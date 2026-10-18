//! Operation-owned save choosers. Native UI objects stay on their owning thread.
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};

struct Operation {
    #[cfg(windows)]
    serial: usize,
    created: Instant,
    started: AtomicBool,
    cancelled: AtomicBool,
}

#[derive(Clone, Default)]
pub struct SaveState(Arc<Mutex<HashMap<String, Arc<Operation>>>>);
static SERIAL: AtomicUsize = AtomicUsize::new(0);

fn main_window(window: &tauri::WebviewWindow) -> Result<(), String> {
    if window.label() == "main" {
        Ok(())
    } else {
        Err("Plugin save dialogs require the main window".into())
    }
}

#[tauri::command]
pub fn reserve_plugin_save(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, SaveState>,
) -> Result<String, String> {
    main_window(&window)?;
    if !cfg!(any(windows, target_os = "linux", target_os = "macos")) {
        return Err("Owned save chooser is not implemented on this platform".into());
    }
    let serial = SERIAL
        .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |value| {
            value.checked_add(1)
        })
        .map_err(|_| "Plugin save operation sequence exhausted")?
        + 1;
    let id = format!("{serial}:{}", uuid::Uuid::new_v4());
    let mut entries = state
        .0
        .lock()
        .map_err(|_| "Plugin save state is unavailable")?;
    entries.retain(|_, op| {
        op.started.load(Ordering::SeqCst) || op.created.elapsed() < Duration::from_secs(30)
    });
    if entries.len() >= 16 {
        return Err("Too many pending plugin save dialogs".into());
    }
    entries.insert(
        id.clone(),
        Arc::new(Operation {
            #[cfg(windows)]
            serial,
            created: Instant::now(),
            started: AtomicBool::new(false),
            cancelled: AtomicBool::new(false),
        }),
    );
    Ok(id)
}

#[tauri::command]
pub fn cancel_plugin_save(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, SaveState>,
    id: String,
) -> Result<bool, String> {
    main_window(&window)?;
    let mut entries = state
        .0
        .lock()
        .map_err(|_| "Plugin save state is unavailable")?;
    let Some(operation) = entries.get(&id) else {
        return Ok(false);
    };
    operation.cancelled.store(true, Ordering::SeqCst);
    if !operation.started.load(Ordering::SeqCst) {
        entries.remove(&id);
    }
    Ok(true)
}

pub fn cancel_all(state: &SaveState) {
    if let Ok(mut entries) = state.0.lock() {
        for operation in entries.values() {
            operation.cancelled.store(true, Ordering::SeqCst);
        }
        entries.retain(|_, op| op.started.load(Ordering::SeqCst));
    }
}

struct Lease {
    state: SaveState,
    id: String,
    operation: Arc<Operation>,
}
impl Drop for Lease {
    fn drop(&mut self) {
        if let Ok(mut entries) = self.state.0.lock() {
            if entries
                .get(&self.id)
                .is_some_and(|op| Arc::ptr_eq(op, &self.operation))
            {
                entries.remove(&self.id);
            }
        }
    }
}

#[tauri::command]
pub async fn show_plugin_save(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, SaveState>,
    id: String,
    default_path: Option<String>,
) -> Result<Option<String>, String> {
    main_window(&window)?;
    if default_path
        .as_ref()
        .is_some_and(|path| path.contains('\0') || path.encode_utf16().count() > 32768)
    {
        return Err("Invalid plugin save default path".into());
    }
    #[cfg(any(windows, target_os = "linux", target_os = "macos"))]
    {
        let operation = {
            let entries = state
                .0
                .lock()
                .map_err(|_| "Plugin save state is unavailable")?;
            let operation = entries
                .get(&id)
                .ok_or("Plugin save operation is no longer reserved")?
                .clone();
            if operation.started.swap(true, Ordering::SeqCst) {
                return Err("Plugin save operation already started".into());
            }
            operation
        };
        let lease = Lease {
            state: state.inner().clone(),
            id,
            operation,
        };
        #[cfg(windows)]
        let selected = {
            let parent = window.hwnd().map_err(|error| error.to_string())?.0 as usize;
            let (send, receive) = tokio::sync::oneshot::channel();
            std::thread::Builder::new()
                .name("plugin-save-chooser".into())
                .spawn(move || {
                    let result = windows_dialog::show(parent, default_path, &lease.operation);
                    drop(lease);
                    let _ = send.send(result);
                })
                .map_err(|error| format!("Cannot start plugin save chooser: {error}"))?;
            receive
                .await
                .map_err(|_| "Plugin save chooser thread ended unexpectedly".to_string())??
        };
        #[cfg(target_os = "linux")]
        let selected = linux_dialog::show(window.clone(), default_path, lease).await?;
        #[cfg(target_os = "macos")]
        let selected = macos_dialog::show(window.clone(), default_path, lease).await?;
        if let Some(path) = &selected {
            // Match tauri-plugin-dialog's selected-file grants, without granting
            // the directory or any path on cancellation/failure.
            use tauri::Manager;
            use tauri_plugin_fs::FsExt;
            if let Some(scope) = window.try_fs_scope() {
                scope.allow_file(path).map_err(|error| error.to_string())?;
            }
            window
                .state::<tauri::scope::Scopes>()
                .allow_file(path)
                .map_err(|error| error.to_string())?;
        }
        Ok(selected)
    }
    #[cfg(not(any(windows, target_os = "linux", target_os = "macos")))]
    {
        let _ = (state, id, default_path);
        Err("Owned save chooser is not implemented on this platform".into())
    }
}

