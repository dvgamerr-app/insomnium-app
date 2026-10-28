//! Read-only legacy response assets confined to the user's existing dialog scope.
//! No scope grants, writes, decompression fallback, or partial body publication.
use base64::{engine::general_purpose::STANDARD, Engine};
use flate2::read::MultiGzDecoder;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs::{self, File, Metadata, OpenOptions},
    io::Read,
    path::{Component, Path, PathBuf},
};
use tauri::Manager;
use tauri_plugin_fs::FsExt;

const BODY_LIMIT: usize = 20 * 1024 * 1024;
const EVENT_LOG_LIMIT: usize = 8 * 1024 * 1024;
const EVENT_LOG_ENTRIES: usize = 10_000;
const TIMELINE_LIMIT: usize = 2 * 1024 * 1024;
const AGGREGATE_LIMIT: usize = 32 * 1024 * 1024;
const ENTRY_LIMIT: usize = 100;
const TIMELINE_ENTRIES: usize = 10_000;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LegacyResponseEntry {
    pub id: String,
    pub body_path: Option<String>,
    pub event_log_path: Option<String>,
    pub timeline_path: Option<String>,
    pub body_compression: String,
    pub body_format: Option<String>,
}

#[derive(Serialize)]
pub struct AssetDiagnostic {
    asset: &'static str,
    code: &'static str,
    message: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyResponseAssets {
    id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    body_base64: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    size: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sha256: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    event_log_base64: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    event_log_size: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    event_log_sha256: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    timeline: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    timeline_base64: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    timeline_size: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    timeline_sha256: Option<String>,
    diagnostics: Vec<AssetDiagnostic>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetLimits {
    max_entries: usize,
    body_input_bytes: usize,
    body_decoded_bytes: usize,
    event_log_bytes: usize,
    event_log_entries: usize,
    timeline_bytes: usize,
    timeline_entries: usize,
    aggregate_input_bytes: usize,
    aggregate_decoded_bytes: usize,
    input_bytes_read: usize,
    decoded_bytes_read: usize,
}

#[derive(Serialize)]
pub struct LegacyResponseResult {
    entries: Vec<LegacyResponseAssets>,
    limits: AssetLimits,
}

type Failure = (&'static str, &'static str);
const REFUSED: Failure = (
    "refused",
    "Asset path must be an ordinary scoped file inside the selected folder.",
);

fn ordinary(metadata: &Metadata) -> bool {
    if metadata.file_type().is_symlink() {
        return false;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return false;
        }
    }
    true
}

fn metadata(path: &Path) -> Result<Metadata, Failure> {
    fs::symlink_metadata(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            (
                "missing",
                "Legacy asset is missing; no body or timeline was substituted.",
            )
        } else {
            ("io", "Legacy asset metadata could not be read.")
        }
    })
}

/// Check every ancestor, including ancestors of the selected folder itself.
fn ordinary_chain(path: &Path, directory: bool) -> Result<(), Failure> {
    let mut current = PathBuf::new();
    let components: Vec<_> = path.components().collect();
    for (index, component) in components.iter().enumerate() {
        match component {
            Component::Prefix(prefix) => {
                #[cfg(windows)]
                if !matches!(
                    prefix.kind(),
                    std::path::Prefix::Disk(_)
                        | std::path::Prefix::UNC(_, _)
                        | std::path::Prefix::VerbatimDisk(_)
                        | std::path::Prefix::VerbatimUNC(_, _)
                ) {
                    return Err(REFUSED);
                }
                #[cfg(not(windows))]
                let _ = prefix;
                current.push(component.as_os_str())
            }
            Component::Normal(name) => {
                #[cfg(windows)]
                {
                    use std::os::windows::ffi::OsStrExt;
                    // Only ordinary asset files, never NTFS alternate streams.
                    if name.encode_wide().any(|unit| unit == u16::from(b':')) {
                        return Err(REFUSED);
                    }
                }
                #[cfg(not(windows))]
                let _ = name;
                current.push(component.as_os_str())
            }
            Component::RootDir => current.push(component.as_os_str()),
            _ => return Err(REFUSED),
        }
        if matches!(component, Component::Prefix(_)) {
            continue;
        }
        let info = metadata(&current)?;
        if !ordinary(&info) || ((index + 1 < components.len() || directory) && !info.is_dir()) {
            return Err(REFUSED);
        }
    }
    Ok(())
}

