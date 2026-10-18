//! Owned late-policy routing; existing reservations and response bodies retain old routes.
use super::{Channel, Error, PickFirst, Pool, Request, Response, ResponseFuture, SubchannelCache};
use crate::grpc_transport::{
    proxy,
    service_config::{PolicyKind, ResolutionConfig},
};
use std::{
    future::Future,
    net::SocketAddr,
    pin::Pin,
    sync::{Arc, Mutex},
    task::{Context, Poll},
};
use tower::Service;
#[path = "grpc_lb_resolution.rs"]
mod resolution;

type PolicyFuture = Pin<Box<dyn Future<Output = Channel> + Send>>;
struct Pending {
    channel: Channel,
    ready: PolicyFuture,
    signature: Vec<PolicyKind>,
    revision: u64,
    addresses: u64,
    membership: u64,
}
fn decision(channel: Channel, membership: u64) -> PolicyFuture {
    Box::pin(async move {
        match channel {
            Channel::RoundRobin(pool) => Channel::RoundRobin(pool.decided_after(membership).await),
            Channel::PickFirst(first) => Channel::PickFirst(first.decided_after(membership).await),
            channel => channel,
        }
    })
}
fn ordered(
    config: &ResolutionConfig,
    kind: PolicyKind,
    addresses: &[SocketAddr],
) -> Vec<SocketAddr> {
    let mut addresses = addresses.to_vec();
    if kind == PolicyKind::PickFirst {
        config.shuffle_addresses(&mut addresses);
    }
    addresses
}
fn revise(
    channel: &Channel,
    addresses: Vec<SocketAddr>,
    policy_config: Option<super::outlier::Policy>,
) -> u64 {
    match channel {
        Channel::RoundRobin(pool) if policy_config.is_some() => {
            pool.update_policy(addresses, policy_config.unwrap())
        }
        Channel::RoundRobin(pool) => pool.update(addresses),
        Channel::PickFirst(first) => first.update(addresses),
        _ => 0,
    }
}
fn pending(
    cache: &SubchannelCache,
    kind: PolicyKind,
    addresses: Vec<SocketAddr>,
    revision: u64,
    address_revision: u64,
    policy_config: Option<super::outlier::Policy>,
) -> Pending {
    let signature = policy_config
        .as_ref()
        .map(|config| config.signature.clone())
        .unwrap_or_else(|| vec![kind]);
    let channel = if matches!(
        kind,
        PolicyKind::WeightedRoundRobin | PolicyKind::OutlierDetection
    ) {
        Channel::RoundRobin(Pool::pending_policy(
            cache.clone(),
            &addresses,
            policy_config.unwrap_or_default(),
        ))
    } else if kind == PolicyKind::RoundRobin {
        Channel::RoundRobin(Pool::pending(cache.clone(), &addresses))
    } else {
        Channel::PickFirst(PickFirst::pending(cache.clone(), addresses))
    };
    let ready = decision(channel.clone(), 0);
    Pending {
        channel,
        ready,
        signature,
        revision,
        addresses: address_revision,
        membership: 0,
    }
}

fn resolution_requests(
    channel: &Channel,
    retain_history: bool,
) -> Option<tokio::sync::watch::Receiver<u64>> {
    let mut requests = match channel {
        Channel::RoundRobin(pool) => pool.resolution_requests(),
        Channel::PickFirst(first) => first.resolution_requests(),
        _ => return None,
    };
    if retain_history && *requests.borrow() != 0 {
        requests.mark_changed();
    }
    Some(requests)
}

