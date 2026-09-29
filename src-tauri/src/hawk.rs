//! Hawk v1 request authentication with RustCrypto SHA1/SHA256.
use base64::{engine::general_purpose::STANDARD, Engine};
use hmac::{Hmac, Mac};
use reqwest::{header, Request};
use serde::Deserialize;
use sha1::{Digest, Sha1};
use sha2::Sha256;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct HawkCredentials {
    pub id: String,
    pub key: String,
    pub algorithm: String,
    pub ext: String,
    pub validate_payload: bool,
    pub body_mode: String,
    pub legacy_payload: Option<String>,
    pub legacy_content_type: String,
    pub postman_skip_payload: bool,
    pub nonce: String,
    pub timestamp: String,
    pub app: String,
    pub dlg: String,
}

pub(crate) struct Signer<'a>(&'a HawkCredentials);

fn payload_hash<D: Digest>(body: &[u8], mime: &str) -> String {
    let mut hash = D::new();
    hash.update(b"hawk.1.payload\n");
    hash.update(
        mime.split(';')
            .next()
            .unwrap_or("")
            .trim()
            .to_ascii_lowercase(),
    );
    hash.update(b"\n");
    hash.update(body);
    hash.update(b"\n");
    STANDARD.encode(hash.finalize())
}

impl<'a> Signer<'a> {
    pub(crate) fn new(c: &'a HawkCredentials) -> Result<Self, String> {
        if c.id.is_empty() || c.key.is_empty() {
            return Err("Hawk ID and key are required.".into());
        }
        if !matches!(c.algorithm.as_str(), "sha1" | "sha256") {
            return Err("Choose Hawk SHA1 or SHA256 in Auth.".into());
        }
        if !matches!(c.body_mode.as_str(), "legacy" | "standard" | "postman") {
            return Err("Choose a Hawk signing mode in Auth.".into());
        }
        for (name, value) in [
            ("ID", &c.id),
            ("nonce", &c.nonce),
            ("application", &c.app),
            ("delegation", &c.dlg),
            ("ext", &c.ext),
        ] {
            if value.len() > 4096
                || !value.bytes().all(|b| (32..=126).contains(&b))
                || (name != "ext" && value.contains(['"', '\\']))
            {
                return Err(format!("Hawk {name} must be printable ASCII (quotes/backslashes only in ext), at most 4096 bytes."));
            }
        }
        if c.key.len() > 64 * 1024
            || c.legacy_payload
                .as_ref()
                .is_some_and(|v| v.len() > 20 * 1024 * 1024)
        {
            return Err("Hawk key exceeds 64 KiB or legacy payload exceeds 20 MiB.".into());
        }
        if c.legacy_content_type.len() > 4096 || c.legacy_content_type.contains(['\r', '\n']) {
            return Err("Invalid Hawk content type.".into());
        }
        if !c.timestamp.is_empty()
            && (!c.timestamp.bytes().all(|b| b.is_ascii_digit())
                || c.timestamp.parse::<u64>().ok().filter(|v| *v > 0).is_none())
        {
            return Err(
                "Hawk timestamp must be positive integer seconds, or blank to generate.".into(),
            );
        }
        if c.app.is_empty() && !c.dlg.is_empty() {
            return Err("Hawk delegation requires an application ID.".into());
        }
        Ok(Self(c))
    }

