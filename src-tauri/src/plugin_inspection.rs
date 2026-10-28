//! Explicit data-only inspection; this does not select the application's runtime.
use crate::http::{NativeWorkLease, NetworkState};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};

struct Operation {
    created: Instant,
    started: bool,
    cancelled: AtomicBool,
    commands: Option<std::sync::mpsc::SyncSender<crate::plugin_bun_session::Command>>,
}
#[derive(Default)]
struct Operations {
    closed: bool,
    entries: HashMap<String, Arc<Operation>>,
}
#[derive(Clone, Default)]
pub struct InspectionState(Arc<Mutex<Operations>>);

impl InspectionState {
    pub(crate) fn reserve(&self) -> Result<String, String> {
        let mut state = self
            .0
            .lock()
            .map_err(|_| "Plugin inspection state is unavailable")?;
        if state.closed {
            return Err("Plugin inspection window is closed".into());
        }
        state
            .entries
            .retain(|_, op| op.started || op.created.elapsed() < Duration::from_secs(30));
        // shortcut: retained sessions share this four-job bound, calibrate width before activation.
        if state.entries.len() >= 4 {
            return Err("Too many pending plugin inspections".into());
        }
        let id = uuid::Uuid::new_v4().to_string();
        state.entries.insert(
            id.clone(),
            Arc::new(Operation {
                created: Instant::now(),
                started: false,
                cancelled: AtomicBool::new(false),
                commands: None,
            }),
        );
        Ok(id)
    }
    fn cancel(&self, id: &str) -> Result<bool, String> {
        let mut state = self
            .0
            .lock()
            .map_err(|_| "Plugin inspection state is unavailable")?;
        let Some(op) = state.entries.get(id) else {
            return Ok(false);
        };
        op.cancelled.store(true, Ordering::SeqCst);
        if !op.started {
            state.entries.remove(id);
        }
        Ok(true)
    }
    fn start(&self, id: String, work: NativeWorkLease) -> Result<Lease, String> {
        self.start_session(id, work, None)
    }
    pub(crate) fn start_session(
        &self,
        id: String,
        work: NativeWorkLease,
        commands: Option<std::sync::mpsc::SyncSender<crate::plugin_bun_session::Command>>,
    ) -> Result<Lease, String> {
        let mut state = self
            .0
            .lock()
            .map_err(|_| "Plugin inspection state is unavailable")?;
        if state.closed {
            return Err("Plugin inspection window is closed".into());
        }
        let op = state
            .entries
            .get_mut(&id)
            .ok_or("Plugin inspection is no longer reserved")?;
        let op = Arc::get_mut(op).ok_or("Plugin inspection already started")?;
        if op.started || op.created.elapsed() >= Duration::from_secs(30) {
            return Err("Plugin inspection is no longer reserved".into());
        }
        op.started = true;
        op.commands = commands;
        Ok(Lease {
            state: self.clone(),
            operation: state.entries[&id].clone(),
            id,
            work,
        })
    }
    pub(crate) fn send(
        &self,
        id: &str,
        command: crate::plugin_bun_session::Command,
    ) -> Result<(), String> {
        let state = self
            .0
            .lock()
            .map_err(|_| "Plugin runtime state is unavailable")?;
        let op = state
            .entries
            .get(id)
            .ok_or("Plugin runtime is no longer current")?;
        if state.closed || op.cancelled.load(Ordering::SeqCst) {
            return Err("Plugin runtime is no longer current".into());
        }
        op.commands
            .as_ref()
            .ok_or("Plugin session is not running")?
            .try_send(command)
            .map_err(|_| "Plugin command queue is unavailable".into())
    }
}

pub(crate) fn cancel_for_navigation(state: &InspectionState) {
    let mut state = state.0.lock().unwrap_or_else(|error| error.into_inner());
    for op in state.entries.values() {
        op.cancelled.store(true, Ordering::SeqCst);
    }
    // Running jobs keep their slots until their leases finish native cleanup.
    state.entries.retain(|_, op| op.started);
}

pub(crate) fn cancel_all(state: &InspectionState) {
    let mut state = state.0.lock().unwrap_or_else(|error| error.into_inner());
    state.closed = true;
    for op in state.entries.values() {
        op.cancelled.store(true, Ordering::SeqCst);
    }
    state.entries.retain(|_, op| op.started);
}
pub(crate) struct Lease {
    state: InspectionState,
    id: String,
    operation: Arc<Operation>,
    work: NativeWorkLease,
}
impl Lease {
    pub(crate) fn check(&self) -> Result<(), String> {
        if self.operation.cancelled.load(Ordering::SeqCst) || self.work.cancelled() {
            return Err("Plugin inspection cancelled".into());
        }
        Ok(())
    }
}
impl Drop for Lease {
    fn drop(&mut self) {
        let mut state = self
            .state
            .0
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if state
            .entries
            .get(&self.id)
            .is_some_and(|op| Arc::ptr_eq(op, &self.operation))
        {
            state.entries.remove(&self.id);
        }
    }
}

