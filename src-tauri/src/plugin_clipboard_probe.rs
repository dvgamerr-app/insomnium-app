//! Opt-in clipboard compare-and-mutate protocol for the isolated saved UI probe.
//! Win32 contracts: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-openclipboard
//! https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setclipboarddata
//! https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getclipboardsequencenumber
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_clipboard_manager::ClipboardExt;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Receipt {
    token: String,
    sequence: u32,
    owner: String,
    mutations: u32,
    error: Option<String>,
}
struct Probe {
    receipt: Receipt,
    hwnd: usize,
    expected_owner: usize,
}
#[derive(Default)]
pub struct ClipboardProbeState(Mutex<Option<Probe>>);

fn admit(window: &tauri::WebviewWindow) -> Result<(), String> {
    let origin = window
        .url()
        .map_err(|e| e.to_string())?
        .origin()
        .ascii_serialization();
    if !matches!(
        window.app_handle().config().identifier.as_str(),
        "app.insomnium.probe.checkout20260929" | "app.insomnium.probe.agentintegration20261014"
    ) || window.label() != "main"
        || !matches!(
            origin.as_str(),
            "http://tauri.localhost" | "https://tauri.localhost" | "tauri://localhost"
        )
    {
        return Err("Clipboard probe requires isolated local main webview".into());
    }
    Ok(())
}

#[cfg(windows)]
mod native {
    use super::*;
    use windows::Win32::{
        Foundation::{GlobalFree, HANDLE, HWND},
        System::{DataExchange::*, Memory::*},
    };
    struct Open;
    impl Drop for Open {
        fn drop(&mut self) {
            unsafe {
                let _ = CloseClipboard();
            }
        }
    }
    fn open(hwnd: usize) -> Result<Open, String> {
        unsafe {
            OpenClipboard(Some(HWND(hwnd as *mut _))).map_err(|e| e.to_string())?;
        }
        Ok(Open)
    }
    fn owner() -> usize {
        unsafe {
            GetClipboardOwner()
                .map(|value| value.0 as usize)
                .unwrap_or(0)
        }
    }
    pub fn begin(window: &tauri::WebviewWindow, expected: u32) -> Result<Probe, String> {
        let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as usize;
        let _open = open(hwnd)?;
        let sequence = unsafe { GetClipboardSequenceNumber() };
        if expected == 0 || sequence != expected {
            return Err("Clipboard sequence changed before probe admission".into());
        }
        let expected_owner = owner();
        Ok(Probe {
            hwnd,
            expected_owner,
            receipt: Receipt {
                token: uuid::Uuid::new_v4().simple().to_string(),
                sequence,
                owner: expected_owner.to_string(),
                mutations: 0,
                error: None,
            },
        })
    }
    pub fn mutate(probe: &mut Probe, text: Option<&str>) -> Result<(), String> {
        // Allocate and populate every byte before EmptyClipboard; ownership only
        // transfers on successful SetClipboardData, so failed writes free memory.
        let mut allocation = None;
        if let Some(text) = text {
            if text.len() > 1024 * 1024 || text.contains('\0') {
                return Err("Invalid bounded clipboard text".into());
            }
            let units: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
            let memory = unsafe { GlobalAlloc(GMEM_MOVEABLE, units.len() * 2) }
                .map_err(|e| e.to_string())?;
            let pointer = unsafe { GlobalLock(memory) };
            if pointer.is_null() {
                unsafe {
                    let _ = GlobalFree(Some(memory));
                }
                return Err("Clipboard allocation lock failed".into());
            }
            unsafe {
                std::ptr::copy_nonoverlapping(units.as_ptr(), pointer.cast(), units.len());
                let _ = GlobalUnlock(memory);
            }
            allocation = Some(memory);
        }
        let result = (|| {
            let _open = open(probe.hwnd)?;
            let sequence = unsafe { GetClipboardSequenceNumber() };
            if sequence != probe.receipt.sequence || owner() != probe.expected_owner {
                return Err("Foreign clipboard update refused before mutation".into());
            }
            let emptied = unsafe { EmptyClipboard() }.map_err(|e| e.to_string());
            let write = if emptied.is_ok() {
                probe.receipt.mutations += 1;
                probe.expected_owner = probe.hwnd;
                if let Some(memory) = allocation {
                    unsafe { SetClipboardData(13, Some(HANDLE(memory.0))) }
                        .map(|_| {
                            allocation = None;
                        })
                        .map_err(|e| e.to_string())
                } else {
                    Ok(())
                }
            } else {
                emptied
            };
            // Capture both EmptyClipboard and SetClipboardData failure paths.
            // These values are recorded under the exclusive OS lock, never by
            // sampling after releasing it and potentially adopting foreign data.
            probe.receipt.sequence = unsafe { GetClipboardSequenceNumber() };
            probe.receipt.owner = owner().to_string();
            write
        })();
        if let Some(memory) = allocation {
            unsafe {
                let _ = GlobalFree(Some(memory));
            }
        }
        probe.receipt.error = result.as_ref().err().cloned();
        result
    }
}

