//! Exclusive intent creation and read-only admission for shallow/ref publication.
//! Recovery must be explicit; opening a repository never resumes writes.
use git2::{Oid, Repository};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeSet, fs, io::Read, path::Path};

pub(crate) const FILE: &str = "insomnium-fetch-journal-v1.json";
const MAX_BYTES: u64 = 2 * 1024 * 1024;

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Journal {
    schema_version: u32,
    operation_id: String,
    endpoint_key: String,
    expected_snapshot: Option<String>,
    target_snapshot: String,
    stage_name: String,
    stage_owner: String,
    old_shallow: Option<String>,
    prepared_shallow: String,
    final_shallow: String,
}

fn canonical_hex(value: &str, size: usize) -> bool {
    value.len() == size
        && value
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}
fn uuid(value: &str) -> bool {
    uuid::Uuid::parse_str(value)
        .map(|id| id.to_string())
        .ok()
        .as_deref()
        == Some(value)
}
fn oid(value: &str) -> Result<Oid, String> {
    if !canonical_hex(value, 40) {
        return Err("Invalid fetch journal object ID.".into());
    }
    let id = Oid::from_str(value).map_err(|_| "Invalid fetch journal object ID.")?;
    if id.is_zero() {
        return Err("Zero fetch journal object ID.".into());
    }
    Ok(id)
}

/// A missing file is distinct from an empty file. Preserve that distinction when
/// comparing old metadata; never follow a journal/shallow link or read unbounded.
fn read_plain(path: &Path, limit: u64) -> Result<Option<Vec<u8>>, String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err("Cannot inspect pending Git publication metadata.".into()),
    };
    let linked = metadata.file_type().is_symlink();
    #[cfg(windows)]
    let linked = {
        use std::os::windows::fs::MetadataExt;
        linked || metadata.file_attributes() & 0x400 != 0
    };
    if linked || !metadata.is_file() || metadata.len() > limit {
        return Err("Git publication metadata must be a bounded regular file.".into());
    }
    let mut bytes = Vec::new();
    fs::File::open(path)
        .map_err(|_| "Cannot open Git publication metadata.")?
        .take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Cannot read Git publication metadata.")?;
    if bytes.len() as u64 > limit {
        return Err("Git publication metadata exceeds size limit.".into());
    }
    Ok(Some(bytes))
}

impl Journal {
    fn validate(&self) -> Result<(Option<Oid>, Oid), String> {
        let owner = self.stage_owner.lines().collect::<Vec<_>>();
        if self.schema_version != 1
            || !uuid(&self.operation_id)
            || !canonical_hex(&self.endpoint_key, 64)
            || !self.stage_name.strip_prefix("fetch-").is_some_and(uuid)
            || self.stage_owner.len() > 256
            || owner.len() != 3
            || owner[0] != "insomnium-fetch-stage-v2"
            || !uuid(owner[1])
            || owner[2]
                .parse::<u32>()
                .ok()
                .filter(|pid| *pid != 0)
                .is_none()
        {
            return Err("Invalid fetch publication journal identity.".into());
        }
        let expected = self.expected_snapshot.as_deref().map(oid).transpose()?;
        let target = oid(&self.target_snapshot)?;
        if expected == Some(target) {
            return Err("Fetch journal must describe a distinct snapshot transition.".into());
        }
        let parse = |text: &str| {
            crate::git_remote::parse_shallow_boundaries(text.as_bytes())
                .map(|ids| ids.into_iter().collect::<BTreeSet<_>>())
        };
        let old = parse(self.old_shallow.as_deref().unwrap_or(""))?;
        let prepared = parse(&self.prepared_shallow)?;
        let final_cuts = parse(&self.final_shallow)?;
        if !old.is_subset(&prepared) || !final_cuts.is_subset(&prepared) {
            return Err("Prepared shallow metadata must protect old and final cuts.".into());
        }
        Ok((expected, target))
    }
}

/// Classify only observable file/ref states. This does not prove that staged
/// objects or a target snapshot are valid and cannot authorize recovery writes.
pub(crate) fn ensure_ready(repo: &Repository) -> Result<(), String> {
    let Some(journal) = read_journal(repo.path())? else {
        return Ok(());
    };
    let state = publication_state(repo, &journal)?;
    Err(format!(
        "Git fetch recovery required for operation {} ({state}); journal retained.",
        journal.operation_id
    ))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RecoveryStatus {
    pub(crate) operation_id: String,
    pub(crate) target_snapshot: String,
    pub(crate) state: String,
}

/// Observes journal/ref metadata only; never leases staging or authorizes
/// writes. Binding endpoint and caller operation must match before disclosure.
pub(crate) fn observe(
    repo: &Repository,
    url: &str,
    operation_id: &str,
) -> Result<Option<RecoveryStatus>, String> {
    let Some((journal, bytes)) = read_journal_record(repo.path())? else {
        return Ok(None);
    };
    if journal.endpoint_key != crate::git_fetch_snapshot::endpoint_key(url)?
        || journal.operation_id != operation_id
    {
        return Err("Pending fetch belongs to a different endpoint or operation; retained.".into());
    }
    let state = publication_state(repo, &journal)?;
    if read_journal_record(repo.path())?.map(|(_, value)| value) != Some(bytes) {
        return Err("Fetch journal changed during observation; reload recovery status.".into());
    }
    Ok(Some(RecoveryStatus {
        operation_id: journal.operation_id,
        target_snapshot: journal.target_snapshot,
        state: state.to_owned(),
    }))
}

fn publication_state(repo: &Repository, journal: &Journal) -> Result<&'static str, String> {
    let (expected, target) = journal.validate()?;
    let name = format!("refs/insomnium-fetch/{}/current", journal.endpoint_key);
    let actual = match repo.find_reference(&name) {
        Ok(reference) => Some(
            reference
                .target()
                .ok_or("Fetch recovery ref must be direct.")?,
        ),
        Err(error) if error.code() == git2::ErrorCode::NotFound => None,
        Err(_) => return Err("Cannot inspect fetch recovery ref.".into()),
    };
    let shallow = read_plain(&repo.path().join("shallow"), 410_000)?;
    let old = journal.old_shallow.as_ref().map(|text| text.as_bytes());
    let prepared = Some(journal.prepared_shallow.as_bytes());
    let final_cuts = Some(journal.final_shallow.as_bytes());
    let observed = shallow.as_deref();
    let state = if actual == expected && (observed == old || observed == prepared) {
        "before snapshot publication"
    } else if actual == Some(target) && (observed == prepared || observed == final_cuts) {
        "after snapshot publication"
    } else {
        return Err(
            "Fetch publication journal conflicts with repository state; retained for recovery."
                .into(),
        );
    };
    Ok(state)
}

