//! Inspection accepts data replies only; no child frame grants a host capability.
use crate::plugin_package::PluginPackageSource;
use serde::Deserialize;

const OUTPUT_LIMIT: usize = 256 * 1024;

#[derive(Deserialize)]
#[serde(
    tag = "type",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
enum Reply {
    Metadata {
        protocol: u32,
        job_id: String,
        wire: String,
    },
    Error {
        protocol: u32,
        job_id: String,
        error: String,
    },
}

fn reply(bytes: &[u8], job_id: &str) -> Result<String, String> {
    if bytes.len() > OUTPUT_LIMIT {
        return Err("Plugin inspection output exceeds its limit".into());
    }
    match serde_json::from_slice::<Reply>(bytes).map_err(|_| "Invalid plugin inspection reply")? {
        Reply::Metadata {
            protocol: 1,
            job_id: owner,
            wire,
        } if owner == job_id && wire.len() <= OUTPUT_LIMIT => Ok(wire),
        Reply::Error {
            protocol: 1,
            job_id: owner,
            error,
        } if owner == job_id && error.len() <= 8192 => Err(error),
        _ => Err("Invalid plugin inspection owner or protocol".into()),
    }
}

fn source_path(path: &str) -> bool {
    !path.is_empty()
        && path.len() <= 2048
        && path.split('/').all(|part| {
            if part.is_empty()
                || part == "."
                || part == ".."
                || part.ends_with(['.', ' '])
                || part
                    .chars()
                    .any(|c| c.is_control() || "\\:*?\"<>|".contains(c))
            {
                return false;
            }
            let stem = part.split('.').next().unwrap_or("").to_ascii_uppercase();
            if matches!(
                stem.as_str(),
                "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$"
            ) {
                return false;
            }
            !["COM", "LPT"].iter().any(|prefix| {
                stem.strip_prefix(prefix).is_some_and(|suffix| {
                    matches!(
                        suffix,
                        "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "¹" | "²" | "³"
                    )
                })
            })
        })
}

fn validate(snapshot: &PluginPackageSource) -> Result<(), String> {
    if snapshot.name.len() > 256
        || !matches!(snapshot.format.as_str(), "commonjs" | "module")
        || snapshot.files.is_empty()
        || snapshot.files.len() > 128
        || !snapshot.files.contains_key(&snapshot.entry)
        || ![".js", ".cjs", ".mjs"]
            .iter()
            .any(|extension| snapshot.entry.ends_with(extension))
    {
        return Err("Invalid plugin inspection snapshot".into());
    }
    let mut total = 0;
    for (path, source) in &snapshot.files {
        if !source_path(path)
            || ![".js", ".cjs", ".mjs", ".json"]
                .iter()
                .any(|extension| path.ends_with(extension))
            || source.len() > 1024 * 1024
        {
            return Err("Invalid plugin inspection source".into());
        }
        total += source.len();
        if total > 8 * 1024 * 1024 {
            return Err("Plugin inspection snapshot exceeds its limit".into());
        }
    }
    Ok(())
}

#[cfg(windows)]
pub(crate) fn stage(
    executable: &std::path::Path,
    expected_sha256: &str,
    snapshot: &PluginPackageSource,
    check: &dyn Fn() -> Result<(), String>,
) -> Result<crate::plugin_sandbox::Sandbox, String> {
    use std::{
        fs::{self, OpenOptions},
        io::Write,
    };
    check()?;
    validate(snapshot)?;
    let sandbox = crate::plugin_sandbox::Sandbox::new(executable)?;
    verify_executable(&sandbox.executable, expected_sha256, check)?;
    let package = sandbox.directory.join("package");
    fs::create_dir(&package).map_err(|error| error.to_string())?;
    for (path, source) in &snapshot.files {
        check()?;
        let file = package.join(path);
        fs::create_dir_all(file.parent().ok_or("Invalid plugin source path")?)
            .map_err(|error| error.to_string())?;
        OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&file)
            .and_then(|mut file| file.write_all(source.as_bytes()))
            .map_err(|error| error.to_string())?;
    }
    if !snapshot.files.contains_key("package.json") {
        fs::write(
            package.join("package.json"),
            if snapshot.format == "module" {
                "{\"type\":\"module\"}"
            } else {
                "{\"type\":\"commonjs\"}"
            },
        )
        .map_err(|error| error.to_string())?;
    }
    check()?;
    Ok(sandbox)
}

