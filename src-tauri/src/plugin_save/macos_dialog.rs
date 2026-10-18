//! AppKit panels, timer targets and completion callbacks stay on the main thread.
use super::*;
use block2::RcBlock;
use objc2::{
    define_class, msg_send, rc::Retained, sel, DefinedClass, MainThreadMarker, MainThreadOnly,
};
use objc2_app_kit::{NSModalResponseCancel, NSModalResponseOK, NSSavePanel, NSWindow};
use objc2_foundation::{NSObject, NSRunLoop, NSRunLoopCommonModes, NSString, NSTimer, NSURL};
use std::{
    cell::RefCell,
    path::Path,
    rc::{Rc, Weak},
};

type Reply = tokio::sync::oneshot::Sender<Result<Option<String>, String>>;
struct UiOperation {
    panel: Option<Retained<NSSavePanel>>,
    timer: Option<Retained<NSTimer>>,
    reply: Option<Reply>,
    lease: Option<Lease>,
}

fn finish(owner: &Rc<RefCell<UiOperation>>, value: Result<Option<String>, String>) {
    let (panel, timer, reply, lease) = {
        let mut state = owner.borrow_mut();
        if state.reply.is_none() {
            return;
        }
        (
            state.panel.take(),
            state.timer.take(),
            state.reply.take(),
            state.lease.take(),
        )
    };
    if let Some(timer) = timer {
        timer.invalidate();
    }
    // AppKit's completion may run while the sheet is still onscreen.
    if let Some(panel) = panel {
        panel.orderOut(None);
    }
    drop(lease);
    if let Some(reply) = reply {
        let _ = reply.send(value);
    }
}

struct WatcherIvars {
    owner: Weak<RefCell<UiOperation>>,
    operation: Arc<Operation>,
    window: tauri::WebviewWindow,
}

define_class!(
    #[unsafe(super(NSObject))]
    #[name = "InsomniumOwnedSaveWatcher"]
    #[thread_kind = MainThreadOnly]
    #[ivars = WatcherIvars]
    struct SaveWatcher;

    impl SaveWatcher {
        #[unsafe(method(tick:))]
        fn tick(&self, _timer: &NSTimer) {
            // Cancelling can synchronously complete the sheet and invalidate
            // the timer, releasing its target while this callback is active.
            let _target_guard = unsafe { Retained::retain(self as *const Self as *mut Self) };
            let ivars = self.ivars();
            let Some(owner) = ivars.owner.upgrade() else { return; };
            let (panel, abandoned) = {
                let state = owner.borrow();
                (state.panel.clone(), state.reply.as_ref().is_some_and(|reply| reply.is_closed()))
            };
            if abandoned || ivars.window.ns_window().is_err() {
                ivars.operation.cancelled.store(true, Ordering::SeqCst);
            }
            if ivars.operation.cancelled.load(Ordering::SeqCst) {
                if let Some(panel) = panel {
                    // This selector accepts nil sender. The panel and target
                    // are main-thread-only and the run loop invokes us there.
                    unsafe { panel.cancel(None); }
                }
            }
        }
    }
);

impl SaveWatcher {
    fn new(mtm: MainThreadMarker, ivars: WatcherIvars) -> Retained<Self> {
        let this = Self::alloc(mtm).set_ivars(ivars);
        // NSObject init is the designated initializer and consumes our allocation.
        unsafe { msg_send![super(this), init] }
    }
}

