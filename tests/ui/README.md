# UI scenarios (Playwright + Bun)

All browser scenarios use `launchUiBrowser` in `helpers/preview-app.js`, with
`headless: true` and no headed override. Run saved scenarios with Bun.
Native Tauri scenarios attach to WebView2 through CDP and hide their own host
window; their rendering mode is `native-hidden`, rather than browser headless.
See `docs/migration/UI-TESTING.md` for the native host and OS dialog limitations.

Reverified 2026-10-08 with `bun tests/ui/design-system.js` (passed). There is one
shared browser launch and it explicitly enables headless mode.

All four client-certificate entries now cover CA-signed server SAN mismatch,
expired and future certificates through real native settings/Send/Connect.
The shared fixture records independently checked signatures/dates/OpenSSL error
codes, Bun TLS classifications and actual native certificate alerts with zero
HTTP/RPC/event delivery. Valid-server recovery and four-setting restoration pass.
Current totals: HTTP15, SSE23, WSS23, gRPC36 including unary and reflection cases.
No network TLS-validation bypass or trust-store change. See STATUS/UI-TESTING for
exact evidence and remaining certificate/provider/platform gates.

SSE/WSS client-certificate scenarios also reuse
`helpers/stream-redirect-certificate.js`: eight native redirect cases per protocol
cover same-origin chains, host/port/scheme refusal before destination TCP, explicit
disabled follow and the10-hop loop limit. Each validates actual peer/path/event
history, exact persisted reload and no automatic reconnect. Final20 groups per
protocol pass; HTTP shared-fixture regression passes12. See UI-TESTING/STATUS for
exact artifacts and remaining gates. Run native scenarios sequentially.

The saved `bun tests/ui/sse-client-certificate.js` now includes two live mutual
TLS Connect/Disconnect cycles, fragmented UTF8/BOM/multiline/id/retry framing,
actual server-observed closure and exact persisted response reload. Run it only
after the production probe build finishes successfully. `bun tests/ui/sse-bom.js`
checks every byte chunk width against the compiled release parser. For recovery
from an interrupted TLS scenario, `INSOMNIUM_UI_TLS_RECOVERY` may point to an
owned `artifacts/playwright` JSON record of the four original settings; the saved
runner restores and verifies them through Preferences before testing.

## Native gRPC client certificate

Run `bun tests/ui/grpc-client-certificate.js` against the successful current
native-recovery-copy-probe build. The saved scenario opts into an owned Rust
HTTP/2 listener with ALPN h2 and mandatory client verification. Twelve unary/TLS groups
cover an independent authenticated HTTP/2 self-check, actual native unary Send,
CA bundles in both root positions, missing/mismatched/untrusted/malformed TLS
settings, recovery and exact response reload without resend. Server evidence
records the verified peer CN/fingerprint and exact protobuf bytes; four original
TLS settings are restored. Run native scenarios sequentially.

The same saved entry now also runs `helpers/grpc-stream-certificate.js`:
server-streaming receives two distinct responses; client-streaming sends two
exact frames then Commit produces server-observed EOF; bidirectional receives
each echo while its sender is still open before Commit. Cancel for all three
shapes must produce actual server-observed HTTP/2 RST_STREAM CANCEL. All seven
streaming cases preserve resources/retained history and full response after
reload, without automatic reconnect; final Chat explicitly reconnects and sends
again. These unary/TLS/streaming checks account for19 groups.

`helpers/grpc-reflection-certificate.js` adds11 reflection groups: actual v1
list-services/file-containing-symbol discovery through Server reflection and Load
methods, exact five methods/shapes and native Send using the cached reflected
schema. CA bundles work in both positions; missing/mismatched/untrusted/malformed
TLS settings refuse discovery. A second mandatory-auth endpoint supports only
v1alpha, proving actual v1 UNIMPLEMENTED fallback. Discovery preserves all
resources/history before explicit method selection; Send and reload preserve
complete responses without automatic discovery/resend. The complete saved entry
has30 groups. Arbitrary reflection graphs/errors, provider/proxy/legacy/platform
parity remain separate gates.

