//! Prepare complete-tree advancement candidates without moving refs, touching
//! the on-disk index, or writing workspace state. Application is journaled later.
use crate::{git, git_journal, storage};
use git2::{Oid, Repository, RepositoryState};
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MergeInput {
    repository_id: String,
    workspace_id: String,
    source_branch: String,
    source_oid: String,
    incoming_oid: String,
    author_name: String,
    author_email: String,
    message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeCandidate {
    source_oid: String,
    incoming_oid: String,
    kind: &'static str,
    merge_base_oid: Option<String>,
    target_oid: Option<String>,
    conflicts: Vec<MergeConflict>,
}

#[derive(Serialize)]
struct MergeConflict {
    ancestor: Option<ConflictEntry>,
    ours: Option<ConflictEntry>,
    theirs: Option<ConflictEntry>,
}

#[derive(Serialize)]
struct ConflictEntry {
    // Git paths are bytes. Never collapse non-UTF8 paths or rename sides.
    path: Vec<u8>,
    oid: String,
    mode: u32,
}

fn oid(value: &str) -> Result<Oid, String> {
    if value.len() != 40 || !value.bytes().all(|c| c.is_ascii_hexdigit()) {
        return Err("Expected a full 40-character merge commit ID".into());
    }
    Oid::from_str(value).map_err(error)
}

fn error(value: git2::Error) -> String {
    value.message().to_owned()
}

fn check_head(repo: &Repository, branch: &str, expected: Oid) -> Result<(), String> {
    if repo.state() != RepositoryState::Clean
        || repo.head_detached().map_err(error)?
        || repo
            .find_reference("HEAD")
            .map_err(error)?
            .symbolic_target()
            .map_err(error)?
            != Some(branch)
        || repo.find_reference(branch).map_err(error)?.target() != Some(expected)
    {
        return Err("Merge source changed; reload Git before preparing again".into());
    }
    Ok(())
}

pub(crate) fn prepare(repo: &Repository, input: &MergeInput) -> Result<MergeCandidate, String> {
    let branch = git::branch_reference(&input.source_branch)?;
    let old = oid(&input.source_oid)?;
    let incoming = oid(&input.incoming_oid)?;
    if input.workspace_id.is_empty()
        || input.workspace_id.len() > 200
        || !input
            .workspace_id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'_' | b'-'))
    {
        return Err("Invalid merge workspace identity".into());
    }
    check_head(repo, &branch, old)?;
    for id in std::collections::HashSet::from([old, incoming]) {
        git_journal::validate_commit(repo, id, &input.workspace_id)?;
    }
    let mut candidate = MergeCandidate {
        source_oid: old.to_string(),
        incoming_oid: incoming.to_string(),
        kind: "upToDate",
        merge_base_oid: None,
        target_oid: Some(old.to_string()),
        conflicts: Vec::new(),
    };
    if old == incoming {
        return Ok(candidate);
    }
    // Missing shallow ancestors must not be mistaken for divergence/unrelated history.
    if repo.is_shallow() {
        return Err("Expand fetched history before classifying this merge".into());
    }
    if repo.graph_descendant_of(old, incoming).map_err(error)? {
        check_head(repo, &branch, old)?;
        return Ok(candidate);
    }
    if repo.graph_descendant_of(incoming, old).map_err(error)? {
        candidate.kind = "fastForward";
        candidate.merge_base_oid = Some(old.to_string());
        candidate.target_oid = Some(incoming.to_string());
        check_head(repo, &branch, old)?;
        return Ok(candidate);
    }
    let bases = repo.merge_bases(old, incoming).map_err(error)?;
    // The current schema2 journal pins one actual base. Recursive virtual bases
    // require an explicit extension rather than silently choosing one ancestor.
    if bases.len() != 1 {
        return Err("Merge requires a supported single common ancestor".into());
    }
    let base = bases[0];
    git_journal::validate_commit(repo, base, &input.workspace_id)?;
    let ours = repo.find_commit(old).map_err(error)?;
    let theirs = repo.find_commit(incoming).map_err(error)?;
    let ancestor = repo.find_commit(base).map_err(error)?;
    let mut index = repo
        .merge_trees(
            &ancestor.tree().map_err(error)?,
            &ours.tree().map_err(error)?,
            &theirs.tree().map_err(error)?,
            None,
        )
        .map_err(error)?;
    candidate.kind = "merge";
    candidate.merge_base_oid = Some(base.to_string());
    candidate.target_oid = None;
    if index.has_conflicts() {
        let entry = |item: Option<git2::IndexEntry>| {
            item.map(|item| ConflictEntry {
                path: item.path,
                oid: item.id.to_string(),
                mode: item.mode,
            })
        };
        for conflict in index.conflicts().map_err(error)? {
            let conflict = conflict.map_err(error)?;
            if candidate.conflicts.len() >= 10000 {
                return Err("Merge exceeds 10000 conflicting paths".into());
            }
            candidate.conflicts.push(MergeConflict {
                ancestor: entry(conflict.ancestor),
                ours: entry(conflict.our),
                theirs: entry(conflict.their),
            });
        }
    } else {
        if input.author_name.trim().is_empty()
            || input.author_name.len() > 1000
            || input.author_email.trim().is_empty()
            || input.author_email.len() > 1000
            || input.message.trim().is_empty()
            || input.message.len() > 10000
            || [&input.author_name, &input.author_email, &input.message]
                .iter()
                .any(|s| s.contains('\0'))
        {
            return Err("Enter a bounded merge author and message".into());
        }
        let signature =
            git2::Signature::now(&input.author_name, &input.author_email).map_err(error)?;
        let tree_id = index.write_tree_to(repo).map_err(error)?;
        let tree = repo.find_tree(tree_id).map_err(error)?;
        // None: create an unreferenced candidate only. Cancel never moves HEAD.
        let target = repo
            .commit(
                None,
                &signature,
                &signature,
                &input.message,
                &tree,
                &[&ours, &theirs],
            )
            .map_err(error)?;
        git_journal::validate_commit(repo, target, &input.workspace_id)?;
        candidate.target_oid = Some(target.to_string());
    }
    check_head(repo, &branch, old)?;
    Ok(candidate)
}

#[tauri::command]
pub async fn git_repository_prepare_merge(
    app: tauri::AppHandle,
    state: tauri::State<'_, git::GitState>,
    input: MergeInput,
) -> Result<MergeCandidate, String> {
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let lock = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock.lock().map_err(|e| e.to_string())?;
        storage::ensure_no_pending_transition(&directory)?;
        let path = git::managed_path(&directory.join("git-v1"), &input.repository_id)?;
        prepare(&git::open_managed(&path)?, &input)
    })
    .await
    .map_err(|e| e.to_string())?
}
