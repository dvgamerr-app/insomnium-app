use crate::http::NetworkState;
#[cfg(not(any(windows, unix)))]
use atomic_write_file::AtomicWriteFile;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
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
    let mut records = HashMap::new();
    for resource in resources {
        let id = resource
            .get("_id")
            .and_then(Value::as_str)
            .ok_or("Missing resource ID")?;
        if id.is_empty()
            || resource.get("_type").and_then(Value::as_str).is_none()
            || records.insert(id, resource).is_some()
        {
            return Err("Invalid or duplicate resource".into());
        }
        if resource["_type"] == "grpc_request" {
            if let Some(metadata) = resource.get("metadata").filter(|rows| !rows.is_null()) {
                if metadata
                    .as_array()
                    .is_none_or(|rows| rows.iter().any(|row| !row.is_object()))
                {
                    let name = resource["name"]
                        .as_str()
                        .filter(|name| !name.is_empty())
                        .unwrap_or(id);
                    return Err(format!(
                        "Invalid metadata for {name}: expected an array of metadata records."
                    ));
                }
            }
        }
    }
    crate::resource_topology::validate(&records)?;
    if let Some(tabs) = value.get("openTabs").filter(|tabs| !tabs.is_null()) {
        if tabs
            .as_array()
            .is_none_or(|tabs| tabs.iter().any(|tab| !tab.is_string()))
        {
            return Err("Invalid saved request tabs".into());
        }
    }
    if let Some(history) = value.get("history").filter(|history| !history.is_null()) {
        let mut history_ids = std::collections::HashSet::new();
        for entry in history.as_array().ok_or("Invalid saved response history")? {
            if entry.get("requestId").and_then(Value::as_str).is_none() {
                return Err("Invalid saved response history".into());
            }
            if let Some(id) = entry.get("_id").filter(|id| !id.is_null()) {
                let id = id
                    .as_str()
                    .ok_or("Invalid or duplicate saved response ID")?;
                if id.is_empty() || !history_ids.insert(id) {
                    return Err("Invalid or duplicate saved response ID".into());
                }
            }
            for field in ["headers", "trailers", "requestHeaders"] {
                if let Some(rows) = entry.get(field).filter(|rows| !rows.is_null()) {
                    if rows.as_array().is_none_or(|rows| {
                        rows.iter().any(|row| {
                            row.as_array().is_none_or(|pair| {
                                pair.len() < 2 || !pair[0].is_string() || !pair[1].is_string()
                            })
                        })
                    }) {
                        return Err(format!("Invalid saved response {field}"));
                    }
                }
            }
            if let Some(log) = entry.get("networkLog").filter(|log| !log.is_null()) {
                if log
                    .as_array()
                    .is_none_or(|lines| lines.iter().any(|line| !line.is_string()))
                {
                    return Err("Invalid saved response networkLog".into());
                }
            }
            if matches!(
                entry.get("protocol").and_then(Value::as_str),
                Some("websocket" | "sse" | "grpc")
            ) {
                if let Some(events) = entry.get("events").filter(|events| !events.is_null()) {
                    let events = events.as_array().ok_or("Invalid saved stream events")?;
                    if events.iter().any(|event| !event.is_object()) {
                        return Err("Invalid saved stream events".into());
                    }
                    let mut event_ids = std::collections::HashSet::new();
                    for event in events {
                        if let Some(id) = event.get("_id").filter(|id| !id.is_null()) {
                            let id = id
                                .as_str()
                                .ok_or("Invalid or duplicate saved stream event ID")?;
                            if id.is_empty() || !event_ids.insert(id) {
                                return Err("Invalid or duplicate saved stream event ID".into());
                            }
                        }
                    }
                }
            }
        }
    }
    if let Some(selections) = value
        .get("responseSelections")
        .filter(|selections| !selections.is_null())
    {
        if selections
            .as_object()
            .is_none_or(|selections| selections.values().any(|selection| !selection.is_string()))
        {
            return Err("Invalid saved response selections".into());
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
        Ok(_) => {
            return Err(
                "Clone installation recovery is required before writing; journal retained".into(),
            )
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
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

#[cfg(windows)]
pub(crate) fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    use std::os::windows::{
        ffi::OsStrExt,
        fs::{MetadataExt, OpenOptionsExt},
        io::{AsRawHandle, FromRawHandle},
    };
    use windows::{
        core::PCWSTR,
        Win32::{
            Foundation::{LocalFree, GENERIC_WRITE, HANDLE, HLOCAL},
            Security::{
                Authorization::{GetSecurityInfo, SE_FILE_OBJECT},
                DACL_SECURITY_INFORMATION, GROUP_SECURITY_INFORMATION, OWNER_SECURITY_INFORMATION,
                PSECURITY_DESCRIPTOR, SECURITY_ATTRIBUTES,
            },
            Storage::FileSystem::{
                CreateFileW, MoveFileExW, ReplaceFileW, CREATE_NEW, FILE_ATTRIBUTE_ENCRYPTED,
                FILE_ATTRIBUTE_NORMAL, FILE_FLAGS_AND_ATTRIBUTES, FILE_READ_ATTRIBUTES,
                FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE, MOVE_FILE_FLAGS,
                READ_CONTROL, REPLACE_FILE_FLAGS,
            },
        },
    };
    let wide = |path: &Path| {
        path.as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect::<Vec<_>>()
    };
    let error_text = |error: windows::core::Error| {
        std::io::Error::from_raw_os_error(error.code().0 & 0xffff).to_string()
    };
    let directory = path
        .parent()
        .ok_or("Missing atomic write directory")?
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let path = directory.join(path.file_name().ok_or("Missing atomic write filename")?);
    let path = path.as_path();
    let original = match fs::OpenOptions::new()
        .access_mode(READ_CONTROL.0 | FILE_READ_ATTRIBUTES.0)
        .share_mode(FILE_SHARE_READ.0 | FILE_SHARE_WRITE.0 | FILE_SHARE_DELETE.0)
        .open(path)
    {
        Ok(file) => Some(file),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(error.to_string()),
    };
    let flags = match &original {
        Some(file) => FILE_FLAGS_AND_ATTRIBUTES(
            file.metadata()
                .map_err(|error| error.to_string())?
                .file_attributes()
                & FILE_ATTRIBUTE_ENCRYPTED.0,
        ),
        None => FILE_ATTRIBUTE_NORMAL,
    };
    let mut descriptor = PSECURITY_DESCRIPTOR::default();
    if let Some(original) = &original {
        unsafe {
            GetSecurityInfo(
                HANDLE(original.as_raw_handle()),
                SE_FILE_OBJECT,
                OWNER_SECURITY_INFORMATION | GROUP_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
                None,
                None,
                None,
                None,
                Some(&mut descriptor),
            )
        }
        .ok()
        .map_err(error_text)?;
    }
    // The pinned Windows writer retains failed commits and overflows long NTFS basenames.
    let opened = loop {
        let temporary = directory.join(format!(".insomnium-write-{}.tmp", uuid::Uuid::new_v4()));
        let attributes = SECURITY_ATTRIBUTES {
            nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: descriptor.0,
            bInheritHandle: false.into(),
        };
        // Apply the old ACL before any payload exists in the staging file.
        let created = unsafe {
            CreateFileW(
                PCWSTR(wide(&temporary).as_ptr()),
                GENERIC_WRITE.0,
                Default::default(),
                Some(&attributes),
                CREATE_NEW,
                flags,
                None,
            )
        };
        match created {
            Ok(handle) => break Ok((temporary, unsafe { fs::File::from_raw_handle(handle.0) })),
            Err(error) if matches!(error.code().0 as u32 & 0xffff, 80 | 183) => continue,
            Err(error) => break Err(error_text(error)),
        }
    };
    if !descriptor.0.is_null() {
        unsafe {
            let _ = LocalFree(Some(HLOCAL(descriptor.0)));
        }
    }
    let (temporary, mut file) = opened?;
    let prepared = file.write_all(bytes).and_then(|()| file.sync_all());
    drop(file);
    let replacing = original.is_some();
    drop(original);
    let result = prepared.map_err(|error| error.to_string()).and_then(|()| {
        let target = wide(path);
        let staged = wide(&temporary);
        if !replacing {
            // Do not overwrite a file that appeared after destination selection.
            return unsafe {
                MoveFileExW(
                    PCWSTR(staged.as_ptr()),
                    PCWSTR(target.as_ptr()),
                    MOVE_FILE_FLAGS(0),
                )
            }
            .map_err(error_text);
        }
        let backup = directory.join(format!(".insomnium-backup-{}.tmp", uuid::Uuid::new_v4()));
        let backup_name = wide(&backup);
        // ReplaceFile preserves ACLs, creation time, encryption and named streams.
        match unsafe {
            ReplaceFileW(
                PCWSTR(target.as_ptr()),
                PCWSTR(staged.as_ptr()),
                PCWSTR(backup_name.as_ptr()),
                REPLACE_FILE_FLAGS(0),
                None,
                None,
            )
        } {
            Ok(()) => fs::remove_file(&backup).map_err(|error| {
                format!(
                    "File saved; previous file retained at {}: {error}",
                    backup.display()
                )
            }),
            Err(error) => {
                // 1177 moves the original to backup even though replacement failed.
                if error.code().0 as u32 & 0xffff == 1177 {
                    unsafe {
                        MoveFileExW(
                            PCWSTR(backup_name.as_ptr()),
                            PCWSTR(target.as_ptr()),
                            MOVE_FILE_FLAGS(0),
                        )
                    }
                    .map_err(|restore| {
                        format!(
                            "{error}; original retained at {}: {restore}",
                            backup.display()
                        )
                    })?;
                }
                Err(error_text(error))
            }
        }
    });
    if let Err(error) = result {
        return match fs::remove_file(&temporary) {
            Ok(()) => Err(error),
            Err(cleanup) if cleanup.kind() == std::io::ErrorKind::NotFound => Err(error),
            Err(cleanup) => Err(format!(
                "{error}; temporary write retained at {}: {cleanup}",
                temporary.display()
            )),
        };
    }
    Ok(())
}

#[cfg(unix)]
pub(crate) fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let name = path.file_name().ok_or("Missing atomic write filename")?;
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let directory = fs::File::open(parent).map_err(|error| error.to_string())?;
    atomic_write_in(&directory, name, bytes)
}

#[cfg(unix)]
pub(crate) fn atomic_write_in(
    directory: &fs::File,
    name: &std::ffi::OsStr,
    bytes: &[u8],
) -> Result<(), String> {
    use nix::{
        errno::Errno,
        fcntl::{openat, renameat, AtFlags, OFlag},
        sys::stat::{fstatat, Mode, SFlag},
        unistd::{unlinkat, UnlinkatFlags},
    };
    use std::io::Write;
    let error_text = |error: Errno| std::io::Error::from(error).to_string();
    if Path::new(name).file_name() != Some(name) {
        return Err("Atomic write requires a filename without directories".into());
    }
    let original = match fstatat(directory, name, AtFlags::AT_SYMLINK_NOFOLLOW) {
        Ok(info) if SFlag::from_bits_truncate(info.st_mode) & SFlag::S_IFMT != SFlag::S_IFREG => {
            return Err("Save requires an ordinary file".into());
        }
        Ok(_) => {
            let file = fs::File::from(
                openat(
                    directory,
                    name,
                    OFlag::O_WRONLY | OFlag::O_NONBLOCK | OFlag::O_NOFOLLOW | OFlag::O_CLOEXEC,
                    Mode::empty(),
                )
                .map_err(error_text)?,
            );
            if !file.metadata().map_err(|e| e.to_string())?.is_file() {
                return Err("Save requires an ordinary file".into());
            }
            Some(file)
        }
        Err(Errno::ENOENT) => None,
        Err(error) => return Err(error_text(error)),
    };
    let (temporary, mut file) = loop {
        let temporary = format!(".insomnium-write-{}.tmp", uuid::Uuid::new_v4());
        // A fixed short basename also fits a255-byte destination name.
        match openat(
            directory,
            temporary.as_str(),
            OFlag::O_WRONLY | OFlag::O_CREAT | OFlag::O_EXCL | OFlag::O_CLOEXEC,
            Mode::from_bits_truncate(if original.is_some() { 0o600 } else { 0o666 }),
        ) {
            Ok(file) => break (temporary, fs::File::from(file)),
            Err(Errno::EEXIST) => continue,
            Err(error) => return Err(error_text(error)),
        }
    };
    let result = (|| {
        if let Some(original) = &original {
            copy_download_metadata(original, &file).map_err(|e| e.to_string())?;
        }
        file.write_all(bytes)
            .and_then(|()| file.sync_all())
            .map_err(|e| e.to_string())?;
        renameat(directory, temporary.as_str(), directory, name).map_err(error_text)
    })();
    drop(file);
    if let Err(error) = result {
        return match unlinkat(directory, temporary.as_str(), UnlinkatFlags::NoRemoveDir) {
            Ok(()) | Err(Errno::ENOENT) => Err(error),
            Err(cleanup) => Err(format!(
                "{error}; temporary download retained at {}: {}",
                temporary,
                error_text(cleanup)
            )),
        };
    }
    Ok(())
}

#[cfg(unix)]
fn copy_download_metadata(source: &fs::File, destination: &fs::File) -> std::io::Result<()> {
    use std::os::unix::fs::{fchown, MetadataExt};
    let original = source.metadata()?;
    let staged = destination.metadata()?;
    if (original.uid(), original.gid()) != (staged.uid(), staged.gid()) {
        fchown(destination, Some(original.uid()), Some(original.gid()))?;
    }
    #[cfg(target_os = "macos")]
    {
        use std::os::fd::AsRawFd;
        unsafe extern "C" {
            fn fcopyfile(from: i32, to: i32, state: *mut std::ffi::c_void, flags: u32) -> i32;
        }
        // Install ACLs before STAT can widen mode bits; payload writes still clear privilege bits.
        for flags in [5, 2] {
            // COPYFILE_ACL | COPYFILE_XATTR, then COPYFILE_STAT.
            if unsafe {
                fcopyfile(
                    source.as_raw_fd(),
                    destination.as_raw_fd(),
                    std::ptr::null_mut(),
                    flags,
                )
            } != 0
            {
                return Err(std::io::Error::last_os_error());
            }
        }
    }
    #[cfg(target_os = "linux")]
    copy_download_xattrs(source, destination)?;
    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    return Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "File ACL preservation is unavailable on this platform",
    ));
    destination.set_permissions(original.permissions())?;
    let staged = destination.metadata()?;
    if (original.uid(), original.gid(), original.mode() & 0o7777)
        != (staged.uid(), staged.gid(), staged.mode() & 0o7777)
    {
        return Err(std::io::Error::other(
            "Could not preserve file ownership and permissions",
        ));
    }
    Ok(())
}