fn read_journal(directory: &Path) -> Result<Option<Journal>, String> {
    Ok(read_journal_record(directory)?.map(|(journal, _)| journal))
}

fn read_journal_record(directory: &Path) -> Result<Option<(Journal, Vec<u8>)>, String> {
    crate::git_remote::validate_stage_parent(&directory.join(FILE))?;
    let Some(bytes) = read_plain(&directory.join(FILE), MAX_BYTES)? else {
        return Ok(None);
    };
    let journal: Journal = serde_json::from_slice(&bytes)
        .map_err(|_| "Invalid fetch publication journal; retained for recovery.")?;
    journal.validate()?;
    Ok(Some((journal, bytes)))
}

/// Acquire the exact retained stage for an already native-validated managed
/// repository. Caller holds GitState. This grants a lease, not permission to
/// import/publish: target snapshot and object graph still need validation.
impl TryFrom<(&Path, &Repository)> for crate::git_remote_job::StageReservation {
    type Error = String;

    fn try_from((app_data, repo): (&Path, &Repository)) -> Result<Self, Self::Error> {
        let (journal, bytes) =
            read_journal_record(repo.path())?.ok_or("No pending fetch publication journal.")?;
        let before = publication_state(repo, &journal)?;
        let stage = Self::try_from((
            app_data,
            journal.stage_name.as_str(),
            journal.stage_owner.as_bytes(),
        ))?;
        let (latest, latest_bytes) = read_journal_record(repo.path())?
            .ok_or("Fetch journal disappeared while acquiring recovery lease.")?;
        if bytes != latest_bytes || publication_state(repo, &latest)? != before {
            return Err(
                "Fetch journal or publication state changed while acquiring recovery lease.".into(),
            );
        }
        stage.repository_path()?;
        Ok(stage)
    }
}

/// libgit2 may parse shallow metadata while opening the repository. Bound and
/// reject indirection before handing pending metadata to that parser.
pub(crate) fn preflight(directory: &Path) -> Result<(), String> {
    if read_journal(directory)?.is_some() {
        if let Some(bytes) = read_plain(&directory.join("shallow"), 410_000)? {
            crate::git_remote::parse_shallow_boundaries(&bytes)?;
        }
    }
    Ok(())
}

/// Discover every stage pinned by a journal before cleanup removes anything.
/// Caller holds GitState across this scan and cleanup, as journal publication
/// and recovery will do. A malformed/inaccessible journal makes ownership
/// unknown: abort the whole cleanup rather than guess from partial JSON.
pub(crate) fn retained_stages(app_data: &Path) -> Result<BTreeSet<String>, String> {
    let root = app_data.join("git-v1");
    match fs::symlink_metadata(&root) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(BTreeSet::new());
        }
        Err(_) => return Err("Cannot inspect repositories for fetch recovery ownership.".into()),
        Ok(_) => {}
    }
    crate::git_remote::validate_stage_parent(&root.join("entry"))?;
    let mut retained = BTreeSet::new();
    for (index, entry) in fs::read_dir(&root)
        .map_err(|_| "Cannot enumerate repositories for fetch recovery ownership.")?
        .enumerate()
    {
        if index >= 1024 {
            return Err(
                "Fetch cleanup recovery scan exceeds 1024 repositories; nothing removed.".into(),
            );
        }
        let entry = entry.map_err(|_| "Cannot inspect repository recovery entry.")?;
        let name = entry.file_name();
        let id = name
            .to_str()
            .and_then(|name| name.strip_prefix("repo-"))
            .ok_or("Unknown managed repository entry; fetch cleanup stopped.")?;
        let path = crate::git::managed_path(&root, id)?;
        if let Some(journal) = read_journal(&path.join(".git"))? {
            // The name alone is enough to retain. A changed owner marker must
            // never authorize deletion of a journal's only recovery material.
            retained.insert(journal.stage_name);
        }
    }
    Ok(retained)
}

