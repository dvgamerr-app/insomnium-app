# Dialog ownership after WebSocket and SSE completion

The actual workspace stream callback previously aborted its root controller as soon as a `closed` event arrived. A plugin dialog opened while rendering the connection URL therefore disappeared before the stream command returned. This differs from the retained ownership already supported for successful HTTP and gRPC completion.

The callback now records the closed connection state without aborting the root. After `connectStream` resolves, the workspace checks cancellation, records/persists the response and marks successful completion through the existing host-only lifetime registry. Cancel, command rejection and persistence failure remain ordinary revocation. A close notification alone does not grant completion authority; late command success cannot promote an already-cancelled signal.

Implementation uses the existing documented command/channel contract: [calling Rust](https://v2.tauri.app/develop/calling-rust/) and [JavaScript core API](https://tauri.app/reference/javascript/api/namespacecore/). No subsystem or generator is initialized. Verification commands are `bun run check`, `bun run build`, `bun tests/ui/plugin-dom-render-owner.js`, `bun tests/ui/plugin-cancel-recovery.js` and `bun tests/ui/plugin-dom-session.js`.

## Verification — 2026-10-12

The existing saved owner scenario and fixture now cover both WebSocket and SSE using Tauri's installed `mockIPC` API. Production workspace execution, request rendering, registry, genuine plugin/template workers, dialog and captured environment helper remain real; stream command/channel delivery, cookie snapshot and persistence are controlled adapters. This is frontend ownership evidence, not an actual native connection.

For each protocol, the scenario verifies the dialog remains through a closed notification while the command is unsettled, survives successful command/persistence and running-entry removal, and executes a genuine guest callback using the captured environment. Idle request-source change closes it. Actual workspace Cancel followed by late closed/success remains aborted and not completed, with `cancel_http` observed. Closed followed by command rejection closes the dialog and retains error state. Result `streamControls` records success/Cancel/error signals, state and IPC command inventory.

- The negative run after adding the required empty cookie-snapshot adapter reproduces dialog count0 instead of1 at the closed event. Exact pre-fix workspace/fixture/scenario and negative result/diagnostics are frozen under `artifacts/plugin-dom-stream-owner-proof/negative`; baseline commit38ecf33. Earlier3428/1951 fixture timeouts lacked the cookie-snapshot adapter and are not product-regression evidence.
- Compiler73261 before the product fix and final65889 both exit0/0errors/0warnings. Final build exits0/6.73s.
- Final saved owner scenario exits0:20fixed-headless groups/41terminated real workers (three plugin/thirty-eight template). Saved Cancel recovery and callback-session regressions exit0.
- `bun artifacts/audit-plugin-dom-stream-owner.mjs --freeze` and subsequent read-only audit pass613exact source/config/script/frontend/generated snapshots, three accepted result hashes, preserved negative source/result hashes, both worker hashes and both protocols' recorded controls. Accepted manifests are never overwritten.

Fresh native WebSocket/SSE completion, Cancel/error/source-loss acceptance remains required: executabled2c20319 and native45checks predate this changed workspace code and cannot verify it. Ordered guest onHide before terminal Abort/unload, full DOM/private/clipboard/save platform/provider/all original migration remain open before deferred shared-input UX/UI/CSS. Normal dialog Close is covered by previous gates; terminal ordered onHide is not claimed. STATUS records commit/evidence/live handles and the handoff; the interface cannot invoke `/compact`.
