//! Outgoing Push admission and durable no-resubmission receipts.
//! Does not publish local refs or write workspace data. Inspection only advertises.
use crate::{
    git, git_fetch_cleanup, git_fetch_command, git_journal, git_remote, git_remote_job, storage,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::atomic::Ordering,
    time::Duration,
};
use tauri::Manager;

#[derive(Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PushIntent {
    version: u32,
    phase: String,
    operation_id: String,
    workspace_id: String,
    repository_id: String,
    binding_id: String,
    url: String,
    source_branch: String,
    source_oid: String,
    destination_branch: String,
    expected_remote_oid: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PushRequest {
    intent: PushIntent,
    expected_binding: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InspectRequest {
    push: PushRequest,
    attempt_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RetireRequest {
    push: PushRequest,
    attempt_id: String,
    expected_receipt: Option<PushReceipt>,
}

#[derive(Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PushReceipt {
    version: u32,
    intent: PushIntent,
    phase: String,
    stage_name: Option<String>,
    stage_marker: Option<String>,
    result: Option<git_remote::push::PushWorkerResult>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PushObservation {
    operation_id: String,
    receipt: Option<PushReceipt>,
    observed_remote_oid: Option<String>,
    matches_pinned_commit: bool,
}

fn uuid(value: &str) -> Result<(), String> {
    if uuid::Uuid::parse_str(value)
        .map(|id| id.to_string())
        .ok()
        .as_deref()
        != Some(value)
    {
        return Err("Push requires a canonical operation identity.".into());
    }
    Ok(())
}

fn oid(value: &str) -> Result<git2::Oid, String> {
    if value.len() != 40
        || !value
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
    {
        return Err("Push requires a full lowercase commit ID.".into());
    }
    let oid = git2::Oid::from_str(value).map_err(|_| "Invalid Push commit ID.")?;
    if oid.is_zero() {
        return Err("Push cannot delete a remote branch.".into());
    }
    Ok(oid)
}

fn validate(intent: &PushIntent) -> Result<(), String> {
    uuid(&intent.operation_id)?;
    if intent.version != 1
        || intent.phase != "submitted"
        || intent.workspace_id.is_empty()
        || intent.workspace_id.len() > 256
        || intent.binding_id.is_empty()
        || intent.binding_id.len() > 256
    {
        return Err("Push requires the saved submitted operation.".into());
    }
    git::branch_reference(&intent.source_branch)?;
    git::branch_reference(&intent.destination_branch)?;
    oid(&intent.source_oid)?;
    if let Some(value) = &intent.expected_remote_oid {
        oid(value)?;
    }
    if git_remote::endpoint(&intent.url)?.as_str() != intent.url {
        return Err("Push requires the exact normalized saved endpoint.".into());
    }
    Ok(())
}

fn receipt_path(app_data: &Path, intent: &PushIntent) -> Result<PathBuf, String> {
    validate(intent)?;
    let root = app_data.join("git-push-v1");
    git_remote::validate_stage_parent(&root)?;
    git::reject_link(&root)?;
    let directory = root.join(format!("push-{}", intent.operation_id));
    git::reject_link(&directory)?;
    Ok(directory)
}

fn read_receipt(directory: &Path, intent: &PushIntent) -> Result<Option<PushReceipt>, String> {
    git::reject_link(directory)?;
    let path = directory.join("receipt.json");
    git::reject_link(&path)?;
    let metadata = match fs::symlink_metadata(&path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err("Cannot inspect Push receipt; retain operation.".into()),
    };
    const MAX_RECEIPT: u64 = 65536;
    if !metadata.is_file() || metadata.len() > MAX_RECEIPT {
        return Err("Push receipt must be a bounded regular file.".into());
    }
    let mut options = fs::OpenOptions::new();
    options.read(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.custom_flags(0x0020_0000);
    }
    let file = options
        .open(&path)
        .map_err(|_| "Cannot open Push receipt.")?;
    let metadata = file
        .metadata()
        .map_err(|_| "Cannot inspect opened Push receipt.")?;
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return Err("Push receipt cannot be a reparse point.".into());
        }
    }
    if !metadata.is_file() {
        return Err("Push receipt is not a regular file.".into());
    }
    let mut bytes = Vec::new();
    file.take(MAX_RECEIPT + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Cannot read Push receipt.")?;
    if bytes.len() as u64 > MAX_RECEIPT {
        return Err("Push receipt exceeds size limit.".into());
    }
    let receipt: PushReceipt =
        serde_json::from_slice(&bytes).map_err(|_| "Invalid Push receipt; retain operation.")?;
    if receipt.version != 1
        || receipt.intent != *intent
        || !matches!(
            receipt.phase.as_str(),
            "preparing" | "submitted" | "finished" | "retired"
        )
        || receipt.stage_name.is_some() != receipt.stage_marker.is_some()
        || (matches!(receipt.phase.as_str(), "submitted" | "finished")
            && receipt.stage_name.is_none())
        || (receipt.phase != "retired" && (receipt.phase == "finished") != receipt.result.is_some())
    {
        return Err("Push receipt identity or phase changed; retain operation.".into());
    }
    if let Some(result) = &receipt.result {
        if result.operation_id != intent.operation_id
            || result.source_oid != intent.source_oid
            || result.destination_branch != intent.destination_branch
        {
            return Err("Push result does not match its pinned operation.".into());
        }
        if let Some(value) = &result.advertised_remote_oid {
            oid(value)?;
        }
    }
    if let Some((name, marker)) = receipt
        .stage_name
        .as_ref()
        .zip(receipt.stage_marker.as_ref())
    {
        uuid(
            name.strip_prefix("fetch-")
                .ok_or("Invalid Push snapshot name.")?,
        )?;
        git_remote_job::StageReservation::validate_marker(marker.as_bytes())?;
    }
    Ok(Some(receipt))
}

fn write_receipt(directory: &Path, receipt: &PushReceipt) -> Result<(), String> {
    git::reject_link(directory)?;
    git::reject_link(&directory.join("receipt.json"))?;
    let bytes = serde_json::to_vec(receipt).map_err(|_| "Cannot encode Push receipt.")?;
    if bytes.len() > 65536 {
        return Err("Push receipt exceeds size limit.".into());
    }
    storage::atomic_write(&directory.join("receipt.json"), &bytes)
}

fn admit(
    app_data: &Path,
    request: &PushRequest,
) -> Result<git_remote::RemoteAdvertisementInput, String> {
    validate(&request.intent)?;
    storage::ensure_no_pending_transition(app_data)?;
    let data = storage::read_workspace_file(app_data)?.ok_or("Missing saved workspace.")?;
    let resources = data["resources"]
        .as_array()
        .ok_or("Missing saved resources.")?;
    let intent = &request.intent;
    if !resources.iter().any(|r| {
        r["_type"] == "workspace" && r["_id"] == intent.workspace_id && r["isPrivate"] != true
    }) {
        return Err("Push collection is missing or private.".into());
    }
    let bindings = resources
        .iter()
        .filter(|r| r["_type"] == "git_repository" && r["parentId"] == intent.workspace_id)
        .collect::<Vec<_>>();
    if bindings.len() != 1
        || *bindings[0] != request.expected_binding
        || bindings[0]["_id"] != intent.binding_id
        || bindings[0]["nativeBindingVersion"] != 1
        || bindings[0]["nativeRepositoryId"] != intent.repository_id
        || bindings[0]["uri"] != intent.url
        || bindings[0]["nativePushIntent"]
            != serde_json::to_value(intent).map_err(|_| "Invalid Push intent.")?
        || resources
            .iter()
            .filter(|r| {
                r["_type"] == "git_repository" && r["nativeRepositoryId"] == intent.repository_id
            })
            .count()
            != 1
        || [
            "nativeFetchIntent",
            "nativeCreateIntent",
            "nativeRemoteCheckoutIntent",
        ]
        .iter()
        .any(|key| !bindings[0][*key].is_null())
    {
        return Err("Saved Git binding or operation changed. Reload before Push/Inspect.".into());
    }
    if serde_json::to_vec(&request.expected_binding)
        .map_err(|_| "Invalid Push binding.")?
        .len()
        > 65536
    {
        return Err("Push binding exceeds size limit.".into());
    }
    git_remote::RemoteAdvertisementInput::from_saved_binding(bindings[0])
}

fn outgoing_snapshot(
    app_data: &Path,
    request: &PushRequest,
    cancelled: &std::sync::atomic::AtomicBool,
) -> Result<git_remote_job::StageReservation, String> {
    let check = || {
        if cancelled.load(Ordering::SeqCst) {
            Err("Push snapshot preparation cancelled.".to_owned())
        } else {
            Ok(())
        }
    };
    let intent = &request.intent;
    let repository = git_fetch_command::destination(app_data, &intent.repository_id)?;
    let head = repository
        .find_reference("HEAD")
        .map_err(|_| "Cannot inspect Push HEAD.")?;
    let reference = git::branch_reference(&intent.source_branch)?;
    let tip = oid(&intent.source_oid)?;
    if head
        .symbolic_target()
        .map_err(|_| "Cannot inspect symbolic Push HEAD.")?
        != Some(reference.as_str())
        || repository
            .find_reference(&reference)
            .map_err(|_| "Missing Push branch.")?
            .target()
            != Some(tip)
    {
        return Err("Local branch changed since Push review.".into());
    }
    git_journal::validate_commit(&repository, tip, &intent.workspace_id)?;
    let graph = git_remote::history_view_while(&repository, tip, &[], check)?;
    let root = app_data.join("git-fetch-v1");
    git_remote::validate_stage_parent(&root)?;
    match fs::create_dir(&root) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
        Err(_) => return Err("Cannot create outgoing staging root.".into()),
    }
    let stage = git_remote_job::StageReservation::create(
        &root.join(format!("fetch-{}", uuid::Uuid::new_v4())),
    )?;
    let outgoing = stage.initialize_outgoing(&intent.source_branch, &intent.operation_id)?;
    let source = repository
        .odb()
        .map_err(|_| "Cannot read Push source objects.")?;
    let target = outgoing
        .odb()
        .map_err(|_| "Cannot write outgoing Push objects.")?;
    for value in graph.objects {
        check()?;
        let object = source
            .read(value)
            .map_err(|_| "Cannot read verified Push object.")?;
        if target
            .write(object.kind(), object.data())
            .map_err(|_| "Cannot copy Push object.")?
            != value
        {
            return Err("Outgoing Push object hash mismatch; retain stage.".into());
        }
    }
    outgoing
        .reference(&reference, tip, false, "push: pinned outgoing snapshot")
        .map_err(|_| "Cannot pin outgoing Push branch.")?;
    git_remote::history_view_while(&stage.object_repository(check)?, tip, &[], check)?;
    Ok(stage)
}

