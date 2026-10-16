//! RFC 5849 request signatures using RustCrypto primitives (no token exchange).
use base64::{engine::general_purpose::STANDARD, Engine};
use hmac::{Hmac, Mac};
use percent_encoding::{utf8_percent_encode, AsciiSet, NON_ALPHANUMERIC};
use reqwest::{header, Request};
use rsa::{
    pkcs1::DecodeRsaPrivateKey,
    pkcs1v15::SigningKey,
    pkcs8::DecodePrivateKey,
    signature::{RandomizedSigner, SignatureEncoding},
    traits::PublicKeyParts,
    RsaPrivateKey,
};
use serde::Deserialize;
use sha1::{Digest, Sha1};
use sha2::Sha256;
use std::time::{SystemTime, UNIX_EPOCH};

const ENCODE: &AsciiSet = &NON_ALPHANUMERIC
    .remove(b'-')
    .remove(b'.')
    .remove(b'_')
    .remove(b'~');
fn encode(value: &str) -> String {
    utf8_percent_encode(value, ENCODE).to_string()
}

fn parameters(bytes: &[u8]) -> Result<Vec<(String, String)>, String> {
    let text = std::str::from_utf8(bytes).map_err(|_| "OAuth1 form/query must be UTF-8.")?;
    text.split('&')
        .filter(|part| !part.is_empty())
        .map(|part| {
            let (key, value) = part.split_once('=').unwrap_or((part, ""));
            let decode = |value: &str| -> Result<String, String> {
                let value = value.replace('+', " ");
                percent_encoding::percent_decode_str(&value)
                    .decode_utf8()
                    .map(|value| value.into_owned())
                    .map_err(|_| "OAuth1 form/query must decode to UTF-8.".into())
            };
            Ok((decode(key)?, decode(value)?))
        })
        .collect()
}

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OAuth1Credentials {
    pub consumer_key: String,
    pub consumer_secret: String,
    pub token_key: String,
    pub token_secret: String,
    pub signature_method: String,
    pub private_key: String,
    pub callback: String,
    pub verifier: String,
    pub version: String,
    pub nonce: String,
    pub timestamp: String,
    pub realm: String,
    pub body_mode: String,
    pub include_body_hash: bool,
    pub add_params_to_header: Option<bool>,
    pub add_empty_params_to_sign: bool,
    pub disable_header_encoding: bool,
    pub legacy_body_json: Option<String>,
}

pub struct Signer<'a> {
    credentials: &'a OAuth1Credentials,
    rsa: Option<SigningKey<Sha1>>,
}
impl<'a> Signer<'a> {
    pub fn new(credentials: &'a OAuth1Credentials) -> Result<Self, String> {
        if credentials.consumer_key.is_empty() {
            return Err("OAuth1 consumer key is required.".into());
        }
        if !matches!(
            credentials.signature_method.as_str(),
            "HMAC-SHA1" | "HMAC-SHA256" | "RSA-SHA1" | "PLAINTEXT"
        ) {
            return Err("Choose a supported OAuth1 signature method.".into());
        }
        if !matches!(credentials.body_mode.as_str(), "standard" | "legacy") {
            return Err("Choose RFC 5849 or legacy OAuth1 body signing explicitly.".into());
        }
        if !credentials.timestamp.is_empty()
            && !credentials.timestamp.bytes().all(|b| b.is_ascii_digit())
        {
            return Err("OAuth1 timestamp must contain decimal seconds.".into());
        }
        if [
            &credentials.consumer_key,
            &credentials.consumer_secret,
            &credentials.token_key,
            &credentials.token_secret,
            &credentials.private_key,
            &credentials.callback,
            &credentials.verifier,
            &credentials.version,
            &credentials.nonce,
            &credentials.timestamp,
            &credentials.realm,
        ]
        .iter()
        .any(|value| value.len() > 64 * 1024)
        {
            return Err("An OAuth1 credential field exceeds 64 KiB.".into());
        }
        if credentials
            .legacy_body_json
            .as_ref()
            .is_some_and(|value| value.len() > 20 * 1024 * 1024)
        {
            return Err("OAuth1 legacy body exceeds 20 MiB.".into());
        }
        let rsa = if credentials.signature_method == "RSA-SHA1" {
            let key = RsaPrivateKey::from_pkcs8_pem(&credentials.private_key)
                .or_else(|_| RsaPrivateKey::from_pkcs1_pem(&credentials.private_key))
                .map_err(|_| {
                    "OAuth1 requires an unencrypted PKCS#1 or PKCS#8 RSA private key in PEM format."
                })?;
            if key.n().bits() > 8192 {
                return Err("OAuth1 RSA keys are limited to 8192 bits.".into());
            }
            Some(SigningKey::<Sha1>::new(key))
        } else {
            None
        };
        Ok(Self { credentials, rsa })
    }

