mod asap;
mod aws;
mod cookies;
mod digest;
mod git;
mod git_clone;
mod git_advance_lock;
mod git_fetch_cleanup;
mod git_fetch_command;
mod git_fetch_journal;
mod git_fetch_snapshot;
mod git_journal;
mod git_merge;
mod git_merge_preview;
mod git_merge_resolution;
mod git_merge_source;
mod git_ref_lock;
mod git_remote;
mod git_remote_checkout;
mod git_remote_job;
mod git_push;
mod grpc;
mod grpc_defaults;
mod grpc_example;
mod grpc_legacy;
mod grpc_legacy_lookup;
mod grpc_schema;
mod grpc_transport;
mod hawk;
mod client_certificates;
mod http;
mod http_redirects;
mod netrc;
mod network_log;
mod ntlm;
mod proxy_auth;
mod oauth;
mod oauth1;
mod oauth_browser;
mod oauth_callback;
mod oauth_embedded;
mod oauth_implicit;
mod oauth_navigation;
mod storage;
mod resource_topology;
mod legacy_response;
mod plugins;
mod plugin_sources;
mod plugin_package;
mod plugin_store;
mod plugin_event_transport;
mod plugin_clipboard_probe;
mod plugin_save;
mod streaming;
mod spectral;
mod spectral_jobs;
mod spectral_process;
mod template;
mod template_os;
mod desktop_menu;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if git_remote_job::worker_entry() {
        return;
    }
    let mut pending_exit_code = None;
    tauri::Builder::default()
        .setup(|app| {
            desktop_menu::install(app)?;
            Ok(())
        })
        .register_asynchronous_uri_scheme_protocol("insomnium-event", plugin_event_transport::handle)
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(
            tauri_plugin_window_state::Builder::new()
                // Window chrome belongs to the platform config, not saved user geometry.
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::all()
                        & !tauri_plugin_window_state::StateFlags::DECORATIONS,
                )
                .with_filter(|label| label == "main")
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(http::NetworkState::default())
        .manage(oauth_browser::OAuthBrowserState::default())
        .manage(cookies::CookieState::default())
        .manage(streaming::StreamState::default())
        .manage(grpc::GrpcState::default())
        .manage(storage::StorageState::default())
        .manage(plugin_store::PluginStoreState::default())
        .manage(plugin_event_transport::EventTransportState::default())
        .manage(plugin_clipboard_probe::ClipboardProbeState::default())
        .manage(git::GitState::default())
        .manage(git_remote_job::RemoteJobState::default())
        .manage(plugin_save::SaveState::default())
        .manage(spectral::SpectralState::default())
        .on_window_event(|window, event| {
            if window.label() == "main" && matches!(event, tauri::WindowEvent::Destroyed) {
                if let Some(state) = window.try_state::<http::NetworkState>() { state.close(); }
                if let Some(state) = window.try_state::<git_remote_job::RemoteJobState>() { state.close(); }
                if let Some(state) = window.try_state::<spectral::SpectralState>() { spectral::cancel_all(&state); }
                if let Some(state) = window.try_state::<plugin_event_transport::EventTransportState>() { plugin_event_transport::cancel_all(&state); }
                if let Some(state) = window.try_state::<plugin_save::SaveState>() {
                    plugin_save::cancel_all(&state);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            spectral::reserve_spectral_lint,
            spectral::run_spectral_lint,
            spectral::cancel_spectral_lint,
            plugin_event_transport::begin_plugin_event_transport,
            plugin_event_transport::end_plugin_event_transport,
            plugin_clipboard_probe::begin_plugin_clipboard_probe,
            plugin_clipboard_probe::write_plugin_clipboard_probe,
            plugin_clipboard_probe::get_plugin_clipboard_probe,
            plugin_clipboard_probe::end_plugin_clipboard_probe,
            http::send_http,
            http::cancel_http,
            http::fetch_oauth_token,
            oauth_browser::authorize_oauth,
            oauth_browser::submit_oauth_callback,
            streaming::connect_stream,
            streaming::send_stream_message,
            streaming::acknowledge_stream,
            grpc::load_grpc_schema,
            grpc::connect_grpc,
            grpc::send_grpc_message,
            grpc::acknowledge_grpc,
            cookies::read_template_cookie,
            cookies::list_cookies,
            cookies::snapshot_request_cookies,
            cookies::change_cookie,
            cookies::import_legacy_cookies,
            template::read_template_file,
            template::read_template_os,
            plugin_save::reserve_plugin_save,
            plugin_save::show_plugin_save,
            plugin_save::cancel_plugin_save,
            storage::load_workspace,
            storage::save_workspace,
            storage::inspect_workspace_backup,
            storage::restore_workspace_backup,
            legacy_response::read_legacy_response_assets,
            legacy_response::read_legacy_request_assets,
            legacy_response::read_legacy_certificate_assets,
            plugins::discover_plugins,
            plugin_sources::discover_plugin_sources,
            plugin_package::read_plugin_package,
            plugin_store::plugin_store,
            plugin_store::import_legacy_plugin_data,
            git_remote_job::git_remote_advertise,
            git_fetch_command::git_remote_fetch,
            git_push::git_remote_push,
            git_push::git_remote_push_inspect,
            git_push::git_remote_push_retire,
            git_fetch_cleanup::git_remote_cleanup_staging,
            git_fetch_command::git_remote_fetch_inspect,
            git_fetch_command::git_remote_fetch_recovery_status,
            git_fetch_command::git_remote_fetch_recover,
            git_remote_job::git_remote_cancel,
            git::git_repository_init,
            git::git_repository_info,
            git::git_repository_read_commit,
            git_merge::git_repository_prepare_merge,
            git::git_repository_history,
            git::git_repository_create_branch,
            git_remote_checkout::git_repository_create_remote_branch,
            git_clone::git_clone_stage,
            git_clone::git_clone_inspect,
            git_clone::git_clone_list,
            git_clone::install::git_clone_install,
            git::git_repository_delete_branch,
            git::git_repository_commit,
            git_journal::git_repository_checkout,
            git_journal::git_repository_advance,
            git_journal::git_repository_apply_merge,
            git_journal::git_repository_restore
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |app, event| {
            if matches!(&event, tauri::RunEvent::WindowEvent {
                label, event: tauri::WindowEvent::Destroyed, ..
            } if label == "main") {
                // macOS may keep the application alive after its last window.
                // Resume an intercepted Quit only after renderer-approved close.
                if let Some(code) = pending_exit_code {
                    app.exit(code);
                }
            }
            if let tauri::RunEvent::ExitRequested { code, api, .. } = &event {
                if *code != Some(tauri::RESTART_EXIT_CODE) {
                    if let Some(window) = app.get_webview_window("main") {
                        // close(), unlike destroy(), lets the renderer cancel
                        // tracked work and save. A failed save keeps the app open.
                        api.prevent_exit();
                        pending_exit_code.get_or_insert(code.unwrap_or(0));
                        if let Err(error) = window.close() {
                            eprintln!("Could not request workspace shutdown: {error}");
                        }
                        return;
                    }
                    // Window destruction can request a fresh exit without a
                    // code. Keep the original programmatic exit status.
                    if let Some(saved_code) = pending_exit_code.take() {
                        if *code != Some(saved_code) {
                            api.prevent_exit();
                            app.exit(saved_code);
                            return;
                        }
                    }
                }
            }
            if let tauri::RunEvent::ExitRequested { code, api, .. } = &event {
                // Keep the event loop available to native window builders/cleanup.
                // Tauri does not honor prevent_exit for its restart sentinel.
                if *code != Some(tauri::RESTART_EXIT_CODE) {
                    if let Some(state) = app.try_state::<http::NetworkState>() {
                        if state.defer_exit(app.clone(), code.unwrap_or(0)) {
                            api.prevent_exit();
                            return;
                        }
                    }
                }
            }
            if matches!(&event, tauri::RunEvent::Exit) {
                if let Some(state) = app.try_state::<git_remote_job::RemoteJobState>() {
                    state.drain();
                }
            }
            if let Some(state) = app.try_state::<spectral::SpectralState>() {
                match event {
                    tauri::RunEvent::ExitRequested { code, api, .. } if !spectral::exit_ready(&state) => {
                        // Tauri ignores prevent_exit for its restart sentinel.
                        if code == Some(tauri::RESTART_EXIT_CODE) {
                            spectral::drain(&state);
                        } else {
                            api.prevent_exit();
                            if spectral::shutdown_then_exit(&state, app.clone(), code.unwrap_or(0)).is_err() {
                                spectral::drain(&state);
                                app.exit(code.unwrap_or(0));
                            }
                        }
                    }
                    tauri::RunEvent::Exit if !spectral::exit_ready(&state) => spectral::drain(&state),
                    _ => {}
                }
            }
        });
}
