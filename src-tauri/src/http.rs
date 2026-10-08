use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::{
    header::{HeaderName, HeaderValue},
    redirect::Policy,
    Client, Method, Url,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::Mutex,
    time::{Duration, Instant},
};
use tokio::sync::watch;

#[derive(Default)]
pub struct NetworkState {
    running: Mutex<HashMap<String, watch::Sender<bool>>>,
}
impl NetworkState {
    pub(crate) fn begin(&self, id: &str) -> Result<watch::Receiver<bool>, String> {
        let (sender, receiver) = watch::channel(false);
        let mut running = self.running.lock().map_err(|e| e.to_string())?;
        if running.contains_key(id) {
            return Err("Request is already running".into());
        }
        running.insert(id.into(), sender);
        Ok(receiver)
    }
    pub(crate) fn finish(&self, id: &str) -> Result<(), String> {
        self.running.lock().map_err(|e| e.to_string())?.remove(id);
        Ok(())
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRequest {
    pub(crate) id: String,
    pub(crate) workspace_id: String,
    pub(crate) method: String,
    pub(crate) url: String,
    #[serde(default)]
    pub(crate) socket_path: Option<String>,
    pub(crate) headers: Vec<(String, String)>,
    #[serde(default)]
    pub(crate) suppress_user_agent: bool,
    pub(crate) body: Option<String>,
    pub(crate) body_base64: Option<String>,
    pub(crate) multipart: Option<Vec<FormPart>>,
    pub(crate) timeout_ms: u64,
    pub(crate) follow_redirects: bool,
    pub(crate) validate_certificates: bool,
    pub(crate) use_cookies: bool,
    pub(crate) cookie_snapshot: Option<crate::cookies::CookieSnapshot>,
    pub(crate) send_cookies: bool,
    pub(crate) store_cookies: bool,
    pub(crate) proxy: Option<String>,
    pub(crate) ca_pem: Option<String>,
    pub(crate) identity_pem: Option<String>,
    #[serde(default)]
    pub(crate) client_certificates: Vec<crate::client_certificates::ClientCertificateSource>,
    pub(crate) digest: Option<crate::digest::DigestCredentials>,
    pub(crate) oauth1: Option<crate::oauth1::OAuth1Credentials>,
    pub(crate) aws: Option<crate::aws::AwsCredentials>,
    pub(crate) hawk: Option<crate::hawk::HawkCredentials>,
    pub(crate) asap: Option<crate::asap::AsapCredentials>,
    pub(crate) ntlm: Option<crate::ntlm::NtlmCredentials>,
    #[serde(default)]
    pub(crate) netrc: bool,
}

impl HttpRequest {
    pub(crate) fn has_identity(&self) -> bool {
        !self.client_certificates.is_empty()
            || self.identity_pem.as_ref().is_some_and(|p| !p.is_empty())
    }

    pub(crate) fn signing(&self) -> crate::digest::Auth<'_> {
        crate::digest::Auth {
            digest: self.digest.as_ref(),
            oauth1: self.oauth1.as_ref(),
            aws: self.aws.as_ref(),
            hawk: self.hawk.as_ref(),
            asap: self.asap.as_ref(),
            ntlm: self.ntlm.as_ref(),
            netrc: self.netrc.then_some(self.url.as_str()),
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormPart {
    pub(crate) name: String,
    pub(crate) value: String,
    pub(crate) file_name: Option<String>,
    #[serde(default)]
    pub(crate) value_base64: bool,
    pub(crate) content_type: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponse {
    status: u16,
    status_text: String,
    url: String,
    headers: Vec<(String, String)>,
    body: String,
    body_base64: String,
    size: usize,
    elapsed_ms: u128,
    headers_ms: u128,
    warnings: Vec<String>,
    network_log: Vec<String>,
}

/// A failed send keeps the partial connection log for the Timeline tab.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpFailure {
    message: String,
    network_log: Vec<String>,
}

impl HttpFailure {
    fn early(message: impl Into<String>) -> Self {
        let message = message.into();
        Self {
            network_log: vec![format!("* Request failed before it was sent: {message}")],
            message,
        }
    }
}

#[tauri::command]
pub fn cancel_http(id: String, state: tauri::State<'_, NetworkState>) -> Result<(), String> {
    if let Some(sender) = state.running.lock().map_err(|e| e.to_string())?.get(&id) {
        let _ = sender.send(true);
    }
    Ok(())
}

#[tauri::command]
pub async fn send_http(
    app: tauri::AppHandle,
    request: HttpRequest,
    state: tauri::State<'_, NetworkState>,
    cookie_state: tauri::State<'_, crate::cookies::CookieState>,
) -> Result<HttpResponse, HttpFailure> {
    let url =
        Url::parse(&request.url).map_err(|e| HttpFailure::early(format!("Invalid URL: {e}")))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err(HttpFailure::early(
            "Only HTTP and HTTPS URLs can be sent as HTTP requests",
        ));
    }
    let mut cancelled = state.begin(&request.id).map_err(HttpFailure::early)?;
    let mut jar = None;
    let requested_url = url.clone();
    let overall = Instant::now();
    let log = std::sync::Arc::new(Mutex::new(crate::network_log::preface(
        &request.method,
        &url,
        &crate::network_log::Settings {
            proxy: request.proxy.as_deref().filter(|p| !p.is_empty()),
            validate_certificates: request.validate_certificates,
            follow_redirects: request.follow_redirects,
            custom_ca: request.ca_pem.as_ref().is_some_and(|p| !p.is_empty()),
            client_certificate: request.has_identity(),
        },
    )));
    let hops = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let result = async {
        if request.use_cookies && (request.send_cookies || request.store_cookies) {
            jar = Some(cookie_state.jar(&app, request.workspace_id.clone()).await?);
        }
        let started = Instant::now();
        let client = build_client(&request, &url, jar.as_ref(), false, false)?;
        let outgoing = build_request(&client, &request, url)?
            .build()
            .map_err(|e| e.to_string())?;
        let mut response = crate::digest::execute(
            outgoing,
            request.signing(),
            request.follow_redirects,
            request.has_identity(),
            |outgoing| {
                let (client, log, hops) = (&client, log.clone(), hops.clone());
                let validate = request.validate_certificates;
                async move {
                    let sent = crate::network_log::Outgoing::capture(&outgoing);
                    let hop_started = Instant::now();
                    let number = hops.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
                    let response = match client.execute(outgoing).await {
                        Ok(response) => response,
                        Err(error) => {
                            if let Ok(mut log) = log.lock() {
                                log.extend(crate::network_log::failed_hop(
                                    number,
                                    sent,
                                    &error,
                                    hop_started.elapsed().as_millis(),
                                ));
                            }
                            return Err(error.to_string());
                        }
                    };
                    if let Ok(mut log) = log.lock() {
                        log.extend(crate::network_log::hop(
                            number,
                            sent,
                            &response,
                            hop_started.elapsed().as_millis(),
                            validate,
                        ));
                    }
                    Ok(response)
                }
            },
        )
        .await?;
        let headers_ms = started.elapsed().as_millis();
        let status = response.status();
        let final_url = response.url().to_string();
        let headers = response
            .headers()
            .iter()
            .map(|(n, v)| {
                (
                    n.to_string(),
                    String::from_utf8_lossy(v.as_bytes()).into_owned(),
                )
            })
            .collect();
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
            if bytes.len() + chunk.len() > 20 * 1024 * 1024 {
                return Err(
                    "Response exceeds the current 20 MiB limit. No partial response was saved."
                        .into(),
                );
            }
            bytes.extend_from_slice(&chunk);
        }
        let elapsed_ms = started.elapsed().as_millis();
        let mut network_log = log.lock().map(|log| log.clone()).unwrap_or_default();
        network_log.extend(crate::network_log::finish(
            &requested_url,
            &final_url,
            bytes.len(),
            elapsed_ms,
            hops.load(std::sync::atomic::Ordering::SeqCst),
        ));
        Ok(HttpResponse {
            status: status.as_u16(),
            status_text: status.canonical_reason().unwrap_or("").into(),
            url: final_url,
            headers,
            body: String::from_utf8_lossy(&bytes).into_owned(),
            body_base64: STANDARD.encode(&bytes),
            size: bytes.len(),
            elapsed_ms,
            headers_ms,
            warnings: Vec::new(),
            network_log,
        })
    };
    let mut response: Result<HttpResponse, String> = tokio::select! {
        result = tokio::time::timeout(Duration::from_millis(request.timeout_ms.clamp(1, 3_600_000)), result) => result.unwrap_or_else(|_| Err("Request timed out".into())),
        _ = cancelled.changed() => Err("Request cancelled".into()),
    };
    if let Some(jar) = jar {
        if let Err(error) = jar.flush().await {
            let warning = format!("Cookies could not be saved: {error}");
            match &mut response {
                Ok(response) => response.warnings.push(warning),
                Err(error) => {
                    error.push_str("; ");
                    error.push_str(&warning);
                }
            }
        }
    }
    state.finish(&request.id).map_err(HttpFailure::early)?;
    response.map_err(|message| {
        let mut network_log = log.lock().map(|log| log.clone()).unwrap_or_default();
        network_log.push(format!(
            "* Request failed after {} ms: {message}",
            overall.elapsed().as_millis()
        ));
        HttpFailure {
            message,
            network_log,
        }
    })
}

#[tauri::command]
pub async fn fetch_oauth_token(
    app: tauri::AppHandle,
    mut request: HttpRequest,
    config: crate::oauth::OAuthConfig,
    state: tauri::State<'_, NetworkState>,
    cookie_state: tauri::State<'_, crate::cookies::CookieState>,
) -> Result<crate::oauth::OAuthToken, String> {
    let url = Url::parse(&request.url).map_err(|_| "Invalid OAuth token URL.")?;
    // Never forward client credentials to a token endpoint redirect.
    request.follow_redirects = false;
    request.digest = None;
    request.oauth1 = None;
    request.aws = None;
    request.hawk = None;
    request.asap = None;
    request.ntlm = None;
    request.netrc = false;
    request.socket_path = None;
    let mut cancelled = state.begin(&request.id)?;
    let mut jar = None;
    let exchange = async {
        if request.use_cookies && (request.send_cookies || request.store_cookies) {
            jar = Some(cookie_state.jar(&app, request.workspace_id.clone()).await?);
        }
        let client = build_client(&request, &url, jar.as_ref(), false, false)
            .map_err(|_| "Invalid OAuth proxy, CA or client certificate settings.")?;
        crate::oauth::exchange(&client, &url, &config).await
    };
    let mut result: Result<crate::oauth::OAuthToken, String> = tokio::select! {
        result = tokio::time::timeout(Duration::from_millis(request.timeout_ms.clamp(1, 3_600_000)), exchange) => result.unwrap_or_else(|_| Err("OAuth token request timed out.".into())),
        _ = cancelled.changed() => Err("OAuth token request cancelled.".into()),
    };
    if let Some(jar) = jar {
        if jar.flush().await.is_err() {
            let warning = "OAuth collection cookies could not be saved.";
            match &mut result {
                Ok(token) => token.warnings.push(warning.into()),
                Err(error) => {
                    error.push(' ');
                    error.push_str(warning);
                }
            }
        }
    }
    state.finish(&request.id)?;
    result
}

pub(crate) fn build_client(
    request: &HttpRequest,
    url: &Url,
    jar: Option<&std::sync::Arc<crate::cookies::PersistentJar>>,
    streaming: bool,
    websocket: bool,
) -> Result<Client, String> {
    // An identity belongs to this origin; a redirect must not offer it to a different server.
    let identity_origin = request.has_identity().then(|| url.origin());
    let manual_authorization = request
        .headers
        .iter()
        .any(|(name, _)| name.eq_ignore_ascii_case("authorization"));
    let mut builder = Client::builder()
        .connect_timeout(Duration::from_millis(
            request.timeout_ms.clamp(1, 3_600_000),
        ))
        .redirect(
            if request.aws.is_some()
                || (!manual_authorization
                    && (request.digest.is_some()
                        || request.oauth1.is_some()
                        || request.hawk.is_some()
                        || request.asap.is_some()
                        || request.ntlm.is_some()
                        || request.netrc))
            {
                // Digest must be recalculated for each effective method/URI.
                Policy::none()
            } else if request.follow_redirects {
                Policy::custom(move |attempt| {
                    if identity_origin
                        .as_ref()
                        .is_some_and(|origin| *origin != attempt.url().origin())
                    {
                        attempt
                            .error("Client certificate redirect to a different origin was blocked")
                    } else {
                        Policy::limited(10).redirect(attempt)
                    }
                })
            } else {
                Policy::none()
            },
        )
        .tls_info(true)
        .danger_accept_invalid_certs(!request.validate_certificates);
    if !request.suppress_user_agent {
        builder = builder.user_agent(concat!("Insomnium/", env!("CARGO_PKG_VERSION")));
    }
    if let Some(jar) = jar {
        builder = builder.cookie_provider(jar.provider(
            request.send_cookies,
            request.store_cookies,
            request.cookie_snapshot.as_ref(),
        )?);
    }
    if let Some(proxy) = request.proxy.as_ref().filter(|p| !p.is_empty()) {
        builder = builder.proxy(reqwest::Proxy::all(proxy).map_err(|e| e.to_string())?);
    }
    if let Some(pem) = request.ca_pem.as_ref().filter(|p| !p.is_empty()) {
        builder = builder.add_root_certificate(
            reqwest::Certificate::from_pem(pem.as_bytes()).map_err(|e| e.to_string())?,
        );
    }
    let identity = if websocket {
        let material = crate::client_certificates::websocket_identity(
            &request.client_certificates,
            request.identity_pem.as_deref(),
        )?;
        for certificate in material.extra_certificates {
            builder = builder.add_root_certificate(
                reqwest::Certificate::from_der(certificate.as_ref()).map_err(|e| e.to_string())?,
            );
        }
        material.identity
    } else {
        crate::client_certificates::load_identity(
            &request.client_certificates,
            request.identity_pem.as_deref(),
        )?
        .map(|pem| reqwest::Identity::from_pem(pem.as_bytes()).map_err(|e| e.to_string()))
        .transpose()?
    };
    if let Some(identity) = identity {
        builder = builder.identity(identity);
    }
    if !streaming {
        builder = builder.timeout(Duration::from_millis(
            request.timeout_ms.clamp(1, 3_600_000),
        ));
    }
    if websocket {
        builder = builder.http1_only();
    }
    let ntlm = request.ntlm.as_ref().filter(|_| !manual_authorization);
    if let Some(ntlm) = ntlm {
        builder = builder
            .http1_only()
            .tls_info(true)
            .pool_max_idle_per_host(1)
            .retry(reqwest::retry::never())
            .connector_layer(ntlm.connection.clone());
    }
    if let Some(path) = request.socket_path.as_deref() {
        if path.is_empty() || path.contains('\0') {
            return Err("Unix socket path must be nonempty and contain no NUL.".into());
        }
        #[cfg(any(unix, windows))]
        {
            builder = builder.unix_socket(path);
        }
        #[cfg(not(any(unix, windows)))]
        {
            return Err("Unix socket transport is not yet available on this platform.".into());
        }
    }
    let client = builder.build().map_err(|e| e.to_string())?;
    if let Some(ntlm) = ntlm {
        ntlm.connection.installed();
    }
    Ok(client)
}

pub(crate) fn build_request(
    client: &Client,
    request: &HttpRequest,
    mut url: Url,
) -> Result<reqwest::RequestBuilder, String> {
    if request.ntlm.is_some() || request.netrc {
        // reqwest otherwise converts URL userinfo into preemptive Basic auth.
        // Selected native credentials (or an explicit header) own authentication.
        url.set_username("")
            .map_err(|_| "Invalid native-auth URL authority")?;
        url.set_password(None)
            .map_err(|_| "Invalid native-auth URL authority")?;
    }
    let method = Method::from_bytes(request.method.as_bytes()).map_err(|e| e.to_string())?;
    let mut outgoing = client.request(method, url);
    for (name, value) in &request.headers {
        let name = HeaderName::from_bytes(name.as_bytes())
            .map_err(|e| format!("Invalid header name: {e}"))?;
        let value =
            HeaderValue::from_str(value).map_err(|e| format!("Invalid header value: {e}"))?;
        outgoing = outgoing.header(name, value);
    }
    if let Some(parts) = &request.multipart {
        let mut form = reqwest::multipart::Form::new();
        for part in parts {
            let mut field = if part.value_base64 || part.file_name.is_some() {
                reqwest::multipart::Part::bytes(
                    STANDARD.decode(&part.value).map_err(|e| e.to_string())?,
                )
            } else {
                reqwest::multipart::Part::text(part.value.clone())
            };
            if let Some(filename) = &part.file_name {
                field = field.file_name(filename.clone());
            }
            if let Some(mime) = &part.content_type {
                field = field.mime_str(mime).map_err(|e| e.to_string())?;
            }
            form = form.part(part.name.clone(), field);
        }
        outgoing = outgoing.multipart(form);
    } else if let Some(encoded) = &request.body_base64 {
        outgoing = outgoing.body(STANDARD.decode(encoded).map_err(|e| e.to_string())?);
    } else if let Some(body) = &request.body {
        outgoing = outgoing.body(body.clone());
    }
    Ok(outgoing)
}