## Native HTTP client certificate

`bun tests/ui/wss-client-certificate.js` shares the stream TLS runner with SSE.
Twelve groups cover native mandatory mTLS upgrade/HTTP101, one received text,
normal1000 close, CA bundle/refusals/recovery and saved reload, plus two live
text/binary/ping-pong send/Disconnect/reconnect cycles. Original TLS
preferences are restored; run sequentially against the current native build.
Redirect and gRPC acceptance remain separate.

The WSS live helper also checks Payload options in24 combinations (dark/light,
1440/900/760, text/JSON/binary/ping): readable name width, containment/no overlap,
no row overflow and keyboard name→type select. Theme/type/viewport are restored.

Binary picker checks also verify one painted compact surface, full interactive
native input area and type→file tab focus. Each live connection selects the same
owned binary file twice through Playwright's intercepted WebView chooser, checks
async reset/persisted filename/bytes and sends the exact payload to the server.
This does not verify the OS file dialog.

`bun tests/ui/sse-client-certificate.js` uses the same current native build and
mandatory-auth TLS fixture, with shared Network Preferences setup. Eleven groups
check real SSE authentication/bundle/refusals/recovery, exact finite event/id/data
and persistence after reload; original TLS settings are restored. Run sequentially
with HTTP/native scenarios. Live disconnect/redirect and WSS/gRPC remain separate.

Run `bun tests/ui/http-client-certificate.js` against a successful current
native-recovery-copy-probe build. Windows fixture prerequisites are the existing
Git OpenSSL, Rust compiler/MSVC/SDK paths and cached native release rlibs; the
shared helper records those exact paths. Per-run CA/identities stay under the
owned artifact directory. Rustls requires client authentication and records
actual peer CN/fingerprint/body; both listeners are checked independently first.
Twelve groups cover native Preferences/reload/Send, both CA bundle orders,
malformed CA refusal before TCP, TLS refusals/recovery and
cross-origin destination TCP/HTTP0. All four TLS preferences are restored and
verified before cleanup. Scope, evidence and commands: docs/migration/UI-TESTING.md.

## Selected Git restore

The restore scenario defaults to `artifacts/native-restore-recovery-probe/build-state.json`. Its success-hook helper preserves native execution/replies while acquiring the OS file handle after successful baseline save, so the next real restore replacement fails deterministically. It verifies locked recovery, unchanged authoritative baseline, no recovery write and automatic mounted Source Control session reload followed by another restore. Native source-control/theme regressions use the shared build-state override for this same executable.

On Windows, the saved restore scenario also uses helpers/windows-workspace-lock.js to deny atomic replacement of only the canonical isolated-probe workspace-v1.json. It checks native refusal/exact original bytes/retry and UI baseline-save refusal without a transition, followed by successful retry. The Bun FFI handle/library are released in finally. This covers file sharing, not disk-full/crash or the retained-copy OS picker.

`bun tests/ui/git-restore.js` uses `artifacts/native-restore-ui-probe/build-state.json` or `INSOMNIUM_UI_BUILD_STATE`. Wait for that build to finish successfully. It exercises real native selected restore with review/cancel, modified/deleted/added resources, preserved unselected/protected records, unchanged HEAD, reload and lost-success reply recovery without resubmission. Review captures dark/light at900/760. Run sequentially with other native scenarios on the isolated identity. Actual disk faults and retained-copy OS picker acceptance remain separate.

The scenario also verifies native stale-HEAD/unselected-write/stale-workspace refusals, restore during a held HTTP request with observed connection close and unchanged history, and a fresh persisted200 afterward. It shares the owned loopback held-http helper with runner-lifecycle. Latest successful build override: artifacts/native-restore-layout-probe/build-state.json. Actual disk faults and retained-copy OS picker remain separate. Source-control scenario verifies each toolbar action against the sidebar form's inner bounds at1440/900/760 in both themes.

## Collection runner

