//! Reclaim only idle v2 fetch staging. Never accepts a renderer filesystem path.
use std::{fs, io::Read, path::Path};
use tauri::Manager;

#[derive(Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupReport {
    removed: usize,
    active: usize,
    retained: usize,
    limited: bool,
}

fn plain_metadata(path: &Path) -> Result<fs::Metadata, String> {
    let metadata = fs::symlink_metadata(path).map_err(|_| "Cannot inspect fetch staging.")?;
    if metadata.file_type().is_symlink() {
        return Err("Fetch staging contains a symbolic link.".into());
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return Err("Fetch staging contains a reparse point.".into());
        }
    }
    Ok(metadata)
}

fn owner(path: &Path) -> Result<Vec<u8>, String> {
    let metadata = plain_metadata(path)?;
    if !metadata.is_file() || metadata.len() > 256 {
        return Err("Invalid fetch staging owner.".into());
    }
    let mut bytes = Vec::new();
    fs::File::open(path)
        .map_err(|_| "Cannot open fetch staging owner.")?
        .take(257)
        .read_to_end(&mut bytes)
        .map_err(|_| "Cannot read fetch staging owner.")?;
    if bytes.len() > 256 {
        return Err("Fetch owner exceeds limit.".into());
    }
    let text = std::str::from_utf8(&bytes).map_err(|_| "Invalid fetch owner encoding.")?;
    let lines = text.lines().collect::<Vec<_>>();
    if lines.len() != 3
        || lines[0] != "insomnium-fetch-stage-v2"
        || uuid::Uuid::parse_str(lines[1])
            .map(|id| id.to_string())
            .ok()
            .as_deref()
            != Some(lines[1])
        || lines[2]
            .parse::<u32>()
            .ok()
            .filter(|pid| *pid != 0)
            .is_none()
    {
        return Err("Unsupported fetch staging owner.".into());
    }
    Ok(bytes)
}

fn plain_tree(path: &Path, budget: &mut usize) -> Result<(), String> {
    let mut pending = vec![path.to_owned()];
    while let Some(path) = pending.pop() {
        if *budget == 0 {
            return Err("Fetch cleanup inspection limit reached.".into());
        }
        *budget -= 1;
        let metadata = plain_metadata(&path)?;
        if metadata.is_dir() {
            for entry in fs::read_dir(&path).map_err(|_| "Cannot inspect fetch staging tree.")? {
                if pending.len() >= *budget {
                    *budget = 0;
                    return Err("Fetch cleanup inspection limit reached.".into());
                }
                pending.push(
                    entry
                        .map_err(|_| "Cannot inspect fetch staging entry.")?
                        .path(),
                );
            }
        } else if !metadata.is_file() {
            return Err("Fetch staging contains a special file.".into());
        }
    }
    Ok(())
}

fn valid_name(name: &str) -> bool {
    let id = name
        .strip_prefix("fetch-")
        .or_else(|| name.strip_prefix("reclaim-"));
    id.is_some_and(|id| {
        uuid::Uuid::parse_str(id)
            .map(|uuid| uuid.to_string())
            .ok()
            .as_deref()
            == Some(id)
    })
}

// false means a cooperative parent/worker/cleaner still holds the lease.
fn reclaim(_root: &Path, directory: &Path, budget: &mut usize) -> Result<bool, String> {
    crate::git_remote::validate_stage_parent(&directory.join("repository"))?;
    let lease_path = directory.join(".insomnium-fetch-lease");
    let metadata = plain_metadata(&lease_path)?;
    if !metadata.is_file() || metadata.len() != 0 {
        return Err("Invalid staging lease.".into());
    }
    let lease = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(&lease_path)
        .map_err(|_| "Cannot open staging lease.")?;
    match lease.try_lock() {
        Ok(()) => {}
        Err(fs::TryLockError::WouldBlock) => return Ok(false),
        Err(_) => return Err("Cannot acquire exclusive staging lease.".into()),
    }
    let marker = owner(&directory.join(".insomnium-fetch-owner"))?;
    // Unexpected top-level material must never become cleanup collateral.
    for entry in fs::read_dir(directory).map_err(|_| "Cannot inspect staging container.")? {
        let name = entry
            .map_err(|_| "Cannot inspect staging entry.")?
            .file_name();
        if name != ".insomnium-fetch-owner"
            && name != ".insomnium-fetch-lease"
            && name != "repository"
        {
            return Err("Unexpected staging container entry.".into());
        }
    }
    plain_tree(directory, budget)?;
    if owner(&directory.join(".insomnium-fetch-owner"))? != marker {
        return Err("Fetch staging ownership changed.".into());
    }
    // Windows cannot rename a directory containing this open lease. Keep the
    // exclusive lease and delete in place instead of releasing it for a rename.
    // A delayed worker cannot acquire its shared lease until deletion completes,
    // then its ownership/path checks fail on the removed container.
    let cleanup_path = directory.to_owned();
    let repository = cleanup_path.join("repository");
    match fs::symlink_metadata(&repository) {
        Ok(metadata) if metadata.is_dir() => {
            fs::remove_dir_all(&repository).map_err(|_| "Cannot remove idle fetch repository.")?
        }
        Ok(_) => return Err("Invalid idle staging repository.".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(_) => return Err("Cannot inspect idle staging repository.".into()),
    }
    // Keep ownership evidence until the repository payload has been removed.
    fs::remove_dir_all(&cleanup_path).map_err(|_| "Cannot finish fetch staging removal.")?;
    drop(lease);
    Ok(true)
}

pub(crate) fn cleanup(app_data: &Path) -> Result<CleanupReport, String> {
    let root = app_data.join("git-fetch-v1");
    match fs::symlink_metadata(&root) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(CleanupReport::default())
        }
        Err(_) => return Err("Cannot inspect fetch staging root.".into()),
        Ok(_) => {}
    }
    crate::git_remote::validate_stage_parent(&root.join("entry"))?;
    // Complete the ownership inventory before the first deletion. Caller holds
    // GitState so a publisher cannot create a new journal between scan and delete.
    let retained = crate::git_fetch_journal::retained_stages(app_data)?;
    let mut report = CleanupReport::default();
    let mut budget = 1_100_000;
    for (index, entry) in fs::read_dir(&root)
        .map_err(|_| "Cannot enumerate fetch staging.")?
        .enumerate()
    {
        if index >= 1024 || budget == 0 {
            report.limited = true;
            break;
        }
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => {
                report.retained += 1;
                continue;
            }
        };
        if !entry.file_name().to_str().is_some_and(valid_name) {
            report.retained += 1;
            continue;
        }
        let name = entry.file_name();
        let name = name.to_str().ok_or("Invalid staging name.")?;
        let journal_name = name
            .strip_prefix("reclaim-")
            .map(|id| format!("fetch-{id}"))
            .unwrap_or_else(|| name.to_owned());
        if retained.contains(&journal_name) {
            report.retained += 1;
            continue;
        }
        match reclaim(&root, &entry.path(), &mut budget) {
            Ok(true) => report.removed += 1,
            Ok(false) => report.active += 1,
            Err(_) => report.retained += 1,
        }
    }
    report.limited |= budget == 0;
    Ok(report)
}

/// Explicit maintenance only; publication/checkout/workspace contents are untouched.
#[tauri::command]
pub async fn git_remote_cleanup_staging(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::git::GitState>,
) -> Result<CleanupReport, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|_| "Cannot resolve application data.")?;
    let git_lock = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _git = git_lock.lock().map_err(|_| "Git lock failed.")?;
        cleanup(&directory)
    })
    .await
    .map_err(|_| "Fetch staging cleanup failed.")?
}
