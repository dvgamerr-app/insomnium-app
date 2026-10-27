//! Insomnium extension: the upstream connection stack before tower Buffer.
use super::Endpoint;
use super::service::Connection;
use crate::{body::Body, transport::Error};
use http::{Request, Response, Uri};
use hyper::rt;
use std::{
    future::Future,
    pin::Pin,
    task::{Context, Poll},
};
use tower::Service;

/// A uniquely owned HTTP/2 transport service without a request buffer.
///
/// Readiness polls reach the original connection/reconnect and middleware stack.
/// A successful poll reserves capacity for one call. The owner must retain this
/// instance between that poll and the call; this type deliberately is not Clone.
/// It creates no additional buffer worker or load-balancing algorithm.
#[derive(Debug)]
pub struct ReadyConnection {
    inner: Connection,
}

impl ReadyConnection {
    pub(super) fn lazy<C>(connector: C, endpoint: Endpoint) -> Self
    where
        C: Service<Uri> + Send + 'static,
        C::Error: Into<crate::BoxError> + Send,
        C::Future: Send,
        C::Response: rt::Read + rt::Write + Unpin + Send + 'static,
    {
        Self {
            inner: Connection::lazy_ready(connector, endpoint),
        }
    }
    /// Subscribe to the latest HTTP2 connectivity state independently of capacity.
    ///
    /// This is a watch snapshot, not an event log; intermediate states may coalesce.
    /// Owner drop publishes Shutdown and closes the sender once retained drivers
    /// release any brief observation currently in progress.
    pub fn connectivity(&self) -> tokio::sync::watch::Receiver<Connectivity> {
        self.inner
            .connectivity()
            .expect("ReadyConnection owns a monitor")
    }

    /// Mark an unrequested failed attempt IDLE after its owner's backoff ends.
    /// Returns false if that exact generation is no longer in TransientFailure.
    /// Does not connect, drop a driver, or change a newer transport's state.
    pub fn idle_after_failure(&self, generation: u64) -> bool {
        self.inner.idle_after_failure(generation)
    }

    pub(super) async fn connect<C>(connector: C, endpoint: Endpoint) -> Result<Self, Error>
    where
        C: Service<Uri> + Send + 'static,
        C::Error: Into<crate::BoxError> + Send,
        C::Future: Unpin + Send,
        C::Response: rt::Read + rt::Write + Unpin + Send + 'static,
    {
        let inner = Connection::connect_ready(connector, endpoint)
            .await
            .map_err(Error::from_source)?;
        Ok(Self { inner })
    }
}

impl Service<Request<Body>> for ReadyConnection {
    type Response = Response<Body>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx).map_err(Error::from_source)
    }

    fn call(&mut self, request: Request<Body>) -> Self::Future {
        let future = self.inner.call(request);
        Box::pin(async move { future.await.map_err(Error::from_source) })
    }
}

/// Transport connectivity, independent of middleware or stream capacity.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ConnectivityState {
    /// A connector/TLS/HTTP2 handshake is in progress.
    Connecting,
    /// The HTTP2 handshake completed and its driver has not ended.
    Ready,
    /// No live connection: established loss or an unrequested failure expired.
    Disconnected,
    /// A connector or HTTP2 handshake failed before becoming READY.
    TransientFailure,
    /// The transport owner was dropped; this does not assert a physical FIN.
    Shutdown,
}

/// Latest observed connectivity generation and state.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Connectivity {
    /// Increments when the owner starts a new connection attempt.
    pub generation: u64,
    /// Transport state for that generation.
    pub state: ConnectivityState,
    /// Process-local order of the current READY observation; zero otherwise.
    /// This orders concurrently observed READY candidates, not an event log.
    pub ready_sequence: u64,
    /// Count of transitions into TransientFailure, retained across generations.
    /// Established-connection loss and duplicate failure notices do not increment.
    pub failures: u64,
}

static NEXT_READY_SEQUENCE: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);

struct MonitorState {
    sender: tokio::sync::watch::Sender<Connectivity>,
}
impl MonitorState {
    fn publish(&self, generation: u64, connectivity: ConnectivityState) {
        let previous = *self.sender.borrow();
        self.sender.send_replace(Connectivity {
            generation,
            state: connectivity,
            ready_sequence: if connectivity == ConnectivityState::Ready {
                NEXT_READY_SEQUENCE.fetch_add(1, std::sync::atomic::Ordering::SeqCst)
            } else {
                0
            },
            failures: previous.failures.wrapping_add(u64::from(
                connectivity == ConnectivityState::TransientFailure
                    && previous.state != ConnectivityState::TransientFailure,
            )),
        });
    }
}
impl Drop for MonitorState {
    fn drop(&mut self) {
        let generation = self.sender.borrow().generation;
        self.publish(generation, ConnectivityState::Shutdown);
    }
}
#[derive(Clone)]
pub(crate) struct Monitor(std::sync::Arc<std::sync::Mutex<MonitorState>>);
#[derive(Clone)]
pub(crate) struct Observation {
    owner: std::sync::Weak<std::sync::Mutex<MonitorState>>,
    generation: u64,
}
impl Monitor {
    pub(crate) fn new() -> Self {
        let (sender, _) = tokio::sync::watch::channel(Connectivity {
            generation: 0,
            state: ConnectivityState::Connecting,
            ready_sequence: 0,
            failures: 0,
        });
        Self(std::sync::Arc::new(std::sync::Mutex::new(MonitorState {
            sender,
        })))
    }
    pub(crate) fn subscribe(&self) -> tokio::sync::watch::Receiver<Connectivity> {
        self.0
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .sender
            .subscribe()
    }
    pub(crate) fn begin(&self) -> Observation {
        let state = self.0.lock().unwrap_or_else(|error| error.into_inner());
        let generation = state.sender.borrow().generation.wrapping_add(1);
        state.publish(generation, ConnectivityState::Connecting);
        Observation {
            owner: std::sync::Arc::downgrade(&self.0),
            generation,
        }
    }
    pub(crate) fn failed(&self) {
        let state = self.0.lock().unwrap_or_else(|error| error.into_inner());
        let generation = state.sender.borrow().generation;
        state.publish(generation, ConnectivityState::TransientFailure);
    }
    pub(crate) fn idle_after_failure(&self, generation: u64) -> bool {
        let state = self.0.lock().unwrap_or_else(|error| error.into_inner());
        let snapshot = *state.sender.borrow();
        if snapshot.generation != generation
            || snapshot.state != ConnectivityState::TransientFailure
        {
            return false;
        }
        state.publish(generation, ConnectivityState::Disconnected);
        true
    }
}
impl Observation {
    pub(crate) fn publish(&self, connectivity: ConnectivityState) {
        if let Some(owner) = self.owner.upgrade() {
            let state = owner.lock().unwrap_or_else(|error| error.into_inner());
            let generation = state.sender.borrow().generation;
            if generation == self.generation {
                state.publish(self.generation, connectivity);
            }
        }
    }
}
pub(crate) struct DriverObservation(pub(crate) Option<Observation>);
impl Drop for DriverObservation {
    fn drop(&mut self) {
        if let Some(observation) = &self.0 {
            observation.publish(ConnectivityState::Disconnected);
        }
    }
}
