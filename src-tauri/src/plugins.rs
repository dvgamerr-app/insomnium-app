//! Read-only package discovery. Package code is never imported or executed here.
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use tauri::Manager;

const MANIFEST_LIMIT: u64 = 256 * 1024;
const ENTRY_LIMIT: usize = 512;
const PACKAGE_LIMIT: usize = 128;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginPackage {
    pub(crate) name: String,
    version: String,
    description: String,
    pub(crate) directory: String,
    entry: Option<String>,
    format: String,
    dependencies: Vec<String>,
    pub(crate) status: String,
    pub(crate) message: String,
}

#[derive(Serialize)]
pub struct DiscoveryIssue {
    pub(crate) directory: String,
    pub(crate) message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginDiscovery {
    pub(crate) directory: String,
    pub(crate) exists: bool,
    pub(crate) complete: bool,
    pub(crate) packages: Vec<PluginPackage>,
    pub(crate) issues: Vec<DiscoveryIssue>,
    #[serde(skip)]
    pub(crate) visited: usize,
}

fn issue(report: &mut PluginDiscovery, path: &Path, message: impl ToString) {
    report.issues.push(DiscoveryIssue {
        directory: path.to_string_lossy().into_owned(),
        message: message.to_string(),
    });
}

fn read_manifest(directory: &Path) -> Result<Value, String> {
    let path = directory.join("package.json");
    let canonical = fs::canonicalize(&path).map_err(|e| e.to_string())?;
    if !canonical.starts_with(directory) {
        return Err("package.json resolves outside the package directory.".into());
    }
    let file = File::open(canonical).map_err(|e| e.to_string())?;
    if !file.metadata().map_err(|e| e.to_string())?.is_file() {
        return Err("package.json must be a regular file.".into());
    }
    let mut bytes = Vec::new();
    file.take(MANIFEST_LIMIT + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > MANIFEST_LIMIT {
        return Err("package.json exceeds the 256 KiB inspection limit.".into());
    }
    let manifest: Value =
        serde_json::from_slice(&bytes).map_err(|e| format!("Invalid package.json: {e}"))?;
    if !manifest.is_object() {
        return Err("package.json must contain an object.".into());
    }
    Ok(manifest)
}

fn valid_name(name: &str) -> bool {
    fn part(value: &str) -> bool {
        !value.is_empty()
            && value != "."
            && value != ".."
            && value
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"-_.".contains(&b))
    }
    if name.len() > 214 {
        return false;
    }
    if let Some(scoped) = name.strip_prefix('@') {
        let parts: Vec<_> = scoped.split('/').collect();
        parts.len() == 2 && parts.iter().all(|p| part(p))
    } else {
        part(name)
    }
}

fn resolve_entry(directory: &Path, manifest: &Value) -> Result<PathBuf, String> {
    let main = match manifest.get("main") {
        None | Some(Value::Null) => {
            return entry_index(directory, directory)?
                .ok_or_else(|| "Package index entry was not found.".into())
        }
        Some(Value::String(value)) if value.is_empty() => {
            return entry_index(directory, directory)?
                .ok_or_else(|| "Package index entry was not found.".into())
        }
        Some(Value::String(value)) if !value.is_empty() => value,
        _ => return Err("Package main must be a non-empty relative path.".into()),
    };
    let base = entry_path(directory, directory, main)?;
    if let Some(file) = entry_file(&base, directory)? {
        return Ok(file);
    }
    if base.is_dir() {
        let canonical = fs::canonicalize(&base).map_err(|e| e.to_string())?;
        if !canonical.starts_with(directory) {
            return Err("Package entry resolves outside the package directory.".into());
        }
        if let Some(file) = entry_index(&canonical, directory)? {
            return Ok(file);
        }
    }
    // Legacy CommonJS falls back to the package's index when main is missing.
    if let Some(file) = entry_index(directory, directory)? {
        return Ok(file);
    }
    Err(format!("Package entry was not found: {main}"))
}

fn entry_path(root: &Path, base: &Path, value: &str) -> Result<PathBuf, String> {
    let mut relative = base
        .strip_prefix(root)
        .map_err(|e| e.to_string())?
        .to_path_buf();
    for component in Path::new(value).components() {
        match component {
            Component::Normal(part) => relative.push(part),
            Component::CurDir => {}
            Component::ParentDir if relative.pop() => {}
            _ => return Err("Package main must stay inside its package directory.".into()),
        }
    }
    Ok(root.join(relative))
}

fn entry_file(base: &Path, root: &Path) -> Result<Option<PathBuf>, String> {
    let mut candidates = vec![base.to_path_buf()];
    for suffix in ["js", "json", "node"] {
        let mut name = base.as_os_str().to_os_string();
        name.push(format!(".{suffix}"));
        candidates.push(PathBuf::from(name));
    }
    for candidate in candidates {
        if !candidate.is_file() {
            continue;
        }
        let canonical = fs::canonicalize(&candidate).map_err(|e| e.to_string())?;
        if !canonical.starts_with(root) {
            return Err("Package entry resolves outside the package directory.".into());
        }
        return Ok(Some(canonical));
    }
    Ok(None)
}

fn entry_index(base: &Path, root: &Path) -> Result<Option<PathBuf>, String> {
    // LOAD_INDEX does not load a bare index file or recurse into directories.
    for suffix in ["js", "json", "node"] {
        let path = base.join(format!("index.{suffix}"));
        if path.is_file() {
            let canonical = fs::canonicalize(path).map_err(|e| e.to_string())?;
            if !canonical.starts_with(root) {
                return Err("Package entry resolves outside the package directory.".into());
            }
            return Ok(Some(canonical));
        }
    }
    Ok(None)
}

fn entry_format(root: &Path, entry: &Path, manifest: &Value) -> Result<String, String> {
    match entry.extension().and_then(|value| value.to_str()) {
        Some("mjs") => return Ok("module".into()),
        Some("cjs") => return Ok("commonjs".into()),
        _ => {}
    }
    let mut scope = entry
        .parent()
        .ok_or("Package entry has no parent directory.")?;
    for _ in 0..128 {
        if scope == root {
            return Ok(
                if manifest.get("type").and_then(Value::as_str) == Some("module") {
                    "module"
                } else {
                    "commonjs"
                }
                .into(),
            );
        }
        if !scope.starts_with(root) {
            return Err("Package scope resolves outside the package directory.".into());
        }
        // A dependency with no manifest does not inherit the outer package type.
        if scope.file_name().is_some_and(|name| name == "node_modules") {
            return Ok("commonjs".into());
        }
        if scope
            .join("package.json")
            .try_exists()
            .map_err(|e| e.to_string())?
        {
            let nested = read_manifest(scope)?;
            return Ok(
                if nested.get("type").and_then(Value::as_str) == Some("module") {
                    "module"
                } else {
                    "commonjs"
                }
                .into(),
            );
        }
        scope = scope
            .parent()
            .ok_or("Package scope has no parent directory.")?;
    }
    Err("Package scope exceeds the 128-directory inspection limit.".into())
}

fn inspect_package(report: &mut PluginDiscovery, directory: &Path) {
    if report
        .packages
        .iter()
        .any(|package| Path::new(&package.directory) == directory)
    {
        return;
    }
    if report.packages.len() >= PACKAGE_LIMIT {
        report.complete = false;
        issue(
            report,
            directory,
            "The 128-package inspection limit was reached. Inspect a smaller folder.",
        );
        return;
    }
    let manifest = match read_manifest(directory) {
        Ok(value) => value,
        Err(error) => {
            issue(report, directory, error);
            return;
        }
    };
    // Legacy packages opt in by owning an insomnia field, regardless of its value.
    if manifest.get("insomnia").is_none() {
        return;
    }
    let name = manifest.get("name").and_then(Value::as_str).unwrap_or("");
    let entry = resolve_entry(directory, &manifest);
    let mut package = PluginPackage {
        name: if name.is_empty() {
            "Unnamed plugin"
        } else {
            name
        }
        .into(),
        version: manifest
            .get("version")
            .and_then(Value::as_str)
            .unwrap_or("unknown")
            .into(),
        description: manifest
            .get("description")
            .and_then(Value::as_str)
            .or_else(|| {
                manifest
                    .pointer("/insomnia/description")
                    .and_then(Value::as_str)
            })
            .unwrap_or("")
            .into(),
        directory: directory.to_string_lossy().into_owned(),
        entry: entry
            .as_ref()
            .ok()
            .map(|p| p.to_string_lossy().into_owned()),
        format: if manifest.get("type").and_then(Value::as_str) == Some("module") {
            "module".into()
        } else {
            "commonjs".into()
        },
        dependencies: Vec::new(),
        status: "execution-pending".into(),
        message: "Detected. Plugin execution is not available yet; this package has not been run."
            .into(),
    };
    let mut dependencies = BTreeMap::new();
    for field in ["dependencies", "optionalDependencies", "peerDependencies"] {
        if let Some(object) = manifest.get(field).and_then(Value::as_object) {
            for (name, _) in object {
                dependencies.insert(name.clone(), ());
            }
        }
    }
    package.dependencies = dependencies.into_keys().collect();
    if !valid_name(name) {
        package.status = "invalid".into();
        package.message = "Package name is missing or invalid.".into();
    } else if let Err(error) = entry {
        package.status = "invalid".into();
        package.message = error;
    } else if let Some(entry) = &package.entry {
        let extension = Path::new(entry)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");
        if !matches!(extension, "js" | "cjs" | "mjs") {
            package.status = "unsupported-entry".into();
            package.message = "The package entry is not a JavaScript module. Native and JSON entries cannot register plugin contributions.".into();
        } else {
            match entry_format(directory, Path::new(entry), &manifest) {
                Ok(format) => package.format = format,
                Err(error) => {
                    package.status = "invalid".into();
                    package.message = error;
                }
            }
        }
    }
    report.packages.push(package);
}

fn scan_children(report: &mut PluginDiscovery, directory: &Path, scope: bool) {
    if !report.complete {
        return;
    }
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return,
        Err(error) => {
            issue(report, directory, error);
            return;
        }
    };
    let mut paths = Vec::new();
    let remaining = ENTRY_LIMIT.saturating_sub(report.visited);
    for (index, entry) in entries.take(remaining + 1).enumerate() {
        if index >= remaining {
            report.complete = false;
            issue(
                report,
                directory,
                "The 512-entry folder limit was reached. Inspect a smaller folder.",
            );
            break;
        }
        // Failed entries consume the same budget as successfully read entries.
        report.visited += 1;
        match entry {
            Ok(entry) => paths.push(entry.path()),
            Err(error) => issue(report, directory, error),
        }
    }
    paths.sort();
    for path in paths {
        if !path.is_dir() {
            continue;
        }
        let canonical = match fs::canonicalize(&path) {
            Ok(path) => path,
            Err(error) => {
                issue(report, &path, error);
                continue;
            }
        };
        if !canonical.starts_with(directory) {
            issue(report, &path, "Linked directory resolves outside the inspected folder. Inspect that package folder directly.");
            continue;
        }
        if !scope
            && path
                .file_name()
                .is_some_and(|name| name.to_string_lossy().starts_with('@'))
        {
            scan_children(report, &canonical, true);
        } else if path.join("package.json").exists() {
            inspect_package(report, &canonical);
        }
        if report.packages.len() >= PACKAGE_LIMIT {
            report.complete = false;
            issue(
                report,
                directory,
                "The 128-package inspection limit was reached. Inspect a smaller folder.",
            );
            break;
        }
    }
}