#[cfg(target_os = "linux")]
unsafe extern "C" {
    fn flistxattr(fd: i32, list: *mut std::ffi::c_char, size: usize) -> isize;
    pub(crate) fn fgetxattr(
        fd: i32,
        name: *const std::ffi::c_char,
        value: *mut std::ffi::c_void,
        size: usize,
    ) -> isize;
    pub(crate) fn fsetxattr(
        fd: i32,
        name: *const std::ffi::c_char,
        value: *const std::ffi::c_void,
        size: usize,
        flags: i32,
    ) -> i32;
    pub(crate) fn fremovexattr(fd: i32, name: *const std::ffi::c_char) -> i32;
}

#[cfg(target_os = "linux")]
fn copy_download_xattrs(source: &fs::File, destination: &fs::File) -> std::io::Result<()> {
    use std::{ffi::CString, io, os::fd::AsRawFd};
    fn names(fd: i32) -> io::Result<Vec<CString>> {
        let length = unsafe { flistxattr(fd, std::ptr::null_mut(), 0) };
        if length < 0 {
            let error = io::Error::last_os_error();
            return if error.kind() == io::ErrorKind::Unsupported {
                Ok(Vec::new())
            } else {
                Err(error)
            };
        }
        if length == 0 {
            return Ok(Vec::new());
        }
        let mut bytes = vec![0u8; length as usize];
        let length = unsafe { flistxattr(fd, bytes.as_mut_ptr().cast(), bytes.len()) };
        if length < 0 {
            return Err(io::Error::last_os_error());
        }
        bytes.truncate(length as usize);
        bytes
            .split_inclusive(|byte| *byte == 0)
            .map(|name| {
                CString::from_vec_with_nul(name.to_vec())
                    .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))
            })
            .collect()
    }
    let source = source.as_raw_fd();
    let destination = destination.as_raw_fd();
    let original = names(source)?;
    for name in names(destination)? {
        if !original.contains(&name) && unsafe { fremovexattr(destination, name.as_ptr()) } != 0 {
            return Err(io::Error::last_os_error());
        }
    }
    for name in original {
        let length = unsafe { fgetxattr(source, name.as_ptr(), std::ptr::null_mut(), 0) };
        if length < 0 {
            return Err(io::Error::last_os_error());
        }
        let mut value = vec![0u8; length as usize];
        let length = unsafe {
            fgetxattr(
                source,
                name.as_ptr(),
                value.as_mut_ptr().cast(),
                value.len(),
            )
        };
        if length < 0 {
            return Err(io::Error::last_os_error());
        }
        if length as usize > value.len() {
            return Err(io::Error::other("File metadata changed while copying"));
        }
        if unsafe {
            fsetxattr(
                destination,
                name.as_ptr(),
                value.as_ptr().cast(),
                length as usize,
                0,
            )
        } != 0
        {
            return Err(io::Error::last_os_error());
        }
    }
    Ok(())
}

