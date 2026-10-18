//! Reflection roots use the archived client's cached-first dependency batches.
//! Packet validation and budgets remain shared across every advertised service.
use super::admission as mpsc;
use super::lb_transport::Channel as NativeChannel;
use super::{call_setup, metadata, retry, Connection, ReflectionDiscovery, MAX_SCHEMA};
use crate::grpc_schema::ReflectionService;
use futures_util::{stream::FuturesUnordered, StreamExt};
use prost::Message;
use prost_reflect::DescriptorPool;
#[cfg(test)]
use std::time::Duration;
use std::{
    collections::{HashMap, HashSet, VecDeque},
    sync::{Arc, Mutex},
};
#[cfg(test)]
use tonic::transport::Channel;
use tonic::{Status, Streaming};
use tonic_reflection::pb::v1::{
    server_reflection_request::MessageRequest as Query,
    server_reflection_response::MessageResponse as Answer, ServerReflectionRequest,
    ServerReflectionResponse,
};

#[derive(Default)]
struct Cache {
    files: HashMap<String, Arc<prost_types::FileDescriptorProto>>,
    order: Vec<String>,
    bytes: usize,
    queries: usize,
}
#[derive(Default)]
struct Session(Mutex<Cache>);
struct Plan {
    cached: Vec<String>,
    missing: Vec<String>,
}
impl Session {
    fn query(&self) -> Result<(), Status> {
        let mut cache = self
            .0
            .lock()
            .map_err(|_| Status::internal("Reflection cache unavailable."))?;
        cache.queries = cache.queries.saturating_add(1);
        if cache.queries > 4096 {
            return Err(Status::resource_exhausted(
                "Too many reflection dependencies.",
            ));
        }
        Ok(())
    }
    fn remember(&self, packets: Vec<Vec<u8>>) -> Result<Vec<String>, Status> {
        let mut cache = self
            .0
            .lock()
            .map_err(|_| Status::internal("Reflection cache unavailable."))?;
        let mut names = Vec::new();
        for bytes in packets {
            cache.bytes = cache.bytes.saturating_add(bytes.len());
            if cache.bytes > MAX_SCHEMA {
                return Err(Status::resource_exhausted(
                    "Reflection descriptors exceed 8 MiB.",
                ));
            }
            let file = prost_types::FileDescriptorProto::decode(bytes.as_slice())
                .map_err(|_| Status::internal("Malformed reflected descriptor."))?;
            let name = file
                .name
                .clone()
                .ok_or_else(|| Status::internal("Reflected descriptor has no name."))?;
            if let Some(previous) = cache.files.get(&name) {
                if previous.as_ref() != &file {
                    return Err(Status::internal("Conflicting reflected descriptors."));
                }
            } else {
                cache.order.push(name.clone());
                cache.files.insert(name.clone(), Arc::new(file));
                if cache.files.len() > 1024 {
                    return Err(Status::resource_exhausted("Reflection exceeds 1024 files."));
                }
            }
            names.push(name);
        }
        Ok(names)
    }
    fn plan(&self, dependencies: Vec<String>) -> Result<Plan, Status> {
        let cache = self
            .0
            .lock()
            .map_err(|_| Status::internal("Reflection cache unavailable."))?;
        let mut result = Plan {
            cached: Vec::new(),
            missing: Vec::new(),
        };
        let mut seen = HashSet::new();
        for name in dependencies {
            if !seen.insert(name.clone()) {
                continue;
            }
            if seen.len() > 1024 {
                return Err(Status::resource_exhausted(
                    "Too many reflection dependencies.",
                ));
            }
            if cache.files.contains_key(&name) {
                result.cached.push(name);
            } else {
                result.missing.push(name);
            }
        }
        Ok(result)
    }
    fn file(&self, name: &str) -> Result<Arc<prost_types::FileDescriptorProto>, Status> {
        self.0
            .lock()
            .map_err(|_| Status::internal("Reflection cache unavailable."))?
            .files
            .get(name)
            .cloned()
            .ok_or_else(|| Status::internal("Reflected dependency is missing."))
    }
    fn pool(&self, names: Option<&[String]>) -> Result<DescriptorPool, Status> {
        let cache = self
            .0
            .lock()
            .map_err(|_| Status::internal("Reflection cache unavailable."))?;
        let names = names.unwrap_or(&cache.order);
        let mut files = Vec::new();
        for name in names {
            files.push(
                cache
                    .files
                    .get(name)
                    .ok_or_else(|| Status::internal("Reflected dependency is missing."))?
                    .as_ref()
                    .clone(),
            );
        }
        drop(cache);
        DescriptorPool::from_file_descriptor_set(prost_types::FileDescriptorSet { file: files })
            .map_err(|error| Status::internal(format!("Invalid reflected schema: {error}")))
    }
}

