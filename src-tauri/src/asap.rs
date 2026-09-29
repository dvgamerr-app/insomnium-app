//! Local ASAP JWT generation. No key discovery, provider calls or persisted token cache.
use base64::{
    engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD},
    Engine,
};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use p521::{ecdsa::signature::Signer as _, pkcs8::DecodePrivateKey as _};
use reqwest::header::HeaderValue;
use rsa::{
    pkcs1::{DecodeRsaPrivateKey, EncodeRsaPrivateKey},
    pkcs8::DecodePrivateKey,
    rand_core::{OsRng, RngCore},
    traits::PublicKeyParts,
    RsaPrivateKey,
};
use serde::Deserialize;
use serde_json::{json, Map, Value};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AsapCredentials {
    pub issuer: String,
    pub subject: String,
    pub audience: Value,
    pub key_id: String,
    pub private_key: String,
    pub additional_claims: String,
    pub claims_mode: String,
    pub algorithm: String,
    pub expiry_seconds: String,
}

#[derive(Clone, Copy)]
enum AsapAlgorithm {
    Jwt(Algorithm),
    Es512,
}

enum SigningKey {
    Jwt(EncodingKey, Algorithm),
    Es512(Box<p521::ecdsa::SigningKey>),
}

impl SigningKey {
    fn token(
        &self,
        kid: String,
        claims: &Map<String, Value>,
        postman: bool,
    ) -> Result<String, String> {
        match self {
            Self::Jwt(key, algorithm) => {
                let mut header = Header::new(*algorithm);
                header.kid = Some(kid);
                if postman {
                    header.typ = None;
                }
                encode(&header, claims, key).map_err(|_| {
                    "Could not sign ASAP token. Check the key format and selected algorithm.".into()
                })
            }
            Self::Es512(key) => {
                // jsonwebtoken has no ES512 variant. RFC7515 compact encoding,
                // with P-521/SHA-512 signing entirely handled by RustCrypto.
                let header = serde_json::to_vec(&json!({"alg":"ES512", "kid":kid}))
                    .map_err(|_| "Could not encode ASAP header.")?;
                let payload =
                    serde_json::to_vec(claims).map_err(|_| "Could not encode ASAP claims.")?;
                let input = format!(
                    "{}.{}",
                    URL_SAFE_NO_PAD.encode(header),
                    URL_SAFE_NO_PAD.encode(payload)
                );
                let signature: p521::ecdsa::Signature = key
                    .try_sign(input.as_bytes())
                    .map_err(|_| "Could not sign ASAP ES512 token.")?;
                // JWS uses the fixed 132-byte R||S representation, not ASN.1 DER.
                Ok(format!(
                    "{input}.{}",
                    URL_SAFE_NO_PAD.encode(signature.to_bytes())
                ))
            }
        }
    }
}

fn truthy(v: &Value) -> bool {
    match v {
        Value::Null => false,
        Value::Bool(v) => *v,
        Value::Number(v) => v.as_f64() != Some(0.0),
        Value::String(v) => !v.is_empty(),
        _ => true,
    }
}

// Postman uses decimal parseInt for expiry values (zero/NaN fall back to defaults).
fn decimal_prefix(text: &str) -> Option<i64> {
    let text = text.trim_start();
    let end = text
        .char_indices()
        .take_while(|(i, c)| c.is_ascii_digit() || (*i == 0 && matches!(c, '+' | '-')))
        .map(|(i, c)| i + c.len_utf8())
        .last()?;
    text[..end].parse().ok()
}

