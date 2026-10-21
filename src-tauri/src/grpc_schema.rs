use base64::{engine::general_purpose::STANDARD, Engine};
use prost::Message;
use prost_reflect::{
    DescriptorPool, DynamicMessage, MessageDescriptor, MethodDescriptor, ReflectMessage,
    SerializeOptions,
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
    #[serde(skip)]
    LegacyReflection,
}
impl JsonMode {
    pub(crate) fn from_schema(self, reflection: bool) -> Self {
        match (self, reflection) {
            (Self::Legacy, true) => Self::LegacyReflection,
            _ => self,
        }
    }
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
    legacy: bool,
    common: HashMap<String, prost_types::FileDescriptorProto>,
    parsed: HashMap<String, prost_types::FileDescriptorProto>,
    order: Vec<String>,
}
impl FileResolver for MemoryFiles {
    fn open_file(&self, name: &str) -> Result<File, protox::Error> {
        if valid_name(name) {
            if let Some(descriptor) = self.common.get(name) {
                return Ok(File::from_file_descriptor_proto(descriptor.clone()));
            }
            if self.legacy {
                if let Some(bundled) = self.bundled(name) {
                    return self
                        .common
                        .get(bundled)
                        .cloned()
                        .map(File::from_file_descriptor_proto)
                        .ok_or_else(|| protox::Error::file_not_found(name));
                }
            }
            if let Some(text) = self.files.get(name) {
                return self.source(name, text);
            }
            for include in &self.includes {
                if let Some(text) = self.files.get(&format!("{include}/{name}")) {
                    return self.source(name, text);
                }
            }
            if !self.legacy {
                return GoogleFileResolver::new().open_file(name);
            }
        }
        Err(protox::Error::file_not_found(name))
    }
}

fn bundled_file(name: &str) -> Result<File, protox::Error> {
    // proto-loader 0.7.13 registers these definitions from protobuf.js 7.2.4.
    // Keep them independent of prost's newer descriptor/type schema versions.
    let source = match name {
        "google/protobuf/api.proto" => include_str!("../vendor/protobufjs-google/api.proto"),
        "google/protobuf/descriptor.proto" => {
            include_str!("../vendor/protobufjs-google/descriptor.proto")
        }
        "google/protobuf/source_context.proto" => {
            include_str!("../vendor/protobufjs-google/source_context.proto")
        }
        "google/protobuf/type.proto" => include_str!("../vendor/protobufjs-google/type.proto"),
        _ => return GoogleFileResolver::new().open_file(name),
    };
    File::from_source(name, source)
}

// protobuf.js Root.load selects common definitions by the last matching suffix,
// before fetching an entry or resolving an import. compiler/plugin is not common.
fn bundled_name(name: &str) -> Option<&'static str> {
    let name = &name[name.rfind("google/protobuf/")?..];
    [
        "google/protobuf/any.proto",
        "google/protobuf/api.proto",
        "google/protobuf/descriptor.proto",
        "google/protobuf/duration.proto",
        "google/protobuf/empty.proto",
        "google/protobuf/field_mask.proto",
        "google/protobuf/source_context.proto",
        "google/protobuf/struct.proto",
        "google/protobuf/timestamp.proto",
        "google/protobuf/type.proto",
        "google/protobuf/wrappers.proto",
    ]
    .into_iter()
    .find(|candidate| *candidate == name)
}

impl MemoryFiles {
    fn source_name(&self, name: &str) -> Option<&str> {
        self.files
            .get_key_value(name)
            .or_else(|| {
                self.includes
                    .iter()
                    .find_map(|include| self.files.get_key_value(&format!("{include}/{name}")))
            })
            .map(|(name, _)| name.as_str())
    }

    fn resolved_name(&self, name: &str) -> Option<String> {
        if self.common.contains_key(name) {
            Some(name.to_owned())
        } else if let Some(name) = self.bundled(name) {
            Some(name.to_owned())
        } else {
            self.source_name(name).map(str::to_owned)
        }
    }

    fn text(&self, name: &str) -> Option<&str> {
        self.files
            .get(name)
            .or_else(|| {
                self.includes
                    .iter()
                    .find_map(|include| self.files.get(&format!("{include}/{name}")))
            })
            .map(String::as_str)
    }

