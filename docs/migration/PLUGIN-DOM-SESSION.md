# Retained DOM callback production session candidate

The working callback runtime, production worker and host session now admit
retained guest functions only during an explicitly enabled, guarded helper
operation. Host callbacks receive opaque invoke/release capabilities instead of
trusting guest-supplied owner data. Ordinary and retained invocations share the
same host queue and worker running guard, so only one VM operation executes.

The runtime captures the original helper generation and activation flags.
The client captures the original current guard, helper/sync endpoints and
interaction subscription. It restores them only while that retained callback
runs. An ordinary later callback cannot revive a saved old app facade. Nested
retention captures the original operation owner rather than depending on the
lifetime of its parent function handle. Release/owner loss revoke idle handles;
active owner loss or guest failure closes the worker. Late host replies cannot
reach a replaced or terminated callback.

The lease pump waits for pending helper RPC even when the guest did not await
the returned Promise. Trusted prompt waiting shares the existing deadline pause
and ten-minute total limit; ordinary guest execution remains bounded. Runtime
bootstrap/failure/dispose also release the lease manager and its timer.

## Verification — 2026-10-11

`bun run build` produces the current application and production plugin worker.
`bun tests/ui/plugin-dom-session.js` passes seven fixed-headless groups through
that actual worker plus current bundled host client/QuickJS runtime: original
helper capability/closure state across ordinary callbacks, opt-in refusal,
nested lease after parent release, explicit/root release, unawaited helper
drain, prompt waiting for 5.3 seconds, idle current-loss refusal, active Abort
and late helper suppression, guest exception and CPU timeout. Four real workers
are observed terminated; the fetched worker hash matches the build artifact.

Saved plugin-app-sync, plugin-app-dialogs, plugin-helper-render,
plugin-cancel-recovery and standalone plugin-dom-callback-leases also pass.
Compiler is zero errors/warnings. `bun artifacts/audit-plugin-dom-session.mjs
--freeze` preserves local source/scripts/configuration, complete frontend build
bytes and six acceptance results. Run without the flag to audit current/exact
snapshots and worker hash. This does not prove native executable acceptance or
every external dependency. Exact counts/commit/handles are in STATUS.md.

## Commit and remaining scope

The topic commit contains the lease-pump idle/deadline extension and saved
production integration fixture/scenario/evidence document. Runtime/client/worker
assembly remains uncommitted with the broader helper runtime: those files also
contain earlier helper, sync mailbox and generated Buffer integration whose
dependency/generator/provider gates remain open. Do not claim this topic alone
activates the production feature from a clean checkout.

Actual guest DOM node/mutation/event/target/this transport, c.app.dialog binding,
exactly-once onHide, long-lived dialog ownership beyond render completion,
generic HTML/private APIs and app route/native activation still remain. The
existing native624e14fa proof predates this callback integration. Broader provider,
clipboard-format restoration, native save/platform and original migration
parity remain required before the deferred shared-input UX/UI/CSS phase.

Reference: [QuickJS guest handles and promise jobs](https://github.com/justjake/quickjs-emscripten).
