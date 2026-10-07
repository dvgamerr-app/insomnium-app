//! Internal fetch snapshots. No local branch, HEAD or workspace mutation.
use crate::git_remote::{AdvertisedBranch, RemoteAdvertisement};
use crate::git_remote_job::{ObjectImportReceipt, WorkerOutput};
use git2::{Oid, Repository};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SnapshotManifest {
    version: u32,
    pub(crate) endpoint_key: String,
    pub(crate) operation_id: String,
    branches: Vec<AdvertisedBranch>,
    default_branch: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    selected_branch: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    requested_depth: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    histories: Option<Vec<BranchHistory>>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BranchHistory {
    name: String,
    depth: Option<u32>,
    boundaries: Vec<String>,
}

impl SnapshotManifest {
    pub(crate) fn branch_oid(&self, name: &str) -> Option<&str> {
        self.branches
            .iter()
            .find(|branch| branch.name == name)
            .map(|branch| branch.oid.as_str())
    }
    #[allow(
        dead_code,
        reason = "Scope-only helper retained for legacy migration compatibility fixtures."
    )]
    pub(crate) fn matches_operation(&self, operation_id: &str, branch: Option<&str>) -> bool {
        self.matches_history_operation(operation_id, branch, None)
    }

    pub(crate) fn matches_history_operation(
        &self,
        operation_id: &str,
        branch: Option<&str>,
        depth: Option<u32>,
    ) -> bool {
        self.operation_id == operation_id
            && self.selected_branch.as_deref() == branch
            && self.requested_depth == depth
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FetchSnapshot {
    pub(crate) oid: String,
    pub(crate) manifest: SnapshotManifest,
}
fn git_error(_: git2::Error) -> String {
    "Cannot read or publish Git fetch snapshot.".into()
}
pub(crate) fn endpoint_key(url: &str) -> Result<String, String> {
    let url = crate::git_remote::endpoint(url)?;
    Ok(format!("{:x}", Sha256::digest(url.as_str().as_bytes())))
}
fn reference(key: &str) -> String {
    format!("refs/insomnium-fetch/{key}/current")
}
fn direct_tip(repo: &Repository, reference: &str) -> Result<Option<Oid>, String> {
    match repo.find_reference(reference) {
        Ok(value) => value
            .target()
            .map(Some)
            .ok_or("Fetch snapshot reference must be direct.".into()),
        Err(error) if error.code() == git2::ErrorCode::NotFound => Ok(None),
        Err(error) => Err(git_error(error)),
    }
}
fn manifest_tips(manifest: &SnapshotManifest) -> Result<Vec<Oid>, String> {
    let valid_scope = match (manifest.version, &manifest.selected_branch) {
        (1 | 3, None) => true,
        (2 | 3, Some(name)) => {
            let reference = format!("refs/heads/{name}");
            reference.len() <= 4096
                && git2::Reference::is_valid_name(&reference)
                && manifest.branches.iter().any(|branch| &branch.name == name)
        }
        _ => false,
    };
    if !valid_scope
        || manifest.branches.len() > 10000
        || uuid::Uuid::parse_str(&manifest.operation_id)
            .map(|id| id.to_string())
            .ok()
            .as_deref()
            != Some(manifest.operation_id.as_str())
    {
        return Err("Invalid Git fetch snapshot manifest.".into());
    }
    let mut names = std::collections::HashSet::new();
    let mut tips = std::collections::BTreeSet::new();
    for branch in &manifest.branches {
        if branch.reference != format!("refs/heads/{}", branch.name)
            || branch.reference.len() > 4096
            || !git2::Reference::is_valid_name(&branch.reference)
            || !names.insert(&branch.reference)
            || branch.oid.len() != 40
        {
            return Err("Invalid Git fetch snapshot branch.".into());
        }
        let oid = Oid::from_str(&branch.oid).map_err(git_error)?;
        if oid.is_zero() {
            return Err("Invalid Git fetch snapshot object ID.".into());
        }
        tips.insert(oid);
    }
    if let Some(name) = &manifest.default_branch {
        if !git2::Reference::is_valid_name(&format!("refs/heads/{name}")) {
            return Err("Invalid Git fetch default branch.".into());
        }
    }
    validate_history_metadata(manifest)?;
    Ok(tips.into_iter().collect())
}

fn valid_depth(depth: Option<u32>) -> bool {
    depth.is_none_or(|depth| depth > 0 && depth < i32::MAX as u32)
}

fn validate_history_metadata(manifest: &SnapshotManifest) -> Result<(), String> {
    if manifest.version != 3 {
        if manifest.requested_depth.is_some() || manifest.histories.is_some() {
            return Err("Legacy fetch snapshot cannot contain depth/history metadata.".into());
        }
        return Ok(());
    }
    let histories = manifest
        .histories
        .as_ref()
        .ok_or("Missing per-branch fetch histories.")?;
    if !valid_depth(manifest.requested_depth) || histories.len() != manifest.branches.len() {
        return Err("Invalid fetch history scope or depth.".into());
    }
    let names = manifest
        .branches
        .iter()
        .map(|b| b.name.as_str())
        .collect::<std::collections::HashSet<_>>();
    let mut seen = std::collections::HashSet::new();
    let mut entries = 0usize;
    for history in histories {
        entries = entries
            .checked_add(history.boundaries.len())
            .ok_or("Fetch history size overflow.")?;
        if !names.contains(history.name.as_str())
            || !seen.insert(history.name.as_str())
            || !valid_depth(history.depth)
            || (history.depth.is_none() && !history.boundaries.is_empty())
            || history.boundaries.len() > 10000
            || entries > 100000
            || history.boundaries.iter().any(|id| id.len() != 40)
            || history.boundaries.windows(2).any(|pair| pair[0] >= pair[1])
        {
            return Err("Invalid or excessive per-branch fetch history.".into());
        }
        crate::git_remote::parse_shallow_boundaries(history.boundaries.join("\n").as_bytes())?;
        let updated = manifest
            .selected_branch
            .as_ref()
            .is_none_or(|name| name == &history.name);
        if updated && history.depth != manifest.requested_depth {
            return Err("Updated branch history does not match the requested depth.".into());
        }
    }
    Ok(())
}

/// Validate requested history views, independently of physical repository cuts.
/// Metadata-only reads do not claim graph completeness. Publication/recovery must
/// invoke this before writing. Bound cumulative work across distinct histories.
pub(crate) fn validate_snapshot_histories(
    repo: &Repository,
    manifest: &SnapshotManifest,
    mut check: impl FnMut() -> Result<(), String>,
) -> Result<(), String> {
    let tips = manifest_tips(manifest)?;
    let Some(histories) = &manifest.histories else {
        crate::git_remote::validate_object_graph_while(repo, &tips, check)?;
        return Ok(());
    };
    let tips = manifest
        .branches
        .iter()
        .map(|b| (b.name.as_str(), b.oid.as_str()))
        .collect::<std::collections::HashMap<_, _>>();
    let mut groups = std::collections::HashSet::new();
    let mut count = 0usize;
    let mut bytes = 0u64;
    let odb = repo.odb().map_err(git_error)?;
    for history in histories {
        check()?;
        let tip = Oid::from_str(tips[history.name.as_str()]).map_err(git_error)?;
        if !groups.insert((tip, &history.boundaries)) {
            continue;
        }
        let boundaries =
            crate::git_remote::parse_shallow_boundaries(history.boundaries.join("\n").as_bytes())?;
        let objects = crate::git_remote::validate_object_graph_with_boundaries_while(
            repo,
            &[tip],
            &boundaries,
            &mut check,
        )?;
        count = count
            .checked_add(objects.len())
            .ok_or("Fetch history work overflow.")?;
        if count > 1_000_000 {
            return Err("Fetch histories exceed cumulative validation limit.".into());
        }
        for object in objects {
            check()?;
            bytes = bytes
                .checked_add(odb.read_header(object).map_err(git_error)?.0 as u64)
                .ok_or("Fetch history byte count overflow.")?;
            if bytes > 4 * 1024 * 1024 * 1024 {
                return Err("Fetch histories exceed cumulative validation size limit.".into());
            }
        }
    }
    check()
}

/// Reader resolves one pointer, then validates immutable manifest/parent identity.
pub(crate) fn read_snapshot(repo: &Repository, url: &str) -> Result<Option<FetchSnapshot>, String> {
    let key = endpoint_key(url)?;
    let Some(oid) = direct_tip(repo, &reference(&key))? else {
        return Ok(None);
    };
    read_snapshot_object(repo, &key, oid).map(Some)
}

/// Read an immutable candidate without publishing a ref (journal preparation).
pub(crate) fn read_snapshot_object(
    repo: &Repository,
    key: &str,
    oid: Oid,
) -> Result<FetchSnapshot, String> {
    if key.len() != 64
        || !key
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
    {
        return Err("Invalid fetch snapshot endpoint key.".into());
    }
    let commit = repo.find_commit(oid).map_err(git_error)?;
    let tree = commit.tree().map_err(git_error)?;
    if tree.len() != 1 {
        return Err("Invalid Git fetch snapshot tree.".into());
    }
    let entry = tree
        .get_name("snapshot.json")
        .ok_or("Missing Git fetch manifest.")?;
    if entry.filemode_raw() != 0o100644 {
        return Err("Invalid Git fetch manifest mode.".into());
    }
    let blob = repo.find_blob(entry.id()).map_err(git_error)?;
    if blob.size() > 32 * 1024 * 1024 {
        return Err("Git fetch manifest exceeds size limit.".into());
    }
    let manifest: SnapshotManifest =
        serde_json::from_slice(blob.content()).map_err(|_| "Invalid Git fetch manifest JSON.")?;
    if manifest.endpoint_key != key {
        return Err("Git fetch snapshot endpoint changed.".into());
    }
    let tips = manifest_tips(&manifest)?;
    if commit.parent_ids().collect::<Vec<_>>() != tips {
        return Err("Git fetch snapshot reachability does not match its branches.".into());
    }
    Ok(FetchSnapshot {
        oid: oid.to_string(),
        manifest,
    })
}

/// Caller must hold managed-repository/binding admission; network already ended.
/// On an uncertain ref write retain stage and inspect current snapshot, never
/// automatically publish a second snapshot or advance local HEAD.
#[allow(
    dead_code,
    reason = "Legacy publication retained for migration compatibility fixtures; production publishes journaled v3."
)]
pub(crate) fn publish_snapshot(
    repo: &Repository,
    output: &WorkerOutput,
    operation_id: &str,
    expected: Option<Oid>,
    cancelled: &AtomicBool,
) -> Result<FetchSnapshot, String> {
    let check_cancel = || {
        if cancelled.load(Ordering::SeqCst) {
            Err("Git fetch publication cancelled.".to_owned())
        } else {
            Ok(())
        }
    };
    check_cancel()?;
    // v1/v2 operation identity cannot represent depth, even if the remote graph
    // happens to be complete. Preserve that distinction until v3 integration.
    if output.requested_depth.is_some() {
        return Err("Depth-limited fetch requires a versioned history snapshot.".into());
    }
    let RemoteAdvertisement {
        url,
        branches,
        default_branch,
        ..
    } = &output.advertisement;
    let key = endpoint_key(url)?;
    let name = reference(&key);
    let current = read_snapshot(repo, url)?;
    if current
        .as_ref()
        .is_some_and(|snapshot| snapshot.manifest.version == 3)
    {
        return Err("History-aware fetch publication requires journal integration.".into());
    }
    let actual = current
        .as_ref()
        .map(|snapshot| Oid::from_str(&snapshot.oid).map_err(git_error))
        .transpose()?;
    if actual != expected {
        return Err("Git fetch snapshot changed; reload before fetching again.".into());
    }
    let mut merged = branches.clone();
    if let Some(selected) = &output.selected_branch {
        if branches.len() != 1 || &branches[0].name != selected {
            return Err("Fetched branches do not match the selected scope.".into());
        }
        if let Some(previous) = &current {
            merged.extend(
                previous
                    .manifest
                    .branches
                    .iter()
                    .filter(|branch| &branch.name != selected)
                    .cloned(),
            );
        }
        merged.sort_by(|a, b| a.name.cmp(&b.name));
    }
    let manifest = SnapshotManifest {
        version: if output.selected_branch.is_some() {
            2
        } else {
            1
        },
        endpoint_key: key,
        operation_id: operation_id.to_owned(),
        branches: merged,
        default_branch: default_branch.clone(),
        selected_branch: output.selected_branch.clone(),
        requested_depth: None,
        histories: None,
    };
    let tips = manifest_tips(&manifest)?;
    ObjectImportReceipt::try_from((output, repo, cancelled))?;
    // Retained tips are part of this new snapshot too, not just newly fetched objects.
    validate_snapshot_histories(repo, &manifest, check_cancel)?;
    let bytes = serde_json::to_vec(&manifest).map_err(|_| "Cannot encode Git fetch manifest.")?;
    if bytes.len() > 32 * 1024 * 1024 {
        return Err("Git fetch manifest exceeds size limit.".into());
    }
    let blob = repo.blob(&bytes).map_err(git_error)?;
    let mut builder = repo.treebuilder(None).map_err(git_error)?;
    builder
        .insert("snapshot.json", blob, 0o100644)
        .map_err(git_error)?;
    let tree = repo
        .find_tree(builder.write().map_err(git_error)?)
        .map_err(git_error)?;
    let parents = tips
        .iter()
        .map(|id| repo.find_commit(*id).map_err(git_error))
        .collect::<Result<Vec<_>, _>>()?;
    let parent_refs = parents.iter().collect::<Vec<_>>();
    let signature =
        git2::Signature::now("Insomnium fetch", "fetch@insomnium.invalid").map_err(git_error)?;
    // Unique manifest operation ID distinguishes retries without storing credentials/URL.
    let oid = repo
        .commit(
            None,
            &signature,
            &signature,
            if manifest.version == 1 {
                "Insomnium fetch snapshot v1"
            } else {
                "Insomnium fetch snapshot v2"
            },
            &tree,
            &parent_refs,
        )
        .map_err(git_error)?;
    check_cancel()?;
    let mut transaction = repo.transaction().map_err(git_error)?;
    transaction.lock_ref(&name).map_err(git_error)?;
    if direct_tip(repo, &name)? != expected {
        return Err("Git fetch snapshot changed before publication.".into());
    }
    check_cancel()?;
    transaction
        .set_target(&name, oid, Some(&signature), "Insomnium fetch snapshot")
        .map_err(git_error)?;
    // Exactly ONE ref update: never depend on multi-ref transaction atomicity.
    transaction.commit().map_err(|_| {
        "Git fetch publication outcome is uncertain; retain staging and inspect current snapshot."
    })?;
    // Cancellation after this boundary must not be reported as an uncommitted fetch.
    let observed = read_snapshot(repo, url)?.ok_or("Published Git fetch snapshot disappeared.")?;
    if observed.oid != oid.to_string() {
        return Err("Git fetch snapshot changed after publication; inspect current state.".into());
    }
    Ok(observed)
}

