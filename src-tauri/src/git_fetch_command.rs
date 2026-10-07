use crate::{git, git_fetch_journal, git_fetch_snapshot, git_remote, git_remote_job, storage};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{path::Path, sync::atomic::Ordering, time::Duration};
use tauri::Manager;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FetchRequest {
    request_id: String,
    workspace_id: String,
    repository_id: String,
    expected_binding: Value,
    #[serde(default)]
    branch: Option<String>,
    #[serde(default)]
    depth: Option<u32>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchResult {
    snapshot: git_fetch_snapshot::FetchSnapshot,
    reconciled: bool,
    cleanup_pending: Option<bool>,
}

fn checked_binding<'a>(data: &'a Value, request: &FetchRequest) -> Result<&'a Value, String> {
    let resources = data["resources"]
        .as_array()
        .ok_or("Missing workspace resources.")?;
    if !resources.iter().any(|r| {
        r["_id"] == request.workspace_id && r["_type"] == "workspace" && r["isPrivate"] != true
    }) {
        return Err("Fetch collection is missing or private.".into());
    }
    let bindings = resources
        .iter()
        .filter(|r| r["_type"] == "git_repository" && r["parentId"] == request.workspace_id)
        .collect::<Vec<_>>();
    if bindings.len() != 1
        || bindings[0] != &request.expected_binding
        || bindings[0]["nativeBindingVersion"] != 1
        || bindings[0]["nativeRepositoryId"] != request.repository_id
        || resources
            .iter()
            .filter(|r| {
                r["_type"] == "git_repository" && r["nativeRepositoryId"] == request.repository_id
            })
            .count()
            != 1
    {
        return Err("Git binding or saved settings changed; reload before fetching.".into());
    }
    Ok(bindings[0])
}

fn admit(
    directory: &Path,
    request: &FetchRequest,
) -> Result<git_remote::RemoteAdvertisementInput, String> {
    storage::ensure_no_pending_transition(directory)?;
    let data = storage::read_workspace_file(directory)?.ok_or("Missing saved workspace.")?;
    let binding = checked_binding(&data, request)?;
    git_remote::RemoteAdvertisementInput::from_saved_binding(binding)
}

pub(crate) fn destination(directory: &Path, repository_id: &str) -> Result<git2::Repository, String> {
    let repository = recovery_destination(directory, repository_id)?;
    git_fetch_journal::ensure_ready(&repository)?;
    Ok(repository)
}

