# Existing Field/FilePicker composition experiment

Fixture-only measurement after V2 handoff. No production/shared API/global style/editor/backend/native/profile changes. Original63-file6aa138ab and66-filecf575330 RED generations unchanged. SAME design-system preserves its complete original suite and actual KeyValue fault/admission/disposal/stale guards; aggregate production RED is deferred until after experiment receipts, never skipped. Terminal35253 remains exit1 for original production24defects, while all six experimental composition profiles pass.

## Measured composition

`tests/ui/fixtures/multipart-file-composition.svelte` uses existing Field `label=""` explicit-div branch. Its empty caption is hidden only in the experiment; FilePicker is nested inside existing display:contents `.kv-value-field`, preventing generic `.ui-field > label` caption selectors from matching its own label. Field root computes display:contents. There are zero nested labels. File type Select remains outside Field context and unmarked on file error. Accessible names `File value 1/2` remain exact with distinct IDs before/after selection, while visible filenames remain `same.txt` unchanged.

At dark/light1440/900/760×600, experimental valid row/control rectangles relative to their row, heights, widths, fonts, colors and backgrounds match actual production KeyValue geometry EXACT in the same fixture position. The prototype is a bounded file-row composition model, not a complete replacement for KeyValue's multipart metadata/template workflows.

## Necessary wrapping evidence

Initial unwrapped experiment29130 records eight narrow-profile control resizes at900/760: picker183.984375→140.046875/114.859375px, type45.96875→35/31px, both height35→36px. Frozen `composition-unwrapped-negative/scenario/multipart-composition-measurements.json` SHA **f0a20858f95e63ee76ae1bd10b798cf422641c9862eea00090aa66870b94435d**, with original fixture/helper/bundle preserved. This is why wrapping is needed; no assertion tolerance was added.

Fixture-only correction adds three declarations: affected kv-value `flex-wrap:wrap`, own Field feedback `flex:0 0 100%` and `order:1`. It preserves picker183.984375×35 and type45.96875×35 at all widths. Feedback lies after controls in column3; widths791/467/383px, heights18/18/36, scrollWidth==clientWidth. Bottoms509.421875/529.8125/551.203125 are within600px. Error rows grow to54/54/72px while controls retain normal sizes; no hidden shrink or horizontal overflow. Normal rows remain36px.

Experimental Field error has exact ID/describedby/invalid, no-data/callback mutation on actual20MiB+1 refusal, other-row success preserves invalid-row error, same-row correction clears it, and exact accepted `AEH/` bytes are preserved. This proves only the experimental receipts. Actual production still has its24 measured failures and original phase/disposal/stale behavior; no production fix accepted.

Frozen wrapped audit path `artifacts/multipart-field-proof/composition-wrapped/audit.json` binds17source files and emitted bundle/scenario outputs; source map→`composition-wrapped/source`, output map relative to`composition-wrapped/`. SHA reported in handoff. It explicitly records exit1/production24 and composition0, not a green full suite.

## Proposed production scope after parent review

Use this existing Field composition and only measured feature-owned rules: Field display:contents, its empty caption hidden, affected value flex wrapping, own Field feedback full basis/order. No shared variant/API/token required. Keep Select outside file context, actual visible filename and indexed File value N. Preserve all normal geometry and only error-row expansion. Actual read/limit stage must be distinguished from admission AND later caller/onchange failures before choosing row-local versus global feedback; the toy experimental model has not exercised callback exceptions and must not be copied as broad production error classification. UI errors stay ephemeral and bound original row/selection; no persisted fields or upload/quota changes. Nearest-survivor/Add focus still needs reviewed production correction.

Root native build25960 untouched. Compiler/build/current-root/native OS/AT/platform/private/full migration remain OPEN for any future production change. All handles terminal; no profile claimed. STATUS records measurement handoff; `/compact` unavailable. This is not a completed production feature/topic commit.
