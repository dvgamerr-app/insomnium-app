//! Ownership of HEAD + one mutating branch transaction. Separate from restore's
//! read-only contract. Never changes refs during recovery or removes unknown locks.
use crate::git_ref_lock::{file_identity, fingerprint, lock_path, plain, Lock};
use git2::{Repository, Transaction};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{fs, io::Read, path::Path};

const RECORD: &str = "insomnium-advance-ref-locks-v1.json";
const LEASE: &str = "insomnium-advance-ref-locks-v1.lease";

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Record {
    version: u32,
    operation: String,
    lease_identity: String,
    branch: String,
    old_oid: String,
    new_oid: String,
    locks: Vec<Lock>,
}
fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn oid(value: &str) -> Result<git2::Oid, String> {
    if value.len() != 40 || !value.bytes().all(|c| c.is_ascii_hexdigit()) {
        return Err("Invalid advance ownership OID; retained".into());
    }
    git2::Oid::from_str(value).map_err(|e| e.message().to_owned())
}
fn read(root: &Path) -> Result<Option<Record>, String> {
    let Some(file) = plain(&root.join(RECORD), 16384)? else {
        return Ok(None);
    };
    let mut bytes = Vec::new();
    file.take(16385)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > 16384 {
        return Err("Oversized advance ownership; retained".into());
    }
    let record: Record =
        serde_json::from_slice(&bytes).map_err(|_| "Malformed advance ownership; retained")?;
    if record.version != 1
        || record.operation.is_empty()
        || record.operation.len() > 100
        || !record
            .operation
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
        || !record.branch.starts_with("refs/heads/")
        || oid(&record.old_oid)? == oid(&record.new_oid)?
        || record.locks.len() > 2
        || record.locks.iter().enumerate().any(|(index, lock)| {
            lock.digest != digest(b"")
                || lock.identity.is_empty()
                || lock.name != if index == 0 { "HEAD" } else { &record.branch }
        })
    {
        return Err("Invalid advance ownership; retained".into());
    }
    lock_path(root, &record.branch)?;
    Ok(Some(record))
}
fn lease(root: &Path, create: bool) -> Result<fs::File, String> {
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
        return Err("Invalid advance ownership lease; retained".into());
    }
    file.try_lock()
        .map_err(|_| "Advance ref-lock owner is still active; retry later")?;
    Ok(file)
}
fn matches(record: &Record, expected: &Lock, actual: &Lock) -> bool {
    if expected.name != actual.name || expected.identity != actual.identity {
        return false;
    }
    if actual.digest == expected.digest {
        return true;
    }
    // Pinned libgit2 FS backend loose_commit writes a canonical hex OID + LF to
    // this same acquired file before rename. Partial/other contents are retained.
    expected.name == record.branch
        && actual.digest == digest(format!("{}\n", record.new_oid.to_ascii_lowercase()).as_bytes())
}
fn recover_locked(repo: &Repository, lease: &fs::File, record: &Record) -> Result<(), String> {
    let root = repo.path();
    if record.lease_identity != file_identity(lease)? {
        return Err("Advance lease identity changed; locks retained".into());
    }
    let mut present = false;
    for lock in &record.locks {
        if let Some(actual) = fingerprint(root, &lock.name)? {
            present = true;
            if !matches(record, lock, &actual) {
                return Err("Owned advance ref lock changed; recovery material retained".into());
            }
        }
    }
    // A normally dropped transaction has no remaining locks. Its own unchanged
    // record can be retired even after stale-HEAD admission refused the writer.
    // When locks survive, require the operation's recorded HEAD/tip as well.
    if present {
        let error = |e: git2::Error| e.message().to_owned();
        let tip = repo.find_reference(&record.branch).map_err(error)?.target();
        if repo
            .find_reference("HEAD")
            .map_err(error)?
            .symbolic_target()
            .map_err(error)?
            != Some(record.branch.as_str())
            || ![Some(oid(&record.old_oid)?), Some(oid(&record.new_oid)?)].contains(&tip)
        {
            return Err("Advance HEAD/tip changed; ownership retained".into());
        }
    }
    for lock in &record.locks {
        if read(root)?.as_ref() != Some(record) {
            return Err("Advance ownership changed during recovery; retained".into());
        }
        if let Some(actual) = fingerprint(root, &lock.name)? {
            if !matches(record, lock, &actual) {
                return Err("Owned advance ref lock changed; retained".into());
            }
            fs::remove_file(lock_path(root, &lock.name)?).map_err(|e| e.to_string())?;
        }
    }
    if read(root)?.as_ref() != Some(record) {
        return Err("Advance ownership changed during recovery; retained".into());
    }
    fs::remove_file(root.join(RECORD)).map_err(|e| e.to_string())
}
pub(crate) fn recover(repo: &Repository) -> Result<(), String> {
    if read(repo.path())?.is_none() {
        return Ok(());
    }
    let lease = lease(repo.path(), false)?;
    if let Some(record) = read(repo.path())? {
        recover_locked(repo, &lease, &record)?;
    }
    Ok(())
}

