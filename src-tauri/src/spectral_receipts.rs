//! Private ASCII receipt metadata; diagnostic JSON remains opaque.
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs,
    io::Read,
    path::{Component, Path, PathBuf},
};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct ReadSet {
    version: u8,
    entries: Vec<Receipt>,
    coverage: Coverage,
}

#[cfg(test)]
mod tests {
    use super::*;
    fn encoded(path: &str) -> String {
        STANDARD.encode(
            path.encode_utf16()
                .flat_map(u16::to_le_bytes)
                .collect::<Vec<_>>(),
        )
    }
    fn root() -> PathBuf {
        let cwd = std::env::current_dir().unwrap();
        let repo = if cwd.join("src-tauri/Cargo.toml").is_file() {
            cwd
        } else {
            cwd.parent().unwrap().to_path_buf()
        };
        let path = repo
            .join("artifacts/spectral-managed-read-fix/rust-tests")
            .join(uuid::Uuid::new_v4().to_string());
        fs::create_dir_all(&path).unwrap();
        fs::canonicalize(path).unwrap()
    }
    fn row(path: &str, raw: &[u8]) -> Receipt {
        Receipt {
            logical: encoded(path),
            canonical: Some(encoded(path)),
            role: Role::Ruleset,
            outcome: Outcome::Bytes,
            bytes: Some(raw.len() as u64),
            sha256: Some(format!("{:x}", Sha256::digest(raw))),
        }
    }
    fn set(entries: Vec<Receipt>) -> ReadSet {
        ReadSet {
            version: 1,
            entries,
            coverage: Coverage {
                external: false,
                remote: false,
                ambient: true,
                resolution: true,
            },
        }
    }
    #[test]
    fn actual_changed_rule_is_refused() {
        let root = root();
        fs::write(root.join("a.yaml"), b"A").unwrap();
        let reads = set(vec![row("a.yaml", b"A")]);
        assert!(reads.verify(Some(&root), || Ok(())).is_ok());
        fs::write(root.join("a.yaml"), b"B").unwrap();
        assert_eq!(reads.verify(Some(&root), || Ok(())).unwrap_err(), "binding");
    }
    #[test]
    fn nonregular_directory_replacement_is_refused() {
        let root = root();
        let path = root.join("a.yaml");
        fs::write(&path, b"A").unwrap();
        let reads = set(vec![row("a.yaml", b"A")]);
        fs::remove_file(&path).unwrap();
        fs::create_dir(&path).unwrap();
        assert_eq!(reads.verify(Some(&root), || Ok(())).unwrap_err(), "binding");
    }
    #[cfg(unix)]
    #[test]
    fn nonregular_fifo_is_refused_before_blocking_open() {
        use std::os::unix::ffi::OsStrExt;
        extern "C" {
            fn mkfifo(path: *const std::ffi::c_char, mode: u32) -> i32;
        }
        let root = root();
        let path = root.join("a.yaml");
        let reads = set(vec![row("a.yaml", b"A")]);
        let name = std::ffi::CString::new(path.as_os_str().as_bytes()).unwrap();
        assert_eq!(unsafe { mkfifo(name.as_ptr(), 0o600) }, 0);
        assert_eq!(reads.verify(Some(&root), || Ok(())).unwrap_err(), "binding");
    }
    #[test]
    fn created_missing_fallback_dependency_is_refused() {
        let root = root();
        let reads = set(vec![Receipt {
            logical: encoded("missing.yaml"),
            canonical: None,
            role: Role::Module,
            outcome: Outcome::Missing,
            bytes: None,
            sha256: None,
        }]);
        assert!(reads.verify(Some(&root), || Ok(())).is_ok());
        fs::write(root.join("missing.yaml"), b"extends: []").unwrap();
        assert_eq!(reads.verify(Some(&root), || Ok(())).unwrap_err(), "binding");
    }
    #[test]
    fn conflicting_consumed_bytes_and_foreign_path_refused() {
        let root = root();
        fs::write(root.join("a.yaml"), b"A").unwrap();
        assert_eq!(
            set(vec![row("a.yaml", b"A"), row("a.yaml", b"B")])
                .verify(Some(&root), || Ok(()))
                .unwrap_err(),
            "binding"
        );
        assert_eq!(
            set(vec![row("../foreign", b"A")])
                .verify(Some(&root), || Ok(()))
                .unwrap_err(),
            "protocol"
        );
    }
    #[test]
    fn cancellation_during_hash_is_not_success() {
        let root = root();
        fs::write(root.join("a.yaml"), vec![b'x'; 131072]).unwrap();
        let reads = set(vec![row("a.yaml", &vec![b'x'; 131072])]);
        let mut n = 0;
        assert_eq!(
            reads
                .verify(Some(&root), || {
                    n += 1;
                    if n == 4 {
                        Err("cancelled".into())
                    } else {
                        Ok(())
                    }
                })
                .unwrap_err(),
            "cancelled"
        );
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Coverage {
    external: bool,
    remote: bool,
    ambient: bool,
    resolution: bool,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Receipt {
    logical: String,
    canonical: Option<String>,
    role: Role,
    outcome: Outcome,
    bytes: Option<u64>,
    sha256: Option<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
enum Role {
    Ruleset,
    Module,
    Reference,
}
#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
enum Outcome {
    Bytes,
    Missing,
}

fn relative(encoded: &str) -> Result<PathBuf, String> {
    let raw = STANDARD.decode(encoded).map_err(|_| "protocol")?;
    if raw.is_empty() || raw.len() % 2 != 0 {
        return Err("protocol".into());
    }
    let units: Vec<u16> = raw
        .chunks_exact(2)
        .map(|b| u16::from_le_bytes([b[0], b[1]]))
        .collect();
    if units.contains(&0) {
        return Err("protocol".into());
    }
    #[cfg(windows)]
    let path = {
        use std::os::windows::ffi::OsStringExt;
        PathBuf::from(std::ffi::OsString::from_wide(&units))
    };
    #[cfg(not(windows))]
    let path = PathBuf::from(String::from_utf16(&units).map_err(|_| "protocol")?);
    if path.is_absolute() || !path.components().all(|c| matches!(c, Component::Normal(_))) {
        return Err("protocol".into());
    }
    Ok(path)
}
fn contained(root: &Path, path: &Path) -> Result<PathBuf, String> {
    let canonical = fs::canonicalize(path).map_err(|_| "binding")?;
    if canonical == root || !canonical.starts_with(root) {
        return Err("binding".into());
    }
    Ok(canonical)
}
impl ReadSet {
    /// Hashes establish observed managed content, not a universal external-writer lease.
    pub(super) fn verify(
        &self,
        root: Option<&Path>,
        mut check: impl FnMut() -> Result<(), String>,
    ) -> Result<(), String> {
        check()?;
        if self.version != 1 {
            return Err("protocol".into());
        }
        // Coverage flags deliberately do not turn trusted external/ambient JS into a sandbox.
        let _unverified = (
            self.coverage.external,
            self.coverage.remote,
            self.coverage.ambient,
            self.coverage.resolution,
        );
        if root.is_none() {
            return if self.entries.is_empty() {
                Ok(())
            } else {
                Err("protocol".into())
            };
        }
        let root = root.unwrap();
        let mut observed = HashMap::new();
        let mut canonical_observed = HashMap::new();
        for entry in &self.entries {
            check()?;
            let logical = relative(&entry.logical)?;
            let path = root.join(&logical);
            let _role = &entry.role;
            match entry.outcome {
                Outcome::Missing => {
                    if entry.canonical.is_some() || entry.bytes.is_some() || entry.sha256.is_some()
                    {
                        return Err("protocol".into());
                    }
                    let mut parent = path.parent().ok_or("protocol")?;
                    while !parent.exists() {
                        check()?;
                        parent = parent.parent().ok_or("binding")?;
                    }
                    let parent = fs::canonicalize(parent).map_err(|_| "binding")?;
                    if !parent.starts_with(root) {
                        return Err("binding".into());
                    }
                    match fs::metadata(&path) {
                        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                        _ => return Err("binding".into()),
                    };
                    if let Some(old) = observed.insert(logical, (None, None)) {
                        if old != (None, None) {
                            return Err("binding".into());
                        }
                    }
                }
                Outcome::Bytes => {
                    let expected_path = relative(entry.canonical.as_deref().ok_or("protocol")?)?;
                    let expected_bytes = entry.bytes.ok_or("protocol")?;
                    let expected_hash = entry.sha256.as_deref().ok_or("protocol")?;
                    if expected_hash.len() != 64
                        || !expected_hash
                            .bytes()
                            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
                    {
                        return Err("protocol".into());
                    }
                    let canonical = contained(root, &path)?;
                    if canonical != root.join(&expected_path) {
                        return Err("binding".into());
                    }
                    if let Some(old) =
                        canonical_observed.insert(expected_path, (expected_bytes, expected_hash))
                    {
                        if old != (expected_bytes, expected_hash) {
                            return Err("binding".into());
                        }
                    }
                    if let Some(old) =
                        observed.insert(logical, (Some(expected_bytes), Some(expected_hash)))
                    {
                        if old != (Some(expected_bytes), Some(expected_hash)) {
                            return Err("binding".into());
                        }
                    }
                    if !fs::metadata(&canonical).map_err(|_| "binding")?.is_file() {
                        return Err("binding".into());
                    }
                    let mut file = fs::File::open(&canonical).map_err(|_| "binding")?;
                    if !file.metadata().map_err(|_| "binding")?.is_file() {
                        return Err("binding".into());
                    }
                    let mut digest = Sha256::new();
                    let mut size = 0u64;
                    let mut buffer = [0u8; 65536];
                    loop {
                        check()?;
                        let n = file.read(&mut buffer).map_err(|_| "binding")?;
                        if n == 0 {
                            break;
                        }
                        size = size.checked_add(n as u64).ok_or("binding")?;
                        if size > expected_bytes {
                            return Err("binding".into());
                        }
                        digest.update(&buffer[..n]);
                    }
                    if size != expected_bytes || format!("{:x}", digest.finalize()) != expected_hash
                    {
                        return Err("binding".into());
                    }
                }
            };
            check()?;
        }
        Ok(())
    }
}
