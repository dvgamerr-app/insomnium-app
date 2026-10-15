//! Insomnium's protobuf.js object representation, separate from ProtoJSON.
//! Wire encoding and descriptor validation remain prost-reflect's responsibility.
use crate::grpc_schema::MAX_MESSAGE;
use base64::{
    alphabet,
    engine::{
        general_purpose::{GeneralPurpose, GeneralPurposeConfig, STANDARD},
        DecodePaddingMode,
    },
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
use std::collections::{BTreeMap, HashMap};

// Only the legacy converter uses JavaScript Number semantics. RawValue validates
// JSON syntax without rejecting numeric overflow before conversion to f64.
enum Json {
    Null,
    Bool(bool),
    Number(f64),
    String(String),
    Array(Vec<Json>),
    Object(BTreeMap<String, Json>),
}
impl Json {
    fn parse(text: &str, depth: usize) -> Result<Self, String> {
        let raw: &serde_json::value::RawValue =
            serde_json::from_str(text).map_err(|error| format!("Invalid gRPC JSON: {error}"))?;
        let text = raw.get();
        let first = text.as_bytes()[0];
        // Match serde_json's default maximum of 127 nested containers.
        if depth >= 127 && matches!(first, b'[' | b'{') {
            return Err("Invalid gRPC JSON: recursion limit exceeded".into());
        }
        let invalid = |error| format!("Invalid gRPC JSON: {error}");
        match first {
            b'n' => Ok(Self::Null),
            b't' => Ok(Self::Bool(true)),
            b'f' => Ok(Self::Bool(false)),
            b'"' => serde_json::from_str(text)
                .map(Self::String)
                .map_err(invalid),
            b'[' => {
                let values: Vec<&serde_json::value::RawValue> =
                    serde_json::from_str(text).map_err(invalid)?;
                values
                    .into_iter()
                    .map(|value| Self::parse(value.get(), depth + 1))
                    .collect::<Result<Vec<_>, _>>()
                    .map(Self::Array)
            }
            b'{' => {
                let values: BTreeMap<String, &serde_json::value::RawValue> =
                    serde_json::from_str(text).map_err(invalid)?;
                values
                    .into_iter()
                    .map(|(key, value)| {
                        Self::parse(value.get(), depth + 1).map(|value| (key, value))
                    })
                    .collect::<Result<BTreeMap<_, _>, _>>()
                    .map(Self::Object)
            }
            _ => text
                .parse::<f64>()
                .map(Self::Number)
                .map_err(|error| format!("Invalid gRPC JSON number: {error}")),
        }
    }
    fn get(&self, key: &str) -> Option<&Self> {
        match self {
            Self::Object(values) => values.get(key),
            _ => None,
        }
    }
    fn as_str(&self) -> Option<&str> {
        match self {
            Self::String(value) => Some(value),
            _ => None,
        }
    }
    fn as_array(&self) -> Option<&Vec<Self>> {
        match self {
            Self::Array(values) => Some(values),
            _ => None,
        }
    }
    fn is_null(&self) -> bool {
        matches!(self, Self::Null)
    }
    fn is_object(&self) -> bool {
        matches!(self, Self::Object(_))
    }
    fn is_array(&self) -> bool {
        matches!(self, Self::Array(_))
    }
}

fn legacy_base64_bytes(text: &str) -> Result<Vec<u8>, &'static str> {
    const ENGINE: GeneralPurpose = GeneralPurpose::new(
        &alphabet::STANDARD,
        GeneralPurposeConfig::new()
            .with_decode_allow_trailing_bits(true)
            .with_decode_padding_mode(DecodePaddingMode::Indifferent),
    );
    const INVALID: &str = "Invalid legacy base64 bytes.";
    let bytes = ENGINE.decode(text).map_err(|_| INVALID)?;
    // protobuf.js 7.2.4 allocates from base64.length before decoding. Only
    // accept fully initialized results; never emulate an unwritten buffer tail.
    let mut position = text.len();
    let mut padding = 0;
    while position > 0 {
        position -= 1;
        if position % 4 > 1 && text.as_bytes()[position] == b'=' {
            padding += 1;
        } else {
            break;
        }
    }
    let allocated = text
        .len()
        .checked_mul(3)
        .and_then(|length| (length / 4).checked_sub(padding))
        .ok_or(INVALID)?;
    if bytes.len() != allocated {
        return Err(INVALID);
    }
    Ok(bytes)
}

