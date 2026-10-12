# Spectral owned job lifecycle bugfix handoff

2026-10-12. Own worktree only; root integration and topic commit remain parent-owned. V6 and every earlier native/UI proof remain immutable. No Spectral Tauri application/profile or packaged producer was launched in this lane.

## Frozen deliverables

The exact ten backend inputs and byte hashes are in `artifacts/spectral-manager-fix-20261012/final-audit.json`; immutable files are under `final-handoff-source/`. This supersedes V6 manager implementation, not its historical verification record. New `src-tauri/src/spectral_jobs.rs` contains the pure manager shared by production and the artifact harness.

Core manager SHA256: `6ea60a708a8c70585f96a5d1bd0cb58a7fd06a6381b51047a7a6d54c4d08c67b`.

Command wrapper SHA256: `a66d0c18b14b505e88082046e9dc8be41f7fcf3a6819b4c85fe4e395e17ed86a`.

Final Windows executor SHA256: `e6bf39484b98e66dbefe018ed4fe4649f61746bb89f4cd7c0fd33bee1a09c8e7`.

App lifecycle wiring SHA256: `c09627b658aa77eba0f4b8dbfe81036a462a54ed2d439e9ba2a6a4bd92b64bdd`.

## Behavior

RESERVE validates scalar identity, byte limits, owner and active capacity, then returns a server UUID promptly without Git/filesystem admission. A dedicated expiry/reaper retires abandoned in-memory payloads after thirty seconds even with no subsequent command. Eight active entries and two owned worker threads are separate bounds; retired refusal metadata is limited to 128 entries/sixty seconds and contains no document body.

RUN accepts the absolute fifteen-second deadline before queue, binding, executable validation, serialization and spawn. Metadata-only admission uses cancellable `try_lock` loops in Git then Storage order. Source remains manager-owned until successful admission and a live/deadline check. Workers are dedicated bounded threads, independent of Wry and Tokio's blocking pool. CANCEL flags the known job immediately and removes any pending body before awaiting a shared asynchronous watch completion; no waiting thread is allocated per cancellation RPC.

Success and cancellation settle under the same registry mutex. A late cancel after successful settlement returns false; a true accepted cancellation cannot coexist with published success. Normal ExitRequested prevents exit and joins timer/workers/processes on one owned coordinator, then preserves the requested exit code. Tauri's forced restart sentinel ignores prevent_exit; forced restart/final Exit retains the explicitly documented synchronous fallback. Hard interruption of filesystem/libgit2/kernel calls is not proven.

Pipe writer/read failures signal the monitor promptly. Windows processes remain suspended until job assignment, limited inherited handles, eight active processes, aggregate 512 MiB and no breakaway. Ambient Bun/Node option injection is filtered. The monitor/pre-termination step captures actual process objects with SYNCHRONIZE/query rights, verifies membership in this exact Job Object, and retains PID plus creation FILETIME identity. Cleanup waits these observed objects after root wait/accounting zero. Observation/retention buffers are sixteen entries; these are bookkeeping bounds, not changes to the eight-process execution allowance. Overflow kills/errors the operation. Missed fleeting births remain an open containment/physical-reap guarantee; no missing-birth permanent wait or accounting-count equality proof is claimed.

## Verification and immutable negatives

All handles listed below are terminal. Saved logs, source snapshots, compiled binaries and hashes are bound by `final-audit.json` (ten source files, twenty-six evidence files).

- Cargo check `94176`: exit 0. Generation-1 manager tests `64677`: exit 0, eleven cases, actual idle expiry 30.25 seconds. Tests cover eight finished jobs followed by a ninth reservation, active/running limits, cancel-before-start, immediate cancellation while a binding mutex remains held, sixty-four cancellation/success races, absolute run budget, bounded tombstones, off-thread shutdown and shared watch completion. Production calls the same tested owner/lock helpers.
- Final Clippy: exit 0 with `--no-deps -- -D warnings`; five existing vendored eventsource warnings remain. Initial manager and observed-object generations were independently checked before later edits.
- Final exact executor `executor-4`, build `80152` and replay `24620`: exit 0, eleven groups. Original strict early/success/tree/deadline/stdout/stderr/memory/fresh/environment/combined quota cases are retained, plus actual closed-stdin producer failure. The root/child/grandchild strict dead-process assertion passes; combined quota retains refusal, one to seven created children and every recorded PID dead. Fifteen-second timeout, output budgets and environment filtering are unchanged. The Win32 closed-stdin producer remains alive before cancellation and yields process failure/reaped root in 119 ms.
- `executor-1/run.log` is the original strict tree negative: accounting zero/root wait returned while a descendant was briefly unsignaled. The artifact observer proves this with exact process handles opened before cancellation and verified in the actual job: observation seven was `[true,false,true]` at executor return, then the child signaled after a further 1 ms. Nine completed observations are preserved. Its later empty-marker parse failure/timeout is separately retained and is not acceptance.
- `executor-io-1` preserves the invalid fixture assumption: Bun `closeSync(0)` did not demonstrate closing Win32 inherited stdin; result was timeout. `executor-io-2` closes `GetStdHandle(STD_INPUT_HANDLE)` with Bun FFI/CloseHandle and asserts success before its entry marker; all six isolated IO/default/budget/environment groups pass. The final fixture is byte-identical to this corrected compiled fixture.
- `executor-2` preserves the eight-ID observation buffer negative: nine groups, including the strict tree, passed before quota failed to write its expected count. `membership-diagnostic-1` proves ERROR_MORE_DATA at the process-list query. Windows documents that failed limit associations temporarily increase accounting/list membership. The final sixteen-entry observation/retention correction passes the unchanged quota oracle. `executor-3` is build-only, never launched.
- Initial failed audit preparation used incorrect non-autogenerated permission paths and wrote only a partial `handoff-source` directory; it is not accepted evidence. Only `final-handoff-source` plus `final-audit.json` constitutes this delivery.

