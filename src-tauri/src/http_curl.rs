//! The imported -G payload remains bytes until libcurl constructs each request.
use super::*;
use curl::easy::{Auth, Easy, HttpVersion, NetRc};
use futures_util::FutureExt;
use http_body_util::{BodyExt, Limited};
use reqwest::cookie::CookieStore;
use reqwest::ResponseBuilderExt;
use std::{
    cell::RefCell,
    ffi::{CStr, CString},
    time::Duration,
};

// CURLOPT_URL copies the CString before this function returns.
fn raw_url(easy: &Easy, bytes: &[u8]) -> Result<(), String> {
    let value = CString::new(bytes).map_err(|_| "cURL URL contains a NUL byte.")?;
    let code =
        unsafe { curl_sys::curl_easy_setopt(easy.raw(), curl_sys::CURLOPT_URL, value.as_ptr()) };
    if code == curl_sys::CURLE_OK {
        Ok(())
    } else {
        Err(curl::Error::new(code).to_string())
    }
}

// Metadata/cookie scoping may use a URL parser; the wire URL never passes through it.
fn metadata_url(bytes: &[u8]) -> Result<Url, String> {
    let mut value = String::new();
    for &byte in bytes {
        if byte.is_ascii() && !byte.is_ascii_control() {
            value.push(byte as char);
        } else {
            value.push_str(&format!("%{byte:02X}"));
        }
    }
    Url::parse(&value).map_err(|e| format!("Invalid cURL URL: {e}"))
}

// curl::easy::List only accepts &str; request headers may carry obs-text bytes.
// libcurl does not copy the list, so it must outlive the Easy handle.
struct RawHeaders(*mut curl_sys::curl_slist);
impl RawHeaders {
    fn append(&mut self, line: impl Into<Vec<u8>>) -> Result<(), String> {
        let line = CString::new(line).map_err(|_| "Header contains a NUL byte.")?;
        let list = unsafe { curl_sys::curl_slist_append(self.0, line.as_ptr()) };
        if list.is_null() {
            return Err("Header list allocation failed.".into());
        }
        self.0 = list;
        Ok(())
    }
    fn install(&self, easy: &Easy) -> Result<(), String> {
        let code = unsafe {
            curl_sys::curl_easy_setopt(easy.raw(), curl_sys::CURLOPT_HTTPHEADER, self.0)
        };
        if code == curl_sys::CURLE_OK {
            Ok(())
        } else {
            Err(curl::Error::new(code).to_string())
        }
    }
}
impl Drop for RawHeaders {
    fn drop(&mut self) {
        unsafe { curl_sys::curl_slist_free_all(self.0) }
    }
}

fn effective_url(handle: *mut curl_sys::CURL) -> Result<Url, String> {
    let mut value: *mut std::os::raw::c_char = std::ptr::null_mut();
    let code = unsafe {
        curl_sys::curl_easy_getinfo(handle, curl_sys::CURLINFO_EFFECTIVE_URL, &mut value)
    };
    if code != curl_sys::CURLE_OK || value.is_null() {
        return Err("cURL effective URL is unavailable.".into());
    }
    metadata_url(unsafe { CStr::from_ptr(value) }.to_bytes())
}

fn install_identity(easy: &mut Easy, pem: &str) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(windows)]
    {
        use p12_keystore::{Certificate, KeyStore, KeyStoreEntry, PrivateKey, PrivateKeyChain};
        use rustls::pki_types::{pem::PemObject, CertificateDer, PrivateKeyDer};
        // Schannel takes an in-memory PFX rather than PEM certificate/key blobs.
        let normalized = crate::client_certificates::key_material(pem, "")?;
        let key = PrivateKeyDer::from_pem_slice(normalized.as_bytes())?;
        let key = PrivateKey::from_der(key.secret_der())?;
        let certificates = CertificateDer::pem_slice_iter(pem.as_bytes())
            .map(|cert| {
                Certificate::from_der(cert.map_err(|e| e.to_string())?.as_ref())
                    .map_err(|e| e.to_string())
            })
            .collect::<Result<Vec<_>, String>>()?;
        let mut store = KeyStore::new();
        store.add_entry(
            "client",
            KeyStoreEntry::PrivateKeyChain(PrivateKeyChain::new("client", key, certificates)),
        );
        let bytes = store.writer("").write()?;
        easy.ssl_cert_type("P12")?;
        easy.ssl_cert_blob(&bytes)?;
        easy.key_password("")?;
    }
    #[cfg(not(windows))]
    {
        easy.ssl_cert_blob(pem.as_bytes())?;
        easy.ssl_key_blob(pem.as_bytes())?;
    }
    Ok(())
}

