use crate::grpc_schema::{self, DynamicCodec, MAX_MESSAGE, MAX_SCHEMA};
use base64::{
    engine::general_purpose::{STANDARD, STANDARD_NO_PAD},
    Engine,
};
use prost_reflect::{DescriptorPool, DynamicMessage, MethodDescriptor};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use tonic::{
    metadata::{Ascii, Binary, KeyAndValueRef, MetadataKey, MetadataMap, MetadataValue},
    transport::{Certificate, Channel, ClientTlsConfig, Endpoint, Identity},
    Request, Status,
};

#[cfg(test)]
#[path = "grpc_reflection_arrival_tests.rs"]
mod arrival_tests;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub url: String,
    #[serde(default)]
    pub metadata: Vec<(String, String)>,
    pub timeout_ms: u64,
    pub ca_pem: Option<String>,
    pub ca_file: Option<String>,
    pub(crate) ca_asset: Option<crate::client_certificates::PortableCertificateAsset>,
    pub identity_pem: Option<String>,
    #[serde(default)]
    pub(crate) client_certificates: Vec<crate::client_certificates::ClientCertificateSource>,
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
        let name = name.to_ascii_lowercase();
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
                // HTTP/2 peers may join duplicate binary values with commas.
                // Decode each value separately, accepting both base64 padding forms.
                for encoded in v.as_encoded_bytes().split(|b| *b == b',') {
                    let encoded = encoded.trim_ascii();
                    let bytes = STANDARD
                        .decode(encoded)
                        .or_else(|_| STANDARD_NO_PAD.decode(encoded))
                        .map_err(|_| "Server sent invalid binary gRPC metadata.")?;
                    rows.push((k.to_string(), STANDARD.encode(bytes)));
                }
            }
        }
    }
    Ok(rows)
}