    fn prepare_common(&mut self, entry: &str) -> Result<(), String> {
        use std::collections::{HashSet, VecDeque};
        let mut queue = VecDeque::from([entry.to_owned()]);
        let mut seen = HashSet::new();
        let mut selected = Vec::new();
        while let Some(name) = queue.pop_front() {
            let name = self.resolved_name(&name).unwrap_or(name);
            if !seen.insert(name.clone()) || !valid_name(&name) {
                continue;
            }
            if let Some(common) = self.bundled(&name) {
                if !selected.contains(&common) {
                    selected.push(common);
                    self.order.push(common.to_owned());
                }
                // Common JSON has inline declarations, not .proto imports.
                continue;
            }
            if let Some(text) = self.text(&name) {
                let file = self
                    .source(&name, text)
                    .map_err(|error| error.to_string())?;
                queue.extend(file.file_descriptor_proto().dependency.iter().cloned());
                self.order.push(name.clone());
                self.parsed
                    .insert(name, file.file_descriptor_proto().clone());
            }
        }
        if selected.is_empty() {
            return Ok(());
        }
        let open = |name: &str| bundled_file(name).map_err(|error| error.to_string());
        let mut declarations = HashSet::new();
        for name in &selected {
            let file = open(name)?;
            let descriptor = file.file_descriptor_proto();
            let mut names: Vec<_> = descriptor
                .message_type
                .iter()
                .filter_map(|m| m.name.as_deref())
                .chain(
                    descriptor
                        .enum_type
                        .iter()
                        .filter_map(|e| e.name.as_deref()),
                )
                .collect();
            let inline: &[&str] = match *name {
                "google/protobuf/api.proto" => &["SourceContext", "Option", "Syntax"],
                "google/protobuf/type.proto" => &["Any", "SourceContext"],
                _ => &[],
            };
            for name in inline {
                if !names.contains(name) {
                    names.push(name);
                }
            }
            for name in names {
                if !declarations.insert(name.to_owned()) {
                    return Err(format!(
                        "Duplicate bundled protobuf declaration 'google.protobuf.{name}'."
                    ));
                }
            }
        }
        // Inline definitions share global references in common JSON. Place
        // them together without introducing other common files' declarations.
        // Overlapping definitions are rejected above, as Root.addJSON does.
        // No reachable source imports or supplied file may resolve this name.
        let mut suffix = 0;
        let shared_name = loop {
            let candidate = format!("insomnium-legacy-common-{suffix}.proto");
            if !seen.contains(&candidate) && self.text(&candidate).is_none() {
                break candidate;
            }
            suffix += 1;
        };
        let api = selected.contains(&"google/protobuf/api.proto");
        let types = selected.contains(&"google/protobuf/type.proto");
        let context = api || types || selected.contains(&"google/protobuf/source_context.proto");
        let any = types || selected.contains(&"google/protobuf/any.proto");
        let mut shared = prost_types::FileDescriptorProto {
            name: Some(shared_name.clone()),
            package: Some("google.protobuf".into()),
            syntax: Some("proto3".into()),
            ..Default::default()
        };
        if context {
            let file = open("google/protobuf/source_context.proto")?;
            let mut message = file.file_descriptor_proto().message_type[0].clone();
            // The inline JSON declaration already uses this name, unlike the
            // keepCase source prototype used to construct the descriptor.
            message.field[0].name = Some("fileName".into());
            message.field[0].json_name = Some("fileName".into());
            shared.message_type.push(message);
        }
        if api || types {
            let file = open("google/protobuf/type.proto")?;
            let descriptor = file.file_descriptor_proto();
            shared.message_type.extend(
                descriptor
                    .message_type
                    .iter()
                    .filter(|message| message.name.as_deref() == Some("Option"))
                    .cloned(),
            );
            shared.enum_type.extend(
                descriptor
                    .enum_type
                    .iter()
                    .filter(|enumeration| enumeration.name.as_deref() == Some("Syntax"))
                    .cloned(),
            );
        }
        if any {
            let file = open("google/protobuf/any.proto")?;
            shared
                .message_type
                .extend(file.file_descriptor_proto().message_type.iter().cloned());
        }
        let has_shared = !shared.message_type.is_empty() || !shared.enum_type.is_empty();
        for name in selected {
            let file = open(name)?;
            let mut descriptor = file.file_descriptor_proto().clone();
            descriptor.dependency.clear();
            descriptor.public_dependency.clear();
            descriptor.weak_dependency.clear();
            descriptor.source_code_info = None;
            descriptor.message_type.retain(|message| {
                !matches!(
                    message.name.as_deref(),
                    Some("SourceContext" | "Option" | "Any")
                )
            });
            descriptor
                .enum_type
                .retain(|enumeration| enumeration.name.as_deref() != Some("Syntax"));
            if has_shared {
                descriptor.dependency.push(shared_name.clone());
                descriptor.public_dependency.push(0);
            }
            self.common.insert(name.into(), descriptor);
        }
        if has_shared {
            self.order.push(shared_name.clone());
            self.common.insert(shared_name, shared);
        }
        Ok(())
    }

