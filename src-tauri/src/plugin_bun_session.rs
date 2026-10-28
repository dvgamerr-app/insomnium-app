//! Persistent physical session. Child frames can use only the parent's live grant.
use crate::{
    http::NetworkState,
    plugin_inspection::{Inspection, InspectionState},
};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    sync::mpsc::{self, Receiver, SyncSender},
    time::{Duration, Instant},
};
use tokio::sync::oneshot;

const WIRE_LIMIT: usize = 8 * 1024 * 1024;
const HELPER_LIMIT: usize = 1024 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Invocation {
    operation: String,
    kind: String,
    index: usize,
    wire: String,
    helpers: bool,
    synchronous: bool,
    #[serde(default)]
    dom: bool,
}
impl Invocation {
    fn validate(&self) -> Result<(), String> {
        if self.operation.is_empty()
            || self.operation.len() > 128
            || !self
                .operation
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-')
            || self.index as u64
                > if matches!(
                    self.kind.as_str(),
                    "domCallback" | "domRelease" | "domEvent"
                ) {
                    9_007_199_254_740_991
                } else {
                    63
                }
            || !matches!(
                self.kind.as_str(),
                "templateTags"
                    | "templateTagMetadata"
                    | "templateTagAction"
                    | "requestHooks"
                    | "responseHooks"
                    | "requestGroupActions"
                    | "requestActions"
                    | "workspaceActions"
                    | "documentActions"
                    | "domCallback"
                    | "domRelease"
                    | "domEvent"
            )
            || self.wire.len()
                > if self.kind.ends_with("Hooks") {
                    WIRE_LIMIT
                } else {
                    HELPER_LIMIT
                }
            || self.helpers
                && matches!(
                    self.kind.as_str(),
                    "templateTagMetadata" | "templateTagAction"
                )
            || self.synchronous && !self.helpers
            || self.dom && !self.synchronous
            || matches!(self.kind.as_str(), "domCallback" | "domEvent") && !self.dom
            || self.kind == "domRelease" && (self.helpers || self.synchronous || self.dom)
        {
            return Err("Invalid Bun plugin callback".into());
        }
        Ok(())
    }
}
pub(crate) enum Command {
    Invoke(Invocation, oneshot::Sender<Result<String, String>>),
    InvokeEvent(Invocation, SyncSender<Event>),
    InvokeNested(Invocation, String, SyncSender<Event>),
    InvokeSibling(Invocation, String, SyncSender<Event>),
    ResumeCheckpoint(String, SyncSender<Event>),
    Helper {
        request: String,
        wire: Option<String>,
        error: Option<String>,
        reply: oneshot::Sender<Result<(), String>>,
    },
    FileHelper {
        request: String,
        wire: Option<String>,
        error: Option<String>,
        reply: oneshot::Sender<Result<(), String>>,
    },
    Interaction {
        operation: String,
        waiting: bool,
    },
}
#[derive(Clone, Serialize)]
#[serde(
    tag = "type",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase"
)]
pub enum Event {
    ObjectUrl {
        request: String,
        method: String,
        args_wire: String,
        replayed: bool,
    },
    Checkpoint {
        operation: String,
    },
    Prefix {
        operation: String,
    },
    Complete {
        operation: String,
        wire: String,
    },
    Started {
        operation: String,
    },
    Helper {
        operation: String,
        request: String,
        namespace: String,
        method: String,
        args_wire: String,
    },
    Closed {
        error: String,
    },
}
#[derive(Deserialize)]
#[serde(
    tag = "type",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
enum Frame {
    ObjectUrl {
        protocol: u32,
        request_id: u64,
        method: String,
        args_wire: String,
    },
    Checkpoint {
        protocol: u32,
        call_id: String,
    },
    Prefix {
        protocol: u32,
        call_id: String,
    },
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
    Result {
        protocol: u32,
        call_id: String,
        wire: String,
    },
    Failure {
        protocol: u32,
        call_id: String,
        error: String,
    },
    Helper {
        protocol: u32,
        call_id: String,
        request_id: u64,
        namespace: String,
        method: String,
        args_wire: String,
    },
    Fatal {
        protocol: u32,
        error: String,
    },
}
struct Active {
    event_steps: Option<SyncSender<Event>>,
    checkpoint: bool,
    input: Invocation,
    capability: String,
    reply: Option<oneshot::Sender<Result<String, String>>>,
    parent: Option<String>,
    body_done: bool,
    interaction: bool,
    waiters: usize,
    started: Instant,
    cpu: Duration,
    waited: Duration,
    waiting: Option<Instant>,
    calls: usize,
    transferred: usize,
    pending: HashMap<String, (u64, Option<Instant>, bool)>,
    file_requests: HashSet<String>,
}

#[cfg(windows)]
struct ObjectUrlRequest {
    token: String,
    child_id: u64,
    started: Instant,
    queued: Option<Event>,
    replayed: bool,
}
fn ancestry(frames: &HashMap<String, Active>, capability: &str) -> Result<Vec<String>, String> {
    let mut result = Vec::new();
    let mut next = Some(capability.to_owned());
    while let Some(capability) = next {
        if result.len() >= 7 {
            return Err("Bun callback depth exceeded".into());
        }
        let frame = frames
            .get(&capability)
            .ok_or("Bun callback ancestor retired")?;
        next = frame.parent.clone();
        result.push(capability);
    }
    Ok(result)
}
fn set_interaction(
    frames: &mut HashMap<String, Active>,
    capability: &str,
    waiting: bool,
) -> Result<(), String> {
    if frames
        .get(capability)
        .ok_or("Bun interaction owner retired")?
        .interaction
        == waiting
    {
        return Ok(());
    }
    let chain = ancestry(frames, capability)?;
    frames.get_mut(capability).unwrap().interaction = waiting;
    for capability in chain {
        let frame = frames.get_mut(&capability).unwrap();
        if waiting {
            if frame.waiters == 0 {
                frame.waiting = Some(Instant::now());
            }
            frame.waiters += 1;
        } else {
            frame.waiters -= 1;
            if frame.waiters == 0 {
                if let Some(start) = frame.waiting.take() {
                    frame.waited += start.elapsed();
                }
            }
        }
    }
    Ok(())
}
fn prune(frames: &mut HashMap<String, Active>, capability: &str) {
    let mut next = Some(capability.to_owned());
    while let Some(capability) = next {
        if !frames.get(&capability).is_some_and(|frame| frame.body_done)
            || frames
                .values()
                .any(|frame| frame.parent.as_deref() == Some(&capability))
        {
            break;
        }
        next = frames.remove(&capability).unwrap().parent;
    }
}
fn forward(call: &Active, event: Event, events: &tauri::ipc::Channel<Event>) -> Result<(), String> {
    if let Some(sender) = &call.event_steps {
        sender
            .try_send(event)
            .map_err(|_| "Bun event reply queue unavailable".into())
    } else {
        events
            .send(event)
            .map_err(|_| "Bun plugin callback owner disappeared".into())
    }
}