fn request(query: Query) -> ServerReflectionRequest {
    ServerReflectionRequest {
        host: String::new(),
        message_request: Some(query),
    }
}
fn key(query: &Query) -> Result<(u8, String), Status> {
    match query {
        Query::FileByFilename(name) => Ok((3, name.clone())),
        Query::FileContainingSymbol(name) => Ok((4, name.clone())),
        _ => Err(Status::internal("Invalid pending reflection request.")),
    }
}
struct Driver {
    sender: Option<mpsc::Sender<ServerReflectionRequest>>,
    response: Streaming<ServerReflectionResponse>,
    listed: Vec<String>,
    deadline: Option<tokio::time::Instant>,
    completion: retry::Completion<ServerReflectionRequest>,
}
struct RequestInput {
    sender: mpsc::Sender<ServerReflectionRequest>,
    guard: super::replay::Guard<ServerReflectionRequest>,
}
impl Driver {
    async fn open(
        channel: impl Into<NativeChannel>,
        config: &Connection,
        version: &str,
    ) -> Result<Self, Status> {
        let channel = channel.into();
        let service = format!("grpc.reflection.{version}.ServerReflection");
        let policy = config
            .resolution_config
            .method(&service, "ServerReflectionInfo")
            .map_err(Status::unavailable)?;
        let previous = crate::http::timeouts::selected(None, config.timeout_ms)
            .map(|timeout| tokio::time::Instant::now() + timeout);
        let budget = policy
            .deadline(previous)
            .map_err(Status::invalid_argument)?;
        let session = policy.retry().map_err(Status::invalid_argument)?;
        Self::start(
            call_setup::Prepared {
                channel,
                session,
                budget,
            },
            config,
            version,
            None,
        )
        .await
    }
    async fn start(
        prepared: call_setup::Prepared,
        config: &Connection,
        version: &str,
        input: Option<RequestInput>,
    ) -> Result<Self, Status> {
        let call_setup::Prepared {
            channel,
            session,
            budget,
        } = prepared;
        let deadline = budget.timer;
        let mut client = tonic::client::Grpc::new(session.channel(channel))
            .max_decoding_message_size(MAX_SCHEMA)
            .max_encoding_message_size(MAX_SCHEMA)
            .accept_compressed(tonic::codec::CompressionEncoding::Gzip)
            .accept_compressed(tonic::codec::CompressionEncoding::Deflate);
        let work = async {
            let RequestInput { sender, guard } = match input {
                Some(input) => input,
                None => {
                    let (sender, receiver) = mpsc::channel(1);
                    sender
                        .send(request(Query::ListServices(String::new())))
                        .await
                        .map_err(|_| Status::cancelled("Reflection closed."))?;
                    let guard = super::replay::Input::new(
                        receiver,
                        config.resolution_config.retry_budget(),
                        true,
                    );
                    guard.0.stage_pending();
                    RequestInput { sender, guard }
                }
            };
            let headers = metadata(&config.metadata).map_err(Status::invalid_argument)?;
            let path = format!("/grpc.reflection.{version}.ServerReflection/ServerReflectionInfo")
                .parse()
                .map_err(|_| Status::internal("Invalid reflection path."))?;
            let codec =
            tonic_prost::ProstCodec::<ServerReflectionRequest, ServerReflectionResponse>::default();
            let retry::Started {
                response,
                completion,
            } = retry::streaming_prepared(
                &mut client,
                guard,
                headers,
                path,
                codec,
                session,
                budget.wire,
            )
            .await?;
            let mut driver = Self {
                sender: Some(sender),
                response: response.into_inner(),
                listed: Vec::new(),
                deadline,
                completion,
            };
            let initial = driver
                .message()
                .await?
                .ok_or_else(|| Status::internal("Reflection ended before service list."))?;
            if initial
                .original_request
                .as_ref()
                .and_then(|query| query.message_request.as_ref())
                != Some(&Query::ListServices(String::new()))
            {
                return Err(Status::internal(
                    "Reflection service list does not match the request.",
                ));
            }
            let listed = match initial.message_response {
                Some(Answer::ListServicesResponse(list)) => list
                    .service
                    .into_iter()
                    .map(|service| service.name)
                    .collect::<Vec<_>>(),
                Some(Answer::ErrorResponse(error)) => {
                    return Err(Status::new(
                        tonic::Code::from_i32(error.error_code),
                        error.error_message,
                    ))
                }
                _ => {
                    return Err(Status::internal(
                        "Invalid reflection service-list response.",
                    ))
                }
            };
            if listed.len() > 1024 {
                return Err(Status::resource_exhausted(
                    "Reflection exceeds 1024 services.",
                ));
            }
            driver.listed = listed;
            Ok(driver)
        };
        match deadline {
            Some(deadline) => tokio::time::timeout_at(deadline, work)
                .await
                .map_err(|_| Status::deadline_exceeded("Reflection deadline exceeded."))?,
            None => work.await,
        }
    }
    async fn message(&mut self) -> Result<Option<ServerReflectionResponse>, Status> {
        let result = self.response.message().await;
        match &result {
            Ok(None) => self.completion.succeeded(),
            Err(_) => self.completion.failed(),
            _ => {}
        }
        result
    }
    async fn batch(
        &mut self,
        queries: Vec<Query>,
        session: &Session,
        drain: bool,
    ) -> Result<Vec<String>, Status> {
        let deadline = self.deadline;
        let work = self.batch_inner(queries, session, drain);
        match deadline {
            Some(deadline) => tokio::time::timeout_at(deadline, work)
                .await
                .map_err(|_| Status::deadline_exceeded("Reflection deadline exceeded."))?,
            None => work.await,
        }
    }
    async fn batch_inner(
        &mut self,
        queries: Vec<Query>,
        session: &Session,
        drain: bool,
    ) -> Result<Vec<String>, Status> {
        let mut unique = HashSet::new();
        for query in &queries {
            if !unique.insert(key(query)?) {
                return Err(Status::internal("Duplicate pending reflection request."));
            }
        }
        let mut pending: VecDeque<_> = queries.into();
        let mut outstanding = HashSet::new();
        let mut names = Vec::new();
        while !pending.is_empty() || !outstanding.is_empty() {
            let sender = self.sender.as_ref().cloned();
            tokio::select! {
                biased;
                permit = async move { sender.expect("Sender exists while requests are pending").reserve_owned().await }, if !pending.is_empty() => {
                    let permit = permit.map_err(|_| Status::cancelled("Reflection closed."))?;
                    let query = pending.pop_front().unwrap();
                    session.query()?;
                    outstanding.insert(key(&query)?);
                    permit.send(request(query));
                }
                reply = self.message() => {
                    let reply = reply?.ok_or_else(|| Status::internal("Reflection ended before descriptors."))?;
                    let original = reply.original_request.as_ref().and_then(|query| query.message_request.as_ref()).ok_or_else(|| Status::internal("Reflection response omitted its request."))?;
                    if !outstanding.remove(&key(original)?) { return Err(Status::internal("Reflection response does not match a pending request.")); }
                    match reply.message_response {
                        Some(Answer::FileDescriptorResponse(files)) => names.extend(session.remember(files.file_descriptor_proto)?),
                        Some(Answer::ErrorResponse(error)) => return Err(Status::new(tonic::Code::from_i32(error.error_code), error.error_message)),
                        _ => return Err(Status::internal("Invalid reflection descriptor response.")),
                    }
                }
            }
            if drain && pending.is_empty() {
                self.sender.take();
            }
        }
        if drain {
            self.sender.take();
            if self.message().await?.is_some() {
                return Err(Status::internal(
                    "Unexpected additional reflection response.",
                ));
            }
        }
        Ok(names)
    }
}

