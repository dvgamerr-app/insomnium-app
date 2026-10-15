# Migration execution plan

Updated 2026-10-15. Current state is in [STATUS.md](STATUS.md); all original requirements and acceptance boundaries remain in [PARITY.md](PARITY.md). Topic documents hold implementation details. Historical execution logs are available in Git at commit 2c8316e; they are not the current plan.

## Remaining execution order

Aggregate20MiB fragmented UTF8/binary exact/+1 native boundary is bounded verified in12frame groups; see HTTP.md#current-aggregate-websocket-fragmentation-boundary. Next broader control/close/fragmented application-history variants, large Clipboard Copy and gRPC plus remaining PARITY.



Eight explicit small WebSocket fragmentation/control sequences are bounded verified through real native Channel/independent wire; see HTTP.md#current-explicit-websocket-frame-acceptance. Next aggregate large fragmented messages, broader control/close cases, Clipboard Copy and gRPC plus every remaining PARITY gate.



Full20MiB text/binary native event Save is now bounded verified before/after reload with four exact files; see HTTP.md#current-full-large-websocket-export. Next explicit fragmentation/control frames, large Clipboard Copy and gRPC plus all retained PARITY gates.



Latest large stream UI correction is bounded verified: responsive512/65536unit previews with full20MiB text/binary history through terminal/reload,9MiB replacement and owned deletion; see HTTP.md#current-large-stream-ui-correction. Fresh largeUI3/SSEexact6/SSE8/WS6/mixed5 and original0override closure pass. Next explicit fragmentation/control frames, full large-event export, gRPC and every remaining PARITY gate.



Latest bounded acceptance: exact20MiB UTF8 text/binary send+echo hashes and incoming20MiB+1refusal pass in14native ACKgroups with original regressions. See HTTP.md#current-exact-websocket-transport-boundaries. Next actual large WebSocket UI/history/reload/retention, explicit fragmented/control frames and gRPC plus remaining PARITY.



Latest outgoing WebSocket guards are bounded verified: UTF8 ping125/126, ASCII/UTF8/binary20MiB+1, format refusals and binary recovery. See HTTP.md#current-outgoing-websocket-size-and-control-guards. Next exact20MiB accepted send/receive, incoming oversized/fragmentation and gRPC, plus all remaining PARITY.



Latest queued-timeout acceptance: open-peer and peer-close missing-ACK cases pass in9native ACKgroups, with exact queue settlement/single deadline and regressions. See HTTP.md#current-queued-websocket-timeout-acceptance. Next binary/control/exact-size/oversized WS-gRPC and remaining mixed/provider/platform/PARITY requirements.



Latest bounded WebSocket queue/close acceptance: three new groups plus original four pass; see HTTP.md#current-websocket-queued-send-and-close-edge-acceptance. Next queued missing-ACK timeout and further close/send races, followed by remaining size/mixed/provider/platform and every PARITY gate.



Latest bounded acceptance: genuine Windows renderer/host suspension8cases plus SSE8/WS6/mixed5 regressions pass; see HTTP.md#current-genuine-renderer-host-suspension. Earlier pending suspension wording below is superseded only for these8cases. Next queued-send/close-edge ACK/backpressure, further size/mixed/provider/platform and all remaining PARITY gates. Full migration incomplete.


### Current working-tree handoff — 2026-10-15

Native SSE bounds and the duplicate ACK deadline fix now have bounded Windows acceptance. Canonical evidence: HTTP.md#current-native-sse-bounds-and-ack-deadline. Candidate sse-bounds-ack-attempt-1 passes8new bounds/ACK groups, originalSSE8groups/10durables and WS6groups, exact3profile restoration and original1254entry source/other-scope closure with0overrides. Missing ACK now ends the invocation in30.004seconds rather than starting a second30second Finished wait. The verified topic commit is recorded in STATUS.md; earlier standalone timelines68aad03 remain accepted. Full migration remains incomplete.

Immediate remaining work:

1. Valid/corrupt gzip/deflate/Brotli6native cases are bounded verified (HTTP.md#current-compressed-sse-native-acceptance). Open-compressor flush and truncated-trailer cases are now bounded Windows verified (HTTP.md#current-open-compressor-flush-and-truncated-trailers). Consecutive gzip members plus corrupt later member and real HTTP Send are now bounded Windows verified (HTTP.md#current-consecutive-gzip-member-correction). Compressed cancellation and decoded line/event limits now pass24bounded Windows cases (HTTP.md#current-compressed-cancellation-and-decoded-limits). Five actual mixed HTTP/SSE/WebSocket history groups now have bounded Windows acceptance (HTTP.md#current-mixed-http-sse-and-websocket-histories). ASCII/LF exact20MiB line/data-field-line-sum guards and9MiB newest payload terminal/reload/replacement with retained raw export are now bounded Windows verified (HTTP.md#current-exact-sse-boundaries-and-large-event-retention). Four separate real Channel WebSocket ACK groups now have bounded Windows acceptance (HTTP.md#current-websocket-acknowledgement-controls). Next genuine renderer-host suspension, queued-send/close-edge ACK variants, further exact-size/oversized WS-gRPC and mixed environment/lifecycle/provider variants. Keep decoded raw capture distinct from compressed wire framing.
2. The scoped exact SSE/large-event milestone above is accepted; continue further UTF8/CRLF/compression/control-frame size and oversized WS/gRPC variants, remaining queued-send/close-edge ACK variants and genuine renderer/host suspension, followed by broader provider/platform/physicalTCP/OS-close requirements. The separate real receiver proves delayed/missing ACK behavior; debugger pause did not prove renderer starvation.
3. Continue supported legacy format/recovery variants, including independent timeline reads for invalid/absent payload paths or unsupported format/compression plans outside the supported missing-file receipt. Preserve diagnostics without fabricating history.
4. Continue model/shared UI/callback-drain; environment/import-export/recovery, GraphQL, gRPC/OpenAPI compatibility; Git clone/remote checkout/push/recovery; auth/provider/cookie/proxy/TLS; runner/plugin/templates; desktop/accessibility/platform/installer/CI and legal source/linkage. Audit every PARITY requirement before deferred input/UX redesign.

Cleanup retains migration contracts, acceptance evidence, original archive integrity/build records and the owner-required deferred UX plan. Removed the separate AI-HARNESS.md explainer; agent instructions remain in CLAUDE.md and .claude/.

Latest bounded milestone: WebSocket NDJSON activation is verified at 869ad32; see [its contract and evidence](IMPORT-EXPORT.md#current-legacy-websocket-ndjson-activation). Earlier activation next-step wording below is superseded only for that recorded scope. Native WebSocket send/receive/cancel/environment-history has bounded Windows acceptance (HTTP.md#current-websocket-runtime-lifecycle); broader variants remain required. SSE incremental events/cancellation/history has bounded Windows acceptance (HTTP.md#current-sse-runtime-lifecycle). Legacy SSE raw-body activation/portability and semantic timelines have bounded Windows acceptance (IMPORT-EXPORT.md#current-legacy-sse-raw-ndjson-activation). Next concrete lane is live raw SSE capture and byte-exact raw timeline preservation. This closes no provider/platform or other PARITY gates.

1. Complete remaining model/shared UI/callback-drain workflows. API import callback lifetime is corrected at9638705; native scenario2e04de6 verifies three genuine Windows save/drain callbacks with exact durable state/profile restoration (API-DESIGN.md). Broader callback-timeout/generation/OS-close/platform acceptance remains required. Windows environment lifecycle is verified at6349100 with unrelated-deletion retention at eae4ac2 (29checks/Name6/JSON12/inheritance5/foreign4+held1); broader caller/protocol/imported-model/platform acceptance remains required. Windows manual body/send/cancel/history is verified at7a0e9e3 with eae4ac2 regression coverage (body36/controls19/seededhistory6); broader platform/lifecycle compatibility remains required. Windows ResourceManager original6 +field24/correction6 +collection lifecycle6 is verified at2870f40, including14 legacy private-model exclusions/15 references and actual root reorder/restoration; broader model, callback-drain and platform acceptance remains required.
2. Finish environment/import/export, GraphQL, streams, gRPC and OpenAPI remaining compatibility. Legacy HTTP response assets/history are implemented at4bc799d and verified headless/Windows at4818d7a (IMPORT-EXPORT.md); reviewed ordinary HTTP binary/multipart request-file activation is implemented at11e9b96 and verified headless/Windows at08ab0b3 (8 assets/6 wire/5 reader refusals, exact source/profile). Reviewed portable CA/PEM/key/PFX activation is implemented atddea70f and headless/Windows verified at9180ac4 (IMPORT-EXPORT.md). Legacy WebSocketResponse NDJSON activation is verified at869ad32. Continue native WebSocket runtime/environment-history acceptance, SSE, embedded proto hierarchy/include variants and broader certificate/provider/import/recovery requirements. Broader legacy formats, protocol assets, recovery and platform gates remain required.
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
