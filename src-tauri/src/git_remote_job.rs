//! Process boundary for cancellable libgit2 discovery. A blocked C transport
//! cannot be aborted by dropping a spawn_blocking future.
use crate::git_remote::{
    advertise, fetch_stage, RemoteAdvertisement, RemoteAdvertisementInput, StagedFetchInput,
};
use std::{
    collections::HashMap,
    io::{Read, Write},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};

const WORKER_ARG: &str = "--insomnium-git-advertisement-worker-v1";
const FETCH_WORKER_ARG: &str = "--insomnium-git-fetch-stage-worker-v1";
const PUSH_WORKER_ARG: &str = "--insomnium-git-push-stage-worker-v1";
const MAX_INPUT: u64 = 65536;
const MAX_OUTPUT: u64 = 32 * 1024 * 1024;
const TIMEOUT: Duration = Duration::from_secs(30);
const FETCH_TIMEOUT: Duration = Duration::from_secs(300);

/// Native-only requests. Renderer commands never accept a staging path.
pub(crate) enum WorkerInput {
    Advertisement(RemoteAdvertisementInput),
    Fetch(StagedFetchInput),
}
impl From<RemoteAdvertisementInput> for WorkerInput {
    fn from(input: RemoteAdvertisementInput) -> Self {
        Self::Advertisement(input)
    }
}
impl From<StagedFetchInput> for WorkerInput {
    fn from(input: StagedFetchInput) -> Self {
        Self::Fetch(input)
    }
}

impl WorkerInput {
    pub(crate) fn fetch_in_app_data(
        app_data: &std::path::Path,
        remote: RemoteAdvertisementInput,
        branch: Option<String>,
        depth: Option<u32>,
    ) -> Result<Self, String> {
        let root = app_data.join("git-fetch-v1");
        crate::git_remote::validate_stage_parent(&root)?;
        match std::fs::create_dir(&root) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
            Err(_) => return Err("Cannot create application Git staging root.".into()),
        }
        let directory = root.join(format!("fetch-{}", uuid::Uuid::new_v4()));
        crate::git_remote::validate_stage_parent(&directory)?;
        Ok(Self::Fetch(StagedFetchInput {
            remote,
            directory,
            branch,
            depth,
        }))
    }
}

struct Job {
    cancelled: Arc<AtomicBool>,
    running: bool,
    touched: Instant,
}
#[derive(Clone, Default)]
pub struct RemoteJobState(Arc<Mutex<HashMap<String, Job>>>);

fn key(id: &str) -> Result<String, String> {
    uuid::Uuid::parse_str(id)
        .map(|id| id.to_string())
        .map_err(|_| "Invalid remote request ID.".into())
}
fn prune(jobs: &mut HashMap<String, Job>) {
    jobs.retain(|_, job| job.running || job.touched.elapsed() < Duration::from_secs(60));
}
impl RemoteJobState {
    pub(crate) fn ensure_idle(&self, id: &str) -> Result<(), String> {
        let id = key(id)?;
        let jobs = self.0.lock().map_err(|_| "Remote job lock failed.")?;
        if jobs.get(&id).is_some_and(|job| job.running) {
            return Err("Push is still running. Wait for it to settle before Inspect.".into());
        }
        Ok(())
    }
    pub(crate) fn reserve(&self, id: &str) -> Result<Reservation, String> {
        let id = key(id)?;
        let mut jobs = self.0.lock().map_err(|_| "Remote job lock failed.")?;
        prune(&mut jobs);
        if let Some(job) = jobs.get(&id) {
            return Err(if job.cancelled.load(Ordering::SeqCst) {
                "Git remote request cancelled."
            } else {
                "Remote request ID has already been used."
            }
            .into());
        }
        if jobs.len() >= 128 || jobs.values().filter(|job| job.running).count() >= 4 {
            return Err("Too many remote requests. Wait for active requests to finish.".into());
        }
        let cancelled = Arc::new(AtomicBool::new(false));
        jobs.insert(
            id.clone(),
            Job {
                cancelled: cancelled.clone(),
                running: true,
                touched: Instant::now(),
            },
        );
        Ok(Reservation {
            state: self.0.clone(),
            id,
            cancelled,
        })
    }
    fn cancel(&self, id: &str) -> Result<(), String> {
        let id = key(id)?;
        let mut jobs = self.0.lock().map_err(|_| "Remote job lock failed.")?;
        prune(&mut jobs);
        if let Some(job) = jobs.get_mut(&id) {
            job.cancelled.store(true, Ordering::SeqCst);
            job.touched = Instant::now();
            return Ok(());
        }
        if jobs.len() >= 128 {
            return Err("Remote cancellation registry is full.".into());
        }
        // Cancellation can arrive before the advertisement command is admitted.
        jobs.insert(
            id,
            Job {
                cancelled: Arc::new(AtomicBool::new(true)),
                running: false,
                touched: Instant::now(),
            },
        );
        Ok(())
    }
}
pub(crate) struct Reservation {
    state: Arc<Mutex<HashMap<String, Job>>>,
    id: String,
    pub(crate) cancelled: Arc<AtomicBool>,
}
impl Drop for Reservation {
    fn drop(&mut self) {
        if let Ok(mut jobs) = self.state.lock() {
            if let Some(job) = jobs.get_mut(&self.id) {
                job.running = false;
                job.touched = Instant::now();
            }
        }
    }
}
struct OwnedChild {
    child: Child,
    reaped: bool,
}
impl OwnedChild {
    fn terminate_and_reap(&mut self) -> std::io::Result<()> {
        if self.reaped {
            return Ok(());
        }
        // kill may report an already-exited process. Successful wait is the
        // authoritative termination evidence, regardless of kill's result.
        let _ = self.child.kill();
        self.child.wait()?;
        self.reaped = true;
        Ok(())
    }
}
impl Drop for OwnedChild {
    fn drop(&mut self) {
        // Fallback for early error/unwind. Normal completion checks the result.
        let _ = self.terminate_and_reap();
    }
}