#[derive(Default)]
struct Root {
    names: Vec<String>,
    seen: HashSet<String>,
}
async fn resolve_files(
    seeds: Vec<String>,
    session: Arc<Session>,
    channel: impl Into<NativeChannel>,
    config: &Connection,
    version: &str,
) -> Result<Vec<String>, Status> {
    let channel = channel.into();
    let mut root = Root::default();
    let mut ready = VecDeque::from([seeds]);
    let mut jobs = FuturesUnordered::new();
    loop {
        while let Some(names) = ready.pop_front() {
            // A completed batch claims all its parents before any child batch.
            let mut parents = Vec::new();
            for name in names {
                if root.seen.insert(name.clone()) {
                    root.names.push(name.clone());
                    parents.push(session.file(&name)?);
                }
            }
            let mut plans = Vec::new();
            for file in parents {
                let dependencies = file
                    .dependency
                    .iter()
                    .filter(|name| !root.seen.contains(*name))
                    .cloned()
                    .collect();
                let plan = session.plan(dependencies)?;
                if !plan.cached.is_empty() || !plan.missing.is_empty() {
                    plans.push(plan);
                }
            }
            for plan in plans {
                if plan.missing.is_empty() {
                    // Resolved cached promises enqueue continuations FIFO. A
                    // scheduler yield inside FuturesUnordered can reverse them.
                    ready.push_back(plan.cached);
                    continue;
                }
                let session = session.clone();
                let channel = channel.clone();
                jobs.push(async move {
                    let mut names = plan.cached;
                    {
                        let mut driver = Driver::open(channel, config, version).await?;
                        names.extend(
                            driver
                                .batch(
                                    plan.missing
                                        .into_iter()
                                        .map(Query::FileByFilename)
                                        .collect(),
                                    &session,
                                    true,
                                )
                                .await?,
                        );
                    }
                    Ok::<_, Status>(names)
                });
            }
        }
        match jobs.next().await {
            Some(result) => ready.push_back(result?),
            None => return Ok(root.names),
        }
    }
}

