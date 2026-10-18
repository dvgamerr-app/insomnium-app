//! Pinned grpc-js built-in policy-list selection; picker execution is separate.
use serde_json::Value;
use std::sync::OnceLock;

#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum Kind {
    PickFirst,
    RoundRobin,
    WeightedRoundRobin,
    OutlierDetection,
}
pub(crate) struct Selection {
    pub(crate) kind: Kind,
    pub(crate) shuffle: bool,
    pub(crate) config: Option<Value>,
}
fn object_like(value: &Value) -> bool {
    value.is_object() || value.is_array()
}
fn number(value: &Value, field: &str) -> bool {
    value.get(field).is_none_or(Value::is_number)
}
fn percentage(value: &Value, field: &str) -> bool {
    value.get(field).is_none_or(|value| {
        value
            .as_f64()
            .is_some_and(|value| (0.0..=100.0).contains(&value))
    })
}
fn duration_object(value: &Value, positive: bool) -> bool {
    let Some(seconds) = value.get("seconds").and_then(Value::as_f64) else {
        return false;
    };
    let Some(nanos) = value.get("nanos").and_then(Value::as_f64) else {
        return false;
    };
    !positive
        || ((0.0..=315_576_000_000.0).contains(&seconds) && (0.0..=999_999_999.0).contains(&nanos))
}
fn duration_string(value: &str) -> bool {
    // The pinned non-multiline duration regex requires the actual end of input.
    let Some(value) = value.strip_suffix('s') else {
        return false;
    };
    let mut parts = value.split('.');
    let seconds = parts.next().unwrap_or("");
    let digits = |value: &str| !value.is_empty() && value.bytes().all(|byte| byte.is_ascii_digit());
    digits(seconds) && parts.next().is_none_or(digits) && parts.next().is_none()
}
fn weighted_duration(value: &Value) -> bool {
    if value.is_null() {
        return true;
    }
    if let Some(value) = value.as_str() {
        return duration_string(value);
    }
    duration_object(value, false)
        || (value.get("seconds").is_some_and(Value::is_string)
            && value.get("nanos").is_some_and(Value::is_number))
}
fn weighted(value: &Value) -> bool {
    object_like(value)
        && value
            .get("enable_oob_load_report")
            .is_none_or(Value::is_boolean)
        && number(value, "error_utilization_penalty")
        && value
            .get("error_utilization_penalty")
            .is_none_or(|value| value.as_f64().is_some_and(|value| value >= 0.0))
        && [
            "oob_load_reporting_period",
            "blackout_period",
            "weight_expiration_period",
            "weight_update_period",
        ]
        .iter()
        .all(|field| value.get(field).is_none_or(weighted_duration))
}
fn outlier(value: &Value) -> bool {
    static ENABLED: OnceLock<bool> = OnceLock::new();
    if !*ENABLED.get_or_init(|| {
        std::env::var("GRPC_EXPERIMENTAL_ENABLE_OUTLIER_DETECTION")
            .map_or(true, |value| value == "true")
    }) {
        return false;
    }
    if !object_like(value)
        || !["interval", "base_ejection_time", "max_ejection_time"]
            .iter()
            .all(|field| {
                value
                    .get(field)
                    .is_none_or(|value| duration_object(value, true))
            })
        || !percentage(value, "max_ejection_percent")
    {
        return false;
    }
    if let Some(config) = value.get("success_rate_ejection") {
        if !object_like(config)
            || !number(config, "stdev_factor")
            || !percentage(config, "enforcement_percentage")
            || !number(config, "minimum_hosts")
            || !number(config, "request_volume")
        {
            return false;
        }
    }
    if let Some(config) = value.get("failure_percentage_ejection") {
        if !object_like(config)
            || !percentage(config, "threshold")
            || !percentage(config, "enforcement_percentage")
            || !number(config, "minimum_hosts")
            || !number(config, "request_volume")
        {
            return false;
        }
    }
    value
        .get("child_policy")
        .and_then(select_list)
        .is_some_and(|child| child.kind != Kind::PickFirst)
}
fn parse(value: &Value) -> Option<Selection> {
    let config = value.as_object().filter(|config| config.len() == 1)?;
    let (name, value) = config.iter().next()?;
    let kind = match name.as_str() {
        "pick_first"
            if object_like(value)
                && value
                    .get("shuffleAddressList")
                    .is_none_or(Value::is_boolean) =>
        {
            Kind::PickFirst
        }
        // This parser ignores the payload entirely in the pinned package.
        "round_robin" => Kind::RoundRobin,
        "weighted_round_robin" if weighted(value) => Kind::WeightedRoundRobin,
        "outlier_detection" if outlier(value) => Kind::OutlierDetection,
        _ => return None,
    };
    Some(Selection {
        kind,
        config: matches!(kind, Kind::WeightedRoundRobin | Kind::OutlierDetection)
            .then(|| value.clone()),
        shuffle: value
            .get("shuffleAddressList")
            .and_then(Value::as_bool)
            .unwrap_or(false),
    })
}
fn select_list(value: &Value) -> Option<Selection> {
    value.as_array()?.iter().find_map(parse)
}
pub(crate) fn select(root: Option<&Value>) -> Selection {
    root.and_then(|root| root.get("loadBalancingConfig"))
        .and_then(select_list)
        .unwrap_or(Selection {
            kind: Kind::PickFirst,
            shuffle: false,
            config: None,
        })
}
