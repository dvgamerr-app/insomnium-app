# Git fetch staging

2026-09-30 latest checkpoint: git_remote_fetch command wired with persisted binding/settings admission before/after network, app-data stage, cancellation, snapshot publication and operation-ID reconciliation. Cargo checks;15 admission +23 snapshot +17 import +15 pack assertions passed. Actual command IPC/UI/lock-race/recovery acceptance pending; next JS client/workspace/UI and saved Playwright.

2026-09-30 latest checkpoint: Immutable fetch manifest commit + single endpoint-scoped pointer implemented, using verified importer and sorted branch-tip parents for reachability. Cargo checks;23 snapshot +17 import +15 real-pack assertions passed. Native command/binding admission/UI and crash/recovery/full parity remain pending.

2026-09-30 latest checkpoint: Lease-gated object importer implemented and standalone verified (17 import/cancellation +15 real-pack assertions; Cargo checks passed). Copies complete verified graph without refs/HEAD/worktree changes. Production caller/publication remains pending; remove temporary scoped dead-code expectation when wiring it.

2026-09-30 latest checkpoint: Fetch validates complete reachable commit/tree/blob graph with type/hash checks before success. Cargo checks,15 graph +15 direct-pack assertions and15 worker-pack regression assertions passed. Parent verified import/publication, UI/recovery and full parity remain pending; current validation size limits documented in STATUS.

2026-09-30 latest checkpoint: Native WorkerOutput now hands successful staging lease to consumers; app-data/UUID allocator added (not yet public Fetch IPC). Cargo checks,58 lifecycle/ownership/allocation assertions and15 real-pack assertions passed. Next object validation/import and snapshot publication, then Fetch UI; restart recovery/full parity remain.

2026-09-30 latest checkpoint: Parent now reserves fetch container/ownership marker; confirmed failed/cancelled workers clean it automatically, successful or uncertain work is retained. Cargo checks,43 lifecycle/ownership assertions and15 real-pack assertions through supervisor passed. App-data allocation, restart recovery, successful-stage handoff/publication and UI remain pending.

2026-09-30 latest checkpoint: Fixed supervisor termination evidence: explicit checked wait, idempotent reaped state and joins of both pipe threads before returning errors. Cargo checks/native33 assertions passed. Automatic staging allocation/cleanup, publication and UI remain pending; see STATUS.md.

2026-09-30 latest checkpoint: Fetch now uses shared native process supervisor (300s cap/305s watchdog; advertisement remains30s/35s), with staging ancestor symlink/reparse checks. Cargo checks and29 native assertions passed. Parent-owned allocation/cleanup, publication, IPC/UI and full parity remain pending. See GIT-FETCH-STAGING.md.

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
