//! Policy-local ORCA weights and the pinned grpc-js deadline-heap picker.
use base64::{
    alphabet,
    engine::{DecodePaddingMode, GeneralPurpose, GeneralPurposeConfig},
    Engine,
};
use prost::Message;
use serde_json::Value;
use std::{
    collections::BTreeMap,
    net::SocketAddr,
    sync::{Arc, Mutex, RwLock, Weak},
    time::Duration,
};
use tonic::transport::{Connectivity, ConnectivityState};

#[derive(Clone)]
pub(crate) struct Config {
    pub(super) oob: bool,
    pub(super) reporting: i32,
    blackout: i32,
    expiration: i32,
    update: i32,
    penalty: f64,
}
fn int32(value: f64) -> i32 {
    if !value.is_finite() {
        0
    } else {
        value.trunc().rem_euclid(4_294_967_296.0) as u32 as i32
    }
}
pub(super) fn duration(value: Option<&Value>, default: i32) -> i32 {
    let Some(value) = value.filter(|value| !value.is_null()) else {
        return default;
    };
    let (seconds, nanos) = if let Some(text) = value.as_str() {
        let mut parts = text.trim_end_matches('s').split('.');
        let seconds = parts.next().unwrap_or("0").parse().unwrap_or(f64::INFINITY);
        let fraction = parts.next().unwrap_or("0");
        let padded = format!("{fraction:0<9}");
        (seconds, padded.parse().unwrap_or(f64::INFINITY))
    } else {
        let seconds = value.get("seconds").map_or(0.0, |seconds| {
            seconds.as_f64().unwrap_or_else(|| {
                crate::grpc_transport::retry::pushback(seconds.as_str().unwrap_or(""))
            })
        });
        (
            seconds,
            value.get("nanos").and_then(Value::as_f64).unwrap_or(0.0),
        )
    };
    int32(seconds * 1000.0 + nanos / 1_000_000.0)
}
impl Default for Config {
    fn default() -> Self {
        Self {
            oob: false,
            reporting: 10_000,
            blackout: 10_000,
            expiration: 180_000,
            update: 1000,
            penalty: 1.0,
        }
    }
}
impl Config {
    pub(crate) fn from_json(value: &Value) -> Self {
        Self {
            oob: value
                .get("enable_oob_load_report")
                .and_then(Value::as_bool)
                .unwrap_or(false),
            reporting: duration(value.get("oob_load_reporting_period"), 10_000),
            blackout: duration(value.get("blackout_period"), 10_000),
            expiration: duration(value.get("weight_expiration_period"), 180_000),
            update: duration(value.get("weight_update_period"), 1000).max(100),
            penalty: value
                .get("error_utilization_penalty")
                .and_then(Value::as_f64)
                .unwrap_or(1.0),
        }
    }
    pub(super) fn interval(&self) -> Duration {
        Duration::from_millis(self.update as u64)
    }
}

