# Git remote worker lifecycle

2026-09-30 latest checkpoint: Parent now reserves fetch container/ownership marker; confirmed failed/cancelled workers clean it automatically, successful or uncertain work is retained. Cargo checks,43 lifecycle/ownership assertions and15 real-pack assertions through supervisor passed. App-data allocation, restart recovery, successful-stage handoff/publication and UI remain pending.

2026-09-30 latest checkpoint: Fixed supervisor termination evidence: explicit checked wait, idempotent reaped state and joins of both pipe threads before returning errors. Cargo checks/native33 assertions passed. Automatic staging allocation/cleanup, publication and UI remain pending; see STATUS.md.

Updated: 2026-09-30. Implemented and native IPC/existing UI responsiveness accepted; remote settings/Stop controls and broader lifecycle acceptance pending.

## Why a process boundary

git2 0.21.0 server timeout options modify unsynchronized C globals and document that they must be set before any thread starts. Remote::stop requires a mutable remote while connect_auth is blocking. Aborting a spawn_blocking future does not terminate a running blocking task. The implementation therefore runs read-only advertisement in a native child process, rather than reporting a timeout while leaving the C call running inside the application.

This boundary currently applies only to advertisement. It must not be reused to kill ref-changing operations without an explicit transaction/uncertainty design.

## Implementation

- git_remote_job.rs owns the registry, worker entry, process supervisor and Tauri commands.
- git_remote_advertise now requires requestId (UUID), input and managed RemoteJobState. At most four jobs run simultaneously; registry retains completed/pre-cancelled IDs for 60 seconds, with a 128-entry cap.
- git_remote_cancel acknowledges the cancellation request. The original advertisement promise resolves only after the supervisor terminates/reaps the child and joins pipe workers. A cancel that reaches native admission first prevents that ID from starting; duplicate IDs are rejected.
- Native child uses the current executable with a fixed worker argument. On Windows CREATE_NO_WINDOW is set, with no shell. Credentials go through bounded stdin JSON, never argv or diagnostic stderr.
- run() checks worker_entry before creating Tauri/plugins or invoking single-instance behavior. The child only calls detached-remote advertisement.
- Supervisor timeout is 30 seconds; cancellation polls every 20 ms. Output is drained concurrently with a 32 MiB cap; input is capped at 64 KiB. OwnedChild terminates/reaps on all exit paths. Result parsing happens after process completion.
- Child has an independent 35-second watchdog, including blocked stdin, to bound an orphan after abrupt parent termination. This is not immediate parent-death cleanup and has not been accepted in a packaged app.
- Registry reservation lives inside the blocking supervisor, so dropping the frontend waiter does not release a running job's slot prematurely.
- No GitState/StorageState lock is held for network work, no managed repository/HEAD/workspace changes, and no global libgit2 timeout mutation.

## Evidence

artifacts/git-remote-job-check/state.json: Cargo fmt/check/clippy -D warnings all exit 0.

Actual source extracted into a Rust stdin probe (no new saved test script), with Bun loopback Git advertisement and a stalled endpoint: probe-state.json / probe-runtime.log show 14 assertions and exit 0. Covered normal result, bounded timeout/cancel return, pre-cancel, invalid/duplicate ID refusal, reservation cleanup and four-job concurrency limit. Probe executes the same binary recursively through worker_entry and run_worker.

This is not mounted Tauri IPC, Windows production EXE, real GitHub/GitLab, UI/OS-close, parent-crash/watchdog, TLS/proxy or redirected-credential acceptance. Previous advertisement auth-mapping fixture remains separate evidence.

## Next steps

1. Build isolated Tauri probe and verify worker dispatch leaves the primary single-instance window intact.
2. Add settings/client integration with unique request IDs, tracked workspace work, cancel-on-dispose/change, and waiting for the original promise before releasing admission.
3. Add saved Playwright scenarios for visible connection/progress/Stop/error and stale endpoint suppression, through the isolated app.
4. Verify orphan watchdog/OS-close lifecycle and transport/provider constraints; continue the complete GIT-REMOTE.md backlog.

## Documentation consulted before implementation

