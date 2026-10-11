# Retained guest callback leases for DOM dialogs

Current working session integration is documented in [PLUGIN-DOM-SESSION.md](PLUGIN-DOM-SESSION.md).
Its actual production worker/client scenario adds capability-frame, queue and
trusted interaction acceptance. Runtime assembly remains uncommitted; the initial
standalone acceptance below is historical. The pump now accepts trusted idle and
deadline predicates so host RPC drain/prompt waiting obey the runtime's policy.

DOM event listeners and onHide must survive the callback that opens a dialog.
The existing callback runtime removes helper privileges on return; directly
reusing that operation would make retained callbacks stale or close UI as soon
as the render session finishes. The new lease manager retains actual QuickJS
function handles with their lexical state and captures a trusted host owner.
Functions are not serialized through the value codec or recreated from source.

Each invocation copies argument values before queueing, rechecks ownership at
execution, and drains guest Promise jobs serially. The immutable guest dispatch
bridge only calls the currently executing handle. Release/Abort/current-loss
dispose idle handles; in-flight cancellation, guest failure or CPU interruption
revoke all leases and notify the caller after active handles are released.
The caller must replace the terminal VM. Queue/function limits bound retained
resources. The lease manager owns its polling timer, not the VM itself.

## Saved verification — 2026-10-11

`bun tests/ui/plugin-dom-callback-leases.js` runs headless through the shared
launcher with three dedicated, genuine QuickJS workers. Six groups prove retained
closure state after the original function handle is disposed, Promise results,
serialized overlapping messages, detached argument values/signed zero, idle
release/Abort/current-loss refusal, active Promise cancellation and terminal
guest exception/CPU interruption. The fixture verifies three worker terminations.
The fetched worker hash matches its saved compiled bundle. Compiler and audit
results are recorded in STATUS.md.

`bun artifacts/audit-plugin-dom-callback-leases.mjs --freeze` preserves local
src/tests-ui sources, the compiled worker and both original/served WASM bytes.
Without the flag it checks current/snapshot/result hashes and the acceptance
assertions. This does not bind a native executable or every external dependency.
All scripts use Bun.

## Integration still required

This manager is not connected to production plugin-session-runtime/worker/client
yet. Integration must share their single exclusive VM queue, bind leases to the
original capability owner, restore only its authorized helper frame while a
retained callback runs, and preserve the dialog owner's lifetime beyond the
short-lived render operation. VM replacement must release its DOM roots and
recover the admitted plugin catalog. Do not run two operation pumps on one VM.

Guest DOM nodes/mutations/event transport, event target/this semantics,
exactly-once onHide dispatch, generic HTML/private APIs, actual app route/native
activation and complete app facade parity remain required. This is foundational
callback lifetime evidence, not full DOM or product activation acceptance.

Reference: [QuickJS handles and async host interoperability](https://github.com/justjake/quickjs-emscripten).
DOM bridging references consulted: [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
and [Document.createElement](https://developer.mozilla.org/en-US/docs/Web/API/Document/createElement).