#[cfg(windows)]
pub(crate) fn opened_path(file: &File) -> Result<PathBuf, Failure> {
    use std::{
        ffi::OsString,
        os::windows::{ffi::OsStringExt, io::AsRawHandle},
    };
    use windows::Win32::{
        Foundation::HANDLE,
        Storage::FileSystem::{
            GetFinalPathNameByHandleW, FILE_NAME_NORMALIZED, GETFINALPATHNAMEBYHANDLE_FLAGS,
            VOLUME_NAME_DOS,
        },
    };
    let mut buffer = [0u16; 4097];
    // File owns the handle for the entire call; no close or raw-handle adoption.
    let length = unsafe {
        GetFinalPathNameByHandleW(
            HANDLE(file.as_raw_handle()),
            &mut buffer,
            GETFINALPATHNAMEBYHANDLE_FLAGS(FILE_NAME_NORMALIZED.0 | VOLUME_NAME_DOS.0),
        )
    } as usize;
    if length == 0 || length >= buffer.len() {
        return Err(REFUSED);
    }
    Ok(PathBuf::from(OsString::from_wide(&buffer[..length])))
}

#[cfg(target_os = "linux")]
pub(crate) fn opened_path(file: &File) -> Result<PathBuf, Failure> {
    use std::os::fd::AsRawFd;
    fs::canonicalize(format!("/proc/self/fd/{}", file.as_raw_fd())).map_err(|_| REFUSED)
}

#[cfg(target_os = "macos")]
#[path = "legacy_opened_path_macos.rs"]
mod macos_path;

#[cfg(target_os = "macos")]
pub(crate) fn opened_path(file: &File) -> Result<PathBuf, Failure> {
    macos_path::opened_path(file).map_err(|_| REFUSED)
}

#[cfg(not(any(windows, target_os = "linux", target_os = "macos")))]
pub(crate) fn opened_path(_file: &File) -> Result<PathBuf, Failure> {
    Err((
        "unsupported",
        "Opened-file identity binding is not implemented on this platform.",
    ))
}

fn verify_opened(
    file: &File,
    root: &Path,
    expected: &Path,
    scope: &dyn Fn(&Path) -> bool,
) -> Result<(), Failure> {
    let actual = opened_path(file)?;
    if actual != expected || !actual.starts_with(root) || !scope(&actual) {
        return Err(REFUSED);
    }
    ordinary_chain(&actual, false)?;
    let info = file.metadata().map_err(|_| REFUSED)?;
    if !ordinary(&info) || !info.is_file() {
        return Err(REFUSED);
    }
    Ok(())
}

fn confined_path(root: &Path, input: &str) -> Result<PathBuf, Failure> {
    if input.len() > 4096 || input.contains('\0') {
        return Err(REFUSED);
    }
    let supplied = Path::new(input);
    if supplied
        .components()
        .any(|part| matches!(part, Component::ParentDir | Component::CurDir))
    {
        return Err(REFUSED);
    }
    // Reject drive-relative and root-relative spellings rather than interpreting
    // them through a process working directory or a different drive.
    if supplied.has_root() && !supplied.is_absolute() {
        return Err(REFUSED);
    }
    if !supplied.is_absolute()
        && supplied
            .components()
            .any(|part| matches!(part, Component::Prefix(_)))
    {
        return Err(REFUSED);
    }
    let path = if supplied.is_absolute() {
        supplied.to_path_buf()
    } else {
        root.join(supplied)
    };
    // Absolute legacy paths can use ordinary DOS spelling while canonical root
    // uses the Windows verbatim prefix. Authorize them after canonicalization;
    // relative paths remain lexically confined before touching the filesystem.
    if !supplied.is_absolute() && (!path.starts_with(root) || path == root) {
        return Err(REFUSED);
    }
    ordinary_chain(&path, false)?;
    let resolved = fs::canonicalize(&path).map_err(|_| REFUSED)?;
    if !resolved.starts_with(root) || resolved == root {
        return Err(REFUSED);
    }
    Ok(resolved)
}

