//! Concurrent configured attempts; all work is owned by the logical RPC future.
use super::*;
use futures_util::{
    future::{AbortHandle, Abortable, BoxFuture},
    stream::FuturesUnordered,
    StreamExt,
};
use std::collections::BTreeMap;
use tokio::time::Instant;

type Outcome<D> = Option<Result<Response<Streaming<D>>, Status>>;
type Jobs<D> = FuturesUnordered<BoxFuture<'static, (u64, Outcome<D>)>>;

fn begin<C>(
    template: &Grpc<ObservedChannel>,
    input: &Arc<Input<C::Encode>>,
    metadata: &MetadataMap,
    path: &tonic::codegen::http::uri::PathAndQuery,
    codec: &C,
    previous: usize,
    deadline: Option<Instant>,
    jobs: &mut Jobs<C::Decode>,
    active: &mut BTreeMap<u64, AbortHandle>,
) where
    C: Codec + Clone + Send + 'static,
    C::Encode: Message + Clone + Send + Sync + 'static,
    C::Decode: Send + Sync + 'static,
{
    let body = input.attempt();
    let id = body.id();
    let owner = input.clone();
    let headers = Arc::new(Mutex::new(Headers {
        hook: Some(Arc::new(move || owner.commit(id))),
        terminal_encoding: Vec::new(),
    }));
    let mut request = Request::new(body);
    *request.metadata_mut() = metadata.clone();
    request
        .extensions_mut()
        .insert(AttemptHeaders(headers.clone()));
    let path = path.clone();
    let codec = codec.clone();
    let mut client = template.clone();
    let (abort, registration) = AbortHandle::new_pair();
    active.insert(id, abort);
    let work = async move {
        let previous = if previous == 0 {
            None
        } else {
            Some(
                previous
                    .to_string()
                    .parse::<tonic::metadata::MetadataValue<tonic::metadata::Ascii>>()
                    .map_err(|_| Status::internal("Invalid gRPC attempt metadata."))?,
            )
        };
        if let Some(previous) = &previous {
            request
                .metadata_mut()
                .insert("grpc-previous-rpc-attempts", previous.clone());
        }
        let result = match client.ready().await {
            Ok(()) => {
                if let Some(deadline) = deadline {
                    let remaining = deadline.saturating_duration_since(Instant::now());
                    if remaining.is_zero() {
                        return Err(Status::deadline_exceeded("gRPC deadline exceeded."));
                    }
                    request.set_timeout(remaining);
                }
                client.streaming(request, path, codec).await
            }
            Err(error) => Err(readiness_error(error)),
        };
        let encodings = headers
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .terminal_encoding
            .clone();
        match result {
            Ok(mut response) => {
                for encoding in encodings {
                    response.metadata_mut().append("grpc-encoding", encoding);
                }
                if let Some(previous) = previous {
                    response
                        .metadata_mut()
                        .insert("grpc-previous-rpc-attempts", previous);
                }
                Ok(response)
            }
            Err(mut status) => {
                for encoding in encodings {
                    status.metadata_mut().append("grpc-encoding", encoding);
                }
                if let Some(previous) = previous {
                    status
                        .metadata_mut()
                        .insert("grpc-previous-rpc-attempts", previous);
                }
                Err(status)
            }
        }
    };
    jobs.push(Box::pin(async move {
        (id, Abortable::new(work, registration).await.ok())
    }));
}