pub(crate) struct StageReservation {
    directory: std::path::PathBuf,
    marker: Vec<u8>,
    // Initial work holds a shared lease; restarted recovery holds an exclusive
    // lease. Both remain alive through their native consumer's lifetime.
    _lease: std::fs::File,
}
impl StageReservation {
    pub(crate) fn create(directory: &std::path::Path) -> Result<Self, String> {
        crate::git_remote::validate_stage_parent(directory)?;
        std::fs::create_dir(directory)
            .map_err(|_| "Cannot reserve fresh Git staging directory.")?;
        let lease = std::fs::File::create_new(directory.join(".insomnium-fetch-lease"))
            .map_err(|_| "Cannot create Git staging lease; retain directory.")?;
        lease
            .try_lock_shared()
            .map_err(|_| "Cannot lock Git staging lease; retain directory.")?;
        lease
            .sync_all()
            .map_err(|_| "Cannot persist Git staging lease; retain directory.")?;
        let marker = format!(
            "insomnium-fetch-stage-v2\n{}\n{}\n",
            uuid::Uuid::new_v4(),
            std::process::id()
        )
        .into_bytes();
        let marker_path = directory.join(".insomnium-fetch-owner");
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(marker_path)
            .map_err(|_| "Cannot create Git staging ownership record; retain directory.")?;
        file.write_all(&marker)
            .and_then(|_| file.sync_all())
            .map_err(|_| "Cannot persist Git staging ownership record; retain directory.")?;
        Ok(Self {
            directory: directory.to_owned(),
            marker,
            _lease: lease,
        })
    }