fn recovery_destination(directory: &Path, repository_id: &str) -> Result<git2::Repository, String> {
    let root = directory.join("git-v1");
    let path = git::managed_path(&root, repository_id)?;
    git_remote::validate_stage_parent(&path.join(".git"))?;
    let git_path = path.join(".git");
    let mut pending = vec![git_path.clone()];
    let mut count = 0usize;
    while let Some(entry) = pending.pop() {
        count += 1;
        if count > 1_100_000 {
            return Err("Managed Git repository has too many filesystem entries.".into());
        }
        git::reject_link(&entry)?;
        let metadata = std::fs::symlink_metadata(&entry)
            .map_err(|_| "Cannot inspect managed Git repository.")?;
        if metadata.is_dir() {
            for child in
                std::fs::read_dir(entry).map_err(|_| "Cannot inspect managed Git directory.")?
            {
                if count + pending.len() >= 1_100_000 {
                    return Err("Managed Git repository has too many filesystem entries.".into());
                }
                pending.push(
                    child
                        .map_err(|_| "Cannot inspect managed Git entry.")?
                        .path(),
                );
            }
        } else if !metadata.is_file() {
            return Err("Managed Git files must be regular files.".into());
        }
    }
    for name in [
        "objects/info/alternates",
        "objects/info/http-alternates",
        "commondir",
    ] {
        match std::fs::symlink_metadata(git_path.join(name)) {
            Ok(_) => {
                return Err(
                    "Managed fetch repository cannot use alternate/shared object storage.".into(),
                )
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => return Err("Cannot inspect managed object storage.".into()),
        }
    }
    let repository = git::open_managed_for_recovery(&path)?;
    if std::fs::canonicalize(repository.commondir())
        .map_err(|_| "Cannot inspect common Git directory.")?
        != std::fs::canonicalize(&git_path).map_err(|_| "Cannot inspect managed Git directory.")?
    {
        return Err("Git common directory escaped managed repository.".into());
    }
    Ok(repository)
}

#[tauri::command]
pub async fn git_remote_fetch(
    app: tauri::AppHandle,
    git_state: tauri::State<'_, git::GitState>,
    storage_state: tauri::State<'_, storage::StorageState>,
    jobs: tauri::State<'_, git_remote_job::RemoteJobState>,
    request: FetchRequest,
) -> Result<FetchResult, String> {
    validate_request(&request)?;
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|_| "Cannot resolve application data.")?;
    let git_lock = git_state.0.clone();
    let storage_lock = storage_state.0.clone();
    let jobs = jobs.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let (remote, expected) = {
            let _git = git_lock.lock().map_err(|_| "Git lock failed.")?;
            let session = storage_lock.lock().map_err(|_| "Workspace lock failed.")?;
            session.require_loaded()?;
            let remote = admit(&directory, &request)?;
            let repository = destination(&directory, &request.repository_id)?;
            let current = git_fetch_snapshot::read_snapshot(&repository, &remote.url)?;
            if let Some(snapshot) = current.as_ref() {
                if snapshot.manifest.operation_id == request.request_id {
                    if !snapshot
                        .manifest
                        .matches_history_operation(&request.request_id, request.branch.as_deref(), request.depth)
                    {
                        return Err(
                            "Fetch operation ID was used with a different branch scope or history depth.".into()
                        );
                    }
                    return Ok(FetchResult {
                        snapshot: current.unwrap(),
                        reconciled: true,
                        cleanup_pending: None,
                    });
                }
            }
            require_fetch_intent(&request)?;
            let expected = current
                .map(|s| git2::Oid::from_str(&s.oid).map_err(|_| "Invalid current fetch snapshot."))
                .transpose()?;
            (remote, expected)
        };
        let reservation = jobs.reserve(&request.request_id)?;
        let input = git_remote_job::WorkerInput::fetch_in_app_data(
            &directory,
            remote,
            request.branch.clone(),
            request.depth,
        )?;
        // No GitState/StorageState locks during network I/O.
        let output = git_remote_job::run_worker(
            input,
            reservation.cancelled.clone(),
            Duration::from_secs(300),
        )?;
        let snapshot = {
            let _git = git_lock.lock().map_err(|_| "Git lock failed.")?;
            let session = storage_lock.lock().map_err(|_| "Workspace lock failed.")?;
            session.require_loaded()?;
            admit(&directory, &request)?;
            if reservation.cancelled.load(Ordering::SeqCst) {
                output
                    .stage
                    .as_ref()
                    .ok_or("Missing fetched staging lease.")?
                    .discard()?;
                return Err("Git fetch cancelled before publication.".into());
            }
            let repository = destination(&directory, &request.repository_id)?;
            let history = git_fetch_snapshot::CandidateInput {
                destination: &repository, output: &output,
                operation_id: &request.request_id, expected,
                cancelled: &reservation.cancelled,
            };
            let candidate = git_fetch_snapshot::FetchSnapshot::try_from(history)?;
            git_fetch_journal::Journal::try_from(git_fetch_journal::JournalCreationInput {
                app_data: &directory,
                publication: git_fetch_snapshot::PublicationInput {
                    candidate: git2::Oid::from_str(&candidate.oid)
                        .map_err(|_| "Invalid prepared fetch snapshot.")?,
                    history,
                },
            })?;
            git_fetch_snapshot::FetchSnapshot::try_from(git_fetch_journal::RecoveryInput {
                app_data: &directory, repository: &repository,
                stage: output.stage.as_ref().ok_or("Missing fetched staging lease.")?,
                cancelled: &reservation.cancelled,
            })?
        };
        let cleanup_pending = output
            .stage
            .as_ref()
            .ok_or("Missing fetched staging lease.")?
            .discard()
            .is_err();
        Ok(FetchResult {
            snapshot,
            reconciled: false,
            cleanup_pending: Some(cleanup_pending),
        })
    })
    .await
    .map_err(|_| "Git fetch supervisor failed.")?
}

