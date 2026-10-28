use crate::grpc_schema::{self, DynamicCodec, MAX_MESSAGE, MAX_SCHEMA};
use base64::{
    engine::general_purpose::{STANDARD, STANDARD_NO_PAD},
    Engine,
};
use prost_reflect::{DescriptorPool, DynamicMessage, MethodDescriptor};
use serde::{Deserialize, Serialize};
use std::time::Duration;
#[cfg(test)]
use tokio::sync::mpsc;
#[cfg(test)]
use tokio_stream::wrappers::ReceiverStream;
use tonic::{
    metadata::{Ascii, Binary, KeyAndValueRef, MetadataKey, MetadataMap, MetadataValue},
    transport::{Certificate, ClientTlsConfig, Endpoint, Identity},
    Status,
};

#[path = "grpc_endpoint.rs"]
mod endpoint_url;

#[path = "grpc_socket.rs"]
mod socket;

#[path = "grpc_dns.rs"]
mod dns;

#[path = "grpc_service_config.rs"]
mod service_config;

#[path = "grpc_lb_transport.rs"]
mod lb_transport;
use lb_transport::Channel;
#[path = "grpc_call_setup.rs"]
mod call_setup;

#[path = "grpc_replay.rs"]
mod replay;

#[path = "grpc_admission.rs"]
pub(crate) mod admission;

#[path = "grpc_retry.rs"]
mod retry;

#[cfg(test)]
#[path = "grpc_reflection_arrival_tests.rs"]
mod arrival_tests;

#[path = "grpc_tls.rs"]
mod tls;

#[path = "grpc_proxy.rs"]
mod proxy;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    // Native lifetime state, never accepted from or serialized into IPC data.
    #[serde(skip)]
    resolution_config: service_config::ResolutionConfig,
    #[serde(skip)]
    lookup_work: dns::LookupWork,
    pub url: String,
    #[serde(default)]
    pub metadata: Vec<(String, String)>,
    pub timeout_ms: u64,
    #[serde(default)]
    pub deadline_ms: Option<u64>,
    #[serde(default = "validate_certificates_default")]
    pub validate_certificates: bool,
    pub ca_pem: Option<String>,
    pub ca_file: Option<String>,
    pub(crate) ca_asset: Option<crate::client_certificates::PortableCertificateAsset>,
    pub identity_pem: Option<String>,
    #[serde(default)]
    pub(crate) client_certificates: Vec<crate::client_certificates::ClientCertificateSource>,
}

impl Connection {
    pub(crate) async fn drain_dns(&self) {
        self.resolution_config.shutdown().await;
        self.lookup_work.drain().await;
    }
    pub(crate) fn call_deadline(&self) -> Option<Duration> {
        // Old IPC callers omitted this field and used timeout_ms for the call.
        // The current renderer sends explicit zero for legacy no-deadline calls.
        let ms = self.deadline_ms.unwrap_or(self.timeout_ms.min(3_600_000));
        (ms != 0).then(|| Duration::from_millis(ms.clamp(1, 3_600_000)))
    }
}

fn validate_certificates_default() -> bool {
    true
}

// grpc-js metadata.ts decodes binary headers with Buffer.from(value, "base64").
// Preserve the tolerant ASCII decoding boundary before protobuf validation.
fn decode_binary_metadata(encoded: &[u8]) -> Option<Vec<u8>> {
    Some(Status::decode_legacy_binary_metadata(encoded))
}
pub(crate) fn metadata(rows: &[(String, String)]) -> Result<MetadataMap, String> {
    if rows.len() > 128
        || rows
            .iter()
            .map(|(k, v)| k.len().saturating_add(v.len()))
            .sum::<usize>()
            > 256 * 1024
    {
        return Err("gRPC metadata exceeds 128 rows or 256 KiB.".into());
    }
    let mut result = MetadataMap::new();
    for (name, value) in rows {
        let name = name.to_lowercase();
        if name.is_empty()
            || !name.bytes().all(|b| {
                b.is_ascii_lowercase() || b.is_ascii_digit() || matches!(b, b'_' | b'-' | b'.')
            })
        {
            return Err(
                "gRPC metadata names allow only letters, digits, underscore, hyphen and dot."
                    .into(),
            );
        }
        if name.starts_with("grpc-") || matches!(name.as_str(), "content-type" | "te" | "host") {
            return Err("gRPC protocol headers are managed by the transport.".into());
        }
        if name.ends_with("-bin") {
            let key = MetadataKey::<Binary>::from_bytes(name.as_bytes())
                .map_err(|_| "Invalid binary metadata name.")?;
            let bytes = STANDARD
                .decode(value)
                .or_else(|_| STANDARD_NO_PAD.decode(value))
                .map_err(|_| "Binary gRPC metadata must be base64.")?;
            let mut value = MetadataValue::from_bytes(&bytes);
            value.set_sensitive(true);
            result.append_bin(key, value);
        } else {
            if !value.bytes().all(|byte| (0x20..=0x7e).contains(&byte)) {
                return Err(
                    "gRPC text metadata must be printable ASCII; use -bin for base64 data.".into(),
                );
            }
            let key = MetadataKey::<Ascii>::from_bytes(name.as_bytes())
                .map_err(|_| "Invalid gRPC metadata name.")?;
            let mut value = MetadataValue::try_from(value.as_str()).map_err(|_| {
                "gRPC text metadata must be printable ASCII; use -bin for base64 data."
            })?;
            value.set_sensitive(true);
            result.append(key, value);
        }
    }
    Ok(result)
}

pub(crate) fn metadata_rows(metadata: &MetadataMap) -> Result<Vec<(String, String)>, String> {
    let mut rows = Vec::new();
    for entry in metadata.iter() {
        match entry {
            KeyAndValueRef::Ascii(k, v) => rows.push((
                k.to_string(),
                String::from_utf8_lossy(v.as_encoded_bytes()).into_owned(),
            )),
            KeyAndValueRef::Binary(k, v) => {
                // grpc-js splits joined custom values, but decodes reserved
                // grpc-* values as one Buffer.from(base64) input.
                let custom = !k.as_str().starts_with("grpc-");
                for encoded in v.as_encoded_bytes().split(|b| custom && *b == b',') {
                    let encoded = encoded.trim_ascii();
                    let bytes = decode_binary_metadata(encoded)
                        .ok_or("Server sent invalid binary gRPC metadata.")?;
                    rows.push((k.to_string(), STANDARD.encode(bytes)));
                }
            }
        }
    }
    Ok(rows)
}

