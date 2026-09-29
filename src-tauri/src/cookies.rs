use cookie_store::{CookieDomain, CookieStore};
use reqwest::{header::HeaderValue, Url};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tauri::Manager;

#[derive(Default)]
pub struct CookieState(Arc<Mutex<HashMap<String, Arc<PersistentJar>>>>);

pub struct PersistentJar {
    path: PathBuf,
    inner: Mutex<JarData>,
}
struct JarData {
    store: CookieStore,
    backed_up: bool,
    generation: u64,
}

impl CookieState {
    pub async fn jar(
        &self,
        app: &tauri::AppHandle,
        workspace_id: String,
    ) -> Result<Arc<PersistentJar>, String> {
        if workspace_id.is_empty()
            || workspace_id.len() > 200
            || !workspace_id
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
        {
            return Err("Invalid collection ID for cookie storage".into());
        }
        let path = app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("cookies")
            .join(format!("{workspace_id}.json"));
        let jars = self.0.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let mut jars = jars.lock().map_err(|e| e.to_string())?;
            if let Some(jar) = jars.get(&workspace_id) {
                return Ok(jar.clone());
            }
            let store = match fs::read(&path) {
                Ok(bytes) => cookie_store::serde::json::load(bytes.as_slice()).map_err(|e| {
                    format!(
                        "Cookie file could not be loaded: {e}. Original retained at {}",
                        path.display()
                    )
                })?,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => CookieStore::default(),
                Err(e) => return Err(e.to_string()),
            };
            let jar = Arc::new(PersistentJar {
                path,
                inner: Mutex::new(JarData {
                    store,
                    backed_up: false,
                    generation: 0,
                }),
            });
            jars.insert(workspace_id, jar.clone());
            Ok(jar)
        })
        .await
        .map_err(|e| e.to_string())?
    }
}

impl PersistentJar {
    fn save(&self, data: &mut JarData, store: &CookieStore) -> Result<(), String> {
        fs::create_dir_all(self.path.parent().ok_or("Invalid cookie directory")?)
            .map_err(|e| e.to_string())?;
        if !data.backed_up {
            match fs::read(&self.path) {
                Ok(bytes) => crate::storage::atomic_write(
                    &self.path.with_extension("previous.json"),
                    &bytes,
                )?,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
                Err(e) => return Err(e.to_string()),
            }
            data.backed_up = true;
        }
        // Preserve session cookies for API-client sessions, discard expired entries.
        let cookies: Vec<_> = store.iter_unexpired().collect();
        crate::storage::atomic_write(
            &self.path,
            &serde_json::to_vec(&cookies).map_err(|e| e.to_string())?,
        )
    }

    pub async fn flush(self: &Arc<Self>) -> Result<(), String> {
        let jar = self.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let mut data = jar.inner.lock().map_err(|e| e.to_string())?;
            let store = data.store.clone();
            jar.save(&mut data, &store)
        })
        .await
        .map_err(|e| e.to_string())?
    }

    pub fn provider(
        self: &Arc<Self>,
        send: bool,
        store: bool,
        snapshot: Option<&CookieSnapshot>,
    ) -> Result<Arc<CookieProvider>, String> {
        let data = self.inner.lock().map_err(|e| e.to_string())?;
        let generation = data.generation;
        let request_store = if let Some(snapshot) = snapshot {
            snapshot.validate_size()?;
            if snapshot.generation != generation {
                return Err("Cookie jar changed while preparing the request. Send again.".into());
            }
            CookieStore::from_cookies(
                snapshot.cookies.iter().map(SnapshotCookie::to_cookie),
                false,
            )?
        } else {
            data.store.clone()
        };
        let request_store = Mutex::new(request_store);
        Ok(Arc::new(CookieProvider {
            jar: self.clone(),
            send,
            store,
            generation,
            request_store,
        }))
    }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotCookie {
    key: String,
    value: String,
    domain: CookieDomain,
    path: cookie_store::CookiePath,
    expires: cookie_store::CookieExpiration,
    secure: bool,
    http_only: bool,
}
impl SnapshotCookie {
    fn from_cookie(cookie: &cookie_store::Cookie<'_>) -> Self {
        Self {
            key: cookie.name().to_owned(),
            value: cookie.value().to_owned(),
            domain: cookie.domain.clone(),
            path: cookie.path.clone(),
            expires: cookie.expires.clone(),
            secure: cookie.secure().unwrap_or(false),
            http_only: cookie.http_only().unwrap_or(false),
        }
    }

