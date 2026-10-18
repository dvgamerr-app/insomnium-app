//! Request samples inspired by the original Insomnium automock.
//! Kept separate from response serialization and never applied to saved bodies.
use crate::grpc_schema::{self, JsonMode};
use prost_reflect::{FieldDescriptor, Kind, MessageDescriptor};
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};

const MAX_EXAMPLE: usize = 128 * 1024;

/// Convert the reflected entry-array sample through the codec before exposing
/// saved-proto JSON (whose maps use objects rather than reflected entry arrays).
pub(crate) fn generate_saved(desc: MessageDescriptor, mode: JsonMode) -> Result<String, String> {
    let canonical = generate(desc.clone(), JsonMode::ProtoJson)?;
    let parsed = grpc_schema::parse_mode(desc.clone(), &canonical, JsonMode::ProtoJson)?;
    let mut result = grpc_schema::json_mode(&parsed, mode, desc.clone())?;
    if matches!(mode, JsonMode::Legacy) {
        let mut value: Value = serde_json::from_str(&result).map_err(|e| e.to_string())?;
        request_shape(&mut value, Kind::Message(desc.clone()), 0)?;
        result = serde_json::to_string(&value).map_err(|e| e.to_string())?;
    }
    if result.len() > MAX_EXAMPLE {
        return Err("Rendered example exceeds 128 KiB.".into());
    }
    grpc_schema::parse_mode(desc, &result, mode)?;
    Ok(result)
}

// Legacy response display is not request JSON: bytes need arrays and 64-bit
// map keys need decimal strings instead of protobuf.js binary hash strings.
fn request_shape(value: &mut Value, kind: Kind, depth: usize) -> Result<(), String> {
    if depth > 32 {
        return Err("Example nesting exceeds 32 levels.".into());
    }
    match kind {
        Kind::Bytes => {
            if let Some(object) = value.as_object() {
                let bytes = (0..object.len())
                    .map(|index| {
                        object
                            .get(&index.to_string())
                            .cloned()
                            .ok_or("Invalid example bytes")
                    })
                    .collect::<Result<Vec<_>, _>>()?;
                *value = Value::Array(bytes);
            }
        }
        Kind::Message(desc) => {
            for field in desc.fields() {
                let Some(child) = value.get_mut(field.name()) else {
                    continue;
                };
                if field.is_map() {
                    let Kind::Message(entry) = field.kind() else {
                        unreachable!()
                    };
                    if let Some(entries) = child.as_object_mut() {
                        let key_kind = entry.map_entry_key_field().kind();
                        let mut converted = Map::new();
                        for (key, mut entry_value) in std::mem::take(entries) {
                            request_shape(
                                &mut entry_value,
                                entry.map_entry_value_field().kind(),
                                depth + 1,
                            )?;
                            converted.insert(request_map_key(key, &key_kind)?, entry_value);
                        }
                        *entries = converted;
                    }
                } else if field.is_list() {
                    if let Some(entries) = child.as_array_mut() {
                        for entry_value in entries {
                            request_shape(entry_value, field.kind(), depth + 1)?;
                        }
                    }
                } else {
                    request_shape(child, field.kind(), depth + 1)?;
                }
            }
            for extension in desc.extensions() {
                let Some(child) = value.get_mut(format!(".{}", extension.full_name())) else {
                    continue;
                };
                if extension.is_list() {
                    if let Some(entries) = child.as_array_mut() {
                        for entry in entries {
                            request_shape(entry, extension.kind(), depth + 1)?;
                        }
                    }
                } else {
                    request_shape(child, extension.kind(), depth + 1)?;
                }
            }
        }
        _ => {}
    }
    Ok(())
}

fn request_map_key(key: String, kind: &Kind) -> Result<String, String> {
    let signed = matches!(kind, Kind::Int64 | Kind::Sint64 | Kind::Sfixed64);
    if !signed && !matches!(kind, Kind::Uint64 | Kind::Fixed64) {
        return Ok(key);
    }
    // Absent/default long keys are displayed as the literal decimal zero.
    if key == "0" {
        return Ok(key);
    }
    let bytes = key
        .chars()
        .map(|ch| u8::try_from(u32::from(ch)))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| "Invalid example map key")?;
    let bytes: [u8; 8] = bytes.try_into().map_err(|_| "Invalid example map key")?;
    Ok(if signed {
        i64::from_le_bytes(bytes).to_string()
    } else {
        u64::from_le_bytes(bytes).to_string()
    })
}

