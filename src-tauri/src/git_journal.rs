//! Recovery of a versioned local checkout journal. Never guesses from journal age.
use crate::{git, storage};
use serde::Deserialize;
use serde_json::Value;
use std::{collections::HashMap, fs, io::Read, path::Path};

const MAX_JOURNAL_BYTES: u64 = 256 * 1024 * 1024;

#[derive(Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Journal {
    schema_version: u32,
    operation_id: String,
    repository_id: String,
    workspace_id: String,
    source_branch: String,
    source_oid: String,
    target_branch: String,
    target_oid: String,
    before_workspace: Value,
    after_workspace: Value,
}

fn valid_id(id: &str, max: usize) -> bool {
    !id.is_empty()
        && id.len() <= max
        && id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
}

fn public_resource(value: &Value) -> bool {
    // Match the JS codec's truthy privacy policy conservatively.
    let private = value.get("isPrivate").is_some_and(|v| match v {
        Value::Null => false,
        Value::Bool(v) => *v,
        Value::Number(v) => v.as_f64() != Some(0.0),
        Value::String(v) => !v.is_empty(),
        _ => true,
    });
    !private
        && matches!(
            value["_type"].as_str(),
            Some(
                "workspace"
                    | "environment"
                    | "request_group"
                    | "request"
                    | "api_spec"
                    | "unit_test_suite"
                    | "unit_test"
                    | "grpc_request"
                    | "proto_file"
                    | "proto_directory"
                    | "websocket_request"
                    | "websocket_payload"
            )
        )
}

fn resources(value: &Value) -> Result<HashMap<&str, &Value>, String> {
    storage::validate(value)?;
    let mut result = HashMap::new();
    for resource in value["resources"].as_array().ok_or("Missing resources")? {
        let id = resource["_id"].as_str().ok_or("Invalid resource ID")?;
        if id.is_empty() {
            return Err("Empty resource ID in checkout journal".into());
        }
        result.insert(id, resource);
    }
    Ok(result)
}

fn owner<'a>(records: &HashMap<&'a str, &'a Value>, id: &str) -> Option<&'a str> {
    let mut item = *records.get(id)?;
    let mut seen = std::collections::HashSet::new();
    loop {
        let id = item["_id"].as_str()?;
        if !seen.insert(id) {
            return None;
        }
        if item["_type"] == "workspace" {
            return Some(id);
        }
        item = *records.get(item["parentId"].as_str()?)?;
    }
}

fn validate_topology(records: &HashMap<&str, &Value>) -> Result<(), String> {
    for resource in records.values() {
        let mut seen = std::collections::HashSet::new();
        let mut current = *resource;
        loop {
            let id = current["_id"]
                .as_str()
                .ok_or("Invalid topology resource ID")?;
            if !seen.insert(id) {
                return Err("Circular checkout parent reference".into());
            }
            let Some(parent) = current["parentId"].as_str().and_then(|id| records.get(id)) else {
                break;
            };
            current = parent;
        }
        let kind = resource["_type"].as_str().unwrap_or("");
        let allowed: &[&str] = match kind {
            "environment" => &["workspace", "environment"],
            "request_group" | "request" | "grpc_request" | "websocket_request" => {
                &["workspace", "request_group"]
            }
            _ => continue,
        };
        let parent = resource["parentId"].as_str().and_then(|id| records.get(id));
        if parent.is_none_or(|parent| !allowed.contains(&parent["_type"].as_str().unwrap_or("")))
            || owner(records, resource["_id"].as_str().unwrap_or("")).is_none()
        {
            return Err("Invalid or missing parent for navigable checkout resource".into());
        }
    }
    Ok(())
}

