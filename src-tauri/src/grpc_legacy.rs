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
    DescriptorPool, DynamicMessage, FieldDescriptor, Kind, MapKey, MessageDescriptor,
    ReflectMessage, Value,
};
use serde::{
    ser::{SerializeMap, SerializeSeq},
    Serialize, Serializer,
};
use std::collections::{HashMap, HashSet};

// protobuf.js retains all oneof members. Independent presence groups let prost
// preserve both their values and explicit default values, without changing the
// user schema or the standard ProtoJSON descriptor pool.
pub(crate) fn legacy_pool(pool: &DescriptorPool) -> Result<DescriptorPool, String> {
    if !pool.all_messages().any(|message| {
        message.is_map_entry()
            || message
                .fields()
                .any(|field| matches!(field.kind(), Kind::String))
            || message.oneofs().any(|group| group.fields().len() > 1)
    }) {
        return Ok(pool.clone());
    }
    fn split(message: &mut prost_types::DescriptorProto, proto3: bool) {
        let mut seen = HashSet::new();
        let mut names: HashSet<String> = message
            .oneof_decl
            .iter()
            .filter_map(|group| group.name.clone())
            .chain(message.field.iter().filter_map(|field| field.name.clone()))
            .chain(
                message
                    .nested_type
                    .iter()
                    .filter_map(|child| child.name.clone()),
            )
            .chain(
                message
                    .enum_type
                    .iter()
                    .filter_map(|child| child.name.clone()),
            )
            .collect();
        names.extend(
            message
                .enum_type
                .iter()
                .flat_map(|kind| kind.value.iter())
                .filter_map(|value| value.name.clone()),
        );
        names.extend(
            message
                .extension
                .iter()
                .filter_map(|field| field.name.clone()),
        );
        if message
            .options
            .as_ref()
            .is_some_and(|options| options.map_entry.unwrap_or(false))
        {
            // Repeated entry messages preserve wire order, duplicate keys and
            // the distinction between an absent key and an explicit zero key.
            message.options.as_mut().unwrap().map_entry = Some(false);
            for field in &mut message.field {
                if field.number == Some(1)
                    && field.r#type == Some(prost_types::field_descriptor_proto::Type::Int32 as i32)
                {
                    // Writer.int32 receives raw map-key strings: positive u32
                    // spellings use five bytes, while negative numbers use ten.
                    field.r#type = Some(prost_types::field_descriptor_proto::Type::Int64 as i32);
                }
                let mut name = format!("insomnium_map_{}", field.number.unwrap_or_default());
                while !names.insert(name.clone()) {
                    name.push('_');
                }
                field.oneof_index = Some(message.oneof_decl.len() as i32);
                message.oneof_decl.push(prost_types::OneofDescriptorProto {
                    name: Some(name),
                    ..Default::default()
                });
            }
        }
        // Legacy BufferWriter can emit WTF8; bytes keep the original wire intact.
        for field in &mut message.field {
            if field.r#type == Some(prost_types::field_descriptor_proto::Type::String as i32) {
                field.r#type = Some(prost_types::field_descriptor_proto::Type::Bytes as i32);
                if proto3
                    && field.label
                        != Some(prost_types::field_descriptor_proto::Label::Repeated as i32)
                    && field.oneof_index.is_none()
                {
                    // Explicit empty strings are written by protobuf.js too.
                    let mut name = format!("insomnium_string_{}", field.number.unwrap_or_default());
                    while !names.insert(name.clone()) {
                        name.push('_');
                    }
                    field.oneof_index = Some(message.oneof_decl.len() as i32);
                    message.oneof_decl.push(prost_types::OneofDescriptorProto {
                        name: Some(name),
                        ..Default::default()
                    });
                }
            }
        }
        for field in &mut message.field {
            let Some(index) = field.oneof_index else {
                continue;
            };
            if !seen.insert(index) {
                let mut name = format!("insomnium_legacy_{}", field.number.unwrap_or_default());
                while !names.insert(name.clone()) {
                    name.push('_');
                }
                let new_index = message.oneof_decl.len();
                message.oneof_decl.push(prost_types::OneofDescriptorProto {
                    name: Some(name),
                    ..Default::default()
                });
                field.oneof_index = Some(new_index as i32);
            }
        }
        // Synthetic optional groups must remain after real oneofs.
        let synthetic: HashSet<usize> = message
            .field
            .iter()
            .filter(|field| field.proto3_optional.unwrap_or_default())
            .filter_map(|field| field.oneof_index.map(|index| index as usize))
            .collect();
        let order: Vec<usize> = (0..message.oneof_decl.len())
            .filter(|index| !synthetic.contains(index))
            .chain((0..message.oneof_decl.len()).filter(|index| synthetic.contains(index)))
            .collect();
        let mut remap = vec![0; order.len()];
        for (new, old) in order.iter().enumerate() {
            remap[*old] = new;
        }
        let original = std::mem::take(&mut message.oneof_decl);
        message.oneof_decl = order.iter().map(|index| original[*index].clone()).collect();
        for field in &mut message.field {
            if let Some(index) = field.oneof_index {
                field.oneof_index = Some(remap[index as usize] as i32);
            }
        }
        for nested in &mut message.nested_type {
            split(nested, proto3);
        }
    }
    let mut files: Vec<_> = pool.file_descriptor_protos().cloned().collect();
    for file in &mut files {
        for message in &mut file.message_type {
            split(message, file.syntax.as_deref() == Some("proto3"));
        }
    }
    DescriptorPool::from_file_descriptor_set(prost_types::FileDescriptorSet { file: files })
        .map_err(|error| format!("Could not prepare legacy gRPC descriptors: {error}"))
}

pub(crate) fn legacy_descriptor(desc: MessageDescriptor) -> Result<MessageDescriptor, String> {
    legacy_pool(desc.parent_pool())?
        .get_message_by_name(desc.full_name())
        .ok_or_else(|| "Missing legacy message descriptor.".into())
}

fn oneof_name(field: &FieldDescriptor, original: &MessageDescriptor) -> Option<String> {
    original
        .get_field(field.number())?
        .containing_oneof()
        .map(|group| group.name().to_string())
}

// Only the legacy converter uses JavaScript Number semantics. RawValue validates
// JSON syntax without rejecting numeric overflow before conversion to f64.
fn js_array_index(key: &str) -> Option<u32> {
    if key.len() > 10 {
        return None;
    }
    let index = key.parse::<u32>().ok()?;
    (index != u32::MAX && index.to_string() == key).then_some(index)
}