/// All workspace writers call this while holding GitState then StorageState.
/// Presence protects the binding even for a partial/unparseable journal: this
/// gate must not guess whether an interrupted publication can be abandoned.
pub(crate) fn protect_workspace_bindings(
    app_data: &Path,
    before: Option<&serde_json::Value>,
    after: &serde_json::Value,
) -> Result<(), String> {
    let root = app_data.join("git-v1");
    match fs::symlink_metadata(&root) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(_) => return Err("Cannot inspect pending fetch bindings.".into()),
        Ok(_) => {}
    }
    crate::git_remote::validate_stage_parent(&root.join("entry"))?;
    for (index, entry) in fs::read_dir(&root)
        .map_err(|_| "Cannot enumerate pending fetch bindings.")?
        .enumerate()
    {
        if index >= 1024 {
            return Err("Pending fetch binding scan exceeds repository limit.".into());
        }
        let entry = entry.map_err(|_| "Cannot inspect pending fetch repository.")?;
        let name = entry.file_name();
        let id = name
            .to_str()
            .and_then(|name| name.strip_prefix("repo-"))
            .ok_or("Unknown managed repository entry; workspace save stopped.")?;
        let path = crate::git::managed_path(&root, id)?.join(".git").join(FILE);
        crate::git_remote::validate_stage_parent(&path)?;
        match fs::symlink_metadata(&path) {
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(_) => return Err("Cannot inspect fetch publication before workspace save.".into()),
            Ok(_) => {}
        }
        let message = "Pending fetch publication protects its saved binding and collection; resume recovery before changing them.";
        let previous = before
            .and_then(|data| data["resources"].as_array())
            .ok_or(message)?;
        let next = after["resources"].as_array().ok_or(message)?;
        let bindings = |resources: &[serde_json::Value]| {
            resources
                .iter()
                .filter(|resource| {
                    resource["_type"] == "git_repository" && resource["nativeRepositoryId"] == id
                })
                .cloned()
                .collect::<Vec<_>>()
        };
        let old = bindings(previous);
        let new = bindings(next);
        if old.len() != 1 || new != old || old[0]["nativeBindingVersion"] != 1 {
            return Err(message.into());
        }
        let parent = old[0]["parentId"].as_str().ok_or(message)?;
        let eligible = |resources: &[serde_json::Value]| {
            resources
                .iter()
                .filter(|resource| {
                    resource["_type"] == "workspace"
                        && resource["_id"] == parent
                        && resource["isPrivate"] != true
                })
                .count()
                == 1
        };
        if !eligible(previous) || !eligible(next) {
            return Err(message.into());
        }
    }
    Ok(())
}

/// Repository-wide retention inventory. Caller holds GitState and supplies an
/// already native-validated managed repository. No metadata is written.
#[derive(Debug, PartialEq, Eq)]
pub(crate) struct RetainedRoots {
    pub(crate) objects: Vec<Oid>,
    pub(crate) boundaries: Vec<Oid>,
    pub(crate) old_shallow: Option<Vec<u8>>,
}

impl TryFrom<(&Repository, &std::sync::atomic::AtomicBool)> for RetainedRoots {
    type Error = String;

    fn try_from(
        (repo, cancelled): (&Repository, &std::sync::atomic::AtomicBool),
    ) -> Result<Self, String> {
        Self::read(repo, repo, cancelled)
    }
}