#[tauri::command]
pub async fn git_remote_push(
    app: tauri::AppHandle,
    state: tauri::State<'_, git::GitState>,
    storage_state: tauri::State<'_, storage::StorageState>,
    jobs: tauri::State<'_, git_remote_job::RemoteJobState>,
    request: PushRequest,
) -> Result<PushReceipt, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|_| "Cannot resolve application data.")?;
    let git_lock = state.0.clone();
    let storage_lock = storage_state.0.clone();
    let jobs = jobs.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        validate(&request.intent)?;
        let reservation = jobs.reserve(&request.intent.operation_id)?;
        let directory = receipt_path(&app_data, &request.intent)?;
        let (remote, stage, mut receipt) = {
            let _git = git_lock.lock().map_err(|_| "Git lock failed.")?;
            let session = storage_lock.lock().map_err(|_| "Workspace lock failed.")?;
            session.require_loaded()?;
            let remote = admit(&app_data, &request)?;
            if let Some(receipt) = read_receipt(&directory, &request.intent)? {
                return Ok(receipt);
            }
            let root = directory.parent().ok_or("Missing Push receipt root.")?;
            match fs::create_dir(root) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
                Err(_) => return Err("Cannot create Push receipt root.".into()),
            }
            git_remote::validate_stage_parent(&directory)?;
            fs::create_dir(&directory).map_err(|_| {
                "Push operation already reserved or unconfirmed. Inspect; do not resend."
            })?;
            let mut receipt = PushReceipt {
                version: 1,
                intent: request.intent.clone(),
                phase: "preparing".into(),
                stage_name: None,
                stage_marker: None,
                result: None,
            };
            write_receipt(&directory, &receipt)?;
            let stage = outgoing_snapshot(&app_data, &request, &reservation.cancelled)?;
            let (name, marker) = stage.sync_recovery_material(&app_data, || {
                if reservation.cancelled.load(Ordering::SeqCst) {
                    Err("Push preparation cancelled.".into())
                } else {
                    Ok(())
                }
            })?;
            if read_receipt(&directory, &request.intent)?.as_ref() != Some(&receipt) {
                return Err("Push receipt changed; stage retained.".into());
            }
            receipt.phase = "submitted".into();
            receipt.stage_name = Some(name);
            receipt.stage_marker = Some(marker);
            write_receipt(&directory, &receipt)?;
            (remote, stage, receipt)
        };
        // No managed repository, Git lock or workspace lock crosses network I/O.
        let result = git_remote_job::run_push_worker(
            git_remote::push::PushWorkerInput {
                directory: stage.repository_path()?,
                remote,
                operation_id: request.intent.operation_id.clone(),
                source_branch: request.intent.source_branch.clone(),
                source_oid: request.intent.source_oid.clone(),
                destination_branch: request.intent.destination_branch.clone(),
                expected_remote_oid: request.intent.expected_remote_oid.clone(),
            },
            reservation.cancelled.clone(),
        )?;
        let _git = git_lock.lock().map_err(|_| "Git lock failed.")?;
        // Receipt writes are independent of the live workspace. Do not save a stale
        // full snapshot or require the original binding still exists to record result.
        if read_receipt(&directory, &request.intent)?.as_ref() != Some(&receipt)
            || result.operation_id != request.intent.operation_id
            || result.source_oid != request.intent.source_oid
            || result.destination_branch != request.intent.destination_branch
        {
            return Err("Push completion is unconfirmed. Retain operation and Inspect.".into());
        }
        stage.recovery_identity(&app_data)?;
        receipt.phase = "finished".into();
        receipt.result = Some(result);
        write_receipt(&directory, &receipt)?;
        Ok(receipt)
    })
    .await
    .map_err(|_| "Push supervisor failed; retain operation and Inspect.")?
}

