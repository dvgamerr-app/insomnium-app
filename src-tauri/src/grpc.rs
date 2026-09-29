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
    mode: JsonMode,
    sender: Option<mpsc::Sender<DynamicMessage>>,
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
    let work = async {
        on_started
            .send(())
            .map_err(|_| "gRPC schema view closed.")?;
        let reflection = request.proto.is_none();
        let pool = match request.proto {
            Some(input) => tokio::task::spawn_blocking(move || grpc_schema::compile(input))
                .await
                .map_err(|_| "Proto compiler stopped unexpectedly.")??,
            None => {
                grpc_transport::reflect(
                    request
                        .connection
                        .as_ref()
                        .ok_or("Provide proto files or a reflection endpoint.")?,
                )
                .await?
            }
        };
        if reflection {
            grpc_schema::describe_reflection(&pool, request.json_mode)
        } else {
            grpc_schema::describe(&pool, request.json_mode)
        }
    };
    let timeout = request
        .connection
        .as_ref()
        .map(|c| c.timeout_ms)
        .unwrap_or(30_000)
        .clamp(1, 3_600_000);
    let result = tokio::select! {
        result = tokio::time::timeout(Duration::from_millis(timeout), work) => result.map_err(|_| "gRPC schema lookup timed out.".to_string()).and_then(|r| r),
        _ = cancelled.changed() => Err("gRPC schema lookup cancelled.".into()),
    };
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
}
impl Delivery {
    async fn send(&mut self, event: Event) -> Result<(), String> {
        self.sequence += 1;
        let sequence = self.sequence;
        self.channel
            .send(Packet { event, sequence })
            .map_err(|_| "gRPC view closed.")?;
        tokio::time::timeout(Duration::from_secs(30), async {
            while let Some(ack) = self.acknowledgements.recv().await {
                if ack == sequence {
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
    request: GrpcRequest,
    on_event: Channel<Packet>,
    state: tauri::State<'_, GrpcState>,
    network: tauri::State<'_, NetworkState>,
) -> Result<(), String> {
    let pool = grpc_schema::decode(&request.descriptor_set)?;
    let method = grpc_schema::method(&pool, &request.method)?;
    let (sender, receiver) = mpsc::channel(1);
    let sender = if method.is_client_streaming() {
        Some(sender)
    } else {
        sender
            .send(grpc_schema::parse_mode(
                method.input(),
                &request.body,
                request.json_mode,
            )?)
            .await
            .map_err(|_| "gRPC stream closed.")?;
        None
    };
    let (ack_sender, acknowledgements) = mpsc::channel(2);
    let input = method.input();
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
    }));
    let timeout_ms = request.connection.timeout_ms.clamp(1, 3_600_000);
    let work = async move {
        delivery.lock().await.send(Event::Started).await?;
        grpc_transport::call(
            &request.connection,
            method,
            receiver,
            request.json_mode,
            move |event| {
                let delivery = delivery.clone();
                async move { delivery.lock().await.send(event).await }
            },
        )
        .await
    };
    let result = tokio::select! {
        result = tokio::time::timeout(Duration::from_millis(timeout_ms), work) => result.map_err(|_| "gRPC deadline exceeded.".to_string()).and_then(|r| r),
        _ = cancelled.changed() => Err("gRPC call cancelled.".into()),
    };
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
) -> Result<(), String> {
    let call = state
        .calls
        .lock()
        .map_err(|_| "gRPC state unavailable.")?
        .get(&id)
        .cloned()
        .ok_or("gRPC call is not running.")?;
    let mut outgoing = call.lock().await;
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
    let message = grpc_schema::parse_mode(
        outgoing.input.clone(),
        text.as_deref().ok_or("Provide a gRPC message.")?,
        outgoing.mode,
    )?;
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