pub(crate) async fn channel(config: &Connection) -> Result<Channel, call_setup::Error> {
    let target = endpoint_url::parse(&config.url)?;
    let url = &target.url;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || url.path() != "/"
        || url.query().is_some()
        || url.fragment().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err(
            "gRPC requires a host and port, with grpc:// or grpcs:// and no path/userinfo/query."
                .into(),
        );
    }
    let mut endpoint = Endpoint::from_shared(url.to_string())
        .map_err(|_| "Invalid gRPC endpoint.")?
        .user_agent(concat!("Insomnium/", env!("CARGO_PKG_VERSION")))
        .map_err(|_| "Invalid gRPC user agent.")?;
    let connect_timeout = crate::http::timeouts::selected(None, config.timeout_ms);
    if let Some(timeout) = connect_timeout {
        endpoint = endpoint.connect_timeout(timeout);
    }
    if url.scheme() == "https" {
        let mut tls = ClientTlsConfig::new();
        if config.validate_certificates {
            let ca = crate::client_certificates::load_ca_certificate(
                config.ca_file.as_deref(),
                config.ca_pem.as_deref(),
                config.ca_asset.as_ref(),
            )?;
            if !ca.replace_roots {
                tls = tls.with_webpki_roots();
            }
            if let Some(pem) = ca.pem {
                if pem.len() > 1024 * 1024 {
                    return Err("gRPC CA exceeds 1 MiB.".into());
                }
                tls = tls.ca_certificate(Certificate::from_pem(&pem));
            }
        }
        if let Some(pem) = crate::client_certificates::load_identity(
            &config.client_certificates,
            config.identity_pem.as_deref(),
        )? {
            if pem.len() > 1024 * 1024 {
                return Err("gRPC identity exceeds 1 MiB.".into());
            }
            tls = tls.identity(Identity::from_pem(&pem, &pem));
        }
        endpoint = if config.validate_certificates {
            endpoint.tls_config(tls)
        } else {
            endpoint.tls_config_with_verifier(tls, tls::unverified_server())
        }
        .map_err(|_| "Invalid gRPC TLS configuration.")?;
    }
    if let Some(path) = &target.socket_path {
        config.resolution_config.clear();
        socket::connect(endpoint, path)
            .await
            .map(Into::into)
            .map_err(call_setup::Error::Transport)
    } else if !target.addresses.is_empty() {
        config.resolution_config.clear();
        proxy::connect_static(
            endpoint,
            &target.addresses,
            connect_timeout,
            &config.lookup_work,
        )
        .await
        .map(Into::into)
        .map_err(call_setup::Error::Transport)
    } else {
        dns::connect(
            endpoint,
            url,
            target.dns_server,
            connect_timeout,
            &config.resolution_config,
            &config.lookup_work,
            &config.url,
        )
        .await
        .map_err(call_setup::Error::Transport)
    }
}

// Reflection v1 and v1alpha messages share the same wire field numbers.
// Use the generated v1 types with the appropriate service path and standard codec.
#[path = "grpc_reflection.rs"]
mod reflection;

pub(crate) struct ReflectionDiscovery {
    pub pool: DescriptorPool,
    pub services: Vec<grpc_schema::ReflectionService>,
}

pub(crate) async fn reflect(config: &Connection) -> Result<ReflectionDiscovery, String> {
    reflection::reflect(config).await
}

#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub(crate) enum Event {
    Started,
    Connected,
    Metadata {
        headers: Vec<(String, String)>,
    },
    Message {
        text: String,
    },
    // Internal completion context; serialized exactly like a normal message.
    #[serde(rename = "message")]
    FinalMessage {
        text: String,
        #[serde(skip)]
        status: Box<Event>,
    },
    #[serde(rename = "error")]
    FinalError {
        message: String,
        #[serde(skip)]
        status: Box<Event>,
    },
    Status {
        #[serde(
            serialize_with = "serialize_status_number",
            skip_serializing_if = "Option::is_none"
        )]
        code: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        details: Option<String>,
        trailers: Vec<(String, String)>,
    },
}
fn serialize_status_number<S: serde::Serializer>(
    code: &Option<f64>,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    let Some(code) = code else {
        return serializer.serialize_none();
    };
    if code.is_finite()
        && code.fract() == 0.0
        && *code >= i64::MIN as f64
        && *code < i64::MAX as f64
    {
        serializer.serialize_i64(*code as i64)
    } else {
        serializer.serialize_f64(*code)
    }
}

enum Callback {
    Message(String),
    Error(String),
}

