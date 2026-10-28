//! Explicit proxy credentials, isolated from origin authentication and OS sign-in.
//! RFC9110 11.7: https://www.rfc-editor.org/rfc/rfc9110.html#section-11.7
//! Socket ownership is enforced by reqwest's proxy challenge transport.
#[path = "proxy_rules.rs"]
mod rules;

use base64::{engine::general_purpose::STANDARD, Engine};
use percent_encoding::percent_decode_str;
use reqwest::{
    header::{HeaderMap, HeaderValue, PROXY_AUTHENTICATE},
    Proxy, ProxyChallengeProvider, ProxyChallengeSession,
};
use std::{error::Error, sync::Arc};

type BoxError = Box<dyn Error + Send + Sync>;
#[derive(Clone, Copy, PartialEq)]
enum AuthMode {
    Auto,
    Basic,
    Digest,
    Ntlm,
}
struct Credentials {
    username: String,
    password: String,
    tls: bool,
    mode: AuthMode,
}
struct Provider(Arc<Credentials>);
enum Phase {
    Initial,
    Negotiated(crate::ntlm::Session),
    Digest {
        nonce: String,
        realm: String,
        algorithm: String,
    },
    Finished,
}
struct Session {
    credentials: Arc<Credentials>,
    phase: Phase,
    proof: Option<Arc<dyn reqwest::ResponseVerifier>>,
}

pub(crate) fn configure_proxy(
    value: &str,
    basic: bool,
    mode: Option<&str>,
    scheme: Option<&str>,
    bypass: Option<&str>,
) -> Result<Proxy, String> {
    let mode = match mode.unwrap_or(if basic { "basic" } else { "auto" }) {
        "auto" => AuthMode::Auto,
        "basic" => AuthMode::Basic,
        "digest" => AuthMode::Digest,
        "ntlm" => AuthMode::Ntlm,
        _ => return Err("Invalid proxy authentication mode".into()),
    };
    // Let pinned IntoProxy validate the accepted syntax first, including its
    // original errors and SOCKS default-port behavior. IntoUrl accepts parsed
    // URLs only when they have a host; IntoProxy retries a missing scheme or
    // hostless BadScheme with http://. Thus user:pass@host:port must not be
    // mistaken for an unsupported `user:` URL scheme and bypass negotiation.
    let ordinary = rules::configured(value, scheme, bypass)?;
    let mut url = match reqwest::Url::parse(value) {
        Ok(url) if url.has_host() => url,
        _ => reqwest::Url::parse(&format!("http://{value}"))
            .map_err(|_| "Invalid proxy configuration")?,
    };
    if !matches!(url.scheme(), "http" | "https")
        && matches!(mode, AuthMode::Digest | AuthMode::Ntlm)
    {
        return Err("Digest and NTLM proxy authentication require HTTP(S)".into());
    }
    if !matches!(url.scheme(), "http" | "https")
        || (url.username().is_empty() && url.password().is_none())
    {
        return Ok(ordinary);
    }
    let username = credential(url.username())?;
    let password = credential(url.password().unwrap_or(""))?;
    if username.is_empty() || username.contains(':') {
        return Err("Invalid explicit proxy username".into());
    }
    if mode == AuthMode::Basic {
        // Proxy::all retains percent-encoded URL credentials and performs
        // preemptive Basic for HTTP/CONNECT. Do not round-trip through
        // basic_auth: its URL setters could reinterpret a literal %HH password.
        return Ok(ordinary);
    }
    let tls = url.scheme() == "https";
    url.set_username("")
        .map_err(|_| "Invalid proxy credential URL")?;
    url.set_password(None)
        .map_err(|_| "Invalid proxy credential URL")?;
    Ok(
        rules::configured(url.as_str(), scheme, bypass)?.challenge_provider(Arc::new(Provider(
            Arc::new(Credentials {
                username,
                password,
                tls,
                mode,
            }),
        ))),
    )
}