#[tauri::command]
pub async fn git_remote_push_inspect(
    app: tauri::AppHandle,
    state: tauri::State<'_, git::GitState>,
    storage_state: tauri::State<'_, storage::StorageState>,
    jobs: tauri::State<'_, git_remote_job::RemoteJobState>,
    request: InspectRequest,
) -> Result<PushObservation, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|_| "Cannot resolve application data.")?;
    let git_lock = state.0.clone();
    let storage_lock = storage_state.0.clone();
    let jobs = jobs.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        uuid(&request.attempt_id)?;
        if request.attempt_id == request.push.intent.operation_id {
            return Err("Push Inspect requires a fresh attempt identity.".into());
        }
        let reservation = jobs.reserve(&request.attempt_id)?;
        let (remote, receipt, _stage) = {
            let _git = git_lock.lock().map_err(|_| "Git lock failed.")?;
            let session = storage_lock.lock().map_err(|_| "Workspace lock failed.")?;
            session.require_loaded()?;
            jobs.ensure_idle(&request.push.intent.operation_id)?;
            let remote = admit(&app_data, &request.push)?;
            let directory = receipt_path(&app_data, &request.push.intent)?;
            let receipt = read_receipt(&directory, &request.push.intent)?;
            let stage = receipt
                .as_ref()
                .filter(|r| r.phase != "retired")
                .and_then(|r| r.stage_name.as_ref().zip(r.stage_marker.as_ref()))
                .map(|(name, marker)| {
                    git_remote_job::StageReservation::try_from((
                        app_data.as_path(),
                        name.as_str(),
                        marker.as_bytes(),
                    ))
                })
                .transpose()?;
            (remote, receipt, stage)
        };
        let output = git_remote_job::run_worker(
            remote,
            reservation.cancelled.clone(),
            Duration::from_secs(30),
        )?;
        let observed = output
            .advertisement
            .branches
            .iter()
            .find(|branch| branch.name == request.push.intent.destination_branch)
            .map(|branch| branch.oid.clone());
        let _git = git_lock.lock().map_err(|_| "Git lock failed.")?;
        let session = storage_lock.lock().map_err(|_| "Workspace lock failed.")?;
        session.require_loaded()?;
        admit(&app_data, &request.push)?;
        if read_receipt(
            &receipt_path(&app_data, &request.push.intent)?,
            &request.push.intent,
        )? != receipt
        {
            return Err(
                "Push receipt changed during inspection. Observe again without resending.".into(),
            );
        }
        Ok(PushObservation {
            operation_id: request.push.intent.operation_id.clone(),
            matches_pinned_commit: observed.as_deref() == Some(&request.push.intent.source_oid),
            observed_remote_oid: observed,
            receipt,
        })
    })
    .await
    .map_err(|_| "Push inspection failed; no upload was requested.")?
}

