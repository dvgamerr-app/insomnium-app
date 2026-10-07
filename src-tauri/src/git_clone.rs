//! Clone candidates are isolated from installed repositories and workspace data.
//! A ready receipt is inspectable without another network request. Installation
//! and its workspace recovery journal are separate consumers of this candidate.
use crate::{git, git_remote, git_remote_job, storage};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::atomic::Ordering,
    time::Duration,
};
use tauri::Manager;
pub(crate) mod install;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CloneStageInput {
    operation_id: String,
    remote: git_remote::RemoteAdvertisementInput,
    #[serde(default)]
    branch: Option<String>,
}

#[derive(Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CloneReceipt {
    version: u32,
    operation_id: String,
    repository_id: String,
    url: String,
    requested_branch: Option<String>,
    phase: String,
    local_branch: Option<String>,
    head_oid: Option<String>,
    branches: Vec<CloneBranch>,
}

#[derive(Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
struct CloneBranch {
    name: String,
    oid: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClonePreview {
    receipt: CloneReceipt,
    collection: Option<git::CommittedResources>,
}

fn uuid(value: &str) -> Result<String, String> {
    let id = uuid::Uuid::parse_str(value).map_err(|_| "Invalid Clone operation ID")?;
    if id.to_string() != value {
        return Err("Clone operation ID must be canonical".into());
    }
    Ok(id.to_string())
}

fn directory(app_data: &Path, operation: &str) -> Result<PathBuf, String> {
    let root = app_data.join("git-clone-v1");
    git_remote::validate_stage_parent(&root)?;
    git::reject_link(&root)?;
    let path = root.join(format!("clone-{}", uuid(operation)?));
    git::reject_link(&path)?;
    Ok(path)
}

fn read_receipt(path: &Path) -> Result<Option<CloneReceipt>, String> {
    let file = path.join("receipt.json");
    git::reject_link(&file)?;
    let metadata = match fs::symlink_metadata(&file) {
        Ok(metadata) => metadata,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(e.to_string()),
    };
    const MAX_RECEIPT: u64 = 8 * 1024 * 1024;
    if !metadata.is_file() || metadata.len() > MAX_RECEIPT {
        return Err("Clone receipt must be a bounded regular file; stage retained".into());
    }
    let mut options = fs::OpenOptions::new();
    options.read(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.custom_flags(0x0020_0000);
    }
    let opened = options.open(file).map_err(|e| e.to_string())?;
    let actual = opened.metadata().map_err(|e| e.to_string())?;
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if actual.file_attributes() & 0x400 != 0 {
            return Err("Clone receipt cannot be a reparse point".into());
        }
    }
    if !actual.is_file() {
        return Err("Clone receipt is not a regular file".into());
    }
    let mut bytes = Vec::new();
    opened
        .take(MAX_RECEIPT + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > MAX_RECEIPT {
        return Err("Clone receipt exceeds size limit".into());
    }
    let value: CloneReceipt =
        serde_json::from_slice(&bytes).map_err(|_| "Invalid Clone receipt; stage retained")?;
    if value.version != 1
        || value.repository_id != format!("clone_{}", uuid(&value.operation_id)?)
        || !matches!(value.phase.as_str(), "receiving" | "ready" | "failed")
        || path.file_name().and_then(|s| s.to_str())
            != Some(format!("clone-{}", value.operation_id).as_str())
        || value.branches.len() > 1000
    {
        return Err("Invalid Clone receipt identity; stage retained".into());
    }
    git_remote::endpoint(&value.url)?;
    if let Some(branch) = &value.requested_branch {
        git::branch_reference(branch)?;
    }
    if let Some(branch) = &value.local_branch {
        git::branch_reference(branch)?;
    }
    let mut names = std::collections::HashSet::new();
    for branch in &value.branches {
        git::branch_reference(&branch.name)?;
        if !names.insert(branch.name.to_lowercase()) || !full_oid(&branch.oid) {
            return Err("Invalid or case-colliding Clone branches".into());
        }
    }
    if value.head_oid.as_deref().is_some_and(|oid| !full_oid(oid)) {
        return Err("Invalid Clone head revision".into());
    }
    Ok(Some(value))
}

fn full_oid(value: &str) -> bool {
    value.len() == 40
        && value
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
        && value != "0000000000000000000000000000000000000000"
}

fn write_receipt(path: &Path, receipt: &CloneReceipt) -> Result<(), String> {
    git::reject_link(path)?;
    git::reject_link(&path.join("receipt.json"))?;
    storage::atomic_write(
        &path.join("receipt.json"),
        &serde_json::to_vec(receipt).map_err(|e| e.to_string())?,
    )
}

fn preview(path: &Path, receipt: CloneReceipt) -> Result<ClonePreview, String> {
    if receipt.phase != "ready" {
        return Ok(ClonePreview {
            receipt,
            collection: None,
        });
    }
    let repo = git::open_managed(&path.join("candidate"))?;
    let branch = receipt
        .local_branch
        .as_deref()
        .ok_or("Ready Clone has no local branch")?;
    let reference = git::branch_reference(branch)?;
    let head = repo
        .find_reference("HEAD")
        .map_err(|e| e.message().to_owned())?;
    if head.symbolic_target().map_err(|e| e.message().to_owned())? != Some(reference.as_str()) {
        return Err("Clone candidate HEAD changed; stage retained".into());
    }
    let mut tips = Vec::new();
    for row in &receipt.branches {
        let oid = git2::Oid::from_str(&row.oid).map_err(|e| e.message().to_owned())?;
        if repo
            .refname_to_id(&format!("refs/remotes/origin/{}", row.name))
            .map_err(|e| e.message().to_owned())?
            != oid
        {
            return Err("Clone tracking revision changed; stage retained".into());
        }
        tips.push(oid);
    }
    if !git_remote::read_shallow_boundaries(repo.path())?.is_empty() {
        return Err("Clone candidate has incomplete history".into());
    }
    git_remote::validate_object_graph(&repo, &tips)?;
    let collection = match receipt.head_oid.as_deref() {
        Some(oid) => {
            if !receipt
                .branches
                .iter()
                .any(|row| row.name == branch && row.oid == oid)
                || repo
                    .refname_to_id(&reference)
                    .map_err(|e| e.message().to_owned())?
                    .to_string()
                    != oid
            {
                return Err("Clone local revision changed; stage retained".into());
            }
            Some(git::committed_resources(&repo, oid)?)
        }
        None => {
            if !receipt.branches.is_empty() || repo.find_reference(&reference).is_ok() {
                return Err("Empty Clone gained a branch; stage retained".into());
            }
            None
        }
    };
    Ok(ClonePreview {
        receipt,
        collection,
    })
}

#[tauri::command]
pub async fn git_clone_list(
    app: tauri::AppHandle,
    state: tauri::State<'_, git::GitState>,
) -> Result<Vec<CloneReceipt>, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let lock = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _git = lock.lock().map_err(|_| "Git lock failed")?;
        let root = app_data.join("git-clone-v1");
        git_remote::validate_stage_parent(&root)?;
        git::reject_link(&root)?;
        let entries = match fs::read_dir(&root) {
            Ok(entries) => entries,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(e) => return Err(e.to_string()),
        };
        let mut receipts = Vec::new();
        for (index, entry) in entries.enumerate() {
            if index >= 128 {
                return Err(
                    "Clone stage inventory exceeds 128 entries; all stages retained".into(),
                );
            }
            let entry = entry.map_err(|e| e.to_string())?;
            let name = entry.file_name();
            let name = name
                .to_str()
                .ok_or("Clone stage inventory contains an invalid name")?;
            let operation = name
                .strip_prefix("clone-")
                .ok_or("Clone staging root contains an unknown entry; retained")?;
            let path = directory(&app_data, operation)?;
            let receipt = read_receipt(&path)?
                .ok_or("Incomplete Clone reservation has no receipt; retained")?;
            receipts.push(receipt);
        }
        receipts.sort_by(|a, b| a.operation_id.cmp(&b.operation_id));
        Ok(receipts)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_clone_inspect(
    app: tauri::AppHandle,
    state: tauri::State<'_, git::GitState>,
    operation_id: String,
) -> Result<ClonePreview, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let lock = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _git = lock.lock().map_err(|_| "Git lock failed")?;
        let path = directory(&app_data, &operation_id)?;
        let receipt =
            read_receipt(&path)?.ok_or("Clone receipt not found; no network request was made")?;
        preview(&path, receipt)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_clone_stage(
    app: tauri::AppHandle,
    state: tauri::State<'_, git::GitState>,
    storage_state: tauri::State<'_, storage::StorageState>,
    jobs: tauri::State<'_, git_remote_job::RemoteJobState>,
    input: CloneStageInput,
) -> Result<ClonePreview, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let git_lock = state.0.clone();
    let storage_lock = storage_state.0.clone();
    let jobs = jobs.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        uuid(&input.operation_id)?;
        let url = git_remote::endpoint(&input.remote.url)?.to_string();
        if let Some(branch) = &input.branch { git::branch_reference(branch)?; }
        let path = directory(&app_data, &input.operation_id)?;
        let mut receipt = CloneReceipt { version: 1, operation_id: input.operation_id.clone(),
            repository_id: format!("clone_{}", input.operation_id), url, requested_branch: input.branch.clone(),
            phase: "receiving".into(), local_branch: None, head_oid: None, branches: Vec::new() };
        {
            let _git = git_lock.lock().map_err(|_| "Git lock failed")?;
            let session = storage_lock.lock().map_err(|_| "Workspace lock failed")?;
            session.require_loaded()?;
            storage::ensure_no_pending_transition(&app_data)?;
            if let Some(existing) = read_receipt(&path)? {
                if existing.url != receipt.url || existing.requested_branch != receipt.requested_branch {
                    return Err("Clone operation ID was used with different settings".into());
                }
                if existing.phase != "ready" {
                    return Err("Clone is incomplete or unconfirmed. Inspect retained stage; use a new operation for an explicit retry".into());
                }
                return preview(&path, existing);
            }
            let root = path.parent().ok_or("Missing Clone staging root")?;
            match fs::create_dir(root) {
                Ok(()) => {}, Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}, Err(e) => return Err(e.to_string()),
            }
            git_remote::validate_stage_parent(&path)?;
            fs::create_dir(&path).map_err(|_| "Cannot reserve fresh Clone stage; existing path retained")?;
            write_receipt(&path, &receipt)?;
        }
        let reservation = jobs.reserve(&input.operation_id)?;
        let worker_input = git_remote_job::WorkerInput::fetch_in_app_data(&app_data, input.remote, input.branch, None)?;
        // Neither GitState nor StorageState is held during network I/O.
        let output = match git_remote_job::run_worker(worker_input, reservation.cancelled.clone(), Duration::from_secs(300)) {
            Ok(output) => output,
            Err(error) => {
                let _git = git_lock.lock().map_err(|_| "Git lock failed")?;
                if read_receipt(&path)?.as_ref() != Some(&receipt) { return Err("Clone receipt changed; stage retained".into()); }
                receipt.phase = "failed".into(); write_receipt(&path, &receipt)?;
                return Err(error);
            }
        };
        let _git = git_lock.lock().map_err(|_| "Git lock failed")?;
        let session = storage_lock.lock().map_err(|_| "Workspace lock failed")?;
        session.require_loaded()?;
        storage::ensure_no_pending_transition(&app_data)?;
        if read_receipt(&path)?.as_ref() != Some(&receipt) { return Err("Clone receipt changed; stage retained".into()); }
        if reservation.cancelled.load(Ordering::SeqCst) { return Err("Clone cancelled before candidate creation; stage retained".into()); }
        if output.advertisement.branches.len() > 1000 {
            return Err("Clone exceeds 1000 branches; select an exact branch in a new operation".into());
        }
        let chosen = match (output.advertisement.branches.is_empty(), output.advertisement.empty) {
            (true, true) => "main".to_owned(),
            (true, false) => return Err("Remote has no branches. Choose a repository with a branch; stage retained".into()),
            (false, _) => output.selected_branch.clone().or_else(|| output.advertisement.default_branch.clone())
                .ok_or("Remote default branch is unknown. Select an exact branch in a new Clone operation")?,
        };
        let selected = output.advertisement.branches.iter().find(|row| row.name == chosen);
        if !output.advertisement.branches.is_empty() && selected.is_none() { return Err("Clone default branch was not fetched".into()); }
        let candidate = path.join("candidate");
        git_remote::validate_stage_parent(&candidate)?;
        fs::create_dir(&candidate).map_err(|_| "Clone candidate path already exists; retained")?;
        let mut options = git2::RepositoryInitOptions::new();
        options.no_reinit(true).external_template(false).initial_head(&chosen);
        let repo = git2::Repository::init_opts(&candidate, &options).map_err(|e| e.message().to_owned())?;
        git_remote_job::ObjectImportReceipt::try_from((&output, &repo, reservation.cancelled.as_ref()))?;
        repo.remote("origin", &receipt.url).map_err(|e| e.message().to_owned())?;
        for branch in &output.advertisement.branches {
            let oid = git2::Oid::from_str(&branch.oid).map_err(|e| e.message().to_owned())?;
            repo.reference(&format!("refs/remotes/origin/{}", branch.name), oid, false, "clone: remote snapshot")
                .map_err(|e| e.message().to_owned())?;
            receipt.branches.push(CloneBranch { name: branch.name.clone(), oid: branch.oid.clone() });
        }
        if let Some(selected) = selected {
            repo.reference(&git::branch_reference(&chosen)?, git2::Oid::from_str(&selected.oid).map_err(|e| e.message().to_owned())?, false, "clone: local branch")
                .map_err(|e| e.message().to_owned())?;
            receipt.head_oid = Some(selected.oid.clone());
        }
        receipt.local_branch = Some(chosen);
        receipt.phase = "ready".into();
        let result = preview(&path, receipt)?;
        write_receipt(&path, &result.receipt)?;
        output.stage.as_ref().ok_or("Missing Clone worker stage")?.discard()?;
        Ok(result)
    }).await.map_err(|e| e.to_string())?
}
