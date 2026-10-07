//! Crash ownership for restore's read-only libgit2 ref transaction. Recovery
//! never removes legacy/unknown locks and never relies on PID reuse heuristics.
use git2::{Repository, Transaction};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
};

const RECORD: &str = "insomnium-restore-ref-locks-v1.json";
const LEASE: &str = "insomnium-restore-ref-locks-v1.lease";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Lock {
    pub(crate) name: String,
    pub(crate) identity: String,
    pub(crate) digest: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Record {
    version: u32,
    operation: String,
    lease_identity: String,
    locks: Vec<Lock>,
}

#[cfg(windows)]
pub(crate) fn file_identity(file: &fs::File) -> Result<String, String> {
    use std::os::windows::io::AsRawHandle;
    #[link(name = "kernel32")]
    extern "system" {
        fn GetFileInformationByHandle(handle: *mut std::ffi::c_void, info: *mut u32) -> i32;
    }
    // BY_HANDLE_FILE_INFORMATION: 13 DWORDs, naturally aligned to DWORD.
    let mut info = [0u32; 13];
    if unsafe { GetFileInformationByHandle(file.as_raw_handle(), info.as_mut_ptr()) } == 0 {
        return Err(std::io::Error::last_os_error().to_string());
    }
    Ok(format!("windows:{}:{}:{}", info[7], info[11], info[12]))
}
#[cfg(unix)]
pub(crate) fn file_identity(file: &fs::File) -> Result<String, String> {
    use std::os::unix::fs::MetadataExt;
    let metadata = file.metadata().map_err(|e| e.to_string())?;
    Ok(format!("unix:{}:{}", metadata.dev(), metadata.ino()))
}

pub(crate) fn plain(path: &Path, cap: u64) -> Result<Option<fs::File>, String> {
    crate::git::reject_link(path)?;
    let file = match fs::File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.to_string()),
    };
    let metadata = file.metadata().map_err(|e| e.to_string())?;
    if !metadata.is_file() || metadata.len() > cap {
        return Err("Invalid restore ref-lock recovery material; retained.".into());
    }
    Ok(Some(file))
}
fn read_record(root: &Path) -> Result<Option<Record>, String> {
    let Some(mut file) = plain(&root.join(RECORD), 16384)? else {
        return Ok(None);
    };
    let mut bytes = Vec::new();
    (&mut file)
        .take(16385)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > 16384 {
        return Err("Oversized restore ownership; retained.".into());
    }
    let record: Record =
        serde_json::from_slice(&bytes).map_err(|_| "Malformed restore ref ownership; retained.")?;
    if record.version != 1
        || uuid::Uuid::parse_str(&record.operation).is_err()
        || record.locks.len() > 2
    {
        return Err("Invalid restore ref ownership; retained.".into());
    }
    Ok(Some(record))
}
pub(crate) fn lock_path(root: &Path, name: &str) -> Result<PathBuf, String> {
    if name != "HEAD" && (!name.starts_with("refs/heads/") || !git2::Reference::is_valid_name(name))
    {
        return Err("Invalid owned restore ref name; retained.".into());
    }
    if name.len() > 1024
        || name.contains('\\')
        || name
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return Err("Invalid owned restore ref path; retained.".into());
    }
    let mut path = root.to_path_buf();
    for part in format!("{name}.lock").split('/') {
        path.push(part);
        crate::git::reject_link(&path)?;
    }
    Ok(path)
}
pub(crate) fn fingerprint(root: &Path, name: &str) -> Result<Option<Lock>, String> {
    let Some(mut file) = plain(&lock_path(root, name)?, 1024)? else {
        return Ok(None);
    };
    let identity = file_identity(&file)?;
    let mut bytes = Vec::new();
    (&mut file)
        .take(1025)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    Ok(Some(Lock {
        name: name.to_owned(),
        identity,
        digest: format!("{:x}", Sha256::digest(&bytes)),
    }))
}
fn acquire_lease(root: &Path, create: bool) -> Result<fs::File, String> {
    let path = root.join(LEASE);
    crate::git::reject_link(&path)?;
    let file = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(create)
        .truncate(false)
        .open(path)
        .map_err(|e| e.to_string())?;
    if !file.metadata().map_err(|e| e.to_string())?.is_file() {
        return Err("Invalid restore ownership lease; retained.".into());
    }
    file.try_lock()
        .map_err(|_| "Restore ref-lock owner is still active; retry later.")?;
    Ok(file)
}
fn recover_locked(root: &Path, lease: &fs::File, record: &Record) -> Result<(), String> {
    if record.lease_identity != file_identity(lease)? {
        return Err("Restore ref lease identity changed; locks retained.".into());
    }
    // Validate the entire set before removing anything. Missing locks mean the
    // old transaction already dropped/committed; changed locks stay untouched.
    for lock in &record.locks {
        if fingerprint(root, &lock.name)?.is_some_and(|actual| actual != *lock) {
            return Err("Owned restore ref lock changed; recovery material retained.".into());
        }
    }
    for lock in &record.locks {
        let path = lock_path(root, &lock.name)?;
        if read_record(root)?.as_ref() != Some(record) {
            return Err("Restore ownership changed during recovery; retained.".into());
        }
        if fingerprint(root, &lock.name)?.as_ref() == Some(lock) {
            fs::remove_file(path).map_err(|e| e.to_string())?;
        }
    }
    if read_record(root)?.as_ref() != Some(record) {
        return Err("Restore ownership changed during recovery; retained.".into());
    }
    fs::remove_file(root.join(RECORD)).map_err(|e| e.to_string())
}
pub(crate) fn recover(repo: &Repository) -> Result<(), String> {
    let root = repo.path();
    if read_record(root)?.is_none() {
        return Ok(());
    }
    let lease = acquire_lease(root, false)?;
    if let Some(record) = read_record(root)? {
        recover_locked(root, &lease, &record)?;
    }
    Ok(())
}