/// Retire only the exact separately reviewed receipt/binding. The durable
/// operation directory and retired receipt are NEVER removed: a later call
/// using the same operation cannot enter outgoing transport, even after restart.
#[tauri::command]
pub async fn git_remote_push_retire(
    app: tauri::AppHandle,
    state: tauri::State<'_, git::GitState>,
    storage_state: tauri::State<'_, storage::StorageState>,
    jobs: tauri::State<'_, git_remote_job::RemoteJobState>,
    request: RetireRequest,
) -> Result<PushReceipt, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|_| "Cannot resolve application data.")?;
    let git_lock = state.0.clone();
    let storage_lock = storage_state.0.clone();
    let jobs = jobs.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        uuid(&request.attempt_id)?;
        if request.attempt_id == request.push.intent.operation_id {
            return Err("Push retirement requires a fresh attempt identity.".into());
        }
        let reservation = jobs.reserve(&request.attempt_id)?;
        let _git = git_lock.lock().map_err(|_| "Git lock failed.")?;
        let session = storage_lock.lock().map_err(|_| "Workspace lock failed.")?;
        session.require_loaded()?;
        jobs.ensure_idle(&request.push.intent.operation_id)?;
        admit(&app_data, &request.push)?;
        let directory = receipt_path(&app_data, &request.push.intent)?;
        let original = read_receipt(&directory, &request.push.intent)?;
        if original != request.expected_receipt {
            return Err(
                "Push receipt changed since observation. Inspect again; no cleanup performed."
                    .into(),
            );
        }
        if original.is_none() {
            let root = directory.parent().ok_or("Missing Push receipt root.")?;
            match fs::create_dir(root) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
                Err(_) => return Err("Cannot reserve Push retirement root.".into()),
            }
            // An existing directory without a receipt has uncertain ownership.
            // Never adopt it or remove anything inside it.
            fs::create_dir(&directory).map_err(|_| {
                "Push receipt directory is unconfirmed. Retain tracking and material.".to_owned()
            })?;
        }
        let already_retired = original.as_ref().is_some_and(|r| r.phase == "retired");
        let mut retired = original.clone().unwrap_or(PushReceipt {
            version: 1,
            intent: request.push.intent.clone(),
            phase: "retired".into(),
            stage_name: None,
            stage_marker: None,
            result: None,
        });
        let stage_identity = retired.stage_name.clone().zip(retired.stage_marker.clone());
        let commit_retirement = || -> Result<(), String> {
            if reservation.cancelled.load(Ordering::SeqCst) {
                return Err("Push retirement cancelled. Retain tracking and Inspect.".into());
            }
            if read_receipt(&directory, &request.push.intent)? != original {
                return Err("Push receipt changed before retirement. Inspect again.".into());
            }
            retired.phase = "retired".into();
            write_receipt(&directory, &retired)
        };
        if let Some((name, marker)) = stage_identity {
            git_fetch_cleanup::reclaim_push(
                &app_data,
                &name,
                marker.as_bytes(),
                &request.push.intent.operation_id,
                already_retired,
                commit_retirement,
            )?;
        } else {
            let mut commit_retirement = commit_retirement;
            commit_retirement()?;
        }
        if read_receipt(&directory, &request.push.intent)?.as_ref() != Some(&retired) {
            return Err("Push retirement is unconfirmed. Keep tracking and Inspect.".into());
        }
        retired.stage_name = None;
        retired.stage_marker = None;
        write_receipt(&directory, &retired)?;
        Ok(retired)
    })
    .await
    .map_err(|_| "Push retirement failed. Keep tracking and Inspect; no upload was requested.")?
}
