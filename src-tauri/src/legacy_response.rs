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
use tauri_plugin_fs::FsExt;

const BODY_LIMIT: usize = 20 * 1024 * 1024;
const TIMELINE_LIMIT: usize = 2 * 1024 * 1024;
const AGGREGATE_LIMIT: usize = 32 * 1024 * 1024;
const ENTRY_LIMIT: usize = 100;
const TIMELINE_ENTRIES: usize = 10_000;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LegacyResponseEntry {
    pub id: String,
    pub body_path: Option<String>,
    pub timeline_path: Option<String>,
    pub body_compression: String,
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
    timeline: Option<Vec<Value>>,
    diagnostics: Vec<AssetDiagnostic>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetLimits {
    max_entries: usize,
    body_input_bytes: usize,
    body_decoded_bytes: usize,
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
fn opened_path(file: &File) -> Result<PathBuf, Failure> {
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
fn opened_path(file: &File) -> Result<PathBuf, Failure> {
    use std::os::fd::AsRawFd;
    fs::canonicalize(format!("/proc/self/fd/{}", file.as_raw_fd())).map_err(|_| REFUSED)
}

#[cfg(not(any(windows, target_os = "linux")))]
fn opened_path(_file: &File) -> Result<PathBuf, Failure> {
    Err((
        "unsupported",
        "Opened-file identity binding is not implemented on this platform.",
    ))
}

fn verify_opened(
    file: &File,
    root: &Path,
    expected: &Path,
    scope: &tauri::scope::fs::Scope,
) -> Result<(), Failure> {
    let actual = opened_path(file)?;
    if actual != expected || !actual.starts_with(root) || !scope.is_allowed(&actual) {
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
    scope: &tauri::scope::fs::Scope,
    limit: usize,
    remaining: &mut usize,
) -> Result<Vec<u8>, Failure> {
    let path = confined_path(root, input)?;
    if !scope.is_allowed(&path) {
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
    if fs::canonicalize(&path).map_err(|_| REFUSED)? != path || !scope.is_allowed(&path) {
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

#[tauri::command]
pub async fn read_legacy_response_assets(
    window: tauri::WebviewWindow,
    root: String,
    entries: Vec<LegacyResponseEntry>,
) -> Result<LegacyResponseResult, String> {
    if window.label() != "main" {
        return Err("Legacy response assets require the main native window.".into());
    }
    if entries.len() > ENTRY_LIMIT {
        return Err("Legacy response assets accept at most 100 entries per preview.".into());
    }
    let mut ids = HashSet::new();
    for entry in &entries {
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
    tauri::async_runtime::spawn_blocking(move || -> Result<LegacyResponseResult, String> {
        if !scope.is_allowed(&supplied_root) {
            return Err("Select and grant the legacy data folder before reading assets.".into());
        }
        ordinary_chain(&supplied_root, true).map_err(|(_, message)| message.to_string())?;
        let root = fs::canonicalize(&supplied_root)
            .map_err(|_| "Legacy data folder could not be resolved.")?;
        if !scope.is_allowed(&root) {
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
                timeline: None,
                diagnostics: Vec::new(),
            };
            let body = if !["raw", "gzip"].contains(&entry.body_compression.as_str()) {
                Err((
                    "compression",
                    "Legacy body compression must be explicitly raw or gzip.",
                ))
            } else if entry.body_path.as_deref().unwrap_or("").is_empty() {
                Ok(Vec::new())
            } else {
                read_file(
                    &root,
                    entry.body_path.as_deref().unwrap(),
                    &scope,
                    BODY_LIMIT,
                    &mut input_remaining,
                )
                .and_then(|bytes| {
                    if entry.body_compression == "gzip" {
                        read_bounded(
                            MultiGzDecoder::new(bytes.as_slice()),
                            BODY_LIMIT.min(decoded_remaining),
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
                    timeline(&bytes)
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
                body_input_bytes: BODY_LIMIT,
                body_decoded_bytes: BODY_LIMIT,
                timeline_bytes: TIMELINE_LIMIT,
                timeline_entries: TIMELINE_ENTRIES,
                aggregate_input_bytes: AGGREGATE_LIMIT,
                aggregate_decoded_bytes: AGGREGATE_LIMIT,
                input_bytes_read: AGGREGATE_LIMIT - input_remaining,
                decoded_bytes_read: AGGREGATE_LIMIT - decoded_remaining,
            },
        })
    })
    .await
    .map_err(|_| "Legacy asset reader worker failed.".to_string())?
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
            timeline_path: None,
            body_compression: "raw".into(),
        })
        .collect();
    read_legacy_response_assets(window, root, entries).await
}
