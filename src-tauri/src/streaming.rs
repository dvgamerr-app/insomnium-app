use crate::{
    cookies::{CookieState, PersistentJar},
    http::{build_client, build_request, HttpRequest, NetworkState},
};
use base64::{engine::general_purpose::STANDARD, Engine};
use eventsource_stream::Eventsource;
use futures_util::{SinkExt, Stream, StreamExt};
use hyper::body::Bytes;
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
    can_drain: bool,
}
impl Delivery {
    // Keep only one data event in flight through IPC. A slow WebView backpressures the socket.
    async fn message(&mut self, event: StreamEvent) -> Result<(), String> {
        self.sequence += 1;
        let sequence = self.sequence;
        if let Err(error) = self.channel.send(StreamPacket {
            event,
            sequence: Some(sequence),
        }) {
            self.can_drain = false;
            return Err(error.to_string());
        }
        let wait = async {
            while let Some(ack) = self.acknowledgements.recv().await {
                if ack == sequence {
                    return Ok(());
                }
            }
            Err("Stream view closed".to_string())
        };
        let (result, failed) = tokio::select! {
            ack = tokio::time::timeout(Duration::from_secs(30), wait) => match ack {
                Ok(result) => {
                    let failed = result.is_err();
                    (result, failed)
                }
                Err(_) => (Err("Stream view stopped acknowledging messages".into()), true),
            },
            _ = self.cancelled.changed() => (Err("Stream cancelled".into()), false),
        };
        if failed {
            self.can_drain = false;
        }
        result
    }
}

