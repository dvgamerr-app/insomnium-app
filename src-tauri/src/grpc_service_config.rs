//! Owned asynchronous DNS service-config selection. Policy execution is separate.
use crate::grpc_legacy::{Json as Value, JsonObject as Map};
use hickory_resolver::{proto::rr::RData, TokioResolver};
use std::sync::{Arc, Mutex, RwLock};
use tokio::task::JoinHandle;

#[path = "grpc_lb_config.rs"]
pub(super) mod lb_config;
pub(super) use lb_config::Kind as PolicyKind;

#[path = "grpc_service_deadline.rs"]
mod deadline;
pub(super) use deadline::add_milliseconds;

pub(super) struct MethodPolicy {
    method: Option<Value>,
    target: String,
}

#[derive(Clone, Copy)]
pub(super) struct CallDeadline {
    pub(super) wire: Option<tokio::time::Instant>,
    pub(super) timer: Option<tokio::time::Instant>,
}

impl MethodPolicy {
    pub(super) fn deadline(
        &self,
        previous: Option<tokio::time::Instant>,
    ) -> Result<CallDeadline, String> {
        deadline::apply(
            self.method
                .as_ref()
                .and_then(|config| config.get("timeout")),
            previous,
        )
    }
    pub(super) fn retry(&self) -> Result<super::retry::Session, String> {
        super::retry::Session::new(self.method.as_ref(), &self.target)
    }
}

#[derive(Clone, Default)]
pub(crate) struct ResolutionConfig(Arc<Inner>);

struct Inner {
    lookup: Mutex<Lookup>,
    snapshot: Arc<RwLock<Snapshot>>,
    retry_bytes: Arc<Mutex<usize>>,
    updates: tokio::sync::watch::Sender<u64>,
    resolution_updates: tokio::sync::watch::Sender<u64>,
}
impl Default for Inner {
    fn default() -> Self {
        let (updates, _) = tokio::sync::watch::channel(0_u64);
        let (resolution_updates, _) = tokio::sync::watch::channel(0_u64);
        Self {
            lookup: Mutex::default(),
            snapshot: Arc::default(),
            retry_bytes: Arc::default(),
            updates,
            resolution_updates,
        }
    }
}

#[derive(Default)]
struct Lookup {
    closed: bool,
    target: String,
    generation: u64,
    percentage: f64,
    task: Option<JoinHandle<()>>,
    retired: Vec<JoinHandle<()>>,
}

struct Snapshot {
    generation: u64,
    target: String,
    query_failed: bool,
    selected: Result<Option<Value>, String>,
    pending_txt: Option<Result<Option<Value>, String>>,
    accepted: Option<Value>,
    selector_ready: bool,
    addresses: Vec<std::net::SocketAddr>,
    address_revision: u64,
    route_addresses: Vec<std::net::SocketAddr>,
    route_address_revision: u64,
    policy_revision: u64,
    address_started: Option<tokio::time::Instant>,
    lookup_started: Option<tokio::time::Instant>,
    lookup_due: Option<tokio::time::Instant>,
}

impl Snapshot {
    fn accept_addresses(&mut self) {
        let config = match &self.selected {
            Ok(config) => config.clone(),
            // A rejected TXT update keeps the accepted selector, but a fresh
            // DNS result still replaces the route's addresses under it.
            Err(_) if self.selector_ready => self.accepted.clone(),
            Err(_) => return,
        };
        let throttle = config
            .as_ref()
            .and_then(|config| config.get("retryThrottling"));
        if let Err(error) = super::retry::publish_throttling(&self.target, throttle) {
            self.selected = Err(error);
            return;
        }
        self.accepted = config;
        self.selector_ready = true;
        self.route_addresses = self.addresses.clone();
        self.route_address_revision = self.address_revision;
        self.policy_revision = self.policy_revision.wrapping_add(1);
    }
}

impl Default for Snapshot {
    fn default() -> Self {
        Self {
            generation: 0,
            target: String::new(),
            query_failed: false,
            selected: Ok(None),
            pending_txt: None,
            accepted: None,
            selector_ready: false,
            addresses: Vec::new(),
            address_revision: 0,
            route_addresses: Vec::new(),
            route_address_revision: 0,
            policy_revision: 0,
            address_started: None,
            lookup_started: None,
            lookup_due: None,
        }
    }
}

impl Drop for Inner {
    fn drop(&mut self) {
        let lookup = self
            .lookup
            .get_mut()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(task) = lookup.task.take() {
            task.abort();
        }
        for task in &lookup.retired {
            task.abort();
        }
    }
}

