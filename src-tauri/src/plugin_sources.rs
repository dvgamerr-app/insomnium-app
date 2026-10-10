use crate::plugins::{discover, DiscoveryIssue, PluginDiscovery};
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use tauri::Manager;

const SOURCE_LIMIT: usize = 32;
const PACKAGE_LIMIT: usize = 128;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginSource {
    directory: String,
    origin: String,
    legacy: bool,
    configured_paths: Vec<String>,
}

#[derive(Serialize)]
pub struct PluginSources {
    sources: Vec<PluginSource>,
    report: PluginDiscovery,
}

// Legacy uses ':' on every platform. Keep Windows drive colons intact instead
// of using PATH parsing (which uses ';' on Windows), without rewriting the input.
fn legacy_paths(value: &str) -> Result<Vec<String>, String> {
    if value.len() > 16 * 1024 {
        return Err("Legacy pluginPath exceeds the 16 KiB path-list limit.".into());
    }
    let bytes = value.as_bytes();
    let mut start = 0;
    let mut paths = Vec::new();
    for (index, character) in value.char_indices() {
        if character != ':' {
            continue;
        }
        let drive = index == start + 1
            && bytes[start].is_ascii_alphabetic()
            && bytes
                .get(index + 1)
                .is_some_and(|b| *b == b'/' || *b == b'\\');
        if drive {
            continue;
        }
        if start < index {
            paths.push(value[start..index].to_string());
        }
        start = index + 1;
    }
    if start < value.len() {
        paths.push(value[start..].to_string());
    }
    if paths.len() > SOURCE_LIMIT {
        return Err("Too many legacy plugin folders (maximum 32).".into());
    }
    Ok(paths)
}

fn resolve_path(value: &str, home: &Path) -> Result<PathBuf, String> {
    if value.is_empty() || value.len() > 8192 {
        return Err("Plugin folder must contain a path of at most 8192 bytes.".into());
    }
    let path = if let Some(relative) = value
        .strip_prefix("~/")
        .or_else(|| value.strip_prefix("~\\"))
    {
        home.join(relative)
    } else {
        PathBuf::from(value)
    };
    let absolute = if path.is_absolute() {
        path
    } else {
        std::env::current_dir()
            .map_err(|e| e.to_string())?
            .join(path)
    };
    // Missing/temporarily inaccessible configured folders stay visible and saved.
    Ok(std::fs::canonicalize(&absolute).unwrap_or(absolute))
}

fn key(path: &Path) -> String {
    let value = path.to_string_lossy().into_owned();
    if cfg!(windows) {
        let separators = value.replace('/', "\\");
        let normalized = if let Some(unc) = separators.strip_prefix("\\\\?\\UNC\\") {
            format!("\\\\{unc}")
        } else {
            separators
                .strip_prefix("\\\\?\\")
                .unwrap_or(&separators)
                .to_string()
        };
        normalized.to_lowercase()
    } else {
        value
    }
}

fn inspect_sources(
    default: PathBuf,
    home: PathBuf,
    directories: Vec<String>,
    legacy_path: Option<String>,
) -> Result<PluginSources, String> {
    if directories.len() > SOURCE_LIMIT {
        return Err("Too many saved plugin folders (maximum 32).".into());
    }
    let legacy = legacy_paths(legacy_path.as_deref().unwrap_or(""))?;
    let mut inputs = vec![(default.to_string_lossy().into_owned(), "default")];
    inputs.extend(legacy.into_iter().map(|p| (p, "legacy")));
    inputs.extend(directories.into_iter().map(|p| (p, "configured")));
    let mut sources: Vec<PluginSource> = Vec::new();
    let mut indices = BTreeMap::<String, usize>::new();
    let mut paths = Vec::new();
    for (input, origin) in inputs {
        let path = resolve_path(&input, &home)?;
        let identity = key(&path);
        if let Some(index) = indices.get(&identity).copied() {
            let source: &mut PluginSource = &mut sources[index];
            if origin == "legacy" {
                source.legacy = true;
            }
            if origin == "configured" {
                source.configured_paths.push(input);
            }
            continue;
        }
        if sources.len() >= SOURCE_LIMIT {
            return Err(
                "Too many distinct plugin folders (maximum 32 including the default folder)."
                    .into(),
            );
        }
        indices.insert(identity, sources.len());
        sources.push(PluginSource {
            directory: path.to_string_lossy().into_owned(),
            origin: origin.into(),
            legacy: origin == "legacy",
            configured_paths: if origin == "configured" {
                vec![input]
            } else {
                vec![]
            },
        });
        paths.push(path);
    }
    let mut report = PluginDiscovery {
        directory: sources[0].directory.clone(),
        exists: false,
        complete: true,
        packages: vec![],
        issues: vec![],
        visited: 0,
    };
    let mut package_paths = BTreeSet::new();
    for (source, path) in sources.iter().zip(paths) {
        match discover(&path, source.origin == "default") {
            Ok(found) => {
                report.exists |= found.exists;
                report.complete &= found.complete;
                report.issues.extend(found.issues);
                for package in found.packages {
                    if !package_paths.insert(key(Path::new(&package.directory))) {
                        continue;
                    }
                    if report.packages.len() >= PACKAGE_LIMIT {
                        report.complete = false;
                        report.issues.push(DiscoveryIssue { directory: source.directory.clone(), message: "The combined 128-package limit was reached. Inspect a single folder for its complete list.".into() });
                        break;
                    }
                    report.packages.push(package);
                }
            }
            Err(error) => {
                report.complete = false;
                report.issues.push(DiscoveryIssue {
                    directory: source.directory.clone(),
                    message: error,
                });
            }
        }
    }
    let mut counts = BTreeMap::new();
    for package in &report.packages {
        *counts.entry(package.name.clone()).or_insert(0) += 1;
    }
    for package in &mut report.packages {
        if counts.get(&package.name).is_some_and(|count| *count > 1) {
            package.status = "duplicate".into();
            package.message = "Multiple folders contain packages with this name. Keep a single version before activation.".into();
        }
    }
    report
        .packages
        .sort_by(|a, b| a.name.cmp(&b.name).then(a.directory.cmp(&b.directory)));
    Ok(PluginSources { sources, report })
}

#[tauri::command]
pub async fn discover_plugin_sources(
    app: tauri::AppHandle,
    directories: Vec<String>,
    legacy_path: Option<String>,
) -> Result<PluginSources, String> {
    let default = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("plugins");
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        inspect_sources(default, home, directories, legacy_path)
    })
    .await
    .map_err(|e| e.to_string())?
}