    /// Worker must acquire its own lease before creating or touching repository
    /// files. Parent death alone must not make an orphan worker's stage idle.
    fn worker_lease(repository: &std::path::Path) -> Result<std::fs::File, String> {
        crate::git_remote::validate_stage_parent(repository)?;
        let directory = repository
            .parent()
            .ok_or("Missing fetch staging container.")?;
        let lease_path = directory.join(".insomnium-fetch-lease");
        let metadata =
            std::fs::symlink_metadata(&lease_path).map_err(|_| "Missing Git staging lease.")?;
        if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() != 0 {
            return Err("Invalid Git staging lease.".into());
        }
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            if metadata.file_attributes() & 0x400 != 0 {
                return Err("Git staging lease cannot be a reparse point.".into());
            }
        }
        let file = std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(lease_path)
            .map_err(|_| "Cannot open Git staging lease.")?;
        file.try_lock_shared()
            .map_err(|_| "Git staging recovery is active.")?;
        let owner_path = directory.join(".insomnium-fetch-owner");
        let metadata =
            std::fs::symlink_metadata(&owner_path).map_err(|_| "Missing Git staging owner.")?;
        if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > 256 {
            return Err("Invalid Git staging owner.".into());
        }
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            if metadata.file_attributes() & 0x400 != 0 {
                return Err("Git staging owner cannot be a reparse point.".into());
            }
        }
        let mut owner = Vec::new();
        std::fs::File::open(owner_path)
            .map_err(|_| "Cannot open Git staging owner.")?
            .take(257)
            .read_to_end(&mut owner)
            .map_err(|_| "Cannot read Git staging owner.")?;
        Self::validate_marker(&owner)?;
        // Recheck ancestry after opening/locking. These are cooperative leases,
        // not handle-relative defenses against malicious external replacements.
        crate::git_remote::validate_stage_parent(repository)?;
        Ok(file)
    }

    fn verify_owner(&self) -> Result<(), String> {
        // Includes the reservation itself in ancestry checks. Never follow a
        // replaced container or ownership marker to delete unrelated data.
        crate::git_remote::validate_stage_parent(&self.directory.join("repository"))?;
        let marker_path = self.directory.join(".insomnium-fetch-owner");
        let metadata = std::fs::symlink_metadata(&marker_path)
            .map_err(|_| "Missing Git staging ownership record; retain directory.")?;
        if !metadata.is_file()
            || metadata.file_type().is_symlink()
            || metadata.len() != self.marker.len() as u64
        {
            return Err("Git staging ownership changed; retain directory.".into());
        }
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            if metadata.file_attributes() & 0x400 != 0 {
                return Err("Git staging ownership is a reparse point; retain directory.".into());
            }
        }
        let mut actual = Vec::new();
        std::fs::File::open(marker_path)
            .map_err(|_| "Cannot open Git staging ownership record; retain directory.")?
            .take(257)
            .read_to_end(&mut actual)
            .map_err(|_| "Cannot read Git staging ownership record; retain directory.")?;
        if actual != self.marker {
            return Err("Git staging ownership changed; retain directory.".into());
        }
        Ok(())
    }

    /// Outgoing transport reuses the native lease and exact ownership checks.
    /// It never opens the managed repository or acquires a recovery lease.
    fn worker_snapshot(repository: &std::path::Path) -> Result<Self, String> {
        let lease = Self::worker_lease(repository)?;
        let directory = repository
            .parent()
            .ok_or("Missing outgoing staging container.")?;
        if repository != directory.join("repository") {
            return Err("Outgoing transport requires the native staging repository.".into());
        }
        let mut marker = Vec::new();
        std::fs::File::open(directory.join(".insomnium-fetch-owner"))
            .map_err(|_| "Cannot reopen outgoing staging owner.")?
            .take(257)
            .read_to_end(&mut marker)
            .map_err(|_| "Cannot read outgoing staging owner.")?;
        Self::validate_marker(&marker)?;
        let stage = Self {
            directory: directory.to_owned(),
            marker,
            _lease: lease,
        };
        stage.repository_path()?;
        Ok(stage)
    }

    pub(crate) fn validate_marker(bytes: &[u8]) -> Result<(), String> {
        if bytes.len() > 256 {
            return Err("Git staging ownership record exceeds size limit.".into());
        }
        let text = std::str::from_utf8(bytes).map_err(|_| "Invalid Git staging owner encoding.")?;
        let lines = text.lines().collect::<Vec<_>>();
        if lines.len() != 3
            || lines[0] != "insomnium-fetch-stage-v2"
            || uuid::Uuid::parse_str(lines[1])
                .map(|id| id.to_string())
                .ok()
                .as_deref()
                != Some(lines[1])
            || lines[2]
                .parse::<u32>()
                .ok()
                .filter(|pid| *pid != 0)
                .is_none()
        {
            return Err("Unsupported Git staging ownership record.".into());
        }
        Ok(())
    }

    pub(crate) fn repository_path(&self) -> Result<std::path::PathBuf, String> {
        self.verify_owner()?;
        let repository = self.directory.join("repository");
        // Check the repository itself, not just its container.
        crate::git_remote::validate_stage_parent(&repository.join("objects"))?;
        Ok(repository)
    }

    pub(crate) fn initialize_outgoing(
        &self,
        branch: &str,
        operation: &str,
    ) -> Result<git2::Repository, String> {
        self.verify_owner()?;
        crate::git::branch_reference(branch)?;
        if uuid::Uuid::parse_str(operation)
            .map(|id| id.to_string())
            .ok()
            .as_deref()
            != Some(operation)
        {
            return Err("Invalid outgoing operation identity.".into());
        }
        // The generic idle Fetch cleaner refuses unexpected top-level entries.
        // This marker keeps submitted Push snapshots retained for inspection.
        let mut marker = std::fs::File::create_new(self.directory.join(".insomnium-push-snapshot"))
            .map_err(|_| "Cannot reserve outgoing snapshot marker.".to_owned())?;
        marker
            .write_all(operation.as_bytes())
            .and_then(|_| marker.sync_all())
            .map_err(|_| "Cannot persist outgoing snapshot marker.".to_owned())?;
        let repository = self.directory.join("repository");
        match std::fs::symlink_metadata(&repository) {
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            _ => return Err("Outgoing snapshot destination already exists; retain stage.".into()),
        }
        let mut options = git2::RepositoryInitOptions::new();
        options
            .bare(true)
            .no_reinit(true)
            .external_template(false)
            .initial_head(branch);
        let result = git2::Repository::init_opts(&repository, &options)
            .map_err(|_| "Cannot initialize outgoing snapshot.".to_owned())?;
        self.repository_path()?;
        Ok(result)
    }

    pub(crate) fn verify_outgoing(&self, operation: &str) -> Result<(), String> {
        self.verify_owner()?;
        let path = self.directory.join(".insomnium-push-snapshot");
        crate::git::reject_link(&path)?;
        let metadata =
            std::fs::symlink_metadata(&path).map_err(|_| "Missing outgoing snapshot marker.")?;
        if !metadata.is_file() || metadata.len() != operation.len() as u64 || operation.len() != 36
        {
            return Err("Outgoing snapshot marker changed.".into());
        }
        let mut bytes = Vec::new();
        std::fs::File::open(&path)
            .map_err(|_| "Cannot open outgoing snapshot marker.")?
            .take(37)
            .read_to_end(&mut bytes)
            .map_err(|_| "Cannot read outgoing snapshot marker.")?;
        if bytes != operation.as_bytes() {
            return Err("Outgoing snapshot operation changed.".into());
        }
        Ok(())
    }

    /// Open only the validated owned ODB; no staging/global Git config or refs.
    pub(crate) fn object_repository(
        &self,
        mut check: impl FnMut() -> Result<(), String>,
    ) -> Result<git2::Repository, String> {
        let path = self.repository_path()?;
        // Only read the owned ODB, never staging repository/global config or refs.
        // Reject filesystem indirection before libgit2 opens any object backend.
        let mut pending = vec![path.join("objects")];
        let mut entries = 0usize;
        while let Some(path) = pending.pop() {
            check()?;
            entries += 1;
            if entries > 1_100_000 {
                return Err("Git staging contains too many filesystem entries.".into());
            }
            let metadata = std::fs::symlink_metadata(&path)
                .map_err(|_| "Cannot inspect staged Git objects.")?;
            let linked = metadata.file_type().is_symlink();
            #[cfg(windows)]
            let linked = {
                use std::os::windows::fs::MetadataExt;
                linked || metadata.file_attributes() & 0x400 != 0
            };
            if linked {
                return Err("Staged Git objects cannot contain links or reparse points.".into());
            }
            if metadata.is_dir() {
                for entry in
                    std::fs::read_dir(&path).map_err(|_| "Cannot read staged object directory.")?
                {
                    let entry = entry.map_err(|_| "Cannot read staged object entry.")?;
                    if pending.len() + entries >= 1_100_000 {
                        return Err("Git staging contains too many filesystem entries.".into());
                    }
                    pending.push(entry.path());
                }
            } else if !metadata.is_file() {
                return Err("Staged Git objects must be regular files.".into());
            }
        }
        for name in ["alternates", "http-alternates"] {
            match std::fs::symlink_metadata(path.join("objects/info").join(name)) {
                Ok(_) => return Err("Staged Git alternate object stores are not supported.".into()),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(_) => return Err("Cannot inspect staged alternate object stores.".into()),
            }
        }
        let git_error = |_| "Cannot validate or import staged Git objects.".to_owned();
        let odb = git2::Odb::new().map_err(git_error)?;
        let objects_path = path.join("objects");
        odb.add_disk_alternate(objects_path.to_str().ok_or("Invalid staged object path.")?)
            .map_err(git_error)?;
        git2::Repository::from_odb(odb).map_err(git_error)
    }

    /// Read-only ownership identity for a journal-bound native stage.
    pub(crate) fn recovery_identity(
        &self,
        app_data: &std::path::Path,
    ) -> Result<(String, String), String> {
        self.verify_owner()?;
        let name = self
            .directory
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or("Invalid recovery staging name.")?;
        let id = name
            .strip_prefix("fetch-")
            .ok_or("Invalid recovery staging name.")?;
        if uuid::Uuid::parse_str(id)
            .map(|id| id.to_string())
            .ok()
            .as_deref()
            != Some(id)
            || self.directory != app_data.join("git-fetch-v1").join(name)
        {
            return Err("Recovery stage is outside native managed staging.".into());
        }
        Self::validate_marker(&self.marker)?;
        Ok((
            name.to_owned(),
            String::from_utf8(self.marker.clone())
                .map_err(|_| "Invalid recovery owner encoding.")?,
        ))
    }

    /// Flush owned recovery files before publishing a journal that pins them.
    /// This does not delete, rename, create, truncate or change their contents.
    pub(crate) fn sync_recovery_material(
        &self,
        app_data: &std::path::Path,
        mut check: impl FnMut() -> Result<(), String>,
    ) -> Result<(String, String), String> {
        check()?;
        self.recovery_identity(app_data)?;
        // The object opener also rejects disk alternates before any flush.
        drop(self.object_repository(&mut check)?);
        let mut pending = vec![self.directory.clone()];
        let mut directories = Vec::new();
        let mut entries = 0usize;
        let mut bytes = 0u64;
        while let Some(path) = pending.pop() {
            check()?;
            entries += 1;
            if entries > 1_100_000 {
                return Err("Recovery staging exceeds filesystem entry limit.".into());
            }
            let metadata = std::fs::symlink_metadata(&path)
                .map_err(|_| "Cannot inspect recovery material.")?;
            let linked = metadata.file_type().is_symlink();
            #[cfg(windows)]
            let linked = {
                use std::os::windows::fs::MetadataExt;
                linked || metadata.file_attributes() & 0x400 != 0
            };
            if linked {
                return Err("Recovery material cannot contain filesystem links.".into());
            }
            if metadata.is_dir() {
                directories.push(path.clone());
                for entry in
                    std::fs::read_dir(path).map_err(|_| "Cannot enumerate recovery material.")?
                {
                    if entries + pending.len() >= 1_100_000 {
                        return Err("Recovery staging exceeds filesystem entry limit.".into());
                    }
                    pending.push(entry.map_err(|_| "Cannot inspect recovery entry.")?.path());
                }
            } else if metadata.is_file() {
                bytes = bytes
                    .checked_add(metadata.len())
                    .ok_or("Recovery material size overflow.")?;
                if bytes > 8 * 1024 * 1024 * 1024 {
                    return Err("Recovery material exceeds 8 GiB flush limit.".into());
                }
                sync_owned_file(&path)?;
            } else {
                return Err(
                    "Recovery material must contain only regular files/directories.".into(),
                );
            }
        }
        #[cfg(unix)]
        {
            for directory in directories.iter().rev() {
                check()?;
                std::fs::File::open(directory)
                    .and_then(|file| file.sync_all())
                    .map_err(|_| "Cannot sync recovery directory; journal not created.")?;
            }
            for directory in [app_data.join("git-fetch-v1"), app_data.to_owned()] {
                std::fs::File::open(directory)
                    .and_then(|file| file.sync_all())
                    .map_err(|_| "Cannot sync recovery parent directory; journal not created.")?;
            }
        }
        check()?;
        self.recovery_identity(app_data)
    }

    pub(crate) fn discard(&self) -> Result<(), String> {
        self.verify_owner()?;
        std::fs::remove_dir_all(&self.directory).map_err(|_| {
            "Cannot remove completed Git staging directory; retain for recovery.".into()
        })
    }
}

