//! Insomnium's protobuf.js object representation, separate from ProtoJSON.
//! Wire encoding and descriptor validation remain prost-reflect's responsibility.
use crate::grpc_schema::MAX_MESSAGE;
use base64::{
    engine::general_purpose::{STANDARD, STANDARD_NO_PAD},
    Engine,
};
use prost::Message;
use prost_reflect::{
    DynamicMessage, FieldDescriptor, Kind, MapKey, MessageDescriptor, ReflectMessage, Value,
};
use serde::{
    ser::{SerializeMap, SerializeSeq},
    Serialize, Serializer,
};
use serde_json::Value as Json;
use std::collections::HashMap;

fn truthy(value: &Json) -> bool {
    match value {
        Json::Null => false,
        Json::Bool(v) => *v,
        Json::Number(v) => v.as_f64().is_some_and(|v| v != 0.0 && !v.is_nan()),
        Json::String(v) => !v.is_empty(),
        _ => true,
    }
}
fn js_string(value: &Json) -> String {
    match value {
        Json::Null => "null".into(),
        Json::Bool(v) => v.to_string(),
        Json::Number(v) => ryu_js::Buffer::new()
            .format(v.as_f64().unwrap_or(f64::NAN))
            .into(),
        Json::String(v) => v.clone(),
        Json::Array(v) => v
            .iter()
            .map(|v| {
                if v.is_null() {
                    String::new()
                } else {
                    js_string(v)
                }
            })
            .collect::<Vec<_>>()
            .join(","),
        Json::Object(_) => "[object Object]".into(),
    }
}
fn number(value: &Json) -> f64 {
    match value {
        Json::Null => 0.0,
        Json::Bool(v) => {
            if *v {
                1.0
            } else {
                0.0
            }
        }
        Json::Number(v) => v.as_f64().unwrap_or(f64::NAN),
        _ => {
            let text = js_string(value);
            let text = text.trim_matches(|c: char| c.is_whitespace() || c == '\u{feff}');
            if text.is_empty() {
                return 0.0;
            }
            for (prefix, radix) in [
                ("0x", 16),
                ("0X", 16),
                ("0o", 8),
                ("0O", 8),
                ("0b", 2),
                ("0B", 2),
            ] {
                if let Some(digits) = text.strip_prefix(prefix) {
                    if digits.is_empty() {
                        return f64::NAN;
                    }
                    return digits
                        .chars()
                        .try_fold(0.0, |n, c| {
                            c.to_digit(radix).map(|d| n * radix as f64 + d as f64)
                        })
                        .unwrap_or(f64::NAN);
                }
            }
            match text {
                "Infinity" | "+Infinity" => f64::INFINITY,
                "-Infinity" => f64::NEG_INFINITY,
                "NaN" => f64::NAN,
                _ if text.contains(['i', 'I', 'n', 'N']) => f64::NAN,
                _ => text.parse().unwrap_or(f64::NAN),
            }
        }
    }
}
fn uint32(value: &Json) -> u32 {
    let number = number(value);
    if !number.is_finite() {
        0
    } else {
        number.trunc().rem_euclid(4_294_967_296.0) as u32
    }
}
fn long_bits(value: &Json) -> Result<u64, String> {
    match value {
        Json::String(text) => {
            if text.is_empty() {
                return Err("Legacy 64-bit field cannot be an empty string.".into());
            }
            if matches!(
                text.as_str(),
                "NaN" | "Infinity" | "+Infinity" | "-Infinity"
            ) {
                return Ok(0);
            }
            let digits = text.trim_start_matches('-');
            let negative = (text.len() - digits.len()) % 2 != 0;
            if digits.is_empty() {
                return Err("Legacy 64-bit field cannot be an empty string.".into());
            }
            if digits.contains('-') {
                return Err("Legacy 64-bit field has an interior hyphen.".into());
            }
            // Long5 parses decimal chunks of eight UTF-16 units with parseInt.
            let units: Vec<u16> = digits.encode_utf16().collect();
            let mut bits = 0u64;
            for chunk in units.chunks(8) {
                let part = String::from_utf16_lossy(chunk);
                let part = part.trim_start_matches(|c: char| c.is_whitespace() || c == '\u{feff}');
                let part = part.strip_prefix('+').unwrap_or(part);
                let value = part
                    .bytes()
                    .take_while(u8::is_ascii_digit)
                    .fold(0u64, |n, b| n * 10 + (b - b'0') as u64);
                bits = bits
                    .wrapping_mul(10u64.pow(chunk.len() as u32))
                    .wrapping_add(value);
            }
            Ok(if negative { bits.wrapping_neg() } else { bits })
        }
        Json::Number(value) => Ok(value.as_f64().unwrap_or(0.0) as i64 as u64),
        Json::Object(value) => Ok(uint32(value.get("low").unwrap_or(&Json::Null)) as u64
            | ((uint32(value.get("high").unwrap_or(&Json::Null)) as u64) << 32)),
        Json::Null => Err("Legacy 64-bit field cannot contain null.".into()),
        _ => Ok(0),
    }
}

