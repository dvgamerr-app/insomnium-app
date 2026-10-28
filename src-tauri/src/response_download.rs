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

#[cfg(windows)]
fn write_download(path: &Path, bytes: &[u8], expected: &DirectoryIdentity) -> Result<(), String> {
    let directory = path.parent().ok_or("Missing download directory")?;
    let (_handle, identity) = open_directory(directory)?;
    if identity != *expected {
        return Err("Download directory changed before writing; choose it again".into());
    }
    crate::storage::atomic_write(path, bytes)
}

#[cfg(unix)]
fn write_download(path: &Path, bytes: &[u8], expected: &DirectoryIdentity) -> Result<(), String> {
    let (directory, identity) = open_directory(path.parent().ok_or("Missing download directory")?)?;
    if identity != *expected {
        return Err("Download directory changed before writing; choose it again".into());
    }
    crate::storage::atomic_write_in(
        &directory,
        path.file_name().ok_or("Missing download filename")?,
        bytes,
    )
}

#[cfg(not(any(windows, unix)))]
fn write_download(
    _path: &Path,
    _bytes: &[u8],
    _expected: &DirectoryIdentity,
) -> Result<(), String> {
    Err("Atomic file saving is unavailable on this platform".into())
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
    #[serde(default)]
    workspace_id: String,
    #[serde(default)]
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
        && !["con", "prn", "aux", "nul", "conin$", "conout$"].contains(&stem.as_str())
        // Win32 also reserves the ISO-8859-1 superscript digits in COM/LPT
        // device names, including when followed by a filename extension.
        && !stem
            .strip_prefix("com")
            .or_else(|| stem.strip_prefix("lpt"))
            .is_some_and(|suffix| {
                matches!(
                    suffix,
                    "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "¹" | "²" | "³"
                )
            })
}

