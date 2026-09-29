use digest_auth::{Algorithm, AuthContext, Charset, HttpMethod, Qop, WwwAuthenticateHeader};
use http_body_util::{BodyExt, Limited};
use reqwest::{header, Method, Request, Response, StatusCode};
use serde::Deserialize;
use std::{borrow::Cow, collections::HashMap, future::Future};
use unicode_normalization::UnicodeNormalization;

#[derive(Deserialize)]
pub struct DigestCredentials {
    pub username: String,
    pub password: String,
}

pub(crate) struct Auth<'a> {
    pub digest: Option<&'a DigestCredentials>,
    pub oauth1: Option<&'a crate::oauth1::OAuth1Credentials>,
    pub aws: Option<&'a crate::aws::AwsCredentials>,
    pub hawk: Option<&'a crate::hawk::HawkCredentials>,
    pub asap: Option<&'a crate::asap::AsapCredentials>,
    pub ntlm: Option<&'a crate::ntlm::NtlmCredentials>,
    pub netrc: Option<&'a str>,
}

pub(crate) trait HttpReply {
    fn response(&self) -> &Response;
    fn into_response(self) -> Response;
}
impl HttpReply for Response {
    fn into_response(self) -> Response {
        self
    }
    fn response(&self) -> &Response {
        self
    }
}
impl HttpReply for reqwest_websocket::UpgradeResponse {
    fn into_response(self) -> Response {
        self.into_inner()
    }
    fn response(&self) -> &Response {
        self
    }
}

// Parse combined challenge lists with the RFC 7235 parser; calculate with
// digest_auth (including H(entity-body) for auth-int), never a Basic fallback.
fn prompt(item: &http_auth::ChallengeRef<'_>) -> Option<WwwAuthenticateHeader> {
    let mut fields = HashMap::new();
    for (key, value) in &item.params {
        if fields
            .insert(key.to_ascii_lowercase(), value.to_unescaped())
            .is_some()
        {
            return None;
        }
    }
    let charset = match fields.get("charset") {
        None => Charset::ASCII,
        Some(value) if value.eq_ignore_ascii_case("utf-8") => Charset::UTF8,
        _ => return None,
    };
    let algorithm: Algorithm = match fields.get("algorithm") {
        None => Algorithm::default(),
        Some(value) => {
            let upper = value.to_ascii_uppercase();
            let name = upper
                .strip_suffix("-SESS")
                .map(|base| format!("{base}-sess"))
                .unwrap_or(upper);
            name.parse().ok()?
        }
    };
    let qop = match fields.get("qop") {
        None => None,
        Some(value) => {
            let supported: Vec<Qop> = value
                .split(',')
                .filter_map(|value| match value.trim().to_ascii_lowercase().as_str() {
                    "auth" => Some(Qop::AUTH),
                    "auth-int" => Some(Qop::AUTH_INT),
                    _ => None,
                })
                .collect();
            if supported.is_empty() {
                return None;
            }
            Some(supported)
        }
    };
    if algorithm.sess && qop.is_none() {
        return None;
    }
    Some(WwwAuthenticateHeader {
        realm: fields.get("realm")?.clone(),
        nonce: fields.get("nonce")?.clone(),
        domain: fields
            .get("domain")
            .map(|value| value.split_whitespace().map(String::from).collect()),
        opaque: fields.get("opaque").cloned(),
        stale: fields
            .get("stale")
            .is_some_and(|value| value.eq_ignore_ascii_case("true")),
        userhash: fields
            .get("userhash")
            .is_some_and(|value| value.eq_ignore_ascii_case("true")),
        charset,
        algorithm,
        qop,
        nc: 0,
    })
}

fn challenge(response: &Response) -> Result<WwwAuthenticateHeader, String> {
    for value in response.headers().get_all(header::WWW_AUTHENTICATE) {
        let Ok(value) = std::str::from_utf8(value.as_bytes()) else {
            continue;
        };
        for item in http_auth::ChallengeParser::new(value) {
            let Ok(item) = item else { continue };
            if !item.scheme.eq_ignore_ascii_case("digest") {
                continue;
            }
            // Use the documented field API; digest_auth's text parser mixes
            // character and byte offsets and is unsafe for Unicode parameters.
            if let Some(prompt) = prompt(&item) {
                return Ok(prompt);
            }
        }
    }
    Err("The server returned no supported Digest challenge (MD5/SHA-256/SHA-512-256; session variants require qop).".into())
}