fn prepare(
    mtm: MainThreadMarker,
    default_path: Option<String>,
) -> Result<Retained<NSSavePanel>, String> {
    let panel = NSSavePanel::savePanel(mtm);
    panel.setCanCreateDirectories(true);
    if let Some(path) = default_path.filter(|path| !path.is_empty()) {
        let path = Path::new(&path);
        let directory = if path.is_dir() {
            Some(path)
        } else {
            path.parent()
        };
        if let Some(directory) =
            directory.filter(|path| !path.as_os_str().is_empty() && path.is_dir())
        {
            let directory = if directory.is_absolute() {
                directory.to_path_buf()
            } else {
                std::env::current_dir()
                    .map_err(|error| error.to_string())?
                    .join(directory)
            };
            let directory = directory
                .to_str()
                .ok_or("Invalid plugin save default directory")?;
            panel.setDirectoryURL(Some(&NSURL::fileURLWithPath_isDirectory(
                &NSString::from_str(directory),
                true,
            )));
        }
        if !path.is_dir() {
            if let Some(name) = path.file_name().and_then(|name| name.to_str()) {
                panel.setNameFieldStringValue(&NSString::from_str(name));
            }
        }
    }
    Ok(panel)
}

pub(super) async fn show(
    window: tauri::WebviewWindow,
    default_path: Option<String>,
    lease: Lease,
) -> Result<Option<String>, String> {
    let (reply, receive) = tokio::sync::oneshot::channel();
    let ui_window = window.clone();
    window
        .run_on_main_thread(move || {
            if lease.operation.cancelled.load(Ordering::SeqCst) || reply.is_closed() {
                drop(lease);
                let _ = reply.send(Ok(None));
                return;
            }
            let setup = || {
                let mtm = MainThreadMarker::new()
                    .ok_or("Plugin save chooser requires the main thread")?;
                let parent = ui_window.ns_window().map_err(|error| error.to_string())?;
                // Tauri returns the live NSWindow for this owned WebviewWindow.
                // Retain it on the UI thread until AppKit has registered the sheet.
                let parent = unsafe { Retained::<NSWindow>::retain(parent.cast()) }
                    .ok_or("Plugin save parent window is unavailable")?;
                if parent.attachedSheet().is_some() {
                    return Err("Another dialog is already attached to the main window".into());
                }
                let panel = prepare(mtm, default_path)?;
                Ok::<_, String>((mtm, parent, panel))
            };
            let (mtm, parent, panel) = match setup() {
                Ok(value) => value,
                Err(error) => {
                    drop(lease);
                    let _ = reply.send(Err(error));
                    return;
                }
            };
            let operation = lease.operation.clone();
            let owner = Rc::new(RefCell::new(UiOperation {
                panel: Some(panel.clone()),
                timer: None,
                reply: Some(reply),
                lease: Some(lease),
            }));
            let watcher = SaveWatcher::new(
                mtm,
                WatcherIvars {
                    owner: Rc::downgrade(&owner),
                    operation: operation.clone(),
                    window: ui_window,
                },
            );
            // The selector is defined above with the NSTimer callback signature.
            // The timer retains its target; finish invalidates it on the UI thread.
            let timer = unsafe {
                NSTimer::timerWithTimeInterval_target_selector_userInfo_repeats(
                    0.02,
                    &watcher,
                    sel!(tick:),
                    None,
                    true,
                )
            };
            owner.borrow_mut().timer = Some(timer.clone());
            let completion_owner = owner.clone();
            let completion_panel = panel.clone();
            let completion = RcBlock::new(move |response| {
                let value = if operation.cancelled.load(Ordering::SeqCst)
                    || response == NSModalResponseCancel
                {
                    Ok(None)
                } else if response == NSModalResponseOK {
                    completion_panel
                        .URL()
                        .filter(|url| url.isFileURL())
                        .and_then(|url| url.path())
                        .map(|path| Some(path.to_string()))
                        .ok_or_else(|| "Plugin save chooser returned no local file".to_string())
                } else {
                    Err("Plugin save chooser could not be displayed".into())
                };
                finish(&completion_owner, value);
            });
            // Common modes keep cancellation live during sheet/modal event tracking.
            unsafe {
                NSRunLoop::currentRunLoop().addTimer_forMode(&timer, NSRunLoopCommonModes);
            }
            panel.beginSheetModalForWindow_completionHandler(&parent, &completion);
        })
        .map_err(|error| format!("Cannot dispatch plugin save chooser: {error}"))?;
    receive
        .await
        .map_err(|_| "Plugin save chooser UI thread ended unexpectedly".to_string())?
}