#[cfg(target_os = "linux")]
mod linux_dialog;

#[cfg(target_os = "macos")]
mod macos_dialog;

#[cfg(windows)]
mod windows_dialog {
    use super::*;
    use std::{cell::Cell, path::Path, sync::OnceLock};
    use windows::{
        core::{w, Interface, HRESULT, HSTRING},
        Win32::{
            Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, WPARAM},
            System::{
                Com::{
                    CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize,
                    CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED,
                },
                LibraryLoader::GetModuleHandleW,
                Ole::IOleWindow,
            },
            UI::{
                Shell::{
                    FileSaveDialog, IFileDialog, IShellItem, SHCreateItemFromParsingName,
                    FOS_FORCEFILESYSTEM, FOS_NOCHANGEDIR, FOS_OVERWRITEPROMPT, SIGDN_FILESYSPATH,
                },
                WindowsAndMessaging::{
                    CreateWindowExW, DefWindowProcW, DestroyWindow, GetWindow, GetWindowLongPtrW,
                    GetWindowThreadProcessId, PostMessageW, RegisterClassW, SendNotifyMessageW,
                    SetWindowLongPtrW, GWLP_USERDATA, GW_OWNER, HWND_MESSAGE, WINDOW_EX_STYLE,
                    WINDOW_STYLE, WM_APP, WM_CLOSE, WNDCLASSW,
                },
            },
        },
    };

    const CANCELLED: HRESULT = HRESULT(0x800704c7u32 as i32);
    struct Apartment;
    impl Drop for Apartment {
        fn drop(&mut self) {
            unsafe {
                CoUninitialize();
            }
        }
    }
    struct Context {
        dialog: IFileDialog,
        operation: Arc<Operation>,
        parent: HWND,
        reported: Cell<bool>,
    }
    const CANCEL_MESSAGE: u32 = WM_APP + 1;
    struct CancelWindow {
        hwnd: HWND,
        _context: Box<Context>,
        stop: Arc<AtomicBool>,
        watcher: Option<std::thread::JoinHandle<()>>,
    }
    impl Drop for CancelWindow {
        fn drop(&mut self) {
            // The sender exits before the private HWND can be destroyed/reused.
            self.stop.store(true, Ordering::SeqCst);
            if let Some(watcher) = self.watcher.take() {
                let _ = watcher.join();
            }
            unsafe {
                SetWindowLongPtrW(self.hwnd, GWLP_USERDATA, 0);
                let _ = DestroyWindow(self.hwnd);
            }
        }
    }
    unsafe extern "system" fn procedure(
        hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if message == CANCEL_MESSAGE {
            let pointer = GetWindowLongPtrW(hwnd, GWLP_USERDATA) as *const Context;
            if let Some(context) = pointer.as_ref() {
                if wparam.0 == context.operation.serial
                    && context.operation.cancelled.load(Ordering::SeqCst)
                {
                    let target = context
                        .dialog
                        .cast::<IOleWindow>()
                        .and_then(|dialog| dialog.GetWindow());
                    let result = context.dialog.Close(CANCELLED);
                    // Close can report S_OK while a hidden chooser remains in Show.
                    // Obtain only this COM object's HWND and recheck its exact STA,
                    // process and host owner before requesting native dismissal.
                    let dismissed = target.and_then(|target| {
                        let mut source_pid = 0;
                        let source_thread = GetWindowThreadProcessId(hwnd, Some(&mut source_pid));
                        let mut target_pid = 0;
                        let target_thread = GetWindowThreadProcessId(target, Some(&mut target_pid));
                        if source_thread == 0
                            || source_thread != target_thread
                            || source_pid != target_pid
                            || GetWindow(target, GW_OWNER)? != context.parent
                        {
                            return Err(windows::core::Error::new(
                                HRESULT(0x80004005u32 as i32),
                                "Plugin chooser ownership changed",
                            ));
                        }
                        PostMessageW(Some(target), WM_CLOSE, WPARAM(0), LPARAM(0))
                    });
                    if !context.reported.replace(true) {
                        eprintln!("Plugin save cancellation Close: {result:?}; owned dismissal: {dismissed:?}");
                    }
                }
            }
            return LRESULT(0);
        }
        DefWindowProcW(hwnd, message, wparam, lparam)
    }

    fn cancel_window(
        dialog: IFileDialog,
        operation: Arc<Operation>,
        parent: HWND,
    ) -> windows::core::Result<CancelWindow> {
        static CLASS: OnceLock<Result<(), String>> = OnceLock::new();
        let instance = unsafe { GetModuleHandleW(None)? };
        let registration = CLASS.get_or_init(|| {
            let class = WNDCLASSW {
                lpfnWndProc: Some(procedure),
                hInstance: HINSTANCE(instance.0),
                lpszClassName: w!("InsomniumOwnedPluginSaveCancel"),
                ..Default::default()
            };
            if unsafe { RegisterClassW(&class) } == 0 {
                Err(windows::core::Error::from_thread().to_string())
            } else {
                Ok(())
            }
        });
        if let Err(error) = registration {
            return Err(windows::core::Error::new(
                HRESULT(0x80004005u32 as i32),
                error,
            ));
        }
        let mut context = Box::new(Context {
            dialog,
            operation: operation.clone(),
            parent,
            reported: Cell::new(false),
        });
        let hwnd = unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE(0),
                w!("InsomniumOwnedPluginSaveCancel"),
                w!(""),
                WINDOW_STYLE(0),
                0,
                0,
                0,
                0,
                Some(HWND_MESSAGE),
                None,
                Some(HINSTANCE(instance.0)),
                None,
            )?
        };
        unsafe {
            SetWindowLongPtrW(
                hwnd,
                GWLP_USERDATA,
                (&mut *context as *mut Context) as isize,
            );
        }
        let stop = Arc::new(AtomicBool::new(false));
        let mut window = CancelWindow {
            hwnd,
            _context: context,
            stop: stop.clone(),
            watcher: None,
        };
        let target = hwnd.0 as usize;
        window.watcher = Some(
            std::thread::Builder::new()
                .name("plugin-save-cancel".into())
                .spawn(move || {
                    while !stop.load(Ordering::SeqCst) {
                        if operation.created.elapsed() >= Duration::from_secs(600) {
                            operation.cancelled.store(true, Ordering::SeqCst);
                        }
                        if operation.cancelled.load(Ordering::SeqCst) {
                            // Sent/nonqueued messages bypass modal filtering of WM_TIMER.
                            // The sender owns no COM interface and cannot outlive this HWND.
                            unsafe {
                                let _ = SendNotifyMessageW(
                                    HWND(target as *mut _),
                                    CANCEL_MESSAGE,
                                    WPARAM(operation.serial),
                                    LPARAM(0),
                                );
                            }
                        }
                        std::thread::sleep(Duration::from_millis(100));
                    }
                })
                .map_err(|error| {
                    windows::core::Error::new(HRESULT(0x80004005u32 as i32), error.to_string())
                })?,
        );
        Ok(window)
    }

    pub fn show(
        parent: usize,
        default_path: Option<String>,
        operation: &Arc<Operation>,
    ) -> Result<Option<String>, String> {
        if operation.cancelled.load(Ordering::SeqCst) {
            return Ok(None);
        }
        let run = || -> windows::core::Result<Option<String>> {
            unsafe {
                CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok()?;
                let _apartment = Apartment;
                let dialog: IFileDialog =
                    CoCreateInstance(&FileSaveDialog, None, CLSCTX_INPROC_SERVER)?;
                dialog.SetOptions(
                    dialog.GetOptions()?
                        | FOS_FORCEFILESYSTEM
                        | FOS_NOCHANGEDIR
                        | FOS_OVERWRITEPROMPT,
                )?;
                dialog.SetTitle(w!("Save File"))?;
                dialog.SetOkButtonLabel(w!("Save"))?;
                if let Some(path) = default_path.filter(|path| !path.is_empty()) {
                    let path = Path::new(&path);
                    let directory = if path.is_dir() {
                        Some(path)
                    } else {
                        path.parent()
                    };
                    if let Some(directory) = directory
                        .filter(|directory| !directory.as_os_str().is_empty() && directory.is_dir())
                    {
                        let directory = if directory.is_absolute() {
                            Some(directory.to_path_buf())
                        } else {
                            std::env::current_dir().ok().map(|cwd| cwd.join(directory))
                        };
                        if let Some(directory) = directory {
                            let folder: IShellItem = SHCreateItemFromParsingName(
                                &HSTRING::from(directory.as_os_str()),
                                None,
                            )?;
                            dialog.SetFolder(&folder)?;
                        }
                    }
                    if !path.is_dir() {
                        if let Some(name) = path.file_name() {
                            dialog.SetFileName(&HSTRING::from(name))?;
                        }
                    }
                }
                let _cancel =
                    cancel_window(dialog.clone(), operation.clone(), HWND(parent as *mut _))?;
                if operation.cancelled.load(Ordering::SeqCst) {
                    return Ok(None);
                }
                if let Err(error) = dialog.Show(Some(HWND(parent as *mut _))) {
                    if error.code() == CANCELLED || operation.cancelled.load(Ordering::SeqCst) {
                        return Ok(None);
                    }
                    return Err(error);
                }
                if operation.cancelled.load(Ordering::SeqCst) {
                    return Ok(None);
                }
                let path = dialog.GetResult()?.GetDisplayName(SIGDN_FILESYSPATH)?;
                let text = path.to_string();
                CoTaskMemFree(Some(path.0.cast()));
                Ok(Some(text?))
            }
        };
        run().map_err(|error| format!("Plugin save chooser failed: {error}"))
    }
}