fn credential(encoded: &str) -> Result<String, String> {
    if encoded.len() > 48 * 1024 {
        return Err("Proxy credential exceeds bound".into());
    }
    let bytes = encoded.as_bytes();
    for (index, byte) in bytes.iter().enumerate() {
        if *byte == b'%'
            && (index + 2 >= bytes.len()
                || !bytes[index + 1].is_ascii_hexdigit()
                || !bytes[index + 2].is_ascii_hexdigit())
        {
            return Err("Malformed proxy credential encoding".into());
        }
    }
    let decoded = percent_decode_str(encoded)
        .decode_utf8()
        .map_err(|_| "Invalid proxy credential UTF-8")?
        .into_owned();
    if decoded.len() > 16 * 1024 || decoded.chars().any(char::is_control) {
        return Err("Invalid bounded proxy credential".into());
    }
    Ok(decoded)
}

impl ProxyChallengeProvider for Provider {
    fn create_session(&self) -> Result<Box<dyn ProxyChallengeSession>, BoxError> {
        Ok(Box::new(Session {
            credentials: self.0.clone(),
            phase: Phase::Initial,
            proof: None,
        }))
    }
}
impl ProxyChallengeSession for Session {
    fn response_verifier(&self) -> Option<Arc<dyn reqwest::ResponseVerifier>> {
        self.proof.clone()
    }
    fn authenticate(
        &mut self,
        headers: &HeaderMap,
        proxy_certificate: Option<&[u8]>,
    ) -> Result<HeaderValue, BoxError> {
        self.reply(headers, proxy_certificate, None)
            .map_err(|error| std::io::Error::other(error).into())
    }

    fn authenticate_request(
        &mut self,
        headers: &HeaderMap,
        proxy_certificate: Option<&[u8]>,
        method: &reqwest::Method,
        target: &str,
        body: &[u8],
    ) -> Result<HeaderValue, BoxError> {
        self.reply(headers, proxy_certificate, Some((method, target, body)))
            .map_err(|error| std::io::Error::other(error).into())
    }
}
impl Session {
    fn reply(
        &mut self,
        headers: &HeaderMap,
        certificate: Option<&[u8]>,
        request: Option<(&reqwest::Method, &str, &[u8])>,
    ) -> Result<HeaderValue, String> {
        // Replace first: every malformed/ambiguous/rejected response permanently
        // exhausts this socket session instead of falling back with credentials.
        let phase = std::mem::replace(&mut self.phase, Phase::Finished);
        if matches!(phase, Phase::Finished) {
            return Err("Proxy authentication was rejected".into());
        }
        let mut schemes = schemes(headers)?;
        // A forced mode never falls back to another advertised credential scheme.
        // Existing callers retain the original negotiation policy.
        match self.credentials.mode {
            AuthMode::Digest => schemes.retain(|scheme| scheme.eq_ignore_ascii_case("digest")),
            AuthMode::Ntlm => schemes.retain(|scheme| scheme.eq_ignore_ascii_case("ntlm")),
            _ => {}
        }
        let ntlm = schemes
            .iter()
            .filter(|scheme| scheme.eq_ignore_ascii_case("ntlm"))
            .count();
        let basic = schemes
            .iter()
            .filter(|scheme| scheme.eq_ignore_ascii_case("basic"))
            .count();
        let digest = schemes
            .iter()
            .any(|scheme| scheme.eq_ignore_ascii_case("digest"));
        if ntlm > 1 || basic > 1 {
            return Err("Ambiguous proxy authentication challenges".into());
        }
        match phase {
            Phase::Initial if ntlm == 1 => {
                if crate::ntlm::challenge_headers(headers, PROXY_AUTHENTICATE)?.is_some() {
                    return Err("Proxy NTLM Type 2 arrived before negotiation".into());
                }
                let mut session = crate::ntlm::Session::new_proxy(
                    &self.credentials.username,
                    &self.credentials.password,
                )?;
                let value = session.negotiate()?;
                self.phase = Phase::Negotiated(session);
                Ok(value)
            }
            Phase::Negotiated(mut session) if ntlm == 1 => {
                if self.credentials.tls && certificate.is_none() {
                    return Err(
                        "Proxy NTLM TLS channel binding requires the proxy certificate".into(),
                    );
                }
                let token = crate::ntlm::challenge_headers(headers, PROXY_AUTHENTICATE)?
                    .ok_or("Proxy NTLM challenge repeated without Type 2")?;
                session.authenticate_proxy(
                    token,
                    if self.credentials.tls {
                        certificate
                    } else {
                        None
                    },
                )
            }
            Phase::Initial if digest => {
                let (method, target, body) =
                    request.ok_or("Proxy Digest requires request context")?;
                let mut prompt = crate::digest::challenge_from_headers(headers, PROXY_AUTHENTICATE)
                    .map_err(|_| "Proxy returned no supported Digest challenge")?;
                self.phase = Phase::Digest {
                    nonce: prompt.nonce.clone(),
                    realm: prompt.realm.clone(),
                    algorithm: format!("{:?}", prompt.algorithm),
                };
                let (value, proof) = crate::digest::authorization(
                    &mut prompt,
                    &self.credentials.username,
                    &self.credentials.password,
                    target,
                    body,
                    method,
                )?;
                self.proof = Some(Arc::new(proof));
                Ok(value)
            }
            Phase::Digest {
                nonce,
                realm,
                algorithm,
            } if digest => {
                let (method, target, body) =
                    request.ok_or("Proxy Digest requires request context")?;
                let mut prompt = crate::digest::challenge_from_headers(headers, PROXY_AUTHENTICATE)
                    .map_err(|_| "Proxy returned no supported Digest challenge")?;
                if !prompt.stale
                    || prompt.nonce == nonce
                    || prompt.realm != realm
                    || format!("{:?}", prompt.algorithm) != algorithm
                {
                    return Err("Proxy Digest authentication was rejected".into());
                }
                let (value, proof) = crate::digest::authorization(
                    &mut prompt,
                    &self.credentials.username,
                    &self.credentials.password,
                    target,
                    body,
                    method,
                )?;
                self.proof = Some(Arc::new(proof));
                Ok(value)
            }
            Phase::Initial if basic == 1 && schemes.len() == 1 => {
                let encoded = STANDARD.encode(format!(
                    "{}:{}",
                    self.credentials.username, self.credentials.password
                ));
                let mut value = HeaderValue::from_str(&format!("Basic {encoded}"))
                    .map_err(|_| "Invalid proxy authorization")?;
                value.set_sensitive(true);
                Ok(value)
            }
            _ => Err("Unsupported or rejected proxy authentication scheme".into()),
        }
    }
}

