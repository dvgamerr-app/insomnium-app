//! GTK objects and GLib sources are created, completed and destroyed on the UI thread.
use super::*;
use gtk::{glib, prelude::*, FileChooserAction, FileChooserNative, ResponseType};
use std::{cell::RefCell, path::Path, rc::Rc};

type Reply = tokio::sync::oneshot::Sender<Result<Option<String>, String>>;
struct UiOperation {
    dialog: Option<FileChooserNative>,
    reply: Option<Reply>,
    lease: Option<Lease>,
    timer: Option<glib::SourceId>,
    response: Option<glib::SignalHandlerId>,
}

// Response and cancellation share this single completion gate. GTK hide does
// not emit response, so cancellation must explicitly complete the native lease.
fn finish(
    owner: &Rc<RefCell<UiOperation>>,
    value: Result<Option<String>, String>,
    from_timer: bool,
) {
    let (dialog, reply, lease, timer, handler) = {
        let mut state = owner.borrow_mut();
        if state.reply.is_none() {
            return;
        }
        (
            state.dialog.take(),
            state.reply.take(),
            state.lease.take(),
            state.timer.take(),
            state.response.take(),
        )
    };
    if let Some(dialog) = dialog {
        if let Some(handler) = handler {
            dialog.disconnect(handler);
        }
        if let Some(timer) = timer {
            if !from_timer {
                timer.remove();
            }
        }
        dialog.hide();
        dialog.destroy();
    }
    drop(lease);
    if let Some(reply) = reply {
        let _ = reply.send(value);
    }
}

fn prepare(
    window: &tauri::WebviewWindow,
    default_path: Option<String>,
) -> Result<FileChooserNative, String> {
    let parent = window.gtk_window().map_err(|error| error.to_string())?;
    let dialog = FileChooserNative::new(
        Some("Save File"),
        Some(&parent),
        FileChooserAction::Save,
        Some("Save"),
        Some("Cancel"),
    );
    dialog.set_modal(true);
    dialog.set_local_only(true);
    dialog.set_do_overwrite_confirmation(true);
    if let Some(path) = default_path.filter(|path| !path.is_empty()) {
        let path = Path::new(&path);
        let directory = if path.is_dir() {
            Some(path)
        } else {
            path.parent()
        };
        if let Some(directory) =
            directory.filter(|directory| !directory.as_os_str().is_empty() && directory.is_dir())
        {
            let directory = if directory.is_absolute() {
                directory.to_path_buf()
            } else {
                match std::env::current_dir() {
                    Ok(cwd) => cwd.join(directory),
                    Err(error) => {
                        dialog.destroy();
                        return Err(error.to_string());
                    }
                }
            };
            if !dialog.set_current_folder(directory) {
                dialog.destroy();
                return Err("Cannot select plugin save default directory".into());
            }
        }
        if !path.is_dir() {
            if let Some(name) = path.file_name().and_then(|name| name.to_str()) {
                dialog.set_current_name(name);
            }
        }
    }
    Ok(dialog)
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
            if lease.operation.cancelled.load(Ordering::SeqCst) {
                drop(lease);
                let _ = reply.send(Ok(None));
                return;
            }
            let dialog = match prepare(&ui_window, default_path) {
                Ok(dialog) => dialog,
                Err(error) => {
                    drop(lease);
                    let _ = reply.send(Err(error));
                    return;
                }
            };
            let operation = lease.operation.clone();
            let owner = Rc::new(RefCell::new(UiOperation {
                dialog: Some(dialog.clone()),
                reply: Some(reply),
                lease: Some(lease),
                timer: None,
                response: None,
            }));
            let response_owner = owner.clone();
            let response_operation = operation.clone();
            let response = dialog.connect_response(move |dialog, response| {
                let value = if response_operation.cancelled.load(Ordering::SeqCst)
                    || response != ResponseType::Accept
                {
                    Ok(None)
                } else {
                    dialog
                        .filename()
                        .ok_or_else(|| "Native save chooser returned no local file".to_string())
                        .and_then(|path| {
                            path.into_os_string()
                                .into_string()
                                .map(Some)
                                .map_err(|_| "Native save path is not UTF-8".to_string())
                        })
                };
                finish(&response_owner, value, false);
            });
            owner.borrow_mut().response = Some(response);
            let timer_owner = owner.clone();
            let timer_operation = operation.clone();
            let timer = glib::timeout_add_local(Duration::from_millis(100), move || {
                if timer_owner.borrow().reply.is_none() {
                    return glib::ControlFlow::Break;
                }
                if timer_operation.created.elapsed() >= Duration::from_secs(600) {
                    timer_operation.cancelled.store(true, Ordering::SeqCst);
                }
                if timer_operation.cancelled.load(Ordering::SeqCst) {
                    finish(&timer_owner, Ok(None), true);
                    glib::ControlFlow::Break
                } else {
                    glib::ControlFlow::Continue
                }
            });
            owner.borrow_mut().timer = Some(timer);
            if operation.cancelled.load(Ordering::SeqCst) {
                finish(&owner, Ok(None), false);
                return;
            }
            dialog.show();
        })
        .map_err(|error| format!("Cannot dispatch plugin save chooser: {error}"))?;
    receive
        .await
        .map_err(|_| "Plugin save chooser UI thread ended unexpectedly".to_string())?
}
