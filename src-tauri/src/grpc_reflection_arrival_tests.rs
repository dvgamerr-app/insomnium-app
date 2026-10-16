//! Owned HTTP/2 regression peers for the legacy partial-descriptor fallback.
//! Fully transitive canonical replies are covered by the retained scenarios.
use super::*;
use http_body_util::{BodyExt, StreamBody};
use hyper::{
    body::{Bytes, Frame, Incoming},
    Request as HttpRequest, Response as HttpResponse,
};
use hyper_util::rt::{TokioExecutor, TokioIo};
use prost::Message;
use std::{
    collections::HashMap,
    convert::Infallible,
    sync::{Arc, Mutex},
};
use tonic_reflection::pb::v1::{
    server_reflection_request::MessageRequest, server_reflection_response::MessageResponse,
    FileDescriptorResponse, ListServiceResponse, ServerReflectionRequest, ServerReflectionResponse,
    ServiceResponse,
};

type Sender = mpsc::Sender<Result<Frame<Bytes>, Infallible>>;
#[derive(Clone, Copy)]
enum Fault {
    None,
    ForeignRequest,
    MissingRequest,
    DuplicateReply,
    WrongAnswer,
}
#[derive(Clone)]
struct Peer {
    files: Arc<HashMap<String, Vec<u8>>>,
    trace: Arc<Mutex<Vec<String>>>,
    reverse_batch: bool,
    warm_right: bool,
    seed_done: Arc<tokio::sync::Notify>,
    fault: Fault,
    graph: Option<bool>,
    graph_release: Arc<tokio::sync::Notify>,
}
fn fixture() -> serde_json::Value {
    serde_json::from_str(include_str!(
        "../../tests/ui/fixtures/grpc-reflection-arrival-reference.json"
    ))
    .unwrap()
}
async fn reply(sender: &Sender, query: ServerReflectionRequest, message: MessageResponse) -> bool {
    raw_reply(sender, Some(query), message).await
}
async fn raw_reply(
    sender: &Sender,
    query: Option<ServerReflectionRequest>,
    message: MessageResponse,
) -> bool {
    let response = ServerReflectionResponse {
        valid_host: String::new(),
        original_request: query,
        message_response: Some(message),
    };
    let payload = response.encode_to_vec();
    let mut wire = Vec::with_capacity(payload.len() + 5);
    wire.push(0);
    wire.extend_from_slice(&(payload.len() as u32).to_be_bytes());
    wire.extend_from_slice(&payload);
    sender
        .send(Ok(Frame::data(Bytes::from(wire))))
        .await
        .is_ok()
}
async fn descriptors(
    peer: &Peer,
    sender: &Sender,
    query: ServerReflectionRequest,
    names: &[&str],
) -> bool {
    let files = names
        .iter()
        .map(|name| peer.files.get(*name).unwrap().clone())
        .collect();
    reply(
        sender,
        query,
        MessageResponse::FileDescriptorResponse(FileDescriptorResponse {
            file_descriptor_proto: files,
        }),
    )
    .await
}
async fn handle(
    peer: Peer,
    request: HttpRequest<Incoming>,
) -> Result<HttpResponse<StreamBody<ReceiverStream<Result<Frame<Bytes>, Infallible>>>>, Infallible>
{
    let (sender, receiver) = mpsc::channel(16);
    tokio::spawn(async move {
        let mut body = request.into_body();
        let mut buffered = Vec::new();
        let mut held_left = None;
        let mut seed = false;
        while let Some(frame) = body.frame().await {
            let Ok(frame) = frame else {
                break;
            };
            let Ok(bytes) = frame.into_data() else {
                continue;
            };
            buffered.extend_from_slice(&bytes);
            while buffered.len() >= 5 {
                assert_eq!(buffered[0], 0);
                let size = u32::from_be_bytes(buffered[1..5].try_into().unwrap()) as usize;
                assert!(size < MAX_SCHEMA);
                if buffered.len() < size + 5 {
                    break;
                }
                let query = ServerReflectionRequest::decode(&buffered[5..size + 5]).unwrap();
                buffered.drain(..size + 5);
                let alive = match query.message_request.clone().unwrap() {
                    MessageRequest::ListServices(_) => {
                        peer.trace.lock().unwrap().push("list".into());
                        let mut names = vec![if peer.graph.is_some() {
                            "ownedgraph.main.Entry"
                        } else {
                            "ownedarrival.root.Entry"
                        }];
                        if peer.warm_right {
                            names.insert(0, "ownedarrival.right.Seed");
                        }
                        reply(
                            &sender,
                            query,
                            MessageResponse::ListServicesResponse(ListServiceResponse {
                                service: names
                                    .into_iter()
                                    .map(|name| ServiceResponse { name: name.into() })
                                    .collect(),
                            }),
                        )
                        .await
                    }
                    MessageRequest::FileContainingSymbol(name) => {
                        peer.trace.lock().unwrap().push(name.clone());
                        if peer.graph.is_some() {
                            assert_eq!(name, "ownedgraph.main.Entry");
                            descriptors(&peer, &sender, query, &["main.proto", "any.proto"]).await
                        } else if name == "ownedarrival.right.Seed" {
                            seed = true;
                            descriptors(&peer, &sender, query, &["right.proto", "any.proto"]).await
                        } else {
                            assert_eq!(name, "ownedarrival.root.Entry");
                            if peer.warm_right {
                                peer.seed_done.notified().await;
                            }
                            descriptors(&peer, &sender, query, &["main.proto", "any.proto"]).await
                        }
                    }
                    MessageRequest::FileByFilename(name) => {
                        peer.trace.lock().unwrap().push(name.clone());
                        if let Some(deep_first) = peer.graph {
                            if (deep_first && name == "d.proto")
                                || (!deep_first && name == "c.proto")
                            {
                                peer.graph_release.notified().await;
                                // Provider-controlled timing after the other branch's
                                // reply; exact client order is asserted below.
                                tokio::time::sleep(Duration::from_millis(40)).await;
                            }
                            let alive = descriptors(&peer, &sender, query, &[&name]).await;
                            if (deep_first && name == "e.proto")
                                || (!deep_first && name == "d.proto")
                            {
                                peer.graph_release.notify_one();
                            }
                            if !alive {
                                return;
                            }
                            continue;
                        }
                        if name == "left.proto" {
                            match peer.fault {
                                Fault::ForeignRequest => {
                                    let mut foreign = query.clone();
                                    foreign.message_request = Some(MessageRequest::FileByFilename(
                                        "unrequested.proto".into(),
                                    ));
                                    descriptors(&peer, &sender, foreign, &["left.proto"]).await;
                                    return;
                                }
                                Fault::MissingRequest => {
                                    raw_reply(
                                        &sender,
                                        None,
                                        MessageResponse::FileDescriptorResponse(
                                            FileDescriptorResponse {
                                                file_descriptor_proto: vec![peer.files
                                                    ["left.proto"]
                                                    .clone()],
                                            },
                                        ),
                                    )
                                    .await;
                                    return;
                                }
                                Fault::WrongAnswer => {
                                    reply(
                                        &sender,
                                        query,
                                        MessageResponse::ListServicesResponse(
                                            ListServiceResponse { service: vec![] },
                                        ),
                                    )
                                    .await;
                                    return;
                                }
                                Fault::DuplicateReply => {
                                    descriptors(&peer, &sender, query.clone(), &["left.proto"])
                                        .await;
                                    descriptors(&peer, &sender, query, &["left.proto"]).await;
                                    return;
                                }
                                Fault::None => {}
                            }
                        }
                        if name == "left.proto" && peer.reverse_batch {
                            // Reply only after the sibling was requested; never send an
                            // unsolicited response for a request the client has not sent.
                            held_left = Some(query);
                            true
                        } else if name == "right.proto" && peer.reverse_batch {
                            if !descriptors(&peer, &sender, query, &["right.proto"]).await {
                                return;
                            }
                            let left = held_left
                                .take()
                                .expect("Left dependency request precedes right");
                            descriptors(&peer, &sender, left, &["left.proto"]).await
                        } else {
                            descriptors(&peer, &sender, query, &[&name]).await
                        }
                    }
                    _ => panic!("Unexpected owned reflection request"),
                };
                if !alive {
                    return;
                }
            }
        }
        if seed {
            peer.seed_done.notify_one();
        }
        let mut trailers = hyper::HeaderMap::new();
        trailers.insert("grpc-status", "0".parse().unwrap());
        let _ = sender.send(Ok(Frame::trailers(trailers))).await;
    });
    Ok(HttpResponse::builder()
        .status(200)
        .header("content-type", "application/grpc")
        .body(StreamBody::new(ReceiverStream::new(receiver)))
        .unwrap())
}

