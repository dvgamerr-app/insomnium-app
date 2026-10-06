# OS template compatibility

Updated: 2026-09-28. Implemented for desktop template preview; Send still uses the previous variable-only renderer. Full migration is incomplete.

## Behavior

The archived OS tag is in _backup/legacy-electron/packages/insomnia/src/ui/components/templating/local-template-tags.ts. The new Rust provider uses libuv directly, with no Node runtime or sidecar.

| Function | Native result                                                                                 |
| -------- | --------------------------------------------------------------------------------------------- |
| arch     | Build architecture mapped to legacy x64/ia32/arm64/ppc/ppc64/loong64 spellings                |
| platform | Build OS mapped to win32/darwin/sunos where required                                          |
| cpus     | Logical CPU array: model, MHz speed, user/nice/sys/idle/irq times in milliseconds             |
| freemem  | Free memory bytes reported by libuv; zero if unknown                                          |
| hostname | Native hostname                                                                               |
| release  | Native OS release from uv_os_uname                                                            |
| userInfo | Effective user uid/gid, username, home directory and shell; Windows uid/gid -1 and shell null |

Only these seven function names are accepted. CPU allocation is freed through RAII, as are user information strings. CPU lists are capped at 10,000 entries. The command runs blocking OS work away from the UI thread and is restricted to the main window. Aborting a preview discards its result; it does not forcibly cancel a native OS query already in progress.

Native JSON is normalized into legacy property order in the template worker before formatting. Only cpus/userInfo apply JSONPath. The first match is returned; strings remain text, other values are JSON. Empty matches preserve undefined behavior. Invalid queries retain the original value as in the archived implementation. Queries use the existing safe evaluator, with 4,096-character query, 10,000-match and 20-Mi-character matched-value bounds. Bound errors are not swallowed. Worker and VM deadlines continue to apply.

The application-owned handler supplies native values; no invoke function or OS API enters the guest VM. Query evaluation stays in the disposable worker. Browser preview has no native OS handler. No OS information is logged or persisted by this implementation.

## Dependency and build setup

Official sources consulted before implementation:

- https://v2.tauri.app/plugin/os-info/ — reviewed; the plugin does not provide the complete CPU/userInfo data required by the archived tag, so it was not installed.
- https://docs.libuv.org/en/v1.x/misc.html — CPU allocation/free, free memory, hostname, uname and effective-user APIs.
- https://github.com/bmatcuk/libuv-sys/blob/master/README.md and build.rs — Rust binding configuration and native build requirements.
- https://doc.rust-lang.org/cargo/commands/cargo-add.html — documented dependency command.
- https://rust-lang.github.io/rust-bindgen/requirements.html — libclang/MSVC requirements.
- https://nodejs.org/api/os.html — legacy data shape only; no Node program was executed.

Installed with cargo add libuv-sys2@~1.53.0 --features skip-pkg-config --manifest-path src-tauri/Cargo.toml. Cargo.lock resolves 1.53.0. skip-pkg-config builds the bundled libuv sources; this is a native library, not a JavaScript runtime. Existing MSVC Build Tools 2017/SDK 10.0.19041 compiled it successfully on Windows x64.

Bindgen additionally requires libclang >=9 at build time. LLVM 20.1.8 was downloaded from the official release, then only bin/libclang.dll and lib/clang/20/include/* were extracted with installed 7-Zip into ignored artifacts/tools/llvm-20.1.8. The installer was not run and no system PATH was changed.

Source: https://github.com/llvm/llvm-project/releases/download/llvmorg-20.1.8/LLVM-20.1.8-win64.exe

SHA-256: 3197846a2b19063687dd56e93e34cd941e3548d907f23a6131571321bdf9fe7b (matched official GitHub release asset digest).

For continuation on this workspace, add LIBCLANG_PATH=E:/insomnium/artifacts/tools/llvm-20.1.8/bin to the child-process environment used to launch Cargo/Tauri, alongside the documented CARGO_HOME/RUSTUP_HOME/MSVC PATH/LIB/INCLUDE settings. Other machines can use their installed LLVM following the bindgen guide. Clang is not a runtime dependency and artifacts are not part of the app bundle.

All commands in this session were launched directly through node_repl child_process with shell:false/windowsHide:true. Bun handled filesystem edits, downloads and inline assertions. No shell/Node/npm/Python was executed and no test scripts were created.

## Verification and remaining acceptance

- 22 inline OS formatting/legacy-algorithm comparisons and validation assertions passed.
- 8 assertions against the compiled template worker passed: primitives, nested CPU filter, encoded filter, user field, canonical user/CPU JSON order and unknown-function rejection. A Bun wrapper supplied fixture native replies and simulated browser WASM loading.
- 2 additional JSONPath query/result-bound assertions passed.
- An inline Rust source compiled through rustc stdin against the actual provider and linked dependency artifacts. Its ignored executable read all seven real Windows values, rejected an unknown function and repeated CPU/user/system reads 32 times. Only a success summary was printed, without host/user values. This verifies the provider, not Tauri IPC.
- Svelte check: zero errors/warnings. Vite production build, Cargo check, Cargo build --lib --locked and Clippy --lib --locked -- -D warnings passed. Initial JSONPath unknown-result/implicit callback annotations and one manual_range_contains lint were corrected.
- Main-window permission generation compiled. Actual WebView IPC/CSP, mounted UI behavior and Linux/macOS builds remain unverified. No new installer was produced; BUILD.json still describes an older checkpoint.

Next: interactive prompt waiting/cancellation/dialog lifecycle, recursive environment/request rendering, Send/auth/protocol call sites and dependent-response sending. Do not mark overall template or full migration parity complete.