impl ResolutionConfig {
    pub(super) fn resolution_error(&self, generation: u64) -> Option<String> {
        let snapshot = self.0.snapshot.read().ok()?;
        if snapshot.generation != generation || snapshot.selector_ready {
            return None;
        }
        snapshot.selected.as_ref().err().cloned()
    }

    pub(super) fn config_available(&self, target: &str) -> bool {
        self.0.snapshot.read().is_ok_and(|snapshot| {
            snapshot.target == super::endpoint_url::channel_target(target)
                && !snapshot.addresses.is_empty()
        })
    }
    pub(super) fn lookup_started(&self, generation: u64, started: tokio::time::Instant) {
        if let Ok(mut snapshot) = self.0.snapshot.write() {
            if snapshot.generation == generation
                && snapshot
                    .lookup_started
                    .is_none_or(|previous| previous <= started)
            {
                snapshot.lookup_started = Some(started);
                snapshot.lookup_due = Some(started + std::time::Duration::from_secs(30));
                self.0
                    .resolution_updates
                    .send_modify(|revision| *revision = revision.wrapping_add(1));
            }
        }
    }
    pub(super) fn lookup_failed(
        &self,
        generation: u64,
        started: tokio::time::Instant,
        retry_at: tokio::time::Instant,
    ) {
        if let Ok(mut snapshot) = self.0.snapshot.write() {
            if snapshot.generation == generation && snapshot.lookup_started == Some(started) {
                snapshot.lookup_due = Some(retry_at);
                self.0
                    .resolution_updates
                    .send_modify(|revision| *revision = revision.wrapping_add(1));
            }
        }
    }
    pub(super) fn resolution_updates(&self) -> tokio::sync::watch::Receiver<u64> {
        self.0.resolution_updates.subscribe()
    }
    pub(super) fn resolution_due(&self, generation: u64) -> Option<tokio::time::Instant> {
        let snapshot = self.0.snapshot.read().ok()?;
        if snapshot.generation != generation {
            return None;
        }
        snapshot.lookup_due
    }
    pub(super) fn publish_addresses(
        &self,
        generation: u64,
        started: tokio::time::Instant,
        addresses: Vec<std::net::SocketAddr>,
    ) -> Option<u64> {
        let mut snapshot = self.0.snapshot.write().ok()?;
        if snapshot.generation != generation
            || addresses.is_empty()
            || snapshot
                .address_started
                .is_some_and(|previous| previous > started)
        {
            return None;
        }
        snapshot.address_started = Some(started);
        snapshot.addresses = addresses;
        snapshot.address_revision = snapshot.address_revision.wrapping_add(1);
        if let Some(selected) = snapshot.pending_txt.take() {
            snapshot.selected = selected;
        }
        // Each successful resolver publication creates a new throttler from
        // the previous bucket, even if the service config itself is unchanged.
        // Calls already in flight retain their previously selected bucket.
        snapshot.accept_addresses();
        let revision = snapshot.address_revision;
        self.0
            .updates
            .send_modify(|revision| *revision = revision.wrapping_add(1));
        Some(revision)
    }
    pub(super) fn addresses(&self, generation: u64) -> Option<(u64, Vec<std::net::SocketAddr>)> {
        let snapshot = self.0.snapshot.read().ok()?;
        (snapshot.generation == generation && !snapshot.route_addresses.is_empty()).then(|| {
            (
                snapshot.route_address_revision,
                snapshot.route_addresses.clone(),
            )
        })
    }
    pub(super) fn policy_revision(&self) -> u64 {
        self.0
            .snapshot
            .read()
            .map_or(0, |snapshot| snapshot.policy_revision)
    }
    pub(super) fn policy_updates(&self) -> tokio::sync::watch::Receiver<u64> {
        self.0.updates.subscribe()
    }
    pub(super) fn generation(&self) -> u64 {
        self.0
            .snapshot
            .read()
            .map_or(0, |snapshot| snapshot.generation)
    }
    pub(super) fn apply_policy(
        &self,
        generation: u64,
        revision: u64,
        kind: PolicyKind,
        apply: impl FnOnce(),
    ) -> bool {
        let Ok(snapshot) = self.0.snapshot.read() else {
            return false;
        };
        if snapshot.generation != generation || snapshot.policy_revision != revision {
            return false;
        }
        let config = match &snapshot.selected {
            Ok(config) => config.as_ref(),
            Err(_) if snapshot.selector_ready => snapshot.accepted.as_ref(),
            Err(_) => None,
        };
        if lb_config::select(config).kind != kind {
            return false;
        }
        // Publication is synchronous under the snapshot read guard, so a new
        // target/config generation cannot race between validation and install.
        apply();
        true
    }
    pub(super) fn method(&self, service: &str, method: &str) -> Result<MethodPolicy, String> {
        let (selected, target) = self.check()?;
        let Some(selected) = selected else {
            return Ok(MethodPolicy {
                method: None,
                target,
            });
        };
        let configs = selected.get("methodConfig").and_then(Value::as_array);
        let service_units: Vec<u16> = service.encode_utf16().collect();
        let method_units: Vec<u16> = method.encode_utf16().collect();
        // Search by specificity first, then declaration order; never merge.
        for level in 0..3 {
            for config in configs.into_iter().flatten() {
                for candidate in config
                    .get("name")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                {
                    let (candidate_service, candidate_method) = name(candidate)?;
                    let matches = match level {
                        0 => candidate_service == service_units && candidate_method == method_units,
                        1 => candidate_service == service_units && candidate_method.is_empty(),
                        _ => candidate_service.is_empty() && candidate_method.is_empty(),
                    };
                    if matches {
                        return Ok(MethodPolicy {
                            method: Some(config.clone()),
                            target,
                        });
                    }
                }
            }
        }
        Ok(MethodPolicy {
            method: None,
            target,
        })
    }