#[tauri::command]
pub fn begin_plugin_clipboard_probe(
    window: tauri::WebviewWindow,
    state: tauri::State<ClipboardProbeState>,
    expected_sequence: u32,
) -> Result<Receipt, String> {
    admit(&window)?;
    let mut active = state
        .0
        .lock()
        .map_err(|_| "Clipboard probe lock poisoned")?;
    if active.is_some() {
        return Err("Clipboard probe already active".into());
    }
    #[cfg(windows)]
    {
        let probe = native::begin(&window, expected_sequence)?;
        let receipt = probe.receipt.clone();
        *active = Some(probe);
        Ok(receipt)
    }
    #[cfg(not(windows))]
    {
        let _ = (&mut active, expected_sequence);
        Err("Clipboard probe requires Windows".into())
    }
}
#[tauri::command]
pub fn write_plugin_clipboard_probe(
    window: tauri::WebviewWindow,
    state: tauri::State<ClipboardProbeState>,
    token: String,
    text: String,
) -> Result<Receipt, String> {
    admit(&window)?;
    let mut active = state
        .0
        .lock()
        .map_err(|_| "Clipboard probe lock poisoned")?;
    let probe = active
        .as_mut()
        .filter(|probe| probe.receipt.token == token)
        .ok_or("Clipboard probe token refused")?;
    #[cfg(windows)]
    {
        native::mutate(probe, Some(&text))?;
        Ok(probe.receipt.clone())
    }
    #[cfg(not(windows))]
    {
        let _ = (probe, text);
        Err("Clipboard probe requires Windows".into())
    }
}
#[tauri::command]
pub fn get_plugin_clipboard_probe(
    window: tauri::WebviewWindow,
    state: tauri::State<ClipboardProbeState>,
    token: String,
) -> Result<Receipt, String> {
    admit(&window)?;
    let active = state
        .0
        .lock()
        .map_err(|_| "Clipboard probe lock poisoned")?;
    Ok(active
        .as_ref()
        .filter(|probe| probe.receipt.token == token)
        .ok_or("Clipboard probe token refused")?
        .receipt
        .clone())
}
#[tauri::command]
pub fn end_plugin_clipboard_probe(
    window: tauri::WebviewWindow,
    state: tauri::State<ClipboardProbeState>,
    token: String,
) -> Result<Receipt, String> {
    admit(&window)?;
    let mut active = state
        .0
        .lock()
        .map_err(|_| "Clipboard probe lock poisoned")?;
    if !active
        .as_ref()
        .is_some_and(|probe| probe.receipt.token == token)
    {
        return Err("Clipboard probe token refused".into());
    }
    Ok(active.take().expect("validated probe").receipt)
}
/// Inactive probes use the ordinary production clipboard API. Active probes require
/// the exact sequence/owner under an exclusive OS lock for every event mutation.
pub fn guarded_mutation(app: &tauri::AppHandle, text: Option<&str>) -> Result<(), String> {
    let state = app.state::<ClipboardProbeState>();
    let mut active = match state.0.lock() {
        Ok(active) => active,
        Err(_) => return Err("Clipboard probe lock poisoned".into()),
    };
    let Some(probe) = active.as_mut() else {
        // Keep the admission lock through the ordinary operation so a concurrent
        // begin cannot activate the probe between an inactive check and mutation.
        return if let Some(text) = text {
            app.clipboard().write_text(text)
        } else {
            app.clipboard().clear()
        }
        .map_err(|error| error.to_string());
    };
    #[cfg(windows)]
    {
        native::mutate(probe, text)
    }
    #[cfg(not(windows))]
    {
        let _ = (probe, text);
        Err("Clipboard probe requires Windows".into())
    }
}
