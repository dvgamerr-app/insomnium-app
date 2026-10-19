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

pub(crate) type JarTask = tauri::async_runtime::JoinHandle<Result<Arc<PersistentJar>, String>>;

/// Keeps blocking jar initialization owned across cancellation of its awaiter.
#[derive(Default)]
pub(crate) struct JarLoad(Option<JarTask>);
impl JarLoad {
    pub(crate) async fn load(
        &mut self,
        state: &CookieState,
        app: &tauri::AppHandle,
        workspace_id: String,
    ) -> Result<Arc<PersistentJar>, String> {
        let task = self.0.insert(state.start_jar(app, workspace_id)?);
        let result = task.await;
        self.0.take();
        result.map_err(|e| e.to_string())?
    }

    pub(crate) async fn drain(&mut self) {
        if let Some(task) = self.0.take() {
            task.abort();
            let _ = task.await;
        }
    }
}

impl CookieState {
    pub async fn jar(
        &self,
        app: &tauri::AppHandle,
        workspace_id: String,
    ) -> Result<Arc<PersistentJar>, String> {
        self.start_jar(app, workspace_id)?
            .await
            .map_err(|e| e.to_string())?
    }

    fn start_jar(&self, app: &tauri::AppHandle, workspace_id: String) -> Result<JarTask, String> {
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
        Ok(tauri::async_runtime::spawn_blocking(move || {
            let mut jars = jars.lock().map_err(|e| e.to_string())?;
            if let Some(jar) = jars.get(&workspace_id) {
                return Ok(jar.clone());
            }
            let store = match fs::read(&path) {
                // Preserve model entries across restart; request/header views
                // independently filter expired cookies when reading the jar.
                Ok(bytes) => {
                    cookie_store::serde::json::load_all(bytes.as_slice()).map_err(|e| {
                        format!(
                            "Cookie file could not be loaded: {e}. Original retained at {}",
                            path.display()
                        )
                    })?
                }
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
        }))
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
        // Model persistence retains session and expired entries, as legacy
        // getAllCookies does. Request snapshots/providers filter expiry separately.
        let cookies: Vec<_> = store.iter_any().collect();
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
            snapshot.to_store(generation)?
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    same_site: Option<String>,
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
            same_site: cookie
                .same_site()
                .map(|value| value.to_string().to_lowercase()),
        }
    }

    fn to_cookie(&self) -> Result<cookie_store::Cookie<'static>, String> {
        HeaderValue::from_str(&format!("{}={}", self.key, self.value))
            .map_err(|_| "Rendered cookie contains an invalid header value".to_string())?;
        // Build name/value directly: rendered delimiters are never reparsed as attributes.
        let mut raw = cookie_store::RawCookie::build((self.key.clone(), self.value.clone()))
            .secure(self.secure)
            .http_only(self.http_only)
            .build();
        if let Some(value) = self.same_site.as_deref() {
            raw.set_same_site(match value {
                "strict" => cookie::SameSite::Strict,
                "lax" => cookie::SameSite::Lax,
                "none" => cookie::SameSite::None,
                _ => return Err("Invalid rendered cookie SameSite attribute".into()),
            });
        }
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
    fn to_store(&self, generation: u64) -> Result<CookieStore, String> {
        self.validate_size()?;
        if self.generation != generation {
            return Err("Cookie jar changed while preparing the request. Send again.".into());
        }
        CookieStore::from_cookies(self.cookies.iter().map(SnapshotCookie::to_cookie), false)
    }

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
    include_expired: Option<bool>,
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
            .iter_any()
            .filter(|cookie| include_expired.unwrap_or(false) || !cookie.is_expired())
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
// RFC6265 section5.4 prefers longer paths. Native storage lacks creation time;
// domain/name provide deterministic ties until that metadata is migrated.
fn matching_cookies<'a>(
    store: &'a CookieStore,
    url: &Url,
) -> Vec<&'a cookie_store::Cookie<'static>> {
    let mut matching = store.matches(url);
    matching.sort_by(|a, b| {
        let a_path: &str = a.path.as_ref();
        let b_path: &str = b.path.as_ref();
        b_path
            .len()
            .cmp(&a_path.len())
            .then_with(|| a.domain.cmp(&b.domain))
            .then_with(|| a.name().cmp(b.name()))
    });
    matching
}
#[cfg(test)]
mod ordering_tests {
    use super::*;