fn key_material(
    c: &AsapCredentials,
    mut kid: String,
    algorithm: AsapAlgorithm,
) -> Result<(SigningKey, String), String> {
    let mut text = c
        .private_key
        .replace("\\n", "\n")
        .replace('"', "")
        .trim()
        .to_string();
    let mut data_uri = false;
    let der = if text.starts_with("data:") {
        for (index, byte) in text.bytes().enumerate() {
            if byte == b'%'
                && !text
                    .as_bytes()
                    .get(index + 1..index + 3)
                    .is_some_and(|v| v.iter().all(u8::is_ascii_hexdigit))
            {
                return Err("Invalid ASAP data URI percent encoding.".into());
            }
        }
        text = percent_encoding::percent_decode_str(&text)
            .decode_utf8()
            .map_err(|_| "ASAP data URI must be UTF-8.")?
            .into_owned();
        let (metadata, encoded) = text
            .split_once(',')
            .ok_or("Malformed ASAP PKCS8 data URI.")?;
        let embedded = metadata
            .strip_prefix("data:application/pkcs8;kid=")
            .and_then(|v| v.strip_suffix(";base64"))
            .filter(|v| !v.is_empty())
            .ok_or("Expected data:application/pkcs8;kid=...;base64,...")?;
        if !embedded
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"_.-+/".contains(&b))
        {
            return Err("Invalid ASAP data URI key ID.".into());
        }
        if !kid.is_empty() && kid != embedded {
            return Err("ASAP key ID does not match the data URI. Use the same ID or leave Key ID blank to use the URI value.".into());
        }
        kid = embedded.into();
        data_uri = true;
        Some(
            STANDARD
                .decode(encoded)
                .map_err(|_| "Invalid base64 in ASAP data URI.")?,
        )
    } else if !text.starts_with("-----BEGIN") {
        let bytes = STANDARD
            .decode(text.split_whitespace().collect::<String>())
            .map_err(|_| {
                "ASAP requires an unencrypted PEM key, base64 DER/PEM, or PKCS8 data URI."
            })?;
        if bytes.starts_with(b"-----BEGIN") {
            text = String::from_utf8(bytes).map_err(|_| "Invalid ASAP PEM text.")?;
            None
        } else {
            Some(bytes)
        }
    } else {
        None
    };
    if kid.is_empty() {
        return Err("ASAP Key ID is required (or include kid in a PKCS8 data URI).".into());
    }
    let algorithm = match algorithm {
        AsapAlgorithm::Es512 => {
            let invalid = "ASAP ES512 requires an unencrypted P-521 PKCS8 or SEC1 private key (PKCS8 for a data URI).";
            let key = match der {
                Some(bytes) if data_uri => {
                    p521::SecretKey::from_pkcs8_der(&bytes).map_err(|_| invalid)
                }
                Some(bytes) => p521::SecretKey::from_der(&bytes).map_err(|_| invalid),
                None => p521::SecretKey::from_pem(&text).map_err(|_| invalid),
            }?;
            return Ok((SigningKey::Es512(Box::new(key.into())), kid));
        }
        AsapAlgorithm::Jwt(algorithm) => algorithm,
    };
    let key = if matches!(algorithm, Algorithm::ES256 | Algorithm::ES384) {
        match der {
            Some(bytes) => EncodingKey::from_ec_der(&bytes),
            None => EncodingKey::from_ec_pem(text.as_bytes())
                .map_err(|_| "ASAP EC keys require PKCS8 PEM/DER matching the selected curve.")?,
        }
    } else {
        let rsa = match der {
            Some(bytes) if data_uri => RsaPrivateKey::from_pkcs8_der(&bytes)
                .map_err(|_| "ASAP data URI requires an RSA PKCS8 key.")?,
            Some(bytes) => RsaPrivateKey::from_pkcs8_der(&bytes)
                .or_else(|_| RsaPrivateKey::from_pkcs1_der(&bytes))
                .map_err(|_| "Invalid ASAP RSA DER key.")?,
            None => RsaPrivateKey::from_pkcs8_pem(&text)
                .or_else(|_| RsaPrivateKey::from_pkcs1_pem(&text))
                .map_err(|_| "ASAP requires an unencrypted PKCS1 or PKCS8 RSA private key.")?,
        };
        if !(2048..=8192).contains(&rsa.n().bits()) {
            return Err("ASAP RSA keys must be between 2048 and 8192 bits.".into());
        }
        let der = rsa
            .to_pkcs1_der()
            .map_err(|_| "Could not encode ASAP RSA key.")?;
        EncodingKey::from_rsa_der(der.as_bytes())
    };
    Ok((SigningKey::Jwt(key, algorithm), kid))
}

