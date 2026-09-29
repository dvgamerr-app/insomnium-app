use base64::{engine::general_purpose::STANDARD, Engine};
use prost::Message;
use prost_reflect::{
    DescriptorPool, DynamicMessage, MessageDescriptor, MethodDescriptor, SerializeOptions,
};
use protox::file::{File, FileResolver, GoogleFileResolver};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub(crate) const MAX_SCHEMA: usize = 8 * 1024 * 1024;
pub(crate) const MAX_MESSAGE: usize = 20 * 1024 * 1024;

#[derive(Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum JsonMode {
    #[default]
    Legacy,
    ProtoJson,
}

#[derive(Deserialize)]
pub struct ProtoFile {
    pub name: String,
    pub text: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtoInput {
    pub entry: String,
    pub files: Vec<ProtoFile>,
    #[serde(default)]
    pub include_paths: Vec<String>,
}

struct MemoryFiles {
    files: HashMap<String, String>,
    includes: Vec<String>,
}
impl FileResolver for MemoryFiles {
    fn open_file(&self, name: &str) -> Result<File, protox::Error> {
        if valid_name(name) {
            if let Some(text) = self.files.get(name) {
                return File::from_source(name, text);
            }
            for include in &self.includes {
                if let Some(text) = self.files.get(&format!("{include}/{name}")) {
                    return File::from_source(name, text);
                }
            }
            return GoogleFileResolver::new().open_file(name);
        }
        Err(protox::Error::file_not_found(name))
    }
}

fn valid_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 1024
        && !name.contains(['\\', ':', '\0'])
        && name.split('/').all(|part| !matches!(part, "" | "." | ".."))
}

