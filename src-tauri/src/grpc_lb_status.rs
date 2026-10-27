//! grpc-js Number conversion at the native/Tonic gRPC status boundary.
use tonic::codegen::http::{HeaderMap, HeaderValue};

fn coalesce(headers: &mut HeaderMap) {
    // Node 18 HTTP/2 toHeaderObject runs before grpc-js Metadata validation.
    // Preserve Set-Cookie arrays, discard later single-value headers, and join
    // all other duplicates (including grpc-status/message and binary metadata).
    for name in headers.keys().cloned().collect::<Vec<_>>() {
        let values = headers.get_all(&name).iter().cloned().collect::<Vec<_>>();
        if values.len() < 2 || name == "set-cookie" {
            continue;
        }
        let single = matches!(
            name.as_str(),
            "access-control-allow-credentials"
                | "access-control-max-age"
                | "access-control-request-method"
                | "age"
                | "authorization"
                | "content-encoding"
                | "content-language"
                | "content-length"
                | "content-location"
                | "content-md5"
                | "content-range"
                | "content-type"
                | "date"
                | "dnt"
                | "etag"
                | "expires"
                | "from"
                | "host"
                | "if-match"
                | "if-modified-since"
                | "if-none-match"
                | "if-range"
                | "if-unmodified-since"
                | "last-modified"
                | "location"
                | "max-forwards"
                | "proxy-authorization"
                | "range"
                | "referer"
                | "retry-after"
                | "tk"
                | "upgrade-insecure-requests"
                | "user-agent"
                | "x-content-type-options"
        );
        if single {
            headers.insert(name, values[0].clone());
            continue;
        }
        let mut joined = Vec::new();
        for (index, value) in values.iter().enumerate() {
            if index != 0 {
                joined.extend_from_slice(if name == "cookie" { b"; " } else { b", " });
            }
            joined.extend_from_slice(value.as_bytes());
        }
        let mut value = HeaderValue::from_bytes(&joined).expect("joined valid HTTP/2 values");
        value.set_sensitive(values.iter().any(HeaderValue::is_sensitive));
        headers.insert(name, value);
    }
}

pub(super) fn normalize(headers: &mut HeaderMap, terminal: bool) {
    coalesce(headers);
    let legal_text = |value: &HeaderValue| {
        value
            .as_bytes()
            .iter()
            .all(|byte| (0x20..=0x7e).contains(byte))
    };
    // Validate the Node-shaped values, stopping a Set-Cookie array at its first
    // invalid value. Binary values are decoded later; grpc-message stays raw
    // until the shared status decoder.
    for name in headers.keys().cloned().collect::<Vec<_>>() {
        if !name.as_str().bytes().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || matches!(byte, b'_' | b'-' | b'.')
        }) {
            headers.remove(&name);
            continue;
        }
        if name.as_str().ends_with("-bin") {
            continue;
        }
        let values = headers.get_all(&name);
        if values.iter().all(legal_text) {
            continue;
        }
        let mut admitted = values
            .iter()
            .take_while(|value| legal_text(value))
            .cloned()
            .collect::<Vec<_>>()
            .into_iter();
        if let Some(first) = admitted.next() {
            headers.insert(name.clone(), first);
            for value in admitted {
                headers.append(name.clone(), value);
            }
        } else {
            headers.remove(&name);
        }
    }
    // Non-END_STREAM status fields are observable initial metadata. Preserve
    // their spelling; only final trailers participate in status conversion.
    if let Some(value) = headers.get("grpc-status").filter(|_| terminal) {
        // Canonicalize Number, retaining the full domain rather than only the
        // standard enum. The legacy Tonic status projection preserves it.
        let text = std::str::from_utf8(value.as_bytes()).unwrap_or("");
        let number = crate::grpc_legacy::string_number(text);
        let canonical = ryu_js::Buffer::new().format(number).to_owned();
        headers.insert(
            "grpc-status",
            HeaderValue::from_str(&canonical).expect("ASCII Number"),
        );
    }
}
