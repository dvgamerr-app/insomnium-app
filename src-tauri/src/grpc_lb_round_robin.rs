//! Per-policy RR membership over shared endpoint-scoped singleton subchannels.
use super::{
    outlier, weighted, ConnectivityState, Entry, HealthReporter, Owner, Pool, State,
    SubchannelCache,
};
use futures_util::{stream::FuturesUnordered, StreamExt};
use std::{
    collections::BTreeMap,
    net::SocketAddr,
    sync::{Arc, Mutex},
};
use tokio::sync::watch;

type Member = (Pool, watch::Receiver<u64>, HealthReporter, bool);
fn member_address(member: &Member) -> SocketAddr {
    member
        .0
        .owner
        .state
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .entries
        .values()
        .next()
        .expect("cached singleton requires an address")
        .address
}
fn build(
    cache: &SubchannelCache,
    addresses: &[SocketAddr],
    health: &Arc<Mutex<BTreeMap<usize, ConnectivityState>>>,
    resolution: &watch::Sender<u64>,
    weighted: bool,
    previous: Vec<Member>,
) -> (BTreeMap<usize, Arc<Entry>>, Vec<Member>) {
    let mut retained = BTreeMap::new();
    if weighted {
        for member in previous {
            retained.insert(member_address(&member), member);
        }
    }
    let sample =
        (uuid::Uuid::new_v4().as_u128() as u64 & ((1_u64 << 53) - 1)) as f64 / (1_u64 << 53) as f64;
    let signed = ((sample * addresses.len() as f64).floor() % 4_294_967_296.0) as u32 as i32;
    let start = if weighted {
        0
    } else if signed < 0 {
        addresses
            .len()
            .saturating_sub(signed.unsigned_abs() as usize)
    } else {
        (signed as usize).min(addresses.len())
    };
    let mut entries = BTreeMap::new();
    let mut members = Vec::new();
    for (key, address) in addresses[start..]
        .iter()
        .chain(addresses[..start].iter())
        .copied()
        .enumerate()
    {
        if let Some(mut member) = retained.remove(&address) {
            member.2.key = key;
            let entry = member
                .0
                .owner
                .state
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .entries
                .values()
                .next()
                .expect("cached singleton requires an address")
                .clone();
            entries.insert(key, entry);
            member.0.start_connecting();
            members.push(member);
            continue;
        }
        let member = cache.get_or_create(address);
        let entry = member
            .owner
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .entries
            .values()
            .next()
            .expect("cached singleton requires an address")
            .clone();
        entries.insert(key, entry);
        member.start_connecting();
        let receiver = member.state_updates();
        members.push((
            member,
            receiver,
            HealthReporter {
                key,
                health: health.clone(),
                requests: resolution.clone(),
                previous: None,
                last: None,
            },
            false,
        ));
    }
    (entries, members)
}
pub(super) fn start(cache: SubchannelCache, addresses: &[SocketAddr]) -> Pool {
    start_inner(cache, addresses, outlier::Policy::default())
}
pub(super) fn start_policy(
    cache: SubchannelCache,
    addresses: &[SocketAddr],
    config: outlier::Policy,
) -> Pool {
    start_inner(cache, addresses, config)
}
fn start_inner(cache: SubchannelCache, addresses: &[SocketAddr], config: outlier::Policy) -> Pool {
    let weighted = config.weighted.is_some();
    let (updates, _) = watch::channel(0_u64);
    let (resolution, _) = watch::channel(0_u64);
    let (connect_requests, _) = watch::channel(None);
    let health = Arc::new(Mutex::new(
        (0..addresses.len())
            .map(|key| (key, ConnectivityState::Connecting))
            .collect::<BTreeMap<_, _>>(),
    ));
    let (entries, mut members) = build(
        &cache,
        addresses,
        &health,
        &resolution,
        weighted,
        Vec::new(),
    );
    let state = Arc::new(Mutex::new(State {
        entries,
        next: None,
        weights: config
            .weighted
            .map(|config| weighted::Weights::new(config, addresses)),
        outliers: config
            .layers
            .into_iter()
            .enumerate()
            .map(|(index, layer_config)| {
                let layer = config.shared.get(index).cloned().unwrap_or_else(|| {
                    Arc::new(Mutex::new(outlier::Layer::new(layer_config, addresses)))
                });
                layer
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .membership(addresses);
                layer
            })
            .collect(),
        signature: config.signature,
        bindings: BTreeMap::new(),
        next_counting: Some(config.counting),
        last_error: None,
        error_baselines: BTreeMap::new(),
    }));
    {
        let mut state = state.lock().unwrap_or_else(|error| error.into_inner());
        state.bind_outliers();
        state.bind_errors();
    }
    let membership = state.clone();
    let observed_health = health.clone();
    let request_resolution = resolution.clone();
    let (address_sender, mut addresses) = watch::channel((0_u64, addresses.to_vec()));
    let (applied, _) = watch::channel(0_u64);
    let published = applied.clone();
    let notify = updates.clone();
    // The controller owns membership/cache state, never the RR owner storing
    // its JoinHandle. Cached entries never point back to this controller.
    let membership_task = tokio::spawn(async move {
        let mut health_updates: Vec<_> = membership
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .outliers
            .iter()
            .map(|layer| {
                layer
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .changes()
            })
            .collect();
        let mut initialized = false;
        let mut replace_ready = false;
        let mut membership_revision = 0;
        let mut next_refresh = tokio::time::Instant::now();
        loop {
            // Consume before observing state: a change during the observation/
            // subscription gap remains pending on the cloned receiver.
            for receiver in &mut health_updates {
                receiver.borrow_and_update();
            }
            let (weighted, diagnostic_changed) = {
                let mut state = membership.lock().unwrap_or_else(|error| error.into_inner());
                for layer in &mut state.outliers {
                    layer
                        .lock()
                        .unwrap_or_else(|error| error.into_inner())
                        .tick();
                }
                let diagnostic_changed = state.observe_errors(true);
                (state.weights.is_some(), diagnostic_changed)
            };
            let mut applied_membership = !initialized;
            let mut publish_picker = !initialized
                || diagnostic_changed
                || (weighted && next_refresh <= tokio::time::Instant::now());
            if addresses.has_changed().unwrap_or(false) {
                publish_picker = true;
                applied_membership = true;
                let update = addresses.borrow_and_update().clone();
                membership_revision = update.0;
                let mut addresses = update.1;
                if weighted {
                    // Map insertion order survives resolver list reordering.
                    // New endpoints append in this update's input order.
                    let mut ordered: Vec<_> = members
                        .iter()
                        .map(member_address)
                        .filter(|address| addresses.contains(address))
                        .collect();
                    for address in addresses {
                        if !ordered.contains(&address) {
                            ordered.push(address);
                        }
                    }
                    addresses = ordered;
                }
                replace_ready = observed_health
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .values()
                    .any(|state| *state == ConnectivityState::Ready);
                let (entries, next_members) = build(
                    &cache,
                    &addresses,
                    &observed_health,
                    &request_resolution,
                    weighted,
                    std::mem::take(&mut members),
                );
                members = next_members;
                let mut state = membership.lock().unwrap_or_else(|error| error.into_inner());
                state.entries = entries;
                state.next = None;
                for layer in &mut state.outliers {
                    layer
                        .lock()
                        .unwrap_or_else(|error| error.into_inner())
                        .membership(&addresses);
                }
                state.bind_outliers();
                state.bind_errors();
                if let Some(weights) = &mut state.weights {
                    weights.membership(&addresses);
                    next_refresh = tokio::time::Instant::now() + weights.interval();
                }
                *observed_health
                    .lock()
                    .unwrap_or_else(|error| error.into_inner()) = members
                    .iter()
                    .map(|(_, _, reporter, _)| {
                        (
                            reporter.key,
                            reporter.last.unwrap_or(ConnectivityState::Connecting),
                        )
                    })
                    .collect();
                initialized = false;
            }
            for (member, receiver, reporter, sticky) in &mut members {
                receiver.borrow_and_update();
                let transport = member.singleton_state();
                let mut snapshot = transport;
                {
                    let mut state = membership.lock().unwrap_or_else(|error| error.into_inner());
                    if snapshot.state == ConnectivityState::Ready
                        && outlier::ejected(state.bindings(reporter.key))
                    {
                        if !(weighted && applied_membership)
                            && reporter.previous.is_none_or(|previous| {
                                previous.state != ConnectivityState::TransientFailure
                                    || previous.generation != snapshot.generation
                            })
                        {
                            if let Some(entry) = state.entries.get(&reporter.key) {
                                state.last_error = Some(super::Diagnostic::new(format!(
                                    "Picked subchannel {} is unhealthy",
                                    entry.address
                                )));
                            }
                        }
                        snapshot.state = ConnectivityState::TransientFailure;
                    }
                    if let Some(weights) = &mut state.weights {
                        weights.connectivity(reporter.key, snapshot, applied_membership);
                        weights.subscribe(reporter.key, member, applied_membership);
                    }
                }
                // A reference RR leaf is singleton PickFirst and forwards its
                // all-addresses-failed request independently of whether the RR
                // parent has ever been READY. Preserve an initial cached TF,
                // and a new failure coalesced into a later snapshot, once each.
                let leaf_failed = match reporter.previous {
                    Some(previous) => previous.failures != snapshot.failures,
                    None => transport.state == ConnectivityState::TransientFailure,
                };
                if leaf_failed {
                    request_resolution.send_modify(|revision| *revision = revision.wrapping_add(1));
                }
                // PF picking a READY transport clears sticky network failure
                // even when the wrapper then reports that pick as unhealthy.
                if transport.state == ConnectivityState::Ready {
                    *sticky = false;
                }
                if transport.state == ConnectivityState::TransientFailure
                    || (transport.state != ConnectivityState::Ready
                        && reporter
                            .previous
                            .is_some_and(|previous| previous.failures != snapshot.failures))
                {
                    *sticky = true;
                }
                member.start_connecting();
                // Each reference RR leaf is a singleton PickFirst: once all
                // its addresses fail, retry Connecting remains failure until READY.
                if *sticky
                    && snapshot.state != ConnectivityState::Ready
                    && snapshot.state != ConnectivityState::Shutdown
                {
                    snapshot.state = ConnectivityState::TransientFailure;
                }
                publish_picker |= reporter.previous != Some(snapshot);
                if weighted
                    && applied_membership
                    && snapshot.state == ConnectivityState::TransientFailure
                {
                    let mut state = membership.lock().unwrap_or_else(|error| error.into_inner());
                    if let Some(entry) = state.entries.get(&reporter.key) {
                        let message = if transport.state == ConnectivityState::Ready {
                            format!("Picked subchannel {} is unhealthy", entry.address)
                        } else {
                            let error = entry
                                .error
                                .lock()
                                .unwrap_or_else(|error| error.into_inner());
                            super::first_failure(
                                error
                                    .as_ref()
                                    .map_or("null", |error| error.message.as_str()),
                            )
                        };
                        // A repeated TF callback still replaces the parent's
                        // lastError, in retained-map callback order.
                        state.last_error = Some(super::Diagnostic::new(message));
                    }
                }
                if weighted
                    && applied_membership
                    && replace_ready
                    && (snapshot.state != ConnectivityState::Ready
                        || reporter.previous.is_some_and(|previous| {
                            previous.state == ConnectivityState::Ready
                                && previous.generation != snapshot.generation
                        }))
                {
                    // startConnecting updates the retained leaf's PF child even
                    // when its state repeats. Parent updates are paused until
                    // all members finish, so use the pre-update READY state.
                    request_resolution.send_modify(|revision| *revision = revision.wrapping_add(1));
                }
                if initialized || (weighted && reporter.previous.is_some()) {
                    reporter.report_with_resolution(snapshot, !(weighted && applied_membership));
                } else {
                    // Seed this policy's first batch without treating cached
                    // initial states as connection losses from a READY parent.
                    reporter
                        .health
                        .lock()
                        .unwrap_or_else(|error| error.into_inner())
                        .insert(reporter.key, snapshot.state);
                    reporter.last = Some(snapshot.state);
                    reporter.previous = Some(snapshot);
                    if !weighted && replace_ready && snapshot.state != ConnectivityState::Ready {
                        request_resolution
                            .send_modify(|revision| *revision = revision.wrapping_add(1));
                    }
                }
            }
            initialized = true;
            replace_ready = false;
            if weighted && publish_picker {
                let mut state = membership.lock().unwrap_or_else(|error| error.into_inner());
                let ready: Vec<_> = state
                    .entries
                    .iter()
                    .filter_map(|(key, entry)| {
                        (entry.connectivity.borrow().state == ConnectivityState::Ready
                            && !outlier::ejected(state.bindings(*key)))
                        .then_some(*key)
                    })
                    .collect();
                if let Some(weights) = &mut state.weights {
                    weights.rebuild(&ready);
                    if next_refresh <= tokio::time::Instant::now() {
                        next_refresh = tokio::time::Instant::now() + weights.interval();
                    }
                }
            }
            if publish_picker {
                membership
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .publish_outlier_counting(applied_membership);
                notify.send_modify(|revision| *revision = revision.wrapping_add(1));
            }
            published.send_replace(membership_revision);
            let mut events = FuturesUnordered::new();
            for receiver in members
                .iter()
                .map(|(_, receiver, _, _)| receiver)
                .chain(health_updates.iter())
            {
                let mut receiver = receiver.clone();
                events.push(async move {
                    let _ = receiver.changed().await;
                });
            }
            let outlier_due = membership
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .outliers
                .iter()
                .filter_map(|layer| {
                    layer
                        .lock()
                        .unwrap_or_else(|error| error.into_inner())
                        .due()
                })
                .min();
            tokio::select! {
                result = addresses.changed() => {
                    if result.is_err() { return; }
                    addresses.mark_changed();
                }
                _ = events.next(), if !events.is_empty() => {}
                _ = tokio::time::sleep_until(next_refresh), if weighted => {}
                _ = async { tokio::time::sleep_until(outlier_due.expect("guarded outlier timer")).await }, if outlier_due.is_some() => {}
            }
        }
    });
    Pool::from_owner(Arc::new(Owner {
        state,
        _updates: updates,
        resolution,
        connect_requests,
        health,
        addresses: Some(address_sender),
        applied,
        membership_task: Some(membership_task),
    }))
}
