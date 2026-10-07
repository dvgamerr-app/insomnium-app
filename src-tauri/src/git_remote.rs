//! Remote discovery and isolated fetch staging. Never opens a managed repository.
use git2::{Cred, CredentialType, Direction, Remote, RemoteCallbacks};
use serde::{Deserialize, Serialize};

pub(crate) mod push;

#[derive(Default, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum RemoteCredentials {
    #[default]
    Anonymous,
    Basic {
        username: String,
        password: String,
    },
    Github {
        token: String,
    },
    Gitlab {
        token: String,
    },
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RemoteAdvertisementInput {
    pub(crate) url: String,
    #[serde(default)]
    credentials: RemoteCredentials,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvertisedBranch {
    pub(crate) name: String,
    pub(crate) reference: String,
    pub(crate) oid: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteAdvertisement {
    pub(crate) url: String,
    pub(crate) branches: Vec<AdvertisedBranch>,
    // Only a server-advertised HEAD symref, never guessed from branch ordering.
    pub(crate) default_branch: Option<String>,
    head_oid: Option<String>,
    // No refs advertised is different from no branches (e.g. a tags-only repo).
    pub(crate) empty: bool,
    #[serde(default)]
    pub(crate) shallow_boundaries: Vec<String>,
}

pub(crate) fn endpoint(value: &str) -> Result<reqwest::Url, String> {
    if value.is_empty() || value.len() > 8192 || value.chars().any(char::is_control) {
        return Err("Invalid Git remote URL.".into());
    }
    let url = reqwest::Url::parse(value).map_err(|_| "Invalid Git remote URL.")?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err("Use an HTTP or HTTPS Git endpoint.".into());
    }
    if !url.username().is_empty() || url.password().is_some() || url.fragment().is_some() {
        return Err("Provide Git credentials separately; URL user information and fragments are not supported.".into());
    }
    Ok(url)
}

fn credential_pair(credentials: &RemoteCredentials) -> Result<Option<(&str, &str)>, String> {
    let pair = match credentials {
        RemoteCredentials::Anonymous => return Ok(None),
        RemoteCredentials::Basic { username, password } => (username.as_str(), password.as_str()),
        RemoteCredentials::Github { token } => (token.as_str(), "x-oauth-basic"),
        RemoteCredentials::Gitlab { token } => ("oauth2", token.as_str()),
    };
    if pair.0.is_empty()
        || pair.1.is_empty()
        || pair.0.len() > 16384
        || pair.1.len() > 16384
        || pair.0.chars().any(char::is_control)
        || pair.1.chars().any(char::is_control)
        || pair.0.contains(':')
    {
        return Err("Git credentials are empty or invalid.".into());
    }
    Ok(Some(pair))
}

fn remote_error(error: git2::Error) -> String {
    // libgit2/server messages may echo a URL or credential. Return codes only.
    format!(
        "Git remote request failed ({:?}/{:?}). Check the endpoint, credentials and connection.",
        error.class(),
        error.code()
    )
}

fn authentication_callbacks<'a>(
    url: &'a reqwest::Url,
    credentials: &'a RemoteCredentials,
) -> Result<RemoteCallbacks<'a>, String> {
    let pair = credential_pair(credentials)?;
    let mut attempts = 0;
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(move |requested, _, allowed| {
        attempts += 1;
        let requested = endpoint(requested)
            .map_err(|_| git2::Error::from_str("Invalid credential endpoint."))?;
        if requested.origin() != url.origin() || attempts > 2 {
            return Err(git2::Error::from_str(
                "Credential endpoint changed or authentication failed.",
            ));
        }
        let (username, password) =
            pair.ok_or_else(|| git2::Error::from_str("Remote requires authentication."))?;
        if allowed.contains(CredentialType::USER_PASS_PLAINTEXT) {
            Cred::userpass_plaintext(username, password)
        } else {
            Err(git2::Error::from_str(
                "Unsupported Git authentication method.",
            ))
        }
    });
    Ok(callbacks)
}