fn response_view(captured: &HttpResponse) -> Result<reqwest::Response, String> {
    let url = Url::parse(&captured.url).map_err(|e| e.to_string())?;
    let mut response = tauri::http::Response::builder()
        .status(captured.status)
        .url(url);
    for (name, value) in &captured.headers {
        response = response.header(name, value);
    }
    let body = STANDARD
        .decode(&captured.body_base64)
        .map_err(|e| e.to_string())?;
    Ok(response.body(body).map_err(|e| e.to_string())?.into())
}

async fn decode_response(mut captured: HttpResponse) -> Result<HttpResponse, String> {
    let mut response = response_view(&captured)?;
    compression::response(&mut response, Some(true))?;
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        if bytes.len().saturating_add(chunk.len()) > 20 * 1024 * 1024 {
            return Err(
                "Response exceeds the current 20 MiB limit. No partial response was saved.".into(),
            );
        }
        bytes.extend_from_slice(&chunk);
    }
    captured.size = bytes.len();
    captured.body = String::from_utf8_lossy(&bytes).into_owned();
    captured.body_base64 = STANDARD.encode(&bytes);
    Ok(captured)
}

pub(super) async fn send(
    app: tauri::AppHandle,
    request: HttpRequest,
    on_started: Option<tauri::ipc::JavaScriptChannelId>,
    webview: tauri::Webview,
    state: tauri::State<'_, NetworkState>,
    cookie_state: tauri::State<'_, crate::cookies::CookieState>,
) -> Result<HttpResponse, HttpFailure> {
    let started = Instant::now();
    let timeout = timeouts::selected(request.request_timeout_ms, request.timeout_ms);
    let decode = request.decode_response != Some(false) && request.method != "HEAD";
    timeouts::validate(request.request_timeout_ms, request.connect_timeout_ms)
        .map_err(HttpFailure::early)?;
    let encoded = request.raw_url_base64.as_deref().unwrap_or_default();
    if encoded.len() > 28 * 1024 * 1024 {
        return Err(HttpFailure::early("cURL URL exceeds 20 MiB."));
    }
    let raw = STANDARD
        .decode(encoded)
        .map_err(|e| HttpFailure::early(e.to_string()))?;
    if raw.len() > 20 * 1024 * 1024 {
        return Err(HttpFailure::early("cURL URL exceeds 20 MiB."));
    }
    let lease = Arc::new(
        state
            .retain_native_work(request.id.clone())
            .map_err(HttpFailure::early)?,
    );
    state
        .publish_started(&request.id, on_started, webview)
        .map_err(HttpFailure::early)?;
    let mut loading = crate::cookies::JarLoad::default();
    let mut jar = None;
    let prepared = async {
        if request.use_cookies && (request.send_cookies || request.store_cookies) {
            jar = Some(
                loading
                    .load(&cookie_state, &app, request.workspace_id.clone())
                    .await?,
            );
        }
        let provider = jar
            .as_ref()
            .map(|jar| {
                jar.provider(
                    request.send_cookies,
                    request.store_cookies,
                    request.cookie_snapshot.as_ref(),
                )
            })
            .transpose()?;
        // Reuse the existing header/body encoder, including multipart validation.
        let url = metadata_url(&raw)?;
        let client = Client::new();
        let mut outgoing = build_request(&client, &request, url)?
            .build()
            .map_err(|e| e.to_string())?;
        let body = match outgoing.body_mut().take() {
            Some(body) => Some(
                Limited::new(body, 20 * 1024 * 1024)
                    .collect()
                    .await
                    .map_err(|_| "Request body exceeds 20 MiB or could not be read.")?
                    .to_bytes()
                    .to_vec(),
            ),
            None => None,
        };
        *outgoing.body_mut() = body.clone().map(Into::into);
        Ok::<_, String>((provider, outgoing, body))
    }
    .await;
    loading.drain().await;
    let result = match prepared {
        Ok((provider, outgoing, body)) => {
            let worker_lease = lease.clone();
            if request.oauth1.is_some()
                || request.aws.is_some()
                || request.hawk.is_some()
                || request.asap.is_some()
            {
                signed_send(Arc::new(request), raw, outgoing, provider, worker_lease).await
            } else {
                tauri::async_runtime::spawn_blocking(move || {
                    perform(
                        &request,
                        &raw,
                        outgoing,
                        body,
                        provider,
                        request.follow_redirects,
                        || worker_lease.cancelled(),
                    )
                })
                .await
                .map_err(|e| e.to_string())
                .and_then(|result| result)
            }
        }
        Err(error) => Err(error),
    };
    let result = match result {
        Ok(response) if decode && !matches!(response.status, 204 | 304) => {
            let mut cancellation = lease.cancellation();
            if lease.cancelled() {
                Err("Request cancelled".into())
            } else {
                tokio::select! {
                    result = timeouts::run(timeout.map(|t| t.saturating_sub(started.elapsed())), decode_response(response), "Request timed out") => result,
                    _ = cancellation.changed() => Err("Request cancelled".into()),
                }
            }
        }
        result => result,
    };
    let mut result = result.map_err(|message| HttpFailure {
        network_log: vec![format!(
            "* cURL transfer failed after {} ms: {message}",
            started.elapsed().as_millis()
        )],
        message,
    });
    if let Some(jar) = jar {
        if let Err(error) = jar.flush().await {
            let warning = format!("Cookies could not be saved: {error}");
            match &mut result {
                Ok(response) => response.warnings.push(warning),
                Err(error) => error.message.push_str(&format!("; {warning}")),
            }
        }
    }
    result
}