// Bound original bytes; UTF8 repair and decoded field limits are separate.
// Count data fields within an event, not comments/heartbeats over the connection lifetime.
#[derive(Default)]
struct SseLimits {
    line_bytes: usize,
    data_bytes: usize,
    field: Vec<u8>,
    colon: bool,
    skip_lf: bool,
    bom: u8,
    // Accepted prefix of the most recent chunk, before its first invalid byte.
    valid_prefix: usize,
}
impl SseLimits {
    fn accept(&mut self, bytes: &[u8]) -> Result<(), String> {
        for (index, &byte) in bytes.iter().enumerate() {
            self.valid_prefix = index;
            // The SSE parser strips one leading UTF-8 BOM, including across chunks.
            let pending = self.bom;
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
                _ => {
                    self.bom = 3;
                    // A partial match is ordinary input unless the complete BOM
                    // arrives. Count all buffered bytes when the prefix differs.
                    if matches!(pending, 1 | 2) {
                        self.accept_byte(0xef)?;
                    }
                    if pending == 2 {
                        self.accept_byte(0xbb)?;
                    }
                }
            }
            self.accept_byte(byte)?;
        }
        self.valid_prefix = bytes.len();
        Ok(())
    }

    fn accept_byte(&mut self, byte: u8) -> Result<(), String> {
        if self.skip_lf {
            self.skip_lf = false;
            if byte == b'\n' {
                return Ok(());
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
            return Ok(());
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
        Ok(())
    }
}

fn sse_checked_parts(
    chunk: Bytes,
    valid_prefix: usize,
    accepted: Result<(), String>,
) -> Vec<Result<Bytes, String>> {
    match accepted {
        Ok(()) => vec![Ok(chunk)],
        Err(error) => {
            let mut parts = Vec::with_capacity(2);
            if valid_prefix > 0 {
                parts.push(Ok(chunk.slice(..valid_prefix)));
            }
            parts.push(Err(error));
            parts
        }
    }
}

/// SSE uses replacement-mode UTF8, unlike the dependency's strict byte stream.
/// Keep only an incomplete final scalar (at most three bytes) between chunks.
#[derive(Default)]
struct SseUtf8 {
    pending: Vec<u8>,
}
impl SseUtf8 {
    fn decode(&mut self, chunk: Bytes, last: bool) -> Bytes {
        if self.pending.is_empty() && std::str::from_utf8(&chunk).is_ok() {
            return chunk;
        }
        let mut bytes = std::mem::take(&mut self.pending);
        bytes.extend_from_slice(&chunk);
        let mut text = String::with_capacity(bytes.len());
        let mut offset = 0;
        loop {
            let rest = &bytes[offset..];
            match std::str::from_utf8(rest) {
                Ok(valid) => {
                    text.push_str(valid);
                    break;
                }
                Err(error) => {
                    let valid = error.valid_up_to();
                    text.push_str(std::str::from_utf8(&rest[..valid]).unwrap());
                    if let Some(invalid) = error.error_len() {
                        text.push('\u{fffd}');
                        offset += valid + invalid;
                    } else {
                        if last {
                            text.push('\u{fffd}');
                        } else {
                            debug_assert!(rest.len() - valid <= 3);
                            self.pending.extend_from_slice(&rest[valid..]);
                        }
                        break;
                    }
                }
            }
        }
        Bytes::from(text)
    }
}

fn sse_utf8<S, E>(stream: S) -> impl Stream<Item = Result<Bytes, E>>
where
    S: Stream<Item = Result<Bytes, E>>,
{
    stream
        .map(|chunk| chunk.map(Some))
        .chain(futures_util::stream::once(futures_util::future::ready(Ok(
            None,
        ))))
        .scan(SseUtf8::default(), |decoder, chunk| {
            futures_util::future::ready(Some(chunk.map(|chunk| {
                let last = chunk.is_none();
                decoder.decode(chunk.unwrap_or_default(), last)
            })))
        })
}

/// Normalize only parser input. A CR ends a line immediately; a subsequent LF
/// belongs to that same ending even when it arrives in another transport chunk.
fn sse_text<S, E>(stream: S) -> impl Stream<Item = Result<Bytes, E>>
where
    S: Stream<Item = Result<Bytes, E>>,
{
    sse_utf8(stream).scan(false, |skip_lf, chunk| {
        futures_util::future::ready(Some(chunk.map(|chunk| {
            if !*skip_lf && !chunk.contains(&b'\r') {
                return chunk;
            }
            let mut normalized = Vec::with_capacity(chunk.len());
            for &byte in chunk.as_ref() {
                if *skip_lf {
                    *skip_lf = false;
                    if byte == b'\n' {
                        continue;
                    }
                }
                if byte == b'\r' {
                    normalized.push(b'\n');
                    *skip_lf = true;
                } else {
                    normalized.push(byte);
                }
            }
            Bytes::from(normalized)
        })))
    })
}

fn validate_sse_text(event: &str, id: &str, data: &str) -> Result<(), String> {
    if [event, id, data]
        .iter()
        .any(|field| field.len() > MAX_MESSAGE)
    {
        return Err("SSE decoded field exceeded the 20 MiB limit".into());
    }
    Ok(())
}

#[cfg(test)]
mod sse_limit_tests {
    use super::*;

    #[test]
    fn partial_bom_counts_non_bom_utf8_and_exact_line_limit() {
        for prefix in [[0xef, 0xbb, 0xbd], [0xef, 0xb8, 0x80]] {
            assert!(std::str::from_utf8(&prefix).is_ok());
            let mut limits = SseLimits::default();
            for byte in prefix {
                limits.accept(&[byte]).unwrap();
            }
            assert_eq!(limits.line_bytes, 3);
            limits.accept(&vec![b'x'; MAX_MESSAGE - 3]).unwrap();
            assert_eq!(limits.line_bytes, MAX_MESSAGE);
            assert!(limits.accept(b"x").is_err());
        }
        let mut limits = SseLimits::default();
        for byte in [0xef, 0xbb, 0xbf] {
            limits.accept(&[byte]).unwrap();
        }
        assert_eq!(limits.line_bytes, 0);
        limits.accept(b"data:x\r").unwrap();
        assert_eq!(limits.data_bytes, 6);
        limits.accept(b"\n\r\n").unwrap();
        assert_eq!(limits.line_bytes, 0);
        assert_eq!(limits.data_bytes, 0);
    }

    #[tokio::test]
    async fn utf8_replacement_dispatches_before_eof_and_keeps_chunked_scalars() {
        let source = futures_util::stream::iter([Ok::<_, String>(Bytes::from_static(
            b"data:bad \xff\n\ndata:next\n\n",
        ))])
        .chain(futures_util::stream::pending());
        let mut events = sse_utf8(source).eventsource().boxed();
        let first = tokio::time::timeout(Duration::from_millis(500), events.next())
            .await
            .unwrap()
            .unwrap()
            .unwrap();
        assert_eq!(first.data, "bad \u{fffd}");
        assert_eq!(events.next().await.unwrap().unwrap().data, "next");

        let raw = "\u{feff}data:ไทย\r\n\r\n".as_bytes();
        let chunks = raw
            .iter()
            .map(|byte| Ok::<_, String>(Bytes::copy_from_slice(&[*byte])))
            .collect::<Vec<_>>();
        let decoded = sse_utf8(futures_util::stream::iter(chunks))
            .eventsource()
            .collect::<Vec<_>>()
            .await;
        assert_eq!(decoded.len(), 1);
        assert_eq!(decoded[0].as_ref().unwrap().data, "ไทย");

        let mut decoder = SseUtf8::default();
        assert_eq!(
            decoder.decode(Bytes::from_static(&[0xe2, 0x82]), false),
            Bytes::new()
        );
        assert_eq!(decoder.pending.len(), 2);
        assert_eq!(
            decoder.decode(Bytes::from_static(b"A"), false).as_ref(),
            "\u{fffd}A".as_bytes()
        );
        assert!(decoder.pending.is_empty());
        decoder.decode(Bytes::from_static(&[0xf0, 0x9f, 0x92]), false);
        assert_eq!(
            decoder.decode(Bytes::new(), true).as_ref(),
            "\u{fffd}".as_bytes()
        );
    }

    #[tokio::test]
    async fn utf8_replacement_expansion_cannot_exceed_event_limit() {
        let mut raw = b"data:".to_vec();
        raw.extend(vec![0xff; MAX_MESSAGE / 3 + 1]);
        raw.extend_from_slice(b"\n\n");
        SseLimits::default().accept(&raw).unwrap();
        let mut events = sse_utf8(futures_util::stream::iter([Ok::<_, String>(Bytes::from(
            raw,
        ))]))
        .eventsource()
        .boxed();
        let event = events.next().await.unwrap().unwrap();
        assert!(event.data.len() > MAX_MESSAGE);
        assert!(validate_sse_text(&event.event, &event.id, &event.data).is_err());
    }

    #[tokio::test]
    async fn line_endings_dispatch_cr_before_eof_and_preserve_split_crlf() {
        let raw = Bytes::from_static(b"data:one\r\r");
        let source = futures_util::stream::iter([Ok::<_, String>(raw.clone())])
            .chain(futures_util::stream::pending());
        let mut events = sse_text(source).eventsource().boxed();
        let first = tokio::time::timeout(Duration::from_millis(500), events.next())
            .await
            .expect("Complete CR-only event must dispatch without waiting for EOF")
            .unwrap()
            .unwrap();
        assert_eq!(first.data, "one");
        assert_eq!(raw.as_ref(), b"data:one\r\r");

        let chunks: Vec<Result<Bytes, String>> = [
            &b"id:42\rretry: +100\rretry: -1\rretry: 1.5\r"[..],
            &b"\ndata:one\r"[..],
            &b"\ndata:two\r"[..],
            &b"\n\r"[..],
            &b"\nretry: 00050\nretry: +100\nretry: \nretry: 1e2\nretry:  100\nretry: \t100\nretry: 18446744073709551616\ndata:valid\n\n"[..],
        ]
        .into_iter()
        .map(|chunk| Ok(Bytes::copy_from_slice(chunk)))
        .collect();
        let parsed = sse_text(futures_util::stream::iter(chunks))
            .eventsource()
            .collect::<Vec<_>>()
            .await;
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].as_ref().unwrap().id, "42");
        assert_eq!(parsed[0].as_ref().unwrap().data, "one\ntwo");
        assert_eq!(parsed[0].as_ref().unwrap().retry, None);
        assert_eq!(parsed[1].as_ref().unwrap().data, "valid");
        assert_eq!(
            parsed[1].as_ref().unwrap().retry,
            Some(Duration::from_millis(50))
        );
        let incomplete = sse_text(futures_util::stream::iter([Ok::<_, String>(
            Bytes::from_static(b"data:unfinished"),
        )]))
        .eventsource()
        .collect::<Vec<_>>()
        .await;
        assert!(incomplete.is_empty());
    }

    #[tokio::test]
    async fn size_failure_keeps_prior_complete_event_independent_of_chunking() {
        let first = Bytes::from_static(b"data:first\n\n");
        let oversized = Bytes::from(vec![b':'; MAX_MESSAGE + 1]);
        let mut combined = first.to_vec();
        combined.extend_from_slice(&oversized);
        for chunks in [
            vec![Bytes::from(combined)],
            vec![first.clone(), oversized.clone()],
        ] {
            let mut limits = SseLimits::default();
            let parts = chunks.into_iter().flat_map(|chunk| {
                let accepted = limits.accept(&chunk);
                sse_checked_parts(chunk, limits.valid_prefix, accepted)
            });
            let events = sse_text(futures_util::stream::iter(parts))
                .eventsource()
                .collect::<Vec<_>>()
                .await;
            assert_eq!(events.len(), 2);
            assert_eq!(events[0].as_ref().unwrap().data, "first");
            assert!(events[1]
                .as_ref()
                .unwrap_err()
                .to_string()
                .contains("20 MiB"));
        }
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
    SseRaw {
        data: String,
        size: usize,
        chunk: u64,
        offset: usize,
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
    crate::http::timeouts::validate(request.request_timeout_ms, request.connect_timeout_ms)?;
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
        can_drain: true,
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
    };
    let result = crate::http::timeouts::run(
        request
            .request_timeout_ms
            .and_then(crate::http::timeouts::duration),
        result,
        "Stream request timed out",
    )
    .await;
    streams
        .sockets
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&request.id);
    let flushed = flush_cookies(jar.as_ref(), &on_event).await;
    // Drain earlier channel events before resolving the invocation/history snapshot.
    // A failed delivery has already exhausted its ACK deadline or lost its view.
    // Waiting for another ACK on Finished would double the timeout and retain
    // run/ACK registrations unnecessarily. Normal/error/cancel paths whose
    // delivery is still usable keep the ordering barrier.
    let delivered = if delivery.can_drain {
        delivery.message(StreamEvent::Finished).await
    } else {
        Ok(())
    };
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
        request.has_identity(),
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
        response = crate::http::timeouts::run(
            if request.connect_timeout_ms.is_some() { None } else { crate::http::timeouts::selected(None, request.timeout_ms) },
            handshake, "WebSocket handshake timed out") => response?,
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
                let closed = tokio::time::timeout(Duration::from_secs(2), socket.close(CloseCode::Normal, Some("Disconnected by client")))
                    .await.map_err(|_| "WebSocket disconnect timed out".to_string())?;
                websocket_close_result(closed, "disconnect")?;
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
                        // Tungstenite queues automatic Pong on read; flush it
                        // before UI delivery can block waiting for its ACK.
                        if matches!(message, Message::Ping(_)) {
                            tokio::select! {
                                result = tokio::time::timeout(Duration::from_secs(2), socket.flush()) => {
                                    result.map_err(|_| "WebSocket pong flush timed out")?
                                        .map_err(|error| format!("WebSocket pong flush failed: {error}"))?;
                                }
                                _ = delivery.cancelled.changed() => return Err("WebSocket pong flush cancelled".into()),
                            }
                        }
                        let closed = matches!(message, Message::Close { .. });
                        if closed { emit(&channel, message_event(&message, "received"))?; } else { delivery.message(message_event(&message, "received")).await?; }
                        if closed {
                            let reply = tokio::time::timeout(Duration::from_secs(2), socket.flush())
                                .await
                                .map_err(|_| "WebSocket close reply timed out".to_string())?;
                            websocket_close_result(reply, "close reply")?;
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

// ConnectionClosed confirms an already-completed connection; other write errors
// must not become a successful Close reply or locally requested disconnect.
fn websocket_close_result(
    result: Result<(), reqwest_websocket::Error>,
    operation: &str,
) -> Result<(), String> {
    match result {
        Ok(())
        | Err(reqwest_websocket::Error::Tungstenite(tungstenite::Error::ConnectionClosed)) => {
            Ok(())
        }
        Err(error) => Err(format!("WebSocket {operation} failed: {error:?}")),
    }
}

#[cfg(test)]
mod websocket_close_tests {
    use super::websocket_close_result;

    #[test]
    fn close_reply_distinguishes_completion_from_transport_failure() {
        for operation in ["close reply", "disconnect"] {
            let websocket_close_reply = |result| websocket_close_result(result, operation);
            assert!(websocket_close_reply(Ok(())).is_ok());
            assert!(
                websocket_close_reply(Err(reqwest_websocket::Error::Tungstenite(
                    tungstenite::Error::ConnectionClosed,
                )))
                .is_ok()
            );
            let error = websocket_close_reply(Err(reqwest_websocket::Error::Tungstenite(
                tungstenite::Error::Io(std::io::Error::new(
                    std::io::ErrorKind::ConnectionReset,
                    "owned reset",
                )),
            )))
            .unwrap_err();
            assert!(
                error.contains(&format!("{operation} failed")) && error.contains("owned reset")
            );
            assert!(
                websocket_close_reply(Err(reqwest_websocket::Error::Tungstenite(
                    tungstenite::Error::AlreadyClosed,
                )))
                .is_err()
            );
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
        request.has_identity(),
        |outgoing| async { client.execute(outgoing).await.map_err(|e| e.to_string()) },
    );
    let mut response = tokio::select! {
        response = crate::http::timeouts::run(
            if request.connect_timeout_ms.is_some() { None } else { crate::http::timeouts::selected(None, request.timeout_ms) },
            handshake, "SSE handshake timed out") => response?,
        _ = delivery.cancelled.changed() => return emit(&channel, StreamEvent::Closed { code: None, reason: "Connection cancelled".into() }),
    };
    crate::http::compression::response(&mut response, request.decode_response)?;
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
    let mut cancelled = delivery.cancelled.clone();
    let shared_delivery = Arc::new(tokio::sync::Mutex::new(delivery));
    let raw_delivery = shared_delivery.clone();
    let mut limits = SseLimits::default();
    let mut chunk_number = 0_u64;
    // `then` holds at most the current decoded transport chunk. Each fragment
    // uses the same acknowledged delivery sequence as parsed events; no queue
    // or second reader can race parsing or terminal invocation completion.
    let bytes = response
        .bytes_stream()
        .then(move |chunk| {
            let raw_delivery = raw_delivery.clone();
            let chunk = chunk.map_err(|e| e.to_string());
            if chunk.as_ref().is_ok_and(|bytes| !bytes.is_empty()) {
                chunk_number += 1;
            }
            let number = chunk_number;
            let (valid_prefix, accepted) = match chunk.as_ref() {
                Ok(bytes) => {
                    let accepted = limits.accept(bytes);
                    (limits.valid_prefix, accepted)
                }
                Err(error) => (0, Err(error.clone())),
            };
            async move {
                let chunk = chunk?;
                for (index, fragment) in chunk.chunks(64 * 1024).enumerate() {
                    raw_delivery
                        .lock()
                        .await
                        .message(StreamEvent::SseRaw {
                            data: STANDARD.encode(fragment),
                            size: fragment.len(),
                            chunk: number,
                            offset: index * 64 * 1024,
                        })
                        .await?;
                }
                // Raw capture stays complete; parse every accepted byte before
                // reporting the later size error from this transport chunk.
                Ok::<_, String>(sse_checked_parts(chunk, valid_prefix, accepted))
            }
        })
        .flat_map(|parts| {
            futures_util::stream::iter(match parts {
                Ok(parts) => parts,
                Err(error) => vec![Err(error)],
            })
        })
        .boxed();
    let mut events = sse_text(bytes).eventsource().boxed();
    loop {
        tokio::select! {
            _ = cancelled.changed() => return emit(&channel, StreamEvent::Closed { code: None, reason: "Disconnected by client".into() }),
            event = events.next() => match event {
                Some(Ok(event)) => {
                    validate_sse_text(&event.event, &event.id, &event.data)?;
                    shared_delivery.lock().await.message(StreamEvent::Sse { event: event.event, id: event.id, data: event.data, retry_ms: event.retry.map(|r| r.as_millis()) }).await?;
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