pub(crate) fn advertise(input: RemoteAdvertisementInput) -> Result<RemoteAdvertisement, String> {
    let url = endpoint(&input.url)?;
    let callbacks = authentication_callbacks(&url, &input.credentials)?;
    // Detached remotes do not read repository config or create local refs/files.
    // Default certificate validation remains enabled.
    let mut remote = Remote::create_detached(url.as_str()).map_err(remote_error)?;
    let connection = remote
        .connect_auth(Direction::Fetch, Some(callbacks), None)
        .map_err(remote_error)?;
    parse_advertisement(&url, connection.list().map_err(remote_error)?)
}

fn parse_advertisement(
    url: &reqwest::Url,
    heads: &[git2::RemoteHead<'_>],
) -> Result<RemoteAdvertisement, String> {
    if heads.len() > 10000 {
        return Err("Remote advertises more than 10000 references.".into());
    }
    let mut branches = Vec::new();
    let mut default_branch = None;
    let mut head_oid = None;
    let mut names = std::collections::HashSet::new();
    for head in heads {
        let reference = head.name();
        if reference.len() > 4096 || head.oid().as_bytes().len() != 20 {
            return Err("Unsupported remote reference or object format.".into());
        }
        if reference == "HEAD" {
            if !head.oid().is_zero() {
                head_oid = Some(head.oid().to_string());
            }
            if let Some(target) = head.symref_target() {
                if let Some(name) = target.strip_prefix("refs/heads/") {
                    if !git2::Reference::is_valid_name(target) {
                        return Err("Invalid remote default branch.".into());
                    }
                    default_branch = Some(name.to_owned());
                }
            }
        }
        let Some(name) = reference.strip_prefix("refs/heads/") else {
            continue;
        };
        if !git2::Reference::is_valid_name(reference)
            || head.oid().is_zero()
            || !names.insert(reference.to_owned())
        {
            return Err("Invalid or duplicate advertised branch.".into());
        }
        branches.push(AdvertisedBranch {
            name: name.to_owned(),
            reference: reference.to_owned(),
            oid: head.oid().to_string(),
        });
    }
    branches.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(RemoteAdvertisement {
        url: url.to_string(),
        branches,
        default_branch,
        head_oid,
        empty: heads.is_empty(),
        shallow_boundaries: Vec::new(),
    })
}

/// Private worker protocol, never accepted from a frontend command. The supervisor
/// must allocate a fresh path beneath its owned staging root and reap the worker
/// before inspecting or cleaning this directory.
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct StagedFetchInput {
    pub(crate) remote: RemoteAdvertisementInput,
    pub(crate) directory: std::path::PathBuf,
    /// Native-selected branch name, never a renderer-supplied refspec.
    #[serde(default)]
    pub(crate) branch: Option<String>,
    #[serde(default)]
    pub(crate) depth: Option<u32>,
}

pub(crate) fn validate_stage_parent(path: &std::path::Path) -> Result<(), String> {
    use std::path::Component;
    if !path.is_absolute()
        || path
            .components()
            .any(|part| matches!(part, Component::ParentDir | Component::CurDir))
    {
        return Err("Git staging directory must be an absolute normalized path.".into());
    }
    let parent = path.parent().ok_or("Missing Git staging parent.")?;
    for ancestor in parent.ancestors() {
        let metadata = std::fs::symlink_metadata(ancestor)
            .map_err(|_| "Cannot inspect Git staging parent.")?;
        if !metadata.is_dir() || metadata.file_type().is_symlink() {
            return Err("Git staging parents must be plain directories.".into());
        }
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            if metadata.file_attributes() & 0x400 != 0 {
                return Err("Git staging parents cannot be reparse points.".into());
            }
        }
    }
    Ok(())
}

/// Read only the owned staging repository's shallow metadata with a hard bound.
pub(crate) fn read_shallow_boundaries(
    directory: &std::path::Path,
) -> Result<Vec<git2::Oid>, String> {
    use std::io::Read;
    const MAX_BYTES: u64 = 410_000;
    let path = directory.join("shallow");
    let metadata = match std::fs::symlink_metadata(&path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(_) => return Err("Cannot inspect staged shallow boundaries.".into()),
    };
    if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > MAX_BYTES {
        return Err("Invalid staged shallow boundary file.".into());
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return Err("Shallow boundary file cannot be a reparse point.".into());
        }
    }
    let mut bytes = Vec::new();
    std::fs::File::open(&path)
        .map_err(|_| "Cannot open staged shallow boundaries.")?
        .take(MAX_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Cannot read staged shallow boundaries.")?;
    parse_shallow_boundaries(&bytes)
}