#[derive(Deserialize)]
#[serde(
    tag = "type",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum EventRequest {
    ResumeCheckpoint {
        operation: String,
    },
    Invoke {
        input: Invocation,
    },
    InvokeNested {
        input: Invocation,
        parent_request: String,
    },
    InvokeSibling {
        input: Invocation,
        parent_operation: String,
    },
    Reply {
        operation: String,
        request: String,
        wire: Option<String>,
        error: Option<String>,
    },
    Next {
        operation: String,
    },
    FileReply {
        request: String,
        wire: Option<String>,
        error: Option<String>,
    },
}
#[derive(Default)]
pub(crate) struct EventPipe {
    frames: Vec<(String, Receiver<Event>)>,
}
impl EventPipe {
    pub(crate) fn request(
        &mut self,
        state: &InspectionState,
        id: &str,
        request: EventRequest,
    ) -> Result<serde_json::Value, String> {
        match request {
            EventRequest::ResumeCheckpoint { operation } => {
                if !self.frames.is_empty() {
                    return Err("Bun event checkpoint is already running".into());
                }
                let (sender, receiver) = mpsc::sync_channel(65);
                state.send(id, Command::ResumeCheckpoint(operation.clone(), sender))?;
                self.frames.push((operation, receiver));
            }
            EventRequest::FileReply { .. } => {
                return Err("File replies require the independent transport".into())
            }
            command @ (EventRequest::Invoke { .. }
            | EventRequest::InvokeNested { .. }
            | EventRequest::InvokeSibling { .. }) => {
                let (input, parent, sibling) = match command {
                    EventRequest::Invoke { input } => (input, None, false),
                    EventRequest::InvokeNested {
                        input,
                        parent_request,
                    } => (input, Some(parent_request), false),
                    EventRequest::InvokeSibling {
                        input,
                        parent_operation,
                    } => (input, Some(parent_operation), true),
                    _ => unreachable!(),
                };
                input.validate()?;
                if input.kind != "domEvent"
                    || ((parent.is_none() || sibling) && !self.frames.is_empty())
                    || self.frames.len() >= 7
                {
                    return Err("Bun event invocation refused".into());
                }
                let (sender, receiver) = mpsc::sync_channel(65);
                let operation = input.operation.clone();
                state.send(
                    id,
                    if let Some(parent) = parent {
                        if sibling {
                            Command::InvokeSibling(input, parent, sender)
                        } else {
                            Command::InvokeNested(input, parent, sender)
                        }
                    } else {
                        Command::InvokeEvent(input, sender)
                    },
                )?;
                self.frames.push((operation, receiver));
            }
            EventRequest::Reply {
                operation,
                request,
                wire,
                error,
            } => {
                if !self.frames.last().is_some_and(|frame| frame.0 == operation) {
                    return Err("Bun event owner changed".into());
                }
                validate_reply(&wire, &error)?;
                let (reply, accepted) = oneshot::channel();
                state.send(
                    id,
                    Command::Helper {
                        request,
                        wire,
                        error,
                        reply,
                    },
                )?;
                accepted
                    .blocking_recv()
                    .map_err(|_| "Bun event reply abandoned")??;
            }
            EventRequest::Next { operation } => {
                if !self.frames.last().is_some_and(|frame| frame.0 == operation) {
                    return Err("Bun event owner changed".into());
                }
            }
        }
        let event = self
            .frames
            .last()
            .ok_or("Bun event is not running")?
            .1
            .recv_timeout(Duration::from_secs(5))
            .map_err(|_| "Bun event reply unavailable or timed out")?;
        if matches!(
            event,
            Event::Complete { .. } | Event::Prefix { .. } | Event::Checkpoint { .. }
        ) {
            self.frames.pop();
        }
        serde_json::to_value(event).map_err(|_| "Invalid Bun event reply".into())
    }
}

fn validate_reply(wire: &Option<String>, error: &Option<String>) -> Result<(), String> {
    if wire.is_some() == error.is_some()
        || wire.as_ref().is_some_and(|s| s.len() > HELPER_LIMIT)
        || error.as_ref().is_some_and(|s| s.len() > 8192)
    {
        return Err("Invalid Bun plugin helper reply".into());
    }
    Ok(())
}
pub(crate) fn reply_file_helper(
    state: &InspectionState,
    id: &str,
    request: String,
    wire: Option<String>,
    error: Option<String>,
) -> Result<serde_json::Value, String> {
    validate_reply(&wire, &error)?;
    let (reply, accepted) = oneshot::channel();
    state.send(
        id,
        Command::FileHelper {
            request,
            wire,
            error,
            reply,
        },
    )?;
    accepted
        .blocking_recv()
        .map_err(|_| "Bun File reply abandoned")??;
    Ok(serde_json::Value::Null)
}
fn allowed(namespace: &str, method: &str, active: &Active) -> bool {
    match namespace {
        "file" => {
            active.input.dom
                && active.input.helpers
                && active.input.synchronous
                && method == "dom.file.read"
        }
        "callback" => {
            active.input.dom
                && active.input.helpers
                && active.input.synchronous
                && method == "callback.retain"
        }
        "dom" => {
            active.input.dom
                && active.input.helpers
                && active.input.synchronous
                && matches!(
                    method,
                    "dom.create"
                        | "dom.files"
                        | "dom.file.read-sync"
                        | "dom.get"
                        | "dom.set"
                        | "dom.node"
                        | "dom.attribute"
                        | "dom.query"
                        | "dom.collection"
                        | "dom.tokens"
                        | "dom.dataset"
                        | "dom.style"
                        | "dom.url.create"
                        | "dom.dialog"
                        | "dom.listen"
                        | "dom.unlisten"
                        | "dom.handler"
                        | "dom.dispatch"
                        | "dom.event"
                        | "dom.event-late"
                )
        }
        "sync" => {
            active.input.synchronous
                && active.input.helpers
                && matches!(
                    method,
                    "app.getInfo"
                        | "app.getPath"
                        | "app.clipboard.readText"
                        | "app.clipboard.writeText"
                        | "app.clipboard.clear"
                )
        }
        "store" => {
            !matches!(
                active.input.kind.as_str(),
                "templateTagMetadata" | "domRelease"
            ) && matches!(
                method,
                "hasItem" | "getItem" | "setItem" | "removeItem" | "clear" | "all"
            )
        }
        "helper" => {
            active.input.helpers
                && matches!(
                    method,
                    "app.alert"
                        | "app.prompt"
                        | "app.showSaveDialog"
                        | "util.render"
                        | "data.export.insomnia"
                        | "data.export.har"
                        | "data.import.raw"
                        | "data.import.uri"
                        | "network.sendRequest"
                        | "models.request.getById"
                        | "models.request.getAncestors"
                        | "models.workspace.getById"
                        | "models.oAuth2Token.getByRequestId"
                        | "models.cookieJar.getOrCreateForWorkspace"
                        | "models.response.getLatestForRequestId"
                        | "models.response.readBodyChunk"
                )
        }
        _ => false,
    }
}

#[tauri::command]
pub async fn open_bun_plugin_session(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, InspectionState>,
    network: tauri::State<'_, NetworkState>,
    id: String,
    directory: Option<String>,
    snapshot: Option<crate::plugin_package::PluginPackageSource>,
    events: tauri::ipc::Channel<Event>,
) -> Result<Inspection, String> {
    crate::plugin_event_transport::caller(&window)?;
    if directory.is_some() == snapshot.is_some()
        || directory
            .as_ref()
            .is_some_and(|path| path.is_empty() || path.len() > 8192)
    {
        return Err("Provide either a plugin folder or an admitted source snapshot".into());
    }
    let executable = crate::plugin_inspection::executable()?;
    let (send, receive) = mpsc::sync_channel(64);
    let work = network.retain_native_work(format!("bun-plugin:{}", uuid::Uuid::new_v4()))?;
    let lease = state.start_session(id.clone(), work, Some(send))?;
    let (ready, opened) = oneshot::channel();
    std::thread::Builder::new()
        .name("bun-plugin-session".into())
        .spawn(move || {
            let mut ready = Some(ready);
            let mut active: HashMap<String, Active> = HashMap::new();
            let result: Result<(), String> = (|| {
                lease.check()?;
                let snapshot = match snapshot {
                    Some(snapshot) => snapshot,
                    None => crate::plugin_package::snapshot(
                        directory.ok_or("Missing plugin folder")?.into(),
                    )?,
                };
                #[cfg(windows)]
                {
                    run(
                        &executable,
                        &id,
                        snapshot,
                        &lease,
                        &events,
                        receive,
                        &mut ready,
                        &mut active,
                    )
                }
                #[cfg(not(windows))]
                {
                    let _ = (executable, id, snapshot, receive);
                    Err("Sandboxed Bun sessions are unavailable on this platform".into())
                }
            })();
            let error = result
                .err()
                .unwrap_or_else(|| "Bun plugin session closed".into());
            drop(lease);
            let _ = events.send(Event::Closed {
                error: error.clone(),
            });
            if let Some(ready) = ready {
                let _ = ready.send(Err(error.clone()));
            }
            for mut frame in active.into_values() {
                if let Some(reply) = frame.reply.take() {
                    let _ = reply.send(Err(error.clone()));
                }
            }
        })
        .map_err(|error| error.to_string())?;
    opened
        .await
        .map_err(|_| "Bun plugin session ended before initialization".to_string())?
}