    fn link(mut self, entry: &str) -> Result<DescriptorPool, String> {
        if self.order.is_empty() {
            return Err(protox::Error::file_not_found(entry).to_string());
        }
        let available: std::collections::HashSet<_> = self
            .common
            .keys()
            .chain(self.parsed.keys())
            .cloned()
            .collect();
        let mut files = Vec::new();
        for name in self.order.clone() {
            let mut descriptor = self
                .common
                .remove(&name)
                .or_else(|| self.parsed.remove(&name))
                .ok_or("Missing prepared gRPC source.")?;
            let weak: std::collections::HashSet<_> =
                descriptor.weak_dependency.iter().copied().collect();
            let mut dependencies = Vec::new();
            for (index, dependency) in descriptor.dependency.iter().enumerate() {
                let resolved = if available.contains(dependency) {
                    Some(dependency.clone())
                } else {
                    self.resolved_name(dependency)
                        .filter(|name| available.contains(name))
                };
                if let Some(resolved) = resolved {
                    if resolved != name && !dependencies.contains(&resolved) {
                        dependencies.push(resolved);
                    }
                } else if !weak.contains(&(index as i32)) {
                    return Err(protox::Error::file_not_found(dependency).to_string());
                }
            }
            descriptor.dependency = dependencies;
            // Root.load uses a global namespace; public imports do not gate
            // visibility. Missing weak imports have already been omitted.
            descriptor.public_dependency.clear();
            descriptor.weak_dependency.clear();
            if let Some(info) = &mut descriptor.source_code_info {
                info.location
                    .retain(|location| !matches!(location.path.first(), Some(3 | 10 | 11)));
            }
            files.push(descriptor);
        }
        crate::grpc_legacy_schema::link(files)
    }

    fn bundled(&self, name: &str) -> Option<&'static str> {
        if let Some(name) = bundled_name(name) {
            return Some(name);
        }
        if self.files.contains_key(name) {
            return None;
        }
        for include in &self.includes {
            let candidate = format!("{include}/{name}");
            if self.files.contains_key(&candidate) {
                return bundled_name(&candidate);
            }
        }
        None
    }

    fn source(&self, name: &str, text: &str) -> Result<File, protox::Error> {
        let file = File::from_source(name, text)?;
        if !self.legacy {
            return Ok(file);
        }
        let original = file.file_descriptor_proto();
        let mut dependencies = Vec::new();
        let mut indices = HashMap::new();
        let mut remap = Vec::new();
        let mut strong = std::collections::HashSet::new();
        let weak_imports: std::collections::HashSet<_> =
            original.weak_dependency.iter().copied().collect();
        for (index, dependency) in original.dependency.iter().enumerate() {
            let dependency = self.bundled(dependency).unwrap_or(dependency);
            let next = dependencies.len() as i32;
            let mapped = *indices.entry(dependency).or_insert_with(|| {
                dependencies.push(dependency.to_owned());
                next
            });
            remap.push(mapped);
            if !weak_imports.contains(&(index as i32)) {
                strong.insert(mapped);
            }
        }
        if dependencies == original.dependency {
            return Ok(file);
        }
        // Aliases can collapse imports. Remap public/weak indices and their
        // source locations as well; a strong occurrence wins over a weak one.
        let reindex = |old: &[i32], weak: bool| {
            let mut result = Vec::new();
            let mut positions = HashMap::new();
            let positions: Vec<Option<i32>> = old
                .iter()
                .map(|index| {
                    let index = remap[*index as usize];
                    if weak && strong.contains(&index) {
                        return None;
                    }
                    Some(*positions.entry(index).or_insert_with(|| {
                        result.push(index);
                        (result.len() - 1) as i32
                    }))
                })
                .collect();
            (result, positions)
        };
        let (public, public_positions) = reindex(&original.public_dependency, false);
        let (weak, weak_positions) = reindex(&original.weak_dependency, true);
        let mut descriptor = original.clone();
        descriptor.dependency = dependencies;
        descriptor.public_dependency = public;
        descriptor.weak_dependency = weak;
        if let Some(info) = &mut descriptor.source_code_info {
            info.location.retain_mut(|location| {
                if location.path.len() < 2 {
                    return true;
                }
                let old = location.path[1] as usize;
                let mapped = match location.path[0] {
                    3 => remap.get(old).copied(),
                    10 => public_positions.get(old).copied().flatten(),
                    11 => weak_positions.get(old).copied().flatten(),
                    _ => return true,
                };
                if let Some(mapped) = mapped {
                    location.path[1] = mapped;
                    true
                } else {
                    false
                }
            });
        }
        Ok(File::from_file_descriptor_proto(descriptor))
    }
}