    pub(crate) fn header(
        &self,
        request: &Request,
        body_was_dropped: bool,
    ) -> Result<header::HeaderValue, String> {
        let c = self.0;
        let url = request.url();
        if !matches!(url.scheme(), "http" | "https")
            || !url.username().is_empty()
            || url.password().is_some()
        {
            return Err("Hawk requires an HTTP(S) URL without embedded credentials.".into());
        }
        let mut host_url = url.clone();
        if c.body_mode == "standard" {
            if request.headers().get_all(header::HOST).iter().count() > 1 {
                return Err("Hawk signing requires one Host header.".into());
            }
            if let Some(host) = request.headers().get(header::HOST) {
                let value = host.to_str().map_err(|_| "Invalid Hawk Host header.")?;
                if value.is_empty() || value.contains(['/', '@', '?', '#', ' ', '\\']) {
                    return Err("Invalid Hawk Host header.".into());
                }
                host_url = reqwest::Url::parse(&format!("{}://{value}/", url.scheme()))
                    .map_err(|_| "Invalid Hawk Host header.")?;
            }
        }
        let host = host_url.host_str().ok_or("Hawk URL has no host.")?;
        // The original URL parser strips IPv6 brackets; actual-header mode retains them.
        let host = if c.body_mode == "standard" {
            host
        } else {
            host.trim_start_matches('[').trim_end_matches(']')
        };
        let port = host_url
            .port_or_known_default()
            .ok_or("Hawk URL has no port.")?;
        let resource = match url.query() {
            Some(query) => format!("{}?{query}", url.path()),
            None => url.path().into(),
        };
        let bytes = request.body().and_then(|v| v.as_bytes()).unwrap_or(&[]);
        let (payload, mime) = if c.body_mode == "legacy" {
            (
                if body_was_dropped {
                    None
                } else {
                    c.legacy_payload.as_ref().map(|v| v.as_bytes())
                },
                c.legacy_content_type.as_str(),
            )
        } else if c.body_mode == "postman" {
            (
                (!c.postman_skip_payload && !bytes.is_empty()).then_some(bytes),
                c.legacy_content_type.as_str(),
            )
        } else {
            if c.validate_payload
                && request
                    .headers()
                    .get_all(header::CONTENT_TYPE)
                    .iter()
                    .count()
                    > 1
            {
                return Err("Hawk payload signing requires one Content-Type header.".into());
            }
            (
                Some(bytes),
                request
                    .headers()
                    .get(header::CONTENT_TYPE)
                    .map(|v| v.to_str())
                    .transpose()
                    .map_err(|_| "Invalid Hawk content type.")?
                    .unwrap_or(""),
            )
        };
        let hash = if c.validate_payload {
            payload.map(|body| {
                if c.algorithm == "sha1" {
                    payload_hash::<Sha1>(body, mime)
                } else {
                    payload_hash::<Sha256>(body, mime)
                }
            })
        } else {
            None
        };
        let timestamp = if c.timestamp.is_empty() {
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_err(|_| "System clock is before Unix epoch.")?
                .as_secs()
                .to_string()
        } else {
            c.timestamp.clone()
        };
        let random = oauth2::CsrfToken::new_random();
        let nonce = if c.nonce.is_empty() {
            &random.secret()[..6]
        } else {
            &c.nonce
        };
        let ext = if c.body_mode == "postman" {
            c.ext.replacen('\\', "\\\\", 1).replacen('\n', "\\n", 1)
        } else {
            c.ext.replace('\\', "\\\\").replace('\n', "\\n")
        };
        let mut normalized = format!(
            "hawk.1.header\n{timestamp}\n{nonce}\n{}\n{resource}\n{}\n{port}\n{}\n{ext}\n",
            request.method().as_str().to_ascii_uppercase(),
            host.to_ascii_lowercase(),
            hash.as_deref().unwrap_or("")
        );
        if !c.app.is_empty() {
            normalized.push_str(&format!("{}\n{}\n", c.app, c.dlg));
        }
        let mac = if c.algorithm == "sha1" {
            let mut mac =
                Hmac::<Sha1>::new_from_slice(c.key.as_bytes()).map_err(|_| "Invalid Hawk key.")?;
            mac.update(normalized.as_bytes());
            STANDARD.encode(mac.finalize().into_bytes())
        } else {
            let mut mac = Hmac::<Sha256>::new_from_slice(c.key.as_bytes())
                .map_err(|_| "Invalid Hawk key.")?;
            mac.update(normalized.as_bytes());
            STANDARD.encode(mac.finalize().into_bytes())
        };
        let mut value = format!(
            "Hawk id=\"{}\", ts=\"{timestamp}\", nonce=\"{nonce}\"",
            c.id
        );
        if let Some(hash) = hash {
            value.push_str(&format!(", hash=\"{hash}\""));
        }
        if !c.ext.is_empty() {
            value.push_str(&format!(
                ", ext=\"{}\"",
                c.ext.replace('\\', "\\\\").replace('"', "\\\"")
            ));
        }
        value.push_str(&format!(", mac=\"{mac}\""));
        if !c.app.is_empty() {
            value.push_str(&format!(", app=\"{}\"", c.app));
            if !c.dlg.is_empty() {
                value.push_str(&format!(", dlg=\"{}\"", c.dlg));
            }
        }
        if value.len() > 4096 {
            return Err("Hawk Authorization exceeds the protocol's 4096-byte header limit.".into());
        }
        let mut value = header::HeaderValue::from_str(&value)
            .map_err(|_| "Invalid Hawk Authorization header.")?;
        value.set_sensitive(true);
        Ok(value)
    }
}
