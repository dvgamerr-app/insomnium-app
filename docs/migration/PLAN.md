# Migration execution plan

Updated 2026-10-16. Current state is in [STATUS.md](STATUS.md); all original requirements and acceptance boundaries remain in [PARITY.md](PARITY.md). Topic documents hold implementation details. Historical execution logs are available in Git at commit 2c8316e; they are not the current plan.

## Current remaining work — 2026-10-16

This checklist is the current execution order; bounded passes do not close an entire subsystem.

1. **Current: finish legacy gRPC Any reflection lookup.** Runtime changes are uncommitted; all45 Rust library tests pass, including100 pinned lookup vectors. Before acceptance: verify WKT field aliases and explicit empty Any payload presence; prepare saved native positive/fallback/refusal/reload/typed-repair/export scenarios; preflight the combined proto fixture; build a fresh audited application; retain all129 prior native groups; independently audit source/profile/export restoration; commit verified work. Ambiguous multi-file/declaration/load-order aliases remain unverified. The last accepted source is9104e215 (Any URL UTF16), with16native-hidden scenarios/129groups/202Save exports; that binary does not verify the current lookup changes. See STATUS.md and GRPC.md#current-native-grpc-any-url. Broader Any/WKT/JSON/template/editor/stream/provider/platform gates remain open.
2. **Streaming compatibility.** Remaining gRPC JSON/shared-editor/UTF8/surrogate cases, broader styles/providers/platforms; WebSocket fragmented application-history/control/close variants and large Clipboard Copy; further SSE UTF8/CRLF/compression exact boundaries and mixed environment/lifecycle variants. Prior exact-size, fragmentation, ACK, suspension and Save passes retain only their recorded scope.
3. **Models and durable data.** Remaining resource/model/callback-drain and OS-close cases, environment callers/imported-model variants, legacy formats/assets/invalid or absent payload recovery, import/export round trips.
4. **API tooling and compatibility.** Remaining GraphQL navigation/completion, gRPC/proto and OpenAPI contracts, runner scripts/imports, plugins and template integration; verify against the topic contracts.
5. **Networking and authentication.** Remaining cookie management/isolation, proxy schemes, OAuth/provider/native flows, redirects, TLS identity/certificate and platform matrices.
6. **Git.** Clone, remote checkout, non-force push and remaining Pull/network/process/I/O/recovery/provider/platform gates.
7. **Desktop and release.** Menus/shortcuts/dialogs/clipboard/window lifecycle, accessibility/keyboard/resize/theme, legal source/linkage, installer and CI/platform checks.
8. **Final audit, then deferred UX.** Map every PARITY acceptance requirement to current evidence or explicit owner removal before declaring migration complete. Continue shared-input adoption/CSS ownership and redesign in POST-MIGRATION-UX only in the authorized sequence.

## Latest investigation and document scope — 2026-10-16

Legacy Any URL UTF16/normalization has bounded Windows acceptance:14actual editor/wire/history/reload/Save groups plus4wrong-type refusal/typed-repair groups, retaining all111prior groups. Full39Rust tests/38pinned Any vectors,16native-hidden scenarios/129groups/202actual successful gRPC Save exports/exact16profiles and original manifest plus explicit1test/1STATUSdoc supplemental closure pass. See GRPC.md#current-native-grpc-any-url. Broader Any/WKT/JSON/template/editor/stream/provider/platform and every PLAN/PARITY gate remain open.

Legacy message-field JSON order now has bounded Windows acceptance:8new native default/full/normal/child/oneof/nested/cross-category cases plus original80groups pass with exact ordered JSON. Full28Rust tests,13native-hidden scenarios/88groups/120gRPCexports/exact13profiles and original0override closure pass. See GRPC.md#current-native-grpc-message-order. Broader JSON/WKT/oneof/map-entry-key/lone-surrogate/editor/template/stream/provider/platform and every retained gate remain open.

Rechecked all26 files under docs against the current migration plan and project knowledge map. All support active contracts, remaining acceptance, archive/build integrity or owner-required deferred UX; no additional unrelated file was identified or deleted. Historical MIGRATION-REVIEW.md, UI-DESIGN-SYSTEM-DEBT.md and COMMANDS.md were already removed (recover at c10061abcc38ac1d1e01d5f6459b1704e2c35217). Superseded plan narratives and completed initialization steps are recoverable at d5603cf641df1b46714f16e7cd4c09abe7ee01ca. Topic evidence and every PARITY requirement remain in place.

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