pub(crate) fn parse_shallow_boundaries(bytes: &[u8]) -> Result<Vec<git2::Oid>, String> {
    if bytes.len() > 410_000 {
        return Err("Staged shallow boundaries exceed size limit.".into());
    }
    let text = std::str::from_utf8(bytes).map_err(|_| "Invalid shallow boundary encoding.")?;
    let mut boundaries = std::collections::BTreeSet::new();
    for line in text.lines() {
        if line.len() != 40
            || !line
                .bytes()
                .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
        {
            return Err("Invalid shallow boundary object ID.".into());
        }
        let oid = git2::Oid::from_str(line).map_err(remote_error)?;
        if oid.is_zero() || !boundaries.insert(oid) || boundaries.len() > 10000 {
            return Err("Invalid, duplicate or excessive shallow boundaries.".into());
        }
    }
    Ok(boundaries.into_iter().collect())
}

/// Downloads full or explicitly depth-limited histories into a fresh bare repository.
/// Shallow publication/import, pruning and application of resources are separate.
pub(crate) fn fetch_stage(input: StagedFetchInput) -> Result<RemoteAdvertisement, String> {
    let depth = match input.depth {
        None => 0,
        Some(value) if value > 0 && value < i32::MAX as u32 => value as i32,
        Some(_) => return Err("Invalid fetch depth.".into()),
    };
    let refspec = if let Some(branch) = &input.branch {
        let reference = format!("refs/heads/{branch}");
        if reference.len() > 4096 || !git2::Reference::is_valid_name(&reference) {
            return Err("Invalid selected fetch branch.".into());
        }
        format!("+{reference}:refs/insomnium-stage/heads/{branch}")
    } else {
        "+refs/heads/*:refs/insomnium-stage/heads/*".to_owned()
    };
    let url = endpoint(&input.remote.url)?;
    let callbacks = authentication_callbacks(&url, &input.remote.credentials)?;
    validate_stage_parent(&input.directory)?;
    // create_dir is exclusive: never reinitialize an existing directory/repository.
    // On error/cancel the supervisor owns cleanup after worker termination.
    std::fs::create_dir(&input.directory)
        .map_err(|_| "Cannot create fresh Git staging directory.")?;
    let mut init = git2::RepositoryInitOptions::new();
    init.bare(true)
        .no_reinit(true)
        .external_template(false)
        .mkdir(false)
        .mkpath(false)
        .initial_head("insomnium-fetch-stage");
    let repository = git2::Repository::init_opts(&input.directory, &init).map_err(remote_error)?;
    // Do not inherit URL rewrites, certificate overrides, credential helpers,
    // pruning or remote settings from system/global Git configuration.
    let config = git2::Config::new().map_err(remote_error)?;
    repository.set_config(&config).map_err(remote_error)?;
    let mut remote = repository
        .remote_anonymous(url.as_str())
        .map_err(remote_error)?;
    let mut options = git2::FetchOptions::new();
    options
        .remote_callbacks(callbacks)
        .update_fetchhead(false)
        .download_tags(git2::AutotagOption::None)
        .prune(git2::FetchPrune::Off)
        .depth(depth)
        .follow_redirects(git2::RemoteRedirect::None);
    remote
        .fetch(&[refspec], Some(&mut options), None)
        .map_err(remote_error)?;
    let mut result = parse_advertisement(&url, remote.list().map_err(remote_error)?)?;
    if let Some(selected) = &input.branch {
        result.branches.retain(|branch| &branch.name == selected);
        if result.branches.len() != 1 {
            return Err("Selected fetch branch was not advertised.".into());
        }
    }
    let mut tips = Vec::new();
    for branch in &result.branches {
        let reference = format!("refs/insomnium-stage/heads/{}", branch.name);
        let oid = git2::Oid::from_str(&branch.oid).map_err(remote_error)?;
        let actual = repository.refname_to_id(&reference).map_err(remote_error)?;
        if actual != oid {
            return Err("Fetched reference does not match remote advertisement.".into());
        }
        tips.push(oid);
    }
    let boundaries = read_shallow_boundaries(&input.directory)?;
    if input.depth.is_none() && !boundaries.is_empty() {
        return Err("Full-history fetch returned shallow boundaries.".into());
    }
    if boundaries.is_empty() {
        validate_object_graph(&repository, &tips)?;
    } else {
        validate_object_graph_with_boundaries_while(&repository, &tips, &boundaries, || Ok(()))?;
    }
    result.shallow_boundaries = boundaries.iter().map(ToString::to_string).collect();
    Ok(result)
}

