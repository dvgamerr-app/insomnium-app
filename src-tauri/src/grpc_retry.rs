//! Configured retries before response headers, with one replay/cancellation owner.
use super::replay::{Guard, Input};
use crate::grpc_legacy::Json as Value;
use prost::Message;
use std::{
    future::Future,
    pin::Pin,
    sync::{Arc, Mutex},
    task::{Context, Poll},
    time::Duration,
};
use tonic::{
    client::Grpc, codec::Codec, metadata::MetadataMap, Request, Response, Status, Streaming,
};

#[path = "grpc_retry_throttle.rs"]
mod throttle;
pub(super) fn normalize_throttle_number(value: f64) -> f64 {
    throttle::thousandths(value)
}
use throttle::Throttle;

#[path = "grpc_hedging.rs"]
mod hedging;

type HeaderHook = Arc<dyn Fn() + Send + Sync>;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Progress {
    NotStarted,
    Refused,
    Processed,
}
fn progress(status: &Status) -> Progress {
    let mut error = std::error::Error::source(status);
    while let Some(current) = error {
        if current.is::<super::lb_transport::NotStarted>() {
            return Progress::NotStarted;
        }
        // This transport exclusively dispatches HTTP/2 requests. In the
        // pinned Hyper client, Canceled means the request was still queued or
        // rejected before dispatch; dropped in-flight callbacks use UserGone.
        if current
            .downcast_ref::<hyper::Error>()
            .is_some_and(hyper::Error::is_canceled)
        {
            return Progress::NotStarted;
        }
        if let Some(http2) = current.downcast_ref::<h2::Error>() {
            return if http2.is_remote()
                && http2.is_reset()
                && http2.reason() == Some(h2::Reason::REFUSED_STREAM)
            {
                Progress::Refused
            } else {
                Progress::Processed
            };
        }
        error = current.source();
    }
    Progress::Processed
}

fn readiness_error(error: super::lb_transport::Error) -> Status {
    // Preserve the selected policy/endpoint diagnostic and typed progress data.
    let mut status = Status::unavailable(error.to_string());
    status.set_source(Arc::new(error));
    status
}
#[derive(Default)]
struct Headers {
    hook: Option<HeaderHook>,
    terminal_encoding: Vec<tonic::metadata::MetadataValue<tonic::metadata::Ascii>>,
}
type HeaderWatch = Arc<Mutex<Headers>>;
#[derive(Clone)]
struct AttemptHeaders(HeaderWatch);
#[derive(Clone)]
pub(super) struct ObservedChannel {
    inner: super::lb_transport::Channel,
    headers: HeaderWatch,
}
impl tower::Service<tonic::codegen::http::Request<tonic::body::Body>> for ObservedChannel {
    type Response = tonic::codegen::http::Response<tonic::body::Body>;
    type Error = super::lb_transport::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;
    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        tower::Service::poll_ready(&mut self.inner, cx)
    }
    fn call(&mut self, request: tonic::codegen::http::Request<tonic::body::Body>) -> Self::Future {
        let watch = request
            .extensions()
            .get::<AttemptHeaders>()
            .map_or_else(|| self.headers.clone(), |watch| watch.0.clone());
        let future = tower::Service::call(&mut self.inner, request);
        let hook = watch
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .hook
            .clone();
        let headers = watch;
        Box::pin(async move {
            let mut response = future.await?;
            // Observe metadata before Tonic's compression/codec validation:
            // an error there must not replay a call already committed by headers.
            // END_STREAM headers are status delivery even when grpc-status is
            // absent. They must not commit a retry as initial metadata would.
            let terminal = tonic::codegen::Body::is_end_stream(response.body());
            if terminal && response.headers().contains_key("grpc-status") {
                // A trailers-only response has no compressed messages. Tonic
                // validates encoding before status, unlike grpc-js; defer this
                // irrelevant header and restore it to the exposed metadata.
                let metadata = MetadataMap::from_headers(response.headers().clone());
                headers
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .terminal_encoding =
                    metadata.get_all("grpc-encoding").iter().cloned().collect();
                response.headers_mut().remove("grpc-encoding");
            }
            if !terminal
                || response
                    .headers()
                    .get("grpc-status")
                    .is_some_and(|value| value == "0")
            {
                if let Some(hook) = hook {
                    hook();
                }
            }
            Ok(response)
        })
    }
}

