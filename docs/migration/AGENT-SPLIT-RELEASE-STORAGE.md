> Historical agent report: its prefix-origin guard claim is superseded by [AGENT-SPLIT-ORIGIN-GUARD.md](AGENT-SPLIT-ORIGIN-GUARD.md). Root integrates the corrected parsed guard; original frozen report remains unchanged in the agent worktree.

# Split release/cancel wiring and size-storage guards — 2026-10-12

Test-only topic; no product failure or correction. Same saved nocturne-workspace/split-pane helper extended. Current root immutable48 frontend assets from split-collapse-root-proof/root-snapshot/build verified against root-audit26d0c1 and copied into owned split-guards-proof/frontend. SplitPane4aee and approved root/native heavy adapter35d7 remain unchanged; original91dc proof/helper preserved separately. No working build/native artifact mutated or native launch.

## Actual contract and evidence

- Existing stop handles pointerup/cancel/lostcapture, clears pointer/dragging and saves last geometry. Six actual pointer-release profiles (dark/light1440/900/760) start a real captured pointer, call documented releasePointerCapture on that actual ID, observe trusted lostcapture, then move/up outside. Dragging/pointer suppression clears; real request content click works and later unpressed hover leaves grid tracks unchanged.
- Six additional profiles dispatch an explicitly untrusted pointercancel only to verify the existing handler wiring, then release actual capture safely and clean up. These are NOT native/OS/touch cancellation acceptance. [Pointer Events capture/release contract](https://www.w3.org/TR/pointerevents3/#implicit-release-of-pointer-capture) distinguishes user-agent capture release from manually dispatched events.
- SplitPane onMount catches denied getItem and accepts finite0–100 numeric ratios; save catches denied setItem. Forty-eight separate browser-private cases cover read/write SecurityError, NaN/Infinity/-1/101/non-numeric strings and valid47.25 across six configured theme/width profiles. Invalid/read-denied values match bounded initial reset; valid decimal initializes rounded47; live Arrow/reset remains usable. Denied writes preserve the prior stored value and prove blocked writes occurred.
- Fault interception is limited to EXACT `nocturne:split:workspace-left` on that context's localStorage. All other keys and global workspace persistence remain intact. Ctrl+S flushes startup metadata before capturing original normalized workspace bytes; every case leaves them exact and records zero page errors. Each private context restores method descriptors and closes in finally. A closed127.0.0.1 preview-origin guard refuses native/external pages before creating contexts. No native store/cookies or user browser data touched.

No rollback-on-cancel requirement introduced: the existing contract commits last drag geometry. Empty numeric string still maps to0; no undocumented rejection claim. Real OS cancellation, other engines/storage policies and orientation interruption remain open.

## Guarded two-file delta and checks

Before: helper48f350ebefb50593137e0b734aa7c4bea8a5880767eec403acceaca1c2c041d4; workspace12fde4c60822db54cfa13d273191f6afd501585abdefff9e4ac9b3e15db0caad. Final hashes are recorded in split-guards-proof/audit.json harnessHashes. Only these two test files and this report should integrate; do not include copied35d7 heavy adapter as this lane's delta or unrelated baseline sources.

Final `tests/ui/helpers/split-pane.js`:85e15146648e97516af93e2e6e6e333bf32879718fe37e2ff34244dcae2f4269. Final `tests/ui/nocturne-workspace.js`:96d8f61ea41bc44029153fcf24d4e1d6990f618332e38f465bcf04cc95e2b2a9.

First full92134/36d8fc passes all new profiles and original6collapse/12heavy/36states/12reload invariants. Compiler47864/cec38b finds13 test JSDoc inference errors; explicit Page/Context declarations reduce them to3 Storage parameter errors65671/6a0853. Final explicit JavaScript annotations fix these without product change. Compiler46472/ca717a terminal0errors/0warnings. Final saved full scenario72623/e10783 ->16af15 terminal0/headless on exact current-root frozen assets. Shared launchUiBrowser unchanged. Bun standalone5-module compilation passes.

Independent final audit0e421a preserves48 asset hashes,7 harness/package/lock files and raw12release/cancel +48storage rows, all zero error arrays/workspace preservation, plus retained6collapse/12heavy/36states/12reload evidence. First-pass source/audit retained separately. No product build needed: exact already-built root assets used and SplitPane byte SHA unchanged.

All own handles terminal/namespaces released; source frozen for root review/topic commit. Browser-private coverage does not close full UI/accessibility/platform/native/full migration. Historical unbound-cookie gate untouched. Parent owns STATUS. `/compact` unavailable; explicit handoff provided.
