use tauri::{
    menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    Emitter, Manager,
};

/// Custom commands return to the main renderer so workspace admission, dialogs,
/// persistence and shutdown use the same paths as the visible application UI.
pub fn install(app: &tauri::App) -> tauri::Result<()> {
    let quit = MenuItemBuilder::with_id("quit", "Quit Insomnium")
        .accelerator("CmdOrCtrl+Q")
        .build(app)?;
    let application = SubmenuBuilder::new(app, "Insomnium")
        .about_with_text(
            "About Insomnium",
            Some(AboutMetadata {
                name: Some("Insomnium".into()),
                version: Some(app.package_info().version.to_string()),
                authors: Some(
                    env!("CARGO_PKG_AUTHORS")
                        .split(':')
                        .map(str::to_owned)
                        .collect(),
                ),
                copyright: Some(
                    include_str!("../../LICENSE")
                        .lines()
                        .filter(|line| line.starts_with("Copyright"))
                        .collect::<Vec<_>>()
                        .join("\n"),
                ),
                license: Some(include_str!("../../LICENSE").into()),
                icon: app.default_window_icon().cloned(),
                ..Default::default()
            }),
        )
        .separator()
        .text("settings", "Preferences…");
    #[cfg(target_os = "macos")]
    let application = application.separator().hide().hide_others();
    let application = application
        .separator()
        .text("close", "Close Window")
        .item(&quit)
        .build()?;
    let file = SubmenuBuilder::new(app, "File")
        .text("new-request", "New Request")
        .text("new-folder", "New Folder…")
        .separator()
        .text("import", "Import…")
        .text("export", "Export Collections…")
        .separator()
        .text("save", "Save Workspace")
        .build()?;
    let edit = SubmenuBuilder::new(app, "Edit");
    // Tauri's native undo/redo items are supported only on macOS.
    #[cfg(target_os = "macos")]
    let edit = edit.undo().redo().separator();
    #[cfg(not(target_os = "macos"))]
    let edit = edit.text("undo", "Undo").text("redo", "Redo").separator();
    let edit = edit.cut().copy().paste().select_all().build()?;
    let request = SubmenuBuilder::new(app, "Request")
        .text("send", "Send Request / Message")
        .text("duplicate", "Duplicate Request")
        .text("delete", "Delete Request…")
        .separator()
        .text("environment", "Edit Environment…")
        .text("cookies", "Manage Cookies…")
        .build()?;
    #[cfg(target_os = "macos")]
    let fullscreen_accelerator = "Ctrl+Super+F";
    #[cfg(not(target_os = "macos"))]
    let fullscreen_accelerator = "F11";
    let fullscreen = MenuItemBuilder::with_id("fullscreen", "Toggle Full Screen")
        .accelerator(fullscreen_accelerator)
        .build(app)?;
    let zoom_reset = MenuItemBuilder::with_id("zoom-reset", "Actual Size")
        .accelerator("CmdOrCtrl+0")
        .build(app)?;
    let zoom_in = MenuItemBuilder::with_id("zoom-in", "Zoom In")
        .accelerator("CmdOrCtrl+=")
        .build(app)?;
    let zoom_out = MenuItemBuilder::with_id("zoom-out", "Zoom Out")
        .accelerator("CmdOrCtrl+-")
        .build(app)?;
    let view = SubmenuBuilder::new(app, "View")
        .item(&fullscreen)
        .separator()
        .text("requests", "Requests")
        .text("tests", "Tests")
        .text("git", "Source Control")
        .separator()
        .text("sidebar", "Toggle Sidebar")
        .separator()
        .item(&zoom_reset)
        .item(&zoom_in)
        .item(&zoom_out)
        .build()?;
    let minimize = MenuItemBuilder::with_id("minimize", "Minimize");
    #[cfg(target_os = "macos")]
    let minimize = minimize.accelerator("Super+M");
    let minimize = minimize.build(app)?;
    let window_menu = SubmenuBuilder::new(app, "Window").item(&minimize).build()?;
    let menu = MenuBuilder::new(app)
        .items(&[&application, &file, &edit, &request, &view, &window_menu])
        .build()?;
    // Quit is application-wide, including macOS after the main window closes.
    // exit() enters the existing ExitRequested save/drain coordinator.
    app.on_menu_event(|app, event| {
        if event.id().as_ref() == "quit" {
            app.exit(0);
        }
    });
    if let Some(window) = app.get_webview_window("main") {
        #[cfg(target_os = "macos")]
        app.set_menu(menu)?;
        #[cfg(not(target_os = "macos"))]
        window.set_menu(menu)?;
        window.on_menu_event(|window, event| {
            // macOS menus are app-wide; do not apply a main-window command
            // while an OAuth/provider window owns focus.
            #[cfg(target_os = "macos")]
            if !window.is_focused().unwrap_or(false) {
                return;
            }
            let action = event.id().as_ref();
            if action == "minimize" {
                if let Err(error) = window.minimize() {
                    eprintln!("Could not minimize the application window: {error}");
                }
                return;
            }
            if (cfg!(not(target_os = "macos")) && matches!(action, "undo" | "redo"))
                || matches!(
                    action,
                    "settings"
                        | "close"
                        | "new-request"
                        | "new-folder"
                        | "import"
                        | "export"
                        | "save"
                        | "send"
                        | "duplicate"
                        | "delete"
                        | "environment"
                        | "cookies"
                        | "requests"
                        | "tests"
                        | "git"
                        | "sidebar"
                        | "fullscreen"
                        | "zoom-reset"
                        | "zoom-in"
                        | "zoom-out"
                )
            {
                let _ = window.emit_to("main", "insomnium-menu", action);
            }
        });
    }
    Ok(())
}
