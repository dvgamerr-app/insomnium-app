//! Bounded display data read exclusively from immutable reviewed conflict OIDs.
use crate::git_merge::MergeConflict;
use git2::{ObjectType, Oid, Repository};
use serde::Serialize;
use std::collections::BTreeMap;

const FILE_LIMIT: usize = 256 * 1024;
const TOTAL_LIMIT: usize = 2 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictContent {
    oid: String,
    size: Option<usize>,
    kind: &'static str,
    text: Option<String>,
    preview_hex: Option<String>,
}

pub(crate) fn read(
    repo: &Repository,
    conflicts: &[MergeConflict],
) -> Result<Vec<ConflictContent>, String> {
    let mut objects = BTreeMap::new();
    for conflict in conflicts {
        for entry in [&conflict.ancestor, &conflict.ours, &conflict.theirs]
            .into_iter()
            .flatten()
        {
            let id = Oid::from_str(&entry.oid).map_err(|e| e.to_string())?;
            let gitlink = entry.mode == 0o160000;
            if let Some(previous) = objects.insert(id, gitlink) {
                if previous != gitlink {
                    return Err("Conflicting Git object modes in review".into());
                }
            }
        }
    }
    let odb = repo.odb().map_err(|e| e.to_string())?;
    let mut remaining = TOTAL_LIMIT;
    let mut result = Vec::with_capacity(objects.len());
    for (id, gitlink) in objects {
        let mut item = ConflictContent {
            oid: id.to_string(),
            size: None,
            kind: "gitlink",
            text: None,
            preview_hex: None,
        };
        // Gitlinks may reference commits absent from this repository.
        if !gitlink {
            let (size, object_type) = odb.read_header(id).map_err(|e| e.to_string())?;
            if object_type != ObjectType::Blob {
                return Err("Reviewed file does not reference a Git blob".into());
            }
            item.size = Some(size);
            if size > FILE_LIMIT {
                item.kind = "tooLarge";
            } else if size > remaining {
                item.kind = "budgetExceeded";
            } else {
                remaining -= size;
                let blob = repo.find_blob(id).map_err(|e| e.to_string())?;
                if blob.size() != size {
                    return Err("Reviewed blob size changed".into());
                }
                match std::str::from_utf8(blob.content()) {
                    Ok(text) if !blob.is_binary() && !text.contains('\0') => {
                        item.kind = "text";
                        item.text = Some(text.to_owned());
                    }
                    _ => {
                        item.kind = "binary";
                        item.preview_hex = Some(
                            blob.content()
                                .iter()
                                .take(128)
                                .map(|byte| format!("{byte:02x}"))
                                .collect(),
                        );
                    }
                }
            }
        }
        result.push(item);
    }
    Ok(result)
}
