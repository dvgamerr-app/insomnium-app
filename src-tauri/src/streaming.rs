use crate::{
    cookies::{CookieState, PersistentJar},
    http::{build_client, build_request, HttpRequest, NetworkState},
};
use base64::{engine::general_purpose::STANDARD, Engine};
use eventsource_stream::Eventsource;
use futures_util::{SinkExt, StreamExt};
use reqwest::{header::HeaderValue, Url};
use reqwest_websocket::{CloseCode, Message, RequestBuilderExt};
use serde::Serialize;
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::ipc::Channel;
use tokio::sync::{mpsc, oneshot, watch};

const MAX_MESSAGE: usize = 20 * 1024 * 1024;

#[derive(Default)]
pub struct StreamState {
    sockets: Mutex<HashMap<String, mpsc::Sender<Outgoing>>>,
    acknowledgements: Mutex<HashMap<String, mpsc::Sender<u64>>>,
}
struct Outgoing {
    message: Message,
    sent: oneshot::Sender<Result<(), String>>,
}

struct Delivery {
    channel: Channel<StreamPacket>,
    acknowledgements: mpsc::Receiver<u64>,
    cancelled: watch::Receiver<bool>,
    sequence: u64,
}
impl Delivery {
    // Keep only one data event in flight through IPC. A slow WebView backpressures the socket.
    async fn message(&mut self, event: StreamEvent) -> Result<(), String> {
        self.sequence += 1;
        let sequence = self.sequence;
        self.channel
            .send(StreamPacket {
                event,
                sequence: Some(sequence),
            })
            .map_err(|e| e.to_string())?;
        let wait = async {
            while let Some(ack) = self.acknowledgements.recv().await {
                if ack == sequence {
                    return Ok(());
                }
            }
            Err("Stream view closed".to_string())
        };
        tokio::select! {
            ack = tokio::time::timeout(Duration::from_secs(30), wait) => ack.map_err(|_| "Stream view stopped acknowledging messages")?,
            _ = self.cancelled.changed() => Err("Stream cancelled".into()),
        }
    }
}

// Size guard only; eventsource-stream remains responsible for UTF-8 and SSE parsing.
// Count data fields within an event, not comments/heartbeats over the connection lifetime.
#[derive(Default)]
struct SseLimits {
    line_bytes: usize,
    data_bytes: usize,
    field: Vec<u8>,
    colon: bool,
    skip_lf: bool,
    bom: u8,
}
impl SseLimits {
    fn accept(&mut self, bytes: &[u8]) -> Result<(), String> {
        for &byte in bytes {
            // The SSE parser strips one leading UTF-8 BOM, including across chunks.
            match (self.bom, byte) {
                (0, 0xef) => {
                    self.bom = 1;
                    continue;
                }
                (1, 0xbb) => {
                    self.bom = 2;
                    continue;
                }
                (2, 0xbf) => {
                    self.bom = 3;
                    continue;
                }
                _ => self.bom = 3,
            }
            if self.skip_lf {
                self.skip_lf = false;
                if byte == b'\n' {
                    continue;
                }
            }
            if matches!(byte, b'\r' | b'\n') {
                if self.line_bytes == 0 {
                    self.data_bytes = 0;
                } else if self.field == b"data" {
                    self.data_bytes += self.line_bytes;
                }
                self.line_bytes = 0;
                self.field.clear();
                self.colon = false;
                self.skip_lf = byte == b'\r';
                continue;
            }
            self.line_bytes += 1;
            if !self.colon {
                if byte == b':' {
                    self.colon = true;
                } else if self.field.len() < 6 {
                    self.field.push(byte);
                }
            }
            if self.line_bytes > MAX_MESSAGE
                || (self.field == b"data" && self.data_bytes + self.line_bytes > MAX_MESSAGE)
            {
                return Err("SSE line or event exceeded the 20 MiB limit".into());
            }
        }
        Ok(())
    }
}

#[tauri::command]
pub fn acknowledge_stream(
    id: String,
    sequence: u64,
    streams: tauri::State<'_, StreamState>,
) -> Result<(), String> {
    if let Some(sender) = streams
        .acknowledgements
        .lock()
        .map_err(|e| e.to_string())?
        .get(&id)
    {
        let _ = sender.try_send(sequence);
    }
    Ok(())
}

#[derive(Clone, Serialize)]
pub struct StreamPacket {
    event: StreamEvent,
    sequence: Option<u64>,
}

