//! Locally selected download directories are authority, not imported metadata.
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    sync::{Arc, LazyLock, Mutex},
};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

pub struct DownloadState(Arc<Mutex<()>>);
static DESTINATIONS_LOCK: LazyLock<Arc<Mutex<()>>> = LazyLock::new(|| Arc::new(Mutex::new(())));
impl Default for DownloadState {
    fn default() -> Self {
        Self(DESTINATIONS_LOCK.clone())
    }
}

#[derive(Serialize, Deserialize, PartialEq, Eq)]
struct DirectoryIdentity {
    volume: u64,
    file: u64,
    birth: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(untagged)]
enum Destination {
    Bound {
        directory: PathBuf,
        identity: DirectoryIdentity,
    },
    Legacy(PathBuf),
}
impl Destination {
    fn path(&self) -> &Path {
        match self {
            Self::Bound { directory, .. } | Self::Legacy(directory) => directory,
        }
    }
}

#[cfg(windows)]
fn open_directory(path: &Path) -> Result<(fs::File, DirectoryIdentity), String> {
    use std::os::windows::{fs::OpenOptionsExt, io::AsRawHandle};
    use windows::Win32::{
        Foundation::HANDLE,
        Storage::FileSystem::{
            GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION, FILE_FLAG_BACKUP_SEMANTICS,
            FILE_READ_ATTRIBUTES, FILE_SHARE_READ, FILE_SHARE_WRITE,
        },
    };
    let file = fs::OpenOptions::new()
        .access_mode(FILE_READ_ATTRIBUTES.0)
        .share_mode(FILE_SHARE_READ.0 | FILE_SHARE_WRITE.0)
        .custom_flags(FILE_FLAG_BACKUP_SEMANTICS.0)
        .open(path)
        .map_err(|e| e.to_string())?;
    if !file.metadata().map_err(|e| e.to_string())?.is_dir() {
        return Err("Download destination is not a directory".into());
    }
    let mut info = BY_HANDLE_FILE_INFORMATION::default();
    // File owns this borrowed handle; keep it alive through the accepted write.
    unsafe { GetFileInformationByHandle(HANDLE(file.as_raw_handle()), &mut info) }
        .map_err(|e| e.to_string())?;
    Ok((
        file,
        DirectoryIdentity {
            volume: u64::from(info.dwVolumeSerialNumber),
            file: (u64::from(info.nFileIndexHigh) << 32) | u64::from(info.nFileIndexLow),
            birth: Some(format!(
                "{}:{}",
                info.ftCreationTime.dwHighDateTime, info.ftCreationTime.dwLowDateTime
            )),
        },
    ))
}

#[cfg(unix)]
fn open_directory(path: &Path) -> Result<(fs::File, DirectoryIdentity), String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let identity = unix_directory_identity(&file)?;
    Ok((file, identity))
}

#[cfg(unix)]
fn unix_directory_identity(file: &fs::File) -> Result<DirectoryIdentity, String> {
    use std::os::unix::fs::MetadataExt;
    let info = file.metadata().map_err(|e| e.to_string())?;
    if !info.is_dir() {
        return Err("Download destination is not a directory".into());
    }
    let birth = info
        .created()
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|time| format!("{}:{}", time.as_secs(), time.subsec_nanos()));
    Ok(DirectoryIdentity {
        volume: info.dev(),
        file: info.ino(),
        birth,
    })
}

fn write_download(path: &Path, bytes: &[u8], expected: &DirectoryIdentity) -> Result<(), String> {
    use std::io::Write;
    let mut file = atomic_write_file::AtomicWriteFile::open(path).map_err(|e| e.to_string())?;
    let prepared = (|| -> Result<(), String> {
        #[cfg(unix)]
        {
            use std::os::fd::AsFd;
            // Verify the writer's actual directory, not another path lookup.
            // The atomic writer retains this FD for its later renameat commit.
            let directory = file
                .directory()
                .ok_or("Atomic download directory is unavailable")?;
            let owned = directory
                .as_fd()
                .try_clone_to_owned()
                .map_err(|e| e.to_string())?;
            let directory_file = fs::File::from(owned);
            if unix_directory_identity(&directory_file)? != *expected {
                return Err("Download directory changed before writing; choose it again".into());
            }
        }
        #[cfg(not(unix))]
        let _ = expected;
        file.write_all(bytes).map_err(|e| e.to_string())
    })();
    if let Err(error) = prepared {
        return match file.discard() {
            Ok(()) => Err(error),
            Err(cleanup) => Err(format!(
                "{error}; temporary download cleanup failed: {cleanup}"
            )),
        };
    }
    file.commit().map_err(|e| e.to_string())
}

