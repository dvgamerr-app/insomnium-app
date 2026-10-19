//! grpc-js Number conversion at the native/Tonic gRPC status boundary.
use base64::{engine::general_purpose::STANDARD, Engine};
use tonic::codegen::http::{HeaderMap, HeaderValue};

// ECMAScript WhiteSpace and LineTerminator, deliberately excluding U+0085.
fn whitespace(value: char) -> bool {
    matches!(value, '\u{0009}'..='\u{000d}' | '\u{0020}' | '\u{00a0}' | '\u{1680}'
        | '\u{2000}'..='\u{200a}' | '\u{2028}' | '\u{2029}' | '\u{202f}'
        | '\u{205f}' | '\u{3000}' | '\u{feff}')
}
fn code(value: &[u8]) -> Option<usize> {
    let value = std::str::from_utf8(value).ok()?.trim_matches(whitespace);
    if value.is_empty() {
        return Some(0);
    }
    // Number accepts unsigned hexadecimal, octal and binary integer literals.
    // Accumulate as f64 to avoid rejecting a long sequence of leading zeroes.
    let radix = if value.starts_with("0x") || value.starts_with("0X") {
        Some(16)
    } else if value.starts_with("0o") || value.starts_with("0O") {
        Some(8)
    } else if value.starts_with("0b") || value.starts_with("0B") {
        Some(2)
    } else {
        None
    };
    let number = if let Some(radix) = radix {
        if value.len() == 2 {
            return None;
        }
        let mut number = 0.0;
        for digit in value[2..].chars() {
            // to_digit accepts ASCII digits/letters for these radices.
            number = number * radix as f64 + digit.to_digit(radix)? as f64;
        }
        number
    } else {
        value.parse::<f64>().ok()?
    };
    (number.is_finite() && (0.0..=16.0).contains(&number) && number.fract() == 0.0)
        .then_some(number as usize)
}
fn message(value: &[u8]) -> String {
    const ENCODE: &percent_encoding::AsciiSet = &percent_encoding::CONTROLS.add(b'%');
    let mut decoded = Vec::with_capacity(value.len());
    let mut index = 0;
    let valid = loop {
        if index == value.len() {
            break std::str::from_utf8(&decoded).is_ok();
        }
        if value[index] != b'%' {
            decoded.push(value[index]);
            index += 1;
            continue;
        }
        let Some(pair) = value.get(index + 1..index + 3) else {
            break false;
        };
        let (Some(high), Some(low)) = (
            (pair[0] as char).to_digit(16),
            (pair[1] as char).to_digit(16),
        ) else {
            break false;
        };
        let byte = (high * 16 + low) as u8;
        // decodeURI preserves the original escape spelling for URI reserved bytes.
        if b";/?:@&=+$,#".contains(&byte) {
            decoded.extend_from_slice(&value[index..index + 3]);
        } else {
            decoded.push(byte);
        }
        index += 3;
    };
    // grpc-js falls back to the complete original value on any decoding error.
    // Escape percent for Tonic's decoder, leaving printable reserved bytes literal
    // so applying this boundary more than once remains idempotent.
    percent_encoding::percent_encode(if valid { &decoded } else { value }, ENCODE).to_string()
}
pub(super) fn normalize(headers: &mut HeaderMap) {
    if let Some(value) = headers.get("grpc-message") {
        if value
            .as_bytes()
            .iter()
            .all(|byte| (0x20..=0x7e).contains(byte))
        {
            let value = message(value.as_bytes());
            headers.insert(
                "grpc-message",
                HeaderValue::from_str(&value)
                    .expect("Encoded gRPC message is a valid header value"),
            );
        } else {
            // grpc-js rejects non-printable/non-ASCII text metadata before parsing status.
            headers.remove("grpc-message");
        }
    }
    // Tonic expects strict base64 here and panics on rejected input. grpc-js
    // decodes this reserved binary field with Buffer.from(value, "base64").
    if let Some(value) = headers.get("grpc-status-details-bin") {
        let bytes =
            crate::grpc_transport::decode_binary_metadata(value.as_bytes()).unwrap_or_default();
        headers.insert(
            "grpc-status-details-bin",
            HeaderValue::from_str(&STANDARD.encode(bytes))
                .expect("Base64 encoding produces a valid header value"),
        );
    }
    let Some(status) = headers
        .get("grpc-status")
        .and_then(|value| code(value.as_bytes()))
    else {
        return;
    };
    const CODES: [&str; 17] = [
        "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16",
    ];
    headers.insert("grpc-status", HeaderValue::from_static(CODES[status]));
}