/// Validate the complete graph reachable from branch tips, including content
/// outside .insomnium. Gitlinks identify a different repository and are not
/// missing objects in this one. Returned OIDs are unique and hash-verified.
pub(crate) fn validate_object_graph(
    repository: &git2::Repository,
    tips: &[git2::Oid],
) -> Result<Vec<git2::Oid>, String> {
    validate_object_graph_while(repository, tips, || Ok(()))
}

pub(crate) fn validate_object_graph_while(
    repository: &git2::Repository,
    tips: &[git2::Oid],
    check_active: impl FnMut() -> Result<(), String>,
) -> Result<Vec<git2::Oid>, String> {
    validate_object_graph_with_boundaries_while(repository, tips, &[], check_active)
}

/// Explicit shallow boundaries cut only commit-parent traversal. Boundary commit,
/// tree and blob contents must still exist and match their hashes. Never infer
/// permission to omit parents from missing objects or managed repository config.
/// Callers must bind these boundaries to the fetched history they describe.
pub(crate) fn validate_object_graph_with_boundaries_while(
    repository: &git2::Repository,
    tips: &[git2::Oid],
    boundaries: &[git2::Oid],
    check_active: impl FnMut() -> Result<(), String>,
) -> Result<Vec<git2::Oid>, String> {
    inspect_object_graph(
        repository,
        &tips
            .iter()
            .map(|id| (*id, git2::ObjectType::Commit))
            .collect::<Vec<_>>(),
        boundaries,
        false,
        true,
        check_active,
    )
    .map(|plan| plan.objects)
}

pub(crate) struct ObjectGraphPlan {
    pub(crate) objects: Vec<git2::Oid>,
    pub(crate) shallow_boundaries: Vec<git2::Oid>,
}

/// Compute the cuts actually required by an object store containing old and new
/// histories. Candidates must come from verified fetch/existing shallow metadata;
/// a missing parent alone never authorizes a new cut. Available ancestry is
/// traversed and validated, so a shallow fetch cannot hide complete local history.
/// Unreachable candidates are omitted. Callers planning repository-wide metadata
/// must include every retained root and existing boundary as roots, including
/// older snapshots, reflogs and dangling shallow commits awaiting collection.
/// Does not write objects, refs, or the repository's shallow file.
pub(crate) fn plan_object_graph_while(
    repository: &git2::Repository,
    tips: &[git2::Oid],
    candidates: &[git2::Oid],
    check_active: impl FnMut() -> Result<(), String>,
) -> Result<ObjectGraphPlan, String> {
    inspect_object_graph(
        repository,
        &tips
            .iter()
            .map(|id| (*id, git2::ObjectType::Commit))
            .collect::<Vec<_>>(),
        candidates,
        true,
        false,
        check_active,
    )
}

/// Project a previously verified multi-tip boundary set onto one history view.
/// Honor every encountered cut even if its parents happen to be available.
pub(crate) fn history_view_while(
    repository: &git2::Repository,
    tip: git2::Oid,
    boundaries: &[git2::Oid],
    check_active: impl FnMut() -> Result<(), String>,
) -> Result<ObjectGraphPlan, String> {
    inspect_object_graph(
        repository,
        &[(tip, git2::ObjectType::Commit)],
        boundaries,
        false,
        false,
        check_active,
    )
}

