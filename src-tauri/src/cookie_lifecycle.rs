//! Called only under cookies::COOKIE_JARS. No jar-inner or storage lock here.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    io::Read,
    path::{Path, PathBuf},
};

type Owners = BTreeMap<String, String>;
const FILE: &str = "cookie-lifecycle-v1.json";
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Pending {
    before: Option<String>,
    after: String,
    owners: Owners,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct State {
    version: u8,
    pub(super) owners: Owners,
    pending: Option<Pending>,
}
pub(super) fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 200
        && id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
}
fn collections(data: &Value) -> impl Iterator<Item = &str> {
    data["resources"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|row| row["_type"] == "workspace")
        .filter_map(|row| row["_id"].as_str())
        .filter(|id| valid_id(id))
}
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn hash_matches(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}
fn valid_owners(owners: &Owners) -> bool {
    owners.iter().all(|(id, epoch)| {
        valid_id(id)
            && (epoch.is_empty()
                || uuid::Uuid::parse_str(epoch).is_ok_and(|value| value.to_string() == *epoch))
    })
}
fn save(root: &Path, state: &State) -> Result<(), String> {
    crate::storage::atomic_write(
        &root.join(FILE),
        &serde_json::to_vec(state).map_err(|e| e.to_string())?,
    )
}
pub(super) fn load(root: &Path, primary: Option<&[u8]>) -> Result<State, String> {
    let path = root.join(FILE);
    let mut state: State = match fs::symlink_metadata(&path) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            let data = primary.and_then(|bytes| crate::storage::decoded_workspace(bytes).ok());
            State {
                version: 1,
                owners: data
                    .as_ref()
                    .into_iter()
                    .flat_map(collections)
                    .map(|id| (id.to_owned(), String::new()))
                    .collect(),
                pending: None,
            }
        }
        Err(e) => return Err(e.to_string()),
        Ok(info) => {
            if !info.file_type().is_file() {
                return Err(
                    "Cookie lifecycle requires an ordinary file; original retained.".into(),
                );
            }
            let mut bytes = Vec::new();
            fs::File::open(&path)
                .map_err(|e| e.to_string())?
                .take(64 * 1024 * 1024 + 1)
                .read_to_end(&mut bytes)
                .map_err(|e| e.to_string())?;
            if bytes.len() > 64 * 1024 * 1024 {
                return Err("Cookie lifecycle exceeds 64 MiB; original retained.".into());
            }
            serde_json::from_slice(&bytes)
                .map_err(|e| format!("Invalid cookie lifecycle: {e}. Original retained."))?
        }
    };
    if state.version != 1
        || !valid_owners(&state.owners)
        || state.pending.as_ref().is_some_and(|p| {
            !valid_owners(&p.owners)
                || !hash_matches(&p.after)
                || p.before.as_ref().is_some_and(|v| !hash_matches(v))
        })
    {
        return Err("Invalid cookie lifecycle identity; original retained.".into());
    }
    if let Some(pending) = state.pending.take() {
        let current = primary.map(hash);
        if current.as_ref() == Some(&pending.after) {
            state.owners = pending.owners;
        } else if current != pending.before {
            return Err(
                "Cookie publication is unconfirmed. Retain lifecycle recovery material.".into(),
            );
        }
        save(root, &state)?;
    }
    Ok(state)
}
pub(super) fn path(root: &Path, id: &str, epoch: &str) -> PathBuf {
    root.join("cookies").join(if epoch.is_empty() {
        format!("{id}.json")
    } else {
        format!("{id}.{epoch}.json")
    })
}
pub(super) fn admit(root: &Path, id: &str) -> Result<(PathBuf, String), String> {
    let primary = crate::storage::primary_bytes(root)?;
    let data = crate::storage::decoded_workspace(
        primary
            .as_deref()
            .ok_or("Save the collection before using its cookies.")?,
    )?;
    if !collections(&data).any(|owner| owner == id) {
        return Err("Cookie collection no longer exists in saved storage.".into());
    }
    let state = load(root, primary.as_deref())?;
    let epoch = state.owners.get(id).ok_or(
        "Cookie collection identity is unconfirmed. Save the workspace before continuing.",
    )?;
    // Persist first-use legacy admission before any later publication can rotate it.
    if matches!(fs::symlink_metadata(root.join(FILE)), Err(e) if e.kind() == std::io::ErrorKind::NotFound)
    {
        save(root, &state)?;
    }
    Ok((path(root, id, epoch), format!("{id}:{epoch}")))
}
pub(super) fn publish(
    root: &Path,
    data: &Value,
    bytes: &[u8],
    write: impl FnOnce() -> Result<(), String>,
) -> Result<State, String> {
    let primary = crate::storage::primary_bytes(root)?;
    let mut state = load(root, primary.as_deref())?;
    let before = primary
        .as_deref()
        .and_then(|raw| crate::storage::decoded_workspace(raw).ok());
    let before_ids: std::collections::HashSet<_> =
        before.as_ref().into_iter().flat_map(collections).collect();
    let owners: Owners = collections(data)
        .map(|id| {
            let epoch = state
                .owners
                .get(id)
                .filter(|_| before_ids.contains(id))
                .cloned()
                .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
            (id.to_owned(), epoch)
        })
        .collect();
    if owners == state.owners {
        write()?;
        return Ok(state);
    }
    state.pending = Some(Pending {
        before: primary.as_deref().map(hash),
        after: hash(bytes),
        owners,
    });
    save(root, &state)?;
    let result = write();
    // Resolve from actual published bytes, including an ambiguous commit error.
    let observed = crate::storage::primary_bytes(root)?;
    let resolved = load(root, observed.as_deref())?;
    result?;
    Ok(resolved)
}
