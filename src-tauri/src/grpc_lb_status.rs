//! grpc-js Number conversion at the native/Tonic gRPC status boundary.
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
pub(super) fn normalize(headers: &mut HeaderMap) {
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