pub(crate) async fn channel(config: &Connection) -> Result<Channel, String> {
    let lower = config.url.to_ascii_lowercase();
    let url = if lower.starts_with("grpcs://") {
        let host = &config.url[8..];
        format!("https://{host}")
    } else if lower.starts_with("grpc://") {
        let host = &config.url[7..];
        format!("http://{host}")
    } else if config.url.contains("://") {
        config.url.clone()
    } else {
        format!("http://{}", config.url)
    };
    let url = reqwest::Url::parse(&url).map_err(|_| "Invalid gRPC endpoint.")?;
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
        .connect_timeout(Duration::from_millis(config.timeout_ms.clamp(1, 3_600_000)))
        .user_agent(concat!("Insomnium/", env!("CARGO_PKG_VERSION")))
        .map_err(|_| "Invalid gRPC user agent.")?;
    if url.scheme() == "https" {
        let ca = crate::client_certificates::load_ca_certificate(
            config.ca_file.as_deref(),
            config.ca_pem.as_deref(),
            config.ca_asset.as_ref(),
        )?;
        let mut tls = ClientTlsConfig::new();
        if !ca.replace_roots {
            tls = tls.with_webpki_roots();
        }
        if let Some(pem) = ca.pem {
            if pem.len() > 1024 * 1024 {
                return Err("gRPC CA exceeds 1 MiB.".into());
            }
            tls = tls.ca_certificate(Certificate::from_pem(&pem));
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
        endpoint = endpoint
            .tls_config(tls)
            .map_err(|_| "Invalid gRPC TLS configuration.")?;
    }
    endpoint
        .connect()
        .await
        .map_err(|e| format!("Could not connect to gRPC endpoint: {e}"))
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

#[derive(Serialize)]
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
    Status {
        code: i32,
        details: String,
        trailers: Vec<(String, String)>,
    },
}

pub(crate) async fn call<F, Fut>(
    config: &Connection,
    method: MethodDescriptor,
    messages: mpsc::Receiver<DynamicMessage>,
    mode: grpc_schema::JsonMode,
    mut emit: F,
) -> Result<(), String>
where
    F: FnMut(Event) -> Fut,
    Fut: std::future::Future<Output = Result<(), String>>,
{
    let channel = channel(config).await?;
    let mut client = tonic::client::Grpc::new(channel)
        .max_decoding_message_size(MAX_MESSAGE)
        .max_encoding_message_size(MAX_MESSAGE)
        .accept_compressed(tonic::codec::CompressionEncoding::Gzip)
        .accept_compressed(tonic::codec::CompressionEncoding::Deflate);
    client
        .ready()
        .await
        .map_err(|e| format!("gRPC connection is not ready: {e}"))?;
    let path = format!("/{}/{}", method.parent_service().full_name(), method.name())
        .parse()
        .map_err(|_| "Invalid gRPC method path.")?;
    let mut request = Request::new(ReceiverStream::new(messages));
    *request.metadata_mut() = metadata(&config.metadata)?;
    request.set_timeout(Duration::from_millis(config.timeout_ms.clamp(1, 3_600_000)));
    emit(Event::Connected).await?;
    // The streaming dispatcher uses the same gRPC wire protocol for every shape;
    // schema-aware IPC restricts sends and response cardinality below.
    let result = client
        .streaming(
            request,
            path,
            DynamicCodec {
                output: match mode {
                    grpc_schema::JsonMode::Legacy | grpc_schema::JsonMode::LegacyReflection => {
                        crate::grpc_legacy::legacy_descriptor(method.output())?
                    }
                    grpc_schema::JsonMode::ProtoJson => method.output(),
                },
            },
        )
        .await;
    let mut response = match result {
        Ok(response) => response,
        Err(status) => return emit(status_event(status)?).await,
    };
    // Tonic keeps a successful trailers-only block in response metadata and
    // exposes an empty body with no subsequent trailers.
    let terminal_headers = response
        .metadata()
        .get("grpc-status")
        .map(|_| response.metadata().clone());
    emit(Event::Metadata {
        headers: metadata_rows(response.metadata())?,
    })
    .await?;
    let stream = response.get_mut();
    let mut count = 0;
    loop {
        match stream.message().await {
            Ok(Some(message)) => {
                count += 1;
                if !method.is_server_streaming() && count > 1 {
                    return Err("Server sent multiple messages for a unary response.".into());
                }
                emit(Event::Message {
                    text: grpc_schema::json_mode(&message, mode, method.output())?,
                })
                .await?;
            }
            Ok(None) => {
                if !method.is_server_streaming() && count != 1 {
                    return Err("Server completed without the required response message.".into());
                }
                let trailers = stream
                    .trailers()
                    .await
                    .map_err(|s| s.to_string())?
                    .or(terminal_headers)
                    .unwrap_or_default();
                return emit(successful_status_event(&trailers)?).await;
            }
            Err(status) => return emit(status_event(status)?).await,
        }
    }
}

fn successful_status_event(metadata: &MetadataMap) -> Result<Event, String> {
    let details = metadata
        .get("grpc-message")
        .map(|value| {
            percent_encoding::percent_decode(value.as_encoded_bytes())
                .decode_utf8_lossy()
                .into_owned()
        })
        .unwrap_or_default();
    Ok(Event::Status {
        code: 0,
        details,
        trailers: metadata_rows(metadata)?,
    })
}

fn status_event(status: Status) -> Result<Event, String> {
    let mut trailers = metadata_rows(status.metadata())?;
    if !status.details().is_empty() {
        trailers.push((
            "grpc-status-details-bin".into(),
            STANDARD.encode(status.details()),
        ));
    }
    Ok(Event::Status {
        code: status.code() as i32,
        details: status.message().to_string(),
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
        let empty =
            serde_json::to_value(successful_status_event(&MetadataMap::new()).unwrap()).unwrap();
        assert_eq!(empty["details"], "");
        assert_eq!(empty["trailers"], serde_json::json!([]));
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
        for shape in 0..5 {
            let method_name = if shape == 1 { "Watch" } else { "Echo" };
            let method = pool
                .get_service_by_name("owned.Status")
                .unwrap()
                .methods()
                .find(|method| method.name() == method_name)
                .unwrap();
            let message = if shape == 2 {
                "denied + %"
            } else {
                "สำเร็จ + 100%"
            };
            let code = if shape == 2 {
                tonic::Code::PermissionDenied
            } else {
                tonic::Code::Ok
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
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let address = listener.local_addr().unwrap();
            let server = tokio::spawn(async move {
                let (socket, _) = listener.accept().await.unwrap();
                let service = hyper::service::service_fn(move |request: HttpRequest<Incoming>| {
                    let trailers = trailers.clone();
                    async move {
                        assert_eq!(request.uri().path(), format!("/owned.Status/{method_name}"));
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
                            4 => {
                                let mut encoder = flate2::write::GzEncoder::new(
                                    Vec::new(),
                                    flate2::Compression::default(),
                                );
                                encoder.write_all(payload).unwrap();
                                (encoder.finish().unwrap(), Some("gzip"))
                            }
                            _ => (payload.to_vec(), None),
                        };
                        let mut frame = vec![u8::from(encoding.is_some())];
                        frame.extend_from_slice(&(encoded.len() as u32).to_be_bytes());
                        frame.extend_from_slice(&encoded);
                        let trailers_only = matches!(shape, 1 | 2);
                        let frames = if !trailers_only {
                            vec![
                                Ok::<_, Infallible>(Frame::data(Bytes::from(frame))),
                                Ok(Frame::trailers(trailers.clone())),
                            ]
                        } else {
                            vec![]
                        };
                        let mut response =
                            HttpResponse::new(StreamBody::new(tokio_stream::iter(frames)));
                        response
                            .headers_mut()
                            .insert("content-type", "application/grpc".parse().unwrap());
                        if let Some(encoding) = encoding {
                            response
                                .headers_mut()
                                .insert("grpc-encoding", encoding.parse().unwrap());
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
            let config: Connection = serde_json::from_value(serde_json::json!({
                "url": format!("grpc://{address}"), "timeoutMs": 3000
            }))
            .unwrap();
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
                    move |event| {
                        observed
                            .lock()
                            .unwrap()
                            .push(serde_json::to_value(event).unwrap());
                        async { Ok(()) }
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
                if matches!(shape, 1 | 2) { 0 } else { 1 }
            );
            if !matches!(shape, 1 | 2) {
                let data = events
                    .iter()
                    .find(|event| event["kind"] == "message")
                    .unwrap();
                let body: serde_json::Value =
                    serde_json::from_str(data["text"].as_str().unwrap()).unwrap();
                assert_eq!(body["value"], "owned");
            }
            let terminal = events.last().unwrap();
            assert_eq!(terminal["kind"], "status");
            assert_eq!(terminal["code"], code as i32);
            assert_eq!(terminal["details"], message);
            let rows = terminal["trailers"].as_array().unwrap();
            assert!(rows.contains(&serde_json::json!(["x-result", "first"])));
            assert!(rows.contains(&serde_json::json!(["x-result", "second"])));
        }
    }
}
