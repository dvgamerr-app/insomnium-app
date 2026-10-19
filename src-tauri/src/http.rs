use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::{
    header::{HeaderName, HeaderValue},
    redirect::Policy,
    Client, Method, Url,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Instant,
};
use tokio::sync::{watch, Notify};
#[path = "http_compression.rs"]
pub(crate) mod compression;
#[path = "multipart_encoding.rs"]
mod multipart_encoding;
#[path = "http_timeouts.rs"]
pub(crate) mod timeouts;
#[path = "http_versions.rs"]
pub(crate) mod versions;

#[derive(Default)]
pub struct NetworkState {
    running: Arc<Mutex<NetworkCalls>>,
    settled: Arc<Notify>,
}
#[derive(Default)]
struct NetworkCalls {
    closing: bool,
    exit_waiting: bool,
    calls: HashMap<String, watch::Sender<bool>>,
}
/// Retain blocking native work even if the command awaiting it is dropped.
pub(crate) struct NativeWorkLease {
    id: String,
    running: Arc<Mutex<NetworkCalls>>,
    settled: Arc<Notify>,
    cancellation: watch::Receiver<bool>,
}
impl NativeWorkLease {
    pub(crate) fn cancelled(&self) -> bool {
        *self.cancellation.borrow()
    }
}
impl Drop for NativeWorkLease {
    fn drop(&mut self) {
        self.running
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .calls
            .remove(&self.id);
        self.settled.notify_waiters();
    }
}
impl NetworkState {
    pub(crate) fn retain_native_work(&self, id: String) -> Result<NativeWorkLease, String> {
        let cancellation = self.begin(&id)?;
        Ok(NativeWorkLease {
            id,
            running: self.running.clone(),
            settled: self.settled.clone(),
            cancellation,
        })
    }
    pub(crate) fn begin(&self, id: &str) -> Result<watch::Receiver<bool>, String> {
        let (sender, receiver) = watch::channel(false);
        let mut running = self.running.lock().map_err(|e| e.to_string())?;
        if running.closing {
            return Err("The application window is closed.".into());
        }
        if running.calls.contains_key(id) {
            return Err("Request is already running".into());
        }
        running.calls.insert(id.into(), sender);
        Ok(receiver)
    }
    pub(crate) fn publish_started(
        &self,
        id: &str,
        channel: Option<tauri::ipc::JavaScriptChannelId>,
        webview: tauri::Webview,
    ) -> Result<(), String> {
        if channel.is_some_and(|channel| channel.channel_on::<_, ()>(webview).send(()).is_err()) {
            self.finish(id)?;
            return Err("Request view closed before starting.".into());
        }
        Ok(())
    }
    pub(crate) fn finish(&self, id: &str) -> Result<(), String> {
        self.running
            .lock()
            .map_err(|e| e.to_string())?
            .calls
            .remove(id);
        self.settled.notify_waiters();
        Ok(())
    }
    /// Delay normal application exit while command cleanup still owns registrations.
    pub(crate) fn defer_exit(&self, app: tauri::AppHandle, code: i32) -> bool {
        self.close();
        let mut calls = self.running.lock().unwrap_or_else(|e| e.into_inner());
        if calls.calls.is_empty() {
            return false;
        }
        if calls.exit_waiting {
            return true;
        }
        calls.exit_waiting = true;
        drop(calls);
        let running = self.running.clone();
        let settled = self.settled.clone();
        tauri::async_runtime::spawn(async move {
            loop {
                // Register before checking the predicate; finish may race either.
                let notified = settled.notified();
                if running
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .calls
                    .is_empty()
                {
                    break;
                }
                notified.await;
            }
            app.exit(code);
        });
        true
    }