// Projection of xds.data.orca.v3.OrcaLoadReport. Unknown protobuf fields are
// skipped by Prost; weights use exactly these three fields in grpc-js1.14.4.
#[derive(Clone, Message)]
pub(super) struct Report {
    #[prost(double, tag = "6")]
    qps: f64,
    #[prost(double, tag = "7")]
    eps: f64,
    #[prost(double, tag = "9")]
    utilization: f64,
}
struct EndpointWeight {
    updated: i64,
    non_empty: Option<i64>,
    weight: f64,
    ready_generation: Option<u64>,
}
#[derive(Clone)]
pub(super) struct Sink {
    endpoints: Weak<Mutex<BTreeMap<SocketAddr, Arc<Mutex<EndpointWeight>>>>>,
    bound: Option<Arc<Mutex<EndpointWeight>>>,
    address: SocketAddr,
    config: Arc<RwLock<Config>>,
}
// grpc-js metadata.ts decodes binary headers with Buffer.from(value, "base64").
// Preserve the tolerant ASCII decoding boundary before protobuf validation.
fn binary_report(encoded: &[u8]) -> Option<Vec<u8>> {
    const DECODER: GeneralPurpose = GeneralPurpose::new(
        &alphabet::STANDARD,
        GeneralPurposeConfig::new()
            .with_decode_padding_mode(DecodePaddingMode::Indifferent)
            .with_decode_allow_trailing_bits(true),
    );
    let mut cleaned: Vec<_> = encoded
        .iter()
        .copied()
        .take_while(|byte| *byte != b'=')
        .filter_map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'+' | b'/' => Some(byte),
            b'-' => Some(b'+'),
            b'_' => Some(b'/'),
            _ => None,
        })
        .collect();
    // A final isolated sextet produces no complete byte in Buffer decoding.
    if cleaned.len() % 4 == 1 {
        cleaned.pop();
    }
    DECODER.decode(cleaned).ok()
}
impl Sink {
    pub(super) fn observe(&self, headers: &tonic::codegen::http::HeaderMap) {
        let Some(value) = headers.get("endpoint-load-metrics-bin") else {
            return;
        };
        let encoded = value
            .as_bytes()
            .split(|byte| *byte == b',')
            .next()
            .unwrap_or_default()
            .trim_ascii();
        let Some(bytes) = binary_report(encoded) else {
            return;
        };
        let Ok(report) = Report::decode(bytes.as_slice()) else {
            return;
        };
        self.report(report);
    }
    pub(super) fn report(&self, report: Report) {
        let endpoint = if let Some(endpoint) = &self.bound {
            Some(endpoint.clone())
        } else {
            let Some(endpoints) = self.endpoints.upgrade() else {
                return;
            };
            let endpoint = endpoints
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .get(&self.address)
                .cloned();
            endpoint
        };
        let Some(endpoint) = endpoint else { return };
        let config = self
            .config
            .read()
            .unwrap_or_else(|error| error.into_inner());
        let mut utilization = report.utilization;
        if utilization > 0.0 && report.qps > 0.0 {
            utilization += report.eps / report.qps * config.penalty;
        }
        let weight = if utilization == 0.0 {
            0.0
        } else {
            report.qps / utilization
        };
        if weight == 0.0 {
            return;
        }
        let now = chrono::Utc::now().timestamp_millis();
        let mut endpoint = endpoint.lock().unwrap_or_else(|error| error.into_inner());
        endpoint.non_empty.get_or_insert(now);
        endpoint.updated = now;
        endpoint.weight = weight;
    }
}