fn read_file(
    root: &Path,
    input: &str,
    scope: &dyn Fn(&Path) -> bool,
    limit: usize,
    remaining: &mut usize,
) -> Result<Vec<u8>, Failure> {
    if !scope(root) {
        return Err(REFUSED);
    }
    let path = confined_path(root, input)?;
    if !scope(&path) {
        return Err(REFUSED);
    }
    let before = metadata(&path)?;
    if !ordinary(&before) || !before.is_file() {
        return Err(REFUSED);
    }
    if before.len() > limit as u64 {
        return Err(("oversize", "Legacy asset exceeds its input byte limit."));
    }
    if before.len() > *remaining as u64 {
        return Err((
            "aggregate_limit",
            "Legacy asset exceeds the remaining aggregate input allowance.",
        ));
    }
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.custom_flags(0x0020_0000); // FILE_FLAG_OPEN_REPARSE_POINT
        options.share_mode(1); // FILE_SHARE_READ: refuse concurrent writers/deletion.
    }
    let file = options
        .open(&path)
        .map_err(|_| ("io", "Legacy asset could not be opened read-only."))?;
    let opened = file
        .metadata()
        .map_err(|_| ("io", "Opened legacy asset metadata could not be read."))?;
    if !ordinary(&opened) || !opened.is_file() {
        return Err(REFUSED);
    }
    verify_opened(&file, root, &path, scope)?;
    // Recheck ancestry and canonical containment after open. These checks do not
    // claim a universal hostile concurrent filesystem-replacement guarantee.
    ordinary_chain(&path, false)?;
    if fs::canonicalize(&path).map_err(|_| REFUSED)? != path || !scope(&path) {
        return Err(REFUSED);
    }
    let bytes = read_bounded(&file, limit.min(*remaining), remaining, "io")?;
    verify_opened(&file, root, &path, scope)?;
    let after = file.metadata().map_err(|_| REFUSED)?;
    if after.len() != opened.len()
        || after.modified().ok() != opened.modified().ok()
        || bytes.len() as u64 != opened.len()
    {
        return Err((
            "changed",
            "Legacy asset changed during the read; no partial asset was published.",
        ));
    }
    Ok(bytes)
}

fn read_bounded(
    reader: impl Read,
    limit: usize,
    remaining: &mut usize,
    error_code: &'static str,
) -> Result<Vec<u8>, Failure> {
    let mut bytes = Vec::new();
    let result = reader.take(limit as u64 + 1).read_to_end(&mut bytes);
    *remaining = remaining.saturating_sub(bytes.len());
    if bytes.len() > limit {
        return Err((
            "oversize",
            "Legacy asset exceeds its decoded or aggregate byte allowance.",
        ));
    }
    if result.is_err() {
        return Err((
            error_code,
            "Legacy asset could not be read or decoded completely.",
        ));
    }
    Ok(bytes)
}