#[cfg(test)]
mod tests {
    #[cfg(any(windows, unix))]
    #[test]
    fn download_write_preserves_long_names_and_cleans_failed_commits() {
        let directory =
            std::env::temp_dir().join(format!("insomnium-download-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&directory).unwrap();
        let result = std::panic::catch_unwind(|| {
            let (_handle, identity) = super::open_directory(&directory).unwrap();
            #[cfg(target_os = "linux")]
            let acl = {
                use std::os::fd::AsRawFd;
                let acl = |user: u32, permissions: u16| {
                    let mut bytes = 2u32.to_le_bytes().to_vec();
                    for (tag, access, id) in [
                        (1u16, 6u16, u32::MAX),
                        (2, permissions, user),
                        (4, 0, u32::MAX),
                        (16, permissions, u32::MAX),
                        (32, 0, u32::MAX),
                    ] {
                        bytes.extend(tag.to_le_bytes());
                        bytes.extend(access.to_le_bytes());
                        bytes.extend(id.to_le_bytes());
                    }
                    bytes
                };
                let inherited = acl(2000, 6);
                assert_eq!(
                    unsafe {
                        crate::storage::fsetxattr(
                            _handle.as_raw_fd(),
                            c"system.posix_acl_default".as_ptr(),
                            inherited.as_ptr().cast(),
                            inherited.len(),
                            0,
                        )
                    },
                    0
                );
                acl(1001, 4)
            };
            for name in [
                "_COM¹.bin".into(),
                "a".repeat(251) + ".bin",
                "ไทย".repeat(27) + "ไท.bin",
            ] {
                assert!(super::filename(&name));
                let path = directory.join(name);
                crate::storage::atomic_write(&path, &[0, 255, 13, 10]).unwrap();
                assert_eq!(std::fs::read(&path).unwrap(), [0, 255, 13, 10]);
                #[cfg(windows)]
                {
                    let created = std::fs::metadata(&path).unwrap().created().unwrap();
                    let stream = std::path::PathBuf::from(format!("{}:owned", path.display()));
                    std::fs::write(&stream, [9, 8, 7]).unwrap();
                    use std::os::windows::ffi::OsStrExt;
                    use windows::{
                        core::{w, PCWSTR},
                        Win32::{
                            Foundation::{LocalFree, HLOCAL},
                            Security::{
                                Authorization::ConvertStringSecurityDescriptorToSecurityDescriptorW,
                                GetFileSecurityW, SetFileSecurityW, DACL_SECURITY_INFORMATION,
                                PROTECTED_DACL_SECURITY_INFORMATION, PSECURITY_DESCRIPTOR,
                                SE_DACL_AUTO_INHERITED,
                            },
                        },
                    };
                    let wide = path
                        .canonicalize()
                        .unwrap()
                        .as_os_str()
                        .encode_wide()
                        .chain(Some(0))
                        .collect::<Vec<_>>();
                    let mut descriptor = PSECURITY_DESCRIPTOR::default();
                    unsafe {
                        ConvertStringSecurityDescriptorToSecurityDescriptorW(
                            w!("D:P(A;;FA;;;OW)"),
                            1,
                            &mut descriptor,
                            None,
                        )
                        .unwrap();
                        let secured = SetFileSecurityW(
                            PCWSTR(wide.as_ptr()),
                            DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
                            descriptor,
                        );
                        let _ = LocalFree(Some(HLOCAL(descriptor.0)));
                        secured.ok().unwrap();
                    }
                    let security = || {
                        let mut descriptor = [0u32; 128];
                        let mut length = 0;
                        unsafe {
                            GetFileSecurityW(
                                PCWSTR(wide.as_ptr()),
                                DACL_SECURITY_INFORMATION.0,
                                Some(PSECURITY_DESCRIPTOR(descriptor.as_mut_ptr().cast())),
                                size_of_val(&descriptor) as u32,
                                &mut length,
                            )
                            .ok()
                            .unwrap();
                        }
                        // Creation may mark identical ACEs auto-inherited; compare all ACEs and protection.
                        descriptor[0] &= !((SE_DACL_AUTO_INHERITED.0 as u32) << 16);
                        descriptor[..(length as usize).div_ceil(4)].to_vec()
                    };
                    let permissions = security();
                    super::write_download(&path, &[42, 0], &identity).unwrap();
                    assert_eq!(std::fs::read(&path).unwrap(), [42, 0]);
                    assert_eq!(
                        std::fs::metadata(&path).unwrap().created().unwrap(),
                        created
                    );
                    assert_eq!(std::fs::read(&stream).unwrap(), [9, 8, 7]);
                    assert_eq!(security(), permissions);
                }
                #[cfg(unix)]
                {
                    use std::os::unix::fs::MetadataExt;
                    let source = std::fs::OpenOptions::new().write(true).open(&path).unwrap();
                    #[cfg(target_os = "linux")]
                    {
                        use std::os::fd::AsRawFd;
                        for (name, value) in [
                            (c"system.posix_acl_access", acl.as_slice()),
                            (c"user.insomnium", &[0, 255, 42]),
                            (c"user.insomnium-empty", &[]),
                        ] {
                            assert_eq!(
                                unsafe {
                                    crate::storage::fsetxattr(
                                        source.as_raw_fd(),
                                        name.as_ptr(),
                                        value.as_ptr().cast(),
                                        value.len(),
                                        0,
                                    )
                                },
                                0
                            );
                        }
                    }
                    let original = source.metadata().unwrap();
                    super::write_download(&path, &[42, 0], &identity).unwrap();
                    assert_eq!(std::fs::read(&path).unwrap(), [42, 0]);
                    let saved = std::fs::File::open(&path).unwrap();
                    let metadata = saved.metadata().unwrap();
                    assert_eq!(
                        (metadata.uid(), metadata.gid(), metadata.mode()),
                        (original.uid(), original.gid(), original.mode())
                    );
                    #[cfg(target_os = "linux")]
                    {
                        use std::os::fd::AsRawFd;
                        for (name, expected) in [
                            (c"system.posix_acl_access", acl.as_slice()),
                            (c"user.insomnium", &[0, 255, 42]),
                            (c"user.insomnium-empty", &[]),
                        ] {
                            let mut value = [0u8; 128];
                            let length = unsafe {
                                crate::storage::fgetxattr(
                                    saved.as_raw_fd(),
                                    name.as_ptr(),
                                    value.as_mut_ptr().cast(),
                                    value.len(),
                                )
                            };
                            assert!(length >= 0, "{}", std::io::Error::last_os_error());
                            assert_eq!(&value[..length as usize], expected);
                        }
                    }
                }
                std::fs::remove_file(path).unwrap();
            }
            #[cfg(target_os = "linux")]
            {
                use std::os::{fd::AsRawFd, unix::fs::PermissionsExt};
                let path = directory.join("without-acl.bin");
                std::fs::write(&path, [9, 8, 7]).unwrap();
                let file = std::fs::File::open(&path).unwrap();
                assert_eq!(
                    unsafe {
                        crate::storage::fremovexattr(
                            file.as_raw_fd(),
                            c"system.posix_acl_access".as_ptr(),
                        )
                    },
                    0
                );
                file.set_permissions(std::fs::Permissions::from_mode(0o640))
                    .unwrap();
                super::write_download(&path, &[42, 0], &identity).unwrap();
                let file = std::fs::File::open(&path).unwrap();
                assert_eq!(std::fs::read(&path).unwrap(), [42, 0]);
                assert_eq!(
                    unsafe {
                        crate::storage::fgetxattr(
                            file.as_raw_fd(),
                            c"system.posix_acl_access".as_ptr(),
                            std::ptr::null_mut(),
                            0,
                        )
                    },
                    -1
                );
                assert_eq!(nix::errno::Errno::last(), nix::errno::Errno::ENODATA);
                if !nix::unistd::geteuid().is_root() {
                    file.set_permissions(std::fs::Permissions::from_mode(0o440))
                        .unwrap();
                    assert!(super::write_download(&path, &[1, 2], &identity).is_err());
                    assert_eq!(std::fs::read(&path).unwrap(), [42, 0]);
                    assert_eq!(std::fs::read_dir(&directory).unwrap().count(), 1);
                }
                std::fs::remove_file(&path).unwrap();
                let link = directory.join("linked.bin");
                std::os::unix::fs::symlink("not-created.bin", &link).unwrap();
                assert!(super::write_download(&link, &[1, 2], &identity).is_err());
                assert!(std::fs::symlink_metadata(&link).unwrap().is_symlink());
                std::fs::remove_file(&link).unwrap();
            }
            let blocked = directory.join("existing-directory.bin");
            std::fs::create_dir(&blocked).unwrap();
            assert!(super::write_download(&blocked, &[1, 2], &identity).is_err());
            assert!(blocked.is_dir());
            assert_eq!(std::fs::read_dir(&directory).unwrap().count(), 1);
            std::fs::remove_dir(&blocked).unwrap();

            // A failed replacement must retain the original file's bytes.
            #[cfg(windows)]
            {
                use std::os::windows::fs::OpenOptionsExt;
                let locked = directory.join("locked.bin");
                std::fs::write(&locked, [9, 8, 7]).unwrap();
                let lock = std::fs::OpenOptions::new()
                    .read(true)
                    .share_mode(0)
                    .open(&locked)
                    .unwrap();
                assert!(super::write_download(&locked, &[1, 2], &identity).is_err());
                drop(lock);
                assert_eq!(std::fs::read(&locked).unwrap(), [9, 8, 7]);
                assert_eq!(std::fs::read_dir(&directory).unwrap().count(), 1);
                std::fs::remove_file(&locked).unwrap();
            }

            // Reusing a pathname must not reuse the old directory's authority.
            let selected = directory.join("selected");
            let retired = directory.join("retired");
            std::fs::create_dir(&selected).unwrap();
            let (handle, selected_identity) = super::open_directory(&selected).unwrap();
            drop(handle);
            std::fs::rename(&selected, &retired).unwrap();
            std::fs::create_dir(&selected).unwrap();
            assert!(super::write_download(
                &selected.join("refused.bin"),
                &[1, 2],
                &selected_identity
            )
            .is_err());
            assert_eq!(std::fs::read_dir(&selected).unwrap().count(), 0);
            assert_eq!(std::fs::read_dir(&retired).unwrap().count(), 0);
        });
        std::fs::remove_dir_all(&directory).unwrap();
        if let Err(error) = result {
            std::panic::resume_unwind(error);
        }
    }

    #[test]
    fn download_filenames_reject_windows_devices() {
        for name in ["CONIN$", "conout$", "CONIN$.txt", "ConOut$.json"] {
            assert!(!super::filename(name), "{name}");
        }
        for prefix in ["COM", "com", "LPT", "lpt"] {
            for digit in ["1", "2", "3", "4", "5", "6", "7", "8", "9", "¹", "²", "³"] {
                for extension in ["", ".txt", ".data.json"] {
                    assert!(!super::filename(&format!("{prefix}{digit}{extension}")));
                }
            }
        }
        for name in [
            "report.txt",
            "_COM¹.txt",
            "COM0.txt",
            "LPT10.json",
            "COM⁴.txt",
            "report.COM¹",
            "CONIN$extra.txt",
            "CONOUT$-backup",
        ] {
            assert!(super::filename(name), "{name}");
        }
    }
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
    let selected_file = ["save", "export"].contains(&request.operation.as_str());
    if request.id.is_empty()
        || request.id.len() > 256
        || (!selected_file
            && (request.workspace_id.is_empty()
                || request.request_id.is_empty()
                || request.workspace_id.len() > 512
                || request.request_id.len() > 512
                || !["get", "choose", "clear", "write"].contains(&request.operation.as_str())))
    {
        return Err("Invalid response download operation".into());
    }
    let lease = Arc::new(network.retain_native_work(request.id.clone())?);
    network.publish_started(&request.id, on_started, webview)?;
    let result = async {
        if selected_file {
            let name = request.name.ok_or("Missing download filename")?;
            if !filename(&name) {
                return Err("Invalid download filename".into());
            }
            let encoded = request.body_base64.ok_or("Missing download bytes")?;
            let decode_lease = lease.clone();
            let bytes = tauri::async_runtime::spawn_blocking(move || {
                if decode_lease.cancelled() {
                    return Err("File save cancelled".to_string());
                }
                STANDARD.decode(encoded).map_err(|error| error.to_string())
            })
            .await
            .map_err(|error| error.to_string())??;
            if lease.cancelled() {
                return Err("File save cancelled".into());
            }
            let (sender, receiver) = tokio::sync::oneshot::channel();
            let dialog = app.dialog().file().set_file_name(name);
            let dialog = if request.operation == "export" {
                dialog.add_filter("Insomnium JSON", &["json"])
            } else {
                dialog
            };
            #[cfg(desktop)]
            let dialog = dialog.set_parent(&window);
            let chooser_lease = lease.clone();
            dialog.save_file(move |path| {
                let _lease = chooser_lease;
                let _ = sender.send(path);
            });
            let selected = receiver.await.map_err(|_| "Save dialog closed")?;
            if lease.cancelled() {
                return Err("File save cancelled".into());
            }
            let Some(path) = selected else {
                return Ok(None);
            };
            let path = path.into_path().map_err(|error| error.to_string())?;
            let write_lease = lease.clone();
            return tauri::async_runtime::spawn_blocking(move || {
                if write_lease.cancelled() {
                    return Err("File save cancelled".into());
                }
                if !path.is_absolute() {
                    return Err("Select an absolute save destination".into());
                }
                let directory = path
                    .parent()
                    .ok_or("Missing save directory")?
                    .canonicalize()
                    .map_err(|error| error.to_string())?;
                let path = directory.join(path.file_name().ok_or("Missing save filename")?);
                let (_handle, identity) = open_directory(&directory)?;
                if write_lease.cancelled() {
                    return Err("File save cancelled".into());
                }
                write_download(&path, &bytes, &identity)?;
                Ok(Some(path.to_string_lossy().into_owned()))
            })
            .await
            .map_err(|error| error.to_string())?;
        }
        let directory = if request.operation == "choose" {
            if lease.cancelled() {
                return Err("Download selection cancelled".into());
            }
            let (sender, receiver) = tokio::sync::oneshot::channel();
            let dialog = app.dialog().file().set_title("Select Download Location");
            #[cfg(desktop)]
            let dialog = dialog.set_parent(&window);
            let chooser_lease = lease.clone();
            dialog.pick_folder(move |path| {
                let _lease = chooser_lease;
                let _ = sender.send(path);
            });
            let selected = receiver.await.map_err(|_| "Download chooser closed")?;
            if lease.cancelled() {
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
        let lease = lease.clone();
        // Never detach a selected directory update or an accepted file write.
        tauri::async_runtime::spawn_blocking(move || -> Result<Option<String>, String> {
            let _guard = lock.lock().map_err(|e| e.to_string())?;
            if lease.cancelled() {
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
                    if lease.cancelled() {
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
                    if lease.cancelled() {
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
    result
}