pub(crate) fn header(c: &AsapCredentials) -> Result<HeaderValue, String> {
    if [
        &c.issuer,
        &c.subject,
        &c.key_id,
        &c.private_key,
        &c.additional_claims,
    ]
    .iter()
    .any(|v| v.len() > 64 * 1024)
        || c.audience.to_string().len() > 64 * 1024
    {
        return Err("An ASAP field exceeds 64 KiB.".into());
    }
    if !matches!(c.claims_mode.as_str(), "legacy" | "postman") {
        return Err("Choose an ASAP claims mode in Auth.".into());
    }
    let postman = c.claims_mode == "postman";
    let algorithm = if c.algorithm == "ES512" && postman {
        AsapAlgorithm::Es512
    } else {
        AsapAlgorithm::Jwt(match c.algorithm.as_str() {
        "" | "RS256" => Algorithm::RS256,
        "RS384" if postman => Algorithm::RS384, "RS512" if postman => Algorithm::RS512,
        "PS256" if postman => Algorithm::PS256, "PS384" if postman => Algorithm::PS384, "PS512" if postman => Algorithm::PS512,
        "ES256" if postman => Algorithm::ES256, "ES384" if postman => Algorithm::ES384,
        _ => return Err("ASAP Insomnium mode uses RS256. Postman mode supports RSA/PSS and ES256/ES384/ES512.".into()),
    })
    };
    let extra: Value = serde_json::from_str(if c.additional_claims.trim().is_empty() {
        "{}"
    } else {
        &c.additional_claims
    })
    .map_err(|_| "ASAP additional claims must be valid JSON.")?;
    let extra: Map<String, Value> = match extra {
        Value::Object(v) => v,
        Value::Array(v) if !postman => v
            .into_iter()
            .enumerate()
            .map(|(i, v)| (i.to_string(), v))
            .collect(),
        v if !postman && !truthy(&v) => Map::new(),
        _ => return Err("ASAP additional claims must be a JSON object.".into()),
    };
    if extra.contains_key("__proto__") {
        return Err("Review the unsupported __proto__ claim in ASAP Auth.".into());
    }
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "System clock is before Unix epoch.")?
        .as_secs();
    let mut random = [0u8; 20];
    OsRng
        .try_fill_bytes(&mut random)
        .map_err(|_| "Could not generate an ASAP token ID.")?;
    let jti: String = if postman {
        uuid::Uuid::new_v4().to_string()
    } else {
        random.iter().map(|b| format!("{b:02x}")).collect()
    };
    let duration = if postman && !c.expiry_seconds.is_empty() {
        decimal_prefix(&c.expiry_seconds)
            .filter(|v| *v != 0)
            .or(Some(3600))
            .filter(|v| *v > 0 && *v <= 3600)
            .map(|v| v as u64)
            .ok_or("ASAP expiry must be 1–3600 seconds.")?
    } else if postman {
        3600
    } else {
        600
    };
    let mut claims = json!({"iss":c.issuer,"sub":if c.subject.is_empty(){&c.issuer}else{&c.subject},"aud":c.audience,"iat":now,"nbf":now,"exp":now+duration,"jti":jti}).as_object().cloned().ok_or("Could not prepare ASAP claims.")?;
    let mut kid = c.key_id.clone();
    if postman {
        claims.remove("nbf");
        for name in ["iss", "sub", "aud", "iat", "exp", "jti"] {
            if let Some(v) = extra.get(name).filter(|v| truthy(v)) {
                claims.insert(name.into(), v.clone());
            }
        }
        let expiry = extra
            .get("exp")
            .filter(|v| truthy(v))
            .and_then(|v| {
                decimal_prefix(
                    v.as_str()
                        .map(String::from)
                        .unwrap_or_else(|| v.to_string())
                        .as_str(),
                )
            })
            .filter(|v| *v != 0);
        claims.insert(
            "exp".into(),
            expiry
                .map(|v| json!(v))
                .unwrap_or_else(|| json!(now + duration)),
        );
        if !extra.get("sub").is_some_and(truthy) && c.subject.is_empty() {
            claims.insert("sub".into(), claims["iss"].clone());
        }
        if let Some(v) = extra.get("kid").filter(|v| truthy(v)) {
            kid = v.as_str().ok_or("ASAP kid must be a string.")?.into();
        }
        for (k, v) in extra {
            if !matches!(k.as_str(), "iss" | "sub" | "aud" | "iat" | "exp" | "jti") {
                claims.insert(k, v);
            }
        }
        for name in ["iss", "sub", "jti"] {
            if !claims[name].as_str().is_some_and(|v| !v.is_empty()) {
                return Err(format!("ASAP {name} must be a non-empty string."));
            }
        }
        if !truthy(&claims["aud"]) {
            return Err("ASAP audience is required.".into());
        }
    } else {
        if c.issuer.is_empty() || !truthy(&c.audience) {
            return Err(
                "ASAP issuer and audience are required before additional-claims overrides.".into(),
            );
        }
        claims.extend(extra);
    }
    for name in ["iat", "nbf", "exp"] {
        if claims.get(name).is_some_and(|v| !v.is_number()) {
            return Err(format!("ASAP {name} must be numeric seconds."));
        }
    }
    if claims["iat"].as_f64() == Some(0.0) {
        claims.insert("iat".into(), json!(now));
    }
    let (key, kid) = key_material(c, kid, algorithm)?;
    let token = key.token(kid, &claims, postman)?;
    if token.len() > 64 * 1024 {
        return Err("ASAP token exceeds 64 KiB.".into());
    }
    let mut header = HeaderValue::from_str(&format!("Bearer {token}"))
        .map_err(|_| "Invalid ASAP Authorization header.")?;
    header.set_sensitive(true);
    Ok(header)
}
