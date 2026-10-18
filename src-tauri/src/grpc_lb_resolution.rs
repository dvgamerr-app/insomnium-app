//! One event-driven re-resolution worker per logical route owner.
use super::{proxy, ResolutionConfig};
use tokio::{sync::watch, task::JoinHandle};

pub(super) fn start(
    mut sources: watch::Receiver<Option<watch::Receiver<u64>>>,
    config: ResolutionConfig,
    resolve: proxy::AddressResolver,
    generation: u64,
    initial_failure: bool,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        let mut policies = config.policy_updates();
        let mut timing = config.resolution_updates();
        // Same-target TXT/address notifications must not cancel an active DNS
        // lookup; only target retirement terminates this future.
        let retired = async {
            loop {
                if config.generation() != generation {
                    return;
                }
                if policies.changed().await.is_err() {
                    return;
                }
            }
        };
        tokio::pin!(retired);
        // Before the first successful address publication there is no child
        // policy to request resolution. The logical owner must drive recovery;
        // resolve itself waits for the failed lookup's backoff deadline.
        while initial_failure {
            tokio::select! {
                biased;
                _ = &mut retired => return,
                result = resolve() => { if result.is_ok() { break; } }
            }
        }
        loop {
            let requests = sources.borrow_and_update().clone();
            let Some(mut requests) = requests else {
                tokio::select! {
                    biased;
                    _ = &mut retired => return,
                    result = sources.changed() => { if result.is_err() { return; } }
                }
                continue;
            };
            // The policy owner supplies the latest child's subscription before
            // waiting for Connecting to finish. This worker retains its cursor;
            // promotion does not replay historical requests from that pool.
            loop {
                tokio::select! {
                    biased;
                    _ = &mut retired => return,
                    result = sources.changed() => {
                        if result.is_err() { return; }
                        break;
                    }
                    result = requests.changed() => {
                        if result.is_err() {
                            // A retired child may close before its replacement
                            // publication is observed. Do not spin on its EOF.
                            tokio::select! {
                                biased;
                                _ = &mut retired => return,
                                result = sources.changed() => { if result.is_err() { return; } }
                            }
                            break;
                        }
                    }
                }
                if config.generation() != generation {
                    return;
                }
                let lookup = async {
                    loop {
                        // Do not lose a requested update merely because the cached
                        // result is still inside the minimum resolution interval.
                        loop {
                            timing.borrow_and_update();
                            let Some(due) = config.resolution_due(generation) else {
                                break;
                            };
                            if due <= tokio::time::Instant::now() {
                                break;
                            }
                            tokio::select! {
                                _ = tokio::time::sleep_until(due) => break,
                                result = timing.changed() => { if result.is_err() { return; } }
                            }
                        }
                        if config.generation() != generation || resolve().await.is_ok() {
                            break;
                        }
                        // A failed requested lookup keeps resolution active. Its
                        // backoff deadline replaces the minimum-interval deadline;
                        // do not wait for another child connectivity notification.
                    }
                };
                tokio::pin!(lookup);
                tokio::select! {
                    biased;
                    _ = &mut retired => return,
                    _ = &mut lookup => {}
                }
                // A replacement child may have requested resolution while the
                // accepted lookup was pending. Adopt its cursor now so those
                // requests are coalesced too, rather than replayed as a new
                // lookup when sources.changed() is observed on the next loop.
                let latest = sources.borrow_and_update().clone();
                let Some(latest) = latest else {
                    break;
                };
                requests = latest;
                // Ignore additional requests during this in-flight lookup,
                // including the latest child's pre-subscription history.
                requests.borrow_and_update();
            }
        }
    })
}
