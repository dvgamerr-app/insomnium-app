//! Locally selected download directories are authority, not imported metadata.
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Deserialize;
use std::{
    collections::BTreeMap,
    fs,
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
pub struct DownloadState(Arc<Mutex<()>>);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DownloadRequest {
    id: String,
    workspace_id: String,
    request_id: String,
    operation: String,
    name: Option<String>,
    body_base64: Option<String>,
}

fn filename(name: &str) -> bool {
    let stem = name.split('.').next().unwrap_or("").to_ascii_lowercase();
    !name.is_empty()
        && name.len() <= 255
        && name != "."
        && name != ".."
        && !name.ends_with(['.', ' '])
        && !name
            .chars()
            .any(|c| c.is_control() || "\\/<>:\"|?*".contains(c))
        && !["con", "prn", "aux", "nul"].contains(&stem.as_str())
        && !(stem.len() == 4
            && (stem.starts_with("com") || stem.starts_with("lpt"))
            && matches!(stem.as_bytes()[3], b'1'..=b'9'))
}

#[tauri::command]
pub async fn response_download(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    webview: tauri::Webview,
    state: tauri::State<'_, DownloadState>,
    network: tauri::State<'_, crate::http::NetworkState>,
    request: DownloadRequest,
    on_started: Option<tauri::ipc::JavaScriptChannelId>,
) -> Result<Option<String>, String> {
    if request.id.is_empty()
        || request.id.len() > 256
        || request.workspace_id.is_empty()
        || request.request_id.is_empty()
        || request.workspace_id.len() > 512
        || request.request_id.len() > 512
        || !["get", "choose", "clear", "write"].contains(&request.operation.as_str())
    {
        return Err("Invalid response download operation".into());
    }
    let cancelled = network.begin(&request.id)?;
    network.publish_started(&request.id, on_started, webview)?;
    let result = async {
        let directory = if request.operation == "choose" {
            if *cancelled.borrow() {
                return Err("Download selection cancelled".into());
            }
            let (sender, receiver) = tokio::sync::oneshot::channel();
            let dialog = app.dialog().file().set_title("Select Download Location");
            #[cfg(desktop)]
            let dialog = dialog.set_parent(&window);
            dialog.pick_folder(move |path| {
                let _ = sender.send(path);
            });
            let selected = receiver.await.map_err(|_| "Download chooser closed")?;
            if *cancelled.borrow() {
                return Err("Download selection cancelled".into());
            }
            let Some(path) = selected else {
                return Ok(None);
            };
            Some(path.into_path().map_err(|e| e.to_string())?)
        } else {
            None
        };
        let root = app.path().app_data_dir().map_err(|e| e.to_string())?;
        let lock = state.0.clone();
        let operation = request.operation.clone();
        let key = serde_json::to_string(&(&request.workspace_id, &request.request_id))
            .map_err(|e| e.to_string())?;
        let name = request.name.clone();
        let encoded = request.body_base64.clone();
        // Never detach a selected directory update or an accepted file write.
        tauri::async_runtime::spawn_blocking(move || -> Result<Option<String>, String> {
            let _guard = lock.lock().map_err(|e| e.to_string())?;
            if *cancelled.borrow() {
                return Err("Response download cancelled".into());
            }
            let config = root.join("response-downloads-v1.json");
            let mut destinations: BTreeMap<String, PathBuf> = match fs::metadata(&config) {
                Ok(info) if info.len() <= 2 * 1024 * 1024 => {
                    serde_json::from_slice(&fs::read(&config).map_err(|e| e.to_string())?)
                        .map_err(|e| e.to_string())?
                }
                Ok(_) => return Err("Download destinations file is too large".into()),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => BTreeMap::new(),
                Err(error) => return Err(error.to_string()),
            };
            if destinations.len() > 4096 {
                return Err("Too many download destinations".into());
            }
            match operation.as_str() {
                "get" => Ok(destinations
                    .get(&key)
                    .map(|p| p.to_string_lossy().into_owned())),
                "choose" | "clear" => {
                    if let Some(directory) = directory {
                        let directory = directory.canonicalize().map_err(|e| e.to_string())?;
                        if !directory.is_dir() {
                            return Err("Choose a download directory".into());
                        }
                        if !destinations.contains_key(&key) && destinations.len() == 4096 {
                            return Err("Too many download destinations".into());
                        }
                        destinations.insert(key.clone(), directory);
                    } else {
                        destinations.remove(&key);
                    }
                    if *cancelled.borrow() {
                        return Err("Download selection cancelled".into());
                    }
                    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
                    let bytes = serde_json::to_vec(&destinations).map_err(|e| e.to_string())?;
                    if bytes.len() > 2 * 1024 * 1024 {
                        return Err("Download destinations file is too large".into());
                    }
                    crate::storage::atomic_write(&config, &bytes)?;
                    Ok(destinations
                        .get(&key)
                        .map(|p| p.to_string_lossy().into_owned()))
                }
                "write" => {
                    let directory = destinations
                        .get(&key)
                        .ok_or("Choose a download directory first")?;
                    if !directory.is_absolute()
                        || directory.canonicalize().map_err(|e| e.to_string())? != *directory
                    {
                        return Err("Download directory changed; choose it again".into());
                    }
                    let name = name.ok_or("Missing download filename")?;
                    if !filename(&name) {
                        return Err("Invalid download filename".into());
                    }
                    let encoded = encoded.ok_or("Missing response bytes")?;
                    if encoded.len() > 28 * 1024 * 1024 {
                        return Err("Response download exceeds 20 MiB".into());
                    }
                    let bytes = STANDARD.decode(encoded).map_err(|e| e.to_string())?;
                    if bytes.len() > 20 * 1024 * 1024 {
                        return Err("Response download exceeds 20 MiB".into());
                    }
                    if *cancelled.borrow() {
                        return Err("Response download cancelled".into());
                    }
                    let path = directory.join(name);
                    crate::storage::atomic_write(&path, &bytes)?;
                    Ok(Some(path.to_string_lossy().into_owned()))
                }
                _ => unreachable!(),
            }
        })
        .await
        .map_err(|e| e.to_string())?
    }
    .await;
    let finished = network.finish(&request.id);
    finished?;
    result
}