impl RetainedRoots {
    fn read(
        repo: &Repository,
        objects: &Repository,
        cancelled: &std::sync::atomic::AtomicBool,
    ) -> Result<Self, String> {
        use std::sync::atomic::Ordering;
        let check = || {
            if cancelled.load(Ordering::SeqCst) {
                Err("Fetch root inventory cancelled.".to_owned())
            } else {
                Ok(())
            }
        };
        check()?;
        let directory = repo.path();
        crate::git_remote::validate_stage_parent(&directory.join("HEAD"))?;
        // Managed repositories have one worktree and the ordinary files ref
        // backend. Never silently inventory only part of a shared repository.
        if repo.is_worktree()
            || repo.commondir() != directory
            || !repo
                .worktrees()
                .map_err(|_| "Cannot inspect Git worktrees.")?
                .is_empty()
            || match fs::symlink_metadata(directory.join("reftable")) {
                Ok(_) => true,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
                Err(_) => return Err("Cannot inspect Git reference backend.".into()),
            }
        {
            return Err("Fetch root inventory requires a single files-backend repository.".into());
        }
        let mut roots = BTreeSet::new();
        let mut add = |id: Oid| -> Result<(), String> {
            if id.is_zero() {
                return Err("Retained Git root cannot be zero.".into());
            }
            roots.insert(id);
            if roots.len() > 1_000_000 {
                return Err("Retained Git roots exceed limit.".into());
            }
            Ok(())
        };
        // Bound and reject filesystem indirection before libgit2 reads refs or
        // reflogs. Include orphaned reflogs, not only logs of current references.
        let mut logs = Vec::new();
        let mut entries = 0usize;
        let mut total = 0usize;
        for kind in ["refs", "logs"] {
            let root = directory.join(kind);
            match fs::symlink_metadata(&root) {
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
                Err(_) => return Err("Cannot inspect Git root storage.".into()),
                Ok(_) => {}
            }
            crate::git_remote::validate_stage_parent(&root.join("entry"))?;
            let mut pending = vec![root.clone()];
            while let Some(parent) = pending.pop() {
                check()?;
                for entry in
                    fs::read_dir(parent).map_err(|_| "Cannot enumerate Git root storage.")?
                {
                    check()?;
                    entries += 1;
                    if entries > 100_000 {
                        return Err("Git root storage exceeds entry limit.".into());
                    }
                    let path = entry.map_err(|_| "Cannot inspect Git root entry.")?.path();
                    let metadata = fs::symlink_metadata(&path)
                        .map_err(|_| "Cannot inspect Git root entry.")?;
                    let linked = metadata.file_type().is_symlink();
                    #[cfg(windows)]
                    let linked = {
                        use std::os::windows::fs::MetadataExt;
                        linked || metadata.file_attributes() & 0x400 != 0
                    };
                    if linked {
                        return Err("Git root storage cannot contain links.".into());
                    }
                    if metadata.is_dir() {
                        pending.push(path);
                        continue;
                    }
                    let bytes = read_plain(
                        &path,
                        if kind == "logs" {
                            32 * 1024 * 1024
                        } else {
                            4096
                        },
                    )?
                    .ok_or("Git root entry disappeared during inventory.")?;
                    total = total
                        .checked_add(bytes.len())
                        .ok_or("Git root inventory size overflow.")?;
                    if total > 128 * 1024 * 1024 {
                        return Err("Git root inventory exceeds byte limit.".into());
                    }
                    let relative = path
                        .strip_prefix(&root)
                        .map_err(|_| "Invalid Git root path.")?;
                    let relative = relative
                        .to_str()
                        .ok_or("Git root path must be UTF-8.")?
                        .replace('\\', "/");
                    let name = if kind == "refs" {
                        format!("refs/{relative}")
                    } else {
                        relative
                    };
                    if name != "HEAD" && !git2::Reference::is_valid_name(&name) {
                        return Err(
                            "Unsupported Git root name or pending lock; retry after Git settles."
                                .into(),
                        );
                    }
                    if kind == "logs" {
                        logs.push((name, bytes));
                    } else {
                        // libgit2's iterator may omit malformed loose references.
                        repo.find_reference(&name)
                            .map_err(|_| "Cannot read retained Git reference.")?
                            .resolve()
                            .map_err(|_| "Cannot resolve retained Git reference.")?
                            .target()
                            .ok_or("Retained Git reference has no target.")?;
                    }
                }
            }
        }
        read_plain(&directory.join("packed-refs"), 32 * 1024 * 1024)?;
        read_plain(&directory.join("HEAD"), 4096)?.ok_or("Git HEAD is missing.")?;
        for (index, reference) in repo
            .references()
            .map_err(|_| "Cannot enumerate retained Git refs.")?
            .enumerate()
        {
            check()?;
            if index >= 100_000 {
                return Err("Retained Git refs exceed limit.".into());
            }
            let reference = reference.map_err(|_| "Cannot read retained Git reference.")?;
            add(reference
                .resolve()
                .map_err(|_| "Cannot resolve retained Git reference.")?
                .target()
                .ok_or("Retained Git reference has no target.")?)?;
        }
        let head = repo
            .find_reference("HEAD")
            .map_err(|_| "Cannot read Git HEAD.")?;
        match head.resolve() {
            Ok(head) => add(head.target().ok_or("Git HEAD has no target.")?)?,
            Err(error)
                if error.code() == git2::ErrorCode::NotFound
                    && head.symbolic_target().ok().flatten().is_some_and(|name| {
                        name.starts_with("refs/heads/") && git2::Reference::is_valid_name(name)
                    }) => {}
            Err(_) => return Err("Cannot resolve Git HEAD.".into()),
        }
        let mut log_entries = 0usize;
        for (name, before) in logs {
            check()?;
            let log = repo
                .reflog(&name)
                .map_err(|_| "Cannot read retained Git reflog.")?;
            // Refuse malformed nonempty records even if a backend parser skips
            // them; each stored line must correspond to one parsed entry.
            if before
                .split(|b| *b == b'\n')
                .filter(|line| !line.is_empty())
                .count()
                != log.len()
            {
                return Err("Retained Git reflog contains unparsed records.".into());
            }
            for entry in log.iter() {
                check()?;
                log_entries += 1;
                if log_entries > 1_000_000 {
                    return Err("Retained Git reflogs exceed entry limit.".into());
                }
                for id in [entry.id_old(), entry.id_new()] {
                    if !id.is_zero() {
                        add(id)?;
                    }
                }
            }
            if read_plain(&directory.join("logs").join(&name), 32 * 1024 * 1024)?.as_deref()
                != Some(before.as_slice())
            {
                return Err("Git reflog changed during root inventory.".into());
            }
        }
        // Pseudorefs are outside refs/. FETCH_HEAD permits tab-separated
        // descriptions and MERGE_HEAD may contain multiple object IDs.
        for name in [
            "ORIG_HEAD",
            "FETCH_HEAD",
            "MERGE_HEAD",
            "REBASE_HEAD",
            "CHERRY_PICK_HEAD",
            "REVERT_HEAD",
            "AUTO_MERGE",
        ] {
            check()?;
            if let Some(bytes) = read_plain(&directory.join(name), 4 * 1024 * 1024)? {
                let value = std::str::from_utf8(&bytes).map_err(|_| "Invalid Git pseudoref.")?;
                for line in value.lines() {
                    check()?;
                    let id = if name == "FETCH_HEAD" {
                        line.split_once('\t')
                            .map(|(id, _)| id)
                            .ok_or("Invalid FETCH_HEAD record.")?
                    } else {
                        line
                    };
                    add(oid(id)?)?;
                }
            }
        }
        let old_shallow = read_plain(&directory.join("shallow"), 410_000)?;
        let boundaries =
            crate::git_remote::parse_shallow_boundaries(old_shallow.as_deref().unwrap_or(b""))?;
        let odb = objects
            .odb()
            .map_err(|_| "Cannot inspect retained shallow objects.")?;
        for id in &boundaries {
            check()?;
            if odb
                .read_header(*id)
                .map_err(|_| "Retained shallow boundary object is missing.")?
                .1
                != git2::ObjectType::Commit
            {
                return Err("Retained shallow boundary must be a commit.".into());
            }
            add(*id)?;
        }
        check()?;
        Ok(Self {
            objects: roots.into_iter().collect(),
            boundaries,
            old_shallow,
        })
    }
}

impl TryFrom<(&Repository, &std::sync::atomic::AtomicBool)> for crate::git_remote::ObjectGraphPlan {
    type Error = String;

    fn try_from(input: (&Repository, &std::sync::atomic::AtomicBool)) -> Result<Self, String> {
        let inventory = RetainedRoots::try_from(input)?;
        let raw = Repository::from_odb(
            input
                .0
                .odb()
                .map_err(|_| "Cannot open retained object store.")?,
        )
        .map_err(|_| "Cannot create raw retained object view.")?;
        let plan = Self::try_from(crate::git_remote::RepositoryGraphInput {
            repository: &raw,
            roots: &inventory.objects,
            boundaries: &inventory.boundaries,
            cancelled: input.1,
        })?;
        if inventory != RetainedRoots::try_from(input)? {
            return Err("Retained Git roots changed during graph planning.".into());
        }
        Ok(plan)
    }
}

pub(crate) struct JournalCreationInput<'a> {
    pub(crate) app_data: &'a Path,
    pub(crate) publication: crate::git_fetch_snapshot::PublicationInput<'a>,
}

