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

#[cfg(multiple_identities)]
#[derive(Debug)]
struct AlgorithmVerifier {
    inner: Arc<dyn rustls::server::danger::ClientCertVerifier>,
    scheme: rustls::SignatureScheme,
    role: &'static str,
    empty_hints: bool,
}

#[cfg(multiple_identities)]
impl rustls::server::danger::ClientCertVerifier for AlgorithmVerifier {
    fn root_hint_subjects(&self) -> &[rustls::DistinguishedName] {
        if self.empty_hints {
            &[]
        } else {
            self.inner.root_hint_subjects()
        }
    }
    fn verify_client_cert(
        &self,
        cert: &CertificateDer<'_>,
        chain: &[CertificateDer<'_>],
        now: rustls::pki_types::UnixTime,
    ) -> Result<rustls::server::danger::ClientCertVerified, rustls::Error> {
        self.inner.verify_client_cert(cert, chain, now)
    }
    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        signature: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        if signature.scheme != self.scheme {
            return Err(rustls::Error::General("Unexpected client signature".into()));
        }
        let result = self
            .inner
            .verify_tls12_signature(message, cert, signature)?;
        println!(
            "{}",
            serde_json::json!({"event":"client-signature","role":self.role,"scheme":format!("{:?}", signature.scheme),"version":"TLS12"})
        );
        Ok(result)
    }
    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        signature: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        if signature.scheme != self.scheme {
            return Err(rustls::Error::General("Unexpected client signature".into()));
        }
        let result = self
            .inner
            .verify_tls13_signature(message, cert, signature)?;
        println!(
            "{}",
            serde_json::json!({"event":"client-signature","role":self.role,"scheme":format!("{:?}", signature.scheme),"version":"TLS13"})
        );
        Ok(result)
    }
    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        vec![self.scheme]
    }
}

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
    let stream_redirect = ["sse", "ws"].into_iter().find_map(|protocol| {
        let prefix = format!("/{protocol}-redirect-");
        let mode = first[1].strip_prefix(&prefix)?;
        match mode {
            "same" => Some(format!("/{protocol}")),
            "chain" => Some(format!("/{protocol}-redirect-same")),
            "loop" => Some(format!("/{protocol}-redirect-loop")),
            "port" => Some(format!(
                "{}/{protocol}",
                redirect.trim_end_matches("/destination")
            )),
            "host" => Some(format!(
                "https://localhost:{}/{protocol}",
                stream.sock.local_addr().ok()?.port()
            )),
            "scheme" => Some(format!(
                "http://127.0.0.1:{}/{protocol}",
                stream.sock.local_addr().ok()?.port()
            )),
            _ => None,
        }
    });
    if let Some(location) = stream_redirect {
        stream.write_all(format!("HTTP/1.1 302 Found\r\nLocation: {location}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").as_bytes()).map_err(|e|e.to_string())?;
        return stream.flush().map_err(|e| e.to_string());
    }
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
    let endpoint = socket.local_addr().map_err(|e|e.to_string())?.ip().to_string();
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
    let goaway=Arc::new(std::sync::atomic::AtomicBool::new(false));
    let mut goaway_sent=false;
    let interval_probe=std::env::var("INSOMNIUM_GRPC_ORCA_INTERVAL").ok().as_deref()==Some("1");
    loop {
        let request=tokio::select! {
            request=connection.accept()=>request,
            _=tokio::time::sleep(Duration::from_millis(20)), if interval_probe&&!goaway_sent=>{
                if goaway.load(std::sync::atomic::Ordering::SeqCst){connection.graceful_shutdown();goaway_sent=true;println!("{}",serde_json::json!({"event":"grpc-orca-goaway"}));}
                continue;
            }
        };
        let Some(request)=request else {break};
        let (request, respond) = request.map_err(|e| e.to_string())?;
        let cn = cn.clone();
        let fingerprint = fingerprint.clone();
        let goaway=goaway.clone();
        let endpoint=endpoint.clone();
        tokio::spawn(async move {
            if let Err(error) = grpc_request(request, respond, cn, fingerprint, alpha_only, goaway, endpoint).await {
                println!(
                    "{}",
                    serde_json::json!({"event":"rejected","role":"grpc-stream","detail":error})
                );
            }
        });
    }
    if goaway_sent {std::future::poll_fn(|cx|connection.poll_closed(cx)).await.map_err(|e|e.to_string())?;}
    Ok(())
}

#[cfg(grpc_fixture)]
fn grpc_frame(text: &[u8]) -> tungstenite::Bytes {
    // grpc-js treats every flag other than 1 as uncompressed.
    let mut frame = vec![2];
    frame.extend_from_slice(&((text.len() + 2) as u32).to_be_bytes());
    frame.extend_from_slice(&[10, text.len() as u8]);
    frame.extend_from_slice(text);
    frame.into()
}

#[cfg(grpc_fixture)]
static REFUSED_HEADERS_RELEASED: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

