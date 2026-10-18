//! Process-wide native singleton reuse with immutable endpoint/credential scope.
use super::{Owner, Pool};
use std::{
    collections::BTreeMap,
    net::SocketAddr,
    sync::{Arc, Mutex, OnceLock},
    time::Duration,
};
use tonic::transport::Endpoint;

#[derive(Clone)]
pub(crate) struct SubchannelCache(Arc<CacheOwner>);
#[derive(Clone, PartialEq, Eq, PartialOrd, Ord)]
struct Scope {
    target: String,
    origin: String,
    connect_timeout: Option<Duration>,
    // Each channel() construction makes a new TLS context. grpc-js compares
    // those contexts by identity, not by certificate content. Cloning this
    // cache preserves the context scope; a new TLS factory never aliases it.
    credentials: Option<uuid::Uuid>,
}
fn registry() -> &'static Mutex<BTreeMap<Scope, Arc<CacheOwner>>> {
    static REGISTRY: OnceLock<Mutex<BTreeMap<Scope, Arc<CacheOwner>>>> = OnceLock::new();
    REGISTRY.get_or_init(Mutex::default)
}
struct CacheOwner {
    endpoint: Endpoint,
    scope: Scope,
    state: Mutex<State>,
}
#[derive(Default)]
struct State {
    entries: BTreeMap<SocketAddr, Arc<Owner>>,
    cleanup: Option<tokio::task::JoinHandle<()>>,
}
impl Drop for CacheOwner {
    fn drop(&mut self) {
        let state = self
            .state
            .get_mut()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(task) = state.cleanup.take() {
            task.abort();
        }
    }
}
impl SubchannelCache {
    pub(crate) fn new(endpoint: Endpoint, target: &str) -> Self {
        // channel() fixes the user agent and all other Endpoint settings;
        // origin and connect timeout are its varying connection options.
        // Extend this scope if that factory gains another varying setting.
        let scope = Scope {
            target: crate::grpc_transport::endpoint_url::channel_target(target),
            origin: endpoint.uri().to_string(),
            connect_timeout: endpoint.get_connect_timeout(),
            credentials: (endpoint.uri().scheme_str() == Some("https")).then(uuid::Uuid::new_v4),
        };
        let mut registry = registry().lock().unwrap_or_else(|error| error.into_inner());
        Self(
            registry
                .entry(scope.clone())
                .or_insert_with(|| {
                    Arc::new(CacheOwner {
                        endpoint,
                        scope,
                        state: Mutex::default(),
                    })
                })
                .clone(),
        )
    }
    fn prune(owner: &Arc<CacheOwner>) {
        // Registry -> cache is the only nested lock order. A concurrent lookup
        // clones under this registry lock, so an owner still held by a logical
        // channel cannot be removed between lookup and get_or_create.
        let mut registry = registry().lock().unwrap_or_else(|error| error.into_inner());
        if Arc::strong_count(owner) == 2
            && registry
                .get(&owner.scope)
                .is_some_and(|entry| Arc::ptr_eq(entry, owner))
            && owner
                .state
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .entries
                .is_empty()
        {
            registry.remove(&owner.scope);
        }
    }
    fn running(owner: &Arc<Owner>) -> bool {
        // A process-wide entry can outlive a stopped runtime in an embedding.
        // Do not reuse an owner whose singleton driver has already terminated.
        owner
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .entries
            .values()
            .next()
            .is_some_and(|entry| !entry.task.is_finished())
    }
    pub(super) fn peek(&self, address: SocketAddr) -> Option<Pool> {
        let state = self
            .0
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        state
            .entries
            .get(&address)
            .filter(|owner| Self::running(owner))
            .cloned()
            .map(Pool::from_owner)
    }
    pub(super) fn get_or_create(&self, address: SocketAddr) -> Pool {
        let mut state = self
            .0
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if state
            .entries
            .get(&address)
            .is_some_and(|owner| !Self::running(owner))
        {
            state.entries.remove(&address);
        }
        let pool = if let Some(owner) = state.entries.get(&address) {
            Pool::from_owner(owner.clone())
        } else {
            let pool = Pool::pending_first(self.0.endpoint.clone(), address);
            state.entries.insert(address, pool.owner.clone());
            pool
        };
        if state.cleanup.as_ref().is_none_or(|task| task.is_finished()) {
            let weak = Arc::downgrade(&self.0);
            // A weak capture prevents the cleanup task from retaining its own
            // JoinHandle owner. Stop when no cached subchannels remain.
            state.cleanup = Some(tokio::spawn(async move {
                loop {
                    tokio::time::sleep(Duration::from_secs(10)).await;
                    let Some(owner) = weak.upgrade() else {
                        return;
                    };
                    let mut state = owner
                        .state
                        .lock()
                        .unwrap_or_else(|error| error.into_inner());
                    state
                        .entries
                        .retain(|_, subchannel| Arc::strong_count(subchannel) > 1);
                    if state.entries.is_empty() {
                        state.cleanup.take();
                        drop(state);
                        Self::prune(&owner);
                        return;
                    }
                }
            }));
        }
        pool
    }
}
impl Drop for SubchannelCache {
    fn drop(&mut self) {
        // Empty factories need no timer. Nonempty factories stay in the global
        // registry until their existing periodic reference check removes them.
        Self::prune(&self.0);
    }
}