    pub(super) fn retry_budget(&self) -> Arc<Mutex<usize>> {
        self.0.retry_bytes.clone()
    }
    pub(super) fn policy_kind(&self) -> PolicyKind {
        let Ok(snapshot) = self.0.snapshot.read() else {
            return PolicyKind::PickFirst;
        };
        let config = match &snapshot.selected {
            Ok(config) => config.as_ref(),
            Err(_) if snapshot.selector_ready => snapshot.accepted.as_ref(),
            Err(_) => None,
        };
        lb_config::select(config).kind
    }
    pub(super) fn pool_config(&self) -> Option<super::lb_transport::outlier::Policy> {
        let snapshot = self.0.snapshot.read().ok()?;
        let config = match &snapshot.selected {
            Ok(config) => config.as_ref(),
            Err(_) if snapshot.selector_ready => snapshot.accepted.as_ref(),
            Err(_) => None,
        };
        Some(super::lb_transport::outlier::Policy::selected(
            lb_config::select(config),
        ))
    }

    pub(super) fn shuffle_addresses(&self, addresses: &mut [std::net::SocketAddr]) {
        let Ok(snapshot) = self.0.snapshot.read() else {
            return;
        };
        let config = match &snapshot.selected {
            Ok(config) => config.as_ref(),
            Err(_) if snapshot.selector_ready => snapshot.accepted.as_ref(),
            Err(_) => None,
        };
        let selected = lb_config::select(config);
        if selected.kind == lb_config::Kind::PickFirst && selected.shuffle {
            // Preserve the pinned grpc-js loop's i > 1 bound.
            for index in (2..addresses.len()).rev() {
                let bits = uuid::Uuid::new_v4().as_u128() as u64 & ((1_u64 << 53) - 1);
                let sample = bits as f64 / (1_u64 << 53) as f64;
                let other = (sample * (index + 1) as f64).floor() as usize;
                addresses.swap(index, other);
            }
        }
    }

    pub(super) async fn shutdown(&self) {
        let tasks = {
            let mut lookup = self
                .0
                .lookup
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            lookup.closed = true;
            lookup.generation = lookup.generation.wrapping_add(1);
            if let Ok(mut snapshot) = self.0.snapshot.write() {
                snapshot.generation = lookup.generation;
            }
            let mut tasks = std::mem::take(&mut lookup.retired);
            tasks.extend(lookup.task.take());
            self.0
                .updates
                .send_modify(|revision| *revision = revision.wrapping_add(1));
            tasks
        };
        for task in &tasks {
            task.abort();
        }
        for task in tasks {
            let _ = task.await;
        }
    }