fn field_name(field: &FieldDescriptor) -> &str {
    // protobuf.js's built-in Struct/Value descriptors use camelCase names.
    if field.parent_message().full_name() == "google.protobuf.Value" {
        field.json_name()
    } else {
        field.name()
    }
}
fn legacy_default(field: &FieldDescriptor, for_wire: bool) -> Value {
    let value = Value::default_value_for_field(field);
    if field.is_list() || field.is_map() {
        return value;
    }
    match value {
        Value::I64(v) => Value::I64(v as f64 as i64),
        Value::U64(v) if matches!(field.kind(), Kind::Fixed64) => {
            Value::U64(v as f64 as i64 as u64)
        }
        Value::U64(v) => Value::U64(v as f64 as u64),
        Value::F32(_) if !for_wire => {
            let number = field
                .field_descriptor_proto()
                .default_value
                .as_deref()
                .and_then(|v| v.parse::<f64>().ok())
                .unwrap_or(0.0);
            Value::F64(number)
        }
        Value::Bytes(bytes) => {
            if let Ok(text) = std::str::from_utf8(&bytes) {
                if text.len().is_multiple_of(4) {
                    if let Ok(decoded) = STANDARD.decode(text) {
                        return Value::Bytes(decoded.into());
                    }
                }
            }
            Value::Bytes(bytes)
        }
        value => value,
    }
}