#[derive(Clone, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum StreamEvent {
    Started,
    Finished,
    Open {
        status: u16,
        url: String,
        headers: Vec<(String, String)>,
        elapsed_ms: u128,
        protocol: String,
    },
    Message {
        direction: String,
        format: String,
        data: String,
        size: usize,
    },
    Sse {
        event: String,
        id: String,
        data: String,
        retry_ms: Option<u128>,
    },
    Closed {
        code: Option<u16>,
        reason: String,
    },
    Warning {
        message: String,
    },
}

fn emit(channel: &Channel<StreamPacket>, event: StreamEvent) -> Result<(), String> {
    channel
        .send(StreamPacket {
            event,
            sequence: None,
        })
        .map_err(|e| format!("Stream view is unavailable: {e}"))
}
fn open_event(response: &reqwest::Response, started: Instant, protocol: &str) -> StreamEvent {
    StreamEvent::Open {
        status: response.status().as_u16(),
        url: response.url().to_string(),
        headers: response
            .headers()
            .iter()
            .map(|(n, v)| {
                (
                    n.to_string(),
                    String::from_utf8_lossy(v.as_bytes()).into_owned(),
                )
            })
            .collect(),
        elapsed_ms: started.elapsed().as_millis(),
        protocol: protocol.into(),
    }
}
fn message_event(message: &Message, direction: &str) -> StreamEvent {
    let (format, data, size) = match message {
        Message::Text(text) => ("text", text.clone(), text.len()),
        Message::Binary(bytes) => ("binary", STANDARD.encode(bytes), bytes.len()),
        Message::Ping(bytes) => ("ping", STANDARD.encode(bytes), bytes.len()),
        Message::Pong(bytes) => ("pong", STANDARD.encode(bytes), bytes.len()),
        Message::Close { code, reason } => {
            return StreamEvent::Closed {
                code: Some((*code).into()),
                reason: reason.clone(),
            }
        }
    };
    StreamEvent::Message {
        direction: direction.into(),
        format: format.into(),
        data,
        size,
    }
}
async fn flush_cookies(
    jar: Option<&Arc<PersistentJar>>,
    channel: &Channel<StreamPacket>,
) -> Result<(), String> {
    if let Some(jar) = jar {
        if let Err(error) = jar.flush().await {
            emit(
                channel,
                StreamEvent::Warning {
                    message: format!("Cookies could not be saved: {error}"),
                },
            )?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn connect_stream(
    app: tauri::AppHandle,
    request: HttpRequest,
    protocol: String,
    on_event: Channel<StreamPacket>,
    network: tauri::State<'_, NetworkState>,
    streams: tauri::State<'_, StreamState>,
    cookies: tauri::State<'_, CookieState>,
) -> Result<(), String> {
    if !matches!(protocol.as_str(), "websocket" | "sse") {
        return Err("Unknown streaming protocol".into());
    }
    let websocket = protocol == "websocket";
    let mut url = Url::parse(&request.url).map_err(|e| e.to_string())?;
    if websocket {
        let scheme = match url.scheme() {
            "ws" | "http" => "http",
            "wss" | "https" => "https",
            _ => return Err("WebSocket URL must use ws or wss".into()),
        };
        url.set_scheme(scheme)
            .map_err(|_| "Invalid WebSocket URL")?;
    } else if !matches!(url.scheme(), "http" | "https") {
        return Err("SSE URL must use HTTP or HTTPS".into());
    }
    let cancelled = network.begin(&request.id)?;
    let (ack, acknowledgements) = mpsc::channel(8);
    streams
        .acknowledgements
        .lock()
        .map_err(|e| e.to_string())?
        .insert(request.id.clone(), ack);
    let mut delivery = Delivery {
        channel: on_event.clone(),
        sequence: 0,
        cancelled,
        acknowledgements,
    };
    let mut jar = None;
    let result = async {
        emit(&on_event, StreamEvent::Started)?;
        if request.use_cookies && (request.send_cookies || request.store_cookies) {
            jar = tokio::select! {
                result = cookies.jar(&app, request.workspace_id.clone()) => Some(result?),
                _ = delivery.cancelled.changed() => return Ok(()),
            };
        }
        let client = build_client(&request, &url, jar.as_ref(), true, websocket)?;
        let started = Instant::now();
        if websocket {
            websocket_session(
                &request,
                build_request(&client, &request, url)?,
                &streams,
                &mut delivery,
                jar.as_ref(),
                started,
            )
            .await
        } else {
            sse_session(
                &request,
                build_request(&client, &request, url)?,
                &mut delivery,
                jar.as_ref(),
                started,
            )
            .await
        }
    }
    .await;
    streams
        .sockets
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&request.id);
    let flushed = flush_cookies(jar.as_ref(), &on_event).await;
    // Drain earlier channel events before resolving the invocation/history snapshot.
    let delivered = delivery.message(StreamEvent::Finished).await;
    streams
        .acknowledgements
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&request.id);
    network.finish(&request.id)?;
    result.and(flushed).and(delivered)
}

async fn websocket_session(
    request: &HttpRequest,
    outgoing: reqwest::RequestBuilder,
    streams: &StreamState,
    delivery: &mut Delivery,
    jar: Option<&Arc<PersistentJar>>,
    started: Instant,
) -> Result<(), String> {
    let channel = delivery.channel.clone();
    let protocols: Vec<String> = request
        .headers
        .iter()
        .filter(|(n, _)| n.eq_ignore_ascii_case("sec-websocket-protocol"))
        .flat_map(|(_, v)| v.split(',').map(|s| s.trim().to_string()))
        .filter(|s| !s.is_empty())
        .collect();
    for protocol in &protocols {
        HeaderValue::from_str(protocol).map_err(|_| "Invalid WebSocket subprotocol")?;
        if !protocol
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"!#$%&'*+-.^_`|~".contains(&c))
        {
            return Err("Invalid WebSocket subprotocol token".into());
        }
    }
    let config = tungstenite::protocol::WebSocketConfig::default()
        .max_message_size(Some(MAX_MESSAGE))
        .max_frame_size(Some(MAX_MESSAGE));
    let (client, outgoing) = outgoing.build_split();
    let outgoing = outgoing.map_err(|e| e.to_string())?;
    let handshake = crate::digest::execute(
        outgoing,
        request.signing(),
        request.follow_redirects,
        request
            .identity_pem
            .as_ref()
            .is_some_and(|pem| !pem.is_empty()),
        |outgoing| {
            let builder = reqwest::RequestBuilder::from_parts(client.clone(), outgoing)
                .upgrade()
                .protocols(protocols.clone())
                .web_socket_config(config);
            async move {
                builder
                    .send()
                    .await
                    .map_err(|e| format!("WebSocket handshake failed: {e:?}"))
            }
        },
    );
    let response = tokio::select! {
        response = tokio::time::timeout(Duration::from_millis(request.timeout_ms.clamp(1, 3_600_000)), handshake) => response.map_err(|_| "WebSocket handshake timed out")??,
        _ = delivery.cancelled.changed() => return emit(&channel, StreamEvent::Closed { code: None, reason: "Connection cancelled".into() }),
    };
    let metadata = open_event(&response, started, "websocket");
    let mut socket = response
        .into_websocket()
        .await
        .map_err(|e| format!("WebSocket upgrade failed: {e:?}"))?;
    let (sender, mut outgoing) = mpsc::channel::<Outgoing>(16);
    streams
        .sockets
        .lock()
        .map_err(|e| e.to_string())?
        .insert(request.id.clone(), sender);
    emit(&channel, metadata)?;
    flush_cookies(jar, &channel).await?;
    loop {
        tokio::select! {
            _ = delivery.cancelled.changed() => {
                let _ = tokio::time::timeout(Duration::from_secs(2), socket.close(CloseCode::Normal, Some("Disconnected by client"))).await;
                return emit(&channel, StreamEvent::Closed { code: Some(1000), reason: "Disconnected by client".into() });
            }
            command = outgoing.recv() => {
                let Some(command) = command else { return Ok(()); };
                let event = message_event(&command.message, "sent");
                let sent = tokio::select! {
                    result = tokio::time::timeout(Duration::from_millis(request.timeout_ms.clamp(1, 3_600_000)), socket.send(command.message)) => result.map_err(|_| "WebSocket send timed out".to_string()).and_then(|result| result.map_err(|e| e.to_string())),
                    _ = delivery.cancelled.changed() => Err("WebSocket send cancelled".into()),
                };
                let _ = command.sent.send(sent.clone());
                sent?;
                delivery.message(event).await?;
            }
            message = socket.next() => {
                match message {
                    Some(Ok(message)) => {
                        let closed = matches!(message, Message::Close { .. });
                        if closed { emit(&channel, message_event(&message, "received"))?; } else { delivery.message(message_event(&message, "received")).await?; }
                        if closed {
                            let _ = tokio::time::timeout(Duration::from_secs(2), socket.flush()).await;
                            return Ok(());
                        }
                    }
                    Some(Err(error)) => return Err(format!("WebSocket failed: {error}")),
                    None => return emit(&channel, StreamEvent::Closed { code: None, reason: "Connection ended".into() }),
                }
            }
        }
    }
}

