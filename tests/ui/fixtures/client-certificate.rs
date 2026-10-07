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
    let response = if first[1] == "/redirect" {
        format!("HTTP/1.1 302 Found\r\nLocation: {redirect}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
    } else {
        let body = "owned mTLS response";
        format!("HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len())
    };
    stream
        .write_all(response.as_bytes())
        .map_err(|e| e.to_string())?;
    stream.flush().map_err(|e| e.to_string())
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
        serde_json::json!({"event":"ready","primary":primary_url,"sink":sink_url})
    );
    let mut stop = String::new();
    let _ = std::io::stdin().read_line(&mut stop);
}
