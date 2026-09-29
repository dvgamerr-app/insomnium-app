fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "send_http",
            "cancel_http",
            "fetch_oauth_token",
            "authorize_oauth",
            "submit_oauth_callback",
            "connect_stream",
            "send_stream_message",
            "acknowledge_stream",
            "load_grpc_schema",
            "connect_grpc",
            "send_grpc_message",
            "acknowledge_grpc",
            "read_template_cookie",
            "list_cookies",
            "change_cookie",
            "import_legacy_cookies",
            "read_template_file",
            "read_template_os",
            "load_workspace",
            "save_workspace",
        ]),
    ))
    .expect("build Tauri application permissions")
}
