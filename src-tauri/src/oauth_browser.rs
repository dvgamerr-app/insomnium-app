use crate::{
    http::{build_client, HttpRequest, NetworkState},
    oauth::{OAuthConfig, OAuthToken},
    oauth_callback::{prepare_redirect, Authorization, Callback, CallbackResponse},
};
use serde::Serialize;
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::ipc::Channel;
use tauri_plugin_opener::OpenerExt;
use tokio::sync::oneshot;

struct Pending {
    callback: Arc<Callback>,
    sender: oneshot::Sender<Result<CallbackResponse, String>>,
}
type PendingMap = Arc<Mutex<HashMap<String, Pending>>>;
#[derive(Default)]
pub struct OAuthBrowserState {
    pending: PendingMap,
}
struct Registration {
    pending: PendingMap,
    id: String,
}
impl Drop for Registration {
    fn drop(&mut self) {
        if let Ok(mut pending) = self.pending.lock() {
            pending.remove(&self.id);
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserEvent {
    id: String,
    stage: &'static str,
    redirect_url: String,
    mode: &'static str,
    expires_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    warning: Option<String>,
}

fn complete(pending: &PendingMap, id: &str, value: Result<CallbackResponse, String>) {
    if let Ok(mut map) = pending.lock() {
        if let Some(session) = map.remove(id) {
            let _ = session.sender.send(value);
        }
    }
}

#[tauri::command]
pub fn submit_oauth_callback(
    id: String,
    url: String,
    state: tauri::State<'_, OAuthBrowserState>,
) -> Result<(), String> {
    let mut pending = state
        .pending
        .lock()
        .map_err(|_| "OAuth callback state is unavailable.")?;
    let session = pending
        .get(&id)
        .ok_or("This authorization is no longer waiting for a callback.")?;
    let response = session.callback.validate(&url)?;
    let session = pending
        .remove(&id)
        .ok_or("This authorization has already completed.")?;
    session
        .sender
        .send(response)
        .map_err(|_| "This authorization is no longer waiting for a callback.".into())
}

#[tauri::command]
pub async fn authorize_oauth(
    app: tauri::AppHandle,
    mut request: HttpRequest,
    config: OAuthConfig,
    on_event: Channel<BrowserEvent>,
    state: tauri::State<'_, NetworkState>,
    browsers: tauri::State<'_, OAuthBrowserState>,
    cookie_state: tauri::State<'_, crate::cookies::CookieState>,
) -> Result<Option<OAuthToken>, String> {
    if !matches!(
        config.grant_type.as_str(),
        "authorization_code" | "implicit"
    ) {
        return Err("Choose Authorization Code or Implicit for browser login.".into());
    }
    let url = reqwest::Url::parse(&request.url).map_err(|_| "Invalid OAuth token URL.")?;
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
    {
        return Err("Invalid OAuth token URL.".into());
    }
    request.follow_redirects = false;
    request.digest = None;
    request.oauth1 = None;
    request.aws = None;
    request.hawk = None;
    request.asap = None;
    request.ntlm = None;
    request.netrc = false;
    let mut cancelled = state.begin(&request.id)?;
    let mut jar = None;
    let operation = async {
        let (redirect, listener) = prepare_redirect(&config).await?;
        let authorization = Authorization::new(&config, redirect)?;
        let (sender, receiver) = oneshot::channel();
        browsers
            .pending
            .lock()
            .map_err(|_| "OAuth callback state is unavailable.")?
            .insert(
                request.id.clone(),
                Pending {
                    callback: authorization.callback.clone(),
                    sender,
                },
            );
        let registration = Registration {
            pending: browsers.pending.clone(),
            id: request.id.clone(),
        };
        let expires_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "Invalid system clock.")?
            .as_millis() as u64
            + 300_000;
        let mut event = BrowserEvent {
            id: request.id.clone(),
            stage: "waiting",
            redirect_url: authorization.redirect_uri().to_string(),
            mode: if config.browser_mode == "embedded" {
                "embedded"
            } else if listener.is_some() {
                "loopback"
            } else {
                "manual"
            },
            expires_at,
            warning: None,
        };
        on_event
            .send(event.clone())
            .map_err(|_| "Could not update OAuth login status.")?;
        let login_window = if config.browser_mode == "embedded" {
            let pending = browsers.pending.clone();
            let run_id = request.id.clone();
            let complete = Arc::new(move |value| complete(&pending, &run_id, value));
            let channel = on_event.clone();
            let status = event.clone();
            let notice = Arc::new(move |message: &str| {
                let mut warning = status.clone();
                warning.warning = Some(message.to_string());
                let _ = channel.send(warning);
            });
            let app = app.clone();
            let url = authorization.url.clone();
            let callback = authorization.callback.clone();
            let session = config.browser_session.clone();
            Some(
                tauri::async_runtime::spawn_blocking(move || {
                    crate::oauth_embedded::open(app, url, callback, session, complete, notice)
                })
                .await
                .map_err(|_| "Could not initialize the OAuth login window.")??,
            )
        } else {
            app.opener()
                .open_url(authorization.url.as_str(), None::<&str>)
                .map_err(|_| {
                    "Could not open the system browser. Check the OS default browser and try again."
                })?;
            None
        };
        let callback = authorization.callback.clone();
        let wait = async {
            tokio::select! {
                result = receiver => result.map_err(|_| "OAuth callback was cancelled.".to_string())?,
                result = async { match listener { Some(listener) => listener.wait(callback).await, None => std::future::pending().await } } => result,
            }
        };
        let response = tokio::time::timeout(Duration::from_secs(300), wait)
            .await
            .map_err(|_| "Authorization timed out after five minutes.")??;
        drop(registration);
        drop(login_window);
        let code = match response {
            CallbackResponse::Code(code) => code,
            CallbackResponse::Tokens(token) => return Ok(Some(*token)),
            CallbackResponse::Empty => return Ok(None),
        };
        event.stage = "exchanging";
        on_event
            .send(event)
            .map_err(|_| "Could not update OAuth login status.")?;
        let exchange = async {
            if request.use_cookies && (request.send_cookies || request.store_cookies) {
                jar = Some(cookie_state.jar(&app, request.workspace_id.clone()).await?);
            }
            let client = build_client(&request, &url, jar.as_ref(), false, false)
                .map_err(|_| "Invalid OAuth proxy, CA or client certificate settings.")?;
            crate::oauth::exchange_code(&client, &url, &config, authorization.grant(code)).await
        };
        tokio::time::timeout(
            Duration::from_millis(request.timeout_ms.clamp(1, 3_600_000)),
            exchange,
        )
        .await
        .map_err(|_| "OAuth token request timed out.")?
        .map(Some)
    };
    let mut result: Result<Option<OAuthToken>, String> = tokio::select! {
        result = operation => result,
        _ = cancelled.changed() => Err("OAuth authorization cancelled.".into()),
    };
    if let Some(jar) = jar {
        if jar.flush().await.is_err() {
            let warning = "OAuth collection cookies could not be saved.";
            match &mut result {
                Ok(Some(token)) => token.warnings.push(warning.into()),
                Ok(None) => {}
                Err(error) => {
                    error.push(' ');
                    error.push_str(warning);
                }
            }
        }
    }
    state.finish(&request.id)?;
    result
}