#[tauri::command]
pub async fn invoke_bun_plugin_callback(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, InspectionState>,
    id: String,
    input: Invocation,
) -> Result<String, String> {
    crate::plugin_event_transport::caller(&window)?;
    input.validate()?;
    if input.kind == "domEvent" {
        return Err("Bun events require the independent transport".into());
    }
    let (send, receive) = oneshot::channel();
    state.send(&id, Command::Invoke(input, send))?;
    receive
        .await
        .map_err(|_| "Bun plugin callback session ended".to_string())?
}
#[tauri::command]
pub async fn reply_bun_plugin_helper(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, InspectionState>,
    id: String,
    request: String,
    wire: Option<String>,
    error: Option<String>,
) -> Result<(), String> {
    crate::plugin_event_transport::caller(&window)?;
    validate_reply(&wire, &error)?;
    let (send, receive) = oneshot::channel();
    state.send(
        &id,
        Command::Helper {
            request,
            wire,
            error,
            reply: send,
        },
    )?;
    receive
        .await
        .map_err(|_| "Bun plugin helper session ended".to_string())?
}
#[tauri::command]
pub fn set_bun_plugin_interaction(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, InspectionState>,
    id: String,
    operation: String,
    waiting: bool,
) -> Result<(), String> {
    crate::plugin_event_transport::caller(&window)?;
    state.send(&id, Command::Interaction { operation, waiting })
}

#[cfg(windows)]
struct Pipes {
    process: crate::spectral_process::Process,
    input: Option<SyncSender<Vec<u8>>>,
    sync_input: Option<SyncSender<Vec<u8>>>,
    sync_handle: usize,
    output: Option<Receiver<Result<Vec<u8>, String>>>,
    writer: Option<std::thread::JoinHandle<Result<(), String>>>,
    sync_writer: Option<std::thread::JoinHandle<Result<(), String>>>,
    reader: Option<std::thread::JoinHandle<()>>,
    errors: Option<std::thread::JoinHandle<Result<(), String>>>,
}
#[cfg(windows)]
impl Pipes {
    fn new(
        sandbox: &crate::plugin_sandbox::Sandbox,
        check: &dyn Fn() -> Result<(), String>,
    ) -> Result<Self, String> {
        use std::io::{BufRead, BufReader, Read, Write};
        let mut process =
            crate::spectral_process::Process::spawn_session(&sandbox.executable, check, sandbox)?;
        let (mut stdin, stdout, mut stderr) = process.take_pipes();
        let (mut sync_pipe, sync_handle) = process.take_sync_pipe()?;
        let (send, receive) = mpsc::sync_channel::<Vec<u8>>(64);
        let (sync_send, sync_receive) = mpsc::sync_channel::<Vec<u8>>(64);
        let (frames, output) = mpsc::sync_channel(1);
        let mut pipes = Self {
            process,
            input: Some(send),
            sync_input: Some(sync_send),
            sync_handle,
            output: Some(output),
            writer: None,
            sync_writer: None,
            reader: None,
            errors: None,
        };
        pipes.writer = Some(
            std::thread::Builder::new()
                .name("bun-plugin-input".into())
                .spawn(move || {
                    for bytes in receive {
                        stdin.write_all(&bytes).map_err(|error| error.to_string())?;
                    }
                    Ok(())
                })
                .map_err(|error| error.to_string())?,
        );
        pipes.sync_writer = Some(
            std::thread::Builder::new()
                .name("bun-plugin-sync-input".into())
                .spawn(move || {
                    for bytes in sync_receive {
                        sync_pipe
                            .write_all(&bytes)
                            .map_err(|error| error.to_string())?;
                    }
                    Ok(())
                })
                .map_err(|error| error.to_string())?,
        );
        pipes.reader = Some(
            std::thread::Builder::new()
                .name("bun-plugin-output".into())
                .spawn(move || {
                    let mut reader = BufReader::new(stdout);
                    loop {
                        let mut bytes = Vec::new();
                        let read = Read::take(&mut reader, (WIRE_LIMIT * 2 + 65537) as u64)
                            .read_until(b'\n', &mut bytes);
                        let packet = match read {
                            Ok(n) if n > 0 && bytes.last() == Some(&b'\n') => Ok(bytes),
                            Ok(0) => Err("Bun plugin output ended before a complete frame".into()),
                            Ok(_) => {
                                Err("Bun plugin output frame was truncated or exceeds its limit"
                                    .into())
                            }
                            Err(error) => Err(error.to_string()),
                        };
                        let done = packet.is_err();
                        if frames.send(packet).is_err() || done {
                            break;
                        }
                    }
                })
                .map_err(|error| error.to_string())?,
        );
        pipes.errors = Some(
            std::thread::Builder::new()
                .name("bun-plugin-errors".into())
                .spawn(move || {
                    // Retained sessions drain diagnostics without retaining lifetime-sized logs.
                    std::io::copy(&mut stderr, &mut std::io::sink())
                        .map(|_| ())
                        .map_err(|error| error.to_string())
                })
                .map_err(|error| error.to_string())?,
        );
        Ok(pipes)
    }
    fn send(&self, value: serde_json::Value) -> Result<(), String> {
        self.send_to(value, false)
    }
    fn send_to(&self, value: serde_json::Value, synchronous: bool) -> Result<(), String> {
        let mut bytes = serde_json::to_vec(&value).map_err(|error| error.to_string())?;
        bytes.push(b'\n');
        (if synchronous {
            &self.sync_input
        } else {
            &self.input
        })
        .as_ref()
        .ok_or("Bun plugin input is closed")?
        .try_send(bytes)
        .map_err(|_| "Bun plugin input queue is unavailable".into())
    }
    fn close(&mut self) -> Result<(), String> {
        let reaped = self.process.kill_and_reap();
        drop(self.input.take());
        drop(self.sync_input.take());
        drop(self.output.take());
        let writer = self.writer.take().map(|w| w.join());
        let sync_writer = self.sync_writer.take().map(|w| w.join());
        let reader = self.reader.take().map(|w| w.join());
        let errors = self.errors.take().map(|w| w.join());
        reaped?;
        if writer.is_some_and(|r| r.is_err())
            || sync_writer.is_some_and(|r| r.is_err())
            || reader.is_some_and(|r| r.is_err())
            || errors.is_some_and(|r| r.is_err())
        {
            return Err("Bun plugin pipe worker failed".into());
        }
        Ok(())
    }
}
#[cfg(windows)]
impl Drop for Pipes {
    fn drop(&mut self) {
        if let Err(error) = self.close() {
            eprintln!("{error}");
        }
    }
}

