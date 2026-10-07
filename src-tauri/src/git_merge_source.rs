//! Admission for reviewed incoming revisions. Recovery follows durable journal
//! OIDs, never a later mutable branch or fetch pointer.
use crate::{git, git_fetch_snapshot};
use git2::{Oid, Repository};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum MergeSource {
    #[serde(rename_all = "camelCase")]
    LocalBranch {
        branch: String,
        expected_oid: String,
    },
    #[serde(rename_all = "camelCase")]
    FetchSnapshot {
        url: String,
        snapshot_oid: String,
        branch: String,
        expected_binding: Value,
    },
}

fn oid(value: &str) -> Result<Oid, String> {
    if value.len() != 40 || !value.bytes().all(|c| c.is_ascii_hexdigit()) {
        return Err("Expected a full incoming source revision".into());
    }
    Oid::from_str(value).map_err(|e| e.message().to_owned())
}

impl MergeSource {
    pub(crate) fn check(
        &self,
        repo: &Repository,
        data: &Value,
        repository_id: &str,
        workspace_id: &str,
        incoming: &str,
    ) -> Result<(), String> {
        let incoming = oid(incoming)?;
        match self {
            Self::LocalBranch {
                branch,
                expected_oid,
            } => {
                let reference = git::branch_reference(branch)?;
                if oid(expected_oid)? != incoming
                    || repo
                        .find_reference(&reference)
                        .map_err(|e| e.message().to_owned())?
                        .target()
                        != Some(incoming)
                {
                    return Err("Reviewed incoming branch changed; review merge again".into());
                }
            }
            Self::FetchSnapshot {
                url,
                snapshot_oid,
                branch,
                expected_binding,
            } => {
                git::branch_reference(branch)?;
                let records = data["resources"]
                    .as_array()
                    .ok_or("Missing saved merge resources")?;
                let bindings: Vec<_> = records
                    .iter()
                    .filter(|r| r["_type"] == "git_repository" && r["parentId"] == workspace_id)
                    .collect();
                if bindings.len() != 1
                    || bindings[0] != expected_binding
                    || expected_binding["nativeBindingVersion"] != 1
                    || expected_binding["nativeRepositoryId"] != repository_id
                    || expected_binding["uri"] != url.as_str()
                    || records
                        .iter()
                        .filter(|r| {
                            r["_type"] == "git_repository"
                                && r["nativeRepositoryId"] == repository_id
                        })
                        .count()
                        != 1
                    || ["nativeFetchIntent", "nativeCreateIntent"]
                        .iter()
                        .any(|key| expected_binding.get(*key).is_some_and(|v| !v.is_null()))
                {
                    return Err("Reviewed endpoint or saved Git binding changed".into());
                }
                let snapshot = git_fetch_snapshot::read_snapshot(repo, url)?
                    .ok_or("Reviewed fetch snapshot is missing")?;
                if oid(snapshot_oid)? != oid(&snapshot.oid)?
                    || snapshot.manifest.branch_oid(branch).map(oid).transpose()? != Some(incoming)
                {
                    return Err("Reviewed fetch snapshot or incoming branch changed".into());
                }
            }
        }
        Ok(())
    }
}
