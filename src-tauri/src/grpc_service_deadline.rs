//! grpc-js service-config Date setters, distinct from protobuf Duration parsing.
use super::CallDeadline;
use chrono::{DateTime, Local, LocalResult, NaiveDateTime, TimeDelta, TimeZone, Timelike};
use serde_json::Value;
use std::time::Duration;
use tokio::time::Instant;

fn integer32(value: &str) -> f64 {
    let value = value.parse::<f64>().unwrap_or(f64::INFINITY);
    if !value.is_finite() || value == 0.0 {
        return 0.0;
    }
    (value.trunc().rem_euclid(4_294_967_296.0) as u32 as i32) as f64
}

fn components(value: &Value) -> Option<(f64, f64)> {
    if let Some(value) = value.as_str() {
        let mut parts = value.strip_suffix('s')?.split('.');
        return Some((
            integer32(parts.next()?),
            integer32(parts.next().unwrap_or("0")),
        ));
    }
    Some((
        value.get("seconds")?.as_f64()?,
        value.get("nanos")?.as_f64()?,
    ))
}

fn calendar_error() -> String {
    "gRPC service-config timeout exceeds the supported local calendar range.".into()
}

// ECMAScript compatible disambiguation: first instant in a fold; the offset
// before the transition in a gap (which moves the wall time forward by the gap).
fn local_time(value: NaiveDateTime) -> Result<DateTime<Local>, String> {
    match Local.from_local_datetime(&value) {
        LocalResult::Single(value) => Ok(value),
        LocalResult::Ambiguous(first, second) => Ok(first.min(second)),
        LocalResult::None => {
            let mut hours = 1_i64;
            loop {
                let before = TimeDelta::try_hours(hours)
                    .and_then(|delta| value.checked_sub_signed(delta))
                    .ok_or_else(calendar_error)?;
                if let Some(before) = Local.from_local_datetime(&before).earliest() {
                    return before
                        .offset()
                        .from_local_datetime(&value)
                        .single()
                        .map(|value| value.with_timezone(&Local))
                        .ok_or_else(calendar_error);
                }
                hours = hours.checked_mul(2).ok_or_else(calendar_error)?;
            }
        }
    }
}

fn setter(
    base: NaiveDateTime,
    value: f64,
    seconds: bool,
) -> Result<Option<DateTime<Local>>, String> {
    // Date TimeClip rejects non-finite values and timestamps outside 100M days.
    let estimate =
        base.and_utc().timestamp_millis() as f64 + value * if seconds { 1000.0 } else { 1.0 };
    if !estimate.is_finite() || estimate.abs() > 8_640_000_000_000_000.0 + 86_400_000.0 {
        return Ok(None);
    }
    if !value.is_finite() || value < i64::MIN as f64 || value >= i64::MAX as f64 {
        return Ok(None);
    }
    let delta = if seconds {
        TimeDelta::try_seconds(value as i64)
    } else {
        TimeDelta::try_milliseconds(value as i64)
    };
    let target = delta
        .and_then(|delta| base.checked_add_signed(delta))
        .ok_or_else(calendar_error)?;
    let target = local_time(target)?;
    if target.timestamp_millis().unsigned_abs() > 8_640_000_000_000_000 {
        return Ok(None);
    }
    Ok(Some(target))
}

/// Equivalent to date.setMilliseconds(date.getMilliseconds() + amount).
/// Invalid Date/TimeClip produces None; unsupported native calendar ranges
/// remain an explicit error, as with method-config deadline setters.
pub(crate) fn add_milliseconds(start: i64, amount: f64) -> Result<Option<i64>, String> {
    if start.unsigned_abs() > 8_640_000_000_000_000 {
        return Ok(None);
    }
    let wall = Local
        .timestamp_millis_opt(start)
        .single()
        .ok_or_else(calendar_error)?;
    let naive = wall.naive_local();
    let base = naive.with_nanosecond(0).ok_or_else(calendar_error)?;
    setter(
        base,
        (naive.nanosecond() as f64 / 1_000_000.0 + amount).trunc(),
        false,
    )
    .map(|target| target.map(|target| target.timestamp_millis()))
}

pub(super) fn apply(
    timeout: Option<&Value>,
    previous: Option<Instant>,
) -> Result<CallDeadline, String> {
    let unchanged = CallDeadline {
        wire: previous,
        timer: previous,
    };
    let Some(timeout) = timeout else {
        return Ok(unchanged);
    };
    let (seconds, nanos) = components(timeout).ok_or("Invalid gRPC service-config timeout.")?;
    let clock = Instant::now();
    let wall = Local::now();
    let wall = wall
        .with_nanosecond(wall.nanosecond() / 1_000_000 * 1_000_000)
        .ok_or_else(calendar_error)?;
    let naive = wall.naive_local();
    let base = naive.with_second(0).ok_or_else(calendar_error)?;
    let Some(first) = setter(base, (naive.second() as f64 + seconds).trunc(), true)? else {
        // minDeadline ignores an invalid Date's NaN comparison.
        return Ok(unchanged);
    };
    let naive = first.naive_local();
    let base = naive.with_nanosecond(0).ok_or_else(calendar_error)?;
    let Some(target) = setter(
        base,
        (naive.nanosecond() as f64 / 1_000_000.0 + nanos / 1_000_000.0).trunc(),
        false,
    )?
    else {
        return Ok(unchanged);
    };
    let delay = target
        .timestamp_millis()
        .saturating_sub(wall.timestamp_millis());
    let target = if delay <= 0 {
        clock
    } else {
        clock
            .checked_add(Duration::from_millis(delay as u64))
            .ok_or_else(calendar_error)?
    };
    if previous.is_some_and(|previous| previous <= target) {
        return Ok(unchanged);
    }
    // grpc-js omits local timers beyond signed 32-bit milliseconds and wire
    // timeouts that cannot fit an 8-digit unit. Tonic would panic on the latter.
    Ok(CallDeadline {
        wire: (delay < 100_000_000_i64 * 3_600_000).then_some(target),
        timer: (delay <= 2_147_483_647).then_some(target),
    })
}
