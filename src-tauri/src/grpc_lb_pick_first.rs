//! Owned pick_first selection over native singleton subchannels.
use super::{Channel, Error, Pool, Request, Response, ResponseFuture, SubchannelCache};
use futures_util::{stream::FuturesUnordered, StreamExt};
use std::{
    collections::VecDeque,
    future::Future,
    net::SocketAddr,
    pin::Pin,
    sync::{Arc, Mutex},
    task::{Context, Poll},
    time::Duration,
};
use tokio::sync::watch;
use tonic::transport::{Connectivity, ConnectivityState};
use tower::Service;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Phase {
    Idle,
    Connecting,
    Failed,
    Ready,
}
#[derive(Clone)]
struct View {
    selected: Option<Arc<Mutex<Pool>>>,
    phase: Phase,
    last_error: Option<String>,
}
struct Owner {
    view: watch::Sender<View>,
    addresses: watch::Sender<(u64, Vec<SocketAddr>)>,
    applied: watch::Sender<u64>,
    wake: watch::Sender<u64>,
    requests: watch::Sender<u64>,
    task: tokio::task::JoinHandle<()>,
}
impl Drop for Owner {
    fn drop(&mut self) {
        self.task.abort();
    }
}
pub(crate) struct PickFirst {
    owner: Arc<Owner>,
    view: watch::Receiver<View>,
    picked: Option<Pool>,
    changed: Option<Pin<Box<dyn Future<Output = watch::Receiver<View>> + Send>>>,
    granted: bool,
}
impl Clone for PickFirst {
    fn clone(&self) -> Self {
        Self {
            owner: self.owner.clone(),
            view: self.owner.view.subscribe(),
            picked: None,
            changed: None,
            granted: false,
        }
    }
}
struct Child {
    address: SocketAddr,
    pool: Option<Pool>,
    updates: Option<watch::Receiver<u64>>,
    previous: Option<Connectivity>,
    failed: bool,
}
fn interleave(addresses: Vec<SocketAddr>) -> Vec<SocketAddr> {
    let first_v6 = addresses.first().is_some_and(SocketAddr::is_ipv6);
    let (mut first, mut second): (VecDeque<_>, VecDeque<_>) = addresses
        .into_iter()
        .partition(|address| address.is_ipv6() == first_v6);
    let mut result = Vec::with_capacity(first.len() + second.len());
    while !first.is_empty() || !second.is_empty() {
        if let Some(address) = first.pop_front() {
            result.push(address);
        }
        if let Some(address) = second.pop_front() {
            result.push(address);
        }
    }
    result
}
fn publish(
    view: &watch::Sender<View>,
    current: &Option<(SocketAddr, Pool, watch::Receiver<u64>)>,
    phase: Phase,
    error: &Option<super::Diagnostic>,
) {
    view.send_if_modified(|view| {
        let last_error = error.as_ref().map(|error| error.message.clone());
        let selected = current.as_ref().map(|(_, pool, _)| pool);
        let same = match (&view.selected, selected) {
            (Some(old), Some(new)) => old
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .same_owner(new),
            (None, None) => true,
            _ => false,
        };
        if same && view.phase == phase && view.last_error == last_error {
            return false;
        }
        *view = View {
            selected: selected.map(|pool| Arc::new(Mutex::new(pool.clone()))),
            phase,
            last_error,
        };
        true
    });
}
fn activate(
    children: &mut [Child],
    next: &mut usize,
    cache: &SubchannelCache,
) -> Option<tokio::time::Instant> {
    while let Some(child) = children.get_mut(*next) {
        *next += 1;
        if child
            .pool
            .as_ref()
            .is_some_and(|pool| pool.singleton_state().state == ConnectivityState::TransientFailure)
        {
            continue;
        }
        if child.pool.is_none() {
            let pool = cache.get_or_create(child.address);
            child.updates = Some(pool.state_updates());
            child.pool = Some(pool);
        }
        child.pool.as_ref().unwrap().start_connecting();
        return Some(tokio::time::Instant::now() + Duration::from_millis(250));
    }
    None
}
impl PickFirst {
    pub(super) fn retire(&self) {
        self.owner.task.abort();
    }