async fn discover(
    reverse_batch: bool,
    warm_right: bool,
    fault: Fault,
) -> (Result<ReflectionDiscovery, String>, Vec<String>) {
    let reference = fixture();
    discover_reference(reference, reverse_batch, warm_right, fault, None).await
}

async fn discover_reference(
    reference: serde_json::Value,
    reverse_batch: bool,
    warm_right: bool,
    fault: Fault,
    graph: Option<bool>,
) -> (Result<ReflectionDiscovery, String>, Vec<String>) {
    let files = reference["files"]
        .as_array()
        .unwrap()
        .iter()
        .map(|file| {
            (
                file["name"].as_str().unwrap().to_string(),
                STANDARD.decode(file["bytes"].as_str().unwrap()).unwrap(),
            )
        })
        .collect();
    let trace = Arc::new(Mutex::new(Vec::new()));
    let peer = Peer {
        files: Arc::new(files),
        trace: trace.clone(),
        reverse_batch,
        warm_right,
        seed_done: Arc::new(tokio::sync::Notify::new()),
        fault,
        graph,
        graph_release: Arc::new(tokio::sync::Notify::new()),
    };
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let mut connections = tokio::task::JoinSet::new();
        loop {
            tokio::select! {
                accepted = listener.accept() => {
                    let (socket, _) = accepted.unwrap(); let peer = peer.clone();
                    connections.spawn(async move {
                        let service = hyper::service::service_fn(move |request| handle(peer.clone(), request));
                        let _ = hyper::server::conn::http2::Builder::new(TokioExecutor::new()).serve_connection(TokioIo::new(socket), service).await;
                    });
                }
                _ = connections.join_next(), if !connections.is_empty() => {}
            }
        }
    });
    let config: Connection = serde_json::from_value(
        serde_json::json!({"url":format!("grpc://{address}"),"timeoutMs":3000}),
    )
    .unwrap();
    let result = tokio::time::timeout(Duration::from_secs(2), reflect(&config)).await;
    // Abort/join only the owned in-process unit peer; this is not native
    // application lifecycle or physical TCP retirement acceptance.
    server.abort();
    let _ = server.await;
    tokio::task::yield_now().await;
    let observed = trace.lock().unwrap().clone();
    let discovery = result.unwrap_or_else(|error| {
        panic!("Dependency batch did not complete: {error}; peer trace={observed:?}")
    });
    (discovery, observed)
}