fn timeline(bytes: &[u8]) -> Result<Vec<Value>, Failure> {
    let value: Value = serde_json::from_slice(bytes)
        .map_err(|_| ("malformed", "Legacy timeline must be a valid JSON array."))?;
    let rows = value
        .as_array()
        .ok_or(("malformed", "Legacy timeline must be a JSON array."))?;
    if rows.len() > TIMELINE_ENTRIES {
        return Err(("oversize", "Legacy timeline exceeds 10000 entries."));
    }
    for row in rows {
        let Some(object) = row.as_object() else {
            return Err(("malformed", "Legacy timeline entries must be objects."));
        };
        if object.get("name").and_then(Value::as_str).is_none()
            || object.get("value").and_then(Value::as_str).is_none()
            || object
                .get("timestamp")
                .and_then(Value::as_f64)
                .filter(|value| value.is_finite())
                .is_none()
        {
            return Err((
                "malformed",
                "Legacy timeline entries require string name/value and finite numeric timestamp.",
            ));
        }
    }
    // Retain all unknown original fields and names after minimum-shape validation.
    Ok(rows.clone())
}

/// WebSocket logs and explicitly marked SSE timelines use NDJSON, never a filename guess.
/// Validate only the persisted envelope here; the frontend owns event semantics.
fn stream_ndjson(bytes: &[u8], is_timeline: bool) -> Result<Vec<Value>, Failure> {
    let limit = if is_timeline {
        TIMELINE_ENTRIES
    } else {
        EVENT_LOG_ENTRIES
    };
    let mut rows = Vec::new();
    for line in bytes.split(|byte| *byte == b'\n') {
        // Empty logs, CRLF, blank lines and a missing final newline are valid.
        if line.iter().all(u8::is_ascii_whitespace) {
            continue;
        }
        if rows.len() == limit {
            return Err(("oversize", "Legacy stream NDJSON exceeds 10000 entries."));
        }
        let row: Value = serde_json::from_slice(line).map_err(|_| {
            (
                "malformed",
                "Legacy stream NDJSON contains an invalid JSON line.",
            )
        })?;
        let object = row
            .as_object()
            .ok_or(("malformed", "Legacy stream NDJSON entries must be objects."))?;
        if object
            .get("timestamp")
            .and_then(Value::as_f64)
            .filter(|value| value.is_finite() && *value >= 0.0)
            .is_none()
            || if is_timeline {
                object.get("name").and_then(Value::as_str).is_none()
                    || object.get("value").and_then(Value::as_str).is_none()
            } else {
                object.get("type").and_then(Value::as_str).is_none()
            }
        {
            return Err(("malformed", "Legacy stream NDJSON requires a nonnegative finite numeric timestamp and string type, or timeline name/value."));
        }
        // Preserve chronological source order and every unknown original field.
        rows.push(row);
    }
    Ok(rows)
}

#[tauri::command]
pub async fn read_legacy_response_assets(
    window: tauri::WebviewWindow,
    webview: tauri::Webview,
    id: Option<String>,
    on_started: Option<tauri::ipc::JavaScriptChannelId>,
    root: String,
    entries: Vec<LegacyResponseEntry>,
) -> Result<LegacyResponseResult, String> {
    read_assets(window, webview, id, on_started, root, entries, BODY_LIMIT).await
}