/// Reacquire exactly the stage recorded by a validated native journal. No path
/// comes from the renderer and no filesystem object is created or truncated.
/// An exclusive lease refuses surviving workers/parents and concurrent recovery.
/// The caller must still validate journal/ref/objects before making any writes.
impl TryFrom<(&std::path::Path, &str, &[u8])> for StageReservation {
    type Error = String;

    fn try_from(
        (app_data, name, marker): (&std::path::Path, &str, &[u8]),
    ) -> Result<Self, Self::Error> {
        let id = name
            .strip_prefix("fetch-")
            .ok_or("Invalid recovery stage name.")?;
        if uuid::Uuid::parse_str(id)
            .map(|id| id.to_string())
            .ok()
            .as_deref()
            != Some(id)
        {
            return Err("Invalid recovery stage name.".into());
        }
        Self::validate_marker(marker)?;
        let directory = app_data.join("git-fetch-v1").join(name);
        crate::git_remote::validate_stage_parent(&directory.join("repository"))?;
        let lease_path = directory.join(".insomnium-fetch-lease");
        let metadata = std::fs::symlink_metadata(&lease_path)
            .map_err(|_| "Missing recovery staging lease; retain journal.")?;
        let linked = metadata.file_type().is_symlink();
        #[cfg(windows)]
        let linked = {
            use std::os::windows::fs::MetadataExt;
            linked || metadata.file_attributes() & 0x400 != 0
        };
        if linked || !metadata.is_file() || metadata.len() != 0 {
            return Err("Invalid recovery staging lease; retain journal.".into());
        }
        let lease = std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(&lease_path)
            .map_err(|_| "Cannot open recovery staging lease.")?;
        match lease.try_lock() {
            Ok(()) => {}
            Err(std::fs::TryLockError::WouldBlock) => {
                return Err("Git staging is still active; retry recovery after it settles.".into());
            }
            Err(_) => return Err("Cannot acquire exclusive recovery staging lease.".into()),
        }
        let reservation = Self {
            directory,
            marker: marker.to_vec(),
            _lease: lease,
        };
        reservation.repository_path()?;
        Ok(reservation)
    }
}