// Preserve JavaScript UTF16 identity, including unpaired surrogate property keys.
// serde_json's byte-string visitor validates escapes while retaining WTF8 units.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct JsString {
    units: Vec<u16>,
    text: String,
}
impl JsString {
    fn from_units(units: Vec<u16>) -> Self {
        let text = String::from_utf16_lossy(&units);
        Self { units, text }
    }
    fn as_str(&self) -> &str {
        &self.text
    }
}
impl From<String> for JsString {
    fn from(text: String) -> Self {
        Self {
            units: text.encode_utf16().collect(),
            text,
        }
    }
}
impl From<&str> for JsString {
    fn from(text: &str) -> Self {
        text.to_owned().into()
    }
}
impl std::ops::Deref for JsString {
    type Target = str;
    fn deref(&self) -> &str {
        &self.text
    }
}
impl<'de> serde::Deserialize<'de> for JsString {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct StringVisitor;
        impl<'de> serde::de::Visitor<'de> for StringVisitor {
            type Value = JsString;
            fn expecting(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                f.write_str("a legacy JSON string")
            }
            fn visit_bytes<E: serde::de::Error>(self, bytes: &[u8]) -> Result<JsString, E> {
                let mut units = Vec::new();
                let mut index = 0;
                while index < bytes.len() {
                    let first = bytes[index];
                    let (width, mut point) = match first {
                        0..=0x7f => (1, first as u32),
                        0xc2..=0xdf => (2, (first & 0x1f) as u32),
                        0xe0..=0xef => (3, (first & 0x0f) as u32),
                        0xf0..=0xf4 => (4, (first & 7) as u32),
                        _ => return Err(E::custom("Invalid legacy WTF8 string.")),
                    };
                    let tail = bytes
                        .get(index + 1..index + width)
                        .ok_or_else(|| E::custom("Truncated legacy WTF8 string."))?;
                    for byte in tail {
                        if byte & 0xc0 != 0x80 {
                            return Err(E::custom("Invalid legacy WTF8 continuation."));
                        }
                        point = (point << 6) | (byte & 0x3f) as u32;
                    }
                    if point > 0x10ffff {
                        return Err(E::custom("Invalid legacy WTF8 codepoint."));
                    }
                    if point <= 0xffff {
                        units.push(point as u16);
                    } else {
                        let value = point - 0x10000;
                        units.push(0xd800 | (value >> 10) as u16);
                        units.push(0xdc00 | (value & 0x3ff) as u16);
                    }
                    index += width;
                }
                Ok(JsString::from_units(units))
            }
        }
        deserializer.deserialize_bytes(StringVisitor)
    }
}

struct JsonObject {
    entries: Vec<(JsString, Json)>,
    index: HashMap<Vec<u16>, usize>,
}
impl JsonObject {
    fn new(mut entries: Vec<(JsString, Json)>) -> Self {
        // JSON.parse keeps a property's original position on duplicate writes.
        // Object.keys then enumerates array indices first, numerically.
        entries.sort_by(|(left, _), (right, _)| {
            match (js_array_index(left), js_array_index(right)) {
                (Some(left), Some(right)) => left.cmp(&right),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => std::cmp::Ordering::Equal,
            }
        });
        let index = entries
            .iter()
            .enumerate()
            .map(|(index, (key, _))| (key.units.clone(), index))
            .collect();
        Self { entries, index }
    }
    fn get(&self, key: &str) -> Option<&Json> {
        self.index
            .get(&key.encode_utf16().collect::<Vec<_>>())
            .map(|index| &self.entries[*index].1)
    }
    fn iter(&self) -> impl Iterator<Item = (&JsString, &Json)> + '_ {
        self.entries.iter().map(|(key, value)| (key, value))
    }
}

// Capture borrowed raw values before converting only the last value of each
// duplicate key, retaining the first insertion position and existing guards.
struct RawJsonObject<'a>(Vec<(JsString, &'a serde_json::value::RawValue)>);
impl<'de> serde::Deserialize<'de> for RawJsonObject<'de> {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct ObjectVisitor;
        impl<'de> serde::de::Visitor<'de> for ObjectVisitor {
            type Value = RawJsonObject<'de>;
            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("a JSON object")
            }
            fn visit_map<M: serde::de::MapAccess<'de>>(
                self,
                mut access: M,
            ) -> Result<Self::Value, M::Error> {
                let mut entries: Vec<(JsString, &'de serde_json::value::RawValue)> = Vec::new();
                let mut index: HashMap<JsString, usize> = HashMap::new();
                while let Some((key, value)) =
                    access.next_entry::<JsString, &'de serde_json::value::RawValue>()?
                {
                    if let Some(position) = index.get(&key) {
                        entries[*position].1 = value;
                    } else {
                        index.insert(key.clone(), entries.len());
                        entries.push((key, value));
                    }
                }
                Ok(RawJsonObject(entries))
            }
        }
        deserializer.deserialize_map(ObjectVisitor)
    }
}

