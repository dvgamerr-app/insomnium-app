use base64::{engine::general_purpose::STANDARD, Engine};

const LIMIT: usize = 20 * 1024 * 1024;

/// Apply a MIME transfer encoding to already-decoded part bytes.
pub(super) fn encode(bytes: Vec<u8>, encoding: &str) -> Result<Vec<u8>, String> {
    if bytes.len() > LIMIT {
        return Err("Multipart encoding input exceeds 20 MiB.".into());
    }
    match encoding {
        "binary" | "8bit" => Ok(bytes),
        "7bit" if bytes.iter().all(|byte| *byte < 128) => Ok(bytes),
        "7bit" => Err("Multipart 7bit encoding cannot contain 8-bit bytes.".into()),
        "base64" => {
            let length = bytes.len().div_ceil(3) * 4;
            let breaks = length.saturating_sub(1) / 76;
            if length + breaks * 2 > LIMIT {
                return Err("Encoded multipart part exceeds 20 MiB.".into());
            }
            let encoded = STANDARD.encode(bytes);
            let mut output = Vec::with_capacity(length + breaks * 2);
            for (index, line) in encoded.as_bytes().chunks(76).enumerate() {
                if index > 0 {
                    output.extend_from_slice(b"\r\n");
                }
                output.extend_from_slice(line);
            }
            Ok(output)
        }
        "quoted-printable" => {
            let mut output = Vec::with_capacity(bytes.len());
            let mut index = 0;
            let mut column = 0;
            const HEX: &[u8] = b"0123456789ABCDEF";
            while index < bytes.len() {
                let byte = bytes[index];
                let crlf = byte == b'\r' && bytes.get(index + 1) == Some(&b'\n');
                let consumed = if crlf { 2 } else { 1 };
                let next = index + consumed;
                let end = next == bytes.len() || bytes.get(next..next + 2) == Some(b"\r\n");
                let escape = !crlf
                    && (!matches!(byte, 33..=60 | 62..=126 | b' ' | b'\t')
                        || (matches!(byte, b' ' | b'\t') && end));
                let width = if crlf {
                    2
                } else if escape {
                    3
                } else {
                    1
                };
                let wrap = !crlf && (column + width > 76 || (column + width == 76 && !end));
                if output.len() + width + if wrap { 3 } else { 0 } > LIMIT {
                    return Err("Encoded multipart part exceeds 20 MiB.".into());
                }
                if wrap {
                    output.extend_from_slice(b"=\r\n");
                    column = 0;
                }
                if crlf {
                    output.extend_from_slice(b"\r\n");
                    column = 0;
                } else if escape {
                    output.extend_from_slice(&[
                        b'=',
                        HEX[(byte >> 4) as usize],
                        HEX[(byte & 15) as usize],
                    ]);
                    column += 3;
                } else {
                    output.push(byte);
                    column += 1;
                }
                index = next;
            }
            Ok(output)
        }
        _ => Err("Choose a supported multipart transfer encoding.".into()),
    }
}