    fn signature(&self, data: &[u8], key: &str, legacy_plaintext: bool) -> Result<String, String> {
        Ok(match self.credentials.signature_method.as_str() {
            "HMAC-SHA1" => {
                let mut mac = Hmac::<Sha1>::new_from_slice(key.as_bytes())
                    .map_err(|_| "Invalid OAuth1 signing key.")?;
                mac.update(data);
                STANDARD.encode(mac.finalize().into_bytes())
            }
            "HMAC-SHA256" => {
                let mut mac = Hmac::<Sha256>::new_from_slice(key.as_bytes())
                    .map_err(|_| "Invalid OAuth1 signing key.")?;
                mac.update(data);
                STANDARD.encode(mac.finalize().into_bytes())
            }
            "RSA-SHA1" => STANDARD.encode(
                self.rsa
                    .as_ref()
                    .ok_or("Missing RSA signer.")?
                    .try_sign_with_rng(&mut rsa::rand_core::OsRng, data)
                    .map_err(|_| "Could not sign OAuth1 request with the RSA key.")?
                    .to_bytes(),
            ),
            "PLAINTEXT" if legacy_plaintext => {
                String::from_utf8(data.to_vec()).map_err(|_| "Invalid legacy OAuth1 input.")?
            }
            "PLAINTEXT" => key.into(),
            _ => return Err("Unsupported OAuth1 signature method.".into()),
        })
    }