async fn read_assets(
    window: tauri::WebviewWindow,
    webview: tauri::Webview,
    id: Option<String>,
    on_started: Option<tauri::ipc::JavaScriptChannelId>,
    root: String,
    entries: Vec<LegacyResponseEntry>,
    body_limit: usize,
) -> Result<LegacyResponseResult, String> {
    if window.label() != "main" {
        return Err("Legacy response assets require the main native window.".into());
    }
    if entries.len() > ENTRY_LIMIT {
        return Err("Legacy response assets accept at most 100 entries per preview.".into());
    }
    let mut ids = HashSet::new();
    for entry in &entries {
        if !matches!(
            entry.body_format.as_deref(),
            None | Some("sse-ndjson") | Some("websocket-ndjson")
        ) || (entry.body_format.as_deref() == Some("sse-ndjson")
            && entry.event_log_path.is_some())
        {
            return Err("Legacy response body format must be ordinary HTTP, SSE NDJSON or WebSocket NDJSON; SSE cannot include a WebSocket event log.".into());
        }
        if entry.id.is_empty()
            || entry.id.len() > 200
            || entry.id.chars().any(char::is_control)
            || !ids.insert(entry.id.clone())
        {
            return Err(
                "Legacy response entries need distinct nonempty IDs of at most 200 bytes.".into(),
            );
        }
    }
    let scope = window
        .try_fs_scope()
        .ok_or("Native filesystem scope is unavailable.")?;
    let supplied_root = PathBuf::from(root);
    if !supplied_root.is_absolute() || supplied_root.as_os_str().len() > 4096 {
        return Err("Select and grant the legacy data folder before reading assets.".into());
    }
    let id = id.unwrap_or_else(|| format!("legacy-assets_{}", uuid::Uuid::new_v4().simple()));
    if !id.strip_prefix("legacy-assets_").is_some_and(|suffix| {
        suffix.len() == 32 && suffix.bytes().all(|byte| byte.is_ascii_hexdigit())
    }) {
        return Err("Invalid legacy asset operation ID.".into());
    }
    let network = window
        .try_state::<crate::http::NetworkState>()
        .ok_or("Native work registry is unavailable.")?;
    let lease = network.retain_native_work(id.clone())?;
    network.publish_started(&id, on_started, webview)?;
    tauri::async_runtime::spawn_blocking(move || {
        if lease.cancelled() {
            return Err("Legacy asset reading was cancelled.".into());
        }
        let result = read_assets_scoped(supplied_root, entries, body_limit, &|path| {
            !lease.cancelled() && scope.is_allowed(path)
        });
        if lease.cancelled() {
            Err("Legacy asset reading was cancelled.".into())
        } else {
            result
        }
    })
    .await
    .map_err(|_| "Legacy asset reader worker failed.".to_string())?
}