pub(crate) fn executable() -> Result<PathBuf, String> {
    if !cfg!(windows) || env!("INSOMNIUM_PLUGIN_RUNTIME_SHA256").is_empty() {
        return Err("Sandboxed Bun inspection is unavailable in this build".into());
    }
    let app = std::env::current_exe().map_err(|error| error.to_string())?;
    let path = app
        .parent()
        .ok_or("Missing application directory")?
        .join("plugin-runtime.exe");
    crate::git::reject_link(&path)?;
    if !path.is_file() {
        return Err("Sandboxed Bun inspection runtime is missing".into());
    }
    Ok(path)
}

#[tauri::command]
pub fn reserve_plugin_inspection(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, InspectionState>,
) -> Result<String, String> {
    crate::plugin_event_transport::caller(&window)?;
    executable()?;
    state.reserve()
}
#[tauri::command]
pub fn cancel_plugin_inspection(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, InspectionState>,
    id: String,
) -> Result<bool, String> {
    crate::plugin_event_transport::caller(&window)?;
    state.cancel(&id)
}

#[derive(serde::Serialize)]
pub struct Inspection {
    pub(crate) snapshot: crate::plugin_package::PluginPackageSource,
    pub(crate) wire: String,
}
#[tauri::command]
pub async fn run_plugin_inspection(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, InspectionState>,
    network: tauri::State<'_, NetworkState>,
    id: String,
    directory: String,
) -> Result<Inspection, String> {
    crate::plugin_event_transport::caller(&window)?;
    if directory.is_empty() || directory.len() > 8192 {
        return Err("Select a plugin package folder".into());
    }
    let executable = executable()?;
    let work = network.retain_native_work(format!("plugin-inspection:{}", uuid::Uuid::new_v4()))?;
    let lease = state.start(id, work)?;
    tauri::async_runtime::spawn_blocking(move || {
        lease.check()?;
        let snapshot = crate::plugin_package::snapshot(PathBuf::from(directory))?;
        lease.check()?;
        #[cfg(windows)]
        let wire = crate::plugin_bun::inspect(
            &executable,
            env!("INSOMNIUM_PLUGIN_RUNTIME_SHA256"),
            &snapshot,
            &|| lease.check(),
        )?;
        #[cfg(not(windows))]
        let wire = {
            let _ = executable;
            return Err("Sandboxed Bun inspection is unavailable on this platform".into());
        };
        lease.check()?;
        Ok(Inspection { snapshot, wire })
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn navigation_cancels_old_work_without_reopening_a_closed_window() {
        let state = InspectionState::default();
        let network = NetworkState::default();
        let active = state.reserve().unwrap();
        let lease = state
            .start(
                active.clone(),
                network.retain_native_work("navigation".into()).unwrap(),
            )
            .unwrap();
        let pending = state.reserve().unwrap();
        cancel_for_navigation(&state);
        assert!(lease.check().is_err());
        {
            let operations = state.0.lock().unwrap();
            assert!(operations.entries.contains_key(&active));
            assert!(!operations.entries.contains_key(&pending));
        }
        for _ in 0..3 {
            state.reserve().unwrap();
        }
        assert!(state.reserve().is_err());
        drop(lease);
        state.reserve().unwrap();
        assert!(state.reserve().is_err());
        cancel_for_navigation(&state);
        assert!(state.0.lock().unwrap().entries.is_empty());
        state.reserve().unwrap();
        cancel_all(&state);
        cancel_for_navigation(&state);
        assert!(state.reserve().is_err());
    }

    #[test]
    fn cancellation_and_close_retain_running_inspections_until_cleanup() {
        let state = InspectionState::default();
        let network = NetworkState::default();
        let pending = state.reserve().unwrap();
        assert!(state.cancel(&pending).unwrap());
        assert!(state
            .start(
                pending,
                network.retain_native_work("pending".into()).unwrap()
            )
            .is_err());
        let id = state.reserve().unwrap();
        let lease = state
            .start(
                id.clone(),
                network.retain_native_work("active".into()).unwrap(),
            )
            .unwrap();
        assert!(state
            .start(
                id.clone(),
                network.retain_native_work("duplicate".into()).unwrap()
            )
            .is_err());
        assert!(state.cancel(&id).unwrap());
        assert!(lease.check().is_err());
        assert!(state.0.lock().unwrap().entries.contains_key(&id));
        cancel_all(&state);
        assert!(state.reserve().is_err());
        assert!(state.0.lock().unwrap().entries.contains_key(&id));
        drop(lease);
        assert!(state.0.lock().unwrap().entries.is_empty());
        assert!(network.retain_native_work("active".into()).is_ok());
    }
}
