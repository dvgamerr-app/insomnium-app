use crate::{http::NetworkState, plugin_clipboard_probe};

/// Keep an admitted clipboard write owned until the OS operation settles, even
/// when its invoking view or awaiting command disappears.
#[tauri::command]
pub async fn write_clipboard_text(
    text: String,
    app: tauri::AppHandle,
    network: tauri::State<'_, NetworkState>,
) -> Result<(), String> {
    let work = network.retain_native_work(format!("clipboard:{}", uuid::Uuid::new_v4()))?;
    tokio::task::spawn_blocking(move || {
        if work.cancelled() {
            return Err("Clipboard write cancelled.".into());
        }
        plugin_clipboard_probe::guarded_mutation(&app, Some(&text))
    })
    .await
    .map_err(|_| "Clipboard write stopped unexpectedly.")?
}
