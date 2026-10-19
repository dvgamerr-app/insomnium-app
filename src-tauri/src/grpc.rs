use crate::{
    grpc_schema::{self, JsonMode, ProtoInput, Schema},
    grpc_transport::{self, Connection, Event},
    http::NetworkState,
};
use prost_reflect::{DynamicMessage, MessageDescriptor};
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
    calls: Mutex<HashMap<String, Arc<AsyncMutex<Outgoing>>>>,
    acknowledgements: Mutex<HashMap<String, mpsc::Sender<u64>>>,
}
struct Outgoing {
    input: MessageDescriptor,
    original_input: MessageDescriptor,
    mode: JsonMode,
    sender: Option<grpc_transport::admission::Sender<DynamicMessage>>,
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
    let mut cancelled = network.begin(&request.id)?;
    let mut compilation = None;
    let work = async {
        on_started
            .send(())
            .map_err(|_| "gRPC schema view closed.")?;
        let pool = match request.proto {
            Some(input) => {
                let task = compilation.insert(tokio::task::spawn_blocking(move || {
                    grpc_schema::compile(input)
                }));
                let result = task.await;
                compilation.take();
                result.map_err(|_| "Proto compiler stopped unexpectedly.")??
            }
            None => {
                let discovery = grpc_transport::reflect(
                    request
                        .connection
                        .as_ref()
                        .ok_or("Provide proto files or a reflection endpoint.")?,
                )
                .await?;
                return grpc_schema::describe_reflection_services(
                    &discovery.pool,
                    &discovery.services,
                    request.json_mode,
                );
            }
        };
        grpc_schema::describe(&pool, request.json_mode)
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
        // then drain any compiler already running before releasing ownership.
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
struct Delivery {
    channel: Channel<Packet>,
    acknowledgements: mpsc::Receiver<u64>,
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
                if ack == sequence {
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

#[tauri::command]
pub async fn connect_grpc(
    mut request: GrpcRequest,
    on_event: Channel<Packet>,
    state: tauri::State<'_, GrpcState>,
    network: tauri::State<'_, NetworkState>,
) -> Result<(), String> {
    request.json_mode = request.json_mode.from_schema(request.reflection);
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
    let input = match request.json_mode {
        grpc_schema::JsonMode::Legacy | grpc_schema::JsonMode::LegacyReflection => {
            crate::grpc_legacy::legacy_descriptor(method.input())?
        }
        grpc_schema::JsonMode::ProtoJson => method.input(),
    };
    let (sender, receiver) = grpc_transport::admission::channel(1);
    let sender = if method.is_client_streaming() {
        Some(sender)
    } else {
        sender
            .send(grpc_schema::parse_prepared_mode(
                input.clone(),
                original_input.clone(),
                &request.body,
                request.json_mode,
            )?)
            .await
            .map_err(|_| "gRPC stream closed.")?;
        // A shadowed sender otherwise stays alive until connect_grpc returns.
        // Close unary/server-streaming request input after its one message.
        drop(sender);
        None
    };
    let (ack_sender, acknowledgements) = mpsc::channel(2);
    // Both maps use the same lock order; no await occurs while holding std mutexes.
    let mut cancelled = {
        let mut calls = state.calls.lock().map_err(|_| "gRPC state unavailable.")?;
        let mut acknowledgements = state
            .acknowledgements
            .lock()
            .map_err(|_| "gRPC acknowledgement state unavailable.")?;
        let cancelled = network.begin(&request.id)?;
        calls.insert(
            request.id.clone(),
            Arc::new(AsyncMutex::new(Outgoing {
                input,
                original_input,
                sender,
                mode: request.json_mode,
            })),
        );
        acknowledgements.insert(request.id.clone(), ack_sender);
        cancelled
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
    let deadline = request
        .connection
        .call_deadline()
        .map(|duration| tokio::time::Instant::now() + duration);
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
                    code: code as i32,
                    details: details.into(),
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
    let calls_removed = state
        .calls
        .lock()
        .map_err(|_| "gRPC state unavailable.")
        .map(|mut calls| calls.remove(&request.id));
    let acknowledgements_removed = state
        .acknowledgements
        .lock()
        .map_err(|_| "gRPC state unavailable.")
        .map(|mut acknowledgements| acknowledgements.remove(&request.id));
    let finished = network.finish(&request.id);
    calls_removed?;
    acknowledgements_removed?;
    finished?;
    result
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
    if work.cancelled() {
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
    let message = grpc_schema::parse_prepared_mode(
        outgoing.input.clone(),
        outgoing.original_input.clone(),
        text.as_deref().ok_or("Provide a gRPC message.")?,
        outgoing.mode,
    )?;
    if work.cancelled() {
        return Err("gRPC message cancelled.".into());
    }
    outgoing
        .sender
        .as_ref()
        .ok_or("gRPC sender closed.")?
        .send(message)
        .await
        .map_err(|_| "gRPC sender closed.".into())
}

#[tauri::command]
pub fn acknowledge_grpc(
    id: String,
    sequence: u64,
    state: tauri::State<'_, GrpcState>,
) -> Result<(), String> {
    if let Some(sender) = state
        .acknowledgements
        .lock()
        .map_err(|_| "gRPC state unavailable.")?
        .get(&id)
    {
        sender
            .try_send(sequence)
            .map_err(|_| "Unexpected gRPC acknowledgement.")?;
    }
    Ok(())
}