    pub(crate) fn pending(cache: SubchannelCache, addresses: Vec<SocketAddr>) -> Self {
        let (view, receiver) = watch::channel(View {
            selected: None,
            phase: Phase::Connecting,
            last_error: None,
        });
        let (address_sender, mut addresses) = watch::channel((0_u64, addresses));
        let (applied, _) = watch::channel(0_u64);
        let published = applied.clone();
        addresses.mark_changed();
        let (wake, mut demand) = watch::channel(0_u64);
        let (requests, _) = watch::channel(0_u64);
        let state = view.clone();
        let resolution = requests.clone();
        // The worker captures senders/state, never its JoinHandle owner.
        let task = tokio::spawn(async move {
            let mut current: Option<(SocketAddr, Pool, watch::Receiver<u64>)> = None;
            let mut current_generation = None;
            let mut children: Vec<Child> = Vec::new();
            let mut latest = Vec::new();
            let mut next = 0;
            let mut timer = None;
            let mut sticky = false;
            let mut membership_revision = 0;
            let mut last_error: Option<super::Diagnostic> = None;
            loop {
                let address_update = addresses.has_changed().unwrap_or(false);
                let requested = demand.has_changed().unwrap_or(false);
                if address_update || (requested && current.is_none() && children.is_empty()) {
                    demand.borrow_and_update();
                    if address_update {
                        let update = addresses.borrow_and_update().clone();
                        membership_revision = update.0;
                        latest = interleave(update.1);
                    }
                    // connectToAddressList scans all cached READY subchannels
                    // in the new list's order, not just the current pick.
                    let cached = latest.iter().find_map(|address| {
                        let pool = cache.peek(*address)?;
                        let snapshot = pool.singleton_state();
                        (snapshot.state == ConnectivityState::Ready).then(|| {
                            (
                                snapshot.generation,
                                (*address, pool.clone(), pool.state_updates()),
                            )
                        })
                    });
                    if let Some((generation, cached)) = cached {
                        current = Some(cached);
                        current_generation = Some(generation);
                        children.clear();
                        next = 0;
                        timer = None;
                        sticky = false;
                    } else {
                        let mut old = std::mem::take(&mut children);
                        children = latest
                            .iter()
                            .map(|address| {
                                if let Some(index) =
                                    old.iter().position(|child| child.address == *address)
                                {
                                    let mut child = old.swap_remove(index);
                                    child.previous = child.pool.as_ref().map(Pool::singleton_state);
                                    child.failed = child.previous.is_some_and(|snapshot| {
                                        snapshot.state == ConnectivityState::TransientFailure
                                    });
                                    child
                                } else {
                                    let pool = cache.peek(*address);
                                    let updates = pool.as_ref().map(Pool::state_updates);
                                    let previous = pool.as_ref().map(Pool::singleton_state);
                                    Child {
                                        address: *address,
                                        pool,
                                        updates,
                                        previous,
                                        failed: previous.is_some_and(|snapshot| {
                                            snapshot.state == ConnectivityState::TransientFailure
                                        }),
                                    }
                                }
                            })
                            .collect();
                        next = 0;
                        timer = activate(&mut children, &mut next, &cache);
                    }
                } else if requested {
                    demand.borrow_and_update();
                }

                if let Some((_, pool, updates)) = &mut current {
                    updates.borrow_and_update();
                    let snapshot = pool.singleton_state();
                    if snapshot.state != ConnectivityState::Ready
                        || current_generation != Some(snapshot.generation)
                    {
                        current = None;
                        current_generation = None;
                    }
                }
                let mut winner: Option<(u64, usize, u64)> = None;
                let mut advance = false;
                for (index, child) in children.iter_mut().enumerate() {
                    let Some(pool) = &child.pool else {
                        continue;
                    };
                    child.updates.as_mut().unwrap().borrow_and_update();
                    let snapshot = pool.singleton_state();
                    if let Some(error) = pool.last_error() {
                        if last_error
                            .as_ref()
                            .is_none_or(|previous| error.order > previous.order)
                        {
                            last_error = Some(error);
                        }
                    }
                    if snapshot.state == ConnectivityState::Ready {
                        // Watch can coalesce notifications from several ready
                        // candidates. Pick by transport READY observation order
                        // rather than by the order in which we scan addresses.
                        if winner.is_none_or(|(sequence, _, _)| snapshot.ready_sequence < sequence)
                        {
                            winner = Some((snapshot.ready_sequence, index, snapshot.generation));
                        }
                    }
                    let changed = child.previous.is_none_or(|previous| {
                        previous.generation != snapshot.generation
                            || previous.state != snapshot.state
                    });
                    let missed_failure = child
                        .previous
                        .is_some_and(|previous| previous.failures != snapshot.failures);
                    if (changed || missed_failure)
                        && matches!(
                            snapshot.state,
                            ConnectivityState::Disconnected | ConnectivityState::TransientFailure
                        )
                    {
                        pool.start_connecting();
                    }
                    if missed_failure
                        || (changed && snapshot.state == ConnectivityState::TransientFailure)
                    {
                        child.failed = true;
                        if index + 1 == next {
                            advance = true;
                        }
                    }
                    child.previous = Some(snapshot);
                }
                if let Some((_, index, generation)) = winner {
                    let mut child = children.swap_remove(index);
                    let pool = child.pool.take().unwrap();
                    let updates = child.updates.take().unwrap();
                    current = Some((child.address, pool, updates));
                    current_generation = Some(generation);
                    children.clear();
                    next = 0;
                    timer = None;
                    sticky = false;
                } else {
                    if !children.is_empty() && children.iter().all(|child| child.failed) {
                        resolution.send_modify(|revision| *revision = revision.wrapping_add(1));
                        // Pinned grpc-js1.14.4 uses every(child => child.flag =
                        // false): the false assignment short-circuits after
                        // the first child. Preserve that failure-round rule.
                        if let Some(first) = children.first_mut() {
                            first.failed = false;
                        }
                        if !sticky {
                            for child in &children {
                                if let Some(pool) = &child.pool {
                                    pool.start_connecting();
                                }
                            }
                        }
                        sticky = true;
                    }
                    if advance || timer.is_some_and(|due| due <= tokio::time::Instant::now()) {
                        timer = activate(&mut children, &mut next, &cache);
                    }
                }
                let phase = if current.is_some() {
                    Phase::Ready
                } else if sticky || latest.is_empty() {
                    Phase::Failed
                } else if children.is_empty() {
                    Phase::Idle
                } else {
                    Phase::Connecting
                };
                publish(&state, &current, phase, &last_error);
                published.send_replace(membership_revision);

                let mut events = FuturesUnordered::new();
                for updates in current
                    .iter()
                    .map(|(_, _, updates)| updates)
                    .chain(children.iter().filter_map(|child| child.updates.as_ref()))
                {
                    let mut updates = updates.clone();
                    events.push(async move {
                        let _ = updates.changed().await;
                    });
                }
                tokio::select! {
                    _ = addresses.changed() => { addresses.mark_changed(); },
                    _ = demand.changed() => { demand.mark_changed(); },
                    Some(_) = events.next() => {},
                    _ = async { if let Some(due) = timer { tokio::time::sleep_until(due).await; } else { std::future::pending::<()>().await; } } => {},
                }
            }
        });
        Self {
            owner: Arc::new(Owner {
                view,
                addresses: address_sender,
                applied,
                wake,
                requests,
                task,
            }),
            view: receiver,
            picked: None,
            changed: None,
            granted: false,
        }
    }
    pub(crate) async fn decided(mut self) -> Self {
        loop {
            if self.view.borrow_and_update().phase != Phase::Connecting {
                return self;
            }
            if self.view.changed().await.is_err() {
                return self;
            }
        }
    }
    pub(super) fn update(&self, addresses: Vec<SocketAddr>) -> u64 {
        let mut revision = 0;
        self.owner.addresses.send_modify(|update| {
            update.0 = update.0.wrapping_add(1);
            update.1 = addresses;
            revision = update.0;
        });
        revision
    }
    pub(super) async fn decided_after(self, revision: u64) -> Self {
        let mut applied = self.owner.applied.subscribe();
        while *applied.borrow_and_update() != revision {
            if applied.changed().await.is_err() {
                return self;
            }
        }
        self.decided().await
    }
    pub(super) fn resolution_requests(&self) -> watch::Receiver<u64> {
        self.owner.requests.subscribe()
    }
}
impl Service<Request> for PickFirst {
    type Response = Response;
    type Error = Error;
    type Future = ResponseFuture;
    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Error>> {
        if self.granted {
            return self.picked.as_mut().unwrap().poll_ready(cx);
        }
        loop {
            if let Some(changed) = &mut self.changed {
                if let Poll::Ready(view) = changed.as_mut().poll(cx) {
                    self.view = view;
                    self.changed = None;
                    self.picked = None;
                }
            }
            if self.changed.is_none() {
                let view = self.view.borrow_and_update().clone();
                self.picked = view.selected.map(|pool| {
                    pool.lock()
                        .unwrap_or_else(|error| error.into_inner())
                        .clone()
                });
                match view.phase {
                    Phase::Idle => self
                        .owner
                        .wake
                        .send_modify(|revision| *revision = revision.wrapping_add(1)),
                    Phase::Failed => {
                        return Channel::Unavailable(Arc::from(super::first_failure(
                            view.last_error.as_deref().unwrap_or("null"),
                        )))
                        .poll_ready(cx)
                    }
                    _ => {}
                }
                let mut view = self.view.clone();
                self.changed = Some(Box::pin(async move {
                    let _ = view.changed().await;
                    view
                }));
                continue;
            }
            if let Some(pool) = &mut self.picked {
                let result = pool.poll_ready(cx);
                if matches!(result, Poll::Ready(Ok(()))) {
                    self.granted = true;
                    self.changed = None;
                }
                return result;
            }
            return Poll::Pending;
        }
    }
    fn call(&mut self, request: Request) -> Self::Future {
        self.granted = false;
        self.picked
            .take()
            .expect("pick_first must reserve before dispatch")
            .call(request)
    }
}