#[cfg(not(any(windows, unix)))]
fn open_directory(_path: &Path) -> Result<(fs::File, DirectoryIdentity), String> {
    Err("Download directory identity is unavailable on this platform".into())
}

fn destinations(root: &Path) -> Result<BTreeMap<String, Destination>, String> {
    let config = root.join("response-downloads-v1.json");
    let values: BTreeMap<String, Destination> = match fs::metadata(&config) {
        Ok(info) if info.len() <= 2 * 1024 * 1024 => {
            serde_json::from_slice(&fs::read(&config).map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?
        }
        Ok(_) => return Err("Download destinations file is too large".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => BTreeMap::new(),
        Err(error) => return Err(error.to_string()),
    };
    if values.len() > 4096 {
        return Err("Too many download destinations".into());
    }
    Ok(values)
}

fn live_keys(data: &serde_json::Value) -> Result<HashSet<String>, String> {
    let resources = data["resources"]
        .as_array()
        .ok_or("Missing workspace resources")?;
    let records: HashMap<&str, &serde_json::Value> = resources
        .iter()
        .filter_map(|r| r["_id"].as_str().map(|id| (id, r)))
        .collect();
    records
        .iter()
        .filter(|(_, r)| r["_type"] == "request")
        .map(|(id, _)| {
            let owner = crate::resource_topology::owner(&records, id)
                .ok_or("Missing request collection")?;
            serde_json::to_string(&(owner, id)).map_err(|e| e.to_string())
        })
        .collect()
}

/// Revoke removed owners before committing their deletion, serialized with
/// selection and writes. A failed workspace commit cannot restore old grants.
pub(crate) fn with_workspace_write(
    root: &Path,
    data: &serde_json::Value,
    write: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    let _guard = DESTINATIONS_LOCK.lock().map_err(|e| e.to_string())?;
    let mut values = destinations(root)?;
    if !values.is_empty() {
        let live = live_keys(data)?;
        let before = values.len();
        values.retain(|key, _| live.contains(key));
        if values.len() != before {
            crate::storage::atomic_write(
                &root.join("response-downloads-v1.json"),
                &serde_json::to_vec(&values).map_err(|e| e.to_string())?,
            )?;
        }
    }
    write()
}

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
            let mut destinations = destinations(&root)?;
            let workspace =
                crate::storage::read_workspace_file(&root)?.ok_or("Workspace is not saved")?;
            if operation != "clear" && !live_keys(&workspace)?.contains(&key) {
                return if operation == "get" {
                    Ok(None)
                } else {
                    Err("Request no longer belongs to this collection".into())
                };
            }
            match operation.as_str() {
                "get" => Ok(destinations
                    .get(&key)
                    .map(|p| p.path().to_string_lossy().into_owned())),
                "choose" | "clear" => {
                    if let Some(directory) = directory {
                        let directory = directory.canonicalize().map_err(|e| e.to_string())?;
                        if !directory.is_dir() {
                            return Err("Choose a download directory".into());
                        }
                        if !destinations.contains_key(&key) && destinations.len() == 4096 {
                            return Err("Too many download destinations".into());
                        }
                        let (_handle, identity) = open_directory(&directory)?;
                        destinations.insert(
                            key.clone(),
                            Destination::Bound {
                                directory,
                                identity,
                            },
                        );
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
                        .map(|p| p.path().to_string_lossy().into_owned()))
                }
                "write" => {
                    let destination = destinations
                        .get(&key)
                        .ok_or("Choose a download directory first")?;
                    let Destination::Bound {
                        directory,
                        identity,
                    } = destination
                    else {
                        return Err(
                            "Download directory identity is missing; choose it again".into()
                        );
                    };
                    if !directory.is_absolute()
                        || directory.canonicalize().map_err(|e| e.to_string())? != *directory
                    {
                        return Err("Download directory changed; choose it again".into());
                    }
                    let (_directory_handle, current_identity) = open_directory(directory)?;
                    if current_identity != *identity {
                        return Err("Download directory was replaced; choose it again".into());
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
                    write_download(&path, &bytes, identity)?;
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
