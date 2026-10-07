mod asap;
mod aws;
mod cookies;
mod digest;
mod git;
mod git_advance_lock;
mod git_fetch_cleanup;
mod git_fetch_command;
mod git_fetch_journal;
mod git_fetch_snapshot;
mod git_journal;
mod git_merge;
mod git_ref_lock;
mod git_remote;
mod git_remote_job;
mod grpc;
mod grpc_example;
mod grpc_legacy;
mod grpc_schema;
mod grpc_transport;
mod hawk;
mod http;
mod netrc;
mod network_log;
mod ntlm;
mod oauth;
mod oauth1;
mod oauth_browser;
mod oauth_callback;
mod oauth_embedded;
mod oauth_implicit;
mod oauth_navigation;
mod storage;
mod streaming;
mod template;
mod template_os;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if git_remote_job::worker_entry() {
        return;
    }
    tauri::Builder::default()
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
        .manage(git::GitState::default())
        .manage(git_remote_job::RemoteJobState::default())
        .invoke_handler(tauri::generate_handler![
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
            storage::load_workspace,
            storage::save_workspace,
            git_remote_job::git_remote_advertise,
            git_fetch_command::git_remote_fetch,
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
            git::git_repository_delete_branch,
            git::git_repository_commit,
            git_journal::git_repository_checkout,
            git_journal::git_repository_advance,
            git_journal::git_repository_restore
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