async fn version(
    channel: impl Into<NativeChannel>,
    config: &Connection,
    version: &str,
    initial: Option<Driver>,
) -> Result<ReflectionDiscovery, Status> {
    let channel = channel.into();
    let initial = match initial {
        Some(initial) => initial,
        None => Driver::open(channel.clone(), config, version).await?,
    };
    let listed = initial.listed.clone();
    let mut unique = HashSet::new();
    for name in &listed {
        if !unique.insert(name) {
            return Err(Status::internal("Duplicate reflected service scope."));
        }
    }
    let session = Arc::new(Session::default());
    let mut first = Some(initial);
    let mut jobs = FuturesUnordered::new();
    for (index, name) in listed.iter().cloned().enumerate() {
        let initial = if index == 0 { first.take() } else { None };
        let session = session.clone();
        let channel = channel.clone();
        jobs.push(async move {
            let mut driver = match initial {
                Some(driver) => driver,
                None => Driver::open(channel.clone(), config, version).await?,
            };
            if !driver.listed.contains(&name) {
                return Err(Status::internal(
                    "Reflection service list changed during discovery.",
                ));
            }
            let seeds = driver
                .batch(
                    vec![Query::FileContainingSymbol(name.clone())],
                    &session,
                    false,
                )
                .await?;
            drop(driver);
            let files = resolve_files(seeds, session.clone(), channel, config, version).await?;
            let pool = session.pool(Some(&files))?;
            if pool.get_service_by_name(&name).is_none() {
                return Err(Status::internal(
                    "Reflection omitted a listed service descriptor.",
                ));
            }
            Ok::<_, Status>((index, ReflectionService { name, files }))
        });
    }
    drop(first);
    let mut completed = Vec::new();
    while let Some(result) = jobs.next().await {
        completed.push(result?);
    }
    completed.sort_by_key(|(index, _)| *index);
    Ok(ReflectionDiscovery {
        pool: session.pool(None)?,
        services: completed.into_iter().map(|(_, service)| service).collect(),
    })
}
pub(super) async fn reflect(config: &Connection) -> Result<ReflectionDiscovery, String> {
    let previous = crate::http::timeouts::selected(None, config.timeout_ms)
        .map(|timeout| tokio::time::Instant::now() + timeout);
    let (sender, receiver) = mpsc::channel(1);
    sender
        .send(request(Query::ListServices(String::new())))
        .await
        .map_err(|_| "Reflection closed.")?;
    let mut receiver = Some(receiver);
    let mut guard = None;
    let prepared = call_setup::connect_with(
        config,
        "grpc.reflection.v1.ServerReflection",
        "ServerReflectionInfo",
        previous,
        || {
            let input = super::replay::Input::new(
                receiver.take().expect("Reflection config selected once"),
                config.resolution_config.retry_budget(),
                true,
            );
            input.0.stage_pending();
            guard = Some(input);
        },
    )
    .await
    .map_err(|error| error.to_string())?;
    let channel = prepared.channel.clone();
    let first_channel = channel.clone();
    let first = async move {
        let input = RequestInput {
            sender,
            guard: guard.expect("Connected reflection has selected config"),
        };
        let initial = Driver::start(prepared, config, "v1", Some(input)).await?;
        version(first_channel, config, "v1", Some(initial)).await
    }
    .await;
    match first {
        Err(error) if error.code() == tonic::Code::Unimplemented => {
            version(channel, config, "v1alpha", None)
                .await
                .map_err(|error| error.to_string())
        }
        result => result.map_err(|error| error.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn reflection_arrival_cached_transitive_order_matches_pinned_client() {
        use base64::Engine;
        let reference: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/ui/fixtures/grpc-reflection-graph-reference.json"
        ))
        .unwrap();
        let session = Arc::new(Session::default());
        session
            .remember(
                reference["files"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|file| {
                        base64::engine::general_purpose::STANDARD
                            .decode(file["bytes"].as_str().unwrap())
                            .unwrap()
                    })
                    .collect(),
            )
            .unwrap();
        let config: Connection = serde_json::from_value(serde_json::json!({
            "url": "grpc://127.0.0.1:1", "timeoutMs": 1000
        }))
        .unwrap();
        // The network parent batch has already completed; all transitive children
        // were warmed by a separate service, as in the pinned Client trace.
        let seeds = ["main.proto", "any.proto", "a.proto", "b.proto"]
            .into_iter()
            .map(String::from)
            .collect();
        let names = resolve_files(
            seeds,
            session.clone(),
            Channel::from_static("http://127.0.0.1:1").connect_lazy(),
            &config,
            "v1",
        )
        .await
        .unwrap();
        let row = &reference["rows"][0];
        let expected: Vec<String> = row["fileOrder"]
            .as_array()
            .unwrap()
            .iter()
            .map(|name| name.as_str().unwrap().into())
            .collect();
        assert_eq!(names, expected);
        let pool = session.pool(Some(&names)).unwrap();
        let method = crate::grpc_schema::reflection_method(
            &pool,
            "/ownedgraph.main.Entry/Call",
            Some(&names),
        )
        .unwrap();
        let parsed = crate::grpc_schema::parse_mode(
            method.input(),
            row["body"].as_str().unwrap(),
            crate::grpc_schema::JsonMode::Legacy.from_schema(true),
        )
        .unwrap();
        let hex: String = parsed
            .encode_to_vec()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        assert_eq!(hex, row["wireHex"].as_str().unwrap());
        assert_eq!(session.0.lock().unwrap().queries, 0);
    }

    #[tokio::test]
    async fn reflection_arrival_deep_cached_chain_avoids_network_and_stack_recursion() {
        let session = Arc::new(Session::default());
        let expected: Vec<String> = (0..1000).map(|i| format!("chain-{i}.proto")).collect();
        let packets = expected
            .iter()
            .enumerate()
            .map(|(i, name)| {
                prost_types::FileDescriptorProto {
                    name: Some(name.clone()),
                    dependency: expected.get(i + 1).cloned().into_iter().collect(),
                    syntax: Some("proto3".into()),
                    ..Default::default()
                }
                .encode_to_vec()
            })
            .collect();
        session.remember(packets).unwrap();
        let config: Connection = serde_json::from_value(serde_json::json!({
            "url": "grpc://127.0.0.1:1", "timeoutMs": 1000
        }))
        .unwrap();
        let channel = Channel::from_static("http://127.0.0.1:1").connect_lazy();
        let actual = tokio::time::timeout(
            Duration::from_secs(2),
            resolve_files(
                vec![expected[0].clone()],
                session.clone(),
                channel,
                &config,
                "v1",
            ),
        )
        .await
        .unwrap()
        .unwrap();
        assert_eq!(actual, expected);
        assert_eq!(session.0.lock().unwrap().queries, 0);
    }

    #[test]
    fn reflection_arrival_query_budget_is_shared_across_service_handles() {
        let first = Arc::new(Session::default());
        let second = first.clone();
        for _ in 0..2000 {
            first.query().unwrap();
        }
        for _ in 2000..4096 {
            second.query().unwrap();
        }
        assert_eq!(
            first.query().unwrap_err().code(),
            tonic::Code::ResourceExhausted
        );
    }
}