#[cfg(not(any(windows, unix)))]
pub(crate) fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = AtomicWriteFile::options()
        .open(path)
        .map_err(|e| e.to_string())?;
    file.write_all(bytes).map_err(|e| e.to_string())?;
    file.commit().map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupPreview {
    data: Value,
    primary_sha256: Option<String>,
    backup_sha256: String,
}

pub(crate) fn decoded_workspace(bytes: &[u8]) -> Result<Value, String> {
    let mut value: Value = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
    if value.get("workspace").is_some() {
        value = value["workspace"].take();
    }
    validate(&value)?;
    Ok(value)
}

fn ordinary_bytes(path: &Path) -> Result<Vec<u8>, String> {
    let metadata = fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    if !metadata.file_type().is_file() {
        return Err("Workspace recovery requires ordinary files.".into());
    }
    fs::read(path).map_err(|e| e.to_string())
}

pub(crate) fn primary_bytes(directory: &Path) -> Result<Option<Vec<u8>>, String> {
    let path = directory.join(WORKSPACE_FILE);
    match fs::symlink_metadata(&path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
        Ok(_) => ordinary_bytes(&path).map(Some),
    }
}

fn backup_preview(directory: &Path) -> Result<(BackupPreview, Option<Vec<u8>>, Vec<u8>), String> {
    ensure_no_pending_transition(directory)?;
    let primary = primary_bytes(directory)?;
    if primary
        .as_ref()
        .is_some_and(|bytes| decoded_workspace(bytes).is_ok())
    {
        return Err(
            "The current workspace is valid. Backup restore is only available for damaged storage."
                .into(),
        );
    }
    let backup = ordinary_bytes(&directory.join(PREVIOUS_WORKSPACE_FILE))?;
    let data = decoded_workspace(&backup).map_err(|e| format!("Backup is invalid: {e}"))?;
    // An unreadable original cannot prove that retained fetch bindings survive.
    crate::git_fetch_journal::protect_workspace_bindings(directory, None, &data)?;
    Ok((
        BackupPreview {
            data,
            primary_sha256: primary
                .as_ref()
                .map(|bytes| format!("{:x}", Sha256::digest(bytes))),
            backup_sha256: format!("{:x}", Sha256::digest(&backup)),
        },
        primary,
        backup,
    ))
}