pub(crate) async fn call<F, Fut>(
    config: &Connection,
    method: MethodDescriptor,
    messages: impl Into<admission::Receiver<DynamicMessage>>,
    mode: grpc_schema::JsonMode,
    deadline: Option<tokio::time::Instant>,
    mut emit: F,
) -> Result<(), String>
where
    F: FnMut(Event) -> Fut,
    Fut: std::future::Future<Output = Result<(), String>>,
{
    let mut receiver = Some(messages.into());
    let mut messages = None;
    let call_setup::Prepared {
        channel,
        session,
        budget,
    } = match call_setup::connect_with(
        config,
        method.parent_service().full_name(),
        method.name(),
        deadline,
        || {
            // Retry storage begins at config selection, before transport READY.
            let input = replay::Input::new(
                receiver.take().expect("Call config selected once"),
                config.resolution_config.retry_budget(),
                true,
            );
            input.0.stage_pending();
            messages = Some(input);
        },
    )
    .await
    {
        Ok(prepared) => prepared,
        Err(error) => {
            // Close producer admission before waiting for renderer status ACK.
            drop(messages);
            drop(receiver);
            let terminal = status_event(error.status()?)?;
            if let Some(callback) = terminal_callback(&terminal) {
                emit(callback).await?;
            }
            return emit(terminal).await;
        }
    };
    let messages = messages.expect("Connected call has selected config");
    let deadline = budget.wire;
    let mut client = tonic::client::Grpc::new(session.channel(channel))
        .max_decoding_message_size(MAX_MESSAGE)
        .max_encoding_message_size(MAX_MESSAGE)
        .accept_compressed(tonic::codec::CompressionEncoding::Gzip)
        .accept_compressed(tonic::codec::CompressionEncoding::Deflate);
    let (unary_response, terminal) = {
        let emit = &mut emit;
        let work = async move {
            let path = format!("/{}/{}", method.parent_service().full_name(), method.name())
                .parse()
                .map_err(|_| "Invalid gRPC method path.")?;
            let headers = metadata(&config.metadata)?;
            emit(Event::Connected).await?;
            let codec = DynamicCodec {
                original: method.output(),
                legacy: !matches!(mode, grpc_schema::JsonMode::ProtoJson),
                output: match mode {
                    grpc_schema::JsonMode::Legacy | grpc_schema::JsonMode::LegacyReflection => {
                        crate::grpc_legacy::legacy_descriptor(method.output())?
                    }
                    grpc_schema::JsonMode::ProtoJson => method.output(),
                },
            };
            // The streaming dispatcher uses the same gRPC wire protocol for every shape;
            // schema-aware IPC restricts sends and response cardinality below.
            let result = retry::streaming_prepared(
                &mut client,
                messages,
                headers,
                path,
                codec,
                session,
                deadline,
            )
            .await;
            let retry::Started {
                mut response,
                mut completion,
            } = match result {
                Ok(response) => response,
                Err(status) => return status_event(status).map(|event| (None, event)),
            };
            // Tonic keeps a successful trailers-only block in response metadata and
            // exposes an empty body with no subsequent trailers.
            let terminal_headers = response
                .extensions()
                .get::<retry::TrailersOnly>()
                .and_then(|_| response.metadata().get("grpc-status"))
                .map(|_| response.metadata().clone());
            // END_STREAM headers are final trailers in grpc-js, not a second
            // initial-metadata event. Keep their values for terminal delivery.
            if terminal_headers.is_none() {
                emit(Event::Metadata {
                    // grpc-js's compression filter consumes these initial
                    // headers after selecting its receive codec. Trailers use
                    // their separate projection and retain ordinary metadata.
                    headers: metadata_rows(response.metadata())?
                        .into_iter()
                        .filter(|(name, _)| {
                            !matches!(name.as_str(), "grpc-encoding" | "grpc-accept-encoding")
                        })
                        .collect(),
                })
                .await?;
            }
            let stream = response.get_mut();
            let mut count = 0;
            let mut unary_response = None;
            loop {
                match stream.message().await {
                    Ok(Some(message)) => {
                        count += 1;
                        if !method.is_server_streaming() && count > 1 {
                            completion.failed();
                            return status_event(Status::unimplemented(
                                "Too many responses received",
                            ))
                            .map(|event| {
                                (
                                    Some(Callback::Error(
                                        "12 UNIMPLEMENTED: Too many responses received".into(),
                                    )),
                                    event,
                                )
                            });
                        }
                        let text = grpc_schema::json_mode(&message, mode, method.output())?;
                        if method.is_server_streaming() {
                            emit(Event::Message { text }).await?;
                        } else {
                            // grpc-js unary/client-stream callbacks publish a
                            // response only after final OK, never before error.
                            unary_response = Some(Callback::Message(text));
                        }
                    }
                    Ok(None) => {
                        completion.succeeded();
                        if !method.is_server_streaming() && count != 1 {
                            // grpc-js reports a unary callback error while
                            // preserving the actual final OK status event.
                            unary_response = Some(Callback::Error(
                                "12 UNIMPLEMENTED: No message received".into(),
                            ));
                        }
                        let trailers = stream
                            .trailers()
                            .await
                            .map_err(|s| s.to_string())?
                            .or(terminal_headers)
                            .unwrap_or_default();
                        return successful_status_event(&trailers)
                            .map(|event| (unary_response, event));
                    }
                    Err(status) => {
                        completion.failed();
                        return status_event(status).map(|event| (None, event));
                    }
                }
            }
        };
        match budget.timer {
            Some(deadline) => match tokio::time::timeout_at(deadline, work).await {
                Ok(result) => result,
                Err(_) => status_event(Status::deadline_exceeded("gRPC deadline exceeded."))
                    .map(|event| (None, event)),
            },
            None => work.await,
        }
    }?;
    // The owned transport/response/replay future is gone before renderer ACK.
    // Terminal delivery belongs to the bridge lifecycle, outside method timeout.
    if let Some(callback) = unary_response {
        let status = Box::new(terminal.clone());
        emit(match callback {
            Callback::Message(text) => Event::FinalMessage { text, status },
            Callback::Error(message) => Event::FinalError { message, status },
        })
        .await?;
    } else if let Some(callback) = terminal_callback(&terminal) {
        emit(callback).await?;
    }
    emit(terminal).await
}

pub(crate) fn terminal_callback(status: &Event) -> Option<Event> {
    let Event::Status { code, details, .. } = status else {
        return None;
    };
    let Some(code) = code else {
        return Some(Event::FinalError {
            message: "undefined undefined: undefined".into(),
            status: Box::new(status.clone()),
        });
    };
    let details = details.as_deref().unwrap_or("undefined");
    // Legacy forwards grpc.error separately, except for explicit cancellation.
    if *code == 0.0 || *code == 1.0 {
        return None;
    }
    let name = if code.fract() == 0.0 && (0.0..=16.0).contains(code) {
        retry::CODES[*code as usize]
    } else {
        "undefined"
    };
    let code = ryu_js::Buffer::new().format(*code).to_owned();
    Some(Event::FinalError {
        message: format!("{code} {name}: {details}"),
        status: Box::new(status.clone()),
    })
}

fn successful_status_event(metadata: &MetadataMap) -> Result<Event, String> {
    let details = metadata
        .get("grpc-message")
        .map(|value| Status::decode_legacy_message(value.as_encoded_bytes()))
        .unwrap_or_default();
    let mut trailers = metadata.clone();
    trailers.remove("grpc-status");
    trailers.remove("grpc-message");
    Ok(Event::Status {
        code: Some(0.0),
        details: Some(details),
        trailers: metadata_rows(&trailers)?,
    })
}