#[cfg(windows)]
pub(crate) fn inspect(
    executable: &std::path::Path,
    expected_sha256: &str,
    snapshot: &PluginPackageSource,
    check: &dyn Fn() -> Result<(), String>,
) -> Result<String, String> {
    use std::{
        io::{Read, Write},
        time::{Duration, Instant},
    };
    let mut sandbox = stage(executable, expected_sha256, snapshot, check)?;
    let job_id = uuid::Uuid::new_v4().to_string();
    let input=serde_json::to_vec(&serde_json::json!({"protocol":1,"jobId":job_id,"name":snapshot.name,"entry":snapshot.entry,"format":snapshot.format})).map_err(|error|error.to_string())?;
    let mut process =
        crate::spectral_process::Process::spawn(&sandbox.executable, check, Some(&sandbox))?;
    let deadline = process.started() + Duration::from_secs(2);
    let (mut stdin, stdout, stderr) = process.take_pipes();
    let writer = std::thread::Builder::new()
        .name("plugin-input".into())
        .spawn(move || stdin.write_all(&input))
        .map_err(|error| error.to_string())?;
    let output = match std::thread::Builder::new()
        .name("plugin-output".into())
        .spawn(move || {
            let mut bytes = Vec::new();
            stdout
                .take((OUTPUT_LIMIT + 1) as u64)
                .read_to_end(&mut bytes)
                .map(|_| bytes)
        }) {
        Ok(worker) => worker,
        Err(error) => {
            drop(process);
            let _ = writer.join();
            return Err(error.to_string());
        }
    };
    let errors = match std::thread::Builder::new()
        .name("plugin-errors".into())
        .spawn(move || {
            let mut bytes = Vec::new();
            stderr.take(65537).read_to_end(&mut bytes).map(|_| bytes)
        }) {
        Ok(worker) => worker,
        Err(error) => {
            drop(process);
            let _ = writer.join();
            let _ = output.join();
            return Err(error.to_string());
        }
    };
    let result = loop {
        if let Err(error) = check() {
            break Err(error);
        }
        if Instant::now() >= deadline {
            break Err("Plugin module initialization interrupted".into());
        }
        match process.exited() {
            Ok(Some(code)) => break Ok(code),
            Err(error) => break Err(error),
            _ => {}
        }
        std::thread::sleep(Duration::from_millis(5));
    };
    let reaped = process.kill_and_reap();
    let written = writer
        .join()
        .map_err(|_| "Plugin inspection input worker failed");
    let output = output
        .join()
        .map_err(|_| "Plugin inspection output worker failed");
    let errors = errors
        .join()
        .map_err(|_| "Plugin inspection error worker failed");
    #[cfg(test)]
    let source_unchanged = if snapshot
        .files
        .get("canary.json")
        .is_some_and(|v| v == "must-survive")
    {
        Some([&snapshot.entry, "canary.json"].iter().all(|path| {
            std::fs::read(sandbox.directory.join("package").join(path))
                .ok()
                .as_deref()
                == Some(snapshot.files[*path].as_bytes())
        }))
    } else {
        None
    };
    let cleaned = sandbox.remove();
    reaped?;
    cleaned?;
    #[cfg(test)]
    if let Some(unchanged) = source_unchanged {
        assert!(unchanged, "Sandbox source was modified");
    }
    let code = result?;
    check()?;
    written?.map_err(|error| error.to_string())?;
    let output = output?.map_err(|error| error.to_string())?;
    let errors = errors?.map_err(|error| error.to_string())?;
    if errors.len() > 65536 {
        return Err("Plugin inspection error output exceeds its limit".into());
    }
    if code != 0 && output.is_empty() {
        return Err("Plugin inspection process failed before initialization completed".into());
    }
    let metadata = reply(&output, &job_id)?;
    if code != 0 {
        return Err("Plugin inspection process failed".into());
    }
    Ok(metadata)
}

