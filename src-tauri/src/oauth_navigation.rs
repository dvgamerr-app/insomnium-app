//! Pure navigation and profile validation for the legacy login window.
use crate::oauth_callback::{Callback, CallbackResponse};
use reqwest::Url;

pub enum Navigation {
    Continue,
    Callback(Result<CallbackResponse, String>),
    Reject(String),
}

pub fn navigation(callback: &Callback, url: &Url, app_origin: Option<&Url>) -> Navigation {
    if callback.matches_target(url) {
        return match callback.validate(url.as_str()) {
            Ok(response) => Navigation::Callback(response),
            Err(error) => Navigation::Reject(error),
        };
    }
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
        || matches!(
            url.host_str(),
            Some("tauri.localhost" | "ipc.localhost" | "asset.localhost")
        )
        || app_origin.is_some_and(|origin| url.origin() == origin.origin())
    {
        return Navigation::Reject("The login window blocked a non-web or application URL. Use the system browser if your provider requires an external app.".into());
    }
    Navigation::Continue
}

pub fn session_identifier(value: &str) -> Result<([u8; 16], String), String> {
    let value = if value.is_empty() {
        "00000000000000000000000000000001"
    } else {
        value
    };
    if value.len() != 32 || !value.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("Invalid OAuth browser session identifier.".into());
    }
    let mut bytes = [0; 16];
    for (index, byte) in bytes.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&value[index * 2..index * 2 + 2], 16)
            .map_err(|_| "Invalid OAuth browser session identifier.")?;
    }
    Ok((bytes, value.to_ascii_lowercase()))
}
