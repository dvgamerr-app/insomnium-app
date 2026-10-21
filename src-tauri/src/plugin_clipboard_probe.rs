//! Opt-in clipboard compare-and-mutate protocol for the isolated saved UI probe.
//! Win32 contracts: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-openclipboard
//! https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setclipboarddata
//! https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getclipboardsequencenumber
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_clipboard_manager::ClipboardExt;

const DEFAULT_TEXT_BYTES: usize = 1024 * 1024;
// UTF-8 replacement decoding can expand a 20 MiB binary event to 60 MiB.
const MAX_TEXT_BYTES: usize = 60 * 1024 * 1024;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Receipt {
    token: String,
    sequence: u32,
    owner: String,
    mutations: u32,
    error: Option<String>,
    max_text_bytes: usize,
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
        Globalization::{
            GetLocaleInfoW, GetOEMCP, GetUserDefaultLCID, WideCharToMultiByte,
            LOCALE_IDEFAULTANSICODEPAGE,
        },
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
    struct Allocation(u32, windows::Win32::Foundation::HGLOBAL);
    impl Drop for Allocation {
        fn drop(&mut self) {
            if !self.1 .0.is_null() {
                unsafe {
                    let _ = GlobalFree(Some(self.1));
                }
            }
        }
    }
    fn allocated(format: u32, bytes: &[u8]) -> Result<Allocation, String> {
        let memory = unsafe { GlobalAlloc(GMEM_MOVEABLE | GMEM_ZEROINIT, bytes.len()) }
            .map_err(|e| e.to_string())?;
        let allocation = Allocation(format, memory);
        let pointer = unsafe { GlobalLock(memory) };
        if pointer.is_null() {
            return Err("Clipboard allocation lock failed".into());
        }
        unsafe {
            std::ptr::copy_nonoverlapping(bytes.as_ptr(), pointer.cast(), bytes.len());
            let _ = GlobalUnlock(memory);
        }
        Ok(allocation)
    }
    fn converted(codepage: u32, units: &[u16], maximum: usize) -> Result<Vec<u8>, String> {
        let required = unsafe { WideCharToMultiByte(codepage, 0, units, None, None, None) };
        if required <= 0 || required as usize > maximum {
            return Err("Clipboard conversion size refused".into());
        }
        let mut bytes = vec![0; required as usize];
        let written =
            unsafe { WideCharToMultiByte(codepage, 0, units, Some(&mut bytes), None, None) };
        if written != required || bytes.last() != Some(&0) {
            return Err("Clipboard text conversion failed".into());
        }
        Ok(bytes)
    }
    pub fn begin(
        window: &tauri::WebviewWindow,
        expected: u32,
        max_text_bytes: usize,
    ) -> Result<Probe, String> {
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
                max_text_bytes,
            },
        })
    }
    pub fn mutate(probe: &mut Probe, text: Option<&str>) -> Result<(), String> {
        // Allocate and populate every byte before EmptyClipboard; ownership only
        // transfers on successful SetClipboardData, so failed writes free memory.
        let mut allocations = Vec::new();
        if let Some(text) = text {
            if text.len() > probe.receipt.max_text_bytes || text.contains('\0') {
                return Err("Invalid bounded clipboard text".into());
            }
            let units: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
            // CF_LOCALE must describe CF_TEXT's actual ANSI code page. Explicit
            // Unicode/ANSI/OEM/locale publication prevents close/read synthesis
            // from changing a receipt sampled under the mutation lock.
            // https://learn.microsoft.com/en-us/windows/win32/dataxchg/standard-clipboard-formats
            // https://learn.microsoft.com/en-us/windows/win32/api/stringapiset/nf-stringapiset-widechartomultibyte
            let locale = unsafe { GetUserDefaultLCID() };
            let mut page = [0u16; 16];
            let length =
                unsafe { GetLocaleInfoW(locale, LOCALE_IDEFAULTANSICODEPAGE, Some(&mut page)) };
            if length <= 1 {
                return Err("Clipboard locale code page unavailable".into());
            }
            let ansi_page = String::from_utf16(&page[..length as usize - 1])
                .map_err(|_| "Clipboard locale code page invalid")?
                .parse::<u32>()
                .map_err(|_| "Clipboard locale code page invalid")?;
            if ansi_page == 0 {
                return Err("Clipboard locale lacks ANSI code page".into());
            }
            let unicode: Vec<u8> = units.iter().flat_map(|unit| unit.to_le_bytes()).collect();
            allocations.push(allocated(13, &unicode)?);
            let conversion_limit = probe.receipt.max_text_bytes * 4;
            allocations.push(allocated(
                1,
                &converted(ansi_page, &units, conversion_limit)?,
            )?);
            allocations.push(allocated(
                7,
                &converted(unsafe { GetOEMCP() }, &units, conversion_limit)?,
            )?);
            allocations.push(allocated(16, &locale.to_le_bytes())?);
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
                let mut published = Ok(());
                for allocation in &mut allocations {
                    if let Err(error) =
                        unsafe { SetClipboardData(allocation.0, Some(HANDLE(allocation.1 .0))) }
                    {
                        published = Err(error.to_string());
                        break;
                    }
                    allocation.1 = windows::Win32::Foundation::HGLOBAL(std::ptr::null_mut());
                }
                published
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
        probe.receipt.error = result.as_ref().err().cloned();
        result
    }
}

#[tauri::command]
pub fn begin_plugin_clipboard_probe(
    window: tauri::WebviewWindow,
    state: tauri::State<ClipboardProbeState>,
    expected_sequence: u32,
    max_text_bytes: Option<usize>,
) -> Result<Receipt, String> {
    admit(&window)?;
    let max_text_bytes = max_text_bytes.unwrap_or(DEFAULT_TEXT_BYTES);
    if !(1..=MAX_TEXT_BYTES).contains(&max_text_bytes) {
        return Err("Clipboard probe text budget must be between 1 byte and 60 MiB".into());
    }
    let mut active = state
        .0
        .lock()
        .map_err(|_| "Clipboard probe lock poisoned")?;
    if active.is_some() {
        return Err("Clipboard probe already active".into());
    }
    #[cfg(windows)]
    {
        let probe = native::begin(&window, expected_sequence, max_text_bytes)?;
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
    #[cfg(windows)]
    if text.is_some_and(|text| text.contains('\0')) {
        return Err("Windows clipboard text cannot contain NUL characters".into());
    }
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
