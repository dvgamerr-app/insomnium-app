//! Rebuild a reviewed merge in a fresh in-memory index. Never alter the disk
//! index or silently replace an unconflicted path while applying choices.
use crate::git_merge::{describe_conflict, MergeConflict};
use git2::{Index, IndexEntry, Repository, Tree};
use serde::Deserialize;
use std::collections::{BTreeSet, HashMap};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Resolution {
    conflict: MergeConflict,
    choice: Choice,
    #[serde(default)]
    path: Option<Vec<u8>>,
    #[serde(default)]
    content: Option<Vec<u8>>,
    #[serde(default)]
    mode: Option<u32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
enum Choice {
    Ours,
    Theirs,
    Delete,
    Custom,
}

fn error(value: git2::Error) -> String {
    value.message().to_owned()
}

fn key(conflict: &MergeConflict) -> Result<String, String> {
    for entry in [&conflict.ancestor, &conflict.ours, &conflict.theirs]
        .into_iter()
        .flatten()
    {
        if entry.path.is_empty()
            || entry.path.len() > 4096
            || entry.oid.len() != 40
            || !entry.oid.bytes().all(|c| c.is_ascii_hexdigit())
        {
            return Err("Invalid reviewed merge conflict".into());
        }
    }
    serde_json::to_string(conflict).map_err(|e| e.to_string())
}

/// libgit2 can leave a directory child at stage0 beside a conflicted parent
/// file. Expose every structurally colliding path to review instead of silently
/// deleting that child or making the file side impossible to choose.
pub(crate) fn expose_path_collisions(
    repo: &Repository,
    merged: &Index,
    ours: &Tree<'_>,
    theirs: &Tree<'_>,
    ancestor: Option<&Tree<'_>>,
) -> Result<Index, String> {
    let paths: BTreeSet<_> = merged
        .iter()
        .filter(|entry| entry.flags & 0x3000 != 0)
        .map(|entry| entry.path)
        .collect();
    let mut result = Index::new().map_err(error)?;
    for (position, entry) in merged.iter().enumerate() {
        let path = &entry.path;
        let mut prefix = path.clone();
        prefix.push(b'/');
        let collision = entry.flags & 0x3000 == 0
            && (paths.contains(path)
                || path
                    .iter()
                    .enumerate()
                    .any(|(offset, byte)| *byte == b'/' && paths.contains(&path[..offset]))
                || paths
                    .range(prefix.clone()..)
                    .next()
                    .is_some_and(|candidate| candidate.starts_with(&prefix)));
        if !collision {
            result.add(&entry).map_err(error)?;
            continue;
        }
        let mut exposed = false;
        for (stage, tree) in [(1, ancestor), (2, Some(ours)), (3, Some(theirs))] {
            let Some(tree) = tree else {
                continue;
            };
            let Some((id, mode)) = file_at(repo, tree, path)? else {
                continue;
            };
            let mut side = merged
                .get(position)
                .ok_or("Merge index entry disappeared")?;
            side.id = id;
            side.mode = mode;
            side.flags = (side.flags & !0x3000) | (stage << 12);
            side.flags_extended = 0;
            result.add(&side).map_err(error)?;
            exposed = true;
        }
        if !exposed {
            return Err("Colliding merge path has no pinned file side".into());
        }
    }
    Ok(result)
}

fn file_at(
    repo: &Repository,
    tree: &Tree<'_>,
    path: &[u8],
) -> Result<Option<(git2::Oid, u32)>, String> {
    let mut current = repo.find_tree(tree.id()).map_err(error)?;
    let mut parts = path.split(|byte| *byte == b'/').peekable();
    while let Some(part) = parts.next() {
        let Some(entry) = current.get_name_bytes(part) else {
            return Ok(None);
        };
        let id = entry.id();
        let mode = entry.filemode() as u32;
        if parts.peek().is_none() {
            return Ok((mode != 0o040000).then_some((id, mode)));
        }
        if mode != 0o040000 {
            return Ok(None);
        }
        drop(entry);
        current = repo.find_tree(id).map_err(error)?;
    }
    Ok(None)
}

pub(crate) fn resolve(
    repo: &Repository,
    merged: &Index,
    resolutions: &[Resolution],
) -> Result<Index, String> {
    if resolutions.is_empty() || resolutions.len() > 10000 || !merged.has_conflicts() {
        return Err("Resolve every current merge conflict exactly once".into());
    }
    let mut choices = HashMap::new();
    let mut total = 0usize;
    for resolution in resolutions {
        if let Some(content) = &resolution.content {
            if content.len() > 20 * 1024 * 1024 {
                return Err("Custom merge content exceeds 20 MiB".into());
            }
            total += content.len();
            if total > 100 * 1024 * 1024 {
                return Err("Custom merge content exceeds 100 MiB".into());
            }
        }
        if choices
            .insert(key(&resolution.conflict)?, resolution)
            .is_some()
        {
            return Err("Duplicate reviewed merge conflict".into());
        }
    }
    let mut entries: Vec<(IndexEntry, Option<&[u8]>)> = merged
        .iter()
        .filter(|entry| entry.flags & 0x3000 == 0)
        .map(|entry| (entry, None))
        .collect();
    for conflict in merged.conflicts().map_err(error)? {
        let conflict = conflict.map_err(error)?;
        let resolution = choices
            .remove(&key(&describe_conflict(&conflict))?)
            .ok_or("Reviewed merge conflicts changed or a choice is missing")?;
        let mut selected = match resolution.choice {
            Choice::Ours => conflict.our,
            Choice::Theirs => conflict.their,
            Choice::Delete => None,
            Choice::Custom => {
                let path = resolution
                    .path
                    .as_ref()
                    .ok_or("Custom resolution needs a reviewed path")?;
                let mut entry = [conflict.ancestor, conflict.our, conflict.their]
                    .into_iter()
                    .flatten()
                    .find(|entry| &entry.path == path)
                    .ok_or("Custom path is outside the reviewed conflict")?;
                entry.mode = resolution
                    .mode
                    .filter(|mode| matches!(mode, 0o100644 | 0o100755))
                    .ok_or("Custom resolution must be a regular file")?;
                if resolution.content.is_none() {
                    return Err("Custom resolution needs content".into());
                }
                Some(entry)
            }
        };
        if !matches!(resolution.choice, Choice::Custom)
            && (resolution.path.is_some()
                || resolution.content.is_some()
                || resolution.mode.is_some())
        {
            return Err("Side/delete resolution must not contain custom fields".into());
        }
        if let Some(mut entry) = selected.take() {
            // Convert reviewed stage1/2/3 to ordinary stage0.
            entry.flags &= !0x3000;
            entry.flags_extended = 0;
            entries.push((entry, resolution.content.as_deref()));
        }
    }
    if !choices.is_empty() {
        return Err("Resolution contains an unknown merge conflict".into());
    }
    let mut paths = BTreeSet::new();
    for (entry, _) in &entries {
        if !paths.insert(entry.path.clone()) {
            return Err("Resolved merge paths collide".into());
        }
    }
    for path in &paths {
        for (offset, byte) in path.iter().enumerate() {
            if *byte == b'/' && paths.contains(&path[..offset]) {
                return Err("Resolved merge has a file/directory path collision".into());
            }
        }
    }
    // All choices and collisions checked before creating custom blobs.
    let mut result = Index::new().map_err(error)?;
    for (mut entry, content) in entries {
        if let Some(content) = content {
            entry.id = repo.blob(content).map_err(error)?;
            entry.file_size = content.len() as u32;
        }
        result.add(&entry).map_err(error)?;
    }
    Ok(result)
}
