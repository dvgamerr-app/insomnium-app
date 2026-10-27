fn main() {
    plugin_runtime_binding();
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "reserve_spectral_lint",
            "run_spectral_lint",
            "cancel_spectral_lint",
            "begin_plugin_event_transport",
            "end_plugin_event_transport",
            "begin_plugin_clipboard_probe",
            "write_plugin_clipboard_probe",
            "get_plugin_clipboard_probe",
            "end_plugin_clipboard_probe",
            "write_clipboard_text",
            "send_http",
            "response_download",
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
            "snapshot_request_cookies",
            "change_cookie",
            "import_legacy_cookies",
            "read_template_file",
            "read_template_os",
            "reserve_plugin_save",
            "show_plugin_save",
            "cancel_plugin_save",
            "load_workspace",
            "save_workspace",
            "inspect_workspace_backup",
            "restore_workspace_backup",
            "read_legacy_response_assets",
            "read_legacy_request_assets",
            "read_legacy_certificate_assets",
            "discover_plugins",
            "discover_plugin_sources",
            "read_plugin_package",
            "reserve_plugin_inspection",
            "run_plugin_inspection",
            "cancel_plugin_inspection",
            "open_bun_plugin_session",
            "invoke_bun_plugin_callback",
            "reply_bun_plugin_helper",
            "set_bun_plugin_interaction",
            "plugin_store",
            "import_legacy_plugin_data",
            "git_remote_advertise",
            "git_clone_stage",
            "git_clone_inspect",
            "git_clone_list",
            "git_clone_install",
            "git_remote_fetch",
            "git_remote_push",
            "git_remote_push_inspect",
            "git_remote_push_retire",
            "git_remote_cleanup_staging",
            "git_remote_fetch_inspect",
            "git_remote_fetch_recovery_status",
            "git_remote_fetch_recover",
            "git_remote_cancel",
            "git_repository_init",
            "git_repository_info",
            "git_repository_read_commit",
            "git_repository_prepare_merge",
            "git_repository_history",
            "git_repository_commit",
            "git_repository_create_branch",
            "git_repository_create_remote_branch",
            "git_repository_delete_branch",
            "git_repository_checkout",
            "git_repository_advance",
            "git_repository_apply_merge",
            "git_repository_restore",
        ]),
    ))
    .expect("build Tauri application permissions")
}

fn plugin_runtime_binding() {
    use sha2::{Digest, Sha256};
    use std::{env, fs, path::Path};
    let target = env::var("TARGET").expect("Cargo target");
    let binary = format!("binaries/plugin-runtime-{target}.exe");
    let manifest = format!("{binary}.manifest.json");
    println!("cargo:rerun-if-changed={binary}");
    println!("cargo:rerun-if-changed={manifest}");
    let inputs = [
        "scripts/build-plugin-runtime.mjs",
        "tools/plugin-runtime/host.js",
        "tools/plugin-runtime/session.js",
        "tools/plugin-runtime/input.js",
        "tools/plugin-runtime/dom.js",
        "tools/plugin-runtime/files.js",
        "scripts/plugin-file-runtime.js",
        "src/lib/plugin-guest-dom.js",
        "src/lib/plugin-call-context.js",
        "src/lib/plugin-request-context.js",
        "src/lib/plugin-response-context.js",
        "src/lib/plugin-run-helpers.js",
        "src/lib/plugin-app-async.js",
        "src/lib/plugin-app-sync.js",
        "src/lib/plugin-metadata.js",
        "src/lib/plugin-tag-metadata.js",
        "src/lib/plugin-values.js",
        "package.json",
    ];
    for path in inputs {
        println!("cargo:rerun-if-changed=../{path}");
    }
    if target != "x86_64-pc-windows-msvc" || !Path::new(&manifest).exists() {
        println!("cargo:rustc-env=INSOMNIUM_PLUGIN_RUNTIME_SHA256=");
        return;
    }
    let stamp: serde_json::Value =
        serde_json::from_slice(&fs::read(&manifest).expect("Bun runtime manifest"))
            .expect("Valid Bun runtime manifest");
    assert_eq!(stamp["schema"], 1);
    assert_eq!(stamp["target"], target);
    let package: serde_json::Value =
        serde_json::from_slice(&fs::read("../package.json").unwrap()).unwrap();
    assert_eq!(
        package["packageManager"].as_str().unwrap(),
        format!("bun@{}", stamp["bunVersion"].as_str().unwrap())
    );
    assert_eq!(stamp["sources"].as_object().unwrap().len(), inputs.len());
    for path in inputs {
        let digest = format!(
            "{:x}",
            Sha256::digest(fs::read(format!("../{path}")).unwrap())
        );
        assert_eq!(
            stamp["sources"][path], digest,
            "Stale Bun runtime input: {path}"
        );
    }
    assert!(!fs::symlink_metadata(&binary)
        .unwrap()
        .file_type()
        .is_symlink());
    let bytes = fs::read(&binary).expect("Compiled Bun inspection runtime");
    assert!(bytes.len() <= 256 * 1024 * 1024);
    assert_eq!(stamp["bytes"].as_u64(), Some(bytes.len() as u64));
    let digest = format!("{:x}", Sha256::digest(&bytes));
    assert_eq!(stamp["sha256"], digest, "Bun runtime binary mismatch");
    println!("cargo:rustc-env=INSOMNIUM_PLUGIN_RUNTIME_SHA256={digest}");
}