pub(crate) struct RestoreRefLocks<'repo> {
    transaction: Option<Transaction<'repo>>,
    root: PathBuf,
    lease: fs::File,
    record: Record,
}
impl<'repo> RestoreRefLocks<'repo> {
    pub(crate) fn new(repo: &'repo Repository) -> Result<Self, String> {
        let root = repo.path().to_path_buf();
        let lease = acquire_lease(&root, true)?;
        if let Some(record) = read_record(&root)? {
            recover_locked(&root, &lease, &record)?;
        }
        let record = Record {
            version: 1,
            operation: uuid::Uuid::new_v4().to_string(),
            lease_identity: file_identity(&lease)?,
            locks: Vec::new(),
        };
        let transaction = repo.transaction().map_err(|e| e.message().to_owned())?;
        Ok(Self {
            transaction: Some(transaction),
            root,
            lease,
            record,
        })
    }
    pub(crate) fn lock_ref(&mut self, name: &str) -> Result<(), String> {
        lock_path(&self.root, name)?;
        self.transaction
            .as_mut()
            .ok_or("Restore transaction already released")?
            .lock_ref(name)
            .map_err(|e| e.message().to_owned())?;
        let lock = fingerprint(&self.root, name)?.ok_or("Acquired restore lock disappeared")?;
        self.record.locks.push(lock);
        let bytes = serde_json::to_vec(&self.record).map_err(|e| e.to_string())?;
        crate::storage::atomic_write(&self.root.join(RECORD), &bytes)
    }
}
impl Drop for RestoreRefLocks<'_> {
    fn drop(&mut self) {
        // Release libgit2's locks before clearing ownership, while still holding
        // the OS lease. On abort/crash both record and lock files survive.
        drop(self.transaction.take());
        if read_record(&self.root).ok().flatten().as_ref() == Some(&self.record) {
            let _ = recover_locked(&self.root, &self.lease, &self.record);
        }
    }
}