/// Private native preparation. The caller holds GitState and has validated the
/// destination as an owned repository. This writes only a candidate pack in the
/// leased stage; journal creation/import/ref/shallow transitions remain separate.
#[derive(Clone, Copy)]
pub(crate) struct CandidateInput<'a> {
    pub(crate) destination: &'a Repository,
    pub(crate) output: &'a WorkerOutput,
    pub(crate) operation_id: &'a str,
    pub(crate) expected: Option<Oid>,
    pub(crate) cancelled: &'a AtomicBool,
}

impl TryFrom<CandidateInput<'_>> for FetchSnapshot {
    type Error = String;

    fn try_from(input: CandidateInput<'_>) -> Result<Self, Self::Error> {
        use std::io::Write;
        let CandidateInput {
            destination,
            output,
            operation_id,
            expected,
            cancelled,
        } = input;
        let (manifest, source) = prepare_history_view(CandidateInput {
            destination,
            output,
            operation_id,
            expected,
            cancelled,
        })?;
        let check = || {
            if cancelled.load(Ordering::SeqCst) {
                Err("Fetch candidate preparation cancelled.".to_owned())
            } else {
                Ok(())
            }
        };
        let stage = output
            .stage
            .as_ref()
            .ok_or("Fetch candidate requires a staging lease.")?;
        let key = manifest.endpoint_key.clone();
        let tips = manifest_tips(&manifest)?;
        let destination_objects = destination.path().join("objects");
        let odb = source.odb().map_err(git_error)?;
        let bytes = serde_json::to_vec(&manifest).map_err(|_| "Cannot encode fetch candidate.")?;
        if bytes.len() > 32 * 1024 * 1024 {
            return Err("Fetch candidate manifest exceeds size limit.".into());
        }
        // All candidate writes go to mempack; both disk backends stay read-only.
        let memory = odb.add_new_mempack_backend(999).map_err(git_error)?;
        let blob = source.blob(&bytes).map_err(git_error)?;
        let mut builder = source.treebuilder(None).map_err(git_error)?;
        builder
            .insert("snapshot.json", blob, 0o100644)
            .map_err(git_error)?;
        let tree = source
            .find_tree(builder.write().map_err(git_error)?)
            .map_err(git_error)?;
        let parents = tips
            .iter()
            .map(|id| source.find_commit(*id).map_err(git_error))
            .collect::<Result<Vec<_>, _>>()?;
        let signature = git2::Signature::now("Insomnium fetch", "fetch@insomnium.invalid")
            .map_err(git_error)?;
        let oid = source
            .commit(
                None,
                &signature,
                &signature,
                "Insomnium fetch snapshot v3",
                &tree,
                &parents.iter().collect::<Vec<_>>(),
            )
            .map_err(git_error)?;
        check()?;
        let mut pack = git2::Buf::new();
        memory.dump(&source, &mut pack).map_err(git_error)?;
        if pack.len() > 64 * 1024 * 1024 {
            return Err("Fetch candidate pack exceeds size limit.".into());
        }
        let pack_dir = stage.repository_path()?.join("objects/pack");
        crate::git_remote::validate_stage_parent(&pack_dir.join("entry"))?;
        // The graph was validated with explicit shallow views above. Generic
        // connectivity verification would reject deliberately absent ancestors.
        let mut indexer = git2::Indexer::new(None, &pack_dir, 0, false).map_err(git_error)?;
        for chunk in pack.chunks(64 * 1024) {
            check()?;
            indexer
                .write_all(chunk)
                .map_err(|_| "Cannot write staged candidate pack.")?;
        }
        check()?;
        indexer.commit().map_err(git_error)?;
        // Fresh ODB proves the candidate is on disk, not only in mempack.
        let persisted = stage.object_repository(check)?;
        persisted
            .odb()
            .map_err(git_error)?
            .add_disk_alternate(
                destination_objects
                    .to_str()
                    .ok_or("Invalid destination object path.")?,
            )
            .map_err(git_error)?;
        let candidate = read_snapshot_object(&persisted, &key, oid)?;
        validate_snapshot_histories(&persisted, &candidate.manifest, check)?;
        if direct_tip(destination, &reference(&key))? != expected {
            return Err("Fetch snapshot changed while preparing candidate; retain staging.".into());
        }
        check()?;
        let plan = PublicationPlan::try_from(PublicationInput {
            candidate: Oid::from_str(&candidate.oid).map_err(git_error)?,
            history: CandidateInput {
                destination,
                output,
                operation_id,
                expected,
                cancelled,
            },
        })?;
        Ok(plan.snapshot)
    }
}