    pub(super) fn clear(&self) {
        let Ok(mut lookup) = self.0.lookup.lock() else {
            return;
        };
        if let Some(task) = lookup.task.take() {
            task.abort();
            lookup.retired.push(task);
        }
        lookup.retired.retain(|task| !task.is_finished());
        lookup.target.clear();
        lookup.generation = lookup.generation.wrapping_add(1);
        if let Ok(mut snapshot) = self.0.snapshot.write() {
            *snapshot = Snapshot {
                generation: lookup.generation,
                ..Snapshot::default()
            };
        }
        self.0
            .updates
            .send_modify(|revision| *revision = revision.wrapping_add(1));
    }

    pub(super) fn refresh(
        &self,
        resolver: Option<Arc<TokioResolver>>,
        name: String,
        target: String,
        retry_target: String,
    ) {
        let Ok(mut lookup) = self.0.lookup.lock() else {
            return;
        };
        if lookup.closed {
            return;
        }
        lookup.retired.retain(|task| !task.is_finished());
        if lookup.target != target {
            if let Some(task) = lookup.task.take() {
                task.abort();
                lookup.retired.push(task);
            }
            lookup.target = target;
            lookup.generation = lookup.generation.wrapping_add(1);
            // One sample per resolver target, retained across refreshes.
            let bits = uuid::Uuid::new_v4().as_u128() as u64 & ((1_u64 << 53) - 1);
            lookup.percentage = bits as f64 * (100.0 / (1_u64 << 53) as f64);
            let Ok(mut snapshot) = self.0.snapshot.write() else {
                return;
            };
            *snapshot = Snapshot {
                generation: lookup.generation,
                target: retry_target,
                query_failed: false,
                selected: Ok(None),
                accepted: None,
                selector_ready: false,
                ..Snapshot::default()
            };
            self.0
                .updates
                .send_modify(|revision| *revision = revision.wrapping_add(1));
        } else if lookup.task.as_ref().is_some_and(|task| !task.is_finished()) {
            return;
        }
        // The pinned resolver retains its rejected pendingTxtPromise. Keep
        // that transport-failure slot until a new target/resolver owns it.
        if self
            .0
            .snapshot
            .read()
            .is_ok_and(|snapshot| snapshot.query_failed)
        {
            return;
        }
        // Missing TXT infrastructure must not skip target retirement or block
        // successful OS address publication/default config selection.
        let Some(resolver) = resolver else {
            return;
        };
        let state = self.0.snapshot.clone();
        let generation = lookup.generation;
        let percentage = lookup.percentage;
        let updates = self.0.updates.clone();
        // The task holds only snapshot state, never Inner/the task handle owner.
        // Dropping the final request/channel owner therefore aborts pending IO.
        lookup.task = Some(tokio::spawn(async move {
            let Ok(records) = resolver.txt_lookup(name).await else {
                if let Ok(mut snapshot) = state.write() {
                    if snapshot.generation == generation {
                        snapshot.query_failed = true;
                    }
                }
                return;
            };
            let mut selected = Ok(None);
            for answer in records.answers() {
                let RData::TXT(record) = &answer.data else {
                    continue;
                };
                let fragments = &record.txt_data;
                if !fragments
                    .first()
                    .is_some_and(|part| part.starts_with(b"grpc_config="))
                {
                    continue;
                }
                // Node decodes each TXT fragment before concatenating strings.
                let text: String = fragments
                    .iter()
                    .map(|part| String::from_utf8_lossy(part))
                    .collect();
                selected = select(&text["grpc_config=".len()..], percentage).map(Some);
                break;
            }
            if let Ok(mut snapshot) = state.write() {
                // A cancelled older target must not publish into a newer one.
                if snapshot.generation == generation {
                    // TXT completion before address success is only cached.
                    // Afterwards it is another successful resolution callback,
                    // independent of whether any method has selected config.
                    if snapshot.lookup_started.is_some()
                        && snapshot.address_started == snapshot.lookup_started
                    {
                        snapshot.selected = selected;
                        snapshot.pending_txt = None;
                        snapshot.accept_addresses();
                        updates.send_modify(|revision| *revision = revision.wrapping_add(1));
                    } else {
                        // A pending/failed lookup has no latest address result.
                        // Cache TXT for the next success without replaying the
                        // previous attempt's addresses or replacing its selector.
                        snapshot.pending_txt = Some(selected);
                    }
                }
            }
        }));
    }

    fn check(&self) -> Result<(Option<Value>, String), String> {
        let snapshot = self
            .0
            .snapshot
            .read()
            .map_err(|_| "gRPC service configuration unavailable.")?;
        match snapshot.selected.clone() {
            // Reading call policy is not a successful resolver callback. In
            // particular, initial DNS failure must not accept a default selector.
            Ok(selected) => Ok((selected, snapshot.target.clone())),
            Err(_) if snapshot.selector_ready => {
                Ok((snapshot.accepted.clone(), snapshot.target.clone()))
            }
            Err(error) => Err(error),
        }
    }
}