pub(crate) fn parse(desc: MessageDescriptor, text: &str) -> Result<DynamicMessage, String> {
    if text.len() > MAX_MESSAGE {
        return Err("gRPC JSON message exceeds 20 MiB.".into());
    }
    let input: Json = serde_json::from_str(text).map_err(|e| format!("Invalid gRPC JSON: {e}"))?;
    let message = from_object(desc, &input, 0)?;
    if message.encoded_len() > MAX_MESSAGE {
        return Err("gRPC message exceeds 20 MiB.".into());
    }
    Ok(message)
}
fn from_object(
    desc: MessageDescriptor,
    object: &Json,
    depth: usize,
) -> Result<DynamicMessage, String> {
    if depth > 64 {
        return Err("gRPC message nesting exceeds 64 levels.".into());
    }
    if object.is_null() && desc.fields().next().is_some() {
        return Err("gRPC message requires an object.".into());
    }
    let mut message = DynamicMessage::new(desc.clone());
    // protobuf.js's Any wrapper accepts an explicitly selected known message.
    if desc.full_name() == "google.protobuf.Any" {
        if let Some(url) = object.get("@type").and_then(Json::as_str) {
            let name = url
                .rsplit('/')
                .next()
                .unwrap_or(url)
                .trim_start_matches('.');
            if let Some(inner) = desc.parent_pool().get_message_by_name(name) {
                let inner = from_object(inner, object, depth + 1)?;
                let url = url.trim_start_matches('.');
                let url = if url.contains('/') {
                    url.into()
                } else {
                    format!("/{url}")
                };
                message.set_field_by_name("type_url", Value::String(url));
                message.set_field_by_name("value", Value::Bytes(inner.encode_to_vec().into()));
                return Ok(message);
            }
        }
    }
    for field in desc.fields() {
        let Some(input) = object.get(field_name(&field)).filter(|v| !v.is_null()) else {
            if field.cardinality() == prost_reflect::Cardinality::Required {
                if matches!(field.kind(), Kind::Message(_)) {
                    return Err(format!(
                        "{}: required message is missing",
                        field.full_name()
                    ));
                }
                message.set_field(&field, legacy_default(&field, true));
            }
            continue;
        };
        let value = if field.is_map() {
            if !truthy(input) {
                continue;
            }
            let Kind::Message(entry) = field.kind() else {
                unreachable!()
            };
            let key = entry.map_entry_key_field();
            let value_field = entry.map_entry_value_field();
            let pairs: Vec<(String, &Json)> = match input {
                Json::Object(map) => map.iter().map(|(k, v)| (k.clone(), v)).collect(),
                Json::Array(array) => array
                    .iter()
                    .enumerate()
                    .map(|(i, v)| (i.to_string(), v))
                    .collect(),
                _ => return Err(format!("{}: object expected", field.full_name())),
            };
            let mut values = HashMap::new();
            for (k, v) in pairs {
                let map_key = scalar(&key, &Json::String(k), depth + 1)?
                    .ok_or("Invalid map key.")?
                    .into_map_key()
                    .ok_or("Invalid map key.")?;
                if let Some(value) = scalar(&value_field, v, depth + 1)? {
                    values.insert(map_key, value);
                }
            }
            Value::Map(values)
        } else if field.is_list() {
            if !truthy(input) {
                continue;
            }
            let input = input
                .as_array()
                .ok_or_else(|| format!("{}: array expected", field.full_name()))?;
            let mut values = Vec::new();
            for input in input {
                let value = scalar(&field, input, depth + 1)?
                    .unwrap_or_else(|| Value::default_value(&field.kind()));
                values.push(value);
            }
            Value::List(values)
        } else {
            let Some(value) = scalar(&field, input, depth + 1)? else {
                continue;
            };
            value
        };
        if let Some(oneof) = field.containing_oneof() {
            if oneof.fields().any(|f| message.has_field(&f)) {
                return Err(format!("Choose one field for oneof {}.", oneof.name()));
            }
        }
        message
            .try_set_field(&field, value)
            .map_err(|e| format!("Invalid {}: {e}", field.name()))?;
    }
    Ok(message)
}
fn scalar(field: &FieldDescriptor, input: &Json, depth: usize) -> Result<Option<Value>, String> {
    Ok(Some(match field.kind() {
        Kind::Double => Value::F64(number(input)),
        Kind::Float => Value::F32(number(input) as f32),
        Kind::Int32 | Kind::Sint32 | Kind::Sfixed32 => Value::I32(uint32(input) as i32),
        Kind::Uint32 | Kind::Fixed32 => Value::U32(uint32(input)),
        Kind::Int64 | Kind::Sint64 | Kind::Sfixed64 => Value::I64(long_bits(input)? as i64),
        Kind::Uint64 | Kind::Fixed64 => Value::U64(long_bits(input)?),
        Kind::Bool => Value::Bool(truthy(input)),
        Kind::String => Value::String(js_string(input)),
        Kind::Bytes => {
            let bytes = match input {
                Json::String(text) => STANDARD
                    .decode(text)
                    .or_else(|_| STANDARD_NO_PAD.decode(text))
                    .map_err(|_| "Invalid legacy base64 bytes.")?,
                Json::Array(array) => array.iter().map(|v| uint32(v) as u8).collect(),
                Json::Object(object) if object.get("length").is_some_and(|v| number(v) >= 0.0) => {
                    let length = number(&object["length"]).trunc();
                    if !length.is_finite() || length > MAX_MESSAGE as f64 {
                        return Err("gRPC bytes exceed 20 MiB.".into());
                    }
                    (0..length as usize)
                        .map(|i| uint32(object.get(&i.to_string()).unwrap_or(&Json::Null)) as u8)
                        .collect()
                }
                Json::Null => return Err("Legacy bytes field cannot contain null.".into()),
                _ => return Ok(None),
            };
            Value::Bytes(bytes.into())
        }
        Kind::Enum(desc) => {
            let number = match input {
                Json::Number(_) => uint32(input) as i32,
                Json::String(name) => match desc.get_value_by_name(name) {
                    Some(value) => value.number(),
                    None => return Ok(None),
                },
                _ => return Ok(None),
            };
            Value::EnumNumber(number)
        }
        Kind::Message(desc) => {
            if !input.is_object() && !input.is_array() && !input.is_null() {
                return Err(format!("{}: object expected", field.full_name()));
            }
            Value::Message(from_object(desc, input, depth)?)
        }
    }))
}

