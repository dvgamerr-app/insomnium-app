use git2::{
    BranchType, ErrorCode, Repository, RepositoryInitOptions, RepositoryOpenFlags, StatusOptions,
};
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};
use tauri::Manager;

#[derive(Default)]
pub struct GitState(pub Arc<Mutex<()>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryInfo {
    head_oid: Option<String>,
    branch: Option<String>,
    branches: Vec<String>,
    branch_tips: Vec<BranchTip>,
    changes: Vec<GitChange>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BranchTip {
    name: String,
    head_oid: Option<String>,
    symbolic: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitChange {
    path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    path_bytes: Option<Vec<u8>>,
    status: u32,
    conflicted: bool,
}

pub(crate) fn reject_link(path: &Path) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) => {
            let linked = metadata.file_type().is_symlink();
            #[cfg(windows)]
            let linked = {
                use std::os::windows::fs::MetadataExt;
                linked || metadata.file_attributes() & 0x400 != 0
            };
            if linked {
                return Err("Managed Git paths cannot be links or reparse points.".into());
            }
            Ok(())
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

pub(crate) fn managed_path(root: &Path, repository_id: &str) -> Result<PathBuf, String> {
    if repository_id.is_empty()
        || repository_id.len() > 100
        || !repository_id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
    {
        return Err("Invalid Git repository ID.".into());
    }
    // Prefix prevents Windows device names (CON, NUL, etc.) becoming path components.
    reject_link(root)?;
    let path = root.join(format!("repo-{repository_id}"));
    reject_link(&path)?;
    reject_link(&path.join(".git"))?;
    Ok(path)
}

pub(crate) fn open_managed(path: &Path) -> Result<Repository, String> {
    let repo = open_managed_for_recovery(path)?;
    crate::git_fetch_journal::ensure_ready(&repo)?;
    Ok(repo)
}

/// Identity validation only. Explicit recovery/status callers must validate
/// journal identity and state; normal operations use open_managed.
pub(crate) fn open_managed_for_recovery(path: &Path) -> Result<Repository, String> {
    crate::git_fetch_journal::preflight(&path.join(".git"))?;
    let repo = Repository::open_ext(
        path,
        RepositoryOpenFlags::NO_SEARCH,
        std::iter::empty::<&Path>(),
    )
    .map_err(|e| e.message().to_owned())?;
    let expected = fs::canonicalize(path).map_err(|e| e.to_string())?;
    let expected_git = fs::canonicalize(path.join(".git")).map_err(|e| e.to_string())?;
    let actual_git = fs::canonicalize(repo.path()).map_err(|e| e.to_string())?;
    let actual_work = repo
        .workdir()
        .ok_or("Managed Git repository has no working directory.")?;
    if repo.is_bare()
        || actual_git != expected_git
        || fs::canonicalize(actual_work).map_err(|e| e.to_string())? != expected
    {
        return Err("Git repository points outside its managed directory.".into());
    }
    crate::git_ref_lock::recover(&repo)?;
    crate::git_advance_lock::recover(&repo)?;
    Ok(repo)
}

fn inspect(repo: &Repository) -> Result<RepositoryInfo, String> {
    let (head_oid, branch) = match repo.head() {
        Ok(head) => (
            head.target().map(|id| id.to_string()),
            if head.is_branch() {
                Some(
                    head.shorthand()
                        .map_err(|e| e.message().to_owned())?
                        .to_owned(),
                )
            } else {
                None
            },
        ),
        Err(error) if matches!(error.code(), ErrorCode::UnbornBranch | ErrorCode::NotFound) => {
            let head = repo
                .find_reference("HEAD")
                .map_err(|e| e.message().to_owned())?;
            let branch = head
                .symbolic_target()
                .map_err(|e| e.message().to_owned())?
                .and_then(|name| name.strip_prefix("refs/heads/"))
                .map(str::to_owned);
            (None, branch)
        }
        Err(error) => return Err(error.message().to_owned()),
    };
    let mut branches = Vec::new();
    let mut branch_tips = Vec::new();
    for item in repo
        .branches(Some(BranchType::Local))
        .map_err(|e| e.message().to_owned())?
    {
        if branches.len() >= 1000 {
            return Err("Git repository exceeds 1000 local branches.".into());
        }
        let (item, _) = item.map_err(|e| e.message().to_owned())?;
        let name = item
            .name()
            .map_err(|e| e.message().to_owned())?
            .ok_or("Git branch is not UTF-8.")?;
        let target = item.get().target();
        if let Some(oid) = target {
            repo.find_commit(oid).map_err(|e| e.message().to_owned())?;
        }
        branch_tips.push(BranchTip {
            name: name.to_owned(),
            head_oid: target.map(|oid| oid.to_string()),
            symbolic: item.get().kind() == Some(git2::ReferenceType::Symbolic),
        });
        branches.push(name.to_owned());
    }
    if let Some(name) = &branch {
        if let Some(tip) = branch_tips.iter().find(|tip| &tip.name == name) {
            if tip.head_oid != head_oid || tip.symbolic {
                return Err("Git HEAD changed while listing branches; reload branches.".into());
            }
        } else {
            if head_oid.is_some() {
                return Err(
                    "Git branch disappeared while listing branches; reload branches.".into(),
                );
            }
            if branches.len() >= 1000 {
                return Err("Git repository exceeds 1000 local branches.".into());
            }
            branches.push(name.clone());
            branch_tips.push(BranchTip {
                name: name.clone(),
                head_oid: None,
                symbolic: false,
            });
        }
    }
    branches.sort();
    branch_tips.sort_by(|a, b| a.name.cmp(&b.name));
    let mut options = StatusOptions::new();
    options
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .update_index(false);
    let statuses = repo
        .statuses(Some(&mut options))
        .map_err(|e| e.message().to_owned())?;
    if statuses.len() > 10000 {
        return Err("Git repository exceeds 10000 changed paths.".into());
    }
    let mut changes = Vec::new();
    for entry in statuses.iter() {
        // Status covers the complete tree, including external byte names which
        // cannot be decoded as UTF-8. Do not disable collection Git operations
        // because an unrelated filename is non-UTF8. Preserve identity as bytes;
        // the hex label is display data, never a pathname to pass back to Git.
        let bytes = entry.path_bytes();
        let (path, path_bytes) = match std::str::from_utf8(bytes) {
            Ok(path) => (path.to_owned(), None),
            Err(_) => (
                format!(
                    "Path bytes: {}",
                    bytes
                        .iter()
                        .map(|byte| format!("{byte:02x}"))
                        .collect::<Vec<_>>()
                        .join(" ")
                ),
                Some(bytes.to_vec()),
            ),
        };
        changes.push(GitChange {
            path,
            path_bytes,
            status: entry.status().bits(),
            conflicted: entry.status().is_conflicted(),
        });
    }
    Ok(RepositoryInfo {
        head_oid,
        branch,
        branches,
        branch_tips,
        changes,
    })
}

async fn repository_operation(
    app: tauri::AppHandle,
    state: tauri::State<'_, GitState>,
    repository_id: String,
    initialize: bool,
) -> Result<RepositoryInfo, String> {
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let root = directory.join("git-v1");
    let lock = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock.lock().map_err(|e| e.to_string())?;
        if initialize {
            crate::storage::ensure_no_pending_transition(&directory)?;
        }
        let path = managed_path(&root, &repository_id)?;
        if initialize {
            match fs::symlink_metadata(&path) {
                // A persisted binding can outlive a lost initialization response.
                // Open the existing repository without reinitializing or changing HEAD.
                Ok(metadata) if metadata.is_dir() => {
                    return inspect(&open_managed(&path).map_err(|error| {
                        format!("Existing Git directory cannot be opened; it was left unchanged: {error}")
                    })?);
                }
                Ok(_) => return Err("Managed Git repository path is not a directory.".into()),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => return Err(error.to_string()),
            }
            fs::create_dir_all(&root).map_err(|e| e.to_string())?;
            reject_link(&root)?;
            // Exclusive creation: never adopt a path that appeared after inspection.
            fs::create_dir(&path).map_err(|e| e.to_string())?;
            let mut options = RepositoryInitOptions::new();
            options
                .no_reinit(true)
                .external_template(false)
                .initial_head("main");
            // Leave a failed initialization directory intact for diagnosis/recovery.
            // An invalid existing directory must not be silently rebuilt on retry.
            Repository::init_opts(&path, &options).map_err(|e| e.message().to_owned())?;
        }
        inspect(&open_managed(&path)?)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_repository_init(
    app: tauri::AppHandle,
    state: tauri::State<'_, GitState>,
    repository_id: String,
) -> Result<RepositoryInfo, String> {
    repository_operation(app, state, repository_id, true).await
}

#[tauri::command]
pub async fn git_repository_info(
    app: tauri::AppHandle,
    state: tauri::State<'_, GitState>,
    repository_id: String,
) -> Result<RepositoryInfo, String> {
    repository_operation(app, state, repository_id, false).await
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommittedResources {
    commit_oid: String,
    files: Vec<ResourceFile>,
}

#[derive(Serialize, serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct ResourceFile {
    path: String,
    content: String,
}

pub(crate) fn committed_resources(
    repo: &Repository,
    commit_oid: &str,
) -> Result<CommittedResources, String> {
    // Require the exact revision observed by the caller, not a moving ref or revspec.
    if commit_oid.len() != 40 || !commit_oid.bytes().all(|c| c.is_ascii_hexdigit()) {
        return Err("Expected a full 40-character Git commit ID.".into());
    }
    let oid = git2::Oid::from_str(commit_oid).map_err(|e| e.message().to_owned())?;
    let commit = repo.find_commit(oid).map_err(|e| e.message().to_owned())?;
    let tree = commit.tree().map_err(|e| e.message().to_owned())?;
    let mut result = CommittedResources {
        commit_oid: commit.id().to_string(),
        files: Vec::new(),
    };
    let Some(root) = tree.get_name(".insomnium") else {
        return Ok(result);
    };
    if root.filemode() != 0o040000 {
        return Err(".insomnium must be a Git tree.".into());
    }
    let odb = repo.odb().map_err(|e| e.message().to_owned())?;
    let read_tree = |id| -> Result<git2::Tree<'_>, String> {
        let (size, kind) = odb.read_header(id).map_err(|e| e.message().to_owned())?;
        if kind != git2::ObjectType::Tree || size > 1024 * 1024 {
            return Err("Managed Git tree is invalid or exceeds 1 MiB.".into());
        }
        repo.find_tree(id).map_err(|e| e.message().to_owned())
    };
    let managed = read_tree(root.id())?;
    if managed.len() > 12 {
        return Err("Too many managed Git resource types.".into());
    }
    let mut total_bytes = 0usize;
    let mut paths = std::collections::HashSet::new();
    for group in managed.iter() {
        let name = group.name().map_err(|e| e.message().to_owned())?;
        if !matches!(
            name,
            "Workspace"
                | "Environment"
                | "RequestGroup"
                | "Request"
                | "ApiSpec"
                | "UnitTestSuite"
                | "UnitTest"
                | "GrpcRequest"
                | "ProtoFile"
                | "ProtoDirectory"
                | "WebSocketRequest"
                | "WebSocketPayload"
        ) || group.filemode() != 0o040000
        {
            return Err("Unsupported entry in managed Git resource root.".into());
        }
        let files = read_tree(group.id())?;
        if result.files.len() + files.len() > 10000 {
            return Err("Git collection exceeds 10000 resource files.".into());
        }
        for file in files.iter() {
            let filename = file.name().map_err(|e| e.message().to_owned())?;
            let id = filename
                .strip_suffix(".yml")
                .or_else(|| filename.strip_suffix(".json"))
                .ok_or("Git resource must use .yml or .json.")?;
            if id.is_empty()
                || id.len() > 200
                || !id
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
            {
                return Err("Invalid Git resource filename.".into());
            }
            if !matches!(file.filemode(), 0o100644 | 0o100755) {
                return Err("Git resource must be a regular blob, not a link or submodule.".into());
            }
            let path = format!(".insomnium/{name}/{filename}");
            if !paths.insert(path.to_ascii_lowercase()) {
                return Err("Case-colliding Git resource paths.".into());
            }
            let (size, kind) = odb
                .read_header(file.id())
                .map_err(|e| e.message().to_owned())?;
            if kind != git2::ObjectType::Blob || size > 20 * 1024 * 1024 {
                return Err("Git resource is invalid or exceeds 20 MiB.".into());
            }
            total_bytes += size;
            if total_bytes > 100 * 1024 * 1024 {
                return Err("Git collection exceeds 100 MiB.".into());
            }
            let blob = repo
                .find_blob(file.id())
                .map_err(|e| e.message().to_owned())?;
            let content = std::str::from_utf8(blob.content())
                .map_err(|_| "Git resource content is not UTF-8.")?
                .to_owned();
            result.files.push(ResourceFile { path, content });
        }
    }
    result.files.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(result)
}

/// Read committed resource blobs only. This never checks out or updates the index.
/// The JavaScript collection reader must still validate resource content and ownership.
#[tauri::command]
pub async fn git_repository_read_commit(
    app: tauri::AppHandle,
    state: tauri::State<'_, GitState>,
    repository_id: String,
    commit_oid: String,
) -> Result<CommittedResources, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("git-v1");
    let lock = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock.lock().map_err(|e| e.to_string())?;
        let path = managed_path(&root, &repository_id)?;
        committed_resources(&open_managed(&path)?, &commit_oid)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHistoryPage {
    tip_oid: String,
    commits: Vec<GitHistoryCommit>,
    next_offset: Option<u32>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitHistoryCommit {
    oid: String,
    parent_oids: Vec<String>,
    message: String,
    message_truncated: bool,
    text_lossy: bool,
    author: GitHistorySignature,
    committer: GitHistorySignature,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitHistorySignature {
    name: String,
    email: String,
    timestamp: i64,
    offset_minutes: i32,
}

fn history_signature(
    signature: git2::Signature<'_>,
) -> Result<(GitHistorySignature, bool), String> {
    if signature.name_bytes().len() > 4096 || signature.email_bytes().len() > 4096 {
        return Err("Git signature exceeds 4096 bytes.".into());
    }
    let lossy = std::str::from_utf8(signature.name_bytes()).is_err()
        || std::str::from_utf8(signature.email_bytes()).is_err();
    Ok((
        GitHistorySignature {
            name: String::from_utf8_lossy(signature.name_bytes()).into_owned(),
            email: String::from_utf8_lossy(signature.email_bytes()).into_owned(),
            timestamp: signature.when().seconds(),
            offset_minutes: signature.when().offset_minutes(),
        },
        lossy,
    ))
}

fn history_page(
    repo: &Repository,
    tip_oid: &str,
    offset: u32,
    limit: u32,
) -> Result<GitHistoryPage, String> {
    if !(1..=100).contains(&limit) {
        return Err("Git history requires limit 1..100.".into());
    }
    if tip_oid.len() != 40 || !tip_oid.bytes().all(|c| c.is_ascii_hexdigit()) {
        return Err("Expected a full 40-character Git commit ID.".into());
    }
    let tip = git2::Oid::from_str(tip_oid).map_err(|e| e.message().to_owned())?;
    repo.find_commit(tip).map_err(|e| e.message().to_owned())?;
    let mut walk = repo.revwalk().map_err(|e| e.message().to_owned())?;
    // Include merged ancestry; pin every page to this immutable tip.
    walk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)
        .map_err(|e| e.message().to_owned())?;
    walk.push(tip).map_err(|e| e.message().to_owned())?;
    for _ in 0..offset {
        match walk.next() {
            Some(id) => {
                id.map_err(|e| e.message().to_owned())?;
            }
            None => {
                return Ok(GitHistoryPage {
                    tip_oid: tip.to_string(),
                    commits: Vec::new(),
                    next_offset: None,
                })
            }
        }
    }
    let odb = repo.odb().map_err(|e| e.message().to_owned())?;
    let mut commits = Vec::new();
    for _ in 0..limit {
        let Some(id) = walk.next() else {
            break;
        };
        let id = id.map_err(|e| e.message().to_owned())?;
        let (size, kind) = odb.read_header(id).map_err(|e| e.message().to_owned())?;
        if kind != git2::ObjectType::Commit || size > 1024 * 1024 {
            return Err("Git history commit is invalid or exceeds 1 MiB.".into());
        }
        let commit = repo.find_commit(id).map_err(|e| e.message().to_owned())?;
        if commit.parent_count() > 1000 {
            return Err("Git commit exceeds 1000 parents.".into());
        }
        let (author, author_lossy) = history_signature(commit.author())?;
        let (committer, committer_lossy) = history_signature(commit.committer())?;
        let message_bytes = commit.message_bytes();
        let text_lossy =
            author_lossy || committer_lossy || std::str::from_utf8(message_bytes).is_err();
        let mut message = String::from_utf8_lossy(message_bytes).into_owned();
        let message_truncated = message.len() > 65536;
        if message_truncated {
            let mut end = 65536;
            while !message.is_char_boundary(end) {
                end -= 1;
            }
            message.truncate(end);
        }
        commits.push(GitHistoryCommit {
            oid: id.to_string(),
            parent_oids: commit.parent_ids().map(|id| id.to_string()).collect(),
            message,
            message_truncated,
            text_lossy,
            author,
            committer,
        });
    }
    let more = walk
        .next()
        .transpose()
        .map_err(|e| e.message().to_owned())?
        .is_some();
    let next_offset = if more {
        Some(
            offset
                .checked_add(commits.len() as u32)
                .ok_or("Git history offset overflow.")?,
        )
    } else {
        None
    };
    Ok(GitHistoryPage {
        tip_oid: tip.to_string(),
        commits,
        next_offset,
    })
}

#[tauri::command]
pub async fn git_repository_history(
    app: tauri::AppHandle,
    state: tauri::State<'_, GitState>,
    repository_id: String,
    tip_oid: String,
    offset: u32,
    limit: u32,
) -> Result<GitHistoryPage, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("git-v1");
    let lock = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock.lock().map_err(|e| e.to_string())?;
        let path = managed_path(&root, &repository_id)?;
        history_page(&open_managed(&path)?, &tip_oid, offset, limit)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GitCommitInput {
    branch: String,
    expected_head_oid: Option<String>,
    workspace_id: String,
    files: Vec<ResourceFile>,
    author_name: String,
    author_email: String,
    message: String,
}

fn commit_resources(repo: &Repository, input: GitCommitInput) -> Result<String, String> {
    let error = |e: git2::Error| e.message().to_owned();
    let reference_name = format!("refs/heads/{}", input.branch);
    if input.branch.is_empty()
        || reference_name.len() > 1024
        || reference_name.contains('\0')
        || !git2::Reference::is_valid_name(&reference_name)
    {
        return Err("Invalid Git branch name.".into());
    }
    if input.message.trim().is_empty()
        || input.message.len() > 65536
        || input.message.contains('\0')
    {
        return Err("Commit message must be nonempty and at most 64 KiB, without NUL.".into());
    }
    for value in [&input.author_name, &input.author_email] {
        if value.trim().is_empty() || value.len() > 4096 || value.chars().any(char::is_control) {
            return Err("Commit author name/email is invalid.".into());
        }
    }
    let signature = git2::Signature::now(&input.author_name, &input.author_email).map_err(error)?;
    let expected = input
        .expected_head_oid
        .as_deref()
        .map(|value| {
            if value.len() != 40 || !value.bytes().all(|c| c.is_ascii_hexdigit()) {
                return Err("Expected a full Git HEAD commit ID.".to_owned());
            }
            git2::Oid::from_str(value).map_err(error)
        })
        .transpose()?;
    if input.files.is_empty() || input.files.len() > 10000 {
        return Err("Git commit requires 1..10000 resource files.".into());
    }
    let mut groups: std::collections::BTreeMap<&str, Vec<(&str, &str)>> =
        std::collections::BTreeMap::new();
    let mut paths = std::collections::HashSet::new();
    let mut ids = std::collections::HashSet::new();
    let mut total = 0usize;
    let mut workspaces = 0;
    for file in &input.files {
        let parts: Vec<_> = file.path.split('/').collect();
        if parts.len() != 3
            || parts[0] != ".insomnium"
            || !matches!(
                parts[1],
                "Workspace"
                    | "Environment"
                    | "RequestGroup"
                    | "Request"
                    | "ApiSpec"
                    | "UnitTestSuite"
                    | "UnitTest"
                    | "GrpcRequest"
                    | "ProtoFile"
                    | "ProtoDirectory"
                    | "WebSocketRequest"
                    | "WebSocketPayload"
            )
        {
            return Err("Invalid managed Git commit path.".into());
        }
        let id = parts[2]
            .strip_suffix(".yml")
            .or_else(|| parts[2].strip_suffix(".json"))
            .ok_or("Invalid Git resource extension.")?;
        if id.is_empty()
            || id.len() > 200
            || !id
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
            || !paths.insert(file.path.to_ascii_lowercase())
            || !ids.insert(id)
        {
            return Err("Invalid or duplicate Git resource path/ID.".into());
        }
        if parts[1] == "Workspace" {
            workspaces += 1;
            if id != input.workspace_id {
                return Err("Git workspace ID does not match.".into());
            }
        }
        total += file.content.len();
        if file.content.len() > 20 * 1024 * 1024 || total > 100 * 1024 * 1024 {
            return Err("Git commit exceeds resource content limits.".into());
        }
        groups
            .entry(parts[1])
            .or_default()
            .push((parts[2], &file.content));
    }
    if workspaces != 1 {
        return Err("Git commit requires exactly one workspace.".into());
    }
    for files in groups.values() {
        if files.iter().map(|(name, _)| name.len() + 28).sum::<usize>() > 1024 * 1024 {
            return Err("Git resource tree exceeds 1 MiB.".into());
        }
    }
    // Lock both the symbolic HEAD and its intended direct target before checking
    // the baseline. Only the branch target will be changed.
    let mut transaction = repo.transaction().map_err(error)?;
    transaction.lock_ref("HEAD").map_err(error)?;
    transaction.lock_ref(&reference_name).map_err(error)?;
    if repo.state() != git2::RepositoryState::Clean {
        return Err("Finish the active Git operation before committing resources.".into());
    }
    let head = repo.find_reference("HEAD").map_err(error)?;
    if head.symbolic_target().map_err(error)? != Some(reference_name.as_str()) {
        return Err("Git branch changed or HEAD is detached; reload staging.".into());
    }
    let actual = match repo.find_reference(&reference_name) {
        Ok(reference) => Some(
            reference
                .target()
                .ok_or("Git branch must be a direct reference.")?,
        ),
        Err(e) if e.code() == ErrorCode::NotFound => None,
        Err(e) => return Err(error(e)),
    };
    if actual != expected {
        return Err("Git HEAD changed; reload staging.".into());
    }
    let parent = expected
        .map(|oid| repo.find_commit(oid).map_err(error))
        .transpose()?;
    let original_tree = parent
        .as_ref()
        .map(|commit| commit.tree().map_err(error))
        .transpose()?;
    // Reject unsupported managed entries rather than silently dropping them.
    if let Some(oid) = expected {
        let baseline = committed_resources(repo, &oid.to_string())?;
        let roots: Vec<_> = baseline
            .files
            .iter()
            .filter(|file| file.path.starts_with(".insomnium/Workspace/"))
            .collect();
        if !baseline.files.is_empty()
            && (roots.len() != 1
                || !(roots[0].path == format!(".insomnium/Workspace/{}.yml", input.workspace_id)
                    || roots[0].path
                        == format!(".insomnium/Workspace/{}.json", input.workspace_id)))
        {
            return Err("Existing Git tree belongs to another or invalid workspace.".into());
        }
    }
    let mut managed_builder = repo.treebuilder(None).map_err(error)?;
    for (kind, files) in groups {
        let mut builder = repo.treebuilder(None).map_err(error)?;
        for (name, content) in files {
            let mode = original_tree
                .as_ref()
                .and_then(|tree| {
                    tree.get_path(Path::new(&format!(".insomnium/{kind}/{name}")))
                        .ok()
                })
                .map(|entry| entry.filemode())
                .unwrap_or(0o100644);
            let oid = repo.blob(content.as_bytes()).map_err(error)?;
            builder.insert(name, oid, mode).map_err(error)?;
        }
        managed_builder
            .insert(kind, builder.write().map_err(error)?, 0o040000)
            .map_err(error)?;
    }
    let mut root = repo.treebuilder(original_tree.as_ref()).map_err(error)?;
    root.insert(
        ".insomnium",
        managed_builder.write().map_err(error)?,
        0o040000,
    )
    .map_err(error)?;
    let tree_oid = root.write().map_err(error)?;
    if original_tree
        .as_ref()
        .is_some_and(|tree| tree.id() == tree_oid)
    {
        return Err("No Git resource changes to commit.".into());
    }
    let tree = repo.find_tree(tree_oid).map_err(error)?;
    let parents: Vec<_> = parent.iter().collect();
    let oid = repo
        .commit(
            None,
            &signature,
            &signature,
            &input.message,
            &tree,
            &parents,
        )
        .map_err(error)?;
    transaction
        .set_target(
            &reference_name,
            oid,
            Some(&signature),
            "commit: Insomnium resources",
        )
        .map_err(error)?;
    transaction.commit().map_err(|e| {
        format!(
            "Git ref update failed; inspect branch before retrying (candidate {oid}): {}",
            e.message()
        )
    })?;
    Ok(oid.to_string())
}

/// Commits a complete JS-validated managed candidate. App resources are the virtual
/// worktree: this command does not alter the physical index/worktree or persist app state.
#[tauri::command]
pub async fn git_repository_commit(
    app: tauri::AppHandle,
    state: tauri::State<'_, GitState>,
    repository_id: String,
    input: GitCommitInput,
) -> Result<String, String> {
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let root = directory.join("git-v1");
    let lock = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock.lock().map_err(|e| e.to_string())?;
        crate::storage::ensure_no_pending_transition(&directory)?;
        let path = managed_path(&root, &repository_id)?;
        commit_resources(&open_managed(&path)?, input)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GitCreateBranchInput {
    /// Persist with the frontend create intent before submitting.
    #[serde(default)]
    operation_id: Option<String>,
    #[serde(default)]
    verify_only: bool,
    name: String,
    expected_branch: String,
    expected_head_oid: String,
    author_name: String,
    author_email: String,
}

pub(crate) fn branch_reference(name: &str) -> Result<String, String> {
    let reference = format!("refs/heads/{name}");
    if name.is_empty()
        || name == "HEAD"
        || name.starts_with('-')
        || reference.len() > 1024
        || reference.contains('\0')
        || !git2::Reference::is_valid_name(&reference)
    {
        return Err("Invalid Git branch name.".into());
    }
    Ok(reference)
}

/// Creates a ref only. Checkout/resource application is a separate recoverable transition.
fn create_branch(repo: &Repository, input: GitCreateBranchInput) -> Result<String, String> {
    let error = |e: git2::Error| e.message().to_owned();
    let source = branch_reference(&input.expected_branch)?;
    let target = branch_reference(&input.name)?;
    if source.eq_ignore_ascii_case(&target) {
        return Err("New branch must differ from the current branch.".into());
    }
    if input.expected_head_oid.len() != 40
        || !input
            .expected_head_oid
            .bytes()
            .all(|c| c.is_ascii_hexdigit())
    {
        return Err("Expected a full Git HEAD commit ID.".into());
    }
    let expected = git2::Oid::from_str(&input.expected_head_oid).map_err(error)?;
    for value in [&input.author_name, &input.author_email] {
        if value.trim().is_empty() || value.len() > 4096 || value.chars().any(char::is_control) {
            return Err("Branch author name/email is invalid.".into());
        }
    }
    let signature = git2::Signature::now(&input.author_name, &input.author_email).map_err(error)?;
    if let Some(id) = &input.operation_id {
        if id.is_empty()
            || id.len() > 100
            || !id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
        {
            return Err("Invalid branch creation operation ID.".into());
        }
    }
    let reflog_message = input.operation_id.as_ref().map_or_else(
        || "branch: created from Insomnium HEAD".to_owned(),
        |id| format!("insomnium-create-v1:{id}:{source}"),
    );

    let mut transaction = repo.transaction().map_err(error)?;
    transaction.lock_ref("HEAD").map_err(error)?;
    // Deterministic lock order for the two direct refs.
    let mut names = [&source, &target];
    names.sort();
    for name in names {
        transaction.lock_ref(name).map_err(error)?;
    }
    if repo.state() != git2::RepositoryState::Clean {
        return Err("Finish the current Git operation before creating a branch.".into());
    }
    let head = repo.find_reference("HEAD").map_err(error)?;
    let current_head = head.symbolic_target().map_err(error)?;
    if current_head != Some(source.as_str())
        && !(input.verify_only && current_head == Some(target.as_str()))
    {
        return Err("Git branch changed or HEAD is detached; reload branches.".into());
    }
    if repo.find_reference(&source).map_err(error)?.target() != Some(expected) {
        return Err("Git HEAD changed; reload branches.".into());
    }
    repo.find_commit(expected).map_err(error)?;
    match repo.find_reference(&target) {
        Ok(reference) => {
            // A matching tip alone cannot prove ownership. Retry never writes.
            if input.operation_id.is_some()
                && reference.name().map_err(error)? == target.as_str()
                && reference.target() == Some(expected)
            {
                let log = repo.reflog(&target).map_err(error)?;
                if let Some(entry) = log.get(0) {
                    let author = entry.committer();
                    if entry.id_old().is_zero()
                        && entry.id_new() == expected
                        && entry.message_bytes() == Some(reflog_message.as_bytes())
                        && author.name_bytes() == input.author_name.as_bytes()
                        && author.email_bytes() == input.author_email.as_bytes()
                    {
                        return Ok(expected.to_string());
                    }
                }
            }
            return Err(
                "Git branch already exists without matching creation evidence; reload branches."
                    .into(),
            );
        }
        Err(e) if e.code() == ErrorCode::NotFound => {}
        Err(e) => return Err(error(e)),
    }
    if input.verify_only {
        return Err(
            "Branch creation cannot be verified: target is absent. Pending intent retained.".into(),
        );
    }
    // Reject case aliases consistently, including packed refs on Windows.
    for (index, item) in repo
        .branches(Some(BranchType::Local))
        .map_err(error)?
        .enumerate()
    {
        if index >= 999 {
            return Err("Git repository would exceed 1000 local branches.".into());
        }
        let (branch, _) = item.map_err(error)?;
        let name = branch
            .name()
            .map_err(error)?
            .ok_or("Git branch is not UTF-8.")?;
        if name.eq_ignore_ascii_case(&input.name) {
            return Err("Git branch already exists with this spelling or case.".into());
        }
    }
    if input.operation_id.is_some() {
        // An empty log from a failed pre-ref attempt can be reused.
        // Retained history without a ref requires inspection, not resurrection.
        match repo.reflog(&target) {
            Ok(log) if !log.is_empty() => {
                return Err(
                    "Branch creation has existing history but no ref; inspect before retrying."
                        .into(),
                )
            }
            Ok(_) => {}
            Err(e) if e.code() == ErrorCode::NotFound => {}
            Err(e) => return Err(error(e)),
        }
        repo.reference_ensure_log(&target).map_err(error)?;
    }
    transaction
        .set_target(&target, expected, Some(&signature), &reflog_message)
        .map_err(error)?;
    transaction.commit().map_err(|e| {
        format!(
            "Git branch creation failed; reload branches before retrying: {}",
            e.message()
        )
    })?;
    Ok(expected.to_string())
}

#[tauri::command]
pub async fn git_repository_create_branch(
    app: tauri::AppHandle,
    state: tauri::State<'_, GitState>,
    repository_id: String,
    input: GitCreateBranchInput,
) -> Result<String, String> {
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let root = directory.join("git-v1");
    let lock = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock.lock().map_err(|e| e.to_string())?;
        crate::storage::ensure_no_pending_transition(&directory)?;
        let path = managed_path(&root, &repository_id)?;
        create_branch(&open_managed(&path)?, input)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GitDeleteBranchInput {
    name: String,
    expected_branch: String,
    expected_head_oid: String,
    expected_target_oid: String,
}

/// Deletes one inactive, fully merged direct local ref after exact-tip checks.
/// No force fallback and no workspace/index/worktree mutation.
fn delete_branch(repo: &Repository, input: GitDeleteBranchInput) -> Result<String, String> {
    let error = |e: git2::Error| e.message().to_owned();
    let source = branch_reference(&input.expected_branch)?;
    let target = branch_reference(&input.name)?;
    if source.eq_ignore_ascii_case(&target) {
        return Err("Cannot delete the active branch.".into());
    }
    let parse = |value: &str| {
        if value.len() != 40 || !value.bytes().all(|c| c.is_ascii_hexdigit()) {
            return Err("Expected a full Git commit ID.".to_owned());
        }
        git2::Oid::from_str(value).map_err(error)
    };
    let expected_head = parse(&input.expected_head_oid)?;
    let expected_target = parse(&input.expected_target_oid)?;
    let mut transaction = repo.transaction().map_err(error)?;
    transaction.lock_ref("HEAD").map_err(error)?;
    let mut names = [&source, &target];
    names.sort();
    for name in names {
        transaction.lock_ref(name).map_err(error)?;
    }
    if repo.state() != git2::RepositoryState::Clean {
        return Err("Finish the current Git operation before deleting a branch.".into());
    }
    // Managed repos do not create linked worktrees. Refuse externally added ones
    // rather than deleting a branch that another worktree may have checked out.
    if !repo.worktrees().map_err(error)?.is_empty() {
        return Err("Branch deletion with linked worktrees requires external review.".into());
    }
    if repo
        .find_reference("HEAD")
        .map_err(error)?
        .symbolic_target()
        .map_err(error)?
        != Some(source.as_str())
    {
        return Err("Git branch changed or HEAD is detached; reload branches.".into());
    }
    if repo.find_reference(&source).map_err(error)?.target() != Some(expected_head) {
        return Err("Git HEAD changed; reload branches.".into());
    }
    let reference = repo.find_reference(&target).map_err(error)?;
    if reference.name().map_err(error)? != target || reference.target() != Some(expected_target) {
        return Err("Branch tip changed or is not a direct reference; reload branches.".into());
    }
    repo.find_commit(expected_head).map_err(error)?;
    repo.find_commit(expected_target).map_err(error)?;
    if expected_head != expected_target
        && !repo
            .graph_descendant_of(expected_head, expected_target)
            .map_err(error)?
    {
        return Err(
            "Branch contains commits not merged into the current branch. Merge before deleting."
                .into(),
        );
    }
    transaction.remove(&target).map_err(error)?;
    transaction.commit().map_err(|e| {
        format!(
            "Branch deletion outcome is uncertain; reload branches before retrying: {}",
            e.message()
        )
    })?;
    Ok(expected_target.to_string())
}

#[tauri::command]
pub async fn git_repository_delete_branch(
    app: tauri::AppHandle,
    state: tauri::State<'_, GitState>,
    repository_id: String,
    input: GitDeleteBranchInput,
) -> Result<String, String> {
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let root = directory.join("git-v1");
    let lock = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock.lock().map_err(|e| e.to_string())?;
        crate::storage::ensure_no_pending_transition(&directory)?;
        let path = managed_path(&root, &repository_id)?;
        delete_branch(&open_managed(&path)?, input)
    })
    .await
    .map_err(|e| e.to_string())?
}
