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

#[derive(Default)]
pub struct StorageState(pub Arc<Mutex<Session>>);
#[derive(Default)]
pub struct Session {
    loaded: bool,
    backed_up: bool,
}

fn validate(value: &Value) -> Result<(), String> {
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

pub(crate) fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = AtomicWriteFile::options()
        .open(path)
        .map_err(|e| e.to_string())?;
    file.write_all(bytes).map_err(|e| e.to_string())?;
    file.commit().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_workspace(
    app: tauri::AppHandle,
    state: tauri::State<'_, StorageState>,
) -> Result<Option<Value>, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("workspace-v1.json");
    let session = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut session = session.lock().map_err(|e| e.to_string())?;
        let result = match fs::read(&path) {
            Ok(bytes) => {
                let mut value: Value = serde_json::from_slice(&bytes).map_err(|e| {
                    format!(
                        "Workspace is damaged: {e}. Original file retained at {}",
                        path.display()
                    )
                })?;
                // Read the initial plugin-store format without rewriting it until an explicit save.
                if value.get("workspace").is_some() {
                    value = value["workspace"].take();
                }
                validate(&value)?;
                Some(value)
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
            Err(e) => return Err(e.to_string()),
        };
        session.loaded = true;
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn save_workspace(
    app: tauri::AppHandle,
    data: Value,
    state: tauri::State<'_, StorageState>,
) -> Result<(), String> {
    validate(&data)?;
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let session = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut session = session.lock().map_err(|e| e.to_string())?;
        if !session.loaded {
            return Err("Cannot save before workspace loads successfully".into());
        }
        fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
        let path = directory.join("workspace-v1.json");
        if !session.backed_up {
            match fs::read(&path) {
                Ok(bytes) => atomic_write(&directory.join("workspace-v1.previous.json"), &bytes)?,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
                Err(e) => return Err(e.to_string()),
            }
            session.backed_up = true;
        }
        let bytes = serde_json::to_vec(&data).map_err(|e| e.to_string())?;
        atomic_write(&path, &bytes)
    })
    .await
    .map_err(|e| e.to_string())?
}