pub(crate) struct LegacyMessage<'a>(pub &'a DynamicMessage, pub usize);
impl Serialize for LegacyMessage<'_> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        if self.1 > 64 {
            return Err(serde::ser::Error::custom(
                "gRPC message nesting exceeds 64 levels.",
            ));
        }
        let mut out = serializer.serialize_map(None)?;
        for field in self.0.descriptor().fields() {
            let present = self.0.has_field(&field);
            if !present && field.containing_oneof().is_some() {
                continue;
            }
            if !present
                && !field.is_list()
                && !field.is_map()
                && matches!(field.kind(), Kind::Message(_))
            {
                out.serialize_entry(field_name(&field), &Option::<()>::None)?;
            } else {
                let value = if present {
                    self.0.get_field(&field)
                } else {
                    std::borrow::Cow::Owned(legacy_default(&field, false))
                };
                out.serialize_entry(
                    field_name(&field),
                    &LegacyValue(&value, field.kind(), self.1 + 1),
                )?;
            }
            if present {
                if let Some(oneof) = field.containing_oneof() {
                    out.serialize_entry(oneof.name(), field_name(&field))?;
                }
            }
        }
        out.end()
    }
}
struct LegacyValue<'a>(&'a Value, Kind, usize);
impl Serialize for LegacyValue<'_> {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        match self.0 {
            Value::Bool(v) => s.serialize_bool(*v),
            Value::I32(v) => s.serialize_i32(*v),
            Value::U32(v) => s.serialize_u32(*v),
            Value::I64(v) => s.serialize_str(&v.to_string()),
            Value::U64(v) => s.serialize_str(&v.to_string()),
            Value::F32(v) => {
                if v.is_finite() {
                    s.serialize_f64(*v as f64)
                } else {
                    s.serialize_none()
                }
            }
            Value::F64(v) => {
                if v.is_finite() {
                    s.serialize_f64(*v)
                } else {
                    s.serialize_none()
                }
            }
            Value::String(v) => s.serialize_str(v),
            Value::Bytes(v) => {
                // Electron structured cloning turns Buffer into Uint8Array;
                // the old renderer then JSON.stringify's its numeric keys.
                let mut m = s.serialize_map(Some(v.len()))?;
                for (index, byte) in v.iter().enumerate() {
                    m.serialize_entry(&index.to_string(), byte)?;
                }
                m.end()
            }
            Value::EnumNumber(v) => {
                if let Kind::Enum(desc) = &self.1 {
                    if let Some(value) = desc.get_value(*v) {
                        s.serialize_str(value.name())
                    } else {
                        s.serialize_i32(*v)
                    }
                } else {
                    s.serialize_i32(*v)
                }
            }
            Value::Message(v) => LegacyMessage(v, self.2).serialize(s),
            Value::List(values) => {
                let mut seq = s.serialize_seq(Some(values.len()))?;
                for v in values {
                    seq.serialize_element(&LegacyValue(v, self.1.clone(), self.2))?;
                }
                seq.end()
            }
            Value::Map(values) => {
                let Kind::Message(entry) = &self.1 else {
                    return Err(serde::ser::Error::custom("Invalid map descriptor."));
                };
                let mut map = s.serialize_map(Some(values.len()))?;
                for (key, value) in values {
                    let key = match key {
                        MapKey::I64(v) => v
                            .to_le_bytes()
                            .iter()
                            .map(|b| char::from(*b))
                            .collect::<String>(),
                        MapKey::U64(v) => v
                            .to_le_bytes()
                            .iter()
                            .map(|b| char::from(*b))
                            .collect::<String>(),
                        MapKey::String(v) => v.clone(),
                        MapKey::Bool(v) => v.to_string(),
                        MapKey::I32(v) => v.to_string(),
                        MapKey::U32(v) => v.to_string(),
                    };
                    map.serialize_entry(
                        &key,
                        &LegacyValue(value, entry.map_entry_value_field().kind(), self.2),
                    )?;
                }
                map.end()
            }
        }
    }
}