    fn to_cookie(&self) -> Result<cookie_store::Cookie<'static>, String> {
        HeaderValue::from_str(&format!("{}={}", self.key, self.value))
            .map_err(|_| "Rendered cookie contains an invalid header value".to_string())?;
        // Build name/value directly: rendered delimiters are never reparsed as attributes.
        let raw = cookie_store::RawCookie::build((self.key.clone(), self.value.clone()))
            .secure(self.secure)
            .http_only(self.http_only)
            .build();
        // This origin only initializes the raw cookie; all scope/expiry comes from the snapshot.
        let origin = Url::parse("https://snapshot.invalid/").map_err(|e| e.to_string())?;
        let mut cookie = cookie_store::Cookie::try_from_raw_cookie(&raw, &origin)
            .map_err(|e| e.to_string())?
            .into_owned();
        cookie.domain = self.domain.clone();
        cookie.path = self.path.clone();
        cookie.expires = self.expires.clone();
        Ok(cookie)
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct CookieSnapshot {
    generation: u64,
    cookies: Vec<SnapshotCookie>,
}
impl CookieSnapshot {
    fn validate_size(&self) -> Result<(), String> {
        if self.cookies.len() > 10000
            || serde_json::to_vec(self).map_err(|e| e.to_string())?.len() > 8 * 1024 * 1024
        {
            return Err("Cookie snapshot exceeds the 10,000 cookie / 8 MiB limit".into());
        }
        Ok(())
    }
}

#[tauri::command]
pub async fn snapshot_request_cookies(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    state: tauri::State<'_, CookieState>,
    workspace_id: String,
) -> Result<CookieSnapshot, String> {
    if window.label() != "main" {
        return Err("Request cookies are only available in the main window".into());
    }
    let jar = state.jar(&app, workspace_id).await?;
    let data = jar.inner.lock().map_err(|e| e.to_string())?;
    let snapshot = CookieSnapshot {
        generation: data.generation,
        cookies: data
            .store
            .iter_unexpired()
            .map(SnapshotCookie::from_cookie)
            .collect(),
    };
    snapshot.validate_size()?;
    Ok(snapshot)
}

pub struct CookieProvider {
    jar: Arc<PersistentJar>,
    send: bool,
    store: bool,
    generation: u64,
    request_store: Mutex<CookieStore>,
}
impl reqwest::cookie::CookieStore for CookieProvider {
    fn set_cookies(&self, cookies: &mut dyn Iterator<Item = &HeaderValue>, url: &Url) {
        if !self.send && !self.store {
            return;
        }
        if let Ok(mut data) = self.jar.inner.lock() {
            if data.generation != self.generation {
                return;
            }
            // Always lock the collection before the per-request store.
            if let Ok(mut request_store) = self.request_store.lock() {
                for value in cookies.filter_map(|h| h.to_str().ok()) {
                    // Redirects learn this response's cookies even when persistence is off.
                    // Merge only response deltas, never the initial snapshot, into the live jar.
                    if self.send {
                        let _ = request_store.parse(value, url);
                    }
                    if self.store {
                        let _ = data.store.parse(value, url);
                    }
                }
            }
        }
    }
    fn cookies(&self, url: &Url) -> Option<HeaderValue> {
        if !self.send {
            return None;
        }
        let data = self.jar.inner.lock().ok()?;
        if data.generation != self.generation {
            return None;
        }
        let request_store = self.request_store.lock().ok()?;
        let value = request_store
            .get_request_values(url)
            .map(|(name, value)| format!("{name}={value}"))
            .collect::<Vec<_>>()
            .join("; ");
        if value.is_empty() {
            None
        } else {
            HeaderValue::from_str(&value).ok()
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CookieView {
    name: String,
    value: String,
    domain: String,
    path: String,
    host_only: bool,
    secure: bool,
    http_only: bool,
    expires: String,
    raw: String,
}
#[derive(Deserialize)]
pub struct CookieKey {
    domain: String,
    path: String,
    name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyCookie {
    url: String,
    raw: String,
    name: String,
    value: String,
    domain: String,
    path: String,
    host_only: bool,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CookieImportReport {
    imported: usize,
    kept: usize,
    replaced: usize,
    expired: usize,
    issues: Vec<CookieImportIssue>,
}
#[derive(Serialize)]
pub struct CookieImportIssue {
    index: usize,
    message: String,
}

fn parse_legacy_cookie(
    entry: &LegacyCookie,
) -> Result<(cookie_store::Cookie<'static>, Url), String> {
    if entry.raw.len() > 8192 {
        return Err("Cookie exceeds the 8 KiB limit".into());
    }
    HeaderValue::from_str(&entry.raw).map_err(|_| "Invalid cookie header".to_string())?;
    let url = Url::parse(&entry.url).map_err(|_| "Invalid cookie origin".to_string())?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str() != Some(entry.domain.as_str()) {
        return Err("Cookie origin and domain differ".into());
    }
    let cookie = cookie_store::Cookie::parse(entry.raw.clone(), &url)
        .map_err(|e| e.to_string())?
        .into_owned();
    let domain = match &cookie.domain {
        CookieDomain::HostOnly(domain) | CookieDomain::Suffix(domain) => domain,
        _ => return Err("Cookie has no domain".into()),
    };
    if cookie.name() != entry.name
        || cookie.value() != entry.value
        || domain != &entry.domain
        || cookie.path.as_ref() != entry.path
        || matches!(cookie.domain, CookieDomain::HostOnly(_)) != entry.host_only
    {
        return Err("Native parser would change the cookie's name, value or scope".into());
    }
    Ok((cookie, url))
}

#[tauri::command]
pub async fn import_legacy_cookies(
    app: tauri::AppHandle,
    state: tauri::State<'_, CookieState>,
    workspace_id: String,
    cookies: Vec<LegacyCookie>,
    overwrite: bool,
    preview: bool,
) -> Result<CookieImportReport, String> {
    if cookies.len() > 10000
        || cookies.iter().map(|cookie| cookie.raw.len()).sum::<usize>() > 8 * 1024 * 1024
    {
        return Err("Cookie import exceeds 10,000 entries or 8 MiB".into());
    }
    let jar = state.jar(&app, workspace_id).await?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut data = jar.inner.lock().map_err(|e| e.to_string())?;
        let mut store = data.store.clone();
        let mut report = CookieImportReport::default();
        for (index, entry) in cookies.iter().enumerate() {
            let (cookie, url) = match parse_legacy_cookie(entry) {
                Ok(parsed) => parsed,
                Err(message) => {
                    report.issues.push(CookieImportIssue { index, message });
                    continue;
                }
            };
            if cookie.is_expired() {
                report.expired += 1;
                continue;
            }
            let exists = store.contains(&entry.domain, &entry.path, &entry.name);
            if exists && !overwrite {
                report.kept += 1;
                continue;
            }
            match store.insert(cookie, &url) {
                Ok(_) => {
                    report.imported += 1;
                    if exists {
                        report.replaced += 1;
                    }
                }
                Err(error) => report.issues.push(CookieImportIssue {
                    index,
                    message: error.to_string(),
                }),
            }
        }
        if !preview && report.imported > 0 {
            // Apply the complete accepted batch in one atomic write, then update the live jar.
            jar.save(&mut data, &store)?;
            data.store = store;
            data.generation = data.generation.wrapping_add(1);
        }
        Ok(report)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn list_cookies(
    app: tauri::AppHandle,
    state: tauri::State<'_, CookieState>,
    workspace_id: String,
) -> Result<Vec<CookieView>, String> {
    let jar = state.jar(&app, workspace_id).await?;
    let data = jar.inner.lock().map_err(|e| e.to_string())?;
    Ok(data
        .store
        .iter_unexpired()
        .map(|c| CookieView {
            name: c.name().into(),
            value: c.value().into(),
            domain: match &c.domain {
                CookieDomain::HostOnly(d) | CookieDomain::Suffix(d) => d.clone(),
                _ => String::new(),
            },
            path: c.path.as_ref().into(),
            host_only: matches!(c.domain, CookieDomain::HostOnly(_)),
            secure: c.secure().unwrap_or(false),
            http_only: c.http_only().unwrap_or(false),
            expires: format!("{:?}", c.expires),
            raw: if c.path().is_some() {
                c.to_string()
            } else {
                format!("{}; Path={}", **c, c.path.as_ref())
            },
        })
        .collect())
}

#[tauri::command]
pub async fn change_cookie(
    app: tauri::AppHandle,
    state: tauri::State<'_, CookieState>,
    workspace_id: String,
    url: Option<String>,
    raw: Option<String>,
    previous: Option<CookieKey>,
    clear: bool,
) -> Result<(), String> {
    let jar = state.jar(&app, workspace_id).await?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut data = jar.inner.lock().map_err(|e| e.to_string())?;
        let mut store = data.store.clone();
        if clear {
            store.clear();
        }
        if let Some(key) = previous {
            store.remove(&key.domain, &key.path, &key.name);
        }
        if let Some(raw) = raw {
            if raw.len() > 8192 {
                return Err("Cookie exceeds the 8 KiB editor limit".into());
            }
            HeaderValue::from_str(&raw).map_err(|e| format!("Invalid cookie: {e}"))?;
            let url =
                Url::parse(&url.ok_or("Cookie URL is required")?).map_err(|e| e.to_string())?;
            if !matches!(url.scheme(), "http" | "https") {
                return Err("Cookie URL must use HTTP or HTTPS".into());
            }
            store
                .parse(&raw, &url)
                .map_err(|e| format!("Invalid cookie: {e}"))?;
        }
        // Commit disk first so a failed edit leaves the live jar unchanged.
        jar.save(&mut data, &store)?;
        data.store = store;
        data.generation = data.generation.wrapping_add(1);
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn read_template_cookie(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    state: tauri::State<'_, CookieState>,
    workspace_id: String,
    url: String,
    name: String,
) -> Result<String, String> {
    if window.label() != "main" {
        return Err("Template cookies are only available in the main window".into());
    }
    if url.len() > 20 * 1024 || name.len() > 8192 {
        return Err("Cookie URL or name exceeds supported length".into());
    }
    let url = Url::parse(&url).map_err(|_| "Invalid cookie URL")?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("Cookie URL must use HTTP or HTTPS".into());
    }
    let jar = state.jar(&app, workspace_id).await?;
    let data = jar.inner.lock().map_err(|e| e.to_string())?;
    let mut matching = data.store.matches(&url);
    if matching.is_empty() {
        return Err("No cookies in store for URL".into());
    }
    // Legacy tough-cookie prefers longer paths. Creation time is not retained
    // by the native store; use domain as a deterministic tie-breaker.
    matching.sort_by(|a, b| {
        let a_path: &str = a.path.as_ref();
        let b_path: &str = b.path.as_ref();
        b_path
            .len()
            .cmp(&a_path.len())
            .then_with(|| a.domain.cmp(&b.domain))
    });
    matching
        .iter()
        .find(|cookie| cookie.name() == name)
        .map(|cookie| cookie.value().to_owned())
        .ok_or_else(|| format!("No cookie with name \"{name}\" for URL"))
}
