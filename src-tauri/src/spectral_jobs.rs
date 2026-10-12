//! Bounded Spectral ownership independent of Wry and Tokio's blocking pool.
use serde_json::Value;
use std::{
    collections::{HashMap, VecDeque},
    sync::{
        atomic::{AtomicBool, AtomicU8, Ordering},
        Arc, Condvar, Mutex,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};
use tokio::sync::watch;

pub(crate) fn owner_label(label: &str) -> Result<(), String> {
    if label == "main" {
        Ok(())
    } else {
        Err("owner".into())
    }
}
pub(crate) fn bounded_lock<'a, T>(
    mutex: &'a Mutex<T>,
    token: &Token,
) -> Result<std::sync::MutexGuard<'a, T>, String> {
    loop {
        token.check()?;
        match mutex.try_lock() {
            Ok(guard) => return Ok(guard),
            Err(std::sync::TryLockError::Poisoned(_)) => return Err("binding".into()),
            Err(std::sync::TryLockError::WouldBlock) => thread::sleep(Duration::from_millis(5)),
        }
    }
}

pub(crate) const RUN_TIMEOUT: Duration = Duration::from_secs(15);
const RESERVATION_TTL: Duration = Duration::from_secs(30);
const RETIRED_TTL: Duration = Duration::from_secs(60);
const REAPER_TICK: Duration = Duration::from_millis(50);
const MAX_ACTIVE: usize = 8;
const MAX_WORKERS: usize = 2;
const MAX_RETIRED: usize = 128;

#[derive(Clone)]
pub(crate) struct Identity {
    pub workspace_id: String,
    pub spec_id: String,
    pub repository_id: Option<String>,
    pub expected_binding: Option<Value>,
}
pub(crate) struct Payload {
    pub identity: Identity,
    pub source_json: String,
}
pub(crate) struct Control {
    reason: AtomicU8,
    complete: watch::Sender<bool>,
}
impl Control {
    fn new() -> Self {
        let (complete, _) = watch::channel(false);
        Self {
            reason: AtomicU8::new(0),
            complete,
        }
    }
    fn cancel(&self, reason: u8) {
        let _ = self
            .reason
            .compare_exchange(0, reason, Ordering::SeqCst, Ordering::SeqCst);
    }
    pub(crate) fn check(&self, deadline: Instant) -> Result<(), String> {
        if Instant::now() >= deadline {
            self.cancel(2);
        }
        match self.reason.load(Ordering::SeqCst) {
            0 => Ok(()),
            1 => Err("cancelled".into()),
            2 => Err("timeout".into()),
            _ => Err("owner".into()),
        }
    }
}
#[derive(Clone)]
pub(crate) struct Token {
    pub id: String,
    pub control: Arc<Control>,
    pub deadline: Instant,
}
impl Token {
    pub(crate) fn check(&self) -> Result<(), String> {
        self.control.check(self.deadline)
    }
}
enum Phase {
    Pending(Instant),
    Running(Instant),
}
struct Active {
    phase: Phase,
    payload: Option<Payload>,
    control: Arc<Control>,
}
struct Retired {
    id: String,
    at: Instant,
    error: Option<String>,
}
#[derive(Default)]
struct Registry {
    active: HashMap<String, Active>,
    retired: VecDeque<Retired>,
    closing: bool,
    stop_timer: bool,
    workers: usize,
}
struct Core {
    registry: Mutex<Registry>,
    changed: Condvar,
}
type Handles = Arc<Mutex<Vec<JoinHandle<()>>>>;
pub(crate) struct Manager {
    core: Arc<Core>,
    handles: Handles,
    timer: Mutex<Option<JoinHandle<()>>>,
    timer_failed: AtomicBool,
    pub shutdown_started: AtomicBool,
    pub exit_ready: AtomicBool,
}
pub(crate) enum Cancel {
    Ready(bool),
    Waiting(watch::Receiver<bool>),
}
#[derive(Clone)]
pub(crate) struct Access {
    core: Arc<Core>,
}

fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|error| error.into_inner())
}
fn retired(registry: &mut Registry, id: String, error: Option<String>, now: Instant) {
    registry.retired.push_back(Retired { id, at: now, error });
    while registry.retired.len() > MAX_RETIRED {
        registry.retired.pop_front();
    }
}
fn prune_retired(registry: &mut Registry, now: Instant) {
    registry
        .retired
        .retain(|entry| now.duration_since(entry.at) < RETIRED_TTL);
}
fn reap(handles: &Handles) {
    let completed = {
        let mut handles = lock(handles);
        let mut completed = Vec::new();
        let mut index = 0;
        while index < handles.len() {
            if handles[index].is_finished() {
                completed.push(handles.swap_remove(index));
            } else {
                index += 1;
            }
        }
        completed
    };
    for handle in completed {
        let _ = handle.join();
    }
}

impl Manager {
    pub(crate) fn new() -> Self {
        let core = Arc::new(Core {
            registry: Mutex::new(Registry::default()),
            changed: Condvar::new(),
        });
        let handles = Arc::new(Mutex::new(Vec::new()));
        let timer_core = core.clone();
        let timer_handles = handles.clone();
        let timer = thread::Builder::new()
            .name("spectral-expiry".into())
            .spawn(move || expiry_loop(timer_core, timer_handles));
        let failed = timer.is_err();
        Self {
            core,
            handles,
            timer: Mutex::new(timer.ok()),
            timer_failed: AtomicBool::new(failed),
            shutdown_started: AtomicBool::new(false),
            exit_ready: AtomicBool::new(false),
        }
    }
    pub(crate) fn reserve(&self, payload: Payload) -> Result<String, String> {
        if self.timer_failed.load(Ordering::SeqCst) {
            return Err("process".into());
        }
        let mut registry = lock(&self.core.registry);
        if registry.closing {
            return Err("owner".into());
        }
        if registry.active.len() >= MAX_ACTIVE {
            return Err("capacity".into());
        }
        let id = uuid::Uuid::new_v4().to_string();
        registry.active.insert(
            id.clone(),
            Active {
                phase: Phase::Pending(Instant::now() + RESERVATION_TTL),
                payload: Some(payload),
                control: Arc::new(Control::new()),
            },
        );
        self.core.changed.notify_all();
        Ok(id)
    }
    pub(crate) fn begin(&self, id: &str, accepted: Instant) -> Result<Token, String> {
        let mut registry = lock(&self.core.registry);
        if registry.closing {
            return Err("owner".into());
        }
        let entry = registry.active.get(id).ok_or_else(|| {
            registry
                .retired
                .iter()
                .find(|entry| entry.id == id)
                .and_then(|entry| entry.error.as_deref())
                .filter(|code| *code == "cancelled")
                .unwrap_or("expired")
                .to_string()
        })?;
        let Phase::Pending(expires) = entry.phase else {
            return Err("expired".into());
        };
        if Instant::now() >= expires {
            let entry = registry.active.remove(id).expect("checked active identity");
            entry.control.complete.send_replace(true);
            retired(
                &mut registry,
                id.into(),
                Some("expired".into()),
                Instant::now(),
            );
            drop(registry);
            drop(entry);
            return Err("expired".into());
        }
        if registry
            .active
            .values()
            .filter(|entry| matches!(entry.phase, Phase::Running(_)))
            .count()
            >= MAX_WORKERS
            || registry.workers >= MAX_WORKERS
        {
            return Err("capacity".into());
        }
        let deadline = accepted + RUN_TIMEOUT;
        let entry = registry
            .active
            .get_mut(id)
            .expect("checked active identity");
        entry.phase = Phase::Running(deadline);
        let token = Token {
            id: id.into(),
            control: entry.control.clone(),
            deadline,
        };
        self.core.changed.notify_all();
        Ok(token)
    }
    pub(crate) fn access(&self) -> Access {
        Access {
            core: self.core.clone(),
        }
    }
    pub(crate) fn cancel(&self, id: &str) -> Result<Cancel, String> {
        let mut registry = lock(&self.core.registry);
        let Some(entry) = registry.active.get_mut(id) else {
            return registry
                .retired
                .iter()
                .find(|entry| entry.id == id)
                .map(|entry| Cancel::Ready(entry.error.as_deref() == Some("cancelled")))
                .ok_or_else(|| "expired".into());
        };
        entry.control.cancel(1);
        let payload = entry.payload.take();
        match entry.phase {
            Phase::Pending(_) => {
                let entry = registry.active.remove(id).expect("checked active identity");
                retired(
                    &mut registry,
                    id.into(),
                    Some("cancelled".into()),
                    Instant::now(),
                );
                entry.control.complete.send_replace(true);
                self.core.changed.notify_all();
                drop(registry);
                drop(payload);
                Ok(Cancel::Ready(true))
            }
            Phase::Running(_) => {
                let completion = entry.control.complete.subscribe();
                self.core.changed.notify_all();
                drop(registry);
                drop(payload);
                Ok(Cancel::Waiting(completion))
            }
        }
    }
    pub(crate) fn spawn<F>(&self, token: Token, operation: F) -> Result<(), String>
    where
        F: FnOnce() + Send + 'static,
    {
        reap(&self.handles);
        // Registration precedes a shutdown join; never hold registry while
        // waiting for this handle mutex or joining an owned worker.
        let mut handles = lock(&self.handles);
        {
            let mut registry = lock(&self.core.registry);
            if registry.closing {
                return Err("owner".into());
            }
            token.check()?;
            if registry.workers >= MAX_WORKERS {
                return Err("capacity".into());
            }
            registry.workers += 1;
        }
        let core = self.core.clone();
        match thread::Builder::new()
            .name("spectral-job".into())
            .spawn(move || {
                let _guard = WorkerGuard { core, token };
                operation();
            }) {
            Ok(handle) => {
                handles.push(handle);
                Ok(())
            }
            Err(_) => {
                let mut registry = lock(&self.core.registry);
                registry.workers -= 1;
                self.core.changed.notify_all();
                Err("process".into())
            }
        }
    }
    pub(crate) fn close(&self) {
        let mut registry = lock(&self.core.registry);
        registry.closing = true;
        let mut dropped = Vec::new();
        for entry in registry.active.values_mut() {
            entry.control.cancel(3);
            if let Some(payload) = entry.payload.take() {
                dropped.push(payload);
            }
        }
        let pending = registry
            .active
            .iter()
            .filter_map(|(id, entry)| {
                matches!(entry.phase, Phase::Pending(_)).then_some(id.clone())
            })
            .collect::<Vec<_>>();
        for id in pending {
            if let Some(entry) = registry.active.remove(&id) {
                entry.control.complete.send_replace(true);
                retired(&mut registry, id, Some("owner".into()), Instant::now());
            }
        }
        self.core.changed.notify_all();
        drop(registry);
        drop(dropped);
    }
    pub(crate) fn drain(&self) {
        self.close();
        {
            let mut registry = lock(&self.core.registry);
            registry.stop_timer = true;
            self.core.changed.notify_all();
        }
        if let Some(timer) = lock(&self.timer).take() {
            let _ = timer.join();
        }
        let handles = std::mem::take(&mut *lock(&self.handles));
        for handle in handles {
            let _ = handle.join();
        }
    }
}
impl Drop for Manager {
    fn drop(&mut self) {
        self.drain();
    }
}
impl Access {
    pub(crate) fn identity(&self, token: &Token) -> Result<Identity, String> {
        token.check()?;
        let registry = lock(&self.core.registry);
        if registry.closing {
            return Err("owner".into());
        }
        let entry = registry.active.get(&token.id).ok_or("expired")?;
        if !Arc::ptr_eq(&entry.control, &token.control) {
            return Err("expired".into());
        }
        entry
            .payload
            .as_ref()
            .map(|payload| payload.identity.clone())
            .ok_or_else(|| token.check().err().unwrap_or_else(|| "expired".into()))
    }
    pub(crate) fn take(&self, token: &Token) -> Result<Payload, String> {
        token.check()?;
        let mut registry = lock(&self.core.registry);
        if registry.closing {
            return Err("owner".into());
        }
        let entry = registry.active.get_mut(&token.id).ok_or("expired")?;
        if !Arc::ptr_eq(&entry.control, &token.control) {
            return Err("expired".into());
        }
        token.check()?;
        entry
            .payload
            .take()
            .ok_or_else(|| token.check().err().unwrap_or_else(|| "expired".into()))
    }
    // The same mutex linearizes accepted cancellation and result publication.
    pub(crate) fn settle<T>(&self, token: &Token, result: Result<T, String>) -> Result<T, String> {
        let mut registry = lock(&self.core.registry);
        let result = if registry.closing {
            Err("owner".into())
        } else {
            token.check().and(result)
        };
        if let Some(entry) = registry.active.remove(&token.id) {
            retired(
                &mut registry,
                token.id.clone(),
                result.as_ref().err().cloned(),
                Instant::now(),
            );
            entry.control.complete.send_replace(true);
            self.core.changed.notify_all();
            drop(registry);
            drop(entry);
        } else {
            return Err("expired".into());
        }
        result
    }
}
struct WorkerGuard {
    core: Arc<Core>,
    token: Token,
}
impl Drop for WorkerGuard {
    fn drop(&mut self) {
        let mut registry = lock(&self.core.registry);
        registry.workers = registry.workers.saturating_sub(1);
        if let Some(entry) = registry.active.remove(&self.token.id) {
            let code = self.token.check().err().unwrap_or_else(|| "process".into());
            retired(
                &mut registry,
                self.token.id.clone(),
                Some(code),
                Instant::now(),
            );
            entry.control.complete.send_replace(true);
            drop(entry);
        }
        self.core.changed.notify_all();
    }
}
fn expiry_loop(core: Arc<Core>, handles: Handles) {
    loop {
        reap(&handles);
        let mut registry = lock(&core.registry);
        if registry.stop_timer {
            return;
        }
        let now = Instant::now();
        prune_retired(&mut registry, now);
        let pending = registry
            .active
            .iter()
            .filter_map(|(id, entry)| match entry.phase {
                Phase::Pending(deadline) if deadline <= now => Some(id.clone()),
                _ => None,
            })
            .collect::<Vec<_>>();
        let mut dropped = Vec::new();
        for id in pending {
            if let Some(entry) = registry.active.remove(&id) {
                entry.control.complete.send_replace(true);
                retired(&mut registry, id, Some("expired".into()), now);
                dropped.push(entry);
            }
        }
        for entry in registry.active.values_mut() {
            if let Phase::Running(deadline) = entry.phase {
                if deadline <= now {
                    entry.control.cancel(2);
                    if let Some(payload) = entry.payload.take() {
                        drop(payload);
                    }
                }
            }
        }
        let earliest = registry
            .active
            .values()
            .filter_map(|entry| match entry.phase {
                Phase::Pending(deadline) => Some(deadline),
                Phase::Running(deadline) if deadline > now => Some(deadline),
                _ => None,
            })
            .chain(registry.retired.iter().map(|entry| entry.at + RETIRED_TTL))
            .min();
        let has_handles = registry.workers > 0;
        let wait = earliest.map(|deadline| deadline.saturating_duration_since(now));
        let wait = if has_handles {
            Some(wait.unwrap_or(REAPER_TICK).min(REAPER_TICK))
        } else {
            wait
        };
        drop(registry);
        drop(dropped);
        let registry = lock(&core.registry);
        if registry.stop_timer {
            return;
        }
        // A short bounded wait also avoids missing a notification during payload
        // retirement outside the mutex. No shared blocking pool is involved.
        let duration = wait.unwrap_or(REAPER_TICK).min(REAPER_TICK);
        let _ = core
            .changed
            .wait_timeout(registry, duration)
            .unwrap_or_else(|error| error.into_inner());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn payload() -> Payload {
        Payload {
            identity: Identity {
                workspace_id: "wrk_owned".into(),
                spec_id: "spc_owned".into(),
                repository_id: None,
                expected_binding: None,
            },
            source_json: "owned private in-memory input".into(),
        }
    }
    fn ready(cancel: Cancel) -> bool {
        match cancel {
            Cancel::Ready(value) => value,
            Cancel::Waiting(_) => panic!("expected settled operation"),
        }
    }
    #[test]
    fn eight_completed_jobs_do_not_exhaust_active_capacity() {
        let manager = Manager::new();
        let access = manager.access();
        let mut ids = std::collections::HashSet::new();
        for _ in 0..8 {
            let id = manager.reserve(payload()).unwrap();
            assert!(ids.insert(id.clone()));
            let token = manager.begin(&id, Instant::now()).unwrap();
            access.settle(&token, Ok(())).unwrap();
            assert!(!ready(manager.cancel(&id).unwrap()));
        }
        manager.reserve(payload()).unwrap();
        assert_eq!(lock(&manager.core.registry).active.len(), 1);
    }
    #[test]
    fn pending_eight_and_running_two_are_independent_bounds() {
        let manager = Manager::new();
        let ids = (0..8)
            .map(|_| manager.reserve(payload()).unwrap())
            .collect::<Vec<_>>();
        assert_eq!(manager.reserve(payload()).unwrap_err(), "capacity");
        let first = manager.begin(&ids[0], Instant::now()).unwrap();
        manager.begin(&ids[1], Instant::now()).unwrap();
        assert!(matches!(manager.begin(&ids[0],Instant::now()),Err(code) if code=="expired"));
        assert!(matches!(manager.begin(&ids[2],Instant::now()),Err(code) if code=="capacity"));
        manager.access().settle(&first, Ok(())).unwrap();
        manager.begin(&ids[2], Instant::now()).unwrap();
    }
    #[test]
    fn cancelled_reserved_id_never_starts_and_payload_is_retired() {
        let manager = Manager::new();
        let id = manager.reserve(payload()).unwrap();
        assert!(ready(manager.cancel(&id).unwrap()));
        assert!(matches!(manager.begin(&id,Instant::now()),Err(code) if code=="cancelled"));
        assert!(lock(&manager.core.registry).active.is_empty());
        assert!(ready(manager.cancel(&id).unwrap()));
    }
    #[test]
    fn cancel_during_locked_binding_is_immediate_and_cannot_claim_body() {
        let manager = Manager::new();
        let id = manager.reserve(payload()).unwrap();
        let token = manager.begin(&id, Instant::now()).unwrap();
        let access = manager.access();
        let gate = Arc::new(Mutex::new(()));
        let held = gate.lock().unwrap();
        let worker_gate = gate.clone();
        let worker_token = token.clone();
        let worker_access = access.clone();
        let (send, receive) = std::sync::mpsc::channel();
        manager
            .spawn(token.clone(), move || {
                let result = bounded_lock(&worker_gate, &worker_token).map(|_| ());
                let result = worker_access.settle(&worker_token, result);
                send.send(result).unwrap();
            })
            .unwrap();
        let started = Instant::now();
        let completion = manager.cancel(&id).unwrap();
        assert!(started.elapsed() < Duration::from_millis(100));
        assert!(matches!(completion, Cancel::Waiting(_)));
        assert!(matches!(access.take(&token),Err(code) if code=="cancelled"));
        assert_eq!(
            receive
                .recv_timeout(Duration::from_secs(1))
                .unwrap()
                .unwrap_err(),
            "cancelled"
        );
        drop(held);
        manager.drain();
    }
    #[test]
    fn cancellation_and_success_settle_have_one_linearization_point() {
        for _ in 0..64 {
            let manager = Arc::new(Manager::new());
            let id = manager.reserve(payload()).unwrap();
            let token = manager.begin(&id, Instant::now()).unwrap();
            let barrier = Arc::new(std::sync::Barrier::new(3));
            let cancel_manager = manager.clone();
            let cancel_id = id.clone();
            let cancel_barrier = barrier.clone();
            let cancel = thread::spawn(move || {
                cancel_barrier.wait();
                match cancel_manager.cancel(&cancel_id).unwrap() {
                    Cancel::Ready(value) => value,
                    Cancel::Waiting(_) => true,
                }
            });
            let access = manager.access();
            let settle_barrier = barrier.clone();
            let settle = thread::spawn(move || {
                settle_barrier.wait();
                access.settle(&token, Ok(()))
            });
            barrier.wait();
            let cancelled = cancel.join().unwrap();
            let result = settle.join().unwrap();
            assert!(!(cancelled && result.is_ok()));
            if cancelled {
                assert_eq!(result.unwrap_err(), "cancelled");
            } else {
                result.unwrap();
            }
        }
    }
    #[test]
    fn idle_reservation_really_expires_at_thirty_seconds_without_commands() {
        let manager = Manager::new();
        let started = Instant::now();
        let id = manager.reserve(payload()).unwrap();
        let registry = lock(&manager.core.registry);
        let Phase::Pending(deadline) = registry.active[&id].phase else {
            panic!("pending reservation")
        };
        assert!(deadline.duration_since(started) >= RESERVATION_TTL);
        assert!(deadline.duration_since(started) < RESERVATION_TTL + Duration::from_millis(100));
        drop(registry);
        thread::sleep(RESERVATION_TTL + Duration::from_millis(250));
        assert!(lock(&manager.core.registry).active.is_empty());
        assert!(matches!(manager.begin(&id,Instant::now()),Err(code) if code=="expired"));
    }
    #[test]
    fn absolute_run_budget_includes_pre_execution_delay() {
        let manager = Manager::new();
        let id = manager.reserve(payload()).unwrap();
        let token = manager.begin(&id, Instant::now() - RUN_TIMEOUT).unwrap();
        assert_eq!(token.check().unwrap_err(), "timeout");
        assert!(matches!(manager.access().take(&token),Err(code) if code=="timeout"));
        assert_eq!(
            manager.access().settle::<()>(&token, Ok(())).unwrap_err(),
            "timeout"
        );
    }
    #[test]
    fn retired_refusal_metadata_remains_bounded() {
        let manager = Manager::new();
        for _ in 0..256 {
            let id = manager.reserve(payload()).unwrap();
            assert!(ready(manager.cancel(&id).unwrap()));
        }
        let registry = lock(&manager.core.registry);
        assert!(registry.active.is_empty());
        assert_eq!(registry.retired.len(), MAX_RETIRED);
        assert!(registry
            .retired
            .iter()
            .all(|entry| entry.error.as_deref() == Some("cancelled")));
    }
    #[test]
    fn shutdown_can_join_while_ui_thread_keeps_progressing() {
        let manager = Arc::new(Manager::new());
        let id = manager.reserve(payload()).unwrap();
        let token = manager.begin(&id, Instant::now()).unwrap();
        let access = manager.access();
        let gate = Arc::new(Mutex::new(()));
        let held = gate.lock().unwrap();
        let worker_gate = gate.clone();
        let worker_token = token.clone();
        manager
            .spawn(token, move || {
                let result = bounded_lock(&worker_gate, &worker_token).map(|_| ());
                let _ = access.settle(&worker_token, result);
            })
            .unwrap();
        let shutdown_manager = manager.clone();
        let (send, receive) = std::sync::mpsc::channel();
        let shutdown = thread::spawn(move || {
            shutdown_manager.drain();
            send.send(()).unwrap();
        });
        let mut ui_ticks = 0;
        while receive.try_recv().is_err() {
            ui_ticks += 1;
            assert!(ui_ticks < 200);
            thread::sleep(Duration::from_millis(5));
        }
        assert!(ui_ticks > 0);
        drop(held);
        shutdown.join().unwrap();
        assert_eq!(lock(&manager.core.registry).workers, 0);
        assert!(lock(&manager.timer).is_none());
        assert!(lock(&manager.handles).is_empty());
        assert_eq!(manager.reserve(payload()).unwrap_err(), "owner");
    }
    #[test]
    fn only_main_label_owns_the_commands() {
        owner_label("main").unwrap();
        for label in ["", "oauth", "Main", "main-foreign"] {
            assert_eq!(owner_label(label).unwrap_err(), "owner");
        }
    }
    #[test]
    fn async_watch_completion_does_not_need_a_blocking_waiter() {
        let manager = Manager::new();
        let id = manager.reserve(payload()).unwrap();
        let token = manager.begin(&id, Instant::now()).unwrap();
        let Cancel::Waiting(mut completion) = manager.cancel(&id).unwrap() else {
            panic!("running cancel")
        };
        assert!(!*completion.borrow());
        assert_eq!(
            manager.access().settle::<()>(&token, Ok(())).unwrap_err(),
            "cancelled"
        );
        let runtime = tokio::runtime::Builder::new_current_thread()
            .build()
            .unwrap();
        runtime.block_on(async {
            while !*completion.borrow_and_update() {
                completion.changed().await.unwrap();
            }
        });
    }
}