fn validate_pair(journal: &Journal) -> Result<(), String> {
    let before = resources(&journal.before_workspace)?;
    let after = resources(&journal.after_workspace)?;
    let workspace = journal.workspace_id.as_str();
    for records in [&before, &after] {
        validate_topology(records)?;
        let root = records
            .get(workspace)
            .ok_or("Missing checkout collection")?;
        if root["_type"] != "workspace" || !public_resource(root) {
            return Err("Checkout collection must be a public workspace".into());
        }
        let bindings: Vec<_> = records
            .values()
            .filter(|r| {
                r["_type"] == "git_repository"
                    && r["nativeBindingVersion"] == 1
                    && r["parentId"] == workspace
            })
            .collect();
        if bindings.len() != 1
            || bindings[0]["nativeRepositoryId"] != journal.repository_id
            || records
                .values()
                .filter(|r| {
                    r["_type"] == "git_repository"
                        && r["nativeRepositoryId"] == journal.repository_id
                })
                .count()
                != 1
        {
            return Err("Checkout journal repository binding does not match".into());
        }
        // Every syncable collection member must have public parent closure.
        for (id, resource) in records {
            if owner(records, id) == Some(workspace) && public_resource(resource) {
                let mut current = *resource;
                let mut seen = std::collections::HashSet::new();
                while current["_id"] != workspace {
                    let id = current["_id"].as_str().ok_or("Invalid resource")?;
                    if !seen.insert(id) {
                        return Err("Circular checkout resource".into());
                    }
                    let parent = current["parentId"]
                        .as_str()
                        .ok_or("Missing checkout parent")?;
                    current = records.get(parent).ok_or("Missing checkout parent")?;
                    if !public_resource(current) {
                        return Err("Public checkout resource has a private/local parent".into());
                    }
                }
            }
        }
    }
    for (id, previous) in &before {
        let next = after.get(id);
        let owned = owner(&before, id) == Some(workspace);
        if !owned || !public_resource(previous) {
            if next.copied() != Some(*previous) {
                return Err("Checkout changes a private, local-only or foreign resource".into());
            }
        } else if let Some(next) = next {
            if owner(&after, id) != Some(workspace)
                || !public_resource(next)
                || previous["_type"] != next["_type"]
            {
                return Err("Checkout changes resource ownership, privacy or type".into());
            }
            for field in [
                "_legacySource",
                "_postmanSource",
                "_harSource",
                "_curlSource",
                "_migrationIssues",
                "_openapiIssues",
                "_oauthImported",
            ] {
                if previous.get(field) != next.get(field) {
                    return Err("Checkout changes local resource metadata".into());
                }
            }
            if *id == workspace && previous.get("parentId") != next.get("parentId") {
                return Err("Checkout changes collection parent".into());
            }
        }
    }
    for (id, next) in &after {
        if !before.contains_key(id)
            && (owner(&after, id) != Some(workspace) || !public_resource(next))
        {
            return Err("Checkout adds a foreign, private or local-only resource".into());
        }
        // Preserved private syncable resources cannot become orphaned by a deletion.
        if before.contains_key(id)
            && owner(&before, id) == Some(workspace)
            && matches!(
                next["_type"].as_str(),
                Some(
                    "workspace"
                        | "environment"
                        | "request_group"
                        | "request"
                        | "api_spec"
                        | "unit_test_suite"
                        | "unit_test"
                        | "grpc_request"
                        | "proto_file"
                        | "proto_directory"
                        | "websocket_request"
                        | "websocket_payload"
                )
            )
            && owner(&after, id) != Some(workspace)
        {
            return Err("Checkout orphans a collection resource".into());
        }
    }

    let active = journal.before_workspace["activeWorkspaceId"]
        .as_str()
        .unwrap_or("");
    if after.get(active).is_none_or(|r| r["_type"] != "workspace") {
        return Err("Checkout lost the active collection".into());
    }
    let is_request = |id: &str| {
        after.get(id).is_some_and(|r| {
            matches!(
                r["_type"].as_str(),
                Some("request" | "grpc_request" | "websocket_request")
            )
        }) && owner(&after, id).is_some()
    };
    let mut before_envelope = journal.before_workspace.clone();
    if let Some(value) = journal.before_workspace.get("activeRequestId") {
        let valid = value
            .as_str()
            .is_some_and(|id| is_request(id) && owner(&after, id) == Some(active));
        if !valid {
            before_envelope["activeRequestId"] = Value::String(String::new());
        }
    }
    if let Some(value) = journal.before_workspace.get("activeEnvironmentId") {
        let valid = value.as_str().is_some_and(|id| {
            after.get(id).is_some_and(|r| r["_type"] == "environment")
                && owner(&after, id) == Some(active)
        });
        if !valid {
            before_envelope["activeEnvironmentId"] = Value::String(String::new());
        }
    }
    if let Some(tabs) = journal.before_workspace.get("openTabs") {
        let tabs = tabs.as_array().ok_or("Invalid checkout request tabs")?;
        if tabs.iter().any(|id| !id.is_string()) {
            return Err("Invalid checkout request tabs".into());
        }
        before_envelope["openTabs"] = Value::Array(
            tabs.iter()
                .filter(|id| is_request(id.as_str().unwrap_or("")))
                .cloned()
                .collect(),
        );
    }
    let mut after_envelope = journal.after_workspace.clone();
    before_envelope
        .as_object_mut()
        .ok_or("Invalid workspace")?
        .remove("resources");
    after_envelope
        .as_object_mut()
        .ok_or("Invalid workspace")?
        .remove("resources");
    if before_envelope != after_envelope {
        return Err("Checkout may only repair invalid request/environment selections and tabs; preserve all other workspace data".into());
    }
    Ok(())
}