    #[test]
    fn rendered_snapshot_lookup_preserves_scope_and_live_store() {
        let url = Url::parse("https://example.invalid/api/item").unwrap();
        let mut live = CookieStore::default();
        live.parse("session=root; Path=/", &url).unwrap();
        live.parse("session=deep; Path=/api", &url).unwrap();
        let mut snapshot = CookieSnapshot {
            generation: 7,
            cookies: live.iter_any().map(SnapshotCookie::from_cookie).collect(),
        };
        let mut source = CookieStore::default();
        source
            .parse("session=source; Path=/api; Secure", &url)
            .unwrap();
        snapshot.cookies.push(SnapshotCookie::from_cookie(
            source.iter_any().next().unwrap(),
        ));
        let rendered = snapshot.to_store(7).unwrap();
        assert_eq!(matching_cookies(&rendered, &url)[0].value(), "source");
        let http = Url::parse("http://example.invalid/api/item").unwrap();
        assert_eq!(matching_cookies(&rendered, &http)[0].value(), "root");
        let foreign = Url::parse("https://other.invalid/api/item").unwrap();
        assert!(matching_cookies(&rendered, &foreign).is_empty());
        assert_eq!(matching_cookies(&live, &url)[0].value(), "deep");
        assert!(snapshot.to_store(8).is_err());
    }

    #[test]
    fn cookie_snapshot_preserves_same_site_and_old_packets() {
        let url = Url::parse("https://example.invalid/").unwrap();
        for attribute in [None, Some("Strict"), Some("Lax"), Some("None")] {
            let raw = format!(
                "session=owned; Path=/; Secure{}",
                attribute
                    .map(|value| format!("; SameSite={value}"))
                    .unwrap_or_default()
            );
            let mut store = CookieStore::default();
            store.parse(&raw, &url).unwrap();
            let original = store.iter_any().next().unwrap();
            let snapshot = SnapshotCookie::from_cookie(original);
            let json = serde_json::to_value(&snapshot).unwrap();
            let restored: SnapshotCookie = serde_json::from_value(json.clone()).unwrap();
            assert_eq!(
                restored.to_cookie().unwrap().same_site(),
                original.same_site()
            );
            if attribute.is_none() {
                assert!(json.get("sameSite").is_none());
            }
            let mut invalid = json;
            invalid["sameSite"] = serde_json::json!("unexpected");
            let invalid: SnapshotCookie = serde_json::from_value(invalid).unwrap();
            assert!(invalid.to_cookie().is_err());
        }
    }

    #[test]
    fn cookie_request_values_prefer_longer_paths() {
        let url = Url::parse("https://example.invalid/api/deep/item").unwrap();
        let mut store = CookieStore::default();
        for raw in [
            "id=root; Path=/",
            "id=deep; Path=/api/deep",
            "id=parent; Path=/api",
        ] {
            store.parse(raw, &url).unwrap();
        }
        let matching = matching_cookies(&store, &url);
        assert_eq!(
            matching
                .iter()
                .map(|cookie| cookie.value())
                .collect::<Vec<_>>(),
            vec!["deep", "parent", "root"]
        );
        let outside = Url::parse("https://example.invalid/other").unwrap();
        assert_eq!(matching_cookies(&store, &outside).len(), 1);
    }
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
        let value = matching_cookies(&request_store, url)
            .into_iter()
            .map(|cookie| format!("{}={}", cookie.name(), cookie.value()))
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
    cookie_snapshot: Option<CookieSnapshot>,
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
    let rendered;
    let store = if let Some(snapshot) = cookie_snapshot {
        rendered = snapshot.to_store(data.generation)?;
        &rendered
    } else {
        &data.store
    };
    let matching = matching_cookies(store, &url);
    if matching.is_empty() {
        return Err("No cookies in store for URL".into());
    }
    matching
        .iter()
        .find(|cookie| cookie.name() == name)
        .map(|cookie| cookie.value().to_owned())
        .ok_or_else(|| format!("No cookie with name \"{name}\" for URL"))
}
