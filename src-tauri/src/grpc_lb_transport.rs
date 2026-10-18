//! Shared native subchannels with exact service reservations and a ready-set ring.
use http_body_util::BodyExt;
use hyper_util::rt::TokioIo;
#[path = "grpc_lb_orca.rs"]
mod orca;
#[path = "grpc_lb_outlier.rs"]
pub(super) mod outlier;
#[path = "grpc_lb_pick_first.rs"]
mod pick_first;
#[path = "grpc_lb_policy.rs"]
mod policy;
#[path = "grpc_lb_round_robin.rs"]
mod round_robin;
#[path = "grpc_lb_weighted.rs"]
pub(super) mod weighted;
#[path = "grpc_lb_status.rs"]
mod wire_status;
pub(super) use pick_first::PickFirst;
#[path = "grpc_lb_cache.rs"]
mod cache;
pub(super) use cache::SubchannelCache;
pub(super) use policy::start as route_policy;
use std::{
    collections::BTreeMap,
    fmt,
    future::Future,
    net::SocketAddr,
    pin::Pin,
    sync::{Arc, Mutex, Weak},
    task::{Context, Poll},
    time::Duration,
};
use tokio::sync::{watch, Mutex as AsyncMutex, OwnedMutexGuard};
use tonic::{
    body::Body,
    transport::{Channel as Buffered, ConnectivityState, Endpoint, ReadyConnection},
};
use tower::{Service, ServiceExt};