fn read_journal(directory: &Path) -> Result<Option<(Journal, Vec<u8>)>, String> {
    let path = directory.join(storage::GIT_TRANSITION_FILE);
    let metadata = match fs::symlink_metadata(&path) {
        Ok(metadata) => metadata,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(e.to_string()),
    };
    git::reject_link(&path)?;
    if !metadata.is_file() || metadata.len() > MAX_JOURNAL_BYTES {
        return Err("Checkout journal is not a bounded regular file".into());
    }
    let mut options = fs::OpenOptions::new();
    options.read(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.custom_flags(0x0020_0000); // FILE_FLAG_OPEN_REPARSE_POINT
    }
    let file = options.open(&path).map_err(|e| e.to_string())?;
    let actual = file.metadata().map_err(|e| e.to_string())?;
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if actual.file_attributes() & 0x400 != 0 {
            return Err("Checkout journal cannot be a reparse point".into());
        }
    }
    if !actual.is_file() {
        return Err("Checkout journal is not a regular file".into());
    }
    let mut bytes = Vec::new();
    file.take(MAX_JOURNAL_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > MAX_JOURNAL_BYTES {
        return Err("Checkout journal exceeds 256 MiB".into());
    }
    let journal: Journal =
        serde_json::from_slice(&bytes).map_err(|e| format!("Invalid checkout journal: {e}"))?;
    validate_journal(&journal)?;
    Ok(Some((journal, bytes)))
}

fn validate_journal(journal: &Journal) -> Result<(), String> {
    if journal.schema_version != 1
        || !valid_id(&journal.operation_id, 100)
        || !valid_id(&journal.repository_id, 100)
        || !valid_id(&journal.workspace_id, 200)
    {
        return Err("Invalid checkout journal version or IDs".into());
    }
    validate_pair(journal)?;
    Ok(())
}

/// Caller MUST hold GitState then StorageState for the whole recovery and load.
/// A refusal retains journal and workspace. No phase/age heuristic authorizes writes.
pub(crate) fn recover(directory: &Path) -> Result<(), String> {
    recover_inner(directory).map(|_| ()).map_err(|error| {
        format!(
            "Workspace Git recovery could not finish: {error}. Journal retained at {}",
            directory.join(storage::GIT_TRANSITION_FILE).display()
        )
    })
}

fn recover_inner(directory: &Path) -> Result<Option<CheckoutResult>, String> {
    let Some((journal, bytes)) = read_journal(directory)? else {
        return Ok(None);
    };
    let source = git::branch_reference(&journal.source_branch)?;
    let target = git::branch_reference(&journal.target_branch)?;
    let path = git::managed_path(&directory.join("git-v1"), &journal.repository_id)?;
    let repo = git::open_managed(&path)?;
    let _transaction = lock_refs(&repo, &journal)?;
    let error = |e: git2::Error| e.message().to_owned();
    let head = repo.find_reference("HEAD").map_err(error)?;
    let branch = head.symbolic_target().map_err(error)?;
    let current = storage::read_workspace_file(directory)?.ok_or("Workspace file is missing")?;
    let at_before = current == journal.before_workspace;
    let at_after = current == journal.after_workspace;
    if branch == Some(source.as_str()) && at_before {
        // Nothing applied: preserve exact original workspace bytes.
    } else if branch == Some(target.as_str()) && (at_before || at_after) {
        if !at_after {
            storage::write_workspace_file(directory, &journal.after_workspace)?;
        }
    } else {
        return Err("HEAD/workspace do not match an unambiguous recorded state".into());
    }
    // Detect unexpected external journal changes before cleanup. App mutexes and
    // Git ref locks protect app writers, not arbitrary external filesystem writers.
    let Some((_, latest)) = read_journal(directory)? else {
        return Err("Checkout journal disappeared during recovery".into());
    };
    if latest != bytes {
        return Err("Checkout journal changed during recovery".into());
    }
    let expected = if branch == Some(source.as_str()) {
        &journal.before_workspace
    } else {
        &journal.after_workspace
    };
    if storage::read_workspace_file(directory)?.as_ref() != Some(expected) {
        return Err("Workspace changed during recovery".into());
    }
    fs::remove_file(directory.join(storage::GIT_TRANSITION_FILE)).map_err(|e| e.to_string())?;
    let applied = branch == Some(target.as_str());
    Ok(Some(CheckoutResult {
        operation_id: journal.operation_id.clone(),
        branch: if applied {
            journal.target_branch.clone()
        } else {
            journal.source_branch.clone()
        },
        head_oid: if applied {
            journal.target_oid.clone()
        } else {
            journal.source_oid.clone()
        },
        workspace: expected.clone(),
    }))
}