- [git2 timeout options](https://docs.rs/git2/latest/git2/opts/index.html) and installed git2 0.21.0 opts.rs safety notes.
- [git2 Remote::stop](https://docs.rs/git2/latest/git2/struct.Remote.html#method.stop).
- [Tokio spawn_blocking](https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html).
- [Rust Child lifecycle](https://doc.rust-lang.org/std/process/struct.Child.html#method.kill).
- [Windows CommandExt](https://doc.rust-lang.org/std/os/windows/process/trait.CommandExt.html#tymethod.creation_flags).

No dependency install or generator needed for this module. Existing AppManifest commands generate advertisement/cancel permissions. Checks launched directly with Cargo through the Bun launcher; no shell or browser-use.

## Native remote lifecycle accepted — 2026-09-30

- Previous turn was progress: process-based timeout/cancel and standalone checks. Observed the original native build PID35160 until successful exit0 (5m49s); did not restart it. Artifact artifacts/native-remote-ui-probe/insomnium-remote-probe.exe uses isolated checkout identity.
- Added reusable tests/ui/git-remote-lifecycle.js and Bun alias test:ui:git-remote. Prettier/Svelte check passed with 0 errors / 0 warnings. No application source changes this turn.
- Saved Playwright scenario passed on the actual Tauri executable: advertisement result, no extra WebView page, existing Git dialog reload while network is stalled, prompt native cancel, pre-cancel prevents network admission, real timeout at 30021ms, unchanged local HEAD/resources. Probe exited0.
- Evidence: artifacts/playwright/git-remote-lifecycle-1790769998943/{result.json,acceptance.json}. Uses Bun loopback synthetic advertisement/stalled endpoint; fixture idleTimeout disabled so native timeout wins.
- Scope: native IPC and existing UI responsiveness, not remote settings/Stop controls (not implemented), real providers, TLS/proxy/redirect credentials, parent-crash watchdog or OS-close lifecycle. No production package updated.
- Inspected beginWorkspaceWork/createWorkspaceWorkScope: client integration must connect AbortSignal to native cancel and keep work registered until original advertisement settles. A cancelled/stale endpoint result must never apply to another binding or collection.
- Next implement settings/client integration, legacy URL normalization/provider lifecycle and saved UI connection/Stop/error scenarios; then continue fetch/advance-ref journal/pull/merge/clone/push and all remaining parity. No browser-use; redesigned UX/shared input phase remains deferred.
- Official references used for scenario: https://bun.sh/docs/runtime/http/server ; https://playwright.dev/docs/api/class-page#page-evaluate . Direct command: bun tests/ui/git-remote-lifecycle.js.

## Remote client/workspace admission — 2026-09-30

- Previous goal turn was progress: native lifecycle Playwright acceptance completed. Added src/lib/git-remote-client.js and exported advertiseGitRemote workspace wrapper.
- Client snapshots input before submission, allocates UUID, attaches AbortSignal to native cancel once, validates returned endpoint/branch data and refuses aborted/stale results. Cancel acknowledgement does not resolve the original advertisement promise.
- Workspace wrapper registers beginWorkspaceWork, forwards external cancellation, verifies original data/active collection/binding and current input fingerprint before returning, and finishes only after the original call settles. Controls still need to call this wrapper; no remote settings/Stop UI exists yet.
- Inline Bun probes: 10 client assertions and 6 actual exported-wrapper assertions passed with mocked native/workspace boundaries. Covers cancellation while pending, immutable request input, pre-abort, endpoint/duplicate response refusal, stale settings and deferred finish. Evidence artifacts/git-remote-client-check/{probe.json,workspace-probe.json}.
- Prettier, Svelte sync/check (0 errors/0 warnings), Vite build passed; state.json records commands/results. Nonfatal >500kB chunk warning remains. No new test script/dependency or native source change. Existing isolated executable predates this frontend wrapper; no claim of mounted UI acceptance.
- Official docs read before implementation: https://v2.tauri.app/develop/calling-rust/ ; https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal .
- Next implement remote settings/connection/Stop controls in existing Git layout with URL input normalization and local settings persistence, then saved Playwright stale-result/Stop/reload cases. Provider refresh and full remote workflow backlog remain in scope.

## Remote settings native UI accepted — 2026-09-30

- Previous goal turn was progress: settings/read/Stop UI and checks completed, isolated build started. Polled original PID30728 until exit0; build took about6m16s. Artifact artifacts/native-remote-settings-ui-probe/insomnium-remote-settings-probe.exe, isolated checkout identity.
- Extended the same saved tests/ui/git-remote-settings.js with wrong-password error preservation and dialog-close cancellation, including server-side connection abort observation. Prettier/Svelte check passed (0 errors/0 warnings).
- Saved Playwright scenario passed8 named checks on the actual native app: local settings save, Basic-auth branch discovery, settings/credentials reload, auth error keeps draft and persisted settings, closing dialog aborts native connection/reopens saved settings, Stop, changed-endpoint cancellation/cleared result, unchanged persisted resources/HEAD after unsaved edits.
- Evidence: artifacts/playwright/git-remote-settings-1790770895847/result.json and acceptance.json. App PID22408 exited0. No app source changes this turn and no active build remains from this milestone.
- Limits: loopback synthetic advertisement, not actual provider login/refresh, TLS/proxy/redirect credentials, filesystem save-failure, checkout-drain/OS-close/crash or full visual parity. Existing native lifecycle timeout evidence remains separate.
- Next implement fetch with scoped remote tracking refs and captured endpoint/settings identity, then versioned advance-ref journal before pull/merge. Continue provider token lifecycle, clone/push/remaining branch modes and full parity. Remote settings alone is not Git sync completion. No browser-use; redesigned UX/shared inputs remain deferred.
