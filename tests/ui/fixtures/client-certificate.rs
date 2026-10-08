//! Owned loopback UI fixture; validates client certificates and records actual peer identity.
use rustls::{
    pki_types::{CertificateDer, PrivateKeyDer},
    RootCertStore, ServerConfig, ServerConnection, StreamOwned,
};
use sha2::{Digest, Sha256};
use std::{
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    sync::Arc,
    time::Duration,
};

fn handle(
    socket: TcpStream,
    config: Arc<ServerConfig>,
    role: &str,
    redirect: &str,
) -> Result<(), String> {
    socket
        .set_read_timeout(Some(Duration::from_secs(5)))
        .map_err(|e| e.to_string())?;
    socket
        .set_write_timeout(Some(Duration::from_secs(5)))
        .map_err(|e| e.to_string())?;
    let mut stream = StreamOwned::new(
        ServerConnection::new(config).map_err(|e| e.to_string())?,
        socket,
    );
    let mut header = Vec::new();
    while !header.ends_with(b"\r\n\r\n") {
        if header.len() >= 65536 {
            return Err("Header limit".into());
        }
        let mut byte = [0];
        stream.read_exact(&mut byte).map_err(|e| e.to_string())?;
        header.push(byte[0]);
    }
    let header = String::from_utf8(header).map_err(|e| e.to_string())?;
    let first: Vec<_> = header
        .lines()
        .next()
        .ok_or("Missing request")?
        .split_whitespace()
        .collect();
    if first.len() != 3 {
        return Err("Invalid request".into());
    }
    let length = header
        .lines()
        .filter_map(|line| line.split_once(':'))
        .find(|(name, _)| name.eq_ignore_ascii_case("content-length"))
        .map(|(_, value)| value.trim().parse::<usize>())
        .transpose()
        .map_err(|e| e.to_string())?
        .unwrap_or(0);
    if length > 65536 {
        return Err("Body limit".into());
    }
    let mut body = vec![0; length];
    stream.read_exact(&mut body).map_err(|e| e.to_string())?;
    if stream.conn.is_handshaking() {
        return Err("Handshake incomplete".into());
    }
    let peer = stream
        .conn
        .peer_certificates()
        .and_then(|chain| chain.first())
        .ok_or("Client certificate missing")?;
    let (_, certificate) =
        x509_parser::parse_x509_certificate(peer.as_ref()).map_err(|e| e.to_string())?;
    let cn = certificate
        .subject()
        .iter_common_name()
        .next()
        .ok_or("Client CN missing")?
        .as_str()
        .map_err(|e| e.to_string())?;
    let fingerprint = Sha256::digest(peer.as_ref())
        .iter()
        .map(|byte| format!("{byte:02X}"))
        .collect::<Vec<_>>()
        .join(":");
    println!(
        "{}",
        serde_json::json!({"event":"request","role":role,"url":first[1],"method":first[0],
        "body":String::from_utf8(body).map_err(|e| e.to_string())?,"authorized":true,"cn":cn,"fingerprint":fingerprint})
    );
    if first[1] == "/sse-live" {
        stream
            .sock
            .set_read_timeout(Some(Duration::from_secs(15)))
            .map_err(|e| e.to_string())?;
        stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\nConnection: keep-alive\r\n\r\n").map_err(|e|e.to_string())?;
        let body = "\u{feff}: owned heartbeat\r\nid: owned-live-1\r\nevent: authenticated\r\nretry: 1234\r\ndata: owned first\r\ndata: live สวัสดี\r\n\r\n: ignored\nid: owned-live-2\nevent: update\ndata: owned second\n\nid: unfinished\nevent: incomplete\ndata: never dispatched";
        let mut fragments = 0;
        let mut utf8_split = false;
        for chunk in body.as_bytes().chunks(7) {
            fragments += 1;
            utf8_split |= chunk[0] & 0xc0 == 0x80;
            stream
                .write_all(format!("{:X}\r\n", chunk.len()).as_bytes())
                .map_err(|e| e.to_string())?;
            stream.write_all(chunk).map_err(|e| e.to_string())?;
            stream.write_all(b"\r\n").map_err(|e| e.to_string())?;
            stream.flush().map_err(|e| e.to_string())?;
        }
        println!(
            "{}",
            serde_json::json!({"event":"sse-written","role":role,"fragments":fragments,"bytes":body.len(),"utf8Split":utf8_split})
        );
        let mut byte = [0];
        match stream.read(&mut byte) {
            Ok(0) => println!(
                "{}",
                serde_json::json!({"event":"sse-close","role":role,"kind":"eof"})
            ),
            Err(error)
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::UnexpectedEof
                        | std::io::ErrorKind::ConnectionReset
                        | std::io::ErrorKind::ConnectionAborted
                        | std::io::ErrorKind::BrokenPipe
                ) =>
            {
                println!(
                    "{}",
                    serde_json::json!({"event":"sse-close","role":role,"kind":format!("{:?}",error.kind()),"detail":error.to_string()})
                )
            }
            Err(error) => return Err(error.to_string()),
            Ok(_) => return Err("Unexpected client data on owned SSE stream".into()),
        }
        return Ok(());
    }
    if matches!(first[1], "/ws" | "/ws-live") {
        let key = header
            .lines()
            .filter_map(|line| line.split_once(':'))
            .find(|(name, _)| name.eq_ignore_ascii_case("sec-websocket-key"))
            .map(|(_, value)| value.trim())
            .ok_or("Missing WebSocket key")?;
        let accept = tungstenite::handshake::derive_accept_key(key.as_bytes());
        stream.write_all(format!("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {accept}\r\n\r\n").as_bytes())
            .map_err(|e| e.to_string())?;
        stream.flush().map_err(|e| e.to_string())?;
        let mut socket = tungstenite::WebSocket::from_raw_socket(
            stream,
            tungstenite::protocol::Role::Server,
            None,
        );
        socket
            .send(tungstenite::Message::Text(
                "owned mutual TLS WSS message".into(),
            ))
            .map_err(|e| e.to_string())?;
        if first[1] == "/ws-live" {
            socket
                .get_mut()
                .sock
                .set_read_timeout(Some(Duration::from_secs(15)))
                .map_err(|e| e.to_string())?;
            loop {
                let message = socket.read().map_err(|e| e.to_string())?;
                let (format, bytes) = match &message {
                    tungstenite::Message::Text(text) => ("text", text.as_bytes()),
                    tungstenite::Message::Binary(bytes) => ("binary", bytes.as_ref()),
                    tungstenite::Message::Ping(bytes) => ("ping", bytes.as_ref()),
                    tungstenite::Message::Close(frame) => {
                        println!(
                            "{}",
                            serde_json::json!({"event":"socket-close","role":role,
                            "code":frame.as_ref().map(|f|u16::from(f.code)),
                            "reason":frame.as_ref().map(|f|f.reason.to_string())})
                        );
                        match socket.flush() {
                            Ok(()) | Err(tungstenite::Error::ConnectionClosed) => return Ok(()),
                            Err(error) => return Err(error.to_string()),
                        }
                    }
                    _ => continue,
                };
                println!(
                    "{}",
                    serde_json::json!({"event":"socket-message","role":role,
                    "format":format,"bytes":bytes})
                );
                if format == "ping" {
                    socket.flush().map_err(|e| e.to_string())?;
                } else {
                    socket.send(message).map_err(|e| e.to_string())?;
                }
            }
        }
        socket
            .close(Some(tungstenite::protocol::CloseFrame {
                code: tungstenite::protocol::frame::coding::CloseCode::Normal,
                reason: "Owned WSS complete".into(),
            }))
            .map_err(|e| e.to_string())?;
        socket.flush().map_err(|e| e.to_string())?;
        loop {
            match socket.read() {
                Err(tungstenite::Error::ConnectionClosed) => return Ok(()),
                Err(error) => return Err(error.to_string()),
                Ok(_) => {}
            }
        }
    }
    let response = if first[1] == "/redirect" {
        format!("HTTP/1.1 302 Found\r\nLocation: {redirect}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
    } else if first[1] == "/sse" {
        let body =
            "id: owned-mtls-event\nevent: authenticated\ndata: owned mutual TLS SSE event\n\n";
        format!("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len())
    } else {
        let body = "owned mTLS response";
        format!("HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len())
    };
    stream
        .write_all(response.as_bytes())
        .map_err(|e| e.to_string())?;
    stream.flush().map_err(|e| e.to_string())
}

#[cfg(grpc_fixture)]
async fn grpc_connection(
    socket: tokio::net::TcpStream,
    config: Arc<ServerConfig>,
    alpha_only: bool,
) -> Result<(), String> {
    let stream = tokio_rustls::TlsAcceptor::from(config)
        .accept(socket)
        .await
        .map_err(|e| e.to_string())?;
    let session = stream.get_ref().1;
    if session.alpn_protocol() != Some(b"h2") {
        return Err("HTTP/2 ALPN missing".into());
    }
    let peer = session
        .peer_certificates()
        .and_then(|chain| chain.first())
        .ok_or("Client certificate missing")?;
    let (_, certificate) =
        x509_parser::parse_x509_certificate(peer.as_ref()).map_err(|e| e.to_string())?;
    let cn = certificate
        .subject()
        .iter_common_name()
        .next()
        .ok_or("Client CN missing")?
        .as_str()
        .map_err(|e| e.to_string())?
        .to_owned();
    let fingerprint = Sha256::digest(peer.as_ref())
        .iter()
        .map(|byte| format!("{byte:02X}"))
        .collect::<Vec<_>>()
        .join(":");
    let mut connection = h2::server::handshake(stream)
        .await
        .map_err(|e| e.to_string())?;
    while let Some(request) = connection.accept().await {
        let (request, respond) = request.map_err(|e| e.to_string())?;
        let cn = cn.clone();
        let fingerprint = fingerprint.clone();
        tokio::spawn(async move {
            if let Err(error) = grpc_request(request, respond, cn, fingerprint, alpha_only).await {
                println!(
                    "{}",
                    serde_json::json!({"event":"rejected","role":"grpc-stream","detail":error})
                );
            }
        });
    }
    Ok(())
}

#[cfg(grpc_fixture)]
fn grpc_frame(text: &[u8]) -> tungstenite::Bytes {
    let mut frame = vec![0];
    frame.extend_from_slice(&((text.len() + 2) as u32).to_be_bytes());
    frame.extend_from_slice(&[10, text.len() as u8]);
    frame.extend_from_slice(text);
    frame.into()
}

#[cfg(grpc_fixture)]
async fn grpc_request(
    request: tungstenite::http::Request<h2::RecvStream>,
    mut respond: h2::server::SendResponse<tungstenite::Bytes>,
    cn: String,
    fingerprint: String,
    alpha_only: bool,
) -> Result<(), String> {
    let path = request.uri().path().to_owned();
    let method = request.method().to_string();
    let mut incoming = request.into_body();
    let reflection = path.starts_with("/grpc.reflection.");
    let duplex = path.ends_with("/Chat");
    let collect = path.ends_with("/Collect");
    let hold = path.ends_with("/Hold");
    let watch = path.ends_with("/Watch");
    if alpha_only && path.starts_with("/grpc.reflection.v1.") {
        let response = tungstenite::http::Response::builder()
            .status(200)
            .header("content-type", "application/grpc")
            .header("grpc-status", "12")
            .header("grpc-message", "Owned fixture supports v1alpha only")
            .body(())
            .map_err(|e| e.to_string())?;
        respond
            .send_response(response, true)
            .map_err(|e| e.to_string())?;
        println!(
            "{}",
            serde_json::json!({"event":"grpc-reflection-unimplemented","url":path,"authorized":true,"cn":cn,"fingerprint":fingerprint,"alpn":"h2"})
        );
        return Ok(());
    }
    let response = tungstenite::http::Response::builder()
        .status(200)
        .header("content-type", "application/grpc")
        .header("owned-metadata", "authenticated")
        .body(())
        .map_err(|e| e.to_string())?;
    let mut send = respond
        .send_response(response, false)
        .map_err(|e| e.to_string())?;
    println!(
        "{}",
        serde_json::json!({"event":"grpc-open","url":path,"authorized":true,"cn":cn,"fingerprint":fingerprint,"alpn":"h2"})
    );
    let mut pending = Vec::new();
    let mut frames = 0;
    let mut total = 0;
    loop {
        match incoming.data().await {
            Some(Ok(chunk)) => {
                total += chunk.len();
                if total > 65536 {
                    return Err("gRPC fixture body limit".into());
                }
                pending.extend_from_slice(&chunk);
                incoming
                    .flow_control()
                    .release_capacity(chunk.len())
                    .map_err(|e| e.to_string())?;
            }
            Some(Err(error)) => {
                println!(
                    "{}",
                    serde_json::json!({"event":"grpc-cancelled","url":path,"frames":frames,"reason":error.reason().map(|r|format!("{r:?}")),"error":error.to_string()})
                );
                return Ok(());
            }
            None => {
                if !pending.is_empty() {
                    return Err("Incomplete gRPC fixture frame".into());
                }
                println!(
                    "{}",
                    serde_json::json!({"event":"grpc-end","url":path,"frames":frames})
                );
                break;
            }
        }
        while pending.len() >= 5 {
            let length = u32::from_be_bytes(pending[1..5].try_into().unwrap()) as usize;
            if length > 65531 || pending[0] != 0 || frames >= 128 {
                return Err("Invalid gRPC fixture frame".into());
            }
            if pending.len() < length + 5 {
                break;
            }
            let frame: Vec<_> = pending.drain(..length + 5).collect();
            frames += 1;
            if frames == 1 {
                println!(
                    "{}",
                    serde_json::json!({"event":"grpc-request","url":path,"method":method,"bodyBytes":frame,"authorized":true,"cn":cn,"fingerprint":fingerprint,"alpn":"h2"})
                );
            }
            println!(
                "{}",
                serde_json::json!({"event":"grpc-message","url":path,"sequence":frames,"bytes":frame})
            );
            if reflection {
                let payload = grpc_reflection(&frame[5..], &path)?;
                let mut encoded = vec![0];
                encoded.extend_from_slice(&(payload.len() as u32).to_be_bytes());
                encoded.extend_from_slice(&payload);
                send.send_data(encoded.into(), false)
                    .map_err(|e| e.to_string())?;
            } else if duplex {
                send.send_data(frame.into(), false)
                    .map_err(|e| e.to_string())?;
            } else if !collect {
                if hold {
                    let reset = std::future::poll_fn(|cx| send.poll_reset(cx)).await;
                    println!(
                        "{}",
                        serde_json::json!({"event":"grpc-cancelled","url":path,"frames":frames,"reason":reset.as_ref().ok().map(|r|format!("{r:?}")),"error":reset.err().map(|e|e.to_string())})
                    );
                    return Ok(());
                }
                send.send_data(grpc_frame(b"owned mutual TLS gRPC response"), false)
                    .map_err(|e| e.to_string())?;
                if watch {
                    send.send_data(grpc_frame(b"owned mutual TLS gRPC second response"), false)
                        .map_err(|e| e.to_string())?;
                }
                grpc_trailers(&mut send)?;
                return Ok(());
            }
        }
    }
    if collect {
        send.send_data(
            grpc_frame(b"owned mutual TLS gRPC collected response"),
            false,
        )
        .map_err(|e| e.to_string())?;
    }
    grpc_trailers(&mut send)
}

#[cfg(grpc_fixture)]
fn grpc_trailers(send: &mut h2::SendStream<tungstenite::Bytes>) -> Result<(), String> {
    let mut trailers = tungstenite::http::HeaderMap::new();
    trailers.insert(
        "grpc-status",
        tungstenite::http::HeaderValue::from_static("0"),
    );
    trailers.insert(
        "owned-trailer",
        tungstenite::http::HeaderValue::from_static("complete"),
    );
    send.send_trailers(trailers).map_err(|e| e.to_string())
}

#[cfg(grpc_fixture)]
fn grpc_reflection(bytes: &[u8], path: &str) -> Result<Vec<u8>, String> {
    use prost::Message;
    use tonic_reflection::pb::v1::{
        server_reflection_request::MessageRequest, server_reflection_response::MessageResponse,
        FileDescriptorResponse, ListServiceResponse, ServerReflectionRequest,
        ServerReflectionResponse, ServiceResponse,
    };
    let query = ServerReflectionRequest::decode(bytes).map_err(|e| e.to_string())?;
    let (kind, value, response) = match query.message_request.as_ref() {
        Some(MessageRequest::ListServices(value)) => (
            "list-services",
            value.clone(),
            MessageResponse::ListServicesResponse(ListServiceResponse {
                service: vec![ServiceResponse {
                    name: "owned.Sample".into(),
                }],
            }),
        ),
        Some(MessageRequest::FileContainingSymbol(value)) if value == "owned.Sample" => (
            "file-containing-symbol",
            value.clone(),
            MessageResponse::FileDescriptorResponse(FileDescriptorResponse {
                file_descriptor_proto: vec![grpc_descriptor()],
            }),
        ),
        _ => return Err("Unexpected owned reflection query".into()),
    };
    println!(
        "{}",
        serde_json::json!({"event":"grpc-reflection","url":path,"kind":kind,"value":value})
    );
    Ok(ServerReflectionResponse {
        valid_host: String::new(),
        original_request: Some(query),
        message_response: Some(response),
    }
    .encode_to_vec())
}

#[cfg(grpc_fixture)]
fn grpc_descriptor() -> Vec<u8> {
    use prost::Message;
    use prost_types::{
        DescriptorProto, FieldDescriptorProto, FileDescriptorProto, MethodDescriptorProto,
        ServiceDescriptorProto,
    };
    FileDescriptorProto {
        name: Some("owned-reflection.proto".into()),
        package: Some("owned".into()),
        syntax: Some("proto3".into()),
        message_type: vec![DescriptorProto {
            name: Some("Input".into()),
            field: vec![FieldDescriptorProto {
                name: Some("name".into()),
                number: Some(1),
                label: Some(1),
                r#type: Some(9),
                ..Default::default()
            }],
            ..Default::default()
        }],
        service: vec![ServiceDescriptorProto {
            name: Some("Sample".into()),
            method: [
                ("Echo", false, false),
                ("Watch", false, true),
                ("Collect", true, false),
                ("Chat", true, true),
                ("Hold", false, true),
            ]
            .into_iter()
            .map(|(name, client, server)| MethodDescriptorProto {
                name: Some(name.into()),
                input_type: Some(".owned.Input".into()),
                output_type: Some(".owned.Input".into()),
                client_streaming: Some(client),
                server_streaming: Some(server),
                ..Default::default()
            })
            .collect(),
            ..Default::default()
        }],
        ..Default::default()
    }
    .encode_to_vec()
}

#[cfg(grpc_fixture)]
fn grpc_listener(config: Arc<ServerConfig>, alpha_only: bool) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("https://{}", listener.local_addr().unwrap());
    listener.set_nonblocking(true).unwrap();
    let mut config = (*config).clone();
    config.alpn_protocols = vec![b"h2".to_vec()];
    let config = Arc::new(config);
    std::thread::spawn(move || {
        let runtime = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .unwrap();
        runtime.block_on(async move {
            let listener = tokio::net::TcpListener::from_std(listener).unwrap();
            loop {
                let (socket, _) = listener.accept().await.unwrap();
                println!("{}", serde_json::json!({"event":"grpc-connection"}));
                let config = config.clone();
                tokio::spawn(async move {
                    let result = tokio::time::timeout(
                        Duration::from_secs(15),
                        grpc_connection(socket, config, alpha_only),
                    )
                    .await;
                    if let Err(error) =
                        result.unwrap_or_else(|_| Err("gRPC fixture timeout".into()))
                    {
                        println!(
                            "{}",
                            serde_json::json!({"event":"rejected","role":"grpc","detail":error})
                        );
                    }
                });
            }
        });
    });
    url
}

fn main() {
    rustls::crypto::ring::default_provider()
        .install_default()
        .unwrap();
    let args: Vec<_> = std::env::args().collect();
    let mut roots = RootCertStore::empty();
    roots
        .add(CertificateDer::from(std::fs::read(&args[3]).unwrap()))
        .unwrap();
    let verifier = rustls::server::WebPkiClientVerifier::builder(Arc::new(roots))
        .build()
        .unwrap();
    let config = Arc::new(
        ServerConfig::builder()
            .with_client_cert_verifier(verifier)
            .with_single_cert(
                vec![CertificateDer::from(std::fs::read(&args[1]).unwrap())],
                PrivateKeyDer::Pkcs8(std::fs::read(&args[2]).unwrap().into()),
            )
            .unwrap(),
    );
    let primary = TcpListener::bind("127.0.0.1:0").unwrap();
    let sink = TcpListener::bind("127.0.0.1:0").unwrap();
    let primary_url = format!("https://{}", primary.local_addr().unwrap());
    let sink_url = format!("https://{}", sink.local_addr().unwrap());
    let redirect = format!("{sink_url}/destination");
    #[cfg(grpc_fixture)]
    let grpc_url = grpc_listener(config.clone(), false);
    #[cfg(grpc_fixture)]
    let grpc_alpha_url = grpc_listener(config.clone(), true);
    #[cfg(not(grpc_fixture))]
    let grpc_alpha_url = "";
    #[cfg(not(grpc_fixture))]
    let grpc_url = "";
    for (role, listener) in [("primary", primary), ("sink", sink)] {
        let config = config.clone();
        let redirect = redirect.clone();
        std::thread::spawn(move || {
            for socket in listener.incoming() {
                let socket = socket.unwrap();
                println!("{}", serde_json::json!({"event":"connection","role":role}));
                if let Err(error) = handle(socket, config.clone(), role, &redirect) {
                    println!(
                        "{}",
                        serde_json::json!({"event":"rejected","role":role,"detail":error})
                    );
                }
            }
        });
    }
    println!(
        "{}",
        serde_json::json!({"event":"ready","primary":primary_url,"sink":sink_url,"grpc":grpc_url,"grpcAlpha":grpc_alpha_url})
    );
    let mut stop = String::new();
    let _ = std::io::stdin().read_line(&mut stop);
}
