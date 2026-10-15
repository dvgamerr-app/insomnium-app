# Migration execution plan

Updated 2026-10-16. Current state is in [STATUS.md](STATUS.md); all original requirements and acceptance boundaries remain in [PARITY.md](PARITY.md). Topic documents hold implementation details. Historical execution logs are available in Git at commit 2c8316e; they are not the current plan.

## Current remaining work — 2026-10-15

This checklist is the current execution order; bounded passes do not close an entire subsystem.

1. **Current: remaining gRPC compatibility.** Legacy JSON numeric overflow corrected in isolated parser:8actual parser vectors/boundaries and23Rust tests pass; eight native editor/double/int32/int64/string/history/export cases pass. Full regression74groups/11profiles/92gRPCexports and fresh0override closure pass. See GRPC.md#current-native-grpc-overflow. Broader JSON/WKT/oneof/map/key-order/editor/stream/provider/platform and every retained gate remain open.
2. **Streaming compatibility.** Remaining gRPC JSON/shared-editor/UTF8/surrogate cases, broader styles/providers/platforms; WebSocket fragmented application-history/control/close variants and large Clipboard Copy; further SSE UTF8/CRLF/compression exact boundaries and mixed environment/lifecycle variants. Prior exact-size, fragmentation, ACK, suspension and Save passes retain only their recorded scope.
3. **Models and durable data.** Remaining resource/model/callback-drain and OS-close cases, environment callers/imported-model variants, legacy formats/assets/invalid or absent payload recovery, import/export round trips.
4. **API tooling and compatibility.** Remaining GraphQL navigation/completion, gRPC/proto and OpenAPI contracts, runner scripts/imports, plugins and template integration; verify against the topic contracts.
5. **Networking and authentication.** Remaining cookie management/isolation, proxy schemes, OAuth/provider/native flows, redirects, TLS identity/certificate and platform matrices.
6. **Git.** Clone, remote checkout, non-force push and remaining Pull/network/process/I/O/recovery/provider/platform gates.
7. **Desktop and release.** Menus/shortcuts/dialogs/clipboard/window lifecycle, accessibility/keyboard/resize/theme, legal source/linkage, installer and CI/platform checks.
8. **Final audit, then deferred UX.** Map every PARITY acceptance requirement to current evidence or explicit owner removal before declaring migration complete. Continue shared-input adoption/CSS ownership and redesign in POST-MIGRATION-UX only in the authorized sequence.

## Latest investigation and document scope — 2026-10-16

Latest verified application topic: 46d1602a; handoff: d5603cf6. Legacy oneof investigation has a pinned reference at artifacts/grpc-oneof-reference.json, but the runtime still rejects multiple members (src-tauri/src/grpc_legacy.rs). Implementation and native acceptance remain pending.

All 26 remaining docs files support active migration contracts, remaining acceptance, archive/build integrity or owner-required deferred UX. No additional unrelated file was identified. Superseded milestone narratives and completed initialization steps were removed from this plan; recover their committed versions at d5603cf641df1b46714f16e7cd4c09abe7ee01ca. Topic evidence and every PARITY requirement remain in place.

## Working rules

Commit verified changes by topic. Update the existing STATUS sections rather than prepend another checkpoint. Record evidence, remaining gates and live handles. This interface cannot invoke /compact; provide the handoff explicitly after each feature. Saved browser scenarios use launchUiBrowser with headless:true and no override; native hosts hide before CDP and report native-hidden. Bun only; preserve legacy backup and the Insomnium layout. Follow AGENTS.md, including the explicitly authorized saved Playwright scenarios.

## Fixed decisions

- Tauri 2 native desktop shell; Svelte + plain JavaScript + Vite frontend.
- Bun only for dependency management, scripts, initialization, frontend build and Tauri CLI. Cargo/Rust handles native code; no Node runtime/sidecar.
- Local-first application with no login, telemetry, remote sync, or automatic calls to sample APIs.
- Preserve current Insomnium layout (collection sidebar, environment switcher, request tabs, URL/send row, response panes, purple accent). Owner explicitly confirmed this choice.
- `jirasync-hub-app` supplies known-working Bun/Tauri configuration patterns, not product identity.
- Original archive/scaffold work is complete. Preserve `_backup/legacy-electron/` and its original manifest. Never repeat the initial move or scaffold over the current application.
- Official generators first for new subsystems. Saved Playwright scenarios are explicitly authorized by AGENTS.md.

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
