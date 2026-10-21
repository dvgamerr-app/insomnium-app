//! Resolve a saved-file protobuf.js root as a group, rather than requiring
//! protoc's dependency-first, per-file visibility rules. ProtoJSON is separate.
use crate::grpc_schema::MAX_SCHEMA;
use prost::Message;
use prost_reflect::{DescriptorPool, DynamicMessage, Kind, Value};
use std::collections::{BTreeSet, HashMap};

// 256 supplied files + eleven common files + one inline declaration owner.
const MAX_FILES: usize = 268;
// Short temporary names keep all-to-all linking metadata below 512 KiB.
const LINK_OVERHEAD: usize = 512 * 1024;

fn record<'a>(message: &'a mut DynamicMessage, path: &[i32]) -> Option<&'a mut DynamicMessage> {
    let Some((&number, rest)) = path.split_first() else {
        return Some(message);
    };
    match message.get_field_by_number_mut(u32::try_from(number).ok()?)? {
        Value::Message(child) => record(child, rest),
        Value::List(children) => {
            let (&index, rest) = rest.split_first()?;
            match children.get_mut(usize::try_from(index).ok()?)? {
                Value::Message(child) => record(child, rest),
                _ => None,
            }
        }
        _ => None,
    }
}

fn reference(
    record: &mut DynamicMessage,
    field: &str,
    full_name: &str,
    owner: &str,
    indices: &HashMap<String, usize>,
    needed: &mut BTreeSet<usize>,
) -> Result<(), String> {
    record.set_field_by_name(field, Value::String(format!(".{full_name}")));
    needed.insert(*indices.get(owner).ok_or("Missing gRPC type owner.")?);
    Ok(())
}

fn field_kind(
    record: &mut DynamicMessage,
    kind: Kind,
    indices: &HashMap<String, usize>,
    needed: &mut BTreeSet<usize>,
) -> Result<(), String> {
    match kind {
        Kind::Message(message) => {
            reference(
                record,
                "type_name",
                message.full_name(),
                message.parent_file().name(),
                indices,
                needed,
            )?;
            // Groups use message descriptors but retain their distinct wire type.
            if !matches!(
                record.get_field_by_name("type").as_deref(),
                Some(Value::EnumNumber(10))
            ) {
                record.set_field_by_name("type", Value::EnumNumber(11));
            }
        }
        Kind::Enum(enumeration) => {
            reference(
                record,
                "type_name",
                enumeration.full_name(),
                enumeration.parent_file().name(),
                indices,
                needed,
            )?;
            record.set_field_by_name("type", Value::EnumNumber(14));
        }
        _ => {}
    }
    Ok(())
}