pub(super) fn publish_throttling(target: &str, config: Option<&Value>) -> Result<(), String> {
    Throttle::configure(target, config).map(|_| ())
}

pub(super) const CODES: &[&str] = &[
    "OK",
    "CANCELLED",
    "UNKNOWN",
    "INVALID_ARGUMENT",
    "DEADLINE_EXCEEDED",
    "NOT_FOUND",
    "ALREADY_EXISTS",
    "PERMISSION_DENIED",
    "RESOURCE_EXHAUSTED",
    "FAILED_PRECONDITION",
    "ABORTED",
    "OUT_OF_RANGE",
    "UNIMPLEMENTED",
    "INTERNAL",
    "UNAVAILABLE",
    "DATA_LOSS",
    "UNAUTHENTICATED",
];
pub(super) fn code(value: &Value) -> Option<i32> {
    if let Some(value) = value.as_f64() {
        return ((0.0..=16.0).contains(&value) && value.fract() == 0.0).then_some(value as i32);
    }
    value
        .as_str()
        .and_then(|value| {
            CODES
                .iter()
                .position(|name| value.to_lowercase() == name.to_ascii_lowercase())
        })
        .map(|value| value as i32)
}
fn sample() -> f64 {
    let bits = uuid::Uuid::new_v4().as_u128() as u64 & ((1_u64 << 53) - 1);
    bits as f64 / (1_u64 << 53) as f64
}
fn seconds(value: Option<&Value>) -> Result<f64, String> {
    value
        .and_then(Value::as_str)
        .and_then(|value| value.strip_suffix('s'))
        .and_then(|value| value.parse::<f64>().ok())
        .ok_or_else(|| "Invalid gRPC retry duration.".into())
}
fn timer(value: f64) -> Duration {
    // Node setTimeout clamps zero, NaN, infinity and overflow to one millisecond.
    Duration::from_millis(
        if !value.is_finite() || !(1.0..=2_147_483_647.0).contains(&value) {
            1
        } else {
            value.trunc() as u64
        },
    )
}
pub(super) fn pushback(value: &str) -> f64 {
    let value = value.trim_start_matches(|c| matches!(c, '\u{0009}'..='\u{000d}' | '\u{0020}' | '\u{00a0}' | '\u{1680}' | '\u{2000}'..='\u{200a}' | '\u{2028}' | '\u{2029}' | '\u{202f}' | '\u{205f}' | '\u{3000}' | '\u{feff}'));
    let negative = value.starts_with('-');
    let value = value.strip_prefix(['+', '-']).unwrap_or(value);
    let (value, radix) = value
        .strip_prefix("0x")
        .or_else(|| value.strip_prefix("0X"))
        .map_or((value, 10), |value| (value, 16));
    let length = value
        .bytes()
        .take_while(|byte| (*byte as char).is_digit(radix))
        .count();
    let digits = &value[..length];
    // parseInt rounds the integer once, not at every multiply/add step.
    let parsed = if radix == 10 {
        digits.parse::<f64>().unwrap_or(f64::NAN)
    } else {
        crate::grpc_legacy::radix_number(digits, radix)
    };
    if digits.is_empty() {
        f64::NAN
    } else if negative {
        -parsed
    } else {
        parsed
    }
}

