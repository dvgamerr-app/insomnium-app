//! Policy-local endpoint counters and grpc-js outlier interval checks.
use super::weighted;
use crate::grpc_legacy::Json as Value;
use crate::grpc_transport::service_config::lb_config;
use std::{
    net::SocketAddr,
    sync::{Arc, Mutex, Weak},
    time::Duration,
};

#[derive(Clone, Default)]
pub(crate) struct Policy {
    pub(super) weighted: Option<weighted::Config>,
    pub(super) layers: Vec<Config>,
    pub(super) signature: Vec<lb_config::Kind>,
    pub(super) shared: Vec<Shared>,
    pub(super) counting: Vec<bool>,
}
impl Policy {
    pub(super) fn retain_parents(&mut self, pool: &super::Pool) {
        let state = pool
            .owner
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let count = self
            .signature
            .iter()
            .zip(&state.signature)
            .take_while(|(next, previous)| {
                next == previous && **next == lb_config::Kind::OutlierDetection
            })
            .count();
        self.shared = state.outliers.iter().take(count).cloned().collect();
        // Parent policy instances survive a child-kind replacement. Their latest
        // configuration applies while the previous child still serves calls.
        for (index, (layer, config)) in self.shared.iter().zip(&self.layers).enumerate() {
            let mut layer = layer.lock().unwrap_or_else(|error| error.into_inner());
            self.counting[index] = layer.counting();
            layer.configure(config.clone());
        }
    }
    pub(crate) fn selected(mut selected: lb_config::Selection) -> Self {
        let mut result = Self::default();
        loop {
            result.signature.push(selected.kind);
            match selected.kind {
                lb_config::Kind::OutlierDetection => {
                    let raw = selected.config.as_ref().expect("validated outlier config");
                    result.layers.push(Config::new(raw));
                    result.counting.push(false);
                    selected = lb_config::select(Some(&Value::singleton(
                        "loadBalancingConfig",
                        raw["child_policy"].clone(),
                    )));
                }
                lb_config::Kind::WeightedRoundRobin => {
                    result.weighted = selected.config.as_ref().map(weighted::Config::from_json);
                    return result;
                }
                _ => return result,
            }
        }
    }
}
fn number(value: &Value, field: &str, default: f64) -> f64 {
    value.get(field).and_then(Value::as_f64).unwrap_or(default)
}
#[derive(Clone)]
struct Check {
    threshold: f64,
    enforcement: f64,
    hosts: f64,
    volume: f64,
}
#[derive(Clone)]
pub(crate) struct Config {
    interval: i32,
    base: i32,
    max: i32,
    percent: f64,
    success: Option<Check>,
    failure: Option<Check>,
}
impl Config {
    fn new(raw: &Value) -> Self {
        Self {
            interval: weighted::duration(raw.get("interval"), 10_000),
            base: weighted::duration(raw.get("base_ejection_time"), 30_000),
            max: weighted::duration(raw.get("max_ejection_time"), 300_000),
            percent: number(raw, "max_ejection_percent", 10.0),
            success: raw.get("success_rate_ejection").map(|v| Check {
                threshold: number(v, "stdev_factor", 1900.0),
                enforcement: number(v, "enforcement_percentage", 100.0),
                hosts: number(v, "minimum_hosts", 5.0),
                volume: number(v, "request_volume", 100.0),
            }),
            failure: raw.get("failure_percentage_ejection").map(|v| Check {
                threshold: number(v, "threshold", 85.0),
                enforcement: number(v, "enforcement_percentage", 100.0),
                hosts: number(v, "minimum_hosts", 5.0),
                volume: number(v, "request_volume", 50.0),
            }),
        }
    }
    fn enabled(&self) -> bool {
        self.success.is_some() || self.failure.is_some()
    }
}
#[derive(Default)]
struct Stats {
    active: [f64; 2],
    previous: [f64; 2],
    ejected: Option<i64>,
    multiplier: f64,
}
pub(super) type Shared = Arc<Mutex<Layer>>;
pub(super) struct Binding {
    entry: Arc<Mutex<Stats>>,
    layer: Weak<Mutex<Layer>>,
    counting: bool,
}
impl Binding {
    pub(super) fn new(layers: &[Shared], address: SocketAddr) -> Vec<Self> {
        layers
            .iter()
            .filter_map(|layer| {
                let state = layer.lock().unwrap_or_else(|error| error.into_inner());
                state
                    .entries
                    .iter()
                    .find(|(current, _)| *current == address)
                    .map(|(_, entry)| Self {
                        entry: entry.clone(),
                        layer: Arc::downgrade(layer),
                        counting: false,
                    })
            })
            .collect()
    }
    pub(super) fn publish(&mut self, previous: Option<bool>) {
        self.counting = previous.unwrap_or_else(|| {
            self.layer.upgrade().is_some_and(|layer| {
                layer
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .config
                    .enabled()
            })
        });
    }
    fn counter(&self) -> Option<Counter> {
        self.counting.then(|| Counter(self.entry.clone()))
    }
}
pub(super) fn ejected(bindings: &[Binding]) -> bool {
    bindings.iter().any(|binding| {
        binding
            .entry
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .ejected
            .is_some()
    })
}
pub(super) struct Layer {
    config: Config,
    entries: Vec<(SocketAddr, Arc<Mutex<Stats>>)>,
    start: Option<i64>,
    due: Option<tokio::time::Instant>,
    changed: tokio::sync::watch::Sender<u64>,
}
impl Layer {
    pub(super) fn new(config: Config, addresses: &[SocketAddr]) -> Self {
        let mut result = Self {
            config: config.clone(),
            entries: Vec::new(),
            start: None,
            due: None,
            changed: tokio::sync::watch::channel(0).0,
        };
        result.membership(addresses);
        result.configure(config);
        result
    }
    pub(super) fn membership(&mut self, addresses: &[SocketAddr]) {
        self.entries
            .retain(|(address, _)| addresses.contains(address));
        for address in addresses {
            if !self.entries.iter().any(|(current, _)| current == address) {
                self.entries
                    .push((*address, Arc::new(Mutex::new(Stats::default()))));
            }
        }
    }
    pub(super) fn configure(&mut self, config: Config) {
        let now = chrono::Utc::now().timestamp_millis();
        if config.enabled() {
            let start = *self.start.get_or_insert_with(|| {
                for (_, entry) in &self.entries {
                    let mut entry = entry.lock().unwrap_or_else(|e| e.into_inner());
                    entry.previous = entry.active;
                    entry.active = [0.0; 2];
                }
                now
            });
            self.due =
                Some(tokio::time::Instant::now() + delay(config.interval as i64 - (now - start)));
        } else {
            self.start = None;
            self.due = None;
            for (_, entry) in &self.entries {
                let mut entry = entry.lock().unwrap_or_else(|e| e.into_inner());
                entry.ejected = None;
                entry.multiplier = 0.0;
            }
        }
        self.config = config;
        self.changed
            .send_modify(|version| *version = version.wrapping_add(1));
    }
    pub(super) fn changes(&self) -> tokio::sync::watch::Receiver<u64> {
        self.changed.subscribe()
    }
    pub(super) fn counting(&self) -> bool {
        self.config.enabled()
    }
    pub(super) fn due(&self) -> Option<tokio::time::Instant> {
        self.due
    }
    fn percent(&self) -> f64 {
        self.entries
            .iter()
            .filter(|(_, entry)| {
                entry
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .ejected
                    .is_some()
            })
            .count() as f64
            * 100.0
            / self.entries.len() as f64
    }
    pub(super) fn tick(&mut self) {
        if self.due.is_none_or(|due| due > tokio::time::Instant::now()) {
            return;
        }
        let now = chrono::Utc::now().timestamp_millis();
        self.start = Some(now);
        self.due = Some(tokio::time::Instant::now() + delay(self.config.interval as i64));
        // Re-arm every subscriber even when the reference aborts this check.
        self.changed
            .send_modify(|version| *version = version.wrapping_add(1));
        for (_, entry) in &self.entries {
            let mut entry = entry.lock().unwrap_or_else(|e| e.into_inner());
            entry.previous = entry.active;
            entry.active = [0.0; 2];
        }
        if let Some(check) = self.config.success.clone() {
            let rates: Vec<_> = self
                .entries
                .iter()
                .filter_map(|(_, entry)| {
                    let stats = entry.lock().unwrap_or_else(|e| e.into_inner());
                    let [success, failure] = stats.previous;
                    (success + failure >= check.volume).then_some(success / (success + failure))
                })
                .collect();
            if rates.len() as f64 >= check.hosts {
                // grpc-js reduces without an initial value. An empty candidate
                // list aborts the callback before failure checks and unejection,
                // after the next timer has already been armed. Preserve that
                // state transition without panicking the native process.
                if rates.is_empty() {
                    return;
                }
                let mean = rates.iter().sum::<f64>() / rates.len() as f64;
                let variance = rates.iter().map(|rate| (rate - mean).powi(2)).sum::<f64>()
                    / rates.len() as f64;
                let threshold = mean - variance.sqrt() * (check.threshold / 1000.0);
                self.check(&check, |success, failure| {
                    success / (success + failure) < threshold
                });
            }
        }
        if let Some(check) = self.config.failure.clone() {
            let candidates = self
                .entries
                .iter()
                .filter(|(_, entry)| {
                    let stats = entry.lock().unwrap_or_else(|e| e.into_inner());
                    stats.previous.iter().sum::<f64>() >= check.volume
                })
                .count();
            if candidates as f64 >= check.hosts {
                self.check(&check, |success, failure| {
                    failure * 100.0 / (success + failure) > check.threshold
                });
            }
        }
        for (_, entry) in &self.entries {
            let mut entry = entry.lock().unwrap_or_else(|e| e.into_inner());
            if let Some(start) = entry.ejected {
                let duration = (self.config.base as f64 * entry.multiplier)
                    .min(self.config.base.max(self.config.max) as f64);
                // An invalid JS Date cannot compare less than now. Keep the
                // ejection on unsupported native calendar ranges as well;
                // never substitute elapsed UTC arithmetic for local setters.
                if crate::grpc_transport::service_config::add_milliseconds(start, duration)
                    .ok()
                    .flatten()
                    .is_some_and(|return_time| return_time < chrono::Utc::now().timestamp_millis())
                {
                    entry.ejected = None;
                }
            } else if entry.multiplier > 0.0 {
                entry.multiplier -= 1.0;
            }
        }
    }
    fn check(&self, config: &Check, bad: impl Fn(f64, f64) -> bool) {
        for (_, entry) in &self.entries {
            if self.percent() >= self.config.percent {
                break;
            }
            let mut entry = entry.lock().unwrap_or_else(|e| e.into_inner());
            let [success, failure] = entry.previous;
            if success + failure >= config.volume && bad(success, failure) {
                let sample = (uuid::Uuid::new_v4().as_u128() as u64 & ((1_u64 << 53) - 1)) as f64
                    / (1_u64 << 53) as f64;
                if sample * 100.0 < config.enforcement {
                    entry.ejected = Some(chrono::Utc::now().timestamp_millis());
                    entry.multiplier += 1.0;
                }
            }
        }
    }
}
fn delay(ms: i64) -> Duration {
    // Node setTimeout clamps both ends to 1 ms. A wall-clock rollback can
    // exceed the upper bound when reconfiguring an existing interval.
    Duration::from_millis(if (1..=i32::MAX as i64).contains(&ms) {
        ms as u64
    } else {
        1
    })
}
pub(super) struct Counter(Arc<Mutex<Stats>>);
#[derive(Default)]
pub(super) struct Call {
    counters: Vec<Counter>,
    ended: bool,
}
impl Call {
    pub(super) fn new(bindings: &[Binding]) -> Self {
        Self {
            counters: bindings.iter().filter_map(Binding::counter).collect(),
            ended: true,
        }
    }
    pub(super) fn start(&mut self) {
        self.ended = false;
    }
    pub(super) fn observe(&mut self, headers: &tonic::codegen::http::HeaderMap) {
        if let Some(status) = headers.get("grpc-status") {
            self.finish(status.as_bytes() == b"0");
        }
    }
    fn finish(&mut self, success: bool) {
        if self.ended {
            return;
        }
        self.ended = true;
        for Counter(entry) in &self.counters {
            entry.lock().unwrap_or_else(|e| e.into_inner()).active[usize::from(!success)] += 1.0;
        }
    }
}
impl Drop for Call {
    fn drop(&mut self) {
        self.finish(false);
    }
}