/// A successful fetch hands its ownership evidence to the native consumer.
/// Not serializable: renderer responses must never include a filesystem lease.
pub(crate) struct WorkerOutput {
    pub(crate) advertisement: RemoteAdvertisement,
    pub(crate) stage: Option<StageReservation>,
    // Captured by supervisor, never inferred from the worker response.
    pub(crate) selected_branch: Option<String>,
    pub(crate) requested_depth: Option<u32>,
}
impl WorkerOutput {
    /// Depth identity is supervisor-owned; boundary metadata must agree with the
    /// leased stage. A short remote can satisfy a depth request without a cut.
    pub(crate) fn verified_boundaries(&self) -> Result<Vec<git2::Oid>, String> {
        if self
            .requested_depth
            .is_some_and(|depth| depth == 0 || depth >= i32::MAX as u32)
        {
            return Err("Invalid fetched history depth.".into());
        }
        let Some(stage) = &self.stage else {
            if self.requested_depth.is_some() || !self.advertisement.shallow_boundaries.is_empty() {
                return Err("Fetched history metadata requires a staging lease.".into());
            }
            return Ok(Vec::new());
        };
        let path = stage.repository_path()?;
        let boundaries = crate::git_remote::read_shallow_boundaries(&path)?;
        let encoded = boundaries
            .iter()
            .map(ToString::to_string)
            .collect::<Vec<_>>();
        if encoded != self.advertisement.shallow_boundaries {
            return Err("Fetched shallow metadata does not match its staging repository.".into());
        }
        if self.requested_depth.is_none() && !boundaries.is_empty() {
            return Err("Full-history fetch returned shallow boundaries.".into());
        }
        Ok(boundaries)
    }

