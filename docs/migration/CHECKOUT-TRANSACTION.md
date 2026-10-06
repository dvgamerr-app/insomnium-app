# Git checkout transaction and recovery

Updated: 2026-09-29  
Status: **partially implemented** — saveData queue barrier implemented and checked; tracked-run coordination is implemented for shutdown; mutation/writer guards and native journal recovery reader are implemented; checkout producer, frontend coordination and runtime acceptance remain incomplete.

## Evidence and decision

Current storage.rs serializes load/save through StorageState and writes workspace-v1.json atomically. Git commands use a separate GitState mutex. persistence.js serializes saves but captures their JSON snapshots before queue execution. workspace.svelte.js can mutate resources and call persist while earlier calls await IPC. Therefore native ref locks alone cannot protect a checkout from a queued old workspace snapshot.

Use a native journaled checkout plus a frontend persistence barrier. Do not expose a raw HEAD-switch command as a complete checkout operation. Existing prepareSwitch is only a preview; recompute/validate its candidate at submission. Legacy createNewGitBranchAction invokes checkout, so creating a ref alone does not complete the create-and-switch workflow.

Sources reviewed:

- [AtomicWriteFile](https://docs.rs/atomic-write-file/latest/atomic_write_file/struct.AtomicWriteFile.html): a single file becomes visible when committed; this does not make Git refs and workspace data one atomic operation.
- [git2 Transaction](https://docs.rs/git2/latest/git2/struct.Transaction.html): refs can be locked, but multiple updates are not an atomic transaction.
- [Git checkout](https://git-scm.com/docs/git-checkout): preserve non-conflicting local changes; reject conflicting replacement.
- Local: src-tauri/src/storage.rs, src-tauri/src/git.rs, src/lib/persistence.js, src/lib/workspace.svelte.js, src/lib/git-client.js, src/lib/git-reconcile.js.

## Required invariants

1. Only the requested collection's accepted resource changes may be applied. Preserve private/local-only and foreign resources, history and settings. Validate topology and repair request/tab/environment selections when a target tree removes resources.
2. Use exact source and target names/OIDs. Under locks, recheck symbolic HEAD and both direct refs. Never switch using an unchecked moving name.
3. Keep an immutable before/after workspace pair in a versioned local journal before changing HEAD.
4. While a journal is pending, ordinary saves and Git mutations cannot proceed. Recovery must finish or report a preserved ambiguity before reopening editing.
5. Every caller needing both native locks acquires GitState then StorageState, including startup recovery. No path may acquire them in reverse.
6. Native checkout success means workspace file and HEAD agree and journal cleanup succeeded. On an uncertain IPC outcome, reload/recover instead of blindly retrying.
7. Preview data is not authority. Recheck live state immediately before submission and compare expected persisted workspace inside the storage lock.
8. Do not claim power-loss guarantees beyond the actual filesystem/library behavior. Process-interruption tests and disk/ACL tests are separate acceptance items.

## Frontend persistence barrier

Implement in persistence.js and coordinate through workspace.svelte.js:

1. Mark a checkout transition active before the first await. Block new user mutations and new sends/runner/stream/OAuth work; settle existing asynchronous writers before capturing state. A modal alone is insufficient.
2. Drain the current save queue. Preserve and surface failures; do not silently treat a rejected save as a persisted baseline.
3. Save the exact current workspace and capture its detached persisted value.
4. Recompute switch preparation from current resources and pinned refs. Capture a full workspace candidate with the planner's resource array and valid selections.
5. Enqueue the native transition as an exclusive queue operation. Introduce a generation/token check for queued snapshots so pre-transition saves cannot execute after checkout.
6. Before native invocation, ensure the captured live workspace still matches. If background completion changed it, abort before mutation and reprepare.
7. After confirmed success, apply returned authoritative workspace synchronously before releasing the queue barrier. On uncertainty/failure after submission, keep editing blocked and invoke recovery/load.
8. Advance the generation after applying recovered/committed state; reject stale pending snapshots. Release the barrier only when native state and live state are reconciled.
9. Retain user's unsubmitted local state in memory/recovery evidence if unexpected changes occur; never overwrite it merely because a previous preview exists.

The exact public API is to be implemented with these guarantees, not added as unused helper functions. Browser preview has no native Git checkout.

## Tracked writer drain implementation — 2026-09-29

Implemented createRunDrain and withWorkspaceRunsPaused, currently used by shutdown. The run gate reserves before awaiting, rejects overlapping drains, covers cancellation and completions with one deadline, and holds reservation through the supplied operation. On timeout it refuses the operation permanently even if old promises settle later. It resumes admission on failure so a failed close can be retried; it is not the recovery lock for an uncertain native checkout.

| Writer                                       | Current coordination                                                                          | Required follow-up                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| HTTP, WebSocket/SSE, gRPC connection         | Existing controllers/completions plus new start guard                                         | Native interruption acceptance                                                  |
| Payload/gRPC messages, proto refresh         | Existing completion tracking plus new start guard                                             | Native completion/cancel acceptance                                             |
| OAuth fetch/adopt and Runner/dependent sends | Existing root completion tracking plus new start guard                                        | Verify all descendant cleanup in native flow                                    |
| API Design generation/file reading           | Registered worker/file tasks with abort/stale-result guards; waits accepted save              | Mounted/native acceptance and final mutation reservation                        |
| Git setup/commit                             | Registered setup/dialog operations; abort checks before next submission; awaits submitted IPC | Native acceptance and final mutation reservation                                |
| Direct UI/resource/settings/import edits     | Central entry guards, guarded page actions/settings and inert shell/dialog during drain       | Full async writer audit, mounted acceptance and durable recovery admission lock |
| Queued saveData                              | Separate persistence barrier already implemented                                              | Drain/save baseline and apply authoritative result under coordinated checkout   |

Evidence: artifacts/run-drain-check.19 helper assertions;14 checks use the actual Svelte-compiled workspace source with mocked dependencies (not native runtime). Compiler/build passed. Mutable pending-array issue found by the first probe was corrected by detaching the initial array. Probe generation of fresh rejected promises was a probe defect, corrected before acceptance.

Official documentation consulted before implementation:

- [Promise.allSettled](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)
- [AbortController.abort](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort)
- [Svelte $state](https://svelte.dev/docs/svelte/$state)

Commands executed directly with Bun, shell:false/windowsHide:true: bun x --bun prettier --write src/lib/run-drain.js src/lib/workspace.svelte.js; bun x --bun svelte-kit sync; bun x --bun svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings; bun x --bun vite build. Inline probes used bun -e, with no saved test scripts. No generator is applicable to this existing-module lifecycle change.

## Component writer registration — 2026-09-29

beginWorkspaceWork registers a component operation before its first await, exposes AbortSignal/cancel and idempotent finish. The drain waits for finish even after abort, including uncancellable file reads and native Git IPC. Callers check cancellation before applying data or submitting the next native mutation. No task is considered complete merely because its signal was aborted.

API Design worker/file handling and Git setup/dialog operations now use this API. These are implemented boundaries; this does not cover direct resource/settings bindings or every remaining component writer. A future checkout must hold the separate mutation/persistence recovery guard after uncertain native outcomes.

Verification: 46 inline behavior checks plus12 prior Git setup regression checks; Svelte check0/0 and build0. API Design/Git dialog checks compile actual script bodies with Svelte and use mock browser/native dependencies; they do not prove mounted UI/native behavior. Evidence artifacts/component-drain-check.

Official docs reviewed:

- [Worker.terminate](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate)
- [AbortSignal.throwIfAborted](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted)
- [Svelte lifecycle hooks](https://svelte.dev/docs/svelte/lifecycle-hooks)

Commands: bun x --bun prettier --write src/lib/workspace.svelte.js src/lib/git-setup.js src/lib/components/GitPanel.svelte src/lib/components/ApiDesign.svelte; bun x --bun svelte-kit sync; bun x --bun svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings; bun x --bun vite build. Inline verification uses bun -e. All processes launched directly without shell; no new subsystem generator applies.

## Live mutation entry guards — 2026-09-29

canEditWorkspace currently rejects edits while runDrain is active. Twenty existing resource/selection/environment/proto/OAuth/Runner entry points plus updateSettings use it. Page direct environment/import/tab operations also check it. Preferences no longer bind directly to workspace state; explicit change handlers pass the current control value to the guarded setter.

The page shell and modal each have inert during drain; keyboard shortcuts check draining explicitly. This preserves layout. It still requires mounted native acceptance for keyboard/focus/dialog interactions and preferences persistence.

The guard is not yet a durable recovery state. A native transition coordinator must keep mutation admission closed when the persistence queue is in recovery, even after a run-drain callback throws. Do not expose checkout until this is integrated.

Historical asynchronous review targets (registered in the following checkpoint; native acceptance remains):

- RequestEditor body upload begins an uncancellable read before guarded onchange; register before reading and reject stale results after drain.
- ProtoManager file selection populates pending component state after reads; register/invalidate reads and review pending target after workspace generation changes.
- GraphqlEditor schema import updates a session cache after reading; cancel/invalidate it across resource replacement.
- CookieManager change and LegacyCookieImport invoke native cookie storage; await submitted writes during close/transition.
- Page import picker/file review and other editor formatting/preview completions need review for captured old resource targets.

Evidence: artifacts/mutation-guard-check;28 workspace assertions,11 API Design and9 Git panel script regressions; compiler/build passed. Vite non-fatal chunk-size warning remains. No mounted/native acceptance claimed.

Official docs reviewed before UI changes:

- [Svelte bindings](https://svelte.dev/docs/svelte/bind): existing event listeners run before bound values update; explicit change handlers now read the control value.
- [HTML inert](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert): modal dialogs require their own inert attribute.

Commands: bun x --bun prettier --write src/lib/workspace.svelte.js src/routes/+page.svelte; bun x --bun svelte-kit sync; bun x --bun svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings; bun x --bun vite build. Inline probes via bun -e; direct hidden-window process execution, no shell or new test scripts.

## File, cookie and import work scopes — 2026-09-29

createWorkspaceWorkScope is implemented on top of registered component work. Its handles stay pending until finish(), and current() requires the same workspace object/active collection, a live component scope and a non-aborted signal. Dispose/cancel cannot falsely declare an uncancellable file read or submitted native IPC finished.

Registered callers now include RequestEditor body uploads/XML formatting, KeyValueEditor multipart uploads, WebSocketMessageEditor file payloads, ProtoManager file selection, GraphqlEditor schema imports, page import picker/file reads, CookieManager list/change and LegacyCookieImport preview/restore. API Design and Git setup/dialog already have registered lifecycles.

Proto apply rejects a pending review from a replaced workspace/request. WebSocket file apply additionally rejects a payload that changed mode/value or was replaced while reading. XML abort terminates its worker. Native cookie writes cannot be undone by frontend abort; the drain awaits their real completion and suppresses stale follow-up/UI results.

Source audit of TemplatePreview render completion, ResponsePane filter completion and CodeEditor dynamic import/keymap completion found display/editor-local updates with cleanup checks, not resource/persistence writes in those inspected callbacks. Mounted and native lifecycle validation is still required, including actual picker and native cookie storage.

Next implementation boundary: connect run/mutation admission to persistence transition/recovery state, retaining the edit block after uncertain native outcomes. Then journaled native checkout/load recovery and synchronous authoritative workspace apply. Existing run-drain release alone is not a recovery lock.

Evidence: artifacts/remaining-writers-check,42 inline checks (11 scope,10 cookie,21 file/XML), Svelte0/0 and build0. Actual source handlers/scripts executed with mocked external boundaries; no native runtime claim. No test scripts saved.

Documentation consulted before implementation:

- [Blob.arrayBuffer](https://developer.mozilla.org/en-US/docs/Web/API/Blob/arrayBuffer)
- [AbortSignal.throwIfAborted](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted)
- [Svelte lifecycle hooks](https://svelte.dev/docs/svelte/lifecycle-hooks)

Commands: bun x --bun prettier --write for the nine edited JS/Svelte files; bun x --bun svelte-kit sync; bun x --bun svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings; bun x --bun vite build. Exact formatter arguments and results are in artifacts/remaining-writers-check/state.json. Inline probes use bun -e; all child processes are direct, shell:false/windowsHide:true.

## Frontend recovery admission — 2026-09-29

Implemented a read-only phase subscription on the real persistence queue/module. Workspace uses its reactive copy for UI and reads queue.phase directly for canEditWorkspace, run admission and persist. All non-idle phases block new edits/runs/saves. Persist checks before trimming/normalizing state.

When a transition callback throws, the queue stays in recovery and the block survives withWorkspaceRunsPaused finally releasing its run gate. Repeated failed recoveries remain blocked. A successful recovery applies its callback work before publishing idle. Only the existing exclusive/recover operations can change phase; no public unlock setter was added. Observer failure does not alter transaction outcome.

Page shell/dialog inert and keyboard guard now include the persistence phase. API Design direct create checks canEditWorkspace. Recovery commands, authoritative workspace application and a user-facing recovery flow still need native integration; this phase subscription must not be described as durable startup recovery.

Evidence artifacts/recovery-admission-check:17 actual queue/persistence + compiled-workspace checks,11 observer checks and27 prior barrier regressions; Svelte0/0/build0. Mock storage/dependencies, no native journal acceptance.

Official sources reviewed:

- [Svelte store contract](https://svelte.dev/docs/svelte/stores)
- [Promise.then](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then)

Commands: bun x --bun prettier --write src/lib/persistence-queue.js src/lib/persistence.js src/lib/workspace.svelte.js src/routes/+page.svelte src/lib/components/ApiDesign.svelte; bun x --bun svelte-kit sync; bun x --bun svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings; bun x --bun vite build. Inline probes via bun -e; direct hidden-window launches only.

## Native storage foundation — 2026-09-29

Implemented shared read_workspace_file, write_workspace_file and Session load/save/require_loaded/ensure_backup. Existing load_workspace/save_workspace commands use them. write_workspace_file is a low-level validated atomic write; ordinary callers must use Session.save, while future recovery will use the low-level path under both locks with a validated journal.

ensure_no_pending_transition checks the fixed git-transition-v1.json with symlink_metadata. Any existing entry or inspection error refuses ordinary operations; it does not parse, follow, remove or repair the journal. Session.load currently refuses pending state rather than setting loaded. Git init/commit/create_branch call the same guard while holding GitState; read-only info/read/history do not mutate and remain available.

This establishes write exclusion for a future journal producer, not a checkout implementation. When recovery is added, load must first run it under GitState then StorageState and only then acknowledge the loaded session. Do not clear a journal merely to make load succeed.

Validation: Cargo fmt/check/clippy passed.24 native assertions execute the actual storage source (Tauri command wrappers excluded) compiled via rustc stdin; isolated fixtures only. Covers first/repeated backup, legacy raw bytes, malformed workspace, pre-load save, duplicate IDs, pending file/directory/junction, and backup failure/retry. Source hash/evidence in artifacts/native-storage-check. The junction target sentinel remained unchanged. This does not cover full native IPC, process-crash/disk-full/power-loss or cross-process races.

Official sources:

- [AtomicWriteFile 0.3.1](https://docs.rs/atomic-write-file/0.3.1/atomic_write_file/struct.AtomicWriteFile.html)
- [Rust symlink_metadata](https://doc.rust-lang.org/std/fs/fn.symlink_metadata.html)

Commands: cargo fmt --manifest-path src-tauri/Cargo.toml; cargo check --manifest-path src-tauri/Cargo.toml; cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings. Native probe: rustc --edition=2021 --crate-name storage_guard_probe - -L dependency=src-tauri/target/release/deps --extern serde_json=<existing rlib> --extern atomic_write_file=<existing rlib> -C panic=abort -o artifacts/native-storage-check/storage-probe.exe, with actual source and inline assertions on stdin. Launch probe with its isolated fixture directory. Bun orchestrated all direct hidden-window processes; no saved test script/source or shell invocation.

## Native transition protocol

Target API: one journaled checkout command, plus recovery integrated with workspace loading. Initial direct committed local-branch support must not remove unborn, detached or remote cases from migration scope.

Under GitState then StorageState:

1. Reject another pending journal; validate input IDs, branch names, OIDs, author and before/after workspace schemas.
2. Require a successfully loaded storage session. Read the actual workspace file and compare its parsed value to expectedBefore (handle the supported legacy wrapper consistently).
3. Open only the managed repository. Lock HEAD and sorted source/target refs; require clean repository operation state and exact expected branch/OIDs.
4. Validate the source/target trees and candidate ownership/topology contract. Preserve unrelated repository objects; virtual resource checkout must not materialize/delete unrelated physical files.
5. Retain the normal previous-workspace backup before transition work.
6. Atomically write git-transition-v1.json with schemaVersion, operationId, repositoryId, workspaceId, source/target names and OIDs, beforeWorkspace, afterWorkspace. The journal stays local in app data and is never exported or committed.
7. Change only symbolic HEAD to the target ref through the locked transaction.
8. Atomically write afterWorkspace to workspace-v1.json while retaining journal and storage lock.
9. Remove the journal only after both states match. If cleanup fails, report recovery required and block further writes.
10. Return the authoritative workspace and resulting branch/OID, not only a success boolean.

Any exception after journal creation leaves the journal available. Do not infer rollback from an exception: inspect actual HEAD and workspace. No force-reset or overwriting of unexpected external changes.

## Recovery decision table

On startup/load, inspect journal under both locks, then validate its format, IDs, refs and workspace snapshots. Lock the recorded refs before inspecting or changing them. Compare the actual workspace to the journal's parsed before/after values.

| Actual HEAD and workspace                                                               | Recovery action                                                             |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Source branch/source OID + before                                                       | Transition did not apply; retain before and clear journal after validation  |
| Target branch/target OID + before                                                       | HEAD applied; write recorded after, verify, then clear journal              |
| Target branch/target OID + after                                                        | Transition applied; verify and clear journal                                |
| Source + after                                                                          | Unexpected mixed state; preserve journal/files and report recovery required |
| Neither recorded workspace, unexpected HEAD/ref movement, missing repo, invalid journal | Preserve all data and stop automatic recovery; expose actionable error      |

If before and after workspace values are identical (e.g. create-and-switch at the same commit), the HEAD distinction still determines whether the transition applied. A separate phase label is diagnostic only; actual files/refs are authoritative.

Do not drop a journal simply because it is old or a previous process no longer exists. A journal with invalid contents must not cause arbitrary path access, resource application or deletion.

## Create-and-switch and branch deletion

For create-and-switch, use the guarded create primitive and then the journaled switch. If interruption occurs between them, the new branch may exist while the original stays active; recognize this state on retry without overwriting an existing unrelated branch. A stable operation ID and exact created tip are needed to distinguish a resumed operation from a pre-existing name. Creation on unborn HEAD needs explicit semantics and acceptance.

Deletion must reject the active branch, require the displayed expected target OID, and preserve unexpected new commits. Do not add force-delete as an implicit fallback. Review legacy handling and expose unmerged branch behavior explicitly.

## Implementation order and acceptance

- [x] Implement persistence generation/barrier and route ordinary saveData through it (27 inline assertions; native acceptance pending).
- [ ] Coordinate all asynchronous workspace writers and live mutation guards with transition callbacks.
- [x] Share storage read/write logic for checkout while preserving load validation and first-save backup behavior (Cargo checks and24 standalone native assertions; Tauri IPC pending).
- [ ] Implement native journal + guarded HEAD transition + ordinary-write pending-journal guard.
- [ ] Integrate recovery into load/startup under the defined lock order.
- [ ] Connect workspace checkout and Svelte branch UI, including create-and-switch and conflict display.
- [ ] Check stale source/target, changed live workspace, private/foreign preservation and request-selection repair.
- [ ] Exercise interruption before journal, after journal, after HEAD, after workspace, before/after cleanup.
- [ ] Confirm pre-transition queued saves cannot overwrite a completed/recovered checkout.
- [ ] Check uncertain IPC, repeated retry, before==after, external ref/workspace edits and malformed journal.
- [ ] Test filesystem failure/permissions separately; keep failed evidence intact.
- [ ] Native UI branch switch/reload/create-and-switch/delete acceptance; branch creation/tip metadata commands also still need runtime coverage.

Do not mark this specification or existing preview as completed checkout parity.

## Implemented recovery reader — 2026-09-29

git_journal.rs now provides recovery invoked by load_workspace under GitState then StorageState. It validates the versioned record, snapshots, binding, exact source/target refs and committed Workspace path identity. The recovery table above is implemented for existing direct committed local branches. Ordinary save/Git write guards remain in force until journal cleanup succeeds.

The current reader accepts only unchanged non-resource workspace fields. The checkout producer must settle the selection-repair contract before exposing switching: preserve history/settings and local metadata, repair selections in authoritative live state, and coordinate any resulting save under the persistence barrier. Do not treat this preliminary restriction as completed selection parity. Full managed tree content validation also remains a producer integration requirement.

33 standalone native fixture checks passed, including all recovery table branches, before==after, retained backup/workspace bytes, moved refs/detached HEAD, invalid/unknown journal fields, private/foreign/metadata/history/binding changes, orphan refusal, missing workspace, journal directory/junction, existing ref lock and wrong committed Workspace identity. Source hash and terminal results: artifacts/native-journal-check. No Tauri IPC, process-kill or power-loss claim.

Official documentation consulted before implementation:

- https://docs.rs/git2/latest/git2/struct.Transaction.html
- https://docs.rs/atomic-write-file/latest/atomic_write_file/struct.AtomicWriteFile.html
- https://serde.rs/container-attrs.html
- https://doc.rust-lang.org/std/fs/struct.OpenOptions.html
- https://doc.rust-lang.org/std/os/windows/fs/trait.OpenOptionsExt.html

Commands: cargo fmt --manifest-path src-tauri/Cargo.toml; cargo check --manifest-path src-tauri/Cargo.toml; cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings. Probe compiled actual storage prefix, managed Git helpers and journal module via rustc --edition=2021 --crate-name journal_recovery_probe - with existing release serde/serde_json/atomic_write_file/git2 rlibs and native git2/ssh2/z search paths, -C panic=abort, output artifacts/native-journal-check/journal-probe.exe. Source and assertions supplied on stdin; no test source/script saved. Bun launched every process directly with shell:false/windowsHide:true. No generator applies to this existing native module integration.

Journal creation and guarded HEAD transition are still pending; do not mark checkout parity complete.

## Native checkout producer implemented — 2026-09-29

git_repository_checkout accepts input { journal, authorName, authorEmail }. Journal uses the documented camelCase v1 fields. It rejects pending state/unloaded session, compares persisted beforeWorkspace under StorageState, validates input/ownership, opens the managed repository, and locks/rechecks HEAD plus source/target refs. It serializes and bounds the journal before ensuring backup and atomically writing the journal.

After journal persistence it updates symbolic HEAD only. git2 Transaction.commit consumes the transaction; the implementation reacquires all refs through shared recovery and revalidates before workspace write/cleanup. Both app mutexes stay held. Unexpected movement is retained as an uncertain outcome. The result contains operationId, branch, headOid and workspace, and is returned only when it matches the requested operation/target/after snapshot.

Both paths call the existing bounded committed_resources reader, rejecting unsupported managed paths/blob types/size/encoding. The JavaScript reader/planner must still decode semantic contents and prove the candidate is the permitted three-way result; native pair guards alone do not establish that. Keep product branch switching unexposed until the coordinated caller and selection/topology contract are implemented.

Verification: Cargo fmt/check/clippy passed. 55 actual-source standalone native checks include recovery regressions and producer success/refusal cases, physical worktree/index preservation, exact first backup, duplicate/stale request refusal and backup retry. Windows read-sharing handle allowed backup but denied atomic workspace replacement after HEAD; journal remained, ordinary save was blocked, and recovery completed after handle release. This is a real sharing violation, not a process-kill/disk-full or Tauri IPC test. Evidence artifacts/native-checkout-check.

Docs consulted: [git2 Transaction](https://docs.rs/git2/latest/git2/struct.Transaction.html), [AtomicWriteFile 0.3.1](https://docs.rs/atomic-write-file/0.3.1/atomic_write_file/struct.AtomicWriteFile.html), [Tauri Rust commands](https://v2.tauri.app/develop/calling-rust/). Existing subsystem extension; no generator applies. Command registration uses the existing tauri-build app manifest and its generated permission.

Commands: cargo fmt --manifest-path src-tauri/Cargo.toml; cargo check --manifest-path src-tauri/Cargo.toml; cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings. Inline rustc --edition=2021 --crate-name journal_checkout_probe - compiles actual storage, Git read/path helpers and journal module with existing release dependencies (-C panic=abort); assertions arrive via stdin. Bun orchestrates direct hidden-window launches. No saved test scripts or production package rebuild.

## Coordinated frontend entry points and repaired selections — 2026-09-29

workspace.checkoutGit calls createGitCheckout through the existing run drain. Do not wrap it in beginWorkspaceWork: checkout must wait for other work, never for itself. It persists the full exact baseline, opens a fresh Git session, prepares the pinned three-way plan, validates topology and detached candidate, then enters the exclusive persistence callback. Native result identity/branch/OID/full workspace are checked before synchronous authoritative apply. Object-key ordering differences from Rust JSON do not count as data changes.

recoverGitCheckout uses run drain plus queue.recover and loadData; it only unlocks after apply succeeds. If live data unexpectedly differs from the recorded baseline, it retains a detached copy and refuses automatic replacement. retainedGitCheckoutWorkspace exposes a detached copy for the pending recovery/export UI; the UI must provide an explicit resolution path without losing those edits.

The previous envelope-equality restriction is superseded: native validates the exact permitted repair derived from before selections and after resources. Invalid active request/environment becomes empty; invalid tabs are removed in existing order, valid foreign tabs stay. Active workspace, history/settings and all other top-level data remain identical. Local-only resource metadata remains preserved; selectedEnvironmentFor already rejects stale environment IDs in metadata. validateData no longer deletes history merely because its request is absent on a branch.

Both frontend planner/candidate and native journal now validate navigable request/environment parent rules and cycles. Native still checks managed tree paths/bounds rather than parsing YAML semantic equality; the actual frontend coordinator invokes the existing strict decoded three-way planner before submission. No product checkout parity claim until mounted/native verification and remaining branch modes are complete.

Evidence: artifacts/checkout-coordinator-check (31 real-module coordinator checks +7 Svelte-compiled workspace integration checks, mocked native boundaries; Svelte0/0/build0); artifacts/native-selection-check (Cargo0 and61 native fixture assertions). All final processes finished. No Tauri UI/IPC or production package rebuild this milestone.

Docs consulted before implementation: [Svelte state and snapshot](https://svelte.dev/docs/svelte/$state), [structuredClone](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone), alongside the existing native transaction and persistence protocol references.

Commands: bun x --bun prettier --write src/lib/git-workspace.js src/lib/git-checkout.js src/lib/git-reconcile.js src/lib/model.js src/lib/workspace.svelte.js; bun x --bun svelte-kit sync; bun x --bun svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings; bun x --bun vite build; cargo fmt/check/clippy with --manifest-path src-tauri/Cargo.toml (clippy -- -D warnings). Inline Bun probes and rustc stdin source probes use direct shell:false/windowsHide:true launches; no saved test scripts. No generator applies to the existing subsystem coordination.

## Branch switch and recovery UI — 2026-09-29

GitPanel exposes existing direct committed local branches and invokes checkoutGit without beginWorkspaceWork/run wrapping. Its own busy state prevents duplicates; after success it uses ordinary registered load to refresh staging/history. UI uses the existing Insomnium dialog/form/button styling.

GitRecovery is a separate modal outside inert app regions. Page closes the previous modal using untrack, avoiding reactive dependency loops from closeModal's counters. Recovery stays present through both recovery/recovering phases. Retained edits are exported as the entire local workspace JSON, not portable collection export. save cancellation/write failure cannot acknowledge the copy. The user then reviews replacement; the exact saved snapshot must still equal retained and live data in coordinator checks both before and after load.

Evidence: artifacts/checkout-ui-check, Svelte0/0/build0,34 coordinator assertions and10 compiled component-script assertions. Mocked boundaries only. Native probe build is being tracked at artifacts/native-checkout-ui-probe/build-state.json; inspect live PID before continuing. Full UI/native acceptance is pending.

Official docs: [HTML inert](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert), [Svelte lifecycle](https://svelte.dev/docs/svelte/lifecycle-hooks), [Tauri dialog](https://v2.tauri.app/plugin/dialog/), [Tauri filesystem](https://v2.tauri.app/plugin/file-system/). Existing installed plugins reused; no init required.

Commands: bun x --bun prettier --write src/lib/components/GitPanel.svelte src/lib/components/GitRecovery.svelte src/lib/git-checkout.js src/lib/workspace.svelte.js src/routes/+page.svelte; bun x --bun svelte-kit sync; bun x --bun svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings; bun x --bun vite build. Native build: bun x --bun tauri build --no-bundle --config with identifier app.insomnium.probe.checkout20260929, productName Insomnium Checkout Probe, build.beforeBuildCommand null. Frontend built first; native build supervisor records PID and terminal result. All launches direct shell:false/windowsHide:true.

## Actual native checkout acceptance — 2026-09-29

Isolated identity app.insomnium.probe.checkout20260929 built successfully in5m41s. Native UI and IPC verified existing-branch switching, resource addition/deletion, selection repair, exact protected resources, nonconflicting local edits, history retention and reload. Real UI conflict refused without data loss. Real native ref-lock failure opened interactive recovery while the application remained inert; Retry after removal of the owned fixture lock restored editing and the unchanged source branch.

16 assertions derived from recorded artifacts passed; screenshots visually inspected. Evidence artifacts/native-checkout-ui-probe/acceptance.json, first-switch.json, reload-target.json, conflict.json, native-error-recovery-ui.json, recovered-native-error.json, switch-target.png and recovery-dialog.png. Probe explicitly destroyed and app-state finished0; this is not an OS-close lifecycle test.

The native run exposed dialog conflict text being cleared by run(load). Fixed source preserves that text after refresh;11 compiled UI handler assertions and Svelte/build passed. Native recheck build is tracked at artifacts/native-checkout-ui-recheck/build-state.json and must be observed before a new launch.

Fault-injection limits: replacing Tauri invoke failed silently because its property/global is read-only. No lost-reply claim. Recovery case was a real pre-journal ref lock, not post-HEAD crash. Existing standalone Rust sharing-violation checks remain separate evidence. Real retained-copy picker/review and process-interruption cases remain pending.

Fixture setup uses actual native init/commit/create-branch and save/load commands, with Git update-ref only inside the isolated probe repository to arrange the two known branch tips. No production app data/repository touched. First failed fixture setup preserved its isolated repository. No saved test scripts.

## Native conflict-message recheck accepted — 2026-09-29

- Previous turn was progress: reconciled the durable Thai handoff and confirmed the old build had finished successfully.
- Launched that verified recheck executable under isolated identity app.insomnium.probe.checkout20260929. Actual UI edited req_delete, selected target and attempted checkout.
- Conflict text remained visible inside Git dialog after staging reload; source HEAD remained main and the conflicting local URL persisted. Fresh-document reload retained the edit. Screenshot visually inspected: readable error and controls without overlap.
- Five assertions including clean process exit recorded in artifacts/native-checkout-ui-recheck/conflict-recheck.json; screenshot conflict-recheck.png. Probe PID12072 exited0 at2026-09-29T13:01:24.333Z by explicit window destroy, not OS-close lifecycle acceptance.
- No application source changes or rebuild this turn. Fixture now retains URL https://example.invalid/recheck-conflict on req_delete in main. Restore exact fixture baseline (including modified metadata) within the owned probe before a nonconflicting checkout failure probe; do not alter production data.
- Next: actual post-HEAD workspace-write failure/recovery through native IPC, retained-copy OS picker/review, process interruption/stale locks and OS-close lifecycle. Native standalone post-HEAD sharing-failure coverage is not equivalent to IPC acceptance. Create-and-switch/delete/remotes and full migration remain incomplete.

## Native post-HEAD workspace-write failure accepted — 2026-09-29

- Previous turn was progress: the native conflict-message fix was accepted and durable handoff updated.
- Used the existing verified isolated recheck executable, real Git client/three-way planner and direct Tauri checkout/load/save IPC. Restored only owned fixture req_delete to its exact baseline before preparing main→target.
- Bun FFI CreateFileW opened the probe workspace with GENERIC_READ and FILE_SHARE_READ, denying replacement. A separate owned sharing fixture first verified the handle's write denial; all handles closed in finally.
- Actual checkout changed HEAD to target but atomic workspace replacement failed. The before workspace and exact native-produced journal remained. Ordinary save was blocked; load recovery also failed while the handle was held and retained the journal.
- After CloseHandle, native load applied the exact after workspace and removed the journal. Deleted-request history, nonconflicting local edit and target resource changes were retained; ordinary save worked again and a fresh document displayed target data.
  -18 assertions passed in artifacts/native-checkout-ui-recheck/post-head-ipc.json. This exercises actual native commands and real planning, not the mounted frontend coordinator under failure. It does not prove crash/lost reply, retained-copy OS picker/review or OS-close lifecycle. No application source changes, saved test scripts or rebuild.
- Fixture now rests on target, recovered workspace persisted, no pending journal. Reuse fixture.json for refs but inspect current state before the next scenario.
- Docs consulted before the inline Bun probe: https://bun.sh/docs/runtime/ffi ; https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew ; https://learn.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-closehandle . Bun -e launched directly through node_repl execFile(shell:false,windowsHide:true); FFI is probe-only, no production dependency added.
- Next: recovery on fresh process/startup after a pending transition, mounted recovery/retained-copy OS picker acceptance, process interruption/stale locks and OS-close lifecycle; create-and-switch/delete/remotes and wider parity still pending.

## Fresh-process startup recovery accepted — 2026-09-29

- Previous turn was progress: real post-HEAD write-failure/recovery IPC passed18 assertions.
- Reused verified isolated executable and real client/planner to prepare target→main. Held the workspace through the documented Bun FFI CreateFileW sharing fixture, producing a real native journal and changed HEAD while workspace replacement failed.
- Closed the first process by explicit window destroy while the sharing handle remained held. Verified terminal exit0 and journal still present, then released the handle and launched a new native process.
- Before any manual load/recovery IPC in the second process, observed startup had removed the pending journal, persisted the exact journal afterWorkspace and displayed main resources. Local edit, deleted-request history and private/foreign resources survived.
  -18 scenario assertions recorded in artifacts/native-checkout-ui-recheck/startup-recovery.json, plus screenshot startup-recovery.png. Both process exits verified0. No new source changes, saved test scripts, dependencies or rebuild.
- Scope: fresh-process recovery from native-produced target+before state after a clean explicit exit. Not abrupt crash within a transaction, stale-lock handling, OS close lifecycle or mounted frontend failure coordination.
- Fixture now main, no pending journal; req_delete restored from source, req_keep retains local edit. Do not use earlier target-state notes as current fixture state.
- Next: mounted recovery/retained-copy OS picker acceptance, interruption/stale-lock and OS-close checks, create-and-switch/delete/remotes and remaining full feature parity. Full migration incomplete.

## Native branch creation retry evidence — 2026-09-30

- Prior completed milestone was progress: fresh-process startup recovery passed. Continued legacy create-and-switch review: createNewGitBranchAction calls checkout(newName), so creating a ref alone is not feature completion.
- GitCreateBranchInput now accepts optional operationId (ASCII alphanumeric/underscore/hyphen,1..100). Existing callers without it retain non-idempotent duplicate refusal.
- With an ID, native creation ensures a branch reflog and includes operation ID plus source ref in the creation message. Under existing HEAD/source/target locks, an existing exact target is acknowledged only when its direct tip matches expected and newest reflog records zero→expected with exact operation/source and author. Retry returns without updating refs/logs.
- Different ID/author, missing creation evidence, moved target, case mismatch and retained nonempty log without a ref refuse. HEAD/source revision guards remain. This is conservative evidence, not an atomic ref+receipt guarantee; missing/ambiguous reflog requires inspection, never overwrite.
- Cargo fmt/check/clippy passed.14 actual-source Rust fixture assertions passed via rustc stdin, including unchanged retry log/HEAD, unrelated same-tip branch refusal, invalid ID, legacy caller, missing log and moved target preservation. Evidence artifacts/git-create-retry-check/{state.json,probe-state.json}. No saved test scripts, UI changes, native package rebuild or IPC acceptance.
- Initial launcher syntax/session-binding errors occurred before source mutation; corrected. Compiler found git2 0.21 Reference.name returns Result<&str> rather than optional name; corrected source and inline probe, reran checks successfully.
- This does NOT globally reserve operation IDs or survive arbitrary external reflog deletion/recreation as proof of origin. Frontend must persist a scoped intent before submission (repository/binding/workspace, target, source branch/OID, author, operation ID), reuse it on retry and retain an acknowledged-created phase. Do not regenerate an ID or infer ownership from matching tip alone.
- Next implement durable frontend intent/coordinator and create-and-switch UI using journaled checkout. On recovery, inspect current HEAD/refs and intent before deciding whether creation or switching remains; expose ambiguous cases. Unborn/detached semantics, full workflow/native acceptance and remote/delete parity remain pending.
- Official docs consulted: https://git-scm.com/docs/git-checkout ; https://docs.rs/git2/latest/git2/struct.Transaction.html ; https://docs.rs/git2/latest/git2/struct.Repository.html#method.reference_ensure_log ; https://docs.rs/git2/latest/git2/struct.ReflogEntry.html . No generator/dependency needed. All commands through hidden node_repl→Bun launcher; Cargo invoked directly.
- Full migration remains incomplete; production and isolated probe executables predate this source change.

## Durable create-and-switch UI and owner UI-test policy — 2026-09-30

- Previous completed goal turn was progress: native creation retry evidence implemented and checked.
- Added git-create.js workflow with persisted prepared/submitted/created intent scoped to binding/workspace/repository/source tip/target/author/operation ID. One drain covers intent saves, ref creation and journaled checkout; checkoutPaused avoids nested drain and pins source/created target tips.
- Resumed submitted/created requests use native verifyOnly, which never creates an absent ref and can verify matching creation evidence after HEAD already switched. Missing/ambiguous evidence retains intent for inspection. UI exposes Create and switch / Continue branch creation / Forget pending creation; forgetting removes only local metadata and leaves refs intact.
- Pending intent disables other commit/switch buttons; portable import/export strips nativeCreateIntent. Unborn creation currently asks for a first commit; detached/unborn/full legacy branch behavior remains in scope.
- Frontend format/Svelte check/build and Cargo fmt/check/clippy passed.31 real-workflow assertions with mocked boundaries and18 actual-source native assertions passed (including verify-only absence and already-on-target). Evidence artifacts/git-create-ui-check and artifacts/git-create-ui-native-check. No native UI acceptance of the new flow yet.
- Started isolated native build at artifacts/native-create-ui-probe/build-state.json, PID35836 (supervisor4480), identity app.insomnium.probe.checkout20260929. Process confirmed live at this checkpoint; poll the same handle/state, never restart on timeout. Existing fixture is main after prior startup recovery; inspect before reuse.
- Owner now explicitly prohibits browser-use and requests saved, reusable Playwright UI scenarios so the same behavior can be retested cheaply. Recorded in AGENTS.md. This authorizes UI test scripts as an exception to the general no-new-tests rule. Do not resume ad-hoc browser/CDP automation or browser-use tools; implement scenario files in JavaScript, launched with Bun, using shared fixtures/helpers.
- Next read official Playwright/WebView2 docs, add Bun-compatible saved UI scenarios for create-and-switch and resume/forget/reload, then use the completed isolated native build for acceptance. Do not claim mock/standalone checks prove mounted UI behavior.
- Docs consulted: https://v2.tauri.app/develop/calling-rust/ ; https://svelte.dev/docs/svelte/$state ; https://git-scm.com/docs/git-checkout ; https://v2.tauri.app/reference/cli/#build . Native build command: bun x --bun tauri build --no-bundle --config with isolated identifier and beforeBuildCommand:null after separately completed frontend build. No shell/Node/npm execution.
- Full migration remains incomplete.

## Saved Playwright native Git scenarios accepted — 2026-09-30

- Previous turn was progress: durable create workflow/UI and compiler checks were completed, then the owner mandated saved Playwright scenarios instead of browser-use.
- Observed the same native build process until successful exit0 (about6 minutes). Artifact artifacts/native-create-ui-probe/insomnium-create-probe.exe, identity app.insomnium.probe.checkout20260929.
- Installed pinned playwright-core1.63.0 with bun add --dev --exact --ignore-scripts playwright-core. Bun executes the library directly; no Playwright Node workers, browser download, shell or browser-use tools.
- Added tests/ui/helpers/native-app.js for verified isolated build launch, documented WebView2 connectOverCDP, bounded waits, explicit cleanup and result/failure artifacts; git-fixture.js creates unique collections/repositories and retains previous fixture data.
- Added reusable scenarios: git-create-and-switch.js, git-create-resume.js and git-create-forget.js. All three ran via direct hidden Bun and passed actual native UI. Covers same-tip create/switch, exact resource/history preservation and reload; saved submitted-intent resume; mismatched creation evidence refusal and explicit intent clearing without deleting branch.
- First create scenario failed because fixture omitted workspace_meta that app creates on reload. Added complete metadata to the shared fixture, reran that same scenario successfully; no application defect inferred. Failed run evidence retained.
- Passing artifacts: artifacts/playwright/git-create-and-switch-1790767532963 ; git-create-resume-1790767551669 ; git-create-forget-1790767558155. Each result.json records exit0. No task build/app processes left running.
- Scope: resume arranges a durable submitted intent and already-created native ref; not an actual lost transport reply. No abrupt crash/stale-lock, OS dialog or normal OS-close acceptance. Screenshots are failure diagnostics, not full visual parity proof.
- Official docs read before setup: https://playwright.dev/docs/webview2 ; https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp . Adapted direct spawn to shell:false/windowsHide:true per owner; all JavaScript run by Bun. Commands and limits in tests/ui/README.md.
- Next add saved scenarios for remaining branch/recovery cases and implement branch deletion/remotes plus remaining parity. Unborn/detached creation still incomplete. Full migration remains IN PROGRESS.

## Guarded branch deletion implementation — 2026-09-30

- Previous turn was progress: saved Playwright create/resume/forget scenarios passed on the native app.
- Read legacy deleteGitBranchAction/GitVCS.deleteBranch and official Git/git2 deletion/transaction/ancestry docs before implementation.
- Added git_repository_delete_branch with generated permission/capability/handler registration. Locks HEAD and sorted source/target refs, checks exact displayed HEAD and target OIDs/direct ref/name, clean repository operation state, rejects active/case-alias target and linked worktrees. Requires target commit equal to or ancestor of current HEAD; no force fallback. Deletes only the target ref; does not apply workspace/index/worktree changes.
- Git client consumes the captured session before native submission and refuses pending creation. Git dialog exposes Delete selected branch and explains merge requirement; tracked run prevents competing checkout drain until native completion. Reloads branches after success/error.
- Cargo fmt/check/clippy passed.11 actual-source Rust assertions passed (same-tip/ancestor delete, active/unmerged/stale/missing/detached refusal and tip preservation), evidence artifacts/git-delete-native-check. Standalone probe has harmless unused-import warnings; application clippy -D warnings passed.
- Svelte check/build passed after adding JSDoc types to the previously saved Playwright helpers and IPC callbacks. The first full check after introducing scripts exposed44 errors there, then3 new unmerged-scenario callbacks; corrected without excluding tests or weakening strict checks. Evidence artifacts/git-delete-ui-check.
- Added reusable tests/ui/git-delete-branch.js and git-delete-unmerged.js, plus Bun script aliases. They cover actual UI deletion/reload, active/unmerged/stale-tip refusals. Not executed yet against new native command. Shared helper/README default build record now points to artifacts/native-delete-ui-probe/build-state.json; override remains available.
- Isolated native build PID28784 (supervisor26528) confirmed live; poll the same handle/state, do not restart on timeout. Intended artifact insomnium-delete-probe.exe, same isolated checkout probe identity. No production package updated.
- Next finish this build, run both saved Playwright scenarios sequentially, fix any findings and re-run relevant scenarios. No browser-use. Remote/delete edge cases, unborn/detached branch workflows, recovery/OS dialogs and full parity remain incomplete.
- Sources: https://git-scm.com/docs/git-branch ; https://docs.rs/git2/latest/git2/struct.Transaction.html#method.remove ; https://docs.rs/git2/latest/git2/struct.Repository.html#method.graph_descendant_of . Existing Tauri AppManifest command generation used; no new dependency. Bun x --bun frontend tools, direct Cargo checks and documented no-bundle Tauri build launched without shell.

## Guarded deletion accepted in native UI — 2026-09-30

- Previous goal turn made progress by recording the owner's browser-use prohibition. This turn completed native deletion acceptance.
- Existing native build finished with code 0; artifact: artifacts/native-delete-ui-probe/insomnium-delete-probe.exe, isolated identity app.insomnium.probe.checkout20260929. No production package updated.
- Three saved Bun/Playwright scenarios passed sequentially, 13 named checks total:
  - git-delete-branch-1790768615482: UI merged-branch deletion, unchanged HEAD/resources, active-branch refusal and absence after fully loaded Git session on reload.
  - git-delete-unmerged-1790768566676: UI unmerged refusal, retained current branch/commit, native stale-target refusal.
  - git-delete-stale-session-1790768580216: HEAD advanced after dialog opened, UI refusal preserves both tips, fresh explicit retry deletes merged ancestor and preserves workspace.
- Evidence: artifacts/playwright/<name>/result.json and acceptance.json. All app processes exited code 0 via explicit window destroy; this is not OS-close lifecycle, lost IPC reply, abrupt crash, remote Git or full visual-parity acceptance.
- First run failed at an exact label locator because nested select option text affected label matching. Corrected saved scenarios to use combobox role and Switch branch prefix; retained failure artifacts at git-delete-branch-1790768485089. Also added an explicit session-load wait before the post-reload absence assertion. No application source changed this turn.
- Prettier passed; Svelte check passed with 0 errors / 0 warnings after final scenario edits. Native checks/build from the prior implementation remain applicable.
- Read official locator documentation before editing: https://playwright.dev/docs/locators#locate-by-role. Commands: bun tests/ui/git-delete-branch.js; bun tests/ui/git-delete-unmerged.js; bun tests/ui/git-delete-stale-session.js (sequential direct hidden process launches, no shell).
- Next: review legacy remote settings/auth/clone/fetch/pull/push/merge against official Git/git2 docs and implement remaining workflows; keep unborn/detached branch modes, recovery/picker/crash/OS-close acceptance and the full PARITY backlog in scope. Never treat guarded local deletion as completed Git migration.