struct Policy {
    max: usize,
    initial: f64,
    next: f64,
    cap: f64,
    multiplier: f64,
    codes: Vec<i32>,
}
pub(super) struct Session {
    policy: Option<Policy>,
    hedge: Option<Hedge>,
    throttle: Option<Arc<Mutex<Throttle>>>,
    headers: HeaderWatch,
}
struct Hedge {
    max: usize,
    delay: Duration,
    codes: Vec<i32>,
    invalid_codes: bool,
}
impl Session {
    pub(super) fn new(method: Option<&Value>, target: &str) -> Result<Self, String> {
        let policy = method
            .and_then(|method| method.get("retryPolicy"))
            .map(|value| {
                let initial = seconds(value.get("initialBackoff"))?;
                Ok::<_, String>(Policy {
                    max: value
                        .get("maxAttempts")
                        .and_then(Value::as_f64)
                        .ok_or("Invalid gRPC retry attempts.")?
                        .min(5.0) as usize,
                    initial,
                    next: initial,
                    cap: seconds(value.get("maxBackoff"))?,
                    multiplier: value
                        .get("backoffMultiplier")
                        .and_then(Value::as_f64)
                        .ok_or("Invalid gRPC retry multiplier.")?,
                    codes: value
                        .get("retryableStatusCodes")
                        .and_then(Value::as_array)
                        .ok_or("Invalid gRPC retry codes.")?
                        .iter()
                        .filter_map(code)
                        .collect(),
                })
            })
            .transpose()?;
        Ok(Self {
            policy,
            hedge: method
                .and_then(|method| method.get("hedgingPolicy"))
                .map(|value| {
                    Ok::<_, String>(Hedge {
                        max: value
                            .get("maxAttempts")
                            .and_then(Value::as_f64)
                            .ok_or("Invalid gRPC hedging attempts.")?
                            .min(5.0) as usize,
                        delay: timer(if value.get("hedgingDelay").is_some() {
                            seconds(value.get("hedgingDelay"))? * 1000.0
                        } else {
                            0.0
                        }),
                        codes: value
                            .get("nonFatalStatusCodes")
                            .and_then(Value::as_array)
                            .map(|values| values.iter().filter_map(code).collect())
                            .unwrap_or_default(),
                        // Normalization retains truthy non-array values, just
                        // like grpc-js. Its status callback cannot call .some
                        // on those values; do not silently treat them as [].
                        invalid_codes: value
                            .get("nonFatalStatusCodes")
                            .is_some_and(|codes| !codes.is_array()),
                    })
                })
                .transpose()?,
            throttle: Throttle::current(target)?,
            headers: Default::default(),
        })
    }
    pub(super) fn channel(
        &self,
        channel: impl Into<super::lb_transport::Channel>,
    ) -> ObservedChannel {
        ObservedChannel {
            inner: channel.into(),
            headers: self.headers.clone(),
        }
    }
    fn failed(&self) {
        if let Some(throttle) = &self.throttle {
            if let Ok(mut throttle) = throttle.lock() {
                throttle.failed();
            }
        }
    }
    fn allowed(&self) -> bool {
        self.throttle
            .as_ref()
            .is_none_or(|throttle| throttle.lock().is_ok_and(|throttle| throttle.allowed()))
    }
    fn delay(&mut self, status: &Status, attempt: usize) -> Option<Duration> {
        let policy = self.policy.as_mut()?;
        if attempt + 1 >= policy.max {
            return None;
        }
        let milliseconds = if let Some(value) = status.metadata().get("grpc-retry-pushback-ms") {
            let delay = pushback(value.to_str().unwrap_or(""));
            if delay < 0.0 {
                return None;
            }
            policy.next = policy.initial;
            delay
        } else {
            let delay = (0.8 + sample() * 0.4) * policy.next * 1000.0;
            let next = policy.next * policy.multiplier;
            // Math.min preserves NaN, unlike Rust's f64::min.
            policy.next = if next.is_nan() {
                next
            } else {
                next.min(policy.cap)
            };
            delay
        };
        Some(timer(milliseconds))
    }
}

pub(super) struct Completion<M> {
    guard: Guard<M>,
    throttle: Option<Arc<Mutex<Throttle>>>,
    reported: bool,
}
impl<M> Completion<M> {
    pub(super) fn succeeded(&mut self) {
        if !self.reported {
            if let Some(throttle) = &self.throttle {
                if let Ok(mut throttle) = throttle.lock() {
                    throttle.succeeded();
                }
            }
        }
        self.failed();
    }
    pub(super) fn failed(&mut self) {
        self.reported = true;
        self.guard.0.cancel();
    }
}
pub(super) struct Started<M, D> {
    pub(super) response: Response<Streaming<D>>,
    pub(super) completion: Completion<M>,
}