enum Json {
    Null,
    Bool(bool),
    Number(f64),
    String(JsString),
    Array(Vec<Json>),
    Object(JsonObject),
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
                let values: RawJsonObject<'_> = serde_json::from_str(text).map_err(invalid)?;
                values
                    .0
                    .into_iter()
                    .map(|(key, value)| {
                        Self::parse(value.get(), depth + 1).map(|value| (key, value))
                    })
                    .collect::<Result<Vec<_>, _>>()
                    .map(|entries| Self::Object(JsonObject::new(entries)))
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
        Json::String(v) => v.text.clone(),
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

fn js_string_units(value: &Json) -> Vec<u16> {
    match value {
        Json::String(value) => value.units.clone(),
        Json::Array(values) => {
            let mut units = Vec::new();
            for (index, value) in values.iter().enumerate() {
                if index != 0 {
                    units.push(b',' as u16);
                }
                if !value.is_null() {
                    units.extend(js_string_units(value));
                }
            }
            units
        }
        _ => js_string(value).encode_utf16().collect(),
    }
}
fn legacy_string_bytes(units: &[u16]) -> Vec<u8> {
    // BufferWriter switches from its manual writer to Buffer UTF8 at40units.
    if units.len() >= 40 {
        return String::from_utf16_lossy(units).into_bytes();
    }
    let mut bytes = Vec::new();
    let mut index = 0;
    while index < units.len() {
        let unit = units[index];
        let mut point = unit as u32;
        if (0xd800..=0xdbff).contains(&unit) {
            if let Some(low) = units
                .get(index + 1)
                .filter(|low| (0xdc00..=0xdfff).contains(*low))
            {
                point = 0x10000 + (((unit as u32 & 0x3ff) << 10) | (*low as u32 & 0x3ff));
                index += 1;
            }
        }
        if point < 0x80 {
            bytes.push(point as u8);
        } else if point < 0x800 {
            bytes.extend([(0xc0 | (point >> 6)) as u8, (0x80 | (point & 0x3f)) as u8]);
        } else if point < 0x10000 {
            bytes.extend([
                (0xe0 | (point >> 12)) as u8,
                (0x80 | ((point >> 6) & 0x3f)) as u8,
                (0x80 | (point & 0x3f)) as u8,
            ]);
        } else {
            bytes.extend([
                (0xf0 | (point >> 18)) as u8,
                (0x80 | ((point >> 12) & 0x3f)) as u8,
                (0x80 | ((point >> 6) & 0x3f)) as u8,
                (0x80 | (point & 0x3f)) as u8,
            ]);
        }
        index += 1;
    }
    bytes
}
fn legacy_field_default(
    field: &FieldDescriptor,
    original: &FieldDescriptor,
    for_wire: bool,
) -> Value {
    if matches!(original.kind(), Kind::String)
        && matches!(field.kind(), Kind::Bytes)
        && !field.is_list()
    {
        if let Value::String(value) = Value::default_value_for_field(original) {
            return Value::Bytes(
                legacy_string_bytes(&value.encode_utf16().collect::<Vec<_>>()).into(),
            );
        }
    }
    legacy_default(field, for_wire)
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
    let view = legacy_descriptor(desc.clone())?;
    parse_prepared(view, desc, text)
}
pub(crate) fn parse_prepared(
    desc: MessageDescriptor,
    original: MessageDescriptor,
    text: &str,
) -> Result<DynamicMessage, String> {
    if text.len() > MAX_MESSAGE {
        return Err("gRPC JSON message exceeds 20 MiB.".into());
    }
    let input = Json::parse(text, 0)?;
    let message = from_object(desc, original, &input, 0)?;
    if message.encoded_len() > MAX_MESSAGE {
        return Err("gRPC message exceeds 20 MiB.".into());
    }
    Ok(message)
}
fn from_object(
    desc: MessageDescriptor,
    original: MessageDescriptor,
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
                let original_inner = original
                    .parent_pool()
                    .get_message_by_name(name)
                    .ok_or("Missing original Any descriptor.")?;
                let inner = from_object(inner, original_inner, object, depth + 1)?;
                let url = url.trim_start_matches('.');
                let url = if url.contains('/') {
                    url.into()
                } else {
                    format!("/{url}")
                };
                let url_field = desc
                    .get_field_by_name("type_url")
                    .ok_or("Missing Any type URL field.")?;
                let url_value = if matches!(url_field.kind(), Kind::Bytes) {
                    Value::Bytes(url.as_bytes().to_vec().into())
                } else {
                    Value::String(url)
                };
                message.set_field(&url_field, url_value);
                message.set_field_by_name("value", Value::Bytes(inner.encode_to_vec().into()));
                return Ok(message);
            }
        }
    }
    for field in desc.fields() {
        let original_field = original
            .get_field(field.number())
            .ok_or("Missing original field descriptor.")?;
        let Some(input) = object.get(field_name(&field)).filter(|v| !v.is_null()) else {
            if field.cardinality() == prost_reflect::Cardinality::Required {
                if matches!(field.kind(), Kind::Message(_)) {
                    return Err(format!(
                        "{}: required message is missing",
                        field.full_name()
                    ));
                }
                message.set_field(&field, legacy_field_default(&field, &original_field, true));
            }
            continue;
        };
        let value = if original_field.is_map() {
            if !truthy(input) {
                continue;
            }
            let Kind::Message(entry) = field.kind() else {
                unreachable!()
            };
            let key = entry.get_field(1).ok_or("Missing map key descriptor.")?;
            let value_field = entry.get_field(2).ok_or("Missing map value descriptor.")?;
            let Kind::Message(original_entry) = original_field.kind() else {
                unreachable!()
            };
            let original_key = original_entry.map_entry_key_field();
            let original_value = original_entry.map_entry_value_field();
            let pairs: Vec<(JsString, &Json)> = match input {
                Json::Object(map) => map.iter().map(|(k, v)| (k.clone(), v)).collect(),
                Json::Array(array) => array
                    .iter()
                    .enumerate()
                    .map(|(i, v)| (i.to_string().into(), v))
                    .collect(),
                _ => return Err(format!("{}: object expected", field.full_name())),
            };
            let mut converted = Vec::new();
            for (k, v) in pairs {
                if let Some(value) = scalar(&value_field, &original_value, v, depth + 1)? {
                    if k.as_str() != "__proto__" {
                        converted.push((k, value));
                    }
                }
            }
            let mut values = Vec::new();
            for (k, value) in converted {
                let raw_key = Json::String(k);
                let key_value = if matches!(original_key.kind(), Kind::Int32) {
                    map_int32_key(&raw_key)?
                } else {
                    scalar(&key, &original_key, &raw_key, depth + 1)?.ok_or("Invalid map key.")?
                };
                let mut item = DynamicMessage::new(entry.clone());
                item.set_field(&key, key_value);
                item.set_field(&value_field, value);
                values.push(Value::Message(item));
            }
            Value::List(values)
        } else if field.is_list() {
            if !truthy(input) {
                continue;
            }
            let input = input
                .as_array()
                .ok_or_else(|| format!("{}: array expected", field.full_name()))?;
            let mut values = Vec::new();
            for input in input {
                let value = scalar(&field, &original_field, input, depth + 1)?
                    .unwrap_or_else(|| Value::default_value(&field.kind()));
                values.push(value);
            }
            Value::List(values)
        } else {
            let Some(value) = scalar(&field, &original_field, input, depth + 1)? else {
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
fn map_int32_key(input: &Json) -> Result<Value, String> {
    let number = number(input);
    if number < 0.0 {
        let magnitude = -number;
        let low = uint32(&Json::Number(magnitude));
        let high = uint32(&Json::Number((magnitude - low as f64) / 4294967296.0));
        let bits = ((high as u64) << 32 | low as u64).wrapping_neg();
        if (bits as i64) >= 0 {
            return Err("Legacy int32 map key requires unwritten writer bytes.".into());
        }
        Ok(Value::I64(bits as i64))
    } else {
        Ok(Value::I64(uint32(&Json::Number(number)) as i64))
    }
}
fn scalar(
    field: &FieldDescriptor,
    original: &FieldDescriptor,
    input: &Json,
    depth: usize,
) -> Result<Option<Value>, String> {
    if matches!(field.kind(), Kind::Int64) && matches!(original.kind(), Kind::Int32) {
        return Ok(Some(Value::I64(uint32(input) as i32 as i64)));
    }
    if matches!(field.kind(), Kind::Bytes) && matches!(original.kind(), Kind::String) {
        return Ok(Some(Value::Bytes(
            legacy_string_bytes(&js_string_units(input)).into(),
        )));
    }
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
                    let length = number(object.get("length").unwrap()).trunc();
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
            let Kind::Message(original) = original.kind() else {
                return Err("Mismatched original message descriptor.".into());
            };
            Value::Message(from_object(desc, original, input, depth)?)
        }
    }))
}

pub(crate) struct LegacyMessage<'a>(pub &'a DynamicMessage, pub usize, pub MessageDescriptor);
impl Serialize for LegacyMessage<'_> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        if self.1 > 64 {
            return Err(serde::ser::Error::custom(
                "gRPC message nesting exceeds 64 levels.",
            ));
        }
        let mut out = serializer.serialize_map(None)?;
        let mut selectors = HashMap::new();
        for field in self
            .0
            .descriptor()
            .fields()
            .filter(|field| self.0.has_field(field))
        {
            if let Some(name) = oneof_name(&field, &self.2) {
                selectors.insert(name, field_name(&field).to_string());
            }
        }
        // protobuf.js initializes repeated, map and ordinary defaults first.
        // Present oneof members are appended later; overwriting an initialized
        // field does not change its JavaScript property position. Four stable
        // descriptor passes preserve field-number order without copying values.
        let descriptor = self.0.descriptor();
        let ordered = (0..4).flat_map(|group| {
            descriptor.fields().filter(move |field| {
                let original = self
                    .2
                    .get_field(field.number())
                    .unwrap_or_else(|| field.clone());
                let rank = if original.containing_oneof().is_some() {
                    3
                } else if original.is_map() {
                    1
                } else if original.is_list() {
                    0
                } else {
                    2
                };
                rank == group
            })
        });
        for field in ordered {
            let present = self.0.has_field(&field);
            if !present && oneof_name(&field, &self.2).is_some() {
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
                    std::borrow::Cow::Owned(legacy_field_default(
                        &field,
                        &self
                            .2
                            .get_field(field.number())
                            .unwrap_or_else(|| field.clone()),
                        false,
                    ))
                };
                out.serialize_entry(
                    field_name(&field),
                    &LegacyValue(
                        &value,
                        field.kind(),
                        self.1 + 1,
                        self.2.get_field(field.number()).map(|field| field.kind()),
                    ),
                )?;
            }
            if present {
                if let Some(name) = oneof_name(&field, &self.2) {
                    if let Some(selected) = selectors.remove(&name) {
                        out.serialize_entry(&name, &selected)?;
                    }
                }
            }
        }
        out.end()
    }
}
struct LegacyValue<'a>(&'a Value, Kind, usize, Option<Kind>);