// The native command supplies its existing filesystem scope; no grants are added.
fn read_assets_scoped(
    supplied_root: PathBuf,
    entries: Vec<LegacyResponseEntry>,
    body_limit: usize,
    scope: &dyn Fn(&Path) -> bool,
) -> Result<LegacyResponseResult, String> {
    if !scope(&supplied_root) {
        return Err("Select and grant the legacy data folder before reading assets.".into());
    }
    ordinary_chain(&supplied_root, true).map_err(|(_, message)| message.to_string())?;
    let root = fs::canonicalize(&supplied_root)
        .map_err(|_| "Legacy data folder could not be resolved.")?;
    if !scope(&root) {
        return Err("Resolved legacy folder is outside the existing filesystem scope.".into());
    }
    let mut input_remaining = AGGREGATE_LIMIT;
    let mut decoded_remaining = AGGREGATE_LIMIT;
    let mut output = Vec::with_capacity(entries.len());
    for entry in entries {
        let mut row = LegacyResponseAssets {
            id: entry.id,
            body_base64: None,
            size: None,
            sha256: None,
            event_log_base64: None,
            event_log_size: None,
            event_log_sha256: None,
            timeline: None,
            timeline_base64: None,
            timeline_size: None,
            timeline_sha256: None,
            diagnostics: Vec::new(),
        };
        if entry.event_log_path.is_some()
            || entry.body_format.as_deref() == Some("websocket-ndjson")
        {
            let result = if entry.event_log_path.is_none() {
                Err((
                    "missing-event-log-path",
                    "Legacy WebSocket event log path is absent; no log was invented.",
                ))
            } else if entry.event_log_path.as_deref() == Some("") {
                Ok(Vec::new())
            } else {
                read_file(
                    &root,
                    entry.event_log_path.as_deref().unwrap(),
                    &scope,
                    EVENT_LOG_LIMIT.min(decoded_remaining),
                    &mut input_remaining,
                )
            }
            .and_then(|bytes| {
                decoded_remaining -= bytes.len();
                Ok(bytes)
            });
            match result {
                Ok(bytes) => {
                    row.event_log_size = Some(bytes.len());
                    row.event_log_sha256 = Some(format!("{:x}", Sha256::digest(&bytes)));
                    row.event_log_base64 = Some(STANDARD.encode(&bytes));
                    // A complete bounded read is portable even when malformed.
                    // Never publish partial reads; derived history validates again.
                    if let Err((code, message)) = stream_ndjson(&bytes, false) {
                        row.diagnostics.push(AssetDiagnostic {
                            asset: "eventLog",
                            code,
                            message,
                        });
                    }
                }
                Err((code, message)) => row.diagnostics.push(AssetDiagnostic {
                    asset: "eventLog",
                    code,
                    message,
                }),
            }
            if let Some(path) = entry.timeline_path.filter(|path| !path.is_empty()) {
                let result = if path.is_empty() {
                    Ok(Vec::new())
                } else {
                    read_file(
                        &root,
                        &path,
                        &scope,
                        TIMELINE_LIMIT.min(decoded_remaining),
                        &mut input_remaining,
                    )
                }
                .and_then(|bytes| {
                    decoded_remaining -= bytes.len();
                    row.timeline_size = Some(bytes.len());
                    row.timeline_sha256 = Some(format!("{:x}", Sha256::digest(&bytes)));
                    row.timeline_base64 = Some(STANDARD.encode(&bytes));
                    stream_ndjson(&bytes, true)
                });
                match result {
                    Ok(rows) => row.timeline = Some(rows),
                    Err((code, message)) => row.diagnostics.push(AssetDiagnostic {
                        asset: "timeline",
                        code,
                        message,
                    }),
                }
            }
            output.push(row);
            continue;
        }
        let body = if !["raw", "gzip"].contains(&entry.body_compression.as_str()) {
            Err((
                "compression",
                "Legacy body compression must be explicitly raw or gzip.",
            ))
        } else if entry.body_path.is_none() {
            Err((
                "missing-body-path",
                "Legacy body path is absent; no response body was invented.",
            ))
        } else if entry.body_path.as_deref() == Some("") {
            Ok(Vec::new())
        } else {
            read_file(
                &root,
                entry.body_path.as_deref().unwrap(),
                &scope,
                body_limit,
                &mut input_remaining,
            )
            .and_then(|bytes| {
                if entry.body_compression == "gzip" {
                    read_bounded(
                        MultiGzDecoder::new(bytes.as_slice()),
                        body_limit.min(decoded_remaining),
                        &mut decoded_remaining,
                        "compression",
                    )
                } else {
                    if bytes.len() > decoded_remaining {
                        return Err((
                            "aggregate_limit",
                            "Legacy body exceeds the remaining aggregate decoded allowance.",
                        ));
                    }
                    decoded_remaining -= bytes.len();
                    Ok(bytes)
                }
            })
        };
        match body {
            Ok(bytes) => {
                row.size = Some(bytes.len());
                row.sha256 = Some(format!("{:x}", Sha256::digest(&bytes)));
                row.body_base64 = Some(STANDARD.encode(bytes));
            }
            Err((code, message)) => row.diagnostics.push(AssetDiagnostic {
                asset: "body",
                code,
                message,
            }),
        }
        if let Some(path) = entry.timeline_path.filter(|path| !path.is_empty()) {
            let result = read_file(
                &root,
                &path,
                &scope,
                TIMELINE_LIMIT.min(decoded_remaining),
                &mut input_remaining,
            )
            .and_then(|bytes| {
                decoded_remaining -= bytes.len();
                row.timeline_size = Some(bytes.len());
                row.timeline_sha256 = Some(format!("{:x}", Sha256::digest(&bytes)));
                row.timeline_base64 = Some(STANDARD.encode(&bytes));
                if entry.body_format.as_deref() == Some("sse-ndjson") {
                    stream_ndjson(&bytes, true)
                } else {
                    timeline(&bytes)
                }
            });
            match result {
                Ok(rows) => row.timeline = Some(rows),
                Err((code, message)) => row.diagnostics.push(AssetDiagnostic {
                    asset: "timeline",
                    code,
                    message,
                }),
            }
        }
        output.push(row);
    }
    Ok(LegacyResponseResult {
        entries: output,
        limits: AssetLimits {
            max_entries: ENTRY_LIMIT,
            body_input_bytes: body_limit,
            body_decoded_bytes: body_limit,
            event_log_bytes: EVENT_LOG_LIMIT,
            event_log_entries: EVENT_LOG_ENTRIES,
            timeline_bytes: TIMELINE_LIMIT,
            timeline_entries: TIMELINE_ENTRIES,
            aggregate_input_bytes: AGGREGATE_LIMIT,
            aggregate_decoded_bytes: AGGREGATE_LIMIT,
            input_bytes_read: AGGREGATE_LIMIT - input_remaining,
            decoded_bytes_read: AGGREGATE_LIMIT - decoded_remaining,
        },
    })
}