#[cfg(windows)]
fn run(
    executable: &std::path::Path,
    id: &str,
    snapshot: crate::plugin_package::PluginPackageSource,
    lease: &crate::plugin_inspection::Lease,
    events: &tauri::ipc::Channel<Event>,
    commands: Receiver<Command>,
    ready: &mut Option<oneshot::Sender<Result<Inspection, String>>>,
    active: &mut HashMap<String, Active>,
) -> Result<(), String> {
    let mut sandbox = crate::plugin_bun::stage(
        executable,
        env!("INSOMNIUM_PLUGIN_RUNTIME_SHA256"),
        &snapshot,
        &|| lease.check(),
    )?;
    let mut pipes = Pipes::new(&sandbox, &|| lease.check())?;
    let initialized = pipes.process.started();
    let mut pumps: Vec<String> = Vec::new();
    let mut object_url: Option<ObjectUrlRequest> = None;
    let mut deferred_event: Option<Command> = None;
    let mut last_object_url = 0;
    let mut completed_object_urls = HashSet::new();
    let result = (|| {
        pipes.send(serde_json::json!({"protocol":1,"jobId":id,"name":snapshot.name,"entry":snapshot.entry,"format":snapshot.format,"mode":"session","syncHandle":pipes.sync_handle.to_string()}))?;
        let mut snapshot = Some(snapshot);
        let mut idle_cpu = Duration::ZERO;
        loop {
            lease.check()?;
            if object_url
                .as_ref()
                .is_some_and(|request| request.started.elapsed() > Duration::from_secs(4))
            {
                return Err("Bun object URL reply exceeded 4 seconds".into());
            }
            if pipes.process.exited()?.is_some() {
                // An initialization error can still be buffered after the process exits.
                if snapshot.is_some() {
                    let remaining = Duration::from_secs(2).saturating_sub(initialized.elapsed());
                    if let Ok(Ok(bytes)) = pipes.output.as_ref().unwrap().recv_timeout(remaining) {
                        if let Ok(Frame::Error {
                            protocol: 1,
                            job_id,
                            error,
                        }) = serde_json::from_slice(&bytes)
                        {
                            if job_id == id && error.len() <= 8192 {
                                lease.check()?;
                                return Err(error);
                            }
                        }
                    }
                    lease.check()?;
                }
                return Err("Bun plugin process exited".into());
            }
            let cpu = pipes.process.cpu_time()?;
            if !active.is_empty() {
                for call in active.values() {
                    if call.pending.values().any(|(_, started, _)| {
                        started.is_some_and(|start| start.elapsed() > Duration::from_secs(4))
                    }) {
                        return Err("Bun synchronous helper exceeded 4 seconds".into());
                    }
                    let paused =
                        call.waited + call.waiting.map_or(Duration::ZERO, |time| time.elapsed());
                    if call.started.elapsed() > Duration::from_secs(600)
                        || call.started.elapsed().saturating_sub(paused) > Duration::from_secs(5)
                    {
                        return Err("Bun plugin callback exceeded its wall deadline".into());
                    }
                    if cpu.saturating_sub(call.cpu)
                        > Duration::from_secs(if call.input.kind.ends_with("Hooks") {
                            5
                        } else {
                            2
                        })
                    {
                        return Err("Bun plugin callback exceeded its CPU limit".into());
                    }
                }
            } else if snapshot.is_some() {
                if initialized.elapsed() > Duration::from_secs(2) {
                    return Err("Bun plugin initialization interrupted".into());
                }
            } else if cpu.saturating_sub(idle_cpu) > Duration::from_secs(2) {
                // shortcut: idle work shares a CPU lease, add owned-task accounting before activation.
                return Err("Bun plugin idle tasks exceeded their CPU limit".into());
            }
            let command = if object_url.is_none() {
                deferred_event
                    .take()
                    .map(Ok)
                    .unwrap_or_else(|| commands.try_recv())
            } else {
                commands.try_recv()
            };
            match command {
                Ok(
                    command @ (Command::Invoke(..)
                    | Command::InvokeEvent(..)
                    | Command::InvokeNested(..)
                    | Command::InvokeSibling(..)),
                ) => {
                    if let Some(pending) = object_url
                        .as_mut()
                        .filter(|_| !matches!(&command, Command::Invoke(..)))
                    {
                        if let Some(Event::ObjectUrl {
                            request,
                            method,
                            args_wire,
                            ..
                        }) = pending.queued.take()
                        {
                            let sender = match &command {
                                Command::InvokeEvent(_, sender)
                                | Command::InvokeNested(_, _, sender)
                                | Command::InvokeSibling(_, _, sender) => sender,
                                _ => {
                                    return Err(
                                        "Bun callback cannot overtake an object URL request".into(),
                                    )
                                }
                            };
                            if deferred_event.is_some() {
                                return Err("Bun object URL event is already waiting".into());
                            }
                            sender
                                .try_send(Event::ObjectUrl {
                                    request,
                                    method,
                                    args_wire,
                                    replayed: true,
                                })
                                .map_err(|_| "Bun object URL event owner disappeared")?;
                            deferred_event = Some(command);
                            pending.replayed = true;
                            continue;
                        }
                    }
                    let (input, reply, event_steps, parent, sibling) = match command {
                        Command::Invoke(input, reply) => (input, reply, None, None, false),
                        Command::InvokeEvent(input, sender) => {
                            let (reply, _) = oneshot::channel();
                            (input, reply, Some(sender), None, false)
                        }
                        Command::InvokeNested(input, parent, sender) => {
                            let (reply, _) = oneshot::channel();
                            (input, reply, Some(sender), Some(parent), false)
                        }
                        Command::InvokeSibling(input, parent, sender) => {
                            let (reply, _) = oneshot::channel();
                            (input, reply, Some(sender), Some(parent), true)
                        }
                        _ => unreachable!(),
                    };
                    if active
                        .values()
                        .any(|frame| frame.input.operation == input.operation)
                    {
                        let _ =
                            reply.send(Err("Bun callback operation is already retained".into()));
                        continue;
                    }
                    let parent_call = if let Some(parent) = &parent {
                        if sibling
                            && (!pumps.is_empty()
                                || active.values().any(|frame| {
                                    frame
                                        .pending
                                        .values()
                                        .any(|(_, started, _)| started.is_some())
                                }))
                        {
                            continue;
                        }
                        let owner = active
                            .iter()
                            .find(|(_, call)| {
                                !call.body_done
                                    && call.input.dom
                                    && if sibling {
                                        call.input.operation == *parent
                                    } else {
                                        call.pending.get(parent).is_some_and(|(_, started, dom)| {
                                            started.is_some() && *dom
                                        })
                                    }
                            })
                            .map(|(capability, _)| capability.clone());
                        let Some(owner) = owner else {
                            continue;
                        };
                        if ancestry(active, &owner)?.len() >= 7 || active.len() >= 64 {
                            continue;
                        }
                        Some(owner)
                    } else {
                        None
                    };
                    if snapshot.is_some() || (!active.is_empty() && parent_call.is_none()) {
                        let _ = reply.send(Err("Bun plugin callback is already running".into()));
                    } else {
                        let capability = uuid::Uuid::new_v4().to_string();
                        let checkpoint = if let Some(owner) = &parent_call {
                            ancestry(active, owner)?
                                .iter()
                                .any(|id| active[id].checkpoint)
                        } else {
                            false
                        };
                        let nested = parent.is_some() && (!sibling || checkpoint);
                        pipes.send_to(serde_json::json!({"type":if nested {"invoke-nested"} else if sibling {"invoke-sibling"} else {"invoke"},"protocol":1,"callId":capability,"parentId":parent_call,"kind":input.kind,"index":input.index,"wire":input.wire,"helpers":input.helpers,"synchronous":input.synchronous,"dom":input.dom}), nested)?;
                        let operation = input.operation.clone();
                        if event_steps.is_some() {
                            pumps.push(capability.clone());
                        }
                        active.insert(
                            capability.clone(),
                            Active {
                                event_steps,
                                checkpoint: false,
                                input,
                                capability,
                                reply: Some(reply),
                                parent: parent_call,
                                body_done: false,
                                interaction: false,
                                waiters: 0,
                                started: Instant::now(),
                                cpu,
                                waited: Duration::ZERO,
                                waiting: None,
                                calls: 0,
                                transferred: 0,
                                pending: HashMap::new(),
                                file_requests: HashSet::new(),
                            },
                        );
                        events
                            .send(Event::Started { operation })
                            .map_err(|_| "Bun plugin callback owner disappeared")?;
                    }
                }
                Ok(Command::ResumeCheckpoint(operation, sender)) => {
                    let (capability, call) = active
                        .iter_mut()
                        .find(|(_, call)| {
                            call.input.operation == operation && !call.body_done && call.checkpoint
                        })
                        .ok_or("Bun event checkpoint has no active grant")?;
                    if !pumps.is_empty() || call.event_steps.is_some() {
                        return Err("Bun event checkpoint is already running".into());
                    }
                    call.checkpoint = false;
                    call.event_steps = Some(sender);
                    pumps.push(capability.clone());
                    pipes.send_to(serde_json::json!({"type":"resume-checkpoint","protocol":1,"callId":capability}), true)?;
                }
                Ok(command @ (Command::Helper { .. } | Command::FileHelper { .. })) => {
                    let file_only = matches!(&command, Command::FileHelper { .. });
                    let (request, wire, error, reply) = match command {
                        Command::Helper {
                            request,
                            wire,
                            error,
                            reply,
                        }
                        | Command::FileHelper {
                            request,
                            wire,
                            error,
                            reply,
                        } => (request, wire, error, reply),
                        _ => unreachable!(),
                    };
                    if !file_only && completed_object_urls.remove(&request) {
                        let _ = reply.send(Ok(()));
                        continue;
                    }
                    if !file_only
                        && object_url
                            .as_ref()
                            .is_some_and(|pending| pending.token == request)
                    {
                        let pending = object_url.take().unwrap();
                        if pending.replayed {
                            if completed_object_urls.len() >= 64 {
                                return Err("Bun object URL acknowledgement limit exceeded".into());
                            }
                            completed_object_urls.insert(request);
                        }
                        let response = pipes.send_to(serde_json::json!({"type":"object-url-result","protocol":1,"requestId":pending.child_id,"wire":wire,"error":error}), true);
                        let _ = reply.send(response.clone());
                        response?;
                        continue;
                    }
                    let owner = active
                        .iter()
                        .find(|(_, frame)| {
                            !frame.body_done
                                && frame.pending.contains_key(&request)
                                && (!file_only || frame.file_requests.contains(&request))
                        })
                        .map(|(capability, _)| capability.clone());
                    let Some(owner) = owner else {
                        let _ = reply.send(Err("Bun plugin helper request is retired".into()));
                        continue;
                    };
                    let response = (|| {
                        for capability in ancestry(active, &owner)? {
                            let frame = active.get_mut(&capability).unwrap();
                            frame.transferred += wire.as_ref().map_or(0, String::len);
                            if frame.transferred > 64 * 1024 * 1024 {
                                return Err("Bun plugin transfer limit exceeded".into());
                            }
                        }
                        let call = active.get_mut(&owner).unwrap();
                        call.file_requests.remove(&request);
                        let (request_id, sync_started, _) = call.pending.remove(&request).unwrap();
                        pipes.send_to(serde_json::json!({"type":"helper-result","protocol":1,"callId":call.capability,"requestId":request_id,"wire":wire,"error":error}), sync_started.is_some())
                    })();
                    let _ = reply.send(response.clone());
                    response?;
                }
                Ok(Command::Interaction { operation, waiting }) => {
                    if let Some(owner) = active
                        .iter()
                        .find(|(_, frame)| !frame.body_done && frame.input.operation == operation)
                        .map(|(capability, _)| capability.clone())
                    {
                        set_interaction(active, &owner, waiting)?;
                    }
                }
                Err(mpsc::TryRecvError::Empty) => {}
                Err(mpsc::TryRecvError::Disconnected) => {
                    return Err("Bun plugin owner disconnected".into())
                }
            }
            match pipes.output.as_ref().unwrap().try_recv() {
                Ok(bytes) => {
                    let frame: Frame =
                        serde_json::from_slice(&bytes?).map_err(|_| "Invalid Bun plugin frame")?;
                    match frame {
                        Frame::ObjectUrl {
                            protocol: 1,
                            request_id,
                            method,
                            args_wire,
                        } if object_url.is_none()
                            && request_id > last_object_url
                            && request_id <= 9_007_199_254_740_991
                            && matches!(
                                method.as_str(),
                                "begin" | "chunk" | "commit" | "abort" | "revoke" | "unlisten"
                            )
                            && args_wire.len() <= HELPER_LIMIT =>
                        {
                            last_object_url = request_id;
                            let token = uuid::Uuid::new_v4().to_string();
                            let event = Event::ObjectUrl {
                                request: token.clone(),
                                method,
                                args_wire,
                                replayed: false,
                            };
                            let queued = if let Some(sender) = pumps
                                .last()
                                .and_then(|owner| active.get(owner))
                                .and_then(|frame| frame.event_steps.as_ref())
                            {
                                sender
                                    .try_send(event)
                                    .map_err(|_| "Bun object URL event queue unavailable")?;
                                None
                            } else {
                                events
                                    .send(event.clone())
                                    .map_err(|_| "Bun object URL owner disappeared")?;
                                Some(event)
                            };
                            object_url = Some(ObjectUrlRequest {
                                token,
                                child_id: request_id,
                                started: Instant::now(),
                                queued,
                                replayed: false,
                            });
                        }
                        Frame::Metadata {
                            protocol: 1,
                            job_id,
                            wire,
                        } if snapshot.is_some() && job_id == id && wire.len() <= 256 * 1024 => {
                            let packet = Inspection {
                                snapshot: snapshot.take().unwrap(),
                                wire,
                            };
                            idle_cpu = cpu;
                            ready
                                .take()
                                .ok_or("Duplicate Bun plugin initialization")?
                                .send(Ok(packet))
                                .map_err(|_| "Bun plugin opening owner disappeared")?;
                        }
                        Frame::Error {
                            protocol: 1,
                            job_id,
                            error,
                        } if snapshot.is_some() && job_id == id && error.len() <= 8192 => {
                            return Err(error)
                        }
                        Frame::Helper {
                            protocol: 1,
                            call_id,
                            request_id,
                            namespace,
                            method,
                            args_wire,
                        } => {
                            let call = active
                                .get(&call_id)
                                .filter(|call| !call.body_done)
                                .ok_or("Bun plugin helper has no active grant")?;
                            let chain = ancestry(active, &call_id)?;
                            if request_id == 0
                                || call.pending.values().any(|(id, _, _)| *id == request_id)
                                || !allowed(&namespace, &method, call)
                                || args_wire.len() > HELPER_LIMIT
                                || chain
                                    .iter()
                                    .any(|capability| active[capability].calls >= 256)
                                || active
                                    .values()
                                    .map(|frame| frame.pending.len())
                                    .sum::<usize>()
                                    >= 64
                            {
                                return Err("Bun plugin helper grant refused".into());
                            }
                            for capability in chain {
                                let frame = active.get_mut(&capability).unwrap();
                                frame.calls += 1;
                                frame.transferred += args_wire.len();
                                if frame.transferred > 64 * 1024 * 1024 {
                                    return Err("Bun plugin transfer limit exceeded".into());
                                }
                            }
                            let call = active.get_mut(&call_id).unwrap();
                            let request = uuid::Uuid::new_v4().to_string();
                            call.pending.insert(
                                request.clone(),
                                (
                                    request_id,
                                    matches!(namespace.as_str(), "sync" | "dom" | "callback")
                                        .then(Instant::now),
                                    namespace == "dom",
                                ),
                            );
                            if namespace == "dom" && method == "dom.file.read-sync" {
                                call.file_requests.insert(request.clone());
                            }
                            let event = Event::Helper {
                                operation: call.input.operation.clone(),
                                request,
                                namespace,
                                method,
                                args_wire,
                            };
                            if let Some(sender) = pumps
                                .last()
                                .and_then(|owner| active.get(owner))
                                .and_then(|frame| frame.event_steps.as_ref())
                            {
                                sender
                                    .try_send(event)
                                    .map_err(|_| "Bun event reply queue unavailable")?;
                            } else {
                                events
                                    .send(event)
                                    .map_err(|_| "Bun plugin callback owner disappeared")?;
                            }
                        }
                        frame @ (Frame::Checkpoint { protocol: 1, .. }
                        | Frame::Prefix { protocol: 1, .. }) => {
                            let checkpoint = matches!(&frame, Frame::Checkpoint { .. });
                            let call_id = match frame {
                                Frame::Checkpoint { call_id, .. }
                                | Frame::Prefix { call_id, .. } => call_id,
                                _ => unreachable!(),
                            };
                            let call = active
                                .get_mut(&call_id)
                                .filter(|call| !call.body_done)
                                .ok_or("Bun event has no active grant")?;
                            if call.input.kind != "domEvent"
                                || call.event_steps.is_none()
                                || call.checkpoint
                                || checkpoint
                                    && call
                                        .pending
                                        .values()
                                        .any(|(_, started, _)| started.is_some())
                            {
                                return Err("Bun event prefix grant refused".into());
                            }
                            forward(
                                call,
                                if checkpoint {
                                    Event::Checkpoint {
                                        operation: call.input.operation.clone(),
                                    }
                                } else {
                                    Event::Prefix {
                                        operation: call.input.operation.clone(),
                                    }
                                },
                                events,
                            )?;
                            call.event_steps = None;
                            call.checkpoint = checkpoint;
                            pumps.retain(|capability| capability != &call_id);
                        }
                        Frame::Result {
                            protocol: 1,
                            call_id,
                            wire,
                        } => {
                            let call = active
                                .get(&call_id)
                                .filter(|call| !call.body_done)
                                .ok_or("Bun plugin result has no active grant")?;
                            if call.checkpoint
                                || !call.pending.is_empty()
                                || wire.len()
                                    > if call.input.kind.ends_with("Hooks") {
                                        WIRE_LIMIT
                                    } else {
                                        HELPER_LIMIT
                                    }
                            {
                                return Err("Bun plugin result grant refused".into());
                            }
                            lease.check()?;
                            set_interaction(active, &call_id, false)?;
                            let call = active.get_mut(&call_id).unwrap();
                            if call.input.kind == "domEvent" {
                                forward(
                                    call,
                                    Event::Complete {
                                        operation: call.input.operation.clone(),
                                        wire: wire.clone(),
                                    },
                                    events,
                                )?;
                            }
                            if let Some(reply) = call.reply.take() {
                                let _ = reply.send(Ok(wire));
                            }
                            call.body_done = true;
                            call.event_steps = None;
                            pumps.retain(|capability| capability != &call_id);
                            prune(active, &call_id);
                            idle_cpu = cpu;
                        }
                        Frame::Failure {
                            protocol: 1,
                            call_id,
                            error,
                        } if active.get(&call_id).is_some_and(|frame| !frame.body_done)
                            && error.len() <= 8192 =>
                        {
                            return Err(error);
                        }
                        Frame::Fatal { protocol: 1, error } if error.len() <= 8192 => {
                            return Err(error)
                        }
                        _ => return Err("Invalid or stale Bun plugin frame".into()),
                    }
                }
                Err(mpsc::TryRecvError::Empty) => {}
                Err(mpsc::TryRecvError::Disconnected) => {
                    return Err("Bun plugin output disconnected".into())
                }
            }
            std::thread::sleep(Duration::from_millis(5));
        }
    })();
    #[cfg(any(test, debug_assertions))]
    let peak_memory = pipes.process.peak_job_memory();
    let closed = pipes.close();
    let cleaned = sandbox.remove();
    closed?;
    cleaned?;
    #[cfg(any(test, debug_assertions))]
    {
        let peak_memory = peak_memory?;
        eprintln!("bun_session_job_peak_bytes={peak_memory}");
        if peak_memory > 128 * 1024 * 1024 {
            return Err(format!(
                "Bun session exceeded its original job memory budget: {peak_memory}"
            ));
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn physical_callback_grants_require_explicit_authority() {
        let (reply, _) = oneshot::channel();
        let input = Invocation {
            operation: "parent-1".into(),
            kind: "templateTagMetadata".into(),
            index: 0,
            wire: "[]".into(),
            helpers: false,
            synchronous: false,
            dom: false,
        };
        input.validate().unwrap();
        let mut call = Active {
            event_steps: None,
            checkpoint: false,
            input,
            capability: "native-only".into(),
            reply: Some(reply),
            parent: None,
            body_done: false,
            interaction: false,
            waiters: 0,
            started: Instant::now(),
            cpu: Duration::ZERO,
            waited: Duration::ZERO,
            waiting: None,
            calls: 0,
            transferred: 0,
            pending: HashMap::new(),
            file_requests: HashSet::new(),
        };
        assert!(!allowed("store", "clear", &call));
        assert!(!allowed("helper", "util.render", &call));
        call.input.kind = "templateTags".into();
        assert!(allowed("store", "getItem", &call));
        assert!(!allowed("helper", "util.render", &call));
        call.input.helpers = true;
        assert!(allowed("helper", "util.render", &call));
        assert!(!allowed("sync", "app.getInfo", &call));
        call.input.synchronous = true;
        assert!(allowed("sync", "app.getInfo", &call));
        assert!(!allowed("sync", "save_workspace", &call));
        assert!(!allowed("sync", "dom.create", &call));
        assert!(!allowed("dom", "dom.create", &call));
        assert!(!allowed("callback", "callback.retain", &call));
        assert!(!allowed("file", "dom.file.read", &call));
        call.input.dom = true;
        assert!(allowed("dom", "dom.create", &call));
        assert!(allowed("callback", "callback.retain", &call));
        assert!(allowed("dom", "dom.files", &call));
        assert!(allowed("dom", "dom.file.read-sync", &call));
        assert!(allowed("file", "dom.file.read", &call));
        assert!(!allowed("file", "dom.file.read-sync", &call));
        assert!(!allowed("file", "dom.files", &call));
        assert!(!allowed("callback", "callback.invoke", &call));
        for method in [
            "dom.listen",
            "dom.unlisten",
            "dom.handler",
            "dom.dispatch",
            "dom.event",
            "dom.event-late",
        ] {
            assert!(allowed("dom", method, &call));
        }
        assert!(!allowed("dom", "dom.file.read", &call));
        call.input.synchronous = false;
        assert!(call.input.validate().is_err());
        call.input.synchronous = true;
        call.input.kind = "domCallback".into();
        call.input.index = 128;
        assert!(call.input.validate().is_ok());
        call.input.kind = "domEvent".into();
        assert!(call.input.validate().is_ok());
        call.input.dom = false;
        assert!(call.input.validate().is_err());
        call.input.kind = "domRelease".into();
        assert!(call.input.validate().is_err());
        call.input.helpers = false;
        call.input.synchronous = false;
        assert!(call.input.validate().is_ok());
        assert!(!allowed("store", "clear", &call));
        assert!(!allowed("callback", "callback.retain", &call));
        call.input.kind = "templateTags".into();
        call.input.index = 0;
        call.input.helpers = true;
        call.input.synchronous = true;
        call.input.dom = true;
        for (namespace, method) in [
            ("helper", "dom.file.read"),
            ("helper", "save_workspace"),
            ("store", "invoke"),
            ("native", "util.render"),
        ] {
            assert!(!allowed(namespace, method, &call));
        }
        assert!(serde_json::from_str::<Frame>(r#"{"type":"helper","protocol":1,"callId":"x","requestId":1,"namespace":"store","method":"clear","argsWire":"[]","owner":"invented"}"#).is_err());
        call.input.kind = "templateTagMetadata".into();
        assert!(call.input.validate().is_err());
    }
    #[test]
    fn event_pipe_rejects_foreign_and_retired_steps() {
        let state = InspectionState::default();
        let (sender, receiver) = mpsc::sync_channel(65);
        let mut pipe = EventPipe {
            frames: vec![("owned".into(), receiver)],
        };
        assert!(pipe
            .request(
                &state,
                "unused",
                EventRequest::Next {
                    operation: "foreign".into()
                }
            )
            .is_err());
        assert!(pipe
            .request(
                &state,
                "unused",
                EventRequest::Reply {
                    operation: "owned".into(),
                    request: "request".into(),
                    wire: Some("wire".into()),
                    error: Some("error".into())
                }
            )
            .is_err());
        sender
            .send(Event::Prefix {
                operation: "owned".into(),
            })
            .unwrap();
        assert_eq!(
            pipe.request(
                &state,
                "unused",
                EventRequest::Next {
                    operation: "owned".into()
                }
            )
            .unwrap()["type"],
            "prefix"
        );
        assert!(pipe.frames.is_empty());
        assert!(pipe
            .request(
                &state,
                "unused",
                EventRequest::Next {
                    operation: "owned".into()
                }
            )
            .is_err());
        assert!(serde_json::from_str::<EventRequest>(
            r#"{"type":"next","operation":"owned","session":"forged"}"#
        )
        .is_err());
    }
}

#[cfg(all(test, windows))]
pub(crate) fn verify_native_session(executable: &std::path::Path) {
    let expected: serde_json::Value =
        serde_json::from_slice(&std::fs::read(executable.with_extension("session.json")).unwrap())
            .unwrap();
    let state = InspectionState::default();
    let network = NetworkState::default();
    let id = state.reserve().unwrap();
    let (send, receive) = mpsc::sync_channel(64);
    let lease = state
        .start_session(
            id.clone(),
            network
                .retain_native_work("persistent-test".into())
                .unwrap(),
            Some(send.clone()),
        )
        .unwrap();
    let (ready, opened) = oneshot::channel();
    let (events, received) = mpsc::channel();
    let channel = tauri::ipc::Channel::new(move |body| {
        events.send(body).unwrap();
        Ok(())
    });
    let executable = executable.to_path_buf();
    let worker_id = id.clone();
    let worker = std::thread::spawn(move || {
        let source=std::fs::read_to_string(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../tests/ui/fixtures/plugin-sandbox.cjs")).unwrap()+"\nlet count=0;exports.templateTags=[{name:'native',async run(context,mode){if(mode==='next')return ++count;return context.util.render('native');}},{name:'sync',run(context){return context.app.clipboard.readText();}},{name:'dom',run(context,mode){if(mode==='retain'){const body=document.createElement('div');context.app.dialog('event',body,{onHide(){Promise.resolve().then(()=>{body.textContent='ready';});}});return 1;}return document.createElement('div') instanceof HTMLElement?1:0;}}];exports.templateTags.push({name:'async',run(context){const body=document.createElement('div');context.app.dialog('async',body,{async onHide(){body.textContent='async-prefix';await context.util.render('native');body.textContent='async-resumed';await context.store.setItem('async','done');}});return 1;}});";
        let snapshot = crate::plugin_package::PluginPackageSource {
            name: "insomnia-plugin-native-session".into(),
            entry: "main.cjs".into(),
            format: "commonjs".into(),
            files: std::collections::BTreeMap::from([
                ("main.cjs".into(), source),
                ("canary.json".into(), "must-survive".into()),
            ]),
        };
        let mut ready = Some(ready);
        let mut active = HashMap::new();
        let result = run(
            &executable,
            &worker_id,
            snapshot,
            &lease,
            &channel,
            receive,
            &mut ready,
            &mut active,
        );
        for mut frame in active.into_values() {
            if let Some(reply) = frame.reply.take() {
                let _ = reply.send(Err("session ended".into()));
            }
        }
        result
    });
    let checked = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let metadata = opened.blocking_recv().unwrap().unwrap();
        assert_eq!(metadata.snapshot.name, "insomnia-plugin-native-session");
        let invoke_steps = |indices: &[usize]| {
            for &index in indices {
                let (reply, result) = oneshot::channel();
                send.send(Command::Invoke(
                    Invocation {
                        operation: format!("native-{index}"),
                        kind: if index == 5 {
                            "requestHooks"
                        } else {
                            "templateTags"
                        }
                        .into(),
                        index: if index == 6 {
                            2
                        } else if index == 4 {
                            1
                        } else {
                            0
                        },
                        wire: expected[if index >= 3 { "helperArgs" } else { "nextArgs" }]
                            .as_str()
                            .unwrap()
                            .into(),
                        helpers: matches!(index, 3 | 4 | 6),
                        synchronous: matches!(index, 4 | 6),
                        dom: index == 6,
                    },
                    reply,
                ))
                .unwrap();
                if matches!(index, 3 | 4 | 6) {
                    let event = loop {
                        let body = received.recv_timeout(Duration::from_secs(10)).unwrap();
                        let event: serde_json::Value = body.deserialize().unwrap();
                        if event["type"] == "helper" {
                            break event;
                        }
                    };
                    assert_eq!(
                        event["namespace"],
                        if index == 6 {
                            "dom"
                        } else if index == 4 {
                            "sync"
                        } else {
                            "helper"
                        }
                    );
                    assert_eq!(
                        event["method"],
                        if index == 6 {
                            "dom.create"
                        } else if index == 4 {
                            "app.clipboard.readText"
                        } else {
                            "util.render"
                        }
                    );
                    if index == 3 {
                        assert_eq!(event["argsWire"], expected["helperRequest"]);
                    }
                    let (reply, refused) = oneshot::channel();
                    send.send(Command::Helper {
                        request: "foreign-request".into(),
                        wire: Some(
                            expected[if index == 6 {
                                "domReply"
                            } else {
                                "helperResult"
                            }]
                            .as_str()
                            .unwrap()
                            .into(),
                        ),
                        error: None,
                        reply,
                    })
                    .unwrap();
                    assert!(refused.blocking_recv().unwrap().is_err());
                    let (reply, accepted) = oneshot::channel();
                    send.send(Command::Helper {
                        request: event["request"].as_str().unwrap().into(),
                        wire: Some(
                            expected[if index == 6 {
                                "domReply"
                            } else {
                                "helperResult"
                            }]
                            .as_str()
                            .unwrap()
                            .into(),
                        ),
                        error: None,
                        reply,
                    })
                    .unwrap();
                    accepted.blocking_recv().unwrap().unwrap();
                }
                let wire = result
                    .blocking_recv()
                    .unwrap()
                    .unwrap_or_else(|error| panic!("native session step {index}: {error}"));
                if index == 5 {
                    assert!(wire.contains("fileOperations") && wire.contains("asyncWrites"));
                    assert!(wire.contains(r#"["asyncReads",["number",2]]"#));
                    continue;
                }
                assert_eq!(
                    wire,
                    expected[if index == 1 || index == 6 {
                        "one"
                    } else if index == 2 {
                        "two"
                    } else {
                        "helperResult"
                    }]
                    .as_str()
                    .unwrap()
                );
            }
        };
        invoke_steps(&[1, 2, 3, 4, 5, 6]);
        let (reply, result) = oneshot::channel();
        send.send(Command::Invoke(
            Invocation {
                operation: "retain".into(),
                kind: "templateTags".into(),
                index: 2,
                wire: expected["retainArgs"].as_str().unwrap().into(),
                helpers: true,
                synchronous: true,
                dom: true,
            },
            reply,
        ))
        .unwrap();
        for method in ["dom.create", "callback.retain", "dom.dialog"] {
            let event: serde_json::Value = loop {
                let body = received.recv_timeout(Duration::from_secs(10)).unwrap();
                let event: serde_json::Value = body.deserialize().unwrap();
                if event["type"] == "helper" {
                    break event;
                }
            };
            assert_eq!(event["method"], method);
            let (reply, accepted) = oneshot::channel();
            send.send(Command::Helper {
                request: event["request"].as_str().unwrap().into(),
                wire: Some(
                    expected[if method == "dom.create" {
                        "domReply"
                    } else {
                        "undefined"
                    }]
                    .as_str()
                    .unwrap()
                    .into(),
                ),
                error: None,
                reply,
            })
            .unwrap();
            accepted.blocking_recv().unwrap().unwrap();
        }
        assert_eq!(
            result.blocking_recv().unwrap().unwrap(),
            expected["one"].as_str().unwrap()
        );
        let mut pipe = EventPipe::default();
        let event = pipe
            .request(
                &state,
                &id,
                EventRequest::Invoke {
                    input: Invocation {
                        operation: "event".into(),
                        kind: "domEvent".into(),
                        index: 1,
                        wire: expected["helperArgs"].as_str().unwrap().into(),
                        helpers: true,
                        synchronous: true,
                        dom: true,
                    },
                },
            )
            .unwrap();
        assert_eq!(event["type"], "helper");
        assert_eq!(event["method"], "dom.set");
        let mut foreign = EventPipe::default();
        assert!(foreign
            .request(
                &state,
                &id,
                EventRequest::InvokeNested {
                    parent_request: "foreign-request".into(),
                    input: Invocation {
                        operation: "foreign".into(),
                        kind: "domEvent".into(),
                        index: 1,
                        wire: expected["helperArgs"].as_str().unwrap().into(),
                        helpers: true,
                        synchronous: true,
                        dom: true
                    }
                }
            )
            .is_err());
        let mut frames = vec![event];
        for depth in 1..=2 {
            let step = pipe
                .request(
                    &state,
                    &id,
                    EventRequest::InvokeNested {
                        parent_request: frames.last().unwrap()["request"].as_str().unwrap().into(),
                        input: Invocation {
                            operation: format!("nested-{depth}"),
                            kind: "domEvent".into(),
                            index: 1,
                            wire: expected["helperArgs"].as_str().unwrap().into(),
                            helpers: true,
                            synchronous: true,
                            dom: true,
                        },
                    },
                )
                .unwrap();
            assert_eq!(step["method"], "dom.set");
            frames.push(step);
        }
        for step in frames.into_iter().rev() {
            let done = pipe
                .request(
                    &state,
                    &id,
                    EventRequest::Reply {
                        operation: step["operation"].as_str().unwrap().into(),
                        request: step["request"].as_str().unwrap().into(),
                        wire: Some(expected["undefined"].as_str().unwrap().into()),
                        error: None,
                    },
                )
                .unwrap();
            assert_eq!(done["type"], "complete");
            assert_eq!(done["wire"], expected["undefined"]);
        }
        assert!(pipe.frames.is_empty());
        let (reply, result) = oneshot::channel();
        send.send(Command::Invoke(
            Invocation {
                operation: "retain-async".into(),
                kind: "templateTags".into(),
                index: 3,
                wire: expected["helperArgs"].as_str().unwrap().into(),
                helpers: true,
                synchronous: true,
                dom: true,
            },
            reply,
        ))
        .unwrap();
        for method in ["dom.create", "callback.retain", "dom.dialog"] {
            let event: serde_json::Value = loop {
                let event: serde_json::Value = received
                    .recv_timeout(Duration::from_secs(10))
                    .unwrap()
                    .deserialize()
                    .unwrap();
                if event["type"] == "helper" {
                    break event;
                }
            };
            assert_eq!(event["method"], method);
            let (reply, accepted) = oneshot::channel();
            send.send(Command::Helper {
                request: event["request"].as_str().unwrap().into(),
                wire: Some(
                    expected[if method == "dom.create" {
                        "domReply"
                    } else {
                        "undefined"
                    }]
                    .as_str()
                    .unwrap()
                    .into(),
                ),
                error: None,
                reply,
            })
            .unwrap();
            accepted.blocking_recv().unwrap().unwrap();
        }
        assert_eq!(
            result.blocking_recv().unwrap().unwrap(),
            expected["one"].as_str().unwrap()
        );
        let parent = pipe
            .request(
                &state,
                &id,
                EventRequest::Invoke {
                    input: Invocation {
                        operation: "async-parent".into(),
                        kind: "domEvent".into(),
                        index: 1,
                        wire: expected["helperArgs"].as_str().unwrap().into(),
                        helpers: true,
                        synchronous: true,
                        dom: true,
                    },
                },
            )
            .unwrap();
        let child = pipe
            .request(
                &state,
                &id,
                EventRequest::InvokeNested {
                    parent_request: parent["request"].as_str().unwrap().into(),
                    input: Invocation {
                        operation: "async-child".into(),
                        kind: "domEvent".into(),
                        index: 2,
                        wire: expected["helperArgs"].as_str().unwrap().into(),
                        helpers: true,
                        synchronous: true,
                        dom: true,
                    },
                },
            )
            .unwrap();
        assert_eq!(child["method"], "dom.set");
        let helper = pipe
            .request(
                &state,
                &id,
                EventRequest::Reply {
                    operation: "async-child".into(),
                    request: child["request"].as_str().unwrap().into(),
                    wire: Some(expected["undefined"].as_str().unwrap().into()),
                    error: None,
                },
            )
            .unwrap();
        assert_eq!(helper["method"], "util.render");
        assert_eq!(
            pipe.request(
                &state,
                &id,
                EventRequest::Next {
                    operation: "async-child".into()
                }
            )
            .unwrap()["type"],
            "prefix"
        );
        assert_eq!(
            pipe.request(
                &state,
                &id,
                EventRequest::Reply {
                    operation: "async-parent".into(),
                    request: parent["request"].as_str().unwrap().into(),
                    wire: Some(expected["undefined"].as_str().unwrap().into()),
                    error: None
                }
            )
            .unwrap()["type"],
            "complete"
        );
        let (reply, blocked) = oneshot::channel();
        send.send(Command::Invoke(
            Invocation {
                operation: "blocked".into(),
                kind: "templateTags".into(),
                index: 0,
                wire: expected["nextArgs"].as_str().unwrap().into(),
                helpers: false,
                synchronous: false,
                dom: false,
            },
            reply,
        ))
        .unwrap();
        assert!(blocked.blocking_recv().unwrap().is_err());
        let sibling_input = |operation: &str| Invocation {
            operation: operation.into(),
            kind: "domEvent".into(),
            index: 1,
            wire: expected["helperArgs"].as_str().unwrap().into(),
            helpers: true,
            synchronous: true,
            dom: true,
        };
        for (parent, operation) in [
            ("foreign", "foreign-sibling"),
            ("async-parent", "retired-sibling"),
            ("async-child", "async-child"),
        ] {
            assert!(EventPipe::default()
                .request(
                    &state,
                    &id,
                    EventRequest::InvokeSibling {
                        parent_operation: parent.into(),
                        input: sibling_input(operation),
                    }
                )
                .is_err());
        }
        let sibling = pipe
            .request(
                &state,
                &id,
                EventRequest::InvokeSibling {
                    parent_operation: "async-child".into(),
                    input: sibling_input("sibling"),
                },
            )
            .unwrap();
        assert_eq!(sibling["operation"], "sibling");
        assert_eq!(sibling["method"], "dom.set");
        let done = pipe
            .request(
                &state,
                &id,
                EventRequest::Reply {
                    operation: "sibling".into(),
                    request: sibling["request"].as_str().unwrap().into(),
                    wire: Some(expected["undefined"].as_str().unwrap().into()),
                    error: None,
                },
            )
            .unwrap();
        assert_eq!(done["type"], "complete");
        assert_eq!(done["operation"], "sibling");
        let (reply, accepted) = oneshot::channel();
        send.send(Command::Helper {
            request: helper["request"].as_str().unwrap().into(),
            wire: Some(expected["helperResult"].as_str().unwrap().into()),
            error: None,
            reply,
        })
        .unwrap();
        accepted.blocking_recv().unwrap().unwrap();
        for method in ["dom.set", "setItem"] {
            let event: serde_json::Value = loop {
                let event: serde_json::Value = received
                    .recv_timeout(Duration::from_secs(10))
                    .unwrap()
                    .deserialize()
                    .unwrap();
                if event["type"] == "helper" && event["operation"] == "async-child" {
                    break event;
                }
            };
            assert_eq!(event["method"], method);
            let (reply, accepted) = oneshot::channel();
            send.send(Command::Helper {
                request: event["request"].as_str().unwrap().into(),
                wire: Some(expected["undefined"].as_str().unwrap().into()),
                error: None,
                reply,
            })
            .unwrap();
            accepted.blocking_recv().unwrap().unwrap();
        }
        loop {
            let event: serde_json::Value = received
                .recv_timeout(Duration::from_secs(10))
                .unwrap()
                .deserialize()
                .unwrap();
            if event["type"] == "complete" && event["operation"] == "async-child" {
                break;
            }
        }
        eprintln!("native session transport assertions passed, including waiting sibling and foreign/retired/duplicate refusals");
    }));
    network.close();
    let result = worker.join().unwrap();
    assert!(
        result
            .as_ref()
            .is_err_and(|error| error.contains("cancelled")),
        "{result:?}"
    );
    checked.unwrap();
}