fn lock_refs<'repo>(
    repo: &'repo git2::Repository,
    journal: &Journal,
) -> Result<git2::Transaction<'repo>, String> {
    let source = git::branch_reference(&journal.source_branch)?;
    let target = git::branch_reference(&journal.target_branch)?;
    if source.eq_ignore_ascii_case(&target) {
        return Err("Journal branches must differ".into());
    }
    let parse_oid = |value: &str| {
        if value.len() != 40 || !value.bytes().all(|c| c.is_ascii_hexdigit()) {
            return Err("Invalid full journal commit ID".to_owned());
        }
        git2::Oid::from_str(value).map_err(|e| e.message().to_owned())
    };
    let source_oid = parse_oid(&journal.source_oid)?;
    let target_oid = parse_oid(&journal.target_oid)?;
    let error = |e: git2::Error| e.message().to_owned();
    let mut transaction = repo.transaction().map_err(error)?;
    transaction.lock_ref("HEAD").map_err(error)?;
    let mut refs = [&source, &target];
    refs.sort();
    for name in refs {
        transaction.lock_ref(name).map_err(error)?;
    }
    if repo.state() != git2::RepositoryState::Clean {
        return Err("Repository has an unfinished Git operation".into());
    }
    for (name, expected) in [(&source, source_oid), (&target, target_oid)] {
        if repo.find_reference(name).map_err(error)?.target() != Some(expected) {
            return Err("Recorded branch moved or is no longer a direct reference".into());
        }
        git::committed_resources(repo, &expected.to_string())?;
        let commit = repo.find_commit(expected).map_err(error)?;
        let tree = commit.tree().map_err(error)?;
        let roots_entry = tree
            .get_path(Path::new(".insomnium/Workspace"))
            .map_err(error)?;
        if roots_entry.kind() != Some(git2::ObjectType::Tree) {
            return Err("Recorded commit has no workspace tree".into());
        }
        let roots = repo.find_tree(roots_entry.id()).map_err(error)?;
        if roots.len() != 1 {
            return Err("Recorded commit must contain exactly one workspace".into());
        }
        let root = roots.get(0).ok_or("Missing committed workspace")?;
        let yml = format!("{}.yml", journal.workspace_id);
        let json = format!("{}.json", journal.workspace_id);
        if !matches!(root.filemode(), 0o100644 | 0o100755)
            || !matches!(root.name(), Ok(name) if name == yml || name == json)
        {
            return Err("Recorded commit belongs to a different workspace".into());
        }
    }
    Ok(transaction)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CheckoutInput {
    journal: Journal,
    author_name: String,
    author_email: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckoutResult {
    operation_id: String,
    branch: String,
    head_oid: String,
    workspace: Value,
}

/// Called under GitState then StorageState. The frontend must prepare the full
/// candidate with the validated three-way collection planner and persistence gate.
pub(crate) fn checkout(
    directory: &Path,
    session: &mut storage::Session,
    input: CheckoutInput,
) -> Result<CheckoutResult, String> {
    storage::ensure_no_pending_transition(directory)?;
    session.require_loaded()?;
    let journal = input.journal;
    validate_journal(&journal)?;
    for value in [&input.author_name, &input.author_email] {
        if value.trim().is_empty() || value.len() > 4096 || value.chars().any(char::is_control) {
            return Err("Checkout author name/email is invalid".into());
        }
    }
    let error = |e: git2::Error| e.message().to_owned();
    let signature = git2::Signature::now(&input.author_name, &input.author_email).map_err(error)?;
    if storage::read_workspace_file(directory)?.as_ref() != Some(&journal.before_workspace) {
        return Err("Persisted workspace changed; prepare checkout again".into());
    }
    let path = git::managed_path(&directory.join("git-v1"), &journal.repository_id)?;
    let repo = git::open_managed(&path)?;
    let mut transaction = lock_refs(&repo, &journal)?;
    let source = git::branch_reference(&journal.source_branch)?;
    let target = git::branch_reference(&journal.target_branch)?;
    if repo
        .find_reference("HEAD")
        .map_err(error)?
        .symbolic_target()
        .map_err(error)?
        != Some(source.as_str())
    {
        return Err("Git HEAD changed or is detached; prepare checkout again".into());
    }
    // Serialization and reader-compatible size limits are checked before writes.
    let bytes = serde_json::to_vec(&journal).map_err(|e| e.to_string())?;
    if bytes.len() as u64 > MAX_JOURNAL_BYTES {
        return Err("Checkout journal exceeds 256 MiB".into());
    }
    session.ensure_backup(directory)?;
    if storage::read_workspace_file(directory)?.as_ref() != Some(&journal.before_workspace) {
        return Err("Workspace changed before journal creation".into());
    }
    storage::ensure_no_pending_transition(directory)?;
    storage::atomic_write(&directory.join(storage::GIT_TRANSITION_FILE), &bytes)?;
    // From this point, failure means inspect/recover. Never remove the journal
    // from an error handler or pretend a failed ref transaction rolled back.
    let apply = || -> Result<CheckoutResult, String> {
        transaction
            .set_symbolic_target(
                "HEAD",
                &target,
                Some(&signature),
                "checkout: Insomnium collection",
            )
            .map_err(error)?;
        transaction.commit().map_err(error)?;
        // commit consumes the Git transaction. Reacquire and revalidate all refs
        // before writing workspace; app mutexes remain held across this boundary.
        let result = recover_inner(directory)?.ok_or("Checkout journal disappeared")?;
        if result.operation_id != journal.operation_id
            || result.branch != journal.target_branch
            || result.workspace != journal.after_workspace
        {
            return Err(
                "Checkout did not reach the requested target; reload authoritative state".into(),
            );
        }
        Ok(result)
    };
    apply().map_err(|error| {
        format!(
            "Checkout outcome requires recovery/load before retry: {error}. Journal location: {}",
            directory.join(storage::GIT_TRANSITION_FILE).display()
        )
    })
}

#[tauri::command]
pub async fn git_repository_checkout(
    app: tauri::AppHandle,
    git_state: tauri::State<'_, git::GitState>,
    storage_state: tauri::State<'_, storage::StorageState>,
    input: CheckoutInput,
) -> Result<CheckoutResult, String> {
    use tauri::Manager;
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let git_lock = git_state.0.clone();
    let storage_lock = storage_state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _git_guard = git_lock.lock().map_err(|e| e.to_string())?;
        let mut session = storage_lock.lock().map_err(|e| e.to_string())?;
        checkout(&directory, &mut session, input)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RestoreInput {
    operation_id: String,
    repository_id: String,
    workspace_id: String,
    branch: String,
    head_oid: String,
    selected_ids: Vec<String>,
    before_workspace: Value,
    after_workspace: Value,
}

/// Single-file compare-and-save; Git refs, index and worktree never change.
/// Caller owns GitState then StorageState. The frontend owns YAML decoding and
/// the reviewed restore plan; native independently validates its write boundary.
pub(crate) fn restore(
    directory: &Path,
    session: &mut storage::Session,
    input: RestoreInput,
) -> Result<CheckoutResult, String> {
    storage::ensure_no_pending_transition(directory)?;
    session.require_loaded()?;
    if !valid_id(&input.operation_id, 100)
        || !valid_id(&input.repository_id, 100)
        || !valid_id(&input.workspace_id, 200)
        || input.selected_ids.is_empty()
        || input.selected_ids.len() > 100_000
        || input.selected_ids.iter().any(|id| !valid_id(id, 200))
        || input.head_oid.len() != 40
        || !input.head_oid.bytes().all(|c| c.is_ascii_hexdigit())
    {
        return Err("Invalid Git restore IDs, selection or commit".into());
    }
    let selected: std::collections::HashSet<_> =
        input.selected_ids.iter().map(String::as_str).collect();
    if selected.len() != input.selected_ids.len() {
        return Err("Duplicate Git restore selection".into());
    }
    let journal = Journal {
        schema_version: 1,
        operation_id: input.operation_id,
        repository_id: input.repository_id,
        workspace_id: input.workspace_id,
        source_branch: input.branch.clone(),
        target_branch: input.branch,
        source_oid: input.head_oid.clone(),
        target_oid: input.head_oid,
        before_workspace: input.before_workspace,
        after_workspace: input.after_workspace,
    };
    // Reuse collection ownership/privacy/topology and envelope protection only.
    // This is NOT a version-1 branch-switch journal; do not persist it.
    validate_pair(&journal)?;
    let before = resources(&journal.before_workspace)?;
    let after = resources(&journal.after_workspace)?;
    for id in before.keys().chain(after.keys()) {
        if before.get(id) != after.get(id) && !selected.contains(id) {
            return Err("Git restore changes an unselected resource".into());
        }
    }
    for id in &selected {
        let resource = before
            .get(id)
            .or_else(|| after.get(id))
            .ok_or("Selected restore resource is missing")?;
        if !public_resource(resource)
            || (owner(&before, id) != Some(journal.workspace_id.as_str())
                && owner(&after, id) != Some(journal.workspace_id.as_str()))
        {
            return Err("Git restore selection is outside the public collection".into());
        }
    }
    let binding = before
        .values()
        .find(|r| {
            r["_type"] == "git_repository" && r["nativeRepositoryId"] == journal.repository_id
        })
        .ok_or("Missing Git restore binding")?;
    if binding
        .get("nativeCreateIntent")
        .is_some_and(|v| !v.is_null())
        || binding
            .get("nativeFetchIntent")
            .is_some_and(|v| !v.is_null())
    {
        return Err("Resolve pending Git work before restore".into());
    }
    let path = git::managed_path(&directory.join("git-v1"), &journal.repository_id)?;
    let repo = git::open_managed(&path)?;
    let error = |e: git2::Error| e.message().to_owned();
    let reference = git::branch_reference(&journal.source_branch)?;
    let expected = git2::Oid::from_str(&journal.source_oid).map_err(error)?;
    let mut locks = repo.transaction().map_err(error)?;
    locks.lock_ref("HEAD").map_err(error)?;
    locks.lock_ref(&reference).map_err(error)?;
    if repo.state() != git2::RepositoryState::Clean
        || repo
            .find_reference("HEAD")
            .map_err(error)?
            .symbolic_target()
            .map_err(error)?
            != Some(reference.as_str())
        || repo.find_reference(&reference).map_err(error)?.target() != Some(expected)
    {
        return Err("Git HEAD changed or repository is not clean; review restore again".into());
    }
    git::committed_resources(&repo, &expected.to_string())?;
    if storage::read_workspace_file(directory)?.as_ref() != Some(&journal.before_workspace) {
        return Err("Persisted workspace changed; review restore again".into());
    }
    session.ensure_backup(directory)?;
    if storage::read_workspace_file(directory)?.as_ref() != Some(&journal.before_workspace) {
        return Err("Workspace changed before restore save".into());
    }
    // One atomic workspace replacement; there is no second ref mutation to journal.
    storage::write_workspace_file(directory, &journal.after_workspace)?;
    Ok(CheckoutResult {
        operation_id: journal.operation_id,
        branch: journal.source_branch,
        head_oid: expected.to_string(),
        workspace: journal.after_workspace,
    })
}

#[tauri::command]
pub async fn git_repository_restore(
    app: tauri::AppHandle,
    git_state: tauri::State<'_, git::GitState>,
    storage_state: tauri::State<'_, storage::StorageState>,
    input: RestoreInput,
) -> Result<CheckoutResult, String> {
    use tauri::Manager;
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let git_lock = git_state.0.clone();
    let storage_lock = storage_state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _git_guard = git_lock.lock().map_err(|e| e.to_string())?;
        let mut session = storage_lock.lock().map_err(|e| e.to_string())?;
        restore(&directory, &mut session, input)
    })
    .await
    .map_err(|e| e.to_string())?
}
