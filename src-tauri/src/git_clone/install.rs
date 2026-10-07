//! Additive Clone installation with a full before/after recovery journal.
use super::*;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};

pub(crate) const JOURNAL: &str = "git-clone-install-v1.json";
const OWNER: &str = "insomnium-clone-owner-v1.json";

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CloneInstallInput {
    expected_receipt: CloneReceipt,
    workspace_id: String,
    before_workspace: Value,
    after_workspace: Value,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct InstallJournal {
    version: u32,
    token: String,
    input: CloneInstallInput,
}
#[derive(Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Ownership {
    version: u32,
    token: String,
    operation_id: String,
    receipt_hash: String,
    workspace_hash: String,
}
fn digest<T: Serialize>(value: &T) -> Result<String, String> {
    Ok(format!(
        "{:x}",
        Sha256::digest(serde_json::to_vec(value).map_err(|e| e.to_string())?)
    ))
}
fn owner(journal: &InstallJournal) -> Result<Ownership, String> {
    Ok(Ownership {
        version: 1,
        token: journal.token.clone(),
        operation_id: journal.input.expected_receipt.operation_id.clone(),
        receipt_hash: digest(&journal.input.expected_receipt)?,
        workspace_hash: digest(&journal.input.after_workspace)?,
    })
}
fn read_json<T: serde::de::DeserializeOwned>(path: &Path, maximum: u64) -> Result<T, String> {
    git::reject_link(path)?;
    let metadata = fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    if !metadata.is_file() || metadata.len() > maximum {
        return Err("Clone recovery file must be bounded and regular; retained".into());
    }
    let mut options = fs::OpenOptions::new();
    options.read(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.custom_flags(0x0020_0000);
    }
    let file = options.open(path).map_err(|e| e.to_string())?;
    let actual = file.metadata().map_err(|e| e.to_string())?;
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if actual.file_attributes() & 0x400 != 0 {
            return Err("Clone recovery file cannot be a reparse point".into());
        }
    }
    if !actual.is_file() {
        return Err("Clone recovery file is not regular".into());
    }
    let mut bytes = Vec::new();
    file.take(maximum + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > maximum {
        return Err("Clone recovery file exceeds limit".into());
    }
    serde_json::from_slice(&bytes).map_err(|_| "Invalid Clone recovery file; retained".into())
}
fn candidate(app_data: &Path, input: &CloneInstallInput) -> Result<ClonePreview, String> {
    let receipt = &input.expected_receipt;
    let path = directory(app_data, &receipt.operation_id)?;
    let actual = read_receipt(&path)?.ok_or("Clone receipt is missing; retained")?;
    if actual != *receipt || actual.phase != "ready" {
        return Err("Clone receipt changed or is unconfirmed; retained".into());
    }
    preview(&path, actual)
}
fn kind(name: &str) -> Option<&'static str> {
    Some(match name {
        "Workspace" => "workspace",
        "Environment" => "environment",
        "RequestGroup" => "request_group",
        "Request" => "request",
        "ApiSpec" => "api_spec",
        "UnitTestSuite" => "unit_test_suite",
        "UnitTest" => "unit_test",
        "GrpcRequest" => "grpc_request",
        "ProtoFile" => "proto_file",
        "ProtoDirectory" => "proto_directory",
        "WebSocketRequest" => "websocket_request",
        "WebSocketPayload" => "websocket_payload",
        _ => return None,
    })
}
fn validate_pair(input: &CloneInstallInput, preview: &ClonePreview) -> Result<(), String> {
    storage::validate(&input.before_workspace)?;
    storage::validate(&input.after_workspace)?;
    let before = input.before_workspace["resources"]
        .as_array()
        .ok_or("Missing original resources")?;
    let after = input.after_workspace["resources"]
        .as_array()
        .ok_or("Missing Clone resources")?;
    if after.len() <= before.len() || after[..before.len()] != before[..] {
        return Err("Clone must append resources and preserve every existing record".into());
    }
    let mut left = input.before_workspace.clone();
    let mut right = input.after_workspace.clone();
    left.as_object_mut()
        .ok_or("Invalid workspace")?
        .remove("resources");
    right
        .as_object_mut()
        .ok_or("Invalid workspace")?
        .remove("resources");
    if left != right {
        return Err(
            "Clone must preserve all existing selections, history, settings and metadata".into(),
        );
    }
    let added = &after[before.len()..];
    let records: HashMap<&str, &Value> = added
        .iter()
        .map(|r| Ok((r["_id"].as_str().ok_or("Missing Clone resource ID")?, r)))
        .collect::<Result<_, String>>()?;
    let root = records
        .get(input.workspace_id.as_str())
        .ok_or("Clone workspace is missing")?;
    if root["_type"] != "workspace"
        || !root["parentId"].is_null()
        || added.iter().filter(|r| r["_type"] == "workspace").count() != 1
    {
        return Err("Clone needs exactly one new root workspace".into());
    }
    let binding = added
        .iter()
        .filter(|r| r["_type"] == "git_repository")
        .collect::<Vec<_>>();
    if binding.len() != 1
        || binding[0]["parentId"] != input.workspace_id
        || binding[0]["nativeBindingVersion"] != 1
        || binding[0]["nativeRepositoryId"] != preview.receipt.repository_id
        || binding[0]["uri"] != preview.receipt.url
        || binding[0]["nativeCloneOperationId"] != preview.receipt.operation_id
    {
        return Err("Clone requires the exact new local binding".into());
    }
    git_remote::RemoteAdvertisementInput::from_saved_binding(binding[0])?;
    for resource in added {
        let id = resource["_id"].as_str().ok_or("Missing resource ID")?;
        if id.is_empty()
            || id.len() > 200
            || !id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
            || resource
                .get("isPrivate")
                .is_some_and(|v| !v.is_null() && v != false && v != 0 && v != "")
        {
            return Err("Invalid or private Clone resource".into());
        }
        let mut row = resource;
        let resource_type = resource["_type"]
            .as_str()
            .ok_or("Missing Clone resource type")?;
        let allowed: &[&str] = match resource_type {
            "environment" => &["workspace", "environment"],
            "request_group" | "request" | "grpc_request" | "websocket_request" => {
                &["workspace", "request_group"]
            }
            _ => &[],
        };
        if !allowed.is_empty()
            && resource["parentId"]
                .as_str()
                .and_then(|id| records.get(id))
                .is_none_or(|parent| !allowed.contains(&parent["_type"].as_str().unwrap_or("")))
        {
            return Err("Invalid typed parent in Clone collection; nothing installed".into());
        }
        let mut seen = HashSet::new();
        while row["_id"] != input.workspace_id {
            if !seen.insert(row["_id"].as_str().ok_or("Invalid parent ID")?) {
                return Err("Circular Clone resource parents".into());
            }
            row = records
                .get(row["parentId"].as_str().ok_or("Missing Clone parent")?)
                .ok_or("Foreign or absent Clone resource parent")?;
        }
    }
    let files = preview
        .collection
        .as_ref()
        .map(serde_json::to_value)
        .transpose()
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| serde_json::json!({"files":[]}));
    let files = files["files"]
        .as_array()
        .ok_or("Missing pinned Clone files")?;
    if files.is_empty() {
        if added.len() != 3
            || root["scope"] != "design"
            || added.iter().filter(|r| r["_type"] == "api_spec").count() != 1
        {
            return Err(
                "A repository without resources needs a new design workspace and ApiSpec".into(),
            );
        }
    } else {
        if added.len() != files.len() + 1 {
            return Err("Clone resource count differs from pinned tree".into());
        }
        let mut roots = 0;
        for file in files {
            let path = file["path"].as_str().ok_or("Missing Clone file path")?;
            let parts = path.split('/').collect::<Vec<_>>();
            if parts.len() != 3 || parts[0] != ".insomnium" {
                return Err("Invalid Clone resource path".into());
            }
            let resource_kind = kind(parts[1]).ok_or("Unknown Clone resource kind")?;
            let id = parts[2]
                .strip_suffix(".yml")
                .or_else(|| parts[2].strip_suffix(".json"))
                .ok_or("Invalid Clone resource extension")?;
            if records
                .get(id)
                .is_none_or(|row| row["_type"] != resource_kind)
            {
                return Err("Clone resource ID/type differs from pinned tree".into());
            }
            if resource_kind == "workspace" {
                roots += 1;
                if id != input.workspace_id {
                    return Err("Clone workspace differs from pinned root".into());
                }
            }
        }
        if roots != 1 {
            return Err("Clone tree must contain one workspace".into());
        }
    }
    Ok(())
}
fn publish(app_data: &Path, journal: &InstallJournal) -> Result<(), String> {
    let input = &journal.input;
    let verified = candidate(app_data, input)?;
    validate_pair(input, &verified)?;
    let root = app_data.join("git-v1");
    git_remote::validate_stage_parent(&root)?;
    git::reject_link(&root)?;
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let target = git::managed_path(&root, &verified.receipt.repository_id)?;
    let expected_owner = owner(journal)?;
    let source =
        git::open_managed(&directory(app_data, &verified.receipt.operation_id)?.join("candidate"))?;
    let branch = verified
        .receipt
        .local_branch
        .as_deref()
        .ok_or("Missing Clone branch")?;
    let repo = match fs::symlink_metadata(&target) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            fs::create_dir(&target)
                .map_err(|_| "Cannot exclusively create Clone destination; retained")?;
            let mut options = git2::RepositoryInitOptions::new();
            options
                .no_reinit(true)
                .external_template(false)
                .initial_head(branch);
            let repo = git2::Repository::init_opts(&target, &options)
                .map_err(|e| e.message().to_owned())?;
            storage::atomic_write(
                &repo.path().join(OWNER),
                &serde_json::to_vec(&expected_owner).map_err(|e| e.to_string())?,
            )?;
            repo
        }
        Ok(_) => {
            let repo = git::open_managed(&target)?;
            let actual: Ownership = read_json(&repo.path().join(OWNER), 8192)?;
            if actual != expected_owner {
                return Err(
                    "Existing Clone destination has different ownership; left unchanged".into(),
                );
            }
            repo
        }
        Err(e) => return Err(e.to_string()),
    };
    if repo.state() != git2::RepositoryState::Clean
        || repo
            .find_reference("HEAD")
            .map_err(|e| e.message().to_owned())?
            .symbolic_target()
            .map_err(|e| e.message().to_owned())?
            != Some(git::branch_reference(branch)?.as_str())
    {
        return Err("Clone destination state or HEAD changed; retained".into());
    }
    let tips = verified
        .receipt
        .branches
        .iter()
        .map(|b| git2::Oid::from_str(&b.oid).map_err(|e| e.message().to_owned()))
        .collect::<Result<Vec<_>, _>>()?;
    let objects = git_remote::validate_object_graph(&source, &tips)?;
    let source_odb = source.odb().map_err(|e| e.message().to_owned())?;
    let target_odb = repo.odb().map_err(|e| e.message().to_owned())?;
    for oid in objects {
        let object = source_odb.read(oid).map_err(|e| e.message().to_owned())?;
        if git2::Oid::hash_object(object.kind(), object.data())
            .map_err(|e| e.message().to_owned())?
            != oid
            || target_odb
                .write(object.kind(), object.data())
                .map_err(|e| e.message().to_owned())?
                != oid
        {
            return Err("Clone object import identity changed; retained".into());
        }
    }
    let mut refs = HashMap::new();
    for row in &verified.receipt.branches {
        refs.insert(format!("refs/remotes/origin/{}", row.name), row.oid.clone());
    }
    if let Some(oid) = &verified.receipt.head_oid {
        refs.insert(git::branch_reference(branch)?, oid.clone());
    }
    for reference in repo.references().map_err(|e| e.message().to_owned())? {
        let reference = reference.map_err(|e| e.message().to_owned())?;
        let name = reference.name().map_err(|e| e.message().to_owned())?;
        if refs.get(name).is_none_or(|oid| {
            reference
                .target()
                .is_none_or(|target| target.to_string() != *oid)
        }) {
            return Err("Clone destination has unexpected refs; no ref was overwritten".into());
        }
    }
    for (name, oid) in refs {
        match repo.find_reference(&name) {
            Ok(reference)
                if reference
                    .target()
                    .is_some_and(|target| target.to_string() == oid) => {}
            Ok(_) => return Err("Clone destination ref changed; retained".into()),
            Err(e) if e.code() == git2::ErrorCode::NotFound => {
                repo.reference(
                    &name,
                    git2::Oid::from_str(&oid).map_err(|e| e.message().to_owned())?,
                    false,
                    "clone: install",
                )
                .map_err(|e| e.message().to_owned())?;
            }
            Err(e) => return Err(e.message().to_owned()),
        }
    }
    git_remote::validate_object_graph(&repo, &tips)?;
    match repo.find_remote("origin") {
        Ok(remote) if remote.url().is_ok_and(|url| url == verified.receipt.url) => {}
        Ok(_) => return Err("Clone destination endpoint changed; retained".into()),
        Err(e) if e.code() == git2::ErrorCode::NotFound => {
            repo.remote("origin", &verified.receipt.url)
                .map_err(|e| e.message().to_owned())?;
        }
        Err(e) => return Err(e.message().to_owned()),
    }
    Ok(())
}
pub(crate) fn recover(app_data: &Path) -> Result<(), String> {
    let path = app_data.join(JOURNAL);
    match fs::symlink_metadata(&path) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(e.to_string()),
        Ok(_) => {}
    }
    let journal: InstallJournal = read_json(&path, 256 * 1024 * 1024)?;
    match fs::symlink_metadata(app_data.join(storage::GIT_TRANSITION_FILE)) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        _ => {
            return Err(
                "Clone and another Git transition journal coexist; both retained for inspection"
                    .into(),
            )
        }
    }
    if journal.version != 1 {
        return Err("Unsupported Clone install journal; retained".into());
    }
    uuid(&journal.token)?;
    let current = storage::read_workspace_file(app_data)?
        .ok_or("Clone baseline workspace is missing; retained")?;
    if current != journal.input.before_workspace && current != journal.input.after_workspace {
        return Err("Workspace differs from original and completed Clone snapshots; retained without overwrite".into());
    }
    publish(app_data, &journal)?;
    if current == journal.input.before_workspace {
        storage::write_workspace_file(app_data, &journal.input.after_workspace)?;
    }
    if storage::read_workspace_file(app_data)?.as_ref() != Some(&journal.input.after_workspace) {
        return Err("Clone installation workspace is unconfirmed; journal retained".into());
    }
    // Exact journal re-read before retirement; changed/foreign files survive.
    let actual: InstallJournal = read_json(&path, 256 * 1024 * 1024)?;
    if digest(&actual)? != digest(&journal)? {
        return Err("Clone journal changed; retained".into());
    }
    fs::remove_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_clone_install(
    app: tauri::AppHandle,
    state: tauri::State<'_, git::GitState>,
    storage_state: tauri::State<'_, storage::StorageState>,
    input: CloneInstallInput,
) -> Result<Value, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let git_lock = state.0.clone();
    let storage_lock = storage_state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _git = git_lock.lock().map_err(|_| "Git lock failed")?;
        let mut session = storage_lock.lock().map_err(|_| "Workspace lock failed")?;
        session.require_loaded()?;
        storage::ensure_no_pending_transition(&app_data)?;
        let verified = candidate(&app_data, &input)?;
        validate_pair(&input, &verified)?;
        let current =
            storage::read_workspace_file(&app_data)?.ok_or("Missing saved Clone baseline")?;
        let target = git::managed_path(
            &app_data.join("git-v1"),
            &input.expected_receipt.repository_id,
        )?;
        if current == input.after_workspace {
            let repo = git::open_managed(&target)?;
            let actual: Ownership = read_json(&repo.path().join(OWNER), 8192)?;
            if actual.version != 1
                || actual.operation_id != input.expected_receipt.operation_id
                || actual.receipt_hash != digest(&input.expected_receipt)?
                || actual.workspace_hash != digest(&input.after_workspace)?
            {
                return Err("Clone completion has different ownership; retained".into());
            }
            return Ok(current);
        }
        if current != input.before_workspace {
            return Err("Workspace changed since Clone review; nothing installed".into());
        }
        if target.try_exists().map_err(|e| e.to_string())? {
            return Err("Clone destination already exists; nothing overwritten".into());
        }
        session.ensure_backup(&app_data)?;
        let journal = InstallJournal {
            version: 1,
            token: uuid::Uuid::new_v4().to_string(),
            input,
        };
        let bytes = serde_json::to_vec(&journal).map_err(|e| e.to_string())?;
        if bytes.len() > 256 * 1024 * 1024 {
            return Err("Clone install journal exceeds limit".into());
        }
        storage::atomic_write(&app_data.join(JOURNAL), &bytes)?;
        recover(&app_data)?;
        storage::read_workspace_file(&app_data)?.ok_or("Clone completed without a workspace".into())
    })
    .await
    .map_err(|e| e.to_string())?
}
