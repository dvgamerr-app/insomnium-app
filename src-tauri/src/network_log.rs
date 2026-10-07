//! Human-readable, curl -v style log of one HTTP exchange.
//!
//! reqwest does not expose DNS/TCP/TLS handshake steps, so this reports what
//! is observable: the connected address, negotiated HTTP version, the peer
//! certificate, headers and sizes. Secrets in request headers are masked.
use reqwest::{header::HeaderMap, Request, Response, Url};
use x509_parser::{extensions::GeneralName, parse_x509_certificate};

const SECRET_HEADERS: [&str; 3] = ["authorization", "proxy-authorization", "cookie"];

fn version_label(version: reqwest::Version) -> &'static str {
    match version {
        reqwest::Version::HTTP_09 => "HTTP/0.9",
        reqwest::Version::HTTP_10 => "HTTP/1.0",
        reqwest::Version::HTTP_2 => "HTTP/2",
        reqwest::Version::HTTP_3 => "HTTP/3",
        _ => "HTTP/1.1",
    }
}

fn host_port(url: &Url) -> String {
    let host = url.host_str().unwrap_or("");
    match url.port_or_known_default() {
        Some(port) => format!("{host}:{port}"),
        None => host.to_string(),
    }
}

/// Mask the value of credential-bearing request headers, keeping the scheme word.
fn masked(name: &str, value: &str) -> String {
    if !SECRET_HEADERS.contains(&name.to_ascii_lowercase().as_str()) {
        return value.to_string();
    }
    match value.split_once(' ') {
        Some((scheme, _)) if !name.eq_ignore_ascii_case("cookie") => format!("{scheme} ***"),
        _ => "***".into(),
    }
}

fn date(time: x509_parser::time::ASN1Time) -> String {
    let dt = time.to_datetime();
    format!("{:04}-{:02}-{:02}", dt.year(), dt.month() as u8, dt.day())
}

fn certificate_lines(der: &[u8], validated: bool) -> Vec<String> {
    let Ok((_, cert)) = parse_x509_certificate(der) else {
        return vec!["*   (peer certificate could not be parsed)".into()];
    };
    let validity = cert.validity();
    let status = if validity.is_valid() {
        ""
    } else {
        "  [NOT CURRENTLY VALID]"
    };
    let mut lines = vec![
        format!("*   subject: {}", cert.subject()),
        format!("*   issuer:  {}", cert.issuer()),
        format!(
            "*   valid:   {} to {}{status}",
            date(validity.not_before),
            date(validity.not_after)
        ),
    ];
    if let Ok(Some(san)) = cert.subject_alternative_name() {
        let names: Vec<&str> = san
            .value
            .general_names
            .iter()
            .filter_map(|name| match name {
                GeneralName::DNSName(dns) => Some(*dns),
                _ => None,
            })
            .collect();
        if !names.is_empty() {
            lines.push(format!("*   SAN:     {}", names.join(", ")));
        }
    }
    lines.push(format!(
        "*   verification: {}",
        if validated {
            "chain and host name checked against trusted roots"
        } else {
            "skipped (Validate TLS certificates is off)"
        }
    ));
    lines
}

pub(crate) struct Settings<'a> {
    pub proxy: Option<&'a str>,
    pub validate_certificates: bool,
    pub follow_redirects: bool,
    pub custom_ca: bool,
    pub client_certificate: bool,
}

/// Lines printed before anything is sent.
pub(crate) fn preface(method: &str, url: &Url, settings: &Settings<'_>) -> Vec<String> {
    let proxy = settings
        .proxy
        .and_then(|p| Url::parse(p).ok())
        .map(|p| format!("{}://{}", p.scheme(), host_port(&p)))
        .unwrap_or_else(|| "none".into());
    let on = |value: bool| if value { "on" } else { "off" };
    vec![
        format!("* Preparing {method} request to {url}"),
        format!(
            "* Settings: proxy {proxy}, follow redirects {}, validate certificates {}, custom CA {}, client certificate {}",
            on(settings.follow_redirects),
            on(settings.validate_certificates),
            on(settings.custom_ca),
            on(settings.client_certificate),
        ),
    ]
}

/// The request half of one hop, captured before it is handed to the client.
pub(crate) struct Outgoing {
    method: String,
    url: Url,
    headers: Vec<(String, String)>,
    body_bytes: Option<usize>,
}

impl Outgoing {
    pub(crate) fn capture(request: &Request) -> Self {
        let headers = headers_of(request.headers());
        Self {
            method: request.method().to_string(),
            url: request.url().clone(),
            headers,
            body_bytes: request
                .body()
                .and_then(|b| b.as_bytes())
                .map(|bytes| bytes.len()),
        }
    }
}

fn headers_of(headers: &HeaderMap) -> Vec<(String, String)> {
    headers
        .iter()
        .map(|(name, value)| {
            let value = String::from_utf8_lossy(value.as_bytes());
            (name.to_string(), masked(name.as_str(), &value))
        })
        .collect()
}

/// Lines for one request/response exchange.
pub(crate) fn hop(
    number: usize,
    sent: Outgoing,
    response: &Response,
    elapsed_ms: u128,
    validate_certificates: bool,
) -> Vec<String> {
    let mut lines = Vec::new();
    if number > 1 {
        lines.push(format!("* ---- Request {number} ----"));
    }
    // After an automatic redirect the connection belongs to the final URL.
    let connected = response.url();
    let version = version_label(response.version());
    let address = response
        .remote_addr()
        .map(|a| format!("{} port {}", a.ip(), a.port()))
        .unwrap_or_else(|| "an unknown address".into());
    lines.push(format!(
        "* Connected to {} at {address}",
        connected.host_str().unwrap_or("")
    ));
    if connected.scheme() == "https" {
        lines.push("* TLS connection established; server certificate:".into());
        match response
            .extensions()
            .get::<reqwest::tls::TlsInfo>()
            .and_then(|info| info.peer_certificate())
        {
            Some(der) => lines.extend(certificate_lines(der, validate_certificates)),
            None => lines.push("*   (no certificate information available)".into()),
        }
    } else {
        lines.push("* Connection is not encrypted (http)".into());
    }
    let target = &sent.url;
    let path = match target.query() {
        Some(query) => format!("{}?{query}", target.path()),
        None => target.path().to_string(),
    };
    lines.push(format!("> {} {path} {version}", sent.method));
    lines.push(format!("> host: {}", target.host_str().unwrap_or("")));
    lines.extend(sent.headers.iter().map(|(n, v)| format!("> {n}: {v}")));
    lines.push(">".into());
    if let Some(bytes) = sent.body_bytes {
        lines.push(format!("* Sent request body: {bytes} bytes"));
    }
    let status = response.status();
    lines.push(format!(
        "< {version} {} {}    [{elapsed_ms} ms to response headers]",
        status.as_u16(),
        status.canonical_reason().unwrap_or("")
    ));
    lines.extend(response.headers().iter().map(|(name, value)| {
        format!("< {name}: {}", String::from_utf8_lossy(value.as_bytes()))
    }));
    lines.push("<".into());
    lines
}

/// Closing lines once the body has been read.
pub(crate) fn finish(
    requested: &Url,
    final_url: &str,
    size: usize,
    elapsed_ms: u128,
    hops: usize,
) -> Vec<String> {
    let mut lines = Vec::new();
    if hops == 1 && final_url != requested.as_str() {
        lines.push(format!(
            "* Redirects were followed automatically: {requested} -> {final_url}"
        ));
    }
    lines.push(format!("* Received {size} bytes"));
    lines.push(format!("* Finished in {elapsed_ms} ms"));
    lines
}
