use atomic_write_file::AtomicWriteFile;
use serde_json::Value;
use std::{
    collections::HashSet,
    fs,
    io::Write,
    path::Path,
    sync::{Arc, Mutex},
};
use tauri::Manager;

pub(crate) const WORKSPACE_FILE: &str = "workspace-v1.json";
pub(crate) const PREVIOUS_WORKSPACE_FILE: &str = "workspace-v1.previous.json";
pub(crate) const GIT_TRANSITION_FILE: &str = "git-transition-v1.json";

#[derive(Default)]
pub struct StorageState(pub Arc<Mutex<Session>>);
#[derive(Default)]
pub struct Session {
    loaded: bool,
    backed_up: bool,
}

pub(crate) fn validate(value: &Value) -> Result<(), String> {
    if value.get("schemaVersion").and_then(Value::as_u64) != Some(1) {
        return Err("Unsupported workspace version. File was not changed.".into());
    }
    let resources = value
        .get("resources")
        .and_then(Value::as_array)
        .ok_or("Missing workspace resources")?;
    if !resources
        .iter()
        .any(|r| r.get("_type").and_then(Value::as_str) == Some("workspace"))
    {
        return Err("No collection in workspace data".into());
    }
    let mut ids = HashSet::new();
    for resource in resources {
        let id = resource
            .get("_id")
            .and_then(Value::as_str)
            .ok_or("Missing resource ID")?;
        if resource.get("_type").and_then(Value::as_str).is_none() || !ids.insert(id) {
            return Err("Invalid or duplicate resource".into());
        }
    }
    Ok(())
}

/// Ordinary operations must refuse any pending journal entry, including malformed
/// files, directories and links. Recovery will validate its contents under both locks.
/// Call while holding StorageState for workspace I/O or GitState for Git mutations.
pub(crate) fn ensure_no_pending_transition(directory: &Path) -> Result<(), String> {
    let clone = directory.join(crate::git_clone::install::JOURNAL);
    match fs::symlink_metadata(&clone) {
        Ok(_) => return Err("Clone installation recovery is required before writing; journal retained".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {},
        Err(error) => return Err(format!("Cannot inspect Clone recovery journal: {error}")),
    }
    let path = directory.join(GIT_TRANSITION_FILE);
    match fs::symlink_metadata(&path) {
        Ok(_) => Err(format!(
            "Workspace Git recovery is required before writing. Pending journal retained at {}",
            path.display()
        )),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "Could not inspect workspace Git recovery journal at {}: {error}",
            path.display()
        )),
    }
}

pub(crate) fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = AtomicWriteFile::options()
        .open(path)
        .map_err(|e| e.to_string())?;
    file.write_all(bytes).map_err(|e| e.to_string())?;
    file.commit().map_err(|e| e.to_string())
}

/// Shared read/validation path. Does not acknowledge a loaded storage session or
/// resolve a pending journal; callers own those decisions under their locks.
pub(crate) fn read_workspace_file(directory: &Path) -> Result<Option<Value>, String> {
    let path = directory.join(WORKSPACE_FILE);
    match fs::read(&path) {
        Ok(bytes) => {
            let mut value: Value = serde_json::from_slice(&bytes).map_err(|e| {
                format!(
                    "Workspace is damaged: {e}. Original file retained at {}",
                    path.display()
                )
            })?;
            // Initial plugin-store format stays unchanged until an explicit save.
            if value.get("workspace").is_some() {
                value = value["workspace"].take();
            }
            validate(&value)?;
            Ok(Some(value))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

/// Shared atomic write used after session/journal checks. Caller holds GitState
/// then StorageState, including Git transition recovery. Fetch binding protection
/// applies to every writer while the fetch journal remains present.
pub(crate) fn write_workspace_file(directory: &Path, data: &Value) -> Result<(), String> {
    validate(data)?;
    let before = read_workspace_file(directory)?;
    crate::git_fetch_journal::protect_workspace_bindings(directory, before.as_ref(), data)?;
    let bytes = serde_json::to_vec(data).map_err(|e| e.to_string())?;
    atomic_write(&directory.join(WORKSPACE_FILE), &bytes)
}

impl Session {
    pub(crate) fn require_loaded(&self) -> Result<(), String> {
        if !self.loaded {
            return Err("Cannot save before workspace loads successfully".into());
        }
        Ok(())
    }

    /// Preserve the first pre-save bytes once per successfully loaded session.
    /// A backup failure must not consume that first-backup opportunity.
    pub(crate) fn ensure_backup(&mut self, directory: &Path) -> Result<(), String> {
        self.require_loaded()?;
        fs::create_dir_all(directory).map_err(|e| e.to_string())?;
        if !self.backed_up {
            match fs::read(directory.join(WORKSPACE_FILE)) {
                Ok(bytes) => atomic_write(&directory.join(PREVIOUS_WORKSPACE_FILE), &bytes)?,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => (),
                Err(error) => return Err(error.to_string()),
            }
            self.backed_up = true;
        }
        Ok(())
    }

    pub(crate) fn load(&mut self, directory: &Path) -> Result<Option<Value>, String> {
        ensure_no_pending_transition(directory)?;
        let data = read_workspace_file(directory)?;
        self.loaded = true;
        Ok(data)
    }

    pub(crate) fn save(&mut self, directory: &Path, data: &Value) -> Result<(), String> {
        validate(data)?;
        self.require_loaded()?;
        ensure_no_pending_transition(directory)?;
        self.ensure_backup(directory)?;
        write_workspace_file(directory, data)
    }
}

#[tauri::command]
pub async fn load_workspace(
    app: tauri::AppHandle,
    git_state: tauri::State<'_, crate::git::GitState>,
    state: tauri::State<'_, StorageState>,
) -> Result<Option<Value>, String> {
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let session = state.0.clone();
    let git_lock = git_state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _git_guard = git_lock.lock().map_err(|e| e.to_string())?;
        let mut session = session.lock().map_err(|e| e.to_string())?;
        crate::git_clone::install::recover(&directory)?;
        crate::git_journal::recover(&directory)?;
        session.load(&directory)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn save_workspace(
    app: tauri::AppHandle,
    data: Value,
    git_state: tauri::State<'_, crate::git::GitState>,
    state: tauri::State<'_, StorageState>,
) -> Result<(), String> {
    validate(&data)?;
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let session = state.0.clone();
    let git_lock = git_state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _git_guard = git_lock.lock().map_err(|e| e.to_string())?;
        session
            .lock()
            .map_err(|e| e.to_string())?
            .save(&directory, &data)
    })
    .await
    .map_err(|e| e.to_string())?
}
