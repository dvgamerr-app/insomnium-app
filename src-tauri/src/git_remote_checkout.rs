//! Create a local branch from an exact fetched revision. Resource application
//! remains a separate schema1 checkout; this command never switches HEAD.
use crate::{git, git_journal, git_merge_source::MergeSource, storage};
use git2::{BranchType, ErrorCode, Oid, Repository};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::Manager;

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RemoteCheckoutIntent {
    version: u32,
    phase: String,
    operation_id: String,
    workspace_id: String,
    repository_id: String,
    binding_id: String,
    source_branch: String,
    source_oid: String,
    name: String,
    target_oid: String,
    url: String,
    snapshot_oid: String,
    remote_branch: String,
    author: Author,
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Author {
    name: String,
    email: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RemoteCheckoutInput {
    intent: RemoteCheckoutIntent,
    expected_binding: Value,
    #[serde(default)]
    verify_only: bool,
}

fn error(value: git2::Error) -> String {
    value.message().to_owned()
}

fn oid(value: &str) -> Result<Oid, String> {
    if value.len() != 40 || !value.bytes().all(|c| c.is_ascii_hexdigit()) {
        return Err("Expected a full remote checkout commit ID".into());
    }
    Oid::from_str(value).map_err(error)
}

fn admit(repo: &Repository, data: &Value, input: &RemoteCheckoutInput) -> Result<(), String> {
    let intent = &input.intent;
    if intent.version != 1
        || !matches!(intent.phase.as_str(), "submitted" | "created")
        || (!input.verify_only && intent.phase != "submitted")
        || intent.operation_id.is_empty()
        || intent.operation_id.len() > 100
        || !intent
            .operation_id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
        || input.expected_binding["_id"] != intent.binding_id
        || input.expected_binding["nativeRemoteCheckoutIntent"]
            != serde_json::to_value(intent).map_err(|e| e.to_string())?
    {
        return Err("Remote checkout requires the exact saved submitted intent".into());
    }
    let resources = data["resources"]
        .as_array()
        .ok_or("Missing saved resources")?;
    if !resources.iter().any(|r| {
        r["_id"] == intent.workspace_id && r["_type"] == "workspace" && r["isPrivate"] != true
    }) {
        return Err("Remote checkout collection is missing or private".into());
    }
    let source = MergeSource::FetchSnapshot {
        url: intent.url.clone(),
        snapshot_oid: intent.snapshot_oid.clone(),
        branch: intent.remote_branch.clone(),
        expected_binding: input.expected_binding.clone(),
    };
    source.check(
        repo,
        data,
        &intent.repository_id,
        &intent.workspace_id,
        &intent.target_oid,
    )?;
    let current = oid(&intent.source_oid)?;
    let target = oid(&intent.target_oid)?;
    git_journal::validate_commit(repo, current, &intent.workspace_id)?;
    git_journal::validate_commit(repo, target, &intent.workspace_id)?;
    let boundaries = crate::git_remote::read_shallow_boundaries(repo.path())?;
    let history = crate::git_remote::history_view_while(repo, target, &boundaries, || Ok(()))?;
    if !history.shallow_boundaries.is_empty() {
        return Err("Fetch complete remote branch history before checkout".into());
    }
    Ok(())
}

fn create(repo: &Repository, input: &RemoteCheckoutInput) -> Result<String, String> {
    let intent = &input.intent;
    let source = git::branch_reference(&intent.source_branch)?;
    let target = git::branch_reference(&intent.name)?;
    if source.eq_ignore_ascii_case(&target) {
        return Err("Remote checkout needs a different local branch name".into());
    }
    let current = oid(&intent.source_oid)?;
    let incoming = oid(&intent.target_oid)?;
    for value in [&intent.author.name, &intent.author.email] {
        if value.trim().is_empty() || value.len() > 4096 || value.chars().any(char::is_control) {
            return Err("Remote checkout author is invalid".into());
        }
    }
    let signature =
        git2::Signature::now(&intent.author.name, &intent.author.email).map_err(error)?;
    let message = format!(
        "insomnium-remote-create-v1:{}:{source}:{current}:{incoming}",
        intent.operation_id
    );
    let mut transaction = repo.transaction().map_err(error)?;
    transaction.lock_ref("HEAD").map_err(error)?;
    let mut refs = [&source, &target];
    refs.sort();
    for name in refs {
        transaction.lock_ref(name).map_err(error)?;
    }
    if repo.state() != git2::RepositoryState::Clean {
        return Err("Finish the current Git operation before remote checkout".into());
    }
    let head = repo.find_reference("HEAD").map_err(error)?;
    let head_branch = head.symbolic_target().map_err(error)?;
    if head_branch != Some(source.as_str())
        && !(input.verify_only && head_branch == Some(target.as_str()))
    {
        return Err("Remote checkout source branch changed or HEAD is detached".into());
    }
    if repo.find_reference(&source).map_err(error)?.target() != Some(current) {
        return Err("Remote checkout source revision changed".into());
    }
    match repo.find_reference(&target) {
        Ok(reference) => {
            let log = repo.reflog(&target).map_err(error)?;
            if reference.name().map_err(error)? == target && reference.target() == Some(incoming) {
                if let Some(entry) = log.get(0) {
                    let author = entry.committer();
                    if entry.id_old().is_zero()
                        && entry.id_new() == incoming
                        && entry.message_bytes() == Some(message.as_bytes())
                        && author.name_bytes() == intent.author.name.as_bytes()
                        && author.email_bytes() == intent.author.email.as_bytes()
                    {
                        return Ok(incoming.to_string());
                    }
                }
            }
            return Err(
                "Local branch already exists without exact remote creation evidence".into(),
            );
        }
        Err(e) if e.code() == ErrorCode::NotFound => {}
        Err(e) => return Err(error(e)),
    }
    if input.verify_only {
        return Err("Remote branch creation is unconfirmed; no ref was recreated".into());
    }
    for (index, branch) in repo
        .branches(Some(BranchType::Local))
        .map_err(error)?
        .enumerate()
    {
        if index >= 999 {
            return Err("Local Git branch limit reached".into());
        }
        let (branch, _) = branch.map_err(error)?;
        let name = branch
            .name()
            .map_err(error)?
            .ok_or("Local branch name is not UTF-8")?;
        if name.eq_ignore_ascii_case(&intent.name) {
            return Err("Local branch already exists with this spelling or case".into());
        }
    }
    match repo.reflog(&target) {
        Ok(log) if !log.is_empty() => {
            return Err(
                "Remote branch has retained creation history but no ref; inspect before continuing"
                    .into(),
            )
        }
        Ok(_) => {}
        Err(e) if e.code() == ErrorCode::NotFound => {}
        Err(e) => return Err(error(e)),
    }
    repo.reference_ensure_log(&target).map_err(error)?;
    transaction
        .set_target(&target, incoming, Some(&signature), &message)
        .map_err(error)?;
    transaction.commit().map_err(|e| {
        format!(
            "Remote branch creation is unconfirmed; inspect before retrying: {}",
            e.message()
        )
    })?;
    Ok(incoming.to_string())
}

#[tauri::command]
pub async fn git_repository_create_remote_branch(
    app: tauri::AppHandle,
    state: tauri::State<'_, git::GitState>,
    storage_state: tauri::State<'_, storage::StorageState>,
    input: RemoteCheckoutInput,
) -> Result<String, String> {
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let git_lock = state.0.clone();
    let storage_lock = storage_state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _git = git_lock.lock().map_err(|_| "Git lock failed")?;
        let session = storage_lock.lock().map_err(|_| "Workspace lock failed")?;
        session.require_loaded()?;
        storage::ensure_no_pending_transition(&directory)?;
        let data = storage::read_workspace_file(&directory)?.ok_or("Missing saved workspace")?;
        let path = git::managed_path(&directory.join("git-v1"), &input.intent.repository_id)?;
        let repo = git::open_managed(&path)?;
        admit(&repo, &data, &input)?;
        create(&repo, &input)
    })
    .await
    .map_err(|e| e.to_string())?
}
