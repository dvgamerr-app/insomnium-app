//! A bounded read-only snapshot for the separate plugin VM, never native execution.
use crate::plugins::{entry_format, read_manifest, resolve_entry, valid_name};
use serde::Serialize;
use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
pub struct PluginPackageSource {
    name: String,
    entry: String,
    format: String,
    files: BTreeMap<String, String>,
}

fn relative(root: &Path, path: &Path) -> Result<String, String> {
    Ok(path
        .strip_prefix(root)
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .replace('\\', "/"))
}

fn snapshot(directory: PathBuf) -> Result<PluginPackageSource, String> {
    let root = fs::canonicalize(directory).map_err(|e| e.to_string())?;
    let manifest = read_manifest(&root)?;
    let name = manifest
        .get("name")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("");
    if !valid_name(name) || manifest.get("insomnia").is_none() {
        return Err("Select a valid plugin package with an insomnia field.".into());
    }
    let entry = resolve_entry(&root, &manifest)?;
    if !matches!(
        entry.extension().and_then(|v| v.to_str()),
        Some("js" | "cjs" | "mjs")
    ) {
        return Err("The plugin entry must be a JavaScript module.".into());
    }
    let format = entry_format(&root, &entry, &manifest)?;
    let mut files = BTreeMap::new();
    let mut pending = vec![root.clone()];
    let mut entries = 0;
    let mut total = 0;
    while let Some(directory) = pending.pop() {
        for item in fs::read_dir(&directory).map_err(|e| e.to_string())? {
            entries += 1;
            if entries > 2048 {
                return Err("Plugin package exceeds the 2048-entry snapshot limit.".into());
            }
            let item = item.map_err(|e| e.to_string())?;
            let path = item.path();
            let metadata = fs::symlink_metadata(&path).map_err(|e| e.to_string())?;
            if metadata.file_type().is_symlink() {
                return Err(
                    "Linked files or folders cannot be included in a plugin snapshot yet.".into(),
                );
            }
            let canonical = fs::canonicalize(&path).map_err(|e| e.to_string())?;
            if !canonical.starts_with(&root) {
                return Err("Plugin snapshot path resolves outside its package directory.".into());
            }
            if metadata.is_dir() {
                if item.file_name() != ".git" {
                    pending.push(canonical);
                }
            } else if metadata.is_file()
                && matches!(
                    path.extension().and_then(|v| v.to_str()),
                    Some("js" | "cjs" | "mjs" | "json")
                )
            {
                if files.len() >= 128 {
                    return Err("Plugin package exceeds the 128-source-file snapshot limit.".into());
                }
                let file = File::open(&canonical).map_err(|e| e.to_string())?;
                let mut bytes = vec![];
                file.take(1024 * 1024 + 1)
                    .read_to_end(&mut bytes)
                    .map_err(|e| e.to_string())?;
                if bytes.len() > 1024 * 1024 {
                    return Err("Plugin source exceeds the 1 MiB file limit.".into());
                }
                total += bytes.len();
                if total > 8 * 1024 * 1024 {
                    return Err("Plugin sources exceed the 8 MiB snapshot limit.".into());
                }
                let source = String::from_utf8(bytes)
                    .map_err(|_| "Plugin sources must contain UTF-8 text.")?;
                files.insert(relative(&root, &canonical)?, source);
            }
        }
    }
    Ok(PluginPackageSource {
        name: name.into(),
        entry: relative(&root, &entry)?,
        format,
        files,
    })
}

#[tauri::command]
pub async fn read_plugin_package(directory: String) -> Result<PluginPackageSource, String> {
    if directory.is_empty() || directory.len() > 8192 {
        return Err("Select a plugin package folder.".into());
    }
    tauri::async_runtime::spawn_blocking(move || snapshot(PathBuf::from(directory)))
        .await
        .map_err(|e| e.to_string())?
}
