# ResourceManager validation association

Isolated feature from b95c089 / preceding inventory commit257b9d1. Local blank-name and malformed/non-object folder JSON failures now use existing Field.error. Corrected valid input clears its local error; synchronous topology/callback failures remain the form-level alert. Successful retry clears that alert. No CRUD callback/data policy, CSS, global Field, editor, dependencies or native code changed.

Root reviewed an actual invalid-name regression before authorizing LOCAL explicit Field.label for Name and Folder variables. Error text in the former implicit label changed its accessible name. The two explicit labels now keep exact names in valid/invalid states while error text is a description through the exact Field error ID. Other valid implicit labels remain untouched. Native label clicks still focus their controls.

## Evidence and limits

- Original source1a4eb656: saved24 missing-association failures (blank/malformed/array/null ×dark/light1440/900/760×600), with no callback/data change; `artifacts/resource-field-proof/negative`.
- Initial implicit-error version: exact Name locator fails when error enters the label; `negative-implicit-error-name`. That assertion was not discarded: final scenario explicitly asserts both exact names before/after each error and correction.
- Original source replay also preserves stale form alert after successful callback retry: `negative-stale-callback-retry`. Clearing form error at the next Save fixes this existing refusal/retry behavior.
- Final SAME saved resource-manager scenario `2e8df7` exit0: all original six last-collection/disabled-keyboard/confirmation/back assertions retained;24 local refusals, exact IDs/aria-invalid/aria-describedby, one local alert/no duplicate form alert, correction/trimmed exact patch/unchanged unknown fields, callback failure/retry, real label click, Enter submit, focus preservation, hover+focus danger priority/no outline/shadow, Escape modal dismissal and trigger restoration. These are component fixtures, not real/native CRUD acceptance.
- Six baseline/final profiles and12 controls have EXACT x/y/width/height/color/background/font equality. Captions use500 rather than400, the existing explicit Field.label public default approved by root; no CSS override was introduced. `baseline-geometry.json` and `geometry-audit.json` retain this distinction.
- Compiler44662 exit0/0errors/0warnings uses an explicitly verification-only preview helper supplement for four PREEXISTING fetch-option errors in plugin scenarios. The normal unsupplemented compiler4252 remains red4/0, unrelated to these three changed files. Root exact helper bytes and original bytes/SHA are archived in `verification/manifest.json`; the tracked helper was restored before commit and is NOT offered.
- Locked `bun install --frozen-lockfile --ignore-scripts` installed only own dependencies. Existing generate:openapi/plugin-buffer commands write ignored src/lib/generated outputs. Frontend build85516 exit0; full saved design-system55204 exit0. All own handles terminal; no browser/native/profile claim remains.

## Frozen handoff

Audit `artifacts/resource-field-proof/final/audit.json` SHA256 `eb755a429e4fdeee0ab2dfe57ef0e2baad1c4c8f5943a52b9f7a2e394fc0ffc0` binds775 snapshot/output files. `verification-source/<original path>` maps actual consumed source/harness (including the explicitly temporary preview supplement and generated files); `frontend` maps emitted build; `scenarios/resource-manager` and `scenarios/design-system` map output/bundle evidence. Original source bytes are in `artifacts/resource-field-proof/baseline/<path>`.

| Offered path | Original → new SHA256 |
| --- | --- |
| src/lib/components/ResourceManager.svelte | 1a4eb6565c48631721577aa470ff98dc83c13e0758f140d436ab2dee29c94912 → 5cd5571ac455460bcdfd1e75b034e6a548ae7b1675b50144706dee78cb142d57 |
| tests/ui/resource-manager.js | 20c64c6edc31e3f8eb833330e39a4df29d6630584da7202f70ae9a23263bc221 → c9f560dd253f1054d9158d2ed492266f608ba4295efd3863b051137d808dd1f9 |
| tests/ui/fixtures/resource-manager.svelte | b285d6ce004fe2541238becc8890f194e53134c8cbc776e461dd3bd49d448829 → 25cd0486e563b7ca1fb66ff4a98d3f24591b2387c7eadf081eced68b8bbef227 |

This report and own STATUS checkpoint accompany those three intended files. Do not integrate preview-app, generated files, dependency/build outputs or overlay own STATUS onto root. Root independently integrates/replays against its newer current source. Actual ResourceManager/native CRUD, real workspace persistence, assistive technology, other-platform and complete UI/migration gates remain open; no old native executable embeds this fix. Prior inventory/external proofs remain immutable.

Primary references read before implementation: [Svelte derived state](https://svelte.dev/docs/svelte/$derived), [Svelte effect dependencies](https://svelte.dev/docs/svelte/$effect), [WAI ARIA21 field error association](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA21.html). Existing Field/Input/Textarea public implementations supply the reactive association and existing theme styles; no new form subsystem was added.

Topic commit is reported in the final handoff; root owns integration/STATUS for its tree. `/compact` cannot be invoked in this interface, so this frozen handoff is provided instead. No live handles.
