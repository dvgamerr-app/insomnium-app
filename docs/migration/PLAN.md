# Migration execution plan

Updated 2026-10-15. Current state is in [STATUS.md](STATUS.md); all original requirements and acceptance boundaries remain in [PARITY.md](PARITY.md). Topic documents hold implementation details. Historical execution logs are available in Git at commit 2c8316e; they are not the current plan.

## Remaining execution order

1. Complete remaining model/shared UI/callback-drain workflows. API import callback lifetime is corrected at9638705; native scenario2e04de6 verifies three genuine Windows save/drain callbacks with exact durable state/profile restoration (API-DESIGN.md). Broader callback-timeout/generation/OS-close/platform acceptance remains required. Windows environment lifecycle is verified at6349100 with unrelated-deletion retention at eae4ac2 (29checks/Name6/JSON12/inheritance5/foreign4+held1); broader caller/protocol/imported-model/platform acceptance remains required. Windows manual body/send/cancel/history is verified at7a0e9e3 with eae4ac2 regression coverage (body36/controls19/seededhistory6); broader platform/lifecycle compatibility remains required. Windows ResourceManager original6 +field24/correction6 +collection lifecycle6 is verified at2870f40, including14 legacy private-model exclusions/15 references and actual root reorder/restoration; broader model, callback-drain and platform acceptance remains required.
2. Finish environment/import/export, GraphQL, streams, gRPC and OpenAPI remaining compatibility. Legacy HTTP response assets/history are implemented at4bc799d and verified headless/Windows at4818d7a (IMPORT-EXPORT.md); next implement reviewed binary/multipart request-file activation through the existing portable body/parameter base64 path. Broader legacy formats, protocol assets, recovery and platform gates remain required.
3. Finish Git clone/remote checkout/push and remaining network/provider/recovery gates; finish authentication provider/native acceptance. Proxy NTLMv2 Windows30 is verified; broader legacy schemes/provider/platform gates remain open.
4. Complete desktop integration, license coverage/linkage, installer and CI/platform acceptance. Namespace original20+88/current Windows source/package/kernel-process audit is verified at787cce7; universal loader/linkage/all-birth/OS-close/physical-width/AT/platform claims remain open.
5. Audit every PARITY requirement against current evidence. Only then start the deferred input/UX redesign in POST-MIGRATION-UX.md.

## Working rules

Commit verified changes by topic. Update the existing STATUS sections rather than prepend another checkpoint. Record evidence, remaining gates and live handles. This interface cannot invoke /compact; provide the handoff explicitly after each feature. Saved browser scenarios use launchUiBrowser with headless:true and no override; native hosts hide before CDP and report native-hidden. Bun only; preserve legacy backup and the Insomnium layout. AGENTS.md is authoritative where older initialization instructions below differ, including the explicitly authorized saved Playwright scenarios.

## Fixed decisions

- Tauri 2 native desktop shell; Svelte + plain JavaScript + Vite frontend.
- Bun only for dependency management, scripts, initialization, frontend build and Tauri CLI. Cargo/Rust handles native code; no Node runtime/sidecar.
- Local-first application with no login, telemetry, remote sync, or automatic calls to sample APIs.
- Preserve current Insomnium layout (collection sidebar, environment switcher, request tabs, URL/send row, response panes, purple accent). Owner explicitly confirmed this choice.
- `jirasync-hub-app` supplies known-working Bun/Tauri configuration patterns, not product identity.
- Original archive/scaffold work is complete. Preserve `_backup/legacy-electron/` and its original manifest. Never repeat the initial move or scaffold over the current application.
- Official generators first for new subsystems. Saved Playwright scenarios are explicitly authorized by AGENTS.md.

## Ordered execution and exit criteria

1. **Inventory and documentation**: inspect models, networking, UI, importers, plugins, workflows; read official Tauri, Bun, Svelte docs; record feature parity and commands.
2. **Archive**: capture original HEAD/status and per-file hashes; move original files with checked absolute paths; compare manifest after move; add `/_backup/` ignore. Existing installed user data is not moved or modified.
3. **Official scaffold**: `bun create tauri-app .migration-scaffold --manager bun --template svelte --identifier app.insomnium.desktop --tauri-version 2 --yes`; promote generated files to root; change scripts to `bun x --bun`; `bun install`. Build the unmodified template before feature work.
4. **Design and architecture**: document tokens, components, state/data boundaries, native commands, resource mapping and data recovery. Implement usable shell matching approved UI direction.
5. **Core request workflow**: workspaces, folders, request CRUD/search/tabs, key-value editors, HTTP methods/body/auth/query, native HTTP transport, cancellation, response body/headers/timing/history, persistence. Verify against local Bun HTTP fixture, not production endpoints.
6. **Data and environments**: Insomnia export import/export, legacy NeDB read-only migration with preview/backup, environment inheritance/templating, cookies, history, settings. Reject unsupported formats visibly; preserve unknown legacy resources.
7. **Advanced networking and tooling**: GraphQL, multipart/binary, proxy/TLS/client certificates, OAuth and other auth, streaming/SSE/WebSocket/gRPC, OpenAPI/design/lint, Git and plugin compatibility. Consult docs per subsystem; follow PARITY.md.
8. **Desktop integration**: menus, shortcuts, native dialogs/files, window state, icons, themes, local preferences, packaging and CI using Bun/Cargo. No update endpoint until project release identity is established.
9. **Acceptance**: Svelte compilation, frontend build, Cargo check/clippy, native build/package, visual inspection and manual core/advanced flows. No new automated test files. Document platform-specific checks that cannot run here.
10. **Handoff**: update STATUS/PARITY/README with exact commands, verified results, outstanding work and next action. Full migration is not complete while parity items remain.

## Continuation protocol

Open `STATUS.md` first, then `PARITY.md`. Inspect working tree without reverting changes. Follow the listed next action. Read relevant official docs before edits. After every milestone update status with files, command and actual outcome. Record active process IDs if a compiler/server is running. Keep failures and limitations explicit. No need for previous chat session.

## Official sources consulted before initialization

- https://v2.tauri.app/start/create-project/ — Bun generator and Svelte JavaScript template.
- https://github.com/tauri-apps/create-tauri-app — generator options; verified with `bun create tauri-app --help` (4.7.4).
- https://v2.tauri.app/start/frontend/vite/ — fixed port, dev URL, dist folder and watcher exclusion.
- https://bun.sh/guides/ecosystem/vite — `bun x --bun` prevents following Node shebangs.
- https://svelte.dev/docs/svelte/overview and https://svelte.dev/docs/svelte/$state — Svelte components and reactive state.
- https://v2.tauri.app/develop/calling-rust/ — async native commands, invocation and channels.
- https://v2.tauri.app/plugin/http-client/ — native HTTP capability and API.
- https://v2.tauri.app/plugin/store/ — local persistent store.
- https://v2.tauri.app/plugin/dialog/ — native file selection.