fn status_event(status: Status) -> Result<Event, String> {
    if status.is_legacy_filter_error() {
        return Ok(Event::Status {
            code: None,
            details: None,
            trailers: Vec::new(),
        });
    }
    let mut trailers = metadata_rows(status.metadata())?;
    if !status.details().is_empty() && !status.metadata().contains_key("grpc-status-details-bin") {
        trailers.push((
            "grpc-status-details-bin".into(),
            STANDARD.encode(status.details()),
        ));
    }
    Ok(Event::Status {
        code: Some(status.legacy_code()),
        details: Some(status.message().to_string()),
        trailers,
    })
}

#[cfg(test)]
mod status_tests {
    use super::*;
    use http_body_util::{BodyExt, StreamBody};
    use hyper::{
        body::{Bytes, Frame, Incoming},
        Request as HttpRequest, Response as HttpResponse,
    };
    use hyper_util::rt::{TokioExecutor, TokioIo};
    use std::{
        convert::Infallible,
        io::Write,
        sync::{Arc, Mutex},
    };

    #[test]
    fn successful_status_preserves_encoded_message_and_metadata() {
        let message = "สำเร็จ + 100%";
        let mut status = Status::new(tonic::Code::Ok, message);
        status
            .metadata_mut()
            .append("x-result", "first".parse().unwrap());
        status
            .metadata_mut()
            .append("x-result", "second".parse().unwrap());
        status
            .metadata_mut()
            .insert_bin("proof-bin", MetadataValue::from_bytes(&[0, 255]));
        let mut headers = Default::default();
        status.add_header(&mut headers).unwrap();
        let headers = MetadataMap::from_headers(headers);
        let event = serde_json::to_value(successful_status_event(&headers).unwrap()).unwrap();
        assert_eq!(event["code"], 0);
        assert_eq!(event["details"], message);
        let rows = event["trailers"].as_array().unwrap();
        assert!(rows.contains(&serde_json::json!(["x-result", "first"])));
        assert!(rows.contains(&serde_json::json!(["x-result", "second"])));
        assert!(rows.contains(&serde_json::json!(["proof-bin", "AP8="])));
        assert!(!rows
            .iter()
            .any(|row| row[0] == "grpc-status" || row[0] == "grpc-message"));
        let empty =
            serde_json::to_value(successful_status_event(&MetadataMap::new()).unwrap()).unwrap();
        assert_eq!(empty["details"], "");
        assert_eq!(empty["trailers"], serde_json::json!([]));
        // grpc-js decodeURI retains reserved escapes and falls back atomically
        // on malformed input. Exercise the shared OK/error wire decoder too.
        for (encoded, expected) in [
            (
                "%2f%2F%3F%23%3B%3A%40%26%3D%2B%24%2C",
                "%2f%2F%3F%23%3B%3A%40%26%3D%2B%24%2C",
            ),
            ("ok%20%25%41", "ok %A"),
            ("ok%20%FF", "ok%20%FF"),
            ("ok%20%", "ok%20%"),
            ("%ED%A0%80", "%ED%A0%80"),
            ("%F0%9F%98%80", "😀"),
        ] {
            let mut headers = MetadataMap::new();
            headers.insert("grpc-message", encoded.parse().unwrap());
            let event = serde_json::to_value(successful_status_event(&headers).unwrap()).unwrap();
            assert_eq!(event["details"], expected);
            for code in ["0", "7"] {
                headers.insert("grpc-status", code.parse().unwrap());
                let status = Status::from_header_map(&headers.clone().into_headers()).unwrap();
                assert_eq!(status.code() as i32, code.parse::<i32>().unwrap());
                assert_eq!(status.message(), expected);
            }
        }
        let deadline = Some(tokio::time::Instant::now());
        let timeout = || Status::from_error(Box::new(tonic::TimeoutExpired(())));
        assert_eq!(timeout().code(), tonic::Code::Cancelled);
        assert_eq!(
            retry::deadline_status(timeout(), None).code(),
            tonic::Code::Cancelled
        );
        let mut timed = timeout();
        timed
            .metadata_mut()
            .insert("x-owned", "kept".parse().unwrap());
        let expired = retry::deadline_status(timed, deadline);
        assert_eq!(expired.code(), tonic::Code::DeadlineExceeded);
        assert_eq!(expired.message(), "gRPC deadline exceeded.");
        assert_eq!(expired.metadata().get("x-owned").unwrap(), "kept");
        let peer = retry::deadline_status(Status::cancelled("Timeout expired"), deadline);
        assert_eq!(peer.code(), tonic::Code::Cancelled);
        assert_eq!(peer.message(), "Timeout expired");
        let filter_error = Status::from_legacy_filter_error("owned codec error");
        assert!(filter_error.clone().is_legacy_filter_error());
        assert!(!retry::status_matches(&[2, 7, 14], &filter_error));
        let event = serde_json::to_value(status_event(filter_error).unwrap()).unwrap();
        assert_eq!(event, serde_json::json!({"kind":"status","trailers":[]}));
        for wire in ["17", "-1", "7.5", "NaN", "Infinity", "-Infinity"] {
            let mut headers = tonic::codegen::http::HeaderMap::new();
            headers.insert("grpc-status", wire.parse().unwrap());
            let status = Status::from_header_map(&headers).unwrap();
            assert!(
                !retry::status_matches(&[2, 7, 14], &status),
                "Non-enum status {wire} must not match UNKNOWN retries/hedges"
            );
        }
        for code in [2, 7, 14] {
            assert!(retry::status_matches(
                &[2, 7, 14],
                &Status::new(tonic::Code::from_i32(code), "")
            ));
        }
        for (encoded, canonical) in [
            ("", ""),
            ("A", ""),
            ("A!P8", "AP8="),
            ("-_8", "+/8="),
            ("AP8=ignored", "AP8="),
            ("AP8,AA", "AP8A"),
        ] {
            let mut headers = tonic::codegen::http::HeaderMap::new();
            headers.insert("grpc-status", "7".parse().unwrap());
            headers.insert("grpc-status-details-bin", encoded.parse().unwrap());
            let status = Status::from_header_map(&headers).unwrap();
            assert_eq!(status.code(), tonic::Code::PermissionDenied);
            assert_eq!(STANDARD.encode(status.details()), canonical);
            let event = serde_json::to_value(status_event(status).unwrap()).unwrap();
            assert_eq!(
                event["trailers"],
                serde_json::json!([["grpc-status-details-bin", canonical]])
            );
        }
    }

