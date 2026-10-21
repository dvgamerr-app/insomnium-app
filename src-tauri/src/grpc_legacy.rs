//! Insomnium's protobuf.js object representation, separate from ProtoJSON.
//! Wire encoding and descriptor validation remain prost-reflect's responsibility.
use crate::grpc_schema::MAX_MESSAGE;
use base64::{
    alphabet,
    engine::{
        general_purpose::{GeneralPurpose, GeneralPurposeConfig},
        DecodePaddingMode,
    },
    Engine,
};
use prost::Message;
use prost_reflect::{
    DescriptorPool, DynamicMessage, ExtensionDescriptor, FieldDescriptor, Kind, MapKey,
    MessageDescriptor, ReflectMessage, Value,
};
use serde::{
    ser::{SerializeMap, SerializeSeq},
    Serialize, Serializer,
};
use std::collections::{HashMap, HashSet};

// protobuf.js retains all oneof members. Independent presence groups let prost
// preserve both their values and explicit default values, without changing the
// user schema or the standard ProtoJSON descriptor pool.
// protobuf.js Field.packed defaults to true even in proto2. Never change the
// source pool or an explicitly declared packed=false option.
fn needs_legacy_packing(field: &prost_types::FieldDescriptorProto) -> bool {
    use prost_types::field_descriptor_proto::{Label, Type};
    field.label == Some(Label::Repeated as i32)
        && matches!(field.r#type,Some(kind) if ![Type::String as i32,Type::Bytes as i32,Type::Message as i32,Type::Group as i32].contains(&kind))
        && field
            .options
            .as_ref()
            .and_then(|options| options.packed)
            .is_none()
}
fn legacy_packing(field: &mut prost_types::FieldDescriptorProto) {
    if needs_legacy_packing(field) {
        field.options.get_or_insert_with(Default::default).packed = Some(true);
    }
}
pub(crate) fn legacy_pool(pool: &DescriptorPool) -> Result<DescriptorPool, String> {
    if !pool.all_messages().any(|message| {
        message.is_map_entry()
            || message.fields().any(|field| {
                matches!(field.kind(), Kind::String)
                    || needs_legacy_packing(field.field_descriptor_proto())
            })
            || message
                .fields()
                .any(|field| !field.is_list() && !field.is_map() && !field.supports_presence())
            || message.oneofs().any(|group| group.fields().len() > 1)
    }) && !pool.all_extensions().any(|field| {
        matches!(field.kind(), Kind::String) || needs_legacy_packing(field.field_descriptor_proto())
    }) {
        return Ok(pool.clone());
    }
    fn split(message: &mut prost_types::DescriptorProto, proto3: bool, parent: &str) {
        let full_name = if parent.is_empty() {
            message.name.clone().unwrap_or_default()
        } else {
            format!("{parent}.{}", message.name.as_deref().unwrap_or_default())
        };
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
            legacy_packing(field);
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
        // protobuf.js encodes every supplied scalar, including false/zero/empty
        // bytes and the sign bit of -0. Private presence keeps those distinct
        // from absent fields without changing the original protobuf schema.
        if proto3 {
            for field in &mut message.field {
                let any_value = full_name == "google.protobuf.Any"
                    && field.number == Some(2)
                    && field.name.as_deref() == Some("value")
                    && field.r#type
                        == Some(prost_types::field_descriptor_proto::Type::Bytes as i32);
                if field.oneof_index.is_none()
                    && field.label
                        != Some(prost_types::field_descriptor_proto::Label::Repeated as i32)
                    && !matches!(field.r#type, Some(kind) if kind == prost_types::field_descriptor_proto::Type::Message as i32 || kind == prost_types::field_descriptor_proto::Type::Group as i32)
                    && !any_value
                {
                    let mut name = format!("insomnium_scalar_{}", field.number.unwrap_or_default());
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
        // Any's wrapper always supplies value, even for an empty inner message.
        // Keep absent versus explicitly empty bytes distinct in the private view.
        if proto3 && full_name == "google.protobuf.Any" {
            for field in &mut message.field {
                if field.number == Some(2)
                    && field.name.as_deref() == Some("value")
                    && field.r#type == Some(prost_types::field_descriptor_proto::Type::Bytes as i32)
                    && field.label
                        == Some(prost_types::field_descriptor_proto::Label::Optional as i32)
                    && field.oneof_index.is_none()
                {
                    let mut name = "insomnium_any_value".to_owned();
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
        for field in &mut message.extension {
            legacy_packing(field);
            if field.r#type == Some(prost_types::field_descriptor_proto::Type::String as i32) {
                field.r#type = Some(prost_types::field_descriptor_proto::Type::Bytes as i32);
            }
        }
        for nested in &mut message.nested_type {
            split(nested, proto3, &full_name);
        }
    }
    let mut files: Vec<_> = pool.file_descriptor_protos().cloned().collect();
    for file in &mut files {
        for field in &mut file.extension {
            legacy_packing(field);
            if field.r#type == Some(prost_types::field_descriptor_proto::Type::String as i32) {
                field.r#type = Some(prost_types::field_descriptor_proto::Type::Bytes as i32);
            }
        }
        for message in &mut file.message_type {
            split(
                message,
                file.syntax.as_deref() == Some("proto3"),
                file.package.as_deref().unwrap_or_default(),
            );
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
pub(crate) struct JsString {
    units: Vec<u16>,
    text: String,
}
impl JsString {
    pub(crate) fn units(&self) -> &[u16] {
        &self.units
    }
    fn from_units(units: Vec<u16>) -> Self {
        let text = String::from_utf16_lossy(&units);
        Self { units, text }
    }
    pub(crate) fn as_str(&self) -> &str {
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

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct JsonObject {
    entries: Vec<(JsString, Json)>,
    index: HashMap<Vec<u16>, usize>,
}
impl JsonObject {
    pub(crate) fn len(&self) -> usize {
        self.entries.len()
    }
    pub(crate) fn contains_key(&self, key: &str) -> bool {
        self.get(key).is_some()
    }
    pub(crate) fn keys(&self) -> impl Iterator<Item = &JsString> {
        self.entries.iter().map(|(key, _)| key)
    }
    pub(crate) fn new(mut entries: Vec<(JsString, Json)>) -> Self {
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
    pub(crate) fn get(&self, key: &str) -> Option<&Json> {
        self.index
            .get(&key.encode_utf16().collect::<Vec<_>>())
            .map(|index| &self.entries[*index].1)
    }
    pub(crate) fn iter(&self) -> impl Iterator<Item = (&JsString, &Json)> + '_ {
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

#[derive(Clone, Debug, PartialEq)]
// Shared with native DNS service-config policy; workspace JSON stays separate.
pub(crate) enum Json {
    Null,
    Bool(bool),
    Number(f64),
    String(JsString),
    Array(Vec<Json>),
    Object(JsonObject),
}
impl Json {
    pub(crate) fn singleton(key: &str, value: Self) -> Self {
        Self::Object(JsonObject::new(vec![(key.into(), value)]))
    }
    pub(crate) fn as_object(&self) -> Option<&JsonObject> {
        if let Self::Object(value) = self {
            Some(value)
        } else {
            None
        }
    }
    pub(crate) fn as_f64(&self) -> Option<f64> {
        if let Self::Number(value) = self {
            Some(*value)
        } else {
            None
        }
    }
    pub(crate) fn as_str(&self) -> Option<&str> {
        // ASCII syntax consumers may use the display view. Identity-sensitive
        // comparisons must use as_js_string/units (or PartialEq<str>) instead.
        if let Self::String(value) = self {
            Some(value.as_str())
        } else {
            None
        }
    }
    pub(crate) fn as_js_string(&self) -> Option<&JsString> {
        if let Self::String(value) = self {
            Some(value)
        } else {
            None
        }
    }
    pub(crate) fn as_bool(&self) -> Option<bool> {
        if let Self::Bool(value) = self {
            Some(*value)
        } else {
            None
        }
    }
    pub(crate) fn is_string(&self) -> bool {
        matches!(self, Self::String(_))
    }
    pub(crate) fn is_number(&self) -> bool {
        matches!(self, Self::Number(_))
    }
    pub(crate) fn is_boolean(&self) -> bool {
        matches!(self, Self::Bool(_))
    }
    pub(crate) fn parse(text: &str, depth: usize) -> Result<Self, String> {
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
    pub(crate) fn get(&self, key: &str) -> Option<&Self> {
        match self {
            Self::Object(values) => values.get(key),
            _ => None,
        }
    }
    pub(crate) fn as_array(&self) -> Option<&Vec<Self>> {
        match self {
            Self::Array(values) => Some(values),
            _ => None,
        }
    }
    pub(crate) fn is_null(&self) -> bool {
        matches!(self, Self::Null)
    }
    pub(crate) fn is_object(&self) -> bool {
        matches!(self, Self::Object(_))
    }
    pub(crate) fn is_array(&self) -> bool {
        matches!(self, Self::Array(_))
    }
}

impl PartialEq<str> for Json {
    fn eq(&self, text: &str) -> bool {
        self.as_js_string()
            .is_some_and(|value| value.units.iter().copied().eq(text.encode_utf16()))
    }
}
impl PartialEq<&str> for Json {
    fn eq(&self, text: &&str) -> bool {
        self == *text
    }
}
impl std::ops::Index<&str> for Json {
    type Output = Self;
    fn index(&self, key: &str) -> &Self {
        self.get(key).unwrap_or(&Self::Null)
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
// Binary/octal/hex integer strings convert their exact integer value to binary64
// once. Accumulating in f64 rounds each digit and can lose the final sticky bit.
pub(crate) fn radix_number(digits: &str, radix: u32) -> f64 {
    if digits.is_empty() {
        return f64::NAN;
    }
    let width = radix.trailing_zeros();
    let mut bits = 0u32;
    let mut significand = 0u64;
    let mut round = false;
    let mut sticky = false;
    for digit in digits.chars() {
        let Some(digit) = digit.to_digit(radix) else {
            return f64::NAN;
        };
        for shift in (0..width).rev() {
            let bit = (digit >> shift) & 1;
            if bits == 0 && bit == 0 {
                continue;
            }
            bits += 1;
            if bits <= 53 {
                significand = (significand << 1) | bit as u64;
            } else if bits == 54 {
                round = bit != 0;
            } else {
                sticky |= bit != 0;
            }
        }
    }
    if bits <= 53 {
        return significand as f64;
    }
    if round && (sticky || significand & 1 != 0) {
        significand += 1;
    }
    (significand as f64) * 2.0f64.powi((bits - 53) as i32)
}
pub(crate) fn string_number(value: &str) -> f64 {
    number(&Json::String(value.into()))
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
                    return radix_number(digits, radix);
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
// JSON cannot contain callable overrides. An own toString shadows the
// inherited primitive-producing method; arrays reach it through join.
// Validate only values actually coerced, never unrelated object properties.
fn ensure_primitive_conversion(value: &Json) -> Result<(), String> {
    let mut pending = vec![value];
    while let Some(value) = pending.pop() {
        match value {
            Json::Object(object) if object.get("toString").is_some() => {
                return Err("Cannot convert object to primitive value.".into());
            }
            Json::Array(array) => pending.extend(array),
            _ => {}
        }
    }
    Ok(())
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
        Json::Object(value) => {
            let low = value.get("low").unwrap_or(&Json::Null);
            let high = value.get("high").unwrap_or(&Json::Null);
            ensure_primitive_conversion(low)?;
            ensure_primitive_conversion(high)?;
            Ok(uint32(low) as u64 | ((uint32(high) as u64) << 32))
        }
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
    if let Some(text) = crate::grpc_defaults::value(&original.parent_file(), original.path()) {
        let bytes =
            Value::Bytes(legacy_string_bytes(&text.encode_utf16().collect::<Vec<_>>()).into());
        if matches!(original.kind(), Kind::String) {
            return bytes;
        }
        return legacy_default_value(
            bytes,
            field.kind(),
            field.field_descriptor_proto().default_value.as_deref(),
            for_wire,
        );
    }
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

pub(crate) fn field_name(field: &FieldDescriptor) -> &str {
    // Root.load adds these bundled JSON definitions without keepCase parsing.
    // Any is deliberately absent: its bundled field is named type_url.
    // Ordinary source files (including WKT namesakes) still use keepCase.
    let file = field.parent_file();
    if common_field_names(file.name(), file.package_name()) {
        field.json_name()
    } else {
        field.name()
    }
}
pub(crate) fn common_field_names(name: &str, package: &str) -> bool {
    package == "google.protobuf"
        && [
            "google/protobuf/struct.proto",
            "google/protobuf/api.proto",
            "google/protobuf/descriptor.proto",
            "google/protobuf/source_context.proto",
            "google/protobuf/type.proto",
        ]
        .iter()
        .any(|suffix| name.ends_with(suffix))
}
fn legacy_default(field: &FieldDescriptor, for_wire: bool) -> Value {
    let value = Value::default_value_for_field(field);
    if field.is_list() || field.is_map() {
        return value;
    }
    legacy_default_value(
        value,
        field.kind(),
        field.field_descriptor_proto().default_value.as_deref(),
        for_wire,
    )
}
fn extension_default(field: &ExtensionDescriptor, original: &ExtensionDescriptor) -> Value {
    if let Some(text) = crate::grpc_defaults::value(&original.parent_file(), original.path()) {
        let bytes =
            Value::Bytes(legacy_string_bytes(&text.encode_utf16().collect::<Vec<_>>()).into());
        if matches!(original.kind(), Kind::String) {
            return bytes;
        }
        return legacy_default_value(
            bytes,
            field.kind(),
            field.field_descriptor_proto().default_value.as_deref(),
            false,
        );
    }
    if matches!(original.kind(), Kind::String)
        && matches!(field.kind(), Kind::Bytes)
        && !field.is_list()
    {
        if let Value::String(value) = Value::default_value_for_extension(original) {
            return Value::Bytes(
                legacy_string_bytes(&value.encode_utf16().collect::<Vec<_>>()).into(),
            );
        }
    }
    let value = Value::default_value_for_extension(field);
    if field.is_list() {
        return value;
    }
    legacy_default_value(
        value,
        field.kind(),
        field.field_descriptor_proto().default_value.as_deref(),
        false,
    )
}
fn legacy_default_value(value: Value, kind: Kind, default: Option<&str>, for_wire: bool) -> Value {
    match value {
        Value::I64(v) => Value::I64(v as f64 as i64),
        Value::U64(v) if matches!(kind.clone(), Kind::Fixed64) => {
            Value::U64(v as f64 as i64 as u64)
        }
        Value::U64(v) => Value::U64(v as f64 as u64),
        Value::F32(_) if !for_wire => {
            let number = default.and_then(|v| v.parse::<f64>().ok()).unwrap_or(0.0);
            Value::F64(number)
        }
        Value::Bytes(bytes) => {
            if let Ok(text) = std::str::from_utf8(&bytes) {
                if text.len().is_multiple_of(4) {
                    // Field.resolve tests the padded base64 shape, then uses
                    // protobuf.js's permissive trailing-bit decoder. Defaults
                    // without that shape remain literal bytes (unlike input).
                    if let Ok(decoded) = legacy_base64_bytes(text) {
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
struct ConversionContext {
    pool: DescriptorPool,
    lookup: std::cell::OnceCell<crate::grpc_legacy_lookup::AnyLookup>,
    reflection: bool,
}

pub(crate) fn parse_prepared(
    desc: MessageDescriptor,
    original: MessageDescriptor,
    text: &str,
) -> Result<DynamicMessage, String> {
    parse_prepared_profile(desc, original, text, false)
}

pub(crate) fn parse_prepared_profile(
    desc: MessageDescriptor,
    original: MessageDescriptor,
    text: &str,
    reflection: bool,
) -> Result<DynamicMessage, String> {
    if text.len() > MAX_MESSAGE {
        return Err("gRPC JSON message exceeds 20 MiB.".into());
    }
    let input = Json::parse(text, 0)?;
    let context = ConversionContext {
        pool: original.parent_pool().clone(),
        lookup: std::cell::OnceCell::new(),
        reflection,
    };
    let message = from_object(desc, original, &input, 0, &context)?;
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
    context: &ConversionContext,
) -> Result<DynamicMessage, String> {
    from_object_inner(desc, original, object, depth, context, true)
}
// Built-in methods available in the archived Electron 25 runtime, visible to protobuf.js lookup. Object.prototype
// names are rejected by its source parser and are deliberately not synthesized here.
fn inherited_method<'a>(object: &Json, name: &'a str) -> Option<(&'a str, usize)> {
    let arity = match object {
        Json::Array(_) => match name {
            "map" | "filter" | "forEach" | "find" | "findIndex" | "flatMap" | "every" | "some"
            | "concat" | "includes" | "indexOf" | "join" | "lastIndexOf" | "push" | "unshift"
            | "at" | "fill" | "reduce" | "reduceRight" | "sort" | "findLast" | "findLastIndex"
            | "toSorted" => 1,
            "slice" | "splice" | "copyWithin" | "toSpliced" | "with" => 2,
            "keys" | "values" | "entries" | "pop" | "reverse" | "shift" | "flat" | "toReversed" => {
                0
            }
            _ => return None,
        },
        Json::Number(_) => match name {
            "toFixed" | "toExponential" | "toPrecision" => 1,
            _ => return None,
        },
        Json::String(_) => match name {
            "charAt" | "charCodeAt" | "codePointAt" | "at" | "concat" | "endsWith" | "includes"
            | "indexOf" | "lastIndexOf" | "match" | "matchAll" | "padEnd" | "padStart"
            | "repeat" | "search" | "localeCompare" | "startsWith" | "anchor" | "fontcolor"
            | "fontsize" | "link" => 1,
            "replace" | "replaceAll" | "slice" | "split" | "substr" | "substring" => 2,
            "normalize" | "toLowerCase" | "toUpperCase" | "toLocaleLowerCase"
            | "toLocaleUpperCase" | "trim" | "trimStart" | "trimEnd" | "trimLeft" | "trimRight"
            | "big" | "blink" | "bold" | "fixed" | "italics" | "small" | "strike" | "sub"
            | "sup" | "isWellFormed" | "toWellFormed" => 0,
            _ => return None,
        },
        _ => return None,
    };
    Some((
        match name {
            "trimLeft" => "trimStart",
            "trimRight" => "trimEnd",
            _ => name,
        },
        arity,
    ))
}

fn from_object_inner(
    desc: MessageDescriptor,
    original: MessageDescriptor,
    object: &Json,
    depth: usize,
    context: &ConversionContext,
    apply_any_wrapper: bool,
) -> Result<DynamicMessage, String> {
    if depth > 64 {
        return Err("gRPC message nesting exceeds 64 levels.".into());
    }
    if object.is_null() && (desc.fields().next().is_some() || desc.extensions().next().is_some()) {
        return Err("gRPC message requires an object.".into());
    }
    let mut message = DynamicMessage::new(desc.clone());
    // protobuf.js's Any wrapper accepts an explicitly selected known message.
    if apply_any_wrapper && desc.full_name() == "google.protobuf.Any" {
        if let Some(input) = object.get("@type").filter(|value| truthy(value)) {
            let Json::String(url_units) = input else {
                return Err("Legacy Any @type requires a string.".into());
            };
            let url = url_units.as_str();
            let name = url.rsplit('/').next().unwrap_or(url);
            let lookup = context.lookup.get_or_init(|| {
                if context.reflection {
                    crate::grpc_legacy_lookup::AnyLookup::from_descriptor(&context.pool)
                } else {
                    crate::grpc_legacy_lookup::AnyLookup::new(&context.pool)
                }
            });
            use crate::grpc_legacy_lookup::Target;
            let resolved = match lookup.resolve(name) {
                Target::Message(name) => Some((name, true)),
                Target::RawContext => Some((original.full_name().to_owned(), false)),
                Target::NonMessage => {
                    return Err("Legacy Any @type does not name a message.".into())
                }
                Target::Unknown => None,
            };
            if let Some((name, apply_inner_wrapper)) = resolved {
                let inner = desc
                    .parent_pool()
                    .get_message_by_name(&name)
                    .ok_or("Missing legacy Any descriptor.")?;
                let original_inner = context
                    .pool
                    .get_message_by_name(&name)
                    .ok_or("Missing original Any descriptor.")?;
                let inner = from_object_inner(
                    inner,
                    original_inner,
                    object,
                    depth + 1,
                    context,
                    apply_inner_wrapper,
                )?;
                // protobuf.js removes exactly one leading dot, then inserts a slash
                // only when missing. Preserve raw UTF16 through the writer threshold.
                let mut normalized = if url_units.units.first() == Some(&(b'.' as u16)) {
                    url_units.units[1..].to_vec()
                } else {
                    url_units.units.clone()
                };
                if !normalized.contains(&(b'/' as u16)) {
                    normalized.insert(0, b'/' as u16);
                }
                let url_field = desc
                    .get_field_by_name("type_url")
                    .ok_or("Missing Any type URL field.")?;
                let url_value = if matches!(url_field.kind(), Kind::Bytes) {
                    Value::Bytes(legacy_string_bytes(&normalized).into())
                } else {
                    Value::String(String::from_utf16_lossy(&normalized))
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
        let name = if context.reflection {
            original_field.name()
        } else {
            field_name(&field)
        };
        // protobuf.js reads d[fieldName], including the built-in length of an
        // array used as a message (or a string supplied at the root).
        let length = if name == "length" {
            match object {
                Json::Array(values) => Some(Json::Number(values.len() as f64)),
                Json::String(value) => Some(Json::Number(value.units.len() as f64)),
                _ => None,
            }
        } else {
            None
        };
        if length.is_none() && object.get(name).is_none() {
            if let Some((method, arity)) = inherited_method(object, name) {
                if original_field.is_map() && !context.reflection {
                    return Err(format!("{}: object expected", field.full_name()));
                }
                if field.is_list() {
                    return Err(format!("{}: array expected", field.full_name()));
                }
                let value = match original_field.kind() {
                    Kind::String => {
                        let text = format!("function {method}() {{ [native code] }}");
                        if matches!(field.kind(), Kind::Bytes) {
                            Value::Bytes(text.into_bytes().into())
                        } else {
                            Value::String(text)
                        }
                    }
                    Kind::Bytes => Value::Bytes(vec![0; arity].into()),
                    Kind::Bool => Value::Bool(true),
                    Kind::Int32 | Kind::Sint32 | Kind::Sfixed32 => Value::I32(0),
                    Kind::Uint32 | Kind::Fixed32 => Value::U32(0),
                    Kind::Int64 | Kind::Sint64 | Kind::Sfixed64 => Value::I64(0),
                    Kind::Uint64 | Kind::Fixed64 => Value::U64(0),
                    Kind::Float => Value::F32(f32::NAN),
                    Kind::Double => Value::F64(f64::NAN),
                    Kind::Enum(_) => {
                        if field.cardinality() != prost_reflect::Cardinality::Required {
                            continue;
                        }
                        legacy_field_default(&field, &original_field, true)
                    }
                    Kind::Message(_) => {
                        return Err(format!("{}: object expected", field.full_name()))
                    }
                };
                message.set_field(&field, value);
                continue;
            }
        }
        let Some(input) = length
            .as_ref()
            .or_else(|| object.get(name))
            .filter(|v| !v.is_null())
        else {
            if field.cardinality() == prost_reflect::Cardinality::Required {
                if let Kind::Message(nested) = field.kind() {
                    // An empty protobuf.js encoder never dereferences its input,
                    // so even the null prototype default encodes an empty message.
                    if nested.fields().next().is_some() || nested.extensions().next().is_some() {
                        return Err(format!(
                            "{}: required message is missing",
                            field.full_name()
                        ));
                    }
                }
                message.set_field(&field, legacy_field_default(&field, &original_field, true));
            }
            continue;
        };
        let value = if original_field.is_map() && !context.reflection {
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
                if let Some(value) = scalar(&value_field, &original_value, v, depth + 1, context)? {
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
                    scalar(&key, &original_key, &raw_key, depth + 1, context)?
                        .ok_or("Invalid map key.")?
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
            let mut skipped_bytes = false;
            for input in input {
                let value = match scalar(&field, &original_field, input, depth + 1, context)? {
                    Some(value) => {
                        if skipped_bytes {
                            return Err(
                                "Legacy repeated bytes contain an unwritten array element.".into(),
                            );
                        }
                        value
                    }
                    None if matches!(original_field.kind(), Kind::Bytes) => {
                        // fromObject assigns valid byte values by index. Invalid
                        // trailing entries do not extend the array; a later valid
                        // entry would leave a hole that BufferWriter cannot write.
                        skipped_bytes = true;
                        continue;
                    }
                    None => Value::default_value(&field.kind()),
                };
                values.push(value);
            }
            Value::List(values)
        } else {
            match scalar(&field, &original_field, input, depth + 1, context)? {
                Some(value) => value,
                // fromObject can ignore unknown enums and non-byte values.
                // protobuf.js still encodes required fields from prototype defaults.
                None if field.cardinality() == prost_reflect::Cardinality::Required => {
                    legacy_field_default(&field, &original_field, true)
                }
                None => continue,
            }
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
    for extension in desc.extensions() {
        let original_extension = original
            .get_extension(extension.number())
            .ok_or("Missing original extension descriptor.")?;
        let name = format!(".{}", original_extension.full_name());
        let Some(input) = object.get(&name).filter(|value| !value.is_null()) else {
            continue;
        };
        let value = if extension.is_list() {
            if !truthy(input) {
                continue;
            }
            let array = input
                .as_array()
                .ok_or_else(|| format!("{name}: array expected"))?;
            let mut values = Vec::new();
            let mut skipped_bytes = false;
            for input in array {
                match scalar_kind(
                    extension.kind(),
                    original_extension.kind(),
                    &name,
                    input,
                    depth + 1,
                    context,
                )? {
                    Some(value) => {
                        if skipped_bytes {
                            return Err(
                                "Legacy repeated bytes contain an unwritten array element.".into(),
                            );
                        }
                        values.push(value);
                    }
                    None if matches!(original_extension.kind(), Kind::Bytes) => {
                        skipped_bytes = true;
                    }
                    None => values.push(Value::default_value(&extension.kind())),
                }
            }
            Value::List(values)
        } else {
            let Some(value) = scalar_kind(
                extension.kind(),
                original_extension.kind(),
                &name,
                input,
                depth + 1,
                context,
            )?
            else {
                continue;
            };
            value
        };
        if !value.is_valid_for_extension(&extension) {
            return Err(format!("Invalid extension {name}"));
        }
        message.set_extension(&extension, value);
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
    context: &ConversionContext,
) -> Result<Option<Value>, String> {
    scalar_kind(
        field.kind(),
        original.kind(),
        field.full_name(),
        input,
        depth,
        context,
    )
}
fn scalar_kind(
    kind: Kind,
    original_kind: Kind,
    name: &str,
    input: &Json,
    depth: usize,
    context: &ConversionContext,
) -> Result<Option<Value>, String> {
    if matches!(
        original_kind.clone(),
        Kind::String
            | Kind::Double
            | Kind::Float
            | Kind::Int32
            | Kind::Sint32
            | Kind::Sfixed32
            | Kind::Uint32
            | Kind::Fixed32
    ) {
        ensure_primitive_conversion(input)?;
    }
    if matches!(kind.clone(), Kind::Int64) && matches!(original_kind.clone(), Kind::Int32) {
        return Ok(Some(Value::I64(uint32(input) as i32 as i64)));
    }
    if matches!(kind.clone(), Kind::Bytes) && matches!(original_kind.clone(), Kind::String) {
        return Ok(Some(Value::Bytes(
            legacy_string_bytes(&js_string_units(input)).into(),
        )));
    }
    Ok(Some(match kind.clone() {
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
                Json::Array(array) => {
                    for value in array {
                        ensure_primitive_conversion(value)?;
                    }
                    array.iter().map(|v| uint32(v) as u8).collect()
                }
                Json::Object(object) => {
                    let Some(input_length) = object.get("length") else {
                        return Ok(None);
                    };
                    ensure_primitive_conversion(input_length)?;
                    if !(number(input_length) >= 0.0) {
                        return Ok(None);
                    }
                    let raw_length = number(input_length).trunc();
                    let length = uint32(input_length) as usize;
                    // BufferWriter tests length>>>0 before copying. Zero wraps
                    // (including +Infinity) write only an empty bytes field.
                    // Nonzero oversized array-likes still refuse before allocation.
                    if length != 0 && (!raw_length.is_finite() || raw_length > MAX_MESSAGE as f64) {
                        return Err("gRPC bytes exceed 20 MiB.".into());
                    }
                    let mut bytes = Vec::with_capacity(length);
                    for i in 0..length {
                        let value = object.get(&i.to_string()).unwrap_or(&Json::Null);
                        ensure_primitive_conversion(value)?;
                        bytes.push(uint32(value) as u8);
                    }
                    bytes
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
                return Err(format!("{}: object expected", name));
            }
            let Kind::Message(original) = original_kind.clone() else {
                return Err("Mismatched original message descriptor.".into());
            };
            Value::Message(from_object(desc, original, input, depth, context)?)
        }
    }))
}

enum LegacyOutputField {
    Ordinary(FieldDescriptor),
    Extension(ExtensionDescriptor),
}
fn output_fields(
    desc: &MessageDescriptor,
    original: &MessageDescriptor,
    grouped: bool,
) -> Vec<LegacyOutputField> {
    let mut fields: Vec<_> = desc
        .fields()
        .map(LegacyOutputField::Ordinary)
        .chain(desc.extensions().map(LegacyOutputField::Extension))
        .collect();
    fields.sort_by_key(|field| match field {
        LegacyOutputField::Ordinary(field) => {
            let original = original
                .get_field(field.number())
                .unwrap_or_else(|| field.clone());
            let rank = if !grouped {
                0
            } else if original.containing_oneof().is_some() {
                3
            } else if original.is_map() {
                1
            } else if original.is_list() {
                0
            } else {
                2
            };
            (rank, field.number())
        }
        LegacyOutputField::Extension(field) => (
            if !grouped {
                0
            } else if field.is_list() {
                0
            } else {
                2
            },
            field.number(),
        ),
    });
    fields
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
        // All ordinary and extension fields share protobuf.js number/rank ordering.
        for output in output_fields(&self.0.descriptor(), &self.2, true) {
            let field = match output {
                LegacyOutputField::Ordinary(field) => field,
                LegacyOutputField::Extension(extension) => {
                    let original = self.2.get_extension(extension.number()).ok_or_else(|| {
                        serde::ser::Error::custom("Missing original extension descriptor")
                    })?;
                    let name = format!(".{}", original.full_name());
                    let present = self.0.has_extension(&extension);
                    if !present
                        && !extension.is_list()
                        && matches!(extension.kind(), Kind::Message(_))
                    {
                        out.serialize_entry(&name, &Option::<()>::None)?;
                    } else {
                        let value = if present {
                            self.0.get_extension(&extension)
                        } else {
                            std::borrow::Cow::Owned(extension_default(&extension, &original))
                        };
                        out.serialize_entry(
                            &name,
                            &LegacyValue(
                                &value,
                                extension.kind(),
                                self.1 + 1,
                                Some(original.kind()),
                            ),
                        )?;
                    }
                    continue;
                }
            };
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
/// Descriptor-loaded legacy methods use proto-loader options {}, independently
/// of the saved-file defaults/enum-name/long-string/oneof display options.
pub(crate) struct ReflectionMessage<'a>(pub &'a DynamicMessage, pub usize, pub MessageDescriptor);
impl Serialize for ReflectionMessage<'_> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        if self.1 > 64 {
            return Err(serde::ser::Error::custom(
                "gRPC message nesting exceeds 64 levels.",
            ));
        }
        let mut out = serializer.serialize_map(None)?;
        for output in output_fields(&self.0.descriptor(), &self.2, false) {
            let field = match output {
                LegacyOutputField::Ordinary(field) => {
                    if !self.0.has_field(&field) {
                        continue;
                    }
                    field
                }
                LegacyOutputField::Extension(extension) => {
                    if !self.0.has_extension(&extension) {
                        continue;
                    }
                    let original = self.2.get_extension(extension.number()).ok_or_else(|| {
                        serde::ser::Error::custom("Missing original extension descriptor")
                    })?;
                    out.serialize_entry(
                        &format!(".{}", original.full_name()),
                        &ReflectionValue(
                            &self.0.get_extension(&extension),
                            extension.kind(),
                            self.1 + 1,
                            Some(original.kind()),
                        ),
                    )?;
                    continue;
                }
            };
            let original = self
                .2
                .get_field(field.number())
                .unwrap_or_else(|| field.clone());
            out.serialize_entry(
                original.name(),
                &ReflectionValue(
                    &self.0.get_field(&field),
                    field.kind(),
                    self.1 + 1,
                    Some(original.kind()),
                ),
            )?;
        }
        out.end()
    }
}
struct ReflectionValue<'a>(&'a Value, Kind, usize, Option<Kind>);
impl Serialize for ReflectionValue<'_> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self.0 {
            Value::I64(value) if matches!(self.3, Some(Kind::Int32)) => {
                serializer.serialize_i32(*value as i32)
            }
            Value::I64(value) => reflection_long(*value as u64, false, serializer),
            Value::U64(value) => reflection_long(*value, true, serializer),
            Value::EnumNumber(value) => serializer.serialize_i32(*value),
            Value::Message(value) => {
                let original = match &self.3 {
                    Some(Kind::Message(desc)) => desc.clone(),
                    _ => value.descriptor(),
                };
                ReflectionMessage(value, self.2, original).serialize(serializer)
            }
            Value::List(values) => {
                let mut out = serializer.serialize_seq(Some(values.len()))?;
                for value in values {
                    out.serialize_element(&ReflectionValue(
                        value,
                        self.1.clone(),
                        self.2,
                        self.3.clone(),
                    ))?;
                }
                out.end()
            }
            Value::Map(_) => Err(serde::ser::Error::custom(
                "Reflected legacy maps require prepared entry descriptors.",
            )),
            _ => LegacyValue(self.0, self.1.clone(), self.2, self.3.clone()).serialize(serializer),
        }
    }
}
fn reflection_long<S: Serializer>(
    bits: u64,
    unsigned: bool,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    let mut out = serializer.serialize_map(Some(3))?;
    out.serialize_entry("low", &(bits as u32 as i32))?;
    out.serialize_entry("high", &((bits >> 32) as u32 as i32))?;
    out.serialize_entry("unsigned", &unsigned)?;
    out.end()
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
                && matches!(original_value.kind(), Kind::Message(ref desc)
                    if desc.fields().next().is_some() || desc.extensions().next().is_some())
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
                    // protobuf.js uses the first declared name for an aliased
                    // number. get_value explicitly leaves alias selection
                    // unspecified, so preserve source order for these enums.
                    if desc
                        .enum_descriptor_proto()
                        .options
                        .as_ref()
                        .is_some_and(|options| options.allow_alias.unwrap_or(false))
                    {
                        if let Some(value) = desc
                            .enum_descriptor_proto()
                            .value
                            .iter()
                            .find(|value| value.number() == *v)
                        {
                            return s.serialize_str(value.name());
                        }
                    }
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
    fn legacy_required_ignored_values_keep_wire_defaults() {
        use crate::grpc_schema::{compile, JsonMode, ProtoFile, ProtoInput};
        let pool = compile(ProtoInput {
            entry: "required.proto".into(),
            files: vec![ProtoFile {
                name: "required.proto".into(),
                text: r#"syntax="proto2"; enum E { A=3; B=7; }
                    message Empty {} message Nonempty { optional string s=1; }
                    message Refusal { required Nonempty child=1; }
                    message RequiredChild { required string s=1; optional int32 count=2; }
                    message RequiredParent { optional RequiredChild child=1;
                        repeated RequiredChild children=2;
                        map<string,RequiredChild> entries=3;
                        optional group G=4 { required string s=1; optional int32 count=2; }
                        extensions 100 to 199; }
                    extend RequiredParent { optional RequiredChild extensionChild=100; }
                    message ExtensionOnly { extensions 100 to 199; }
                    extend ExtensionOnly { optional int32 extensionOnlyValue=100; }
                    message ExtensionMap { map<string,ExtensionOnly> values=1; }
                    message M { required E e=1 [default=B];
                        required bytes b=2 [default="Zh=="]; optional E opt=3;
                        required Empty empty=4; optional bytes o=5 [default="Zm9="];
                        extensions 100 to 199; }
                    extend M { optional bytes ext=100 [default="AB=="]; }
                    message Lexical { required string s=1 [default="\x41\101\a\v\b\f\'\"\u0041"];
                        required bytes b=2 [default="\x41\101"];
                        optional string t=3 [default="one" /* between */ 'two\n']; extensions 100 to 199; }
                    extend Lexical { optional string lexical_ext=100 [default="\x42"]; }"#
                    .into(),
            }],
            include_paths: vec![],
        })
        .unwrap();
        let snapshot = pool.encode_to_vec();
        let original_map = pool.get_message_by_name("ExtensionMap").unwrap();
        let map_view = legacy_descriptor(original_map.clone()).unwrap();
        let missing =
            crate::grpc_schema::decode_legacy_response(&map_view, b"\x0a\x02\x0a\x00").unwrap();
        assert!(
            crate::grpc_schema::json_mode(&missing, JsonMode::Legacy, original_map.clone())
                .unwrap_err()
                .contains("Legacy map message value is missing.")
        );
        let present =
            crate::grpc_schema::decode_legacy_response(&map_view, b"\x0a\x04\x0a\x00\x12\x00")
                .unwrap();
        assert_eq!(
            crate::grpc_schema::json_mode(&present, JsonMode::Legacy, original_map).unwrap(),
            r#"{"values":{"":{".extensionOnlyValue":0}}}"#
        );
        let response =
            legacy_descriptor(pool.get_message_by_name("RequiredParent").unwrap()).unwrap();
        let required = crate::grpc_schema::decode_legacy_response;
        assert!(required(&response, &[]).is_ok());
        assert!(required(&response, b"\x0a\x02\x0a\x00").is_ok());
        // Singular children/groups/extensions replace; repeated children append.
        let wire = [
            b"\x0a\x04\x0a\x00\x10\x07\x0a\x02\x0a\x00".as_slice(),
            b"\x12\x04\x0a\x00\x10\x07\x12\x02\x0a\x00",
            b"\x23\x0a\x00\x10\x07\x24\x23\x0a\x00\x24",
            b"\xa2\x06\x04\x0a\x00\x10\x07\xa2\x06\x02\x0a\x00",
        ]
        .concat();
        assert_eq!(
            required(&response, &wire).unwrap().encode_to_vec(),
            [
                b"\x0a\x02\x0a\x00".as_slice(),
                b"\x12\x04\x0a\x00\x10\x07\x12\x02\x0a\x00",
                b"\x23\x0a\x00\x24",
                b"\xa2\x06\x02\x0a\x00",
            ]
            .concat()
        );
        for wire in [
            b"\x0a\x00".as_slice(),
            b"\x0a\x00\x0a\x02\x0a\x00",
            b"\x12\x00",
            b"\x1a\x04\x0a\x00\x12\x00",
            b"\x23\x24",
        ] {
            assert!(required(&response, wire)
                .unwrap_err()
                .contains("missing required 's'"));
        }
        // The pinned source parser drops unknown escape letters, unlike protoc.
        // Exercise the serialized descriptor path used by discovery and calls.
        let decoded_pool = DescriptorPool::decode(snapshot.as_slice()).unwrap();
        let lexical = decoded_pool.get_message_by_name("Lexical").unwrap();
        assert_eq!(
            Value::default_value_for_field(&lexical.get_field_by_name("s").unwrap()),
            Value::String("AA\u{7}\u{b}\u{8}\u{c}'\"A".into())
        );
        let message =
            crate::grpc_schema::parse_mode(lexical.clone(), "{}", JsonMode::Legacy).unwrap();
        assert_eq!(
            message.encode_to_vec(),
            [0x0a, 8, b'4', b'1', b'0', b'1', b'0', b'0', b'4', b'1', 0x12, 3, 0xe3, 0x5d, 0x35]
        );
        let output: serde_json::Value = serde_json::from_str(
            &crate::grpc_schema::json_mode(&message, JsonMode::Legacy, lexical).unwrap(),
        )
        .unwrap();
        assert_eq!(
            output,
            serde_json::json!({"s":"41010041","b":{"0":227,"1":93,"2":53},"t":"onetwo\n",".lexical_ext":"42"})
        );
        let original = pool.get_message_by_name("M").unwrap();
        // Exact fromObject/encode output from protobuf.js 7.2.4.
        for (body, expected) in [
            (r#"{}"#, "08071201662200"),
            (r#"{"empty":null}"#, "08071201662200"),
            (
                r#"{"e":"unknown","b":{},"opt":"unknown"}"#,
                "08071201662200",
            ),
            (r#"{"e":[],"b":false}"#, "08071201662200"),
            (r#"{"e":"A","b":[]}"#, "080312002200"),
        ] {
            for mode in [JsonMode::Legacy, JsonMode::LegacyReflection] {
                let message = crate::grpc_schema::parse_mode(original.clone(), body, mode).unwrap();
                let hex: String = message
                    .encode_to_vec()
                    .iter()
                    .map(|byte| format!("{byte:02x}"))
                    .collect();
                assert_eq!(hex, expected, "{body}");
                let output: serde_json::Value = serde_json::from_str(
                    &crate::grpc_schema::json_mode(&message, mode, original.clone()).unwrap(),
                )
                .unwrap();
                if matches!(mode, JsonMode::Legacy) {
                    assert_eq!(output["o"], serde_json::json!({"0":102,"1":111}));
                    assert_eq!(output[".ext"], serde_json::json!({"0":0}));
                } else {
                    assert!(output.get("o").is_none());
                    assert!(output.get(".ext").is_none());
                }
            }
        }
        assert!(crate::grpc_schema::parse_mode(
            original,
            r#"{"e":"unknown","b":{}}"#,
            JsonMode::ProtoJson
        )
        .is_err());
        for mode in [JsonMode::Legacy, JsonMode::LegacyReflection] {
            assert!(crate::grpc_schema::parse_mode(
                pool.get_message_by_name("Refusal").unwrap(),
                "{}",
                mode
            )
            .unwrap_err()
            .contains("required message is missing"));
        }
        assert_eq!(pool.encode_to_vec(), snapshot);
    }
    #[test]
    fn legacy_extensions_preserve_wire_defaults_and_profiles() {
        use crate::grpc_schema::{compile, json_mode, JsonMode, ProtoFile, ProtoInput};
        for packed in ["", " [packed=false]"] {
            let source = format!(
                r#"syntax="proto2"; package p;
              message M {{ optional int32 normal=200; extensions 100 to 199; }}
              extend M {{ optional string text=100 [default="hello"]; repeated int32 nums=101{packed}; }}"#
            );
            let pool = compile(ProtoInput {
                entry: "ext.proto".into(),
                files: vec![ProtoFile {
                    name: "ext.proto".into(),
                    text: source,
                }],
                include_paths: vec![],
            })
            .unwrap();
            let snapshot = pool.encode_to_vec();
            let original = pool.get_message_by_name("p.M").unwrap();
            for reflection in [false, true] {
                let mode = if reflection {
                    JsonMode::LegacyReflection
                } else {
                    JsonMode::Legacy
                };
                for (input, expected) in [
                    (
                        r#"{}"#,
                        if reflection {
                            r#"{}"#
                        } else {
                            r#"{".p.nums":[],".p.text":"hello","normal":0}"#
                        },
                    ),
                    (
                        r#"{".p.text":"Thai Ω",".p.nums":[1,2],"normal":3}"#,
                        if reflection {
                            r#"{".p.text":"Thai Ω",".p.nums":[1,2],"normal":3}"#
                        } else {
                            r#"{".p.nums":[1,2],".p.text":"Thai Ω","normal":3}"#
                        },
                    ),
                ] {
                    let message = parse_prepared_profile(
                        legacy_descriptor(original.clone()).unwrap(),
                        original.clone(),
                        input,
                        reflection,
                    )
                    .unwrap();
                    let wire = message.encode_to_vec();
                    let expected_wire = if input == "{}" {
                        ""
                    } else if packed.is_empty() {
                        "a206075468616920cea9aa06020102c00c03"
                    } else {
                        "a206075468616920cea9a80601a80602c00c03"
                    };
                    assert_eq!(
                        wire.iter()
                            .map(|byte| format!("{byte:02x}"))
                            .collect::<String>(),
                        expected_wire
                    );
                    let decoded = crate::grpc_schema::decode_legacy_response(
                        &message.descriptor(),
                        wire.as_slice(),
                    )
                    .unwrap();
                    assert_eq!(
                        json_mode(&decoded, mode, original.clone()).unwrap(),
                        expected
                    );
                }
            }
            assert!(crate::grpc_schema::parse_mode(
                original,
                r#"{".p.text":"value"}"#,
                JsonMode::ProtoJson
            )
            .is_err());
            assert_eq!(snapshot, pool.encode_to_vec());
        }
    }

    #[test]
    fn legacy_nested_and_typed_extensions_match_pinned_profiles() {
        use crate::grpc_schema::{compile, json_mode, JsonMode, ProtoFile, ProtoInput};
        let pool=compile(ProtoInput {entry:"ext.proto".into(),files:vec![
            ProtoFile{name:"base.proto".into(),text:r#"syntax="proto2";package p;message M{optional int32 normal=200;extensions 100 to 199;}message Child{optional string child_name=1;}enum E{option allow_alias=true;ZERO=0;ONE=1;ALIAS=1;}message Only{extensions 100 to 199;}"#.into()},
            ProtoFile{name:"ext.proto".into(),text:r#"syntax="proto2";import "base.proto";package p;extend M{optional Child child=102;optional E e=103[default=ONE];optional bytes blob=104[default="AB"];optional int64 large=105;repeated bytes chunks=106;}message Scope{extend M{optional int32 nested=107;}}extend Only{optional int32 n=100;}"#.into()},
        ],include_paths:vec![]}).unwrap();
        let snapshot = pool.encode_to_vec();
        let original = pool.get_message_by_name("p.M").unwrap();
        // Archived automock + pinned protobuf.js 7.2.4 produce this wire for
        // both file and reflection descriptors, including extension samples.
        for mode in [JsonMode::Legacy, JsonMode::ProtoJson] {
            for reflection in [false, true] {
                let example = if reflection {
                    crate::grpc_example::generate(original.clone(), mode)
                } else {
                    crate::grpc_example::generate_saved(original.clone(), mode)
                }
                .unwrap();
                let sample = crate::grpc_schema::parse_mode(
                    original.clone(),
                    &example,
                    mode.from_schema(reflection),
                )
                .unwrap();
                assert_eq!(
                    sample
                        .encode_to_vec()
                        .iter()
                        .map(|byte| format!("{byte:02x}"))
                        .collect::<String>(),
                    "b206070a0548656c6c6fb80600c20603a1b2c3c80614d20603a1b2c3d8060ac00c0a"
                );
            }
        }
        let input = r#"{".p.child":{"child_name":"Ω"},".p.e":"ONE",".p.blob":"AP+A",".p.large":"42",".p.chunks":["AQI=","Aw=="],".p.Scope.nested":7,"normal":3}"#;
        for reflection in [false, true] {
            let mode = if reflection {
                JsonMode::LegacyReflection
            } else {
                JsonMode::Legacy
            };
            let only = pool.get_message_by_name("p.Only").unwrap();
            assert!(parse_prepared_profile(
                legacy_descriptor(only.clone()).unwrap(),
                only,
                "null",
                reflection
            )
            .is_err());
            let message = parse_prepared_profile(
                legacy_descriptor(original.clone()).unwrap(),
                original.clone(),
                input,
                reflection,
            )
            .unwrap();
            let wire = message.encode_to_vec();
            assert_eq!(
                wire.iter()
                    .map(|byte| format!("{byte:02x}"))
                    .collect::<String>(),
                "b206040a02cea9b80601c2060300ff80c8062ad206020102d2060103d80607c00c03"
            );
            let decoded =
                crate::grpc_schema::decode_legacy_response(&message.descriptor(), wire.as_slice())
                    .unwrap();
            let expected = if reflection {
                r#"{".p.child":{"child_name":"Ω"},".p.e":1,".p.blob":{"0":0,"1":255,"2":128},".p.large":{"low":42,"high":0,"unsigned":false},".p.chunks":[{"0":1,"1":2},{"0":3}],".p.Scope.nested":7,"normal":3}"#
            } else {
                r#"{".p.chunks":[{"0":1,"1":2},{"0":3}],".p.child":{"child_name":"Ω"},".p.e":"ONE",".p.blob":{"0":0,"1":255,"2":128},".p.large":"42",".p.Scope.nested":7,"normal":3}"#
            };
            assert_eq!(
                json_mode(&decoded, mode, original.clone()).unwrap(),
                expected
            );
        }
        assert_eq!(snapshot, pool.encode_to_vec());
    }
    #[test]
    fn legacy_array_message_length_matches_pinned_loader() {
        let pool = crate::grpc_schema::compile(crate::grpc_schema::ProtoInput {
            entry: "length.proto".into(),
            files: vec![crate::grpc_schema::ProtoFile {
                name: "length.proto".into(),
                text: "syntax=\"proto3\"; message Child { uint32 length=1; } message Envelope { Child child=1; repeated Child children=2; map<string, Child> values=3; } message M { string map=1; bytes forEach=2; bool join=3; int32 push=4; double reduce=5; int64 slice=6; string localeCompare=7; string toFixed=8; bytes toExponential=9; bool toPrecision=10; string findLast=11; bytes findLastIndex=12; string toReversed=13; int32 toSorted=14; bytes toSpliced=15; bool with=16; string isWellFormed=17; bytes toWellFormed=18; }".into(),
            }],
            include_paths: vec![],
        }).unwrap();
        let snapshot = pool.encode_to_vec();
        let methods = pool.get_message_by_name("M").unwrap();
        for (body, hex) in [
            ("[]", "0a2066756e6374696f6e206d61702829207b205b6e617469766520636f64655d207d1201001801200029000000000000f87f30005a2566756e6374696f6e2066696e644c6173742829207b205b6e617469766520636f64655d207d6201006a2766756e6374696f6e20746f52657665727365642829207b205b6e617469766520636f64655d207d70007a020000800101"),
            (r#""abc""#, "30003a2a66756e6374696f6e206c6f63616c65436f6d706172652829207b205b6e617469766520636f64655d207d8a012966756e6374696f6e20697357656c6c466f726d65642829207b205b6e617469766520636f64655d207d920100"),
            ("1", "422466756e6374696f6e20746f46697865642829207b205b6e617469766520636f64655d207d4a01005001"),
            ("{}", ""),
        ] {
            let message = crate::grpc_schema::parse_mode(methods.clone(), body, crate::grpc_schema::JsonMode::Legacy).unwrap();
            let actual: String = message.encode_to_vec().iter().map(|byte| format!("{byte:02x}")).collect();
            assert_eq!(actual, hex, "{body}");
        }
        assert!(crate::grpc_schema::parse_mode(
            methods,
            "[]",
            crate::grpc_schema::JsonMode::ProtoJson
        )
        .is_err());
        assert_eq!(snapshot, pool.encode_to_vec());
        let desc = pool.get_message_by_name("Envelope").unwrap();
        // Exact protobuf.js 7.2.4 fromObject/encode outputs, checked under Bun.
        for (body, hex) in [
            (r#"{"child":[1,2,3]}"#, "0a020803"),
            (r#"{"children":[[],[1,2]]}"#, "1202080012020802"),
            (r#"{"values":{"key":[0,0,0,0]}}"#, "1a090a036b657912020804"),
            (r#"{"child":{"length":7}}"#, "0a020807"),
        ] {
            let message = crate::grpc_schema::parse_mode(
                desc.clone(),
                body,
                crate::grpc_schema::JsonMode::Legacy,
            )
            .unwrap();
            let actual: String = message
                .encode_to_vec()
                .iter()
                .map(|byte| format!("{byte:02x}"))
                .collect();
            assert_eq!(actual, hex, "{body}");
        }
        assert!(crate::grpc_schema::parse_mode(
            desc,
            r#"{"child":[1,2,3]}"#,
            crate::grpc_schema::JsonMode::ProtoJson
        )
        .is_err());
    }

    #[test]
    fn legacy_object_primitive_matches_pinned_loader() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/ui/fixtures/grpc-object-primitive-reference.json"
        ))
        .unwrap();
        let reflected =
            crate::grpc_schema::decode(fixture["descriptorSet"].as_str().unwrap()).unwrap();
        let compiled = crate::grpc_schema::compile(crate::grpc_schema::ProtoInput {
            entry: "primitive.proto".into(),
            files: vec![crate::grpc_schema::ProtoFile {
                name: "primitive.proto".into(),
                text: fixture["source"].as_str().unwrap().into(),
            }],
            include_paths: vec![],
        })
        .unwrap();
        assert_eq!(fixture["rows"].as_array().unwrap().len(), 262);
        assert_eq!(fixture["versions"]["protobufjs"], "7.2.4");
        assert_eq!(fixture["versions"]["protoLoader"], "0.7.13");
        let snapshots = (compiled.encode_to_vec(), reflected.encode_to_vec());
        let mut failures = Vec::new();
        for row in fixture["rows"].as_array().unwrap() {
            let reflection = row["profile"] == "reflection";
            let pool = if reflection { &reflected } else { &compiled };
            let original = pool.get_message_by_name("ownedprimitive.Envelope").unwrap();
            let mode = crate::grpc_schema::JsonMode::Legacy.from_schema(reflection);
            let result = crate::grpc_schema::parse_mode(
                original.clone(),
                row["body"].as_str().unwrap(),
                mode,
            );
            let label = format!("{}:{}", row["profile"], row["label"]);
            if row.get("error").is_some() {
                assert!(
                    crate::grpc_schema::parse_mode(
                        original.clone(),
                        row["body"].as_str().unwrap(),
                        crate::grpc_schema::JsonMode::ProtoJson,
                    )
                    .is_err(),
                    "strict ProtoJSON unexpectedly accepted {label}"
                );
            }
            match result {
                Err(error) if row.get("error").is_none() => {
                    failures.push(format!("{label}: unexpected refusal {error}"))
                }
                Ok(_) if row.get("error").is_some() => {
                    failures.push(format!("{label}: expected refusal"))
                }
                Ok(message) => {
                    let wire = message.encode_to_vec();
                    let hex: String = wire.iter().map(|byte| format!("{byte:02x}")).collect();
                    if hex != row["wireHex"].as_str().unwrap() {
                        failures.push(format!("{label}: wire {hex} != {}", row["wireHex"]));
                        continue;
                    }
                    let decoded = crate::grpc_schema::decode_legacy_response(
                        &legacy_descriptor(original.clone()).unwrap(),
                        wire.as_slice(),
                    )
                    .unwrap();
                    let json = crate::grpc_schema::json_mode(&decoded, mode, original).unwrap();
                    if json != row["json"].as_str().unwrap() {
                        failures.push(format!("{label}: JSON differs"));
                    }
                }
                Err(_) => {}
            }
        }
        assert!(
            failures.is_empty(),
            "{} pinned primitive divergences:\n{}",
            failures.len(),
            failures.join("\n")
        );
        assert_eq!(
            snapshots,
            (compiled.encode_to_vec(), reflected.encode_to_vec())
        );
    }

    #[test]
    fn legacy_bytes_arraylike_matches_pinned_loader() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/ui/fixtures/grpc-bytes-arraylike-reference.json"
        ))
        .unwrap();
        let reflected =
            crate::grpc_schema::decode(fixture["descriptorSet"].as_str().unwrap()).unwrap();
        let compiled = crate::grpc_schema::compile(crate::grpc_schema::ProtoInput {
            entry: "arraylike.proto".into(),
            files: vec![crate::grpc_schema::ProtoFile {
                name: "arraylike.proto".into(),
                text: fixture["source"].as_str().unwrap().into(),
            }],
            include_paths: vec![],
        })
        .unwrap();
        assert_eq!(fixture["rows"].as_array().unwrap().len(), 124);
        assert_eq!(fixture["versions"]["protobufjs"], "7.2.4");
        assert_eq!(fixture["versions"]["protoLoader"], "0.7.13");
        let snapshots = (compiled.encode_to_vec(), reflected.encode_to_vec());
        let mut failures = Vec::new();
        for row in fixture["rows"].as_array().unwrap() {
            let reflection = row["profile"] == "reflection";
            let pool = if reflection { &reflected } else { &compiled };
            let original = pool.get_message_by_name("ownedarraylike.Envelope").unwrap();
            let mode = crate::grpc_schema::JsonMode::Legacy.from_schema(reflection);
            let result = crate::grpc_schema::parse_mode(
                original.clone(),
                row["body"].as_str().unwrap(),
                mode,
            );
            let label = format!("{}:{}", row["profile"], row["label"]);
            match result {
                Err(error) if row.get("error").is_none() => {
                    failures.push(format!("{label}: unexpected refusal {error}"))
                }
                Ok(_) if row.get("error").is_some() => {
                    failures.push(format!("{label}: expected refusal"))
                }
                Ok(message) => {
                    let wire = message.encode_to_vec();
                    let hex: String = wire.iter().map(|byte| format!("{byte:02x}")).collect();
                    if hex != row["wireHex"].as_str().unwrap() {
                        failures.push(format!("{label}: wire {hex} != {}", row["wireHex"]));
                        continue;
                    }
                    let decoded = crate::grpc_schema::decode_legacy_response(
                        &legacy_descriptor(original.clone()).unwrap(),
                        wire.as_slice(),
                    )
                    .unwrap();
                    let json = crate::grpc_schema::json_mode(&decoded, mode, original).unwrap();
                    if json != row["json"].as_str().unwrap() {
                        failures.push(format!("{label}: JSON differs"));
                    }
                }
                Err(_) => {}
            }
        }
        assert!(
            failures.is_empty(),
            "{} pinned bytes divergences:\n{}",
            failures.len(),
            failures.join("\n")
        );
        assert_eq!(
            snapshots,
            (compiled.encode_to_vec(), reflected.encode_to_vec())
        );
    }

    #[test]
    fn legacy_bytes_arraylike_does_not_change_protojson() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/ui/fixtures/grpc-bytes-arraylike-reference.json"
        ))
        .unwrap();
        let pool = crate::grpc_schema::decode(fixture["descriptorSet"].as_str().unwrap()).unwrap();
        let descriptor = pool.get_message_by_name("ownedarraylike.Envelope").unwrap();
        for row in fixture["rows"].as_array().unwrap() {
            assert!(
                crate::grpc_schema::parse_mode(
                    descriptor.clone(),
                    row["body"].as_str().unwrap(),
                    crate::grpc_schema::JsonMode::ProtoJson
                )
                .is_err(),
                "Standard ProtoJSON must reject the array-like byte object: {}",
                row["label"]
            );
        }
        let parsed = crate::grpc_schema::parse_mode(
            descriptor,
            r#"{"data":"QQ=="}"#,
            crate::grpc_schema::JsonMode::ProtoJson,
        )
        .unwrap();
        assert_eq!(parsed.encode_to_vec(), [0x0a, 1, 65]);
    }

    fn any_target_fixture() -> (serde_json::Value, DescriptorPool) {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/ui/fixtures/grpc-any-target-reference.json"
        ))
        .unwrap();
        let pool = crate::grpc_schema::compile(crate::grpc_schema::ProtoInput {
            entry: "any_target.proto".into(),
            files: vec![crate::grpc_schema::ProtoFile {
                name: "any_target.proto".into(),
                text: fixture["source"].as_str().unwrap().into(),
            }],
            include_paths: Vec::new(),
        })
        .unwrap();
        (fixture, pool)
    }

    #[test]
    fn legacy_any_target_long_root_path_refuses_without_recursive_lookup() {
        let (_, pool) = any_target_fixture();
        let body =
            serde_json::json!({"@type": format!("types/{}", ".".repeat(100_000)), "value": [1,2]})
                .to_string();
        let error = parse(
            pool.get_message_by_name("google.protobuf.Any").unwrap(),
            &body,
        )
        .unwrap_err();
        assert_eq!(error, "Legacy Any @type does not name a message.");
    }

    #[test]
    fn legacy_any_target_repeated_conversion_retains_pinned_wire() {
        let (fixture, _) = any_target_fixture();
        let pool = crate::grpc_schema::compile(crate::grpc_schema::ProtoInput {
            entry: "batch.proto".into(),
            files: vec![crate::grpc_schema::ProtoFile {
                name: "batch.proto".into(),
                text: format!(
                    "{} message Batch {{ repeated google.protobuf.Any items=1; }}",
                    fixture["source"].as_str().unwrap()
                ),
            }],
            include_paths: Vec::new(),
        })
        .unwrap();
        let row = fixture["rows"]
            .as_array()
            .unwrap()
            .iter()
            .find(|row| row["label"] == "ownedtargets.Payload")
            .unwrap();
        let input: serde_json::Value = serde_json::from_str(row["body"].as_str().unwrap()).unwrap();
        let body = serde_json::json!({"items": vec![input; 5000]}).to_string();
        let hex = row["wireHex"].as_str().unwrap();
        let single: Vec<u8> = hex
            .as_bytes()
            .chunks_exact(2)
            .map(|pair| u8::from_str_radix(std::str::from_utf8(pair).unwrap(), 16).unwrap())
            .collect();
        assert!(single.len() < 128);
        let mut expected = Vec::new();
        for _ in 0..5000 {
            expected.extend([10, single.len() as u8]);
            expected.extend_from_slice(&single);
        }
        let descriptor = pool.get_message_by_name("ownedtargets.Batch").unwrap();
        let parsed = parse(descriptor.clone(), &body).unwrap();
        assert_eq!(parsed.encode_to_vec(), expected);
        let decoded = DynamicMessage::decode(descriptor, expected.as_slice()).unwrap();
        let Value::List(items) = decoded.get_field_by_name("items").unwrap().into_owned() else {
            panic!("Expected list");
        };
        assert_eq!(items.len(), 5000);
    }

    #[test]
    fn legacy_any_target_matches_pinned_lookup_vectors() {
        let (fixture, pool) = any_target_fixture();
        assert_eq!(fixture["protobufjs"], "7.2.4");
        let snapshot = pool.encode_to_vec();
        let rows = fixture["rows"].as_array().unwrap();
        assert_eq!(rows.len(), 100);
        let mut refusals = 0;
        for row in rows {
            let label = row["label"].as_str().unwrap();
            let original = pool
                .get_message_by_name(row["name"].as_str().unwrap())
                .unwrap();
            let parsed = parse(original.clone(), row["body"].as_str().unwrap());
            if row.get("error").is_some() {
                refusals += 1;
                assert!(parsed.is_err(), "Reference refusal {label}");
                continue;
            }
            let request = parsed.unwrap_or_else(|e| panic!("{label}: {e}"));
            let wire = request.encode_to_vec();
            let hex: String = wire.iter().map(|b| format!("{b:02x}")).collect();
            assert_eq!(
                hex,
                row["wireHex"].as_str().unwrap(),
                "Any target wire {label}"
            );
            let decoded = crate::grpc_schema::decode_legacy_response(
                &legacy_descriptor(original.clone()).unwrap(),
                wire.as_slice(),
            )
            .unwrap();
            let json = crate::grpc_schema::json_mode(
                &decoded,
                crate::grpc_schema::JsonMode::Legacy,
                original,
            )
            .unwrap();
            assert_eq!(
                json,
                row["json"].as_str().unwrap(),
                "Any target JSON {label}"
            );
        }
        assert_eq!(refusals, 62);
        assert_eq!(snapshot, pool.encode_to_vec());
    }

    fn reflection_profile_fixture() -> (serde_json::Value, DescriptorPool) {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/ui/fixtures/grpc-reflection-profile-reference.json"
        ))
        .unwrap();
        assert_eq!(fixture["versions"]["protoLoader"], "0.7.13");
        assert_eq!(fixture["versions"]["protobufjs"], "7.2.4");
        assert_eq!(fixture["versions"]["long"], "5.3.2");
        assert_eq!(fixture["rows"].as_array().unwrap().len(), 46);
        let pool = crate::grpc_schema::decode(fixture["descriptorSet"].as_str().unwrap()).unwrap();
        assert!(pool
            .files()
            .all(|file| file.file_descriptor_proto().source_code_info.is_none()));
        (fixture, pool)
    }

    fn assert_profile_wire(label: &str) {
        let (fixture, _) = reflection_profile_fixture();
        let row = fixture["rows"]
            .as_array()
            .unwrap()
            .iter()
            .find(|row| row["label"] == label)
            .unwrap();
        // Saved files use the compiler path; reflection uses supplied descriptors.
        let pool = crate::grpc_schema::compile(crate::grpc_schema::ProtoInput {
            entry: "profile.proto".into(),
            files: vec![crate::grpc_schema::ProtoFile {
                name: "profile.proto".into(),
                text: fixture["source"].as_str().unwrap().into(),
            }],
            include_paths: Vec::new(),
        })
        .unwrap();
        let parsed = parse(
            pool.get_message_by_name("ownedreflection.Input").unwrap(),
            row["body"].as_str().unwrap(),
        )
        .unwrap();
        let hex: String = parsed
            .encode_to_vec()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        assert_eq!(
            hex,
            row["wireHex"].as_str().unwrap(),
            "Pinned file profile wire {label}"
        );
    }

    #[test]
    fn legacy_reflection_profile_explicit_scalar_zero_wire() {
        assert_profile_wire("explicit-zero-file");
    }

    #[test]
    fn legacy_reflection_profile_negative_zero_wire() {
        assert_profile_wire("negative-zero-file");
    }

    #[test]
    fn legacy_reflection_profile_sparse_response_contract() {
        let (fixture, pool) = reflection_profile_fixture();
        let row = fixture["rows"]
            .as_array()
            .unwrap()
            .iter()
            .find(|row| row["label"] == "absent-reflection")
            .unwrap();
        let original = pool.get_message_by_name("ownedreflection.Input").unwrap();
        let decoded = crate::grpc_schema::decode_legacy_response(
            &legacy_descriptor(original.clone()).unwrap(),
            &[][..],
        )
        .unwrap();
        // Select from explicit schema origin, independently of source positions.
        let json = crate::grpc_schema::json_mode(
            &decoded,
            crate::grpc_schema::JsonMode::Legacy.from_schema(true),
            original,
        )
        .unwrap();
        assert_eq!(json, row["json"].as_str().unwrap());
    }

    #[test]
    fn legacy_reflection_profile_descriptor_map_requires_entries() {
        let (fixture, pool) = reflection_profile_fixture();
        let row = fixture["rows"]
            .as_array()
            .unwrap()
            .iter()
            .find(|row| row["label"] == "empty-containers-reflection")
            .unwrap();
        assert!(row.get("error").is_some());
        assert!(
            crate::grpc_schema::parse_mode(
                pool.get_message_by_name("ownedreflection.Input").unwrap(),
                row["body"].as_str().unwrap(),
                crate::grpc_schema::JsonMode::Legacy.from_schema(true),
            )
            .is_err(),
            "Pinned descriptor loader requires an entry array, not a map object"
        );
    }

    #[test]
    fn legacy_reflection_profile_matches_pinned_loader_vectors() {
        let (fixture, reflected) = reflection_profile_fixture();
        assert_eq!(fixture["versions"]["reflectionClient"], "0.3.0");
        let compiled = crate::grpc_schema::compile(crate::grpc_schema::ProtoInput {
            entry: "profile.proto".into(),
            files: vec![crate::grpc_schema::ProtoFile {
                name: "profile.proto".into(),
                text: fixture["source"].as_str().unwrap().into(),
            }],
            include_paths: Vec::new(),
        })
        .unwrap();
        assert!(
            !crate::grpc_schema::describe(&compiled, crate::grpc_schema::JsonMode::Legacy)
                .unwrap()
                .reflection
        );
        assert!(
            crate::grpc_schema::describe_reflection(
                &reflected,
                crate::grpc_schema::JsonMode::Legacy
            )
            .unwrap()
            .reflection
        );
        assert!(matches!(
            crate::grpc_schema::JsonMode::ProtoJson.from_schema(true),
            crate::grpc_schema::JsonMode::ProtoJson
        ));
        assert!(
            serde_json::from_str::<crate::grpc_schema::JsonMode>("\"legacyReflection\"").is_err()
        );
        let snapshots = (compiled.encode_to_vec(), reflected.encode_to_vec());
        let mut refusals = 0;
        for row in fixture["rows"].as_array().unwrap() {
            let reflection = row["profile"] == "reflection";
            let pool = if reflection { &reflected } else { &compiled };
            let original = pool
                .get_message_by_name(row["name"].as_str().unwrap())
                .unwrap();
            let mode = crate::grpc_schema::JsonMode::Legacy.from_schema(reflection);
            let label = row["label"].as_str().unwrap();
            if row["incoming"] == true {
                let hex = row["wireHex"].as_str().unwrap();
                let wire: Vec<_> = hex
                    .as_bytes()
                    .chunks_exact(2)
                    .map(|pair| u8::from_str_radix(std::str::from_utf8(pair).unwrap(), 16).unwrap())
                    .collect();
                let decoded = crate::grpc_schema::decode_legacy_response(
                    &legacy_descriptor(original.clone()).unwrap(),
                    wire.as_slice(),
                )
                .unwrap();
                let json = crate::grpc_schema::json_mode(&decoded, mode, original).unwrap();
                assert_eq!(
                    json,
                    row["json"].as_str().unwrap(),
                    "Incoming profile JSON {label}"
                );
                continue;
            }
            let parsed = crate::grpc_schema::parse_mode(
                original.clone(),
                row["body"].as_str().unwrap(),
                mode,
            );
            if row.get("error").is_some() {
                refusals += 1;
                assert!(parsed.is_err(), "Pinned refusal {label}");
                continue;
            }
            let message = parsed.unwrap_or_else(|error| panic!("{label}: {error}"));
            let wire = message.encode_to_vec();
            let hex: String = wire.iter().map(|b| format!("{b:02x}")).collect();
            assert_eq!(
                hex,
                row["wireHex"].as_str().unwrap(),
                "Profile wire {label}"
            );
            let view = legacy_descriptor(original.clone()).unwrap();
            assert_eq!(
                legacy_pool(view.parent_pool()).unwrap().encode_to_vec(),
                view.parent_pool().encode_to_vec()
            );
            let decoded =
                crate::grpc_schema::decode_legacy_response(&view, wire.as_slice()).unwrap();
            let json = crate::grpc_schema::json_mode(&decoded, mode, original).unwrap();
            assert_eq!(json, row["json"].as_str().unwrap(), "Profile JSON {label}");
        }
        assert_eq!(refusals, 2);
        assert_eq!(
            snapshots,
            (compiled.encode_to_vec(), reflected.encode_to_vec())
        );
    }

    #[test]
    fn legacy_reflection_profile_any_wkt_matches_pinned_loader() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/ui/fixtures/grpc-reflection-any-reference.json"
        ))
        .unwrap();
        assert_eq!(fixture["versions"]["protoLoader"], "0.7.13");
        assert_eq!(fixture["versions"]["reflectionClient"], "0.3.0");
        let reflected =
            crate::grpc_schema::decode(fixture["descriptorSet"].as_str().unwrap()).unwrap();
        let compiled = crate::grpc_schema::compile(crate::grpc_schema::ProtoInput {
            entry: "profile_any.proto".into(),
            files: vec![crate::grpc_schema::ProtoFile {
                name: "profile_any.proto".into(),
                text: fixture["source"].as_str().unwrap().into(),
            }],
            include_paths: Vec::new(),
        })
        .unwrap();
        let snapshots = (compiled.encode_to_vec(), reflected.encode_to_vec());
        let rows = fixture["rows"].as_array().unwrap();
        assert_eq!(rows.len(), 42);
        let mut refusals = 0;
        for row in rows {
            let reflection = row["profile"] == "reflection";
            let pool = if reflection { &reflected } else { &compiled };
            let original = pool
                .get_message_by_name(row["name"].as_str().unwrap())
                .unwrap();
            let mode = crate::grpc_schema::JsonMode::Legacy.from_schema(reflection);
            let label = row["label"].as_str().unwrap();
            let parsed = crate::grpc_schema::parse_mode(
                original.clone(),
                row["body"].as_str().unwrap(),
                mode,
            );
            if row.get("error").is_some() {
                refusals += 1;
                assert!(parsed.is_err(), "Any profile refusal {label}");
                continue;
            }
            let wire = parsed
                .unwrap_or_else(|error| panic!("{label}: {error}"))
                .encode_to_vec();
            let hex: String = wire.iter().map(|b| format!("{b:02x}")).collect();
            assert_eq!(
                hex,
                row["wireHex"].as_str().unwrap(),
                "Any profile wire {label}"
            );
            let decoded = crate::grpc_schema::decode_legacy_response(
                &legacy_descriptor(original.clone()).unwrap(),
                wire.as_slice(),
            )
            .unwrap();
            let json = crate::grpc_schema::json_mode(&decoded, mode, original).unwrap();
            assert_eq!(
                json,
                row["json"].as_str().unwrap(),
                "Any profile JSON {label}"
            );
        }
        assert_eq!(refusals, 12);
        assert_eq!(
            snapshots,
            (compiled.encode_to_vec(), reflected.encode_to_vec())
        );
    }

    #[test]
    fn legacy_reflection_profile_examples_are_sendable_for_both_ui_modes() {
        let samples = crate::grpc_schema::compile(crate::grpc_schema::ProtoInput {
            entry: "float-example.proto".into(),
            files: vec![crate::grpc_schema::ProtoFile {
                name: "float-example.proto".into(),
                text: r#"syntax="proto2"; message FloatChild { optional float value=1; }
                    message FloatInput { optional float direct=1; repeated float many=2;
                        map<string,float> values=3; optional FloatChild child=4;
                        extensions 100 to 199; }
                    extend FloatInput { optional float sample=100; }"#
                    .into(),
            }],
            include_paths: vec![],
        })
        .unwrap();
        let sample = crate::grpc_example::generate_saved(
            samples.get_message_by_name("FloatInput").unwrap(),
            crate::grpc_schema::JsonMode::Legacy,
        )
        .unwrap();
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&sample).unwrap(),
            serde_json::json!({"direct":1.1,"many":[1.1],"values":{"Hello":1.1},
                "child":{"value":1.1},".sample":1.1})
        );
        let maps = map_order_reference_pool();
        let long_map = maps.get_message_by_name("Int64").unwrap();
        for mode in [
            crate::grpc_schema::JsonMode::Legacy,
            crate::grpc_schema::JsonMode::ProtoJson,
        ] {
            let sample = crate::grpc_example::generate_saved(long_map.clone(), mode).unwrap();
            let value: serde_json::Value = serde_json::from_str(&sample).unwrap();
            assert_eq!(
                value["values"]["20"], "Hello",
                "Request map key must stay decimal: {sample}"
            );
        }
        let (_, pool) = reflection_profile_fixture();
        let original = pool.get_message_by_name("ownedreflection.Input").unwrap();
        for mode in [
            crate::grpc_schema::JsonMode::Legacy,
            crate::grpc_schema::JsonMode::ProtoJson,
        ] {
            let example = crate::grpc_example::generate(original.clone(), mode).unwrap();
            let json: serde_json::Value = serde_json::from_str(&example).unwrap();
            if matches!(mode, crate::grpc_schema::JsonMode::Legacy) {
                assert!(
                    json["labels"].is_array(),
                    "Descriptor entry sample {example}"
                );
                assert_eq!(json["labels"][0]["key"], "Hello");
                assert_eq!(json["labels"][0]["value"], 10);
            } else {
                assert!(json["labels"].is_object(), "Standard map sample {example}");
            }
            crate::grpc_schema::parse_mode(original.clone(), &example, mode.from_schema(true))
                .unwrap();
            let saved = crate::grpc_example::generate_saved(original.clone(), mode).unwrap();
            let saved_json: serde_json::Value = serde_json::from_str(&saved).unwrap();
            assert!(saved_json["labels"].is_object(), "Saved map sample {saved}");
            assert_eq!(saved_json["labels"]["Hello"], 10);
            let saved_message =
                crate::grpc_schema::parse_mode(original.clone(), &saved, mode).unwrap();
            let reflected_message =
                crate::grpc_schema::parse_mode(original.clone(), &example, mode.from_schema(true))
                    .unwrap();
            assert_eq!(
                saved_message.encode_to_vec(),
                reflected_message.encode_to_vec()
            );
        }
        let any: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/ui/fixtures/grpc-reflection-any-reference.json"
        ))
        .unwrap();
        let pool = crate::grpc_schema::decode(any["descriptorSet"].as_str().unwrap()).unwrap();
        let any_message = pool.get_message_by_name("google.protobuf.Any").unwrap();
        let reflected = crate::grpc_example::generate(
            any_message.clone(),
            crate::grpc_schema::JsonMode::LegacyReflection,
        )
        .unwrap();
        let saved = crate::grpc_example::generate_saved(
            any_message.clone(),
            crate::grpc_schema::JsonMode::Legacy,
        )
        .unwrap();
        assert_eq!(
            crate::grpc_schema::parse_mode(
                any_message.clone(),
                &saved,
                crate::grpc_schema::JsonMode::Legacy,
            )
            .unwrap()
            .encode_to_vec(),
            crate::grpc_schema::parse_mode(
                any_message,
                &reflected,
                crate::grpc_schema::JsonMode::LegacyReflection,
            )
            .unwrap()
            .encode_to_vec(),
        );
        let value = pool.get_message_by_name("google.protobuf.Value").unwrap();
        let example =
            crate::grpc_example::generate(value.clone(), crate::grpc_schema::JsonMode::Legacy)
                .unwrap();
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&example).unwrap(),
            serde_json::json!({"null_value":0})
        );
        crate::grpc_schema::parse_mode(
            value,
            &example,
            crate::grpc_schema::JsonMode::Legacy.from_schema(true),
        )
        .unwrap();
    }

    #[test]
    fn reflection_native_example_contract_and_protojson_control() {
        use crate::grpc_schema::{self, JsonMode};
        let (_, pool) = reflection_profile_fixture();
        let original = pool.get_message_by_name("ownedreflection.Input").unwrap();
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/ui/fixtures/grpc-reflection-example-reference.json"
        ))
        .unwrap();
        for row in fixture["rows"].as_array().unwrap() {
            let mode = if row["jsonMode"] == "legacy" {
                JsonMode::Legacy
            } else {
                JsonMode::ProtoJson
            };
            let body = row["body"].as_str().unwrap();
            assert_eq!(
                crate::grpc_example::generate(original.clone(), mode).unwrap(),
                body
            );
            let parsed =
                grpc_schema::parse_mode(original.clone(), body, mode.from_schema(true)).unwrap();
            let hex: String = parsed
                .encode_to_vec()
                .iter()
                .map(|byte| format!("{byte:02x}"))
                .collect();
            assert_eq!(hex, row["wireHex"].as_str().unwrap());
            assert_eq!(
                grpc_schema::json_mode(&parsed, mode.from_schema(true), original.clone()).unwrap(),
                row["responseText"].as_str().unwrap()
            );
        }
        let parsed = grpc_schema::parse_mode(original.clone(), r#"{"number":7,"flag":true,"real":1.5,"text":"owned","data":"AP+A","wide":"9007199254740993","unsignedWide":"18446744073709551615","choice":"ONE"}"#, JsonMode::ProtoJson.from_schema(true)).unwrap();
        assert_eq!(
            grpc_schema::json_mode(&parsed, JsonMode::ProtoJson.from_schema(true), original)
                .unwrap(),
            r#"{"number":7,"flag":true,"real":1.5,"text":"owned","data":"AP+A","wide":"9007199254740993","unsigned_wide":"18446744073709551615","choice":"ONE","list":[],"labels":{}}"#
        );
    }

    fn reflection_service_reference() -> serde_json::Value {
        serde_json::from_str(include_str!(
            "../../tests/ui/fixtures/grpc-reflection-service-reference.json"
        ))
        .unwrap()
    }

    fn assert_reflection_service_row(fixture: &serde_json::Value, label: &str, scoped: bool) {
        let row = fixture["rows"]
            .as_array()
            .unwrap()
            .iter()
            .find(|row| row["label"] == label)
            .unwrap();
        let encoded = if scoped {
            fixture["scopes"]
                .as_array()
                .unwrap()
                .iter()
                .find(|scope| scope["scope"] == row["scope"])
                .unwrap()["descriptorSet"]
                .as_str()
                .unwrap()
        } else {
            fixture["combinedDescriptorSet"].as_str().unwrap()
        };
        let pool = crate::grpc_schema::decode(encoded).unwrap();
        let path = format!("/{}/Call", row["service"].as_str().unwrap());
        let method = if scoped {
            crate::grpc_schema::method(&pool, &path).unwrap()
        } else {
            let scope = fixture["scopes"]
                .as_array()
                .unwrap()
                .iter()
                .find(|scope| scope["scope"] == row["scope"])
                .unwrap();
            let files = scope["fileOrder"]
                .as_array()
                .unwrap()
                .iter()
                .map(|name| name.as_str().unwrap().to_string())
                .collect();
            let schema = crate::grpc_schema::describe_reflection_services(
                &pool,
                &[crate::grpc_schema::ReflectionService {
                    name: row["service"].as_str().unwrap().into(),
                    files,
                }],
                crate::grpc_schema::JsonMode::Legacy,
            )
            .unwrap();
            assert_eq!(
                schema.methods.len(),
                1,
                "Only listed service methods belong to this scope"
            );
            assert_eq!(schema.methods[0].path, path);
            let serialized = serde_json::to_value(&schema).unwrap();
            let names: Vec<String> = serialized["reflectionServices"][0]["files"]
                .as_array()
                .unwrap()
                .iter()
                .map(|name| name.as_str().unwrap().into())
                .collect();
            assert_eq!(
                serialized["reflectionServices"][0]["files"],
                scope["fileOrder"]
            );
            let decoded =
                crate::grpc_schema::decode(serialized["descriptorSet"].as_str().unwrap()).unwrap();
            crate::grpc_schema::reflection_method(&decoded, &path, Some(&names)).unwrap()
        };
        let original = method.input();
        let parsed = crate::grpc_schema::parse_mode(
            original.clone(),
            row["body"].as_str().unwrap(),
            crate::grpc_schema::JsonMode::Legacy.from_schema(true),
        )
        .unwrap();
        let wire = parsed.encode_to_vec();
        let hex: String = wire.iter().map(|byte| format!("{byte:02x}")).collect();
        assert_eq!(
            hex,
            row["wireHex"].as_str().unwrap(),
            "Service-scoped wire {label}"
        );
        assert_eq!(
            crate::grpc_schema::json_mode(
                &parsed,
                crate::grpc_schema::JsonMode::Legacy.from_schema(true),
                original
            )
            .unwrap(),
            row["json"].as_str().unwrap(),
            "Service-scoped JSON {label}"
        );
    }

    #[test]
    fn reflection_service_scope_pinned_roots_are_controls() {
        let fixture = reflection_service_reference();
        assert_eq!(fixture["versions"]["reflectionClient"], "0.3.0");
        assert_eq!(fixture["rows"].as_array().unwrap().len(), 16);
        for row in fixture["rows"].as_array().unwrap() {
            assert_reflection_service_row(&fixture, row["label"].as_str().unwrap(), true);
        }
    }

    #[test]
    fn reflection_service_scope_short_alias_uses_selected_root() {
        assert_reflection_service_row(
            &reflection_service_reference(),
            "isolated-beta:Payload",
            false,
        );
    }

    #[test]
    fn reflection_service_scope_excludes_unreturned_foreign_type() {
        assert_reflection_service_row(
            &reflection_service_reference(),
            "isolated-alpha:ownedclosure.beta.Payload",
            false,
        );
    }

    #[test]
    fn reflection_service_scope_metadata_roundtrip_matches_all_vectors() {
        let fixture = reflection_service_reference();
        for row in fixture["rows"].as_array().unwrap() {
            assert_reflection_service_row(&fixture, row["label"].as_str().unwrap(), false);
        }
    }

    #[test]
    fn reflection_service_scope_invalid_file_indexes_refuse() {
        use crate::grpc_schema;
        let fixture = reflection_service_reference();
        let pool = grpc_schema::decode(fixture["combinedDescriptorSet"].as_str().unwrap()).unwrap();
        let before = pool.encode_to_vec();
        for files in [
            vec!["missing.proto".into()],
            vec!["any.proto".into(), "any.proto".into()],
            vec!["alpha.proto".into()],
            vec!["any.proto".into(); 1025],
        ] {
            assert!(grpc_schema::reflection_pool(&pool, &files).is_err());
        }
        assert!(grpc_schema::reflection_method(
            &pool,
            "/ownedclosure.beta.Echo/Call",
            Some(&["alpha.proto".into(), "any.proto".into()])
        )
        .is_err());
        assert!(
            grpc_schema::reflection_method(&pool, "/ownedclosure.beta.Echo/Call", None).is_ok()
        );
        assert_eq!(pool.encode_to_vec(), before);
    }

    fn assert_any_order_vectors(group: &str) {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/ui/fixtures/grpc-any-order-reference.json"
        ))
        .unwrap();
        assert_eq!(fixture["protobufjs"], "7.2.4");
        let rows = fixture["rows"].as_array().unwrap();
        assert_eq!(rows.len(), 12);
        for row in rows {
            let label = row["label"].as_str().unwrap();
            let selected = match group {
                "service" => label.starts_with("service-before-"),
                "imports" => label.starts_with("main-before-"),
                _ => !label.starts_with("service-before-") && !label.starts_with("main-before-"),
            };
            if !selected {
                continue;
            }
            let pool = crate::grpc_schema::compile(crate::grpc_schema::ProtoInput {
                entry: row["entry"].as_str().unwrap().into(),
                files: row["files"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|file| crate::grpc_schema::ProtoFile {
                        name: file["name"].as_str().unwrap().into(),
                        text: file["text"].as_str().unwrap().into(),
                    })
                    .collect(),
                include_paths: Vec::new(),
            })
            .unwrap();
            assert!(pool
                .get_file_by_name(row["entry"].as_str().unwrap())
                .unwrap()
                .file_descriptor_proto()
                .source_code_info
                .is_some());
            let schema =
                crate::grpc_schema::describe(&pool, crate::grpc_schema::JsonMode::Legacy).unwrap();
            let pool = crate::grpc_schema::decode(&schema.descriptor_set).unwrap();
            let original = pool.get_message_by_name("google.protobuf.Any").unwrap();
            let parsed = parse(original.clone(), row["body"].as_str().unwrap());
            if row.get("error").is_some() {
                assert!(parsed.is_err(), "Declaration-order refusal {label}");
                continue;
            }
            let wire = parsed
                .unwrap_or_else(|error| panic!("{label}: {error}"))
                .encode_to_vec();
            let hex: String = wire.iter().map(|b| format!("{b:02x}")).collect();
            assert_eq!(
                hex,
                row["wireHex"].as_str().unwrap(),
                "Declaration-order wire {label}; files {:?}",
                pool.files()
                    .map(|f| f.name().to_owned())
                    .collect::<Vec<_>>()
            );
            let decoded = crate::grpc_schema::decode_legacy_response(
                &legacy_descriptor(original.clone()).unwrap(),
                wire.as_slice(),
            )
            .unwrap();
            let json = crate::grpc_schema::json_mode(
                &decoded,
                crate::grpc_schema::JsonMode::Legacy,
                original,
            )
            .unwrap();
            assert_eq!(
                json,
                row["json"].as_str().unwrap(),
                "Declaration-order JSON {label}"
            );
        }
    }

    #[test]
    fn legacy_any_order_service_before_message() {
        assert_any_order_vectors("service");
    }

    #[test]
    fn legacy_any_order_main_before_imports() {
        assert_any_order_vectors("imports");
    }

    #[test]
    fn legacy_any_order_source_controls() {
        assert_any_order_vectors("controls");
    }

    fn assert_any_wkt_vectors(empty: bool) {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/ui/fixtures/grpc-any-wkt-reference.json"
        ))
        .unwrap();
        assert_eq!(fixture["protobufjs"], "7.2.4");
        let pool = crate::grpc_schema::compile(crate::grpc_schema::ProtoInput {
            entry: "any_wkt.proto".into(),
            files: vec![crate::grpc_schema::ProtoFile {
                name: "any_wkt.proto".into(),
                text: fixture["source"].as_str().unwrap().into(),
            }],
            include_paths: Vec::new(),
        })
        .unwrap();
        let snapshot = pool.encode_to_vec();
        let rows = fixture["rows"].as_array().unwrap();
        assert_eq!(rows.len(), 40);
        for (index, row) in rows.iter().enumerate() {
            if (index < 14) != empty {
                continue;
            }
            let label = row["label"].as_str().unwrap();
            let original = pool
                .get_message_by_name(row["name"].as_str().unwrap())
                .unwrap();
            let parsed = parse(original.clone(), row["body"].as_str().unwrap());
            if row.get("error").is_some() {
                assert!(parsed.is_err(), "WKT refusal {label}");
                continue;
            }
            let wire = parsed
                .unwrap_or_else(|e| panic!("{label}: {e}"))
                .encode_to_vec();
            let hex: String = wire.iter().map(|b| format!("{b:02x}")).collect();
            assert_eq!(hex, row["wireHex"].as_str().unwrap(), "WKT wire {label}");
            let view = legacy_descriptor(original.clone()).unwrap();
            assert_eq!(
                view.parent_pool().encode_to_vec(),
                legacy_pool(view.parent_pool()).unwrap().encode_to_vec()
            );
            let decoded =
                crate::grpc_schema::decode_legacy_response(&view, wire.as_slice()).unwrap();
            let json = crate::grpc_schema::json_mode(
                &decoded,
                crate::grpc_schema::JsonMode::Legacy,
                original,
            )
            .unwrap();
            assert_eq!(json, row["json"].as_str().unwrap(), "WKT JSON {label}");
        }
        assert_eq!(snapshot, pool.encode_to_vec());
    }

    #[test]
    fn legacy_any_wkt_empty_payload_presence() {
        assert_any_wkt_vectors(true);
    }

    #[test]
    fn legacy_any_wkt_field_alias_lookup() {
        assert_any_wkt_vectors(false);
        // A user-declared namesake is parsed with keepCase, not loaded from
        // protobuf.js's bundled Struct JSON. Its fields must retain their names.
        let pool = crate::grpc_schema::compile(crate::grpc_schema::ProtoInput {
            entry: "custom_value.proto".into(),
            files: vec![crate::grpc_schema::ProtoFile {
                name: "custom_value.proto".into(),
                text:
                    r#"syntax="proto3"; import "google/protobuf/any.proto"; package google.protobuf;
                    message Value { string custom_value=1; int32 null_value=2; }"#
                        .into(),
            }],
            include_paths: vec![],
        })
        .unwrap();
        let original = pool.get_message_by_name("google.protobuf.Value").unwrap();
        let snapshot = pool.encode_to_vec();
        let body =
            r#"{"custom_value":"owned","null_value":7,"customValue":"ignored","nullValue":9}"#;
        let lookup = crate::grpc_legacy_lookup::AnyLookup::new(&pool);
        assert!(matches!(
            lookup.resolve("google.protobuf.Value.custom_value"),
            crate::grpc_legacy_lookup::Target::NonMessage
        ));
        assert!(matches!(
            lookup.resolve("google.protobuf.Value.customValue"),
            crate::grpc_legacy_lookup::Target::Unknown
        ));
        for mode in [
            crate::grpc_schema::JsonMode::Legacy,
            crate::grpc_schema::JsonMode::LegacyReflection,
        ] {
            let message = crate::grpc_schema::parse_mode(original.clone(), body, mode).unwrap();
            assert_eq!(message.encode_to_vec(), b"\x0a\x05owned\x10\x07");
            assert_eq!(
                crate::grpc_schema::json_mode(&message, mode, original.clone()).unwrap(),
                r#"{"custom_value":"owned","null_value":7}"#
            );
        }
        assert_eq!(pool.encode_to_vec(), snapshot);

        // The same common file reached through prefix/include aliases is loaded
        // once, ahead of owned source, while ordinary namesakes above stay owned.
        let input = || crate::grpc_schema::ProtoInput {
            entry: "alias.proto".into(),
            files: vec![
                crate::grpc_schema::ProtoFile {
                    name: "alias.proto".into(),
                    text: r#"syntax="proto2"; package ownedalias;
                        import weak "a/google/protobuf/source_context.proto";
                        import public "b/google/protobuf/source_context.proto";
                        import "source_context.proto";
                        import "google/protobuf/descriptor.proto";
                        import "google/protobuf/any.proto";
                        extend google.protobuf.FieldOptions { optional string note=50001; }
                        message Request {
                            optional string spelling=1 [default="\x41", (note)="owned"];
                            optional google.protobuf.SourceContext source=2;
                        }"#
                    .into(),
                },
                crate::grpc_schema::ProtoFile {
                    name: "includes/google/protobuf/source_context.proto".into(),
                    text: "invalid owned source must be ignored in Legacy".into(),
                },
            ],
            include_paths: vec!["includes/google/protobuf".into()],
        };
        let pool = crate::grpc_schema::compile(input()).unwrap();
        let file = pool.get_file_by_name("alias.proto").unwrap();
        let descriptor = file.file_descriptor_proto();
        assert_eq!(
            descriptor.dependency,
            vec![
                "google/protobuf/source_context.proto".to_owned(),
                "google/protobuf/descriptor.proto".to_owned(),
                "google/protobuf/any.proto".to_owned(),
                pool.get_message_by_name("google.protobuf.SourceContext")
                    .unwrap()
                    .parent_file()
                    .name()
                    .to_owned(),
            ]
        );
        assert!(descriptor.public_dependency.is_empty());
        assert!(descriptor.weak_dependency.is_empty());
        assert!(pool
            .get_message_by_name("google.protobuf.FileDescriptorProto")
            .unwrap()
            .get_field_by_name("edition")
            .is_none());
        let message = pool.get_message_by_name("ownedalias.Request").unwrap();
        let options = message.get_field_by_name("spelling").unwrap().options();
        let extension = pool.get_extension_by_name("ownedalias.note").unwrap();
        assert_eq!(
            options.get_extension(&extension).as_ref(),
            &Value::String("owned".into())
        );
        let parsed = crate::grpc_schema::parse_mode(
            message.clone(),
            r#"{"source":{"fileName":"owned.proto"}}"#,
            crate::grpc_schema::JsonMode::Legacy,
        )
        .unwrap();
        assert_eq!(parsed.encode_to_vec(), b"\x12\x0d\x0a\x0bowned.proto");
        let json =
            crate::grpc_schema::json_mode(&parsed, crate::grpc_schema::JsonMode::Legacy, message)
                .unwrap();
        let json: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(json["spelling"], "41");
        assert_eq!(json["source"]["fileName"], "owned.proto");
        assert!(
            crate::grpc_schema::compile_mode(input(), crate::grpc_schema::JsonMode::ProtoJson)
                .is_err()
        );
        let mut entry = input();
        entry.entry = "includes/google/protobuf/source_context.proto".into();
        assert!(crate::grpc_schema::compile(entry)
            .unwrap()
            .get_file_by_name("google/protobuf/source_context.proto")
            .is_some());
        let mut entry = input();
        entry.entry = "includes/google/protobuf/source_context.proto".into();
        assert!(
            crate::grpc_schema::compile_mode(entry, crate::grpc_schema::JsonMode::ProtoJson)
                .is_err()
        );
        let mut api_only = input();
        api_only.entry = "google/protobuf/api.proto".into();
        assert!(crate::grpc_schema::compile(api_only).is_err());
        let mut api_only = input();
        api_only.entry = "google/protobuf/api.proto".into();
        assert!(crate::grpc_schema::compile_mode(
            api_only,
            crate::grpc_schema::JsonMode::ProtoJson
        )
        .is_ok());
        assert!(pool.get_message_by_name("google.protobuf.Type").is_none());
        let mut type_only = input();
        type_only.entry = "google/protobuf/type.proto".into();
        let types = crate::grpc_schema::compile(type_only).unwrap();
        assert_eq!(
            types
                .get_enum_by_name("google.protobuf.Syntax")
                .unwrap()
                .values()
                .count(),
            2
        );
        assert!(types.get_message_by_name("google.protobuf.Any").is_some());
        assert!(types.get_message_by_name("google.protobuf.Api").is_none());
        let mut overlap = input();
        overlap.files[0]
            .text
            .push_str("\nimport \"google/protobuf/api.proto\";");
        assert!(crate::grpc_schema::compile(overlap).is_err());
        let mut api_with_any = input();
        api_with_any.files[0].text = r#"syntax="proto3";
            import "google/protobuf/api.proto"; import "google/protobuf/any.proto";
            message Root { google.protobuf.Api api=1; }"#
            .into();
        let api = crate::grpc_schema::compile(api_with_any).unwrap();
        assert!(api
            .get_message_by_name("google.protobuf.SourceContext")
            .is_some());
        assert!(api.get_message_by_name("google.protobuf.Type").is_none());
        let mut source_any = input();
        source_any.files[0].text = r#"syntax="proto3"; package google.protobuf;
            import "google/protobuf/api.proto"; import weak "missing.proto";
            message Any { string type_url=1; bytes value=2; }
            message Envelope { Api api=1; }"#
            .into();
        let source = crate::grpc_schema::compile(source_any).unwrap();
        assert_eq!(
            source
                .get_message_by_name("google.protobuf.Any")
                .unwrap()
                .parent_file()
                .name(),
            "alias.proto"
        );
        let envelope = source
            .get_message_by_name("google.protobuf.Envelope")
            .unwrap();
        let parsed = crate::grpc_schema::parse_mode(
            envelope.clone(),
            r#"{"api":{"sourceContext":{"fileName":"owned.proto"}}}"#,
            crate::grpc_schema::JsonMode::Legacy,
        )
        .unwrap();
        assert_eq!(
            parsed.encode_to_vec(),
            b"\x0a\x0f\x2a\x0d\x0a\x0bowned.proto"
        );
        let json: serde_json::Value = serde_json::from_str(
            &crate::grpc_schema::json_mode(&parsed, crate::grpc_schema::JsonMode::Legacy, envelope)
                .unwrap(),
        )
        .unwrap();
        assert_eq!(json["api"]["sourceContext"]["fileName"], "owned.proto");
    }

    fn assert_any_target_wire(label: &str) {
        let (fixture, pool) = any_target_fixture();
        let row = fixture["rows"]
            .as_array()
            .unwrap()
            .iter()
            .find(|r| r["label"] == label)
            .unwrap();
        let request = parse(
            pool.get_message_by_name(row["name"].as_str().unwrap())
                .unwrap(),
            row["body"].as_str().unwrap(),
        )
        .unwrap();
        let hex: String = request
            .encode_to_vec()
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect();
        assert_eq!(
            hex,
            row["wireHex"].as_str().unwrap(),
            "Pinned target {label}"
        );
    }

    #[test]
    fn legacy_any_target_resolves_relative_message() {
        assert_any_target_wire("Payload");
        let source = r#"syntax="proto2"; package ownedlookup;
            import "google/protobuf/descriptor.proto";
            message Box {
                message Payload { optional string value=1; }
                enum Choice { ZERO=0; ONE=1; }
            }
            message Request {
                optional string Payload=9;
                optional Payload data=1;
                optional Choice choice=2;
                optional google.protobuf.Type descriptorKind=3;
            }
            service Caller { rpc Call(Payload) returns(Request); }"#;
        let input = || crate::grpc_schema::ProtoInput {
            entry: "lookup.proto".into(),
            files: vec![crate::grpc_schema::ProtoFile {
                name: "lookup.proto".into(),
                text: source.into(),
            }],
            include_paths: vec![],
        };
        let pool = crate::grpc_schema::compile(input()).unwrap();
        let method = pool
            .get_service_by_name("ownedlookup.Caller")
            .unwrap()
            .methods()
            .next()
            .unwrap();
        assert_eq!(method.input().full_name(), "ownedlookup.Box.Payload");
        assert_eq!(method.output().full_name(), "ownedlookup.Request");
        let desc = method.output();
        let body = r#"{"data":{"value":"owned"},"choice":"ONE","descriptorKind":"TYPE_STRING"}"#;
        let parsed = crate::grpc_schema::parse_mode(
            desc.clone(),
            body,
            crate::grpc_schema::JsonMode::Legacy,
        )
        .unwrap();
        assert_eq!(
            parsed.encode_to_vec(),
            b"\x0a\x07\x0a\x05owned\x10\x01\x18\x09"
        );
        let json: serde_json::Value = serde_json::from_str(
            &crate::grpc_schema::json_mode(&parsed, crate::grpc_schema::JsonMode::Legacy, desc)
                .unwrap(),
        )
        .unwrap();
        assert_eq!(json["data"]["value"], "owned");
        assert_eq!(json["choice"], "ONE");
        assert_eq!(json["descriptorKind"], "TYPE_STRING");
        // Same source-loader regression: namespace allocation determines
        // whether Object.prototype names collide, unlike a blanket name ban.
        let compile_source = |text: &str| {
            crate::grpc_schema::compile(crate::grpc_schema::ProtoInput {
                entry: "prototype.proto".into(),
                files: vec![crate::grpc_schema::ProtoFile {
                    name: "prototype.proto".into(),
                    text: text.into(),
                }],
                include_paths: vec![],
            })
        };
        assert!(compile_source(r#"syntax="proto3"; package owned; message constructor { string value=1; } service Calls { rpc Call(constructor) returns(constructor); }"#)
            .unwrap().get_message_by_name("owned.constructor").is_some());
        assert!(compile_source(
            r#"syntax="proto3"; package owned; message Input { string constructor=1; }"#
        )
        .unwrap_err()
        .contains("inherited dictionary member"));
        assert!(compile_source(r#"syntax="proto3"; package owned; message First {} message constructor { string value=1; }"#)
            .unwrap_err().contains("inherited dictionary member"));
        assert!(
            crate::grpc_schema::compile_mode(input(), crate::grpc_schema::JsonMode::ProtoJson)
                .is_err()
        );
    }

    #[test]
    fn legacy_any_target_hides_synthetic_map_entry() {
        assert_any_target_wire("ownedtargets.Payload.LabelsEntry");
    }

    #[test]
    fn legacy_any_target_empty_name_wraps_raw_any_context() {
        assert_any_target_wire("");
    }

    #[test]
    fn legacy_any_url_matches_pinned_wire_and_json() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/ui/fixtures/grpc-any-url-reference.json"
        ))
        .unwrap();
        assert_eq!(fixture["protobufjs"], "7.2.4");
        let pool = crate::grpc_schema::compile(crate::grpc_schema::ProtoInput {
            entry: "any_url.proto".into(),
            files: vec![crate::grpc_schema::ProtoFile {
                name: "any_url.proto".into(),
                text: fixture["source"].as_str().unwrap().into(),
            }],
            include_paths: Vec::new(),
        })
        .unwrap();
        let snapshot = pool.encode_to_vec();
        let rows = fixture["rows"].as_array().unwrap();
        assert_eq!(rows.len(), 38);
        let mut refusals = 0;
        for row in rows {
            let label = row["label"].as_str().unwrap();
            let original = pool
                .get_message_by_name(row["name"].as_str().unwrap())
                .unwrap();
            let parsed = parse(original.clone(), row["body"].as_str().unwrap());
            if row.get("error").is_some() {
                refusals += 1;
                assert!(parsed.is_err(), "Reference refusal {label}");
                continue;
            }
            let request = parsed.unwrap_or_else(|e| panic!("{label}: {e}"));
            let wire = request.encode_to_vec();
            let hex: String = wire.iter().map(|b| format!("{b:02x}")).collect();
            assert_eq!(hex, row["wireHex"].as_str().unwrap(), "Any request {label}");
            let view = legacy_descriptor(original.clone()).unwrap();
            assert_eq!(
                legacy_pool(view.parent_pool()).unwrap().encode_to_vec(),
                view.parent_pool().encode_to_vec()
            );
            let decoded =
                crate::grpc_schema::decode_legacy_response(&view, wire.as_slice()).unwrap();
            let json = crate::grpc_schema::json_mode(
                &decoded,
                crate::grpc_schema::JsonMode::Legacy,
                original,
            )
            .unwrap();
            assert_eq!(json, row["json"].as_str().unwrap(), "Any JSON {label}");
        }
        assert_eq!(refusals, 8);
        assert_eq!(snapshot, pool.encode_to_vec());
    }

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
            let response = crate::grpc_schema::decode_legacy_response(
                &legacy_descriptor(original.clone()).unwrap(),
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
            let decoded =
                crate::grpc_schema::decode_legacy_response(&view, wire.as_slice()).unwrap();
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
            let response = crate::grpc_schema::decode_legacy_response(&view, wire.as_slice())
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
            let response = crate::grpc_schema::decode_legacy_response(
                &legacy_descriptor(original.clone()).unwrap(),
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
            let response = crate::grpc_schema::decode_legacy_response(
                &legacy_descriptor(original.clone()).unwrap(),
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
                if extensions {
                    serde_json::json!({"a":1,"b":"x","pick":"b",".Choice.insomnium_legacy_2":0,".Choice.insomnium_legacy_2_":0})
                } else {
                    serde_json::json!({"a":1,"b":"x","pick":"b"})
                }
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
                let message =
                    crate::grpc_schema::decode_legacy_response(&adapted, wire.as_slice()).unwrap();
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
        let decoded = crate::grpc_schema::decode_legacy_response(
            &legacy_descriptor(original.clone()).unwrap(),
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
    fn legacy_radix_rounding_matches_protobufjs_wire() {
        use prost_types::field_descriptor_proto::{Label, Type};
        let pool = DescriptorPool::from_file_descriptor_set(FileDescriptorSet {
            file: vec![FileDescriptorProto {
                name: Some("radix.proto".into()),
                syntax: Some("proto3".into()),
                message_type: vec![DescriptorProto {
                    name: Some("Radix".into()),
                    field: [("real", Type::Double), ("integer", Type::Int32)]
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
        let descriptor = pool.get_message_by_name("Radix").unwrap();
        // Actual protobuf.js 7.2.4 fromObject -> encode, including ties-to-even.
        for (literal, wire) in [
            ("0x1000000000000081", "09010000000000b043108002"),
            ("0o100000000000000000201", "09010000000000b043108002"),
            (
                "0b1000000000000000000000000000000000000000000000000000010000001",
                "09010000000000b043108002",
            ),
            ("0x1000000000000080", "09000000000000b0431000"),
            ("0x1000000000000180", "09020000000000b043108004"),
        ] {
            let body = format!("{{\"real\":\"{literal}\",\"integer\":\"{literal}\"}}");
            let bytes = parse(descriptor.clone(), &body).unwrap().encode_to_vec();
            let actual: String = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
            assert_eq!(actual, wire, "{literal}");
        }
        assert!(number(&Json::String("0x".into())).is_nan());
        assert!(number(&Json::String("0b102".into())).is_nan());
        assert!(number(&Json::String(format!("0x1{}z", "0".repeat(256)).into())).is_nan());
        assert_eq!(
            number(&Json::String(format!("0x1{}", "0".repeat(256)).into())),
            f64::INFINITY
        );
        assert_eq!(number(&Json::String("0O0007".into())), 7.0);
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
