//! Compression adapter retaining the existing message/delivery interface.
use futures_util::{future::poll_fn, SinkExt, StreamExt};
use reqwest_websocket::{CloseCode, Error, Message, UpgradeResponse};
use yawc::{
    frame::{Frame, OpCode},
    WebSocketError,
};

pub(super) const OFFER: &str = "permessage-deflate; client_max_window_bits";
pub(super) enum Socket {
    Plain(reqwest_websocket::WebSocket),
    Deflate(Box<yawc::WebSocket<reqwest::Upgraded>>),
}
fn failure(error: impl std::fmt::Display) -> Error {
    tungstenite::Error::Io(std::io::Error::other(error.to_string())).into()
}
fn transport(error: WebSocketError) -> Error {
    match error {
        WebSocketError::ConnectionClosed => tungstenite::Error::ConnectionClosed.into(),
        error => failure(error),
    }
}

// Validate before the decoder's permissive extension parser sees the header.
fn negotiated(response: &UpgradeResponse) -> Result<Option<String>, String> {
    let mut headers = response
        .headers()
        .get_all(reqwest::header::SEC_WEBSOCKET_EXTENSIONS)
        .iter();
    let Some(value) = headers.next() else {
        return Ok(None);
    };
    if headers.next().is_some() {
        return Err("Repeated WebSocket extension response".into());
    }
    let value = value
        .to_str()
        .map_err(|_| "Invalid WebSocket extension response")?;
    let mut parts = value.split(';').map(|part| part.trim_matches([' ', '\t']));
    if parts.next() != Some("permessage-deflate") {
        return Err("Unrequested WebSocket extension".into());
    }
    let mut seen = std::collections::HashSet::new();
    let mut canonical = String::from("permessage-deflate");
    for part in parts {
        let (name, value) = part.split_once('=').map_or((part, None), |(name, value)| {
            (
                name.trim_matches([' ', '\t']),
                Some(value.trim_matches([' ', '\t'])),
            )
        });
        if !seen.insert(name) {
            return Err("Duplicate WebSocket deflate parameter".into());
        }
        canonical.push_str("; ");
        canonical.push_str(name);
        match name {
            "server_no_context_takeover" | "client_no_context_takeover" if value.is_none() => {}
            "server_max_window_bits" | "client_max_window_bits" => {
                let value = value.ok_or("Missing WebSocket deflate window size")?;
                let value = value
                    .strip_prefix('"')
                    .and_then(|value| value.strip_suffix('"'))
                    .unwrap_or(value);
                if !["8", "9", "10", "11", "12", "13", "14", "15"].contains(&value) {
                    return Err("Invalid WebSocket deflate window size".into());
                }
                canonical.push('=');
                canonical.push_str(value);
            }
            _ => return Err("Invalid WebSocket deflate parameter".into()),
        }
    }
    Ok(Some(canonical))
}
impl Socket {
    pub(super) async fn open(response: UpgradeResponse, limit: usize) -> Result<Self, String> {
        let Some(extension) = negotiated(&response)? else {
            return response
                .into_websocket()
                .await
                .map(Self::Plain)
                .map_err(|error| format!("WebSocket upgrade failed: {error:?}"));
        };
        let (stream, _) = response
            .into_upgraded()
            .await
            .map_err(|error| format!("WebSocket upgrade failed: {error:?}"))?;
        let options = yawc::Options::default()
            .with_limits(limit, limit)
            .with_utf8()
            .with_balanced_compression();
        yawc::WebSocket::from_stream_with_extensions(
            stream,
            yawc::Role::Client,
            Some(&extension),
            options,
        )
        .map(|socket| Self::Deflate(Box::new(socket)))
        .map_err(|error| error.to_string())
    }
    pub(super) async fn next(&mut self) -> Option<Result<Message, Error>> {
        match self {
            Self::Plain(socket) => socket.next().await,
            Self::Deflate(socket) => Some(match poll_fn(|cx| socket.poll_next_frame(cx)).await {
                Ok(frame) => {
                    let (opcode, bytes) = (frame.opcode(), frame.into_payload());
                    match opcode {
                        OpCode::Text => String::from_utf8(bytes.to_vec())
                            .map(Message::Text)
                            .map_err(failure),
                        OpCode::Binary => Ok(Message::Binary(bytes)),
                        OpCode::Ping => Ok(Message::Ping(bytes)),
                        OpCode::Pong => Ok(Message::Pong(bytes)),
                        OpCode::Close => {
                            let (code, reason) = if bytes.is_empty() {
                                (CloseCode::Status, String::new())
                            } else if bytes.len() >= 2 {
                                match String::from_utf8(bytes[2..].to_vec()) {
                                    Ok(reason) => {
                                        (u16::from_be_bytes([bytes[0], bytes[1]]).into(), reason)
                                    }
                                    Err(error) => return Some(Err(failure(error))),
                                }
                            } else {
                                return Some(Err(failure("Invalid WebSocket close payload")));
                            };
                            Ok(Message::Close { code, reason })
                        }
                        _ => Err(failure("Unexpected WebSocket continuation")),
                    }
                }
                Err(error) => Err(transport(error)),
            }),
        }
    }
    pub(super) async fn send(&mut self, message: Message) -> Result<(), Error> {
        match self {
            Self::Plain(socket) => socket.send(message).await,
            Self::Deflate(socket) => {
                let frame = match message {
                    Message::Text(text) => Frame::text(text),
                    Message::Binary(bytes) => Frame::binary(bytes),
                    Message::Ping(bytes) => Frame::ping(bytes),
                    Message::Pong(bytes) => Frame::pong(bytes),
                    Message::Close { code, reason } => {
                        Frame::close(u16::from(code).into(), reason.as_bytes())
                    }
                };
                socket.send(frame).await.map_err(transport)
            }
        }
    }
    pub(super) async fn flush(&mut self) -> Result<(), Error> {
        match self {
            Self::Plain(socket) => socket.flush().await,
            Self::Deflate(socket) => socket.flush().await.map_err(transport),
        }
    }
    pub(super) async fn close(
        mut self,
        code: CloseCode,
        reason: Option<&str>,
    ) -> Result<(), Error> {
        match self {
            Self::Plain(socket) => socket.close(code, reason).await,
            Self::Deflate(_) => {
                self.send(Message::Close {
                    code,
                    reason: reason.unwrap_or_default().into(),
                })
                .await
            }
        }
    }
}