/// New publication must remain discoverable after a process restart.
fn require_fetch_intent(request: &FetchRequest) -> Result<(), String> {
    let error = "Saved fetch intent does not match operation, branch, depth or binding; reload before fetching.";
    let intent = request
        .expected_binding
        .get("nativeFetchIntent")
        .ok_or(error)?;
    let branch = match intent.get("branch") {
        None | Some(Value::Null) => None,
        Some(Value::String(value)) => Some(value.as_str()),
        _ => return Err(error.into()),
    };
    let depth = match intent.get("depth") {
        None | Some(Value::Null) => None,
        Some(value) => Some(value.as_u64().ok_or(error)?),
    };
    let version_ok = match intent["version"].as_u64() {
        Some(1) => branch.is_none() && depth.is_none(),
        Some(2) => branch.is_some() && depth.is_none(),
        Some(3) => true,
        _ => false,
    };
    if !version_ok
        || intent["operationId"] != request.request_id
        || intent["workspaceId"] != request.workspace_id
        || intent["repositoryId"] != request.repository_id
        || intent["url"] != request.expected_binding["uri"]
        || branch != request.branch.as_deref()
        || depth != request.depth.map(u64::from)
    {
        return Err(error.into());
    }
    Ok(())
}

fn validate_request(request: &FetchRequest) -> Result<(), String> {
    if request
        .depth
        .is_some_and(|depth| depth == 0 || depth >= i32::MAX as u32)
    {
        return Err("Invalid fetch history depth.".into());
    }
    if let Some(branch) = &request.branch {
        let reference = format!("refs/heads/{branch}");
        if reference.len() > 4096 || !git2::Reference::is_valid_name(&reference) {
            return Err("Invalid selected fetch branch.".into());
        }
    }
    let canonical = uuid::Uuid::parse_str(&request.request_id)
        .map_err(|_| "Invalid fetch operation ID.")?
        .to_string();
    if canonical != request.request_id
        || request.workspace_id.is_empty()
        || request.workspace_id.len() > 256
        || serde_json::to_vec(&request.expected_binding)
            .map_err(|_| "Invalid expected Git binding.")?
            .len()
            > 65536
    {
        return Err("Invalid fetch request.".into());
    }
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchObservation {
    request_id: String,
    // Only confirms the currently published snapshot. A different/missing
    // pointer cannot prove this operation never committed in the past.
    confirmed_current: bool,
    snapshot: Option<git_fetch_snapshot::FetchSnapshot>,
}

/// Read-only reconciliation. Never calls the remote or changes a ref.
#[tauri::command]
pub async fn git_remote_fetch_inspect(
    app: tauri::AppHandle,
    git_state: tauri::State<'_, git::GitState>,
    storage_state: tauri::State<'_, storage::StorageState>,
    request: FetchRequest,
) -> Result<FetchObservation, String> {
    validate_request(&request)?;
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|_| "Cannot resolve application data.")?;
    let git_lock = git_state.0.clone();
    let storage_lock = storage_state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _git = git_lock.lock().map_err(|_| "Git lock failed.")?;
        let session = storage_lock.lock().map_err(|_| "Workspace lock failed.")?;
        session.require_loaded()?;
        let remote = admit(&directory, &request)?;
        let repository = destination(&directory, &request.repository_id)?;
        let snapshot = git_fetch_snapshot::read_snapshot(&repository, &remote.url)?;
        let confirmed_current = snapshot.as_ref().is_some_and(|value| {
            value.manifest.matches_history_operation(
                &request.request_id,
                request.branch.as_deref(),
                request.depth,
            )
        });
        Ok(FetchObservation {
            request_id: request.request_id,
            confirmed_current,
            snapshot,
        })
    })
    .await
    .map_err(|_| "Git fetch inspection failed.")?
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RecoveryRequest {
    fetch: FetchRequest,
    attempt_id: String,
    #[serde(default)]
    depth: Option<u32>,
}

