//! Independent event transport. Complete event/clipboard acceptance is pending.
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::{
    http::{Request, Response},
    Manager,
};
use tauri_plugin_clipboard_manager::ClipboardExt;

struct Lease {
    label: String,
    origin: String,
    expires: Instant,
    clipboard: bool,
    bun: Option<(String, Arc<Mutex<crate::plugin_bun_session::EventPipe>>)>,
}
#[derive(Default)]
pub struct EventTransportState(Mutex<HashMap<String, Lease>>);
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventTransportLease {
    token: String,
    info_url: String,
    desktop_url: String,
    clipboard_read_url: Option<String>,
    clipboard_write_url: Option<String>,
    clipboard_clear_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bun_url: Option<String>,
}

fn admitted_origin(origin: &str) -> bool {
    matches!(
        origin,
        "http://tauri.localhost" | "https://tauri.localhost" | "tauri://localhost"
    )
}
pub(crate) fn caller(window: &tauri::WebviewWindow) -> Result<String, String> {
    let origin = window
        .url()
        .map_err(|e| e.to_string())?
        .origin()
        .ascii_serialization();
    if window.label() != "main" || !admitted_origin(&origin) {
        return Err("Event transport requires the local main webview".into());
    }
    Ok(origin)
}
#[tauri::command]
pub fn begin_plugin_event_transport(
    window: tauri::WebviewWindow,
    state: tauri::State<EventTransportState>,
    ttl_ms: u64,
    clipboard_access: Option<bool>,
    bun_session: Option<String>,
) -> Result<EventTransportLease, String> {
    let origin = caller(&window)?;
    if !(100..=20_000).contains(&ttl_ms)
        || bun_session.as_ref().is_some_and(|id| {
            id.is_empty()
                || id.len() > 128
                || !id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
        })
    {
        return Err("Invalid event transport lifetime".into());
    }
    let mut leases = state
        .0
        .lock()
        .map_err(|_| "Event transport lock poisoned")?;
    leases.retain(|_, lease| lease.expires > Instant::now());
    if leases.len() >= 128 {
        return Err("Event transport lease limit exceeded".into());
    }
    let token = uuid::Uuid::new_v4().simple().to_string();
    leases.insert(
        token.clone(),
        Lease {
            label: window.label().to_owned(),
            origin,
            expires: Instant::now() + Duration::from_millis(ttl_ms),
            clipboard: clipboard_access == Some(true),
            bun: bun_session.as_ref().map(|id| {
                (
                    id.clone(),
                    Arc::new(Mutex::new(crate::plugin_bun_session::EventPipe::default())),
                )
            }),
        },
    );
    let base = if cfg!(any(target_os = "windows", target_os = "android")) {
        "http://insomnium-event.localhost"
    } else {
        "insomnium-event://localhost"
    };
    Ok(EventTransportLease {
        bun_url: bun_session.map(|_| format!("{base}/bun?token={token}")),
        info_url: format!("{base}/info?token={token}"),
        desktop_url: format!("{base}/desktop?token={token}"),
        clipboard_read_url: clipboard_access
            .filter(|access| *access)
            .map(|_| format!("{base}/clipboard/read?token={token}")),
        clipboard_write_url: clipboard_access
            .filter(|access| *access)
            .map(|_| format!("{base}/clipboard/write?token={token}")),
        clipboard_clear_url: clipboard_access
            .filter(|access| *access)
            .map(|_| format!("{base}/clipboard/clear?token={token}")),
        token,
    })
}
#[tauri::command]
pub fn end_plugin_event_transport(
    window: tauri::WebviewWindow,
    state: tauri::State<EventTransportState>,
    token: String,
) -> Result<bool, String> {
    caller(&window)?;
    let mut leases = state
        .0
        .lock()
        .map_err(|_| "Event transport lock poisoned")?;
    if !leases
        .get(&token)
        .is_some_and(|lease| lease.label == window.label())
    {
        return Ok(false);
    }
    Ok(leases.remove(&token).is_some())
}
pub fn cancel_all(state: &EventTransportState) {
    if let Ok(mut leases) = state.0.lock() {
        leases.clear();
    }
}

pub fn handle(
    context: tauri::UriSchemeContext<'_, tauri::Wry>,
    request: Request<Vec<u8>>,
    responder: tauri::UriSchemeResponder,
) {
    let app = context.app_handle().clone();
    let label = context.webview_label().to_owned();
    let work = app
        .try_state::<crate::http::NetworkState>()
        .ok_or_else(|| "Native event transport state unavailable".to_string())
        .and_then(|state| {
            state.retain_native_work(format!("plugin-event:{}", uuid::Uuid::new_v4()))
        });
    let work = match work {
        Ok(work) => work,
        Err(error) => {
            let origin = request
                .headers()
                .get("origin")
                .and_then(|value| value.to_str().ok())
                .unwrap_or("");
            responder.respond(event_response(origin, Err(error)));
            return;
        }
    };
    tauri::async_runtime::spawn_blocking(move || {
        // Retain the actual native callback, including clipboard/event-loop
        // work and the final responder, independently of a renderer awaiter.
        let _work = work;
        let response = if _work.cancelled() {
            let origin = request
                .headers()
                .get("origin")
                .and_then(|value| value.to_str().ok())
                .unwrap_or("");
            event_response(origin, Err("Event transport cancelled".into()))
        } else {
            process_request(&app, &label, request)
        };
        responder.respond(response)
    });
}

