//! grpc-js 1.14.4 environment proxy mapping. This is independent of HTTP app
//! proxy preferences, just as in the archived Electron gRPC client.
use base64::{engine::general_purpose::STANDARD, Engine};
use hyper_util::rt::TokioIo;
use reqwest::Url;
use std::{io, net::Ipv4Addr};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt, BufReader},
    net::TcpStream,
};
use tonic::transport::{Channel, Endpoint};

#[derive(Clone)]
pub(crate) struct Proxy {
    pub(crate) host: String,
    pub(crate) port: u16,
    pub(crate) authorization: Option<String>,
}

fn decimal_prefix(value: &str) -> Option<u32> {
    let value = value.trim_start_matches(|c| {
        matches!(c,
        '\u{0009}'..='\u{000d}' | '\u{0020}' | '\u{00a0}' | '\u{1680}' |
        '\u{2000}'..='\u{200a}' | '\u{2028}' | '\u{2029}' | '\u{202f}' |
        '\u{205f}' | '\u{3000}' | '\u{feff}')
    });
    let negative = value.starts_with('-');
    let value = value.strip_prefix(['+', '-']).unwrap_or(value);
    let end = value.bytes().take_while(u8::is_ascii_digit).count();
    let prefix: u32 = value.get(..end)?.parse().ok()?;
    (!negative || prefix == 0).then_some(prefix)
}

fn bypass(host: &str, list: &str) -> bool {
    list.split(',').any(|entry| {
        if let Some((ip, prefix)) = entry.split_once('/') {
            if !prefix.contains('/') {
                if let (Ok(ip), Ok(target), Some(prefix)) = (
                    ip.parse::<Ipv4Addr>(),
                    host.parse::<Ipv4Addr>(),
                    decimal_prefix(prefix),
                ) {
                    if prefix <= 32 {
                        // JS bit shifts mask their count to five bits, including /0.
                        let mask = u32::MAX.wrapping_shl(32 - prefix);
                        if u32::from(ip) & mask == u32::from(target) & mask {
                            return true;
                        }
                    }
                }
            }
        }
        // Preserve grpc-js raw suffix/empty-entry semantics; not HTTP NoProxy rules.
        host.ends_with(entry)
    })
}

/** Lookup is injectable for pure controls; production only reads the environment. */
pub(crate) fn select(
    target: &Url,
    lookup: impl Fn(&str) -> Option<String>,
) -> Result<Option<Proxy>, String> {
    let first = |names: &[&str]| {
        names
            .iter()
            .find_map(|name| lookup(name).filter(|s| !s.is_empty()))
    };
    let Some(value) = first(&["grpc_proxy", "https_proxy", "http_proxy"]) else {
        return Ok(None);
    };
    // grpc-js logs and ignores malformed or unsupported proxy URLs.
    let Ok(url) = Url::parse(&value) else {
        return Ok(None);
    };
    if url.scheme() != "http" {
        return Ok(None);
    }
    let Some(host) = url.host_str() else {
        return Ok(None);
    };
    if let Some(list) = first(&["no_grpc_proxy", "no_proxy"]) {
        if bypass(
            target.host_str().unwrap_or("").trim_matches(['[', ']']),
            &list,
        ) {
            return Ok(None);
        }
    }
    let credentials = if url.username().is_empty() {
        None
    } else if let Some(password) = url.password().filter(|s| !s.is_empty()) {
        let encoded = format!("{}:{password}", url.username());
        for (index, byte) in encoded.bytes().enumerate() {
            if byte == b'%'
                && !encoded
                    .as_bytes()
                    .get(index + 1..index + 3)
                    .is_some_and(|pair| pair.iter().all(u8::is_ascii_hexdigit))
            {
                return Err("Invalid percent-encoded gRPC proxy credentials.".into());
            }
        }
        Some(
            percent_encoding::percent_decode_str(&encoded)
                .decode_utf8()
                .map_err(|_| "Invalid UTF-8 gRPC proxy credentials.")?
                .into_owned(),
        )
    } else {
        Some(url.username().to_owned())
    };
    Ok(Some(Proxy {
        host: host.trim_matches(['[', ']']).to_owned(),
        port: url.port().unwrap_or(80),
        authorization: credentials
            .map(|value| format!("Basic {}", STANDARD.encode(value.as_bytes()))),
    }))
}

pub(crate) fn authority(target: &Url) -> String {
    let host = target.host_str().unwrap_or("");
    let host = if host.contains(':') && !host.starts_with('[') {
        format!("[{host}]")
    } else {
        host.to_owned()
    };
    format!("{host}:{}", target.port_or_known_default().unwrap_or(443))
}

pub(crate) async fn tunnel(proxy: &Proxy, target: &str) -> io::Result<BufReader<TcpStream>> {
    let stream = TcpStream::connect((proxy.host.as_str(), proxy.port)).await?;
    stream.set_nodelay(true)?;
    let mut stream = BufReader::new(stream);
    let mut request = format!("CONNECT {target} HTTP/1.1\r\nHost: {target}\r\n");
    if let Some(auth) = &proxy.authorization {
        request.push_str(&format!("Proxy-Authorization: {auth}\r\n"));
    }
    request.push_str("\r\n");
    stream.write_all(request.as_bytes()).await?;
    // Node's HTTP parser default. Buffered reads retain any tunnel bytes already
    // received with the CONNECT response (including initial HTTP/2 SETTINGS).
    const LIMIT: usize = 16 * 1024;
    let mut bytes = Vec::new();
    loop {
        if bytes.len() == LIMIT {
            return Err(io::Error::other(
                "gRPC proxy response headers exceed 16 KiB.",
            ));
        }
        bytes.push(stream.read_u8().await?);
        if !bytes.ends_with(b"\r\n\r\n") {
            continue;
        }
        let mut headers = vec![httparse::EMPTY_HEADER; LIMIT / 4];
        let mut response = httparse::Response::new(&mut headers);
        let status = response
            .parse(&bytes)
            .map_err(|_| io::Error::other("Invalid gRPC proxy response."))?;
        if !status.is_complete() {
            return Err(io::Error::other("Incomplete gRPC proxy response."));
        }
        match response.code {
            Some(200) => return Ok(stream),
            Some(100..=199) if response.code != Some(101) => bytes.clear(),
            Some(407) => return Err(io::Error::other("gRPC proxy authentication required.")),
            _ => return Err(io::Error::other("gRPC proxy rejected CONNECT.")),
        }
    }
}

pub(crate) async fn connect(endpoint: Endpoint, target: &Url) -> Result<Channel, String> {
    let selected = select(target, |key| std::env::var(key).ok())?;
    if let Some(proxy) = selected {
        let target = authority(target);
        endpoint
            .connect_with_connector(tower::service_fn(move |_| {
                let proxy = proxy.clone();
                let target = target.clone();
                async move { tunnel(&proxy, &target).await.map(TokioIo::new) }
            }))
            .await
    } else {
        endpoint.connect().await
    }
    .map_err(|error| format!("Could not connect to gRPC endpoint: {error}"))
}