pub fn discover(directory: &Path, allow_missing: bool) -> Result<PluginDiscovery, String> {
    let exists = directory.try_exists().map_err(|e| e.to_string())?;
    if !exists && !allow_missing {
        return Err("The selected plugin folder does not exist.".into());
    }
    let root = if exists {
        fs::canonicalize(directory).map_err(|e| e.to_string())?
    } else {
        directory.to_path_buf()
    };
    if exists && !root.is_dir() {
        return Err("Select a plugin folder, not a file.".into());
    }
    let mut report = PluginDiscovery {
        directory: root.to_string_lossy().into_owned(),
        exists,
        complete: true,
        packages: Vec::new(),
        issues: Vec::new(),
        visited: 0,
    };
    if !exists {
        return Ok(report);
    }
    if root.join("package.json").exists() {
        match read_manifest(&root) {
            Ok(manifest) if manifest.get("insomnia").is_some() => {
                inspect_package(&mut report, &root)
            }
            Ok(_) => {
                scan_children(&mut report, &root, false);
                scan_children(&mut report, &root.join("node_modules"), false);
            }
            Err(error) => issue(&mut report, &root, error),
        }
    } else {
        scan_children(&mut report, &root, false);
        scan_children(&mut report, &root.join("node_modules"), false);
    }
    let mut counts = BTreeMap::new();
    for package in &report.packages {
        *counts.entry(package.name.clone()).or_insert(0) += 1;
    }
    for package in &mut report.packages {
        if counts.get(&package.name).is_some_and(|count| *count > 1) {
            package.status = "duplicate".into();
            package.message = "Multiple packages declare this name. Choose a folder containing a single version before activation.".into();
        }
    }
    report
        .packages
        .sort_by(|a, b| a.name.cmp(&b.name).then(a.directory.cmp(&b.directory)));
    Ok(report)
}

#[tauri::command]
pub async fn discover_plugins(
    app: tauri::AppHandle,
    directory: Option<String>,
) -> Result<PluginDiscovery, String> {
    let selected = directory.is_some();
    let path = match directory {
        Some(value) if !value.trim().is_empty() => PathBuf::from(value),
        Some(_) => return Err("Select a plugin folder.".into()),
        None => app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("plugins"),
    };
    tauri::async_runtime::spawn_blocking(move || discover(&path, !selected))
        .await
        .map_err(|e| e.to_string())?
}
