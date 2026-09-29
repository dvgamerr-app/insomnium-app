//! Single-attempt OAuth authorization and a bounded loopback callback listener.
use crate::{
    oauth::{CodeGrant, OAuthConfig, OAuthToken},
    oauth_implicit::Implicit,
};
use http_body_util::{BodyExt, Full, Limited};
use hyper::{body::Bytes, server::conn::http1, service::service_fn, Request, Response, StatusCode};
use hyper_util::rt::{TokioIo, TokioTimer};
use oauth2::{
    basic::BasicClient, AuthUrl, AuthorizationCode, ClientId, CsrfToken, PkceCodeChallenge,
    PkceCodeVerifier, RedirectUrl, ResponseType, Scope,
};
use reqwest::Url;
use std::{
    collections::HashMap,
    convert::Infallible,
    net::{IpAddr, Ipv4Addr},
    sync::{Arc, Mutex},
    time::Duration,
};
use tokio::{net::TcpListener, task::JoinSet};

const CALLBACK_LIMIT: usize = 16 * 1024;
const RESPONSE_KEYS: [&str; 12] = [
    "code",
    "state",
    "error",
    "error_description",
    "error_uri",
    "access_token",
    "id_token",
    "iss",
    "token_type",
    "expires_in",
    "refresh_token",
    "scope",
];

pub enum CallbackResponse {
    Code(String),
    Tokens(Box<OAuthToken>),
    Empty,
}

pub struct Authorization {
    pub url: Url,
    pub callback: Arc<Callback>,
    redirect: RedirectUrl,
    verifier: Option<PkceCodeVerifier>,
}
pub struct Callback {
    pub redirect: Url,
    state: CsrfToken,
    issuer: String,
    implicit: Option<Implicit>,
    relay_secret: CsrfToken,
}
pub struct Loopback {
    listener: TcpListener,
    pub redirect: Url,
}

fn query(url: &Url) -> Result<HashMap<String, String>, String> {
    parameters(url.query().unwrap_or_default())
}
fn parameters(value: &str) -> Result<HashMap<String, String>, String> {
    let mut result = HashMap::new();
    for (key, value) in url::form_urlencoded::parse(value.as_bytes()) {
        if result
            .insert(key.into_owned(), value.into_owned())
            .is_some()
        {
            return Err("Duplicate OAuth callback/query parameter.".into());
        }
    }
    Ok(result)
}

/// Select the exact configured redirect; only an empty redirect allocates a default.
pub async fn prepare_redirect(config: &OAuthConfig) -> Result<(Url, Option<Loopback>), String> {
    if !matches!(config.browser_mode.as_str(), "" | "system" | "embedded") {
        return Err("Unknown OAuth login browser mode.".into());
    }
    if config.browser_mode == "embedded" && config.redirect_url.is_empty() {
        return Err("Enter the provider's registered redirect URL for the login window.".into());
    }
    if !matches!(config.callback_mode.as_str(), "" | "auto" | "manual") {
        return Err("Unknown OAuth callback mode.".into());
    }
    if config.redirect_url.is_empty() && config.callback_mode == "manual" {
        return Err("Manual callback mode requires a redirect URL.".into());
    }
    let mut redirect = Url::parse(if config.redirect_url.is_empty() {
        "http://127.0.0.1:0/oauth/callback"
    } else {
        &config.redirect_url
    })
    .map_err(|_| "Invalid OAuth redirect URL.")?;
    if redirect.as_str().len() > CALLBACK_LIMIT
        || !redirect.username().is_empty()
        || redirect.password().is_some()
        || redirect.fragment().is_some()
    {
        return Err(
            "OAuth redirect must have no user information or fragment and be under 16 KiB.".into(),
        );
    }
    if query(&redirect)?
        .keys()
        .any(|key| RESPONSE_KEYS.contains(&key.as_str()))
    {
        return Err("Remove OAuth response parameters from the configured redirect URL.".into());
    }
    let ip = match redirect.host() {
        Some(oauth2::url::Host::Ipv4(ip)) if ip.is_loopback() => Some(IpAddr::V4(ip)),
        Some(oauth2::url::Host::Ipv6(ip)) if ip.is_loopback() => Some(IpAddr::V6(ip)),
        Some(oauth2::url::Host::Domain("localhost")) => Some(IpAddr::V4(Ipv4Addr::LOCALHOST)),
        _ => None,
    };
    if config.browser_mode == "embedded"
        || redirect.scheme() != "http"
        || ip.is_none()
        || config.callback_mode == "manual"
    {
        return Ok((redirect, None));
    }
    let listener = TcpListener::bind((ip.expect("loopback checked"), redirect.port_or_known_default().unwrap_or(80))).await.map_err(|_| "OAuth callback port is unavailable. Choose another registered redirect port or manual callback mode.")?;
    let port = listener
        .local_addr()
        .map_err(|_| "Cannot read OAuth callback port.")?
        .port();
    redirect
        .set_port(Some(port))
        .map_err(|_| "Invalid OAuth callback port.")?;
    Ok((redirect.clone(), Some(Loopback { listener, redirect })))
}