    fn into_advertisement(self) -> Result<RemoteAdvertisement, String> {
        if self.stage.is_some() {
            return Err(
                "Fetched staging requires native consumption before returning to the renderer."
                    .into(),
            );
        }
        Ok(self.advertisement)
    }
}

/// Object import receipt only; no refs, HEAD or workspace have been published.
#[derive(serde::Serialize)]
pub(crate) struct ObjectImportReceipt {
    objects: usize,
}

impl TryFrom<(&WorkerOutput, &git2::Repository, &AtomicBool)> for ObjectImportReceipt {
    type Error = String;

    fn try_from(
        (output, destination, cancelled): (&WorkerOutput, &git2::Repository, &AtomicBool),
    ) -> Result<Self, Self::Error> {
        let check_cancel = || {
            if cancelled.load(Ordering::SeqCst) {
                Err("Git object import cancelled.".to_owned())
            } else {
                Ok(())
            }
        };
        check_cancel()?;
        if !output.verified_boundaries()?.is_empty() {
            return Err("Shallow object import requires history metadata integration.".into());
        }
        let stage = output
            .stage
            .as_ref()
            .ok_or("Object import requires a fetched staging lease.")?;
        let source = stage.object_repository(check_cancel)?;
        let git_error = |_| "Cannot validate or import staged Git objects.".to_owned();
        let mut tips = Vec::new();
        for branch in &output.advertisement.branches {
            if branch.oid.len() != 40 {
                return Err("Invalid fetched branch object ID.".into());
            }
            tips.push(git2::Oid::from_str(&branch.oid).map_err(git_error)?);
        }
        let plan = crate::git_remote::plan_object_graph_while(&source, &tips, &[], check_cancel)?;
        if !plan.shallow_boundaries.is_empty() {
            return Err("Full-history object import cannot contain shallow cuts.".into());
        }
        let verified = plan.objects;
        check_cancel()?;
        let source_odb = source.odb().map_err(git_error)?;
        let target_odb = destination.odb().map_err(git_error)?;
        for oid in &verified {
            check_cancel()?;
            let object = source_odb.read(*oid).map_err(git_error)?;
            if git2::Oid::hash_object(object.kind(), object.data()).map_err(git_error)? != *oid {
                return Err("Staged Git object changed before import.".into());
            }
            if target_odb
                .write(object.kind(), object.data())
                .map_err(git_error)?
                != *oid
            {
                return Err("Imported Git object ID changed.".into());
            }
        }
        check_cancel()?;
        crate::git_remote::validate_object_graph_while(destination, &tips, check_cancel)?;
        stage.verify_owner()?;
        Ok(Self {
            objects: verified.len(),
        })
    }
}

pub(crate) fn run_worker(
    input: impl Into<WorkerInput>,
    cancelled: Arc<AtomicBool>,
    timeout: Duration,
) -> Result<WorkerOutput, String> {
    if cancelled.load(Ordering::SeqCst) {
        return Err("Git remote request cancelled.".into());
    }
    let input = input.into();
    let (selected_branch, requested_depth) = match &input {
        WorkerInput::Advertisement(_) => (None, None),
        WorkerInput::Fetch(input) => (input.branch.clone(), input.depth),
    };
    let (input, stage) = match input {
        WorkerInput::Advertisement(input) => (WorkerInput::Advertisement(input), None),
        WorkerInput::Fetch(mut input) => {
            let stage = StageReservation::create(&input.directory)?;
            input.directory = stage.directory.join("repository");
            (WorkerInput::Fetch(input), Some(stage))
        }
    };
    // No child exists yet. Once spawned, only explicit wait success restores this.
    let mut cleanup_safe = true;
    let result = run_worker_inner(input, cancelled, timeout, &mut cleanup_safe);
    match result {
        Ok(advertisement) => {
            if let Some(stage) = &stage {
                stage.repository_path()?;
            }
            let output = WorkerOutput {
                advertisement,
                stage,
                selected_branch,
                requested_depth,
            };
            output.verified_boundaries()?;
            Ok(output)
        }
        Err(error) => {
            if cleanup_safe {
                if let Some(stage) = stage {
                    stage.discard()?;
                }
            }
            // Unconfirmed termination retains staging. Never clean in Drop.
            Err(error)
        }
    }
}