struct SignedReply {
    response: reqwest::Response,
    captured: HttpResponse,
}
impl crate::digest::HttpReply for SignedReply {
    fn response(&self) -> &reqwest::Response {
        &self.response
    }
    fn into_response(self) -> reqwest::Response {
        self.response
    }
}

// Application signers must sign each redirected URL again; their existing
// orchestration still uses libcurl for every hop and keeps the first target raw.
async fn signed_send(
    request: Arc<HttpRequest>,
    raw: Vec<u8>,
    outgoing: reqwest::Request,
    provider: Option<Arc<crate::cookies::CookieProvider>>,
    lease: Arc<NativeWorkLease>,
) -> Result<HttpResponse, String> {
    let original = outgoing.url().clone();
    let calls = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let spliced = Arc::new(std::sync::Mutex::new(None::<(Url, Vec<u8>)>));
    let mut netrc = crate::netrc::Load::default();
    let result = crate::digest::execute(
        outgoing,
        request.signing(&mut netrc),
        request.follow_redirects,
        request.has_identity(),
        |attempt| {
            let request = request.clone();
            let provider = provider.clone();
            let lease = lease.clone();
            let calls = calls.clone();
            let spliced = spliced.clone();
            let mut wire = raw.clone();
            // Only the first target is raw; later hops are redirect targets.
            let first = calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst) == 0;
            let cached = spliced.lock().unwrap().clone();
            if let Some((_, bytes)) = cached.filter(|(url, _)| url == attempt.url()) {
                // Challenge retry of the same signed first target keeps its raw bytes.
                wire = bytes;
            } else if attempt.url() != &original {
                if first
                    && attempt.url().origin() == original.origin()
                    && attempt.url().path() == original.path()
                {
                    // Query signers append their fields to the canonical metadata URL.
                    let old = original.query().unwrap_or("");
                    if let Some(extra) = attempt.url().query().unwrap_or("").strip_prefix(old) {
                        let hash = wire.iter().position(|b| *b == b'#').unwrap_or(wire.len());
                        let mut extra = extra.as_bytes().to_vec();
                        // Add '?' only when the raw URL has no query delimiter yet.
                        if old.is_empty() && !extra.is_empty() && !wire[..hash].contains(&b'?') {
                            extra.insert(0, b'?');
                        }
                        wire.splice(hash..hash, extra);
                        *spliced.lock().unwrap() = Some((attempt.url().clone(), wire.clone()));
                    } else {
                        return std::future::ready(Err(
                            "URL signer replaced the raw cURL query.".into()
                        ))
                        .boxed();
                    }
                } else {
                    wire = attempt.url().as_str().as_bytes().to_vec();
                }
            }
            async move {
                tauri::async_runtime::spawn_blocking(move || {
                    let body = attempt
                        .body()
                        .and_then(|b| b.as_bytes())
                        .map(|b| b.to_vec());
                    let captured =
                        perform(&request, &wire, attempt, body, provider, false, || {
                            lease.cancelled()
                        })?;
                    let response = response_view(&captured)?;
                    Ok(SignedReply { response, captured })
                })
                .await
                .map_err(|e| e.to_string())?
            }
            .boxed()
        },
    )
    .await
    .map(|reply| reply.captured);
    netrc.drain().await;
    result
}

