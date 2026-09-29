//! Reflection request samples inspired by the original Insomnium automock.
//! Kept separate from response serialization and never applied to saved bodies.
use crate::grpc_schema::{self, JsonMode};
use prost_reflect::{FieldDescriptor, Kind, MessageDescriptor};
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};

const MAX_EXAMPLE: usize = 128 * 1024;

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
    let parsed = grpc_schema::parse_mode(desc.clone(), &text, JsonMode::Legacy)?;
    let result = match mode {
        JsonMode::Legacy => text,
        JsonMode::ProtoJson => grpc_schema::json_mode(&parsed, mode)?,
    };
    if result.len() > MAX_EXAMPLE {
        return Err("Rendered example exceeds 128 KiB.".into());
    }
    grpc_schema::parse_mode(desc, &result, mode)?;
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
            let key = scalar(&entry.map_entry_key_field(), field.name())?;
            let key = match key {
                Value::String(v) => v,
                other => other.to_string(),
            };
            let value = field_value(
                &entry.map_entry_value_field(),
                field.name(),
                budget,
                depth + 1,
            )?;
            Value::Object(Map::from_iter([(key, value)]))
        } else {
            let value = field_value(&field, field.name(), budget, depth + 1)?;
            if field.is_list() {
                Value::Array(vec![value])
            } else {
                value
            }
        };
        let name = if desc.full_name() == "google.protobuf.Value" {
            field.json_name()
        } else {
            field.name()
        };
        result.insert(name.to_string(), value);
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