`bun tests/ui/runner-lifecycle.js` uses the successful `artifacts/native-ui-ownership-probe/build-state.json` by default (or the shared `INSOMNIUM_UI_BUILD_STATE` override). It covers real native HTTP for direct/detached/delegated callbacks, passing/failing assertions, single-test result selection, persisted reload, Stop with observed server connection close and no cancelled result/history, a fresh run after Stop, and dark/light widths1440/900/760. It uses the existing owned-collection/native-app helpers and a loopback HTTP fixture. Run sequentially with other native scenarios; never use production data. Nested suite/script/import/provider/OS-close compatibility remains separate.

## Shared controls and Nocturne theme

- `bun tests/ui/git-diff.js` checks the production unified diff component: YAML syntax, old/new line markers, red/green backgrounds, read-only behavior, gutter bounds, and switching modified/added/deleted/unchanged in dark/light at1440/900/760. `git-source-control.js` and `nocturne-native-theme.js` now default to `artifacts/native-unified-diff-probe/build-state.json`; await that build before running native scenarios. Source-control acceptance checks the real native change baseline, staging/commit and simplified local branch actions.

- `bun tests/ui/design-system.js` checks shared field/checkbox/file/tab/dialog contracts using production components in a saved fixture. `nocturne-theme.js` additionally checks SVG dropdown arrows, native-arrow suppression, arrow bounds and full-surface hover in both themes; `nocturne-workspace.js` checks centered method/protocol alignment and picker keyboard behavior. Keep `bun run check` and `bun run build` sequential because both mutate SvelteKit generated output.

- `bun run test:ui:workspace` checks shared dropdown keyboard selection and dark/light picker styling, Escape ordering, numeric input persistence, modal focus, and resizable panels. Screenshot evidence includes `dropdown-dark.png`, `dropdown-light.png` and `shared-settings.png`.
- `bun run test:ui:source-control` verifies selected native commits, staging, author settings, branches and panel sizing using the isolated controls probe.

- `bun tests/ui/nocturne-reference.js` captures the anonymous live reference in dark/light themes using an isolated Edge session.
- `bun run build`, then `bun run test:ui:theme` checks the static preview at1440/900/760 widths, both themes, editor/auth/body/dialog/design/runner/protocol surfaces and routed HTTP success/loading/failure. Outputs are in `artifacts/playwright/nocturne-theme/`.
- `bun tests/ui/nocturne-native-theme.js` checks actual native Git, cookies, proto management and checkout recovery. Defaults to the successful isolated build record `artifacts/native-nocturne-controls-probe/build-state.json`; run sequentially with other native scenarios. Outputs use timestamped scenario folders.
- `bun tests/ui/nocturne-stream-theme.js` checks live WS/SSE events, headers, disconnection and errors against a Bun loopback server, both themes at1440/900/760.
- `bun tests/ui/nocturne-grpc-theme.js` checks gRPC messages, metadata, trailers and errors against a Bun HTTP/2 fixture using an imported proto. Uses the same isolated native build record.

These are visual/theme checks of existing features, not completion evidence for the full migration parity tracker.

## Native migration scenarios

Run from the project root after an isolated native build finishes:

- `bun tests/ui/git-create-and-switch.js`
- `bun tests/ui/git-create-resume.js`
- `bun tests/ui/git-create-forget.js`
- `bun tests/ui/git-delete-branch.js` — merged deletion, active refusal, reload
- `bun tests/ui/git-delete-unmerged.js` — unmerged and stale target refusal
- `bun tests/ui/git-delete-stale-session.js` — stale HEAD refusal and explicit retry

Run sequentially: the Windows single-instance app identity and native app-data directory are shared. Each scenario creates unique collections/repositories and retains previous fixtures. Do not run against production data.

Default build record: `artifacts/native-delete-ui-probe/build-state.json`. Override with `INSOMNIUM_UI_BUILD_STATE` only for another successful build with the exact allowed probe identity. The helper validates identity, artifact path and build timestamp before launch.

Playwright library connects to the spawned app's WebView2 through documented `chromium.connectOverCDP`. Bun runs the JavaScript directly; no Playwright Node worker, browser download, shell, browser-use tool or ad-hoc UI commands. Shared helpers own native launch, fixture preparation, bounded waits, cleanup and result artifacts.

