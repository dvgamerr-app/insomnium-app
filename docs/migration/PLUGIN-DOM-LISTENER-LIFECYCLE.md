# Owned listener lifecycle checkpoint — 2026-10-12

This browser checkpoint preserves native synchronous default cancellation, private Event identity/state, ready microtask checkpoints and bounded same-owner nested retained callbacks. It does not complete the full Event feature or migration. Native provider wiring is committed separately in94b8d06.

Removing an executing listener now revokes future entry while preserving its borrowed active handle until return/continuation. Same-stack once re-registration retains its new lease immediately through the existing native frame, before admitting the new listener. Trusted owner/generation/capability guards remain required; no new CPU/helper budget is granted. A removed lease cannot enter again.

Saved `bun tests/ui/plugin-dom-listener-lifecycle.js` compares actual production guest callbacks to independent native browser behavior for self-removal, self-removal across controlled host waiting, once nested entry, once re-registration, peer removal, peer addition and passive cancellation. All7modes/21checks pass; checked state, exact observations and stale-entry refusal match, every worker terminates. Current worker SHA256:06d0dab348d6a68eb54ad8f03042d262e49b96210d5a23380cc953d84766b699.

Current retained acceptance: host-wait4, host-wait guards6, checkpoint3, identity4, Event surface15, six production regressions68, retained lease6, nesting12, nesting guards4, standalone transport16. Together with listener21:159passed groups. Original terminal-owner replay25086/268120 exits1 at its unchanged held-sync controlled clipboard IPC assertion after10owner/store prerequisite controls; full suite acceptance is not claimed. Root compiler0errors/0warnings, production build0 and Cargo check0 are recorded in STATUS.

`bun artifacts/audit-plugin-dom-listener-lifecycle.mjs`60582/5c3802 exits0 and freezes789exact source/config/scenario/results/actual-worker/Wasm files in `artifacts/plugin-dom-listener-lifecycle-proof`. It verifies all771previous nesting proof files unchanged plus two729file listener failure snapshots. Both initial self-removal and same-stack once re-registration failures are preserved; no assertion was weakened.

Still required: additional unrelated asynchronous callback frames and same-lease async overlap, full synthetic dispatch and outer Window-stack semantics, subclasses/property handlers/full listener-option and Event controls, original held-provider cancellation, fresh native acceptance of current frontend, full private/platform/provider and all other migration/UI/CSS parity. Agent Event API work continues in an isolated worktree. No current native acceptance is inferred from this headless proof.

Topic commit is a verified browser checkpoint, not full Event completion. Root has no live process handles at this checkpoint; agents may have separately recorded handles. `/compact` is unavailable through this interface; this file and STATUS provide the explicit handoff.