    #[tokio::test]
    async fn call_preserves_status_messages_over_http2() {
        let pool = grpc_schema::compile(grpc_schema::ProtoInput {
            entry: "status.proto".into(),
            files: vec![grpc_schema::ProtoFile {
                name: "status.proto".into(),
                text: "syntax=\"proto3\"; package owned; message Payload { string value = 1; } service Status { rpc Echo(Payload) returns(Payload); rpc Watch(Payload) returns(stream Payload); }".into(),
            }],
            include_paths: vec![],
        }).unwrap();
        for shape in 0..44 {
            let method_name = if shape == 1 { "Watch" } else { "Echo" };
            let method = pool
                .get_service_by_name("owned.Status")
                .unwrap()
                .methods()
                .find(|method| method.name() == method_name)
                .unwrap();
            let message = match shape {
                2 | 19 | 20 | 22 => "denied + %",
                32 | 33 => "duplicate first, duplicate second",
                5 => "Received HTTP status code 403",
                6 => "Received HTTP status code 200",
                7 => "Received RST_STREAM with code 0 (Call ended without gRPC status)",
                8 | 17 => "Received HTTP status code 503",
                9 => "Bandwidth exhausted or memory limit exceeded",
                10 => "Call cancelled",
                11 => "Connection dropped",
                12 | 16 => "Received message larger than max (20971521 vs 20971520)",
                13 => "Failed to decompress deflate-encoded message",
                37 | 38 | 39 => "Failed to decompress gzip-encoded message",
                40 => "Received message that decompresses to a size larger than 20971520",
                14 => "Failed to decompress gzip-encoded message",
                15 => "Received message that decompresses to a size larger than 20971520",
                21 => "protocol error: received message with compressed-flag but no grpc-encoding was specified",
                18 => "Content is compressed with `owned-unsupported` which isn't supported",
                _ => "สำเร็จ + 100%",
            };
            let code = match shape {
                2 | 5 | 19 | 20 | 22 => tonic::Code::PermissionDenied,
                6 => tonic::Code::Unknown,
                7 => tonic::Code::Internal,
                8 | 17 => tonic::Code::Unavailable,
                9 => tonic::Code::ResourceExhausted,
                10 => tonic::Code::Cancelled,
                11 => tonic::Code::Unavailable,
                12 | 16 => tonic::Code::ResourceExhausted,
                13 | 14 | 21 | 37 | 38 | 39 => tonic::Code::Internal,
                15 | 40 => tonic::Code::ResourceExhausted,
                18 => tonic::Code::Unimplemented,
                _ => tonic::Code::Ok,
            };
            let code = if (23..31).contains(&shape) {
                tonic::Code::Unknown
            } else {
                code
            };
            let mut status = Status::new(code, message);
            status
                .metadata_mut()
                .append("x-result", "first".parse().unwrap());
            status
                .metadata_mut()
                .append("x-result", "second".parse().unwrap());
            let mut trailers = Default::default();
            status.add_header(&mut trailers).unwrap();
            // Preserve the existing success/error wire paths while checking
            // grpc-js Number conversion of legal leading-zero status values.
            if (23..31).contains(&shape) {
                trailers.insert(
                    "grpc-status",
                    [
                        "17",
                        "-1",
                        "7.5",
                        "NaN",
                        "Infinity",
                        "-Infinity",
                        "0x11",
                        "1e2",
                    ][shape - 23]
                        .parse()
                        .unwrap(),
                );
            }
            if matches!(shape, 32 | 33) {
                trailers.insert("grpc-status", "0".parse().unwrap());
                trailers.append("grpc-status", "7".parse().unwrap());
                trailers.insert("grpc-message", "duplicate%20first".parse().unwrap());
                trailers.append("grpc-message", "duplicate%20second".parse().unwrap());
                trailers.append("cookie", "a=1".parse().unwrap());
                trailers.append("cookie", "b=2".parse().unwrap());
                trailers.append("set-cookie", "a=1".parse().unwrap());
                trailers.append("set-cookie", "b=2".parse().unwrap());
                trailers.append("authorization", "first".parse().unwrap());
                trailers.append("authorization", "discarded".parse().unwrap());
                trailers.append("proof-bin", "AP8=".parse().unwrap());
                trailers.append("proof-bin", "AA".parse().unwrap());
            }
            if shape == 1 {
                trailers.insert("grpc-status", "00".parse().unwrap());
            } else if shape == 2 {
                trailers.insert("grpc-status", "007".parse().unwrap());
            }
            if (5..19).contains(&shape) {
                // Distinct missing-status paths reuse this peer and ownership:
                // headers-only, final trailers, clean EOF and invalid HTTP body.
                trailers.remove("grpc-status");
            }
            if shape == 6 {
                // Invalid text metadata is skipped before Number conversion;
                // a Unicode space must not turn a missing status into OK.
                trailers.insert(
                    "grpc-status",
                    tonic::codegen::http::HeaderValue::from_bytes(b"\xc2\xa0").unwrap(),
                );
            }
            // Retain the five original shapes, with malformed binary details
            // on both final-trailer and trailers-only error paths.
            if matches!(shape, 2 | 3) {
                trailers.insert("grpc-status-details-bin", "A!P8".parse().unwrap());
            }
            if shape == 2 {
                trailers.append("grpc-status-details-bin", "AA".parse().unwrap());
            }
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let address = listener.local_addr().unwrap();
            let (headers_seen, headers_ready) = tokio::sync::oneshot::channel();
            let headers_seen = Arc::new(Mutex::new(Some(headers_seen)));
            let server = tokio::spawn(async move {
                let (socket, _) = listener.accept().await.unwrap();
                if matches!(shape, 9..=11) {
                    // Reuse the owned peer to surface a real remote RST_STREAM,
                    // without a grpc-status header or synthetic error value.
                    let mut peer = h2::server::handshake(socket).await.unwrap();
                    let (request, mut response) = peer.accept().await.unwrap().unwrap();
                    assert_eq!(request.uri().path(), format!("/owned.Status/{method_name}"));
                    if shape == 9 {
                        response.send_reset(h2::Reason::ENHANCE_YOUR_CALM);
                    } else {
                        let mut stream = response
                            .send_response(
                                HttpResponse::builder()
                                    .header("content-type", "application/grpc")
                                    .body(())
                                    .unwrap(),
                                false,
                            )
                            .unwrap();
                        // Drive the connection until the actual client metadata
                        // callback observes headers; then reset its body reader.
                        tokio::select! {
                            ready = headers_ready => ready.unwrap(),
                            unexpected = peer.accept() => panic!("Peer closed before metadata: {}", unexpected.is_some()),
                        }
                        if shape == 11 {
                            // Close TCP after observed headers, without a
                            // status, trailers or a peer RST_STREAM.
                            drop(peer);
                            drop(stream);
                            return;
                        }
                        stream.send_reset(h2::Reason::CANCEL);
                    }
                    while peer.accept().await.is_some() {}
                    return;
                }
                let service = hyper::service::service_fn(move |request: HttpRequest<Incoming>| {
                    let trailers = trailers.clone();
                    async move {
                        assert_eq!(request.uri().path(), format!("/owned.Status/{method_name}"));
                        assert_eq!(request.headers().contains_key("grpc-timeout"), shape != 1);
                        if shape == 0 {
                            let timeout = request.headers()["grpc-timeout"].to_str().unwrap();
                            let (value, unit) = timeout.split_at(timeout.len() - 1);
                            let nanos = value.parse::<u128>().unwrap()
                                * match unit {
                                    "H" => 3_600_000_000_000,
                                    "M" => 60_000_000_000,
                                    "S" => 1_000_000_000,
                                    "m" => 1_000_000,
                                    "u" => 1_000,
                                    "n" => 1,
                                    _ => panic!("Invalid timeout unit"),
                                };
                            assert!(
                                nanos > 0 && nanos < 450_000_000,
                                "The renderer ACK wait must be deducted from the 500ms budget"
                            );
                        }
                        if shape == 1 {
                            // The existing streaming case must outlive the
                            // connection timeout when its call has no deadline.
                            tokio::time::sleep(Duration::from_millis(150)).await;
                        }
                        let accepted = request
                            .headers()
                            .get("grpc-accept-encoding")
                            .unwrap()
                            .to_str()
                            .unwrap();
                        assert!(accepted.split(',').any(|encoding| encoding == "deflate"));
                        assert!(accepted.split(',').any(|encoding| encoding == "gzip"));
                        assert_eq!(
                            request
                                .into_body()
                                .collect()
                                .await
                                .unwrap()
                                .to_bytes()
                                .as_ref(),
                            &[0, 0, 0, 0, 0]
                        );
                        let payload = b"\x0a\x05owned";
                        let (encoded, encoding) = match shape {
                            3 => {
                                let mut encoder = flate2::write::ZlibEncoder::new(
                                    Vec::new(),
                                    flate2::Compression::default(),
                                );
                                encoder.write_all(payload).unwrap();
                                (encoder.finish().unwrap(), Some("deflate"))
                            }
                            4 | 15 => {
                                let mut encoder = flate2::write::GzEncoder::new(
                                    Vec::new(),
                                    flate2::Compression::default(),
                                );
                                if shape == 15 {
                                    encoder.write_all(&vec![0; MAX_MESSAGE + 1]).unwrap();
                                } else {
                                    encoder.write_all(payload).unwrap();
                                }
                                (encoder.finish().unwrap(), Some("gzip"))
                            }
                            36..=43 => {
                                let gzip = |bytes: &[u8]| {
                                    let mut encoder = flate2::write::GzEncoder::new(
                                        Vec::new(),
                                        flate2::Compression::default(),
                                    );
                                    encoder.write_all(bytes).unwrap();
                                    encoder.finish().unwrap()
                                };
                                let mut first = gzip(payload);
                                let mut second = gzip(b"\x0a\x04tail");
                                match shape {
                                    37 => {
                                        let crc = second.len() - 8;
                                        second[crc] ^= 1;
                                    }
                                    38 => second.truncate(8),
                                    39 => second = b"junk".to_vec(),
                                    40 => second = gzip(&vec![0; MAX_MESSAGE]),
                                    41 => second = vec![0, 0],
                                    42 => second = b"\0junk".to_vec(),
                                    43 => second.insert(0, 0),
                                    _ => {}
                                }
                                first.extend(second);
                                (first, Some("gzip"))
                            }
                            13 => (vec![0xff; 8], Some("deflate")),
                            14 => (vec![0xff; 8], Some("gzip")),
                            18 | 22 => (payload.to_vec(), Some("owned-unsupported")),
                            20 | 31 => (payload.to_vec(), Some("identity")),
                            _ => (payload.to_vec(), None),
                        };
                        let mut frame = vec![u8::from(encoding.is_some())];
                        frame.extend_from_slice(&(encoded.len() as u32).to_be_bytes());
                        frame.extend_from_slice(&encoded);
                        if matches!(shape, 19..=22) {
                            frame[0] = 1;
                            if shape != 21 {
                                frame.truncate(6);
                            }
                        }
                        if shape == 0 {
                            // Legacy reads every flag other than 1 as raw.
                            frame[0] = 2;
                        }
                        if shape == 8 {
                            frame = vec![2, 0, 0, 0, 0];
                        }
                        if matches!(shape, 12 | 16 | 17) {
                            // Declared overflow must fail before waiting for
                            // or allocating the absent oversized payload.
                            // Shapes16/17 also have compressed-flag1 without an
                            // encoding; framing refusal/HTTP fallback win first.
                            frame = vec![u8::from(shape != 12)];
                            frame.extend_from_slice(&((MAX_MESSAGE + 1) as u32).to_be_bytes());
                        }
                        let trailers_only = matches!(shape, 1 | 2 | 5 | 32);
                        let frames = if matches!(shape, 7 | 8) {
                            vec![Ok::<_, Infallible>(Frame::data(Bytes::from(frame)))]
                        } else if !trailers_only {
                            vec![
                                Ok::<_, Infallible>(Frame::data(Bytes::from(frame))),
                                Ok(Frame::trailers(trailers.clone())),
                            ]
                        } else {
                            vec![]
                        };
                        // Empty reports end-of-stream before headers are sent;
                        // an exhausted StreamBody can instead send a later EOF.
                        let response_body = if trailers_only {
                            http_body_util::Empty::<Bytes>::new().boxed()
                        } else {
                            StreamBody::new(tokio_stream::iter(frames)).boxed()
                        };
                        let mut response = HttpResponse::new(response_body);
                        *response.status_mut() = match shape {
                            5 => tonic::codegen::http::StatusCode::FORBIDDEN,
                            8 | 13 | 17 => tonic::codegen::http::StatusCode::SERVICE_UNAVAILABLE,
                            _ => tonic::codegen::http::StatusCode::OK,
                        };
                        response
                            .headers_mut()
                            .insert("content-type", "application/grpc".parse().unwrap());
                        if matches!(shape, 0 | 34 | 35) {
                            let headers = response.headers_mut();
                            // Initial status is metadata until END_STREAM;
                            // the real final trailers below still carry OK.
                            headers.insert(
                                "grpc-status",
                                match shape {
                                    34 => "0",
                                    35 => "not-a-status",
                                    _ => "007",
                                }
                                .parse()
                                .unwrap(),
                            );
                            if shape == 34 {
                                headers.append("grpc-status", "7".parse().unwrap());
                            }
                            headers.insert("grpc-message", "initial%20%25".parse().unwrap());
                            headers.insert("grpc-encoding", "owned-unsupported".parse().unwrap());
                            headers
                                .insert("grpc-accept-encoding", "identity,gzip".parse().unwrap());
                            headers.append("x-prefix", "kept".parse().unwrap());
                            headers.append(
                                "x-prefix",
                                tonic::codegen::http::HeaderValue::from_bytes(b"\xff").unwrap(),
                            );
                            headers.append("x-prefix", "not-reached".parse().unwrap());
                            headers.insert("x!invalid", "not-admitted".parse().unwrap());
                        }
                        if let Some(encoding) = encoding {
                            response
                                .headers_mut()
                                .insert("grpc-encoding", encoding.parse().unwrap());
                        }
                        if matches!(shape, 1 | 2) {
                            // Trailers-only status does not pass through the
                            // compression filter, even with unknown encoding.
                            response
                                .headers_mut()
                                .insert("grpc-encoding", "owned-unsupported".parse().unwrap());
                        }
                        if trailers_only {
                            response.headers_mut().extend(trailers);
                        }
                        Ok::<_, Infallible>(response)
                    }
                });
                let _ = hyper::server::conn::http2::Builder::new(TokioExecutor::new())
                    .serve_connection(TokioIo::new(socket), service)
                    .await;
            });
            let mut config: Connection = serde_json::from_value(serde_json::json!({
                // Keep the original 100ms connection-budget control numeric;
                // it intentionally cannot wait for the 250ms family fallback.
                // The other existing shapes exercise OS DNS against this same
                // IPv4-only peer, including IPv6-to-IPv4 fallback if supplied.
                "url": if shape == 1 { format!("grpc://{address}") } else { format!("grpc://localhost:{}", address.port()) }, "timeoutMs": if shape == 1 { 100 } else { 3000 }
            }))
            .unwrap();
            if shape == 1 {
                config.deadline_ms = Some(0);
                assert_eq!(config.call_deadline(), None);
            } else if shape == 0 {
                config.deadline_ms = Some(500);
                assert_eq!(config.call_deadline(), Some(Duration::from_millis(500)));
            } else {
                assert_eq!(config.call_deadline(), Some(Duration::from_millis(3000)));
            }
            let (sender, receiver) = mpsc::channel(1);
            sender
                .send(DynamicMessage::new(method.input()))
                .await
                .unwrap();
            drop(sender);
            let events = Arc::new(Mutex::new(Vec::new()));
            let observed = events.clone();
            let result = tokio::time::timeout(
                Duration::from_secs(5),
                call(
                    &config,
                    method,
                    receiver,
                    grpc_schema::JsonMode::ProtoJson,
                    config
                        .call_deadline()
                        .map(|duration| tokio::time::Instant::now() + duration),
                    move |event| {
                        let connected = matches!(&event, Event::Connected);
                        if matches!(&event, Event::Metadata { .. }) {
                            if let Some(ready) = headers_seen.lock().unwrap().take() {
                                let _ = ready.send(());
                            }
                        }
                        observed
                            .lock()
                            .unwrap()
                            .push(serde_json::to_value(event).unwrap());
                        async move {
                            if shape == 0 && connected {
                                tokio::time::sleep(Duration::from_millis(100)).await;
                            }
                            Ok(())
                        }
                    },
                ),
            )
            .await;
            // Retire only this owned in-process peer, including failed calls.
            server.abort();
            let _ = server.await;
            result.unwrap().unwrap();
            let events = events.lock().unwrap();
            assert_eq!(
                events
                    .iter()
                    .filter(|event| event["kind"] == "message")
                    .count(),
                if matches!(shape, 0 | 3 | 4 | 34 | 35 | 36 | 41 | 42 | 43) {
                    1
                } else {
                    0
                },
                "shape {shape}: {events:?}"
            );
            if matches!(shape, 0 | 3 | 4 | 34 | 35 | 36 | 41 | 42 | 43) {
                let data = events
                    .iter()
                    .find(|event| event["kind"] == "message")
                    .unwrap();
                let body: serde_json::Value =
                    serde_json::from_str(data["text"].as_str().unwrap()).unwrap();
                assert_eq!(body["value"], if shape == 36 { "tail" } else { "owned" });
            }
            let terminal = events.last().unwrap();
            for metadata in events.iter().filter(|event| event["kind"] == "metadata") {
                assert!(
                    metadata["headers"].as_array().unwrap().iter().all(|row| {
                        row[0] != "grpc-encoding" && row[0] != "grpc-accept-encoding"
                    }),
                    "Compression filter headers leaked in shape {shape}: {metadata:?}"
                );
            }
            assert_eq!(
                events
                    .iter()
                    .filter(|event| event["kind"] == "metadata")
                    .count(),
                if matches!(shape, 1 | 2 | 5 | 9 | 32) {
                    0
                } else {
                    1
                },
                "shape {shape}: {events:?}"
            );
            assert_eq!(terminal["kind"], "status");
            if matches!(shape, 0 | 34 | 35) {
                let metadata = events
                    .iter()
                    .find(|event| event["kind"] == "metadata")
                    .unwrap()["headers"]
                    .as_array()
                    .unwrap();
                assert!(metadata.contains(&serde_json::json!(["grpc-message", "initial%20%25"])));
                assert!(metadata.contains(&serde_json::json!([
                    "grpc-status",
                    match shape {
                        34 => "0, 7",
                        35 => "not-a-status",
                        _ => "007",
                    }
                ])));
                assert_eq!(
                    metadata
                        .iter()
                        .filter(|row| row[0] == "x-prefix")
                        .collect::<Vec<_>>(),
                    Vec::<&serde_json::Value>::new()
                );
                assert!(!metadata.iter().any(|row| row[0] == "x!invalid"));
            }
            let expected_code = if matches!(shape, 18 | 21 | 31 | 32 | 33) {
                serde_json::Value::Null
            } else if (23..31).contains(&shape) {
                [
                    serde_json::json!(17),
                    serde_json::json!(-1),
                    serde_json::json!(7.5),
                    serde_json::Value::Null,
                    serde_json::Value::Null,
                    serde_json::Value::Null,
                    serde_json::json!(17),
                    serde_json::json!(100),
                ][shape - 23]
                    .clone()
            } else {
                serde_json::json!(code as i32)
            };
            assert_eq!(terminal["code"], expected_code, "shape {shape}: {events:?}");
            if (23..31).contains(&shape) {
                let code_text = [
                    "17",
                    "-1",
                    "7.5",
                    "NaN",
                    "Infinity",
                    "-Infinity",
                    "17",
                    "100",
                ][shape - 23];
                let error = events
                    .iter()
                    .find(|event| event["kind"] == "error")
                    .unwrap();
                assert_eq!(
                    error["message"],
                    format!("{code_text} undefined: {message}")
                );
            }
            if matches!(shape, 18 | 21 | 31) {
                assert!(terminal.get("code").is_none());
                assert!(terminal.get("details").is_none());
                let error = events
                    .iter()
                    .find(|event| event["kind"] == "error")
                    .unwrap();
                assert_eq!(error["message"], "undefined undefined: undefined");
            } else {
                assert_eq!(terminal["details"], message);
            }
            let rows = terminal["trailers"].as_array().unwrap();
            assert!(!rows.iter().any(|row| row[0] == "grpc-status"));
            assert_eq!(
                rows.iter().any(|row| row[0] == "grpc-message"),
                matches!(shape, 5 | 6)
            );
            if shape < 7
                || matches!(shape, 19 | 20 | 22 | 32 | 33 | 34 | 35 | 36 | 41 | 42 | 43)
                || (23..31).contains(&shape)
            {
                assert!(rows.contains(&serde_json::json!(["x-result", "first, second"])));
            } else {
                assert!(rows.is_empty());
            }
            if matches!(shape, 32 | 33) {
                assert!(rows.contains(&serde_json::json!(["cookie", "a=1; b=2"])));
                assert!(rows.contains(&serde_json::json!(["set-cookie", "a=1"])));
                assert!(rows.contains(&serde_json::json!(["set-cookie", "b=2"])));
                assert!(rows.contains(&serde_json::json!(["authorization", "first"])));
                assert!(!rows
                    .iter()
                    .any(|row| row[0] == "authorization" && row[1] == "discarded"));
                assert_eq!(
                    rows.iter()
                        .filter(|row| row[0] == "proof-bin")
                        .cloned()
                        .collect::<Vec<_>>(),
                    vec![
                        serde_json::json!(["proof-bin", "AP8="]),
                        serde_json::json!(["proof-bin", "AA=="])
                    ]
                );
            }
            if matches!(shape, 2 | 3) {
                assert_eq!(
                    rows.iter()
                        .filter(|row| row[0] == "grpc-status-details-bin")
                        .cloned()
                        .collect::<Vec<_>>(),
                    if shape == 2 {
                        vec![serde_json::json!(["grpc-status-details-bin", "AP8A"])]
                    } else {
                        vec![serde_json::json!(["grpc-status-details-bin", "AP8="])]
                    }
                );
            }
        }
    }
    #[tokio::test]
    async fn graceful_goaway_notifies_ready_owner_before_active_body_finishes() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let (release, mut goaway) = tokio::sync::oneshot::channel::<()>();
        let server = tokio::spawn(async move {
            let (socket, _) = listener.accept().await.unwrap();
            let mut peer: h2::server::Connection<_, Bytes> =
                h2::server::handshake(socket).await.unwrap();
            let (request, mut respond) = peer.accept().await.unwrap().unwrap();
            let _body = request.into_body();
            let _stream = respond
                .send_response(HttpResponse::builder().status(200).body(()).unwrap(), false)
                .unwrap();
            tokio::select! { result=&mut goaway=>result.unwrap(), unexpected=peer.accept()=>panic!("Unexpected stream before GOAWAY: {}",unexpected.is_some()) }
            peer.graceful_shutdown();
            while peer.accept().await.is_some() {}
            std::future::poll_fn(|cx| peer.poll_closed(cx))
                .await
                .unwrap();
        });
        let endpoint =
            tonic::transport::Endpoint::from_shared(format!("http://{address}")).unwrap();
        let mut service =
            endpoint.connect_with_connector_ready_lazy(tower::service_fn(move |_| async move {
                tokio::net::TcpStream::connect(address)
                    .await
                    .map(TokioIo::new)
            }));
        let mut connectivity = service.connectivity();
        tower::ServiceExt::ready(&mut service).await.unwrap();
        let mut response = tower::Service::call(
            &mut service,
            HttpRequest::builder()
                .uri("/owned/hold")
                .body(tonic::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
        assert_eq!(
            connectivity.borrow().state,
            tonic::transport::ConnectivityState::Ready
        );
        connectivity.borrow_and_update();
        release.send(()).unwrap();
        let disconnected = tokio::time::timeout(Duration::from_millis(1000), async {
            loop {
                connectivity.changed().await.unwrap();
                if connectivity.borrow().state != tonic::transport::ConnectivityState::Ready {
                    break;
                }
            }
        })
        .await;
        let still_open =
            tokio::time::timeout(Duration::from_millis(100), response.body_mut().frame())
                .await
                .is_err();
        drop(response);
        drop(service);
        server.abort();
        let _ = server.await;
        assert!(
            still_open,
            "Graceful GOAWAY must keep the active response open"
        );
        assert!(
            disconnected.is_ok(),
            "GOAWAY must retire READY before the active response drains"
        );
    }
}