/// Read-only metadata observation. A pending state does not assert that the
/// candidate graph is recoverable; explicit recovery validates that separately.
#[tauri::command]
pub async fn git_remote_fetch_recovery_status(
    app: tauri::AppHandle,
    git_state: tauri::State<'_, git::GitState>,
    storage_state: tauri::State<'_, storage::StorageState>,
    request: FetchRequest,
) -> Result<Option<git_fetch_journal::RecoveryStatus>, String> {
    validate_request(&request)?;
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|_| "Cannot resolve application data.")?;
    let git_lock = git_state.0.clone();
    let storage_lock = storage_state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _git = git_lock.lock().map_err(|_| "Git lock failed.")?;
        let session = storage_lock.lock().map_err(|_| "Workspace lock failed.")?;
        session.require_loaded()?;
        let remote = admit(&directory, &request)?;
        let repository = recovery_destination(&directory, &request.repository_id)?;
        git_fetch_journal::observe(&repository, &remote.url, &request.request_id)
    })
    .await
    .map_err(|_| "Git fetch recovery observation failed.")?
}

/// Explicit same-operation recovery. No remote request, workspace update or
/// local HEAD change. Keep the stage for acknowledgment/explicit cleanup.
#[tauri::command]
pub async fn git_remote_fetch_recover(
    app: tauri::AppHandle,
    git_state: tauri::State<'_, git::GitState>,
    storage_state: tauri::State<'_, storage::StorageState>,
    jobs: tauri::State<'_, git_remote_job::RemoteJobState>,
    request: RecoveryRequest,
) -> Result<FetchResult, String> {
    validate_request(&request.fetch)?;
    let attempt = uuid::Uuid::parse_str(&request.attempt_id)
        .map_err(|_| "Invalid recovery attempt ID.")?
        .to_string();
    if attempt != request.attempt_id || attempt == request.fetch.request_id {
        return Err(
            "Recovery requires a fresh attempt ID distinct from the saved operation.".into(),
        );
    }
    if request
        .depth
        .is_some_and(|depth| depth == 0 || depth >= i32::MAX as u32)
        || request.fetch.depth.is_some()
    {
        return Err("Fetch recovery depth must be positive.".into());
    }
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|_| "Cannot resolve application data.")?;
    let git_lock = git_state.0.clone();
    let storage_lock = storage_state.0.clone();
    let jobs = jobs.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let request_id = &request.fetch.request_id;
        let reservation = jobs.reserve(&request.attempt_id)?;
        let _git = git_lock.lock().map_err(|_| "Git lock failed.")?;
        let session = storage_lock.lock().map_err(|_| "Workspace lock failed.")?;
        session.require_loaded()?;
        let remote = admit(&directory, &request.fetch)?;
        let repository = recovery_destination(&directory, &request.fetch.repository_id)?;
        let pending = git_fetch_journal::observe(&repository, &remote.url, request_id)?;
        if pending.is_none() {
            let snapshot = git_fetch_snapshot::read_snapshot(&repository, &remote.url)?
                .ok_or("No pending or currently published matching fetch operation.")?;
            if !snapshot.manifest.matches_history_operation(
                request_id,
                request.fetch.branch.as_deref(),
                request.depth,
            ) {
                return Err(
                    "Published fetch does not match the requested recovery operation.".into(),
                );
            }
            return Ok(FetchResult {
                snapshot,
                reconciled: true,
                cleanup_pending: None,
            });
        }
        let stage = git_remote_job::StageReservation::try_from((directory.as_path(), &repository))?;
        let input = git_fetch_journal::RecoveryInput {
            app_data: &directory,
            repository: &repository,
            stage: &stage,
            cancelled: &reservation.cancelled,
        };
        let plan = git_fetch_snapshot::PublicationPlan::try_from(input)?;
        if plan.snapshot.manifest.endpoint_key != git_fetch_snapshot::endpoint_key(&remote.url)?
            || !plan.snapshot.manifest.matches_history_operation(
                request_id,
                request.fetch.branch.as_deref(),
                request.depth,
            )
        {
            return Err(
                "Recovery candidate does not match the saved endpoint and operation scope.".into(),
            );
        }
        let snapshot = git_fetch_snapshot::FetchSnapshot::try_from(input)?;
        Ok(FetchResult {
            snapshot,
            reconciled: false,
            cleanup_pending: Some(true),
        })
    })
    .await
    .map_err(|_| "Git fetch recovery failed; inspect the same operation before retrying.")?
}