fn prepare_history_view(
    input: CandidateInput<'_>,
) -> Result<(SnapshotManifest, Repository), String> {
    let CandidateInput {
        destination,
        output,
        operation_id,
        expected,
        cancelled,
    } = input;
    let check = || {
        if cancelled.load(Ordering::SeqCst) {
            Err("Fetch candidate preparation cancelled.".to_owned())
        } else {
            Ok(())
        }
    };
    check()?;
    let key = endpoint_key(&output.advertisement.url)?;
    let current = read_snapshot(destination, &output.advertisement.url)?;
    if current
        .as_ref()
        .map(|s| Oid::from_str(&s.oid).map_err(git_error))
        .transpose()?
        != expected
    {
        return Err("Fetch snapshot changed before candidate preparation.".into());
    }
    let boundaries = output.verified_boundaries()?;
    let stage = output
        .stage
        .as_ref()
        .ok_or("Fetch candidate requires a staging lease.")?;
    if let Some(selected) = &output.selected_branch {
        if output.advertisement.branches.len() != 1
            || output.advertisement.branches[0].name != *selected
        {
            return Err("Candidate fetch branches do not match selected scope.".into());
        }
    }
    let mut manifest = SnapshotManifest {
        version: 3,
        endpoint_key: key.clone(),
        operation_id: operation_id.to_owned(),
        branches: output.advertisement.branches.clone(),
        default_branch: output.advertisement.default_branch.clone(),
        selected_branch: output.selected_branch.clone(),
        requested_depth: output.requested_depth,
        histories: Some(
            output
                .advertisement
                .branches
                .iter()
                .map(|b| BranchHistory {
                    name: b.name.clone(),
                    depth: output.requested_depth,
                    boundaries: Vec::new(),
                })
                .collect(),
        ),
    };
    // Validate names, duplicate tips, operation identity and depth before graph work.
    let fetched_tips = manifest_tips(&manifest)?;
    let source = stage.object_repository(check)?;
    crate::git_remote::validate_object_graph_with_boundaries_while(
        &source,
        &fetched_tips,
        &boundaries,
        check,
    )?;
    let mut views = std::collections::HashMap::<Oid, Vec<String>>::new();
    let mut visited = 0usize;
    for (branch, history) in manifest
        .branches
        .iter()
        .zip(manifest.histories.as_mut().unwrap())
    {
        check()?;
        let tip = Oid::from_str(&branch.oid).map_err(git_error)?;
        if let std::collections::hash_map::Entry::Vacant(entry) = views.entry(tip) {
            let view = crate::git_remote::history_view_while(&source, tip, &boundaries, check)?;
            visited = visited
                .checked_add(view.objects.len())
                .ok_or("Candidate validation overflow.")?;
            if visited > 1_000_000 {
                return Err("Candidate histories exceed cumulative validation limit.".into());
            }
            entry.insert(
                view.shallow_boundaries
                    .iter()
                    .map(ToString::to_string)
                    .collect(),
            );
        }
        history.boundaries = views[&tip].clone();
    }
    if let (Some(selected), Some(previous)) = (&output.selected_branch, current) {
        let previous = previous.manifest;
        let histories = previous.histories.unwrap_or_else(|| {
            previous
                .branches
                .iter()
                .map(|b| BranchHistory {
                    name: b.name.clone(),
                    depth: None,
                    boundaries: Vec::new(),
                })
                .collect()
        });
        manifest.branches.extend(
            previous
                .branches
                .into_iter()
                .filter(|b| b.name != *selected),
        );
        manifest
            .histories
            .as_mut()
            .unwrap()
            .extend(histories.into_iter().filter(|h| h.name != *selected));
    }
    manifest.branches.sort_by(|a, b| a.name.cmp(&b.name));
    manifest
        .histories
        .as_mut()
        .unwrap()
        .sort_by(|a, b| a.name.cmp(&b.name));
    manifest_tips(&manifest)?;
    let destination_objects = destination.path().join("objects");
    let odb = source.odb().map_err(git_error)?;
    // Read-only, in-memory alternate. No alternates file or managed ODB write.
    odb.add_disk_alternate(
        destination_objects
            .to_str()
            .ok_or("Invalid destination object path.")?,
    )
    .map_err(git_error)?;
    validate_snapshot_histories(&source, &manifest, check)?;
    drop(odb);
    Ok((manifest, source))
}