impl Authorization {
    pub fn new(config: &OAuthConfig, redirect: Url) -> Result<Self, String> {
        if config.client_id.is_empty() {
            return Err("OAuth client ID is required.".into());
        }
        let implicit = if config.grant_type == "implicit" {
            Some(Implicit::new(config)?)
        } else {
            None
        };
        if implicit.is_none() && !matches!(config.response_type.as_str(), "" | "code") {
            return Err("Authorization Code requires response type code.".into());
        }
        let auth_url =
            Url::parse(&config.authorization_url).map_err(|_| "Invalid authorization URL.")?;
        if !matches!(auth_url.scheme(), "http" | "https")
            || !auth_url.username().is_empty()
            || auth_url.password().is_some()
            || auth_url.fragment().is_some()
        {
            return Err(
                "Use an HTTP(S) authorization URL without user information or fragment.".into(),
            );
        }
        let reserved = [
            "response_type",
            "client_id",
            "redirect_uri",
            "scope",
            "state",
            "code_challenge",
            "code_challenge_method",
            "audience",
            "resource",
            "nonce",
            "response_mode",
        ];
        if query(&auth_url)?
            .keys()
            .any(|key| reserved.contains(&key.as_str()))
        {
            return Err(
                "Set OAuth parameters in Auth fields, not in the authorization URL query.".into(),
            );
        }
        // Providers may compare the registered redirect byte-for-byte (including
        // explicit default ports). Preserve its text unless an ephemeral port changed it.
        let redirect_uri = if !config.redirect_url.is_empty()
            && Url::parse(&config.redirect_url).ok().as_ref() == Some(&redirect)
        {
            RedirectUrl::new(config.redirect_url.clone())
                .map_err(|_| "Invalid OAuth redirect URL.")?
        } else {
            RedirectUrl::from_url(redirect.clone())
        };
        let client = BasicClient::new(ClientId::new(config.client_id.clone()))
            .set_auth_uri(AuthUrl::from_url(auth_url))
            .set_redirect_uri(redirect_uri.clone());
        let state = if config.state.is_empty() {
            CsrfToken::new_random()
        } else {
            CsrfToken::new(config.state.clone())
        };
        let mut request = client.authorize_url(|| state.clone()).add_scopes(
            config
                .scope
                .split_ascii_whitespace()
                .map(|s| Scope::new(s.into())),
        );
        let mut verifier = None;
        let response_type = ResponseType::new(
            implicit
                .as_ref()
                .map_or("code", |value| value.response_type)
                .into(),
        );
        if let Some(implicit) = &implicit {
            // Use the documented default mode: fragment for tokens, query for none.
            request = request.set_response_type(&response_type);
            if let Some(nonce) = &implicit.nonce {
                request = request.add_extra_param("nonce", nonce.secret());
            }
        }
        if implicit.is_none() && config.use_pkce {
            let (challenge, secret) = match config.pkce_method.as_str() {
                "" | "S256" => PkceCodeChallenge::new_random_sha256(),
                "plain" => PkceCodeChallenge::new_random_plain(),
                _ => return Err("Unsupported PKCE method. Choose S256 or plain explicitly.".into()),
            };
            request = request.set_pkce_challenge(challenge);
            verifier = Some(secret);
        }
        for (key, value) in [
            ("audience", &config.audience),
            ("resource", &config.resource),
        ] {
            if !value.is_empty() {
                request = request.add_extra_param(key, value);
            }
        }
        let (url, state) = request.url();
        if url.as_str().len() > CALLBACK_LIMIT {
            return Err("OAuth authorization URL exceeds 16 KiB.".into());
        }
        Ok(Self {
            url,
            redirect: redirect_uri,
            callback: Arc::new(Callback {
                redirect,
                state,
                issuer: config.issuer.clone(),
                implicit,
                relay_secret: CsrfToken::new_random(),
            }),
            verifier,
        })
    }
    pub fn grant(self, code: String) -> CodeGrant {
        CodeGrant {
            code: AuthorizationCode::new(code),
            redirect: self.redirect,
            verifier: self.verifier,
        }
    }
    pub fn redirect_uri(&self) -> &str {
        self.redirect.as_str()
    }
}