#[derive(Debug)]
pub(crate) struct Error(Box<dyn std::error::Error + Send + Sync>);
impl fmt::Display for Error {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&describe(self.0.as_ref()))
    }
}
pub(super) fn describe(error: &dyn std::error::Error) -> String {
    let mut message = error.to_string();
    let mut source = error.source();
    while let Some(error) = source {
        let cause = error.to_string();
        if !cause.is_empty() && !message.ends_with(&cause) {
            message.push_str(": ");
            message.push_str(&cause);
        }
        source = error.source();
    }
    message
}
#[derive(Clone)]
struct Diagnostic {
    order: u64,
    message: String,
}
impl Diagnostic {
    fn new(message: String) -> Self {
        use std::sync::atomic::{AtomicU64, Ordering};
        static NEXT: AtomicU64 = AtomicU64::new(1);
        Self {
            order: NEXT.fetch_add(1, Ordering::Relaxed),
            message,
        }
    }
}
fn first_failure(message: &str) -> String {
    format!("No connection established. Last error: {message}. Resolution note: ")
}
impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        Some(self.0.as_ref())
    }
}
impl From<tonic::transport::Error> for Error {
    fn from(error: tonic::transport::Error) -> Self {
        Self(Box::new(error))
    }
}
#[derive(Debug)]
pub(crate) struct NotStarted(Option<tonic::transport::Error>);
impl fmt::Display for NotStarted {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("gRPC subchannel was lost before dispatch")
    }
}
impl std::error::Error for NotStarted {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        self.0
            .as_ref()
            .map(|error| error as &(dyn std::error::Error + 'static))
    }
}
fn before_dispatch(error: Option<tonic::transport::Error>) -> Error {
    Error(Box::new(NotStarted(error)))
}
type Response = tonic::codegen::http::Response<Body>;
type Request = tonic::codegen::http::Request<Body>;
type ResponseFuture = Pin<Box<dyn Future<Output = Result<Response, Error>> + Send>>;
type Guard = OwnedMutexGuard<ReadyConnection>;

struct Entry {
    address: SocketAddr,
    slot: Arc<AsyncMutex<ReadyConnection>>,
    connectivity: watch::Receiver<tonic::transport::Connectivity>,
    task: tokio::task::JoinHandle<()>,
    orca: Mutex<Option<orca::Producer>>,
    error: Arc<Mutex<Option<Diagnostic>>>,
}
impl Drop for Entry {
    fn drop(&mut self) {
        self.task.abort();
    }
}
struct State {
    entries: BTreeMap<usize, Arc<Entry>>,
    next: Option<usize>,
    weights: Option<weighted::Weights>,
    outliers: Vec<outlier::Shared>,
    bindings: BTreeMap<usize, Vec<outlier::Binding>>,
    next_counting: Option<Vec<bool>>,
    last_error: Option<Diagnostic>,
    error_baselines: BTreeMap<SocketAddr, (Weak<Entry>, u64)>,
    signature: Vec<crate::grpc_transport::service_config::PolicyKind>,
}
impl State {
    fn bind_errors(&mut self) {
        self.error_baselines
            .retain(|address, _| self.entries.values().any(|entry| entry.address == *address));
        for entry in self.entries.values() {
            if self
                .error_baselines
                .get(&entry.address)
                .is_some_and(|(previous, _)| previous.ptr_eq(&Arc::downgrade(entry)))
            {
                continue;
            }
            // A newly wrapped cached READY connection emits no failure callback.
            // Seed its old diagnostic version without importing that old error.
            // Retained wrappers keep their baseline so a coalesced fail/recover
            // still contributes the newer diagnostic to this policy's history.
            let before = *entry.connectivity.borrow();
            let order = entry
                .error
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .as_ref()
                .map_or(0, |error| error.order);
            let after = *entry.connectivity.borrow();
            let baseline = if before == after && after.state == ConnectivityState::Ready {
                order
            } else {
                0
            };
            self.error_baselines
                .insert(entry.address, (Arc::downgrade(entry), baseline));
        }
    }
    fn observe_errors(&mut self, leaf: bool) -> bool {
        let incoming = self
            .entries
            .values()
            .filter_map(|entry| {
                let error = entry
                    .error
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .clone()?;
                let baseline = self
                    .error_baselines
                    .get(&entry.address)
                    .map_or(0, |(_, order)| *order);
                (error.order > baseline).then_some(error)
            })
            .max_by_key(|error| error.order);
        if let Some(mut incoming) = incoming {
            if self
                .last_error
                .as_ref()
                .is_none_or(|previous| incoming.order > previous.order)
            {
                if leaf {
                    incoming.message = first_failure(&incoming.message);
                }
                self.last_error = Some(incoming);
                return true;
            }
        }
        false
    }
    fn bindings(&self, key: usize) -> &[outlier::Binding] {
        self.bindings
            .get(&key)
            .map(Vec::as_slice)
            .unwrap_or_default()
    }
    fn publish_outlier_counting(&mut self, membership: bool) {
        // updateAddressList invokes the child before assigning latestConfig.
        // Consume the pre-update flags even if that child only reports Connecting.
        let previous = if membership {
            self.next_counting.take()
        } else {
            None
        };
        let ready = self.entries.iter().any(|(key, entry)| {
            entry.connectivity.borrow().state == ConnectivityState::Ready
                && !outlier::ejected(self.bindings(*key))
        });
        if !ready {
            return;
        }
        for bindings in self.bindings.values_mut() {
            for (index, binding) in bindings.iter_mut().enumerate() {
                binding.publish(
                    previous
                        .as_ref()
                        .and_then(|flags| flags.get(index).copied()),
                );
            }
        }
    }
    fn bind_outliers(&mut self) {
        self.bindings = self
            .entries
            .iter()
            .map(|(key, entry)| (*key, outlier::Binding::new(&self.outliers, entry.address)))
            .collect();
        for bindings in self.bindings.values_mut() {
            for (index, binding) in bindings.iter_mut().enumerate() {
                binding.publish(
                    self.next_counting
                        .as_ref()
                        .and_then(|flags| flags.get(index).copied()),
                );
            }
        }
    }
}
struct Owner {
    state: Arc<Mutex<State>>,
    _updates: watch::Sender<u64>,
    resolution: watch::Sender<u64>,
    connect_requests: watch::Sender<Option<u64>>,
    health: Arc<Mutex<BTreeMap<usize, ConnectivityState>>>,
    addresses: Option<watch::Sender<(u64, Vec<SocketAddr>)>>,
    applied: watch::Sender<u64>,
    membership_task: Option<tokio::task::JoinHandle<()>>,
}
impl Drop for Owner {
    fn drop(&mut self) {
        if let Some(task) = &self.membership_task {
            task.abort();
        }
    }
}
struct HealthReporter {
    key: usize,
    health: Arc<Mutex<BTreeMap<usize, ConnectivityState>>>,
    requests: watch::Sender<u64>,
    previous: Option<tonic::transport::Connectivity>,
    last: Option<ConnectivityState>,
}
impl HealthReporter {
    fn emit(&mut self, state: ConnectivityState, resolution: bool) {
        if self.last == Some(state) {
            return;
        }
        let mut states = self
            .health
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let was_ready = states
            .values()
            .any(|state| *state == ConnectivityState::Ready);
        let previous = states.insert(self.key, state);
        if resolution && was_ready && state != ConnectivityState::Ready && previous != Some(state) {
            self.requests
                .send_modify(|revision| *revision = revision.wrapping_add(1));
        }
        self.last = Some(state);
    }
    fn report(&mut self, snapshot: tonic::transport::Connectivity) {
        self.report_with_resolution(snapshot, true);
    }
    fn report_with_resolution(
        &mut self,
        snapshot: tonic::transport::Connectivity,
        resolution: bool,
    ) {
        // A new Ready generation proves the old connection ended, even if
        // watch coalesced its brief Disconnected/Connecting snapshots.
        if self.previous.is_some_and(|previous| {
            previous.state == ConnectivityState::Ready
                && previous.generation != snapshot.generation
                && snapshot.state == ConnectivityState::Ready
        }) {
            self.emit(ConnectivityState::Disconnected, resolution);
        }
        self.emit(snapshot.state, resolution);
        self.previous = Some(snapshot);
    }
}
pub(crate) struct Pool {
    owner: Arc<Owner>,
    updates: watch::Receiver<u64>,
    locking: Option<Pin<Box<dyn Future<Output = Guard> + Send>>>,
    reserved: Option<Guard>,
    selected_state: Option<watch::Receiver<tonic::transport::Connectivity>>,
    granted_generation: Option<u64>,
    selected_entry: Option<Arc<Entry>>,
    selected_metrics: Option<weighted::Sink>,
    selected_call: Option<outlier::Call>,
    waiting: Option<Pin<Box<dyn Future<Output = watch::Receiver<u64>> + Send>>>,
}
impl Clone for Pool {
    fn clone(&self) -> Self {
        Self {
            owner: self.owner.clone(),
            updates: self.updates.clone(),
            locking: None,
            reserved: None,
            selected_state: None,
            granted_generation: None,
            selected_entry: None,
            selected_metrics: None,
            selected_call: None,
            waiting: None,
        }
    }
}
impl Pool {
    fn from_owner(owner: Arc<Owner>) -> Self {
        Self {
            updates: owner._updates.subscribe(),
            owner,
            locking: None,
            reserved: None,
            selected_state: None,
            granted_generation: None,
            selected_entry: None,
            selected_metrics: None,
            selected_call: None,
            waiting: None,
        }
    }
    fn retire(&self) {
        if let Some(task) = &self.owner.membership_task {
            task.abort();
        }
        let mut state = self
            .owner
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        // Exact dispatched/granted entries and counter callbacks have their own
        // retention; a retired controller must not keep OOB subscriptions alive.
        state.weights = None;
        state.outliers.clear();
        state.bindings.clear();
        state.next_counting = None;
    }
    fn same_owner(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.owner, &other.owner)
    }
    fn state_updates(&self) -> watch::Receiver<u64> {
        self.owner._updates.subscribe()
    }
    fn singleton_state(&self) -> tonic::transport::Connectivity {
        let state = self
            .owner
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let snapshot = *state
            .entries
            .values()
            .next()
            .expect("singleton pool requires an address")
            .connectivity
            .borrow();
        snapshot
    }
    fn last_error(&self) -> Option<Diagnostic> {
        let mut state = self
            .owner
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        state.observe_errors(false);
        state.last_error.clone()
    }
    fn start_connections(endpoint: Endpoint, addresses: &[SocketAddr]) -> Self {
        let (updates, receiver) = watch::channel(0_u64);
        let (resolution, _) = watch::channel(0_u64);
        let (connect_requests, connect_receiver) = watch::channel(None::<u64>);
        let (applied, _) = watch::channel(0_u64);
        let health = Arc::new(Mutex::new(
            (0..addresses.len())
                .map(|key| (key, ConnectivityState::Connecting))
                .collect::<BTreeMap<_, _>>(),
        ));
        let mut entries = BTreeMap::new();
        // The pinned round_robin rotates each new endpoint list by a random
        // signed32 index before starting children, rather than shuffling it.
        let sample = (uuid::Uuid::new_v4().as_u128() as u64 & ((1_u64 << 53) - 1)) as f64
            / (1_u64 << 53) as f64;
        let signed = ((sample * addresses.len() as f64).floor() % 4_294_967_296.0) as u32 as i32;
        let start = if signed < 0 {
            addresses
                .len()
                .saturating_sub(signed.unsigned_abs() as usize)
        } else {
            (signed as usize).min(addresses.len())
        };
        for (key, address) in addresses[start..]
            .iter()
            .chain(addresses[..start].iter())
            .copied()
            .enumerate()
        {
            let connection = endpoint.connect_with_connector_ready_lazy(tower::service_fn(
                move |_| async move {
                    let stream = tokio::net::TcpStream::connect(address).await?;
                    stream.set_nodelay(true)?;
                    Ok::<_, std::io::Error>(TokioIo::new(stream))
                },
            ));
            let connectivity = connection.connectivity();
            let slot = Arc::new(AsyncMutex::new(connection));
            let driver_slot = slot.clone();
            let mut observer = connectivity.clone();
            let changed = updates.clone();
            let health = health.clone();
            let request_resolution = resolution.clone();
            let mut connect = connect_receiver.clone();
            let error = Arc::new(Mutex::new(None));
            let recorded_error = error.clone();
            // This task owns the slot, not Entry/Owner. Entry drop aborts it.
            let task = tokio::spawn(async move {
                let mut next_delay = 1000.0_f64;
                let mut reporter = HealthReporter {
                    key,
                    health,
                    requests: request_resolution,
                    previous: None,
                    last: None,
                };
                loop {
                    let snapshot = *observer.borrow_and_update();
                    reporter.report(snapshot);
                    let state = snapshot.state;
                    match state {
                        ConnectivityState::Shutdown => return,
                        ConnectivityState::Ready => {
                            next_delay = 1000.0;
                            if observer.changed().await.is_err() {
                                return;
                            }
                            changed.send_modify(|revision| *revision = revision.wrapping_add(1));
                        }
                        _ => {
                            if matches!(
                                state,
                                ConnectivityState::Disconnected
                                    | ConnectivityState::TransientFailure
                            ) {
                                // IDLE reconnect and post-backoff continuation
                                // both require the pending child's request for
                                // this exact generation. Retaining Entry alone
                                // must not authorize another connection attempt.
                                loop {
                                    if *connect.borrow_and_update() == Some(snapshot.generation) {
                                        break;
                                    }
                                    if connect.changed().await.is_err() {
                                        return;
                                    }
                                }
                            }
                            // Node timers truncate fractional milliseconds. This delay stays
                            // within the pinned default backoff's 1..144000ms range.
                            let delay = Duration::from_millis(next_delay.trunc() as u64);
                            let sample = (uuid::Uuid::new_v4().as_u128() as u64
                                & ((1_u64 << 53) - 1))
                                as f64
                                / (1_u64 << 53) as f64;
                            next_delay = (next_delay * 1.6).min(120_000.0) * (0.8 + sample * 0.4);
                            let (result, deadline) = {
                                let mut service = driver_slot.lock().await;
                                let mut connecting = *observer.borrow();
                                connecting.state = ConnectivityState::Connecting;
                                reporter.report(connecting);
                                let deadline = tokio::time::Instant::now() + delay;
                                let readiness = service.ready();
                                tokio::pin!(readiness);
                                let result = loop {
                                    tokio::select! {
                                        biased;
                                        result = &mut readiness => break result.map(|_| ()),
                                        result = observer.changed() => {
                                            if result.is_err() { return; }
                                            // Connectivity is independent of
                                            // stream/middleware capacity. Do not
                                            // withhold READY/loss notifications
                                            // until the service becomes ready.
                                            reporter.report(*observer.borrow_and_update());
                                            changed.send_modify(|revision| *revision = revision.wrapping_add(1));
                                        }
                                    }
                                };
                                (result, deadline)
                            };
                            if let Err(error) = &result {
                                *recorded_error
                                    .lock()
                                    .unwrap_or_else(|error| error.into_inner()) =
                                    Some(Diagnostic::new(describe(error)));
                            }
                            let after = *observer.borrow_and_update();
                            reporter.report(after);
                            changed.send_modify(|revision| *revision = revision.wrapping_add(1));
                            if after.state == ConnectivityState::Disconnected {
                                // Retiring an established HTTP2 service is not
                                // a failed new connection/backoff attempt.
                                next_delay = 1000.0;
                            } else if result.is_err() {
                                tokio::time::sleep_until(deadline).await;
                                if *connect.borrow_and_update() != Some(after.generation) {
                                    let service = driver_slot.lock().await;
                                    if service.idle_after_failure(after.generation) {
                                        changed.send_modify(|revision| {
                                            *revision = revision.wrapping_add(1)
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            });
            entries.insert(
                key,
                Arc::new(Entry {
                    address,
                    slot,
                    connectivity,
                    task,
                    orca: Mutex::new(None),
                    error,
                }),
            );
        }
        let owner = Arc::new(Owner {
            state: Arc::new(Mutex::new(State {
                entries,
                next: None,
                weights: None,
                outliers: Vec::new(),
                bindings: BTreeMap::new(),
                next_counting: None,
                last_error: None,
                error_baselines: BTreeMap::new(),
                signature: Vec::new(),
            })),
            _updates: updates,
            resolution,
            connect_requests,
            health,
            addresses: None,
            applied,
            membership_task: None,
        });
        Self {
            owner,
            updates: receiver,
            locking: None,
            reserved: None,
            selected_state: None,
            granted_generation: None,
            selected_entry: None,
            selected_metrics: None,
            selected_call: None,
            waiting: None,
        }
    }
    pub(super) fn resolution_requests(&self) -> watch::Receiver<u64> {
        self.owner.resolution.subscribe()
    }
    pub(super) fn pending(cache: SubchannelCache, addresses: &[SocketAddr]) -> Self {
        round_robin::start(cache, addresses)
    }
    pub(super) fn pending_policy(
        cache: SubchannelCache,
        addresses: &[SocketAddr],
        config: outlier::Policy,
    ) -> Self {
        round_robin::start_policy(cache, addresses, config)
    }
    pub(super) fn update_policy(&self, addresses: Vec<SocketAddr>, config: outlier::Policy) -> u64 {
        {
            let mut state = self
                .owner
                .state
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            state.next_counting = Some(
                (0..config.layers.len())
                    .map(|index| {
                        state.outliers.get(index).is_some_and(|layer| {
                            layer
                                .lock()
                                .unwrap_or_else(|error| error.into_inner())
                                .counting()
                        })
                    })
                    .collect(),
            );
            match (state.weights.as_mut(), config.weighted) {
                (Some(weights), Some(config)) => weights.configure(config),
                (_, Some(config)) => {
                    let current: Vec<_> =
                        state.entries.values().map(|entry| entry.address).collect();
                    state.weights = Some(weighted::Weights::new(config, &current))
                }
                (_, None) => state.weights = None,
            }
            state.signature = config.signature;
            state.outliers.truncate(config.layers.len());
            for (index, config) in config.layers.into_iter().enumerate() {
                if let Some(layer) = state.outliers.get_mut(index) {
                    layer
                        .lock()
                        .unwrap_or_else(|error| error.into_inner())
                        .configure(config);
                } else {
                    state.outliers.push(Arc::new(Mutex::new(outlier::Layer::new(
                        config, &addresses,
                    ))));
                }
            }
        }
        self.update(addresses)
    }
    fn update(&self, addresses: Vec<SocketAddr>) -> u64 {
        let mut revision = 0;
        if let Some(sender) = &self.owner.addresses {
            sender.send_modify(|update| {
                update.0 = update.0.wrapping_add(1);
                update.1 = addresses;
                revision = update.0;
            });
        }
        revision
    }
    fn pending_first(endpoint: Endpoint, address: SocketAddr) -> Self {
        Self::start_connections(endpoint, &[address])
    }
    fn start_connecting(&self) {
        let snapshot = self.singleton_state();
        if matches!(
            snapshot.state,
            ConnectivityState::Disconnected | ConnectivityState::TransientFailure
        ) {
            self.owner
                .connect_requests
                .send_replace(Some(snapshot.generation));
        }
    }
    async fn decided_after(self, revision: u64) -> Self {
        let mut applied = self.owner.applied.subscribe();
        while *applied.borrow_and_update() != revision {
            if applied.changed().await.is_err() {
                return self;
            }
        }
        self.decided().await
    }
    pub(super) async fn decided(mut self) -> Self {
        loop {
            self.updates.borrow_and_update();
            let states: Vec<_> = self
                .owner
                .state
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .entries
                .values()
                .map(|entry| entry.connectivity.borrow().state)
                .collect();
            if states
                .iter()
                .any(|state| *state == ConnectivityState::Ready)
                || !self
                    .owner
                    .health
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .values()
                    .any(|state| *state == ConnectivityState::Connecting)
            {
                break;
            }
            if self.updates.changed().await.is_err() {
                break;
            }
        }
        self
    }
    fn pick(&self) -> Result<Option<(Arc<Entry>, Option<weighted::Sink>, outlier::Call)>, Error> {
        let mut state = self
            .owner
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let ready: Vec<_> = state
            .entries
            .iter()
            .filter_map(|(&key, entry)| {
                (entry.connectivity.borrow().state == ConnectivityState::Ready
                    && !outlier::ejected(state.bindings(key)))
                .then_some((key, entry.clone()))
            })
            .collect();
        if ready.is_empty() {
            state.next = None;
            state.observe_errors(self.owner.membership_task.is_some());
            if self
                .owner
                .health
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .values()
                .any(|state| {
                    matches!(
                        *state,
                        ConnectivityState::Connecting | ConnectivityState::Disconnected
                    )
                })
            {
                return Ok(None);
            }
            let last = state
                .last_error
                .as_ref()
                .map_or("null", |error| error.message.as_str());
            let message = if self.owner.membership_task.is_none() {
                first_failure(last)
            } else {
                let policy = if state.weights.is_some() {
                    "weighted_round_robin"
                } else {
                    "round_robin"
                };
                format!("{policy}: No connection established. Last error: {last}")
            };
            return Err(Error(Box::new(std::io::Error::other(message))));
        }
        if let Some(weights) = &mut state.weights {
            let keys: Vec<_> = ready.iter().map(|(key, _)| *key).collect();
            let mut changed = false;
            for (key, entry) in &ready {
                changed |= weights.connectivity(*key, *entry.connectivity.borrow(), false);
            }
            if changed {
                weights.rebuild(&keys);
            }
            let (key, metrics) = weights.pick(&keys).expect("Weighted READY set is nonempty");
            let entry = ready
                .iter()
                .find(|(candidate, _)| *candidate == key)
                .unwrap()
                .1
                .clone();
            let call = outlier::Call::new(state.bindings(key));
            return Ok(Some((entry, metrics, call)));
        }
        let index = state
            .next
            .and_then(|next| ready.iter().position(|(key, _)| *key == next))
            .unwrap_or(0);
        state.next = Some(ready[(index + 1) % ready.len()].0);
        let call = outlier::Call::new(state.bindings(ready[index].0));
        Ok(Some((ready[index].1.clone(), None, call)))
    }
    fn selection_ready(&self) -> bool {
        self.selected_state.as_ref().is_some_and(|state| {
            let snapshot = *state.borrow();
            snapshot.state == ConnectivityState::Ready
                && self
                    .granted_generation
                    .is_none_or(|generation| generation == snapshot.generation)
        })
    }
}
impl Service<Request> for Pool {
    type Response = Response;
    type Error = Error;
    type Future = ResponseFuture;
    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Error>> {
        loop {
            if self.reserved.is_some() && !self.selection_ready() {
                self.reserved = None;
                self.selected_state = None;
                self.granted_generation = None;
                self.selected_entry = None;
                self.selected_metrics = None;
                self.selected_call = None;
                return Poll::Ready(Err(before_dispatch(None)));
            }
            if let Some(service) = &mut self.reserved {
                let ready = service
                    .poll_ready(cx)
                    .map_err(|error| before_dispatch(Some(error)));
                if matches!(&ready, Poll::Ready(Err(_))) {
                    self.reserved = None;
                    self.selected_state = None;
                    self.granted_generation = None;
                    self.selected_entry = None;
                    self.selected_metrics = None;
                    self.selected_call = None;
                }
                if matches!(&ready, Poll::Ready(Ok(()))) {
                    let snapshot = *self.selected_state.as_ref().unwrap().borrow();
                    if snapshot.state != ConnectivityState::Ready {
                        self.reserved = None;
                        self.selected_state = None;
                        self.granted_generation = None;
                        self.selected_entry = None;
                        self.selected_metrics = None;
                        self.selected_call = None;
                        return Poll::Ready(Err(before_dispatch(None)));
                    }
                    // Bind the actual readiness grant, not the earlier pick:
                    // the same subchannel can reconnect before capacity is granted.
                    self.granted_generation = Some(snapshot.generation);
                }
                return ready;
            }
            if let Some(locking) = &mut self.locking {
                match locking.as_mut().poll(cx) {
                    Poll::Ready(service) => {
                        self.locking = None;
                        self.reserved = Some(service);
                        continue;
                    }
                    Poll::Pending => return Poll::Pending,
                }
            }
            if let Some(waiting) = &mut self.waiting {
                match waiting.as_mut().poll(cx) {
                    Poll::Ready(receiver) => {
                        self.updates = receiver;
                        self.waiting = None;
                    }
                    Poll::Pending => return Poll::Pending,
                }
            }
            self.updates.borrow_and_update();
            if let Some((entry, metrics, call)) = match self.pick() {
                Ok(entry) => entry,
                Err(error) => return Poll::Ready(Err(error)),
            } {
                self.selected_metrics = metrics;
                self.selected_call = Some(call);
                self.selected_state = Some(entry.connectivity.clone());
                self.selected_entry = Some(entry.clone());
                self.locking = Some(Box::pin(entry.slot.clone().lock_owned()));
            } else {
                let mut updates = self.updates.clone();
                self.waiting = Some(Box::pin(async move {
                    let _ = updates.changed().await;
                    updates
                }));
            }
        }
    }
    fn call(&mut self, request: Request) -> Self::Future {
        let still_ready = self.granted_generation.is_some() && self.selection_ready();
        let mut service = self
            .reserved
            .take()
            .expect("Native picker must reserve before dispatch");
        self.selected_state = None;
        self.granted_generation = None;
        if !still_ready {
            self.selected_entry = None;
            self.selected_metrics = None;
            self.selected_call = None;
            drop(service);
            return Box::pin(async { Err(before_dispatch(None)) });
        }
        let future = service.call(request);
        // Request dispatch consumes the reservation; no mutex spans the response.
        drop(service);
        let retained = self
            .selected_entry
            .take()
            .expect("Reserved subchannel must own its entry");
        let metrics = self.selected_metrics.take();
        let mut call = self.selected_call.take().unwrap_or_default();
        call.start();
        Box::pin(async move {
            let mut response = future.await.map_err(Error::from)?;
            wire_status::normalize(response.headers_mut());
            call.observe(response.headers());
            if response.headers().contains_key("grpc-status") {
                if let Some(metrics) = &metrics {
                    metrics.observe(response.headers());
                }
            }
            Ok(response.map(|body| {
                Body::new(body.map_frame(move |mut frame| {
                    let _ = &retained;
                    if let Some(trailers) = frame.trailers_mut() {
                        wire_status::normalize(trailers);
                    }
                    if let Some(trailers) = frame.trailers_ref() {
                        call.observe(trailers);
                    }
                    if let (Some(metrics), Some(trailers)) = (&metrics, frame.trailers_ref()) {
                        metrics.observe(trailers);
                    }
                    frame
                }))
            }))
        })
    }
}
pub(crate) enum Channel {
    Unavailable(Arc<str>),
    Buffered(Buffered),
    RoundRobin(Pool),
    PickFirst(PickFirst),
    Dynamic(policy::Dynamic),
}
impl Clone for Channel {
    fn clone(&self) -> Self {
        match self {
            Self::Unavailable(message) => Self::Unavailable(message.clone()),
            Self::Buffered(channel) => Self::Buffered(channel.clone()),
            Self::RoundRobin(pool) => Self::RoundRobin(pool.clone()),
            Self::PickFirst(first) => Self::PickFirst(first.clone()),
            Self::Dynamic(channel) => Self::Dynamic(channel.clone()),
        }
    }
}
impl From<Buffered> for Channel {
    fn from(channel: Buffered) -> Self {
        Self::Buffered(channel)
    }
}
impl Service<Request> for Channel {
    type Response = Response;
    type Error = Error;
    type Future = ResponseFuture;
    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Error>> {
        match self {
            Self::Unavailable(message) => Poll::Ready(Err(Error(Box::new(std::io::Error::other(
                message.to_string(),
            ))))),
            Self::Buffered(channel) => channel.poll_ready(cx).map_err(Error::from),
            Self::RoundRobin(pool) => pool.poll_ready(cx),
            Self::PickFirst(first) => first.poll_ready(cx),
            Self::Dynamic(channel) => channel.poll_ready(cx),
        }
    }
    fn call(&mut self, request: Request) -> Self::Future {
        match self {
            Self::Unavailable(message) => {
                let error = Error(Box::new(std::io::Error::other(message.to_string())));
                Box::pin(async move { Err(error) })
            }
            Self::Buffered(channel) => {
                let retained = channel.clone();
                let future = channel.call(request);
                Box::pin(async move {
                    let mut response = future.await.map_err(Error::from)?;
                    wire_status::normalize(response.headers_mut());
                    Ok(response.map(|body| {
                        Body::new(body.map_frame(move |mut frame| {
                            let _ = &retained;
                            if let Some(trailers) = frame.trailers_mut() {
                                wire_status::normalize(trailers);
                            }
                            frame
                        }))
                    }))
                })
            }
            Self::RoundRobin(pool) => pool.call(request),
            Self::PickFirst(first) => first.call(request),
            Self::Dynamic(channel) => channel.call(request),
        }
    }
}
