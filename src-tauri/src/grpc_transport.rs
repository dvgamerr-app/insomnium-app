use crate::grpc_schema::{self, DynamicCodec, MAX_MESSAGE, MAX_SCHEMA};
use base64::{
    engine::general_purpose::{STANDARD, STANDARD_NO_PAD},
    Engine,
};
use prost::Message;
use prost_reflect::{DescriptorPool, DynamicMessage, MethodDescriptor};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, time::Duration};
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use tonic::{
    metadata::{Ascii, Binary, KeyAndValueRef, MetadataKey, MetadataMap, MetadataValue},
    transport::{Certificate, Channel, ClientTlsConfig, Endpoint, Identity},
    Request, Status,
};

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub url: String,
    #[serde(default)]
    pub metadata: Vec<(String, String)>,
    pub timeout_ms: u64,
    pub ca_pem: Option<String>,
    pub identity_pem: Option<String>,
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
        let mut tls = ClientTlsConfig::new().with_webpki_roots();
        if let Some(pem) = config.ca_pem.as_ref().filter(|p| !p.is_empty()) {
            if pem.len() > 1024 * 1024 {
                return Err("gRPC CA exceeds 1 MiB.".into());
            }
            tls = tls.ca_certificate(Certificate::from_pem(pem));
        }
        if let Some(pem) = config.identity_pem.as_ref().filter(|p| !p.is_empty()) {
            if pem.len() > 1024 * 1024 {
                return Err("gRPC identity exceeds 1 MiB.".into());
            }
            tls = tls.identity(Identity::from_pem(pem, pem));
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
pub(crate) async fn reflect(config: &Connection) -> Result<DescriptorPool, String> {
    let channel = channel(config).await?;
    match reflect_version(channel.clone(), config, "v1").await {
        Err(error) if error.code() == tonic::Code::Unimplemented => {
            reflect_version(channel, config, "v1alpha")
                .await
                .map_err(|e| e.to_string())
        }
        result => result.map_err(|e| e.to_string()),
    }
}

async fn reflect_version(
    channel: Channel,
    config: &Connection,
    version: &str,
) -> Result<DescriptorPool, Status> {
    use tonic_reflection::pb::v1::{
        server_reflection_request::MessageRequest, server_reflection_response::MessageResponse,
        ServerReflectionRequest, ServerReflectionResponse,
    };
    let mut client = tonic::client::Grpc::new(channel)
        .max_decoding_message_size(MAX_SCHEMA)
        .max_encoding_message_size(MAX_SCHEMA);
    client
        .ready()
        .await
        .map_err(|_| Status::unavailable("Reflection connection is not ready."))?;
    let (sender, receiver) = mpsc::channel(1);
    let request_for = |message_request| ServerReflectionRequest {
        host: String::new(),
        message_request: Some(message_request),
    };
    sender
        .send(request_for(MessageRequest::ListServices(String::new())))
        .await
        .map_err(|_| Status::cancelled("Reflection closed."))?;
    let mut request = Request::new(ReceiverStream::new(receiver));
    *request.metadata_mut() = metadata(&config.metadata).map_err(Status::invalid_argument)?;
    request.set_timeout(Duration::from_millis(config.timeout_ms.clamp(1, 3_600_000)));
    let path = format!("/grpc.reflection.{version}.ServerReflection/ServerReflectionInfo")
        .parse()
        .map_err(|_| Status::internal("Invalid reflection path."))?;
    let codec =
        tonic_prost::ProstCodec::<ServerReflectionRequest, ServerReflectionResponse>::default();
    let mut response = client.streaming(request, path, codec).await?.into_inner();
    let initial = response
        .message()
        .await?
        .ok_or_else(|| Status::internal("Reflection ended before service list."))?;
    if initial
        .original_request
        .as_ref()
        .and_then(|r| r.message_request.as_ref())
        != Some(&MessageRequest::ListServices(String::new()))
    {
        return Err(Status::internal(
            "Reflection service list does not match the request.",
        ));
    }
    let services = match initial.message_response {
        Some(MessageResponse::ListServicesResponse(list)) => list.service,
        Some(MessageResponse::ErrorResponse(error)) => {
            return Err(Status::new(
                tonic::Code::from_i32(error.error_code),
                error.error_message,
            ))
        }
        _ => {
            return Err(Status::internal(
                "Invalid reflection service-list response.",
            ))
        }
    };
    if services.len() > 1024 {
        return Err(Status::resource_exhausted(
            "Reflection exceeds 1024 services.",
        ));
    }
    let mut pending: std::collections::VecDeque<MessageRequest> = services
        .iter()
        .map(|s| MessageRequest::FileContainingSymbol(s.name.clone()))
        .collect();
    let mut files = HashMap::new();
    let mut queries = 0;
    let mut total = 0usize;
    while let Some(query) = pending.pop_front() {
        if let MessageRequest::FileByFilename(name) = &query {
            if files.contains_key(name) {
                continue;
            }
        }
        queries += 1;
        if queries > 4096 {
            return Err(Status::resource_exhausted(
                "Too many reflection dependencies.",
            ));
        }
        sender
            .send(request_for(query.clone()))
            .await
            .map_err(|_| Status::cancelled("Reflection closed."))?;
        let reply = response
            .message()
            .await?
            .ok_or_else(|| Status::internal("Reflection ended before descriptors."))?;
        if reply
            .original_request
            .as_ref()
            .and_then(|r| r.message_request.as_ref())
            != Some(&query)
        {
            return Err(Status::internal(
                "Reflection response does not match the pending request.",
            ));
        }
        let descriptors = match reply.message_response {
            Some(MessageResponse::FileDescriptorResponse(files)) => files.file_descriptor_proto,
            Some(MessageResponse::ErrorResponse(error)) => {
                return Err(Status::new(
                    tonic::Code::from_i32(error.error_code),
                    error.error_message,
                ))
            }
            _ => return Err(Status::internal("Invalid reflection descriptor response.")),
        };
        for bytes in descriptors {
            total = total.saturating_add(bytes.len());
            if total > MAX_SCHEMA {
                return Err(Status::resource_exhausted(
                    "Reflection descriptors exceed 8 MiB.",
                ));
            }
            let descriptor = prost_types::FileDescriptorProto::decode(bytes.as_slice())
                .map_err(|_| Status::internal("Malformed reflected descriptor."))?;
            let name = descriptor
                .name
                .clone()
                .ok_or_else(|| Status::internal("Reflected descriptor has no name."))?;
            if let Some(previous) = files.get(&name) {
                if previous != &descriptor {
                    return Err(Status::internal("Conflicting reflected descriptors."));
                }
            } else {
                for dependency in &descriptor.dependency {
                    pending.push_back(MessageRequest::FileByFilename(dependency.clone()));
                }
                files.insert(name, descriptor);
                if files.len() > 1024 {
                    return Err(Status::resource_exhausted("Reflection exceeds 1024 files."));
                }
            }
        }
    }
    drop(sender);
    let pool = DescriptorPool::from_file_descriptor_set(prost_types::FileDescriptorSet {
        file: files.into_values().collect(),
    })
    .map_err(|e| Status::internal(format!("Invalid reflected schema: {e}")))?;
    if services
        .iter()
        .any(|service| pool.get_service_by_name(&service.name).is_none())
    {
        return Err(Status::internal(
            "Reflection omitted a listed service descriptor.",
        ));
    }
    Ok(pool)
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
        .accept_compressed(tonic::codec::CompressionEncoding::Gzip);
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
                output: method.output(),
            },
        )
        .await;
    let mut response = match result {
        Ok(response) => response,
        Err(status) => return emit(status_event(status)?).await,
    };
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
                    text: grpc_schema::json_mode(&message, mode)?,
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
                    .map(|m| metadata_rows(&m))
                    .transpose()?
                    .unwrap_or_default();
                return emit(Event::Status {
                    code: 0,
                    details: String::new(),
                    trailers,
                })
                .await;
            }
            Err(status) => return emit(status_event(status)?).await,
        }
    }
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