pub(crate) struct AdvanceRefLocks<'repo> {
    repo: &'repo Repository,
    transaction: Option<Transaction<'repo>>,
    lease: fs::File,
    record: Record,
}
impl<'repo> AdvanceRefLocks<'repo> {
    pub(crate) fn new(
        repo: &'repo Repository,
        operation: &str,
        branch: &str,
        old: git2::Oid,
        new: git2::Oid,
    ) -> Result<Self, String> {
        lock_path(repo.path(), branch)?;
        let lease = lease(repo.path(), true)?;
        if let Some(record) = read(repo.path())? {
            recover_locked(repo, &lease, &record)?;
        }
        Ok(Self {
            repo,
            transaction: Some(repo.transaction().map_err(|e| e.message().to_owned())?),
            record: Record {
                version: 1,
                operation: operation.to_owned(),
                lease_identity: file_identity(&lease)?,
                branch: branch.to_owned(),
                old_oid: old.to_string(),
                new_oid: new.to_string(),
                locks: Vec::new(),
            },
            lease,
        })
    }
    pub(crate) fn lock_refs(&mut self) -> Result<(), String> {
        for name in ["HEAD".to_owned(), self.record.branch.clone()] {
            self.transaction
                .as_mut()
                .ok_or("Advance transaction already released")?
                .lock_ref(&name)
                .map_err(|e| e.message().to_owned())?;
            let lock =
                fingerprint(self.repo.path(), &name)?.ok_or("Acquired advance lock disappeared")?;
            if lock.digest != digest(b"") {
                return Err("Acquired advance lock is not empty; retained".into());
            }
            self.record.locks.push(lock);
            crate::storage::atomic_write(
                &self.repo.path().join(RECORD),
                &serde_json::to_vec(&self.record).map_err(|e| e.to_string())?,
            )?;
        }
        Ok(())
    }
    pub(crate) fn commit(mut self, signature: &git2::Signature<'_>) -> Result<(), String> {
        let mut transaction = self
            .transaction
            .take()
            .ok_or("Advance transaction already released")?;
        transaction
            .set_target(
                &self.record.branch,
                oid(&self.record.new_oid)?,
                Some(signature),
                "advance: Insomnium collection",
            )
            .map_err(|e| e.message().to_owned())?;
        // Drop (also on failure) releases libgit2 before ownership cleanup under
        // the OS lease. The caller retains its journal for every uncertain error.
        transaction.commit().map_err(|e| e.message().to_owned())
    }
}
impl Drop for AdvanceRefLocks<'_> {
    fn drop(&mut self) {
        drop(self.transaction.take());
        if read(self.repo.path()).ok().flatten().as_ref() == Some(&self.record) {
            let _ = recover_locked(self.repo, &self.lease, &self.record);
        }
    }
}