fn truthy(value: &Json) -> bool {
    match value {
        Json::Null => false,
        Json::Bool(v) => *v,
        Json::Number(v) => *v != 0.0 && !v.is_nan(),
        Json::String(v) => !v.is_empty(),
        _ => true,
    }
}
fn js_string(value: &Json) -> String {
    match value {
        Json::Null => "null".into(),
        Json::Bool(v) => v.to_string(),
        Json::Number(v) => ryu_js::Buffer::new().format(*v).into(),
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
// ECMAScript WhiteSpace + LineTerminator for Number and parseInt.
// Rust's Unicode White_Space additionally includes U+0085 (NEL).
fn js_whitespace(c: char) -> bool {
    matches!(
        c,
        '\u{0009}'..='\u{000d}'
            | '\u{0020}'
            | '\u{00a0}'
            | '\u{1680}'
            | '\u{2000}'..='\u{200a}'
            | '\u{2028}'
            | '\u{2029}'
            | '\u{202f}'
            | '\u{205f}'
            | '\u{3000}'
            | '\u{feff}'
    )
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
        Json::Number(v) => *v,
        _ => {
            let text = js_string(value);
            let text = text.trim_matches(js_whitespace);
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
                let part = part.trim_start_matches(js_whitespace);
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
        Json::Number(value) => Ok(*value as i64 as u64),
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
    let input = Json::parse(text, 0)?;
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
                Json::String(text) => legacy_base64_bytes(text)?,
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
fn serialize_js_number<S: Serializer>(value: f64, serializer: S) -> Result<S::Ok, S::Error> {
    if !value.is_finite() {
        return serializer.serialize_none();
    }
    // Keep JSON.stringify spelling (including -0 and exponent thresholds).
    // Parsing as Number would send finite values back through serde's formatter.
    let mut buffer = ryu_js::Buffer::new();
    let raw: &serde_json::value::RawValue =
        serde_json::from_str(buffer.format(value)).map_err(serde::ser::Error::custom)?;
    raw.serialize(serializer)
}
impl Serialize for LegacyValue<'_> {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        match self.0 {
            Value::Bool(v) => s.serialize_bool(*v),
            Value::I32(v) => s.serialize_i32(*v),
            Value::U32(v) => s.serialize_u32(*v),
            Value::I64(v) => s.serialize_str(&v.to_string()),
            Value::U64(v) => s.serialize_str(&v.to_string()),
            Value::F32(v) => serialize_js_number(*v as f64, s),
            Value::F64(v) => serialize_js_number(*v, s),
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

#[cfg(test)]
mod tests {
    use super::*;
    use prost_reflect::DescriptorPool;
    use prost_types::{
        DescriptorProto, FieldDescriptorProto, FileDescriptorProto, FileDescriptorSet,
    };

    #[test]
    fn legacy_json_parser_preserves_syntax_and_container_boundaries() {
        for input in [
            "NaN",
            "Infinity",
            "-Infinity",
            "+1",
            "01",
            "1.",
            "1e",
            "[1,]",
            "{\"x\":1,}",
            "{\"x\":1}null",
            "\"unterminated",
            "{bad:1}",
        ] {
            assert!(
                Json::parse(input, 0).is_err(),
                "Invalid JSON accepted: {input}"
            );
        }
        let duplicate = Json::parse("{\"value\":1e400,\"value\":2}", 0).unwrap();
        assert_eq!(number(duplicate.get("value").unwrap()), 2.0);
        let duplicate = Json::parse("{\"value\":2,\"value\":-1e400}", 0).unwrap();
        assert_eq!(number(duplicate.get("value").unwrap()), f64::NEG_INFINITY);
        let negative_zero = Json::parse("-0", 0).unwrap();
        assert!(number(&negative_zero).is_sign_negative());
        assert!(!truthy(&negative_zero));
        assert_eq!(js_string(&negative_zero), "0");
        let overflow = Json::parse("1e400", 0).unwrap();
        assert!(truthy(&overflow));
        assert_eq!(js_string(&overflow), "Infinity");
        assert_eq!(
            js_string(&Json::parse("[null,true,1,\"x\",{}]", 0).unwrap()),
            ",true,1,x,[object Object]"
        );
        for (depth, allowed) in [(127, true), (128, false)] {
            let input = "[".repeat(depth) + "0" + &"]".repeat(depth);
            assert_eq!(
                serde_json::from_str::<serde_json::Value>(&input).is_ok(),
                allowed
            );
            assert_eq!(
                Json::parse(&input, 0).is_ok(),
                allowed,
                "JSON depth {depth}"
            );
        }
    }

    #[test]
    fn legacy_json_numeric_overflow_reference_vectors() {
        use prost_types::field_descriptor_proto::{Label, Type};
        let pool = DescriptorPool::from_file_descriptor_set(FileDescriptorSet {
            file: vec![FileDescriptorProto {
                name: Some("numeric_overflow.proto".into()),
                syntax: Some("proto3".into()),
                message_type: vec![DescriptorProto {
                    name: Some("NumericOverflow".into()),
                    field: [
                        ("real", Type::Double),
                        ("integer", Type::Int32),
                        ("wide", Type::Int64),
                        ("text", Type::String),
                    ]
                    .into_iter()
                    .enumerate()
                    .map(|(index, (name, kind))| FieldDescriptorProto {
                        name: Some(name.into()),
                        number: Some(index as i32 + 1),
                        label: Some(Label::Optional as i32),
                        r#type: Some(kind as i32),
                        ..Default::default()
                    })
                    .collect(),
                    ..Default::default()
                }],
                ..Default::default()
            }],
        })
        .unwrap();
        let descriptor = pool.get_message_by_name("NumericOverflow").unwrap();
        // Pinned JSON.parse + protobuf.js7.2.4/Long5.3.2 oracle.
        for (literal, real, wide, text) in [
            ("1e400", f64::INFINITY, i64::MAX, "Infinity"),
            ("-1e400", f64::NEG_INFINITY, i64::MIN, "-Infinity"),
            ("1e309", f64::INFINITY, i64::MAX, "Infinity"),
            ("-1e309", f64::NEG_INFINITY, i64::MIN, "-Infinity"),
            ("1e308", 1e308, i64::MAX, "1e+308"),
            ("-1e308", -1e308, i64::MIN, "-1e+308"),
            ("1e-400", 0.0, 0, "0"),
            ("-1e-400", -0.0, 0, "0"),
        ] {
            let input = format!("{{\"real\":{literal},\"integer\":{literal},\"wide\":{literal},\"text\":{literal}}}");
            let message = parse(descriptor.clone(), &input)
                .unwrap_or_else(|error| panic!("Reference JSON number {literal} refused: {error}"));
            for (field, expected) in [
                ("real", Value::F64(real)),
                ("integer", Value::I32(0)),
                ("wide", Value::I64(wide)),
                ("text", Value::String(text.into())),
            ] {
                assert_eq!(
                    message.get_field_by_name(field).unwrap().as_ref(),
                    &expected,
                    "Reference field {field} for {literal}"
                );
            }
        }
    }

    #[test]
    fn legacy_long_whitespace_reference_vectors() {
        let whitespace = [
            9, 11, 12, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201,
            8202, 8239, 8287, 12288, 65279, 10, 13, 8232, 8233,
        ];
        for code in whitespace.into_iter().chain([133, 6158, 8203, 8288]) {
            let ch = char::from_u32(code).unwrap();
            let input = Json::String(format!("{ch}1{ch}"));
            assert_eq!(
                long_bits(&input).unwrap(),
                if whitespace.contains(&code) { 1 } else { 0 },
                "Long conversion U+{code:04X}"
            );
        }
        for (input, expected) in [
            ("12345678\u{0085}1", 1_234_567_800),
            ("12345678\u{00a0}1", 1_234_567_801),
            ("12345678\u{feff}1", 1_234_567_801),
            ("-\u{0085}1", 0),
            ("-\u{feff}1", u64::MAX),
        ] {
            assert_eq!(
                long_bits(&Json::String(input.into())).unwrap(),
                expected,
                "Long chunk conversion {input:?}"
            );
        }
    }

    #[test]
    fn legacy_float_json_reference_vectors() {
        let cases = [
            (1.0, "1"),
            (-0.0, "0"),
            (0.1, "0.1"),
            (1e-6, "0.000001"),
            (1e-7, "1e-7"),
            (1e20, "100000000000000000000"),
            (1e21, "1e+21"),
            (f64::from_bits(1), "5e-324"),
            (f64::MAX, "1.7976931348623157e+308"),
            (f64::NAN, "null"),
            (f64::INFINITY, "null"),
            (f64::NEG_INFINITY, "null"),
        ];
        for (number, expected) in cases {
            let value = Value::F64(number);
            let actual = serde_json::to_string(&LegacyValue(&value, Kind::Double, 0)).unwrap();
            assert_eq!(actual, expected, "Legacy JSON number {number:?}");
        }
        let value = Value::F32(0.1);
        assert_eq!(
            serde_json::to_string(&LegacyValue(&value, Kind::Float, 0)).unwrap(),
            "0.10000000149011612"
        );
    }

    #[test]
    fn legacy_numeric_whitespace_reference_vectors() {
        let pool = DescriptorPool::from_file_descriptor_set(FileDescriptorSet {
            file: vec![FileDescriptorProto {
                name: Some("numeric_whitespace.proto".into()),
                syntax: Some("proto3".into()),
                message_type: vec![DescriptorProto {
                    name: Some("Numeric".into()),
                    field: [
                        ("value", 1, prost_types::field_descriptor_proto::Type::Int32),
                        ("real", 2, prost_types::field_descriptor_proto::Type::Double),
                    ]
                    .into_iter()
                    .map(|(name, number, kind)| FieldDescriptorProto {
                        name: Some(name.into()),
                        number: Some(number),
                        label: Some(prost_types::field_descriptor_proto::Label::Optional as i32),
                        r#type: Some(kind as i32),
                        ..Default::default()
                    })
                    .collect(),
                    ..Default::default()
                }],
                ..Default::default()
            }],
        })
        .unwrap();
        let descriptor = pool.get_message_by_name("Numeric").unwrap();
        // Pinned protobuf.js7.2.4 Number/bitwise conversion oracle.
        let whitespace = [
            9, 11, 12, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201,
            8202, 8239, 8287, 12288, 65279, 10, 13, 8232, 8233,
        ];
        for code in whitespace.into_iter().chain([133, 6158, 8203, 8288]) {
            let ch = char::from_u32(code).unwrap();
            let text = format!("{ch}1{ch}");
            let input = serde_json::json!({"value": text, "real": text});
            let message = parse(descriptor.clone(), &input.to_string()).unwrap();
            let accepted = whitespace.contains(&code);
            assert_eq!(
                message.get_field_by_name("value").unwrap().as_ref(),
                &Value::I32(if accepted { 1 } else { 0 }),
                "Integer conversion U+{code:04X}"
            );
            let real = message.get_field_by_name("real").unwrap();
            let Value::F64(real) = real.as_ref() else {
                panic!("Expected double")
            };
            assert!(
                if accepted {
                    *real == 1.0
                } else {
                    real.is_nan()
                },
                "Double conversion U+{code:04X}"
            );
        }
    }

    #[test]
    fn legacy_base64_reference_vectors() {
        let pool = DescriptorPool::from_file_descriptor_set(FileDescriptorSet {
            file: vec![FileDescriptorProto {
                name: Some("base64_oracle.proto".into()),
                syntax: Some("proto3".into()),
                message_type: vec![DescriptorProto {
                    name: Some("Packet".into()),
                    field: vec![FieldDescriptorProto {
                        name: Some("payload".into()),
                        number: Some(1),
                        label: Some(prost_types::field_descriptor_proto::Label::Optional as i32),
                        r#type: Some(prost_types::field_descriptor_proto::Type::Bytes as i32),
                        ..Default::default()
                    }],
                    ..Default::default()
                }],
                ..Default::default()
            }],
        })
        .unwrap();
        let descriptor = pool.get_message_by_name("Packet").unwrap();
        // Pinned protobuf.js7.2.4/Long5.3.2 byte oracle, not a second decoder.
        // Cases with unwritten allocUnsafe tails remain explicitly unsupported.
        let cases: &[(&str, Option<&str>)] = &[
            ("", Some("")),
            ("Zg==", Some("66")),
            ("Zg", Some("66")),
            ("Zg=", Some("66")),
            ("Zh==", Some("66")),
            ("Zh", Some("66")),
            ("Zm8=", Some("666f")),
            ("Zm8", Some("666f")),
            ("Zm9=", Some("666f")),
            ("Zm9", Some("666f")),
            ("Zm9v", Some("666f6f")),
            ("AA==", Some("00")),
            ("AB==", Some("00")),
            ("AA=", Some("00")),
            ("AB", Some("00")),
            ("AAA=", Some("0000")),
            ("AAB=", Some("0000")),
            ("AAB", Some("0000")),
            ("AAAA", Some("000000")),
            ("AP+A", Some("00ff80")),
            ("AP+A==", None),
            ("Z", None),
            ("A", None),
            ("=", None),
            ("==", None),
            ("Zg===", None),
            ("Zg====", None),
            ("Zm8==", None),
            ("Zm8===", None),
            ("Zg==a", None),
            ("Zg== ", None),
            ("Z g==", None),
            (" Zg==", None),
            ("Zg\n==", None),
            ("AP-A", None),
            ("AP_A", None),
            ("Zg==!", None),
        ];
        assert_eq!(cases.len(), 37);
        for (input, expected) in cases {
            let result = parse(
                descriptor.clone(),
                &serde_json::json!({"payload": input}).to_string(),
            );
            match expected {
                None => assert!(result.is_err(), "Unsupported input {input:?} was accepted"),
                Some(hex) => {
                    let message = result.unwrap_or_else(|error| {
                        panic!("Reference input {input:?} refused: {error}")
                    });
                    let value = message.get_field_by_name("payload").unwrap();
                    let Value::Bytes(bytes) = value.as_ref() else {
                        panic!("Expected bytes");
                    };
                    let actual: String = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
                    assert_eq!(&actual, hex, "Reference bytes differ for {input:?}");
                }
            }
        }
    }
}