fn run_worker_inner(
    input: WorkerInput,
    cancelled: Arc<AtomicBool>,
    timeout: Duration,
    cleanup_safe: &mut bool,
) -> Result<RemoteAdvertisement, String> {
    let (payload, argument, maximum_timeout) = match input {
        WorkerInput::Advertisement(input) => (serde_json::to_vec(&input), WORKER_ARG, TIMEOUT),
        WorkerInput::Fetch(input) => (serde_json::to_vec(&input), FETCH_WORKER_ARG, FETCH_TIMEOUT),
    };
    let payload = payload.map_err(|_| "Invalid remote input.")?;
    run_native_worker(
        payload,
        argument,
        maximum_timeout,
        cancelled,
        timeout,
        cleanup_safe,
    )
}

pub(crate) fn run_push_worker(
    input: crate::git_remote::push::PushWorkerInput,
    cancelled: Arc<AtomicBool>,
) -> Result<crate::git_remote::push::PushWorkerResult, String> {
    let payload = serde_json::to_vec(&input).map_err(|_| "Invalid Push worker input.")?;
    // Outgoing stage is retained regardless of outcome; caller owns its lease.
    let mut reaped = true;
    run_native_worker(
        payload,
        PUSH_WORKER_ARG,
        FETCH_TIMEOUT,
        cancelled,
        FETCH_TIMEOUT,
        &mut reaped,
    )
}

fn run_native_worker<T: serde::de::DeserializeOwned>(
    payload: Vec<u8>,
    argument: &str,
    maximum_timeout: Duration,
    cancelled: Arc<AtomicBool>,
    timeout: Duration,
    cleanup_safe: &mut bool,
) -> Result<T, String> {
    if cancelled.load(Ordering::SeqCst) {
        return Err("Git remote request cancelled.".into());
    }
    let timeout = timeout.min(maximum_timeout);
    if payload.len() as u64 > MAX_INPUT {
        return Err("Remote request exceeds input limit.".into());
    }
    let mut command =
        Command::new(std::env::current_exe().map_err(|_| "Cannot locate native worker.")?);
    command
        .arg(argument)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW, no shell
    }
    let mut child = OwnedChild {
        child: command
            .spawn()
            .map_err(|_| "Cannot start native remote worker.")?,
        reaped: false,
    };
    *cleanup_safe = false;
    let mut stdin = child
        .child
        .stdin
        .take()
        .ok_or("Missing worker input pipe.")?;
    let stdout = child
        .child
        .stdout
        .take()
        .ok_or("Missing worker output pipe.")?;
    // Drain output concurrently; large advertisements must not deadlock a full pipe.
    let writer = std::thread::spawn(move || stdin.write_all(&payload));
    let reader = std::thread::spawn(move || {
        let mut output = Vec::new();
        stdout
            .take(MAX_OUTPUT + 1)
            .read_to_end(&mut output)
            .map(|_| output)
    });
    let started = Instant::now();
    let result = loop {
        if cancelled.load(Ordering::SeqCst) {
            break Err("Git remote request cancelled.");
        }
        if started.elapsed() >= timeout {
            break Err("Git remote request timed out.");
        }
        match child.child.try_wait() {
            Ok(Some(status)) if status.success() => break Ok(()),
            Ok(Some(_)) => break Err("Native remote worker exited unexpectedly."),
            Ok(None) => std::thread::sleep(Duration::from_millis(20)),
            Err(_) => break Err("Cannot observe native remote worker."),
        }
    };
    // Terminate and reap before publishing completion/cancellation to the caller.
    let reaped = child.terminate_and_reap();
    *cleanup_safe = reaped.is_ok();
    // Always join both pipes, even if one thread panicked. A dropped JoinHandle
    // detaches its thread and would let work outlive the completion signal.
    let wrote = writer.join();
    let output = reader.join();
    reaped.map_err(|_| "Cannot confirm native worker termination. Retain staging for recovery.")?;
    let wrote = wrote.map_err(|_| "Remote input worker failed.")?;
    let output = output.map_err(|_| "Remote output worker failed.")?;
    result?;
    if cancelled.load(Ordering::SeqCst) {
        return Err("Git remote request cancelled.".into());
    }
    wrote.map_err(|_| "Cannot send remote request.")?;
    let output = output.map_err(|_| "Cannot read remote result.")?;
    if output.len() as u64 > MAX_OUTPUT {
        return Err("Remote response exceeds output limit.".into());
    }
    serde_json::from_slice::<Result<T, String>>(&output)
        .map_err(|_| "Invalid native remote result.".to_owned())?
}