Outputs: `artifacts/playwright/<scenario>-<timestamp>/`; result.json and acceptance.json record scope. Screenshot/body text are saved on failure. Rerun the same scenario after a fix rather than recreating interactive steps.

These scenarios verify native UI behavior with loopback debugging; they do not cover OS file dialogs, abrupt process crashes, lost transport replies or OS-close lifecycle. Resume arranges a durable submitted intent with an already-created native ref.

Official references:

- https://playwright.dev/docs/webview2
- https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp

Dependency installed with `bun add --dev --exact --ignore-scripts playwright-core` (1.63.0). The existing WebView2 runtime supplies the browser.

Locator reference: https://playwright.dev/docs/locators#locate-by-role. Wait for the reloaded Git session before asserting a branch is absent.

## Remote lifecycle

Run `bun tests/ui/git-remote-lifecycle.js` after `artifacts/native-remote-ui-probe/build-state.json` finishes successfully. This scenario defaults to that newer build record and takes about 35–45 seconds because it verifies the actual 30-second timeout. Optional INSOMNIUM_UI_BUILD_STATE must reference a compatible isolated build.

Uses a disposable Bun loopback advertisement/stalled endpoint, native IPC, and saved Playwright actions on the existing Git dialog. Covers worker dispatch, UI responsiveness, cancel/pre-cancel/timeout and local data preservation. Remote settings/Stop UI and actual providers are not covered. No browser-use.

References consulted: https://bun.sh/docs/runtime/http/server (disable fixture idleTimeout so native timeout wins); https://playwright.dev/docs/api/class-page#page-evaluate.

## Remote settings UI

Run `bun tests/ui/git-remote-settings.js` (alias `bun run test:ui:git-remote-settings`) after artifacts/native-remote-settings-ui-probe/build-state.json finishes. The script defaults to that build record. Covers saved local settings/basic authentication/reload, visible Read/Stop, endpoint-edit cancellation and data preservation against a loopback fixture. Also verifies wrong-password error preservation and dialog-close cancellation using observed loopback connection abort. Provider OAuth/refresh, OS dialogs/OS-close, checkout-drain and storage failure edges remain separate acceptance. Run sequentially with other native scenarios.

- Git Fetch: bun tests/ui/git-fetch.js (native-fetch-ui-probe build required). Real-pack fixture, saved-settings gate, HEAD/resources preservation, reconciliation and Stop. Passed on native-fetch-ui-probe: artifacts/playwright/git-fetch-1790774627690. Also covers changed persisted binding during network; restart/OS-close/lost IPC remain pending.

Fetch inspection update: default build record is artifacts/native-fetch-inspect-ui-probe/build-state.json. The same saved git-fetch.js runs Fetch plus a separate orderly native restart inspection. Passed artifacts/playwright/git-fetch-1790775212631 and git-fetch-restart-1790775214639. Client is exercised through injected native invoke; durable recovery UI and crash/power-loss remain pending.

Durable-intent UI update: git-fetch.js now defaults to artifacts/native-fetch-intent-ui-probe/build-state.json; confirmed intent UI recovery and unconfirmed Stop/reload retention passed in git-fetch-1790775827974, with restart git-fetch-restart-1790775830365. Explicit resolution of unconfirmed intent remains pending.

Retirement acceptance: git-fetch.js now uses native-fetch-retire-ui-probe (11 checks + restart3). Run bun tests/ui/git-fetch-retire-race.js for controlled in-flight retirement with cancel IPC rejection (5 checks). Evidence git-fetch-1790776436355, git-fetch-restart-1790776438945, git-fetch-retire-race-1790776601455. The race injects only cancel transport rejection; real native worker/network/storage/publication remain active. Disk faults/crash/stage cleanup remain unverified.

Recovery errors: bun tests/ui/git-fetch-recovery-errors.js uses helpers/ipc-failure.js and the native-fetch-retire-ui-probe build. Passed lost native Fetch success reply (5 checks), rejected retirement save (4), lost native save success reply (4). Evidence suffixes1790776835174,1790776836701,1790776838051. These are IPC transport faults, not OS disk or power-loss tests.