impl Callback {
    /// Target comparison before interception; validation still checks query, state and issuer.
    pub fn matches_target(&self, url: &Url) -> bool {
        url.scheme() == self.redirect.scheme()
            && url.host() == self.redirect.host()
            && url.port_or_known_default() == self.redirect.port_or_known_default()
            && url.path() == self.redirect.path()
    }
    /// Outer error: invalid/unrelated callback; keep listening. Inner error: valid provider denial.
    pub fn validate(&self, value: &str) -> Result<Result<CallbackResponse, String>, String> {
        if value.len() > CALLBACK_LIMIT {
            return Err("OAuth callback exceeds 16 KiB.".into());
        }
        let url = Url::parse(value).map_err(|_| "Invalid callback URL.")?;
        let target = &self.redirect;
        if url.scheme() != target.scheme()
            || url.host() != target.host()
            || url.port_or_known_default() != target.port_or_known_default()
            || url.path() != target.path()
            || !url.username().is_empty()
            || url.password().is_some()
            || (self.implicit.is_none() && url.fragment().is_some())
        {
            return Err("Callback URL does not match the configured redirect.".into());
        }
        let query_params = query(&url)?;
        if query(target)?
            .iter()
            .any(|(key, value)| query_params.get(key) != Some(value))
        {
            return Err("Callback is missing a configured redirect query parameter.".into());
        }
        let params = if self.implicit.is_some() {
            if let Some(fragment) = url.fragment() {
                if query_params
                    .keys()
                    .any(|key| RESPONSE_KEYS.contains(&key.as_str()))
                {
                    return Err("Mixed query and fragment OAuth responses are not accepted.".into());
                }
                let params = parameters(fragment)?;
                if params.keys().any(|key| query_params.contains_key(key)) {
                    return Err(
                        "Duplicate OAuth callback parameter across query and fragment.".into(),
                    );
                }
                params
            } else if query_params.contains_key("error")
                || self
                    .implicit
                    .as_ref()
                    .is_some_and(|value| value.response_type == "none")
            {
                query_params
            } else {
                return Err("Implicit callback must include the complete URL fragment.".into());
            }
        } else {
            query_params
        };
        if !params
            .get("state")
            .is_some_and(|state| CsrfToken::new(state.clone()) == self.state)
        {
            return Err("OAuth state mismatch. The callback was not accepted.".into());
        }
        if !self.issuer.is_empty() && params.get("iss") != Some(&self.issuer) {
            return Err("OAuth issuer mismatch. The callback was not accepted.".into());
        }
        if (self.implicit.is_none()
            && (params.contains_key("access_token") || params.contains_key("id_token")))
            || (params.contains_key("error")
                && ["code", "access_token", "id_token", "refresh_token"]
                    .iter()
                    .any(|key| params.contains_key(*key)))
        {
            return Err("Unexpected OAuth callback response type.".into());
        }
        if let Some(error) = params.get("error") {
            let message = match error.as_str() {
                "access_denied" => "Authorization was denied.",
                "temporarily_unavailable" => "Authorization provider is temporarily unavailable.",
                "login_required" | "interaction_required" => {
                    "The provider requires another interactive login."
                }
                _ => "Authorization provider returned an OAuth error.",
            };
            return Ok(Err(message.into()));
        }
        if let Some(implicit) = &self.implicit {
            return implicit.token(&params).map(|token| {
                Ok(match token {
                    Some(token) => CallbackResponse::Tokens(Box::new(token)),
                    None => CallbackResponse::Empty,
                })
            });
        }
        let code = params
            .get("code")
            .filter(|code| !code.is_empty())
            .ok_or("No authorization code in callback.")?;
        Ok(Ok(CallbackResponse::Code(code.clone())))
    }
}

fn page(status: StatusCode, text: &'static str) -> Response<Full<Bytes>> {
    let mut response = Response::new(Full::new(Bytes::from(text)));
    *response.status_mut() = status;
    for (key, value) in [
        ("content-type", "text/plain; charset=utf-8"),
        ("cache-control", "no-store"),
        ("referrer-policy", "no-referrer"),
        (
            "content-security-policy",
            "default-src 'none'; frame-ancestors 'none'",
        ),
        ("x-content-type-options", "nosniff"),
    ] {
        response
            .headers_mut()
            .insert(key, hyper::header::HeaderValue::from_static(value));
    }
    response
}

type CallbackResult = Arc<Mutex<Option<Result<CallbackResponse, String>>>>;