/// Request file inputs expose neither response decompression nor timeline reads.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LegacyRequestEntry {
    pub id: String,
    pub path: String,
}

#[tauri::command]
pub async fn read_legacy_request_assets(
    window: tauri::WebviewWindow,
    webview: tauri::Webview,
    id: Option<String>,
    on_started: Option<tauri::ipc::JavaScriptChannelId>,
    root: String,
    entries: Vec<LegacyRequestEntry>,
) -> Result<LegacyResponseResult, String> {
    if entries.len() > ENTRY_LIMIT {
        return Err("Legacy request files accept at most 100 entries per preview.".into());
    }
    if entries.iter().any(|entry| entry.path.is_empty()) {
        return Err("Legacy request file assets require an explicit nonempty source path.".into());
    }
    let entries = entries
        .into_iter()
        .map(|entry| LegacyResponseEntry {
            id: entry.id,
            body_path: Some(entry.path),
            event_log_path: None,
            body_format: None,
            timeline_path: None,
            body_compression: "raw".into(),
        })
        .collect();
    read_legacy_response_assets(window, webview, id, on_started, root, entries).await
}

/// Certificate input exposes raw scoped bytes only, under the existing TLS cap.
#[tauri::command]
pub async fn read_legacy_certificate_assets(
    window: tauri::WebviewWindow,
    webview: tauri::Webview,
    id: Option<String>,
    on_started: Option<tauri::ipc::JavaScriptChannelId>,
    root: String,
    entries: Vec<LegacyRequestEntry>,
) -> Result<LegacyResponseResult, String> {
    if entries.len() > ENTRY_LIMIT {
        return Err("Legacy certificate files accept at most 100 entries per preview.".into());
    }
    if entries.iter().any(|entry| entry.path.is_empty()) {
        return Err("Legacy certificate assets require an explicit nonempty source path.".into());
    }
    let entries = entries
        .into_iter()
        .map(|entry| LegacyResponseEntry {
            id: entry.id,
            body_path: Some(entry.path),
            event_log_path: None,
            body_format: None,
            timeline_path: None,
            body_compression: "raw".into(),
        })
        .collect();
    read_assets(window, webview, id, on_started, root, entries, 1024 * 1024).await
}

#[cfg(all(test, any(windows, target_os = "linux", target_os = "macos")))]
mod tests {
    use super::*;

    #[test]
    fn cancelled_read_refuses_before_resolving_the_next_path() {
        let network = crate::http::NetworkState::default();
        let id = format!("legacy-assets_{}", uuid::Uuid::new_v4().simple());
        let lease = network.retain_native_work(id.clone()).unwrap();
        network.cancel(&id).unwrap();
        let root =
            std::env::temp_dir().join(format!("insomnium-unopened-{}", uuid::Uuid::new_v4()));
        let checks = std::cell::Cell::new(0);
        let mut remaining = AGGREGATE_LIMIT;
        let result = read_file(
            &root,
            "never-open.body",
            &|path| {
                assert_eq!(path, root);
                checks.set(checks.get() + 1);
                !lease.cancelled()
            },
            BODY_LIMIT,
            &mut remaining,
        );
        assert_eq!(result.unwrap_err(), REFUSED);
        assert_eq!(checks.get(), 1);
        assert!(network.retain_native_work(id.clone()).is_err());
        drop(lease);
        assert!(network.retain_native_work(id).is_ok());
    }

