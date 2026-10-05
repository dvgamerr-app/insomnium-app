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

References consulted before implementation:
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

| Observed state | Required behavior |
| --- | --- |
| Expected old ref, old/prepared metadata | Verify retained stage and resume the planned import/publication, or explicitly abandon while retaining any physical cuts needed by imported dangling objects. Do not blindly restore old shallow bytes after partial import. |
| Intended new ref, prepared/final metadata | Validate objects and complete final metadata; report the original operation as committed. |
| Any unrelated ref or unrecognized metadata | Retain journal/stage and report conflict; do not overwrite external changes. |
| Stage absent/corrupt before completion | Keep protective metadata and pending journal; report missing recovery evidence. Do not guess from timestamps. |
| Cancellation before journal | Existing cancellation/cleanup semantics. |
| Cancellation after durable journal | Settle or expose recovery for that same operation; do not publish another UUID or delete recovery material prematurely. |

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
