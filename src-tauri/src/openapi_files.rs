use serde::Serialize;
use std::{
    collections::HashMap,
    fs::File,
    io::Read,
    path::{Path, PathBuf},
};
use tauri_plugin_fs::FsExt;

const FILE_LIMIT: u64 = 2 * 1024 * 1024;
const TOTAL_LIMIT: u64 = 8 * 1024 * 1024;
const COUNT_LIMIT: usize = 32;

#[derive(Serialize, Clone)]
pub struct ReferenceFile {
    name: String,
    contents: String,
}

fn bounded_read(reader: impl Read, size: u64) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    reader
        .take(size + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 != size {
        return Err("API document changed size while reading; select it again.".into());
    }
    Ok(bytes)
}

fn read_files(
    paths: Vec<PathBuf>,
    existing_count: usize,
    existing_bytes: u64,
    allowed: impl Fn(&Path) -> bool,
) -> Result<Vec<ReferenceFile>, String> {
    if existing_count > COUNT_LIMIT || paths.len() > COUNT_LIMIT - existing_count {
        return Err("Reference files exceed 32 files or 8 MiB.".into());
    }
    let mut total = existing_bytes;
    if total > TOTAL_LIMIT {
        return Err("Reference files exceed 32 files or 8 MiB.".into());
    }
    // Maps each input path to its unique document so the result keeps one entry per input.
    let mut seen = HashMap::new();
    let mut order = Vec::new();
    let mut pending = Vec::new();
    // Preflight the entire selection before reading any document contents.
    for path in paths {
        if !allowed(&path) {
            return Err("Select the API document before reading it.".into());
        }
        let path = path.canonicalize().map_err(|e| e.to_string())?;
        if !allowed(&path) {
            return Err("API document is outside the selected filesystem scope.".into());
        }
        if let Some(index) = seen.get(&path) {
            order.push(*index);
            continue;
        }
        if !path.metadata().map_err(|e| e.to_string())?.is_file() {
            return Err("API document must be a regular file.".into());
        }
        let file = File::open(&path).map_err(|e| e.to_string())?;
        let actual = crate::legacy_response::opened_path(&file)
            .map_err(|(_, message)| message.to_owned())?;
        // Normalize both sides identically (verbatim prefix/case differ on Windows).
        let actual = actual.canonicalize().map_err(|e| e.to_string())?;
        if actual != path || !allowed(&actual) {
            return Err("Opened API document is outside the selected filesystem scope.".into());
        }
        let metadata = file.metadata().map_err(|e| e.to_string())?;
        if !metadata.is_file() {
            return Err("API document must be a regular file.".into());
        }
        let size = metadata.len();
        if size > FILE_LIMIT {
            return Err("API document exceeds 2 MiB.".into());
        }
        total = total.checked_add(size).ok_or("Reference size overflow.")?;
        if total > TOTAL_LIMIT {
            return Err("Reference files exceed 32 files or 8 MiB.".into());
        }
        seen.insert(path.clone(), pending.len());
        order.push(pending.len());
        pending.push((path, file, size));
    }
    let files: Vec<ReferenceFile> = pending
        .into_iter()
        .map(|(path, file, size)| {
            if !allowed(&path) {
                return Err("API document reading was cancelled.".into());
            }
            let bytes = bounded_read(file, size)?;
            let bytes = bytes.strip_prefix(&[0xef, 0xbb, 0xbf]).unwrap_or(&bytes);
            let contents = std::str::from_utf8(bytes)
                .map_err(|_| "Selected API document file is not valid UTF-8.")?
                .to_owned();
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or("API document filename must contain valid UTF-8.")?
                .to_owned();
            Ok(ReferenceFile { name, contents })
        })
        .collect::<Result<_, String>>()?;
    Ok(order.into_iter().map(|index| files[index].clone()).collect())
}

#[tauri::command]
pub async fn read_openapi_files(
    window: tauri::Window,
    state: tauri::State<'_, crate::http::NetworkState>,
    paths: Vec<PathBuf>,
    existing_count: usize,
    existing_bytes: u64,
) -> Result<Vec<ReferenceFile>, String> {
    let scope = window
        .try_fs_scope()
        .ok_or("Native filesystem scope is unavailable.")?;
    let lease = state.retain_native_work(format!("openapi-files_{}", uuid::Uuid::new_v4()))?;
    tauri::async_runtime::spawn_blocking(move || {
        let result = read_files(paths, existing_count, existing_bytes, |path| {
            !lease.cancelled() && scope.is_allowed(path)
        });
        if lease.cancelled() {
            Err("API document reading was cancelled.".into())
        } else {
            result
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn count_is_checked_before_open_and_growth_reads_only_one_extra_byte() {
        assert!(
            read_files(vec![PathBuf::from("must-not-open"); 33], 0, 0, |_| panic!(
                "preflight must reject count first"
            ))
            .is_err()
        );
        let mut reader = std::io::Cursor::new(vec![b'x'; 1024]);
        assert!(bounded_read(&mut reader, 10).is_err());
        assert_eq!(reader.position(), 11);
        assert_eq!(bounded_read(&b"abc"[..], 3).unwrap(), b"abc");
        assert!(bounded_read(&b"ab"[..], 3).is_err());
    }
    #[test]
    fn metadata_budget_and_duplicate_paths_keep_input_order() {
        let path = std::env::temp_dir().join(format!("insomnium-openapi-{}", uuid::Uuid::new_v4()));
        std::fs::write(&path, b"type: string").unwrap();
        let size = std::fs::metadata(&path).unwrap().len();
        assert!(read_files(vec![path.clone()], 31, TOTAL_LIMIT - size, |_| true).is_ok());
        assert!(read_files(vec![path.clone()], 31, TOTAL_LIMIT - size + 1, |_| true).is_err());
        assert_eq!(
            read_files(vec![path.clone(), path.clone()], 0, 0, |_| true)
                .unwrap()
                .len(),
            2
        );
        std::fs::remove_file(path).unwrap();
    }
}