    fn signed_parameters(&self, request: &Request) -> Result<Vec<(String, String)>, String> {
        let c = self.credentials;
        if [header::HOST, header::CONTENT_TYPE]
            .iter()
            .any(|name| request.headers().get_all(name).iter().count() > 1)
        {
            return Err("OAuth1 requires a single Host and Content-Type header.".into());
        }
        if c.body_mode == "standard" && c.token_key.is_empty() && !c.token_secret.is_empty() {
            return Err("OAuth1 token secret requires a token key; clear the secret explicitly for client-only signing.".into());
        }
        let body = request
            .body()
            .and_then(|value| value.as_bytes())
            .unwrap_or_default();
        let form = request
            .headers()
            .get(header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| {
                value
                    .split(';')
                    .next()
                    .unwrap_or("")
                    .trim()
                    .eq_ignore_ascii_case("application/x-www-form-urlencoded")
            });
        let legacy_hash = c.body_mode == "legacy" && c.include_body_hash && form;
        let query = request.url().query().unwrap_or("");
        let mut params = parameters(query.as_bytes())?;
        if c.body_mode == "legacy" && !query.is_empty() {
            let mut seen = std::collections::HashMap::new();
            for part in query.split('&') {
                let (key, value) = part.split_once('=').unwrap_or((part, ""));
                let ambiguous = part.is_empty()
                    || key.contains('%')
                    || part.contains('+')
                    || value.contains('=')
                    || matches!(key, "__proto__" | "constructor" | "toString")
                    || seen
                        .get(key)
                        .is_some_and(|previous: &&str| previous.is_empty() || value.is_empty());
                if ambiguous {
                    return Err("This query uses ambiguous legacy OAuth1 encoding. Review it and select RFC 5849 explicitly in Auth.".into());
                }
                seen.insert(key, value);
            }
        }
        if c.body_mode == "standard" && form {
            params.extend(parameters(body)?);
        }
        if params.iter().any(|(key, _)| key.starts_with("oauth_")) {
            return Err(
                "Set OAuth1 protocol parameters in Auth rather than the URL or form body.".into(),
            );
        }
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "Invalid system clock.")?
            .as_secs()
            .to_string();
        let random = oauth2::CsrfToken::new_random();
        // Legacy Hash Body signs a JSON object with the configured overrides inside
        // the hash. Its header nonce/time are generated, matching the original adapter.
        let nonce = if legacy_hash || c.nonce.is_empty() {
            random.secret()
        } else {
            &c.nonce
        };
        let timestamp = if legacy_hash || c.timestamp.is_empty() {
            &now
        } else {
            &c.timestamp
        };
        let mut oauth = vec![
            ("oauth_consumer_key".into(), c.consumer_key.clone()),
            ("oauth_nonce".into(), nonce.clone()),
            ("oauth_signature_method".into(), c.signature_method.clone()),
            ("oauth_timestamp".into(), timestamp.clone()),
        ];
        if !c.version.is_empty() || c.body_mode == "legacy" || c.add_empty_params_to_sign {
            oauth.push((
                "oauth_version".into(),
                if c.version.is_empty() && c.body_mode == "legacy" {
                    "1.0".into()
                } else {
                    c.version.clone()
                },
            ));
        }
        if !c.token_key.is_empty() || c.add_empty_params_to_sign {
            oauth.push(("oauth_token".into(), c.token_key.clone()));
        }
        if !legacy_hash {
            for (key, value) in [
                ("oauth_callback", &c.callback),
                ("oauth_verifier", &c.verifier),
            ] {
                if !value.is_empty() {
                    oauth.push((key.into(), value.clone()));
                }
            }
        }
        let secret = if c.token_key.is_empty() {
            ""
        } else {
            &c.token_secret
        };
        let key = format!("{}&{}", encode(&c.consumer_secret), encode(secret));
        if legacy_hash {
            let json = c
                .legacy_body_json
                .as_ref()
                .ok_or("Missing resolved legacy OAuth1 form data.")?;
            oauth.push((
                "oauth_body_hash".into(),
                self.signature(json.as_bytes(), &key, true)?,
            ));
        } else if c.body_mode == "standard" && c.include_body_hash {
            if form {
                return Err("RFC form bodies are signed as parameters. Disable Hash Body for this form, or select legacy mode explicitly.".into());
            }
            if c.signature_method == "PLAINTEXT" {
                return Err(
                    "The body-hash extension does not define PLAINTEXT. Disable Hash Body.".into(),
                );
            }
            let hash = if c.signature_method == "HMAC-SHA256" {
                STANDARD.encode(Sha256::digest(body))
            } else {
                STANDARD.encode(Sha1::digest(body))
            };
            oauth.push(("oauth_body_hash".into(), hash));
        }
        params.extend(oauth.iter().cloned());
        let mut encoded: Vec<_> = params.iter().map(|(k, v)| (encode(k), encode(v))).collect();
        encoded.sort_unstable();
        let normalized = encoded
            .iter()
            .map(|(k, v)| format!("{k}={v}"))
            .collect::<Vec<_>>()
            .join("&");
        let mut base = request.url().clone();
        base.set_query(None);
        base.set_fragment(None);
        if !matches!(base.scheme(), "http" | "https")
            || !base.username().is_empty()
            || base.password().is_some()
        {
            return Err("OAuth1 requires an HTTP(S) URL without user information.".into());
        }
        if let Some(host) = request.headers().get(header::HOST) {
            let host = host.to_str().map_err(|_| "Invalid OAuth1 Host header.")?;
            let authority = reqwest::Url::parse(&format!("{}://{host}/", base.scheme()))
                .map_err(|_| "Invalid OAuth1 Host header.")?;
            if authority.path() != "/"
                || authority.query().is_some()
                || authority.fragment().is_some()
                || !authority.username().is_empty()
                || authority.password().is_some()
            {
                return Err("Invalid OAuth1 Host header.".into());
            }
            base.set_host(authority.host_str())
                .map_err(|_| "Invalid OAuth1 host.")?;
            base.set_port(authority.port())
                .map_err(|_| "Invalid OAuth1 port.")?;
        }
        let input = format!(
            "{}&{}&{}",
            request.method().as_str().to_ascii_uppercase(),
            encode(base.as_str()),
            encode(&normalized)
        );
        oauth.push((
            "oauth_signature".into(),
            self.signature(input.as_bytes(), &key, c.body_mode == "legacy")?,
        ));
        oauth.sort_by(|a, b| a.0.cmp(&b.0));
        Ok(oauth)
    }

    pub fn header(&self, request: &Request) -> Result<header::HeaderValue, String> {
        let oauth = self.signed_parameters(request)?;
        let c = self.credentials;
        let mut parts: Vec<_> = oauth
            .iter()
            // Postman's empty parameters affect signing and URL/form placement,
            // but its Authorization-header serializer omits empty values.
            .filter(|(_, value)| !value.is_empty())
            .map(|(k, v)| {
                let value = if c.disable_header_encoding {
                    v.trim().to_string()
                } else {
                    encode(v)
                };
                format!("{k}=\"{value}\"")
            })
            .collect();
        if !c.realm.is_empty() {
            let realm = if c.disable_header_encoding {
                c.realm.clone()
            } else {
                encode(&c.realm)
            };
            if !c.disable_header_encoding || !realm.trim().is_empty() {
                parts.insert(0, format!("realm=\"{realm}\""));
            }
        }
        let value = format!("OAuth {}", parts.join(", "));
        if value.len() > 64 * 1024 {
            return Err("OAuth1 authorization header exceeds 64 KiB.".into());
        }
        let mut header = header::HeaderValue::from_str(&value)
            .map_err(|_| "Invalid OAuth1 authorization header.")?;
        header.set_sensitive(true);
        Ok(header)
    }

    pub fn sign(&self, request: &mut Request) -> Result<(), String> {
        if self.credentials.add_params_to_header != Some(false) {
            let value = self.header(request)?;
            request.headers_mut().insert(header::AUTHORIZATION, value);
            return Ok(());
        }
        let oauth = self.signed_parameters(request)?;
        let encoded = oauth
            .iter()
            .map(|(key, value)| format!("{}={}", encode(key), encode(value)))
            .collect::<Vec<_>>()
            .join("&");
        if encoded.len() > 64 * 1024 {
            return Err("OAuth1 parameters exceed 64 KiB.".into());
        }
        let form = matches!(request.method().as_str(), "POST" | "PUT")
            && request
                .headers()
                .get(header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok())
                .is_some_and(|value| {
                    value
                        .split(';')
                        .next()
                        .unwrap_or("")
                        .trim()
                        .eq_ignore_ascii_case("application/x-www-form-urlencoded")
                });
        if form {
            let original = request
                .body()
                .and_then(|body| body.as_bytes())
                .unwrap_or_default();
            let mut body = original.to_vec();
            if !body.is_empty() {
                body.push(b'&');
            }
            body.extend_from_slice(encoded.as_bytes());
            if body.len() > 20 * 1024 * 1024 {
                return Err("Signed request body exceeds 20 MiB.".into());
            }
            let length = header::HeaderValue::from_str(&body.len().to_string())
                .map_err(|_| "Invalid OAuth1 body length.")?;
            *request.body_mut() = Some(body.into());
            request.headers_mut().insert(header::CONTENT_LENGTH, length);
            request.headers_mut().remove(header::TRANSFER_ENCODING);
        } else {
            let query = match request.url().query() {
                Some(value) if !value.is_empty() => format!("{value}&{encoded}"),
                _ => encoded,
            };
            request.url_mut().set_query(Some(&query));
        }
        request.headers_mut().remove(header::AUTHORIZATION);
        Ok(())
    }
}
