//! Optional legacy login window. Remote content has no application IPC capability.
use crate::{
    oauth_callback::{Callback, CallbackResponse},
    oauth_navigation::{navigation, session_identifier, Navigation},
};
use oauth2::CsrfToken;
use reqwest::Url;
use std::sync::Arc;
use tauri::{
    webview::NewWindowResponse, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
    WindowEvent,
};

pub type Complete = Arc<dyn Fn(Result<CallbackResponse, String>) + Send + Sync>;
pub type Notice = Arc<dyn Fn(&str) + Send + Sync>;

/// The window is owned by the authorization future, including early errors/cancellation.
pub struct LoginWindow(WebviewWindow);
impl Drop for LoginWindow {
    fn drop(&mut self) {
        let _ = self.0.destroy();
    }
}

pub fn open(
    app: tauri::AppHandle,
    url: Url,
    callback: Arc<Callback>,
    session: String,
    complete: Complete,
    notice: Notice,
) -> Result<LoginWindow, String> {
    let (store_id, profile) = session_identifier(&session)?;
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|_| "Cannot locate OAuth browser data.")?
        .join("oauth-browser")
        .join(profile);
    let app_origin = app.config().build.dev_url.clone();
    if !matches!(
        navigation(&callback, &url, app_origin.as_ref()),
        Navigation::Continue
    ) {
        return Err("The authorization URL cannot be opened in the login window.".into());
    }
    let label = format!("oauth-login-{}", CsrfToken::new_random().secret());
    let title = format!("Insomnium OAuth — {}", url.origin().ascii_serialization());
    let nav_callback = callback.clone();
    let close_complete = complete.clone();
    let nav_complete = complete.clone();
    let nav_notice = notice.clone();
    let popup_notice = notice.clone();
    let popup_callback = callback.clone();
    let popup_complete = complete.clone();
    let nav_origin = app_origin.clone();
    let builder = WebviewWindowBuilder::new(&app, label, WebviewUrl::External(url))
        .title(title).inner_size(900.0, 720.0).min_inner_size(500.0, 400.0).center()
        .visible(false).devtools(false).data_directory(directory)
        .on_navigation(move |url| match navigation(&nav_callback, url, nav_origin.as_ref()) {
            Navigation::Continue => true,
            Navigation::Callback(result) => { nav_complete(result); false },
            Navigation::Reject(error) => { nav_notice(&error); false },
        })
        .on_page_load(move |_window, payload| {
            if callback.matches_target(payload.url()) {
                match callback.validate(payload.url().as_str()) {
                    Ok(result) => complete(result),
                    Err(error) => notice(&error),
                }
            }
        })
        .on_new_window(move |url, _features| {
            // A callback opened as a popup can complete without granting it a window.
            match navigation(&popup_callback, &url, app_origin.as_ref()) {
                Navigation::Callback(result) => popup_complete(result),
                _ => popup_notice("This provider requested a popup. Use the system browser for popup-based login."),
            }
            NewWindowResponse::Deny
        })
        .on_download(|_, _| false);
    #[cfg(any(target_os = "macos", target_os = "ios"))]
    let builder = builder.data_store_identifier(store_id);
    #[cfg(not(any(target_os = "macos", target_os = "ios")))]
    let _ = store_id;
    let window = LoginWindow(
        builder
            .build()
            .map_err(|_| "Could not create the OAuth login window. Try the system browser.")?,
    );
    window.0.on_window_event(move |event| {
        if matches!(
            event,
            WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed
        ) {
            close_complete(Err("Authorization window closed.".into()));
        }
    });
    window
        .0
        .show()
        .map_err(|_| "Could not show the OAuth login window.")?;
    Ok(window)
}