    #[test]
    fn missing_payloads_preserve_real_timelines_without_inventing_bytes() {
        struct OwnedDir(PathBuf);
        impl Drop for OwnedDir {
            fn drop(&mut self) {
                for name in ["http.json", "stream.ndjson", "body.txt"] {
                    let _ = fs::remove_file(self.0.join(name));
                }
                let _ = fs::remove_dir(&self.0);
            }
        }
        let directory =
            std::env::temp_dir().join(format!("insomnium-assets-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&directory).unwrap();
        let directory = OwnedDir(fs::canonicalize(directory).unwrap());
        let http = br#"[{"name":"Text","value":"owned","timestamp":1}]"#;
        let stream = b"{\"name\":\"Text\",\"value\":\"owned\",\"timestamp\":1}\n";
        fs::write(directory.0.join("http.json"), http).unwrap();
        fs::write(directory.0.join("stream.ndjson"), stream).unwrap();
        fs::write(directory.0.join("body.txt"), b"owned body").unwrap();
        let entry = |id: &str, body: Option<&str>, format: Option<&str>, timeline: &str| {
            LegacyResponseEntry {
                id: id.into(),
                body_path: body.map(str::to_owned),
                event_log_path: None,
                timeline_path: Some(timeline.into()),
                body_compression: "raw".into(),
                body_format: format.map(str::to_owned),
            }
        };
        let result = read_assets_scoped(
            directory.0.clone(),
            vec![
                entry("missing", None, None, "http.json"),
                entry("empty", Some(""), None, "http.json"),
                entry("websocket", None, Some("websocket-ndjson"), "stream.ndjson"),
                entry("body", Some("body.txt"), None, "http.json"),
            ],
            BODY_LIMIT,
            &|path| path.starts_with(&directory.0),
        )
        .unwrap();
        let missing = &result.entries[0];
        assert!(missing.body_base64.is_none());
        assert!(missing
            .diagnostics
            .iter()
            .any(|d| d.code == "missing-body-path"));
        assert_eq!(
            missing.timeline_base64.as_deref(),
            Some(STANDARD.encode(http).as_str())
        );
        assert_eq!(missing.timeline.as_ref().unwrap().len(), 1);
        assert_eq!(result.entries[1].body_base64.as_deref(), Some(""));
        let websocket = &result.entries[2];
        assert!(websocket.event_log_base64.is_none());
        assert!(websocket.body_base64.is_none());
        assert!(websocket
            .diagnostics
            .iter()
            .any(|d| d.code == "missing-event-log-path"));
        assert_eq!(
            websocket.timeline_base64.as_deref(),
            Some(STANDARD.encode(stream).as_str())
        );
        assert_eq!(websocket.timeline.as_ref().unwrap().len(), 1);
        assert_eq!(
            result.entries[3].body_base64.as_deref(),
            Some(STANDARD.encode(b"owned body").as_str())
        );
        let refused = read_assets_scoped(
            directory.0.clone(),
            vec![entry("denied", Some("body.txt"), None, "")],
            BODY_LIMIT,
            &|path| {
                path.starts_with(&directory.0)
                    && path.file_name().is_none_or(|name| name != "body.txt")
            },
        )
        .unwrap();
        assert!(refused.entries[0].body_base64.is_none());
        assert!(!refused.entries[0].diagnostics.is_empty());
        assert_eq!(
            fs::read(directory.0.join("body.txt")).unwrap(),
            b"owned body"
        );
    }
}