struct Owner {
    route: Arc<Mutex<Channel>>,
    task: tokio::task::JoinHandle<()>,
    resolver_task: tokio::task::JoinHandle<()>,
    changes: tokio::sync::watch::Sender<u64>,
}
impl Drop for Owner {
    fn drop(&mut self) {
        self.task.abort();
        self.resolver_task.abort();
    }
}
pub(crate) struct Dynamic {
    owner: Arc<Owner>,
    picked: Option<Box<Channel>>,
    updates: tokio::sync::watch::Receiver<u64>,
    changed: Option<Pin<Box<dyn Future<Output = tokio::sync::watch::Receiver<u64>> + Send>>>,
    granted: bool,
}
impl Clone for Dynamic {
    fn clone(&self) -> Self {
        Self {
            owner: self.owner.clone(),
            picked: None,
            updates: self.owner.changes.subscribe(),
            changed: None,
            granted: false,
        }
    }
}
pub(crate) fn start(
    initial: Channel,
    initial_kind: PolicyKind,
    config: ResolutionConfig,
    subchannels: SubchannelCache,
    addresses: Vec<SocketAddr>,
    resolver: proxy::AddressResolver,
    generation: u64,
    initial_address_revision: u64,
    initial_policy_revision: u64,
) -> Channel {
    let initial_signature = match &initial {
        Channel::RoundRobin(pool) => {
            let state = pool
                .owner
                .state
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            if state.signature.is_empty() {
                vec![initial_kind]
            } else {
                state.signature.clone()
            }
        }
        _ => vec![initial_kind],
    };
    let initial_resolution = resolution_requests(&initial, true);
    let (resolution_source, resolution_receiver) = tokio::sync::watch::channel(initial_resolution);
    let initial_failure = matches!(&initial, Channel::Unavailable(_));
    let route = Arc::new(Mutex::new(initial));
    let state = route.clone();
    let (changes, receiver) = tokio::sync::watch::channel(0_u64);
    let notify = changes.clone();
    let resolver_task = resolution::start(
        resolution_receiver,
        config.clone(),
        resolver.clone(),
        generation,
        initial_failure,
    );
    let mut updates = config.policy_updates();
    // Task captures only route state/config/factories, never the handle owner.
    let task = tokio::spawn(async move {
        let mut active_signature = initial_signature;
        let mut active_addresses = initial_address_revision;
        let mut active_revision = if matches!(
            initial_kind,
            PolicyKind::RoundRobin | PolicyKind::WeightedRoundRobin | PolicyKind::OutlierDetection
        ) {
            initial_policy_revision
        } else {
            0
        };
        let mut candidate: Option<Pending> = None;
        loop {
            updates.borrow_and_update();
            let revision = config.policy_revision();
            if config.generation() != generation {
                return;
            }
            let desired = config.policy_kind();
            // Read configuration before the atomic publication guard; a nested
            // snapshot lock could otherwise deadlock behind a waiting writer.
            let mut policy_config = config.pool_config();
            let desired_signature = policy_config
                .as_ref()
                .map(|config| config.signature.clone())
                .unwrap_or_else(|| vec![desired]);
            let (address_revision, current_addresses) = config
                .addresses(generation)
                .unwrap_or_else(|| (initial_address_revision, addresses.clone()));
            let recovering = matches!(
                &*state.lock().unwrap_or_else(|error| error.into_inner()),
                Channel::Unavailable(_)
            );
            if recovering && current_addresses.is_empty() {
                if updates.changed().await.is_err() {
                    return;
                }
                continue;
            }
            let superseded = candidate
                .as_ref()
                .is_some_and(|pending| pending.signature != desired_signature);
            let replace_pending = superseded
                || (candidate.is_none() && (recovering || active_signature != desired_signature));
            if replace_pending {
                if let Some(config) = &mut policy_config {
                    if let Some(pending) = &candidate {
                        if let Channel::RoundRobin(pool) = &pending.channel {
                            config.retain_parents(pool);
                        }
                    } else {
                        let route = state.lock().unwrap_or_else(|error| error.into_inner());
                        if let Channel::RoundRobin(pool) = &*route {
                            config.retain_parents(pool);
                        }
                    }
                }
            }
            if superseded {
                resolution_source.send_replace(None);
                candidate = None;
            }
            if replace_pending {
                if !superseded {
                    resolution_source.send_replace(None);
                }
                let next = pending(
                    &subchannels,
                    desired,
                    ordered(&config, desired, &current_addresses),
                    revision,
                    address_revision,
                    policy_config,
                );
                if recovering
                    && !config.apply_policy(generation, revision, desired, || {
                        // With no previous child to keep serving, publish the
                        // recovered child's Connecting picker immediately.
                        // New calls can then wait for readiness instead of
                        // receiving the obsolete initial DNS error.
                        let mut route = state.lock().unwrap_or_else(|error| error.into_inner());
                        *route = next.channel.clone();
                        notify.send_modify(|revision| *revision = revision.wrapping_add(1));
                    })
                {
                    continue;
                }
                resolution_source.send_replace(resolution_requests(&next.channel, true));
                if recovering {
                    // This child is already current. Do not later retire it
                    // as though it were an older policy during promotion.
                    active_signature = next.signature;
                    active_revision = revision;
                    active_addresses = address_revision;
                    continue;
                }
                candidate = Some(next);
            } else if let Some(pending) = &mut candidate {
                if pending.revision != revision || pending.addresses != address_revision {
                    let next_addresses = ordered(&config, desired, &current_addresses);
                    let mut membership = 0;
                    if !config.apply_policy(generation, revision, desired, || {
                        membership = revise(&pending.channel, next_addresses, policy_config);
                    }) {
                        continue;
                    }
                    pending.ready = decision(pending.channel.clone(), membership);
                    pending.membership = membership;
                    pending.revision = revision;
                    pending.addresses = address_revision;
                }
            } else {
                if active_revision != revision || active_addresses != address_revision {
                    let next_addresses = ordered(&config, desired, &current_addresses);
                    if !config.apply_policy(generation, revision, desired, || {
                        let route = state.lock().unwrap_or_else(|error| error.into_inner());
                        revise(&route, next_addresses, policy_config);
                    }) {
                        continue;
                    }
                    active_revision = revision;
                    active_addresses = address_revision;
                }
                if updates.changed().await.is_err() {
                    return;
                }
                continue;
            }
            let pending = candidate.as_mut().unwrap();
            let pending_signature = pending.signature.clone();
            let pending_revision = pending.revision;
            let pending_addresses = pending.addresses;
            let channel = tokio::select! {
                biased;
                _ = updates.changed() => { continue; }
                channel = &mut pending.ready => channel,
            };
            if !config.apply_policy(generation, pending_revision, desired, || {
                let mut route = state.lock().unwrap_or_else(|error| error.into_inner());
                match &*route {
                    Channel::RoundRobin(pool) => pool.retire(),
                    Channel::PickFirst(first) => first.retire(),
                    _ => {}
                }
                *route = channel;
                notify.send_modify(|revision| *revision = revision.wrapping_add(1));
            }) {
                pending.ready = decision(pending.channel.clone(), pending.membership);
                continue;
            }
            active_signature = pending_signature;
            active_revision = pending_revision;
            active_addresses = pending_addresses;
            candidate = None;
        }
    });
    Channel::Dynamic(Dynamic {
        owner: Arc::new(Owner {
            route,
            task,
            resolver_task,
            changes,
        }),
        picked: None,
        updates: receiver,
        changed: None,
        granted: false,
    })
}
impl Service<Request> for Dynamic {
    type Response = Response;
    type Error = Error;
    type Future = ResponseFuture;
    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Error>> {
        if self.granted {
            return Poll::Ready(Ok(()));
        }
        loop {
            if self.picked.is_none() {
                let route = self
                    .owner
                    .route
                    .lock()
                    .unwrap_or_else(|error| error.into_inner());
                self.updates.borrow_and_update();
                self.picked = Some(Box::new(route.clone()));
                let mut receiver = self.updates.clone();
                self.changed = Some(Box::pin(async move {
                    let _ = receiver.changed().await;
                    receiver
                }));
            }
            if let Some(changed) = &mut self.changed {
                if let Poll::Ready(receiver) = changed.as_mut().poll(cx) {
                    self.updates = receiver;
                    self.changed = None;
                    self.picked = None;
                    continue;
                }
            }
            let result = self.picked.as_mut().unwrap().poll_ready(cx);
            match &result {
                Poll::Ready(Ok(())) => {
                    self.granted = true;
                    self.changed = None;
                }
                Poll::Ready(Err(_)) => {
                    self.picked = None;
                    self.changed = None;
                }
                Poll::Pending => {}
            }
            return result;
        }
    }
    fn call(&mut self, request: Request) -> Self::Future {
        self.granted = false;
        self.changed = None;
        self.picked
            .take()
            .expect("Policy route must reserve before dispatch")
            .call(request)
    }
}