pub(crate) fn link(files: Vec<prost_types::FileDescriptorProto>) -> Result<DescriptorPool, String> {
    if files.is_empty() || files.len() > MAX_FILES {
        return Err("Prepared gRPC source count exceeds its budget.".into());
    }
    let names: Vec<_> = files.iter().map(|file| file.name().to_owned()).collect();
    let original_indices: HashMap<_, _> = names
        .iter()
        .cloned()
        .enumerate()
        .map(|(i, name)| (name, i))
        .collect();
    if original_indices.len() != files.len() {
        return Err("Duplicate prepared gRPC source.".into());
    }
    let temporary: Vec<_> = (0..files.len()).map(|index| format!("i{index}")).collect();
    let indices: HashMap<_, _> = temporary
        .iter()
        .cloned()
        .enumerate()
        .map(|(i, name)| (name, i))
        .collect();
    let original_dependencies: Vec<_> = files.iter().map(|file| file.dependency.clone()).collect();
    let mut batch = files;
    for (index, file) in batch.iter_mut().enumerate() {
        file.name = Some(temporary[index].clone());
        file.dependency = temporary
            .iter()
            .enumerate()
            .filter(|(i, _)| *i != index)
            .map(|(_, name)| name.clone())
            .collect();
        file.public_dependency.clear();
        file.weak_dependency.clear();
    }
    let pool =
        DescriptorPool::from_file_descriptor_set(prost_types::FileDescriptorSet { file: batch })
            .map_err(|error| {
                let name = error
                    .file()
                    .and_then(|name| indices.get(name))
                    .map(|index| names[*index].as_str());
                match name {
                    Some(name) => format!("{name}: {error}"),
                    None => error.to_string(),
                }
            })?;
    if pool.encode_to_vec().len() > MAX_SCHEMA + LINK_OVERHEAD {
        return Err("Compiled descriptors exceed 8 MiB.".into());
    }
    let descriptor = DescriptorPool::global()
        .get_message_by_name("google.protobuf.FileDescriptorProto")
        .ok_or("Missing protobuf descriptor definition.")?;
    let mut messages = vec![Vec::new(); names.len()];
    for message in pool.all_messages() {
        let index = *indices
            .get(message.parent_file().name())
            .ok_or("Missing gRPC message owner.")?;
        messages[index].push(message);
    }
    let mut extensions = vec![Vec::new(); names.len()];
    for extension in pool.all_extensions() {
        let index = *indices
            .get(extension.parent_file().name())
            .ok_or("Missing gRPC extension owner.")?;
        extensions[index].push(extension);
    }
    let mut encoded = Vec::new();
    for (index, original) in original_dependencies.iter().enumerate() {
        let file = pool
            .get_file_by_name(&temporary[index])
            .ok_or("Missing linked gRPC source.")?;
        // Decode the encoded descriptor, not its prost_types projection: custom
        // option extension bytes must survive the name/dependency rewrite.
        let mut restored =
            DynamicMessage::decode(descriptor.clone(), file.encode_to_vec().as_slice())
                .map_err(|error| error.to_string())?;
        let mut needed = BTreeSet::new();
        let mut dependencies = Vec::new();
        for dependency in original {
            let owner = *original_indices
                .get(dependency)
                .ok_or("Missing gRPC import.")?;
            if owner != index && !needed.contains(&owner) {
                needed.insert(owner);
                dependencies.push(owner);
            }
        }
        for message in &messages[index] {
            for field in message.fields() {
                let record =
                    record(&mut restored, field.path()).ok_or("Missing gRPC field descriptor.")?;
                field_kind(record, field.kind(), &indices, &mut needed)?;
            }
        }
        for extension in &extensions[index] {
            let record = record(&mut restored, extension.path())
                .ok_or("Missing gRPC extension descriptor.")?;
            let extendee = extension.containing_message();
            reference(
                record,
                "extendee",
                extendee.full_name(),
                extendee.parent_file().name(),
                &indices,
                &mut needed,
            )?;
            field_kind(record, extension.kind(), &indices, &mut needed)?;
        }
        for service in file.services() {
            for method in service.methods() {
                let record = record(&mut restored, method.path())
                    .ok_or("Missing gRPC method descriptor.")?;
                let input = method.input();
                reference(
                    record,
                    "input_type",
                    input.full_name(),
                    input.parent_file().name(),
                    &indices,
                    &mut needed,
                )?;
                let output = method.output();
                reference(
                    record,
                    "output_type",
                    output.full_name(),
                    output.parent_file().name(),
                    &indices,
                    &mut needed,
                )?;
            }
        }
        needed.remove(&index);
        for owner in needed {
            if !dependencies.contains(&owner) {
                dependencies.push(owner);
            }
        }
        restored.set_field_by_name("name", Value::String(names[index].clone()));
        restored.set_field_by_name(
            "dependency",
            Value::List(
                dependencies
                    .into_iter()
                    .map(|owner| Value::String(names[owner].clone()))
                    .collect(),
            ),
        );
        restored.set_field_by_name("public_dependency", Value::List(Vec::new()));
        restored.set_field_by_name("weak_dependency", Value::List(Vec::new()));
        let bytes = restored.encode_to_vec();
        encoded.push(0x0a);
        prost::encoding::encode_varint(bytes.len() as u64, &mut encoded);
        encoded.extend(bytes);
        if encoded.len() > MAX_SCHEMA {
            return Err("Compiled descriptors exceed 8 MiB.".into());
        }
    }
    DescriptorPool::decode(encoded.as_slice()).map_err(|error| error.to_string())
}