/// Native-only plan for a new publication, not a journal or authorization to
/// write. Caller holds GitState and retains the WorkerOutput staging lease.
#[derive(Clone, Copy)]
pub(crate) struct PublicationInput<'a> {
    pub(crate) candidate: Oid,
    pub(crate) history: CandidateInput<'a>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PublicationPlan {
    pub(crate) snapshot: FetchSnapshot,
    pub(crate) expected_snapshot: Option<String>,
    pub(crate) objects: Vec<String>,
    pub(crate) old_shallow: Option<String>,
    pub(crate) prepared_shallow: String,
    pub(crate) final_shallow: String,
}

impl TryFrom<PublicationInput<'_>> for PublicationPlan {
    type Error = String;
    fn try_from(input: PublicationInput<'_>) -> Result<Self, String> {
        use crate::git_fetch_journal::RetainedRoots;
        use crate::git_remote::{ObjectGraphPlan, RepositoryGraphInput};
        use std::collections::BTreeSet;
        let PublicationInput { candidate, history } = input;
        let destination = history.destination;
        let cancelled = history.cancelled;
        let expected = history.expected;
        let output = history.output;
        let check = || {
            if cancelled.load(Ordering::SeqCst) {
                Err("Fetch publication planning cancelled.".to_owned())
            } else {
                Ok(())
            }
        };
        check()?;
        crate::git_fetch_journal::ensure_ready(destination)?;
        let retained = RetainedRoots::try_from((destination, cancelled))?;
        // Validate the old repository independently. New objects must not mask
        // preexisting unauthorized missing ancestry or corrupt retained content.
        ObjectGraphPlan::try_from((destination, cancelled))?;
        let (manifest, combined) = prepare_history_view(history)?;
        let snapshot = read_snapshot_object(&combined, &manifest.endpoint_key, candidate)?;
        if snapshot.manifest.version != 3
            || serde_json::to_vec(&snapshot.manifest)
                .map_err(|_| "Cannot encode candidate metadata.")?
                != serde_json::to_vec(&manifest)
                    .map_err(|_| "Cannot encode expected candidate metadata.")?
            || expected == Some(candidate)
        {
            return Err("Staged candidate does not match the verified fetch operation.".into());
        }
        let mut boundaries = retained.boundaries.iter().copied().collect::<BTreeSet<_>>();
        boundaries.extend(output.verified_boundaries()?);
        let boundaries = boundaries.into_iter().collect::<Vec<_>>();
        let mut roots = retained.objects.iter().copied().collect::<BTreeSet<_>>();
        roots.insert(candidate);
        let roots = roots.into_iter().collect::<Vec<_>>();
        let graph = ObjectGraphPlan::try_from(RepositoryGraphInput {
            repository: &combined,
            roots: &roots,
            boundaries: &boundaries,
            cancelled,
        })?;
        let encode =
            |ids: &BTreeSet<Oid>| -> String { ids.iter().map(|id| format!("{id}\n")).collect() };
        let final_cuts = graph
            .shallow_boundaries
            .iter()
            .copied()
            .collect::<BTreeSet<_>>();
        let mut prepared = retained.boundaries.iter().copied().collect::<BTreeSet<_>>();
        prepared.extend(final_cuts.iter().copied());
        let prepared_shallow = encode(&prepared);
        let final_shallow = encode(&final_cuts);
        // Enforce the same representation/limits the journal parser accepts.
        crate::git_remote::parse_shallow_boundaries(prepared_shallow.as_bytes())?;
        crate::git_remote::parse_shallow_boundaries(final_shallow.as_bytes())?;
        if retained != RetainedRoots::try_from((destination, cancelled))?
            || direct_tip(destination, &reference(&manifest.endpoint_key))? != expected
        {
            return Err("Repository changed while planning fetch publication.".into());
        }
        output
            .stage
            .as_ref()
            .ok_or("Fetch publication requires staging.")?
            .repository_path()?;
        crate::git_fetch_journal::ensure_ready(destination)?;
        check()?;
        let mut objects = graph
            .objects
            .iter()
            .map(ToString::to_string)
            .collect::<Vec<_>>();
        objects.sort();
        Ok(Self {
            snapshot,
            expected_snapshot: expected.map(|id| id.to_string()),
            objects,
            old_shallow: retained
                .old_shallow
                .map(String::from_utf8)
                .transpose()
                .map_err(|_| "Invalid old shallow metadata encoding.")?,
            prepared_shallow,
            final_shallow,
        })
    }
}

