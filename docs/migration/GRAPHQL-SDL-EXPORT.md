# Native SDL export lifecycle

2026-10-12: scoped Windows native-hidden acceptance on root generation5c884ed,
executable9b3f05686b830b8dae5140daca7b68a548ce764ab5d87d40df42f1a5e10c1bda,
worker8893751d2adb8de85ea905425a15694be6527817d19644e1f5dfe188383b2811.

Saved scenario: `bun tests/ui/graphql-sdl-export-native.js`, with explicit
`INSOMNIUM_UI_BUILD_STATE=artifacts/native-current-root-5c884-20261012/build-state.json`.
The shared native helper hides its owned host before CDP attachment. The scenario
self-wraps exact workspace/store/cookie preservation and registers the actual
persisted fixture collection before introspection. It tests a real owned Windows
dialog cancellation, exact Unicode UTF8 SDL output, and actual file sharing write
refusal (`os error 32`); each case verifies return focus and unchanged workspace.
Exactly one introspection request and one native reply per dialog case occur.

Runner80120 and host50968 exit0; three groups pass. Compiler95021 reports0errors,
0warnings. Independent auditor357890 freezes the exact consumed sources, results,
saved output and denial sentinel at `artifacts/native-sdl-proof/audit.json`.
Both original buffers, plugin store and654baseline cookies match original hashes;
only one before-absent cookie bound to the registered collection in the changed
persisted workspace is removed. Clipboard is untouched.

The initial filename-readiness failure is retained in
`artifacts/native-sdl-negative-first/manifest.json`. The test polls only the strict
zero-matches filename-control assertion before any filename mutation. Ambiguous
controls, foreign dialogs and other errors still fail immediately. Existing
native chooser ownership helpers and product behavior are unchanged.

Official contract: [Tauri dialog save](https://v2.tauri.app/reference/javascript/dialog/)
and [filesystem API](https://v2.tauri.app/reference/javascript/fs/). Save returns
a selected path or cancellation; actual native write errors remain observable.
No subsystem was initialized and no generator was required.

This accepts the Windows SDL dialog lifecycle only. Full GraphQL parity, other
platforms and full migration remain open. The historical unbound empty cookie is
retained unchanged; its cleanup is not retroactively accepted. Root has no live
handles. `/compact` cannot be invoked by this interface; this is the handoff.