Commands use Cargo and Bun only. The artifact manager package compiles the exact production manager file; the executor package compiles the exact final manager/executor with production numeric limits and owned compiled Bun fixtures. Observer/diagnostic derivatives are explicitly separate artifacts, not production acceptance or packaged-producer acceptance.

## Repository source acceptance remains open

Read-only audit found `GitState(Arc<Mutex<()>>)` with no repository generation. Current binding checks whole saved resource identity/private/registration and managed path before RUN; the mutex is released before producer execution. Neither ID nor HEAD detects changes to `other/.spectral.yaml`, custom functions/imports or referenced working-tree files, including external edits or trusted custom-function effects.

Actual Spectral ruleset bundler 1.8.0 paths were inspected: YAML migration/extends use supplied `fs.promises.readFile`; the Node preset installs only its URL plugin. Rollup default loading reads local function/import files outside that supplied filesystem wrapper. Package imports are externalized and loaded through `createRequire` in `loader/node.js`. Current producer reference catalog captures document-reference contents, not the complete ruleset/import/function closure. A filesystem wrapper alone therefore cannot establish this gate.

Proposed scoped acceptance: collect content read receipts for ruleset/migration/import closure, Rollup-loaded modules and actual repository references, including fallback/missing outcomes; native reacquires cancellable Git->Storage before publication and revalidates whole binding plus each captured content receipt against current managed files. Explicitly distinguish these declared lint inputs from arbitrary trusted custom-function filesystem/network effects, which legacy permits. Do not add a sandbox or pretend ambient effects are deterministic. A whole-tree before/after hash alone misses transient ABA reads and poorly bounds large modules; no token/receipt implementation or full same-source assertion is claimed here.

## Primary references and remaining gates

- [Tokio watch](https://docs.rs/tokio/latest/tokio/sync/watch/index.html): shared async completion without per-RPC wait threads.
- [Rust JoinHandle](https://doc.rust-lang.org/std/thread/struct.JoinHandle.html): physical owned thread joining, not detach-on-drop.
- [Windows process termination](https://learn.microsoft.com/en-us/windows/win32/procthread/terminating-a-process): process-object signaling proves observed process termination.
- [Job accounting](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_accounting_information): failed associations are included and temporarily affect active accounting.
- [Process-ID lists](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_process_id_list): variable-size membership lists.
- [Job completion notifications](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_associate_completion_port): ordinary lifecycle notification delivery is not guaranteed, and PID reuse requires retained objects.
- [TerminateJobObject](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-terminatejobobject): termination request is analogous to individual TerminateProcess calls.

OPEN: actual Tauri command admission/Git locks/window destroy/restart, packaged producer integration, native total deadline under blocked filesystem/kernel calls, unobserved fleeting process births, repository input receipt/revalidation, Unix containment/platform parity. Original Event held synchronous Promise IPC/FIFO gates remain RED, unrelated to this lane. No full migration, Event, provider, private/platform or native Spectral acceptance claim.

No live process handles and no profile claim. Parent should review/integrate ten exact backend files by topic and update STATUS before continuing. This interface cannot invoke `/compact`; this document supplies the handoff instead.

## Root guarded integration

Root independently rehashes10exactbackend snapshots and26evidence files, reviews four existing native-file deltas (only three closed commands/state/lifecycle and WindowsAPI features), and integrates the frozen generation. Actual root Cargo test26316 exit0,11manager tests pass in30.31s, including realidleexpiry/cancel/settlement/bounds/shutdown. Existing57autogenerated permission files and Cargo.lock remain byte-exact; only3newgenerated commands added. Root audit artifacts/spectral-native-root-proof/root-audit.json. Agent exactexecutor11/Clippy acceptance stays bounded artifact scope; no root nativeapp/packagedproducer launch. Unobservedbirths/hardFS/restart/repositoryreceipts/platform/currentnative remain OPEN. Root handles terminal, UI/receipt agents continue separate work; /compact unavailable explicit handoff.
