use crate::{
    grpc_schema::{self, JsonMode, ProtoInput, Schema},
    grpc_transport::{self, Connection, Event},
    http::{NativeWorkLease, NetworkState},
};
use prost_reflect::{DynamicMessage, MessageDescriptor, MethodDescriptor};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Duration,
};
use tauri::ipc::Channel;
use tokio::sync::{mpsc, Mutex as AsyncMutex};

#[derive(Default)]
pub struct GrpcState {
    calls: Arc<Mutex<HashMap<String, Arc<AsyncMutex<Outgoing>>>>>,
    acknowledgements: Arc<Mutex<HashMap<String, mpsc::Sender<Acknowledgement>>>>,
}
struct Outgoing {
    input: MessageDescriptor,
    original_input: MessageDescriptor,
    mode: JsonMode,
    sender: Option<grpc_transport::admission::Sender<DynamicMessage>>,
    cancellation: tokio::sync::watch::Receiver<bool>,
}

struct CallRegistration {
    id: String,
    calls: Arc<Mutex<HashMap<String, Arc<AsyncMutex<Outgoing>>>>>,
    acknowledgements: Arc<Mutex<HashMap<String, mpsc::Sender<Acknowledgement>>>>,
    outgoing: Arc<AsyncMutex<Outgoing>>,
    acknowledgement_sender: mpsc::Sender<Acknowledgement>,
    _work: Arc<NativeWorkLease>,
}
impl Drop for CallRegistration {
    fn drop(&mut self) {
        let mut calls = self.calls.lock().unwrap_or_else(|error| error.into_inner());
        if calls
            .get(&self.id)
            .is_some_and(|call| Arc::ptr_eq(call, &self.outgoing))
        {
            calls.remove(&self.id);
        }
        drop(calls);
        let mut acknowledgements = self
            .acknowledgements
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if acknowledgements
            .get(&self.id)
            .is_some_and(|sender| sender.same_channel(&self.acknowledgement_sender))
        {
            acknowledgements.remove(&self.id);
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaRequest {
    id: String,
    proto: Option<ProtoInput>,
    connection: Option<Connection>,
    #[serde(default)]
    json_mode: JsonMode,
}

#[tauri::command]
pub async fn load_grpc_schema(
    request: SchemaRequest,
    on_started: Channel<()>,
    network: tauri::State<'_, NetworkState>,
) -> Result<Schema, String> {
    let lease = Arc::new(network.retain_native_work(request.id.clone())?);
    let mut cancelled = lease.cancellation();
    let mut compilation = None;
    let work = async {
        on_started
            .send(())
            .map_err(|_| "gRPC schema view closed.")?;
        let mode = request.json_mode;
        let worker_lease = lease.clone();
        let preparation = match request.proto {
            Some(input) => tokio::task::spawn_blocking(move || {
                let work = worker_lease;
                if work.cancelled() {
                    return Err("gRPC schema lookup cancelled.".into());
                }
                let pool = grpc_schema::compile_mode(input, mode)?;
                grpc_schema::describe(&pool, mode)
            }),
            None => {
                let discovery = grpc_transport::reflect(
                    request
                        .connection
                        .as_ref()
                        .ok_or("Provide proto files or a reflection endpoint.")?,
                )
                .await?;
                tokio::task::spawn_blocking(move || {
                    let work = worker_lease;
                    if work.cancelled() {
                        return Err("gRPC schema lookup cancelled.".into());
                    }
                    grpc_schema::describe_reflection_services(
                        &discovery.pool,
                        &discovery.services,
                        mode,
                    )
                })
            }
        };
        let task = compilation.insert(preparation);
        let result = task.await;
        compilation.take();
        result.map_err(|_| "Proto compiler stopped unexpectedly.")?
    };
    let timeout = request
        .connection
        .as_ref()
        .map(|c| c.timeout_ms)
        .unwrap_or(30_000);
    let result = tokio::select! {
        result = crate::http::timeouts::run(
            crate::http::timeouts::selected(None, timeout),
            work,
            "gRPC schema lookup timed out.",
        ) => result,
        _ = cancelled.changed() => Err("gRPC schema lookup cancelled.".into()),
    };
    if let Some(task) = compilation {
        // Dropping a blocking task's handle detaches it. Cancel queued work,
        // then drain any compiler/schema preparation already running before
        // releasing ownership.
        task.abort();
        let _ = task.await;
    }
    if let Some(connection) = request.connection.as_ref() {
        connection.drain_dns().await;
    }
    network.finish(&request.id)?;
    result
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrpcRequest {
    id: String,
    connection: Connection,
    descriptor_set: String,
    method: String,
    body: String,
    #[serde(default)]
    json_mode: JsonMode,
    #[serde(default)]
    reflection: bool,
    #[serde(default)]
    reflection_files: Option<Vec<String>>,
}
#[derive(Serialize)]
pub struct Packet {
    event: Event,
    sequence: u64,
}
// Receipt time is native-only; the renderer still acknowledges with id/sequence.
struct Acknowledgement {
    sequence: u64,
    received: tokio::time::Instant,
}
impl Acknowledgement {
    fn new(sequence: u64) -> Self {
        Self {
            sequence,
            received: tokio::time::Instant::now(),
        }
    }
}
struct Delivery {
    channel: Channel<Packet>,
    acknowledgements: mpsc::Receiver<Acknowledgement>,
    sequence: u64,
    terminal_sent: bool,
    acknowledged_sequence: u64,
    acknowledgement_deadline: Option<tokio::time::Instant>,
    pending_terminal: Option<Event>,
}
impl Delivery {
    async fn send(&mut self, event: Event) -> Result<(), String> {
        let terminal = matches!(&event, Event::Status { .. });
        if let Event::FinalMessage { status, .. } | Event::FinalError { status, .. } = &event {
            self.pending_terminal = Some((**status).clone());
        } else if terminal {
            self.pending_terminal = None;
        }
        self.sequence += 1;
        let sequence = self.sequence;
        self.channel
            .send(Packet { event, sequence })
            .map_err(|_| "gRPC view closed.")?;
        self.terminal_sent |= terminal;
        self.acknowledgement_deadline = Some(tokio::time::Instant::now() + Duration::from_secs(30));
        self.wait_for_ack(sequence).await
    }
    async fn wait_for_ack(&mut self, sequence: u64) -> Result<(), String> {
        if self.acknowledged_sequence >= sequence {
            return Ok(());
        }
        // Resuming the same packet after deadline/cancel must not renew its
        // renderer budget. Only send() creates a new packet deadline.
        let deadline = self
            .acknowledgement_deadline
            .ok_or("gRPC acknowledgement state unavailable.")?;
        tokio::time::timeout_at(deadline, async {
            while let Some(ack) = self.acknowledgements.recv().await {
                if ack.sequence == sequence {
                    // timeout_at polls a ready receiver before its timer. Use
                    // receipt time so buffered late ACKs cannot bypass expiry,
                    // while on-time ACKs remain valid after delayed polling.
                    if ack.received >= deadline {
                        return Err("gRPC view stopped acknowledging messages.".to_string());
                    }
                    self.acknowledged_sequence = sequence;
                    self.acknowledgement_deadline = None;
                    return Ok(());
                }
            }
            Err("gRPC view closed.".to_string())
        })
        .await
        .map_err(|_| "gRPC view stopped acknowledging messages.")?
    }
}

type PreparedCall = (
    GrpcRequest,
    MethodDescriptor,
    MessageDescriptor,
    MessageDescriptor,
    Option<DynamicMessage>,
);

fn prepare_call(request: GrpcRequest, work: Arc<NativeWorkLease>) -> Result<PreparedCall, String> {
    if work.cancelled() {
        return Err("gRPC call cancelled.".to_string());
    }
    let pool = grpc_schema::decode(&request.descriptor_set)?;
    let method = grpc_schema::reflection_method(
        &pool,
        &request.method,
        if request.reflection {
            request.reflection_files.as_deref()
        } else {
            None
        },
    )?;
    let original_input = method.input();
    if matches!(request.json_mode, grpc_schema::JsonMode::LegacyReflection) {
        crate::grpc_legacy_lookup::validate_reflection_members(original_input.parent_pool())?;
    }
    let input = match request.json_mode {
        grpc_schema::JsonMode::Legacy | grpc_schema::JsonMode::LegacyReflection => {
            crate::grpc_legacy::legacy_descriptor(method.input())?
        }
        grpc_schema::JsonMode::ProtoJson => method.input(),
    };
    if work.cancelled() {
        return Err("gRPC call cancelled.".into());
    }
    let message = if method.is_client_streaming() {
        None
    } else {
        Some(grpc_schema::parse_prepared_mode(
            input.clone(),
            original_input.clone(),
            &request.body,
            request.json_mode,
        )?)
    };
    Ok((request, method, input, original_input, message))
}

struct Preparation {
    task: tokio::task::JoinHandle<Result<PreparedCall, String>>,
    work: Arc<NativeWorkLease>,
    deadline: Option<tokio::time::Instant>,
}
fn start_preparation(request: GrpcRequest, network: &NetworkState) -> Result<Preparation, String> {
    let work = Arc::new(network.retain_native_work(request.id.clone())?);
    // Explicit call budgets start at admission, including time queued/running
    // in the blocking pool. Transport and Started ACK inherit this same instant.
    let deadline = request
        .connection
        .call_deadline()
        .map(|duration| tokio::time::Instant::now() + duration);
    let preparation_work = work.clone();
    let task = tokio::task::spawn_blocking(move || prepare_call(request, preparation_work));
    Ok(Preparation {
        task,
        work,
        deadline,
    })
}

#[tauri::command]
pub async fn connect_grpc(
    mut request: GrpcRequest,
    on_event: Channel<Packet>,
    state: tauri::State<'_, GrpcState>,
    network: tauri::State<'_, NetworkState>,
) -> Result<(), String> {
    request.json_mode = request.json_mode.from_schema(request.reflection);
    let Preparation {
        task,
        work,
        deadline,
    } = start_preparation(request, &network)?;
    let (request, method, input, original_input, message) = task
        .await
        .map_err(|_| "gRPC request preparation stopped unexpectedly.")??;
    if work.cancelled() {
        return Err("gRPC call cancelled.".into());
    }
    let (sender, receiver) = grpc_transport::admission::channel(1);
    let sender = if let Some(message) = message {
        sender
            .send(message)
            .await
            .map_err(|_| "gRPC stream closed.")?;
        // A shadowed sender otherwise stays alive until connect_grpc returns.
        // Close unary/server-streaming request input after its one message.
        drop(sender);
        None
    } else {
        Some(sender)
    };
    let (ack_sender, acknowledgements) = mpsc::channel(2);
    // Both maps use the same lock order; no await occurs while holding std mutexes.
    let (registration, mut cancelled) = {
        let mut calls = state.calls.lock().map_err(|_| "gRPC state unavailable.")?;
        let mut acknowledgements = state
            .acknowledgements
            .lock()
            .map_err(|_| "gRPC acknowledgement state unavailable.")?;
        let cancelled = work.cancellation();
        let outgoing = Arc::new(AsyncMutex::new(Outgoing {
            input,
            original_input,
            sender,
            mode: request.json_mode,
            cancellation: cancelled.clone(),
        }));
        calls.insert(request.id.clone(), outgoing.clone());
        acknowledgements.insert(request.id.clone(), ack_sender.clone());
        (
            CallRegistration {
                id: request.id.clone(),
                calls: state.calls.clone(),
                acknowledgements: state.acknowledgements.clone(),
                outgoing,
                acknowledgement_sender: ack_sender,
                _work: work.clone(),
            },
            cancelled,
        )
    };
    let delivery = Arc::new(AsyncMutex::new(Delivery {
        channel: on_event,
        acknowledgements,
        sequence: 0,
        terminal_sent: false,
        acknowledged_sequence: 0,
        acknowledgement_deadline: None,
        pending_terminal: None,
    }));
    let terminal_delivery = delivery.clone();
    enum CallEnd {
        Finished(Result<(), String>),
        Terminal(tonic::Code, &'static str),
    }
    let dns_owner = request.connection.clone();
    let work = async move {
        // Transport setup and RPC work enforce the same absolute deadline.
        // This wrapper owns only the earlier Started ACK portion of that budget.
        let started = async { delivery.lock().await.send(Event::Started).await };
        let started = match deadline {
            Some(deadline) => match tokio::time::timeout_at(deadline, started).await {
                Ok(result) => result,
                Err(_) => {
                    return CallEnd::Terminal(
                        tonic::Code::DeadlineExceeded,
                        "gRPC deadline exceeded.",
                    )
                }
            },
            None => started.await,
        };
        if let Err(error) = started {
            return CallEnd::Finished(Err(error));
        }
        CallEnd::Finished(
            grpc_transport::call(
                &request.connection,
                method,
                receiver,
                request.json_mode,
                deadline,
                move |event| {
                    let delivery = delivery.clone();
                    async move { delivery.lock().await.send(event).await }
                },
            )
            .await,
        )
    };
    let end = tokio::select! {
        result = work => result,
        _ = cancelled.changed() => CallEnd::Terminal(tonic::Code::Cancelled, "gRPC call cancelled."),
    };
    // The stopped call future has been dropped before terminal delivery;
    // transport/replay ownership cannot outlive the terminal ACK wait.
    let result = match end {
        CallEnd::Finished(result) => result,
        CallEnd::Terminal(code, details) => {
            let mut delivery = terminal_delivery.lock().await;
            if delivery.terminal_sent {
                // A terminal packet may already be queued when its ACK races
                // deadline/cancel. Preserve that result and finish its ACK.
                let sequence = delivery.sequence;
                delivery.wait_for_ack(sequence).await
            } else if let Some(status) = delivery.pending_terminal.take() {
                // Unary callback result already selected before its ACK.
                // Finish that callback and its chosen status instead of cancel.
                let sequence = delivery.sequence;
                match delivery.wait_for_ack(sequence).await {
                    Ok(()) => delivery.send(status).await,
                    Err(error) => Err(error),
                }
            } else {
                let status = Event::Status {
                    code: Some(code as i32 as f64),
                    details: Some(details.into()),
                    trailers: Vec::new(),
                };
                if let Some(callback) = grpc_transport::terminal_callback(&status) {
                    match delivery.send(callback).await {
                        Ok(()) => delivery.send(status).await,
                        Err(error) => Err(error),
                    }
                } else {
                    delivery.send(status).await
                }
            }
        }
    };
    dns_owner.drain_dns().await;
    drop(registration);
    result
}

fn prepare_message(
    input: MessageDescriptor,
    original_input: MessageDescriptor,
    text: String,
    mode: JsonMode,
    work: NativeWorkLease,
    cancellation: tokio::sync::watch::Receiver<bool>,
) -> Result<(DynamicMessage, NativeWorkLease), String> {
    // The command lease owns shutdown/drain; call-ID Cancel belongs to the
    // parent watch. Both must be checked when queued blocking work starts.
    if work.cancelled() || *cancellation.borrow() || cancellation.has_changed().is_err() {
        return Err("gRPC message cancelled.".into());
    }
    let message = grpc_schema::parse_prepared_mode(input, original_input, &text, mode)?;
    Ok((message, work))
}

#[tauri::command]
pub async fn send_grpc_message(
    id: String,
    text: Option<String>,
    finish: bool,
    state: tauri::State<'_, GrpcState>,
    network: tauri::State<'_, NetworkState>,
) -> Result<(), String> {
    // A cloned outgoing handle can outlive connect_grpc's registration while
    // waiting for its mutex or queue. Retain this command until it settles too.
    let work = network.retain_native_work(format!("grpc-message:{}", uuid::Uuid::new_v4()))?;
    let call = state
        .calls
        .lock()
        .map_err(|_| "gRPC state unavailable.")?
        .get(&id)
        .cloned()
        .ok_or("gRPC call is not running.")?;
    let mut outgoing = call.lock().await;
    if work.cancelled()
        || *outgoing.cancellation.borrow()
        || outgoing.cancellation.has_changed().is_err()
    {
        return Err("gRPC message cancelled.".into());
    }
    if outgoing.sender.is_none() {
        return Err("This gRPC call cannot accept more messages.".into());
    }
    if finish {
        if text.is_some() {
            return Err("Finish cannot contain another gRPC message.".into());
        }
        outgoing.sender.take();
        return Ok(());
    }
    let text = text.ok_or("Provide a gRPC message.")?;
    let input = outgoing.input.clone();
    let original_input = outgoing.original_input.clone();
    let mode = outgoing.mode;
    let cancellation = outgoing.cancellation.clone();
    let (message, work) = tokio::task::spawn_blocking(move || {
        prepare_message(input, original_input, text, mode, work, cancellation)
    })
    .await
    .map_err(|_| "gRPC message preparation stopped unexpectedly.")??;
    if work.cancelled()
        || *outgoing.cancellation.borrow()
        || outgoing.cancellation.has_changed().is_err()
    {
        return Err("gRPC message cancelled.".into());
    }
    let mut cancellation = outgoing.cancellation.clone();
    outgoing
        .sender
        .as_ref()
        .ok_or("gRPC sender closed.")?
        .send_until_cancelled(message, &mut cancellation)
        .await
        .map_err(|_| {
            if *cancellation.borrow() || cancellation.has_changed().is_err() {
                "gRPC message cancelled.".into()
            } else {
                "gRPC sender closed.".into()
            }
        })
}

#[tauri::command]
pub fn acknowledge_grpc(
    id: String,
    sequence: u64,
    state: tauri::State<'_, GrpcState>,
) -> Result<(), String> {
    let acknowledgement = Acknowledgement::new(sequence);
    if let Some(sender) = state
        .acknowledgements
        .lock()
        .map_err(|_| "gRPC state unavailable.")?
        .get(&id)
    {
        sender
            .try_send(acknowledgement)
            .map_err(|_| "Unexpected gRPC acknowledgement.")?;
    }
    Ok(())
}

#[cfg(test)]
mod preparation_tests {
    use super::*;
    #[test]
    fn queued_message_preparation_observes_owning_call_cancellation() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .max_blocking_threads(1)
            .build()
            .unwrap();
        runtime.block_on(async {
            let pool = grpc_schema::compile_mode(ProtoInput {
                entry: "message.proto".into(), include_paths: Vec::new(),
                files: vec![grpc_schema::ProtoFile { name: "message.proto".into(),
                    text: "syntax=\"proto3\"; package owned; message Input { string name=1; }".into() }],
            }, JsonMode::ProtoJson).unwrap();
            let input = pool.get_message_by_name("owned.Input").unwrap();
            let network = NetworkState::default();
            let owner = network.retain_native_work("message-call".into()).unwrap();
            let work = network.retain_native_work("message-command".into()).unwrap();
            let cancellation = owner.cancellation();
            let (started, received) = std::sync::mpsc::channel();
            let (release, held) = std::sync::mpsc::channel();
            let blocker = tokio::task::spawn_blocking(move || { started.send(()).unwrap(); held.recv().unwrap(); });
            received.recv().unwrap();
            let descriptor = input.clone();
            let queued = tokio::task::spawn_blocking(move || prepare_message(
                descriptor.clone(), descriptor, "invalid JSON must never be parsed".into(), JsonMode::ProtoJson, work, cancellation));
            network.cancel("message-call").unwrap();
            assert!(owner.cancelled());
            assert!(network.retain_native_work("message-command".into()).is_err(), "Queued worker retains its own drain lease");
            release.send(()).unwrap(); blocker.await.unwrap();
            let error = match queued.await.unwrap() { Err(error) => error, Ok(_) => panic!("Cancelled worker prepared a message") };
            assert_eq!(error, "gRPC message cancelled.", "Call-ID cancellation must precede JSON parsing in queued message work");
            let replacement = network.retain_native_work("message-command".into()).unwrap();drop(replacement);
            drop(owner);
            let owner = network.retain_native_work("message-call".into()).unwrap();
            let work = network.retain_native_work("healthy-message".into()).unwrap();
            let (message, work) = prepare_message(input.clone(), input.clone(), r#"{"name":"healthy"}"#.into(), JsonMode::ProtoJson, work, owner.cancellation()).unwrap();
            assert_eq!(message.get_field_by_name("name").unwrap().as_ref(), &prost_reflect::Value::String("healthy".into()));
            drop(work);
            let cancellation = owner.cancellation();drop(owner);
            let work = network.retain_native_work("retired-message".into()).unwrap();
            assert!(matches!(prepare_message(input.clone(), input, "invalid".into(), JsonMode::ProtoJson, work, cancellation), Err(error) if error == "gRPC message cancelled."));
            println!("Queued message work checks owning call before parsing; healthy parse and retired-owner controls retain drain ownership");
        });
    }

    fn request() -> GrpcRequest {
        serde_json::from_str(r#"{"id":"owned-preparing-call","connection":{"url":"http://127.0.0.1:1","timeoutMs":30000},"descriptorSet":"","method":"/owned.Invalid/Method","body":"{}"}"#).unwrap()
    }
    #[test]
    fn queued_preparation_is_cancelled_by_call_id_and_keeps_its_owner() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .max_blocking_threads(1)
            .build()
            .unwrap();
        runtime.block_on(async {
            let network=NetworkState::default();
            // The previous internal preparation ID is invisible to call-ID Cancel.
            let old=Arc::new(network.retain_native_work("grpc-prepare:old".into()).unwrap());
            network.cancel("owned-preparing-call").unwrap();assert!(!old.cancelled());
            assert_ne!(prepare_call(request(),old.clone()).err().unwrap(),"gRPC call cancelled.");drop(old);
            let (started,received)=std::sync::mpsc::channel();let (release,held)=std::sync::mpsc::channel();
            let blocker=tokio::task::spawn_blocking(move||{started.send(()).unwrap();held.recv().unwrap();});received.recv().unwrap();
            let work=Arc::new(network.retain_native_work("owned-preparing-call".into()).unwrap());let worker=work.clone();
            let queued=tokio::task::spawn_blocking(move||prepare_call(request(),worker));
            network.cancel("owned-preparing-call").unwrap();assert!(work.cancelled());drop(work);
            assert!(network.retain_native_work("owned-preparing-call".into()).is_err(),"Queued worker retains native ownership after its awaiting command drops");
            release.send(()).unwrap();blocker.await.unwrap();
            assert_eq!(queued.await.unwrap().err().unwrap(),"gRPC call cancelled.","Cancelled queued preparation must stop before descriptor parsing");
            let replacement=network.retain_native_work("owned-preparing-call".into()).unwrap();assert!(!replacement.cancelled());drop(replacement);
            println!("Call-ID cancellation misses old internal preparation lease; queued actual prepare_call now cancels before descriptor parsing, retains owner through worker completion and permits clean ID reuse");
        });
    }
    #[test]
    fn preparation_queue_consumes_the_explicit_deadline_before_any_peer_dispatch() {
        use base64::Engine;
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .max_blocking_threads(1)
            .build()
            .unwrap();
        runtime.block_on(async {
            let network=NetworkState::default();
            let listener=std::net::TcpListener::bind("127.0.0.1:0").unwrap();listener.set_nonblocking(true).unwrap();
            let pool=grpc_schema::compile_mode(ProtoInput{entry:"deadline.proto".into(),include_paths:Vec::new(),files:vec![grpc_schema::ProtoFile{name:"deadline.proto".into(),text:r#"syntax="proto3"; package owned; message Input { string name=1; } service Sample { rpc Echo(Input) returns(Input); }"#.into()}]},JsonMode::ProtoJson).unwrap();
            let mut value=request();value.connection.url=format!("http://{}",listener.local_addr().unwrap());value.connection.deadline_ms=Some(20);value.descriptor_set=base64::engine::general_purpose::STANDARD.encode(pool.encode_to_vec());value.method="/owned.Sample/Echo".into();
            let (started,received)=std::sync::mpsc::channel();let (release,held)=std::sync::mpsc::channel();
            let blocker=tokio::task::spawn_blocking(move||{started.send(()).unwrap();held.recv().unwrap();});received.recv().unwrap();
            let Preparation{task,work,deadline}=start_preparation(value,&network).unwrap();
            let deadline=deadline.unwrap();tokio::time::sleep(Duration::from_millis(80)).await;
            assert!(deadline<=tokio::time::Instant::now(),"Explicit budget expires while preparation remains queued");
            release.send(()).unwrap();blocker.await.unwrap();
            let (value,method,_,_,message)=task.await.unwrap().unwrap();let message=message.unwrap();
            // The former post-preparation deadline gives this expired call a new
            // budget and actually opens a peer connection. Keep that control.
            let run=|budget:tokio::time::Instant| {
                let config=value.connection.clone();let method=method.clone();let message=message.clone();
                async move {let (sender,receiver)=grpc_transport::admission::channel(1);sender.send(message).await.unwrap();drop(sender);let events=Arc::new(Mutex::new(Vec::new()));let saved=events.clone();
                    grpc_transport::call(&config,method,receiver,value.json_mode,Some(budget),move|event|{saved.lock().unwrap().push(serde_json::to_value(event).unwrap());async{Ok(())}}).await.unwrap();
                    let statuses:Vec<_>=events.lock().unwrap().iter().filter(|e|e["kind"]=="status").map(|e|e["code"].as_i64().unwrap()).collect();assert_eq!(statuses,vec![4]);
                }
            };
            run(tokio::time::Instant::now()+Duration::from_millis(50)).await;
            let (old_peer,_)=listener.accept().expect("Old post-preparation deadline dispatches to the peer");drop(old_peer);
            run(deadline).await;
            assert!(matches!(listener.accept(),Err(error) if error.kind()==std::io::ErrorKind::WouldBlock),"Expired admission deadline must not open another connection");
            drop(work);
            println!("Explicit20ms budget consumed by80ms blocking queue; old renewed50ms control opens peer, captured admission deadline returns status4 with zero additional peer connections");
        });
    }
}

#[cfg(test)]
mod delivery_tests {
    use super::*;
    fn delivery(
        receiver: mpsc::Receiver<Acknowledgement>,
        deadline: tokio::time::Instant,
    ) -> Delivery {
        Delivery {
            channel: Channel::new(|_| Ok(())),
            acknowledgements: receiver,
            sequence: 1,
            terminal_sent: false,
            acknowledged_sequence: 0,
            acknowledgement_deadline: Some(deadline),
            pending_terminal: None,
        }
    }
    #[tokio::test]
    async fn buffered_ack_respects_its_original_receipt_deadline() {
        let past = tokio::time::Instant::now() - Duration::from_millis(1);
        let (sender, receiver) = mpsc::channel(2);
        let mut state = delivery(receiver, past);
        sender.send(Acknowledgement::new(1)).await.unwrap();
        assert_eq!(
            state.wait_for_ack(1).await.unwrap_err(),
            "gRPC view stopped acknowledging messages."
        );
        assert_eq!(state.acknowledged_sequence, 0);
        assert_eq!(state.acknowledgement_deadline, Some(past));
        // Exact expiry is late too, without relying on scheduler timing.
        let (sender, receiver) = mpsc::channel(2);
        let mut state = delivery(receiver, past);
        sender
            .send(Acknowledgement {
                sequence: 1,
                received: past,
            })
            .await
            .unwrap();
        assert!(state.wait_for_ack(1).await.is_err());
        // A queued on-time ACK remains valid even when delivery is polled late.
        let (sender, receiver) = mpsc::channel(2);
        let mut state = delivery(receiver, past);
        sender
            .send(Acknowledgement {
                sequence: 0,
                received: past + Duration::from_millis(1),
            })
            .await
            .unwrap();
        sender
            .send(Acknowledgement {
                sequence: 1,
                received: past - Duration::from_millis(1),
            })
            .await
            .unwrap();
        state.wait_for_ack(1).await.unwrap();
        assert_eq!(state.acknowledged_sequence, 1);
        assert_eq!(state.acknowledgement_deadline, None);
        state.wait_for_ack(1).await.unwrap();
        // Dropping/resuming the ACK future after call cancellation must not
        // restart this packet's budget or make its late receipt admissible.
        let deadline = tokio::time::Instant::now() + Duration::from_millis(100);
        let (sender, receiver) = mpsc::channel(2);
        let mut state = delivery(receiver, deadline);
        let mut waiting = Box::pin(state.wait_for_ack(1));
        assert!(futures_util::poll!(&mut waiting).is_pending());
        drop(waiting);
        tokio::time::sleep(Duration::from_millis(120)).await;
        assert_eq!(state.acknowledgement_deadline, Some(deadline));
        sender.send(Acknowledgement::new(1)).await.unwrap();
        assert!(state.wait_for_ack(1).await.is_err());
        assert_eq!(state.acknowledged_sequence, 0);
        let (sender, receiver) = mpsc::channel(2);
        let mut state = delivery(receiver, past);
        drop(sender);
        assert_eq!(
            state.wait_for_ack(1).await.unwrap_err(),
            "gRPC view closed."
        );
        let (_sender, receiver) = mpsc::channel(2);
        let mut state = delivery(receiver, past);
        assert_eq!(
            state.wait_for_ack(1).await.unwrap_err(),
            "gRPC view stopped acknowledging messages."
        );
        println!("Late/exact-expiry buffered ACKs rejected; on-time buffered/stale-sequence/cached ACKs preserved; dropped/resumed wait keeps original budget; closed/silent receiver controls pass");
    }
}