async fn sse_session(
    request: &HttpRequest,
    outgoing: reqwest::RequestBuilder,
    delivery: &mut Delivery,
    jar: Option<&Arc<PersistentJar>>,
    started: Instant,
) -> Result<(), String> {
    let channel = delivery.channel.clone();
    let (client, outgoing) = outgoing.build_split();
    let outgoing = outgoing.map_err(|e| e.to_string())?;
    let handshake = crate::digest::execute(
        outgoing,
        request.signing(),
        request.follow_redirects,
        request
            .identity_pem
            .as_ref()
            .is_some_and(|pem| !pem.is_empty()),
        |outgoing| async { client.execute(outgoing).await.map_err(|e| e.to_string()) },
    );
    let response = tokio::select! {
        response = tokio::time::timeout(Duration::from_millis(request.timeout_ms.clamp(1, 3_600_000)), handshake) => response.map_err(|_| "SSE handshake timed out")??,
        _ = delivery.cancelled.changed() => return emit(&channel, StreamEvent::Closed { code: None, reason: "Connection cancelled".into() }),
    };
    emit(&channel, open_event(&response, started, "sse"))?;
    flush_cookies(jar, &channel).await?;
    if !response.status().is_success() {
        return Err(format!("SSE server returned HTTP {}", response.status()));
    }
    if !response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| {
            v.split(';')
                .next()
                .unwrap_or("")
                .trim()
                .eq_ignore_ascii_case("text/event-stream")
        })
    {
        return Err("The response Content-Type is not text/event-stream. Use HTTP mode to inspect its body.".into());
    }
    let mut limits = SseLimits::default();
    let bytes = response.bytes_stream().map(move |chunk| {
        let chunk = chunk.map_err(|e| e.to_string())?;
        limits.accept(&chunk)?;
        Ok::<_, String>(chunk)
    });
    let mut events = bytes.eventsource();
    loop {
        tokio::select! {
            _ = delivery.cancelled.changed() => return emit(&channel, StreamEvent::Closed { code: None, reason: "Disconnected by client".into() }),
            event = events.next() => match event {
                Some(Ok(event)) => {
                    delivery.message(StreamEvent::Sse { event: event.event, id: event.id, data: event.data, retry_ms: event.retry.map(|r| r.as_millis()) }).await?;
                }
                Some(Err(error)) => return Err(format!("SSE stream failed: {error}")),
                None => return emit(&channel, StreamEvent::Closed { code: None, reason: "Event stream ended".into() }),
            }
        }
    }
}