/// Persist only the intent record. The caller must hold GitState, keep the
/// staging lease, and retain both journal and stage on every uncertain outcome.
/// No object import, shallow update or snapshot-ref publication happens here.
impl TryFrom<JournalCreationInput<'_>> for Journal {
    type Error = String;
    fn try_from(input: JournalCreationInput<'_>) -> Result<Self, String> {
        use crate::git_fetch_snapshot::PublicationPlan;
        use std::{io::Write, sync::atomic::Ordering};
        let JournalCreationInput {
            app_data,
            publication,
        } = input;
        let repo = publication.history.destination;
        let check = || {
            if publication.history.cancelled.load(Ordering::SeqCst) {
                Err("Fetch journal creation cancelled before reservation.".to_owned())
            } else {
                Ok(())
            }
        };
        check()?;
        verify_managed_identity(app_data, repo)?;
        let plan = PublicationPlan::try_from(publication)?;
        let stage = publication
            .history
            .output
            .stage
            .as_ref()
            .ok_or("Missing recovery staging lease.")?;
        let (stage_name, stage_owner) = stage.sync_recovery_material(app_data, check)?;
        // Re-read graphs, bytes and identity after flush, before the only write.
        let fresh = PublicationPlan::try_from(publication)?;
        if fresh.snapshot.oid != plan.snapshot.oid
            || fresh.expected_snapshot != plan.expected_snapshot
            || fresh.objects != plan.objects
            || fresh.old_shallow != plan.old_shallow
            || fresh.prepared_shallow != plan.prepared_shallow
            || fresh.final_shallow != plan.final_shallow
        {
            return Err("Fetch publication plan changed during recovery flush.".into());
        }
        let journal = Self {
            schema_version: 1,
            operation_id: plan.snapshot.manifest.operation_id,
            endpoint_key: plan.snapshot.manifest.endpoint_key,
            expected_snapshot: plan.expected_snapshot,
            target_snapshot: plan.snapshot.oid,
            stage_name,
            stage_owner,
            old_shallow: plan.old_shallow,
            prepared_shallow: plan.prepared_shallow,
            final_shallow: plan.final_shallow,
        };
        journal.validate()?;
        let bytes =
            serde_json::to_vec(&journal).map_err(|_| "Cannot encode fetch publication journal.")?;
        if bytes.len() as u64 > MAX_BYTES {
            return Err("Fetch publication journal exceeds size limit.".into());
        }
        if read_journal_record(repo.path())?.is_some() {
            return Err("A fetch publication journal already exists.".into());
        }
        publication_state(repo, &journal)?;
        check()?;
        let mut options = fs::OpenOptions::new();
        options.read(true).write(true).create_new(true);
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            options.custom_flags(0x80000000); // FILE_FLAG_WRITE_THROUGH
        }
        let mut file = options
            .open(repo.path().join(FILE))
            .map_err(|_| "Cannot reserve new fetch journal; existing material retained.")?;
        // From reservation onward cancellation cannot erase the pending intent.
        // An incomplete write is retained: admission/cleanup fail closed.
        file.write_all(&bytes)
            .and_then(|_| file.sync_all())
            .map_err(|_| "Cannot flush fetch journal; retain journal and staging for recovery.")?;
        #[cfg(unix)]
        fs::File::open(repo.path())
            .and_then(|directory| directory.sync_all())
            .map_err(|_| "Cannot sync fetch journal directory; retain recovery material.")?;
        drop(file);
        let (_, actual) = read_journal_record(repo.path())?
            .ok_or("Fetch journal disappeared after creation; retain staging.")?;
        if actual != bytes || publication_state(repo, &journal)? != "before snapshot publication" {
            return Err("Fetch journal changed after creation; retain recovery material.".into());
        }
        stage.repository_path()?;
        PublicationPlan::try_from(RecoveryInput {
            app_data,
            repository: repo,
            stage,
            cancelled: publication.history.cancelled,
        })?;
        Ok(journal)
    }
}

fn verify_managed_identity(app_data: &Path, repo: &Repository) -> Result<(), String> {
    let worktree = repo
        .workdir()
        .ok_or("Recovery journal requires a managed worktree.")?;
    let name = worktree
        .file_name()
        .and_then(|n| n.to_str())
        .and_then(|n| n.strip_prefix("repo-"))
        .ok_or("Invalid managed recovery repository identity.")?;
    let path = crate::git::managed_path(&app_data.join("git-v1"), name)?;
    if fs::canonicalize(worktree).map_err(|_| "Cannot resolve recovery worktree.")?
        != fs::canonicalize(&path).map_err(|_| "Cannot resolve managed recovery path.")?
        || fs::canonicalize(repo.path()).map_err(|_| "Cannot resolve recovery Git directory.")?
            != fs::canonicalize(path.join(".git"))
                .map_err(|_| "Cannot resolve managed Git directory.")?
        || repo.is_bare()
    {
        return Err("Recovery journal repository is outside native managed storage.".into());
    }
    Ok(())
}

#[derive(Clone, Copy)]
pub(crate) struct RecoveryInput<'a> {
    pub(crate) app_data: &'a Path,
    pub(crate) repository: &'a Repository,
    pub(crate) stage: &'a crate::git_remote_job::StageReservation,
    pub(crate) cancelled: &'a std::sync::atomic::AtomicBool,
}