fn inspect_object_graph(
    repository: &git2::Repository,
    tips: &[(git2::Oid, git2::ObjectType)],
    boundaries: &[git2::Oid],
    retain_available_ancestry: bool,
    require_all_boundaries: bool,
    mut check_active: impl FnMut() -> Result<(), String>,
) -> Result<ObjectGraphPlan, String> {
    check_active()?;
    use git2::{ObjectType, Oid};
    use std::collections::{HashMap, HashSet};
    const MAX_OBJECTS: usize = 1_000_000;
    const MAX_OBJECT_BYTES: usize = 256 * 1024 * 1024;
    const MAX_TOTAL_BYTES: u64 = 4 * 1024 * 1024 * 1024;

    fn enqueue(
        pending: &mut Vec<Oid>,
        kinds: &mut HashMap<Oid, ObjectType>,
        oid: Oid,
        kind: ObjectType,
    ) -> Result<(), String> {
        if oid.is_zero() {
            return Err("Fetched graph contains a zero object ID.".into());
        }
        if let Some(previous) = kinds.get(&oid) {
            if *previous != kind {
                return Err("Fetched graph references an object with conflicting types.".into());
            }
            return Ok(());
        }
        if kinds.len() >= MAX_OBJECTS {
            return Err("Fetched graph exceeds 1000000 objects.".into());
        }
        kinds.insert(oid, kind);
        pending.push(oid);
        Ok(())
    }

    if boundaries.len() > 10000 {
        return Err("Fetched history exceeds 10000 shallow boundaries.".into());
    }
    let boundary_set = boundaries.iter().copied().collect::<HashSet<_>>();
    if boundary_set.len() != boundaries.len() || boundaries.iter().any(Oid::is_zero) {
        return Err("Invalid or duplicate shallow boundary.".into());
    }
    let mut seen_boundaries = HashSet::new();
    let odb = repository.odb().map_err(remote_error)?;
    let mut kinds = HashMap::new();
    let mut pending = Vec::new();
    let mut verified = Vec::new();
    let mut total = 0u64;
    for (tip, kind) in tips {
        enqueue(&mut pending, &mut kinds, *tip, *kind)?;
    }
    while let Some(oid) = pending.pop() {
        check_active()?;
        let expected = kinds[&oid];
        let (size, kind) = odb.read_header(oid).map_err(remote_error)?;
        if kind != expected {
            return Err("Fetched object has an unexpected type.".into());
        }
        total = total
            .checked_add(size as u64)
            .ok_or("Fetched graph size overflow.")?;
        if size > MAX_OBJECT_BYTES || total > MAX_TOTAL_BYTES {
            return Err(
                "Fetched graph exceeds the 256 MiB object or 4 GiB validation limit.".into(),
            );
        }
        let object = odb.read(oid).map_err(remote_error)?;
        if object.kind() != expected
            || object.len() != size
            || Oid::hash_object(expected, object.data()).map_err(remote_error)? != oid
        {
            return Err("Fetched object content does not match its ID.".into());
        }
        match expected {
            ObjectType::Commit => {
                let commit = repository.find_commit(oid).map_err(remote_error)?;
                enqueue(&mut pending, &mut kinds, commit.tree_id(), ObjectType::Tree)?;
                let cut = boundary_set.contains(&oid)
                    && (!retain_available_ancestry
                        || commit.parent_ids().any(|parent| !odb.exists(parent)));
                if cut {
                    seen_boundaries.insert(oid);
                } else {
                    for parent in commit.parent_ids() {
                        enqueue(&mut pending, &mut kinds, parent, ObjectType::Commit)?;
                    }
                }
            }
            ObjectType::Tree => {
                let tree = repository.find_tree(oid).map_err(remote_error)?;
                let mut names = HashSet::new();
                for entry in &tree {
                    let name = entry.name_bytes();
                    if name.is_empty()
                        || name == b"."
                        || name == b".."
                        || name.contains(&b'/')
                        || !names.insert(name.to_vec())
                    {
                        return Err("Fetched tree contains an invalid or duplicate name.".into());
                    }
                    let kind = match entry.filemode_raw() {
                        0o040000 => ObjectType::Tree,
                        0o100644 | 0o100755 | 0o120000 => ObjectType::Blob,
                        0o160000 => continue, // Submodule commit lives in another repository.
                        _ => return Err("Fetched tree contains an unsupported file mode.".into()),
                    };
                    enqueue(&mut pending, &mut kinds, entry.id(), kind)?;
                }
            }
            ObjectType::Tag => {
                let tag = repository.find_tag(oid).map_err(remote_error)?;
                let kind = tag.target_type().ok_or("Tag has no target type.")?;
                if !matches!(
                    kind,
                    ObjectType::Commit | ObjectType::Tag | ObjectType::Tree | ObjectType::Blob
                ) {
                    return Err("Unsupported tag target type.".into());
                }
                enqueue(&mut pending, &mut kinds, tag.target_id(), kind)?;
            }
            ObjectType::Blob => {}
            _ => return Err("Unsupported fetched object type.".into()),
        }
        verified.push(oid);
    }
    check_active()?;
    if require_all_boundaries && seen_boundaries != boundary_set {
        return Err("Shallow boundary is not a reachable commit in this history.".into());
    }
    let mut shallow_boundaries = seen_boundaries.into_iter().collect::<Vec<_>>();
    shallow_boundaries.sort();
    Ok(ObjectGraphPlan {
        objects: verified,
        shallow_boundaries,
    })
}