fn valid_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 1024
        && !name.contains(['\\', ':', '\0'])
        && name.split('/').all(|part| !matches!(part, "" | "." | ".."))
}

#[cfg(test)]
pub(crate) fn compile(input: ProtoInput) -> Result<DescriptorPool, String> {
    compile_mode(input, JsonMode::Legacy)
}

pub(crate) fn compile_mode(input: ProtoInput, mode: JsonMode) -> Result<DescriptorPool, String> {
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
    let legacy = matches!(mode, JsonMode::Legacy);
    let mut resolver = MemoryFiles {
        files: files.clone(),
        includes: input.include_paths.clone(),
        legacy,
        common: HashMap::new(),
        parsed: HashMap::new(),
        order: Vec::new(),
    };
    if legacy {
        resolver
            .prepare_common(&input.entry)
            .map_err(|error| error.to_string())?;
    }
    let pool = if legacy {
        resolver.link(&input.entry)?
    } else {
        let mut compiler = protox::Compiler::with_file_resolver(resolver);
        compiler
            .include_imports(true)
            .include_source_info(false)
            .open_file(&input.entry)
            .map_err(|error| error.to_string())?;
        compiler.descriptor_pool().clone()
    };
    if pool.encode_to_vec().len() > MAX_SCHEMA {
        return Err("Compiled descriptors exceed 8 MiB.".into());
    }
    if legacy {
        // Ignored common-file text must not supply lexical defaults for the
        // bundled descriptors during the later annotation pass.
        files.retain(|name, _| bundled_name(name).is_none());
    }
    crate::grpc_defaults::annotate(pool, &files, &input.include_paths)
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
    pub reflection: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub reflection_services: Vec<ReflectionService>,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReflectionService {
    pub name: String,
    pub files: Vec<String>,
}
pub(crate) fn describe(pool: &DescriptorPool, mode: JsonMode) -> Result<Schema, String> {
    describe_with_examples(pool, mode, false, &[])
}
pub(crate) fn describe_reflection(pool: &DescriptorPool, mode: JsonMode) -> Result<Schema, String> {
    describe_with_examples(pool, mode, true, &[])
}
pub(crate) fn describe_reflection_services(
    pool: &DescriptorPool,
    services: &[ReflectionService],
    mode: JsonMode,
) -> Result<Schema, String> {
    if services.is_empty() {
        describe_reflection(pool, mode)
    } else {
        describe_with_examples(pool, mode, true, services)
    }
}
pub(crate) fn reflection_pool(
    pool: &DescriptorPool,
    files: &[String],
) -> Result<DescriptorPool, String> {
    if files.len() > 1024
        || files
            .iter()
            .fold(0usize, |size, name| size.saturating_add(name.len()))
            > MAX_SCHEMA
    {
        return Err("Reflected service file index exceeds its budget.".into());
    }
    let mut seen = std::collections::HashSet::new();
    let mut selected = Vec::new();
    for name in files {
        if !seen.insert(name) {
            return Err("Duplicate reflected service file.".into());
        }
        let file = pool
            .get_file_by_name(name)
            .ok_or("Reflected service file is missing.")?;
        selected.push(file.file_descriptor_proto().clone());
    }
    DescriptorPool::from_file_descriptor_set(prost_types::FileDescriptorSet { file: selected })
        .map_err(|error| format!("Invalid reflected service schema: {error}"))
}
pub(crate) fn reflection_method(
    pool: &DescriptorPool,
    path: &str,
    files: Option<&[String]>,
) -> Result<MethodDescriptor, String> {
    match files {
        Some(files) => method(&reflection_pool(pool, files)?, path),
        None => method(pool, path),
    }
}
fn describe_with_examples(
    pool: &DescriptorPool,
    mode: JsonMode,
    reflection: bool,
    reflection_services: &[ReflectionService],
) -> Result<Schema, String> {
    let bytes = pool.encode_to_vec();
    if bytes.len() > MAX_SCHEMA {
        return Err("Descriptors exceed 8 MiB.".into());
    }
    let mut methods = Vec::new();
    let mut method_bytes = 0usize;
    if reflection_services.len() > 1024 {
        return Err("Reflection exceeds 1024 services.".into());
    }
    let mut service_names = std::collections::HashSet::new();
    let mut index_bytes = 0usize;
    for scope in reflection_services {
        if !service_names.insert(&scope.name) {
            return Err("Duplicate reflected service scope.".into());
        }
        index_bytes = scope.files.iter().fold(
            index_bytes.saturating_add(scope.name.len()),
            |size, name| size.saturating_add(name.len()),
        );
        if index_bytes > MAX_SCHEMA {
            return Err("Reflected service index exceeds 8 MiB.".into());
        }
    }
    let scopes: Vec<_> = if reflection_services.is_empty() {
        pool.services()
            .map(|s| (s.full_name().to_string(), None))
            .collect()
    } else {
        reflection_services
            .iter()
            .map(|s| (s.name.clone(), Some(s.files.as_slice())))
            .collect()
    };
    for (name, files) in scopes {
        let scoped_pool;
        let selected_pool = if let Some(files) = files {
            scoped_pool = reflection_pool(pool, files)?;
            &scoped_pool
        } else {
            pool
        };
        let service = selected_pool
            .get_service_by_name(&name)
            .ok_or("Reflection omitted a listed service descriptor.")?;
        for method in service.methods() {
            if methods.len() >= 4096 {
                return Err("Schema exceeds 4096 methods.".into());
            }
            // Any needs an application-selected type URL; one unconstructible
            // default must not hide every service in an otherwise valid schema.
            let generated = if reflection {
                crate::grpc_example::generate(method.input(), mode)
            } else {
                crate::grpc_example::generate_saved(method.input(), mode)
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
        reflection,
        reflection_services: reflection_services.to_vec(),
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
        JsonMode::LegacyReflection => {
            let view = crate::grpc_legacy::legacy_descriptor(desc.clone())?;
            crate::grpc_legacy::parse_prepared_profile(view, desc, text, true)
        }
        JsonMode::ProtoJson => parse(desc, text),
    }
}
pub(crate) fn parse_prepared_mode(
    view: MessageDescriptor,
    original: MessageDescriptor,
    text: &str,
    mode: JsonMode,
) -> Result<DynamicMessage, String> {
    match mode {
        JsonMode::Legacy => crate::grpc_legacy::parse_prepared(view, original, text),
        JsonMode::LegacyReflection => {
            crate::grpc_legacy::parse_prepared_profile(view, original, text, true)
        }
        JsonMode::ProtoJson => parse(original, text),
    }
}
pub(crate) fn json_mode(
    message: &DynamicMessage,
    mode: JsonMode,
    original: MessageDescriptor,
) -> Result<String, String> {
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
            crate::grpc_legacy::LegacyMessage(message, 0, original).serialize(&mut serializer)
        }
        JsonMode::LegacyReflection => {
            crate::grpc_legacy::ReflectionMessage(message, 0, original).serialize(&mut serializer)
        }
        JsonMode::ProtoJson => {
            // Reflection examples may have been validated in the legacy view.
            // Restore standard map/oneof descriptors before ProtoJSON rendering.
            let restored;
            let message = if message.descriptor() != original {
                if message.encoded_len() > MAX_MESSAGE {
                    return Err("gRPC message exceeds 20 MiB.".into());
                }
                restored = DynamicMessage::decode(original, message.encode_to_vec().as_slice())
                    .map_err(|error| format!("Could not restore ProtoJSON descriptors: {error}"))?;
                &restored
            } else {
                message
            };
            message.serialize_with_options(
                &mut serializer,
                &SerializeOptions::new()
                    .use_proto_field_name(true)
                    .skip_default_fields(false),
            )
        }
    }
    .map_err(|e| format!("Could not display gRPC message: {e}"))?;
    String::from_utf8(bytes.0).map_err(|_| "Invalid gRPC JSON encoding.".into())
}

#[derive(Clone)]
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
                tonic::Status::internal(
                    "Response message parsing error: Response does not match the selected protobuf type.",
                )
            })
    }
}
