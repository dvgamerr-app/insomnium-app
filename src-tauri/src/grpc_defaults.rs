//! Source-only protobuf.js default spelling, carried separately from canonical defaults.
use prost::Message;
use prost_reflect::{DescriptorPool, FileDescriptor, Kind, Value};
use std::collections::HashMap;

const MARKER: &str = "insomnium.legacy-default.v1";

pub(crate) fn value(file: &FileDescriptor, path: &[i32]) -> Option<String> {
    file.file_descriptor_proto()
        .source_code_info
        .as_ref()?
        .location
        .iter()
        .find(|location| {
            location.trailing_comments.as_deref() == Some(MARKER)
                && location.path.len() == path.len() + 1
                && location.path.starts_with(path)
                && location.path.last() == Some(&7)
        })?
        .leading_comments
        .clone()
}

// Match protobuf.js 7.2.4 tokenize.unescape, not protoc's C escape decoder.
fn literal(text: &str) -> Option<String> {
    let mut chars = text.chars().peekable();
    let mut result = String::new();
    let mut count = 0;
    while let Some(character) = chars.next() {
        if character.is_whitespace() {
            continue;
        }
        if character == '/' {
            match chars.next()? {
                '/' => {
                    for next in chars.by_ref() {
                        if next == '\n' {
                            break;
                        }
                    }
                }
                '*' => {
                    let mut previous = '\0';
                    loop {
                        let next = chars.next()?;
                        if previous == '*' && next == '/' {
                            break;
                        }
                        previous = next;
                    }
                }
                _ => return None,
            }
            continue;
        }
        if !matches!(character, '\'' | '"') {
            return None;
        }
        count += 1;
        loop {
            let next = chars.next()?;
            if next == character {
                break;
            }
            if next != '\\' {
                result.push(next);
                continue;
            }
            match chars.next()? {
                '0' => result.push('\0'),
                'n' => result.push('\n'),
                'r' => result.push('\r'),
                't' => result.push('\t'),
                '\\' => result.push('\\'),
                _ => {}
            }
        }
    }
    (count > 0).then_some(result)
}

pub(crate) fn annotate(
    pool: DescriptorPool,
    sources: &HashMap<String, String>,
    includes: &[String],
) -> Result<DescriptorPool, String> {
    let mut encoded = Vec::new();
    let mut changed = false;
    for file in pool.files() {
        let source = sources.get(file.name()).or_else(|| {
            includes
                .iter()
                .find_map(|include| sources.get(&format!("{include}/{}", file.name())))
        });
        let mut bytes = file.encode_to_vec();
        if let (Some(source), Some(info)) = (source, &file.file_descriptor_proto().source_code_info)
        {
            let mut lines = vec![0];
            lines.extend(source.match_indices('\n').map(|(offset, _)| offset + 1));
            let mut paths = Vec::new();
            for message in pool
                .all_messages()
                .filter(|message| message.parent_file() == file)
            {
                for field in message.fields().filter(|field| {
                    matches!(field.kind(), Kind::String | Kind::Bytes)
                        && field.field_descriptor_proto().default_value.is_some()
                }) {
                    let mut path = field.path().to_vec();
                    path.push(7);
                    let canonical = match Value::default_value_for_field(&field) {
                        Value::String(text) => text.into_bytes(),
                        Value::Bytes(bytes) => bytes.to_vec(),
                        _ => continue,
                    };
                    paths.push((path, canonical));
                }
            }
            for field in pool.all_extensions().filter(|field| {
                field.parent_file() == file
                    && matches!(field.kind(), Kind::String | Kind::Bytes)
                    && field.field_descriptor_proto().default_value.is_some()
            }) {
                let mut path = field.path().to_vec();
                path.push(7);
                let canonical = match Value::default_value_for_extension(&field) {
                    Value::String(text) => text.into_bytes(),
                    Value::Bytes(bytes) => bytes.to_vec(),
                    _ => continue,
                };
                paths.push((path, canonical));
            }
            let mut annotations = prost_types::SourceCodeInfo::default();
            for (path, canonical) in paths {
                let Some(location) = info.location.iter().find(|location| location.path == path)
                else {
                    continue;
                };
                let (start_line, start_column, end_line, end_column) =
                    match location.span.as_slice() {
                        [line, start, end] => (*line, *start, *line, *end),
                        [line, start, end_line, end] => (*line, *start, *end_line, *end),
                        _ => continue,
                    };
                let offset = |line: i32, column: i32| -> Option<usize> {
                    lines
                        .get(usize::try_from(line).ok()?)?
                        .checked_add(usize::try_from(column).ok()?)
                };
                let text = offset(start_line, start_column)
                    .zip(offset(end_line, end_column))
                    .and_then(|(start, end)| source.get(start..end));
                let Some(default) = text.and_then(literal) else {
                    continue;
                };
                if default.as_bytes() == canonical {
                    continue;
                }
                annotations
                    .location
                    .push(prost_types::source_code_info::Location {
                        path,
                        span: location.span.clone(),
                        leading_comments: Some(default),
                        trailing_comments: Some(MARKER.into()),
                        ..Default::default()
                    });
            }
            if !annotations.location.is_empty() {
                changed = true;
                // Message fields merge on decode. Append metadata without losing
                // custom option extension bytes from the original descriptor.
                bytes.push(0x4a);
                prost::encoding::encode_varint(annotations.encoded_len() as u64, &mut bytes);
                annotations
                    .encode(&mut bytes)
                    .map_err(|error| error.to_string())?;
            }
        }
        encoded.push(0x0a);
        prost::encoding::encode_varint(bytes.len() as u64, &mut encoded);
        encoded.extend(bytes);
        if encoded.len() > crate::grpc_schema::MAX_SCHEMA {
            return Err("Compiled descriptors exceed 8 MiB.".into());
        }
    }
    if changed {
        DescriptorPool::decode(encoded.as_slice()).map_err(|error| error.to_string())
    } else {
        Ok(pool)
    }
}
