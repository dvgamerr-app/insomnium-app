//! Endpoint-owned OpenRcaService subscription shared by weighted policy watchers.
use super::{weighted, Entry, Pool};
use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex, Weak},
    time::Duration,
};
use tokio::sync::watch;
use tonic::transport::ConnectivityState;

type Watchers = Arc<Mutex<BTreeMap<uuid::Uuid, (i32, weighted::Sink)>>>;
pub(super) struct Producer {
    watchers: Watchers,
    changed: watch::Sender<u64>,
    task: tokio::task::JoinHandle<()>,
}
impl Drop for Producer {
    fn drop(&mut self) {
        self.task.abort();
    }
}
pub(super) struct Registration {
    entry: Weak<Entry>,
    id: uuid::Uuid,
}
impl Registration {
    pub(super) fn new(pool: &Pool, interval: i32, sink: weighted::Sink) -> Self {
        let entry = pool
            .owner
            .state
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .entries
            .values()
            .next()
            .expect("ORCA requires singleton subchannel")
            .clone();
        let id = uuid::Uuid::new_v4();
        let mut producer = entry.orca.lock().unwrap_or_else(|e| e.into_inner());
        let producer = producer.get_or_insert_with(|| {
            let watchers = Arc::new(Mutex::new(BTreeMap::from([(id, (interval, sink.clone()))])));
            let (changed, receiver) = watch::channel(0);
            let task = tokio::spawn(run(pool.clone(), watchers.clone(), receiver));
            Producer {
                watchers,
                changed,
                task,
            }
        });
        producer
            .watchers
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(id, (interval, sink));
        producer
            .changed
            .send_modify(|revision| *revision = revision.wrapping_add(1));
        Self {
            entry: Arc::downgrade(&entry),
            id,
        }
    }
    pub(super) fn interval(&self, interval: i32) {
        let Some(entry) = self.entry.upgrade() else {
            return;
        };
        let producer = entry.orca.lock().unwrap_or_else(|e| e.into_inner());
        let Some(producer) = producer.as_ref() else {
            return;
        };
        let mut watchers = producer.watchers.lock().unwrap_or_else(|e| e.into_inner());
        if let Some((previous, _)) = watchers.get_mut(&self.id) {
            if *previous != interval {
                *previous = interval;
                producer
                    .changed
                    .send_modify(|revision| *revision = revision.wrapping_add(1));
            }
        }
    }
}
impl Drop for Registration {
    fn drop(&mut self) {
        let Some(entry) = self.entry.upgrade() else {
            return;
        };
        let mut producer = entry.orca.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(current) = producer.as_ref() {
            let empty = {
                let mut watchers = current.watchers.lock().unwrap_or_else(|e| e.into_inner());
                watchers.remove(&self.id);
                watchers.is_empty()
            };
            if empty {
                // Break the worker's singleton-pool retention before the last
                // watcher disappears; dropping the call cancels its HTTP/2 stream.
                producer.take();
            } else {
                current
                    .changed
                    .send_modify(|revision| *revision = revision.wrapping_add(1));
            }
        }
    }
}

#[derive(Clone, prost::Message)]
struct Request {
    #[prost(message, optional, tag = "1")]
    report_interval: Option<prost_types::Duration>,
}
async fn metrics(pool: Pool, interval: i32, watchers: Watchers) -> Result<(), tonic::Status> {
    let mut client = tonic::client::Grpc::new(pool)
        .accept_compressed(tonic::codec::CompressionEncoding::Gzip)
        .accept_compressed(tonic::codec::CompressionEncoding::Deflate);
    client
        .ready()
        .await
        .map_err(|e| tonic::Status::unavailable(e.to_string()))?;
    let request = Request {
        report_interval: Some(prost_types::Duration {
            seconds: (interval / 1000) as i64,
            nanos: (interval % 1000) * 1_000_000,
        }),
    };
    let mut response = client
        .server_streaming(
            tonic::Request::new(request),
            tonic::codegen::http::uri::PathAndQuery::from_static(
                "/xds.service.orca.v3.OpenRcaService/StreamCoreMetrics",
            ),
            tonic_prost::ProstCodec::<Request, weighted::Report>::default(),
        )
        .await?
        .into_inner();
    while let Some(report) = response.message().await? {
        let sinks: Vec<_> = watchers
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .values()
            .map(|(_, sink)| sink.clone())
            .collect();
        for sink in sinks {
            sink.report(report.clone());
        }
    }
    Ok(())
}
async fn run(pool: Pool, watchers: Watchers, mut changed: watch::Receiver<u64>) {
    let mut connectivity = pool
        .owner
        .state
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .entries
        .values()
        .next()
        .expect("ORCA requires singleton subchannel")
        .connectivity
        .clone();
    let mut interval = None;
    let mut call: Option<
        std::pin::Pin<Box<dyn std::future::Future<Output = Result<(), tonic::Status>> + Send>>,
    > = None;
    let mut supported = true;
    let mut completed = false;
    let mut start = true;
    let mut retry = None;
    let mut backoff = 1000.0_f64;
    let mut watcher_version = None;
    let mut observed_connectivity = None;
    loop {
        // Another select branch may win while a watcher update arrives. Keep
        // our own sampled version so borrow_and_update cannot swallow that
        // trigger before it has authorized a subscription attempt.
        let version = *changed.borrow_and_update();
        if watcher_version != Some(version) {
            watcher_version = Some(version);
            start = true;
        }
        let next = watchers
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .values()
            .map(|(ms, _)| *ms)
            .min();
        let Some(next) = next else { return };
        let snapshot = *connectivity.borrow_and_update();
        if observed_connectivity != Some(snapshot) {
            observed_connectivity = Some(snapshot);
            start = true;
        }
        let ready = snapshot.state == ConnectivityState::Ready;
        // The reference returns before touching the subscription while the
        // subchannel is not READY (or ORCA was rejected). Retain the old call
        // and interval until a supported READY update can replace them.
        if supported && ready && interval != Some(next) {
            call = None;
            completed = false;
            interval = Some(next);
            start = true;
        }
        if start && supported && !completed && call.is_none() && ready {
            call = Some(Box::pin(metrics(pool.clone(), next, watchers.clone())));
        }
        start = false;
        tokio::select! {
            result = async { call.as_mut().expect("guarded ORCA call").await }, if call.is_some() => {
                call = None;
                match result {
                    Ok(()) => completed = true,
                    Err(error) if error.code() == tonic::Code::Unimplemented => supported = false,
                    Err(error) if error.code() == tonic::Code::Cancelled => {},
                    Err(_) => {
                        retry = Some(tokio::time::Instant::now() + Duration::from_millis(backoff.trunc() as u64));
                        let base = (backoff * 1.6).min(120_000.0);
                        let sample = (uuid::Uuid::new_v4().as_u128() as u64 & ((1_u64 << 53) - 1)) as f64 / (1_u64 << 53) as f64;
                        backoff = base + (sample * 2.0 - 1.0) * base * 0.2;
                    }
                }
            }
            result = changed.changed() => { if result.is_err() { return } start = true; }
            result = connectivity.changed() => { if result.is_err() { return } start = true; }
            _ = async { tokio::time::sleep_until(retry.expect("guarded ORCA retry")).await }, if retry.is_some() => {
                retry = None;
                start = true;
            }
        }
    }
}