fn perform(
    request: &HttpRequest,
    raw: &[u8],
    outgoing: reqwest::Request,
    body: Option<Vec<u8>>,
    provider: Option<Arc<crate::cookies::CookieProvider>>,
    follow_redirects: bool,
    cancelled: impl Fn() -> bool,
) -> Result<HttpResponse, String> {
    let run = || -> Result<HttpResponse, Box<dyn std::error::Error>> {
        if cancelled() {
            return Err("Request cancelled".into());
        }
        let mut raw_headers = RawHeaders(std::ptr::null_mut());
        let mut easy = Easy::new();
        raw_url(&easy, raw)?;
        // HTTP(S) only, including redirects; never use CURLOPT_REQUEST_TARGET.
        for option in [
            curl_sys::CURLOPT_PROTOCOLS,
            curl_sys::CURLOPT_REDIR_PROTOCOLS,
        ] {
            let code = unsafe {
                curl_sys::curl_easy_setopt(
                    easy.raw(),
                    option,
                    (curl_sys::CURLPROTO_HTTP | curl_sys::CURLPROTO_HTTPS) as std::os::raw::c_long,
                )
            };
            if code != curl_sys::CURLE_OK {
                return Err(curl::Error::new(code).into());
            }
        }
        easy.signal(false)?;
        easy.follow_location(follow_redirects)?;
        easy.unrestricted_auth(false)?;
        let limit = request.max_redirects.unwrap_or(10);
        crate::http_redirects::limit(Some(limit))?;
        let code = unsafe {
            curl_sys::curl_easy_setopt(
                easy.raw(),
                curl_sys::CURLOPT_MAXREDIRS,
                limit as std::os::raw::c_long,
            )
        };
        if code != curl_sys::CURLE_OK {
            return Err(curl::Error::new(code).into());
        }
        if let Some(timeout) = timeouts::selected(request.request_timeout_ms, request.timeout_ms) {
            easy.timeout(timeout)?;
        }
        easy.connect_timeout(Duration::from_millis(
            request
                .connect_timeout_ms
                .filter(|n| *n != 0)
                .unwrap_or(300_000),
        ))?;
        easy.ssl_verify_peer(request.validate_certificates)?;
        easy.ssl_verify_host(request.validate_certificates)?;
        easy.proxy_ssl_verify_peer(request.validate_certificates)?;
        easy.proxy_ssl_verify_host(request.validate_certificates)?;
        let ca = crate::client_certificates::load_ca_certificate(
            request.ca_file.as_deref(),
            request.ca_pem.as_deref(),
            request.ca_asset.as_ref(),
        )?;
        if let Some(pem) = ca.pem {
            easy.ssl_cainfo_blob(pem.as_bytes())?;
        }
        let identity = crate::client_certificates::load_identity(
            &request.client_certificates,
            request.identity_pem.as_deref(),
        )?;
        if let Some(pem) = &identity {
            install_identity(&mut easy, pem)?;
        }
        let original = metadata_url(raw)?;
        let proxy = (if original.scheme() == "https" {
            request.proxy_https.as_deref()
        } else {
            request.proxy_http.as_deref()
        })
        .filter(|p| !p.is_empty())
        .or(request.proxy.as_deref());
        let explicit_proxy_user = proxy
            .and_then(|proxy| {
                Url::parse(&if proxy.contains("://") {
                    proxy.to_owned()
                } else {
                    format!("http://{proxy}")
                })
                .ok()
            })
            .is_some_and(|url| !url.username().is_empty());
        if request.proxy_disabled {
            easy.proxy("")?;
        } else if let Some(proxy) = proxy {
            easy.proxy(proxy)?;
            easy.noproxy(request.proxy_no_proxy.as_deref().unwrap_or(""))?;
        } else if let Some(bypass) = &request.proxy_no_proxy {
            easy.noproxy(bypass)?;
        }
        // Known gap: with no explicit proxy libcurl honours only environment proxies,
        // while the reqwest path also reads the OS proxy. reqwest keeps that matcher
        // private, so it cannot be reused here without duplicating platform lookups.
        let mut proxy_auth = Auth::new();
        match request
            .proxy_auth_mode
            .as_deref()
            .unwrap_or(if request.proxy_basic_auth {
                "basic"
            } else {
                "auto"
            }) {
            "auto" => {
                proxy_auth
                    .basic(true)
                    .digest(true)
                    .ntlm(explicit_proxy_user);
            }
            "basic" => {
                proxy_auth.basic(true);
            }
            "digest" => {
                proxy_auth.digest(true);
            }
            "ntlm" => {
                if !explicit_proxy_user {
                    return Err("Proxy NTLM requires an explicit username; automatic OS sign-in is not used.".into());
                }
                proxy_auth.ntlm(true);
            }
            _ => return Err("Invalid proxy authentication mode.".into()),
        }
        easy.proxy_auth(&proxy_auth)?;
        if let Some(path) = &request.socket_path {
            easy.unix_socket(path)?;
        }
        easy.http_version(match request.http_version.as_deref() {
            None => HttpVersion::Any,
            Some("1.0") => HttpVersion::V10,
            Some("1.1") => HttpVersion::V11,
            Some("2-prior-knowledge") => HttpVersion::V2PriorKnowledge,
            _ => return Err("Unsupported HTTP version selection".into()),
        })?;
        let upload = if request.curl_upload {
            Some(
                body.as_deref()
                    .ok_or("Select the upload file before sending.")?,
            )
        } else {
            None
        };
        if let Some(bytes) = upload {
            easy.upload(true)?;
            easy.in_filesize(bytes.len() as u64)?;
        } else if let Some(body) = &body {
            easy.post_fields_copy(body)?;
        }
        match (request.method.as_str(), upload.is_some()) {
            ("PUT", true) => {}
            (method, true) => easy.custom_request(method)?,
            ("GET", false) if body.is_none() => easy.get(true)?,
            ("HEAD", false) => easy.nobody(true)?,
            ("POST", false) if body.is_some() => easy.post(true)?,
            ("POST", false) => {
                // Real POST with Content-Length: 0; keep -X POST across redirects.
                easy.post(true)?;
                easy.post_field_size(0)?;
                easy.custom_request("POST")?;
            }
            (method, false) => easy.custom_request(method)?,
        }
        if !request.suppress_user_agent && !outgoing.headers().contains_key("user-agent") {
            easy.useragent("Insomnium/0.1.0")?;
        }
        // Reuse the app's bounded gzip/deflate/Brotli decoder after transfer.
        easy.http_content_decoding(false)?;
        if request.decode_response.is_none()
            && !outgoing.headers().contains_key("accept-encoding")
            && !outgoing.headers().contains_key("range")
        {
            raw_headers.append("Accept-Encoding: gzip, deflate, br")?;
        }
        for (name, value) in outgoing.headers() {
            // Header values may hold obs-text bytes; reject only CR/LF/NUL.
            let value = value.as_bytes();
            if value.iter().any(|b| matches!(b, b'\r' | b'\n' | 0)) {
                return Err("Header value contains a forbidden control byte.".into());
            }
            let mut line = name.as_str().as_bytes().to_vec();
            if value.is_empty() {
                line.push(b';');
            } else {
                line.extend_from_slice(b": ");
                line.extend_from_slice(value);
            }
            raw_headers.append(line)?;
        }
        for name in &request.suppress_default_headers {
            if !matches!(name.as_str(), "accept" | "content-type") {
                return Err("Unsupported default header suppression.".into());
            }
            if !outgoing.headers().contains_key(name) {
                raw_headers.append(format!("{name}:"))?;
            }
        }
        if request.method == "POST"
            && upload.is_none()
            && body.is_none()
            && !outgoing.headers().contains_key("content-type")
        {
            // CURLOPT_POST adds a form Content-Type the empty-body reqwest path never sends.
            raw_headers.append("Content-Type:")?;
        }
        raw_headers.append("Expect:")?;
        raw_headers.install(&easy)?;
        if let Some(auto_referer) = request.auto_referer {
            let code = unsafe {
                curl_sys::curl_easy_setopt(
                    easy.raw(),
                    curl_sys::CURLOPT_AUTOREFERER,
                    auto_referer as std::os::raw::c_long,
                )
            };
            if code != curl_sys::CURLE_OK {
                return Err(curl::Error::new(code).into());
            }
        }
        let manual_auth = outgoing.headers().contains_key("authorization");
        if !manual_auth {
            if let Some(credentials) = &request.digest {
                easy.username(&credentials.username)?;
                easy.password(&credentials.password)?;
                easy.http_auth(Auth::new().digest(true))?;
            } else if let Some(credentials) = &request.ntlm {
                if credentials.username.is_empty() {
                    return Err(
                        "NTLM requires an explicit username; automatic OS sign-in is not used."
                            .into(),
                    );
                }
                let username = if credentials.domain.is_empty() {
                    credentials.username.clone()
                } else {
                    format!("{}\\{}", credentials.domain, credentials.username)
                };
                easy.username(&username)?;
                easy.password(&credentials.password)?;
                easy.http_auth(Auth::new().ntlm(true))?;
            } else if request.netrc {
                easy.netrc(NetRc::Required)?;
            }
        }
        if let Some(provider) = &provider {
            if request.send_cookies {
                easy.cookie_file("")?;
                for cookie in provider.curl_seed()? {
                    easy.cookie_list(&cookie)?;
                }
            }
        }
        easy.progress(true)?;
        let handle = easy.raw();
        let started = Instant::now();
        let bytes = RefCell::new(Vec::new());
        let response_headers = RefCell::new(Vec::new());
        let failure = RefCell::new(None::<String>);
        let mut header_bytes = 0usize;
        let mut headers_ms = 0;
        let mut version = String::new();
        let mut reason = String::new();
        let mut status = 0;
        let mut log = Vec::new();
        let upload_position = std::cell::Cell::new(0usize);
        {
            let mut transfer = easy.transfer();
            if let Some(bytes) = upload {
                transfer.read_function(|buffer| {
                    let position = upload_position.get();
                    let length = buffer.len().min(bytes.len() - position);
                    buffer[..length].copy_from_slice(&bytes[position..position + length]);
                    upload_position.set(position + length);
                    Ok(length)
                })?;
                transfer.seek_function(|seek| {
                    let position = match seek {
                        std::io::SeekFrom::Start(offset) => i128::from(offset),
                        std::io::SeekFrom::End(offset) => bytes.len() as i128 + i128::from(offset),
                        std::io::SeekFrom::Current(offset) => {
                            upload_position.get() as i128 + i128::from(offset)
                        }
                    };
                    if position < 0 || position > bytes.len() as i128 {
                        return curl::easy::SeekResult::Fail;
                    }
                    upload_position.set(position as usize);
                    curl::easy::SeekResult::Ok
                })?;
            }
            transfer.progress_function(|_, _, _, _| {
                if let Some(error) = provider.as_ref().and_then(|p| p.curl_current().err()) {
                    *failure.borrow_mut() = Some(error);
                    return false;
                }
                !cancelled()
            })?;
            transfer.write_function(|chunk| {
                let mut bytes = bytes.borrow_mut();
                if bytes.len().saturating_add(chunk.len()) > 20 * 1024 * 1024 {
                    *failure.borrow_mut() = Some(
                        "Response exceeds the current 20 MiB limit. No partial response was saved."
                            .into(),
                    );
                    return Ok(0);
                }
                bytes.extend_from_slice(chunk);
                Ok(chunk.len())
            })?;
            transfer.header_function(|line| {
                header_bytes = header_bytes.saturating_add(line.len());
                if header_bytes > 256 * 1024 {
                    *failure.borrow_mut() = Some("Response headers exceed 256 KiB.".into());
                    return false;
                }
                let raw_line = line;
                let line = String::from_utf8_lossy(line);
                if line.starts_with("HTTP/") {
                    response_headers.borrow_mut().clear();
                    bytes.borrow_mut().clear();
                    let mut parts = line.trim_end().splitn(3, ' ');
                    version = parts.next().unwrap_or("").to_owned();
                    status = parts
                        .next()
                        .and_then(|s| s.parse::<u16>().ok())
                        .unwrap_or(0);
                    reason = parts.next().unwrap_or("").to_owned();
                    log.push(format!("< {}", line.trim_end()));
                } else if line.trim().is_empty() {
                    headers_ms = started.elapsed().as_millis();
                } else if let Some((name, value)) = line.trim_end().split_once(':') {
                    let value = value.trim_start();
                    if name.eq_ignore_ascii_case("set-cookie") {
                        // Parse the raw bytes so non-ASCII cookies are not lossy-decoded away.
                        let raw_value = raw_line
                            .iter()
                            .position(|b| *b == b':')
                            .map(|i| raw_line[i + 1..].trim_ascii())
                            .unwrap_or_default();
                        if let (Some(provider), Ok(url), Ok(value)) = (
                            &provider,
                            effective_url(handle),
                            HeaderValue::from_bytes(raw_value),
                        ) {
                            provider.set_cookies(&mut std::iter::once(&value), &url);
                        }
                    }
                    if identity.is_some()
                        && follow_redirects
                        && matches!(status, 301 | 302 | 303 | 307 | 308)
                        && name.eq_ignore_ascii_case("location")
                    {
                        let cross_origin = effective_url(handle)
                            .and_then(|url| url.join(value).map_err(|e| e.to_string()))
                            .map(|url| url.origin() != original.origin())
                            .unwrap_or(true);
                        if cross_origin {
                            *failure.borrow_mut() = Some(
                                "Redirect to another origin cannot use this client certificate."
                                    .into(),
                            );
                            return false;
                        }
                    }
                    response_headers
                        .borrow_mut()
                        .push((name.to_lowercase(), value.to_owned()));
                }
                !cancelled()
            })?;
            if let Err(error) = transfer.perform() {
                if cancelled() {
                    return Err("Request cancelled".into());
                }
                if let Some(error) = failure.borrow_mut().take() {
                    return Err(error.into());
                }
                if error.is_operation_timedout() {
                    return Err("Request timed out".into());
                }
                return Err(error.into());
            }
        }
        let status = easy.response_code()? as u16;
        let url = effective_url(handle)?.to_string();
        let bytes = bytes.into_inner();
        Ok(HttpResponse {
            status,
            http_version: version,
            status_text: reason,
            url,
            headers: response_headers.into_inner(),
            body: String::from_utf8_lossy(&bytes).into_owned(),
            body_base64: STANDARD.encode(&bytes),
            size: bytes.len(),
            bytes_read: easy.download_size()? as u64,
            elapsed_ms: started.elapsed().as_millis(),
            headers_ms,
            warnings: Vec::new(),
            network_log: log,
        })
    };
    run().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{Read, Write},
        net::TcpListener,
        thread,
    };

    fn request(url: &str, method: &str) -> HttpRequest {
        serde_json::from_value(serde_json::json!({
            "id":"raw-test", "workspaceId":"owned", "url":url, "method":method,
            "headers":[], "timeoutMs":3000, "followRedirects":true,
            "validateCertificates":true, "useCookies":false, "sendCookies":false,
            "storeCookies":false, "proxyDisabled":true,
        }))
        .unwrap()
    }
    fn server(
        replies: impl FnOnce(&str) -> Vec<String>,
    ) -> (String, thread::JoinHandle<Vec<Vec<u8>>>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let replies = replies(&base);
        let worker = thread::spawn(move || {
            let mut requests = Vec::new();
            for reply in replies {
                let deadline = Instant::now() + Duration::from_secs(4);
                let mut socket = loop {
                    match listener.accept() {
                        Ok((socket, _)) => break socket,
                        Err(e)
                            if e.kind() == std::io::ErrorKind::WouldBlock
                                && Instant::now() < deadline =>
                        {
                            thread::sleep(Duration::from_millis(2))
                        }
                        Err(e) => panic!("fixture accept: {e}"),
                    }
                };
                socket.set_nonblocking(false).unwrap();
                socket
                    .set_read_timeout(Some(Duration::from_secs(3)))
                    .unwrap();
                let mut bytes = Vec::new();
                loop {
                    let mut byte = [0u8];
                    socket.read_exact(&mut byte).unwrap();
                    bytes.push(byte[0]);
                    if bytes.ends_with(b"\r\n\r\n") {
                        break;
                    }
                    assert!(bytes.len() < 128 * 1024);
                }
                let head = String::from_utf8_lossy(&bytes);
                let length = head
                    .lines()
                    .find_map(|line| {
                        line.to_ascii_lowercase()
                            .strip_prefix("content-length: ")
                            .and_then(|v| v.parse::<usize>().ok())
                    })
                    .unwrap_or(0);
                let offset = bytes.len();
                bytes.resize(offset + length, 0);
                socket.read_exact(&mut bytes[offset..]).unwrap();
                requests.push(bytes);
                socket.write_all(reply.as_bytes()).unwrap();
            }
            requests
        });
        (base, worker)
    }
    const OK: &str = "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok";

    fn send(
        request: &HttpRequest,
        raw: &[u8],
        body: Option<Vec<u8>>,
    ) -> Result<HttpResponse, String> {
        let outgoing = build_request(&Client::new(), request, metadata_url(raw)?)?
            .build()
            .map_err(|e| e.to_string())?;
        perform(
            request,
            raw,
            outgoing,
            body,
            None,
            request.follow_redirects,
            || false,
        )
    }

    #[test]
    fn curl_keeps_utf8_binary_percent_escapes_and_fragment_semantics() {
        for (query, target) in [
            ("name=ไทย".as_bytes(), "/wire?name=ไทย".as_bytes()),
            (&b"q=\xff\x80"[..], &b"/wire?q=\xff\x80"[..]),
            (&b"q=%2F%252F"[..], &b"/wire?q=%2F%252F"[..]),
            (&b"q=a#fragment"[..], &b"/wire?q=a"[..]),
        ] {
            let (base, worker) = server(|_| vec![OK.into()]);
            let mut raw = format!("{base}/wire?").into_bytes();
            raw.extend_from_slice(query);
            let response = send(&request(&base, "GET"), &raw, None).unwrap();
            assert_eq!(response.body, "ok");
            let requests = worker.join().unwrap();
            let mut expected = b"GET ".to_vec();
            expected.extend_from_slice(target);
            expected.extend_from_slice(b" HTTP/1.1\r\n");
            assert!(requests[0].starts_with(&expected), "wire={:?}", requests[0]);
        }
    }

    #[test]
    fn curl_owns_redirect_targets_methods_and_cross_origin_authentication() {
        for status in [301, 302, 307, 308] {
            let (base, worker) = server(|base| {
                vec![format!("HTTP/1.1 {status} Redirect\r\nLocation: {base}/next?new=1\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"), OK.into()]
            });
            let raw = format!("{base}/first?q=raw").into_bytes();
            send(&request(&base, "POST"), &raw, Some(b"payload".to_vec())).unwrap();
            let wire = worker.join().unwrap();
            let method = if status < 307 { "GET" } else { "POST" };
            assert!(wire[1].starts_with(format!("{method} /next?new=1 HTTP/1.1\r\n").as_bytes()));
            if status >= 307 {
                assert!(wire[1].ends_with(b"payload"));
            }
        }
        let (base, worker) = server(|base| {
            vec![format!("HTTP/1.1 302 Redirect\r\nLocation: {base}/explicit-post\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"), OK.into()]
        });
        send(
            &request(&base, "POST"),
            format!("{base}/wire?q=raw").as_bytes(),
            None,
        )
        .unwrap();
        let wire = worker.join().unwrap();
        assert!(
            wire[1].starts_with(b"POST /explicit-post HTTP/1.1\r\n"),
            "-G -X POST keeps the explicit method"
        );
        assert!(!String::from_utf8_lossy(&wire[0])
            .to_lowercase()
            .contains("content-type:"));
        let (second, second_worker) = server(|_| vec![OK.into()]);
        let (first, first_worker) = server(|_| {
            vec![format!("HTTP/1.1 302 Redirect\r\nLocation: {second}/final\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")]
        });
        let mut config = request(&first, "GET");
        config
            .headers
            .push(("Authorization".into(), "Basic c2VjcmV0".into()));
        send(&config, format!("{first}/wire?q=raw").as_bytes(), None).unwrap();
        assert!(String::from_utf8_lossy(&first_worker.join().unwrap()[0])
            .to_lowercase()
            .contains("authorization: basic c2vjcmv0"));
        assert!(!String::from_utf8_lossy(&second_worker.join().unwrap()[0])
            .to_lowercase()
            .contains("authorization:"));
    }

    #[test]
    fn curl_builds_proxy_absolute_form_without_changing_bytes() {
        let (proxy, worker) = server(|_| vec![OK.into()]);
        let mut config = request("http://owned.invalid/wire", "GET");
        config.proxy_disabled = false;
        config.proxy = Some(proxy);
        send(&config, b"http://owned.invalid/wire?q=\xff\x80", None).unwrap();
        assert!(worker.join().unwrap()[0]
            .starts_with(b"GET http://owned.invalid/wire?q=\xff\x80 HTTP/1.1\r\n"));
    }

    #[test]
    fn ntlm_never_falls_back_to_os_credentials() {
        let mut config = request("http://127.0.0.1:1/wire", "GET");
        config.ntlm = Some(crate::ntlm::NtlmCredentials::default());
        assert!(send(&config, config.url.as_bytes(), None)
            .err()
            .unwrap()
            .contains("explicit username"));
        config.ntlm = None;
        config.proxy = Some("http://127.0.0.1:1".into());
        config.proxy_disabled = false;
        config.proxy_auth_mode = Some("ntlm".into());
        assert!(send(&config, config.url.as_bytes(), None)
            .err()
            .unwrap()
            .contains("explicit username"));
        let (proxy, worker) = server(|_| {
            vec!["HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: NTLM\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".into()]
        });
        config.proxy = Some(proxy);
        config.proxy_auth_mode = Some("auto".into());
        assert_eq!(
            send(&config, b"http://owned.invalid/wire?q=raw", None)
                .unwrap()
                .status,
            407
        );
        assert!(!String::from_utf8_lossy(&worker.join().unwrap()[0])
            .to_lowercase()
            .contains("proxy-authorization:"));
    }

    #[test]
    fn empty_post_sends_content_length_zero_and_non_ascii_header_bytes() {
        let (base, worker) = server(|_| vec![OK.into()]);
        let mut config = request(&base, "POST");
        config.headers.push(("X-Name".into(), "ไทย".into()));
        send(&config, format!("{base}/p").as_bytes(), None).unwrap();
        let wire = worker.join().unwrap().remove(0);
        let text = String::from_utf8_lossy(&wire).to_lowercase();
        assert!(text.starts_with("post /p http/1.1"));
        assert!(text.contains("content-length: 0"));
        assert!(!text.contains("content-type:"));
        assert!(wire
            .windows("x-name: ไทย".len())
            .any(|w| w == "x-name: ไทย".as_bytes()));
    }

    #[test]
    fn upload_rewinds_on_redirect_without_a_form_content_type() {
        let (base, worker) = server(|base| {
            vec![format!("HTTP/1.1 302 Redirect\r\nLocation: {base}/next\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"), OK.into()]
        });
        let mut config = request(&base, "PUT");
        config.curl_upload = true;
        let payload = b"binary\0\xff\x80".to_vec();
        send(
            &config,
            format!("{base}/upload?q=raw").as_bytes(),
            Some(payload.clone()),
        )
        .unwrap();
        let requests = worker.join().unwrap();
        for request in requests {
            assert!(request.starts_with(b"PUT "));
            assert!(request.ends_with(&payload));
            assert!(!String::from_utf8_lossy(&request)
                .to_lowercase()
                .contains("content-type:"));
        }
    }
}