fn process_request(
    app: &tauri::AppHandle,
    label: &str,
    request: Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    let origin = request
        .headers()
        .get("origin")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    let result = (|| -> Result<serde_json::Value, String> {
        if !matches!(request.method().as_str(), "GET" | "POST")
            || request.body().len()
                > if request.uri().path() == "/bun" {
                    2 * 1024 * 1024 + 65536
                } else {
                    1024 * 1024
                }
            || label != "main"
            || !admitted_origin(origin)
        {
            return Err("Event transport request refused".into());
        }
        let token = request
            .uri()
            .query()
            .and_then(|value| value.strip_prefix("token="))
            .filter(|value| value.len() == 32 && value.bytes().all(|byte| byte.is_ascii_hexdigit()))
            .ok_or("Invalid event transport token")?;
        let window = app
            .get_webview_window("main")
            .ok_or("Event transport window closed")?;
        if caller(&window)? != origin {
            return Err("Event transport origin changed".into());
        }
        let state = app.state::<EventTransportState>();
        let validate = |leases: &HashMap<String, Lease>| -> Result<bool, String> {
            let lease = leases.get(token).ok_or("Event transport lease retired")?;
            if lease.label != label || lease.origin != origin || lease.expires <= Instant::now() {
                return Err("Event transport lease expired or changed".into());
            }
            Ok(lease.clipboard)
        };
        let (clipboard, bun) = {
            let leases = state
                .0
                .lock()
                .map_err(|_| "Event transport lock poisoned")?;
            (
                validate(&leases)?,
                leases.get(token).and_then(|lease| lease.bun.clone()),
            )
        };
        let get = request.method() == "GET" && request.body().is_empty();
        let value = match request.uri().path() {
            "/bun" if request.method() == "POST" => {
                let (session, pipe) = bun.ok_or("Bun event capability is unavailable")?;
                let command = serde_json::from_slice(request.body()).map_err(|_| "Invalid Bun event payload")?;
                if let crate::plugin_bun_session::EventRequest::FileReply { request, wire, error } = command {
                    crate::plugin_bun_session::reply_file_helper(&app.state::<crate::plugin_inspection::InspectionState>(), &session, request, wire, error)
                } else {
                    let mut pipe = pipe.lock().map_err(|_| "Bun event state unavailable")?;
                    pipe.request(&app.state::<crate::plugin_inspection::InspectionState>(), &session, command)
                }
            }
            "/info" if get => Ok(
                serde_json::json!({"version": app.package_info().version.to_string(), "platform": if cfg!(target_os="windows") {"win32"} else if cfg!(target_os="macos") {"darwin"} else {std::env::consts::OS}}),
            ),
            "/desktop" if get => Ok(serde_json::json!(app
                .path()
                .desktop_dir()
                .map_err(|e| e.to_string())?
                .to_string_lossy())),
            "/clipboard/read" if get && clipboard => match app.clipboard().read_text() {
                Ok(text)=>Ok(serde_json::Value::String(text)),
                Err(tauri_plugin_clipboard_manager::Error::Clipboard(message)) if message=="The clipboard contents were not available in the requested format or the clipboard is empty."=>Ok(serde_json::Value::String(String::new())),
                Err(error)=>Err(error.to_string()),
            },
            "/clipboard/write" | "/clipboard/clear" if request.method() == "POST" && clipboard => {
                let body: serde_json::Value = serde_json::from_slice(request.body())
                    .map_err(|_| "Invalid clipboard payload")?;
                let object = body.as_object().ok_or("Invalid clipboard payload")?;
                let text = if request.uri().path() == "/clipboard/write" {
                    if object.len() != 1 {
                        return Err("Invalid clipboard payload".into());
                    }
                    Some(
                        object
                            .get("text")
                            .and_then(|text| text.as_str())
                            .ok_or("Invalid clipboard text")?,
                    )
                } else {
                    if !object.is_empty() {
                        return Err("Invalid clipboard clear payload".into());
                    }
                    None
                };
                // Serialize admission/retirement with the actual mutation, but
                // never hold this lock while querying the native event loop.
                if caller(&window)? != origin {
                    return Err("Event transport origin changed".into());
                }
                let leases = state
                    .0
                    .lock()
                    .map_err(|_| "Event transport lock poisoned")?;
                if !validate(&leases)? {
                    return Err("Clipboard capability is unavailable".into());
                }
                crate::plugin_clipboard_probe::guarded_mutation(app, text)?;
                Ok(serde_json::Value::Null)
            }
            _ => Err("Unsupported event transport operation".into()),
        }?;
        if caller(&window)? != origin {
            return Err("Event transport origin changed".into());
        }
        let leases = state
            .0
            .lock()
            .map_err(|_| "Event transport lock poisoned")?;
        validate(&leases)?;
        Ok(value)
    })();
    event_response(origin, result)
}

fn event_response(origin: &str, result: Result<serde_json::Value, String>) -> Response<Vec<u8>> {
    let (status, value) = match result {
        Ok(value) => (200, value),
        Err(error) => (403, serde_json::json!({"error":error})),
    };
    let mut response = Response::builder()
        .status(status)
        .header("Content-Type", "application/json")
        .header("Cache-Control", "no-store")
        .header("Vary", "Origin")
        .header("Cross-Origin-Resource-Policy", "cross-origin");
    if admitted_origin(origin) {
        response = response.header("Access-Control-Allow-Origin", origin);
    }
    response
        .body(serde_json::to_vec(&value).unwrap_or_default())
        .expect("Static event transport response")
}