    pub(crate) fn close(&self) {
        let mut running = self.running.lock().unwrap_or_else(|e| e.into_inner());
        running.closing = true;
        for sender in running.calls.values() {
            sender.send_replace(true);
        }
        // Each command retains its registration until its own cleanup finishes.
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
    #[serde(default)]
    pub(crate) suppress_default_headers: Vec<String>,
    #[serde(default)]
    pub(crate) auto_referer: Option<bool>,
    #[serde(default)]
    pub(crate) decode_response: Option<bool>,
    pub(crate) body: Option<String>,
    pub(crate) body_base64: Option<String>,
    pub(crate) multipart: Option<Vec<FormPart>>,
    #[serde(default)]
    pub(crate) multipart_content_type: Option<String>,
    #[serde(default)]
    pub(crate) http_version: Option<String>,
    pub(crate) timeout_ms: u64,
    #[serde(default)]
    pub(crate) request_timeout_ms: Option<u64>,
    #[serde(default)]
    pub(crate) connect_timeout_ms: Option<u64>,
    pub(crate) follow_redirects: bool,
    #[serde(default)]
    pub(crate) max_redirects: Option<i32>,
    pub(crate) validate_certificates: bool,
    pub(crate) use_cookies: bool,
    pub(crate) cookie_snapshot: Option<crate::cookies::CookieSnapshot>,
    pub(crate) send_cookies: bool,
    pub(crate) store_cookies: bool,
    pub(crate) proxy: Option<String>,
    #[serde(default)]
    pub(crate) proxy_http: Option<String>,
    #[serde(default)]
    pub(crate) proxy_https: Option<String>,
    #[serde(default)]
    pub(crate) proxy_no_proxy: Option<String>,
    #[serde(default)]
    pub(crate) proxy_disabled: bool,
    #[serde(default)]
    pub(crate) proxy_basic_auth: bool,
    #[serde(default)]
    pub(crate) proxy_auth_mode: Option<String>,
    pub(crate) ca_pem: Option<String>,
    pub(crate) ca_file: Option<String>,
    pub(crate) ca_asset: Option<crate::client_certificates::PortableCertificateAsset>,
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

    pub(crate) fn signing<'a>(
        &'a self,
        netrc_load: &'a mut crate::netrc::Load,
    ) -> crate::digest::Auth<'a> {
        crate::digest::Auth {
            digest: self.digest.as_ref(),
            oauth1: self.oauth1.as_ref(),
            aws: self.aws.as_ref(),
            hawk: self.hawk.as_ref(),
            asap: self.asap.as_ref(),
            ntlm: self.ntlm.as_ref(),
            netrc: self.netrc.then_some(self.url.as_str()),
            netrc_load,
            auto_referer: self.auto_referer.unwrap_or(false),
            max_redirects: self.max_redirects,
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
    #[serde(default)]
    pub(crate) headers: Vec<(String, String)>,
    #[serde(default)]
    pub(crate) transfer_encoding: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponse {
    status: u16,
    http_version: String,
    bytes_read: u64,
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
    if let Some(sender) = state
        .running
        .lock()
        .map_err(|e| e.to_string())?
        .calls
        .get(&id)
    {
        let _ = sender.send(true);
    }
    Ok(())
}

#[tauri::command]
pub async fn send_http(
    app: tauri::AppHandle,
    request: HttpRequest,
    on_started: Option<tauri::ipc::JavaScriptChannelId>,
    webview: tauri::Webview,
    state: tauri::State<'_, NetworkState>,
    cookie_state: tauri::State<'_, crate::cookies::CookieState>,
) -> Result<HttpResponse, HttpFailure> {
    timeouts::validate(request.request_timeout_ms, request.connect_timeout_ms)
        .map_err(HttpFailure::early)?;
    let url =
        Url::parse(&request.url).map_err(|e| HttpFailure::early(format!("Invalid URL: {e}")))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err(HttpFailure::early(
            "Only HTTP and HTTPS URLs can be sent as HTTP requests",
        ));
    }
    let mut cancelled = state.begin(&request.id).map_err(HttpFailure::early)?;
    state
        .publish_started(&request.id, on_started, webview)
        .map_err(HttpFailure::early)?;
    let mut jar = None;
    let mut jar_load = crate::cookies::JarLoad::default();
    let mut netrc_load = crate::netrc::Load::default();
    let requested_url = url.clone();
    let overall = Instant::now();
    let log = std::sync::Arc::new(Mutex::new(crate::network_log::preface(
        &request.method,
        &url,
        &crate::network_log::Settings {
            proxy: if request.proxy_disabled {
                None
            } else {
                match url.scheme() {
                    "http" | "ws" => request.proxy_http.as_deref(),
                    "https" | "wss" => request.proxy_https.as_deref(),
                    _ => None,
                }
                .filter(|p| !p.is_empty())
                .or(request.proxy.as_deref().filter(|p| !p.is_empty()))
            },
            validate_certificates: request.validate_certificates,
            follow_redirects: request.follow_redirects,
            custom_ca: request.ca_pem.as_ref().is_some_and(|p| !p.is_empty())
                || request.ca_file.as_ref().is_some_and(|p| !p.is_empty()),
            client_certificate: request.has_identity(),
        },
    )));
    let hops = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let result = async {
        if request.use_cookies && (request.send_cookies || request.store_cookies) {
            jar = Some(
                jar_load
                    .load(&cookie_state, &app, request.workspace_id.clone())
                    .await?,
            );
        }
        let started = Instant::now();
        let client = build_client(&request, &url, jar.as_ref(), false, false)?;
        let outgoing = build_request(&client, &request, url)?
            .build()
            .map_err(|e| e.to_string())?;
        let mut response = crate::digest::execute(
            outgoing,
            request.signing(&mut netrc_load),
            request.follow_redirects,
            request.has_identity(),
            |outgoing| {
                let (client, log, hops) = (&client, log.clone(), hops.clone());
                let validate = request.validate_certificates;
                let decode_response = request.decode_response;
                async move {
                    let sent = crate::network_log::Outgoing::capture(&outgoing);
                    let hop_started = Instant::now();
                    let number = hops.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
                    let mut response = match client.execute(outgoing).await {
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
                            return Err(if error.is_timeout() {
                                "Request timed out".into()
                            } else {
                                error.to_string()
                            });
                        }
                    };
                    let compression_result = compression::response(&mut response, decode_response);
                    if let Ok(mut log) = log.lock() {
                        log.extend(crate::network_log::hop(
                            number,
                            sent,
                            &response,
                            hop_started.elapsed().as_millis(),
                            validate,
                        ));
                    }
                    compression_result?;
                    Ok(response)
                }
            },
        )
        .await?;
        let headers_ms = started.elapsed().as_millis();
        let status = response.status();
        let http_version = crate::network_log::version_label(response.version()).to_string();
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
        while let Some(chunk) = response.chunk().await.map_err(|error| {
            if error.is_timeout() {
                "Request timed out".into()
            } else {
                error.to_string()
            }
        })? {
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
            http_version,
            bytes_read: response
                .downloaded_body_bytes()
                .ok_or_else(|| "Native response download counter missing".to_string())?,
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
        result = timeouts::run(timeouts::selected(request.request_timeout_ms, request.timeout_ms), result, "Request timed out") => result,
        _ = cancelled.changed() => Err("Request cancelled".into()),
    };
    jar_load.drain().await;
    netrc_load.drain().await;
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
    on_started: Option<tauri::ipc::JavaScriptChannelId>,
    webview: tauri::Webview,
    state: tauri::State<'_, NetworkState>,
    cookie_state: tauri::State<'_, crate::cookies::CookieState>,
) -> Result<crate::oauth::OAuthToken, String> {
    timeouts::validate(request.request_timeout_ms, request.connect_timeout_ms)?;
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
    state.publish_started(&request.id, on_started, webview)?;
    let mut jar = None;
    let mut jar_load = crate::cookies::JarLoad::default();
    let exchange = async {
        if request.use_cookies && (request.send_cookies || request.store_cookies) {
            jar = Some(
                jar_load
                    .load(&cookie_state, &app, request.workspace_id.clone())
                    .await?,
            );
        }
        let client = build_client(&request, &url, jar.as_ref(), false, false)
            .map_err(|_| "Invalid OAuth proxy, CA or client certificate settings.")?;
        crate::oauth::exchange(
            &client,
            &url,
            &config,
            versions::selected(request.http_version.as_deref())?,
        )
        .await
    };
    let mut result: Result<crate::oauth::OAuthToken, String> = tokio::select! {
        result = timeouts::run(timeouts::selected(request.request_timeout_ms, request.timeout_ms), exchange, "OAuth token request timed out.") => result,
        _ = cancelled.changed() => Err("OAuth token request cancelled.".into()),
    };
    jar_load.drain().await;
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
    timeouts::validate(request.request_timeout_ms, request.connect_timeout_ms)?;
    // An identity belongs to this origin; a redirect must not offer it to a different server.
    let redirect_policy =
        crate::http_redirects::policy(crate::http_redirects::limit(request.max_redirects)?);
    let identity_origin = request.has_identity().then(|| url.origin());
    let manual_authorization = request
        .headers
        .iter()
        .any(|(name, _)| name.eq_ignore_ascii_case("authorization"));
    let mut builder = Client::builder()
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
                        redirect_policy.redirect(attempt)
                    }
                })
            } else {
                Policy::none()
            },
        )
        .tls_info(true)
        .danger_accept_invalid_certs(!request.validate_certificates);
    builder = builder.referer(request.auto_referer.unwrap_or(true));
    if let Some(timeout) = timeouts::selected(request.connect_timeout_ms, request.timeout_ms) {
        builder = builder.connect_timeout(timeout);
    }
    builder = compression::client(builder, request.decode_response);
    if request
        .suppress_default_headers
        .iter()
        .any(|name| name == "accept")
    {
        builder = builder.remove_default_header(reqwest::header::ACCEPT);
    }
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
    if request.proxy_disabled {
        builder = builder.no_proxy();
    } else {
        builder =
            crate::proxy_auth::configure_system_bypass(builder, request.proxy_no_proxy.as_deref())?;
        for (proxy, scheme) in [
            (request.proxy_http.as_deref(), Some("http")),
            (request.proxy_https.as_deref(), Some("https")),
            (request.proxy.as_deref(), None),
        ] {
            if let Some(proxy) = proxy.filter(|value| !value.is_empty()) {
                builder = builder.proxy(crate::proxy_auth::configure_proxy(
                    proxy,
                    request.proxy_basic_auth,
                    request.proxy_auth_mode.as_deref(),
                    scheme,
                    request.proxy_no_proxy.as_deref(),
                )?);
            }
        }
    }
    let ca = crate::client_certificates::load_ca_certificate(
        request.ca_file.as_deref(),
        request.ca_pem.as_deref(),
        request.ca_asset.as_ref(),
    )?;
    if ca.replace_roots {
        builder = builder.tls_built_in_root_certs(false);
    }
    if let Some(pem) = ca.pem {
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
        if let Some(timeout) = timeouts::selected(request.request_timeout_ms, request.timeout_ms) {
            builder = builder.timeout(timeout);
        }
    }
    builder = versions::configure(
        builder,
        request.http_version.as_deref(),
        websocket,
        request.ntlm.is_some() && !manual_authorization,
    )?;
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
    if let Some(version) = versions::selected(request.http_version.as_deref())? {
        outgoing = outgoing.version(version);
    }
    outgoing = compression::request(
        outgoing,
        request.decode_response,
        request
            .headers
            .iter()
            .any(|(name, _)| name.eq_ignore_ascii_case("accept-encoding")),
    );
    for (name, value) in &request.headers {
        let name = HeaderName::from_bytes(name.as_bytes())
            .map_err(|e| format!("Invalid header name: {e}"))?;
        let value =
            HeaderValue::from_str(value).map_err(|e| format!("Invalid header value: {e}"))?;
        outgoing = outgoing.header(name, value);
    }
    let mut multipart_content_type = None;
    if let Some(parts) = &request.multipart {
        let mut form = reqwest::multipart::Form::new();
        for part in parts {
            if part.headers.len() > 128
                || part
                    .headers
                    .iter()
                    .map(|(name, value)| name.len().saturating_add(value.len()))
                    .sum::<usize>()
                    > 65536
            {
                return Err("Multipart headers exceed 128 rows or 64 KiB.".into());
            }
            let mut part_headers = reqwest::header::HeaderMap::new();
            for (name, value) in &part.headers {
                if [
                    "content-disposition",
                    "content-type",
                    "content-transfer-encoding",
                    "content-length",
                ]
                .contains(&name.to_ascii_lowercase().as_str())
                {
                    return Err("Raw multipart framing header overrides are not supported.".into());
                }
                let name = HeaderName::from_bytes(name.as_bytes())
                    .map_err(|e| format!("Invalid multipart header name: {e}"))?;
                let value = HeaderValue::from_str(value)
                    .map_err(|e| format!("Invalid multipart header value: {e}"))?;
                part_headers.append(name, value);
            }
            let mut field = if let Some(encoding) = &part.transfer_encoding {
                let bytes = if part.value_base64 || part.file_name.is_some() {
                    STANDARD.decode(&part.value).map_err(|e| e.to_string())?
                } else {
                    part.value.as_bytes().to_vec()
                };
                let bytes = multipart_encoding::encode(bytes, encoding)?;
                part_headers.insert(
                    "content-transfer-encoding",
                    HeaderValue::from_str(encoding).map_err(|e| e.to_string())?,
                );
                reqwest::multipart::Part::bytes(bytes)
            } else if part.value_base64 || part.file_name.is_some() {
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
            field = field.headers(part_headers);
            form = form.part(part.name.clone(), field);
        }
        multipart_content_type = request.multipart_content_type.as_ref().map(|value| {
            if value.is_empty() {
                String::new()
            } else {
                format!("{}; boundary={}", value, form.boundary())
            }
        });
        outgoing = outgoing.multipart(form);
    } else if let Some(encoded) = &request.body_base64 {
        outgoing = outgoing.body(STANDARD.decode(encoded).map_err(|e| e.to_string())?);
    } else if let Some(body) = &request.body {
        outgoing = outgoing.body(body.clone());
    }
    if !request.suppress_default_headers.is_empty() || multipart_content_type.is_some() {
        let (client, built) = outgoing.build_split();
        let mut built = built.map_err(|e| e.to_string())?;
        if let Some(value) = multipart_content_type {
            built.headers_mut().insert(
                reqwest::header::CONTENT_TYPE,
                HeaderValue::from_str(&value)
                    .map_err(|e| format!("Invalid multipart Content-Type: {e}"))?,
            );
        }
        for name in &request.suppress_default_headers {
            if !matches!(name.as_str(), "accept" | "content-type") {
                return Err("Unsupported default header suppression.".into());
            }
            if !(name == "content-type" && request.multipart_content_type.is_some())
                && !request
                    .headers
                    .iter()
                    .any(|(header, _)| header.eq_ignore_ascii_case(name))
            {
                built.headers_mut().remove(name);
            }
        }
        outgoing = reqwest::RequestBuilder::from_parts(client, built);
    }
    Ok(outgoing)
}
