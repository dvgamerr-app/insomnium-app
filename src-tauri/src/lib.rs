mod asap;
mod aws;
mod cookies;
mod digest;
mod grpc;
mod grpc_example;
mod grpc_legacy;
mod grpc_schema;
mod grpc_transport;
mod hawk;
mod http;
mod netrc;
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
            storage::save_workspace
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