fn restore_backup(
    session: &mut Session,
    directory: &Path,
    primary_hash: Option<&str>,
    backup_hash: &str,
) -> Result<Option<String>, String> {
    if session.loaded {
        return Err("Reload before restoring a damaged workspace.".into());
    }
    let (preview, primary, backup) = backup_preview(directory)?;
    if preview.primary_sha256.as_deref() != primary_hash || preview.backup_sha256 != backup_hash {
        return Err(
            "Workspace or backup changed. Inspect the backup again before restoring.".into(),
        );
    }
    let retained = if let Some(bytes) = &primary {
        let path = directory.join(format!(
            "workspace-v1.damaged-{}.json",
            uuid::Uuid::new_v4()
        ));
        let mut copy = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
            .map_err(|e| e.to_string())?;
        copy.write_all(bytes)
            .and_then(|_| copy.sync_all())
            .map_err(|e| e.to_string())?;
        Some(path)
    } else {
        None
    };
    let retained_notice = retained
        .as_ref()
        .map(|path| format!(" Damaged copy retained at {}.", path.display()))
        .unwrap_or_default();
    // Recheck after retaining the damaged bytes, before replacing the primary.
    if primary_bytes(directory)? != primary
        || ordinary_bytes(&directory.join(PREVIOUS_WORKSPACE_FILE))? != backup
    {
        return Err(format!(
            "Workspace changed. Inspect again.{retained_notice}"
        ));
    }
    crate::cookies::with_workspace_write(directory, &preview.data, &backup, || {
        crate::response_download::with_workspace_write(directory, &preview.data, || {
            atomic_write(&directory.join(WORKSPACE_FILE), &backup)
        })
    })
    .map_err(|e| format!("Restore failed: {e}.{retained_notice}"))?;
    session.backed_up = true; // Preserve the reviewed backup through the next save.
    Ok(retained.map(|path| path.to_string_lossy().into_owned()))
}