#[tauri::command]
pub async fn send_stream_message(
    id: String,
    format: String,
    data: String,
    streams: tauri::State<'_, StreamState>,
) -> Result<(), String> {
    if data.len() > MAX_MESSAGE * 4 / 3 + 4 {
        return Err("Message exceeds the 20 MiB limit".into());
    }
    let message = match format.as_str() {
        "text" => Message::Text(data),
        "binary" => Message::Binary(STANDARD.decode(data).map_err(|e| e.to_string())?.into()),
        "ping" => Message::Ping(data.into_bytes().into()),
        _ => return Err("Unsupported WebSocket message type".into()),
    };
    let size = match &message {
        Message::Text(t) => t.len(),
        Message::Binary(b) | Message::Ping(b) => b.len(),
        _ => 0,
    };
    if size > MAX_MESSAGE || matches!(&message, Message::Ping(b) if b.len() > 125) {
        return Err("Message is too large (20 MiB data / 125 bytes ping)".into());
    }
    let sender = streams
        .sockets
        .lock()
        .map_err(|e| e.to_string())?
        .get(&id)
        .cloned()
        .ok_or("WebSocket is not connected")?;
    let (sent, result) = oneshot::channel();
    sender
        .try_send(Outgoing { message, sent })
        .map_err(|e| format!("WebSocket send queue unavailable: {e}"))?;
    result
        .await
        .map_err(|_| "WebSocket disconnected before sending".to_string())?
}