fn invalid() -> String {
    "Invalid gRPC DNS service configuration.".into()
}
fn object(value: &Value) -> Result<&Map, String> {
    value.as_object().ok_or_else(invalid)
}
fn numeric(value: Option<&Value>) -> Result<f64, String> {
    value.and_then(Value::as_f64).ok_or_else(invalid)
}
fn duration(value: &Value) -> bool {
    let Some(value) = value.as_str().and_then(|value| value.strip_suffix('s')) else {
        return false;
    };
    let mut parts = value.split('.');
    let seconds = parts.next().unwrap_or("");
    !seconds.is_empty()
        && seconds.bytes().all(|byte| byte.is_ascii_digit())
        && parts.next().is_none_or(|part| {
            !part.is_empty() && part.len() <= 9 && part.bytes().all(|byte| byte.is_ascii_digit())
        })
        && parts.next().is_none()
}
fn statuses(values: &[Value]) -> Result<(), String> {
    for value in values {
        // The pinned validator uppercases names; retry matching lowercases them.
        // These intentionally differ for some non-ASCII Unicode spellings.
        let valid = match value {
            Value::String(value) => super::retry::CODES.contains(&value.to_uppercase().as_str()),
            _ => super::retry::code(value).is_some(),
        };
        if !valid {
            return Err(invalid());
        }
    }
    Ok(())
}
fn attempts(value: &Map) -> Result<(), String> {
    let number = numeric(value.get("maxAttempts"))?;
    if number < 2.0 || number.fract() != 0.0 {
        return Err(invalid());
    }
    Ok(())
}
fn retry(value: &Value) -> Result<(), String> {
    let value = object(value)?;
    attempts(value)?;
    for key in ["initialBackoff", "maxBackoff"] {
        if !value.get(key).is_some_and(duration) {
            return Err(invalid());
        }
    }
    if numeric(value.get("backoffMultiplier"))? <= 0.0 {
        return Err(invalid());
    }
    let codes = value
        .get("retryableStatusCodes")
        .and_then(Value::as_array)
        .ok_or_else(invalid)?;
    if codes.is_empty() {
        return Err(invalid());
    }
    statuses(codes)
}
fn hedging(value: &Value) -> Result<(), String> {
    let value = object(value)?;
    attempts(value)?;
    if value
        .get("hedgingDelay")
        .is_some_and(|value| !duration(value))
    {
        return Err(invalid());
    }
    // The pinned validator validates this field only when it is an array.
    if let Some(codes) = value.get("nonFatalStatusCodes").and_then(Value::as_array) {
        statuses(codes)?;
    }
    Ok(())
}
fn name(value: &Value) -> Result<(Vec<u16>, Vec<u16>), String> {
    // JSON arrays have no named service/method properties in JavaScript.
    if value.is_array() {
        return Ok((Vec::new(), Vec::new()));
    }
    let value = object(value)?;
    match value.get("service") {
        None | Some(Value::String(_)) if value.get("service").is_none_or(|value| value == "") => {
            if value.contains_key("method") {
                return Err(invalid());
            }
            Ok((Vec::new(), Vec::new()))
        }
        Some(Value::String(service)) => {
            let method = value
                .get("method")
                .map(|value| {
                    value
                        .as_js_string()
                        .map(|value| value.units().to_vec())
                        .ok_or_else(invalid)
                })
                .transpose()?
                .unwrap_or_default();
            Ok((service.units().to_vec(), method))
        }
        _ => Err(invalid()),
    }
}
fn validate_config(value: &Value) -> Result<(), String> {
    // The reference uses named-property checks, not a plain-object check.
    // An array therefore validates as the default empty service config.
    if value.is_array() {
        return Ok(());
    }
    let value = object(value)?;
    if value
        .get("loadBalancingPolicy")
        .is_some_and(|value| !value.is_string())
    {
        return Err(invalid());
    }
    if let Some(configs) = value.get("loadBalancingConfig") {
        for config in configs.as_array().ok_or_else(invalid)? {
            // Object.keys([payload]) has one unknown policy key, "0". It is
            // structurally valid and later skipped by policy-list selection.
            if config.as_array().is_some_and(|entries| entries.len() == 1) {
                continue;
            }
            if object(config)?.len() != 1 {
                return Err(invalid());
            }
        }
    }
    let mut seen = std::collections::HashSet::new();
    // A non-array methodConfig is ignored by the pinned validator.
    for config in value
        .get("methodConfig")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        let config = object(config)?;
        let names = config
            .get("name")
            .and_then(Value::as_array)
            .ok_or_else(invalid)?;
        for item in names {
            if !seen.insert(name(item)?) {
                return Err(invalid());
            }
        }
        if config
            .get("waitForReady")
            .is_some_and(|value| !value.is_boolean())
        {
            return Err(invalid());
        }
        if let Some(timeout) = config.get("timeout") {
            if timeout.is_object() {
                numeric(timeout.get("seconds"))?;
                numeric(timeout.get("nanos"))?;
            } else if !duration(timeout) {
                return Err(invalid());
            }
        }
        for key in ["maxRequestBytes", "maxResponseBytes"] {
            if let Some(value) = config.get(key) {
                numeric(Some(value))?;
            }
        }
        match (config.get("retryPolicy"), config.get("hedgingPolicy")) {
            (Some(_), Some(_)) => return Err(invalid()),
            (Some(value), None) => retry(value)?,
            (None, Some(value)) => hedging(value)?,
            _ => {}
        }
    }
    if let Some(throttling) = value.get("retryThrottling") {
        let tokens = numeric(throttling.get("maxTokens"))?;
        let ratio = numeric(throttling.get("tokenRatio"))?;
        if !(0.0..=1000.0).contains(&tokens) || tokens == 0.0 || ratio <= 0.0 {
            return Err(invalid());
        }
    }
    Ok(())
}
fn select(text: &str, percentage: f64) -> Result<Value, String> {
    let choices: Value = Value::parse(text, 0).map_err(|_| invalid())?;
    for choice in choices.as_array().ok_or_else(invalid)? {
        let choice = object(choice)?;
        let config = choice.get("serviceConfig").ok_or_else(invalid)?;
        validate_config(config)?;
        if choice.keys().any(|key| {
            ![
                "serviceConfig",
                "clientLanguage",
                "clientHostname",
                "percentage",
            ]
            .contains(&key.as_str())
        }) {
            return Err(invalid());
        }
        for key in ["clientLanguage", "clientHostname"] {
            if let Some(values) = choice.get(key) {
                if values
                    .as_array()
                    .is_none_or(|values| values.iter().any(|value| !value.is_string()))
                {
                    return Err(invalid());
                }
            }
        }
        let limit = choice
            .get("percentage")
            .map(|value| numeric(Some(value)))
            .transpose()?;
        if limit.is_some_and(|value| !(0.0..=100.0).contains(&value)) {
            return Err(invalid());
        }
        if limit.is_some_and(|limit| percentage > limit) {
            continue;
        }
        if let Some(hosts) = choice.get("clientHostname").and_then(Value::as_array) {
            if hosts.is_empty() {
                continue;
            }
            let hostname = crate::template_os::read_os("hostname")?;
            if !hosts
                .iter()
                .any(|host| hostname.as_str().is_some_and(|name| host == name))
            {
                continue;
            }
        }
        if choice
            .get("clientLanguage")
            .and_then(Value::as_array)
            .is_some_and(|languages| !languages.iter().any(|language| language == "node"))
        {
            continue;
        }
        return Ok(config.clone());
    }
    Err("No matching gRPC DNS service configuration.".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn txt_json_preserves_js_number_and_utf16_selection() {
        let config = select(
            r#"[{"serviceConfig":{
            "retryThrottling":{"maxTokens":1,"tokenRatio":1e999},
            "methodConfig":[{"name":[
                {"service":"\ud800","method":"\udc00"},
                {"service":"\ud801","method":"\udc01"},{}
            ]}]
        }}]"#,
            50.0,
        )
        .unwrap();
        assert_eq!(
            config["retryThrottling"]["tokenRatio"].as_f64(),
            Some(f64::INFINITY)
        );
        let names = config["methodConfig"].as_array().unwrap()[0]["name"]
            .as_array()
            .unwrap();
        assert_eq!(name(&names[0]).unwrap(), (vec![0xd800], vec![0xdc00]));
        assert_eq!(name(&names[1]).unwrap(), (vec![0xd801], vec![0xdc01]));
        assert!(select(r#"[{"percentage":1e999,"serviceConfig":{}}]"#, 50.0).is_err());
    }
}