#[tauri::command]
pub async fn inspect_workspace_backup(
    app: tauri::AppHandle,
    git_state: tauri::State<'_, crate::git::GitState>,
    state: tauri::State<'_, StorageState>,
    network: tauri::State<'_, NetworkState>,
) -> Result<BackupPreview, String> {
    let work = network.retain_native_work(format!("storage-inspect:{}", uuid::Uuid::new_v4()))?;
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let git = git_state.0.clone();
    let session = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _work = work;
        let _git = git.lock().map_err(|e| e.to_string())?;
        let session = session.lock().map_err(|e| e.to_string())?;
        if session.loaded {
            return Err("Reload before inspecting damaged storage.".into());
        }
        backup_preview(&directory).map(|(preview, _, _)| preview)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn restore_workspace_backup(
    app: tauri::AppHandle,
    primary_sha256: Option<String>,
    backup_sha256: String,
    git_state: tauri::State<'_, crate::git::GitState>,
    state: tauri::State<'_, StorageState>,
    network: tauri::State<'_, NetworkState>,
) -> Result<Option<String>, String> {
    let work = network.retain_native_work(format!("storage-restore:{}", uuid::Uuid::new_v4()))?;
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let git = git_state.0.clone();
    let session = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _work = work;
        let _git = git.lock().map_err(|e| e.to_string())?;
        let mut session = session.lock().map_err(|e| e.to_string())?;
        restore_backup(
            &mut session,
            &directory,
            primary_sha256.as_deref(),
            &backup_sha256,
        )
    })
    .await
    .map_err(|e| e.to_string())?
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
    crate::cookies::with_workspace_write(directory, data, &bytes, || {
        crate::response_download::with_workspace_write(directory, data, || {
            atomic_write(&directory.join(WORKSPACE_FILE), &bytes)
        })
    })
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
                Ok(bytes) => {
                    atomic_write(&directory.join(PREVIOUS_WORKSPACE_FILE), &bytes)?;
                    self.backed_up = true;
                }
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => (),
                Err(error) => return Err(error.to_string()),
            }
        }
        Ok(())
    }

    pub(crate) fn load(&mut self, directory: &Path) -> Result<Option<Value>, String> {
        self.loaded = false;
        ensure_no_pending_transition(directory)?;
        let data = read_workspace_file(directory)?;
        if data.is_none() {
            match fs::symlink_metadata(directory.join(PREVIOUS_WORKSPACE_FILE)) {
                Ok(_) => return Err("Workspace file is missing, but a backup exists. Inspect the backup before continuing.".into()),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => return Err(format!("Could not inspect workspace backup: {error}")),
            }
        }
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
    network: tauri::State<'_, NetworkState>,
) -> Result<Option<Value>, String> {
    let work = network.retain_native_work(format!("storage-load:{}", uuid::Uuid::new_v4()))?;
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let session = state.0.clone();
    let git_lock = git_state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _work = work;
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
    network: tauri::State<'_, NetworkState>,
) -> Result<(), String> {
    let work = network.retain_native_work(format!("storage-save:{}", uuid::Uuid::new_v4()))?;
    validate(&data)?;
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let session = state.0.clone();
    let git_lock = git_state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        // Accepted saves/recovery must finish even after exit cancellation.
        // The actual blocking worker owns this lease, not its IPC awaiter.
        let _work = work;
        let _git_guard = git_lock.lock().map_err(|e| e.to_string())?;
        session
            .lock()
            .map_err(|e| e.to_string())?
            .save(&directory, &data)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    struct RecoveryDirectory(std::path::PathBuf);
    impl Drop for RecoveryDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    fn damaged_backup() -> (RecoveryDirectory, Vec<u8>) {
        let directory = RecoveryDirectory(
            std::env::temp_dir().join(format!("insomnium-recovery-{}", uuid::Uuid::new_v4())),
        );
        fs::create_dir(&directory.0).unwrap();
        let backup = serde_json::to_vec(&workspace()).unwrap();
        fs::write(directory.0.join(WORKSPACE_FILE), b"damaged original").unwrap();
        fs::write(directory.0.join(PREVIOUS_WORKSPACE_FILE), &backup).unwrap();
        (directory, backup)
    }

    #[test]
    fn reviewed_backup_restore_retains_damaged_and_backup_bytes() {
        let (directory, backup) = damaged_backup();
        let (preview, _, _) = backup_preview(&directory.0).unwrap();
        assert_eq!(
            fs::read(directory.0.join(WORKSPACE_FILE)).unwrap(),
            b"damaged original"
        );
        let mut session = Session::default();
        let retained = restore_backup(
            &mut session,
            &directory.0,
            preview.primary_sha256.as_deref(),
            &preview.backup_sha256,
        )
        .unwrap();
        assert_eq!(fs::read(retained.unwrap()).unwrap(), b"damaged original");
        assert_eq!(fs::read(directory.0.join(WORKSPACE_FILE)).unwrap(), backup);
        assert_eq!(
            fs::read(directory.0.join(PREVIOUS_WORKSPACE_FILE)).unwrap(),
            backup
        );
        assert!(!session.loaded);
        assert_eq!(session.load(&directory.0).unwrap(), Some(workspace()));
        session.save(&directory.0, &workspace()).unwrap();
        assert_eq!(
            fs::read(directory.0.join(PREVIOUS_WORKSPACE_FILE)).unwrap(),
            backup
        );
    }

    #[test]
    fn backup_restore_refuses_stale_files_and_pending_transition() {
        for changed in [WORKSPACE_FILE, PREVIOUS_WORKSPACE_FILE, GIT_TRANSITION_FILE] {
            let (directory, _) = damaged_backup();
            let (preview, _, _) = backup_preview(&directory.0).unwrap();
            let change = if changed == PREVIOUS_WORKSPACE_FILE {
                serde_json::to_vec(&json!({"workspace":workspace()})).unwrap()
            } else {
                b"changed".to_vec()
            };
            fs::write(directory.0.join(changed), &change).unwrap();
            let primary = fs::read(directory.0.join(WORKSPACE_FILE)).unwrap();
            let backup = fs::read(directory.0.join(PREVIOUS_WORKSPACE_FILE)).unwrap();
            assert!(restore_backup(
                &mut Session::default(),
                &directory.0,
                preview.primary_sha256.as_deref(),
                &preview.backup_sha256
            )
            .is_err());
            assert_eq!(fs::read(directory.0.join(WORKSPACE_FILE)).unwrap(), primary);
            assert_eq!(
                fs::read(directory.0.join(PREVIOUS_WORKSPACE_FILE)).unwrap(),
                backup
            );
            assert_eq!(
                fs::read_dir(&directory.0).unwrap().count(),
                if changed == GIT_TRANSITION_FILE { 3 } else { 2 }
            );
        }
    }

    #[test]
    fn backup_preview_refuses_invalid_backup_and_healthy_primary() {
        let (directory, backup) = damaged_backup();
        fs::write(directory.0.join(PREVIOUS_WORKSPACE_FILE), b"invalid backup").unwrap();
        assert!(backup_preview(&directory.0).is_err());
        fs::write(directory.0.join(PREVIOUS_WORKSPACE_FILE), &backup).unwrap();
        fs::write(directory.0.join(WORKSPACE_FILE), &backup).unwrap();
        assert!(backup_preview(&directory.0).is_err());
    }

    #[test]
    fn missing_primary_requires_review_but_first_run_stays_empty() {
        let (directory, backup) = damaged_backup();
        fs::remove_file(directory.0.join(WORKSPACE_FILE)).unwrap();
        let mut session = Session::default();
        assert!(session.load(&directory.0).is_err());
        assert!(session.require_loaded().is_err());
        let (preview, _, _) = backup_preview(&directory.0).unwrap();
        assert_eq!(preview.primary_sha256, None);
        assert_eq!(
            serde_json::to_value(&preview).unwrap()["primarySha256"],
            Value::Null
        );
        assert!(
            restore_backup(&mut session, &directory.0, None, &preview.backup_sha256)
                .unwrap()
                .is_none()
        );
        assert_eq!(fs::read(directory.0.join(WORKSPACE_FILE)).unwrap(), backup);
        assert_eq!(
            fs::read(directory.0.join(PREVIOUS_WORKSPACE_FILE)).unwrap(),
            backup
        );
        let mut files: Vec<_> = fs::read_dir(&directory.0)
            .unwrap()
            .map(|entry| entry.unwrap().file_name())
            .collect();
        files.sort();
        assert_eq!(
            files,
            [
                std::ffi::OsString::from("cookie-lifecycle-v1.json"),
                std::ffi::OsString::from(WORKSPACE_FILE),
                std::ffi::OsString::from(PREVIOUS_WORKSPACE_FILE),
            ]
        );
        assert_eq!(session.load(&directory.0).unwrap(), Some(workspace()));

        fs::remove_file(directory.0.join(WORKSPACE_FILE)).unwrap();
        fs::remove_file(directory.0.join(PREVIOUS_WORKSPACE_FILE)).unwrap();
        fs::remove_file(directory.0.join("cookie-lifecycle-v1.json")).unwrap();
        let mut fresh = Session::default();
        assert_eq!(fresh.load(&directory.0).unwrap(), None);
        assert!(fresh.require_loaded().is_ok());
        fresh.save(&directory.0, &workspace()).unwrap();
        let first = fs::read(directory.0.join(WORKSPACE_FILE)).unwrap();
        assert!(
            !fresh.backed_up,
            "No original file was backed up on the first write"
        );
        assert!(!directory.0.join(PREVIOUS_WORKSPACE_FILE).exists());
        let mut changed = workspace();
        changed["resources"][0]["name"] = json!("Changed after first save");
        fs::create_dir(directory.0.join(PREVIOUS_WORKSPACE_FILE)).unwrap();
        assert!(fresh.save(&directory.0, &changed).is_err());
        assert_eq!(fs::read(directory.0.join(WORKSPACE_FILE)).unwrap(), first);
        assert!(!fresh.backed_up);
        fs::remove_dir(directory.0.join(PREVIOUS_WORKSPACE_FILE)).unwrap();
        fresh.save(&directory.0, &changed).unwrap();
        assert_eq!(
            fs::read(directory.0.join(PREVIOUS_WORKSPACE_FILE)).unwrap(),
            first
        );
        changed["resources"][0]["name"] = json!("Third save");
        fresh.save(&directory.0, &changed).unwrap();
        assert_eq!(
            fs::read(directory.0.join(PREVIOUS_WORKSPACE_FILE)).unwrap(),
            first
        );
        fs::write(directory.0.join(WORKSPACE_FILE), b"new corruption").unwrap();
        assert!(fresh.load(&directory.0).is_err());
        assert!(fresh.require_loaded().is_err());
    }

    #[test]
    fn missing_primary_preview_does_not_replace_a_newly_created_file() {
        let (directory, backup) = damaged_backup();
        fs::remove_file(directory.0.join(WORKSPACE_FILE)).unwrap();
        let (preview, _, _) = backup_preview(&directory.0).unwrap();
        fs::write(directory.0.join(WORKSPACE_FILE), b"new file since review").unwrap();
        assert!(restore_backup(
            &mut Session::default(),
            &directory.0,
            None,
            &preview.backup_sha256
        )
        .is_err());
        assert_eq!(
            fs::read(directory.0.join(WORKSPACE_FILE)).unwrap(),
            b"new file since review"
        );
        assert_eq!(
            fs::read(directory.0.join(PREVIOUS_WORKSPACE_FILE)).unwrap(),
            backup
        );
        assert_eq!(fs::read_dir(&directory.0).unwrap().count(), 2);
    }

    #[test]
    fn topology_validation_preserves_unknown_models_and_rejects_broken_trees() {
        let mut valid = workspace();
        valid["resources"].as_array_mut().unwrap().extend([
            json!({"_id":"folder","_type":"request_group","parentId":"wrk_owned"}),
            json!({"_id":"req","_type":"request","parentId":"folder"}),
            json!({"_id":"env","_type":"environment","parentId":"wrk_owned"}),
            json!({"_id":"subenv","_type":"environment","parentId":"env"}),
            json!({"_id":"future","_type":"unknown_legacy_model","parentId":"foreign","payload":{"keep":true}}),
        ]);
        let original = valid.clone();
        validate(&valid).unwrap();
        assert_eq!(valid, original);
        for broken in [
            json!([{"_id":"req","_type":"request","parentId":"missing"}]),
            json!([{"_id":"folder","_type":"request_group","parentId":"folder"}]),
            json!([{"_id":"req","_type":"request","parentId":"wrk_owned"},{"_id":"env","_type":"environment","parentId":"req"}]),
            json!([{"_id":"future","_type":"unknown_legacy_model","parentId":"future"}]),
            json!([{"_id":"","_type":"unknown_legacy_model"}]),
        ] {
            let mut data = workspace();
            data["resources"]
                .as_array_mut()
                .unwrap()
                .extend(broken.as_array().unwrap().iter().cloned());
            assert!(validate(&data).is_err());
        }
    }

    #[test]
    fn topology_failure_can_restore_a_reviewed_backup() {
        let (directory, backup) = damaged_backup();
        let mut broken = workspace();
        broken["resources"]
            .as_array_mut()
            .unwrap()
            .push(json!({"_id":"folder","_type":"request_group","parentId":"folder"}));
        let original = serde_json::to_vec(&broken).unwrap();
        fs::write(directory.0.join(WORKSPACE_FILE), &original).unwrap();
        let mut session = Session::default();
        assert!(session.load(&directory.0).is_err());
        assert!(session.require_loaded().is_err());
        let (preview, _, _) = backup_preview(&directory.0).unwrap();
        let retained = restore_backup(
            &mut session,
            &directory.0,
            preview.primary_sha256.as_deref(),
            &preview.backup_sha256,
        )
        .unwrap()
        .unwrap();
        assert_eq!(fs::read(retained).unwrap(), original);
        assert_eq!(
            fs::read(directory.0.join(PREVIOUS_WORKSPACE_FILE)).unwrap(),
            backup
        );
        assert_eq!(session.load(&directory.0).unwrap(), Some(workspace()));
    }

    #[test]
    fn damaged_navigation_metadata_blocks_load_but_allows_backup_review() {
        let (directory, _) = damaged_backup();
        for (field, invalid) in [
            ("openTabs", json!("not a list")),
            ("openTabs", json!([7])),
            ("responseSelections", json!([])),
            ("responseSelections", json!({"req":null})),
        ] {
            let mut data = workspace();
            data[field] = invalid;
            let bytes = serde_json::to_vec(&data).unwrap();
            fs::write(directory.0.join(WORKSPACE_FILE), &bytes).unwrap();
            let mut session = Session::default();
            assert!(session.load(&directory.0).is_err());
            assert!(session.require_loaded().is_err());
            assert_eq!(backup_preview(&directory.0).unwrap().0.data, workspace());
            assert_eq!(fs::read(directory.0.join(WORKSPACE_FILE)).unwrap(), bytes);
        }
        let mut valid = workspace();
        valid["openTabs"] = json!(["req"]);
        valid["responseSelections"] = json!({"req":"response"});
        validate(&valid).unwrap();
    }

    fn workspace() -> Value {
        json!({"schemaVersion":1,"resources":[{"_id":"wrk_owned","_type":"workspace"}],"history":[]})
    }

    #[test]
    fn malformed_stream_history_is_rejected() {
        for protocol in ["websocket", "sse", "grpc"] {
            for events in [json!({}), json!([null]), json!(["invalid"]), json!([[]])] {
                let mut data = workspace();
                data["history"] = json!([{"requestId":"req","protocol":protocol,"events":events}]);
                assert_eq!(validate(&data).unwrap_err(), "Invalid saved stream events");
            }
        }
    }

    #[test]
    fn malformed_response_header_rows_are_rejected() {
        for field in ["headers", "trailers", "requestHeaders"] {
            for rows in [
                json!({}),
                json!("headers"),
                json!([null]),
                json!([[]]),
                json!([["name"]]),
                json!([[1, "value"]]),
                json!([["name", false]]),
            ] {
                let mut data = workspace();
                data["history"] = json!([{"requestId":"req"}]);
                data["history"][0][field] = rows;
                assert_eq!(
                    validate(&data).unwrap_err(),
                    format!("Invalid saved response {field}")
                );
            }
        }
    }

    #[test]
    fn malformed_response_network_log_is_rejected() {
        for log in [
            json!({}),
            json!("log"),
            json!([null]),
            json!([1]),
            json!([{}]),
            json!([[]]),
        ] {
            let mut data = workspace();
            data["history"] = json!([{"requestId":"req","networkLog":log}]);
            assert_eq!(
                validate(&data).unwrap_err(),
                "Invalid saved response networkLog"
            );
        }
    }

    #[test]
    fn malformed_or_duplicate_response_ids_are_rejected() {
        for id in [json!(""), json!(1), json!({}), json!([])] {
            let mut data = workspace();
            data["history"] = json!([{"requestId":"req","_id":id}]);
            assert_eq!(
                validate(&data).unwrap_err(),
                "Invalid or duplicate saved response ID"
            );
        }
        let mut data = workspace();
        data["history"] = json!([
            {"requestId":"req_first","_id":"res_owned"},
            {"requestId":"req_second","_id":"res_owned"}
        ]);
        assert_eq!(
            validate(&data).unwrap_err(),
            "Invalid or duplicate saved response ID"
        );
    }

    #[test]
    fn malformed_or_duplicate_stream_event_ids_are_rejected() {
        for id in [json!(""), json!(1), json!({}), json!([])] {
            let mut data = workspace();
            data["history"] = json!([{"requestId":"req","protocol":"sse","events":[{"_id":id}]}]);
            assert_eq!(
                validate(&data).unwrap_err(),
                "Invalid or duplicate saved stream event ID"
            );
        }
        let mut data = workspace();
        data["history"] = json!([{"requestId":"req","protocol":"sse","events":[{"_id":"evt_owned"},{"_id":"evt_owned"}]}]);
        assert_eq!(
            validate(&data).unwrap_err(),
            "Invalid or duplicate saved stream event ID"
        );
        data["history"] = json!([
            {"requestId":"req_first","protocol":"sse","events":[{"_id":"evt_owned"},{}]},
            {"requestId":"req_second","protocol":"grpc","events":[{"_id":"evt_owned"},{"_id":null}]}
        ]);
        let before = data.clone();
        validate(&data).unwrap();
        assert_eq!(data, before);
    }

    #[test]
    fn valid_and_legacy_history_is_unchanged() {
        let mut data = workspace();
        data["history"] = json!([
            {"requestId":"req","protocol":"websocket","events":[{"kind":"closed","code":1000}]},
            {"requestId":"req","protocol":"sse"},
            {"requestId":"req","protocol":"grpc","events":null},
            {"requestId":"req","body":"original","headers":[["X-Owned","ไทย"],["X-Owned","duplicate",{"unknown":"retained"}]],"trailers":[["x-end",""]]},
            {"requestId":"req","headers":null,"trailers":[],"requestHeaders":[["Authorization","Bearer ***"]],"networkLog":["","* Saved ไทย"]},
            {"requestId":"req","networkLog":null,"requestHeaders":null}
        ]);
        let before = data.clone();
        validate(&data).unwrap();
        assert_eq!(data, before);
    }

    #[test]
    fn refused_save_preserves_primary_backup_and_session() {
        struct OwnedDirectory(std::path::PathBuf);
        impl Drop for OwnedDirectory {
            fn drop(&mut self) {
                let _ = fs::remove_dir_all(&self.0);
            }
        }
        let directory = OwnedDirectory(
            std::env::temp_dir().join(format!("insomnium-storage-{}", uuid::Uuid::new_v4())),
        );
        fs::create_dir(&directory.0).unwrap();
        let original = serde_json::to_vec(&workspace()).unwrap();
        fs::write(directory.0.join(WORKSPACE_FILE), &original).unwrap();
        fs::write(
            directory.0.join(PREVIOUS_WORKSPACE_FILE),
            b"original backup",
        )
        .unwrap();
        let mut session = Session::default();
        session.load(&directory.0).unwrap();
        let mut invalid = workspace();
        invalid["history"] = json!([{"requestId":"req","protocol":"websocket","events":[null]}]);
        assert!(session.save(&directory.0, &invalid).is_err());
        assert_eq!(
            fs::read(directory.0.join(WORKSPACE_FILE)).unwrap(),
            original
        );
        assert_eq!(
            fs::read(directory.0.join(PREVIOUS_WORKSPACE_FILE)).unwrap(),
            b"original backup"
        );
        assert!(!session.backed_up);
        // A later valid save still gets the first-backup opportunity.
        session.save(&directory.0, &workspace()).unwrap();
        assert_eq!(
            fs::read(directory.0.join(PREVIOUS_WORKSPACE_FILE)).unwrap(),
            original
        );
    }
}
