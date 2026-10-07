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
    #[serde(default)]
    expected_merge_base_oid: Option<String>,
    #[serde(default)]
    expected_merge_base_oids: Option<Vec<String>>,
    #[serde(default)]
    resolutions: Option<Vec<crate::git_merge_resolution::Resolution>>,
    #[serde(default)]
    source: Option<crate::git_merge_source::MergeSource>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeCandidate {
    source_oid: String,
    incoming_oid: String,
    kind: &'static str,
    merge_base_oid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    merge_base_oids: Option<Vec<String>>,
    target_oid: Option<String>,
    conflicts: Vec<MergeConflict>,
    conflict_contents: Vec<crate::git_merge_preview::ConflictContent>,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct MergeConflict {
    pub(crate) ancestor: Option<ConflictEntry>,
    pub(crate) ours: Option<ConflictEntry>,
    pub(crate) theirs: Option<ConflictEntry>,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct ConflictEntry {
    // Git paths are bytes. Never collapse non-UTF8 paths or rename sides.
    pub(crate) path: Vec<u8>,
    pub(crate) oid: String,
    pub(crate) mode: u32,
}

pub(crate) fn describe_conflict(value: &git2::IndexConflict) -> MergeConflict {
    let entry = |item: &Option<git2::IndexEntry>| {
        item.as_ref().map(|item| ConflictEntry {
            path: item.path.clone(),
            oid: item.id.to_string(),
            mode: item.mode,
        })
    };
    MergeConflict {
        ancestor: entry(&value.ancestor),
        ours: entry(&value.our),
        theirs: entry(&value.their),
    }
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
        merge_base_oids: None,
        target_oid: Some(old.to_string()),
        conflicts: Vec::new(),
        conflict_contents: Vec::new(),
    };
    if old == incoming {
        if input.resolutions.is_some() {
            return Err("No divergent merge conflicts to resolve".into());
        }
        check_head(repo, &branch, old)?;
        return Ok(candidate);
    }
    // Only the selected histories govern graph classification. A retained
    // snapshot for another endpoint may still have a valid unrelated cut.
    // Honor declared cuts even when parent objects happen to exist; Fetch owns
    // expanding/reconciling shallow metadata, never merge preparation.
    if repo.is_shallow() {
        let boundaries = crate::git_remote::read_shallow_boundaries(repo.path())?;
        for tip in [old, incoming] {
            let history = crate::git_remote::history_view_while(repo, tip, &boundaries, || Ok(()))?;
            if !history.shallow_boundaries.is_empty() {
                return Err("Expand fetched history before classifying this merge".into());
            }
        }
    }
    if repo.graph_descendant_of(old, incoming).map_err(error)? {
        if input.resolutions.is_some() {
            return Err("No divergent merge conflicts to resolve".into());
        }
        check_head(repo, &branch, old)?;
        return Ok(candidate);
    }
    if repo.graph_descendant_of(incoming, old).map_err(error)? {
        if input.resolutions.is_some() {
            return Err("No divergent merge conflicts to resolve".into());
        }
        candidate.kind = "fastForward";
        candidate.merge_base_oid = Some(old.to_string());
        candidate.target_oid = Some(incoming.to_string());
        check_head(repo, &branch, old)?;
        return Ok(candidate);
    }
    let bases = crate::git_journal::merge_bases(repo, old, incoming)?;
    let multiple = bases.len() > 1;
    let base_ids: Vec<String> = bases.iter().map(ToString::to_string).collect();
    if input.resolutions.is_some() {
        let exact = if multiple {
            input.expected_merge_base_oid.is_none()
                && input.expected_merge_base_oids.as_ref() == Some(&base_ids)
        } else {
            input.expected_merge_base_oids.is_none()
                && input
                    .expected_merge_base_oid
                    .as_deref()
                    .map(oid)
                    .transpose()?
                    == Some(bases[0])
        };
        if !exact {
            return Err("Conflict resolution requires the exact reviewed merge base".into());
        }
    }
    for base in &bases {
        git_journal::validate_commit(repo, *base, &input.workspace_id)?;
    }
    let ours = repo.find_commit(old).map_err(error)?;
    let theirs = repo.find_commit(incoming).map_err(error)?;
    let mut index = if multiple {
        // Default recursive behavior consolidates ALL actual common ancestors,
        // including conflicts in the virtual base. Do not set a recursion limit:
        // libgit2 falls back to selecting one ancestor when that limit is hit.
        repo.merge_commits(&ours, &theirs, None).map_err(error)?
    } else {
        let ancestor = repo.find_commit(bases[0]).map_err(error)?;
        repo.merge_trees(
            &ancestor.tree().map_err(error)?,
            &ours.tree().map_err(error)?,
            &theirs.tree().map_err(error)?,
            None,
        )
        .map_err(error)?
    };
    candidate.kind = "merge";
    if multiple {
        candidate.merge_base_oids = Some(base_ids);
    } else {
        candidate.merge_base_oid = Some(bases[0].to_string());
    }
    candidate.target_oid = None;
    if let Some(resolutions) = &input.resolutions {
        index = crate::git_merge_resolution::resolve(repo, &index, resolutions)?;
    }
    if index.has_conflicts() {
        for conflict in index.conflicts().map_err(error)? {
            let conflict = conflict.map_err(error)?;
            if candidate.conflicts.len() >= 10000 {
                return Err("Merge exceeds 10000 conflicting paths".into());
            }
            candidate.conflicts.push(describe_conflict(&conflict));
        }
        candidate.conflict_contents = crate::git_merge_preview::read(repo, &candidate.conflicts)?;
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
        let repo = git::open_managed(&path)?;
        let check = || -> Result<(), String> {
            if let Some(source) = &input.source {
                let data = storage::read_workspace_file(&directory)?
                    .ok_or("Missing saved merge workspace")?;
                source.check(
                    &repo,
                    &data,
                    &input.repository_id,
                    &input.workspace_id,
                    &input.incoming_oid,
                )?;
            }
            Ok(())
        };
        check()?;
        let candidate = prepare(&repo, &input)?;
        check()?;
        Ok(candidate)
    })
    .await
    .map_err(|e| e.to_string())?
}
