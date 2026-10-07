# Git sync migration inventory

## Current-source remaining-work audit — 2026-10-07

- Local status/staging/selected commit/history, branch create/delete/switch and selected restore have production callers/native commands; restore pre-replace interruption is now verified (STATUS). Older foundation/TODO checkpoints below are historical, not current implementation descriptions.
- Fetch exists in git_fetch_command.rs, lib.rs and GitRemotePanel.svelte, including Inspect/Resume and cleanup. Existing artifacts git-fetch-depth-real-git1790791041039 and git-fetch-public-journal-restart1790791216338 were reread: real upload-pack full/selected depth1/history expansion/reconciliation and public-journal restart acceptance passed on their recorded journaled-fetch build. These historical artifacts do not prove the latest restore build or hosted-provider compatibility.
- No pull/push/clone/merge command is registered in current lib.rs; remote UI only exposes advertisement/Fetch. These original workflows remain missing. Do not replace them with Fetch or local checkout and call parity complete.
- git_journal.rs:344 accepts only schema1; lock_refs:424 rejects equal source/target branches; recover_inner:366 chooses state by symbolic HEAD branch and before/after workspace. This cannot represent advancing one branch from old OID to new OID. Follow GIT-REMOTE.md's versioned advance-ref table, retain schema1 recovery, validate complete tree/pinned merge inputs and workspace preservation before adding pull/merge callers.
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

2026-09-30 latest checkpoint: Advertisement now uses a cancellable native worker process with bounded lifecycle/registry. Cargo checks and 14 actual-source assertions passed. See [GIT-REMOTE-LIFECYCLE.md](GIT-REMOTE-LIFECYCLE.md); isolated app/IPC/settings/UI acceptance remains pending.

2026-09-30 latest checkpoint: git_remote_advertise primitive implemented with detached native remote and explicit auth mapping. Cargo checks and 14 actual-source loopback assertions passed. No UI/provider/fetch acceptance. Next bounded lifecycle/cancel and settings/client integration; GIT-REMOTE.md retains full remote scope.

2026-09-30 remote design checkpoint: See [GIT-REMOTE.md](GIT-REMOTE.md) for inspected legacy behavior, ordered implementation and acceptance. Current checkout journal cannot advance a branch tip; versioned OID-based recovery is required before pull/merge. Next settings/auth and read-only advertisement. Remote implementation remains pending.

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

See [CHECKOUT-TRANSACTION.md](CHECKOUT-TRANSACTION.md): actual storage/queue evidence, lock order, journal schema, recovery decisions and required acceptance. This is an implementation specification, not functional checkout. Next persistence barrier/generation prevents queued stale snapshots overwriting the native transition. No checks or builds performed for this documentation-only decision.

## Persistence barrier implementation — 2026-09-29

Read official Promise chaining semantics https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then and Tauri async IPC https://v2.tauri.app/develop/calling-rust/ before changing queue behavior.

persistence-queue.js provides save/exclusive/recover with idle/reserved/running/recovery/recovering phases and generation checks. saveData now uses this queue, preserving detached JSON snapshots and ordered ordinary writes. Reservation happens before await; accepted earlier saves drain, later saves reject without joining queue. A failed last baseline prevents transition callback from starting. Once callback starts, any failure requires recovery; only successful callback completion releases writes/advances generation.

persistence.js exports runWorkspaceTransition, recoverWorkspaceTransition, workspacePersistencePhase for upcoming workspace/native checkout integration. Callbacks must apply authoritative state before returning and must not call ordinary saveData while reserved. No native journal, startup recovery or mutation guard is supplied by the queue itself; do not use an empty recovery callback in product code. Tests used controlled callbacks to inspect queue state only.

27 inline assertions include deferred saves/transition/recovery, snapshot detachment, overlapping calls, error propagation/failure phases, retries, and actual persistence.js wrapper behavior with in-memory browser storage. Svelte0/0 and Vite build0; artifacts/persistence-barrier-check. Commands bun x --bun prettier --write src/lib/persistence.js src/lib/persistence-queue.js; bun x --bun svelte-kit sync; bun x --bun svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings; bun x --bun vite build. No saved test scripts or native acceptance.