/// Called before Tauri/plugins/single-instance setup. Secrets travel only in stdin.
pub(crate) fn worker_entry() -> bool {
    let argument = std::env::args_os().nth(1);
    let fetch = argument.as_deref() == Some(std::ffi::OsStr::new(FETCH_WORKER_ARG));
    let push = argument.as_deref() == Some(std::ffi::OsStr::new(PUSH_WORKER_ARG));
    if !fetch && !push && argument.as_deref() != Some(std::ffi::OsStr::new(WORKER_ARG)) {
        return false;
    }
    // Also bounds an orphaned worker after abrupt parent exit or blocked stdin.
    std::thread::spawn(move || {
        let limit = if fetch || push {
            FETCH_TIMEOUT
        } else {
            TIMEOUT
        };
        std::thread::sleep(limit + Duration::from_secs(5));
        std::process::exit(124);
    });
    let result = (|| {
        let mut bytes = Vec::new();
        std::io::stdin()
            .take(MAX_INPUT + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "Cannot read native remote input.".to_owned())?;
        if bytes.len() as u64 > MAX_INPUT {
            return Err("Remote request exceeds input limit.".into());
        }
        let value = if push {
            let input: crate::git_remote::push::PushWorkerInput = serde_json::from_slice(&bytes)
                .map_err(|_| "Invalid native Push input.".to_owned())?;
            let stage = StageReservation::worker_snapshot(&input.directory)?;
            serde_json::to_value(crate::git_remote::push::push(input, &stage)?)
        } else if fetch {
            let input: StagedFetchInput = serde_json::from_slice(&bytes)
                .map_err(|_| "Invalid native fetch input.".to_owned())?;
            let _lease = StageReservation::worker_lease(&input.directory)?;
            serde_json::to_value(fetch_stage(input)?)
        } else {
            let input = serde_json::from_slice(&bytes)
                .map_err(|_| "Invalid native remote input.".to_owned())?;
            serde_json::to_value(advertise(input)?)
        };
        value.map_err(|_| "Cannot encode native remote response.".to_owned())
    })();
    if let Ok(bytes) = serde_json::to_vec(&result) {
        let _ = std::io::stdout().write_all(&bytes);
    }
    true
}

/// Flush an already native-owned plain file; callers validate its ownership scope.
pub(crate) fn sync_owned_file(path: &std::path::Path) -> Result<(), String> {
    crate::git_remote::validate_stage_parent(path)?;
    let metadata =
        std::fs::symlink_metadata(path).map_err(|_| "Cannot inspect owned file for flush.")?;
    let linked = metadata.file_type().is_symlink();
    #[cfg(windows)]
    let linked = {
        use std::os::windows::fs::MetadataExt;
        linked || metadata.file_attributes() & 0x400 != 0
    };
    if linked || !metadata.is_file() {
        return Err("Owned flush target must be a regular file.".into());
    }
    // Windows FlushFileBuffers requires a write-capable handle, but
    // libgit2 marks pack/index files readonly. Clear that attribute
    // only while opening our owned file, then restore it before sync.
    // This does not change ACLs; never apply this operation on Unix.
    #[cfg(windows)]
    let file = {
        let original = metadata.permissions();
        if original.readonly() {
            let mut writable = original.clone();
            #[expect(
                clippy::permissions_set_readonly_false,
                reason = "Windows-only readonly attribute; ACLs unchanged and original restored before sync"
            )]
            writable.set_readonly(false);
            std::fs::set_permissions(path, writable)
                .map_err(|_| "Cannot prepare owned recovery file for flush.")?;
        }
        let opened = std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(path);
        if original.readonly() {
            std::fs::set_permissions(path, original)
                .map_err(|_| "Cannot restore recovery readonly attribute; retain staging.")?;
        }
        opened
            .map_err(|_| "Cannot open recovery material for flush; recovery material retained.")?
    };
    #[cfg(not(windows))]
    let file = std::fs::File::open(path)
        .map_err(|_| "Cannot open recovery material for flush; recovery material retained.")?;
    file.sync_all()
        .map_err(|_| "Cannot flush recovery material; recovery material retained.")?;
    if file
        .metadata()
        .map_err(|_| "Cannot verify flushed recovery file.")?
        .len()
        != metadata.len()
    {
        return Err("Recovery material changed during flush.".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn git_remote_advertise(
    state: tauri::State<'_, RemoteJobState>,
    request_id: String,
    input: RemoteAdvertisementInput,
) -> Result<RemoteAdvertisement, String> {
    let reservation = state.reserve(&request_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let result = run_worker(input, reservation.cancelled.clone(), TIMEOUT)
            .and_then(WorkerOutput::into_advertisement);
        drop(reservation);
        result
    })
    .await
    .map_err(|_| "Remote supervisor failed.".to_owned())?
}

#[tauri::command]
pub fn git_remote_cancel(
    state: tauri::State<'_, RemoteJobState>,
    request_id: String,
) -> Result<(), String> {
    // Acknowledges the cancellation request. Original command resolves after reaping.
    state.cancel(&request_id)
}

/// Native allocation entry point for the forthcoming fetch command. Paths and
/// operation UUIDs are generated here, never accepted from renderer arguments.
impl TryFrom<(tauri::AppHandle, RemoteAdvertisementInput)> for WorkerInput {
    type Error = String;

    fn try_from(
        (app, remote): (tauri::AppHandle, RemoteAdvertisementInput),
    ) -> Result<Self, Self::Error> {
        use tauri::Manager;
        let app_data = app
            .path()
            .app_data_dir()
            .map_err(|_| "Cannot resolve application data directory.")?;
        Self::fetch_in_app_data(&app_data, remote, None, None)
    }
}