pub(super) async fn streaming<C>(
    client: &mut Grpc<ObservedChannel>,
    guard: Guard<C::Encode>,
    metadata: MetadataMap,
    path: tonic::codegen::http::uri::PathAndQuery,
    codec: C,
    session: Session,
    deadline: Option<Instant>,
) -> Result<Started<C::Encode, C::Decode>, Status>
where
    C: Codec + Clone + Send + 'static,
    C::Encode: Message + Clone + Send + Sync + 'static,
    C::Decode: Send + Sync + 'static,
{
    let hedge = session.hedge.as_ref().expect("Selected hedging policy");
    guard.0.stage_pending();
    let mut jobs = Jobs::new();
    let mut active = BTreeMap::new();
    let mut attempts = 1usize;
    let mut refused_used = false;
    begin(
        client,
        &guard.0,
        &metadata,
        &path,
        &codec,
        0,
        deadline,
        &mut jobs,
        &mut active,
    );
    let mut regular = (attempts < hedge.max).then(|| Instant::now() + hedge.delay);
    // Nonfatal-status callbacks are independent of the regular hedge timer in
    // grpc-js. A new attempt resets only the regular timer, not these callbacks.
    let mut callbacks: Vec<(Instant, u64, Status)> = Vec::new();
    loop {
        if let Some(winner) = guard.0.winner() {
            regular = None;
            callbacks.clear();
            active.retain(|&id, abort| {
                if id == winner {
                    true
                } else {
                    abort.abort();
                    guard.0.end_attempt(id);
                    false
                }
            });
        }
        let next = regular
            .into_iter()
            .chain(callbacks.iter().map(|(when, _, _)| *when))
            .min();
        let wait = async {
            match next {
                Some(next) => tokio::time::sleep_until(next).await,
                None => std::future::pending::<()>().await,
            }
        };
        tokio::pin!(wait);
        tokio::select! {
            biased;
            _ = guard.0.changes.notified() => {},
            result = jobs.next(), if !jobs.is_empty() => {
                let Some((id, result)) = result else { continue };
                if active.remove(&id).is_none() { continue; }
                let Some(result) = result else { continue };
                if guard.0.winner().is_some_and(|winner| winner != id) {
                    guard.0.end_attempt(id);
                    continue;
                }
                match result {
                    Ok(response) => {
                        guard.0.commit(id);
                        // Dropping the set cancels all losing request futures;
                        // Input winner selection also cuts their body ownership.
                        return Ok(Started {
                            response,
                            completion: Completion { guard, throttle: session.throttle.clone(), reported: false },
                        });
                    }
                    Err(status) => {
                        guard.0.end_attempt(id);
                        if guard.0.committed() {
                            if guard.0.claim_status(id) { return Err(status); }
                            continue;
                        }
                        match progress(&status) {
                            Progress::NotStarted => {
                                tokio::task::yield_now().await;
                                begin(client, &guard.0, &metadata, &path, &codec, attempts - 1, deadline, &mut jobs, &mut active);
                                continue;
                            }
                            Progress::Refused if !refused_used => {
                                refused_used = true;
                                begin(client, &guard.0, &metadata, &path, &codec, attempts - 1, deadline, &mut jobs, &mut active);
                                continue;
                            }
                            _ => {}
                        }
                        if !hedge.codes.contains(&(status.code() as i32)) {
                            if guard.0.claim_status(id) { return Err(status); }
                            continue;
                        }
                        session.failed();
                        let delay = match status.metadata().get("grpc-retry-pushback-ms") {
                            None => timer(0.0),
                            Some(value) => {
                                let milliseconds = pushback(value.to_str().unwrap_or(""));
                                if milliseconds < 0.0 {
                                    if guard.0.claim_status(id) { return Err(status); }
                                    continue;
                                }
                                timer(milliseconds)
                            }
                        };
                        callbacks.push((Instant::now() + delay, id, status));
                    }
                }
            },
            _ = &mut wait => {
                let now = Instant::now();
                let callback = callbacks.iter().enumerate()
                    .filter(|(_, (when, _, _))| *when <= now)
                    .min_by_key(|(_, (when, _, _))| *when).map(|(index, _)| index);
                // Keep the chronological order if both timers became ready.
                let callback = callback.filter(|&index| regular.is_none_or(|when| callbacks[index].0 <= when));
                let status = if let Some(index) = callback {
                    Some(callbacks.remove(index))
                } else {
                    regular = None;
                    None
                };
                if !guard.0.committed() && attempts < hedge.max {
                    attempts += 1;
                    begin(client, &guard.0, &metadata, &path, &codec, attempts - 1, deadline, &mut jobs, &mut active);
                    regular = (attempts < hedge.max).then(|| Instant::now() + hedge.delay);
                }
                if active.is_empty() {
                    if let Some((_, id, status)) = status {
                        if guard.0.claim_status(id) { return Err(status); }
                    }
                }
            }
        }
    }
}