/// A single request operation, including bounded challenge retries and redirects.
/// Callers keep their existing cancellation/deadline around this future.
pub(crate) async fn execute<T, F, Fut>(
    mut outgoing: Request,
    auth: Auth<'_>,
    follow_redirects: bool,
    has_identity: bool,
    send: F,
) -> Result<T, String>
where
    T: HttpReply,
    F: Fn(Request) -> Fut,
    Fut: Future<Output = Result<T, String>>,
{
    let Auth {
        digest: credentials,
        oauth1,
        aws,
        hawk,
        asap,
        ntlm,
        netrc,
    } = auth;
    if (aws.is_none() && outgoing.headers().contains_key(header::AUTHORIZATION))
        || (credentials.is_none()
            && oauth1.is_none()
            && aws.is_none()
            && hawk.is_none()
            && asap.is_none()
            && ntlm.is_none()
            && netrc.is_none())
    {
        return send(outgoing).await;
    }
    if [
        credentials.is_some(),
        oauth1.is_some(),
        aws.is_some(),
        hawk.is_some(),
        asap.is_some(),
        ntlm.is_some(),
        netrc.is_some(),
    ]
    .iter()
    .filter(|v| **v)
    .count()
        > 1
    {
        return Err("Choose one authentication method per request.".into());
    }
    let netrc = match netrc {
        Some(url) => Some(crate::netrc::Session::load(url).await?),
        None => None,
    };
    let mut ntlm_session = ntlm.map(crate::ntlm::Session::new).transpose()?;
    let mut ntlm_round = 0;
    if let Some(c) = ntlm {
        c.connection.release();
    }
    let oauth1 = oauth1.map(crate::oauth1::Signer::new).transpose()?;
    let hawk = hawk.map(crate::hawk::Signer::new).transpose()?;
    let asap = asap.map(crate::asap::header).transpose()?;
    let aws = aws
        .map(|credentials| crate::aws::Signer::new(credentials, &outgoing))
        .transpose()?;
    // Encode multipart exactly once, preserving its boundary and bytes on retry.
    // All request bodies are already in memory; the buffer is bounded here too.
    if let Some(body) = outgoing.body_mut().take() {
        let bytes = Limited::new(body, 20 * 1024 * 1024)
            .collect()
            .await
            .map_err(|_| "Signed request body exceeds 20 MiB or could not be read")?
            .to_bytes();
        *outgoing.body_mut() = Some(bytes.into());
    }
    outgoing.headers_mut().remove(header::AUTHORIZATION);
    outgoing.url_mut().set_fragment(None);
    let original_origin = outgoing.url().origin();
    let mut redirects = 0;
    let mut attempts = 0;
    let mut body_was_dropped = false;
    loop {
        if let Some(session) = &netrc {
            outgoing.headers_mut().remove(header::AUTHORIZATION);
            if let Some(value) = session.header(outgoing.url())? {
                outgoing.headers_mut().insert(header::AUTHORIZATION, value);
            }
        }
        if let Some(value) = &asap {
            if outgoing.url().origin() == original_origin {
                outgoing
                    .headers_mut()
                    .insert(header::AUTHORIZATION, value.clone());
            }
        }
        if let Some(signer) = &hawk {
            if outgoing.url().origin() == original_origin {
                let value = signer.header(&outgoing, body_was_dropped)?;
                outgoing.headers_mut().insert(header::AUTHORIZATION, value);
            }
        }
        if let Some(signer) = &aws {
            if outgoing.url().origin() == original_origin {
                signer.sign(&mut outgoing)?;
            }
        }
        if let Some(signer) = &oauth1 {
            if outgoing.url().origin() == original_origin {
                let header = signer.header(&outgoing)?;
                outgoing.headers_mut().insert(header::AUTHORIZATION, header);
            }
        }
        let reply = send(
            outgoing
                .try_clone()
                .ok_or("Signed request cannot be replayed")?,
        )
        .await
        .map_err(|error| {
            if ntlm.is_some_and(|c| c.connection.rejected()) {
                "NTLM connection closed during authentication; send again to start a new handshake."
                    .to_string()
            } else {
                error
            }
        })?;
        let response = reply.response();
        if let Some(c) = ntlm.filter(|_| {
            response.status() == StatusCode::UNAUTHORIZED
                && outgoing.url().origin() == original_origin
                && ntlm_round < 2
        }) {
            let token = crate::ntlm::challenge(response)?;
            let session = ntlm_session.as_mut().ok_or("Missing NTLM session")?;
            let header = if ntlm_round == 0 {
                session.negotiate()?
            } else {
                session.authenticate(
                    token.ok_or("The server returned no NTLM Type 2 token.")?,
                    response,
                    &c.connection,
                )?
            };
            crate::ntlm::drain(reply.into_response()).await?;
            outgoing.headers_mut().insert(header::AUTHORIZATION, header);
            ntlm_round += 1;
            continue;
        }
        if let Some(credentials) = credentials.filter(|_| {
            response.status() == StatusCode::UNAUTHORIZED
                && outgoing.url().origin() == original_origin
                && attempts < 2
        }) {
            let mut prompt = challenge(response)?;
            if attempts > 0 && !prompt.stale {
                return Ok(reply);
            }
            let uri = match outgoing.url().query() {
                Some(query) => format!("{}?{query}", outgoing.url().path()),
                None => outgoing.url().path().to_string(),
            };
            let body = outgoing
                .body()
                .and_then(|body| body.as_bytes())
                .unwrap_or(&[]);
            let normalize = |value: &str| -> String { value.nfc().collect() };
            let (username, password) = if prompt.charset == Charset::UTF8 {
                (
                    Cow::Owned(normalize(&credentials.username)),
                    Cow::Owned(normalize(&credentials.password)),
                )
            } else {
                (
                    Cow::Borrowed(credentials.username.as_str()),
                    Cow::Borrowed(credentials.password.as_str()),
                )
            };
            if username.contains(':') {
                return Err("Digest usernames cannot contain a colon".into());
            }
            let context = AuthContext::new_with_method(
                username.as_ref(),
                password.as_ref(),
                uri.as_str(),
                Some(body),
                HttpMethod::from(outgoing.method().as_str()),
            );
            let mut answer = prompt
                .respond(&context)
                .map_err(|_| "Could not calculate Digest response")?;
            // RFC 7616 section 4 / RFC 5987: non-ASCII unhashed usernames use
            // username*, while the digest was calculated from normalized UTF-8.
            let value = if !answer.userhash && !answer.username.is_ascii() {
                let username = std::mem::take(&mut answer.username);
                let encoded = percent_encoding::utf8_percent_encode(
                    &username,
                    percent_encoding::NON_ALPHANUMERIC,
                );
                answer.to_string().replacen(
                    "username=\"\"",
                    &format!("username*=UTF-8''{encoded}"),
                    1,
                )
            } else {
                answer.to_string()
            };
            let mut value = header::HeaderValue::from_str(&value)
                .map_err(|_| "Invalid Digest authorization value")?;
            value.set_sensitive(true);
            outgoing.headers_mut().insert(header::AUTHORIZATION, value);
            attempts += 1;
            continue;
        }
        let status = response.status();
        if !follow_redirects || !matches!(status.as_u16(), 301 | 302 | 303 | 307 | 308) {
            return Ok(reply);
        }
        let Some(location) = response.headers().get(header::LOCATION) else {
            return Ok(reply);
        };
        if redirects >= 10 {
            return Err("Too many redirects (maximum 10)".into());
        }
        let previous = outgoing.url().clone();
        let mut next = previous
            .join(location.to_str().map_err(|_| "Invalid redirect Location")?)
            .map_err(|_| "Invalid redirect URL")?;
        if !matches!(next.scheme(), "http" | "https") {
            return Err("Redirect must use HTTP or HTTPS".into());
        }
        if has_identity && next.origin() != original_origin {
            return Err("Client certificate redirect to a different origin was blocked".into());
        }
        if !next.username().is_empty() || next.password().is_some() {
            return Err("Redirect URLs containing credentials are not supported".into());
        }
        next.set_fragment(None);
        outgoing.headers_mut().remove(header::AUTHORIZATION);
        outgoing.headers_mut().remove(header::HOST);
        if aws.is_some() {
            crate::aws::clear_headers(&mut outgoing);
        }
        if previous.origin() != next.origin() {
            for name in [
                header::COOKIE,
                header::PROXY_AUTHORIZATION,
                header::WWW_AUTHENTICATE,
            ] {
                outgoing.headers_mut().remove(name);
            }
            outgoing.headers_mut().remove("cookie2");
        }
        if previous.scheme() == "https" && next.scheme() == "http" {
            outgoing.headers_mut().remove(header::REFERER);
        }
        if ((status == StatusCode::MOVED_PERMANENTLY || status == StatusCode::FOUND)
            && outgoing.method() == Method::POST)
            || (status == StatusCode::SEE_OTHER && outgoing.method() != Method::HEAD)
        {
            *outgoing.method_mut() = Method::GET;
            *outgoing.body_mut() = None;
            body_was_dropped = true;
            for name in [
                header::CONTENT_LENGTH,
                header::CONTENT_TYPE,
                header::TRANSFER_ENCODING,
            ] {
                outgoing.headers_mut().remove(name);
            }
        }
        if let Some(c) = ntlm {
            crate::ntlm::drain(reply.into_response()).await?;
            c.connection.release();
            ntlm_round = 0;
            ntlm_session = if next.origin() == original_origin {
                Some(crate::ntlm::Session::new(c)?)
            } else {
                None
            };
        }
        *outgoing.url_mut() = next;
        redirects += 1;
        attempts = 0;
    }
}