#[derive(Clone)]
struct Pick {
    key: usize,
    period: f64,
    deadline: f64,
}
#[derive(Default)]
struct Queue(Vec<Pick>);
impl Queue {
    fn push(&mut self, value: Pick) {
        self.0.push(value);
        let mut index = self.0.len() - 1;
        // Preserve the pinned priority-queue parent expression floor(i / 2).
        while index > 0 && self.0[index].deadline < self.0[index / 2].deadline {
            self.0.swap(index, index / 2);
            index /= 2;
        }
    }
    fn next(&mut self) -> Option<usize> {
        let last = self.0.len().checked_sub(1)?;
        self.0.swap(0, last);
        let mut entry = self.0.pop()?;
        let mut index = 0;
        loop {
            let left = index * 2 + 1;
            let right = left + 1;
            if left >= self.0.len() {
                break;
            }
            let next = if right < self.0.len() && self.0[right].deadline < self.0[left].deadline {
                right
            } else {
                left
            };
            if !(self.0[left].deadline < self.0[index].deadline
                || (right < self.0.len() && self.0[right].deadline < self.0[index].deadline))
            {
                break;
            }
            self.0.swap(index, next);
            index = next;
        }
        let key = entry.key;
        entry.deadline += entry.period;
        self.push(entry);
        Some(key)
    }
}
pub(super) struct Weights {
    config: Arc<RwLock<Config>>,
    addresses: Vec<SocketAddr>,
    endpoints: Arc<Mutex<BTreeMap<SocketAddr, Arc<Mutex<EndpointWeight>>>>>,
    ready: Vec<usize>,
    queue: Queue,
    subscriptions: BTreeMap<SocketAddr, super::orca::Registration>,
}
impl Weights {
    pub(super) fn new(config: Config, addresses: &[SocketAddr]) -> Self {
        let mut result = Self {
            config: Arc::new(RwLock::new(config)),
            addresses: Vec::new(),
            endpoints: Arc::new(Mutex::new(BTreeMap::new())),
            ready: Vec::new(),
            queue: Queue::default(),
            subscriptions: BTreeMap::new(),
        };
        result.membership(addresses);
        result
    }
    pub(super) fn configure(&self, config: Config) {
        *self
            .config
            .write()
            .unwrap_or_else(|error| error.into_inner()) = config;
    }
    pub(super) fn subscribe(&mut self, key: usize, pool: &super::Pool, replace: bool) {
        let config = self
            .config
            .read()
            .unwrap_or_else(|error| error.into_inner());
        let address = self.addresses[key];
        if !config.oob {
            self.subscriptions.remove(&address);
            return;
        }
        let sink = Sink {
            endpoints: Arc::downgrade(&self.endpoints),
            bound: Some(
                self.endpoints
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .get(&address)
                    .expect("weighted member requires metric entry")
                    .clone(),
            ),
            address,
            config: self.config.clone(),
        };
        if replace || !self.subscriptions.contains_key(&address) {
            // PF creates/refers the new wrapper before releasing its previous
            // pick. Keep a watcher alive throughout replacement so the shared
            // producer retains its support/backoff state and min interval.
            let registration = super::orca::Registration::new(pool, config.reporting, sink);
            self.subscriptions.insert(address, registration);
        } else if let Some(registration) = self.subscriptions.get(&address) {
            registration.interval(config.reporting);
        }
    }
    pub(super) fn interval(&self) -> Duration {
        self.config
            .read()
            .unwrap_or_else(|error| error.into_inner())
            .interval()
    }
    pub(super) fn membership(&mut self, addresses: &[SocketAddr]) {
        self.subscriptions
            .retain(|address, _| addresses.contains(address));
        self.addresses = addresses.to_vec();
        let mut endpoints = self
            .endpoints
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        endpoints.retain(|address, _| addresses.contains(address));
        for address in addresses {
            endpoints.entry(*address).or_insert_with(|| {
                Arc::new(Mutex::new(EndpointWeight {
                    updated: chrono::Utc::now().timestamp_millis(),
                    non_empty: None,
                    weight: 0.0,
                    ready_generation: None,
                }))
            });
        }
        self.ready.clear();
        self.queue = Queue::default();
    }
    pub(super) fn connectivity(
        &self,
        key: usize,
        snapshot: Connectivity,
        ready_callback: bool,
    ) -> bool {
        let endpoint = self.addresses.get(key).and_then(|address| {
            self.endpoints
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .get(address)
                .cloned()
        });
        let Some(endpoint) = endpoint else {
            return false;
        };
        let mut endpoint = endpoint.lock().unwrap_or_else(|error| error.into_inner());
        let previous = endpoint.ready_generation;
        if snapshot.state == ConnectivityState::Ready {
            if ready_callback || endpoint.ready_generation != Some(snapshot.generation) {
                endpoint.non_empty = None;
            }
            endpoint.ready_generation = Some(snapshot.generation);
        } else {
            endpoint.ready_generation = None;
        }
        previous != endpoint.ready_generation
    }
    pub(super) fn rebuild(&mut self, ready: &[usize]) {
        self.ready = ready.to_vec();
        let config = self
            .config
            .read()
            .unwrap_or_else(|error| error.into_inner());
        let now = chrono::Utc::now().timestamp_millis();
        let endpoints = self
            .endpoints
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let values: Vec<_> = ready
            .iter()
            .map(|key| {
                let endpoint = &endpoints[&self.addresses[*key]];
                let mut endpoint = endpoint.lock().unwrap_or_else(|error| error.into_inner());
                let weight = if now - endpoint.updated >= config.expiration as i64 {
                    endpoint.non_empty = None;
                    0.0
                } else if config.blackout > 0
                    && endpoint
                        .non_empty
                        .is_none_or(|start| now - start < config.blackout as i64)
                {
                    0.0
                } else {
                    endpoint.weight
                };
                (*key, weight)
            })
            .collect();
        let positives: Vec<_> = values
            .iter()
            .map(|(_, weight)| *weight)
            .filter(|weight| *weight > 0.0)
            .collect();
        let average = if positives.len() < 2 {
            1.0
        } else {
            positives.iter().sum::<f64>() / positives.len() as f64
        };
        self.queue = Queue::default();
        for (key, weight) in values {
            let period = if weight > 0.0 { 1.0 / weight } else { average };
            let sample = (uuid::Uuid::new_v4().as_u128() as u64 & ((1_u64 << 53) - 1)) as f64
                / (1_u64 << 53) as f64;
            self.queue.push(Pick {
                key,
                period,
                deadline: sample * period,
            });
        }
    }
    pub(super) fn pick(&mut self, ready: &[usize]) -> Option<(usize, Option<Sink>)> {
        if self.ready != ready {
            self.rebuild(ready);
        }
        let key = self.queue.next()?;
        let oob = self
            .config
            .read()
            .unwrap_or_else(|error| error.into_inner())
            .oob;
        let sink = (!oob).then(|| Sink {
            endpoints: Arc::downgrade(&self.endpoints),
            bound: None,
            address: self.addresses[key],
            config: self.config.clone(),
        });
        Some((key, sink))
    }
}