#[cfg(windows)]
fn verify_executable(
    path: &std::path::Path,
    expected: &str,
    check: &dyn Fn() -> Result<(), String>,
) -> Result<(), String> {
    use sha2::{Digest, Sha256};
    use std::io::Read;
    crate::git::reject_link(path)?;
    let mut file = std::fs::File::open(path).map_err(|error| error.to_string())?;
    let length = file.metadata().map_err(|error| error.to_string())?.len();
    if length == 0 || length > 256 * 1024 * 1024 {
        return Err("Invalid Bun inspection binary size".into());
    }
    let mut hash = Sha256::new();
    let mut bytes = [0u8; 65536];
    loop {
        check()?;
        let read = file.read(&mut bytes).map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        hash.update(&bytes[..read]);
    }
    if format!("{:x}", hash.finalize()) != expected {
        return Err("Bun inspection binary identity mismatch".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inspection_replies_cannot_request_host_authority() {
        for bytes in [
            br#"{"type":"helper","protocol":1,"jobId":"current","method":"store.clear"}"#.as_slice(),
            br#"{"type":"metadata","protocol":1,"jobId":"retired","wire":"data"}"#.as_slice(),
            br#"{"type":"metadata","protocol":1,"jobId":"current","wire":"data","helper":"store.clear"}"#.as_slice(),
            br#"{"type":"metadata","protocol":1,"jobId":"current","wire":"one"}{"type":"helper"}"#.as_slice(),
        ] {assert!(reply(bytes,"current").is_err());}
        assert_eq!(
            reply(
                br#"{"type":"metadata","protocol":1,"jobId":"current","wire":"data"}"#,
                "current"
            )
            .unwrap(),
            "data"
        );
        for path in [
            "../entry.js",
            "/entry.js",
            "C:/entry.js",
            "a\\entry.js",
            "NUL.js",
            "COM1/a.js",
            "a./entry.js",
            "a/../entry.js",
        ] {
            assert!(!source_path(path), "{path}");
        }
        assert!(source_path("node_modules/package/ไทย.mjs"));
    }

    #[cfg(windows)]
    #[test]
    #[ignore = "Requires an explicitly compiled owned Bun inspection candidate"]
    fn bun_inspects_snapshots_without_invoking_contributions() {
        let executable = std::path::PathBuf::from(
            std::env::var_os("INSOMNIUM_BUN_INSPECT_EXE")
                .expect("Explicit owned Bun inspection candidate required"),
        );
        use sha2::{Digest, Sha256};
        let expected = format!("{:x}", Sha256::digest(std::fs::read(&executable).unwrap()));
        assert!(verify_executable(&executable, &"0".repeat(64), &|| Ok(())).is_err());
        let protected = PluginPackageSource {
            name: "inspection".into(),
            entry: "main.cjs".into(),
            format: "commonjs".into(),
            files: std::collections::BTreeMap::from([
                (
                    "main.cjs".into(),
                    std::fs::read_to_string(
                        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                            .join("../tests/ui/fixtures/plugin-sandbox.cjs"),
                    )
                    .unwrap(),
                ),
                ("canary.json".into(), "must-survive".into()),
            ]),
        };
        assert_eq!(
            super::inspect(&executable, &expected, &protected, &|| Ok(())).unwrap(),
            std::fs::read_to_string(executable.with_extension("expected.json")).unwrap()
        );
        crate::plugin_bun_session::verify_native_session(&executable);
        let inspect = |executable: &std::path::Path,
                       snapshot: &PluginPackageSource,
                       check: &dyn Fn() -> Result<(), String>| {
            super::inspect(executable, &expected, snapshot, check)
        };
        for (entry,format,source) in [
            ("main.cjs","commonjs","setInterval(()=>{},1000);console.log('package diagnostic');exports.themes=[{name:'literal',theme:{background:{default:'#111'}}}];exports.requestHooks=[()=>{throw Error('must not invoke');}];"),
            ("main.mjs","module","await new Promise(resolve=>setTimeout(resolve,5));export const themes=[{name:'literal',theme:{background:{default:'#111'}}}];export const requestHooks=[()=>{throw Error('must not invoke');}];"),
        ] {
            let snapshot=PluginPackageSource{name:"inspection".into(),entry:entry.into(),format:format.into(),files:std::collections::BTreeMap::from([(entry.into(),source.into())])};
            let wire=inspect(&executable,&snapshot,&||Ok(())).unwrap();
            assert_eq!(wire,std::fs::read_to_string(executable.with_extension("expected.json")).unwrap());
        }
        let snapshot=PluginPackageSource{name:"forgery".into(),entry:"main.cjs".into(),format:"commonjs".into(),files:std::collections::BTreeMap::from([("main.cjs".into(),"process.stdout.write(JSON.stringify({type:'helper',protocol:1,jobId:'forged',method:'store.clear'}));process.exit(0);".into())])};
        assert!(inspect(&executable, &snapshot, &|| Ok(()))
            .unwrap_err()
            .contains("Invalid plugin inspection reply"));
        let target = executable.with_extension("cleanup-target");
        assert!(!target.exists());
        std::fs::create_dir(&target).unwrap();
        let canary = target.join("keep.txt");
        std::fs::write(&canary, "must-survive-profile-cleanup").unwrap();
        let source="const fs=require('node:fs');let outcome;try{fs.symlinkSync(TARGET,'cleanup-link','junction');outcome='link-created';}catch(error){if(!['EPERM','EACCES'].includes(error.code))throw error;outcome='link-denied';}exports.themes=[{name:outcome,theme:{background:{default:'#111'}}}];".replace("TARGET",&serde_json::to_string(&target).unwrap());
        let cleanup = PluginPackageSource {
            name: "cleanup".into(),
            entry: "main.cjs".into(),
            format: "commonjs".into(),
            files: std::collections::BTreeMap::from([("main.cjs".into(), source)]),
        };
        let result = inspect(&executable, &cleanup, &|| Ok(()));
        let preserved = std::fs::read_to_string(&canary);
        if canary.exists() {
            std::fs::remove_file(&canary).unwrap();
        }
        std::fs::remove_dir(&target).unwrap();
        let wire = result.unwrap();
        assert!(wire.contains("link-created") || wire.contains("link-denied"));
        assert_eq!(preserved.unwrap(), "must-survive-profile-cleanup");
        let blocked = PluginPackageSource {
            name: "bounded".into(),
            entry: "main.mjs".into(),
            format: "module".into(),
            files: std::collections::BTreeMap::from([(
                "main.mjs".into(),
                "await new Promise(()=>{});export const themes=[];".into(),
            )]),
        };
        let turns = std::cell::Cell::new(0);
        let cancelled = inspect(&executable, &blocked, &|| {
            turns.set(turns.get() + 1);
            if turns.get() >= 8 {
                Err("owner-retired".into())
            } else {
                Ok(())
            }
        });
        assert_eq!(cancelled.unwrap_err(), "owner-retired");
        assert!(inspect(&executable, &blocked, &|| Ok(()))
            .unwrap_err()
            .contains("initialization interrupted"));
    }
}