struct LegacyMapEntries<'a>(&'a [Value], usize, MessageDescriptor);
impl Serialize for LegacyMapEntries<'_> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let original_key = self.2.map_entry_key_field();
        let original_value = self.2.map_entry_value_field();
        let mut entries: Vec<(String, &DynamicMessage)> = Vec::new();
        let mut positions: HashMap<String, usize> = HashMap::new();
        for value in self.0 {
            let Value::Message(entry) = value else {
                return Err(serde::ser::Error::custom("Invalid legacy map entry."));
            };
            let key_field = entry
                .descriptor()
                .get_field(1)
                .ok_or_else(|| serde::ser::Error::custom("Missing map key field."))?;
            let key = entry.get_field(&key_field);
            let missing_long = !entry.has_field(&key_field)
                && matches!(
                    original_key.kind(),
                    Kind::Int64 | Kind::Uint64 | Kind::Sint64 | Kind::Fixed64 | Kind::Sfixed64
                );
            let key = if missing_long {
                "0".into()
            } else {
                match key.as_ref() {
                    Value::I64(value) if matches!(original_key.kind(), Kind::Int32) => {
                        (*value as i32).to_string()
                    }
                    Value::I64(value) => value
                        .to_le_bytes()
                        .iter()
                        .map(|byte| char::from(*byte))
                        .collect(),
                    Value::U64(value) => value
                        .to_le_bytes()
                        .iter()
                        .map(|byte| char::from(*byte))
                        .collect(),
                    Value::Bytes(value) if matches!(original_key.kind(), Kind::String) => {
                        String::from_utf8_lossy(value).into_owned()
                    }
                    Value::String(value) => value.clone(),
                    Value::Bool(value) => value.to_string(),
                    Value::I32(value) => value.to_string(),
                    Value::U32(value) => value.to_string(),
                    _ => return Err(serde::ser::Error::custom("Invalid legacy map key.")),
                }
            };
            // Match own-property enumeration without mutating any prototype.
            if key == "__proto__" {
                continue;
            }
            if let Some(position) = positions.get(&key) {
                entries[*position].1 = entry;
            } else {
                positions.insert(key.clone(), entries.len());
                entries.push((key, entry));
            }
        }
        entries.sort_by(|(left, _), (right, _)| {
            match (js_array_index(left), js_array_index(right)) {
                (Some(left), Some(right)) => left.cmp(&right),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => std::cmp::Ordering::Equal,
            }
        });
        let mut output = serializer.serialize_map(Some(entries.len()))?;
        for (key, entry) in entries {
            let field = entry
                .descriptor()
                .get_field(2)
                .ok_or_else(|| serde::ser::Error::custom("Missing map value field."))?;
            if !entry.has_field(&field)
                && matches!(original_value.kind(), Kind::Message(ref desc) if desc.fields().next().is_some())
            {
                return Err(serde::ser::Error::custom(
                    "Legacy map message value is missing.",
                ));
            }
            let value = entry.get_field(&field);
            output.serialize_entry(
                &key,
                &LegacyValue(&value, field.kind(), self.1, Some(original_value.kind())),
            )?;
        }
        output.end()
    }
}
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
            Value::I64(v) if matches!(self.3, Some(Kind::Int32)) => s.serialize_i32(*v as i32),
            Value::I64(v) => s.serialize_str(&v.to_string()),
            Value::U64(v) => s.serialize_str(&v.to_string()),
            Value::F32(v) => serialize_js_number(*v as f64, s),
            Value::F64(v) => serialize_js_number(*v, s),
            Value::String(v) => s.serialize_str(v),
            Value::Bytes(v) if matches!(self.3, Some(Kind::String)) => {
                s.serialize_str(&String::from_utf8_lossy(v))
            }
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
            Value::Message(v) => {
                let original = match &self.3 {
                    Some(Kind::Message(desc)) => desc.clone(),
                    _ => v.descriptor(),
                };
                LegacyMessage(v, self.2, original).serialize(s)
            }
            Value::List(values) => {
                if let Some(Kind::Message(original)) = &self.3 {
                    if original.is_map_entry() {
                        return LegacyMapEntries(values, self.2, original.clone()).serialize(s);
                    }
                }
                let mut seq = s.serialize_seq(Some(values.len()))?;
                for v in values {
                    seq.serialize_element(&LegacyValue(v, self.1.clone(), self.2, self.3.clone()))?;
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
                        &LegacyValue(
                            value,
                            entry.map_entry_value_field().kind(),
                            self.2,
                            match &self.3 {
                                Some(Kind::Message(original)) => {
                                    Some(original.map_entry_value_field().kind())
                                }
                                _ => None,
                            },
                        ),
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

    #[test]
    fn legacy_surrogate_view_preserves_defaults_any_and_protojson() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/ui/fixtures/grpc-surrogate-reference.json"
        ))
        .unwrap();
        let controls = fixture["controls"].as_array().unwrap();
        assert_eq!(controls.len(), 7);
        for row in controls {
            let label = row["label"].as_str().unwrap();
            let pool = crate::grpc_schema::compile(crate::grpc_schema::ProtoInput {
                entry: "control.proto".into(),
                files: vec![crate::grpc_schema::ProtoFile {
                    name: "control.proto".into(),
                    text: row["source"].as_str().unwrap().into(),
                }],
                include_paths: Vec::new(),
            })
            .unwrap();
            let original = pool
                .get_message_by_name(row["name"].as_str().unwrap())
                .unwrap();
            let snapshot = pool.encode_to_vec();
            let request = parse(original.clone(), row["body"].as_str().unwrap())
                .unwrap_or_else(|e| panic!("{label}: {e}"));
            let wire = request.encode_to_vec();
            let hex: String = wire.iter().map(|b| format!("{b:02x}")).collect();
            assert_eq!(hex, row["wireHex"].as_str().unwrap(), "Wire {label}");
            let response = DynamicMessage::decode(
                legacy_descriptor(original.clone()).unwrap(),
                wire.as_slice(),
            )
            .unwrap();
            assert_eq!(
                crate::grpc_schema::json_mode(
                    &response,
                    crate::grpc_schema::JsonMode::Legacy,
                    original.clone()
                )
                .unwrap(),
                row["json"].as_str().unwrap(),
                "JSON {label}"
            );
            let standard = crate::grpc_schema::json_mode(
                &response,
                crate::grpc_schema::JsonMode::ProtoJson,
                original.clone(),
            );
            if label == "any-known-surrogate" {
                assert!(
                    standard.is_err(),
                    "Standard Any must reject invalid UTF8 inner string"
                );
            } else {
                let value: serde_json::Value = serde_json::from_str(
                    &standard.unwrap_or_else(|e| panic!("ProtoJSON {label}: {e}")),
                )
                .unwrap();
                if label.starts_with("default-") {
                    if label == "default-empty" {
                        assert!(value.get("text").is_none());
                    } else {
                        assert!(value["text"].is_string());
                    }
                    assert!(value["must"].is_string());
                } else {
                    assert!(value["@type"].is_string());
                    assert_eq!(value["text"], "owned");
                }
            }
            if label.starts_with("default-") {
                for mode in [
                    crate::grpc_schema::JsonMode::Legacy,
                    crate::grpc_schema::JsonMode::ProtoJson,
                ] {
                    let example = crate::grpc_example::generate(original.clone(), mode).unwrap();
                    crate::grpc_schema::parse_mode(original.clone(), &example, mode).unwrap();
                }
            }
            assert_eq!(pool.encode_to_vec(), snapshot, "Original pool {label}");
        }
    }

    #[test]
    fn legacy_surrogate_matches_pinned_wire_and_json() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/ui/fixtures/grpc-surrogate-reference.json"
        ))
        .unwrap();
        assert_eq!(fixture["protobufjs"], "7.2.4");
        let pool = crate::grpc_schema::compile(crate::grpc_schema::ProtoInput {
            entry: "surrogate.proto".into(),
            files: vec![crate::grpc_schema::ProtoFile {
                name: "surrogate.proto".into(),
                text: fixture["source"].as_str().unwrap().into(),
            }],
            include_paths: Vec::new(),
        })
        .unwrap();
        let original = pool.get_message_by_name("Text").unwrap();
        let snapshot = pool.encode_to_vec();
        let rows = fixture["rows"].as_array().unwrap();
        assert_eq!(rows.len(), 43);
        for row in rows {
            let label = row["label"].as_str().unwrap();
            let message = parse(original.clone(), row["body"].as_str().unwrap())
                .unwrap_or_else(|e| panic!("{label}: {e}"));
            let wire = message.encode_to_vec();
            let actual: String = wire.iter().map(|b| format!("{b:02x}")).collect();
            assert_eq!(actual, row["wireHex"].as_str().unwrap(), "Wire {label}");
            let view = legacy_descriptor(original.clone()).unwrap();
            assert_eq!(
                legacy_pool(view.parent_pool()).unwrap().encode_to_vec(),
                view.parent_pool().encode_to_vec()
            );
            let decoded = DynamicMessage::decode(view, wire.as_slice()).unwrap();
            let json = crate::grpc_schema::json_mode(
                &decoded,
                crate::grpc_schema::JsonMode::Legacy,
                original.clone(),
            )
            .unwrap();
            assert_eq!(json, row["json"].as_str().unwrap(), "Response {label}");
        }
        assert_eq!(snapshot, pool.encode_to_vec());
        assert!(crate::grpc_schema::parse(original, r#"{"text":"\ud800"}"#).is_err());
    }

    #[test]
    fn legacy_surrogate_property_keys_keep_utf16_identity() {
        let input = Json::parse(r#"{"\ud800":1,"\udfff":2,"�":3,"\ud800":4}"#, 0).unwrap();
        let Json::Object(map) = input else {
            panic!("Expected object");
        };
        assert_eq!(map.entries.len(), 3);
        assert_eq!(map.entries[0].0.units, vec![0xd800]);
        assert_eq!(map.entries[1].0.units, vec![0xdfff]);
        assert_eq!(map.entries[2].0.units, vec![0xfffd]);
        assert_eq!(number(&map.entries[0].1), 4.0);
        assert_eq!(number(map.get("�").unwrap()), 3.0);
        let input = Json::parse(r#"{"😀":1,"\ud83d\ude00":2}"#, 0).unwrap();
        let Json::Object(map) = input else {
            panic!("Expected object");
        };
        assert_eq!(map.entries.len(), 1);
        assert_eq!(number(&map.entries[0].1), 2.0);
    }

    #[test]
    fn legacy_surrogate_unknown_field_is_ignored() {
        let pool = map_order_reference_pool();
        let descriptor = pool.get_message_by_name("Strings").unwrap();
        let parsed = parse(descriptor, r#"{"ignored":"\ud800"}"#).unwrap();
        assert!(parsed.encode_to_vec().is_empty());
    }

    #[test]
    fn legacy_surrogate_short_string_preserves_reference_wire() {
        let pool = map_order_reference_pool();
        let descriptor = pool.get_message_by_name("Strings").unwrap();
        let parsed = parse(descriptor, r#"{"values":{"owned":"\ud800"}}"#).unwrap();
        // Pinned protobuf.js7.2.4 BufferWriter uses its JS UTF8 writer below40units.
        assert_eq!(
            parsed.encode_to_vec(),
            vec![10, 12, 10, 5, b'o', b'w', b'n', b'e', b'd', 18, 3, 0xed, 0xa0, 0x80]
        );
    }

    #[test]
    fn legacy_map_matches_pinned_wire_and_json_vectors() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/ui/fixtures/grpc-map-reference.json"
        ))
        .unwrap();
        assert_eq!(fixture["protobufjs"], "7.2.4");
        let pool = map_order_reference_pool();
        let snapshot = pool.encode_to_vec();
        let rows = fixture["rows"].as_array().unwrap();
        assert_eq!(rows.len(), 70);
        let hex = |value: &str| -> Vec<u8> {
            assert_eq!(value.len() % 2, 0);
            value
                .as_bytes()
                .chunks_exact(2)
                .map(|pair| u8::from_str_radix(std::str::from_utf8(pair).unwrap(), 16).unwrap())
                .collect()
        };
        let mut expected_errors = 0;
        for row in rows {
            let label = row["label"].as_str().unwrap();
            let original = pool
                .get_message_by_name(row["name"].as_str().unwrap())
                .unwrap();
            let wire = if let Some(body) = row["body"].as_str() {
                let request = parse(original.clone(), body)
                    .unwrap_or_else(|error| panic!("{label}: {error}"));
                let wire = request.encode_to_vec();
                assert_eq!(
                    wire,
                    hex(row["wireHex"].as_str().unwrap()),
                    "Request wire {label}"
                );
                wire
            } else {
                hex(row["incomingWireHex"].as_str().unwrap())
            };
            let view = legacy_descriptor(original.clone()).unwrap();
            assert_eq!(
                legacy_pool(view.parent_pool()).unwrap().encode_to_vec(),
                view.parent_pool().encode_to_vec(),
                "Idempotence {label}"
            );
            let response = DynamicMessage::decode(view, wire.as_slice())
                .unwrap_or_else(|error| panic!("Decode {label}: {error}"));
            let json = crate::grpc_schema::json_mode(
                &response,
                crate::grpc_schema::JsonMode::Legacy,
                original,
            );
            if row.get("error").is_some() {
                expected_errors += 1;
                assert_eq!(label, "wire-missing-message-value");
                assert!(json
                    .unwrap_err()
                    .contains("Legacy map message value is missing."));
            } else {
                assert_eq!(
                    json.unwrap_or_else(|error| panic!("Serialize {label}: {error}")),
                    row["json"].as_str().unwrap(),
                    "Exact JSON {label}"
                );
            }
        }
        assert_eq!(expected_errors, 1);
        let refusals = fixture["refusals"].as_array().unwrap();
        assert_eq!(refusals.len(), 3);
        let original = pool.get_message_by_name("Int32").unwrap();
        for refusal in refusals {
            assert_eq!(refusal["reservedBytes"], 10);
            assert!(refusal["actualVarintBytes"].as_u64().unwrap() < 10);
            let body = serde_json::json!({"values":{refusal["key"].as_str().unwrap():"owned"}})
                .to_string();
            assert!(parse(original.clone(), &body)
                .unwrap_err()
                .contains("unwritten writer bytes"));
        }
        assert_eq!(
            pool.encode_to_vec(),
            snapshot,
            "Original map schema changed"
        );
    }

    #[test]
    fn legacy_map_view_does_not_leak_into_protojson_or_examples() {
        let pool = map_order_reference_pool();
        let original = pool.get_message_by_name("Strings").unwrap();
        let parsed = parse(original.clone(), r#"{"values":{"z":"first","a":"last"}}"#).unwrap();
        let before = parsed.encode_to_vec();
        let text = crate::grpc_schema::json_mode(
            &parsed,
            crate::grpc_schema::JsonMode::ProtoJson,
            original.clone(),
        )
        .unwrap();
        let json: serde_json::Value = serde_json::from_str(&text).unwrap();
        assert!(json["values"].is_object());
        assert_eq!(json, serde_json::json!({"values":{"z":"first","a":"last"}}));
        assert_eq!(parsed.encode_to_vec(), before);
        assert_eq!(
            crate::grpc_schema::json_mode(&parsed, crate::grpc_schema::JsonMode::Legacy, original)
                .unwrap(),
            r#"{"values":{"z":"first","a":"last"}}"#
        );
        assert!(crate::grpc_schema::parse(
            pool.get_message_by_name("Int32").unwrap(),
            r#"{"values":{"z":"invalid standard key"}}"#
        )
        .is_err());
        for name in ["Strings", "Int64", "Nested", "Enums"] {
            let descriptor = pool.get_message_by_name(name).unwrap();
            let example = crate::grpc_example::generate(
                descriptor.clone(),
                crate::grpc_schema::JsonMode::ProtoJson,
            )
            .unwrap();
            let json: serde_json::Value = serde_json::from_str(&example).unwrap();
            assert!(
                json["values"].is_object(),
                "ProtoJSON example {name}: {example}"
            );
            crate::grpc_schema::parse(descriptor, &example).unwrap();
        }
    }

    #[test]
    fn legacy_json_object_keys_follow_ecmascript_order() {
        let parsed = Json::parse(
            r#"{"10":10,"2":2,"z":1,"01":1,"a":0,"z":3,"4294967295":5,"4294967294":4,"0":0}"#,
            0,
        )
        .unwrap();
        let Json::Object(object) = parsed else {
            panic!("Expected object")
        };
        assert_eq!(
            object
                .iter()
                .map(|(key, _)| key.as_str())
                .collect::<Vec<_>>(),
            vec!["0", "2", "10", "4294967294", "z", "01", "a", "4294967295"]
        );
        assert_eq!(number(object.get("z").unwrap()), 3.0);
        for (key, expected) in [
            ("0", Some(0)),
            ("4294967294", Some(u32::MAX - 1)),
            ("4294967295", None),
            ("01", None),
            ("-0", None),
            ("+1", None),
            ("1.0", None),
            ("87654321", Some(87654321)),
        ] {
            assert_eq!(js_array_index(key), expected, "Index {key:?}");
        }
    }

    fn map_order_reference_pool() -> DescriptorPool {
        crate::grpc_schema::compile(crate::grpc_schema::ProtoInput {
            entry: "map_order.proto".into(),
            files: vec![crate::grpc_schema::ProtoFile {
                name: "map_order.proto".into(),
                text: r##"syntax="proto3"; message Strings { map<string,string> values=1; } message Int32 { map<int32,string> values=1; } message Uint32 { map<uint32,string> values=1; } message Sint32 { map<sint32,string> values=1; } message Fixed32 { map<fixed32,string> values=1; } message Sfixed32 { map<sfixed32,string> values=1; } message Int64 { map<int64,string> values=1; } message Uint64 { map<uint64,string> values=1; } message Sint64 { map<sint64,string> values=1; } message Fixed64 { map<fixed64,string> values=1; } message Sfixed64 { map<sfixed64,string> values=1; } message Bools { map<bool,string> values=1; } enum Flag { ZERO=0; ONE=1; } message Enums { map<string,Flag> values=1; } message Blobs { map<string,bytes> values=1; } message Child { map<string,string> values=1; } message Nested { map<string,Child> values=1; } message Empty {} message EmptyValues { map<string,Empty> values=1; }"##.into(),
            }], include_paths: Vec::new(),
        }).unwrap()
    }

    #[test]
    fn legacy_map_request_order_preserves_colliding_key_winner() {
        let pool = map_order_reference_pool();
        // Pinned legacy conversion and actual encode/decode, not normalized JSON.
        for (name, body, expected, expected_wire) in [
            (
                "Int32",
                r##"{"values":{"z":"first","a":"last"}}"##,
                r##"{"values":{"0":"last"}}"##,
                vec![
                    0x0a, 0x09, 0x08, 0x00, 0x12, 0x05, 0x66, 0x69, 0x72, 0x73, 0x74, 0x0a, 0x08,
                    0x08, 0x00, 0x12, 0x04, 0x6c, 0x61, 0x73, 0x74,
                ],
            ),
            (
                "Bools",
                r##"{"values":{"z":"first","a":"last"}}"##,
                r##"{"values":{"true":"last"}}"##,
                vec![
                    0x0a, 0x09, 0x08, 0x01, 0x12, 0x05, 0x66, 0x69, 0x72, 0x73, 0x74, 0x0a, 0x08,
                    0x08, 0x01, 0x12, 0x04, 0x6c, 0x61, 0x73, 0x74,
                ],
            ),
        ] {
            let original = pool.get_message_by_name(name).unwrap();
            let request = parse(original.clone(), body).unwrap();
            let wire = request.encode_to_vec();
            let response = DynamicMessage::decode(
                legacy_descriptor(original.clone()).unwrap(),
                wire.as_slice(),
            )
            .unwrap();
            let json = crate::grpc_schema::json_mode(
                &response,
                crate::grpc_schema::JsonMode::Legacy,
                original,
            )
            .unwrap();
            assert_eq!(json, expected, "Map winner {name}: {body}");
            assert_eq!(wire, expected_wire, "Map request wire {name}: {body}");
        }
    }

    #[test]
    fn legacy_map_missing_long_key_keeps_numeric_zero_property() {
        let pool = map_order_reference_pool();
        for (name, wire, expected) in [
            (
                "Int64",
                vec![
                    0x0a, 0x09, 0x12, 0x07, 0x6d, 0x69, 0x73, 0x73, 0x69, 0x6e, 0x67,
                ],
                r##"{"values":{"0":"missing"}}"##,
            ),
            (
                "Int64",
                vec![
                    0x0a, 0x0c, 0x08, 0x00, 0x12, 0x08, 0x65, 0x78, 0x70, 0x6c, 0x69, 0x63, 0x69,
                    0x74,
                ],
                r##"{"values":{"\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000":"explicit"}}"##,
            ),
        ] {
            let original = pool.get_message_by_name(name).unwrap();
            let response = DynamicMessage::decode(
                legacy_descriptor(original.clone()).unwrap(),
                wire.as_slice(),
            )
            .unwrap();
            let json = crate::grpc_schema::json_mode(
                &response,
                crate::grpc_schema::JsonMode::Legacy,
                original,
            )
            .unwrap();
            assert_eq!(json, expected, "Missing versus explicit long map key");
        }
    }

    #[test]
    fn legacy_message_output_order_matches_protobufjs() {
        let pool = crate::grpc_schema::compile(crate::grpc_schema::ProtoInput {
            entry: "message_order.proto".into(),
            files: vec![crate::grpc_schema::ProtoFile {
                name: "message_order.proto".into(),
                text: r##"syntax="proto3"; message Inner { string value=1; } message Order { bool flag=7; string scalar=1; oneof pick { string b=5; int32 a=4; } Inner child=6; map<string,string> labels=3; repeated int32 list=2; } message Envelope { int32 count=1; repeated Order items=2; map<string,Order> groups=3; } message MapFirst { repeated string tail=4; map<string,string> labels=1; bool flag=3; repeated int32 list=2; map<string,int32> counts=5; }"##.into(),
            }],
            include_paths: Vec::new(),
        }).unwrap();
        // Literal JSON and wire from protobuf.js7.2.4, not from this serializer.
        for (name, input, expected, wire) in [
            (
                "Order",
                r##"{}"##,
                r##"{"list":[],"labels":{},"scalar":"","child":null,"flag":false}"##,
                vec![],
            ),
            (
                "Order",
                r##"{"a":1,"b":"x","scalar":"s","list":[2],"labels":{"owned":"v"},"child":{"value":"c"},"flag":true}"##,
                r##"{"list":[2],"labels":{"owned":"v"},"scalar":"s","child":{"value":"c"},"flag":true,"a":1,"pick":"b","b":"x"}"##,
                vec![
                    0x0a, 0x01, 0x73, 0x12, 0x01, 0x02, 0x1a, 0x0a, 0x0a, 0x05, 0x6f, 0x77, 0x6e,
                    0x65, 0x64, 0x12, 0x01, 0x76, 0x20, 0x01, 0x2a, 0x01, 0x78, 0x32, 0x03, 0x0a,
                    0x01, 0x63, 0x38, 0x01,
                ],
            ),
            (
                "Order",
                r##"{"scalar":"s","flag":true}"##,
                r##"{"list":[],"labels":{},"scalar":"s","child":null,"flag":true}"##,
                vec![0x0a, 0x01, 0x73, 0x38, 0x01],
            ),
            (
                "Order",
                r##"{"a":0,"b":""}"##,
                r##"{"list":[],"labels":{},"scalar":"","child":null,"flag":false,"a":0,"pick":"b","b":""}"##,
                vec![0x20, 0x00, 0x2a, 0x00],
            ),
            (
                "Order",
                r##"{"child":{}}"##,
                r##"{"list":[],"labels":{},"scalar":"","child":{"value":""},"flag":false}"##,
                vec![0x32, 0x00],
            ),
            (
                "Envelope",
                r##"{"count":1,"items":[{"a":1,"b":"x","scalar":"s","list":[2],"labels":{"owned":"v"},"child":{"value":"c"},"flag":true}],"groups":{"owned":{"a":1,"b":"x","scalar":"s","list":[2],"labels":{"owned":"v"},"child":{"value":"c"},"flag":true}}}"##,
                r##"{"items":[{"list":[2],"labels":{"owned":"v"},"scalar":"s","child":{"value":"c"},"flag":true,"a":1,"pick":"b","b":"x"}],"groups":{"owned":{"list":[2],"labels":{"owned":"v"},"scalar":"s","child":{"value":"c"},"flag":true,"a":1,"pick":"b","b":"x"}},"count":1}"##,
                vec![
                    0x08, 0x01, 0x12, 0x1e, 0x0a, 0x01, 0x73, 0x12, 0x01, 0x02, 0x1a, 0x0a, 0x0a,
                    0x05, 0x6f, 0x77, 0x6e, 0x65, 0x64, 0x12, 0x01, 0x76, 0x20, 0x01, 0x2a, 0x01,
                    0x78, 0x32, 0x03, 0x0a, 0x01, 0x63, 0x38, 0x01, 0x1a, 0x27, 0x0a, 0x05, 0x6f,
                    0x77, 0x6e, 0x65, 0x64, 0x12, 0x1e, 0x0a, 0x01, 0x73, 0x12, 0x01, 0x02, 0x1a,
                    0x0a, 0x0a, 0x05, 0x6f, 0x77, 0x6e, 0x65, 0x64, 0x12, 0x01, 0x76, 0x20, 0x01,
                    0x2a, 0x01, 0x78, 0x32, 0x03, 0x0a, 0x01, 0x63, 0x38, 0x01,
                ],
            ),
            (
                "MapFirst",
                r##"{}"##,
                r##"{"list":[],"tail":[],"labels":{},"counts":{},"flag":false}"##,
                vec![],
            ),
            (
                "MapFirst",
                r##"{"labels":{"owned":"v"},"list":[2],"flag":true,"tail":["t"],"counts":{"owned":1}}"##,
                r##"{"list":[2],"tail":["t"],"labels":{"owned":"v"},"counts":{"owned":1},"flag":true}"##,
                vec![
                    0x0a, 0x0a, 0x0a, 0x05, 0x6f, 0x77, 0x6e, 0x65, 0x64, 0x12, 0x01, 0x76, 0x12,
                    0x01, 0x02, 0x18, 0x01, 0x22, 0x01, 0x74, 0x2a, 0x09, 0x0a, 0x05, 0x6f, 0x77,
                    0x6e, 0x65, 0x64, 0x10, 0x01,
                ],
            ),
        ] {
            let descriptor = pool.get_message_by_name(name).unwrap();
            let message = parse(descriptor.clone(), input).unwrap();
            assert_eq!(message.encode_to_vec(), wire, "Wire {name}: {input}");
            let actual = crate::grpc_schema::json_mode(
                &message,
                crate::grpc_schema::JsonMode::Legacy,
                descriptor,
            )
            .unwrap();
            assert_eq!(actual, expected, "Ordered JSON {name}: {input}");
        }
    }

    #[test]
    fn legacy_oneof_generated_names_avoid_enum_values_and_extensions() {
        for extensions in [false, true] {
            let mut files: Vec<_> = oneof_reference_pool()
                .file_descriptor_protos()
                .cloned()
                .collect();
            files[0].syntax = Some("proto2".into());
            let choice = &mut files[0].message_type[0];
            let names = ["insomnium_legacy_2", "insomnium_legacy_2_"];
            if extensions {
                choice
                    .extension_range
                    .push(prost_types::descriptor_proto::ExtensionRange {
                        start: Some(100),
                        end: Some(200),
                        ..Default::default()
                    });
                choice.extension = names
                    .iter()
                    .enumerate()
                    .map(|(index, name)| FieldDescriptorProto {
                        name: Some((*name).into()),
                        extendee: Some(".Choice".into()),
                        number: Some(100 + index as i32),
                        label: Some(1),
                        r#type: Some(5),
                        ..Default::default()
                    })
                    .collect();
            } else {
                choice.enum_type.push(prost_types::EnumDescriptorProto {
                    name: Some("Collision".into()),
                    value: names
                        .iter()
                        .enumerate()
                        .map(|(index, name)| prost_types::EnumValueDescriptorProto {
                            name: Some((*name).into()),
                            number: Some(index as i32),
                            ..Default::default()
                        })
                        .collect(),
                    ..Default::default()
                });
            }
            let pool = DescriptorPool::from_file_descriptor_set(FileDescriptorSet { file: files })
                .unwrap();
            let snapshot = pool.encode_to_vec();
            let descriptor = pool.get_message_by_name("Choice").unwrap();
            let parsed = parse(descriptor.clone(), r#"{"a":1,"b":"x"}"#).unwrap_or_else(|error| {
                panic!("Valid schema refused, extensions={extensions}: {error}")
            });
            assert_eq!(parsed.encode_to_vec(), vec![8, 1, 18, 1, 120]);
            assert_eq!(
                serde_json::to_value(LegacyMessage(&parsed, 0, descriptor)).unwrap(),
                serde_json::json!({"a":1,"b":"x","pick":"b"})
            );
            assert_eq!(pool.encode_to_vec(), snapshot);
        }
    }

    fn oneof_reference_pool() -> DescriptorPool {
        prost_reflect::DescriptorPool::from_file_descriptor_set(prost_types::FileDescriptorSet {
            file: vec![prost_types::FileDescriptorProto {
                name: Some("oneof_reference.proto".into()),
                syntax: Some("proto3".into()),
                message_type: vec![prost_types::DescriptorProto {
                    name: Some("Choice".into()),
                    oneof_decl: vec![prost_types::OneofDescriptorProto {
                        name: Some("pick".into()),
                        ..Default::default()
                    }],
                    field: [("a", 1, 5), ("b", 2, 9)]
                        .into_iter()
                        .map(|(name, number, kind)| prost_types::FieldDescriptorProto {
                            name: Some(name.into()),
                            number: Some(number),
                            label: Some(1),
                            r#type: Some(kind),
                            oneof_index: Some(0),
                            ..Default::default()
                        })
                        .collect(),
                    ..Default::default()
                }],
                ..Default::default()
            }],
        })
        .unwrap()
    }

    #[test]
    fn legacy_oneof_preserves_conflicting_members_reference() {
        let pool = oneof_reference_pool();
        let descriptor = pool.get_message_by_name("Choice").unwrap();
        // Independent protobuf.js 7.2.4 reference: both members remain present,
        // including explicit defaults. A last-member-wins workaround loses wire data.
        for (input, expected_wire, expected_json) in [
            (
                r#"{"a":1,"b":"x"}"#,
                vec![8, 1, 18, 1, 120],
                serde_json::json!({"a":1,"b":"x","pick":"b"}),
            ),
            (
                r#"{"b":"x","a":1}"#,
                vec![8, 1, 18, 1, 120],
                serde_json::json!({"a":1,"b":"x","pick":"b"}),
            ),
            (
                r#"{"a":0,"b":""}"#,
                vec![8, 0, 18, 0],
                serde_json::json!({"a":0,"b":"","pick":"b"}),
            ),
        ] {
            let message = parse(descriptor.clone(), input)
                .unwrap_or_else(|error| panic!("Legacy reference input {input} refused: {error}"));
            assert_eq!(message.encode_to_vec(), expected_wire, "{input}");
            let output =
                serde_json::to_value(LegacyMessage(&message, 0, descriptor.clone())).unwrap();
            assert_eq!(output, expected_json, "{input}");
        }
    }

    #[test]
    fn legacy_oneof_decode_order_optional_presence_and_protojson_isolation() {
        for reverse_declaration in [false, true] {
            let mut files: Vec<_> = oneof_reference_pool()
                .file_descriptor_protos()
                .cloned()
                .collect();
            let choice = &mut files[0].message_type[0];
            if reverse_declaration {
                choice.field.reverse();
            }
            choice.oneof_decl.push(prost_types::OneofDescriptorProto {
                name: Some("_c".into()),
                ..Default::default()
            });
            choice.field.push(FieldDescriptorProto {
                name: Some("c".into()),
                number: Some(3),
                label: Some(1),
                r#type: Some(5),
                proto3_optional: Some(true),
                oneof_index: Some(1),
                ..Default::default()
            });
            let pool = DescriptorPool::from_file_descriptor_set(FileDescriptorSet { file: files })
                .unwrap();
            let original_bytes = pool.encode_to_vec();
            let original = pool.get_message_by_name("Choice").unwrap();
            let adapted = legacy_descriptor(original.clone()).unwrap();
            assert_eq!(
                legacy_pool(adapted.parent_pool()).unwrap().encode_to_vec(),
                adapted.parent_pool().encode_to_vec()
            );
            for wire in [vec![8, 1, 18, 1, 120], vec![18, 1, 120, 8, 1]] {
                let message = DynamicMessage::decode(adapted.clone(), wire.as_slice()).unwrap();
                let json =
                    serde_json::to_string(&LegacyMessage(&message, 0, original.clone())).unwrap();
                assert_eq!(json, r#"{"a":1,"pick":"b","b":"x"}"#);
                assert_eq!(json.matches("\"pick\"").count(), 1);
                let standard = DynamicMessage::decode(original.clone(), wire.as_slice()).unwrap();
                assert_eq!(standard.has_field_by_name("a"), wire[0] == 18);
                assert_eq!(standard.has_field_by_name("b"), wire[0] == 8);
            }
            let explicit = parse(original.clone(), r#"{"a":0,"b":"","c":0}"#).unwrap();
            assert_eq!(explicit.encode_to_vec(), vec![8, 0, 18, 0, 24, 0]);
            assert!(crate::grpc_schema::parse(original.clone(), r#"{"a":1,"b":"x"}"#).is_err());
            assert_eq!(
                pool.encode_to_vec(),
                original_bytes,
                "Original schema mutated"
            );
        }
    }

    #[test]
    fn legacy_oneof_nested_list_and_map_reference() {
        let mut pool = oneof_reference_pool();
        let field =
            |name: &str, number, kind, type_name: Option<&str>, repeated| FieldDescriptorProto {
                name: Some(name.into()),
                number: Some(number),
                label: Some(if repeated { 3 } else { 1 }),
                r#type: Some(kind),
                type_name: type_name.map(str::to_owned),
                ..Default::default()
            };
        pool.add_file_descriptor_proto(FileDescriptorProto {
            name: Some("oneof_container.proto".into()),
            syntax: Some("proto3".into()),
            dependency: vec!["oneof_reference.proto".into()],
            message_type: vec![DescriptorProto {
                name: Some("Container".into()),
                field: vec![
                    field("children", 1, 11, Some(".Choice"), true),
                    field("entries", 2, 11, Some(".Container.Entry"), true),
                ],
                nested_type: vec![DescriptorProto {
                    name: Some("Entry".into()),
                    field: vec![
                        field("key", 1, 9, None, false),
                        field("value", 2, 11, Some(".Choice"), false),
                    ],
                    options: Some(prost_types::MessageOptions {
                        map_entry: Some(true),
                        ..Default::default()
                    }),
                    ..Default::default()
                }],
                ..Default::default()
            }],
            ..Default::default()
        })
        .unwrap();
        let original = pool.get_message_by_name("Container").unwrap();
        let input = r#"{"children":[{"a":1,"b":"x"}],"entries":{"owned":{"a":1,"b":"x"}}}"#;
        let expected = serde_json::json!({"children":[{"a":1,"b":"x","pick":"b"}],"entries":{"owned":{"a":1,"b":"x","pick":"b"}}});
        let message = parse(original.clone(), input).unwrap();
        let wire = vec![
            10, 5, 8, 1, 18, 1, 120, 18, 14, 10, 5, 111, 119, 110, 101, 100, 18, 5, 8, 1, 18, 1,
            120,
        ];
        assert_eq!(message.encode_to_vec(), wire);
        assert_eq!(
            serde_json::to_value(LegacyMessage(&message, 0, original.clone())).unwrap(),
            expected
        );
        let decoded = DynamicMessage::decode(
            legacy_descriptor(original.clone()).unwrap(),
            wire.as_slice(),
        )
        .unwrap();
        assert_eq!(
            serde_json::to_value(LegacyMessage(&decoded, 0, original)).unwrap(),
            expected
        );
    }
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
            // Check original-schema wire values, independent of the private legacy view.
            let message =
                DynamicMessage::decode(descriptor.clone(), message.encode_to_vec().as_slice())
                    .unwrap();
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
            let input = Json::String(format!("{ch}1{ch}").into());
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
            let actual =
                serde_json::to_string(&LegacyValue(&value, Kind::Double, 0, None)).unwrap();
            assert_eq!(actual, expected, "Legacy JSON number {number:?}");
        }
        let value = Value::F32(0.1);
        assert_eq!(
            serde_json::to_string(&LegacyValue(&value, Kind::Float, 0, None)).unwrap(),
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