pub(crate) fn compile(input: ProtoInput) -> Result<DescriptorPool, String> {
    if !valid_name(&input.entry)
        || input.files.is_empty()
        || input.files.len() > 256
        || input.include_paths.len() > 256
        || input.include_paths.iter().any(|p| !valid_name(p))
    {
        return Err(
            "Choose a relative proto entry and at most 256 files/include directories.".into(),
        );
    }
    let mut total = 0usize;
    let mut files = HashMap::new();
    for file in input.files {
        total = total.saturating_add(file.text.len());
        if !valid_name(&file.name) || file.text.len() > 2 * 1024 * 1024 || total > MAX_SCHEMA {
            return Err(
                "Proto files require relative names, at most 2 MiB each and 8 MiB combined.".into(),
            );
        }
        if files.insert(file.name, file.text).is_some() {
            return Err("Duplicate proto file name.".into());
        }
    }
    let mut compiler = protox::Compiler::with_file_resolver(MemoryFiles {
        files,
        includes: input.include_paths,
    });
    compiler
        .include_imports(true)
        .include_source_info(false)
        .open_file(input.entry)
        .map_err(|e| e.to_string())?;
    let pool = compiler.descriptor_pool();
    if pool.encode_to_vec().len() > MAX_SCHEMA {
        return Err("Compiled descriptors exceed 8 MiB.".into());
    }
    Ok(pool)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MethodInfo {
    pub path: String,
    pub input_type: String,
    pub output_type: String,
    pub client_streaming: bool,
    pub server_streaming: bool,
    pub example: String,
    pub example_error: Option<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Schema {
    pub descriptor_set: String,
    pub methods: Vec<MethodInfo>,
}
pub(crate) fn describe(pool: &DescriptorPool, mode: JsonMode) -> Result<Schema, String> {
    describe_with_examples(pool, mode, false)
}
pub(crate) fn describe_reflection(pool: &DescriptorPool, mode: JsonMode) -> Result<Schema, String> {
    describe_with_examples(pool, mode, true)
}
fn describe_with_examples(
    pool: &DescriptorPool,
    mode: JsonMode,
    reflection: bool,
) -> Result<Schema, String> {
    let bytes = pool.encode_to_vec();
    if bytes.len() > MAX_SCHEMA {
        return Err("Descriptors exceed 8 MiB.".into());
    }
    let mut methods = Vec::new();
    let mut method_bytes = 0usize;
    for service in pool.services() {
        for method in service.methods() {
            if methods.len() >= 4096 {
                return Err("Schema exceeds 4096 methods.".into());
            }
            // Any needs an application-selected type URL; one unconstructible
            // default must not hide every service in an otherwise valid schema.
            let generated = if reflection {
                crate::grpc_example::generate(method.input(), mode)
            } else {
                json_mode(&DynamicMessage::new(method.input()), mode)
            };
            let (example, example_error) = match generated {
                Ok(example) => (example, None),
                Err(error) => ("{}".into(), Some(error)),
            };
            let info = MethodInfo {
                path: format!("/{}/{}", service.full_name(), method.name()),
                input_type: method.input().full_name().into(),
                output_type: method.output().full_name().into(),
                client_streaming: method.is_client_streaming(),
                server_streaming: method.is_server_streaming(),
                example,
                example_error,
            };
            method_bytes = method_bytes.saturating_add(
                info.path.len()
                    + info.input_type.len()
                    + info.output_type.len()
                    + info.example.len()
                    + info.example_error.as_ref().map_or(0, String::len),
            );
            if method_bytes > MAX_SCHEMA {
                return Err("Method descriptions exceed 8 MiB.".into());
            }
            methods.push(info);
        }
    }
    Ok(Schema {
        descriptor_set: STANDARD.encode(bytes),
        methods,
    })
}

pub(crate) fn decode(encoded: &str) -> Result<DescriptorPool, String> {
    if encoded.len() > MAX_SCHEMA.div_ceil(3) * 4 {
        return Err("Descriptors exceed 8 MiB.".into());
    }
    let bytes = STANDARD
        .decode(encoded)
        .map_err(|_| "Invalid descriptor base64.")?;
    if bytes.len() > MAX_SCHEMA {
        return Err("Descriptors exceed 8 MiB.".into());
    }
    DescriptorPool::decode(bytes.as_slice()).map_err(|e| format!("Invalid descriptors: {e}"))
}
pub(crate) fn method(pool: &DescriptorPool, path: &str) -> Result<MethodDescriptor, String> {
    let (service, method) = path
        .strip_prefix('/')
        .and_then(|p| p.split_once('/'))
        .ok_or("Choose a gRPC service/method.")?;
    pool.get_service_by_name(service)
        .and_then(|s| s.methods().find(|m| m.name() == method))
        .ok_or_else(|| "Selected gRPC method is not in this schema.".into())
}
pub(crate) fn parse(desc: MessageDescriptor, text: &str) -> Result<DynamicMessage, String> {
    if text.len() > MAX_MESSAGE {
        return Err("gRPC JSON message exceeds 20 MiB.".into());
    }
    let mut deserializer = serde_json::Deserializer::from_str(text);
    let message = DynamicMessage::deserialize(desc, &mut deserializer)
        .map_err(|e| format!("Invalid gRPC message: {e}"))?;
    deserializer
        .end()
        .map_err(|_| "Unexpected data after gRPC message.")?;
    if message.encoded_len() > MAX_MESSAGE {
        return Err("gRPC message exceeds 20 MiB.".into());
    }
    Ok(message)
}
pub(crate) fn parse_mode(
    desc: MessageDescriptor,
    text: &str,
    mode: JsonMode,
) -> Result<DynamicMessage, String> {
    match mode {
        JsonMode::Legacy => crate::grpc_legacy::parse(desc, text),
        JsonMode::ProtoJson => parse(desc, text),
    }
}
pub(crate) fn json_mode(message: &DynamicMessage, mode: JsonMode) -> Result<String, String> {
    struct LimitedJson(Vec<u8>);
    impl std::io::Write for LimitedJson {
        fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
            if bytes.len() > MAX_MESSAGE.saturating_sub(self.0.len()) {
                return Err(std::io::Error::other("gRPC JSON response exceeds 20 MiB."));
            }
            self.0.extend_from_slice(bytes);
            Ok(bytes.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    let mut bytes = LimitedJson(Vec::new());
    let mut serializer = serde_json::Serializer::new(&mut bytes);
    match mode {
        JsonMode::Legacy => {
            crate::grpc_legacy::LegacyMessage(message, 0).serialize(&mut serializer)
        }
        JsonMode::ProtoJson => message.serialize_with_options(
            &mut serializer,
            &SerializeOptions::new()
                .use_proto_field_name(true)
                .skip_default_fields(false),
        ),
    }
    .map_err(|e| format!("Could not display gRPC message: {e}"))?;
    String::from_utf8(bytes.0).map_err(|_| "Invalid gRPC JSON encoding.".into())
}

pub(crate) struct DynamicCodec {
    pub output: MessageDescriptor,
}
pub(crate) struct DynamicEncoder;
pub(crate) struct DynamicDecoder(MessageDescriptor);
impl tonic::codec::Codec for DynamicCodec {
    type Encode = DynamicMessage;
    type Decode = DynamicMessage;
    type Encoder = DynamicEncoder;
    type Decoder = DynamicDecoder;
    fn encoder(&mut self) -> Self::Encoder {
        DynamicEncoder
    }
    fn decoder(&mut self) -> Self::Decoder {
        DynamicDecoder(self.output.clone())
    }
}
impl tonic::codec::Encoder for DynamicEncoder {
    type Item = DynamicMessage;
    type Error = tonic::Status;
    fn encode(
        &mut self,
        item: Self::Item,
        dst: &mut tonic::codec::EncodeBuf<'_>,
    ) -> Result<(), Self::Error> {
        if item.encoded_len() > MAX_MESSAGE {
            return Err(tonic::Status::resource_exhausted(
                "gRPC message exceeds 20 MiB.",
            ));
        }
        item.encode(dst)
            .map_err(|_| tonic::Status::internal("Could not encode gRPC message."))
    }
}
impl tonic::codec::Decoder for DynamicDecoder {
    type Item = DynamicMessage;
    type Error = tonic::Status;
    fn decode(
        &mut self,
        src: &mut tonic::codec::DecodeBuf<'_>,
    ) -> Result<Option<Self::Item>, Self::Error> {
        DynamicMessage::decode(self.0.clone(), src)
            .map(Some)
            .map_err(|_| {
                tonic::Status::internal("Response does not match the selected protobuf type.")
            })
    }
}