/// Validate a recognized pending operation without writing. The caller holds
/// GitState and the creator's settled lease or a journal-reacquired exclusive
/// lease for the entire validation and any subsequent transition.
impl TryFrom<RecoveryInput<'_>> for crate::git_fetch_snapshot::PublicationPlan {
    type Error = String;
    fn try_from(input: RecoveryInput<'_>) -> Result<Self, String> {
        use crate::git_fetch_snapshot::{read_snapshot_object, validate_snapshot_histories};
        use crate::git_remote::{parse_shallow_boundaries, ObjectGraphPlan, RepositoryGraphInput};
        use std::sync::atomic::Ordering;
        let RecoveryInput {
            app_data,
            repository: repo,
            stage,
            cancelled,
        } = input;
        let check = || {
            if cancelled.load(Ordering::SeqCst) {
                Err("Fetch recovery validation cancelled; journal and staging retained.".to_owned())
            } else {
                Ok(())
            }
        };
        check()?;
        verify_managed_identity(app_data, repo)?;
        let (journal, bytes) =
            read_journal_record(repo.path())?.ok_or("No fetch recovery journal.")?;
        let state = publication_state(repo, &journal)?;
        let observed_shallow = read_plain(&repo.path().join("shallow"), 410_000)?;
        let identity = stage.recovery_identity(app_data)?;
        if identity.0 != journal.stage_name || identity.1 != journal.stage_owner {
            return Err("Recovery lease does not match the journal stage.".into());
        }
        let (expected, target) = journal.validate()?;
        let combined = stage.object_repository(check)?;
        let snapshot = read_snapshot_object(&combined, &journal.endpoint_key, target)?;
        if snapshot.manifest.operation_id != journal.operation_id {
            return Err("Recovery candidate operation does not match journal.".into());
        }
        let fetched = snapshot
            .manifest
            .verified_fetched_boundaries(&combined, check)?;
        combined
            .odb()
            .map_err(|_| "Cannot open recovery staging objects.")?
            .add_disk_alternate(
                repo.path()
                    .join("objects")
                    .to_str()
                    .ok_or("Invalid recovery object path.")?,
            )
            .map_err(|_| "Cannot combine recovery object stores.")?;
        validate_snapshot_histories(&combined, &snapshot.manifest, check)?;
        // During prepared-before-import the shallow file may list objects only
        // present in staging. Validate those roots through the combined store.
        let retained = RetainedRoots::read(repo, &combined, cancelled)?;
        let old =
            parse_shallow_boundaries(journal.old_shallow.as_deref().unwrap_or("").as_bytes())?;
        let recorded_final = parse_shallow_boundaries(journal.final_shallow.as_bytes())?;
        let recorded_prepared = parse_shallow_boundaries(journal.prepared_shallow.as_bytes())?;
        let mut authorized = old.iter().copied().collect::<BTreeSet<_>>();
        authorized.extend(fetched);
        let authorized = authorized.into_iter().collect::<Vec<_>>();
        let mut roots = retained.objects.iter().copied().collect::<BTreeSet<_>>();
        roots.extend(old.iter().copied());
        roots.insert(target);
        if let Some(previous) = expected {
            // Keep the previous immutable snapshot even when the current ref
            // already points at target and no reflog was configured.
            read_snapshot_object(&combined, &journal.endpoint_key, previous)?;
            roots.insert(previous);
        }
        let roots = roots.into_iter().collect::<Vec<_>>();
        let graph = ObjectGraphPlan::try_from(RepositoryGraphInput {
            repository: &combined,
            roots: &roots,
            boundaries: &authorized,
            cancelled,
        })?;
        let mut prepared = old.iter().copied().collect::<BTreeSet<_>>();
        prepared.extend(graph.shallow_boundaries.iter().copied());
        if graph.shallow_boundaries != recorded_final
            || prepared.into_iter().collect::<Vec<_>>() != recorded_prepared
        {
            return Err("Recovery graph does not match the recorded shallow transition.".into());
        }
        if state == "after snapshot publication" {
            // A published ref may not rely on staging to hide missing imported
            // objects. Require the destination alone to satisfy the final graph.
            let raw = Repository::from_odb(
                repo.odb()
                    .map_err(|_| "Cannot open published object store.")?,
            )
            .map_err(|_| "Cannot create published object view.")?;
            let published = read_snapshot_object(&raw, &journal.endpoint_key, target)?;
            validate_snapshot_histories(&raw, &published.manifest, check)?;
            let published_graph = ObjectGraphPlan::try_from(RepositoryGraphInput {
                repository: &raw,
                roots: &roots,
                boundaries: &recorded_final,
                cancelled,
            })?;
            if published_graph.shallow_boundaries != recorded_final {
                return Err(
                    "Published destination does not match final shallow boundaries.".into(),
                );
            }
        }
        let (_, latest_bytes) =
            read_journal_record(repo.path())?.ok_or("Recovery journal disappeared.")?;
        if latest_bytes != bytes
            || publication_state(repo, &journal)? != state
            || read_plain(&repo.path().join("shallow"), 410_000)? != observed_shallow
            || RetainedRoots::read(repo, &combined, cancelled)? != retained
            || stage.recovery_identity(app_data)? != identity
        {
            return Err("Recovery evidence changed during validation; material retained.".into());
        }
        check()?;
        let mut objects = graph
            .objects
            .iter()
            .map(ToString::to_string)
            .collect::<Vec<_>>();
        objects.sort();
        Ok(Self {
            snapshot,
            expected_snapshot: journal.expected_snapshot,
            objects,
            old_shallow: journal.old_shallow,
            prepared_shallow: journal.prepared_shallow,
            final_shallow: journal.final_shallow,
        })
    }
}

