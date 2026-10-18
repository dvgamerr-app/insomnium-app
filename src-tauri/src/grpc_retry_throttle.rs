//! Retry token buckets shared by target, as in grpc-js InternalChannel.
use serde_json::Value;
use std::{
    collections::HashMap,
    sync::{Arc, Mutex, OnceLock},
};

pub(super) struct Throttle {
    max: f64,
    ratio: f64,
    tokens: f64,
}
type Bucket = Arc<Mutex<Throttle>>;
static TARGETS: OnceLock<Mutex<HashMap<String, Bucket>>> = OnceLock::new();

// Number(toFixed(3)) for positive finite values. Scale the exact binary
// significand before rounding, avoiding a second binary64 rounding at *1000.
fn thousandths(value: f64) -> f64 {
    if value >= (1_u64 << 43) as f64 {
        return value;
    }
    let bits = value.to_bits();
    let exponent = ((bits >> 52) & 0x7ff) as i32;
    let mantissa = bits & ((1_u64 << 52) - 1);
    let (mantissa, shift) = if exponent == 0 {
        (mantissa, -1074)
    } else {
        (mantissa | (1_u64 << 52), exponent - 1023 - 52)
    };
    if shift >= 0 {
        return value;
    }
    let shift = (-shift) as u32;
    if shift >= 64 {
        return 0.0;
    }
    let scaled = mantissa as u128 * 1000;
    let rounded = (scaled + (1_u128 << (shift - 1))) >> shift;
    rounded as f64 / 1000.0
}

impl Throttle {
    pub(super) fn configure(
        target: &str,
        config: Option<&Value>,
    ) -> Result<Option<Bucket>, String> {
        let registry = TARGETS.get_or_init(Default::default);
        let mut registry = registry
            .lock()
            .map_err(|_| "gRPC retry throttling unavailable.")?;
        let Some(config) = config else {
            registry.remove(target);
            return Ok(None);
        };
        let max = thousandths(
            config
                .get("maxTokens")
                .and_then(Value::as_f64)
                .ok_or("Invalid gRPC retry throttling.")?,
        );
        let ratio = thousandths(
            config
                .get("tokenRatio")
                .and_then(Value::as_f64)
                .ok_or("Invalid gRPC retry throttling.")?,
        );
        let mut tokens = max;
        if let Some(previous) = registry.get(target) {
            let previous_state = previous
                .lock()
                .map_err(|_| "gRPC retry throttling unavailable.")?;
            tokens = previous_state.tokens * (max / previous_state.max);
        }
        let bucket = Arc::new(Mutex::new(Self { max, ratio, tokens }));
        registry.insert(target.to_owned(), bucket.clone());
        Ok(Some(bucket))
    }
    pub(super) fn current(target: &str) -> Result<Option<Bucket>, String> {
        let registry = TARGETS.get_or_init(Default::default);
        Ok(registry
            .lock()
            .map_err(|_| "gRPC retry throttling unavailable.")?
            .get(target)
            .cloned())
    }
    pub(super) fn failed(&mut self) {
        if !self.tokens.is_nan() {
            self.tokens = (self.tokens - 1.0).max(0.0);
        }
    }
    pub(super) fn succeeded(&mut self) {
        if !self.tokens.is_nan() {
            self.tokens = (self.tokens + self.ratio).min(self.max);
        }
    }
    pub(super) fn allowed(&self) -> bool {
        self.tokens > self.max / 2.0
    }
}