impl SnapshotManifest {
    /// Revalidate only the operation's fetched branches in staging, before a
    /// destination alternate can hide missing fetched objects. Retained branches
    /// are validated separately against the combined store.
    pub(crate) fn verified_fetched_boundaries(
        &self,
        source: &Repository,
        check: impl FnMut() -> Result<(), String>,
    ) -> Result<Vec<Oid>, String> {
        if self.version != 3 {
            return Err("Recovery candidate must use snapshot v3.".into());
        }
        manifest_tips(self)?;
        let updated = |name: &str| {
            self.selected_branch
                .as_deref()
                .is_none_or(|selected| selected == name)
        };
        let histories = self
            .histories
            .as_ref()
            .ok_or("Missing recovery history metadata.")?
            .iter()
            .filter(|h| updated(&h.name))
            .map(|h| BranchHistory {
                name: h.name.clone(),
                depth: h.depth,
                boundaries: h.boundaries.clone(),
            })
            .collect::<Vec<_>>();
        let boundaries = histories
            .iter()
            .flat_map(|h| h.boundaries.iter())
            .map(|id| Oid::from_str(id).map_err(git_error))
            .collect::<Result<std::collections::BTreeSet<_>, _>>()?
            .into_iter()
            .collect::<Vec<_>>();
        let fetched = Self {
            version: self.version,
            endpoint_key: self.endpoint_key.clone(),
            operation_id: self.operation_id.clone(),
            branches: self
                .branches
                .iter()
                .filter(|b| updated(&b.name))
                .cloned()
                .collect(),
            default_branch: self.default_branch.clone(),
            selected_branch: self.selected_branch.clone(),
            requested_depth: self.requested_depth,
            histories: Some(histories),
        };
        validate_snapshot_histories(source, &fetched, check)?;
        Ok(boundaries)
    }
}