struct ShallowGuard {
    file: fs::File,
    path: std::path::PathBuf,
    marker: Vec<u8>,
}
impl ShallowGuard {
    fn acquire(repo: &Repository, journal: &Journal) -> Result<Self, String> {
        use std::io::{Seek, Write};
        let path = repo.path().join("shallow.lock");
        crate::git_remote::validate_stage_parent(&path)?;
        let marker = format!(
            "insomnium-fetch-shallow-v1\n{}\n{}",
            journal.operation_id, journal.stage_owner
        )
        .into_bytes();
        let (mut file, created) = match fs::OpenOptions::new()
            .read(true)
            .write(true)
            .create_new(true)
            .open(&path)
        {
            Ok(file) => (file, true),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                if read_plain(&path, 512)?.as_deref() != Some(marker.as_slice()) {
                    return Err("Unowned Git shallow lock exists; retain recovery material.".into());
                }
                (
                    fs::OpenOptions::new()
                        .read(true)
                        .write(true)
                        .open(&path)
                        .map_err(|_| "Cannot reopen owned shallow lock.")?,
                    false,
                )
            }
            Err(_) => return Err("Cannot reserve Git shallow lock.".into()),
        };
        file.try_lock()
            .map_err(|_| "Git shallow transition is still active.")?;
        if created {
            file.write_all(&marker)
                .and_then(|_| file.sync_all())
                .map_err(|_| "Cannot persist shallow lock ownership; retain recovery material.")?;
        }
        file.rewind()
            .map_err(|_| "Cannot inspect owned shallow lock.")?;
        let mut actual = Vec::new();
        (&mut file)
            .take(513)
            .read_to_end(&mut actual)
            .map_err(|_| "Cannot read owned shallow lock.")?;
        if actual != marker {
            return Err("Shallow lock changed while acquiring it.".into());
        }
        Ok(Self { file, path, marker })
    }

    fn release(mut self) -> Result<(), String> {
        use std::io::Seek;
        self.file
            .rewind()
            .map_err(|_| "Cannot verify shallow lock before release.")?;
        let mut actual = Vec::new();
        (&mut self.file)
            .take(513)
            .read_to_end(&mut actual)
            .map_err(|_| "Cannot verify shallow lock owner.")?;
        if actual != self.marker {
            return Err("Shallow lock ownership changed; retain recovery material.".into());
        }
        // Deliberately no Drop deletion. Failed transitions keep a recognizable
        // lock; a restarted exclusive stage owner can acquire and resume it.
        fs::remove_file(&self.path)
            .map_err(|_| "Cannot release owned shallow lock; retain journal.")?;
        Ok(())
    }
}

fn sync_directory(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    fs::File::open(path)
        .and_then(|file| file.sync_all())
        .map_err(|_| "Cannot sync Git recovery directory.")?;
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}

fn install_shallow(
    input: RecoveryInput<'_>,
    journal_bytes: &[u8],
    image: &str,
) -> Result<(), String> {
    use std::io::Write;
    crate::git_fetch_snapshot::PublicationPlan::try_from(input)?;
    let path = input.repository.path().join("shallow");
    let observed = read_plain(&path, 410_000)?;
    let mut file = atomic_write_file::AtomicWriteFile::open(&path)
        .map_err(|_| "Cannot prepare atomic shallow metadata; recovery retained.")?;
    file.write_all(image.as_bytes())
        .and_then(|_| file.sync_all())
        .map_err(|_| "Cannot flush replacement shallow metadata; recovery retained.")?;
    crate::git_fetch_snapshot::PublicationPlan::try_from(input)?;
    if read_journal_record(input.repository.path())?
        .map(|(_, bytes)| bytes)
        .as_deref()
        != Some(journal_bytes)
        || read_plain(&path, 410_000)? != observed
    {
        return Err("Shallow publication evidence changed before replacement.".into());
    }
    file.commit()
        .map_err(|_| "Shallow replacement outcome uncertain; retain journal and staging.")?;
    sync_directory(input.repository.path())?;
    if read_plain(&path, 410_000)?.as_deref() != Some(image.as_bytes()) {
        return Err("Shallow replacement did not confirm; retain recovery material.".into());
    }
    Ok(())
}