#[derive(Default)]
struct Budget {
    visits: HashMap<String, usize>,
    fields: usize,
    bytes: usize,
}
impl Budget {
    fn visit(&mut self, key: String) -> bool {
        let count = self.visits.entry(key).or_default();
        *count += 1;
        *count <= 4
    }
    fn field(&mut self, name: &str) -> Result<(), String> {
        self.fields += 1;
        self.bytes = self.bytes.saturating_add(name.len() + 96);
        if self.fields > 1024 || self.bytes > MAX_EXAMPLE {
            return Err(
                "Example exceeds the 1024-field / 128 KiB budget. Write a smaller request body."
                    .into(),
            );
        }
        Ok(())
    }
}

pub(crate) fn generate(desc: MessageDescriptor, mode: JsonMode) -> Result<String, String> {
    let value = message(&desc, &mut Budget::default(), 0)?;
    let text = serde_json::to_string(&value).map_err(|e| e.to_string())?;
    if text.len() > MAX_EXAMPLE {
        return Err("Example exceeds 128 KiB. Write a smaller request body.".into());
    }
    // Validate the exact legacy sample, including oneofs and required fields,
    // before exposing an enabled Use example action.
    let parsed = grpc_schema::parse_mode(desc.clone(), &text, JsonMode::Legacy.from_schema(true))?;
    let result = match mode {
        JsonMode::Legacy | JsonMode::LegacyReflection => text,
        JsonMode::ProtoJson => grpc_schema::json_mode(&parsed, mode, desc.clone())?,
    };
    if result.len() > MAX_EXAMPLE {
        return Err("Rendered example exceeds 128 KiB.".into());
    }
    grpc_schema::parse_mode(desc, &result, mode.from_schema(true))?;
    Ok(result)
}

fn message(desc: &MessageDescriptor, budget: &mut Budget, depth: usize) -> Result<Value, String> {
    if depth > 16 {
        return Err("Example nesting exceeds 16 levels. Write a smaller request body.".into());
    }
    if !budget.visit(format!("type:{}", desc.full_name())) {
        return Ok(json!({}));
    }
    let mut result = Map::new();
    let mut oneofs = HashSet::new();
    // Declaration order matches the archived protobuf.js fieldsArray.
    for raw in &desc.descriptor_proto().field {
        let Some(field) = desc.get_field(raw.number() as u32) else {
            continue;
        };
        if matches!(field.kind(), Kind::Message(ref child) if child == desc) {
            continue;
        }
        if let Some(oneof) = field.containing_oneof() {
            if !oneofs.insert(oneof.full_name().to_string()) {
                continue;
            }
        }
        budget.field(field.name())?;
        if !budget.visit(format!("field:{}", field.name())) {
            // Original automock emits {} even for scalars here. Omit optional
            // fields instead of publishing a sample that cannot be encoded.
            continue;
        }
        let value = if field.is_map() {
            let Kind::Message(entry) = field.kind() else {
                unreachable!()
            };
            // Root.fromDescriptor exposes map fields as repeated entry types.
            // Samples must match the actual reflected request serializer.
            Value::Array(vec![message(&entry, budget, depth + 1)?])
        } else {
            let value = field_value(&field, field.name(), budget, depth + 1)?;
            if field.is_list() {
                Value::Array(vec![value])
            } else {
                value
            }
        };
        result.insert(field.name().to_string(), value);
    }
    Ok(Value::Object(result))
}

fn field_value(
    field: &FieldDescriptor,
    name: &str,
    budget: &mut Budget,
    depth: usize,
) -> Result<Value, String> {
    match field.kind() {
        Kind::Message(desc) => message(&desc, budget, depth),
        Kind::Enum(desc) => Ok(json!(desc
            .enum_descriptor_proto()
            .value
            .first()
            .map(|v| v.number())
            .unwrap_or(0))),
        _ => scalar(field, name),
    }
}

fn scalar(field: &FieldDescriptor, name: &str) -> Result<Value, String> {
    Ok(match field.kind() {
        Kind::String => {
            let name = name.to_lowercase();
            json!(if name.starts_with("id") || name.ends_with("id") {
                uuid::Uuid::new_v4().to_string()
            } else {
                "Hello".into()
            })
        }
        Kind::Bool => json!(true),
        Kind::Int32 => json!(10),
        Kind::Int64 => json!(20),
        Kind::Uint32 | Kind::Uint64 | Kind::Sint32 => json!(100),
        Kind::Sint64 => json!(1200),
        Kind::Fixed32 => json!(1400),
        Kind::Fixed64 => json!(1500),
        Kind::Sfixed32 => json!(1600),
        Kind::Sfixed64 => json!(1700),
        Kind::Double => json!(1.4),
        Kind::Float => json!(1.1),
        // Arrays survive JSON/IPC and are accepted by legacy fromObject.
        Kind::Bytes => json!([161, 178, 195]),
        _ => return Err("Unsupported example scalar.".into()),
    })
}