async fn check(label: &str, reverse_batch: bool, warm_right: bool) {
    let reference = fixture();
    let (result, observed) = discover(reverse_batch, warm_right, Fault::None).await;
    let discovery = result
        .unwrap_or_else(|error| panic!("Reflection failed: {error}; peer trace={observed:?}"));
    let scope = discovery
        .services
        .iter()
        .find(|scope| scope.name == "ownedarrival.root.Entry")
        .unwrap();
    let row = reference["rows"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["label"] == label)
        .unwrap();
    assert_eq!(
        scope.files,
        row["fileOrder"]
            .as_array()
            .unwrap()
            .iter()
            .map(|name| name.as_str().unwrap().to_string())
            .collect::<Vec<_>>(),
        "Actual native discovery file order; trace={observed:?}"
    );
    let method = grpc_schema::reflection_method(
        &discovery.pool,
        "/ownedarrival.root.Entry/Call",
        Some(&scope.files),
    )
    .unwrap();
    let parsed = grpc_schema::parse_mode(
        method.input(),
        row["body"].as_str().unwrap(),
        grpc_schema::JsonMode::Legacy.from_schema(true),
    )
    .unwrap();
    let hex: String = parsed
        .encode_to_vec()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    assert_eq!(hex, row["wireHex"].as_str().unwrap());
}

#[tokio::test]
async fn reflection_arrival_sequential_control() {
    check("left-right:left-first:cache-none", false, false).await;
}
#[tokio::test]
async fn reflection_arrival_batch_response_order() {
    check("left-right:right-first:cache-none", true, false).await;
}
#[tokio::test]
async fn reflection_arrival_shared_cache_precedes_new_files() {
    check("left-right:left-first:cache-right", false, true).await;
}

#[tokio::test]
async fn reflection_arrival_rejects_foreign_duplicate_missing_and_wrong_replies() {
    for (fault, expected) in [
        (Fault::ForeignRequest, "does not match a pending request"),
        (Fault::DuplicateReply, "does not match a pending request"),
        (Fault::MissingRequest, "omitted its request"),
        (Fault::WrongAnswer, "Invalid reflection descriptor response"),
    ] {
        let (result, trace) = discover(false, false, fault).await;
        let error = result
            .err()
            .expect("Malformed peer reply must refuse discovery");
        assert!(
            error.contains(expected),
            "Expected {expected}; got {error}; trace={trace:?}"
        );
    }
}

#[tokio::test]
async fn reflection_arrival_cold_transitive_branches_match_pinned_client() {
    let reference: serde_json::Value = serde_json::from_str(include_str!(
        "../../tests/ui/fixtures/grpc-reflection-graph-reference.json"
    ))
    .unwrap();
    for deep_first in [true, false] {
        let label = if deep_first {
            "cold-deep-first"
        } else {
            "cold-shallow-first"
        };
        let row = reference["rows"]
            .as_array()
            .unwrap()
            .iter()
            .find(|row| row["label"] == label)
            .unwrap();
        let (result, trace) = discover_reference(
            reference.clone(),
            false,
            false,
            Fault::None,
            Some(deep_first),
        )
        .await;
        let discovery = result.unwrap_or_else(|error| panic!("{error}; trace={trace:?}"));
        let scope = &discovery.services[0];
        let expected: Vec<String> = row["fileOrder"]
            .as_array()
            .unwrap()
            .iter()
            .map(|name| name.as_str().unwrap().into())
            .collect();
        assert_eq!(scope.files, expected, "{label}; trace={trace:?}");
        let method = grpc_schema::reflection_method(
            &discovery.pool,
            "/ownedgraph.main.Entry/Call",
            Some(&scope.files),
        )
        .unwrap();
        let parsed = grpc_schema::parse_mode(
            method.input(),
            row["body"].as_str().unwrap(),
            grpc_schema::JsonMode::Legacy.from_schema(true),
        )
        .unwrap();
        let hex: String = parsed
            .encode_to_vec()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        assert_eq!(hex, row["wireHex"].as_str().unwrap(), "{label}");
    }
}