/// Resume one journaled operation. Never start a different operation or change
/// local HEAD/workspace. Caller holds GitState and the stage lease throughout.
impl TryFrom<RecoveryInput<'_>> for crate::git_fetch_snapshot::FetchSnapshot {
    type Error = String;
    fn try_from(input: RecoveryInput<'_>) -> Result<Self, String> {
        use crate::git_fetch_snapshot::PublicationPlan;
        use crate::git_remote::RepositoryGraphInput;
        use crate::git_remote_job::sync_owned_file;
        let repo = input.repository;
        let (journal, bytes) =
            read_journal_record(repo.path())?.ok_or("No fetch recovery journal.")?;
        let plan = PublicationPlan::try_from(input)?;
        let guard = ShallowGuard::acquire(repo, &journal)?;
        if read_journal_record(repo.path())?
            .map(|(_, bytes)| bytes)
            .as_deref()
            != Some(bytes.as_slice())
        {
            return Err("Fetch journal changed before recovery transition.".into());
        }
        let (expected, target) = journal.validate()?;
        let name = format!("refs/insomnium-fetch/{}/current", journal.endpoint_key);
        if publication_state(repo, &journal)? == "before snapshot publication" {
            install_shallow(input, &bytes, &journal.prepared_shallow)?;
            let source = input.stage.object_repository(|| {
                if input.cancelled.load(std::sync::atomic::Ordering::SeqCst) {
                    Err("Fetch import cancelled; retain journal and staging.".into())
                } else {
                    Ok(())
                }
            })?;
            source
                .odb()
                .map_err(|_| "Cannot read recovery source.")?
                .add_disk_alternate(
                    repo.path()
                        .join("objects")
                        .to_str()
                        .ok_or("Invalid import object path.")?,
                )
                .map_err(|_| "Cannot combine import stores.")?;
            let source_odb = source.odb().map_err(|_| "Cannot read recovery source.")?;
            let dest_odb = repo
                .odb()
                .map_err(|_| "Cannot open destination object store.")?;
            let mut directories = BTreeSet::new();
            for id in &plan.objects {
                if input.cancelled.load(std::sync::atomic::Ordering::SeqCst) {
                    return Err("Fetch import cancelled; retain journal and staging.".into());
                }
                let id = oid(id)?;
                let object = source_odb
                    .read(id)
                    .map_err(|_| "Cannot read planned recovery object.")?;
                if Oid::hash_object(object.kind(), object.data())
                    .map_err(|_| "Cannot hash recovery object.")?
                    != id
                {
                    return Err("Recovery object content changed; retain material.".into());
                }
                if dest_odb.exists(id) {
                    let existing = dest_odb
                        .read(id)
                        .map_err(|_| "Cannot verify existing destination object.")?;
                    if existing.kind() != object.kind() || existing.data() != object.data() {
                        return Err("Destination object conflicts with planned content.".into());
                    }
                } else if dest_odb
                    .write(object.kind(), object.data())
                    .map_err(|_| "Cannot import recovery object; retain journal.")?
                    != id
                {
                    return Err("Imported recovery object ID differs from plan.".into());
                }
                let hex = id.to_string();
                let loose = repo.path().join("objects").join(&hex[..2]).join(&hex[2..]);
                match fs::symlink_metadata(&loose) {
                    Ok(_) => {
                        sync_owned_file(&loose)?;
                        directories.insert(loose.parent().unwrap().to_owned());
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                        // An existing packed object was already verified above.
                        if !dest_odb.exists(id) {
                            return Err("Imported recovery object disappeared.".into());
                        }
                    }
                    Err(_) => return Err("Cannot inspect imported recovery object.".into()),
                }
            }
            for directory in directories {
                sync_directory(&directory)?;
            }
            sync_directory(&repo.path().join("objects"))?;
            // Verify the complete destination BEFORE changing the snapshot ref.
            let raw =
                Repository::from_odb(repo.odb().map_err(|_| "Cannot inspect imported store.")?)
                    .map_err(|_| "Cannot open raw imported store.")?;
            let roots = plan
                .objects
                .iter()
                .map(|id| oid(id))
                .collect::<Result<Vec<_>, _>>()?;
            let cuts =
                crate::git_remote::parse_shallow_boundaries(journal.final_shallow.as_bytes())?;
            let verified = crate::git_remote::ObjectGraphPlan::try_from(RepositoryGraphInput {
                repository: &raw,
                roots: &roots,
                boundaries: &cuts,
                cancelled: input.cancelled,
            })?;
            if verified.shallow_boundaries != cuts {
                return Err("Imported destination does not match final physical history.".into());
            }
            PublicationPlan::try_from(input)?;
            let mut transaction = repo
                .transaction()
                .map_err(|_| "Cannot start recovery ref transaction.")?;
            transaction
                .lock_ref(&name)
                .map_err(|_| "Cannot lock recovery snapshot ref; retain journal.")?;
            let actual = match repo.find_reference(&name) {
                Ok(reference) => Some(
                    reference
                        .target()
                        .ok_or("Recovery snapshot ref must remain direct.")?,
                ),
                Err(error) if error.code() == git2::ErrorCode::NotFound => None,
                Err(_) => return Err("Cannot recheck recovery snapshot ref.".into()),
            };
            if actual != expected
                || read_journal_record(repo.path())?
                    .map(|(_, bytes)| bytes)
                    .as_deref()
                    != Some(bytes.as_slice())
                || read_plain(&repo.path().join("shallow"), 410_000)?.as_deref()
                    != Some(journal.prepared_shallow.as_bytes())
            {
                return Err("Recovery publication evidence changed under ref lock.".into());
            }
            if input.cancelled.load(std::sync::atomic::Ordering::SeqCst) {
                return Err(
                    "Recovery publication cancelled before ref commit; journal retained.".into(),
                );
            }
            let signature = git2::Signature::now("Insomnium fetch", "fetch@insomnium.invalid")
                .map_err(|_| "Cannot create recovery ref signature.")?;
            transaction
                .set_target(
                    &name,
                    target,
                    Some(&signature),
                    "Insomnium recovered fetch snapshot",
                )
                .map_err(|_| "Cannot prepare recovery snapshot ref.")?;
            transaction
                .commit()
                .map_err(|_| "Recovery ref outcome uncertain; retain journal and staging.")?;
        }
        // Once committed, finish that same operation even if cancellation arrives.
        let settled = std::sync::atomic::AtomicBool::new(false);
        let finish = RecoveryInput {
            cancelled: &settled,
            ..input
        };
        PublicationPlan::try_from(finish)?;
        let loose_ref = repo.path().join(&name);
        let persisted_ref = match fs::symlink_metadata(&loose_ref) {
            Ok(_) => loose_ref,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                repo.path().join("packed-refs")
            }
            Err(_) => return Err("Cannot inspect published ref storage.".into()),
        };
        sync_owned_file(&persisted_ref)?;
        let mut durable_paths = vec![persisted_ref];
        let log = repo.path().join("logs").join(&name);
        match fs::symlink_metadata(&log) {
            Ok(_) => {
                sync_owned_file(&log)?;
                durable_paths.push(log);
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => return Err("Cannot inspect recovery reflog durability.".into()),
        }
        for path in durable_paths {
            let mut parent = path.parent().unwrap().to_owned();
            loop {
                sync_directory(&parent)?;
                if parent == repo.path() {
                    break;
                }
                parent = parent
                    .parent()
                    .ok_or("Invalid recovery ref ancestry.")?
                    .to_owned();
            }
        }
        install_shallow(finish, &bytes, &journal.final_shallow)?;
        let result = PublicationPlan::try_from(finish)?.snapshot;
        guard.release()?;
        PublicationPlan::try_from(finish)?;
        if read_journal_record(repo.path())?
            .map(|(_, bytes)| bytes)
            .as_deref()
            != Some(bytes.as_slice())
        {
            return Err("Recovery journal changed before retirement.".into());
        }
        fs::remove_file(repo.path().join(FILE))
            .map_err(|_| "Snapshot committed but journal retirement failed; retain staging.")?;
        sync_directory(repo.path())?;
        // Staging is retained for caller acknowledgment/explicit cleanup.
        Ok(result)
    }
}
