//! Immutable, in-memory Spectral reservations. Never stage source documents.
use crate::spectral_jobs::{
    bounded_lock, owner_label, Cancel, Identity, Manager as JobManager, Payload, Token,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    path::{Path, PathBuf},
    sync::{atomic::Ordering, Arc},
    time::Instant,
};
use tauri::Manager;

pub(crate) const INPUT_LIMIT: usize = 24 * 1024 * 1024;
pub(crate) const WIRE_LIMIT: usize = 48 * 1024 * 1024;
pub(crate) const OUTPUT_LIMIT: usize = 16 * 1024 * 1024;
pub(crate) const RESULT_LIMIT: usize = 8 * 1024 * 1024;
pub(crate) const STDERR_LIMIT: usize = 64 * 1024;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReserveInput {
    pub workspace_id: String,
    pub spec_id: String,
    pub source_json: String,
    pub repository_id: Option<String>,
    pub expected_binding: Option<Value>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Reservation {
    job_id: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LintResult {
    job_id: String,
    result_json: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelResult {
    job_id: String,
    cancelled: bool,
}
#[derive(Clone)]
pub struct SpectralState(Arc<JobManager>);
impl Default for SpectralState {
    fn default() -> Self {
        Self(Arc::new(JobManager::new()))
    }
}

fn owner(window: &tauri::WebviewWindow) -> Result<(), String> {
    owner_label(window.label())
}
fn valid_id(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 200
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}
fn private(v: &Value) -> bool {
    v.get("isPrivate").is_some_and(|v| match v {
        Value::Null => false,
        Value::Bool(v) => *v,
        Value::Number(v) => v.as_f64() != Some(0.0),
        Value::String(v) => !v.is_empty(),
        _ => true,
    })
}

fn binding(
    app: &tauri::AppHandle,
    input: &Identity,
    token: &Token,
) -> Result<Option<PathBuf>, String> {
    token.check()?;
    let Some(id) = &input.repository_id else {
        return if input.expected_binding.is_none() {
            Ok(None)
        } else {
            Err("binding".into())
        };
    };
    let expected = input.expected_binding.as_ref().ok_or("binding")?;
    if serde_json::to_vec(expected).map_err(|_| "binding")?.len() > 65536 {
        return Err("input_limit".into());
    }
    let directory = app.path().app_data_dir().map_err(|_| "binding")?;
    let git = app.state::<crate::git::GitState>();
    let storage = app.state::<crate::storage::StorageState>();
    let _git = bounded_lock(&git.0, token)?;
    let _storage = bounded_lock(&storage.0, token)?;
    crate::storage::ensure_no_pending_transition(&directory).map_err(|_| "binding")?;
    let data = crate::storage::read_workspace_file(&directory)
        .map_err(|_| "binding")?
        .ok_or("binding")?;
    token.check()?;
    let records = data["resources"].as_array().ok_or("binding")?;
    let workspace = records
        .iter()
        .find(|r| r["_type"] == "workspace" && r["_id"] == input.workspace_id)
        .ok_or("binding")?;
    if private(workspace) {
        return Err("binding".into());
    }
    // Unsaved specs are permitted; saved identities must remain in this collection.
    if let Some(spec) = records.iter().find(|r| r["_id"] == input.spec_id) {
        if spec["_type"] != "api_spec" || spec["parentId"] != input.workspace_id || private(spec) {
            return Err("binding".into());
        }
    }
    let bindings: Vec<_> = records
        .iter()
        .filter(|r| r["_type"] == "git_repository" && r["parentId"] == input.workspace_id)
        .collect();
    if bindings.len() != 1
        || bindings[0] != expected
        || private(expected)
        || expected["nativeBindingVersion"] != 1
        || expected["nativeRepositoryId"] != *id
        || records
            .iter()
            .filter(|r| r["_type"] == "git_repository" && r["nativeRepositoryId"] == *id)
            .count()
            != 1
        || [
            "nativeFetchIntent",
            "nativeCreateIntent",
            "nativePushIntent",
            "nativeRemoteCheckoutIntent",
        ]
        .iter()
        .any(|key| !expected[*key].is_null())
    {
        return Err("binding".into());
    }
    let path = crate::git::managed_path(&directory.join("git-v1"), id).map_err(|_| "binding")?;
    crate::git::open_managed(&path).map_err(|_| "binding")?;
    token.check()?;
    crate::git::reject_link(&path.join("other")).map_err(|_| "binding")?;
    crate::git::reject_link(&path.join("other/.spectral.yaml")).map_err(|_| "binding")?;
    let canonical = std::fs::canonicalize(path).map_err(|_| "binding")?;
    token.check()?;
    Ok(Some(canonical))
}

#[tauri::command]
pub fn reserve_spectral_lint(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, SpectralState>,
    input: ReserveInput,
) -> Result<Reservation, String> {
    owner(&window)?;
    if !valid_id(&input.workspace_id)
        || !valid_id(&input.spec_id)
        || input.source_json.len() > INPUT_LIMIT
    {
        return Err("input_limit".into());
    }
    if input.repository_id.is_some() != input.expected_binding.is_some() {
        return Err("binding".into());
    }
    if input
        .repository_id
        .as_ref()
        .is_some_and(|id| id.len() > 100 || !valid_id(id))
    {
        return Err("binding".into());
    }
    if input
        .expected_binding
        .as_ref()
        .is_some_and(|value| serde_json::to_vec(value).map_or(true, |bytes| bytes.len() > 65536))
    {
        return Err("input_limit".into());
    }
    let id = state.0.reserve(Payload {
        identity: Identity {
            workspace_id: input.workspace_id,
            spec_id: input.spec_id,
            repository_id: input.repository_id,
            expected_binding: input.expected_binding,
        },
        source_json: input.source_json,
    })?;
    Ok(Reservation { job_id: id })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Envelope<'a> {
    protocol: u8,
    job_id: &'a str,
    source_json: &'a str,
    repository_root: Option<&'a Path>,
    ruleset_path: Option<PathBuf>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Reply {
    protocol: u8,
    job_id: String,
    result_json: Option<String>,
    error: Option<ErrorFrame>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ErrorFrame {
    code: String,
}
fn allowed_error(code: &str) -> bool {
    matches!(
        code,
        "cancelled"
            | "timeout"
            | "input_limit"
            | "output_limit"
            | "binding"
            | "process"
            | "protocol"
            | "capacity"
            | "expired"
            | "owner"
    )
}
fn parse_reply(bytes: &[u8], id: &str) -> Result<String, String> {
    let body = bytes.strip_suffix(b"\n").ok_or("protocol")?;
    if body.contains(&b'\n') {
        return Err("protocol".into());
    }
    let reply: Reply = serde_json::from_slice(body).map_err(|_| "protocol")?;
    if reply.protocol != 1 || reply.job_id != id {
        return Err("protocol".into());
    }
    match (reply.result_json, reply.error) {
        (Some(result), None) if result.len() <= RESULT_LIMIT => Ok(result),
        (Some(_), None) => Err("output_limit".into()),
        (None, Some(error)) if allowed_error(&error.code) => Err(error.code),
        _ => Err("protocol".into()),
    }
}
fn executable() -> Result<PathBuf, String> {
    let parent = std::env::current_exe()
        .map_err(|_| "process")?
        .parent()
        .ok_or("process")?
        .to_path_buf();
    let path = parent.join(if cfg!(windows) {
        "spectral-linter.exe"
    } else {
        "spectral-linter"
    });
    crate::git::reject_link(&path).map_err(|_| "process")?;
    if !std::fs::metadata(&path).is_ok_and(|m| m.is_file()) {
        return Err("process".into());
    }
    Ok(path)
}
#[tauri::command]
pub async fn run_spectral_lint(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    state: tauri::State<'_, SpectralState>,
    job_id: String,
) -> Result<LintResult, String> {
    let accepted = Instant::now();
    owner(&window)?;
    let token = state.0.begin(&job_id, accepted)?;
    let access = state.0.access();
    let worker_access = access.clone();
    let worker_token = token.clone();
    let (send, receive) = tokio::sync::oneshot::channel();
    let spawned = state.0.spawn(token.clone(), move || {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let identity = worker_access.identity(&worker_token)?;
            let root = binding(&app, &identity, &worker_token)?;
            let executable = executable()?;
            worker_token.check()?;
            let input = worker_access.take(&worker_token)?;
            let mut wire = serde_json::to_vec(&Envelope {
                protocol: 1,
                job_id: &worker_token.id,
                source_json: &input.source_json,
                repository_root: root.as_deref(),
                ruleset_path: root.as_ref().map(|r| r.join("other/.spectral.yaml")),
            })
            .map_err(|_| "protocol")?;
            drop(input);
            worker_token.check()?;
            if wire.len() >= WIRE_LIMIT {
                return Err("input_limit".into());
            }
            wire.push(b'\n');
            let output = crate::spectral_process::execute(&executable, wire, &worker_token)?;
            let result_json = parse_reply(&output, &worker_token.id)?;
            Ok(LintResult {
                job_id: worker_token.id.clone(),
                result_json,
            })
        }))
        .unwrap_or_else(|_| Err("process".into()));
        let result = worker_access.settle(&worker_token, result);
        let _ = send.send(result);
    });
    if let Err(code) = spawned {
        return access.settle(&token, Err(code));
    }
    receive.await.map_err(|_| "process".to_string())?
}
#[tauri::command]
pub async fn cancel_spectral_lint(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, SpectralState>,
    job_id: String,
) -> Result<CancelResult, String> {
    owner(&window)?;
    let cancelled = match state.0.cancel(&job_id)? {
        Cancel::Ready(cancelled) => cancelled,
        Cancel::Waiting(mut completion) => {
            while !*completion.borrow_and_update() {
                completion.changed().await.map_err(|_| "process")?;
            }
            true
        }
    };
    Ok(CancelResult { job_id, cancelled })
}
pub fn cancel_all(state: &SpectralState) {
    state.0.close();
}
pub fn drain(state: &SpectralState) {
    state.0.drain();
    state.0.exit_ready.store(true, Ordering::SeqCst);
}
pub fn exit_ready(state: &SpectralState) -> bool {
    state.0.exit_ready.load(Ordering::SeqCst)
}
pub fn shutdown_then_exit(
    state: &SpectralState,
    app: tauri::AppHandle,
    code: i32,
) -> Result<(), String> {
    cancel_all(state);
    if state
        .0
        .shutdown_started
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Ok(());
    }
    let coordinator = state.clone();
    match std::thread::Builder::new()
        .name("spectral-shutdown".into())
        .spawn(move || {
            drain(&coordinator);
            app.exit(code);
        }) {
        Ok(_) => Ok(()),
        Err(_) => {
            state.0.shutdown_started.store(false, Ordering::SeqCst);
            Err("process".into())
        }
    }
}
