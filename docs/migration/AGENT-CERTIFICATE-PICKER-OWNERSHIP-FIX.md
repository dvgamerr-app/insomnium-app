# Certificate picker ownership correction — 2026-10-13

ClientCertificates now retires pending picker mutations and feedback when its component, observed collection generation, workspace data, or exact certificate resource changes. A valid current selection retains the existing editResource persistence convention. Generic failures render once in their owning CA or client surface, and never mark a certificate input invalid. Existing CSS, normal geometry, shared controls, native/network scenario body, TLS/backend/provider behavior and dependencies are unchanged.

The existing workspace work scope begins before opening the picker and finishes after its promise settles. Cancellation refuses stale synchronous resource mutation; it does not physically cancel the OS dialog. Queued save settlement remains owned by the existing persistence queue, separately from component picker lifetime. No redundant persist call or workspace API expansion was added.

The SAME saved headless scenario retains all 156 measurement cases and adds 66 correction cases across dark/light at 1440/900/760×600. All passed: zero retired-operation writes or alerts, one owning generic alert, held cancellation preservation, exact normal geometry/fonts/colors, same-ID resource replacement, inactive collection refusal and actual workspace drain waiting for picker settlement. Collection ABA evidence uses separately flushed observed transitions. Same-turn coalesced ABA is unproven and remains OPEN.

## Frozen evidence

Final manifest: `artifacts/certificate-component-fix/final/manifest.json`, SHA256 `d60e81b09471b52e6ad3361f64bebbc663e3135d35a0064b64eafe7d124a31a5`, eight offered source snapshots and 82 output receipts. Exact current-root before bytes/absences are in `final/root-before`; offered sources are in `final/source`.

- Compiler74007: exit0, zero errors/warnings (`compiler-final-v5.log`).
- SAME saved scenario31105: exit0, original156 + correction66 (`scenario-final-v5.log`).
- Shared design-system97986: exit0 (`shared-regression.log`).
- Final Bun frontend build: exit0 (`build-final-v5.log`).
- Saved audit `audit-final.js`: exit0; whole original native/network body and consumer CSS equality, original-negative hashes and correction assertions verified.

The accepted original measurement manifest `5b0e29d1f06862da2e08c92793179d5f19c8399eff996385f9d4077bf3e9da37` remains unchanged. Reused live output paths are explicitly historical: all 18 original byte receipts are preserved under `immutable-negative`, mapped by `negative-preservation.json`. Its original fixture bundle was rebuilt from exact unchanged old source snapshots and accepted only after byte-exact original hash/size comparison; measured negative data was not rerun or relabelled. The original 24 persisted stale writes and duplicate alerts remain preserved. Initial correction shadowing failure (compiler53401/scenario1) is retained in failed-v1 and corrected with a distinct isCurrent guard.

## Documented lifecycle contract

Consulted official [Svelte effects](https://svelte.dev/docs/svelte/$effect), [lifecycle hooks](https://svelte.dev/docs/svelte/lifecycle-hooks), and [untrack](https://svelte.dev/docs/svelte/svelte#untrack). Effects are batched; the implementation claims observed transition retirement, not universal same-turn history tracking. Existing `createWorkspaceWorkScope`, persistence queue immutable snapshots and exclusive-transition tail ownership supply the project contract.

Commands used: `bun run check`; `bun tests/ui/http-client-certificate.js --certificate-component --certificate-corrected` with the frozen owned source root; `bun tests/ui/design-system.js`; `bun run build`; `bun artifacts/certificate-component-fix/audit-final.js`. Every browser scenario used shared headless launch. There was no agent native/app/profile/root/cache mutation or launch. All own process handles are terminal. Root guarded adoption/current-tree replay and real OS picker acceptance remain separate gates; full migration is not complete.

This interface cannot invoke `/compact`. This frozen handoff substitutes for compaction; no next feature has started.