/// Split outside quoted auth-param values; comma fragments containing '=' are
/// continuation parameters rather than a new scheme. Bound the entire header set.
fn schemes(headers: &HeaderMap) -> Result<Vec<String>, String> {
    let mut result = Vec::new();
    let mut size = 0;
    for value in headers.get_all(PROXY_AUTHENTICATE) {
        let value = value
            .to_str()
            .map_err(|_| "Invalid proxy authentication challenge")?;
        size += value.len();
        if size > 96 * 1024 {
            return Err("Proxy authentication challenge exceeds bound".into());
        }
        let (mut quote, mut escape, mut start) = (false, false, 0);
        let mut parts = Vec::new();
        for (index, ch) in value.char_indices() {
            if escape {
                escape = false;
                continue;
            }
            if quote && ch == '\\' {
                escape = true;
                continue;
            }
            if ch == '"' {
                quote = !quote;
            }
            if ch == ',' && !quote {
                parts.push(&value[start..index]);
                start = index + 1;
            }
        }
        if quote || escape {
            return Err("Malformed quoted proxy challenge".into());
        }
        parts.push(&value[start..]);
        for part in parts {
            let part = part.trim();
            if part.is_empty() {
                continue;
            }
            let end = part.find(char::is_whitespace).unwrap_or(part.len());
            let scheme = &part[..end];
            if scheme.contains('=') || part[end..].trim_start().starts_with('=') {
                continue;
            }
            if !scheme
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
            {
                return Err("Invalid proxy authentication scheme".into());
            }
            result.push(scheme.to_owned());
        }
    }
    if result.is_empty() {
        return Err("Proxy returned no authentication challenge".into());
    }
    Ok(result)
}

/// App exclusions also apply when proxy URLs come from the environment or OS.
pub(crate) fn configure_system_bypass(
    builder: reqwest::ClientBuilder,
    bypass: Option<&str>,
) -> Result<reqwest::ClientBuilder, String> {
    Ok(builder.system_proxy_bypass(rules::checked_bypass(bypass)?))
}