impl RemoteAdvertisementInput {
    pub(crate) fn from_saved_binding(binding: &serde_json::Value) -> Result<Self, String> {
        let url = endpoint(
            binding["uri"]
                .as_str()
                .ok_or("Save a Git endpoint before fetching.")?,
        )?
        .to_string();
        let value = &binding["credentials"];
        let text = |key: &str| value[key].as_str().unwrap_or("").to_owned();
        let credentials = if value.is_null() {
            RemoteCredentials::Anonymous
        } else {
            match value["oauth2format"].as_str() {
                Some("github") => RemoteCredentials::Github {
                    token: text("token"),
                },
                Some("gitlab") => RemoteCredentials::Gitlab {
                    token: text("token"),
                },
                Some(_) => {
                    return Err("Unsupported saved Git authentication; save settings again.".into())
                }
                None => RemoteCredentials::Basic {
                    username: text("username"),
                    password: if text("password").is_empty() {
                        text("token")
                    } else {
                        text("password")
                    },
                },
            }
        };
        credential_pair(&credentials)?;
        Ok(Self { url, credentials })
    }
}

pub(crate) struct RepositoryGraphInput<'a> {
    pub(crate) repository: &'a git2::Repository,
    pub(crate) roots: &'a [git2::Oid],
    pub(crate) boundaries: &'a [git2::Oid],
    pub(crate) cancelled: &'a std::sync::atomic::AtomicBool,
}

impl TryFrom<RepositoryGraphInput<'_>> for ObjectGraphPlan {
    type Error = String;
    fn try_from(input: RepositoryGraphInput<'_>) -> Result<Self, String> {
        let check = || {
            if input.cancelled.load(std::sync::atomic::Ordering::SeqCst) {
                Err("Repository graph planning cancelled.".to_owned())
            } else {
                Ok(())
            }
        };
        check()?;
        if input.roots.len() > 1_000_000 {
            return Err("Repository graph exceeds root limit.".into());
        }
        let odb = input.repository.odb().map_err(remote_error)?;
        let roots = input
            .roots
            .iter()
            .map(|id| {
                check()?;
                let (_, kind) = odb.read_header(*id).map_err(remote_error)?;
                if !matches!(
                    kind,
                    git2::ObjectType::Commit
                        | git2::ObjectType::Tag
                        | git2::ObjectType::Tree
                        | git2::ObjectType::Blob
                ) {
                    return Err("Unsupported repository root type.".into());
                }
                Ok((*id, kind))
            })
            .collect::<Result<Vec<_>, String>>()?;
        inspect_object_graph(
            input.repository,
            &roots,
            input.boundaries,
            true,
            false,
            check,
        )
    }
}