#[cfg(grpc_fixture)]
async fn grpc_request(
    request: tungstenite::http::Request<h2::RecvStream>,
    mut respond: h2::server::SendResponse<tungstenite::Bytes>,
    cn: String,
    fingerprint: String,
    alpha_only: bool,
    goaway: Arc<std::sync::atomic::AtomicBool>,
    endpoint: String,
) -> Result<(), String> {
    let weight_mode=std::env::var("INSOMNIUM_GRPC_ORCA_WEIGHTS").unwrap_or_default();
    let weights_probe = !weight_mode.is_empty();
    let weight_recovery=matches!(weight_mode.as_str(),"blackout-exit"|"expiry-refresh");
    let path = request.uri().path().to_owned();
    let method = request.method().to_string();
    let previous_attempt = request
        .headers()
        .get("grpc-previous-rpc-attempts")
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);
    let orca_reference=request.headers().contains_key("x-owned-orca-reference");
    let accept_encoding = request.headers().get("grpc-accept-encoding").and_then(|v|v.to_str().ok()).unwrap_or("").to_owned();
    let wire_timeout = request.headers().get("grpc-timeout").and_then(|v|v.to_str().ok()).map(str::to_owned);
    let mut incoming = request.into_body();
    if path == "/xds.service.orca.v3.OpenRcaService/StreamCoreMetrics" {
        #[derive(prost::Message)]
        struct OrcaRequest { #[prost(message, optional, tag="1")] report_interval: Option<prost_types::Duration> }
        let mut body = Vec::new();
        while let Some(chunk) = incoming.data().await {
            let chunk = chunk.map_err(|e|e.to_string())?;
            body.extend_from_slice(&chunk);
            if body.len()>65536 { return Err("ORCA fixture request limit".into()); }
            incoming.flow_control().release_capacity(chunk.len()).map_err(|e|e.to_string())?;
        }
        if body.len()<5 || body[0]!=0 || u32::from_be_bytes(body[1..5].try_into().unwrap()) as usize != body.len()-5 { return Err("ORCA fixture framing".into()); }
        let decoded = <OrcaRequest as prost::Message>::decode(&body[5..]).map_err(|e|e.to_string())?;
        let interval = decoded.report_interval.ok_or("ORCA interval missing")?;
        static ORCA_ATTEMPTS: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
        let attempt=if orca_reference {0} else {ORCA_ATTEMPTS.fetch_add(1,std::sync::atomic::Ordering::SeqCst)+1};
        let mode=std::env::var("INSOMNIUM_GRPC_ORCA_ERROR").unwrap_or_default();
        let malformed_orca=matches!(mode.as_str(),"malformed-proto"|"malformed-gzip"|"partial-gzip"|"members-gzip"|"limit-gzip-exact"|"limit-gzip-over"|"limit-frame-over") && attempt<=1;
        let status=match mode.as_str() { "unavailable" | "backoff-cancel" if attempt==1 => Some("14"), "unimplemented" => Some("12"), "cancelled" => Some("1"), _ => None };
        println!("{}",serde_json::json!({"endpoint":endpoint,"event":"grpc-orca-attempt","reference":orca_reference,"attempt":attempt,"status":status,"requestBytes":body,"seconds":interval.seconds,"nanos":interval.nanos,"fingerprint":fingerprint,"atMillis":std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()}));
        if let Some(status)=status {
            let response=tungstenite::http::Response::builder().status(200).header("content-type","application/grpc").header("grpc-status",status).header("grpc-message","owned ORCA failure").body(()).map_err(|e|e.to_string())?;
            respond.send_response(response,true).map_err(|e|e.to_string())?;
            return Ok(());
        }
        if malformed_orca {
            let boundary=mode.starts_with("limit-")||mode=="members-gzip";
            let compressed=mode!="malformed-proto"&&mode!="limit-frame-over";
            let mut response=tungstenite::http::Response::builder().status(200).header("content-type","application/grpc");
            if compressed {response=response.header("grpc-encoding","gzip");}
            let mut send=respond.send_response(response.body(()).map_err(|e|e.to_string())?,false).map_err(|e|e.to_string())?;
            let gzip=|bytes:&[u8]|->Result<Vec<u8>,String>{let mut encoder=flate2::write::GzEncoder::new(Vec::new(),flate2::Compression::default());encoder.write_all(bytes).map_err(|e|e.to_string())?;encoder.finish().map_err(|e|e.to_string())};
            let mut decoded_len=None;
            let frame=match mode.as_str(){
                "malformed-proto"=>vec![0,0,0,0,4,49,0,0,0],
                "malformed-gzip"=>vec![1,0,0,0,4,0,1,2,3],
                "partial-gzip"=>vec![1,0,0,0,20,0,1,2,3],
                "limit-frame-over"=>{let mut frame=vec![0];frame.extend_from_slice(&(4_u32*1024*1024+1).to_be_bytes());frame},
                _=>{
                    let mut report=vec![49];report.extend_from_slice(&100_f64.to_le_bytes());report.push(73);report.extend_from_slice(&0.5_f64.to_le_bytes());
                    if mode.starts_with("limit-gzip-"){
                        let size=4*1024*1024+usize::from(mode=="limit-gzip-over");
                        // Valid unknown bytes field100 pads a report to exactly the decoded boundary.
                        let padding=size-18-6;report.extend_from_slice(&[162,6]);let mut length=padding;while length>=128 {report.push((length as u8&127)|128);length>>=7;}report.push(length as u8);report.resize(size,0);
                    }
                    decoded_len=Some(report.len());
                    let payload=if mode=="members-gzip" {let mut first=gzip(&report[..9])?;first.extend_from_slice(&gzip(&report[9..])?);first}else{gzip(&report)?};
                    let mut frame=vec![1];frame.extend_from_slice(&(payload.len()as u32).to_be_bytes());frame.extend_from_slice(&payload);frame
                }
            };
            send.send_data(frame.clone().into(),false).map_err(|e|e.to_string())?;
            let status=if boundary {"0"}else{"12"};
            let mut trailers=tungstenite::http::HeaderMap::new();trailers.insert("grpc-status",status.parse().unwrap());trailers.insert("grpc-message","owned ORCA fixture trailer".parse().unwrap());
            send.send_trailers(trailers).map_err(|e|e.to_string())?;
            println!("{}",serde_json::json!({"event":"grpc-orca-malformed","reference":orca_reference,"attempt":attempt,"mode":mode,"reportBytes":frame,"decodedLength":decoded_len,"trailerStatus":if boundary {0}else{12},"fingerprint":fingerprint}));
            return Ok(());
        }
        let encoding=match weight_mode.as_str() { "gzip" => Some("gzip"), "deflate" => Some("deflate"), _ => None };
        let mut response = tungstenite::http::Response::builder().status(200).header("content-type","application/grpc");
        if let Some(encoding)=encoding { response=response.header("grpc-encoding",encoding); }
        let response=response.body(()).map_err(|e|e.to_string())?;
        let mut send=respond.send_response(response,false).map_err(|e|e.to_string())?;
        // Independent fixed64 reports. The swap probe updates the same stream
        // before its foreground RPC retries, rather than opening a new channel.
        let swap=std::env::var("INSOMNIUM_GRPC_ORCA_WEIGHTS").ok().as_deref()==Some("swap");
        let initial=if weights_probe && endpoint == "127.0.0.2" {0.05_f64} else {0.5_f64};
        let mut emit=|utilization:f64,phase:u8| -> Result<(),String> {
            let number_update=phase==1 && endpoint=="127.0.0.2" && weight_mode.starts_with("number-");
            let qps=if number_update {match weight_mode.as_str(){"number-zero"=>0_f64,"number-infinity"=>f64::INFINITY,"number-negative"=>-100_f64,_=>100_f64}}else{100_f64};
            let utilization=if number_update && weight_mode=="number-nan" {f64::NAN}else{utilization};
            let wire_type_probe=weight_mode=="wiretype";
            let mut report=vec![if wire_type_probe {48} else {49}];report.extend_from_slice(&qps.to_le_bytes());
            if matches!(std::env::var("INSOMNIUM_GRPC_ORCA_WEIGHTS").unwrap_or_default().as_str(),"penalty"|"penalty0") {report.push(57);report.extend_from_slice(&(if endpoint=="127.0.0.2" {10000_f64} else {0_f64}).to_le_bytes());}
            report.push(if wire_type_probe {72} else {73});report.extend_from_slice(&utilization.to_le_bytes());
            let payload=match encoding {
                Some("gzip") => { let mut encoder=flate2::write::GzEncoder::new(Vec::new(),flate2::Compression::default());encoder.write_all(&report).map_err(|e|e.to_string())?;encoder.finish().map_err(|e|e.to_string())? },
                Some("deflate") => { let mut encoder=flate2::write::ZlibEncoder::new(Vec::new(),flate2::Compression::default());encoder.write_all(&report).map_err(|e|e.to_string())?;encoder.finish().map_err(|e|e.to_string())? },
                _ => report,
            };
            let mut frame=vec![u8::from(encoding.is_some())];frame.extend_from_slice(&(payload.len() as u32).to_be_bytes());frame.extend_from_slice(&payload);
            send.send_data(frame.clone().into(),false).map_err(|e|e.to_string())?;
            println!("{}",serde_json::json!({"endpoint":endpoint,"event":"grpc-orca-report","attempt":attempt,"phase":phase,"atMillis":std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis(),"url":path,"requestBytes":body,"seconds":interval.seconds,"nanos":interval.nanos,"reportBytes":frame,"encoding":encoding,"acceptEncoding":accept_encoding,"cn":cn,"fingerprint":fingerprint}));
            Ok(())
        };
        emit(initial,0)?;
        if swap {tokio::time::sleep(Duration::from_millis(200)).await;emit(if endpoint == "127.0.0.2" {0.5} else {0.05},1)?;}
        else if weight_mode.starts_with("number-") && endpoint=="127.0.0.2" {tokio::time::sleep(Duration::from_millis(200)).await;emit(initial,1)?;}
        else if weight_mode=="expiry-refresh" {tokio::time::sleep(Duration::from_millis(1100)).await;emit(initial,1)?;}
        if std::env::var("INSOMNIUM_GRPC_ORCA_INTERVAL").ok().as_deref()==Some("1")&&attempt==1 {goaway.store(true,std::sync::atomic::Ordering::SeqCst);}
        let reset=std::future::poll_fn(|cx|send.poll_reset(cx)).await;
        println!("{}",serde_json::json!({"endpoint":endpoint,"event":"grpc-orca-close","attempt":attempt,"nanos":interval.nanos,"reset":format!("{reset:?}")}));
        return Ok(());
    }
    let reflection = path.starts_with("/grpc.reflection.");
    let duplex = path.ends_with("/Chat");
    let collect = path.ends_with("/Collect");
    let hold = path.ends_with("/Hold") || path.ends_with("/HoldUnary") || path.rsplit('/').next().is_some_and(|method| method.starts_with("Deadline"));
    let watch = path.ends_with("/Watch");
    let malformed = path.rsplit('/').next().unwrap_or("");
    let corrupt = matches!(malformed, "BadGzip" | "BadDeflate");
    let oversized = matches!(malformed, "Oversized" | "Oversized503");
    let decoded_overflow = malformed == "DecodedOverflow";
    if malformed.starts_with("Gzip") {
        let mut body = Vec::new();
        while let Some(chunk) = incoming.data().await {
            let chunk = chunk.map_err(|e| e.to_string())?;
            body.extend_from_slice(&chunk);
            if body.len() > 65536 { return Err("Gzip fixture body limit".into()); }
            incoming.flow_control().release_capacity(chunk.len()).map_err(|e| e.to_string())?;
        }
        println!("{}",serde_json::json!({"endpoint":endpoint,"event":"grpc-request","url":path,"method":method,"bodyBytes":body,"authorized":true,"cn":cn,"fingerprint":fingerprint,"alpn":"h2"}));
        let gzip = |bytes: &[u8]| -> Result<Vec<u8>, String> {
            let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
            encoder.write_all(bytes).map_err(|e| e.to_string())?;
            encoder.finish().map_err(|e| e.to_string())
        };
        let first = grpc_frame(b"owned mutual TLS gRPC response");
        let second = grpc_frame(b"gzip tail");
        let mut encoded = gzip(&first[5..])?;
        let mut tail = gzip(&second[5..])?;
        match malformed {
            "GzipCorrupt" => { let crc = tail.len() - 8; tail[crc] ^= 1; }
            "GzipTruncated" => tail.truncate(8),
            "GzipJunk" => tail = b"junk".to_vec(),
            "GzipOverflow" => tail = gzip(&vec![0; 20 * 1024 * 1024])?,
            "GzipZeros" => tail = vec![0, 0],
            "GzipZeroJunk" => tail = b"\0junk".to_vec(),
            "GzipZeroMember" => tail.insert(0, 0),
            "GzipExact" | "GzipExactOver" => {
                let size = 20 * 1024 * 1024 + usize::from(malformed == "GzipExactOver");
                // JSON {"name":"..."} adds11 bytes; retain both documented20MiB budgets.
                // An unknown field contributes6wire bytes without expanding JSON.
                let text_size = size - 11;
                let mut raw = vec![10];let mut n = text_size;
                while n >= 128 { raw.push((n as u8 & 127) | 128);n >>= 7; }raw.push(n as u8);
                raw.extend_from_slice(b"owned exact start ");
                raw.resize(raw.len() + text_size - 18 - 16, b'x');
                raw.extend_from_slice(b" owned exact end");
                raw.extend_from_slice(&[18, 4, 0, 0, 0, 0]);
                if raw.len() != size { return Err("Exact fixture length mismatch".into()); }
                encoded = gzip(&raw)?;tail.clear();
            }
            "GzipMembers" => {},
            _ => return Err("Unknown owned gzip case".into()),
        }
        encoded.extend(tail);
        let mut frame = vec![1];frame.extend_from_slice(&(encoded.len() as u32).to_be_bytes());frame.extend(encoded);
        let response = tungstenite::http::Response::builder().status(200).header("content-type","application/grpc").header("grpc-encoding","gzip").body(()).map_err(|e| e.to_string())?;
        let mut send = respond.send_response(response, false).map_err(|e| e.to_string())?;
        println!("{}",serde_json::json!({"event":"grpc-malformed-response","method":malformed,"bytes":frame}));
        send.send_data(frame.into(), false).map_err(|e| e.to_string())?;
        grpc_trailers(&mut send)?;
        return Ok(());
    }
    if matches!(malformed, "InitialPadded" | "InitialDuplicate" | "InitialInvalid") {
        let mut body = Vec::new();
        while let Some(chunk) = incoming.data().await {
            let chunk = chunk.map_err(|e| e.to_string())?;
            body.extend_from_slice(&chunk);
            if body.len() > 65536 { return Err("Initial-status fixture body limit".into()); }
            incoming.flow_control().release_capacity(chunk.len()).map_err(|e| e.to_string())?;
        }
        println!("{}",serde_json::json!({"endpoint":endpoint,"event":"grpc-request","url":path,"method":method,"bodyBytes":body,"authorized":true,"cn":cn,"fingerprint":fingerprint,"alpn":"h2"}));
        let raw = match malformed { "InitialPadded" => "007", "InitialDuplicate" => "0", _ => "not-a-status" };
        let mut response = tungstenite::http::Response::builder().status(200).header("content-type", "application/grpc").header("grpc-status",raw).header("grpc-message","initial%20%25").body(()).map_err(|e| e.to_string())?;
        if malformed == "InitialDuplicate" { response.headers_mut().append("grpc-status", "7".parse().unwrap()); }
        let mut send = respond.send_response(response, false).map_err(|e| e.to_string())?;
        send.send_data(grpc_frame(b"owned mutual TLS gRPC response"), false).map_err(|e| e.to_string())?;
        grpc_trailers(&mut send)?;
        println!("{}",serde_json::json!({"event":"grpc-malformed-response","method":malformed,"statusRaw":if malformed=="InitialDuplicate"{vec!["0","7"]}else{vec![raw]},"terminalStatus":"0","initialEndStream":false}));
        return Ok(());
    }
    if matches!(malformed, "DuplicateHeaders" | "DuplicateTrailers") {
        let mut body = Vec::new();
        while let Some(chunk) = incoming.data().await {
            let chunk = chunk.map_err(|e| e.to_string())?;
            body.extend_from_slice(&chunk);
            if body.len() > 65536 { return Err("Duplicate-header fixture body limit".into()); }
            incoming.flow_control().release_capacity(chunk.len()).map_err(|e| e.to_string())?;
        }
        println!("{}",serde_json::json!({"endpoint":endpoint,"event":"grpc-request","url":path,"method":method,"bodyBytes":body,"authorized":true,"cn":cn,"fingerprint":fingerprint,"alpn":"h2"}));
        let mut trailers = tungstenite::http::HeaderMap::new();
        for (key, values) in [
            ("grpc-status", ["0", "7"]),
            ("grpc-message", ["duplicate%20first", "duplicate%20second"]),
            ("x-result", ["first", "second"]),
            ("cookie", ["a=1", "b=2"]),
            ("set-cookie", ["a=1", "b=2"]),
            ("authorization", ["first", "discarded"]),
            ("proof-bin", ["AP8=", "AA"]),
            ("grpc-status-details-bin", ["A!P8", "AA"]),
        ] { for value in values { trailers.append(key, value.parse().unwrap()); } }
        trailers.append("x-prefix", "kept".parse().unwrap());
        trailers.append("x-prefix", tungstenite::http::HeaderValue::from_bytes(b"\xff").unwrap());
        trailers.append("x-prefix", "not-reached".parse().unwrap());
        let mut response = tungstenite::http::Response::builder().status(200).header("content-type", "application/grpc").body(()).map_err(|e| e.to_string())?;
        let headers_only = malformed == "DuplicateHeaders";
        let mut initial = trailers.clone();
        if !headers_only { initial.remove("grpc-status"); initial.remove("grpc-message"); initial.remove("grpc-status-details-bin"); }
        response.headers_mut().extend(initial);
        let mut send = respond.send_response(response, headers_only).map_err(|e| e.to_string())?;
        if !headers_only { send.send_trailers(trailers).map_err(|e| e.to_string())?; }
        println!("{}",serde_json::json!({"event":"grpc-malformed-response","method":malformed,"bytes":[],"statusRaw":["0","7"],"detailsRaw":["duplicate%20first","duplicate%20second"]}));
        return Ok(());
    }
    let partial = matches!(
        malformed,
        "PartialMissing" | "PartialIdentity" | "PartialUnknown"
    );
    if matches!(
        malformed,
        "ThrottleDrain"
            | "ThrottleBlocked"
            | "ThrottleRecover"
            | "ThrottleRetry"
            | "ThrottleScaleSeed"
            | "ThrottleScaleUp"
            | "ThrottleScaleDown"
    ) {
        use std::sync::atomic::{AtomicUsize, Ordering};
        static DRAIN: AtomicUsize = AtomicUsize::new(0);
        static BLOCKED: AtomicUsize = AtomicUsize::new(0);
        static RECOVER: AtomicUsize = AtomicUsize::new(0);
        static RETRY: AtomicUsize = AtomicUsize::new(0);
        static SCALE_SEED: AtomicUsize = AtomicUsize::new(0);
        static SCALE_UP: AtomicUsize = AtomicUsize::new(0);
        static SCALE_DOWN: AtomicUsize = AtomicUsize::new(0);
        let counter = match malformed {
            "ThrottleDrain" => &DRAIN,
            "ThrottleBlocked" => &BLOCKED,
            "ThrottleRecover" => &RECOVER,
            "ThrottleScaleSeed" => &SCALE_SEED,
            "ThrottleScaleUp" => &SCALE_UP,
            "ThrottleScaleDown" => &SCALE_DOWN,
            _ => &RETRY,
        };
        let attempt = counter.fetch_add(1, Ordering::SeqCst) + 1;
        let mut body = Vec::new();
        while let Some(chunk) = incoming.data().await {
            let chunk = chunk.map_err(|e| e.to_string())?;
            body.extend_from_slice(&chunk);
            if body.len() > 65536 {
                return Err("Throttle fixture body limit".into());
            }
            incoming
                .flow_control()
                .release_capacity(chunk.len())
                .map_err(|e| e.to_string())?;
        }
        println!(
            "{}",
            serde_json::json!({"endpoint":endpoint,"event":"grpc-request","url":path,"method":method,"bodyBytes":body,"authorized":true,"cn":cn,"fingerprint":fingerprint,"alpn":"h2"})
        );
        println!(
            "{}",
            serde_json::json!({"event":"grpc-throttle-attempt","method":malformed,"attempt":attempt,"previous":previous_attempt})
        );
        let fail = malformed.starts_with("ThrottleScale")
            || matches!(malformed, "ThrottleDrain" | "ThrottleBlocked")
            || (malformed == "ThrottleRetry" && attempt == 1);
        if fail {
            let response = tungstenite::http::Response::builder()
                .status(200)
                .header("content-type", "application/grpc")
                .header("grpc-status", "14")
                .header("grpc-message", "owned throttle failure")
                .header(
                    "grpc-retry-pushback-ms",
                    if malformed == "ThrottleScaleSeed" {
                        "-1"
                    } else {
                        "1"
                    },
                )
                .body(())
                .map_err(|e| e.to_string())?;
            respond
                .send_response(response, true)
                .map_err(|e| e.to_string())?;
        } else {
            let response = tungstenite::http::Response::builder()
                .status(200)
                .header("content-type", "application/grpc")
                .body(())
                .map_err(|e| e.to_string())?;
            let mut send = respond
                .send_response(response, false)
                .map_err(|e| e.to_string())?;
            send.send_data(grpc_frame(b"owned mutual TLS gRPC response"), false)
                .map_err(|e| e.to_string())?;
            grpc_trailers(&mut send)?;
        }
        return Ok(());
    }
    if matches!(
        malformed,
        "RefusedOnce" | "RefusedTwice" | "RefusedAfterHeaders"
    ) {
        use std::sync::atomic::{AtomicUsize, Ordering};
        static ONCE: AtomicUsize = AtomicUsize::new(0);
        static TWICE: AtomicUsize = AtomicUsize::new(0);
        static HEADERS: AtomicUsize = AtomicUsize::new(0);
        let counter = match malformed {
            "RefusedOnce" => &ONCE,
            "RefusedTwice" => &TWICE,
            _ => &HEADERS,
        };
        let attempt = counter.fetch_add(1, Ordering::SeqCst) + 1;
        let mut body = Vec::new();
        while let Some(chunk) = incoming.data().await {
            let chunk = chunk.map_err(|e| e.to_string())?;
            body.extend_from_slice(&chunk);
            if body.len() > 65536 {
                return Err("Refused fixture body limit".into());
            }
            incoming
                .flow_control()
                .release_capacity(chunk.len())
                .map_err(|e| e.to_string())?;
        }
        println!(
            "{}",
            serde_json::json!({"endpoint":endpoint,"event":"grpc-request","url":path,"method":method,"bodyBytes":body,"authorized":true,"cn":cn,"fingerprint":fingerprint,"alpn":"h2"})
        );
        println!(
            "{}",
            serde_json::json!({"event":"grpc-refused-attempt","method":malformed,"attempt":attempt,"previous":previous_attempt})
        );
        if malformed == "RefusedAfterHeaders" {
            let response = tungstenite::http::Response::builder()
                .status(200)
                .header("content-type", "application/grpc")
                .header("x-owned-before-reset", "observed")
                .body(())
                .map_err(|e| e.to_string())?;
            let mut send = respond
                .send_response(response, false)
                .map_err(|e| e.to_string())?;
            tokio::time::timeout(Duration::from_secs(10), async {
                while !REFUSED_HEADERS_RELEASED.load(Ordering::SeqCst) {
                    tokio::time::sleep(Duration::from_millis(5)).await;
                }
            })
            .await
            .map_err(|e| e.to_string())?;
            send.send_reset(h2::Reason::REFUSED_STREAM);
        } else if attempt <= if malformed == "RefusedTwice" { 2 } else { 1 } {
            respond.send_reset(h2::Reason::REFUSED_STREAM);
        } else {
            let response = tungstenite::http::Response::builder()
                .status(200)
                .header("content-type", "application/grpc")
                .body(())
                .map_err(|e| e.to_string())?;
            let mut send = respond
                .send_response(response, false)
                .map_err(|e| e.to_string())?;
            send.send_data(grpc_frame(b"owned mutual TLS gRPC response"), false)
                .map_err(|e| e.to_string())?;
            grpc_trailers(&mut send)?;
        }
        return Ok(());
    }
    if matches!(
        malformed,
        "BudgetExact" | "BudgetOver" | "BudgetEmptyExact" | "BudgetEmptyOver"
    ) {
        use std::sync::atomic::{AtomicUsize, Ordering};
        static EXACT: AtomicUsize = AtomicUsize::new(0);
        static OVER: AtomicUsize = AtomicUsize::new(0);
        static EMPTY_EXACT: AtomicUsize = AtomicUsize::new(0);
        static EMPTY_OVER: AtomicUsize = AtomicUsize::new(0);
        let counter = match malformed {
            "BudgetExact" => &EXACT,
            "BudgetOver" => &OVER,
            "BudgetEmptyExact" => &EMPTY_EXACT,
            _ => &EMPTY_OVER,
        };
        let attempt = counter.fetch_add(1, Ordering::SeqCst) + 1;
        let mut body = Vec::new();
        while let Some(chunk) = incoming.data().await {
            let chunk = chunk.map_err(|e| e.to_string())?;
            body.extend_from_slice(&chunk);
            if body.len() > 2 * 1024 * 1024 {
                return Err("Replay fixture body limit".into());
            }
            incoming
                .flow_control()
                .release_capacity(chunk.len())
                .map_err(|e| e.to_string())?;
        }
        println!(
            "{}",
            serde_json::json!({"endpoint":endpoint,"event":"grpc-policy-attempt","method":malformed,"attempt":attempt,"previous":previous_attempt})
        );
        println!(
            "{}",
            serde_json::json!({"endpoint":endpoint,"event":"grpc-request","url":path,"method":method,"wireLength":body.len(),"wireSHA256":format!("{:x}",Sha256::digest(&body)),"frameHeader":&body[..body.len().min(5)],"authorized":true,"cn":cn,"fingerprint":fingerprint,"alpn":"h2"})
        );
        if attempt == 1 {
            let response = tungstenite::http::Response::builder()
                .status(200)
                .header("content-type", "application/grpc")
                .header("grpc-status", "14")
                .header("grpc-message", "owned budget rejection")
                .header("grpc-retry-pushback-ms", "1")
                .body(())
                .map_err(|e| e.to_string())?;
            respond
                .send_response(response, true)
                .map_err(|e| e.to_string())?;
        } else {
            let response = tungstenite::http::Response::builder()
                .status(200)
                .header("content-type", "application/grpc")
                .body(())
                .map_err(|e| e.to_string())?;
            let mut send = respond
                .send_response(response, false)
                .map_err(|e| e.to_string())?;
            send.send_data(grpc_frame(b"owned mutual TLS gRPC response"), false)
                .map_err(|e| e.to_string())?;
            grpc_trailers(&mut send)?;
        }
        return Ok(());
    }
    if matches!(
        malformed,
        "RetryOnce" | "HedgeOnce" | "RetryCancel" | "HedgeCancel"
            | "RetryAscii" | "RetryUnicode" | "HedgeAscii" | "HedgeUnicode"
            | "OutlierReferenceDisabled" | "OutlierReferenceEnabled" | "OutlierDisabled" | "OutlierEnabled"
            | "OutlierReferenceRecovery" | "OutlierRecovery"
    ) {
        use std::sync::atomic::{AtomicUsize, Ordering};
        static RETRIES: AtomicUsize = AtomicUsize::new(0);
        static HEDGES: AtomicUsize = AtomicUsize::new(0);
        static RETRY_CANCEL: AtomicUsize = AtomicUsize::new(0);
        static HEDGE_CANCEL: AtomicUsize = AtomicUsize::new(0);
        static RETRY_ASCII: AtomicUsize = AtomicUsize::new(0);
        static RETRY_UNICODE: AtomicUsize = AtomicUsize::new(0);
        static HEDGE_ASCII: AtomicUsize = AtomicUsize::new(0);
        static HEDGE_UNICODE: AtomicUsize = AtomicUsize::new(0);
        static OUTLIER_REF_DISABLED: AtomicUsize = AtomicUsize::new(0);
        static OUTLIER_REF_ENABLED: AtomicUsize = AtomicUsize::new(0);
        static OUTLIER_DISABLED: AtomicUsize = AtomicUsize::new(0);
        static OUTLIER_ENABLED: AtomicUsize = AtomicUsize::new(0);
        static OUTLIER_REF_RECOVERY: AtomicUsize = AtomicUsize::new(0);
        static OUTLIER_RECOVERY: AtomicUsize = AtomicUsize::new(0);
        let counter = match malformed {
            "RetryOnce" => &RETRIES,
            "HedgeOnce" => &HEDGES,
            "RetryCancel" => &RETRY_CANCEL,
            "RetryAscii" => &RETRY_ASCII,
            "RetryUnicode" => &RETRY_UNICODE,
            "HedgeAscii" => &HEDGE_ASCII,
            "HedgeUnicode" => &HEDGE_UNICODE,
            "OutlierReferenceDisabled" => &OUTLIER_REF_DISABLED,
            "OutlierReferenceEnabled" => &OUTLIER_REF_ENABLED,
            "OutlierDisabled" => &OUTLIER_DISABLED,
            "OutlierEnabled" => &OUTLIER_ENABLED,
            "OutlierReferenceRecovery" => &OUTLIER_REF_RECOVERY,
            "OutlierRecovery" => &OUTLIER_RECOVERY,
            _ => &HEDGE_CANCEL,
        };
        let attempt = counter.fetch_add(1, Ordering::SeqCst) + 1;
        println!(
            "{}",
            serde_json::json!({"endpoint":endpoint,"event":"grpc-policy-attempt","method":malformed,"attempt":attempt,"previous":previous_attempt,"atMillis":std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()})
        );
        if attempt == 1 || (weights_probe && previous_attempt.is_none()) || (weight_recovery && previous_attempt.as_deref()==Some("1")) || malformed.ends_with("Cancel") {
            let mut body = Vec::new();
            while let Some(chunk) = incoming.data().await {
                let chunk = chunk.map_err(|e| e.to_string())?;
                body.extend_from_slice(&chunk);
                if body.len() > 65536 {
                    return Err("Policy request body limit".into());
                }
                incoming
                    .flow_control()
                    .release_capacity(chunk.len())
                    .map_err(|e| e.to_string())?;
            }
            println!(
                "{}",
                serde_json::json!({"endpoint":endpoint,"event":"grpc-request","url":path,"method":method,"bodyBytes":body,"timeout":wire_timeout,"authorized":true,"cn":cn,"fingerprint":fingerprint,"alpn":"h2"})
            );
            if malformed.starts_with("Outlier") || matches!(malformed, "RetryOnce" | "RetryCancel" | "RetryAscii" | "RetryUnicode" | "HedgeAscii" | "HedgeUnicode") {
                let pushback = if weight_mode=="blackout-exit" {if previous_attempt.as_deref()==Some("1") {"800"} else {"400"}}
                        else if weight_mode=="expiry-refresh" {if previous_attempt.as_deref()==Some("1") {"600"} else {"800"}}
                        else if weights_probe {
                            if std::env::var("INSOMNIUM_GRPC_ORCA_WEIGHTS").ok().as_deref()==Some("swap") {"600"} else {"400"}
                        } else if malformed.ends_with("Recovery") {
                            "1600"
                        } else if malformed.starts_with("Outlier") {
                            "400"
                        } else if malformed == "RetryCancel" {
                            "800"
                        } else {
                            "1"
                        };
                let response = tungstenite::http::Response::builder()
                    .status(200)
                    .header("content-type", "application/grpc")
                    .header("grpc-status", "14")
                    .header("grpc-message", "owned retry")
                    .header(
                        "grpc-retry-pushback-ms",
                        pushback,
                    )
                    .body(())
                    .map_err(|e| e.to_string())?;
                respond
                    .send_response(response, true)
                    .map_err(|e| e.to_string())?;
                println!(
                    "{}",
                    serde_json::json!({"event":"grpc-policy-backoff","method":malformed,"milliseconds":pushback.parse::<u64>().unwrap()})
                );
            } else {
                let reason = std::future::poll_fn(|cx| respond.poll_reset(cx))
                    .await
                    .map_err(|e| e.to_string())?;
                println!(
                    "{}",
                    serde_json::json!({"event":"grpc-policy-cancel","method":malformed,"reason":format!("{reason:?}")})
                );
            }
            return Ok(());
        }
    }
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
    let mut response = tungstenite::http::Response::builder()
        .status(if malformed == "Oversized503" {
            503
        } else {
            200
        })
        .header("content-type", "application/grpc")
        .header("owned-metadata", "authenticated")
        // Non-END_STREAM status must stay initial metadata; final trailers win.
        .header("grpc-status", "7")
        .header("grpc-accept-encoding", "identity,deflate,gzip");
    if corrupt || decoded_overflow {
        response = response.header(
            "grpc-encoding",
            if malformed == "BadGzip" || decoded_overflow {
                "gzip"
            } else {
                "deflate"
            },
        );
    } else if matches!(malformed, "PartialIdentity" | "CodecIdentity") {
        response = response.header("grpc-encoding", "identity");
    } else if !oversized && !matches!(malformed, "PartialMissing" | "CodecMissing") {
        // grpc-js accepts unknown encoding metadata on raw flag0/flag2 frames.
        response = response.header("grpc-encoding", "owned-unsupported");
    }
    let response = response.body(()).map_err(|e| e.to_string())?;
    let mut send = respond
        .send_response(response, false)
        .map_err(|e| e.to_string())?;
    println!(
        "{}",
        serde_json::json!({"event":"grpc-open","url":path,"authorized":true,"cn":cn,"fingerprint":fingerprint,"alpn":"h2","initialStatus":7})
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
                    serde_json::json!({"endpoint":endpoint,"event":"grpc-request","url":path,"method":method,"bodyBytes":frame,"timeout":wire_timeout,"authorized":true,"cn":cn,"fingerprint":fingerprint,"alpn":"h2"})
                );
            }
            println!(
                "{}",
                serde_json::json!({"event":"grpc-message","url":path,"sequence":frames,"bytes":frame})
            );
            if reflection {
                let payload = grpc_reflection(&frame[5..], &path)?;
                let mut encoded = vec![2];
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
                let number_status = match malformed {
                    "Number17" => Some("17"),
                    "NumberNegative" => Some("-1"),
                    "NumberFraction" => Some("7.5"),
                    "NumberNaN" => Some("NaN"),
                    "NumberInfinity" => Some("Infinity"),
                    "NumberNegativeInfinity" => Some("-Infinity"),
                    "NumberHex" => Some("0x11"),
                    "NumberExponent" => Some("1e2"),
                    _ => None,
                };
                if let Some(code) = number_status {
                    println!(
                        "{}",
                        serde_json::json!({"event":"grpc-malformed-response","method":malformed,"bytes":[],"status":code})
                    );
                    let mut trailers = tungstenite::http::HeaderMap::new();
                    trailers.insert("grpc-status", code.parse().unwrap());
                    trailers.insert("grpc-message", "owned%20number%20status".parse().unwrap());
                    trailers.insert("x-number", "kept".parse().unwrap());
                    send.send_trailers(trailers).map_err(|e| e.to_string())?;
                    return Ok(());
                }
                if matches!(malformed, "CodecMissing" | "CodecIdentity" | "CodecUnknown") {
                    let invalid = vec![1u8, 0, 0, 0, 1, 0];
                    println!(
                        "{}",
                        serde_json::json!({"event":"grpc-malformed-response","method":malformed,"bytes":invalid})
                    );
                    send.send_data(invalid.into(), false)
                        .map_err(|e| e.to_string())?;
                    grpc_trailers(&mut send)?;
                    return Ok(());
                }
                if partial {
                    let invalid = vec![1u8, 0, 0, 0, 7, 10];
                    println!(
                        "{}",
                        serde_json::json!({"event":"grpc-malformed-response","method":malformed,"bytes":invalid})
                    );
                    send.send_data(invalid.into(), false)
                        .map_err(|e| e.to_string())?;
                    let mut trailers = tungstenite::http::HeaderMap::new();
                    trailers.insert("grpc-status", "7".parse().unwrap());
                    trailers.insert("grpc-message", "owned%20partial%20denied".parse().unwrap());
                    trailers.insert("x-partial", "kept".parse().unwrap());
                    send.send_trailers(trailers).map_err(|e| e.to_string())?;
                    return Ok(());
                }
                if corrupt || oversized || decoded_overflow {
                    let mut invalid = vec![1];
                    if decoded_overflow {
                        let mut encoder = flate2::write::GzEncoder::new(
                            Vec::new(),
                            flate2::Compression::default(),
                        );
                        encoder
                            .write_all(&vec![0; 20971521])
                            .map_err(|e| e.to_string())?;
                        let encoded = encoder.finish().map_err(|e| e.to_string())?;
                        invalid.extend_from_slice(&(encoded.len() as u32).to_be_bytes());
                        invalid.extend_from_slice(&encoded);
                    } else {
                        invalid.extend_from_slice(
                            &(if oversized { 20971521u32 } else { 8u32 }).to_be_bytes(),
                        );
                    }
                    if corrupt {
                        invalid.extend_from_slice(&[0xff; 8]);
                    }
                    println!(
                        "{}",
                        serde_json::json!({"event":"grpc-malformed-response","method":malformed,"bytes":invalid})
                    );
                    send.send_data(invalid.into(), false)
                        .map_err(|e| e.to_string())?;
                    grpc_trailers(&mut send)?;
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
    let alternate = (!std::env::var("INSOMNIUM_GRPC_ORCA_WEIGHTS").unwrap_or_default().is_empty()).then(|| {let other=TcpListener::bind(("127.0.0.2",listener.local_addr().unwrap().port())).unwrap();other.set_nonblocking(true).unwrap();other});
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
            let alternate = alternate.map(|other|tokio::net::TcpListener::from_std(other).unwrap());
            loop {
                let (socket, _) = tokio::select! { result=listener.accept()=>result.unwrap(), result=async{alternate.as_ref().unwrap().accept().await},if alternate.is_some()=>result.unwrap() };
                println!("{}", serde_json::json!({"event":"grpc-connection"}));
                let config = config.clone();
                tokio::spawn(async move {
                    let result = tokio::time::timeout(
                        // The interval probe spans the resolver's 30s minimum.
                        // Keep its owned foreground/OOB streams alive until UI Cancel.
                        Duration::from_secs(if std::env::var("INSOMNIUM_GRPC_ORCA_INTERVAL").ok().as_deref() == Some("1") || !std::env::var("INSOMNIUM_GRPC_ORCA_WEIGHTS").unwrap_or_default().is_empty() { 90 } else { 15 }),
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
    #[cfg(multiple_identities)]
    roots
        .add(CertificateDer::from(
            std::fs::read(std::path::Path::new(&args[4]).join("rsa-ca.der")).unwrap(),
        ))
        .unwrap();
    let verifier = rustls::server::WebPkiClientVerifier::builder(Arc::new(roots))
        .build()
        .unwrap();
    let config = Arc::new(
        ServerConfig::builder()
            .with_client_cert_verifier(verifier.clone())
            .with_single_cert(
                vec![CertificateDer::from(std::fs::read(&args[1]).unwrap())],
                PrivateKeyDer::Pkcs8(std::fs::read(&args[2]).unwrap().into()),
            )
            .unwrap(),
    );
    let mut invalid_servers = Vec::new();
    for role in ["hostname", "expired", "future"] {
        let cert = std::path::Path::new(&args[4]).join(format!("{role}.der"));
        let key = std::path::Path::new(&args[4]).join(format!("{role}-key.der"));
        let invalid_config = ServerConfig::builder()
            .with_client_cert_verifier(verifier.clone())
            .with_single_cert(
                vec![CertificateDer::from(std::fs::read(cert).unwrap())],
                PrivateKeyDer::Pkcs8(std::fs::read(key).unwrap().into()),
            )
            .unwrap();
        let invalid_config = Arc::new(invalid_config);
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let http_url = format!("https://{}", listener.local_addr().unwrap());
        #[cfg(grpc_fixture)]
        let grpc_url = grpc_listener(invalid_config.clone(), false);
        #[cfg(not(grpc_fixture))]
        let grpc_url = "";
        invalid_servers.push(serde_json::json!({"id":role,"httpUrl":http_url,"grpcUrl":grpc_url}));
        std::thread::spawn(move || {
            for socket in listener.incoming() {
                println!("{}", serde_json::json!({"event":"connection","role":role}));
                if let Err(error) = handle(socket.unwrap(), invalid_config.clone(), role, "") {
                    println!(
                        "{}",
                        serde_json::json!({"event":"rejected","role":role,"detail":error})
                    );
                }
            }
        });
    }
    let primary = TcpListener::bind("127.0.0.1:0").unwrap();
    let sink = TcpListener::bind("127.0.0.1:0").unwrap();
    let primary_url = format!("https://{}", primary.local_addr().unwrap());
    let sink_url = format!("https://{}", sink.local_addr().unwrap());
    let redirect = format!("{sink_url}/destination");
    #[cfg(multiple_identities)]
    let mut algorithm_servers = Vec::<serde_json::Value>::new();
    #[cfg(not(multiple_identities))]
    let algorithm_servers = Vec::<serde_json::Value>::new();
    #[cfg(multiple_identities)]
    for (role, scheme, version, empty_hints) in [
        (
            "rsa13",
            rustls::SignatureScheme::RSA_PSS_SHA256,
            &rustls::version::TLS13,
            false,
        ),
        (
            "ec13",
            rustls::SignatureScheme::ECDSA_NISTP256_SHA256,
            &rustls::version::TLS13,
            false,
        ),
        (
            "rsa12",
            rustls::SignatureScheme::RSA_PSS_SHA256,
            &rustls::version::TLS12,
            false,
        ),
        (
            "ec12",
            rustls::SignatureScheme::ECDSA_NISTP256_SHA256,
            &rustls::version::TLS12,
            false,
        ),
        (
            "rsa13empty",
            rustls::SignatureScheme::RSA_PSS_SHA256,
            &rustls::version::TLS13,
            true,
        ),
    ] {
        let restricted = AlgorithmVerifier {
            inner: verifier.clone(),
            scheme,
            role,
            empty_hints,
        };
        let restricted = ServerConfig::builder_with_protocol_versions(&[version])
            .with_client_cert_verifier(Arc::new(restricted))
            .with_single_cert(
                vec![CertificateDer::from(std::fs::read(&args[1]).unwrap())],
                PrivateKeyDer::Pkcs8(std::fs::read(&args[2]).unwrap().into()),
            )
            .unwrap();
        let restricted = Arc::new(restricted);
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        algorithm_servers.push(serde_json::json!({"id":role,"url":format!("wss://{}",listener.local_addr().unwrap()),"scheme":format!("{scheme:?}"),"version":if version == &rustls::version::TLS13 {"TLS13"} else {"TLS12"},"emptyHints":empty_hints}));
        let redirect = redirect.clone();
        std::thread::spawn(move || {
            for socket in listener.incoming() {
                println!("{}", serde_json::json!({"event":"connection","role":role}));
                if let Err(error) = handle(socket.unwrap(), restricted.clone(), role, &redirect) {
                    println!(
                        "{}",
                        serde_json::json!({"event":"rejected","role":role,"detail":error})
                    );
                }
            }
        });
    }
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
        serde_json::json!({"event":"ready","primary":primary_url,"sink":sink_url,"grpc":grpc_url,"grpcAlpha":grpc_alpha_url,"invalidServers":invalid_servers,"algorithmServers":algorithm_servers})
    );
    loop {
        let mut command = String::new();
        if std::io::stdin().read_line(&mut command).unwrap_or(0) == 0 {
            break;
        }
        #[cfg(grpc_fixture)]
        if command.trim() == "release-refused-headers" {
            REFUSED_HEADERS_RELEASED.store(true, std::sync::atomic::Ordering::SeqCst);
            continue;
        }
        break;
    }
}
