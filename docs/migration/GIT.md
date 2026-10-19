# GIT migration

## Empty Clone display-name fallback — 2026-10-17

planGitClone no longer lets decodeURIComponent reject an accepted remote URL while naming a new empty-repository collection. gitCloneName decodes valid UTF8 paths, preserves encoded display text for malformed UTF8/percent sequences or decoded control characters, strips the .git display suffix and supplies Cloned repository for an empty name. Explicit user names keep their existing precedence. Remote URLs, native repository paths, receipts and install coordination are unchanged.

Direct Bun checks pass seven inputs through normalizeGitRemoteUrl, the new helper and actual planGitClone with controlled ready/empty-repository receipts: ordinary name, Thai UTF8, %FF, lone %, encoded NUL, .git-only and root path. Each produces the expected nonempty name and leaves source data unchanged. bun run check0errors0warnings; sequential bun run build0. No new test files/scripts/native build/network/repository/profile/clipboard mutation. Actual native stage/install/provider/path/recovery and broader Git/PLAN/PARITY acceptance remain open.



Updated 2026-10-14. Local status/commit/branch/restore, staged clone, checkout, Fetch, Pull/Merge and non-force Push implementations exist with scoped historical receipts. Remaining current network/process/recovery/provider/path/history/platform gates remain open.

See [current status](STATUS.md), [execution plan](PLAN.md) and [complete parity requirements](PARITY.md). No original scope was removed by consolidation.

## Topic records

<a id="record-checkout-transaction"></a>

<details>
<summary>CHECKOUT-TRANSACTION</summary>

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


</details>

<a id="record-git-clone"></a>

<details>
<summary>GIT-CLONE</summary>

# Staged Clone — Windows implementation and acceptance

## Author form validation — 2026-10-10

Clone author name/email now use required shared inputs, email type and a native form submit action. Previously, malformed author email could begin a download. Native form validation blocks staging before IPC/network work; retained-stage Inspect uses reportValidity before invoking native inspection. Existing trim checks, remote validation, review/install/source guards and backend author/storage policy remain. No credential/storage/native change or new dependency.

Consulted before implementation: [MDN HTML constraint validation](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation). This reuses documented required/email/form submission/reportValidity behavior and existing shared controls; no generator needed.

```powershell
bun run check
$env:LIBCLANG_PATH='E:/.dvgamerr-app/insomnium-app/artifacts/tools/llvm-20.1.8/bin'
Remove-Item Env:INSOMNIUM_UI_LOW_MEMORY -ErrorAction SilentlyContinue
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_CLONE_CASE='normal'
Remove-Item Env:INSOMNIUM_CLONE_EXPLICIT_BRANCH -ErrorAction SilentlyContinue
bun tests/ui/git-clone.js
```

Compiler75871 exited0/zero errors/warnings. Production build82761 exited0 (started1791621895023/finished1791622312109), executable SHA256 `9fc6a4b756255a9cc5e8901d387f1f3d6f52b4e449c5cb5a8f1b004217c5c838`. Frozen468app/235scenario703paths differ from the accepted tab-panel baseline only in GitCloneDialog and git-clone scenario. Preserved baseline82102013 executable/build state: `artifacts/native-clone-form-baseline`; source/build binding: `artifacts/playwright/clone-form-source-freeze.json` and `clone-form-bind.mjs`.

Native50542/artifact `artifacts/playwright/git-clone-1791622322184` exited0/passed6 checks; native66276 exited0, `native-hidden`, visible:false. New negatives cover required/empty author name and malformed email before staging/retained inspection, zero refused IPC calls/network additions, unchanged full workspace snapshot/bytes; valid corrections then retain lost-stage-success inspection/review Cancel, one additive install, existing-ID navigation and fresh200/persisted reload with complete remote HEAD. Actual smart HTTP download totals1advertisement GET/1pack POST. `bun artifacts/clone-form-audit.mjs artifacts/playwright/git-clone-1791622322184` independently verifies703hashes/executable/preserved baseline/native result/reported six checks/real command and network records. Exact owned PID/profile processes absent, recorded in `artifacts/playwright/clone-form-cleanup.json`; no live feature handles. Diff checks pass.

This accepts the covered Windows normal Clone/author form workflow. It does not rerun every historical fault mode or prove every email/address/provider/platform/assistive/keyboard submission case. Full Git/migration/shared UI/UX/CSS gates remain required. Browser scenarios remain headless; native scenarios hide the owned host before CDP.

Clone installs a newly owned managed repository and validates/imports its collection additively after explicit review. Windows stage/review/install/recovery acceptance is recorded below. Fetch or remote checkout of an already installed collection is not a replacement. Full Git/migration/provider/platform/release parity remains open.

## Current implementation

`git_clone_stage` takes a canonical operation UUID, HTTP(S) remote settings and optional exact branch. It exclusively creates a native `git-clone-v1/clone-<operation>` reservation and persists a version1 receiving receipt before network work. The receipt contains endpoint/operation identity, never credentials. The existing process-isolated Fetch worker supplies complete history with Stop and its 300-second timeout; neither GitState nor StorageState is held during network I/O. Graph-verified complete objects are imported into a fresh managed-layout candidate, preserving external tree content/modes/gitlinks. The advertised default or explicitly selected branch becomes the local branch; all fetched branch tips are recorded under origin tracking refs. Unknown default, tags-only/no branch and more than1000 branches refuse rather than guessing. Empty advertisements prepare an unborn main branch.

A ready receipt is written only after the candidate HEAD/refs, complete history and bounded committed resource read are checked. `git_clone_inspect` revalidates the candidate without another network request. A repeated stage call for a ready identical operation inspects only; an incomplete/unconfirmed operation never implicitly creates another candidate or downloads again. `git_clone_list` inventories at most128 owned receipt entries for later restart UI; malformed/unknown entries are retained and reported. Receipt reads are limited to8MiB with regular-file/reparse checks. Owned worker staging is discarded only after successful consumption; the candidate stays separate from installed repositories and workspace bytes.

`planGitClone` constructs a detached additive plan using the existing Git codec. One valid Workspace imports unchanged resource IDs after topology/privacy checks. An existing Workspace returns a navigation plan without replacement or rebinding. Other local resource-ID collisions and multiple Workspaces refuse. Empty/external-only repositories produce a new design Workspace and ApiSpec; orphaned managed resources without a Workspace refuse as invalid topology and remain in staging. The proposed binding records the native repository/clone/branch/endpoint identity and local-only credentials. Existing resources, history, settings, tabs and selections remain unchanged in the proposed additive snapshot; navigation is a later explicit product action.

The installer independently checks receipt/source graph and refs, complete original snapshot preservation, pinned resource path IDs/types/count, new binding and additive parent closure/typed navigable parents. Public resource JSON decoding/content validation remains in the existing frontend Git codec and private single-use review; the native installer does not independently parse YAML bodies. Its local full-snapshot journal contains the existing local data/connection credentials under the application's current storage policy, while public receipts/review/Git objects exclude credentials. This is not a claim of encrypted credential storage or complete protection against an independently compromised renderer.

The saved native retained-copy fixture explicitly allows git_clone_install as well as restore/merge. The shared helper drives actual Clone UI and transport, injects an unexpected live edit only after the native install completes, and then exercises production recovery/copy guards. Builder11097 finished0; build1791385088355/1791385681535/result0/hash13040452603445153458. Clone retained-copy1791385692539 passes actual OS dialog cancellation/native sharing write refusal/exact full saved copy/required review/authoritative recovery/one installer/no additional network/fresh persisted200. Screenshot inspected: recovery text, copy action and required unchecked review are visible, and loading stays disabled until review. Ordinary edit/settings/Send/persist guards all refuse during recovery.

## Windows acceptance and broader remaining gates

Production Clone build1791383768195/1791384437570/result0: normal1791384452646 (4), external-only design1791384470939 (3), actual empty upload-pack1791384526415 (3), typed-parent frontend/native refusal1791384544215 (1), truncated pack1791384614611 (3), Stop1791384633499 (3), collision1791384653603 (1), multiple1791384662988 (1), install-success reply loss1791384673056 (5), Windows workspace write refusal1791384685302 (5), known durable parent-stop1791384732295 (1) and startup reopen1791384736922 (2) pass. All handles terminal0. Startup checks full reviewed workspace/complete tree+HEAD/journal retirement/fresh persisted200. The later fixture-only build above adds retained-copy acceptance without changing production Clone code. Midwrite/power-loss/destination ownership gap and broader platform/provider acceptance remain unproven.

Further admission1791384868607 passes2 groups: changed ready receipt, stale full baseline, actual candidate HEAD change and foreign destination all refuse before journal/installation, preserving source/full workspace/held Send/no network. Source Control1791384754107, remote checkout1791384769573 and Pull1791384797103 regressions pass; handles terminal0. The subsequent fixture-only rebuild above leaves production Clone source unchanged and proves Clone-specific retained-copy. Fresh restore-copy1791385725827, merge-copy1791385741748, Source Control1791385754812, checkout1791385767167 and Pull1791385792921 regressions pass.

Latest Fetch1791385900486 and restart1791385910089 regressions also pass. Earlier Fetch1791385810674/1791385861353 failed before relevant remote interaction because the saved scenario assumed Remote settings were permanently rendered. It now opens them through the existing responsive shared helper after Git entry and each reload, and defaults to the current recovery-copy probe. Production Fetch was unchanged.