pub(super) async fn streaming_prepared<C>(
    client: &mut Grpc<ObservedChannel>,
    guard: Guard<C::Encode>,
    metadata: MetadataMap,
    path: tonic::codegen::http::uri::PathAndQuery,
    codec: C,
    mut session: Session,
    deadline: Option<tokio::time::Instant>,
) -> Result<Started<C::Encode, C::Decode>, Status>
where
    C: Codec + Clone + Send + 'static,
    C::Encode: Message + Clone + Send + Sync + 'static,
    C::Decode: Send + Sync + 'static,
{
    if session.hedge.is_some() {
        return hedging::streaming(client, guard, metadata, path, codec, session, deadline).await;
    }
    let mut attempt = 0;
    let mut transparent_refused = false;
    loop {
        guard.0.stage_pending();
        session
            .headers
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .terminal_encoding
            .clear();
        let body = guard.0.attempt();
        let id = body.id();
        let input = guard.0.clone();
        session
            .headers
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .hook = Some(Arc::new(move || input.commit(id)));
        let mut outgoing = Request::new(body);
        *outgoing.metadata_mut() = metadata.clone();
        let previous = if attempt == 0 {
            None
        } else {
            Some(
                attempt
                    .to_string()
                    .parse::<tonic::metadata::MetadataValue<tonic::metadata::Ascii>>()
                    .map_err(|_| Status::internal("Invalid gRPC attempt metadata."))?,
            )
        };
        if let Some(previous) = &previous {
            outgoing
                .metadata_mut()
                .insert("grpc-previous-rpc-attempts", previous.clone());
        }
        let result = match client.ready().await {
            Ok(()) => {
                guard.0.stage_pending();
                if let Some(deadline) = deadline {
                    let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
                    if remaining.is_zero() {
                        return Err(Status::deadline_exceeded("gRPC deadline exceeded."));
                    }
                    outgoing.set_timeout(remaining);
                }
                client
                    .streaming(outgoing, path.clone(), codec.clone())
                    .await
            }
            Err(error) => Err(readiness_error(error)),
        };
        match result {
            Ok(mut response) => {
                for encoding in &session
                    .headers
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .terminal_encoding
                {
                    response
                        .metadata_mut()
                        .append("grpc-encoding", encoding.clone());
                }
                if let Some(previous) = previous {
                    response
                        .metadata_mut()
                        .insert("grpc-previous-rpc-attempts", previous);
                }
                // Initial response metadata commits the attempt. No response
                // messages or later trailers may cause a replay after this.
                guard.0.commit(id);
                return Ok(Started {
                    response,
                    completion: Completion {
                        guard,
                        throttle: session.throttle.clone(),
                        reported: false,
                    },
                });
            }
            Err(mut status) => {
                for encoding in &session
                    .headers
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .terminal_encoding
                {
                    status
                        .metadata_mut()
                        .append("grpc-encoding", encoding.clone());
                }
                if let Some(previous) = previous {
                    status
                        .metadata_mut()
                        .insert("grpc-previous-rpc-attempts", previous);
                }
                guard.0.end_attempt(id);
                if !guard.0.committed() {
                    match progress(&status) {
                        Progress::NotStarted => {
                            // No limit for requests that never left this client.
                            // Yield so repeated immediate dispatch failures do
                            // not starve cancellation or the absolute deadline.
                            tokio::task::yield_now().await;
                            continue;
                        }
                        Progress::Refused if !transparent_refused => {
                            transparent_refused = true;
                            continue;
                        }
                        _ => {}
                    }
                }
                if guard.0.committed()
                    || !session
                        .policy
                        .as_ref()
                        .is_some_and(|policy| policy.codes.contains(&(status.code() as i32)))
                {
                    return Err(status);
                }
                session.failed();
                let Some(delay) = session.delay(&status, attempt) else {
                    return Err(status);
                };
                guard.0.backoff(delay).await;
                if guard.0.committed() || !session.allowed() {
                    return Err(status);
                }
                attempt += 1;
            }
        }
    }
}