fn relay_page(callback: &Callback) -> Response<Full<Bytes>> {
    let nonce = CsrfToken::new_random();
    let html = format!("<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><title>Insomnium authorization</title><h1>Insomnium</h1><p id=\"status\">Receiving authorization response…</p><textarea id=\"fallback\" aria-label=\"Callback URL for manual paste\" readonly hidden rows=\"8\" cols=\"80\"></textarea><script nonce=\"{}\" data-relay=\"{}\">{}</script></html>", nonce.secret(), callback.relay_secret.secret(), include_str!("oauth-fragment.js"));
    let mut response = page(StatusCode::OK, "");
    *response.body_mut() = Full::new(Bytes::from(html));
    response.headers_mut().insert(
        "content-type",
        hyper::header::HeaderValue::from_static("text/html; charset=utf-8"),
    );
    response.headers_mut().insert("content-security-policy", hyper::header::HeaderValue::from_str(&format!("default-src 'none'; script-src 'nonce-{}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'", nonce.secret())).expect("random base64url nonce"));
    response
}

async fn callback_request(
    request: Request<hyper::body::Incoming>,
    callback: Arc<Callback>,
    authority: String,
    result: CallbackResult,
) -> Result<Response<Full<Bytes>>, Infallible> {
    let invalid = || {
        page(StatusCode::BAD_REQUEST, "Callback was not accepted. Continue the original authorization or return to Insomnium.")
    };
    let host = request
        .headers()
        .get(hyper::header::HOST)
        .and_then(|v| v.to_str().ok());
    if request.uri().scheme().is_some()
        || request
            .headers()
            .get_all(hyper::header::HOST)
            .iter()
            .count()
            != 1
        || host != Some(authority.as_str())
    {
        return Ok(invalid());
    }
    let mut value = format!("http://{}{}", authority, request.uri());
    if callback.implicit.is_some() {
        let parsed = match Url::parse(&value) {
            Ok(value) => value,
            Err(_) => return Ok(invalid()),
        };
        // A relay page/body is accepted only at the exact registered URI (including static query).
        let exact = parsed == callback.redirect;
        if request.method() == hyper::Method::GET && exact {
            return Ok(relay_page(&callback));
        }
        if request.method() == hyper::Method::POST && exact {
            let origin = callback.redirect.origin().ascii_serialization();
            let headers = request.headers();
            let secret = headers
                .get("x-insomnium-oauth")
                .and_then(|v| v.to_str().ok());
            if headers.get_all("origin").iter().count() != 1
                || headers.get("origin").and_then(|v| v.to_str().ok()) != Some(origin.as_str())
                || headers.get_all("x-insomnium-oauth").iter().count() != 1
                || !secret
                    .is_some_and(|value| CsrfToken::new(value.into()) == callback.relay_secret)
            {
                return Ok(invalid());
            }
            let bytes = match Limited::new(request.into_body(), CALLBACK_LIMIT)
                .collect()
                .await
            {
                Ok(body) => body.to_bytes(),
                Err(_) => return Ok(invalid()),
            };
            value = match String::from_utf8(bytes.to_vec()) {
                Ok(value) => value,
                Err(_) => return Ok(invalid()),
            };
        } else if request.method() != hyper::Method::GET {
            return Ok(invalid());
        }
    } else if request.method() != hyper::Method::GET {
        return Ok(invalid());
    }
    match callback.validate(&value) {
        Ok(value) => {
            if let Ok(mut target) = result.lock() {
                *target = Some(value);
            }
            Ok(page(
                StatusCode::OK,
                "Authorization response received. Return to Insomnium.",
            ))
        }
        Err(_) => Ok(invalid()),
    }
}

impl Loopback {
    /// Dropping this future closes its listener and aborts all owned connection tasks.
    pub async fn wait(self, callback: Arc<Callback>) -> Result<CallbackResponse, String> {
        let mut connections = JoinSet::new();
        loop {
            tokio::select! {
                accepted = self.listener.accept(), if connections.len() < 16 => {
                    let (socket, _) = accepted.map_err(|_| "Could not accept OAuth callback.")?;
                    let callback = callback.clone();
                    let authority = self.redirect[url::Position::BeforeHost..url::Position::AfterPort].to_string();
                    connections.spawn(async move {
                        let result = Arc::new(Mutex::new(None));
                        let saved = result.clone();
                        let service = service_fn(move |request: Request<hyper::body::Incoming>| {
                            callback_request(request, callback.clone(), authority.clone(), result.clone())
                        });
                        let mut builder = http1::Builder::new();
                        builder.keep_alive(false).max_buf_size(CALLBACK_LIMIT).max_headers(32).timer(TokioTimer::new()).header_read_timeout(Duration::from_secs(5));
                        let _ = tokio::time::timeout(Duration::from_secs(10), builder.serve_connection(TokioIo::new(socket), service)).await;
                        saved.lock().ok().and_then(|mut value| value.take())
                    });
                },
                done = connections.join_next(), if !connections.is_empty() => {
                    if let Some(Ok(Some(result))) = done { return result; }
                }
            }
        }
    }
}

// Use oauth2's URL re-export to keep parsing consistent with its builders.
use oauth2::url;
