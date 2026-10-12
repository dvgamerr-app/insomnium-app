# Native provider agent handoff — 2026-10-12

Worktree: `E:\.dvgamerr-app\insomnium-agent-native-provider`. Baseline HEAD `25fa97a62e55fae680ff01809fc30119396703b8` plus root's copied unfinished work; `artifacts/agent-baseline.json` identifies that baseline. No agent commit or root source changes. Root owns integration and the topic commit; do not stage all baseline differences.

## Completed cancellation fix

`src/lib/plugin-app-native.js` now rejects its consumer immediately when the actual owner AbortSignal aborts, without awaiting unresolved native IPC. It removes each call's Abort listener on settlement and observes eventual native success/rejection without republishing either. `signal.reason` is preserved exactly, including `0`, `false`, and empty string. Existing current-owner checks still deny stale results and new stale calls. Native work already dispatched is not canceled or undone; this change retires its consumer.

Event lease refresh rechecks owner/current lease after awaiting previous-lease retirement. Abort during that wait retires the replacement lease and prevents registering a fresh timer after owner retirement. No Rust changes, endpoint caching, early event completion or clipboard access.

Own new files: `tests/ui/plugin-native-provider-owner.js`, `tests/ui/fixtures/plugin-native-provider-owner.js`, this handoff. Saved scenario always uses shared headless `launchUiBrowser`; documented Tauri mockIPC controls native promises. A routed local HTTPS origin exercises the actual prepareEvent branch, not a modified product module. No native binary acceptance is claimed.

## Evidence

- `bun tests/ui/plugin-native-provider-owner.js`: initial 12-group pass `329894`; final 16-group pass `b68533`; final typed fixture replay `ed8948`, exit 0. Results/actual fixture bytes: `artifacts/playwright/plugin-native-provider-owner/{result.json,observed.json,fixture.js}`.
- All five methods: clipboard read/write/clear, Desktop path and info reject with identical owner reason before held IPC releases. Both late success and rejection remain suppressed. No redispatch, no page errors, removed per-call listener. Info starts exactly two expected IPC calls; each other method starts one.
- Stale owner refuses late publication and new dispatch. Three falsy Abort reasons preserved. Renewal: two leases issued, both retired, held refresh rejects owner reason, eventCall denied, timer allocation remains one (the original timer only).
- `bun run check`: final `7e1720`/session 30126 + `bc8829` exit 0, zero errors/warnings. Earlier checks exposed missing ignored generated files and fixture-only JS declaration errors; existing `bun run generate:openapi` (`f18198`) and `bun run generate:plugin-buffer` (`7de563`) supplied worktree-local generated files; declaration errors corrected. No compiler failures remain.
- All own command/process handles terminal. No app build/native executable/OS clipboard change; no fresh full terminal-owner replay claimed. Full integration/build belongs to root.

## Original held synchronous event gate remains open

`tests/ui/plugin-dom-terminal-owner.js` and its fixture are unchanged. Existing root proof has ten owner/store prerequisite controls passing, then unchanged held-sync started assertion failing; this agent does not relabel that suite accepted.

The controlled held-sync provider is a Promise-producing mockIPC closure in the Main Window. The native DOM listener calls synchronous guest clipboard read before its first await. The host retains that same native JS stack while pumping the event mailbox, preserving default cancellation. Preview cannot acquire the independent local native URI lease, so current routing refuses before that mock runs. Merely routing through the ordinary endpoint could start its closure but could not process Promise settlement or the subsequent page.evaluate Abort while the same Window stack remains active. The scenario awaits Playwright click before issuing its Abort; a permanently held synchronous event would also prevent that continuation. Endpoint cancellation above fixes asynchronous owner lifecycle, not this task scheduling conflict.

A valid additional native acceptance must use an independently held native provider and independently issued owner-retirement control (native window destruction/backend cancellation), then verify bounded exact mailbox retirement, no late value and actual default-action behavior. That requires coordinated native/worker/session architecture and a saved native-hidden scenario; the old Window-controlled test must remain explicit red unless its original semantics can actually be satisfied. Do not weaken it, cache clipboard contents, prematurely release the native event, or claim that this endpoint test closes the gate.

References consulted: [DOM AbortSignal](https://dom.spec.whatwg.org/#abortsignal), [Tauri core invoke](https://v2.tauri.app/reference/javascript/api/namespacecore/), [HTML event-loop processing](https://html.spec.whatwg.org/multipage/webappapis.html#event-loop-processing-model). Existing documented Bun/Playwright/Tauri tools used; no new subsystem/dependency/generator.

`/compact` cannot be invoked by this agent interface. This document is the handoff, not a claim that compaction occurred. Remaining gates: unchanged original held-sync event, true independent native cancellation/late delivery, current native binary and root integration/build; whole migration/Event/private/platform/provider and deferred shared-input UX/UI/CSS remain active.