The empty server fixture uses real `git upload-pack --stateless-rpc --advertise-refs .` output and verifies its zero-id capabilities no-refs packet, documented in [Git pack protocol](https://git-scm.com/docs/gitprotocol-pack.html). It preserves those actual bytes and asserts no upload-pack POST/no fabricated pack during Clone.

The original implementation/Windows acceptance gates are covered: exclusive owned stage and destination, exact ready receipt/private single-use confirmation, full before/after journal and write fence/startup recovery, shared collection-entry UI/author/settings/Stop/Inspect, empty/no/one/multiple/existing Workspace, collision/malformed topology, complete external tree/modes/history, cancel/drain, failed/reloaded/lost-success stage/install, actual write refusal, retained copy and fresh persisted Send. Topic commit/compact handoff follows documented verification; it does not close full Git or migration.

Remaining broader gates: provider login/refresh and proxy/TLS/redirect acceptance, other platforms, OS shutdown/network-close lifecycle, midwrite/power-loss/disk-full and destination-create-to-owner-marker interruption, Push, original PARITY/CI/release gates and authorized shared-input/UX debt. Unknown/incomplete destinations and changed journals/refs are conservatively retained; these unverified boundaries are not removed from scope. Earlier failures/build checkpoints remain in STATUS for traceability.

## Evidence and documentation — 2026-10-07

Applicable ancestor/root/relevant Claude files were rediscovered; none found. Current clean baseline was remote checkout commitde683f7. Read migration STATUS/PLAN/PARITY, the Clone contract in GIT-REMOTE and actual archived git-actions/shallow-clone code (read-only). Legacy no-workspace creation, multiple-workspace refusal and existing-workspace navigation inform the implementation.

Consulted [Git clone official documentation](https://git-scm.com/docs/git-clone). Online git2 RepoBuilder/Repository documentation was unavailable; reused the project's existing documented RepositoryInitOptions and Fetch worker APIs and inspected installed/current implementation. This virtual-worktree application uses Git objects and resource storage rather than checking untrusted files out into a user's directory. The complete external Git tree must survive installation and later operations.

Commands: targeted Rust formatting; `cargo check --manifest-path src-tauri/Cargo.toml`; latest `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` passes (51235 terminal0). Existing Tauri build.rs generated Stage/Inspect/List/Install permissions; generated files were not hand-authored. Latest `bun run check` passes0 errors/0 warnings (3844 terminal0). Saved build command: `bun tests/ui/build-recovery-copy-probe.js`; feature commands: `bun tests/ui/git-clone.js` with INSOMNIUM_CLONE_CASE normal/design/empty/invalid-parent/collision/multiple/truncated/stop/install-uncertain/write-refusal/parent-stop/admission, and `bun tests/ui/git-clone-retained-copy.js`. Native scenarios run sequentially with the isolated probe identity. Saved browser scenarios are headless; native hosts are PID-scoped hidden, not true WebView2 headless.


</details>

<a id="record-git-conflict-edges"></a>

<details>
<summary>GIT-CONFLICT-EDGES</summary>

# Git conflict byte paths and bounded previews

Verified checkpoint 2026-10-07: fixed-build edge Pull1791375357926 passes5 groups with11 conflicts/2 actual advertisement+pack downloads. Current Source Control1791375478637 passes13/divergent1791375525416 passes5/check0/0/Cargo/Clippy/build1791374935430/1791375338947/result0 pass. This document does not claim full Pull/Merge or migration completion.

Source Control reads native status for the complete Git tree, even though collection staging works only with managed resource paths. The original status reader required every external filename to decode as UTF-8 and consequently disabled the whole collection's Git UI for a non-UTF8 filename. The fix uses `StatusEntry::path_bytes`: valid UTF-8 status records retain the existing shape; invalid records add exact `pathBytes` and use a hex `path` display label. That label is not a Git pathname. No bytes are replaced or used to authorize a resource operation through the display string.

Merge conflicts retain ancestor/current/incoming byte path, full OID and mode triples. The existing UI displays invalid UTF-8 paths as hex and retains the original bytes for side or custom path choices. Custom text creates a regular/executable UTF-8 blob at a reviewed byte path. It does not decode/re-encode that path or implicitly rewrite another file. Side choices retain the full immutable object and original mode.

Native previews read at most 256 KiB per blob and 2 MiB of preview content per review. Larger blobs or entries beyond the aggregate budget expose size/identity metadata rather than incomplete content. The resolution still uses the original complete blob. Gitlinks expose the submodule commit identity without assuming that commit exists in the collection repository; symlink side choices retain the symlink mode and target blob. These Git objects are merged without checking external paths out into the Windows filesystem.

Saved scenario: `bun tests/ui/git-pull-conflict-edges.js`, with shared `git-conflict-edge-fixture.js` and exact-byte `fixtureGitBytes` plumbing. It constructs complete managed commits containing two distinct non-UTF8 names that replacement-decode identically, absent submodule commit IDs, symlinks, oversized blobs, enough distinct bounded blobs to exceed the aggregate preview budget, and unrelated local/remote files. It submits actual native smart-HTTP packs, reviews exact display data, cancels without workspace/ref/index writes, resolves with a required second review, then compares NUL-delimited resulting tree entries by raw bytes and exact OID/mode/type, ordered parents and the complete workspace.

Official fixture/API sources: [Git mktree](https://git-scm.com/docs/git-mktree), [Git ls-tree](https://git-scm.com/docs/git-ls-tree), installed git2-0.21.0 `StatusEntry` documentation/source. `mktree -z` and `ls-tree -z` preserve raw names; missing gitlink commit objects are allowed. Existing Git subsystem reused; no initializer is required. Commands: targeted rustfmt on git.rs, Cargo check/Clippy using the existing MSVC environment, `bun run check`, saved native probe rebuild and saved feature/regression scenarios.

The initial real scenario1791374769632 reproduced the native UTF-8 status error after obtaining the real conflict descriptors. Fixed-build replay passes the same workflow plus two distinct byte-name cases. One Source Control run mistakenly used the saved scenario's old default probe and is excluded from current evidence; explicit fixed-build rerun passes. Feature commit/compact handoff is saved in STATUS without claiming an unavailable compact tool ran. Rename/ancestor-path collisions and remaining history/network/provider/platform/fault/clone/push/full parity and later input/UX are still in scope.


</details>

<a id="record-git-fetch-staging"></a>

<details>
<summary>GIT-FETCH-STAGING</summary>

# Git fetch staging

2026-09-30 latest checkpoint: git_remote_fetch command wired with persisted binding/settings admission before/after network, app-data stage, cancellation, snapshot publication and operation-ID reconciliation. Cargo checks;15 admission +23 snapshot +17 import +15 pack assertions passed. Actual command IPC/UI/lock-race/recovery acceptance pending; next JS client/workspace/UI and saved Playwright.

2026-09-30 latest checkpoint: Immutable fetch manifest commit + single endpoint-scoped pointer implemented, using verified importer and sorted branch-tip parents for reachability. Cargo checks;23 snapshot +17 import +15 real-pack assertions passed. Native command/binding admission/UI and crash/recovery/full parity remain pending.

2026-09-30 latest checkpoint: Lease-gated object importer implemented and standalone verified (17 import/cancellation +15 real-pack assertions; Cargo checks passed). Copies complete verified graph without refs/HEAD/worktree changes. Production caller/publication remains pending; remove temporary scoped dead-code expectation when wiring it.

2026-09-30 latest checkpoint: Fetch validates complete reachable commit/tree/blob graph with type/hash checks before success. Cargo checks,15 graph +15 direct-pack assertions and15 worker-pack regression assertions passed. Parent verified import/publication, UI/recovery and full parity remain pending; current validation size limits documented in STATUS.

2026-09-30 latest checkpoint: Native WorkerOutput now hands successful staging lease to consumers; app-data/UUID allocator added (not yet public Fetch IPC). Cargo checks,58 lifecycle/ownership/allocation assertions and15 real-pack assertions passed. Next object validation/import and snapshot publication, then Fetch UI; restart recovery/full parity remain.

2026-09-30 latest checkpoint: Parent now reserves fetch container/ownership marker; confirmed failed/cancelled workers clean it automatically, successful or uncertain work is retained. Cargo checks,43 lifecycle/ownership assertions and15 real-pack assertions through supervisor passed. App-data allocation, restart recovery, successful-stage handoff/publication and UI remain pending.

2026-09-30 latest checkpoint: Fixed supervisor termination evidence: explicit checked wait, idempotent reaped state and joins of both pipe threads before returning errors. Cargo checks/native33 assertions passed. Automatic staging allocation/cleanup, publication and UI remain pending; see STATUS.md.

2026-09-30 latest checkpoint: Fetch now uses shared native process supervisor (300s cap/305s watchdog; advertisement remains30s/35s), with staging ancestor symlink/reparse checks. Cargo checks and29 native assertions passed. Parent-owned allocation/cleanup, publication, IPC/UI and full parity remain pending. See GIT.md#record-git-fetch-staging.

Updated: 2026-09-30. **Internal staging primitive implemented; public Fetch workflow incomplete.**

## Documentation consulted before implementation

- https://docs.rs/git2/latest/git2/struct.Remote.html#method.fetch — fetch downloads and updates refs.
- https://docs.rs/git2/latest/git2/struct.FetchOptions.html — explicit refspec, depth, tags, pruning, redirects and FETCH_HEAD options.
- https://docs.rs/git2/latest/git2/struct.RepositoryInitOptions.html — disable external templates and reinitialization; bare staging.
- https://docs.rs/git2/latest/git2/struct.Repository.html#method.set_config — set isolated config.
- https://docs.rs/git2/latest/git2/struct.Transaction.html#method.commit — multiple ref updates are **not atomic** and do not roll back successful earlier updates.
- https://docs.rs/git2/latest/git2/struct.PackBuilder.html#method.insert_commit — used for the disposable two-commit pack verification fixture.

No dependency or project initializer needed. Programs launched directly with hidden-window options; no shell/Node/npm/browser-use.
Checks: cargo fmt --manifest-path src-tauri/Cargo.toml; cargo check --manifest-path src-tauri/Cargo.toml; cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings. Bun hosts inline fixture and launches rustc with source on stdin; no saved new non-UI test script.

## Current boundary

The private worker input is { remote: {url, credentials}, directory }. Only a native supervisor may eventually create this input; never expose a renderer-provided filesystem path. fetch_stage requires a fresh absolute directory but checks parent symlink/reparse points but does not yet enforce the future app-owned root. This dispatch is not exposed as a Tauri command.

The worker writes only its new bare staging directory, with explicit refs/insomnium-stage/heads/* destinations. Stage contents on failure/cancel remain owned by the supervisor; cleanup must happen only after the child exits and is reaped. Existing managed repository paths must never be passed. No local branch/resource transition is performed.

Initial mode is full history/all branches, no tags, no pruning, no redirects. These are implementation milestones, not removals of legacy modes from scope. Staging uses no global Git config; application proxy/TLS compatibility still requires deliberate integration and acceptance.

## Next implementation steps

1. Allocate a fresh operation ID and path beneath app-owned staging root in parent. Validate path components and reject links/reparse points. Capture repository/binding/settings identity and expected prior fetch snapshot. Never persist credentials in ownership/recovery metadata.
2. Generalize existing process supervisor for stage payload/result; retain cancellation registry, pipe bounds, child kill/reap and workspace drain accounting. Set a deliberate fetch timeout/progress policy rather than accidentally inheriting advertisement's30-second UI timeout. Stage worker now has305-second watchdog; supervisor caps fetch at300 seconds. Shared supervisor dispatch is implemented, but parent-owned lease and cleanup are not.
3. After reaping, validate staging path/config/refs and complete object graph; import all necessary objects, including trees/blobs outside .insomnium. Object writes alone must not publish a fetch snapshot or advance local HEAD.
4. Under GitState and binding admission, publish a complete endpoint-scoped tracking snapshot through one observable point. Multi-ref Transaction is insufficient. Candidate approach: immutable generation refs keep objects reachable, a validated manifest records endpoint/scope/ref map, and one compare-and-update pointer selects the current generation. Final pointer representation and recovery validation still need implementation; this is not a proven guarantee.
5. Readers must resolve only the published snapshot and verify manifest/generation consistency; never enumerate unfinished generation refs as fetched branches. A failure before publication keeps the old snapshot authoritative. On uncertain completion inspect the publication point before retrying.
6. Keep all referenced objects reachable while snapshots are retained. Cleanup/pruning must not remove the current generation or a generation in active use. Restart cleanup must distinguish live worker-owned stage directories from proven orphans; no blanket delete.
7. Wire client/workspace Fetch and saved Playwright scenarios only after native publication/cancel/recovery contracts are implemented. Verify branch add/update/delete, auth/transport failure, stale settings, cancel at transfer/publication, crash/lost reply, and exact unchanged HEAD/resources.
8. Add single-branch/depth/relative/prune/pruneTags modes and preserve full legacy scope. Then implement versioned advance-ref journal before pull/merge; fetch completion alone is not workspace synchronization.

## Evidence and limits

artifacts/git-fetch-stage-check/state.json: fmt/check/clippy passed.
probe-state.json: real pack fixture15 assertions; advertisement-state.json:14 regression assertions.
The probe directly calls the current fetch_stage source. It does not exercise new worker dispatch, supervisor cancellation, application IPC/UI, crash/restart, actual hosting providers or publication into managed repositories. No native app rebuild occurred at this checkpoint.

## Shared staging leases implemented — 2026-09-30

- Previous turn made progress (lost-reply/save recovery acceptance). Inspected native StageReservation/worker lifetime: v1 marker/PID alone cannot prove that an orphan worker stopped after parent crash.
- Read official std::fs::File try_lock_shared/try_lock documentation (https://doc.rust-lang.org/std/fs/struct.File.html#method.try_lock_shared and #method.try_lock). Existing configured toolchain is rustc1.98.1; these stable locking APIs require Rust1.89+. No new dependency/generator needed. Initial bare rustc launcher lacked RUSTUP_HOME; reran with existing native environment successfully, no toolchain installation/change.
- StageReservation now creates a dedicated empty .insomnium-fetch-lease file, takes a shared OS lock and keeps its File handle through import/publication/cleanup. New owner marker is insomnium-fetch-stage-v2. Worker independently opens existing lease, rejects nonregular/link/reparse files, takes its own shared lock, checks bounded v2 owner/UUID/PID and ancestry before fetch_stage. Lock acquisition never creates a missing worker container or lease.
- Both parent and worker must release their own handle before an exclusive cleanup lock can succeed. Parent death alone no longer implies idle staging if worker still holds its lease. This is cooperative filesystem locking; it is not a handle-relative defense against malicious external path replacement.
- Inline Rust Windows probe verified concurrent shared locks reject exclusive lock until both close and remove_dir_all succeeds while lease handle is held (default Windows share-delete behavior). No saved non-UI test script added. Disposable fixture only.
- Cargo fmt/check/clippy -D warnings passed. Actual current-source staged worker real-pack probe passed15 assertions (pack/history/binary/scoped refs/HEAD/existing path/corrupt/empty/invalid URL); evidence artifacts/git-stage-lease-check/full-pack-state.json and logs. This is not orphan-parent-kill/restart acceptance.
- No automatic staging deletion/scanner added yet. Next build cleanup around exclusive lease acquisition plus ownership revalidation/quarantine and bounded traversal; v1/unknown/malformed stages must be retained rather than assuming PID expiry proves safe deletion. Add saved Playwright/native parent-crash/worker-still-live cases and production app rebuild after integration.
- Current last accepted UI binary predates these lease changes (native-fetch-retire-ui-probe). No new app build running. Retained-stage cleanup/crash recovery, OS disk faults/OS-close and full original PARITY remain incomplete.

## Exclusive-lease staging cleanup implemented — 2026-09-30

- Previous turn made progress (shared parent/worker leases). Added git_fetch_cleanup.rs and git_remote_cleanup_staging command/handler/AppManifest/capability; generated permission artifacts with Cargo. Command accepts no renderer path and operates only under app-data/git-fetch-v1. It is explicit maintenance; no startup/automatic deletion or UI caller yet.
- Cleanup handles at most1024 root entries and1,100,000 inspected tree nodes per call. Reports removed/active/retained/limited counts. Requires canonical fetch-/reclaim-UUID name, plain ancestry, empty regular non-reparse lease, exclusive OS lock, bounded valid v2 ownership record, expected top-level entries and plain regular repository tree. Unknown/v1/malformed/missing-lease material is retained; held shared lease counts active.
- IMPORTANT changed design from prior checkpoint: Windows probe showed directory rename fails while its lease handle is open. Do not release lock just to rename. Cleanup now deletes in place while holding exclusive lease through validation/payload deletion/final removal. Ownership marker remains until repository payload is gone. Existing reclaim-* names are accepted for conservative recovery, but no new quarantine rename is used.
- Failure during final container removal can leave partially removed metadata requiring manual handling; failed/unknown paths stay retained. This cooperative locking/preflight is not handle-relative protection against malicious external path replacement. No ref/HEAD/workspace changes are made.
- Official docs read before implementation: https://doc.rust-lang.org/std/fs/fn.rename.html and https://doc.rust-lang.org/std/fs/fn.remove_dir_all.html ; File lock documentation read previously. Uses existing std/serde/uuid, no new dependency/init.
- Cargo fmt/check/clippy -D warnings passed. Current-source standalone cleanup probe passed20 assertions: absent root, idle and prior reclaim container removal, held parent lease retained, legacy/oversize/unrelated/missing-lease retained, unrelated payload preserved, child-held lease retained and removable after checked child kill/wait. Evidence artifacts/git-stage-cleanup-check/state.json. Probe compiled from stdin; no saved non-UI test script.
- Initial probe compile failed due panic unwind vs release abort rlibs; matched release panic=abort. Then probe exposed Windows rename failure (removed0 instead of2), corrected in-place deletion. Initial evidence retained as initial-build-failure.json and initial-runtime-failure.json.
- Next add tracked frontend maintenance action and saved Playwright/native IPC acceptance, including real fetch worker alive across parent termination and retry cleanup. Last accepted app binary predates shared leases and cleanup; no app rebuild active. Actual parent-crash, OS disk faults/OS-close, stage cleanup end-to-end and full original PARITY remain pending.


</details>

<a id="record-git-inventory"></a>

<details>
<summary>GIT-INVENTORY</summary>

# Git sync migration inventory

## Current advancement foundation checkpoint — 2026-10-07

- Schema2 same-branch journal reader b2ccdac plus registered git_repository_advance writer and separate mutation ownership now implement the prerequisite that the historical audit below identified. Saved Windows writer/ref-rename parent+restart/lost-success parent+restart/reader/restore/Source Control acceptance passes on build1791359893235/1791360274228/result0; exact artifacts and failure corrections are in STATUS/GIT-REMOTE.
- This is the native prepared-input primitive, not public pull/merge. No network pull/push/clone/merge command or end-user workflow has been added; no frontend quiescence/reconciliation/conflict coordinator calls advancement yet. Those full original workflows, Fetch/provider/other-platform/fault acceptance and remaining original PARITY are required. Preserve existing UI and defer redesign per current owner instruction.
- Restore's read-only guard is unchanged apart from visibility of shared low-level path/identity/fingerprint helpers. New advance guard permits exactly HEAD+one mutating branch with its own record/lease and explicit old/new uncertainty; it does not replace other listed transaction sites. Partial-byte/ownership-persistence gap/power-loss/disk-full/cross-platform behavior is not claimed. Compact before starting the next feature; continue full GIT-REMOTE step5 after actual compact.

## Remaining-work audit before advancement — historical 2026-10-07

- Local status/staging/selected commit/history, branch create/delete/switch and selected restore have production callers/native commands; restore pre-replace interruption is now verified (STATUS). Older foundation/TODO checkpoints below are historical, not current implementation descriptions.
- Fetch exists in git_fetch_command.rs, lib.rs and GitRemotePanel.svelte, including Inspect/Resume and cleanup. Existing artifacts git-fetch-depth-real-git1790791041039 and git-fetch-public-journal-restart1790791216338 were reread: real upload-pack full/selected depth1/history expansion/reconciliation and public-journal restart acceptance passed on their recorded journaled-fetch build. These historical artifacts do not prove the latest restore build or hosted-provider compatibility.
- No pull/push/clone/merge command is registered in current lib.rs; remote UI only exposes advertisement/Fetch. These original workflows remain missing. Do not replace them with Fetch or local checkout and call parity complete.
- git_journal.rs:344 accepts only schema1; lock_refs:424 rejects equal source/target branches; recover_inner:366 chooses state by symbolic HEAD branch and before/after workspace. This cannot represent advancing one branch from old OID to new OID. Follow GIT.md#record-git-remote's versioned advance-ref table, retain schema1 recovery, validate complete tree/pinned merge inputs and workspace preservation before adding pull/merge callers.
- Restore's new ownership guard is not a general transaction wrapper: it records at most two locks and permits HEAD/refs/heads names, with no ref-commit methods. Uninstrumented current sites: git.rs commit_resources:696, create_branch:893, delete_branch:1040; git_journal.rs lock_refs:442 (checkout/recovery locks three refs); git_fetch_snapshot.rs publish_snapshot:405; git_fetch_journal.rs recovery publication:1158 (endpoint snapshot refs). Extending ownership requires operation-specific validated ref namespaces, lock counts and ref-update uncertainty semantics; blindly substituting RestoreRefLocks is incorrect. Other crash windows remain unverified.
- Next implementation after owner-required compact: versioned same-branch advance-ref journal/recovery with old/new OID classification and saved native refusal/interruption/restart acceptance, then full fast-forward/divergent/conflict pull/merge, staged clone/remote checkout and non-force push. Keep broader Fetch fault/provider/other-platform and original PARITY gates open. This turn is read-only code audit plus handoff documentation; no new feature/runtime change or test run.

2026-10-07 mounted recovery fix: saved git-restore1791352130010 reproduced then verifies repair of the mounted GitPanel session remaining closed after authoritative recovery. Actual native save refusal after a successful baseline save mounts locked recovery; recovery loads unchanged baseline without write, panel reloads itself after persistence/drain release, and the next selected restore succeeds without app reload/navigation. Fresh native-restore-recovery-probe passes source-control/native-theme regressions, owned exits0. Disk-full/crash/retained-copy picker/platform/full parity remain open. See STATUS.

2026-10-07 sharing-failure acceptance: saved git-restore1791351439885 passes actual Windows native atomic replacement refusal with exact original bytes, successful retry after handle release, mounted UI baseline-save refusal with unchanged resources/no transition and successful retry. Bun FFI fixture opens only the canonical isolated probe file. Native/app sources unchanged; owned exit0. Disk-full/crash, mounted transition-failure recovery, retained-copy picker/review and other-platform/full parity remain open. See STATUS.

2026-10-07 acceptance update: fresh native-restore-layout-probe verifies narrow toolbar bounds and selected restore while a real HTTP request is held. Connection closes, cancelled send leaves history unchanged and fresh native send persists200. Evidence git-restore1791351033422/source-control1791350959259; owned exits0. Shared held-http helper also passes Runner1791351058954. Actual disk fault/retained-copy picker and platform/full parity remain open.

## Selected restore workspace/UI and native acceptance — 2026-10-07

- Existing planner/coordinator now has workspace and GitPanel callers. Review individual or staged paths; explicit confirmation uses its own drain and durable baseline/revalidation. Cancel/disposal consumes review without write. Authoritative apply resets stale protocol/schema state. Locked recovery routes restore to its own authoritative load and retained-copy coordinator rather than checkout.
- Saved git-restore1791350420282 passes native stale HEAD/unselected-write/stale-workspace refusals, read-only review/cancel, selected modify/delete/add, preserved unselected environment/protected records, unchanged HEAD/reload, and successful-native/lost-reply recovery with no resend. Fresh native-restore-ui-probe exit0; owned scenario exit0. Current check/build and native source-control regression pass. Narrow toolbar crowding was found in screenshot review and requires wrapping repair/fresh acceptance.
- This closes the missing UI caller, not full Git parity. Actual disk fault, retained-copy OS picker/review and active-run drain remain unverified; remote pull/push/clone/merge and original parity gates remain required. Official docs: https://v2.tauri.app/develop/calling-rust/ and https://svelte.dev/docs/svelte/$state. Saved scenario: bun tests/ui/git-restore.js.

## Guarded selected Git restore save and coordinator — 2026-10-03

- Added git_repository_restore in git_journal.rs and registered command/generated ACL. Under GitState→StorageState it requires loaded session/no checkout journal, validates IDs/unique nonempty selection, reuses collection privacy/ownership/topology/envelope guards, rejects unselected resource changes and pending create/fetch intent, locks HEAD+branch, verifies exact symbolic branch/OID and clean repository, compares persisted before-workspace twice, backs up and atomically writes one workspace file. Git refs/index/worktree are unchanged. No version1 checkout journal is written for this single-file operation.
- YAML decoding/selected baseline reconstruction remains the frontend planner responsibility (same frontend/native boundary as checkout). Native independently validates write scope and captured HEAD, not YAML-to-candidate semantic equivalence. Runtime refusal/fault/atomic-save coverage remains REQUIRED before UI release.
- Added createGitRestore coordinator with private single-use review handles, cancel, exact complete-workspace/fresh HEAD+plan revalidation after quiescence, baseline save and exclusive persistence transition. Native reply must match operation/branch/OID/workspace. Uncertain replies require authoritative load instead of resend; unexpected live edits retained and require explicit reviewed-copy recovery. Not wired into workspace/UI yet.
  -11 inline Bun assertions pass: read-only review, mutated visible review cannot alter private candidate, successful confirm/save, consumed/cancelled/forged handles, stale workspace/HEAD refusal, lost-success reply recovery without resend, retained live edits and mismatched review refusal. Native command was injected for these coordinator checks; not actual native runtime evidence. artifacts/git-restore-coordinator-check/result.json.
- cargo check --locked and cargo clippy --locked -- -D warnings pass using documented child MSVC/SDK environment; command ACL generated by Tauri build. bun run check0 errors/0 warnings; Prettier/targeted diff check pass. Initial JSDoc on a multi-variable declaration left retained implicitly any; split declarations and reran check successfully. No new saved feature test scripts.
- Official API consulted: https://v2.tauri.app/develop/calling-rust/ ; git2 Transaction docs URL unavailable via web, existing installed transaction/lock pattern reused without adding dependencies. Commands: Bun inline coordinator probe; bun run check; Bun Prettier; Cargo fmt/check/clippy.
- NEXT actual native restore refusal/write/reload/fault validation, wire coordinator review/confirm/cancel/recovery into existing Git panel/workspace, then saved Playwright acceptance and fresh isolated build. Existing probe lacks the new command. Full restore UX and overall migration remain incomplete; all other PARITY gates retained.

## Selected Git restore planning — 2026-10-03

- Added prepareGitRestore in git-staging.js for explicitly selected changed paths against a pinned committed baseline. Restores modified/deleted resources and removes selected local additions. Unlike commit preparation, does not implicitly include workspace changes. Uses existing topology/three-way reconciliation to preserve local metadata/private/foreign records and reject orphaning selections, protected resources, unknown/stale/empty selections. Pure plan only; no refs/persistence mutation.
- Added createGitClient.prepareRestore: uses private session baseline (ignores modified displayed metadata), requires committed branch, rereads HEAD, rejects changed binding/public collection, guards complete resource array and closed session after async native read. Returned preview is NOT permission to overwrite later live edits.
  -17 inline Bun assertions pass (no saved new test script): selected modify/delete/add, unselected workspace edits, local metadata/protected/foreign preservation, input immutability, orphan/private/empty/unknown refusal, private captured HEAD, read-only IPC, moved HEAD/live foreign edit/closed-session refusal. Evidence artifacts/git-restore-planner-check/result.json. Svelte check0/0; frontend build0; Prettier applied. Initial tool orchestration syntax error occurred before execution/writes, corrected.
- Source consulted: https://git-scm.com/docs/git-restore ; existing legacy selected undo requirement in GIT-INVENTORY. Commands: inline bun -e probe; bun run check; bun run build; bun x --bun prettier --write src/lib/git-staging.js src/lib/git-client.js.
- NEXT implement reviewed selected-restore coordinator with quiescence, persisted before-state and native HEAD/binding/resource revalidation under GitState→StorageState; atomic save/recovery and retained live edits, then explicit review/confirm/cancel UI and saved native scenarios. Do not directly apply this preview or reuse a stale plan. Native worktree/index behavior and legacy selection cancellation remain required.
- Full selected undo is not yet user-accessible. Advance-ref journal/pull/merge/clone/push, GraphQL/platform/CI and full parity remain open; shared input/UX deferred.

2026-09-30 latest checkpoint: Remote settings build finished0; saved native Playwright passed8 checks (save/read/reload/auth error/Stop/endpoint edit/dialog close/data preservation). Evidence git-remote-settings-1790770895847. Next scoped fetch, advance-ref journal/pull/merge and remaining remote/parity workflows; actual providers remain unverified.

2026-09-30 latest checkpoint: Isolated remote build finished0; saved Playwright native lifecycle passed7 named checks, including actual 30021ms timeout and existing Git UI responsiveness. Evidence git-remote-lifecycle-1790769998943. Settings/remote Stop UI/providers and remaining workflows are pending; next client/workspace admission integration.

2026-09-30 latest checkpoint: Advertisement now uses a cancellable native worker process with bounded lifecycle/registry. Cargo checks and 14 actual-source assertions passed. See [GIT.md#record-git-remote-lifecycle](GIT.md#record-git-remote-lifecycle); isolated app/IPC/settings/UI acceptance remains pending.

2026-09-30 latest checkpoint: git_remote_advertise primitive implemented with detached native remote and explicit auth mapping. Cargo checks and 14 actual-source loopback assertions passed. No UI/provider/fetch acceptance. Next bounded lifecycle/cancel and settings/client integration; GIT.md#record-git-remote retains full remote scope.

2026-09-30 remote design checkpoint: See [GIT.md#record-git-remote](GIT.md#record-git-remote) for inspected legacy behavior, ordered implementation and acceptance. Current checkout journal cannot advance a branch tip; versioned OID-based recovery is required before pull/merge. Next settings/auth and read-only advertisement. Remote implementation remains pending.

2026-09-30 latest checkpoint: Native deletion build finished 0; saved Playwright deletion/unmerged/stale-session scenarios passed 13 checks. Reload absence now waits for the loaded Git session. Evidence and limits in STATUS.md. Next remote/auth/clone/fetch/pull/push/merge, branch modes and recovery acceptance; full migration remains incomplete. Older checkpoints below are historical.

2026-09-30 checkpoint: Guarded native branch deletion + consumed-session client/UI implemented; frontend/Cargo checks and11 native assertions passed. Saved deletion/unmerged Playwright scenarios added, not yet run. Native build live at artifacts/native-delete-ui-probe/build-state.json; poll before restarting. Full migration incomplete.

2026-09-30 checkpoint: Native create build finished0 and all three saved Bun/Playwright scenarios passed: create-and-switch/reload, pending intent resume and mismatch refusal/forget preserving branch. Scripts in tests/ui, results in artifacts/playwright. No browser-use. Remaining branch modes/delete/remotes/recovery/visual parity still pending.

2026-09-30 checkpoint: Durable create intent, native verifyOnly resume and create-and-switch/continue/forget UI wired; frontend/Cargo checks and31 coordinator/18 native assertions passed. Isolated build running at artifacts/native-create-ui-probe/build-state.json. Owner prohibits browser-use: future UI acceptance must use saved reusable Playwright JavaScript scenarios with Bun. Native UI acceptance remains next.

2026-09-30 checkpoint: Native create-branch accepts optional operationId and acknowledges existing branches only from exact current-tip/creation-reflog/source/author evidence, without rewriting refs. Cargo checks and14 actual-source assertions passed. Durable frontend intent/create-and-switch UI and native IPC acceptance remain next; this is not completed branch creation workflow.

2026-09-29 checkpoint: Fresh-process startup recovery passed18 assertions using a real native-produced pending journal after workspace sharing failure. New app startup recovered exact main workspace without manual recovery IPC, preserving history/local/private/foreign data; both probes closed0. Evidence artifacts/native-checkout-ui-recheck/startup-recovery.json. Abrupt crash/stale-lock, mounted failure/retained picker and broader parity remain pending.

2026-09-29 checkpoint: Real native checkout/load/save IPC passed18 post-HEAD file-sharing failure/recovery assertions. Before workspace and native journal survived failure, pending journal blocked save, releasing handle let load finish exact target and fresh-document reload agreed. Evidence artifacts/native-checkout-ui-recheck/post-head-ipc.json. Fresh-process startup, mounted failure coordinator, retained picker/review and wider branch/remote parity remain pending.

2026-09-29 checkpoint: Native recheck executable verified the conflict-message fix in actual Git dialog after staging reload; source branch/local edit retained, fresh-document reload passed, screenshot inspected and probe closed0. Five assertions recorded in artifacts/native-checkout-ui-recheck/conflict-recheck.json. Next post-HEAD IPC failure/recovery, retained-copy OS picker/review and remaining branch/remote parity.

2026-09-29 checkpoint: Actual native checkout/reload/protected-data/selection/conflict and pre-journal ref-lock recovery flows passed16 artifact assertions; probe closed0. Fixed conflict text lost on dialog reload;11 handler checks and frontend build passed. Native fix recheck build is live at artifacts/native-checkout-ui-recheck/build-state.json. Retained picker/review, crash/uncertain IPC and broader branch parity remain pending.

2026-09-29 checkpoint: Existing committed local branch switching and separate recovery modal connected. Retained edits require successful copy and exact reviewed snapshot before replacement.34 coordinator +10 compiled UI-script checks and Svelte/build passed. Isolated native build is in progress; observe artifacts/native-checkout-ui-probe/build-state.json before any restart. Next actual Tauri checkout/recovery/visual acceptance.

2026-09-29 checkpoint: Frontend checkout/recovery coordinator is wired into workspace with exact baseline, pinned three-way plan, authoritative apply and retained unexpected live edits. JS/native selection/topology contract aligned; orphaned branch history preserved on load.31 coordinator +7 compiled-workspace +61 native checks and frontend/Cargo checks passed. Next branch/recovery UI, retained-data resolution and actual Tauri acceptance; full migration remains incomplete.

2026-09-29 checkpoint: Guarded native checkout producer/command now writes journal and switches HEAD, then completes via revalidated recovery under GitState → StorageState. Cargo checks and 55 native assertions passed, including real Windows post-HEAD workspace sharing failure/recovery. Frontend three-way coordinator, candidate/topology/selection contract and Tauri IPC/UI acceptance remain pending.

2026-09-29 checkpoint: Native journal recovery now runs during load under GitState then StorageState. Version/snapshot/ref/binding checks and conservative recovery table implemented; Cargo checks and 33 standalone native assertions passed. No journal producer/HEAD transition or Tauri IPC acceptance yet. Next guarded checkout producer, full candidate/selection coordination and native UI acceptance.

Updated: 2026-09-29. **Resource codec, snapshot/planner and native init/info foundation implemented; full Git workflow/UI remain incomplete.**

## Evidence inspected

All legacy paths below are relative to `_backup/legacy-electron/packages/insomnia/src/`.

- `sync/git/git-vcs.ts`: isomorphic-git wrapper; init/clone, status/add/remove/commit, author/remotes, local/remote branches, fetch/pull/push, merge, checkout, log and selected-file undo.
- `sync/git/ne-db-client.ts`: virtual filesystem backed by NeDB resources.
- `sync/git/parse-git-path.ts`: path-to-resource mapping; accepts yml/json suffixes.
- `sync/ignore-keys.ts`: modified-key deletion helper and workspace parentId reset helper are distinct operations. NeDB readFile calls resetKeys; do not assume it deletes modified.
- `models/git-repository.ts`: repository URI, author, credentials, needsFullClone and uriNeedsMigration; repository model is neither duplicable nor syncable.
- Located UI/actions: `ui/routes/git-actions.tsx`, `ui/components/dropdowns/git-sync-dropdown.tsx`, staging/log/branches and repository-settings/clone modals. Detailed action/conflict/provider review is still required.

## Compatibility requirements established

1. Repository resource root is **.insomnium**, not .insomnia. Files are `.insomnium/<legacy model type>/<id>.yml`, YAML of the legacy model. Preserve this representation to interoperate with existing repositories.
2. NeDB directory enumeration includes workspace, environment, request group/request, API spec, test suite/test, gRPC request, proto file/directory, WebSocket request/payload. It filters descendants by active workspace and excludes resources whose own isPrivate flag is true. Investigate private ancestors separately; do not infer subtree behavior.
3. Resource path ID/type must match parsed content. Workspace parentId is serialized as null and restored to the current project during checkout writes.
4. The old virtual filesystem lets checkout/merge add/update/remove application resources. A plain Git repository command wrapper alone will not replace this behavior.
5. Legacy credentials include username/password and provider-formatted OAuth token forms. Credentials/repository settings must stay out of the synced resource tree. No existing credentials were read in this inventory.
6. Preserve status/staging, selected changes commit, history, branches, fetch/pull/push, merge and undo workflows. Review conflict and rollback orchestration before implementation; no automatic destructive checkout or force push.
7. Unrelated repository files must survive resource synchronization. New resource application must preserve collection ownership, local-only state, private resources and rollback/recovery.

## Implementation direction to validate

Keep native repository operations behind Rust/Tauri commands, with Svelte JavaScript UI and the existing resource model. Evaluate git2/libgit2 before adding a dependency: it supplies init/open/clone and repository/index/branch/remote APIs without a Node runtime. This is a candidate, not a selected or verified backend.

The previous isomorphic-git implementation uses a custom filesystem adapter; its adapter architecture explains why copying only Git commands loses resource transactions. Compare that behavior with a native managed worktree and staged application-state transaction.

No new dependency, native command, saved development test script, real repository mutation, clone or remote push has been performed for this inventory.

## Ordered implementation and acceptance

1. Finish action/provider/conflict/rollback inventory and map current resource types/unknown fields to exact legacy serialization.
2. Verify backend build compatibility on the installed Windows toolchain and required platforms; record dependency/license and official install command before changing Cargo dependencies.
3. Implement deterministic resource encode/decode, private/local-only exclusions, path validation, schema/resource ownership checks and transactional apply/recovery.
4. Add managed repository lifecycle, status/diff/staging/commit/log and branch operations, then fetch/pull/push/auth/conflict handling. Serialize operations per repository and guard collection deletion/cancellation.
5. Port existing Git dropdown and settings/staging/log/branch dialogs to the current Insomnium Svelte layout.
6. Verify with isolated local repositories first: round-trip existing legacy YAML, private resources, unrelated files, selected commits, branch switch, add/delete/rename, merge conflicts, rollback and reload.
7. Verify native UI/IPC and explicit remote authentication workflows. Never use the application's source repository as a fixture.

Full Git parity requires these workflows and their acceptance; this inventory does not change PARITY's TODO classification.

## Official sources consulted

- [git2 crate documentation](https://docs.rs/git2/latest/git2/) — native Rust libgit2 bindings, repository initialization/open/clone and associated APIs; candidate only.
- [isomorphic-git filesystem interface](https://isomorphic-git.org/docs/en/fs) — legacy custom filesystem adapter contract.

Read exact API and installation documentation again for the chosen version before implementation.

## Action and rollback follow-up — 2026-09-29

Read commit/checkout/merge/push/pull/getGitChanges actions and git-rollback helper:

- Commit takes selected paths or all modified/unversioned groups; deleted resources are staged with remove, others with add. Status UI forces Workspace changes staged/noneditable so clones retain a root.
- Status compares the union of tracked Git paths and current resource paths, allowing deleted resources to appear; missing display names are recovered from the last commit tree.
- Selected rollback removes/unlinks newly added resources and force-checks-out only selected existing paths. Preserve the explicit selected scope and cancellation/confirmation behavior when porting.
- Checkout buffers database changes and updates cached branch/last author/time; pull fetches then pulls and updates metadata. Early-error paths do not establish transactional rollback, so the replacement needs its own verified state transaction.
- Merge action calls merge(theirBranch), then checkout(theirBranch); assess the intended current-branch behavior rather than copying this suspicious sequence.
- Push action reads force but calls push(credentials) without forwarding it. Treat force-push support as unproven; never infer it from an unused form value.
- Observed pull/merge error handlers return errors. No in-app conflict-resolution UI has been established from these handlers; further review remains required.

These are source observations, not executed Git acceptance or backend implementation.

## Resource codec implemented — 2026-09-29

Added src/lib/git-resources.js as a prerequisite, not yet called by UI/backend:

- Explicit mapping for all 12 legacy syncable types. Supports .insomnium/<Type>/<id>.yml and legacy .json input; unrelated paths return null and malformed managed paths fail.
- Encode preserves current resource values/unknown fields and modified, maps _type to legacy type, resets Workspace parentId, and rejects private/local-only or conflicting types. No stale fields are restored from _legacySource.
- Excludes local import provenance/diagnostics (_legacySource, _postmanSource, _harSource, _curlSource, _migrationIssues, _openapiIssues, _oauthImported). Decode never accepts remote provenance as local recovery data.
- Decode validates YAML, duplicate keys, unsupported tags/documents, ID/type-to-path agreement and parent ID shape; preserves IDs. Workspace can be assigned an explicit local project parent.
- Limits individual text to20 MiB, aliases to100 and object nesting to100; rejects circular/non-JSON values. Forward-slash paths are required; native path conversion remains the backend caller's responsibility.
- No collection traversal, private-ancestor decision, topology/ownership validation, state application, repository operation or UI wired yet. This codec must not be used alone to apply remote state.

Official docs read before implementation: [yaml v2](https://eemeli.org/yaml/) parseDocument/stringify, errors/warnings and maxAliasCount. Used the existing yaml dependency; no install/init needed. Legacy source/tests confirmed all type names, Workspace parent reset and private exclusions.

Validation:

- 87 inline assertions passed for12 types, yml/json round-trip, no mutation, provenance omission, unrelated paths and invalid input.
- Existing archived smoke export fixtures insomnia4/unit-test/grpc/websockets/environments:37 syncable resources round-tripped;5 local-only/private records excluded by the probe. These are actual export fixtures transformed to Git representation, not live Git repository acceptance.
- bun run check initially found2 Map inference errors; explicit JavaScript JSDoc Map<string,string> fixed them. Final check0 errors/0 warnings.
- Initial build observation overflowed launcher stdout buffer; rerun with sufficient capture completed code0. bun run build passed.
- No saved development test scripts, dependency change, native rebuild or real repository mutation.

Next: collection snapshot and atomic apply contract, current/legacy field compatibility, then native backend and Git UI. Git sync is still unavailable as a product workflow.

## Collection snapshot and managed-tree reader — 2026-09-29

Added src/lib/git-collection.js:

- snapshotGitCollection traverses only the selected workspace, returns sorted encoded files and an explicit list of private/local-only/unsupported exclusions. Input resources are unchanged.
- readGitCollection parses only managed .insomnium resource files, reports unrelated paths, preserves IDs and accepts an expected workspace ID/local project parent.
- Validates a single root, unique IDs, parent closure, no nested workspace, reachable graph, duplicate/case-colliding paths and10,000-file/100-MiB managed-tree bounds. It rejects mixed collections, missing/circular parents and private records in a remote public tree.
- This is graph/collection validation, not complete per-type field schema validation or validation of every request/proto/test cross-reference.
- It does not apply remote state, infer deletions, authorize overwrite, touch a real repository or persist anything. Atomic application, dirty-local-change reconciliation, native Git backend and UI remain pending.

Private-parent evidence: legacy common/database.ts withDescendants recursively traverses all model types without pruning private parents; NeDBClient then filters only each resource's own isPrivate. Therefore a public child beneath a private parent can yield an incomplete serialized tree. The new snapshot reports that invalid parent closure; it neither exports the private parent nor silently hides the public child. A user-visible resolution flow is still required before full parity.

Sources consulted before this work:

- [Git checkout](https://git-scm.com/docs/git-checkout) — branch switching and handling uncommitted changes; future state application must reconcile against a baseline, not blindly replace the collection.
- [yaml document API](https://eemeli.org/yaml/#documents) — existing decoder remains the YAML boundary.

Validation:28 inline assertions including5 existing archived fixture collections/37 resources passed. Cases cover collection isolation, deterministic file ordering, exclusions, no mutation, foreign workspace, duplicate IDs/paths, public child/private parent, missing/circular parents and actual fixture snapshot/read round-trips. Svelte check0 errors/0 warnings and frontend build passed. No saved development test scripts.

Next implementation: compare base/current/incoming snapshots; protect local-only/private/foreign-ID collisions and uncommitted changes; construct a nonmutating change plan before wiring revision-guarded persistence and native repository rollback. Do not describe the current reader as a completed transaction.

## Three-way resource update planner — 2026-09-29

Added src/lib/git-reconcile.js (planGitCollectionUpdate). Exported the existing frozen gitLocalFields list from the codec so provenance handling has one definition.

Inputs are current application resources, workspace ID, last-applied repository tree and proposed incoming tree. Both repository trees must pass the existing full-tree reader for the same workspace. The planner:

- Compares normalized records with order-independent object keys; array order/unknown field values remain significant.
- Keeps local changes/deletions when incoming matches base, applies incoming when local matches base, and accepts identical concurrent changes.
- Reports resource-level conflicts for divergent concurrent edits, edit/delete, conflicting adds, changed resource type, protected private/local-only IDs and foreign collection IDs.
- Returns resources:null and no changes if any conflict exists; never exposes a partially applicable candidate.
- Preserves unrelated/private/local-only resources and local import provenance on updated records; removed public fields stay removed. Workspace retains its local project parent.
- Revalidates merged parent connectivity so remote folder deletion cannot orphan a local public/private child. Returns detached candidate resources and does not mutate inputs.

This is a resource-level plan, not Git's line/field merge engine and not a persisted transaction. Per-field resolution UI, stale revision checks, active request cancellation, local metadata cleanup policies, durable app/repository commit and rollback, clone/new-workspace flow, native backend and UI remain required. Local-only metadata is retained even if its referenced public request disappears; caller lifecycle/cleanup must be defined before application.

Official source consulted: [Git read-tree](https://git-scm.com/docs/git-read-tree) on three-way trivial merges, conflicts and protecting local changes. No Git commands were executed for this milestone.

Validation:38 inline checks passed (add/edit/delete truth cases, no mutation, detached candidate, provenance, removal of old fields, protected/foreign IDs, parent conflicts, whole-plan rejection). Svelte check0 errors/0 warnings and frontend build passed. No saved development test scripts, dependencies or native build.

## Native Git backend foundation — 2026-09-29

Selected git2 0.21.0 (Rust/libgit2) and added it using documented Cargo commands:

- cargo add git2@0.21.0 --manifest-path src-tauri/Cargo.toml
- cargo info git2@0.21.0 confirmed default features are empty.
- cargo add git2@0.21.0 --features https,ssh --manifest-path src-tauri/Cargo.toml
- cargo check --manifest-path src-tauri/Cargo.toml

Ran Cargo directly through hidden Bun/node_repl launcher with the documented local MSVC/SDK/INCLUDE/LIB/libclang environment. Dependency check passed in46.28s. Lockfile includes git2 0.21.0, libgit2-sys 0.18.8+1.9.7, libssh2-sys 0.3.2 and related native dependencies. git2 and Rust sys wrappers declare MIT OR Apache-2.0; bundled C-library licenses and final distribution notices still need inclusion in package delivery review. HTTPS/SSH compiling does not prove provider authentication or wire compatibility.

Added src-tauri/src/git.rs and registered GitState, git_repository_init and git_repository_info:

- Repositories live only under app-data/git-v1/repo-<validated-id>; no caller-provided filesystem path.
- Reject links/reparse points at managed root/repository/.git; open with NO_SEARCH and verify actual workdir/gitdir match expected canonical locations.
- Init refuses existing directories, uses no_reinit, main initial branch and external_template(false). Failed initialization is retained for diagnosis.
- Serialized operations run in spawn_blocking, away from UI. Info reports HEAD, current/local branches and status/conflict flags without updating index or contacting a remote.
- Command manifest/default main-window capability updated; generated allow/deny permissions exist.

Validation and corrections:

- First fmt/check/clippy launcher exceeded30s and lost observation; tasklist confirmed no cargo.exe remained before retry. This was not assumed to be build success.
- Durable retry exposed4 API type errors: git2 0.21 shorthand/path/symbolic_target return Result forms. Inspected installed crate source and corrected error handling; also avoided Windows-only unused-mut portability issue.
- Final cargo fmt, cargo check and cargo clippy -- -D warnings all exited0. Evidence: artifacts/native-git-check/commands-fixed-state.json and commands-fixed.log. Prior dependency/failed checks retained separately.
- No saved development test scripts, real repository creation, native app invocation, frontend changes or installer build in this milestone.

Sources consulted:

- [Cargo add](https://doc.rust-lang.org/cargo/commands/cargo-add.html)
- [git2 API](https://docs.rs/git2/latest/git2/) and [upstream feature manifest](https://raw.githubusercontent.com/rust-lang/git2-rs/master/Cargo.toml); version-specific docs URLs were unavailable, so installed crate source was used for exact signatures.
- [Tauri Rust commands](https://v2.tauri.app/develop/calling-rust/) and [permissions](https://v2.tauri.app/security/permissions/)

Next: native init/info acceptance in isolated app data, committed-tree/resource reads and status/diff/staging/commit/history, then branch/remote/credentials and transaction/UI integration. These initial commands do not implement complete Git sync.

## Native committed-resource read — 2026-09-29

- Added git_repository_read_commit to src-tauri/src/git.rs and registered its handler, manifest and main-window capability. Generated permission verified.
- Caller supplies a managed repository ID and exact 40-character commit OID. No moving refs/revspec, checkout, working-tree reads, index writes or remote contact.
- Reads only .insomnium from the commit tree. Absent root returns an empty files list with commitOid; this is not a valid collection until the JS reader validates its root.
- Accepts the 12 legacy type directories and regular .yml/.json blobs with bounded IDs. Rejects nested directories, symlinks/submodules, unsupported entries, non-UTF-8 and case-colliding paths.
- Limits: 10000 files, 20 MiB per blob, 100 MiB total contents, 1 MiB per managed tree object. Object headers checked before loading managed trees/blobs. Unrelated repository contents are neither returned nor changed.
- Response is {commitOid, files:[{path,content}]}, sorted by path. Content/schema/ID agreement, duplicate resource IDs across extensions, workspace graph and private-resource validation remain the responsibility of readGitCollection; this command is not yet wired to that reader or persistence.
- Used official git2 Tree/Repository docs before implementation and inspected installed 0.21.0 tree.rs/blob.rs/odb.rs signatures. Sources: https://docs.rs/git2/latest/git2/struct.Tree.html and https://docs.rs/git2/latest/git2/struct.Repository.html .
- Validation: cargo fmt, cargo check, cargo clippy -- -D warnings all exit 0. Evidence: artifacts/native-git-read-check/state.json and check.log. No saved test scripts or native runtime acceptance in this milestone.
- Next: rebuild isolated native probe and verify init/info/read-commit via IPC, including malformed paths/object modes and empty/missing revision behavior; then connect validated resource snapshots, guarded application and full Git workflows/UI. No production installer rebuilt.

## Integration observation during native build — 2026-09-29

workspace.svelte.js revision increments inside persist() and controls save flags; it is not a dedicated resource transaction revision. persistence.js serializes detached save snapshots through a Promise queue, but this does not atomically coordinate Git refs/index and application resources. Future apply must capture/revalidate resource state, coordinate in-flight HTTP/stream/Runner work, and define recoverable repository + data writes before changing either. Native Git probe build runs under isolated identifier app.insomnium.probe.git20260929; see artifacts/native-git-probe/build-state.json/log.

## Native Git IPC acceptance — 2026-09-29

- Official Tauri CLI docs consulted: https://v2.tauri.app/reference/cli/ . Ran bun x --bun tauri build --no-bundle --config with isolated identifier app.insomnium.probe.git20260929, productName Insomnium Git Probe and build.beforeBuildCommand:null; child-only MSVC/SDK/libclang environment as prior native probes.
- Build finished code 0 in 6m31s. Verified fresh executable timestamp and embedded identifier, copied to artifacts/native-git-probe and opened isolated WebView profile. Runtime identifier confirmed through native IPC.
- Actual WebView IPC: init created empty main branch, info matched, duplicate init/missing repo/traversal rejected. HEAD/short/nonhex/null object IDs rejected by committed read.
- Created independent Git object fixtures only in the native-created isolated repo with git hash-object -w --stdin, git mktree and git commit-tree (dummy probe author, no user project commit or refs updated). Official docs consulted: https://git-scm.com/docs/git-hash-object , https://git-scm.com/docs/git-mktree , https://git-scm.com/docs/git-commit-tree .
- Valid commit returned exact two encoded resources, excluded unrelated README, and actual JS readGitCollection decoded them with local workspace parent. This JS-reader step ran in Bun after receiving native IPC output; it is not mounted UI integration.
- Missing .insomnium root returned no files and was correctly rejected by collection reader. Nine malformed cases rejected: symlink, submodule, nested directory, bad extension, invalid UTF-8, >20 MiB blob, case-colliding paths, root blob and blob OID used as commit.
- Info reported fixture untracked.txt. Before/after HEAD text, absent index, working-file bytes and git status matched exactly. No checkout, index update or ref mutation from native reads.
- Fixture launcher initially assumed APPDATA was present; both direct and case-insensitive lookup failed before writes. Used app-data location returned by native error and verified .git/HEAD before creating objects. No app source fix required.
- Evidence: artifacts/native-git-probe/{build-state.json,build.log,app-state.json,app.log,init-info-evidence.json,fixtures.json,read-evidence.json,unchanged-evidence.json}. No saved development test script. Fixtures remain in isolated app data for diagnosis.
- Probe destroyed after checks; app exit 0 at 09:56:07 UTC, process confirmed absent. No server or compiler remains from this milestone.
- This verifies bounded init/info/read IPC, not all file/count/tree/total-byte boundaries, OS reparse containment, branch changes, credentials/remotes or Git UI/transactions. No installer; production BUILD.json is still older. The release target executable now carries the probe identity and must not be distributed as production.
- Next: native status/diff/staging/commit/history and resource-state transaction integration; then branches/remotes and legacy Git UI workflow acceptance. Full migration remains incomplete.

## Native Git history command — 2026-09-29

- Added git_repository_history with managed repository ID, exact tipOid, offset and limit (1..100). Pages return tipOid, commits and nextOffset; callers must reuse the returned immutable tip for subsequent pages. Unborn repositories have no tip; UI should show empty history from info rather than pass HEAD.
- git2 revwalk uses TOPOLOGICAL | TIME and includes all reachable parents, not just first-parent. It reports traversal/object errors instead of silently skipping broken history. Offset pagination retraverses ancestry and has no total-history cutoff; large histories may require a more efficient cursor/cancellation design before broad acceptance.
- Each row includes OID, parent OIDs, message, author/committer names/emails, Unix seconds and timezone offset minutes. Mirrors legacy git-log-modal message/date/author requirements; full visual integration remains pending.
- Display message is limited to 64 KiB at a UTF-8 boundary with messageTruncated flag. Non-UTF-8 metadata uses replacement text with textLossy flag; raw objects are never changed. No legacy encoding transcoding yet.
- Returned commit payloads reject >1 MiB objects, >1000 parents or >4096-byte signature name/email. These are payload checks, not a bound on libgit2 internal traversal memory or total walk duration. UI must expose these errors/flags.
- Registered handler/manifest/main capability and verified generated permission. No network, checkout, staging, ref or working-tree writes.
- Official docs consulted before implementation: https://docs.rs/git2/latest/git2/struct.Revwalk.html and https://docs.rs/git2/latest/git2/struct.Commit.html . Exact Commit/Signature APIs checked against installed git2 0.21.0 source. Legacy evidence: git-vcs.ts log and git-log-modal.tsx.
- Cargo fmt/check/clippy -- -D warnings all code 0. Evidence artifacts/native-git-history-check/state.json and check.log. No saved test scripts or native executable rebuild this turn.
- Runtime acceptance pending: merge ancestry, multi-page continuity, fixed tip during branch advancement, author/committer timestamps, message flags and invalid/empty inputs. Earlier native-git-probe does not contain this new command.
- Next: verify history in next isolated native build, then add diff/staging/commit plus guarded resource persistence and Git UI. Full migration remains incomplete.

## Legacy history follow-up — 2026-09-29

Re-read git-vcs.ts log: legacy defaults to depth 35 and fetches origin before returning git.log when a remote exists; NotFound returns an empty list. New native history is currently local-only by design of this command, so remote history freshness still requires explicit workflow integration. Do not count current history command as full log parity.

## Resource staging model — 2026-09-29

- Added src/lib/git-staging.js: gitCollectionChanges compares committed managed files to the current collection snapshot; prepareGitCommit overlays selected changes on the validated baseline and validates the complete candidate graph.
- Status rows carry path/ID/type/name, added/modified/deleted, required workspace flag, exclusion reason and before/after text for later diff UI. Deleted names come from committed resources. Byte comparison intentionally reports serialization/format changes; it is not a semantic diff.
- Empty managed baseline supports initial commit; foreign/malformed nonempty collection baselines reject. Private/local-only snapshots are excluded; a previously tracked resource now private appears as an explicit deletion with reason, without exporting current private content.
- Workspace changes are always included, matching legacy staging. Unknown/stale paths and empty selections reject; selecting a child without a new parent or deleting a parent without deleting its retained child rejects the candidate. Unselected files keep original bytes.
- Unrelated repository paths are reported, not returned as managed candidate files. The future native writer MUST preserve them when overlaying resources; absence from this candidate is not authorization to delete them.
- Pure model only: does not write a native index, commit, persist resources, bind a commit OID or prevent later stale-state edits. Next integration must capture/check tip OID and resource revision plus lifecycle/persistence state. Existing Git index selections still need reconciliation.
- Official Git diff/status docs consulted before implementation: https://git-scm.com/docs/git-diff and https://git-scm.com/docs/git-status . Legacy git-staging-modal.tsx reviewed for required workspace/modified-unversioned selection behavior.
- Validation:26 inline assertions passed for no change/add/edit/delete/name, initial workspace inclusion, parent dependencies, partial selection, preserved bytes, unrelated/private/local/foreign resources, invalid/stale selection and detached inputs. No saved development test script.
- Svelte check0 errors/0 warnings; Vite build code0 via direct bun x --bun commands. Evidence artifacts/git-staging-check/probe.json, frontend-state.json and frontend.log.
- No native/installer rebuild or UI integration this turn. History native acceptance remains pending. Next native commit/index transaction plus Svelte staging UI and revision checks, then bounded native workflow acceptance.

## Native resource commit command — 2026-09-29

- Added git_repository_commit(repositoryId, input). Input has branch, expectedHeadOid (null for unborn), workspaceId, full selected candidate files, authorName, authorEmail and message. Returns new commit OID.
- Native guards: valid branch/ref and full expected OID; bounded nonempty author/message; 1..10000 managed files; known type directories; bounded ASCII IDs; unique resource IDs/case-folded paths; exactly one matching workspace; 20 MiB/file,100 MiB total and <=1 MiB estimated per type tree.
- Uses git2 transaction locks for HEAD and intended branch, then validates symbolic HEAD, repository clean operation state and exact current target. Detached/changed branch or stale expected HEAD rejects before writing objects.
- Validates existing managed entries via committed_resources; refuses replacing another/invalid workspace. Builds new .insomnium trees, preserves existing resource executable modes and overlays only that root entry on the prior full commit tree. Unrelated entries retain object IDs/modes; zero tree changes reject.
- Writes blobs/trees/commit object first, then updates only the locked branch ref with explicit reflog signature. Commit author and committer are both the supplied author at current time. No signing/amend/merge commit yet.
- Architecture: application resources are the virtual worktree, as in legacy NeDB adapter. Physical repository index/worktree are not written or staged by this command. Native info physical status is NOT the resource staging model; UI must use gitCollectionChanges. Physical external staging reconciliation remains a workflow concern.
- Content schema/private flags/parent graph validation is still performed by prepareGitCommit/readGitCollection in JS; Rust enforces path/size/workspace-ID boundaries, not YAML semantic validity. Frontend must use the validated candidate and captured resource revision. Command is registered for main window but not yet called by UI.
- Ref locking is not a cross-store atomic transaction. git2 transaction docs explicitly state multi-update commits are non-atomic; here only one branch target is updated. Object-write failures can leave unreachable objects; ref update errors include candidate OID and require rereading branch before retry. App data baseline/recovery coordination still required.
- Sources consulted before implementation: https://docs.rs/git2/latest/git2/struct.Repository.html , https://docs.rs/git2/latest/git2/struct.TreeBuilder.html and https://docs.rs/git2/latest/git2/struct.Transaction.html . Installed 0.21.0 transaction.rs/repo.rs checked for exact APIs.
- Validation: Cargo fmt/check/clippy -- -D warnings all code0. Generated allow/deny permission verified. Evidence artifacts/native-git-commit-check/state.json and check.log. No saved development tests, repository commit, native runtime or installer build this milestone.
- Next: rebuild isolated native probe and verify initial/selected second commit, preserved unrelated entries/modes, stale head/branch/no-op/invalid inputs, locks/error cleanup and history pagination/merge ancestry. Then connect frontend revision/persistence and legacy staging/log UI.

## Native commit/history acceptance — 2026-09-29

- Prior implementation checks passed. Rebuilt release probe with documented bun x --bun tauri build --no-bundle --config, isolated app.insomnium.probe.git20260929 and beforeBuildCommand:null. Build code0 in5m39s; verified fresh executable/embedded ID before launch and actual runtime identity via WebView IPC.
- New isolated repo commit-flow: initial native commit returned exact resource files; selected second commit changed only the chosen request while another edited request retained its committed value. JS prepareGitCommit ran in Bun, then its actual candidate was passed via native WebView IPC; this is not mounted staging UI acceptance.
- Seven commit rejection cases: stale initial HEAD, no-op, mismatched branch, NUL refname, empty message, duplicate path and foreign workspace ID. Subsequent valid commit succeeded, proving these failure paths did not leave blocking ref locks.
- History two1-row pages yielded newest/parent with correct author and parent OID. Native info HEAD matched second commit.
- Independent Git plumbing added unrelated executable-mode tool.sh and advanced isolated branch with expected-old update-ref. Native rejected stale prior HEAD, then committed against the new baseline.
- git ls-tree independently confirmed unrelated blob OID and100755 mode unchanged. HEAD matched returned native OID; HEAD/main/other lock files absent; physical index and managed working directory still absent, consistent with virtual-resource architecture.
- Built a separate merge graph with Git commit-tree. Native paged history returned all6 reachable commits exactly once, both merge parents and pinned old-tip history remained2 commits after branch advanced. History limit0/101 and HEAD revspec rejected; offset beyond end returned empty/no next page.
- Probe cleanup exit0 at10:15:37 UTC; process confirmed absent. No server or compiler left running from this milestone. Fixture repositories retained only in isolated app data.
- Evidence in artifacts/native-git-commit-probe: build/app states/logs, commit-progress.json, commit-evidence.json, extra-fixtures.json, extra-evidence.json, git-independent-evidence.json.
- Sources: https://v2.tauri.app/reference/cli/ and official https://git-scm.com/docs/git-update-ref , https://git-scm.com/docs/git-mktree , https://git-scm.com/docs/git-commit-tree . All launchers used Bun/direct hidden spawn; no saved development test script or production repository commit.
- Limits: no real remote/auth/push, no mounted Git UI, no app-data transaction/recovery acceptance, no interrupted disk writes/lock-contention race, and history text-loss/truncation/large graph bounds still need acceptance. No installer/production BUILD update; release target executable remains isolated probe identity.
- Next: connect persistent Git collection binding, captured resource revision, commit error recovery and Svelte staging/log UI; then branch/remote/rollback workflows and remaining parity.

## Git frontend binding/session client — 2026-09-29

- Added src/lib/git-client.js with newNativeGitBinding/nativeGitBinding/createGitClient. New bindings are local-only git_repository resources with generated nativeRepositoryId/version1; duplicate per-collection or reused repository bindings reject. Legacy settings without explicit native binding are not auto-activated.
- Client uses documented @tauri-apps/api/core invoke/isTauri; browser preview rejects native access. Source: https://v2.tauri.app/develop/calling-rust/ . Legacy GitRepository nonduplicable/nonsyncable model and current model/persistence inspected.
- open reads repository info and exact HEAD resource tree, checks returned OID, computes staging rows and rechecks collection/binding after async reads. Private session state keeps detached baseline/expected HEAD separate from mutable UI rows.
- commit checks live collection snapshot and binding against opened session, builds selected candidate via prepareGitCommit, captures native input and prevents concurrent commits within that client. Submission consumes session before IPC; any uncertain error requires new HEAD read rather than automatic repeat. Edits after submission remain local and are not overwritten.
- Change guard compares serialized public snapshot plus sorted exclusions, not a global persist counter. It protects the content submitted to Git; it is not an app lifecycle/disk transaction or cross-client lock. Native expected HEAD/ref locks remain authoritative for repository concurrency.
  -18 inline checks passed with injected command responses: local-only binding, duplicate/legacy binding, correct init target, immutable private baseline, consumed/closed session, stale content before/during load, removed binding, ambiguous IPC and retained post-submit edits. These are client contract checks, not new native acceptance.
- Format, Svelte sync/check and Vite build all code0; no Svelte errors/warnings. Evidence artifacts/git-client-check/probe.json,state.json,frontend.log. No saved development test script.
- Not yet integrated with workspace persistence or mounted UI. Caller must save binding before native init, define interrupted-init recovery without broad error fallback, reset/remap bindings on external import, and save/validate app edits before committing. Native binding data must not accidentally attach an imported collection to an existing local repository.
- Next connect one client instance to workspace actions and existing dialogs for Git setup/staging/history, add persistence/recovery lifecycle and UI/native acceptance. No installer/native rebuild this turn; full migration incomplete.

## Portable imports do not activate native Git bindings — 2026-09-29

- Found parseImport remapped _id/parentId but retained nativeRepositoryId/nativeBindingVersion; exportData emitted both. This could attach an imported collection to a pre-existing local managed repo once UI is connected.
- import-export.js now strips exactly these two machine-local activation fields from git_repository resources at import/export boundaries. Keeps author, URI, unknown fields and records; no native repo is opened, modified or deleted.
- Import review warns when an incoming binding was detached. Legacy multi-.db picker feeds parseLegacyFiles output through parseImport, so it shares the same boundary. Normal local validateData/loadData path remains unchanged and restores native binding.
- Read official Tauri capability docs before boundary change: https://v2.tauri.app/security/capabilities/ . Capabilities govern WebView command access; they do not make imported repository IDs valid local bindings. No capability changes were needed.
  -15 inline assertions exercised real parseImport/exportData serialization with intercepted browser download: fields stripped, IDs remapped, settings/unknown fields preserved, source unmodified, nativeGitBinding inactive after import, warnings and portable round-trip, local saved-state validation retains binding. No saved development test script.
- Svelte check0/0 and Vite build0; all formatter/sync/check/build steps0. Evidence artifacts/git-portability-check/probe.json,state.json,frontend.log.
- No native UI import/export acceptance or installer rebuild this turn. Next persist/recover Git binding initialization and connect frontend service to existing Svelte dialogs; mounted/native acceptance remains required.

## Initialization retry recovery — 2026-09-29

Official sources consulted before implementation:

- https://docs.rs/git2/latest/git2/struct.RepositoryInitOptions.html (no_reinit, external_template and initial_head)
- https://doc.rust-lang.org/std/fs/fn.symlink_metadata.html (metadata without following links and error handling)

Changed src-tauri/src/git.rs, existing git_repository_init contract: a valid existing managed directory is opened and inspected, never reinitialized. A missing path is exclusively created and initialized. Other metadata/open errors propagate without destructive cleanup. An interrupted initialization leaving an invalid directory still requires explicit recovery; this change does not silently repair or delete it. Existing managed_path link/reparse protections remain. This is not a filesystem transaction against external path replacement.

Commands executed directly via Bun/node_repl with hidden windows and shell:false:

- cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
- cargo check --manifest-path src-tauri/Cargo.toml
- cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

All exit 0; artifacts/git-init-recovery-check/state.json and check.log. Native runtime acceptance for changed initialization behavior remains pending; earlier native probe predates this change. Frontend persistence and UI integration remain pending.

## Persist-before-initialize coordinator — 2026-09-29

Official docs consulted:

- https://svelte.dev/docs/svelte/$state — reactive proxies and passing live state through callbacks.
- https://v2.tauri.app/develop/calling-rust/ — asynchronous command invocation.

src/lib/git-setup.js creates/reuses local binding, awaits persistence before native initialization and validates collection/binding after both awaits. Repeated setup is rejected per collection while in flight; failures release the guard but retain binding for retry. Workspace replacement/deletion invalidates success; a native repository already created remains intact. Existing portable legacy settings remain unchanged. This does not coordinate all other resource edits or make filesystem and app storage atomic.

src/lib/workspace.svelte.js exposes setupGit(workspaceId) with desktop/ready guards, live resources getter, existing persist() and createGitClient.initialize. No startup auto-init and no UI caller yet.

Validation:12 inline assertions; bun x --bun prettier --write src/lib/git-setup.js src/lib/workspace.svelte.js; bun x --bun svelte-kit sync; bun x --bun svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings; bun x --bun vite build. All0, Svelte0/0. artifacts/git-setup-check/{probe.json,state.json,frontend.log}. Actual mounted Svelte/native save and retry acceptance remains pending.

## Local Git Svelte dialog — 2026-09-29

Official docs consulted before implementation:

- https://svelte.dev/docs/svelte/lifecycle-hooks (mount/unmount cleanup)
- https://svelte.dev/docs/svelte/$state (raw state for session identity)

src/lib/components/GitPanel.svelte connects explicit setupGit, client.open/commit/history/close and workspace persistence. Header Git button is desktop-only; current modal captures workspace ID at open. It exposes before/after resource content, required selected workspace rows, private/local exclusions, author/message and local history. Author settings persist before commit; closed/superseded collection results do not update the panel. Closing does not cancel an already-submitted native commit; reopening reloads authoritative HEAD. History is local only, anchored to session tip with35-row pages, not a remote fetch. No branch/remote/merge/rollback UI yet.

src/lib/git-client.js history(session,offset) checks session validity, skips native call for unborn HEAD and verifies returned tip.6 inline assertions passed for page arguments/results, pagination, mismatched tip, closed session and unborn history.

Commands: bun x --bun prettier --write src/lib/components/GitPanel.svelte src/lib/git-client.js src/routes/+page.svelte; bun x --bun svelte-kit sync; bun x --bun svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings; bun x --bun vite build. All code0, Svelte0/0. Evidence artifacts/git-ui-check/state.json,frontend.log,history-probe.json. No mounted/native or visual acceptance claimed. Next rebuild an isolated native executable (existing probe predates recovery/setup/UI) and check actual flow, failures, reload and screenshots.

## Native Git dialog probe and reload fix — 2026-09-29

Consulted Tauri CLI docs https://v2.tauri.app/reference/cli/ before isolated build.
Build command: bun x --bun tauri build --no-bundle --config '{"identifier":"app.insomnium.probe.gitui20260929","productName":"Insomnium Git UI Probe","build":{"beforeBuildCommand":null}}'.
Build finished0 in5m43s. Verified executable freshness/embedded and runtime identifier before app mutation. Evidence artifacts/native-git-ui-probe.

Actual native UI: initial setup persisted binding; first commit6baa46ac9df7 and second URL-edit commitc98ee8eeba75 displayed history and zero changes before reload. Saved resources/HEAD/tree captured in first-commit.json,reload-data.json; UI in second-commit-ui.json,reload-ui.json. Repeated init preserved HEAD/branch (init-retry.json). This did not exercise partial selection across multiple changes or full recovery matrix.

Failure: reload produced Environment and Request changes due solely to YAML key ordering. Native persisted JSON maps differed in insertion order; original stringify(record) exposed that order. Consulted official https://eemeli.org/yaml/#schema-options and installed yaml options definitions; changed encoding to stringify(record,{sortMapEntries:true}). Array order and raw body strings retained.7 inline regression checks use captured native data; artifacts/git-ordering-fix/probe.json. Existing unsorted committed bytes remain unchanged until explicitly selected for a new commit; formatting-only changes to older trees remain possible once.

Viewed changes.png: dark dialog visible; checkbox stretched by global input styling. Added local width:auto/flex:0 0 auto. Both fixes pass Svelte0/0 and frontend build0 but are NOT yet native/visually reverified. The probe binary is stale relative to these fixes. App exit0, PID31676 absent; no live processes left.

Next native acceptance: canonical commit followed by reload produces zero changes; selected/unselected rows; author persistence; screenshot after checkbox fix; native init existing unborn/committed and invalid/partial directory cases. Full Git remote/branch workflow still pending.

## Native canonical reload / selected commit recheck — 2026-09-29

artifacts/native-git-ui-recheck build completed0 in5m43s, using same isolated identity and persisted probe data. Canonical formatting commit25e4c26c explicitly selected through UI; after reload Changes(0). canonical-reload.json records before/after. This proves the previously observed key-order failure is fixed for the inspected native persistence flow.

Partial selection: UI changed original request URL to https://example.invalid/partial-ui, duplicated request, unchecked original modified row and committed copy only (e406bf950e3d). Decoded committed tree independently: original URL retained pre-edit baseline, copy has new URL, saved workspace original still has local edit. Native reload leaves exactly one modified row. before-partial.json,partial-commit.json,partial-reload.json record actual data/tree/text.

Visual inspection of partial-selection.png revealed auto margins still displacing checkbox. Native computed styles showed13px input with210px horizontal margins. Source margin:0 added; live inline CSS preview aligned input left edge to label and screenshot inspected. checkbox-margin-preview.json explicitly records preview-only status; executable predates this last CSS edit. Svelte0/0 and build0 after edit in artifacts/git-checkbox-fix. App closed0, PID4500 absent.

Still pending: full init failure/recovery matrix and stale lifecycle/disk failures, branch/remotes/auth/merge/rollback, light/resize/keyboard/full UI parity. Do not reuse this scoped success as proof of complete Git sync.

## Native initialization recovery matrix — 2026-09-29

Reused native-git-ui-recheck executable after verifying current source initialization was unchanged; separate supervisor/log/profile in artifacts/native-git-recovery-probe. Runtime identity verified app.insomnium.probe.gitui20260929.

19 inline IPC assertions: new unborn main repository; repeated init returns same info with every file hash unchanged; already-committed bound repo repeated init keeps HEAD and every file hash; six invalid existing paths (empty directory, nonrepo with sentinel, partial .git with broken HEAD, plain file, .git file pointing nowhere, Windows junction) reject and preserve observed path contents. Junction destination independently checked to contain only original sentinel bytes. No production repository/data touched.

recovery-evidence.json includes generated fixture IDs, errors, before/after results, committed HEAD and explicit limitations. app-state.json finished0 at2026-09-29T10:57:50.810Z; PID31196 absent. Invalid partial initialization remains an explicit preserved error; automatic repair/backup replacement not implemented. ACL/disk-full/crash/race tests and coordinated cross-store recovery remain pending.

Next branch work must preserve virtual resource checkout semantics: prepare target committed resources and three-way reconcile with local edits; guard source/target refs and live resource revision; persist a recoverable transition before advancing HEAD and applying app state; finish/restore deterministically after interruption. Creating/deleting branches must use exact expected tips and must not silently overwrite/delete active branches. Read legacy actions and official APIs before implementation.

## Native create-branch primitive — 2026-09-29

Read legacy git-actions.tsx createNewGitBranchAction/checkoutGitBranchAction and GitVCS branch/checkout inventory. Legacy creation calls checkout(name), and checkout of new names creates and switches. Creating a ref alone is an internal step, not completion of this user workflow.

Official sources consulted:

- https://docs.rs/git2/latest/git2/struct.Transaction.html — lock_ref/set_target/commit, including non-atomic multi-update warning.
- https://docs.rs/git2/latest/git2/struct.Reference.html — reference validation.

Added GitCreateBranchInput {name,expectedBranch,expectedHeadOid,authorName,authorEmail}; git_repository_create_branch returns created target OID. Validates branch ref syntax/NUL/length and disallows HEAD/leading dash, same current name/case. Full40hex expected OID must be source direct-ref commit. HEAD/source/target locked (direct refs sorted); clean operation state and symbolic HEAD checked after locks. Existing target or ASCII-case alias rejected;1000 local branch cap. Single new target ref update with explicit author/reflog; HEAD/index/worktree/resources untouched. Errors advise rereading branches before retry. External ref mutations outside covered locks/case collision races require further acceptance; no cross-store transaction claimed.

Tauri handler/manifest/main capability registered; generated permission at src-tauri/permissions/autogenerated/git_repository_create_branch.toml. Cargo fmt --manifest-path src-tauri/Cargo.toml; cargo check --manifest-path src-tauri/Cargo.toml; cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings all0. Evidence artifacts/git-branch-create-check. No saved tests, runtime repository writes or frontend/native release build this turn.

Next: source/target branch snapshot for UI, guarded delete, recoverable checkout coordinating Git HEAD and app resources, frontend create-and-switch/session integration, then actual native flow validation. Unborn branch creation and legacy remote fallback semantics still need explicit implementation/acceptance; not removed from scope.

## Branch tip metadata for checkout planning — 2026-09-29

Official docs read before implementation:

- https://docs.rs/git2/latest/git2/struct.Branch.html (get/name)
- https://docs.rs/git2/latest/git2/struct.Reference.html#method.target (direct target vs symbolic reference)

Existing git_repository_info/init response now adds branchTips with name,headOid,symbolic, sorted by name. Existing branches:string[] retained. Each direct target validated as a commit; symbolic refs marked explicitly, not confused with an unborn branch. Missing current unborn name added with null tip and cap checked. Current listed tip must match earlier HEAD or command returns reload error. The read is not an externally atomic snapshot and cannot authorize a later ref change without expected-tip checks.

Cargo fmt --manifest-path src-tauri/Cargo.toml; cargo check --manifest-path src-tauri/Cargo.toml; cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings passed0 (artifacts/git-branch-info-check/state.json/check.log). JS RepositoryInfo typedef documents optional additive field for existing clients/probes. Native runtime branch tip cases still pending: unborn/detached/symbolic, malformed noncommit ref, current branch changes, cap and source/target exactness.

Next coordinate pinned tree reads and planGitCollectionUpdate with live resource-version guard, then recoverable native/app-state transition and actual checkout/create-and-switch. Branch metadata alone does not switch data or complete branch parity.

## Read-only branch switch preparation — 2026-09-29

Official references consulted:

- https://git-scm.com/docs/git-checkout — switch updates worktree while preserving non-conflicting local edits.
- https://v2.tauri.app/develop/calling-rust/ — asynchronous command results.

prepareSwitch(session,getResources,targetBranch) in git-client.js uses private stored branchTips and baseFiles. It rejects expired/source-unborn/detached/same/missing/symbolic target cases, validates current binding and public snapshot, captures whole live resource array as JSON (detaches Svelte proxies), reads exact target OID and rereads native info to reject moved source/target. Before planning, it rechecks session and complete resource array, including local-only/foreign data. planGitCollectionUpdate supplies candidate or conflicts. Return includes source/target names/OIDs and plan.

No mutation/persistence; the preview is mutable data and is NOT authorization for future writes. A future durable coordinator must revalidate resources and native refs at submission, not trust an old returned preview. Existing resource-level conflict granularity remains; remote fallback, unborn/detached transitions and create-and-switch need implementation.

11 inline assertions covered private tip despite UI metadata mutation, disjoint local/target edits, no input mutation, read-only IPC, conflict/no candidate, local-only change during read, stale native HEAD, closed session and wrong target OID. artifacts/git-switch-plan-check/probe.json. Commands bun x --bun prettier --write src/lib/git-client.js; bun x --bun svelte-kit sync; bun x --bun svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings; bun x --bun vite build all0, Svelte0/0. No saved test scripts or native build/runtime acceptance.

## Checkout protocol decision — 2026-09-29

See [GIT.md#record-checkout-transaction](GIT.md#record-checkout-transaction): actual storage/queue evidence, lock order, journal schema, recovery decisions and required acceptance. This is an implementation specification, not functional checkout. Next persistence barrier/generation prevents queued stale snapshots overwriting the native transition. No checks or builds performed for this documentation-only decision.

## Persistence barrier implementation — 2026-09-29

Read official Promise chaining semantics https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then and Tauri async IPC https://v2.tauri.app/develop/calling-rust/ before changing queue behavior.

persistence-queue.js provides save/exclusive/recover with idle/reserved/running/recovery/recovering phases and generation checks. saveData now uses this queue, preserving detached JSON snapshots and ordered ordinary writes. Reservation happens before await; accepted earlier saves drain, later saves reject without joining queue. A failed last baseline prevents transition callback from starting. Once callback starts, any failure requires recovery; only successful callback completion releases writes/advances generation.

persistence.js exports runWorkspaceTransition, recoverWorkspaceTransition, workspacePersistencePhase for upcoming workspace/native checkout integration. Callbacks must apply authoritative state before returning and must not call ordinary saveData while reserved. No native journal, startup recovery or mutation guard is supplied by the queue itself; do not use an empty recovery callback in product code. Tests used controlled callbacks to inspect queue state only.

27 inline assertions include deferred saves/transition/recovery, snapshot detachment, overlapping calls, error propagation/failure phases, retries, and actual persistence.js wrapper behavior with in-memory browser storage. Svelte0/0 and Vite build0; artifacts/persistence-barrier-check. Commands bun x --bun prettier --write src/lib/persistence.js src/lib/persistence-queue.js; bun x --bun svelte-kit sync; bun x --bun svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings; bun x --bun vite build. No saved test scripts or native acceptance.


</details>

<a id="record-git-merge-bases"></a>

<details>
<summary>GIT-MERGE-BASES</summary>

# Recursive merge bases and advancement recovery

Verified checkpoint: 2026-10-07. Native bases1791374388057 passes8, actual smart-HTTP Pull UI1791374071314 passes3, current reader20/preparation11/writer8/divergent5/contract9/check/Cargo/Clippy and native build1791373637707/1791374019966/result0 pass. This document does not mark full Pull/Merge or migration complete.

The merge preparation command requires complete selected histories. It obtains every actual common ancestor with `Repository::merge_bases`, sorts full OIDs, and supports at most 64 actual bases. A single-base merge keeps the previous complete-root-tree merge. Multiple bases use `Repository::merge_commits` with recursive defaults: libgit2 consolidates the ancestors and carries conflicting base regions into the virtual ancestor. It does not choose one actual ancestor. No `no_recursive` flag or recursion limit is supplied, because reaching libgit2's recursion limit selects the next ancestor instead of merging it.

The result still describes each final conflict with exact byte path/OID/mode triples. Its ancestor entry may describe a generated virtual-base blob rather than a blob in one historical commit. Existing bounded native content previews read that exact object. Preparation and cancellation may retain unreachable objects, but never move refs or write workspace/on-disk index state.

| Operation | Candidate identity | Resolution pin | Journal |
| --- | --- | --- | --- |
| Up to date | Existing source commit | No resolutions | No advancement |
| Fast forward | `mergeBaseOid = sourceOid` | No resolutions | Schema2 |
| Single-base divergence | One actual `mergeBaseOid` | `expectedMergeBaseOid` | Schema2 |
| Multiple-base divergence | `mergeBaseOid = null`, sorted unique `mergeBaseOids` | Exact `expectedMergeBaseOids`, no single base | Schema3 |

Schema3 is an explicit extension of the same-branch journal. `advance` contains `kind: "merge"`, the incoming OID and 2..64 sorted unique actual base OIDs; `mergeBaseOid` must be absent. Native application/recovery verifies that the recorded base set equals the actual complete base set of the pinned old/incoming commits, verifies exactly two ordered target parents, rejects ancestor/up-to-date relationships, and validates every involved managed collection tree. It performs graph validation rather than merge computation under StorageState. Schema2 rejects an attached base list and requires exactly one actual base for divergence. Schema1 checkout recovery remains separate.

The frontend verifies full lowercase OIDs, bounds, uniqueness/order, null single-base field and merge kind before admission. Private reviews retain the native set through resolution and emit schema3 only for multiple-base candidates. The existing full workspace reconciliation, final review, run drain, baseline persistence, immutable source proof and authoritative recovery paths remain in use.

Saved acceptance scenarios:

- `bun tests/ui/git-merge-bases.js`: real clean two/three/nested recursive graphs compared against Git's complete result trees, conflicting bases/pinned virtual ancestor preview, exact resolution set, malformed schema2/schema3 graph admission, actual Windows post-ref write refusal/authoritative full workspace recovery and synthetic old-before/new-after/contradictory old-after reader states.
- `bun tests/ui/git-merge-bases-ui.js`: actual loopback smart-HTTP recursive Pull, virtual/current/incoming previews, cancellation, resolution/second review and schema3 confirmation preserving full workspace, selected blob, unrelated files and ordered parents.
- `bun tests/ui/git-merge-contract.js`: injected candidate validation/coordinator contract, supplementary to native evidence.
- Regression: saved merge preparation, advancement reader/writer and divergent Pull scenarios on the same successful build.

Sources: [git2 0.21 MergeOptions](https://docs.rs/git2/0.21.0/git2/struct.MergeOptions.html), [libgit2 merge_commits](https://libgit2.org/docs/reference/main/merge/git_merge_commits.html), installed git2-0.21.0/libgit2-1.9.7 headers/source. Existing documented APIs reused; no initializer/generator is needed. Native checks use Cargo with the existing MSVC environment; JavaScript tooling uses Bun only.

These scenarios verify the listed two/three/nested graphs, not every possible history or a process/power interruption. Additional history/provider/platform/network-fault/path choices and full migration parity remain required until separately verified. The multiple-base capability handoff is saved in STATUS; commit by topic and compact before the next capability, without claiming an unavailable compact tool ran.


</details>

<a id="record-git-path-conflicts"></a>

<details>
<summary>GIT-PATH-CONFLICTS</summary>

# Rename and file/directory merge review

The Windows native fixture reproduces a rename/rename history and a file at `collision` competing with a directory containing `collision/child.txt`. Both histories contain the complete managed collection. The rename conflict preserves the original/current/incoming byte paths and modes; selecting every current or incoming side produces the exact root tree of that side.

libgit2 can expose a conflicted parent file while keeping a directory child at stage0. Previously the final collision guard correctly rejected selecting the file, but the child was not available to review. Preparation now rebuilds a fresh in-memory index and promotes stage0 paths that collide with any conflict path to explicit ancestor/current/incoming file entries from the pinned trees. Directory tree entries are not file sides. Every promoted path requires a choice; selecting a missing side explicitly removes that file. No unreviewed child is silently deleted.

Existing exact descriptor, complete choice, duplicate path and file/directory prefix collision guards remain mandatory. A mixed selection that keeps the parent file and directory child refuses before a target, journal, ref, disk-index or workspace transition. Preparation reads raw bytes without checking out external paths. Single-base promotion may expose that real ancestor file. For recursive bases, a promoted path has no fabricated stage1 entry; the UI labels a missing ancestor entry `No ancestor entry`.

Saved commands:

- `bun tests/ui/git-merge-paths.js`: real rename and file/directory complete choices, mixed/incomplete refusal, unchanged workspace/ref/index and no advancement artifacts. Run1791376467375 passes5 groups.
- `bun tests/ui/git-pull-paths.js`: actual native smart-HTTP Pull, pinned per-side path/content review, cancel, mixed refusal with fresh retry, both complete choices through a second review and confirmation. Run1791376482685 passes7 groups with7 advertisement/pack rounds; exact complete selected root (including modes and managed files), ordered parents, full workspace/index and cleanup verified.
- `bun run check`; targeted Rust formatting and Cargo check/Clippy `-D warnings`; `bun tests/ui/build-recovery-copy-probe.js`. Fresh build1791376053818/1791376441357/result0.

Official API/fixture references: [git2 MergeOptions](https://docs.rs/git2/0.21.0/git2/struct.MergeOptions.html), [Git mktree](https://git-scm.com/docs/git-mktree), installed git2-0.21.0 Index/Tree byte-entry APIs. Existing subsystem and documented Git plumbing reused; no initializer is needed.

This verifies these real rename/rename and parent-file/child-directory cases. Other rename histories, server/source shallow histories, network uncertainty, fault/provider/platform/clone/push/full parity remain required. Full migration and the later shared input/UX goal are unfinished. Feature commit and compact handoff must precede the next capability; do not claim an unavailable compact tool ran.

Current-build regression evidence: recursive bases1791376528168 passes8; preparation1791376599665 passes11; edge Pull1791376622570 passes5; divergent Pull1791376659299 passes5 including actual post-ref Windows write refusal/authoritative recovery/no duplicate/fresh200. All apps exit0 and owned servers/handles are released. Final compiler0 errors/0 warnings and diff check pass.


</details>

<a id="record-git-pull-uncertainty"></a>

<details>
<summary>GIT-PULL-UNCERTAINTY</summary>

# Pull after an unconfirmed completed Fetch

Pull first saves a full-history Fetch intent and submits the native download/publication. Only a validated, current receipt with a successfully cleared intent can enter merge review. A rejected IPC call does not establish whether publication happened. The saved operation ID, exact endpoint/repository/collection/branch and requested depth remain the inspection identity.

Previously Fetch displayed the operation ID and explained uncertain completion, while Pull's catch reduced the same error to a string. GitRemotePanel now shares that formatter for both actions and points to `Inspect pending fetch`. It adds no automatic retry, rollback, merge review or ref transition. Both actions remain disabled while the pending intent exists.

The saved `git-pull-uncertain.js` scenario submits an actual native smart-HTTP pack containing the complete managed collection. The existing `withIpcFailure` helper consumes a real successful native reply and replaces its acknowledgement with an error. This is controlled IPC reply replacement after actual publication; it is not network reply loss, OS process termination, crash or power-loss acceptance.

The scenario verifies the pinned current snapshot through native read-only inspection, the entire workspace except the explicit pending intent, unchanged local ref/disk index, no advancement artifacts/review, and an unrelated real native Send that remains connected until explicit Cancel. UI reload must restore the pending branch/identity without network or merge. Explicit Inspect clears only the exact acknowledged intent and never repeats the download. A later explicit Pull must still pass working choices and a second review before confirming the ref; the complete local workspace and a fresh persisted HTTP200 are checked.

Official references consulted before changes: [Tauri commands and error handling](https://v2.tauri.app/develop/calling-rust/), [Playwright Page.evaluate](https://playwright.dev/docs/api/class-page#page-evaluate). Existing commands/helpers/subsystem reused; no initializer is required.

Commands: `bun run check`; `bun tests/ui/build-recovery-copy-probe.js`; `bun tests/ui/git-pull-uncertain.js`; `bun tests/ui/git-fetch-recovery-errors.js`; `bun tests/ui/git-pull.js`; `bun tests/ui/git-pull-divergent.js`. The existing Fetch error scenario uses the current shared Remote navigation helper/build instead of its old inline Remote probe. Reproducer1791376910451 proves actual publication but fails missing operation/error instructions. Fixed replay1791377578393 passes5 groups on the hidden native host. Native builder59777 terminal0/build1791376958919/1791377400613/result0/hash18136940908490119303; compiler0 errors/0 warnings and diff check pass.

Current-build regressions: Fetch lost-reply1791377705185 passes5; retirement rejected-save1791377711059 and lost-save-success1791377716635 pass4 each; original Pull1791377729177 passes8; divergent Pull1791377807266 passes5 including actual post-ref write refusal/recovery/no duplicate/fresh200; retained-copy1791377844226 passes actual Windows picker cancel/write refusal/exact full copy/review/recovery/fresh200 while the native host is hidden. All owned apps/servers/handles are released. Owner-requested headless work was committed separately ascccf507; [UI-TESTING.md](UI-TESTING.md) records exact modes and lifecycle evidence.

Remaining migration requirements include network timeout/socket reset, true process/network outcome uncertainty, Pull retained-copy/close, other histories/path cases, provider/platform/fault/clone/push/full parity, and the subsequent centralized input/UX phase. This capability does not establish full migration completion.


</details>

<a id="record-git-push"></a>

<details>
<summary>GIT-PUSH</summary>

# Non-force Push

Receiptless directory guard: saved `bun tests/ui/git-push-admission.js`1791407379525 passes9 native groups on unchanged release1791406630663/1791406984947/result0. Exclusively owned sentinel models a preexisting operation directory without receipt: Push refuses before network/new snapshot, independent Inspect returns receipt null/remote absent, retirement refuses adoption or deletion. Exact full workspace bytes/data/refs/HEAD/sentinel/stage list preserved. Fixture removes only its own sentinel/empty directory; fresh Inspect then permits a retired tombstone without upload. No production behavior changed. This verifies reservation/uncertain-ownership guards, not actual initial atomic-write failure/disk-full/spontaneous orphan recovery/product UI/process-powerloss/platform acceptance; remaining gates in STATUS.

Provider token capability893e852/49bd6b3: GitHub HTTPS uses x-access-token/token (token in password), GitLab remains oauth2/token; persisted schema/UI resource fields unchanged. Actual provider selectors and password-only fields pass owned loopback GitHub1791406996009/GitLab1791407006598,6 groups each on release1791406630663/1791406984947/result0. Real challenge/receive-pack validates the exact pair, pinned complete server tree/full private workspace preservation, persisted selector/token after reload, no automatic resend and fresh unchecked Inspect/retirement. Basic success/refusal and core Fetch/Clone/Pull/checkout/Source Control/native Push/admission regressions pass on the same artifact, all processes terminal0. Current official [GitHub PAT documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) places tokens in password; [GitLab OAuth documentation](https://docs.gitlab.com/api/oauth2/) documents oauth2/token. This is synthetic transport/schema acceptance, not real provider scope/expiry/SSO/login-refresh or complete Push/migration acceptance. Exact evidence/remaining gates in STATUS.

Untrusted TLS capability4f10351: TLS1791406353242 passes5, exact batch95904 terminal0 with Basic-auth4/new-branch3 regression. Per-run self-signed leaf/matching IP SAN is rejected by actual Review Push with Http/Certificate before HTTP handler/review/intent/upload; exact full state/bytes/refs/private Send retained. Trust stores and verification unchanged; explicit saved URL correction to owned HTTP fixture requires fresh review and then succeeds. Not trusted TLS/provider/expiry/mTLS/proxy/platform proof or production downgrade guidance. Official [Bun TLS](https://bun.sh/docs/runtime/http/tls) and [OpenSSL req](https://docs.openssl.org/3.0/man1/openssl-req/) consulted; commands/scope/checkpoint in UI-TESTING/STATUS.

Initial discovery redirect capabilityba242f8: persistent3071791406092266/3011791406102074 each pass6, exact batch90184 terminal0/current unchanged release. Authenticated review succeeds before fixture moves discovery; native repeats original GET14 then refuses with submitted/resultnull/no POST/remote absent/full state-private Send retained. Owned second-origin sink receives0 requests/credentials/PACK; reload never uploads, explicit fixture restoration precedes fresh unchecked Inspect/retirement. One-shot redirect may retry original endpoint and legitimately accept original-server Push, so it is not evidence of refusal/leak. No alternate-origin challenge was actually reached; callback-origin protection/other codes/chains/TLS/provider/platform/full parity remain independent. Regression POST3076/Basic-auth4 passes; details/scope in STATUS.

Authenticated POST redirect capability8d8e3e2: saved post-redirect3071791405676658/3081791405686877 each pass6 on unchanged current release, batch23079 terminal0. Original authenticated receive-pack POST redirects to second owned loopback origin before Git execution; sink receives0 requests/POSTs/credentials/bodybytes, remote ref absent and durable finished/unknown receipt retained. Full data/private Send/refs preserved; reload/fresh unchecked Inspect/retirement cause no extra POST or target request. Basic-auth4/admission8 regressions pass. This verifies307/308 POST boundaries, not initial GET/other codes/chains/TLS/provider/platform/full parity. [Official git2 RemoteRedirect documentation](https://docs.rs/git2/latest/git2/enum.RemoteRedirect.html) consulted; remaining exact scope in STATUS.

Auth-refusal capability1de5820: basic-push-refused1791405467334 passes5 and basic-post-refused1791405477523 passes6, exact batch75474 terminal0. Real review auth succeeds then worker discovery401 refuses with bounded attempts/submitted-resultnull; alternatively discovery succeeds but actual POST401 before Git execution yields finished/unknown with refused POST2/authenticated POST0/remote ref absent. Full state/intent/snapshot/private Send retained, reload and fixture auth restoration never upload; fresh unchecked Inspect/explicit retirement succeeds without retry. Basic success/Inspect401/new-branch regressions pass, artifact unchanged. Synthetic same-origin Basic refusal only, not provider token expiry/OAuth refresh/TLS/proxy/redirect/platform/full parity. Exact counters/limits/remaining scope in STATUS.

Basic authentication capabilityeb4a225: actual product saved Basic credentials respond to real401 challenges in review/worker discovery and authenticated receive-pack POST; owned exact server tree accepted. basic-auth1791405145784 passes4; basic-inspect-refused1791405183778 passes5 with repeated401 bounded challenge delta<=4/no observation/no upload/no credential in error/full receipt-intent-bytes-server retention, fresh explicit Inspect after fixture recovery. Shared helper normal/Inspect503/InspectStop/native admission regressions pass, exact batch23908 terminal0; artifact unchanged. This is same-origin synthetic Basic acceptance, not OAuth/provider refresh/TLS/proxy/redirect/platform/full parity. Official callback documentation consulted: [git2 0.21 RemoteCallbacks credentials](https://docs.rs/git2/0.21.0/git2/struct.RemoteCallbacks.html#method.credentials). Remaining scope/checkpoint in STATUS.

Product normal capability634b682: equal1791404985405/fast-forward1791404995486 each pass4 through actual UI review/confirm/status/unchecked Inspect/retirement on current unchanged release. Equal yields durable unchanged/zero receive POST; fast-forward yields accepted/one POST with separately checked exact server commit/tree/old-tip ancestry. Full local state except saved intent/local refs/private held Send preserved. New-branch/non-fast-forward regressions pass3 each, exact batches6754/61582 terminal0. Basic normal product equality/advance now accepted at Windows owned-loopback scope; auth/provider/platform/other completion/fault/full migration/UX remain required in STATUS.

Snapshot ownership capability25e9f3b: saved owner-changed1791404817622/owner-missing1791404827698 each pass6, exact batch85977 terminal0. Controlled owner-marker change/removal after actual worker upload negotiation causes completion refusal/submitted receipt retention after real server acceptance. Reload does not resend; Inspect refuses before discovery/no observation minted, direct native retirement refuses before deletion, full receipt/intent/workspace/snapshot/private Send preserved. Exact original owner bytes are restored only by the fixture; fresh unchecked Inspect/explicit retirement succeeds without upload. Actual messages and limits in acceptance.json/STATUS. Current artifact unchanged; full Push/provider/platform/write/fault/migration/UX scope remains incomplete.

Actual receipt replacement refusal capability251ea0a: product receipt-write-failed1791404248519 passes6 on unchanged accepted release. Real server acceptance/complete tree followed by Windows finished-receipt write refusal retains submitted bytes/resultnull/full state; reload never resends. Initial retirement receipt write refusal retains exact receipt/intent/snapshot and requires fresh unchecked Inspect/explicit retry after lock release. Native9/retired restart/completed-server Stop4 regressions pass, all handles terminal. Actual OS5 observed at both writes. Earlier wrong32-only text assertion corrected, not accepted. STATUS pins remaining preparing/submitted receipt/marker/fault/auth/provider/platform/CI/release/full migration/UX scope; no complete parity claim.

Current capability commit90b68d0 and unchanged release1791402139954/1791402495453/result0 accept actual background Send/history invalidation (latest1791403342857), Inspect HTTP503 (1791403333218) and Inspect Stop/native disconnect (1791403267698),4 groups each. Native admission8/Pull/merge-copy/normal/Stop/completed-server Stop regressions pass; nine current result records/counters inspected and all handles terminal. Remaining partial-upload/pack/receipt-marker/auth/provider/platform/product/CI/release/full migration/UX scope stays explicit in STATUS. No complete parity claim.

Actual product review/history and Inspect recovery acceptance (2026-10-08): `history-before-confirm`1791402991158/replay1791403138887 passes4, real background private native Send/history200 persists while review is open; stale confirmation makes zero native Push IPC calls/no POST, retains complete current data/bytes and requires new explicit review before one valid upload/observed retirement. `inspect-failed`1791403059223 passes4 with actual remote discovery HTTP503 and `inspect-stop`1791403267698 passes4 with actual held-advertisement/native disconnect. Both mint no observation review, preserve prior receipt/intent/full persisted state/server commit/private Send and permit only fresh explicit Inspect/retirement without upload. Production artifact unchanged; exact final helper replay/remaining gates in STATUS. These are actual loopback/native product boundaries, not partial-upload/process/power-loss/auth/provider/platform proof.

Committed current capability:12c9a2a fixes stale live binding references across retirement/save waits; f98deb2 verifies actual fresh-negotiation OID race refusal. Headless12 and mounted actual native replacement4 complement each other at their recorded scopes. Product save/reply/replacement, restore/merge/Clone retained-copy and core Git regressions pass on release1791402139954/1791402495453/result0; all handles terminal and15 result records inspected. STATUS preserves remaining actual review/history/network/fault/auth/provider/platform/normal-completion/full migration/UX gates; no complete parity claim.

Current live replacement acceptance: release build1791402139954/1791402495453/result0/hash6138653783074166181; mounted actual native product1791402534402/replay1791402641786 passes4 each, preserving latest private edit/full current persisted data/held Send and clearing current live intent after native retirement. Headless coordinator12 complements this with private review/observation consumption and current-state/binding/admission/save races. Native admission1791402555534 passes8; actual captured old Git advertisement followed by independent server ref change causes fresh negotiation pin to refuse stale before POST, preserving concurrent ref/full local data. All individual tools terminal0; current shared-fixture/core regression handle in STATUS. Earlier pending statements below describe previous source checkpoints; full remaining scope stays active.

Live binding replacement correction in progress: saved headless production coordinator contract reproduces stale-object cleanup, then passes12 groups after reacquiring the exact current binding after asynchronous retirement. Failed tracking save restores intent only onto the current unchanged cleared binding, preserving newer intent/changed endpoint and authoritative durable state. This is adapter-level frontend evidence; new `retire-state-replaced` mounted App/native scenario and fresh release probe are required. STATUS holds builder and acceptance boundaries. Official Svelte reference: https://svelte.dev/docs/svelte/$state.

Verified milestone commits:3d6404c native Push/Inspect/retirement,4974117 private reviewed product flow/non-fast-forward guidance,ddfd0fe probe/recovery fixtures,84a591d saved real transport/admission/lifecycle/product acceptance. Current source/build/regressions and all remaining gates are pinned in STATUS. These commits preserve the full unfinished Push/migration/UX scope; no complete parity claim follows from them.

Current correction runtime acceptance: release build1791401011344/1791401382184/result0/hash3495617236535378001, builder40920 terminal0. Native admission1791401390375 passes7 and exact `nonFastForward`; product non-fast-forward1791401405859 passes3 with Fetch/Pull guidance/zero POSTs. Product source-before-confirm1791401419390 passes3 (real tip movement after review/no network/preparing no-stage receipt); source-advanced1791401437526 passes3 (actual later tip change after pack submission, server gets reviewed immutable commit/tree and later local ref preserved). Completed-stop1791401448661 passes4: real Git server completes update before held report-status; Stop observes disconnect/submitted uncertainty/reload/no resend/fresh unchecked retirement with actual remote commit retained. Every case preserves full live data except exact intent and private held Send cancellation0. Exact tools terminal0. Current regression batch/remaining scope in STATUS; earlier pending-correction statements below are historical.

Non-fast-forward correction pending fresh runtime evidence: native admission1791400828964 passes7 on previous release artifact, including actual rewind refusal/no second POST but receipt unknown. Current source maps typed git2 `NotFastForward` to `nonFastForward` only when no report-status callback/invalid negotiation occurred; libgit2 1.9.7 `queue_objects` refuses before transport upload (after negotiation). Other failures remain unknown. Frontend gives explicit Fetch/review Pull guidance. Installed Git source/error mapping and official https://libgit2.org/docs/reference/main/errors/git_error_code.html verified. Saved native admission now requires this exact outcome; product non-fast-forward mode requires zero POSTs/independent advanced server/full state/held Send/explicit retirement. New release build handle/status in STATUS; these assertions are not yet runtime acceptance of changed source.

Actual lifecycle acceptance (2026-10-08): parent1791400651123/reopen1791400653829 passes4 and Windows close1791400667456/reopen1791400670240 passes3 on the current release probe. Real parent termination leaves orphan lease that blocks fresh Inspect/retirement; controlled held-response EOF settles it without server Git execution. Real WM_CLOSE drains tracked product Push, observes disconnect and exits0. Reopen never resends; fresh unchecked review and explicit retirement preserve unknown receipt outcome, reclaim owned stage and restore full baseline/refs/HEAD. One receive POST and zero upload POSTs per scenario; server branch absent. Both exact tool invocations terminal0. This covers held-response boundaries only, not partial upload/server-success cancellation/power loss/provider/platform. Remaining gates and source/artifact identifiers in STATUS.

Status: implementation in progress. Native outgoing worker, snapshot supervisor,
durable receipts and separate Push/Inspect/retirement IPC/ACL compile and nine actual Windows
receive-pack command-contract groups plus real retirement restart pass on
build1791397873072/1791398319882. Product UI normal3, unknown-response/reload4,
hook-rejection3 and retirement reply/save-fault recovery4 per case pass.
Shared Field acknowledgment geometry passes and screenshot is inspected on this
production-profile probe. Earlier build-wait statements below are historical.
Native retirement/reclamation passes the explicit Windows deletion-refusal/retry,
restart and reply/save recovery boundaries; broader remaining gates are required.
This document does not claim Push or full Git parity is complete.

Held-response lifecycle acceptance on the same release probe: product Stop
1791399280822 and actual 300-second supervisor timeout1791399409063 pass4 each.
Real receive-pack POST is held before Git executes; native connection closes,
server ref remains absent, full local data/refs and private held Send remain,
reload/fresh observed-state review/retirement never resend. Timeout scenario
asserts native timed-out error and >=290000ms elapsed; whole scenario304s.
No shortened production deadline, OS-close/parent-death or server-completion
cancellation acceptance is inferred. STATUS contains current helper regressions.

## Contract

Push sends an already committed local revision. It never implicitly stages or
commits working resources. Review pins the collection, saved binding/endpoint,
local branch and complete commit OID, explicit remote branch and advertised old
remote OID (null means the branch does not exist). Confirmation is private,
single-use and must revalidate the original state. Credentials remain separate
from review, receipt and remote error messages, following the existing local
credential policy; no encrypted-storage claim is made.

Before submission the native supervisor must validate the saved binding and
operation, current local branch/OID and selected complete graph under the
existing admission locks. Copy the exact outgoing graph into a fresh owned bare
stage, create only the pinned source branch and release storage/Git locks before
network work. Never give a worker the managed repository path. The stage uses the
existing native staging owner marker and cooperative lease; source object files
must be plain, bounded and have no alternate stores. Unknown/foreign paths and
ownership changes refuse without deletion.

The supervisor must persist a submitted operation before starting the outgoing
worker. A repeated submitted operation, IPC failure, Stop, timeout, parent death
or uncertain process termination enters inspection, never a second upload.
Submission and inspection must be distinguishable commands. Inspection opens a
fresh remote discovery connection and reports the currently observed exact
destination OID; it does not infer attribution or definitive historic success
from equality. A subsequent attempt requires a fresh explicit review and
operation identity. Retain the original pinned operation if inspection itself
fails. No automatic retry or force option is permitted.

Push preserves local HEAD, refs, managed resources, private/foreign/local-only
data, request history and working changes. Only explicit operation bookkeeping
may update the saved binding after exact-baseline admission. It must use the
existing save queue/transition/recovery rules so completed remote work cannot
cause a stale complete workspace save. Network waiting alone must not cancel
an active Send. The integration must distinguish short persistence admission
from the long remote job and prove the intended concurrency with saved evidence.

## Current native worker

`src-tauri/src/git_remote/push.rs` receives a native-only stdin protocol via
`--insomnium-git-push-stage-worker-v1`, before Tauri/plugin/single-instance setup.
Renderer commands accept a saved Push intent/binding, never a worker path.
`git_push.rs` supervises this worker through shared bounded stdin/stdout, timeout,
cancel/kill/reap machinery. The private worker remains separate from renderer IPC.

- Canonical UUID, full nonzero lowercase SHA-1 IDs and exact heads branch names.
- Shared staging lease, exact owner marker and plain bounded ODB validation;
  complete selected graph checked without shallow cuts or alternate stores.
- Bare outgoing repository, pinned source ref, empty in-memory Git config;
  existing credential callbacks and default certificate verification.
- Receive-pack advertisement checks expected old remote OID. Equality returns
  `unchanged`, mismatch returns `stale`, neither uploads.
- Exactly one normal heads-to-heads refspec; no `+`, deletion or wildcard.
  `push_negotiation` checks the exact source/destination, new pinned OID and
  actual old remote OID again before upload. In git2 0.21, `PushUpdate.src()` is
  the old remote OID and `.dst()` is the new OID, confirmed against the installed
  crate and libgit2 `push.c` implementation.
- `accepted` requires successful transport, exact negotiation and exactly one
  matching per-ref callback with no rejection. A matching rejection callback
  yields `rejected` even when transport reports success. Invalid/missing reports
  or transport errors yield conservative `unknown`. Raw server messages are
  omitted because they can contain URLs or credentials.
- `advertisedRemoteOid` describes the observation BEFORE upload, never the final
  remote state. A supervisor must perform the separate required inspection for
  uncertain outcomes. None of these values proves who last changed the remote.
- Push options disable off-site redirects. Initial `connect_auth` still follows
  the existing discovery policy; broader redirect/provider/proxy/TLS acceptance
  is required. The orphan-worker watchdog bounds lifetime at 305 seconds; parent
  supervision uses the shared 300-second limit and existing job cancellation.
  Stop, timeout and lifecycle behavior still require runtime evidence.

## Current native supervisor and receipts

`git_remote_push` requires the exact saved version1 submitted intent and full
binding, normalized endpoint, single public collection/unique native repository
binding and no conflicting saved Fetch/create/remote-checkout intent. Short Git
then Storage admission validates HEAD/branch, collection commit and full graph;
copies hash-checked objects to an exclusive bare native stage with no external
template; creates only the pinned branch. Graph and plain ODB are revalidated.
No local refs or workspace bytes are written by Push.

Exclusive `git-push-v1/push-<UUID>` contains a bounded64KiB receipt without
credentials. Phase `preparing` is saved before snapshot work; `submitted` with
exact stage name/owner marker is saved after flushing recovery material and
before spawning any remote worker. Stage creation-to-receipt and interrupted
preparation can leave retained orphan material; no stage deletion or automatic
resubmission is inferred from those gaps. Power-loss/midwrite/disk-full remain
unverified. The outgoing `.insomnium-push-snapshot` marker pins the operation
and causes existing idle Fetch cleanup to refuse that stage as unexpected
top-level material. Explicit Push retirement owns the separate cleanup path below.

Same-operation submission reconciles an existing receipt or refuses through the
bounded job registry; existing directory without receipt also refuses. It never
uploads again. Worker errors/cancellation/uncertain completion retain submitted
receipt and stage. Confirmed returned outcomes produce a `finished` receipt only
after exact previous receipt/stage identity/result pin verification. Completion
does not write or require the old live workspace, avoiding stale full saves.

`git_remote_push_inspect` requires a fresh attempt UUID and the saved binding;
refuses live same-process jobs and reacquires an exclusive recorded stage lease
to refuse surviving workers after parent interruption. It uses only a fresh
discovery worker; reports current destination OID and equality with pinned commit
without attribution or historic-success inference. Exact binding/receipt are
checked again after network completion. Missing receipt remains inspectable but
does not authorize upload. No startup path automatically submits Push.

The existing Advertisement/Fetch worker response serialization now uses an
intermediate JSON value to share worker entry with Push. Its external Result
shape remains the same in source; a fresh native build and saved regressions
must prove compatibility. A compiler pass is insufficient runtime evidence.

## Remaining implementation and acceptance

Current retirement source: `git_remote_push_retire` admits a fresh attempt and
exact reviewed receipt/current binding, checks operation idleness, holds an
exclusive snapshot lease, exact owner/operation marker and bounded plain tree,
and rejects unexpected top-level material. It atomically writes phase `retired`
before payload/container deletion and keeps the receipt/operation directory
permanently to prevent repeat upload after restart. Cleanup failures retain
tombstone and tracking for fresh Inspect/explicit retry. Changed/foreign owners
or an existing receipt-less directory refuse adoption/deletion. Retired Inspect
does not reopen reclaimed stages. Frontend clears only exact current intent after
a validated retired receipt without stage identity; remote outcome is preserved.
Native1791398375318 passes9 including actual Windows deletion refusal, retired
Inspect and explicit cleanup retry; retirement restart1791398383699 passes.
Product normal1791398399342/unknown1791398409795/rejected1791398419977,
retirement lost reply1791398430029, save refused1791398556351 and actual
successful-save lost reply1791398566335 pass. All exact sessions terminal0.
This is explicit destroy/reopen and controlled IPC loss, not OS-close, parent
death, true transport/process interruption, diskfull or powerloss acceptance.

Official references for this work: [Rust File locks](https://doc.rust-lang.org/std/fs/struct.File.html#method.try_lock)
and [remove_dir_all](https://doc.rust-lang.org/std/fs/fn.remove_dir_all.html).
Recursive removal can fail partway; durable no-resubmission/ownership evidence
precedes reclamation. These cooperative guards do not prove hostile external
replacement, powerloss/diskfull or partial container-marker-loss safety.

Current frontend source in git-push.js/workspace/GitRemotePanel/GitPushReview:
private one-use review and exact full-before guard, saved settings and source pin,
live queued intent save, separate tracked cancellable Push/Inspect without a
global Send drain, outcome/operation-aware pending state, required initially
unchecked observed-state acknowledgment and exact-binding local tracking clear.
No automatic retry or complete stale snapshot application follows a response.
Native retired receipts remain as permanent tombstones; explicit reviewed
tracking clear reclaims only validated owned snapshots and retains intent on
unconfirmed retirement/persistence. The basic normal workflow and recorded
recovery cases pass; broader normal-completion/product/UX/lifecycle requirements
remain open. STATUS retains exact historical builder/source boundaries and
current regression process identities.

1. Extend the accepted basic native supervisor/receipt/Inspect scenario with
   server rejection/race/uncertainty/lifecycle/fault/admission boundaries.
2. Explicit retirement and owned snapshot cleanup; no upload on submitted
   retries/reload/startup/unknown result, even when inspection/retirement fails.
3. Frontend private review/confirm/Inspect with exact saved binding and full
   snapshot guards, operation-aware recovery and existing Git/shared UI layout.
4. Saved reusable Playwright JavaScript scenarios with an owned loopback real
   receive-pack server: new branch, equality/no upload, normal fast-forward,
   non-fast-forward and hook rejection, advertisement-to-negotiation race,
   negotiation-to-server race, dropped completed response, Stop/timeout/reload/
   parent interruption, local changes and held Send/full workspace preservation.
   Assert server refs/objects separately, not only the returned outcome.
5. Fresh native build plus current Fetch/Clone/Pull/checkout/Source Control
   regressions. No overlapping native scenarios; require exact terminal handles.
6. Provider/login-refresh/proxy/TLS/redirect/platform/lifecycle/fault/CI/release
   and every remaining migration/UX parity gate remain required independently.

Use only disposable owned loopback endpoints for development acceptance. No
Push to the owner's real remotes is authorized by the migration goal.

## Official documentation and commands

- [Git push](https://git-scm.com/docs/git-push): explicit refspec and non-force
  branch update behavior.
- [git2 0.21 RemoteCallbacks](https://docs.rs/git2/0.21.0/git2/struct.RemoteCallbacks.html):
  negotiation can refuse before upload; per-ref status indicates rejection.
- [git2 0.21 remote source](https://raw.githubusercontent.com/rust-lang/git2-rs/git2-0.21.0/src/remote.rs):
  anonymous remote, push options and redirect policy.
- [Svelte state](https://svelte.dev/docs/svelte/$state): raw review objects and
  JSON copies for reactive workspace data; shared existing component APIs reused.
- [MDN AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal):
  tracked cancellation and listener cleanup.
- Installed `git2-0.21.0/src/push_update.rs` and
  `libgit2-sys-0.18.8+1.9.7/libgit2/src/libgit2/push.c`: exact old/new OID mapping.

Commands: targeted `rustfmt --edition 2021 src-tauri/src/git_push.rs
src-tauri/src/git_remote/push.rs src-tauri/src/git_remote_job.rs`;
`cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` (pass);
`bun run check` (0 errors/0 warnings); `bun tests/ui/build-recovery-copy-probe.js`
(terminal0, build1791391574460/1791392013022/result0). The saved scenario is
`bun tests/ui/git-push.js`: six native contract groups for new branch/exact
complete server tree/local full preservation, repeat/Inspect/no resend, equality,
normal advance/complete ancestry, stale expected OID and actual completed
receive-pack followed by HTTP503/unknown result/fresh Inspect without resend.
Run1791392039742 passes all6, session91009 terminal0, independently verified3
receive-pack POSTs for3 intended updates and0 upload-pack POSTs. It does not
exercise product Push controls, held Send, rejection/races or lifecycle.
Same-artifact Fetch1791392084284/restart1791392092313 (session2279 terminal0)
and normal Clone1791392104319 (session51056 terminal0) pass. All handles terminal.
JavaScript tooling/scenarios continue to use Bun; browser scenarios remain
headless and native scenarios hide their owned window. Official ODB/Repository
pages were unavailable on this continuation; the installed crate API and existing
verified native Clone object-copy/initialization pattern were reused.


</details>

<a id="record-git-remote-checkout"></a>

<details>
<summary>GIT-REMOTE-CHECKOUT</summary>

# Remote branch checkout

The existing Remote panel can fetch a complete selected remote branch, review its collection changes, create a new local branch and switch through the existing journaled checkout. This operates on an installed collection and managed repository. Staged Clone is still required separately, including empty/no/multiple/existing-workspace installation cases.

## Admission and persistence

Network Fetch happens before the request drain. The review pins the local branch/revision captured before Fetch, endpoint, immutable snapshot, selected remote branch and full target revision. Reading or cancelling the review creates no local branch and does not change workspace bytes, index or an active Send. Local reconciliation conflicts disable confirmation; private requests, foreign collections and connection metadata remain local.

Confirmation owns the existing workspace drain and persists a version1 `nativeRemoteCheckoutIntent` through prepared, submitted and created phases. The native command checks the exact saved binding/intent, current snapshot, complete selected history and valid source/target collection trees. It locks HEAD/source/target and creates only a new local ref. It never switches HEAD or writes workspace/index. Existing different tips and case aliases are refused. An existing equal tip is also refused unless its latest reflog proves this exact operation, zero-old creation, revision and author.

Continuation after a submitted/created intent is verify-only: an absent branch is never recreated. A completed native creation with a lost IPC reply retains the intent and original HEAD. After exact creation verification, schema1 checkout applies the full collection reconciliation with its existing journal/recovery. The final save records `nativeRemoteBranches` local/remote/endpoint/creation/snapshot identity and removes the intent. Forget removes only the saved intent; it never deletes or rewinds the created branch. Pending intents block public Fetch/settings and other frontend Git mutations.

## Saved native evidence — Windows, 2026-10-07

Fresh isolated build started1791378895562, finished1791379275819, result0, fixtureHash6820601272446002580; builder25591 terminal0. Native targeted Rust formatting, Cargo check/Clippy `-D warnings` and frontend check0 errors/0 warnings pass.

- `bun tests/ui/git-remote-checkout.js`: artifact `artifacts/playwright/git-remote-checkout-1791379481936`, seven groups. Real smart-HTTP full packs; read-only review/cancel; held native Send drained only on confirmation; real creation followed by controlled lost success reply; reload/verify-only resume without another download or ref rewrite; exact complete remote tree/executable mode/source ref/index/full private workspace and binding; fresh persisted200; stale snapshot/verify-only absent/existing equal-or-different tip refusal; normal explicit confirmation; explicit Forget retaining the created ref.
- `$env:INSOMNIUM_REMOTE_CHECKOUT_CONFLICT='1'; bun tests/ui/git-remote-checkout.js`: artifact `artifacts/playwright/git-remote-checkout-conflict-1791379512542`, local-and-remote edit blocks confirmation with exact full workspace/ref/index and active Send preserved. The same saved scenario and shared fixtures are reused.

Both runs record `renderingMode: native-hidden`, owned PID/window and visible:false. Browser-only fixtures use headless Chromium. Screenshots remain available for review.

Final display refinement uses request names and readable conflict explanations. Fresh builder53742 terminal0, build1791379696923/1791380065818/result0/hash9568362250211973830. Sequential final checkout1791380135083 passes7, conflict1791380171711 passes1; updated screenshot inspected. Accidental overlapping probe launch1791380095005/startup refusal and first run1791380072404/final-review timeout are excluded; both handles were terminal before the passing sequential replay. Previous same-workflow Source Control1791379531842 (13), Pull1791379565179 (8), divergent1791379633402 (5) regressions pass before this display-only refinement. All final handles terminal and owned servers released.

This evidence does not establish process interruption during ref creation, the ownership persistence gap, midwrite/powerloss/diskfull, provider credentials, external concurrent ref/snapshot mutation or other platforms. A superseded snapshot/source conservatively refuses continuation and retains the intent; explicit Forget does not undo a previously created branch. Clone, nonforce Push, broader fault/provider/platform/CI acceptance, all remaining PARITY and remaining shared-input/UX work remain required. POST-MIGRATION-UX.md records the later owner authorization to start Nocturne/shared UI during migration; that does not remove migration requirements.

## Documentation and commands

Consulted [Git switch](https://git-scm.com/docs/git-switch) and the installed git2 Repository/transaction source before implementation. The versioned docs.rs Repository page was unavailable during lookup. New command permission was generated through the project's existing Tauri `build.rs` command generator; generated permission content was not authored manually.

`bun tests/ui/build-recovery-copy-probe.js` builds the isolated native fixture. `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`, `bun run check` and `git diff --check` validate the changed production source. Use the current recovery-copy build state explicitly when running Source Control regressions, whose older default is a separate probe.


</details>

<a id="record-git-remote-lifecycle"></a>

<details>
<summary>GIT-REMOTE-LIFECYCLE</summary>

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
4. Verify orphan watchdog/OS-close lifecycle and transport/provider constraints; continue the complete GIT.md#record-git-remote backlog.

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


</details>

<a id="record-git-remote"></a>

<details>
<summary>GIT-REMOTE</summary>

# Git remote migration contract

2026-10-08 transport review: native Git detached/isolated libgit2 inputs include
endpoint/credentials and retain default certificate validation; they do not
receive HTTP workspace caPem/identityPem settings. The legacy Git axios adapter
also supplies no explicit CA/identity settings. HTTP mTLS acceptance997f0a7 does
not establish Git TLS upload/trust/provider behavior. Authenticated trusted Git
HTTPS/proxy/provider/platform gates remain required; no Git trust policy changed.

2026-10-08 capabilityf30e195: saved git-remote-lifecycle.js opt-in public TLS mode
accepts anonymous actual native HTTPS advertisement matching independent Git CLI
refs/default HEAD. Native wrong-host and expired-certificate refusals are independently
classified by Bun; exact full workspace bytes/data/local refs/repository info remain
unchanged. Final1791411327755 passes9 with existing cancel/pre-cancel/real30s timeout;
same current release mounted self-signed Push refusal1791411376365 passes5.
No trust-store/production configuration change or public Push. Public endpoints may
change; this does not prove server-side negative request counts, authenticated HTTPS
upload, provider refresh, mTLS, proxy or other platforms. Those and full migration/UX
remain required. Sources/commands in UI-TESTING; exact artifact/handles in STATUS.

2026-10-07 Pull completed-Fetch reply uncertainty: shared operation-aware Fetch/Pull error and explicit inspection instruction. Fixed saved1791377578393 passes5 with real native pack publication and controlled lost-success IPC acknowledgement: exact pending intent/full workspace/local ref/index and held Send preserved, no automatic merge; reload and Inspect avoid network and clear only confirmed intent; later explicit Pull requires second review and applies once/fresh200. Current Fetch5+4+4/Pull8/divergent5/retained-copy/headless/native-close regressions pass, fresh build/check pass. Exact scope in [GIT.md#record-git-pull-uncertainty](GIT.md#record-git-pull-uncertainty); test modes in [UI-TESTING.md](UI-TESTING.md). Remaining network/process uncertainty and full original parity stay required.

2026-10-07 rename/file-directory review: stage0 children colliding with conflict paths are promoted to explicit pinned file-side conflicts. Native paths1791376467375 passes5; actual smart-HTTP Pull1791376482685 passes7/7 download rounds, verifying pinned paths/content, cancel, mixed refusal/retry, both complete side confirmations and exact complete trees/modes/parents/full workspace/index. Full descriptor/choice and final collision guards retained. Contract and remaining scope in [GIT.md#record-git-path-conflicts](GIT.md#record-git-path-conflicts); full migration remains open.

2026-10-07 conflict-edge milestone: inspect no longer rejects a collection because an external status filename is non-UTF8; exact optional pathBytes and hex display retained. Real saved edge Pull1791375357926 passes5 groups with11 conflicts/2 native smart-HTTP pack rounds, proving distinct raw names through status/preview/custom executable confirmation, missing gitlink identity, symlink and complete side choice despite per-file/aggregate omitted previews, cancel/full preservation and exact complete final tree/parents/workspace. Current Source Control13/divergent5/check/Cargo/Clippy/build pass; wrong old-default-probe regression excluded and rerun on fixed build. Contract/evidence in [GIT.md#record-git-conflict-edges](GIT.md#record-git-conflict-edges). Rename/ancestor collision and remaining history/network/provider/platform/fault/clone-push/full parity remain required.

2026-10-07 recursive base capability: multiple actual common ancestors now use recursive merge_commits rather than refusal or heuristic selection. Native candidates retain sorted actual mergeBaseOids (single mergeBaseOid=null); resolutions require exact full ordered set. Schema3 pins this set and target's ordered old/incoming parents; application/recovery revalidate graph without computing merge under StorageState. Schema1/schema2 compatibility retained; schema2 divergence now requires exactly one actual base. Final native bases1791374388057 passes8 (clean two/three/nested result vs Git, conflicted virtual preview, exact resolution/forgery refusal, actual Windows recovery and synthetic reader states); actual smart-HTTP recursive Pull UI1791374071314 passes3. Reader20/preparation11/writer8/divergent5/contract9/check/build/Cargo/Clippy pass. Details and remaining scope in [GIT.md#record-git-merge-bases](GIT.md#record-git-merge-bases); full Pull/Merge/migration remain incomplete.

2026-10-07 Pull network failure milestone: existing saved Pull1791373254105 now passes8 actual native groups, including incomplete pack EOF and explicit Stop while actual upload-pack response held/observed connection abort. Exact full workspace changes only persisted Fetch intent/retirement metadata; local ref, active Send and absence of merge journal/owned locks preserved. Pending blocks another Pull; Inspect and explicit retirement perform no network; subsequent Pull succeeds. Current shared-helper divergent1791373286302 passes5 and compiler/diff pass on unchanged successful build. This does not establish timeout/midstream socket reset/completed-Fetch reply loss/Pull copy-close/multiple-base/provider/platform/full parity. Official HTTP protocol documentation and commands in STATUS.

2026-10-07 selected history milestone: native merge classification uses existing bounded object-graph validation for source/incoming and rejects reachable declared shallow cuts even when parent objects exist. Unrelated retained snapshot cuts no longer block complete histories; preparation never changes shallow metadata. Saved history1791372820452 passes6 actual smart-HTTP groups, including absent unrelated parent restored by explicit full Fetch and absent selected managed intermediate restored by complete-history Pull before review despite depth field1. Exact cut bytes/physical parent/complete manifest/full workspace/ref checked; empty published shallow marker is not evidence of missing ancestry. Current native preparation11/divergent Pull5/check/build/Cargo/Clippy pass. Multiple/virtual bases and other source/server-shallow/network/provider/platform/full parity requirements remain open. Docs and commands in STATUS.

2026-10-07 divergent network Pull milestone: saved git-pull-divergent1791371749077 passes5 Windows native groups for actual complete-history smart-HTTP packs/pinned binary content, cancel/no write/no request drain, ours/theirs/delete/custom executable plus working incoming review, exact complete merged tree/ordered parents, actual post-ref workspace write refusal/schema2 durable full candidate/authoritative recovery/no duplicate/fresh200. Current fast-forward Pull1791371788565 passes6 after sharing smart-HTTP helper. No application/native changes or redundant rebuild. Remaining non-UTF8/gitlink/large/rename/ancestor-path UI, network interruption/reply-loss/copy/close acceptance, shallow expansion/multiple or virtual bases, providers/platform/faults/clone/push/full parity stay required. See STATUS.

2026-10-07 network Pull review milestone: Remote now offers Review pull for an explicit branch, fetching complete history before existing merge review. Pins local branch/HEAD before network, current immutable Fetch snapshot/branch/revision, saved binding and normalized settings; confirmation retains native source admission/journal/drain/recovery. Final saved Windows loopback git-pull1791371338822 passes6 groups with4 real advertisement/pack download rounds, full cancel/workspace/ref preservation, confirmed fast-forward/held HTTP drain, up-to-date keeping active Send and local-ref change during gated advertisement refusing review. Same-build local merge5/Remote settings8/Source Control13/injected contract8 pass. This does not prove divergent network Pull, network fault recovery/copy/close, shallow expansion/multiple or virtual bases/providers/platform/full parity; those requirements remain open. Official Git Pull and Svelte props docs/commands recorded in STATUS.

2026-09-30 latest checkpoint: Fetch now uses shared native process supervisor (300s cap/305s watchdog; advertisement remains30s/35s), with staging ancestor symlink/reparse checks. Cargo checks and29 native assertions passed. Parent-owned allocation/cleanup, publication, IPC/UI and full parity remain pending. See GIT.md#record-git-fetch-staging.

2026-09-30 latest checkpoint: Isolated fetch staging primitive/private worker dispatch implemented. Cargo checks passed; real-pack15 assertions and advertisement14 regression assertions passed. Supervisor/path ownership/publication/UI remain pending; multi-ref Transaction is not atomic. See [GIT.md#record-git-fetch-staging](GIT.md#record-git-fetch-staging). No native app rebuild; full migration incomplete.

2026-09-30 latest checkpoint: Remote settings build finished0; saved native Playwright passed8 checks (save/read/reload/auth error/Stop/endpoint edit/dialog close/data preservation). Evidence git-remote-settings-1790770895847. Next scoped fetch, advance-ref journal/pull/merge and remaining remote/parity workflows; actual providers remain unverified.

2026-09-30 latest checkpoint: Remote settings/read/Stop UI implemented in existing Git dialog.15 model/export assertions and frontend checks/build passed. Saved Playwright settings scenario awaits native build PID30728 at artifacts/native-remote-settings-ui-probe/build-state.json. No mounted UI acceptance yet. Poll same build; next run test:ui:git-remote-settings.

2026-09-30 latest checkpoint: Remote client and tracked workspace advertisement wrapper implemented; 10 client + 6 wrapper assertions and frontend checks/build passed. Settings/connection/Stop controls and mounted UI verification remain next. Evidence: artifacts/git-remote-client-check; details in STATUS.md.

2026-09-30 latest checkpoint: Isolated remote build finished0; saved Playwright native lifecycle passed7 named checks, including actual 30021ms timeout and existing Git UI responsiveness. Evidence git-remote-lifecycle-1790769998943. Settings/remote Stop UI/providers and remaining workflows are pending; next client/workspace admission integration.

2026-09-30 latest checkpoint: Advertisement now uses a cancellable native worker process with bounded lifecycle/registry. Cargo checks and 14 actual-source assertions passed. See [GIT.md#record-git-remote-lifecycle](GIT.md#record-git-remote-lifecycle); isolated app/IPC/settings/UI acceptance remains pending.

Updated: 2026-09-30. **Native advertisement primitive implemented and standalone checked; lifecycle/settings/UI and remaining remote workflows are incomplete.** This extends GIT.md#record-git-inventory and GIT.md#record-checkout-transaction. Local create/switch/delete acceptance does not satisfy this contract.

## Native remote advertisement primitive — 2026-09-30

- Previous goal turn made progress by recording the owner's deferred shared-input/UX phase. Current migration scope remains unchanged.
- Added src-tauri/src/git_remote.rs and git_remote_advertise handler/build-manifest/capability. It uses a detached git2 remote, so no local repository, HEAD, workspace or refs are opened/modified. Network work runs outside GitState/StorageState.
- Input currently requires normalized HTTP(S) URL and explicit anonymous/basic/github/gitlab credentials. URL embedded credentials/fragments/control characters rejected; credentials bounded, basic username colon rejected. GitHub token/x-oauth-basic and GitLab oauth2/token mirror legacy callback mapping. No credential persistence/provider refresh yet.
- Credential callback checks requested origin and bounds callback attempts. Default certificate verification remains enabled. Errors return libgit2 class/code rather than server messages that may echo secrets. This is not evidence of all redirect credential behavior; cross-host redirect, TLS/proxy and actual providers still need acceptance.
- Output distinguishes zero advertised refs from zero branches, includes server HEAD symref/default branch and head OID, sorted full branch refs/OIDs, and rejects oversized/invalid/duplicate branches or incompatible OID width. Does not infer the default branch from alphabetical ordering.
- Cargo fmt/check/clippy -D warnings passed. Initial compile exposed callback lifetime declaration order; corrected and retained initial-failure.json. Generated permission file produced through existing AppManifest build.
- Actual-source Rust stdin probe compiled and ran against a temporary Bun loopback smart-HTTP advertisement fixture: 14 assertions passed for anonymous, basic/provider credential mapping, wrong credentials, empty advertisement, sorted branches/default HEAD, invalid URL and basic username. Synthetic advertised OIDs do not represent downloadable objects; this is not fetch/clone evidence. No saved new test script or browser-use. Fixture stopped and native process exited 0.
- Evidence: artifacts/git-remote-advertise-check/state.json, probe-state.json, probe-build.log, probe-runtime.log. No new native app release/probe build, no mounted UI/Tauri IPC acceptance yet.
- Next add bounded network lifecycle/cancel and settings/client admission before exposing this in UI, preserve URL input normalization compatibility, then saved Playwright remote scenarios. Provider token storage/refresh, fetch, advance-ref journal, pull/merge, clone and push remain pending. Full migration is incomplete.
- Docs used: https://docs.rs/git2/latest/git2/struct.Remote.html ; https://docs.rs/git2/latest/git2/struct.RemoteConnection.html ; https://docs.rs/git2/latest/git2/struct.RemoteHead.html ; https://docs.rs/git2/0.21.0/git2/struct.RemoteCallbacks.html . Installed git2 0.21.0 source also checked; no dependency install/init required.

## Evidence and compatibility

Legacy paths below are relative to _backup/legacy-electron/packages/insomnia/src/. Inspected source, not production credentials.

| Source                                            | Observed behavior                                                                                                                                                       | Migration requirement                                                                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| models/git-repository.ts                          | Local-only repository model: uri, credentials, author, needsFullClone, uriNeedsMigration; cannot sync/duplicate                                                         | Keep connection/auth metadata out of resource trees and portable exports; import legacy connection settings deliberately                  |
| ui/routes/git-actions.tsx:328                     | Hosted URL conversion followed by scp-like git@host:path and ssh:// fallback to HTTPS                                                                                   | Preserve supported input forms with a visible normalized endpoint; distinguish input compatibility from actual SSH transport              |
| sync/git/utils.ts                                 | Basic username/password; GitHub token as username + x-oauth-basic; GitLab oauth2 + token; provider token lookup and GitLab refresh                                      | Implement explicit anonymous/basic/GitHub/GitLab modes and provider token lifecycle, not only a generic password field                    |
| git-actions.tsx:540                               | Update URI, author and credentials; new bindings require full clone                                                                                                     | Save settings atomically, invalidate stale sessions when changed, expose connection errors without losing entered values                  |
| sync/git/shallow-clone.ts and git-actions.tsx:349 | Single-branch depth-1 preview; require one Workspace when present; no workspace creates design workspace; existing ID navigates to existing workspace; later full clone | Stage clone separately, validate resources/topology before workspace installation, handle no/multiple/existing workspace cases explicitly |
| sync/git/git-vcs.ts:239,279                       | Remote branch advertisement; origin configuration                                                                                                                       | Read advertised branches separately from local branches; show network failure rather than silently treating it as empty                   |
| sync/git/git-vcs.ts:407                           | Fetch supports single/all branches, depth/relative, prune and pruneTags                                                                                                 | Track fetched refs independently of local branch/resource application; preserve depth/prune behavior in the compatibility backlog         |
| git-actions.tsx:921                               | Push current branch; equality check gives Nothing to push; action reads force but does not pass it to push                                                              | Normal push and explicit rejection reporting required. Do not infer that legacy UI actually force-pushed from the unused form value       |
| git-actions.tsx:998                               | Fetch depth 1 then pull; Git writes flow through database-backed filesystem                                                                                             | Pull must update native refs and workspace as one recoverable transition, including local edits                                           |
| sync/git/git-vcs.ts:398                           | Merge current branch with chosen branch                                                                                                                                 | Support fast-forward, up-to-date, divergent merge and conflict workflow; fast-forward-only is an intermediate milestone                   |
| sync/git/http-client.ts                           | Electron HTTP transport, redirects and binary body                                                                                                                      | Replace with native transport; verify proxy/TLS/redirect/provider compatibility independently                                             |

Legacy clone also preserves files outside .insomnium through its routed filesystem. Native merge/push must preserve the complete Git tree; the resource codec only owns .insomnium. Do not reconstruct a remote repository solely from application resources.

## Versioned journal foundation and remaining caller gap

2026-10-07 foundation accepted on Windows: src-tauri/src/git_journal.rs reads schema1 checkout and schema2 same-branch advancement recovery records. Version1 lock_refs still rejects equal source/target branches and requires both tips to remain at their recorded OIDs; its recovery distinguishes before/after by symbolic HEAD branch identity. The checkout command explicitly rejects schema2. Schema2 reader validates exact old/new OIDs, pinned graph inputs and collection trees, then classifies recovery by branch tip plus whole workspace. Current saved native git-advance-recovery1791360359200 passes20 synthetic-state/refusal/actual Windows write-failure checks and schema1 compatibility. Registered git_repository_advance with generated permission/default capability passes actual writer/ref-interruption/completed-command-loss/recovery acceptance below. Public network pull/merge commands/planner/UI are still absent.

Version1 **cannot** represent pull/merge advancing the current branch: symbolic HEAD stays on the same branch while its OID changes. Removing its equal-branch guard would make recovery ambiguous. Use the accepted schema2 advance-ref writer and explicit OID recovery when wiring pull/merge to workspace writes. Preserve support for recovering existing version-1 checkout journals.

Advance-ref record: operation/repository/workspace IDs, exact branch reference, old/new OIDs, before/after workspace, and pinned merge inputs. Native validates candidate resources and complete commit tree. Under GitState then StorageState, lock HEAD and the branch, require symbolic HEAD/name and old OID, persist journal, then compare-and-update ref. Recovery uses:

| Branch tip | Workspace                                                        | Result                                                       |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| old        | before                                                           | Nothing applied; retain before and finish aborted transition |
| new        | before                                                           | Complete recorded after workspace                            |
| new        | after                                                            | Verify and finish cleanup                                    |
| old        | after, unrelated tip, detached/changed HEAD, unrelated workspace | Refuse overwrite; retain journal for recovery                |

These rules are implemented and accepted for synthetic reader states plus actual native writer interruption/outcome boundaries on Windows. Schema2 retains the existing envelope fields with equal sourceBranch/targetBranch and distinct sourceOid/targetOid; its required advance field contains kind (fastForward or merge), incomingOid and mergeBaseOid. Fast-forward pins incoming=new/base=old and proves ancestry; merge pins exact ordered old/incoming parents and their base, requiring divergent inputs. No shape allows schema1 to be reinterpreted as advancement. Lost replies must re-enter recovery and inspect recorded state; they must not trigger an automatic second pull, merge commit or push.

The writer accepts the same input envelope as checkout (journal, authorName, authorEmail), requires a loaded session and exact persisted before workspace plus clean symbolic HEAD/old branch tip, validates graph and collection preservation, then writes the durable journal before one branch target update. New advance ref-lock ownership/lease is separate from restore: HEAD stays read-only, only the recorded branch may contain its canonical newOID+LF before rename. Recovery removes matching orphan locks after the actual OS lease proves no live owner; unknown/replaced/partial contents remain retained. It never advances a ref during lock recovery. Every error after journal persistence requires the authoritative loader; a native success returns only after the schema2 reader verifies new tip/after workspace and cleanup. No network or merge computation occurs under StorageState. The frontend pull/merge coordinator still must drain runs, reconcile full resources, retain unexpected live edits and reload after uncertainty before calling this primitive.

## Implementation sequence and exit evidence

Mounted actual merge drain/recovery milestone: saved git-merge-recovery1791368419860 passes6 groups against unchanged successful build1791367298075/1791367681295. Existing production workspace coordinator/UI/native command verified at actual baseline file-sharing failure (zero merge IPC submissions), post-ref workspace file-sharing failure (schema2 journal persists/new ref/old full bytes, ordinary save refused, Escape cannot dismiss recovery, authoritative load completes exact candidate/cleanup), injected completed-success transport reply loss (one command, one native success, no resend), actual held Send cancellation/full data/no cancelled history/fresh persisted200, and up-to-date preserving active HTTP/exact workspace bytes/data/ref until explicit user Cancel. Strict full expected incoming request includes documented legacy type marker; fields are not ignored. Independent exact owned fixture ref rewinds separate cases. No retained-copy/OS-close/crash/power-loss/disk-full/other-platform or network Pull acceptance is claimed; those and remaining conflict-choice UI/history/multiple-base/full feature stay open.

Working conflict display milestone: merge-only client enrichment indexes canonical base/captured local/immutable candidate public YAML, names actual local-and-incoming conflicts and exposes explicit absent/omitted sides with256 KiB each/2 MiB total preview-copy bounds. Protected/type/foreign/topology conflicts get no content. Existing planner candidate/resolution guards remain authoritative and independent of detached display tampering. Existing UnifiedDiff renders base→local and base→merged in expandable details; human-readable reasons and named second-review changes replace opaque-only labels. Fresh build1791367298075/1791367681295/result0 and mounted git-merge-ui1791367714792 (5 groups) prove exact URL contents/red-green decoration/readable name/both actual choices/full workspace/privacy/metadata alongside prior divergent custom merge; current Source Control1791367740022 (13), extended injected contract8 and final checks pass. Injected bounds/protected/import-metadata/deletion cases do not establish native edge-case UI acceptance. Next remaining Git-choice/binary/path UI and actual merge-specific drain/uncertain reply/write refusal/retained-copy/close/network/history/multiple-base gates; full feature remains unfinished.

Pinned conflict display milestone: prepare_merge includes unique conflictContents read only from described immutable OIDs. ODB headers gate preview reads; files above256 KiB and entries exceeding2 MiB cumulative loaded preview bytes return metadata without content, binary returns first128 bytes as hex, nonbinary valid UTF-8 returns full bounded text, gitlinks retain commit identity without assuming commit presence. Resolution descriptors remain exact byte path/OID/mode triples. Client verifies descriptor/content association, allowed modes/paths, kinds/sizes/text/hex/bounds before detached display. Existing review supports base/current/incoming details and absent sides, exact hex for non-UTF8 path, custom existing side path and regular/executable file mode. Custom input is UTF-8 text; no binary editor claim. Fresh build1791366377398/1791366765195/result0: preparation1791366801347 (11), mounted UI1791366823384 (4 including pinned text/custom executable divergent application), source-admission1791366856058 (5), injected contract8 and checks pass; STATUS records exact scope and screenshots. Remaining working diffs/both choices, other Git resolution/path/binary UI and actual merge-specific drain/recovery/copy/close/network/history/multiple-base gates remain open.

Mounted local-branch milestone: workspace now wires the merge coordinator to real drain/persistence/apply/recovery and retained-copy routing. Existing Branches dialog opens a raw single-use review, conflict choices require a second review and confirm owns its drain rather than registering work it would await. Saved git-merge-ui1791365757414 passes3 native production UI groups for read-only working conflict/cancel, incoming working resolution plus exact schema2 fast-forward/privacy/full metadata, and up-to-date no-write; source-control1791365773566 (13) and restore1791365792163 (17) regressions pass on fresh build1791365308572/1791365707371/result0. Undefined bindable choice initialization and helper loading race corrected; STATUS records failures/screenshots/checks. Full pinned content/mode/path and readable resource diff review, divergent conflict/both working choices, merge-specific actual HTTP drain/uncertain reply/write refusal/retained-copy/close and real network Pull/history/multiple-base/provider/platform remain pending. This is not full feature completion or a compact boundary.

Frontend coordinator milestone: createGitClient.prepareMerge validates native candidate/source and immutable committed collection before resource reconciliation. createGitMerge uses private single-use review capabilities, consumes on resolve/cancel/confirm, preserves full workspace metadata and private/foreign/local records, drains/saves exact baseline before required-proof schema2 apply, and routes uncertain outcomes/retained edits to authoritative recovery. Working-resource choices apply only to real local-and-incoming changed conflicts, never protected/type/foreign/topology failures. Saved injected browser contract7 groups and frontend check/build pass (STATUS has evidence/initial JSDoc correction). Workspace/UI integration and native mounted/actual drain/OS copy/real network/content/history/multiple-base/full Pull/Merge acceptance remain pending; this is not feature completion.

Source admission milestone acceptance: build1791363075280/1791363430579/result0 and saved git-merge-source1791363439246 pass5 native groups, including preview/application stale guards, required-proof command, actual post-ref Windows write refusal, snapshot change before authoritative load and same-journal completion/no second apply. Current-build merge10/writer8/reader20 regressions pass. Source snapshots were owned synthetic valid manifests, not network download evidence; incoming refs are observed rather than atomically locked. Public UI/coordinator/blob review/real network/history/multiple bases/full Pull/Merge and original parity remain open.

Source admission in progress: prepare_merge accepts optional source and checks it before/after computation; new apply_merge requires it and uses the same schema2 writer with checks after source/current branch locking and immediately before journal creation. LocalBranch requires a direct named branch at expectedOid=incomingOid. FetchSnapshot requires exact saved binding and URL, current validated snapshotOid and selected advertised branch at incomingOid; a superseded receipt, missing/symbolic branch or changed saved settings refuses. The existing foundation advance retains optional-proof compatibility; public workflow callers must use apply_merge. Proof is volatile admission data, not a recovery dependency. Internal ref/settings mutations cannot interleave during final GitState→StorageState admission. Incoming refs are read, not locked, so an external writer may move one after the final check; the operation still uses the exact reviewed immutable OID. This is not multi-ref atomicity. Runtime source acceptance pending; source fixture creates synthetic immutable manifests, not a network Fetch gate.

Native resolution milestone acceptance: current build1791362349137/1791362723693/result0 and saved git-merge-prepare1791362729664 pass10 groups including exact-state cancellation, reviewed choices and guards, complete-tree merge and actual journaled custom candidate preserving the original full local workspace. Compiler/frontend/native build checks pass; STATUS records limits. Target admission/blob review/working conflict UI/coordinator/history/multiple bases/full public Pull/Merge remain open; continue the same feature before compact.

Step5 conflict resolution in progress: prepare_merge now accepts optional expectedMergeBaseOid and resolutions. Each resolution contains the exact returned conflict triple and choice ours/theirs/delete/custom; custom includes an existing reviewed byte path, regular-file mode and bounded byte content. Native recomputes the pinned complete-tree merge and requires the exact base plus every conflict exactly once, rejecting changed/unknown/duplicate/incomplete choices. It copies only stage0 entries into a fresh in-memory index, checks exact path and file/directory collisions before new blob writes, and creates the same ordered unreferenced merge candidate after managed-tree validation. Ref/workspace application remains exclusively through schema2 advance. UI review/content loading, target-ref and endpoint/fetch snapshot pinning, working-resource conflicts, history/multiple-base handling and full Pull/Merge remain unfinished. Saved runtime acceptance pending in STATUS.

Step5 candidate milestone acceptance: build1791361473582/1791361843897/result0, saved git-merge-prepare1791361949912 passes7 native cases (classification, full-tree divergence/ordered parents/external binary and documentation, conflict cancellation and exact-state/refusal guards). Advancement writer1791361977938 and reader1791361997809 regressions pass on this build. Public workflow/conflict resolution/endpoint pinning/history and multiple-base gaps below remain open. STATUS records exact scope and corrected fixture failure. Continue full Pull/Merge before the next completed-feature compact boundary.

2026-10-07 step5 in progress: `git_repository_prepare_merge` accepts an exact managed repository/workspace/source branch/source OID/incoming OID and merge author/message. It requires clean symbolic HEAD at the source and validates managed collection trees. Equal/ancestor inputs produce upToDate; descendant produces fastForward; divergence merges the complete root trees against the one actual common ancestor using an in-memory index. Unconflicted output is an unreferenced commit with ordered source/incoming parents, validated before return. Conflict output carries all ancestor/ours/theirs entries (byte paths, object IDs, modes), targetOid=null; it never applies a partial candidate. No refs/on-disk index/workspace are changed, but preparation may write unreachable Git objects, retained on cancel. Native runtime evidence remains pending in STATUS.

This preparation command is not public Pull/Merge completion. Caller still must pin local target ref or endpoint settings/revision/fetch snapshot/branch, expand required history outside StorageState, revalidate after network and before journal submission, reconcile working resources and metadata, review/resolve conflicts and cancel, drain runs/save exact baseline, and use authoritative retained-edit recovery on uncertainty. Current shallow-history and multiple-base refusal are explicit implementation gaps to handle in the full workflow, not parity exclusions. Conflict resolution must rebuild the same pinned in-memory merge and validate exact conflict choices; never persist a partial merge to the disk index or refs. Existing schema2 requires one actual base, so recursive virtual-base support needs deliberate validation/journal work. All original remote and migration scope stays open.

2026-10-07 step4 native foundation evidence: build1791359893235/1791360274228/result0; git-advance-writer1791360290235 (8 checks including prepared divergent merge and actual workspace replace refusal); ref-replace parent1791360316450/restart1791360319542 (complete newOID lock interrupted before rename, live/changed/replaced preservation and old-before recovery); completed-command reply-loss parent1791360337364/restart1791360341351 (exact new state and no second advance). Current reader/schema1/Source Control/restore/pre-replace restore regressions and compiler/Clippy pass; STATUS has exact artifacts/failure corrections. This does not close power-loss/partial-byte/ownership-persistence-gap/disk-full/platform or public pull/merge/coordinator scope. Compact before step5.

1. **Connection settings and authentication.** Add typed Rust request shapes and plain-JavaScript UI model for URI/provider/author and credential handling. Reuse local binding/persistence admission. Keep secrets out of logs, ref names, Git trees and portable exports. Inspect existing provider token storage/refresh code before migrating it. Verify legacy URL forms and self-hosted endpoints. Do not blindly forward credentials to another host after redirects.
2. **Read-only remote advertisement.** Start from git2 Remote::connect_auth/list/default_branch with explicit callbacks. Return advertised full refs and OIDs, default branch, and empty-repository state; validate supported object format against current 40-hex OID model. Disconnection, authentication failure, cancellation and timeout are distinct from an empty branch list. No workspace/ref changes.
3. **Fetch.** Use explicit remote branch refspecs and scoped tracking namespace. Fetch/download must never target refs/heads or alter HEAD/workspace. A settings change must not silently reinterpret old tracking refs as belonging to the new URL. Return captured endpoint/revision and refs actually read; revalidate before using them in later operations. Handle partial network failure and pruning without claiming workspace synchronization.
4. **Versioned advance-ref journal.** Implement and verify the above recovery table, backward compatibility and uncertainty handling. Reuse quiescence, candidate validation, retained edits and startup recovery. Do not keep StorageState locked during network I/O; revalidate baseline after network completion before journaled application.
5. **Pull and merge.** Classify graph relation; up-to-date does nothing; fast-forward advances with journal; divergent merge builds a candidate complete tree with pinned parents and handles conflicts before applying. Then reconcile working resource edits against old/new committed snapshots. Keep non-resource files and private/foreign/local-only data. Conflict resolution/cancel must leave an inspectable recoverable state.
6. **Clone and remote branch checkout.** Remote checkout is implemented for an installed managed collection: full Fetch, pinned review, durable new-ref creation/verify-only continuation, journaled checkout and recorded binding; seven actual native groups plus blocked working-conflict acceptance pass (GIT.md#record-git-remote-checkout). Staged Clone now independently implements owned complete-history stage, native Inspect/inventory, private review, exclusive additive managed install/full-snapshot journal/write fence/startup recovery. Windows empty/no-Workspace/one/multiple/existing-ID/collision/topology/network-failure/uncertainty/admission/restart/actual OS retained-copy and fresh Send acceptance pass; exact artifacts and broader remaining fault/provider/platform/lifecycle limits are in GIT.md#record-git-clone. Existing Fetch/checkout does not substitute for Clone; full Git remains PARTIAL.
7. **Push.** Pin local branch/OID and explicit destination; use normal non-force update. Inspect push_update_reference callback status even when the transport call succeeds. Preserve local state on server rejection. If transport outcome is unknown, re-advertise and report observed remote state; do not blindly resend. No push to the owner's real remote during development without authorization. Worker, native supervisor, durable submission/no-resubmission receipts, explicit Inspect/retirement and frontend review are implemented. The current GIT-PUSH section above records bounded Windows owned-loopback acceptance; retained faults/lifecycle/provider/platform requirements remain open. Historical worker-only checkpoints do not describe the current implementation.
8. **Provider/UI acceptance and release.** Wire controls into Insomnium Git layout; provider login/refresh, progress/Stop/retry, settings reload, branch list, fetch/pull/push/merge/clone all need saved Playwright scenarios and native evidence. Rebuild production only after remaining full PARITY items are addressed.

Read-only advertisement can be implemented before the advance-ref journal. Fetch can land next, but it is not pull. Keep later steps in scope.

## Saved Playwright acceptance backlog

Create reusable files in tests/ui with shared fixture helpers; use Bun and the verified isolated app identity. No browser-use or inline ad-hoc UI automation. Use a disposable loopback Git endpoint for deterministic transport and authentication fixtures; do not use real account secrets.

- Settings save/reload, invalid URI/provider, cancellation and changed binding/session.
- Advertisement: public/basic/provider mapping, wrong credential, empty repo, unavailable endpoint, redirect host change, cancellation; local HEAD/resources remain exact.
- Fetch: branch add/update/delete, requested depth/pruning, interrupted transfer, stale endpoint, unchanged local HEAD/resources.
- Pull: up-to-date, fast-forward, divergent merge, conflicts/cancel, preserved local/private/foreign/history, post-ref workspace-write failure, restart/lost reply.
- Push: new branch, equality, normal advance, server rejection, remote race, unknown response; server's final refs asserted separately.
- Clone: no workspace, one workspace, multiple workspaces, existing IDs, interrupted/resumed install, external tree content preserved.
- GitHub/GitLab actual provider login/refresh and proxy/TLS remain separate acceptance from synthetic loopback fixtures.
- OS-close during network work and retained-copy OS dialog need explicit lifecycle acceptance; explicit test window destruction is insufficient.

## Official documentation consulted

- [git2 Remote](https://docs.rs/git2/latest/git2/struct.Remote.html): connect_auth/list and fetch/download/update_tips distinction; push callback requirement.
- [git2 RemoteCallbacks](https://docs.rs/git2/0.21.0/git2/struct.RemoteCallbacks.html): allowed credential types, progress, push negotiation and per-ref rejection.
- [git2 FetchOptions](https://docs.rs/git2/0.21.0/git2/struct.FetchOptions.html).
- [git2 Repository](https://docs.rs/git2/latest/git2/struct.Repository.html#method.merge_trees): native tree/merge APIs to inspect before implementation.
- [Git fetch](https://git-scm.com/docs/git-fetch) and [Git push](https://git-scm.com/docs/git-push).

Existing git2 0.21.0 already enables https/ssh in Cargo.toml. No package install, initialization, new tests or remote network operation performed for this design checkpoint. Implementation must use documented APIs; no new subsystem generator is needed for the existing Rust module. Build/check commands remain direct Cargo and Bun x --bun, with shell:false/windowsHide:true launch on Windows.


</details>

<a id="record-request-body-git"></a>

<details>
<summary>REQUEST-BODY-GIT</summary>

# Request body clearing and Git snapshots

Status: verified and committed in a752707; checkpoint ff3d051. Field composition is a separate topic using the same tested release.

Changing Body type passed binary/serialized/cURL properties as undefined, then
merged them into the live body object. Persistence JSON omitted these keys,
while Git snapshots correctly reject non-JSON values. Opening Source Control
before reload therefore failed with JSON-compatible values error.

RequestEditor now applies undefined body patch values by deleting the key.
Explicit values and unrelated fields remain. This corrects the editor mutation
boundary; Git resource validation is unchanged. GraphQL selection still
initializes its existing blank query/variables model.

Evidence:

- Native theme16599/artifact1791556213497 failed after initial native controls
  and completion checks at Source Control Changes wait60s. Actual failure PNG
  shows Git JSON-compatibility error. Native48704 exit0/native-hidden/visiblefalse;
  owned Bun40696/native gone and scoped WebView0. Failed artifact retained.
- Existing saved openapi-serialized-contract.js now mounts real RequestEditor
  via request-body-git.svelte. Baseline rejects ordinary Body type change with
  own binary/_openapiSerialization undefined keys. Original result/progress/PNG
  preserved in artifacts/playwright/request-body-git-baseline; PNG inspected.
- Corrected scenario terminal0: ordinary/serialized/cURL to Text or GraphQL
  gives6 cases. Cleared keys are absent immediately in memory; MIME/text follow
  existing UI behavior, unknown nested data retained, actual Git encode/decode
  round trip succeeds. Original168 composer/11 refusal/8 signing controls pass.
- Independent request-body-git-audit.json verifies six unique cases and literal
  body text/metadata deletion/unknown data round trips. An unrelated undefined
  unknown body field still fails strict Git validation.
- Fixture decode invocation/type annotations were corrected after initial
  harness failure. The initial expectation to retain raw text for GraphQL was
  wrong: existing selection initializes blank query/variables; corrected
  expectation follows the source. These failures are not product regressions.
- Final compiler zero errors/warnings. Seven app hashes, including unchanged
  six Field files and corrected RequestEditor, are frozen in
  artifacts/playwright/request-body-git-source-freeze.json.

```powershell
bun tests/ui/openapi-serialized-contract.js
bun run check
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/nocturne-native-theme.js
```

Native2580/artifact1791557144758 terminal0/passed14:45:45.162Z–14:49:39.844Z on frozen build1791556752062/finished1791557135005/result0/hash16674050803735312688.12 workflow captures,10 dialogs,6 Field feedback/12 form profiles pass; Git HEAD unchanged. Independent acceptance/seven-source-hash audit passes. Actual dark/light Git900 and cookie images inspected. Native61208 exit0/native-hidden/visiblefalse; owned Bun42584/native gone and scoped WebView0; no live handles.

The tested working set includes the six Field composition files plus corrected
RequestEditor; seven source hashes document the exact release. Body and Field
changes are committed separately by topic. This does not claim a test of the
body commit in isolation from the tested Field working set.

Native checks include opening Source Control immediately after actual Body
type change, before reload; corrected Git Changes and YAML diff render. Native
bridge dialogs/proto/cookie/recovery are retained workflow regression, not real
provider/network or OS file-dialog acceptance. All original migration, UI/CSS,
platform and distribution gates remain required. Commit/checkpoint: STATUS.md.


</details>

<a id="record-shallow-history"></a>

<details>
<summary>SHALLOW-HISTORY</summary>

# Shallow Git history: storage and recovery decision

## Independent-process recovery evidence — 2026-09-30

Current-source native writer accepted two real forced-termination cases using a16MiB binary tree to allow external observation, without production hooks:

1. Observe prepared shallow metadata while process is live and ref is still absent, kill/wait, then start a new process with the same journal/stage.
2. Observe intended snapshot ref while process is live, kill/wait, then restart to finalize the same operation.

Both restart processes acquired the released OS lease and known owned shallow lock, completed/confirmed the same snapshot UUID/OID, preserved HEAD and retired journal/lock. Both final repositories passed git fsck --full with empty output. Evidence: artifacts/git-writer-crash-check/crash-acceptance.json and artifacts/git-writer-published-crash-check/crash-acceptance.json (PIDs/exits, fixture locations, original operation identity, final output, fsck results).20 new checks each, with195 regressions each; no active child remains.

This proves those observed Windows process boundaries only. It does not cover hardware/power-loss durability, partial journal/lock-marker writes, interruption while libgit2 holds a ref lock, interrupted attribute restoration or Unix behavior. Unknown locks and malformed records remain retained; do not infer ownership or silently delete them. Native/UI recovery command and binding fencing are still pending.

Reference consulted: https://doc.rust-lang.org/std/process/struct.Child.html#method.kill .

## Actual transition writer — 2026-09-30

FetchSnapshot::try_from(RecoveryInput) now executes the journaled transition under the caller's GitState/stage lease. Uses an operation+stage-owner shallow.lock marker and exclusive OS lock. Existing matching idle locks are reusable; unknown or active locks fail closed. There is no automatic Drop deletion on failure.

Sequence: validate pending evidence, acquire lock, atomic prepared image, import exact planned objects and flush loose files, validate destination graph, one expected-ref locked transaction, flush loose/packed ref and optional reflog, atomic final image, revalidate, release owned lock, revalidate and retire journal. Staging remains for acknowledgment/cleanup. After ref commit, cancellation cannot report an uncommitted outcome or redirect to another operation.

AtomicWriteFile provides replacement visibility; explicit sync and Unix directory ordering are used. Windows owned-file flushing temporarily clears readonly solely to open a handle, restores it before sync, and does not alter ACLs. No claims of power-loss/hardware or untested Unix acceptance.

Evidence:22 actual writer cases in git-transition-check and10 already-published packed-ref finalization cases in git-published-finalize-check, plus included regressions. A real loose-object-path obstruction caused partial import and retained prepared/journal/lock state; retry after removing that fixture obstruction completed. Both final repositories pass git fsck --full. No process-kill simulation was used for these32 cases; independent-process interruption is next.

Still pending: real writer process-stop/restart, ref/shallow replacement and retirement fault windows, partial journal/lock-marker recovery handling, binding fencing/native commands, v3 receipts/intents/depth/relative UI, saved Playwright acceptance and platform/installer matrix.

References:

- https://docs.rs/atomic-write-file/latest/atomic_write_file/struct.AtomicWriteFile.html#method.commit
- https://docs.rs/git2/latest/git2/struct.Transaction.html
- https://doc.rust-lang.org/std/fs/fn.rename.html
- https://docs.rs/git2/latest/git2/struct.Repository.html#method.refdb_compress

## Journal-bound recovery validation — 2026-09-30

RecoveryInput -> PublicationPlan now validates recognized pending states without writes. Requires native managed identity, exact stage ownership and a lease held by the caller under GitState. Checks journal/immutable candidate operation, fetched-only history in staging before enabling the destination alternate, then full mixed histories and physical roots. Previous expected snapshot and old boundary roots remain included after the new ref is published, even without reflogs.

The shared root reader takes an explicit object source: normal admission validates boundary objects in destination; recovery can validate prepared boundaries not yet imported using the combined store. Computed final cuts and old-union-final prepared cuts must match the journal. Exact journal bytes, phase, observed shallow bytes, inventory and stage identity are checked again.

After publication the destination-only raw object view must satisfy snapshot, requested histories and final physical graph. A staging copy cannot make a prematurely published/incompletely imported destination pass. Journal creation invokes this recovery validator after recording intent.

Evidence: new30 state and15 retained-snapshot checks in artifacts/git-recovery-plan-check and artifacts/git-retained-recovery-check. Covers partial import and actual missing loose object observed through fresh repository open, plus retained full history only in destination and expected old snapshot without reflog. Normal roots246 and stage-recovery282 regressions rerun. Cargo checks pass.

No transition writes or crash acceptance yet. Callers must revalidate immediately before every eventual write under GitState; a returned plan is not permission to overwrite a subsequently changed repository. Partial/malformed journals remain retained and blocked. Next implement prepared/import/ref/final/retirement transitions and explicit recovery command, then process-stop/disk-fault acceptance and public depth integration.

References: https://docs.rs/git2/latest/git2/struct.Repository.html#method.from_odb ; https://git-scm.com/docs/shallow ; https://docs.rs/git2/latest/git2/struct.Transaction.html .

## Exclusive intent creation — 2026-09-30

Journal::try_from(JournalCreationInput) now creates a new bounded record after validating native managed destination/stage identity, computing the combined plan, flushing recovery files, and recomputing that plan. It uses create_new (never overwrite), writes and syncs JSON, then verifies exact bytes and before-publication state. Windows uses FILE_FLAG_WRITE_THROUGH; Unix additionally syncs directories. Caller must hold GitState and retain the settled worker's staging lease.

Stage flush walks only verified owned plain material with limits. Windows readonly pack/index attributes are temporarily cleared only to open a write-capable handle, restored before sync (also on open failure), and checked by real fixture evidence. Unix uses read-only file handles and preserves modes. No payload bytes are changed by flush.

Important boundary: reservation and JSON write are separate. A partial journal is retained and blocks admission/cleanup. The constructor does not import objects, change shallow/ref state, recover or retire a journal. It is not exposed to UI yet. Successful flush APIs/readback do not prove survival of power loss, hardware caching, directory-entry loss, interrupted readonly restoration, or untested Unix/platform behavior.

Evidence: artifacts/git-journal-creation-check/full-pack-state.json:42 new cases +195 regressions, including actual journal-bound stage reacquisition after releasing the creator lease. Current-source stage-recovery282 also passes. Cargo fmt/check/clippy -- -D warnings passes.

Next: implement combined journal-bound recovery validation that accepts recognized prepared/partial-import states, atomic shallow replacement, import+object flush, expected-ref transaction, final metadata and journal retirement. Partial journal handling and real process-stop/disk-fault acceptance remain required before enabling public shallow publication.

References consulted:

- https://doc.rust-lang.org/std/fs/struct.File.html#method.sync_all
- https://doc.rust-lang.org/std/fs/struct.OpenOptions.html#method.create_new
- https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers
- https://doc.rust-lang.org/std/os/windows/fs/trait.OpenOptionsExt.html#tymethod.custom_flags
- https://doc.rust-lang.org/std/fs/struct.Permissions.html#method.set_readonly
- https://docs.rs/atomic-write-file/latest/atomic_write_file/struct.OpenOptions.html (does not provide create_new; not used to reserve a journal)

## Combined new-publication plan — 2026-09-30

PublicationPlan::try_from(PublicationInput) now independently validates destination history, reconstructs the same expected manifest as candidate generation, matches immutable staged candidate identity and computes a typed graph over retained roots plus candidate using a read-only stage+destination object view. Cut candidates come only from existing physical metadata and verified worker cuts. The result includes canonical sorted object IDs, expected ref, exact optional old shallow bytes and sorted prepared/final images. Prepared is old union final; healed cuts are removed only in the final image.

Candidate construction uses the shared prepare_history_view helper and requires a successful combined plan before reporting success. No destination writes, journal creation or public command connection occurs. Keep the native staging lease and GitState throughout eventual publication. Revalidate the plan at the durable transition; it is not a reusable authorization token.

The new plan rejects pending journals and independently invalid old graphs. Recovery must use the journal-bound stage/ref/metadata state, including prepared-before-import and partially imported objects; do not reuse new-publication admission to reject legitimate incomplete recovery states.

Evidence: artifacts/git-publication-plan-check/full-pack-state.json,29 new +195 existing checks; retained roots246 and recovery282 also rerun. Cargo fmt/check/clippy -- -D warnings passed. No native UI build or power-loss durability claim.

References consulted before implementation:

- https://git-scm.com/docs/shallow
- https://docs.rs/git2/latest/git2/struct.Odb.html#method.add_disk_alternate

Next: durable stage/candidate ordering, exclusive bounded journal creation using this plan, prepared/import/ref/final writes and explicit recovery. Public depth/relative request identity, JS receipts/UI and saved Playwright acceptance follow.

## Retained roots implementation — 2026-09-30

RetainedRoots now inventories current loose/packed refs, HEAD (including unborn/detached), old/new reflog roots including logs whose refs no longer exist, known pseudorefs, and existing shallow commits. Exact old shallow bytes are kept. Bounded filesystem preflight rejects indirection/invalid storage before backend parsing. Single ordinary files-backend managed repository is required; linked/shared worktrees and reftable are refused.

Typed RepositoryGraphInput supports commit/tag/tree/blob roots and nested annotated targets. Existing fetch branch validation still requires commits. ObjectGraphPlan::try_from((repository,cancelled)) inventories, validates a raw object view with authorized old boundaries, and repeats inventory. Caller holds GitState; this is cooperative serialization, not protection against adversarial external filesystem races.

Evidence:43 new assertions/246 total in artifacts/git-retained-roots-check/full-pack-state.json. Current-source candidate195 and recovery282 suites also pass. Cargo fmt/check/clippy -- -D warnings pass.

This normal-state inventory rejects missing existing boundary objects. A journal may intentionally be at a prepared-before-import state with boundary objects only in staging; recovery must instead use the journal's verified combined stage+destination plan and exact expected state. Do not call normal-state inventory alone as proof that recovery is impossible.

Still required: combine candidate stage and destination inventories with verified fetched/old boundary union; capture final objects/cuts and old/prepared/final images; durable stage ordering; exclusive journal creation and transitions/recovery. The root planner does not enable tag-fetch UI or satisfy the separate remote tag/prune parity items.

- https://docs.rs/git2/latest/git2/struct.Repository.html#method.references
- https://docs.rs/git2/latest/git2/struct.Reflog.html
- https://git-scm.com/docs/gitrepository-layout

## Staged candidate checkpoint — 2026-09-30

Implemented private CandidateInput/TryFrom preparation, not publication. Validate fetched data in raw staging ODB before enabling destination read-only alternate; project exact per-branch cut views; preserve prior unselected histories. Build manifest/tree/commit in git2 mempack and persist its pack/index using Indexer in staging only. Reopen raw ODB, verify candidate/graphs and expected ref. Importer shares the bounded stage ODB opener.

Official API references consulted during implementation: [Repository::from_odb](https://docs.rs/git2/0.21.0/git2/struct.Repository.html#method.from_odb), [Odb::add_new_mempack_backend](https://docs.rs/git2/0.21.0/git2/struct.Odb.html#method.add_new_mempack_backend), [Mempack::dump](https://docs.rs/git2/0.21.0/git2/struct.Mempack.html#method.dump), [Indexer](https://docs.rs/git2/0.21.0/git2/struct.Indexer.html), plus installed git2 0.21.0 source. This continuation's web re-open returned inaccessible; current source and executable probes were used for verification, not a claim that the web retry succeeded.

Validation commands: cargo fmt --manifest-path src-tauri/Cargo.toml; cargo check --manifest-path src-tauri/Cargo.toml; cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings. Native temporary Rust probes were orchestrated through Bun stdin, not saved non-UI test scripts. See STATUS for current evidence and counts.

Readback proves process-visible persistence only. No fsync ordering or power-loss claim. Retained histories may rely on destination objects; recovery must revalidate destination and candidate. The builder is not wired into public commands. Remaining order: complete physical-root inventory and effective cuts, durable stage/candidate, exclusive journal creation under GitState, prepared/import/ref/final transitions and explicit recovery, then public request/intent/receipt/UI integration.

Date: 2026-09-30. Status: representation selected and graph planner verified; publication/journal integration is NOT implemented.

## Decision

Use ordinary Git objects and repository-level `shallow` metadata, with versioned snapshot request/history metadata and an explicit native journal for the shallow-file/ref transition. Keep snapshot parent pointers for reachability. Do not encode raw commits as archive blobs or create a separate repository for every history.

This replaces earlier checkpoint language suggesting that a managed global shallow file must never be used. The actual constraint is that a new fetch must not unnecessarily cut ancestry already available to unrelated complete histories. Global metadata is Git's standard representation; copying the worker's boundary list verbatim into the destination would violate that constraint.

The legacy `git-vcs.ts` fetch supports depth/relative/singleBranch and prune/pruneTags; shallow-clone starts at depth1. Those remain required parity, not removed by this design.

## Two distinct kinds of metadata

- Requested history: supervisor-owned depth and selected branch, plus verified worker boundaries. A depth request remains a depth request even if a short remote returns a complete graph. A future v3 snapshot must preserve this identity for reconciliation and per-branch history display.
- Physical repository cuts: only authorized boundary commits whose direct parents are still absent in the combined destination + verified staged object store. Walk available ancestry and validate it. A full history already present stays traversable. Missing ancestors not authorized by prior/fetched boundary metadata are errors.

`plan_object_graph_while` now computes physical cuts without mutating the repository. The existing exact-boundary validator still stops at every declared boundary and requires every boundary to be reached. The planner omits unreachable candidates and removes redundant cuts; callers must therefore supply the complete root set before using its result for a global shallow file. The current full importer invokes it with no candidates and retains all existing shallow-import/publication guards.

## Root and object-store requirements for integration

1. Validate staged ownership, filesystem, objects and exact fetched boundaries independently.
2. Construct a read-only combined ODB using only already-validated native paths. Do not inherit alternate stores or config from staged repositories.
3. Include newly fetched tips, retained snapshot/local/remote/tag roots, reflog roots and every existing shallow boundary as a root. Keeping old boundary roots protects dangling shallow commits until collection; pruning one branch must not break older snapshots or remaining objects.
4. Candidate boundaries are the deduplicated union of validated existing physical cuts and verified fetched boundaries. Their source must be known; an arbitrary missing parent is never a candidate.
5. Run the bounded hash/type/tree/blob validator over the combined graph. Record the effective cuts and all imported object IDs in the native operation plan. Revalidate after import.
6. Preserve per-branch request/history metadata when exact-branch fetch retains other branches. Legacy v1/v2 snapshots remain readable; full fetch after v3 must still account for retained shallow snapshots and physical cuts.

## Planned publication order (not yet implemented)

Hold the managed Git operation lock; exclude conflicting Git actions while a journal exists. Recovery must run before repository/history consumers proceed.

1. Persist a bounded versioned journal containing operation UUID, endpoint/snapshot ref identity, expected old ref, verified owned stage identity, old shallow bytes, prepared/final shallow bytes, and the intended new immutable snapshot identity. Never store remote credentials in it.
2. Prepared shallow metadata is the union of old physical cuts and required new physical cuts. Persist it atomically before importing incomplete commit graphs. Do not use all requested cuts, since some would unnecessarily hide existing ancestry.
3. Import verified objects, persist the intended snapshot objects, validate destination graph with final cuts, and retain the stage until the outcome is confirmed.
4. Publish exactly one snapshot ref under the existing expected-OID/ref-lock check. Local HEAD/workspace remain unchanged.
5. Install final physical shallow metadata (drop healed cuts only after required objects exist), confirm ref/metadata/graph, then remove the journal and release/clean staging.

The detailed journal encoding, atomic replacement/fsync behavior on Windows, crash recovery implementation, root enumeration and reader admission still need implementation and verification. A journal alone is not evidence of atomicity or durability.

## Recovery rules to implement

| Observed state                             | Required behavior                                                                                                                                                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expected old ref, old/prepared metadata    | Verify retained stage and resume the planned import/publication, or explicitly abandon while retaining any physical cuts needed by imported dangling objects. Do not blindly restore old shallow bytes after partial import. |
| Intended new ref, prepared/final metadata  | Validate objects and complete final metadata; report the original operation as committed.                                                                                                                                    |
| Any unrelated ref or unrecognized metadata | Retain journal/stage and report conflict; do not overwrite external changes.                                                                                                                                                 |
| Stage absent/corrupt before completion     | Keep protective metadata and pending journal; report missing recovery evidence. Do not guess from timestamps.                                                                                                                |
| Cancellation before journal                | Existing cancellation/cleanup semantics.                                                                                                                                                                                     |
| Cancellation after durable journal         | Settle or expose recovery for that same operation; do not publish another UUID or delete recovery material prematurely.                                                                                                      |

## Verified evidence

- `artifacts/git-shallow-plan-check/full-pack-state.json`: compile0/run0; 29 new planner/real-Git assertions plus 137 existing native worker/snapshot/import assertions.
- Mixed fixture has full local main and a shallow remote history pinned by a snapshot parent. Without shallow metadata, fsck fails. With the computed cut, `git fsck --full` passes; main count is2 and shallow count is1.
- `git -c gc.autoDetach=false -c gc.writeCommitGraph=false gc --prune=now` and a second fsck pass. Both histories, snapshot and binary blob survive. HEAD remains the full local main.
- Filling the missing parent makes the planner remove the cut. Removing shallow metadata yields count2, fsck passes and a second GC/fsck passes.
- Planner rejects unauthorized missing ancestry, duplicate/zero/excessive candidates and cancellation; it does not change exact-cut validator semantics.
- `artifacts/git-shallow-plan-check/preimport-metadata.json`: Git2.55.0.windows.3 accepts a shallow entry before its commit object exists in an empty disposable repository; fsck0. This only verifies that preparation state, not arbitrary mid-import consistency or crash recovery.
- Cargo fmt/check/clippy -D warnings passed. Probe source was passed through Bun/Rust stdin, not saved as a new test script. Initial long command hit Windows ENAMETOOLONG before launch; stdin run succeeded.
- No public depth option, v3 snapshot, journal, new native app build, provider acceptance or crash/disk-fault acceptance is claimed complete.

## References consulted before implementation

- https://git-scm.com/docs/shallow
- https://git-scm.com/docs/git-fetch
- https://git-scm.com/docs/gitrepository-layout
- https://git-scm.com/docs/git-fsck
- https://git-scm.com/docs/git-gc
- https://docs.rs/git2/latest/git2/struct.Odb.html#method.exists

Next: implement the versioned shallow publication journal and admission/recovery using this representation, then v3 request identity/per-branch metadata, public depth/relative transport and saved Playwright acceptance. Preserve the original full migration scope.

## Implemented admission layer — 2026-09-30

- `git_fetch_journal.rs` defines a bounded version1 record and validates identity/metadata images. `git::open_managed` checks pending files before libgit2 can parse shallow metadata, then classifies direct ref +exact bytes and refuses admission without mutation.
- Absent shallow and empty shallow are distinct. Prepared/final images are present files, including the empty-string image; finalization must use that representation consistently.
- Pending state classification does not validate stage contents or target snapshot object graph and does not authorize any write. Production journal creation and explicit recovery are not implemented.
- Actual open_managed probe passed37 new assertions; total203 with prior regression. Evidence `artifacts/git-fetch-journal-check/full-pack-state.json`.
- Before adding a production writer, make journal-retained stage ownership visible to staging cleanup. A released parent/worker lease alone must not permit cleanup to delete a stage needed by a journal after restart.
- Official implementation references: https://docs.rs/atomic-write-file/latest/atomic_write_file/struct.AtomicWriteFile.html and https://docs.rs/git2/latest/git2/struct.Transaction.html .

## Journal ownership during cleanup — 2026-09-30

Implemented `retained_stages` ownership inventory before any deletion. All managed repositories must be inspectable within1024 entries. Unknown, malformed, oversized or linked state causes cleanup to stop before deleting even unrelated stages. Valid journal stage names are retained without requiring a live process lease or a matching current owner marker; a marker conflict must not destroy recovery material. Matching reclaim aliases are retained too.

The native cleanup command holds GitState across inventory/deletion. Journal creation/recovery must hold that same mutex. Journal-based retention is independent of the parent/worker OS leases, which continue protecting live operations. This is cooperative in-app serialization, not a defense against adversarial external filesystem edits.

Evidence: artifacts/git-fetch-journal-cleanup-check/full-pack-state.json,27 new cases/230 total assertions. Saved UI acceptance is pending native-fetch-journal-ui-probe at this checkpoint. Production journal writer and recovery remain next.

Native UI follow-up: native-fetch-journal-ui-probe build0. Saved cleanup10 groups passed at artifacts/playwright/git-fetch-cleanup-1790782032722; main Fetch11/restart3/scoped Fetch9 regressions passed on the same binary. No build active. These fixtures verify retention/admission only, not production journal creation/recovery.

## Recovery stage acquisition — 2026-09-30

Implemented exclusive reacquisition of the exact native stage name/owner through StageReservation::try_from. It never creates/truncates files, and refuses live worker/parent/recovery leases, missing ownership, replacement/link material and invalid identity. Dropping the result releases only the OS lease.

Journal-bound acquisition requires a validated native Repository and GitState held by the caller. It reads/validates journal and publication state, reacquires stage, checks exact journal bytes/state again and returns the lease. It does not import or publish, and does not prove the target snapshot/object graph valid. Future recovery must retain this lease while performing those checks and transitions.

Evidence: artifacts/git-stage-recovery-check/full-pack-state.json;282 assertions including41 stage acquisition and11 journal-bound checks. An independent live process holding the worker shared lease blocked recovery until release and observed exit. No crash/publication-recovery acceptance is claimed.

## Native snapshot v3 contract — 2026-09-30

Implemented native metadata/reader/validation, not publication:

- `requestedDepth`: optional positive finite depth; absent/null means a full-history operation.
- `histories`: required array in v3, with exactly one `{name, depth, boundaries}` per advertised/retained branch. Selected Fetch updates only its branch history; an all-branch operation must have matching depth for all entries.
- Full entries have null depth and no boundaries. Depth-limited entries may have no cuts if the returned graph is complete. Boundaries are sorted canonical unique nonzero SHA1 IDs, max10000 per history/100000 entries total.
- UUID+branch+depth identify an operation. Existing callers without depth cannot confirm a depth-limited v3 request.
- Reader checks immutable manifest/tree/parent identity without graph traversal or ref mutation. Explicit history verifier checks full/shallow graphs, cancellation and cumulative work. Old publisher blocks v3 overwrite until the journal transition exists.
- v1/v2 omit new fields and remain accepted. JS receipts, relative depth semantics, public requests/intents/UI and v3 publisher are still pending.

Evidence:44 new assertions in git-fetch-snapshot-v3-check plus282 existing current-source assertions rerun in git-stage-recovery-check. No native app build for this change yet.


</details>

## Native window destruction remote-job cancellation — 2026-10-19

The existing main-window Destroyed handler now closes RemoteJobState alongside network/plugin services. Closing marks every accepted reservation cancelled and sets a shared closed flag while holding the same mutex as reserve. Cloned registry handles therefore reject late jobs rather than starting a worker after destruction. Existing reservations remain until their own supervisors finish; existing cancellation checks, OwnedChild kill/reap, staging cleanup and journal recovery stay authoritative. No remote command, process protocol, journal or repository mutation policy changed.

Cargo check --manifest-path src-tauri/Cargo.toml --all-targets --locked passed6.85s with existing vendor warnings; scoped rustfmt/diff0. artifacts/git-window-destruction-cancel-20261019.json binds source and source-review limits. No saved testcase/scenario additions, edits or runs; no Git remote/provider/native app/profile operation. This connects cancellation signaling and admission only: actual OS-close/process reap timing, app process-exit drain, staging recovery, provider/platform and all retained PLAN/PARITY acceptance remain open. The normal frontend close drain remains in place.

## Git supervisor exit drain — 2026-10-19

RunEvent::Exit now closes and drains the shared Git remote registry before Tauri cleanup. RemoteJobState uses a condition variable tied to the same job mutex; Reservation::drop marks its job settled and notifies waiters after the existing supervisor/child/staging cleanup. The wait rechecks all running jobs on every wake, tolerates spurious notifications and keeps admission closed across cloned handles. There is no new polling loop or early timeout that would abandon a child. Poisoned-lock recovery in reservation cleanup still retires the job and notifies waiters. Named registry fields replace the prior positional fields.

Checked locked Tauri2.12.0 app.rs make_run_event_loop_callback: application Exit callback runs before cleanup_before_exit and process restart. Existing normal CloseRequested save/drain coordination and Spectral shutdown stay unchanged. Git reservations are owned in blocking supervisors, not main-thread UI callbacks; final exit waits for that work rather than running asynchronous UI cleanup on the event thread. This does not establish that unregistered Git operations or all other native services have complete exit coverage.

Contract: https://doc.rust-lang.org/std/sync/struct.Condvar.html . Cargo all-targets --locked0/5.25s, scoped rustfmt/diff0. Actual registry/Reservation code compiled from stdin confirms drain remains pending with either of two held reservations, wakes after final drop, rejects new admission and permits repeated drain. artifacts/git-exit-reservation-drain-20261019.json binds source/results. No saved testcase/scenario additions, edits or runs, child/remote/provider/native app/profile operation. Actual Tauri Exit/blocked child/reap/staging recovery/platform acceptance remains open; full original PLAN/PARITY remains active.

## Local Git worker native exit ownership — 2026-10-20

Source parentb182ddc3. The seven local git.rs commands (repository init/info, committed-resource read, history, commit, branch create/delete) now acquire unique NativeWorkLease registrations through injected NetworkState and move them into actual blocking closures. Init/info share repository_operation and one registration per invocation. Accepted libgit2/filesystem work remains in native exit drain while queued, waiting for the existing GitState mutex, inspecting refs/history/resources or performing an authorized mutation, independently of the IPC awaiter. Accepted operations finish normally; no new cancellation in the middle of ref/index/worktree changes. New admission after native shutdown is refused by the shared registry.

Managed-path/reparse guards, pending-transition checks, pinned OID/path/branch preconditions, resource selection, libgit2 algorithms and mutex ordering are unchanged. No raw checkout or new Git operation is exposed. Remote supervisors, staged clone/push and journal/merge command paths retain their separate ownership requirements; this source receipt does not claim all Git commands are covered. Uses the existing NativeWorkLease/RAII pattern and previously consulted Tokio blocking-task contract.

cargo check --manifest-path src-tauri/Cargo.toml --all-targets --locked --offline exit0/5.31s; scoped rustfmt/diffcheck pass, five existing eventsource warnings. No testcase/script/scenario/matrix additions/changes/runs, real local/remote repository mutation, app/profile/browser/provider operation or live processes. This is Windows source/compiler evidence; held mutex/I/O, IPC-drop/panic/OS-close/restart, current UI/recovery/provider/Linux/macOS/runtime acceptance remains required. Current b6efc235 packages and e4eee1d4 Linux compiler predate this and intervening plugin changes. All PLAN/PARITY requirements remain active.

## Git transaction worker native exit ownership — 2026-10-20

Source parent925e8285. Checkout, foundation advance/reviewed apply-merge, selected restore, merge preparation and local branch creation from a pinned remote snapshot now use unique NativeWorkLease registrations through injected NetworkState. Their actual blocking closures retain ownership while queued, waiting for Git/storage locks, preparing merge objects or applying the already authorized journal/workspace/ref transaction, independently of the IPC awaiter. apply-merge delegates the injected state into advance and creates one lease there; no duplicate registration. Accepted work finishes normally under exit cancellation, leaving existing journal recovery authoritative if the OS forcibly stops the process.

Existing Git-then-storage lock order, source-proof requirement, workspace/OID/admission checks, candidate validation and journal/restore/merge algorithms are unchanged. This adds no raw checkout/force mutation, remote request or renderer payload. Staged network operations/supervisors have separate retained ownership requirements; this is not an all-Git lifecycle claim. Reuses existing RAII and the previously consulted Tokio blocking-task contract.

cargo check --manifest-path src-tauri/Cargo.toml --all-targets --locked --offline exit0/5.14s; scoped rustfmt/diffcheck pass; five existing eventsource warnings. No testcase/script/scenario/matrix additions/changes/runs, actual checkout/merge/restore/branch/local-or-remote repository/profile/native-app/browser/provider operation or live processes. Windows compiler/source evidence only; held locks/filesystem, IPC-drop/panic/OS-close/restart, native UI/recovery/Linux/macOS/provider/platform and all PLAN/PARITY gates remain required. b6efc235 packages and e4eee1d4 Linux compiler predate these and the intervening Git/plugin changes.

## Staged Git command worker native exit ownership — 2026-10-20

Source parente0ebdb4a. Eleven commands in git_clone.rs (list/inspect/stage), git_fetch_command.rs (fetch/inspect/recovery status/recover), git_push.rs (push/inspect/retire) and git_fetch_cleanup.rs (explicit cleanup) now acquire unique NativeWorkLease registrations before validation/path work and transfer them into actual blocking closures. This retains the command's pre-reservation filesystem admission, lock waits, staging/inspection, accepted cleanup/publication and post-child receipt work independently of its IPC awaiter. Existing RemoteJobState reservations continue owning child cancellation/reaping exactly as before; no second supervisor or new registry is created. The lease covers the wider command lifetime, including commands that do not launch a child. New command admission after native shutdown closes is refused; accepted synchronous local work finishes normally.

Existing reservation timing, no-lock-across-network rule, managed stage identity/leases, receipt/source/OID checks, recovery acknowledgment, non-force Push and explicit-only cleanup policies remain unchanged. No retry/resend/network/deletion behavior is added. The lease does not claim that restart/OS kill can be prevented, or replace crash journals. Nested install/publication modules and other retained Git paths remain separate scopes; this is not universal Git lifecycle acceptance.

cargo check --manifest-path src-tauri/Cargo.toml --all-targets --locked --offline exit0/5.17s; reviewed33-line additive source diff and git diff --check pass. Existing unformatted long lines were preserved; no file-wide formatting claimed. Five existing eventsource warnings only. No testcase/script/scenario/matrix additions/changes/runs, actual clone/fetch/push/cleanup/local-or-remote repository/profile/native-app/browser/provider operation or live process. Windows compiler/source evidence only; held I/O/locks/supervisor handoff/drop/panic/OS-close/restart/recovery/native UI/Linux/macOS/provider/platform and every PLAN/PARITY gate remain open. Current b6efc235 packages/e4eee1d4 Linux receipt predate recent plugin/Git changes.

## Clone install worker native exit ownership — 2026-10-20

Source parent9da31dce. The nested git_clone::install::git_clone_install command now acquires a unique NativeWorkLease before path setup and transfers it into the actual blocking worker. Accepted lock waits, candidate/source checks, backup/journal creation, publication and recover/confirmation remain owned through termination even if the IPC awaiter disappears. Existing Git-then-storage locking, exact before/after workspace comparisons, destination ownership, exclusive install, bounded journal and recovery algorithm remain unchanged. Accepted installation finishes normally rather than adding cancellation between journal/publication steps; no operation is executed by this source change.

cargo check --manifest-path src-tauri/Cargo.toml --all-targets --locked --offline exit0/5.05s; scoped diffcheck passes, three additive source lines, five existing eventsource warnings. No testcase/script/scenario/matrix additions/changes/runs, actual clone/install/local-or-remote repository/profile/native-app/browser/provider operation or live handles. Windows compiler/source evidence only; held I/O/drop/panic/OS-close/restart/native UI/recovery/Linux/macOS/provider/platform and all PLAN/PARITY gates remain open. Prior local/staged command receipts do not imply universal Git runtime acceptance; current b6efc235 packages/e4eee1d4 Linux compiler predate recent changes.

## Remote advertisement worker native exit ownership — 2026-10-20

Source parentbded6f8d. git_remote_advertise now acquires a unique NativeWorkLease before RemoteJobState reservation and transfers it into the actual spawn_blocking closure. The existing reservation already owned child cancellation/reaping, including the final RunEvent::Exit drain; the missing registry lease meant normal native exit did not defer with the event loop available for this command as it does for Fetch/Push/Clone. The registry now retains the whole accepted advertisement worker through run_worker/result conversion/reservation cleanup even if its IPC awaiter disappears. Closed native admission refuses before reserving work. Unique registration avoids reusing the renderer's child request ID. Existing RemoteJobState reserve/cancel/reap/timeouts and worker protocol are unchanged; no second supervisor or process is introduced.

Reviewed sibling Git command leases, NetworkState.defer_exit and RunEvent::Exit RemoteJobState.drain. Also reconciled existing DNS LookupWork, netrc Load, JarLoad and response-download chooser/worker ownership; these already have explicit retained handles/leases, so no duplicate mechanism was added there. Official Tokio blocking-task contract: https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html . Windows cargo check --manifest-path src-tauri/Cargo.toml --all-targets --locked --offline exit0/7.02s, five existing eventsource warnings. Scoped rustfmt initially requested only the new line wrap; applied it and final scoped rustfmt/diffcheck passed (four additive lines, no unrelated formatting). No testcase/helper/scenario changes/runs, native app/profile/provider/local-or-remote repository operations or live handles. This is compiler/source evidence; actual queued/held child/drop/OS-close/restart/native UI/Linux/macOS/provider/platform and all original PLAN/PARITY gates remain open. Existing native/package/Linux receipts predate this change. /compact unavailable; explicit handoff recorded.

## Git remote cancellation callback drain — 2026-10-20

Source parentdf33f671. Advertisement and Fetch/recovery in createGitRemoteClient, plus Git Push remoteCall, now retain the Promise for an issued git_remote_cancel and await it in finally after removing the abort listener. Previously that callback was fire-and-forget: even though the original worker remained awaited, workspace work.finish could run while its cancellation IPC was still pending. Cancellation failures retain the existing swallowed-error behavior and cannot overwrite successful durable publication or the original worker error. This does not equate a cancel acknowledgement with worker completion; both remain awaited. Push's pre-aborted path is now inside try/finally so it also drains its existing cancellation request and removes its listener. No new cancellation registry/command or worker is introduced.

Validation: bun run check21108 terminal0/zero errors and warnings; sequential bun run build0; scoped diffcheck0. One Bun-stdin observation imported the actual production createGitRemoteClient with deferred injected IPC: git_remote_advertise then git_remote_cancel; after the worker settled the outer scope remained pending, then completed only after cancellation acknowledgement. No saved testcase/helper/scenario file changed/added/run, no new matrix, native/network/profile/provider/repository operation or live handles. That observation covers the shared advertisement helper with controlled IPC, not Fetch/Push durability, actual native IPC ordering/OS-close/provider/platform acceptance. All original PLAN/PARITY gates remain active. /compact unavailable; explicit handoff recorded.

## Clone dialog workspace drain ownership — 2026-10-20

Source parent43b774e2. GitCloneDialog now registers List, staged Download and Inspect with the existing createWorkspaceWorkScope. Previously these invoked native commands directly, so renderer workspace drain could finish before their IPC/late review continuation. List/Inspect await their original native calls and publish only while their captured data/collection scope remains current. Download owns its accepted stage through result and any issued cancellation acknowledgement; workspace abort/disposal requests the existing remote supervisor cancellation once, and finally removes its listener and releases the scope only after completion. Manual Stop reuses that same owned cancellation Promise. Disposing an Inspect no longer sends an unrelated remote cancel against its previously selected operation ID.

Download completion keeps busy through the owned follow-up list refresh. Confirmation deliberately remains outside this component scope: confirmGitClone owns quiesce/transition/drain itself, so registering that call would make it wait on itself. Existing native stage/inspect/install leases, retained receipts/journals, review validation and installation/recovery transaction are unchanged. No new registry/worker/IPC payload or UI layout is introduced.

Validation: bun run check86006 terminal0/zero errors and warnings; sequential bun run build0; scoped diffcheck0. Source traced createWorkspaceWorkScope/current/finish, GitCloneDialog finally/dispose and createGitClone.confirm's quiesce boundary. No testcase/helper/scenario additions/changes/runs, native/profile/provider/local-or-remote repository operation or live handles. Actual held List/stage/cancel/Inspect, renderer close/collection change/restart/native/platform and every original PLAN/PARITY requirement remain unverified. Existing native/package/compiler runtime receipts retain their original source scope. /compact unavailable; explicit handoff recorded.
