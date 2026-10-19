use std::{fs::File, io::Read};

const MAX_TEMPLATE_FILE_BYTES: u64 = 20 * 1024 * 1024;

/// Preserve the legacy UTF-8 replacement behavior, without unbounded reads.
fn read_text(path: &str) -> Result<String, String> {
    if path.is_empty() {
        return Err("No file selected".into());
    }
    // Reject directories/devices before opening; check the opened handle again.
    let metadata =
        std::fs::metadata(path).map_err(|e| format!("Could not read template file: {e}"))?;
    if !metadata.is_file() {
        return Err("Template file must be a regular file".into());
    }
    let file = File::open(path).map_err(|e| format!("Could not open template file: {e}"))?;
    let metadata = file.metadata().map_err(|e| e.to_string())?;
    if !metadata.is_file() {
        return Err("Template file must be a regular file".into());
    }
    if metadata.len() > MAX_TEMPLATE_FILE_BYTES {
        return Err("Template file exceeds 20 MiB".into());
    }
    let mut bytes = Vec::new();
    file.take(MAX_TEMPLATE_FILE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| format!("Could not read template file: {e}"))?;
    if bytes.len() as u64 > MAX_TEMPLATE_FILE_BYTES {
        return Err("Template file exceeds 20 MiB".into());
    }
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

#[tauri::command]
pub async fn read_template_file(
    window: tauri::WebviewWindow,
    network: tauri::State<'_, crate::http::NetworkState>,
    path: String,
) -> Result<String, String> {
    if window.label() != "main" {
        return Err("Template file reads are only available in the main window".into());
    }
    let work = network.retain_native_work(format!("template-file:{}", uuid::Uuid::new_v4()))?;
    tauri::async_runtime::spawn_blocking(move || {
        let _work = work;
        if _work.cancelled() {
            return Err("Template file read cancelled.".into());
        }
        read_text(&path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn read_template_os(
    window: tauri::WebviewWindow,
    network: tauri::State<'_, crate::http::NetworkState>,
    function: String,
) -> Result<serde_json::Value, String> {
    if window.label() != "main" {
        return Err("OS template information is only available in the main window".into());
    }
    if function.len() > 16 {
        return Err("Unknown OS template function".into());
    }
    let work = network.retain_native_work(format!("template-os:{}", uuid::Uuid::new_v4()))?;
    tauri::async_runtime::spawn_blocking(move || {
        let _work = work;
        if _work.cancelled() {
            return Err("OS template read cancelled.".into());
        }
        crate::template_os::read_os(&function)
    })
    .await
    .map_err(|e| e.to_string())?
}
