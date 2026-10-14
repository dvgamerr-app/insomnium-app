# UI DESIGN SYSTEM DEBT migration

Updated 2026-10-14. Preserve the Insomnium layout during migration. Existing authorized shared UI/resize/theme work has bounded receipts; full component adoption/CSS ownership/accessibility/workflow/platform gates remain. Deferred redesign follows POST-MIGRATION-UX.md.

See [current status](STATUS.md), [execution plan](PLAN.md) and [complete parity requirements](PARITY.md). No original scope was removed by consolidation.

## Topic records

<a id="record-agent-field-select-names"></a>

<details>
<summary>AGENT-FIELD-SELECT-NAMES</summary>

# Composed select name regression evidence — 2026-10-12

No accessibility-name defect reproduced and no production changes. Existing implicit Field/select consumers stay unchanged; exact native-label querying and accessible naming are different contracts.

Root authorized actual measurement after CRUD's exact-label locator negative. WAI's [labeling guidance](https://www.w3.org/WAI/tutorials/forms/labels/) permits implicit association and favors explicit association where possible; neither statement establishes an app defect. Saved browser evidence is authoritative for this bounded check.

## Actual measured result

Existing saved design-system fixture now renders real ResourceManager Location and AsapEditor Claims mode/Algorithm, plus a named Field/select comparator. Dark/light1440/900/760 across initial and changed option/help/error states produces12 profiles/48 controls. All48 exact `getByRole('combobox', {name, exact:true})` matches and accessibility snapshots have correct stable names. Native label for/id relationships and control IDs remain stable. The36 implicit controls have exact getByLabel count0 because wrapped labels include option text; named comparator's12 exact label matches succeed. That difference is diagnostic and is not used as a product failure requirement.

Initial saved000be6 fails only the newly introduced wrong-equivalence assertion requiring implicit exact native-label match; all48 accessible-name counts were already1. The full raw rows, failure image/result and initial fixture/helper/script are frozen under `artifacts/field-select-label-query-negative`. No product claim based on that failure; no implicit consumer rewritten just for Playwright convenience.

Final helper verifies actual keyboard End/Enter selection and callbacks for destination parent, ASAP algorithm and named bound value; Location Tab enters folder variables. Named help/error associations remain correct, IDs/control width/height/font geometry stay exact across option/help changes. Twelve keyboard profiles exercise36 select commits plus12 Tab movements. Actual application persistence, native picker behavior and screen reader speech/WCAG conformance remain separate gates.

## Guarded test-only delta

| File | Before SHA256 | Final SHA256 |
| --- | --- | --- |
| `tests/ui/design-system.js` |56090317ea560ba5cc4ef51969c3dcae8808f2712f92b829e824da7e0d1d8091|f508d5a3afa3d9802e573d5d04a8c3a0290841356e9b1329481425424da51981|
| `tests/ui/fixtures/design-system.svelte` |bce53304459f7e0e5a061d65bb9808e265816927062fa4925ba52f5efb9c23a2|8bac5fcfc029735791368c398b02e64e20d953ce6fdfba179426cf65d325f463|
| `tests/ui/helpers/field-select-names.js` |new|9b2e046beb89cd9c9ddbc0ea0e2956471cb0e7e1c30f7299f01f7cc5f227d1ba|

No delta to ResourceManager/AsapEditor/GitPanel/Field or current CRUDeb4802. Original source bytes/hashes preserved in `artifacts/field-select-baseline`. Do not copy unrelated agent baseline runtime/UI dirt.

## Checks and handoff

- First full expanded design-system92656/4d2b2b passes. Compiler83288/67acad then finds1 JSDoc inference error; explicit JavaScript annotation fixes it, no behavior/assertion change.
- Final compiler88277/e95716 terminal0errors/0warnings. Full saved `bun tests/ui/design-system.js` rerun81792/af3880 ->b21c63 terminal0/headless using shared launchUiBrowser. Bun standalone compilation passes12modules. Browser fixture build is part of saved scenario; no product build/native candidate needed for this test-only topic.
- Independent audit69110a at `artifacts/field-select-names-proof/audit.json` binds152 consumed source/helper/CSS/package/lock files, generated fixture JS/CSS bytes and raw12 profiles/48 names/36 label-query differences. Relevant product and current CRUD hashes unchanged; no own native host/process handles. Source frozen for root integration.

Bounded read-only next-gate inventory: `UI-DESIGN-SYSTEM-DEBT.md#record-agent-ui-next-gates`. Current raw-control adoption is complete apart from CodeMirror's engine-owned textarea; historical A3/A4 counts and missing-selected-Git-restore label are stale. Resize interrupted capture/storage/orientation/collapse focus gates and full UI/native/platform/migration requirements remain open. Historical default unbound-cookie gate untouched.

Parent owns topic commit and STATUS. `/compact` unavailable in this interface; explicit handoff supplied instead of claiming compaction.


</details>

<a id="record-agent-lint-tooltip-ownership"></a>

<details>
<summary>AGENT-LINT-TOOLTIP-OWNERSHIP</summary>

# CodeMirror lint popup ownership — 2026-10-12

Actual bug: a stationary pointer over the same connected gutter marker receives another trusted mouseover during typography reflow without a recorded mouseout. Upstream5.65.21 creates a fresh tooltip for every mouseover; old popup only hides on mouseout or after its marker disconnects. Two inline opacity1 popups break the original strict unique typography/shadow assertions and show duplicate user content. Root's original opacity-filter failure and own diagnostic negative are immutable.

Own diagnostic82fd39 records markerID1 first mouseover at7538.7ms (12px/top445.125), then same connected marker/point349,453 at8032.5ms (14px/top452.391), no recorded intervening mouseout. Both append callstacks resolve to actual addon showTooltipFor/makeMarker; two active nodes3/5 exist. Newly fading-in popup is computedopacity0.081 while old popup remains1. Original finally restores tokens before final capture, so final snapshot font12 is explicitly distinguished from event-time14px. `artifacts/lint-tooltip-proof/negative/audit.json` SHA03e18dc33a8dbf7806fbab5113d71b0f14db4c0bfa6ec7ede401e12957fb5eca binds untouched product/source/assets, eleven-file diagnostic harness, trace, screenshot, installed addon and copied root negative. No mutation of vendor code for diagnosis.

## Chosen correction and compatibility

Public lint configuration exposes formatting/update/tooltip options but no active popup ownership/cleanup handle. App-owned build adapter uses documented Vite resolveId/load and Bun onResolve/onLoad; both consume ONE shared createLintOwnershipSource implementation. Exact raw addonSHA8d16a6b48b5b860807aaf7c329009d7a49f8078570263a6def773c61d2b353fb and packageversion5.65.21 are pinned; changed bytes/version or non-unique patch anchors fail build before adoption. Original CommonJS/AMD wrapper is replaced by ordinary ESM import/factory, not runtime eval. Seven guarded minimal body substitutions add private per-editor active-hide WeakMap and per-tooltip position-cleanup WeakMap; a new hover closes that editor's previous popup before creating another. Annotation clearing/lint disable/unmount also retire its popup; old poll interval, mouseout and document-mousemove callbacks detach. Cleanup only deletes the same owner's current entry; another editor's active popup remains intact.

Upstream annotations, severity grouping, async lint/configuration/formatting, tooltip text/HTML copying, gutter/inline/selfContain options, colors/fonts/shadow, positioning formula,400ms detached-marker poll and600ms fade-removal behavior remain preserved. No node_modules/vendorfile writes, application CodeEditor/engine API changes, global DOM API interception in product, runtime eval, CSP/provider/authority changes or style workaround. Diagnostic helper temporarily observes append/listeners only inside saved test and restores originals; positive ownership cases run AFTER that probe stops, with local real-event observation only.

MIT full text retained in generated module and explicit `codemirror-lint.LICENSE.txt` emitted asset because production minification removes comments. Final ordinary frontend count is49 (old48 plus license notice), not silently reused old48. Generated patched sourceSHAf14c920aa4743356c42873cac79fa183108118b0ad43220bbddede24d916cf1e; raw/patched/license snapshots in final proof. Exact public references consulted: [pinned upstream lint source](https://raw.githubusercontent.com/codemirror/codemirror5/5.65.21/addon/lint/lint.js), [Vite Plugin API](https://vite.dev/guide/api-plugin.html), [Vite JavaScript createServer](https://vite.dev/guide/api-javascript.html#create-server), [Bun plugin API](https://bun.sh/docs/bundler/plugins). CodeMirror hosted manual returns403; pinned official source/options and installed LICENSE used. Commands use Bun only.

## Actual saved acceptance

SAME nocturne-theme original unique/default12px/changed14px/color/shadow/restore assertions remain, stationary pointer and two animation frames after typography change. Move-off/rehover control passed but DOES NOT establish product fix; it is archived separately and reverted for acceptance. New reusable ownership helper performs four actual stationary14↔12 checks per theme, per-editor lint retirement, cross-editor unaffected popup, keyboard Schema unmount while pointer remains, immediate active-popup retirement, all popup nodes removed within2000ms and no reopening on later real pointer movement. No synthetic MouseEvent dispatch or tooltip first() assertion replacement.

- Final production: four trusted mouseovers/no mouseout per theme, exactly one active popup each reflow; both themes/cross-owner/unmount pass. Original full theme baseline and16GraphQL selected/focus rows pass.
- Actual Vite dev: SAME full theme/cases passes both themes. Dev modulegraph must contain already-loaded virtual module/transform result; saved dev-loaded-lint.js SHA bcf3c2841ef4d371d1afae22e910ea78e8ecb33b98018f8eaac092188de2c210 binds actual dev import, not a post-run artificial module load.
- Actual saved Bun Svelte CodeEditor fixture: patched namespace appears in compiled bundle, same shared generator and pinned bytes, font checks/cross-owner/unmount pass. Its compact independent geometry produces one real mouseover, so repeated reflow mouseovers are claimed only for actual production/dev app; no false Bun duplicate-event claim.
- Retained workspace: API18/Runner18, GraphQL12caret/4captured viewport transitions, collapse6/release12/storage48/origin9/heavy12profiles/36states/12reloads pass unchanged. No native launch or current-native acceptance.

Terminal evidence: final build06f19f exit0; frozen-input preflighte74d58 captures260source/49assets BEFORE final launches; production+Bun46961/f58ba3 exit0; workspace87948/5ba183 exit0; compiler71237/5c2133 exit0errors0warnings; final actualdev68682/f18741 exit0. Independent audit44f1fd at `artifacts/lint-tooltip-proof/final/audit.json` SHA8b8d49e85b24f9ba4eefe4077eb07cf15d9aa35f424ba17f56ded141991bee0f verifies all260source/49assets/raw/patched/license/21harness files and copies source/frontend/harness plus production/dev/Bun/workspace results. Actual Bun bundle includes namespace/WeakMaps and full license. Sources remain byte-frozen.

Earlier evidence retained: initial first diagnostic pass83687 and compiler21003 pass; original same stationary diagnostic failure82fd39; first product build39ac41 and theme8739 pass; ownership first13616 pass but four local listener JSDoc errors49022 corrected without assertion change. First actualdev65270 reaches dark ownership then fails later API Diagnostics after dynamic client-node fetch failure; unchanged full serial dev82293 passes with failure-only network diagnostics added. Cold/concurrent cause is not proven or masked. Final dev provenance run independently passes. An orchestration mistake launched60597/55790 before license-header build12831 was noticed running; those overlapping runs are explicitly NOT acceptance, raw theme pass/workspace storage startup timeout retained. Final preflight/launch ordering corrected and final runs pass; no assertion weakened. Old Runner/GraphQL proofs are unchanged.

## Guarded handoff

Product-only paths:

- `vite.config.js`: root baseline39b4053b1f0a72b70f88e8ddcbe3eb89943cb219c8b8d675503be244e079ec68 → finalcb3d23c1ff8b2ddc8ed9510fd9448288d2cfb3b75d5714ee03329b097998f525.
- NEW `scripts/codemirror-lint-ownership.mjs`:4d165b7aaddf90946619a803c14c57d99ad3b6559b7f5ecc8c3aadf5f79f6397.

Saved harness paths:

- `tests/ui/nocturne-theme.js`: baseline124fa1080c9ab26c6612ce46e715e515f2be45a3527ce720bf73a99e1efc90bd → e21ef689939b3a3f830f2ff61d48dbc849cbf17275e3d9da6bae82e5f999a5d5.
- `tests/ui/helpers/component-fixture.js`: canonical current root baseline59dc40efc2bd62935a974795bcfe0bd706be244ccac5b7714026170a67de82e7 → a0699d2c04d25089a221447c37ce6adfa6e941feda2bef275cfd0a95122686b1. Old own3a319 bytes are wholly CRLF-normalized equal and archived; no blind source mismatch exclusion.
- NEW `helpers/lint-tooltip-diagnostics.js`:7ea991bd3faacbd522a8c50a9fba2315d93618fce7eb33c8f48920344269ed5d.
- NEW `helpers/lint-tooltip-cases.js`:9f9c110b7fbfda8f5ff5e1aadf16f90cd0a09087d9af96c398a0b4c67f5d041e.
- NEW `helpers/lint-theme-preview.js`:7eefef13ae25ff6f8a25601c8622cb6a0e16fa9b5b26ba645e98e7364279cf34. Closed env1 selects real loopback dev/headless only; no headed/authority override.
- NEW `fixtures/lint-tooltip.js`:0d48e21e8bb430ba370a10319b5d6e2f3e90be07f221bb1459f5717f6403e87f.
- NEW `fixtures/lint-tooltip.svelte`:37c7733742e0979c042a703566e80c6a34ad073d5ffbfbbea5bf312957e2604a.

All helper/fixture paths above are under tests/ui. This report is the documentation delta. Do not copy old ownF9 runtime overlay into current root; exact protected259previous inputs unchanged except Vite config plus new adapter. Root modern Event work is independent and must remain. Root native588 candidate predates this fix; new current-generation native/source/fixture closure acceptance remains OPEN. Other engines/platforms/full UI/original migration and historical unbound-cookie cleanup remain OPEN.

All own handles terminal; no native namespace claim. Parent owns STATUS/current topic commit and final root replay. `/compact` unavailable; explicit handoff supplied.

## Current root verification

Root independently rehashes260source/49assets/21harness snapshots and integrates10guarded paths, preserving e971 modern Event worker and Runner. Root additionally excludes artifacts from Vite watch and explicitly optimizes20editor deep imports plus both url entry names with noDiscovery:true; documented dev-only options (https://vite.dev/config/server-options.html#server-watch and https://vite.dev/config/dep-optimization-options.html#optimizedeps-include). Saved diagnostic body-read failures are recorded without unhandled rejections; application assertions stay unchanged.

Initial dev launch180s timeout, V2 measured504 Outdated Optimize Dep/API Diagnostics timeout and V3 bareurl CommonJS error remain immutable under root proof generations1–3. Exact first startup cause remains unproven. Corrected actual dev57591 passes full theme/ownership/API Diagnostics; final buildabf65a/check1000 pass0/0, then suite54512 passes production+Bun fixture/workspace with unchanged source and preserved dev provenance. Both app modes record four trusted stationary mouseovers/no mouseout per theme, each reflow one active popup, cross-owner/unmount/all-node cleanup; Bun fixture actual onemouseover is distinct. Current frozen evidence artifacts/lint-root-proof-v4/root-audit.json. Historical failure files retained in raw dev output do not establish positive acceptance. All root handles terminal. Fresh native generation remains open; old588 unchanged historical proof. /compact unavailable; explicit handoff.


</details>

<a id="record-agent-request-response-resize"></a>

<details>
<summary>AGENT-REQUEST-RESPONSE-RESIZE</summary>

# Current content-heavy HTTP resize workflow — 2026-10-12

No product defect reproduced; production SplitPane/application/styles unchanged. Existing saved workspace scenario now covers actual content-heavy request/response usability at owner-supported widths and the600px height already used by API layout acceptance. This closes only a bounded headless regression gap, not all UI/native/platform parity.

## Exact current frontend and test-only delta

Root authorized immutable `artifacts/native-pending-root-proof/root-build` with its verification asset map. Copied all48 ordinary emitted files into own `artifacts/resize-current-preview/frontend`, exact SHA checks418429. Native builder's four fixture assets (52total) are not served here; no native host launched or default namespace claimed. Working build and oldCRUD/Field/native proofs untouched.

SplitPane/+page/request.css/key-value.css/response.css are bound to currentdeef083759-source snapshot hashes. Own supporting files differ only by CRLF: entire normalized UTF8 bytes equal, both hashes/bytes preserved, no source alignment or product edits. Parent history/native closure remains unchanged.

| File | Root frozen before SHA | Final SHA |
| --- | --- | --- |
| `tests/ui/nocturne-workspace.js` |16b9c0034c4e119fa199f9885ae7cb9bf9ee56d3da6f1332b3e0197b49b4b86c|34ddd5c9cf66daedee6532e12dd0cda221ca1ea809d6b44dcd59545a1b9b7099|
| `tests/ui/helpers/preview-app.js` |0caf95e7cccc9f7c79cf5f5839590208270c29a3c96773c164a877c9efe26c31|5493d7352111fa95cd70ec41babf766045e106771f7f9cf6f29cd313aa8cabc7|
| `tests/ui/helpers/request-response-split.js` |new|91dc75ab1496edfb8394574340755e025bbd9ff6c0a1b61ed17e5aa7c3397789|

Preview helper adds optional buildRoot confined to regular realpath own build/artifacts; headless launch unchanged. Preserve root's pre-existing optional fetch WIP rather than staging that as this topic's new behavior. Existing workspace script now asserts completed keyboard rename does not reopen on repeated focus, then uses a pointer click for the next Escape draft, matching accepted EditableName behavior. All prior exact rename/Escape/workspace checks retained.

## Meaningful workflow evidence

Same `nocturne-workspace.js` creates only a private browser-local preview fixture:32 header rows,32 URL-encoded body fields,3000 response lines and32 response header string tuples. Ctrl+S flushes startup-normalized metadata before capturing the read-only baseline. It restores the original private workspace key in finally and closes the owned browser.

Across dark/light1440/900/760 ×960/600 (12profiles), each Home/End/Enter boundary/reset produces36 resize states. Actual final header and body input focus/End scrolls into all ancestor clipping bounds; CodeMirror keyboard Ctrl+End reaches line2999 with actual engine input focus and caret coordinates bounded. Response Headers is entered through the focusable panel and real Tab to Chromium's scroll container; End exposes both final header name/value text cells. Twelve Shift+ArrowDown preferences survive reload; every reload preserves normalized resources, active request and original response history exactly. No Send/transport operation claimed.

Final explicit command:

```powershell
$env:INSOMNIUM_UI_PREVIEW_BUILD='artifacts/resize-current-preview/frontend'
bun tests/ui/nocturne-workspace.js
```

Final15754/e8c05a ->e305d6 terminal0/headless. Existing ordinary workspace checks retained plus final heavy-split.json12profiles/36states/12reload proofs. Compiler64385/082ebb terminal0errors/0warnings; Bun standalone5-module compilation passes4111c0. No product build required for this test-only delta; runtime acceptance uses exact already-built current root assets.

Independent4111c0 audit `artifacts/resize-current-preview/audit.json` verifies48asset SHA, frozen current product source association, unchanged own supporting bytes,7harness/package/lock files,36header+36body input bounds,36final caret checks,72response text-cell bounds and12exact size/resource/history reload records. Source frozen and no own live handles/namespaces.

## Preserved negatives and limits

- First55708/a91a0b stops at stale workspace rename expectation after accepted focus guard; captured under resize-workspace-stale-rename-negative. Corrected actual interaction, no product regression.
- DOM Selection assumption29fa83 is incorrect for CodeMirror5's textarea input; retained resize-dom-selection-assumption-negative. Consulted official [CodeMirror5 manual](https://raw.githubusercontent.com/codemirror/codemirror5/master/doc/manual.html) after public manual403; saved probe uses documented getCursor/cursorCoords(window)/getInputField read-only APIs following real keyboard actions.
- Header tab includes its32count; incorrect bare exact tab name41123/5487a0 preserved separately. Corrected exact counted-tab name.
- Parent TabPanel+End alone does not target the descendant scrolling content; real next-Tab path does. Whole41px header-row fit at36px minimum viewport is an unnecessarily strict padding requirement; actual19px name/value text is visible after settled keyboard scroll. Initial row-padding failure497482 preserved, not reported as a product defect. No assertion about request/response content weakened to ignore clipped meaningful text.

Native content-heavy keyboard/scroll/height acceptance, other browser auto-focus behavior, interruption/collapse/storage-denial resize scenarios and all original migration/provider/Git/UI requirements remain separate. Historical unbound-cookie gate untouched. Root owns topic commit and STATUS. `/compact` unavailable; explicit handoff supplied.


</details>

<a id="record-agent-shared-ui-native"></a>

<details>
<summary>AGENT-SHARED-UI-NATIVE</summary>

# Native UI gates — saved scenario preparation

2026-10-12. Root has committed rename focus `af49d71` and GraphQL selected
foreground `38a98fb`. Worktree `E:\.dvgamerr-app\insomnium-agent-shared-ui`
has both prior frozen deltas, not the root's newer branch HEAD. The next delta
contains only the three script paths below and this report; do not reinclude any
previous feature file.

## Prepared checks

- Existing `editName` helper now checks completion leaves no input open and
  preserves the expected focus destination: blur target for blur; rename trigger
  for Enter/Escape. This applies to original 18 component and 60 native rename
  cases, including actual changed/blank/cancelled drafts.
- Existing component keyboard contract is refactored into
  `assertRenameKeyboard(page, leave)` in the same helper. It tests 8 dark/light,
  1440/760, Enter/Escape profiles with focus-visible/no immediate reopen, Enter
  reopening, Tab to the supplied actual next control, pointer reopen/dismissal,
  measured shared focus token, and theme/viewport restoration.
- Existing native rename script calls the same contract in HTTP, GraphQL, SSE
  and WebSocket workflows, expecting exactly 32 rows. Its actual next control is
  "Move or manage request". Each workflow's keyboard profiles must perform zero
  save_workspace calls and leave the entire workspace exactly unchanged. Existing
  60 rename persistence/reload/Git/no-network assertions remain intact.
- Existing native `graphql-editor.js` already calls shared
  `assertGraphqlSegmented`, added in the prior committed topic. No duplicate native
  scenario/build was created.

## Current script SHA256

| Script | SHA256 |
| --- | --- |
| `tests/ui/helpers/editable-name-cases.js` | `2763ee84699b39e6835ba14932267fe28ff43a2dcc46943932acdd55f83a0b28` |
| `tests/ui/editable-name.js` | `4a8ce077c90582ff8cb09d4a5a12935d6b1ec08eada4dd9054a4086691b1b552` |
| `tests/ui/editable-name-native.js` | `e49063f67a4b620e7c54a962128beed08ec71fb8e5efb0a2675de446685654fd` |

Only editable-name.js overlaps a prior topic: take its current complete script
as the delta against root's already-integrated af49d71 version. Existing full
contract block was moved without dropping assertions; native uses the same code.

## Evidence / pending authorization

`bun tests/ui/editable-name.js` 66b74f then b82001 terminal 0, preserving all
18 original cases +8 keyboard profiles. Second replay includes the new original
case focus assertions. Current `git diff --check` c897ee terminal 0. No production
source or dependency change; all task handles terminal.

Native provider agent confirmed its currently frozen 730-source candidate predates
both UI topics. It must not be used to claim new UI acceptance. Root requested
one later latest-source native overlay/build; neither native UI scenario has been
launched yet. Await root authorization of an artifact proven to include the latest
UI assets, then run these existing scenarios serially through withNativeApp
(native-hidden before CDP, probe identity/data, owned cleanup), inspect exact
acceptance/source/build hashes and report every remaining native gate accurately.

`/compact` is unavailable. This is the prepared handoff, not compaction or native
acceptance. Both native gates remain open until actual current-candidate results.


</details>

<a id="record-agent-split-collapse-fix"></a>

<details>
<summary>AGENT-SPLIT-COLLAPSE-FIX</summary>

# Split collapse ends captured drag — 2026-10-12

Real bug reproduced: start a collection-sidebar drag, keep the pointer pressed and open Source Control with Ctrl+Shift+G. Collapsing the workspace removes the captured separator, but the old SplitPane keeps dragging=true. Git Close and Request URL clicks are intercepted, and hovering the expanded handle after mouse-up changes its ratio. The fix invokes existing stop when collapsed changes, clearing the pointer/drag state and preserving stop's current-ratio save behavior.

Official references consulted before implementing: [Pointer Events implicit capture release](https://www.w3.org/TR/pointerevents3/#implicit-release-of-pointer-capture) explains document-target lostcapture after captured-node removal; [Svelte effect lifecycle/dependencies](https://svelte.dev/docs/svelte/$effect) documents browser effects after DOM updates and synchronous dependency tracking. The bounded stop guard writes only when dragging is active; the following effect run does nothing. No global event listener, new pointer policy, UI token/minima/layout or native authority changes.

## Exact negative and guarded delta

Saved SAME nocturne-workspace/split-pane helper uses trusted real pointer down/move/capture, real Ctrl+Shift+G, pointer up, actual Git Close/URL click attempts and unpressed hover. Initial fea99e terminal1 is an actual UI failure, not a locator/geometry assumption. Audit6d8c14 freezes8 consumed source files, all48 exact current-root frontend assets and original Split source bytes under `artifacts/split-collapse-negative`. Pointer1 lostcapture target is #document; both clicks fail because workspace dragging disables content. Grid tracks change21.7307->21.8028fr after unpressed hover. Original strict assertions and failures retained.

| File | Before SHA256 | Final SHA256 |
| --- | --- | --- |
| `src/lib/components/ui/SplitPane.svelte` |root29ff6db4a8cc7a98619ebcc78c8dcadfbe0f86a30189af6d6cbc8b70b105c39d|4aee14960061f598c73b079a7aafe89ec0a8ad9dd1186aa7ad91bfa6e3fe0407|
| `tests/ui/helpers/split-pane.js` |10d6ebe6b9ce42d65a9744e38263d80f147d5bc0ec778c278b3a1be75d14f0a3|48f350ebefb50593137e0b734aa7c4bea8a5880767eec403acceaca1c2c041d4|
| `tests/ui/nocturne-workspace.js` |34ddd5c9cf66daedee6532e12dd0cda221ca1ea809d6b44dcd59545a1b9b7099|12fde4c60822db54cfa13d273191f6afd501585abdefff9e4ac9b3e15db0caad|

Own original Split a8c81b1f differed from root29ff only by CRLF: entire normalized UTF8 bytes equal, both preserved. Adopted exact root bytes before five-line effect addition; no silent source mismatch exclusion. Positive audit confirms removing exactly those five lines restores root before bytes. Original exerciseSplit assertions unchanged; new exerciseSplitCollapse exported from the SAME helper. Root/native-owned request-response-split.js91dc and preview-app.js5493 untouched.

## Verification and generation limits

- Before build:267 isolated app/static/config/package/lock/harness inputs frozen0c1888; all48 previous working-build files archived. Compiler94943/c94ef0 terminal0errors/0warnings. Bun production build26139/a518a3 terminal0. Capture4fcb95 verifies all267 input hashes unchanged and freezes48 new emitted assets.
- SAME saved full workspace scenario on frozen fixed isolated assets:69423/81bbd8 terminal0/headless. Six dark/light×1440/900/760 collapse profiles pass active pointer capture, cleared collapsed/expanded drag, clickable Git/request content and unchanged grid tracks on unpressed hover. All original workspace checks and unchanged heavy helper's12 theme/width/height profiles/36 resize states/12 exact resource-history-size reloads pass.
- Independent a6cb0a audit `artifacts/split-collapse-positive/audit.json` verifies267 source/48 frontend/48 preserved prior-build hashes, five-line-only product change,6 collapse profiles, retained12heavy/36states, unchanged heavy helper and no owned live process. Bun5-module standalone saved-scenario compilation passes. Source frozen for integration; no handles/namespaces owned.

Negative uses exact current-root deef08348assets; fixed positive is the isolated worktree's267-input build, whose unrelated baseline runtime/history differs from current root. Integrate ONLY the guarded three-file delta and this report; do not copy baseline Event/ResponsePane/history/CSS dirt or compiled outputs into root. Root must rerun current-generation compiler/build/scenarios after integration. Existing native49/f8c756 artifacts do not contain this fix; fresh source/assets/executable proof and actual native collapse acceptance remain OPEN. No native launch or old-proof relabeling.

Storage denial, explicit release/cancel without collapse, responsive-orientation interruption, platform/assistive/full UI and every original migration requirement remain separate. Historical unbound-cookie gate untouched. Parent owns topic commit and STATUS. `/compact` unavailable; explicit handoff supplied.


</details>

<a id="record-agent-split-origin-guard"></a>

<details>
<summary>AGENT-SPLIT-ORIGIN-GUARD</summary>

# Split preview origin guard correction — 2026-10-12

Test-only correction requested by root review. The previous prefix guard could accept `http://127.0.0.1:pass@example.com/`. The same reusable split-pane helper now parses the URL and requires HTTP, exact hostname `127.0.0.1`, nonempty port, and empty username/password before creating private browser contexts. No product source, CSS, heavy helper, native artifact or profile changed.

Saved `exerciseSplitStorage` now checks nine refusals: the credential-prefix example, username/password and username-only loopback URLs, missing port, external hostname, localhost, Tauri hostname, HTTPS and invalid URL. The saved output binds the actual accepted preview URL and records that the checks precede private contexts. Existing exact size-key interception, workspace-byte preservation and all prior assertions remain unchanged.

New frozen proof: `artifacts/split-origin-guard-proof/audit.json`, seven-file imported harness/package/lock snapshot, raw scenario output and `split-origin-guard.json`. It independently verifies the same 48 immutable current-root frontend assets, unchanged SplitPane/35d7 heavy adapter/5493 preview helper, six actual capture releases, six explicitly synthetic cancel wiring profiles, 48 size-storage cases, six collapse profiles, twelve heavy profiles, 36 states and twelve reload checks. Synthetic cancel remains handler wiring evidence only; no OS/native cancellation acceptance.

Commands: `bun run check` (session 34974, terminal 0 errors / 0 warnings); `INSOMNIUM_UI_PREVIEW_BUILD=artifacts/split-guards-proof/frontend bun tests/ui/nocturne-workspace.js` (PowerShell environment assignment; session 47563, terminal exit 0, headless); `bun artifacts/audit-split-origin-guard.mjs` (exit 0); `bun build tests/ui/nocturne-workspace.js --target=bun --packages=external --outdir=artifacts/split-origin-guard-proof/compiled` (five modules, exit 0). No product build required because product and consumed emitted assets are byte-identical.

Root integration baseline stays helper `48f350ebefb50593137e0b734aa7c4bea8a5880767eec403acceaca1c2c041d4` and workspace `12fde4c60822db54cfa13d273191f6afd501585abdefff9e4ac9b3e15db0caad`. NEW final helper: `d68e1b0ec57721dd267a123cffda662f70f97d569edc9af67dbd3adc38da9c5f`. Workspace remains `96d8f61ea41bc44029153fcf24d4e1d6990f618332e38f465bcf04cc95e2b2a9`.

Previous 85/96 proof/report remains immutable in `artifacts/split-guards-proof` and `UI-DESIGN-SYSTEM-DEBT.md#record-agent-split-release-storage` (report SHA `bbe990ede5aba26251916650453b29abf933b16e53405b4577c59e8899c6e57f`). Its origin-guard sufficiency claim is superseded by this correction; historical output is not rewritten. Previous audit SHA remains `d29026fca22a8271b481f901760a65964b65e610d4b1458adadce5ce1359836e`.

All own handles terminal; sources frozen for guarded root integration/topic commit. No native namespace claimed. Full migration/native/platform/storage-policy gates and historical unbound-cookie cleanup remain open. Parent owns STATUS and commits. `/compact` is unavailable in this agent interface; this report is the explicit handoff.


</details>

<a id="record-agent-split-release-storage"></a>

<details>
<summary>AGENT-SPLIT-RELEASE-STORAGE</summary>

> Historical agent report: its prefix-origin guard claim is superseded by [UI-DESIGN-SYSTEM-DEBT.md#record-agent-split-origin-guard](UI-DESIGN-SYSTEM-DEBT.md#record-agent-split-origin-guard). Root integrates the corrected parsed guard; original frozen report remains unchanged in the agent worktree.

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


</details>

<a id="record-agent-ui-adoption-20261013"></a>

<details>
<summary>AGENT-UI-ADOPTION-20261013</summary>

# Remaining shared UI adoption and workflow gates

Read-only inventory, 2026-10-13, base `b95c089`, branch `agent/ui-inventory-20261013`. Root external-source feature `2849148` is already integrated; earlier isolated external proofs are immutable. No product/scenario/dependency changes, browser/native/profile launches or builds were performed. Applicable AGENTS and migration/POST-MIGRATION-UX/Nocturne/debt documents were read; ancestor/root/relevant-directory discovery found no CLAUDE instruction files.

## Current evidence, not historical counts

`bun scripts/ui-inventory.js` completed exit0 (`61a1d3`). This existing AST inventory reads production source and writes only ignored, owned artifacts. Source hash `6718ab458821d57f83ea1a63c835668f241989a6fde33fc08b833ee88d4adc6c`:65 Svelte files,742 shared markup sites,119 tokens,1888 CSS declarations,18 feature/editor scoped-style files. Input88/26 consumer files, Select55/21, Textarea22/15, Field141/26, Checkbox29/12 and FilePicker13/8 are adopted; these are static sites, not mounted instances or accessibility acceptance.

Only raw form-control site outside shared UI is `CodeEditor.svelte:575` textarea, an intentional editor/fallback adapter. Runtime CodeMirror/plugin DOM is outside this static count. No duplicate CSS imports, multiple token-owner files or declaration-only token candidates were found. `--focus-danger-text` is an intentional optional fallback, and ResponsePane's dynamic `--method-*` references are intentional. Do not remove either as “unused”. Ordered entry is `styles/index.css:1–30`; shared focus owner loads after variants. Scoped feature styles are not automatically debt: certificate file flex, response filter widths, Git graphs, editor gutters and domain layouts remain legitimate feature/adapter ownership.

## Small ordered follow-ups

| Order | Concrete source evidence and proposed scope | Existing saved acceptance to extend; acceptance criteria |
| --- | --- | --- |
| 1 | ResourceManager field validation association. `ResourceManager.svelte:59–71` distinguishes empty name / folder JSON errors but collapses every failure into one string; Fields at110/131 supply neither `error` nor description, while the alert at205 is outside those Fields. This is a code-evidenced association gap, not a measured screen-reader or WCAG failure. Classify local name/JSON failures into the existing Field error contract; preserve topology/callback failures as form-level feedback. Keep valid implicit labels unchanged. | Extend `tests/ui/resource-manager.js` and its existing fixture for blank name, malformed/non-object JSON, corrected input, unchanged resources on refusal and modal retention; preserve last-collection keyboard tests. Use `design-system.js` Field association/invalid-hover oracle for exact ID/aria-describedby/aria-invalid and error-border precedence. Dark/light1440/900/760 at600px; Tab/Enter/Escape, preserved focus, readable wrapped messages, no layout/data changes. Full actual CRUD remains `resource-manager-native.js`, a separate current-artifact gate. |
| 2 | XPath namespace Field/CSS exception. `ResponseNamespaces.svelte:49/58` uses native labels around shared Input; label grid/gap is locally owned at106–110 (`space-6`), whereas shared Field uses `field-gap` (`forms.css:24`, foundation67 defaults7px). Alert78 has no field association. Labels and explicit dynamic aria-labels are already present; inaccessible names are **not** claimed. First measure token propagation/validation/removal focus, then either document this dense composition exception or adopt Field with a reviewed density contract that preserves its6px baseline. Do not silently change the gap to7px. | Extend SAME `xml-response-filter.js` / `helpers/xml-response-namespaces.js`. Existing helper already tests four invalid mappings with no save, Escape focus return and both-theme widths; retain them. Add exact name/description/invalid associations where errors can be attributed, keyboard add/remove (including focused row removal), error correction and32-row cap. Preserve global alert for collection-level errors, saved namespaces/raw response, dynamic numbering,760/600 viewport and existing sub600px stacked layout. CSS measurements precede any correction. |
| 3 | Clarify Select multiple/listbox contract before adding unused capability. `ui/Select.svelte:4/44–48` permits native multiple/size attributes for presentation but its public value is string/number and change handler stores only currentTarget.value. No feature Select multiple consumer was found; current multiple sites are FilePickers. This is a public-contract limitation, **not** a reproduced application loss-of-selection bug. Document single-value listbox scope or, only when an actual consuming workflow requires it, add an explicit array-valued contract. | SAME `design-system.js` / fixture: if implementation is authorized, retain all single-choice/string/number/Field/arrow tests and add native Ctrl/Shift multi-selection, disabled options, exact array values and association/theme/focus/size-listbox geometry. Do not invent a new generic combobox or multi-select redesign merely to raise adoption counts. |

Suggested next implementation is order1: bounded existing form behavior plus existing shared Field API, with a saved negative before changing source. Order2 requires density/validation measurement and owner review. Order3 is documentation/exception work until there is a real consumer.

## Workflow gates to retain, not reimplement

- `SplitPane.svelte:25/77/80/100–104` already implements orientation, collapse cleanup, keyboard and storage recovery. `helpers/split-pane.js:653–751/908–941` already covers real capture release, labelled synthetic cancel and scoped storage faults; historical AGENT-UI-NEXT-GATES “missing tests” wording is superseded. Keep `nocturne-workspace.js`, request-response heavy/reload helper, GraphQL600px captured viewport/caret cases and native split scenarios. Remaining gates are real OS/native pointer cancellation, other-engine fallback/storage behavior and current-generation workflow acceptance; synthetic cancel is not native cancellation evidence.
- Response history shared Button/Escape/Arrow/Home/End/Space/focus was already implemented (`ResponseHistoryMenu.svelte:34/82–101`, feature response-history CSS). Do not duplicate this topic. Likewise EditableName Enter/Escape restoration, Button child whitespace, Field implicit-select accessible names, tooltip ownership and local GraphQL/Runner clipping fixes have existing bounded evidence in STATUS. Preserve owner no-outline/no-shadow-ring policy and token-based focus/error priority; do not “fix” valid implicit labels for Playwright query convenience.
- Selected Git restore UI is present: `GitPanel.svelte:582/794–848` reviews selected/per-row paths and confirms through the existing modal. Debt text calling this UI missing is stale. Retain `git-source-control.js`, Git restore/recovery scenarios and exact data/Git restoration; remaining backend/repository/provider/platform gates are not a new generic-button adoption task.
- Root's current structural full-source/range diagnostics, repository consumed-read/inflight generation and new external native acceptance remain open. `ApiDesign.svelte`, openapi worker/catalog utility and `spectral-api-design.js` belong to root/native lanes; this inventory does not claim those gates or edit them. Runner result scrolling has headless rich-result evidence but native lifecycle/vertical-size acceptance remains separately scoped.

Current per-feature evidence must bind actual source/assets/executable and full data restoration before a native claim. Historical Nocturne “theme complete” is a dated theme checkpoint, not universal current WCAG/assistive-technology/high-contrast/browser/platform or full-workflow acceptance.

## Owner scope and handoff

POST-MIGRATION-UX explicitly records October5 authorization for shared UI, Git and resize now. Small adoption/validation/ownership fixes can proceed within current Insomnium layout/Nocturne choices after measured acceptance. Broad navigation/information-hierarchy redesign follows full migration; no reference-brand rename, palette/font/shape overhaul, cloud features or reduced parity scope is proposed. Preserve CodeMirror, unified diff and domain graphs as adapters; avoid forcing all scoped CSS or runtime plugin DOM into generic primitives.

Guard receipts: inventory script SHA256 `9ae2c7c5edf8940d7d8947113803c74426b9ada15148441e1517ae0c712bfb75`; ignored report `artifacts/ui-inventory/report.json` SHA256 `f38b7c8ecd469576b3fd8932e31a995d25e862aeffb5768e1249deac02189666`. Source anchors: ResponseNamespaces `1274a5aa94d88c46fe60f3b7cbd022121ca19e97f8333393b48c6bc8bb52d35d`, ResourceManager `1a4eb6565c48631721577aa470ff98dc83c13e0758f140d436ab2dee29c94912`, Select `85991c4f31d9b0f47204b992b0baed82b651be5be2e340daafddd9cddf33226a`. Line references apply to b95c089 only. Only this new documentation file is offered for guarded integration; root owns STATUS/integration and subsequent implementation. Live handles:none. Documentation commit is reported in the final handoff. `/compact` is unavailable in this interface; no compaction is claimed. Full UI debt/migration remains open.


</details>

<a id="record-agent-ui-gates"></a>

<details>
<summary>AGENT-UI-GATES</summary>

# Remaining shared UI gates

These requirements remain open after agent branch integration; source implementation and bounded passing scenarios do not prove the complete workflows. Preserve the current Insomnium layout until migration is complete, then follow POST-MIGRATION-UX.md.

- Collection/folder/request CRUD: persisted subtree duplication with ID remapping and excluded private state; cross-collection movement and cycle refusal; children/history deletion and last-collection guard; ordering/search/switch/reload; owned native-state preservation.
- Request rename and GraphQL: fresh native focus/keyboard/save-count/persistence cases, native SDL chooser/export with exact bytes and cancellation, and complete query/variables/operation/introspection/schema/error workflows.
- Shared inputs: finish UI-DESIGN-SYSTEM-DEBT.md inventory/contracts, exception and obsolete-alias cleanup, validation/focus/keyboard behavior and full workflow adoption.
- Accessibility and platform: complete visual/responsive/accessibility and native platform coverage; bounded Windows/headless checks remain separately scoped.

PLAN.md, PARITY.md and STATUS.md retain the full migration, distribution/legal and deferred UX requirements. No requirement is removed by this integration.


</details>

<a id="record-agent-ui-native-findings"></a>

<details>
<summary>AGENT-UI-NATIVE-FINDINGS</summary>

# Current native UI findings and verified Button correction

2026-10-12. Native candidate copied byte-identically from the provider lane:
`artifacts/native-integrated-3694764-20261012`, root runtime `3694764`,
exe SHA256 `1084af43fcda16310d762478543c3ddc5487aafd52f4b55d7104798535cef6ff`,
worker `54e274cc`, 740 source files and 52 frontend assets. Old candidate and
its provider/API audits remain immutable. It predates the Button correction below.

## Exact provenance

`artifacts/current-ui-native-proof/prelaunch.json` verifies actual runtime import
closure of native rename/GraphQL scripts via Bun.Transpiler.scanImports, exact
captured helper/source bytes, all archived frontend hashes and exe. Regex-based
first auditor mistakenly followed JSDoc type imports; replaced with actual JS
import scanning. Initial local checkout differences were fully checked as ENTIRE
UTF-8 bytes equal after CRLF normalization before copying exact snapshot bytes
into isolated local support/helper paths. Both original bytes/SHA and exact
captured SHA are retained in `line-ending-original/` and
`line-ending-alignment.json`; no functional content was replaced.

The explicitly supplemental profile-preservation wrapper SHA45c74016 is frozen
separately. It is not claimed to belong to the old 740-source snapshot.

## Native negative and conditional GraphQL success

- `run-current-ui-native.mjs` 7e9a59 exits1: native rename56716 exits0,
  native-hidden/visiblefalse, first original unchanged case fails its retained
  exact display text assertion: `" Owned name"` versus `"Owned name"`.
  New focus/no-reopen and workspace checks before that assertion pass; no complete
  native rename acceptance. Outer restoration result
  `resource-manager-restoration-1791779546879` passes: both workspace buffers and
  cookie/store inventory restored/unchanged.
- Independent native GraphQL first0d7a5e exits1: its host exits0/hidden, reads
  intermediate animated color104/133/166 rather than exact101/132/163. Existing
  helper waited only background completion. First restoration1791779771287 passes.
- Root-approved helper now waits BOTH exact foreground/background before the
  unchanged strict color assertion. Supplemental helperE5470f60 is frozen and
  audited4f6848 against every other original consumed hash/exe/preservation wrapper.
- Replay40005/82d641: actual GraphQL host51844 exits0, native-hidden/visiblefalse,
  **17 existing editor groups +8 new Query/Schema profiles pass** in
  `graphql-editor-1791779904906`. Outer runner still exits1 because preservation
  detects one new empty cookie file. Both workspace buffers restore exactly and
  all original653 cookie files/plugin-store hashes are unchanged.

Retained cleanup gate: `wrk_0932ea6647744debbf6e4fdb3e488b1b.json`, 2 bytes `[]`,
SHA4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945,
mtime1791779913722.8076 within the exclusive owned host run. The original scenario
did not capture its imported fixture collection ID and wrapper did not save changed
workspace before restoring, so no authoritative ID-to-filename ownership binding
remains. Root explicitly required retaining the file; **nothing deleted**.
The original failed restoration result and cookie-delta.json stay immutable.
No full GraphQL native acceptance claimed while this cleanup gate is open.
Future wrapper work must capture changed workspace and register actual fixture IDs
before restoration, retaining/failing unknown new files rather than guessing.

Both native negative result/images and original script/helper/Button bytes are
preserved under `artifacts/current-ui-native-negative/`.

## Product correction / saved headless verification

Shared Button's whitespace between its busy conditional and rendered children
injected a leading text node after EditableName adopted the primitive. Root
authorized correcting snippet adjacency rather than trimming the assertion.
Button now preserves exact caller text in both busy states; CSS gap still owns
loader spacing. No layout/token/native/backend changes.

Headless original rename scenario extended with the same exact text assertion
reproduces failure e848c8; source/result/image retained under
`artifacts/button-child-text-negative/`. Corrected rename6b2eff exits0, 18 original
cases +8 keyboard profiles including legacy padded/empty/Unicode names. Saved
design-system58178/110537 exits0:12 busy/nonbusy ×theme/width rows preserve exact
padded Unicode children, spinner/disabled/focus behavior and one Enter callback,
plus the full previous shared control contracts. Check52550/b26eda exits0/0errors/
0warnings; build17998/eb144e exits0; targeted whitespace cceef8 passes.

| Own delta against prior integrated UI/native-prep topics | SHA256 |
| --- | --- |
| `src/lib/components/ui/Button.svelte` | `f91130df73086ca0e04eb8669de34bb6566b14c516db83dd4769a066bf103f04` |
| `tests/ui/editable-name.js` | `bee8247390167c0c41244b6f551c4a8dae9b556490388ea7f7c28fb8736fc891` |
| `tests/ui/design-system.js` | `56090317ea560ba5cc4ef51969c3dcae8808f2712f92b829e824da7e0d1d8091` |
| `tests/ui/fixtures/design-system.svelte` | `bce53304459f7e0e5a061d65bb9808e265816927062fa4925ba52f5efb9c23a2` |
| `tests/ui/helpers/graphql-segmented.js` | `e5470f6031fdff03cb857173e65167cd0446cdeee66db92e8a7cd1c2623d9082` |

Integrate these five paths plus this report only. Do not integrate CRLF-only
provenance alignments or overwrite old proof/candidate directories.

All own task handles terminal, native lane released with its explicit cleanup
gate. Product source frozen for root review/integration. Fresh audited native UI
assets/exe are required before claiming corrected native rename acceptance.
CRUD remains prepared/unrun; isolated last-collection native gate still required.
Full original UI/CRUD/GraphQL/provider/platform/migration scope remains active.
`/compact` unavailable; this is the handoff, not compaction.


</details>

<a id="record-agent-ui-next-gates"></a>

<details>
<summary>AGENT-UI-NEXT-GATES</summary>

# Bounded current UX/CSS audit — 2026-10-12

Read-only inspection of current root application source and existing saved scenarios after shared UI/native CRUD acceptance. Root currently owns ResponseHistoryMenu/ResponsePane/history styles; excluded from proposed implementation. No product edits, builds or native claims in this audit.

## Next concrete gate: stable names for composed Field selects

`src/lib/components/ui/Field.svelte:80` implicit branch wraps the children and help/error messages in a label; explicit `label` branch renders a separate label and control. `Select.svelte:23` correctly consumes that Field ID. Adoption is complete enough that remaining concern is the composition boundary, not missing shared Select usage.

Current implicit consumers without a separate aria-label include `ResourceManager.svelte:117` Location, `AsapEditor.svelte:70` Claims mode and90 Algorithm, and `GitPanel.svelte:874` Switch branch. In contrast `ApiExampleChoices.svelte:19/36/63` and Settings use explicit Field labels. GitMergeReview's implicit fields have independent explicit aria-labels; do not classify them as the same unlabelled-name problem.

Actual proven current native CRUD DOM at `artifacts/playwright/resource-manager-native-1791785212627/location-label-dom.json` contains label text `LocationMy Collection...source...destination`, with all option DOM values equal exact logical/resource IDs. Original exact-label negative365b69/80db56 and readiness-only timeout5aac10 preserved. The saved CRUD correction uniquely identifies the Location control and checks label's own direct text; its strict ID/persistence assertions remain valid. This is proof of unstable complete label text / exact-label querying, not by itself a WCAG failure or measurement of a screen reader's spoken name.

Existing `tests/ui/fixtures/design-system.svelte:316` Contract select and258 Required selection use explicit `label`; description contracts also use explicit labels. They do not cover implicit Field select exact accessible-name stability as option lists/value/help/error change. Existing Git branch scenarios deliberately use `/^Switch branch/`, so they do not prove exact names either.

Proposed small next topic: first extend the existing saved design-system fixture/scenario with one implicit select and one explicit select, both changing selection/options/description/error. Save actual accessible names, native label text and label-control IDs; assert intended stable exact name, feedback associations and label-click focus across dark/light1440/900/760. Preserve the failing implicit baseline. If a true name pollution is reproduced, prefer the existing explicit `Field label` contract for ResourceManager Location and Asap Claims mode/Algorithm, verify geometry before/after and existing workflow state/cancellation. Do not rewrite shared Field implicit rich checkbox/file-label semantics or change Git UI without coordination. No new native candidate or native acceptance until product bytes freeze and root authorizes it.

Subsequent actual saved measurement resolved this proposal's uncertainty: all48 accessible names across12 profiles are correct and stable; only native complete-label querying differs. Root approved retaining valid implicit consumers unchanged. Expanded saved design-system now covers this missing exact-name/value/feedback/keyboard/geometry gate; see `UI-DESIGN-SYSTEM-DEBT.md#record-agent-field-select-names` and frozen audit69110a. No product accessibility defect is claimed and no new native candidate needed for the test-only topic. Remaining resize gates below are the next unmeasured workflow candidates.

Official references read: [WAI form labels](https://www.w3.org/WAI/tutorials/forms/labels/) supports explicit for/id association and notes both implicit and explicit labeling are valid. [APG window splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) informs the separate resize contract. These references do not establish this app's assistive-technology behavior; saved browser/native evidence is still required.

## Other current findings and stale summary labels

| Area | Current source/evidence | Actual remaining limitation |
| --- | --- | --- |
| Raw controls / adoption | Production scan finds native control markup only inside ui primitives plus CodeEditor.svelte:479 engine-owned textarea. Shared Button/Input/Select/Textarea/Checkbox/FilePicker consumers exist throughout forms. | Historical A4 counts20buttons/34inputs and A3 only2Fields are snapshot labels, not current gaps. Do not force CodeMirror into generic Textarea. |
| Selected Git restore | GitPanel.svelte:170 reviewRestore,185 confirmRestore,582 selected action,794 per-row action,826 review modal. Existing git-restore.js covers actual backend/frontend restore with owned fixtures. | UI is implemented; debt line364 saying missing selected restore is stale. Current-generation workflow/source/backend/bytes/recovery acceptance must be read from that feature's artifacts, not inferred from implementation or historical green. |
| Resize | SplitPane.svelte:53 pointer capture,78 keyboard Arrow/Home/End/Enter,99 ResizeObserver,135 separator/value/controls contract. Existing helpers/split-pane.js verifies normal bounds/reset/pointer; nocturne-workspace.js119 verifies sidebar ratio reload. | No dedicated saved matrix for pointercancel/lostcapture, malformed/denied localStorage, resize while focused across stackAt orientation and collapsed handle focus disposal. Source implements stop/observer/collapse, so these are verification gaps, not evidenced bugs. Current layout and6px handle geometry preserved. |
| CSS ownership | Shared forms.css owns Field layout and labels; focus/select/control owners exist. Domain CodeEditor/graphs/tables retain explicit adapters; earlier reviewed feature CSS tables remain historical evidence. | A full current unused alias/literal/override audit must follow source provenance; do not treat every domain spacing literal as a defect. This bounded audit does not measure whole-debt completion. |

Parent owns STATUS/topic ordering. All own handles terminal and namespaces released. `/compact` unavailable; this report is the explicit handoff. Full migration, historical unbound-cookie cleanup and deferred broad redesign remain outside this audit's acceptance.


</details>

<a id="record-compact-feedback"></a>

<details>
<summary>COMPACT-FEEDBACK</summary>

# Compact feedback and Field message ownership

## Problem and resulting behavior

Compact KeyValueEditor hints inherited paragraph margins of12px above and
below each message in addition to feature-owned padding/gap. The saved
design-system baseline reproduces the top-margin failure in
artifacts/playwright/compact-feedback-baseline-failure.json.

Feedback compact density now owns zero margins and line-height1.5. Its selector
uses :where() for density eligibility so feature classes can still own message
placement. Normal Feedback keeps its paragraph margins/line-height. Preformatted
and list-item presentations keep their semantic tags and error line breaks.

Field descriptions/errors now use shared Feedback with compact density and
as="small". Existing IDs, SMALL tags, hint/error classes, alert roles, context
attributes and reactive message lifecycle remain. The redundant Field small
line-height rule is removed. No backend/dependency/subsystem change.

## References and saved verification

- [MDN :where() specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:where)
- [MDN SMALL semantics](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/small)

```powershell
bun run check
bun tests/ui/design-system.js
bun scripts/ui-inventory.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/openapi-query-serialization.js
bun tests/ui/nocturne-native-theme.js
```

Existing headless scenario checks10 compact tag/tone cases for each of6
dark/light1440/900/760 profiles (60), normal paragraphs and consumer placement
overrides, reactive Field linked messages/error clearing, and30 actual
KeyValueEditor rows with exact feature padding/gap/bottom geometry. Existing
keyboard/required/invalid-hover/form/file/dialog/tab contracts also run.

Shared key-value helper is reused by actual native query editor verification.
Shared Field-message helper is reused by native Preferences autocomplete help
at6 theme/width profiles, alongside existing author validation/workflows and
workspace preservation. Final production release1791476676475/finished1791477053177/
result0/hash11533498037045558973 accepts native query1791477080785 (44 groups,
3.0.3) and native theme1791477509944 (6 Field message profiles,12 captures,
12 form/18 focus/10 dialog cases, unchanged Git HEAD). Both terminal results
passed/native-hidden/visiblefalse/exit0; sequence55457 terminal0. Final headless
93106 passed60 compact cases/6 Field profiles/30 help rows/12 multipart pairs;
compiler29285 terminal0/0errors0warnings and formatting/diff checks pass.
Actual final reserved-array760 screenshot inspected and corrected separator
confirmed. Authoritative process scan found no owned handles. Browser scenarios are headless; native
hosts hide before CDP attachment and report native-hidden.

The source inventory reports662 external shared markup sites/118 tokens/1719
CSS declarations; internal Field reuse does not add external consumer sites.
Final source hasha5dfa28c0bcfad8067157dd458a3c87cd0518641ee3e2daa3f774edaf0fa56e3.

Native760px screenshot inspection also exposed adjacent compound instructions
(Use JSON values.Reserved characters). KeyValueEditor now emits an explicit
separator in the conditional string; shared saved helper asserts the actual
readable text and the fixture exercises array guidance. Prior accepted release
1791475749233/1791476237736 had narrower geometry/Field evidence and is
superseded for final source acceptance.

## Remaining gates

This closes the demonstrated compact spacing/Field message ownership and
sentence separator gaps. Feature-specific margins, ordinary feedback presentation,
domain validation/adoption, OS dialogs, platform/workflow coverage and full
UI debt remain separate required work. Every remaining owner-approved PLAN/PARITY
OpenAPI/TLS/Git/storage/CI/release/desktop/migration/UX gate is unchanged.


</details>

<a id="record-dialog-backdrop"></a>

<details>
<summary>DIALOG-BACKDROP</summary>

# Shared dialog backdrop ownership

The remaining dialog presentation debt included a hardcoded `#0a0a1466` tint and `blur(6px)` in the shared dialog stylesheet. Changing central tokens had no effect on these values. The saved design-system scenario reproduced this: actual session 50492 exited one, retaining `rgba(10, 10, 20, 0.4)` after an override to `rgba(24, 36, 48, 0.6)`. Original failure evidence is retained in `artifacts/playwright/dialog-backdrop-before.json` and its PNG.

`theme.css` now owns semantic `--dialog-backdrop`; `foundation.css` owns `--dialog-backdrop-filter`. `dialog.css` consumes both for all shared Modal/DialogShell consumers. Defaults retain the exact existing tint/6px blur in both themes. Setting the filter token to `none` removes blur while retaining tint and dialog geometry. No feature-specific backdrop styles or new controls were added. Domain dialog queues, dismissibility, recovery locks and persistence are unchanged.

Primary references consulted before implementation: [CSS Positioned Layout 4 backdrop](https://drafts.csswg.org/css-position-4/#backdrop) and [Filter Effects 2 backdrop-filter](https://drafts.csswg.org/filter-effects-2/#BackdropFilterProperty). Both are editor drafts; actual saved browser/native acceptance establishes the current target engine behavior. MDN pages were also inspected; no universal cross-engine inheritance claim is made from their prose. Existing CSS/custom-property infrastructure was reused; no generator or installation was needed.

The existing shared `assertDialogTokens` helper measures computed `::backdrop` tint/filter, default/overridden/unfiltered/restored values and retained geometry. Its consumers are the saved design-system, application-theme and native-theme scenarios. Design-system exercises normal, compact and locked recovery dialogs across dark/light and 1440/900/760/480 widths, alongside existing Escape/focus/locked lifecycle. Native theme covers actual remote/cookie/branch/recovery workflows, unchanged Git HEAD and original validation/focus contracts.

Commands:

```powershell
bun tests/ui/design-system.js
bun run check
bun scripts/ui-inventory.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/nocturne-native-theme.js
```

Saved headless design-system session 48320 exited zero with all 24 dialog profiles and retained control/lifecycle contracts; compiler session 27067 exited zero with zero errors/warnings. Saved application theme session 99740 exited zero and checked the same backdrop contract on ten actual environment/import/cookie/manage/new collection dialogs across both themes, along with existing theme, focus, picker, workflow and persistence checks.

Fresh production build session 8123 exited zero, native compiler 61188, start 1791592058347 and finish 1791592436327. Executable SHA256 is `ca5d0a8f985d896f741dd0de98d421a16f638f7f5a2aa4ae8d432f300ae8abc8`. Freeze `dialog-backdrop-source-freeze.json` contains 465 application/217 scenario hashes from base e3d8e75. Six intended changes are three CSS owners, UI README, the existing shared helper and native scenario acceptance description. No application/scenario source changed during build or acceptance. Injected fixtureHash alone is not full source identity.

Native theme session 34598 exited zero, artifact `artifacts/playwright/nocturne-native-theme-1791592447541`, native PID 31516. Result is passed, native exit zero, `native-hidden` and `hiddenWindow.visible:false`. Its ten dialog profiles cover remote at 1440/900, cookies, branches and locked recovery in each theme; twelve existing workflow captures, loaded fonts, original validation/focus behavior, Escape lock/retry and unchanged Git HEAD also pass. Independent `backdrop-independent-audit.json` reconstructs expected tint/filter/default/override/none/restoration and geometry, verifies all 682 current hashes and the executable bytes, and binds actual accepted run/build identities.

Actual dark cookie-confirm and light checkout-recovery images were inspected: the original backdrop tint/blur and readable dialog content remain. Computed override checks establish token propagation; these images show restored defaults. No claim of blur-performance improvement or universal platform/browser support follows from this test. `dialog-backdrop-cleanup-audit.json` confirms the owned native PID and exact WebView profile processes are gone; the scenario owns no loopback fixture listener. All feature handles are terminal. Final aggregate evidence is `dialog-backdrop-final-audit.json`; these ignored artifacts remain local evidence. Saved scenarios/helper, source and documentation are committed by topic, with actual SHA recorded in STATUS.

Current source inventory is 58 Svelte files, 681 shared markup sites, 119 tokens and 1730 CSS declarations, with no multiple token owner files, duplicate CSS imports or tokens without var references. CodeMirror's raw textarea remains the documented engine adapter; optional focus-danger-text retains its explicit fallback. This inventory is static evidence, not runtime or full-debt acceptance. Formatting and diff checks pass.

Full migration, shared-component adoption/ownership, other literal/alias cleanup, platform/browser fallback, accessibility and broader UX/CSS requirements remain active. OS-close lifecycle and native Git synchronization are outside this topic's proof. Do not close the full UI debt checklist from these two token contracts. The agent interface has no callable `/compact`; STATUS records the explicit handoff instead of claiming compaction.


</details>

<a id="record-field-descriptions"></a>

<details>
<summary>FIELD-DESCRIPTIONS</summary>

# Shared Field descriptions

Status: verified shared-control fix; topic commit/checkpoint recorded in STATUS.md.

Explicit aria-describedby previously replaced Field description/error IDs.
fieldDescriptions now combines caller IDs first, then reactive Field feedback,
splits HTML ASCII whitespace and deduplicates while retaining order. Empty
caller help retains Field feedback. Input, Textarea, Select, Checkbox and
FilePicker use this one helper. No CSS/layout changes.

Official reference consulted before implementation:
https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA1

Verified evidence:

- Baseline saved design-system.js failed on mounted Input: duplicate caller IDs
  and missing merged-input-error. Observed terminal assertion/failure PNG copied
  to artifacts/playwright/field-description-baseline. Original constant
  result.json was later overwritten; observed-failure.json is the observation
  record. PNG inspected; DOM assertion proves the association defect, while
  screenshot shows earlier fixture context.
- Saved headless87664 terminal0/passed130: five actual components/four reactive
  description-error states/dark+light/1440+900+760 gives120; caller help removal
  and replacement adds10. Retained whole design-system scenario passes.
  Evidence: artifacts/playwright/design-system/field-description-acceptance.json
  and result.json. Earlier corrected63261 passed120.
- field-description-final-audit.json independently verifies120 raw rows, their
  unique profile/state/control identities, ordered references, resolved text and
  current invalid attributes. Additional10 are proven by passing saved assertions;
  their evidence entries record expected refs after assertions, not raw DOM.
- Compiler zero errors/warnings; selected source/scenario/new-doc Prettier and
  diff checks pass. Six shared source SHA256s match field-description-source-freeze.json.
- Fresh native build1791556752062 finished1791557135005/result0, production
  release profile with isolated probe identity, hash16674050803735312688.
  It includes these six files and separately committed body/Git fix a752707.
- Native2580/artifact1791557144758 terminal0/passed14:45:45.162Z–14:49:39.844Z:
  12 workflows/10 dialogs,6 Field feedback/12 form profiles,6 button/6 Select
  profiles and18 focus surfaces. Git HEAD unchanged. Independent seven-source
  acceptance audit passes. Actual dark/light Git900 and cookie images inspected.
  Native61208 exit0/native-hidden/visiblefalse; Bun42584/native gone and scoped
  WebView0. No live feature handles. Passing runs were not restarted.

Retained native failures on superseded release1791555520862:

- Native31170/artifact1791555945042 failed at workspace selection wait15s;
  fixture condition remains exact with60s bound. Native83611/artifact1791556077899
  failed at HTTP Request click15s after initial measurements; image shows new
  request already created/selected. Scenario action/navigation limits are now60s,
  with original assertions and single actions retained.
- Native16599/artifact1791556213497 failed at Source Control wait60s. Actual
  image exposes non-JSON body properties in memory after Body type change.
  RequestEditor now deletes undefined patch keys, with mounted regression6 and
  strict Git guard retained. See GIT.md#record-request-body-git.
- Failed artifacts retained; each native exit0/native-hidden/visiblefalse, owned
  processes/profile released and failure PNG inspected. Superseded successful
  build42205 did not produce passing complete native acceptance.

Saved Bun commands:

```powershell
bun tests/ui/design-system.js
bun run check
bun tests/ui/build-recovery-copy-probe.js
bun tests/ui/nocturne-theme.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/nocturne-native-theme.js
```

Frontend theme27253 passes19 surfaces/persistence/six profiles on the unchanged
Field sources before the body fix; native regression uses the corrected fresh
release. Browser fixtures use launchUiBrowser/headless:true; native scenarios
hide owned host windows before CDP and report native-hidden.

This proves DOM description composition, not screen-reader speech or OS file
dialogs. Production Field callers currently do not supply separate help IDs;
that combination is exercised by the actual component fixture. Native testing
is retained application workflow/theme regression. Broader UI adoption, CSS
ownership/validation/keyboard/platform and all original migration/UX/CSS gates
remain required. Full migration goal is active.


</details>

<a id="record-file-picker-concurrency"></a>

<details>
<summary>FILE-PICKER-CONCURRENCY</summary>

# FilePicker async reset ownership

2026-10-09. Base `9e09a9f`. Native regression and final audit pass; exact commit checkpoint is in STATUS.

When first.txt is selected and its callback is still processing, selecting
second.txt starts another callback. Previously, finishing the first callback
unconditionally cleared the native input, erasing second.txt while its callback
was still pending. The saved old-source baseline reproduces this with manually
released promises, rather than timing assumptions.

The shared FilePicker now numbers each change per component instance. Its
finally block resets only when that change is still the latest and
`resetAfterChange` is enabled. The latest callback retains normal cleanup; the
explicit opt-out retains the selected file. Consumers still own upload/data
freshness, validation and error presentation; this change does not order their
domain results or cancel their processing.

Native file input semantics were checked against the
[WHATWG File Upload state](<https://html.spec.whatwg.org/multipage/input.html#file-upload-state-(type=file)>).
The callback receives the native event; consumers needing the input or files
after an await must capture them while the callback starts. The component
captures its own input before awaiting. No CSS/layout change is included.

## Verification

```powershell
bun run check
bun tests/ui/design-system.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/upload-size.js
bun scripts/ui-inventory.js
```

- Baseline: terminal exit 1, older completion leaves no file instead of second.txt.
  Original result/progress/PNG preserved in
  `artifacts/playwright/file-picker-concurrency-baseline`; image inspected.
- Corrected saved headless design-system39854: terminal exit 0, complete scenario
  passes. Twelve groups cover dark/light, 1440/900/760 and enabled/disabled reset.
  Each verifies older completion preserves second.txt and latest completion
  follows reset policy. Existing completed-callback same-file reselection,
  required-file/form contracts and other shared control regressions remain.
- Independent raw-row audit validates all twelve distinct combinations:
  `file-picker-concurrency-headless-audit.json`.
- Compiler initially found missing input type annotations, then cast precedence
  errors in the saved scenario; corrected before acceptance. Final compiler is
  terminal exit 0, zero errors/warnings.
- App source freeze: `file-picker-concurrency-source-freeze.json`. Fresh native
  build72338 started1791560250408, fixture hash3094143901124634421. Do not change
  source while native build or acceptance is active.

Saved native upload3997/artifact upload-size-1791560755861 passes with terminal
exit0 on release1791560250408/finished1791560630293. It accepts exact16MiB and
20MiB persisted/reloaded/wire payloads, then clears its owned binary payload.
Native52104 exit0/native-hidden/visiblefalse, owned Bun58996/native gone, scoped
WebView0 and local fixture60538 listeners0. Final independent audit recomputes
the two expected SHA256 values and verifies headless12/source freeze/release
identity/native terminal visibility: file-picker-concurrency-final-audit.json.

The first native attempt6152/artifact upload-size-1791560639751 failed at15s
Import click acknowledgement, while its failure body snapshot already showed the
imported Binary File request. No PNG was available. It ended terminal1 with
native exit0/hidden cleanup and no owned processes. The saved upload scenario
now uses60s action/navigation waits, matching native-theme; assertions and single
actions are unchanged. Compiler after this edit passes0errors0warnings.

All browser scenarios use fixed headless launch; native regression must hide its
owned host before CDP and report native-hidden. Saved native upload-size exercises
actual file selection/persistence/reload/16MiB and20MiB wire bytes. It does not
reproduce the controlled overlapping-callback order; that is covered by the
mounted headless real-component fixture. Native OS chooser interaction,
directory/multiple selection, callback rejection and other platforms are not
proved by this scoped scenario.

No full migration/UI debt completion is claimed. All remaining original
PLAN/PARITY and UI adoption/ownership/workflow/platform requirements stay open.
Record terminal native evidence, owned cleanup and commit in STATUS before the
next feature. This interface cannot invoke /compact; provide the recorded handoff
without claiming compaction.


</details>

<a id="record-filled-foreground"></a>

<details>
<summary>FILLED-FOREGROUND</summary>

# Filled surface foreground tokens

2026-10-09. Base `b89c530`; headless policy checkpoint `80d542f`.
Native regression and independent final audit pass; exact checkpoint is recorded in STATUS.

Primary/Send buttons, branding and response badges previously declared white
independently. They now consume three semantic foreground tokens, each defaulting
to white in the theme owner:

| Token          | Consumers                                          |
| -------------- | -------------------------------------------------- |
| `--on-accent`  | Primary, Send, `.brand-mark`, `.large-brand`       |
| `--on-danger`  | Danger hover/focus fallback, failed response badge |
| `--on-success` | Successful response badge                          |

Danger focus still accepts an explicit `--focus-danger-text` override. Its root
default declaration is removed; the consuming rule uses
`var(--focus-danger-text, var(--on-danger))`. This lets a component-local
`--on-danger` override reach focus as well as hover. Reading the raw custom
property now yields empty when no explicit focus override is supplied; the
rendered default remains white. Existing explicit focus overrides retain priority.

The CSS substitution/inheritance model was checked against the
[W3C custom properties specification](https://www.w3.org/TR/css-variables-1/).
No framework or subsystem was initialized.

## Saved verification

All browser scenarios use the fixed headless `launchUiBrowser` helper. Native
scenarios hide their owned host window before attaching to WebView2 and report
`native-hidden`.

```powershell
bun tests/ui/design-system.js
bun run check
bun tests/ui/build-recovery-copy-probe.js
bun tests/ui/nocturne-theme.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/nocturne-native-theme.js
bun scripts/ui-inventory.js
```

The reusable saved helper measures white defaults, a global override, a different
component-local override, exact restoration, and unchanged background/width/
height/font size/line height/radius. Actions never activate the measured buttons.
It restores inline values and priorities even on assertion failure.

- Design-system: 66 measured cases across dark/light and 1440/900/760, including
  Primary/Send default/hover/focus, Danger hover/focus and three brand/badge cases.
  The whole retained scenario also passes. Raw rows independently audited.
- Actual frontend: terminal exit 0; 26 rows in ten groups, with Send at all six
  profiles, visible brand at four, and actual owned local HTTP 200/500 badges in
  both themes. Retained 19 surfaces and persistence pass.
- Native build: terminal exit 0, started `1791558859119`, finished
  `1791559237464`, fixture hash `16674050803735312688`. The six CSS SHA256 hashes
  in `filled-foreground-source-freeze.json` match the sources.
- Actual native: terminal exit 0, 52 rows in twelve groups on the frozen release,
  with 12 workflow captures, 10 dialog cases, six Field profiles and twelve form
  profiles. Git HEAD is unchanged; native exit 0, native-hidden, visible:false.
  Owned Bun48476/native53720 are gone; artifact-scoped WebView processes are zero.
  Dark/light native cookie images were inspected.
- Independent final audit: design66/frontend26/native52 raw rows, source hashes,
  build identity and native terminal/visibility evidence all match. Record:
  artifacts/playwright/filled-foreground-final-audit.json.
- Compiler after saved scenario correction: zero errors and zero warnings.

Artifacts are under `artifacts/playwright`: `design-system`, `nocturne-theme`,
`filled-foreground-build.json`, `filled-foreground-source-freeze.json` and the
timestamped native directory recorded in STATUS. Artifacts are ignored by Git.

## Failures and corrections

The first baseline helper waited for a nonexistent focused element; optional
focus capture was corrected before collecting product evidence. The valid old
CSS baseline then fails the Primary global token assertion: actual white versus
expected `rgb(1, 2, 3)`. Its result/progress/image are preserved under
`filled-foreground-baseline`, and the image was inspected.

Compiler found three possibly missing lookup results in restoration; explicit
guards fixed them without changing accepted runtime behavior.

The first actual frontend run failed waiting for a visible brand at 760px. Its
image and existing CSS confirm the intentional `max-width: 800px` hiding rule.
The original evidence is preserved under `filled-foreground-narrow-failure`.
Both saved actual-app scenarios now assert the breakpoint visibility explicitly,
measure the brand only at 1440/900, and still measure Send at every width.
Actual expected totals are 26 frontend and 52 native, replacing the earlier
incorrect 28/54 plan. No product breakpoint was changed.

## Scope and remaining gates

Brand-mark is currently a raster image: computed CSS foreground acceptance does
not prove recoloring its pixels. The fixture large-brand case measures text.
The tests prove token propagation/restoration and measured geometry, not WCAG
contrast for arbitrary user colors, other-platform native behavior, native OS
file dialogs or completion of the full migration/design-system debt checklist.

Current inventory is source SHA256
`60e841406d173995f8247dc7109c78fba7770945eae3d858cf4a375d8c2e8fbe`:
57 production Svelte files, 664 shared markup sites, 14 feature scoped style
files, 120 tokens and 1722 CSS declarations. There are no multiple-owner token
files or duplicate local CSS imports. The inventory's unresolved
`--focus-danger-text` reference is an intentional optional override with an
explicit fallback; it remains visible in the report. Three unused-var candidates
and dynamic method color references remain for broader debt review.

All original PLAN/PARITY migration requirements and broader UI/CSS adoption,
ownership, interaction, provider/platform and distribution gates remain required.


</details>

<a id="record-nocturne-theme"></a>

<details>
<summary>NOCTURNE-THEME</summary>

# Nocturne theme — completion audit

Current theme name: **Nocturne Dark / Nocturne Light**. October5 owner follow-up removes the reference brand from theme naming. Current checks run with `bun run test:ui:theme` (`tests/ui/nocturne-theme.js`); current preview evidence is in `artifacts/playwright/nocturne-theme/`. CSS cleanup removes unused legacy blocks and duplicate control overrides, with one shared URL focus ring and single pane/control dividers. Historical evidence below retains its original paths.

Owner objective: ปรับ design theme ทั้งหมด ให้ลอกจาก https://hoppscotch.io/

The explicit October5 objective authorizes this theme phase now. Original migration parity and deferred reusable input/workflow work remain separately tracked. Preserve Insomnium identity and existing feature/data behavior while matching the reference's visual system. No browser-use tools; all captured UI evidence uses saved Bun/Playwright scenarios.

## Reference

- Live https://hoppscotch.io/ captured anonymously by `bun tests/ui/nocturne-reference.js`, in dark/light system preferences at1440×960. Script waits for full pane opacity; screenshots and computed font/background/accent are in `artifacts/playwright/hoppscotch-reference/`.
- Live accent observed October5: `#6366f1` in both themes. Earlier green-mixin assumption is superseded. Dark background `#181818`, light `#fff`, Inter Variable. Keep HTTP method/success colors independent of accent.
- Official upstream implementation: [base themes](https://github.com/hoppscotch/hoppscotch/blob/main/packages/hoppscotch-common/assets/themes/base-themes.scss), [accent themes](https://github.com/hoppscotch/hoppscotch/blob/main/packages/hoppscotch-common/assets/themes/accent-themes.scss), [editor themes](https://github.com/hoppscotch/hoppscotch/blob/main/packages/hoppscotch-common/assets/themes/editor-themes.scss), [header](https://github.com/hoppscotch/hoppscotch/blob/main/packages/hoppscotch-common/src/components/app/Header.vue), [navigation](https://github.com/hoppscotch/hoppscotch/blob/main/packages/hoppscotch-common/src/components/app/Sidenav.vue), [pane layout](https://github.com/hoppscotch/hoppscotch/blob/main/packages/hoppscotch-common/src/components/app/PaneLayout.vue), [request controls](https://github.com/hoppscotch/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/Request.vue).
- Fonts: [Fontsource installation](https://fontsource.org/docs/getting-started/install), [MDN font-face](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@font-face). Installed with `bun add @fontsource-variable/inter @fontsource-variable/roboto-mono`; Vite bundles normal variable fonts locally. OFL notices in `static/licenses/`.

## Current coverage

| Requirement                                     | Authoritative evidence                                                                                                                                                                                                         | Remaining work                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Dark/light palette, typography, semantic colors | Central CSS; bundled fonts; UI asserts loaded Inter, mono family, body/Send/method/error/tooltip/completion colors; source audit finds no component-specific literal palette colors; final native completion-popup checks pass | Verified                                                 |
| Reference shell/layout                          | Right-pane bounding boxes and toolbar hit-tests at1440/900/760; compact collection chrome, environment in request toolbar; populated narrow design/runner/stream screenshots; direct reference/current screenshot comparison   | Verified for theme scope                                 |
| HTTP editor and response                        | Six tabs; eleven auth modes at1440/900; JSON/GraphQL/text/XML/form/multipart/binary; tooltip/completion; response200/four tabs/loading/failure; populated/disabled query/header rows and actual Tab focus outline              | Verified                                                 |
| WS/SSE/gRPC                                     | Both-theme idle screens; native proto source/confirmation; live native WS/SSE events/headers/disconnect/error and gRPC response/sent/metadata/trailers/error at1440/900/760                                                    | Verified for rendering/theme; see transport caveat below |
| Dialogs/settings                                | Preferences (keyboard-opened Editor/Certificates), Environment, Import (invalid and review), Cookies, Manage/New collection; native cookie/proto confirmation and Git recovery; runner deletion confirmation                   | Verified for existing dialog styles                      |
| Design/runner                                   | Populated views, narrow overflow checks; real API validation/Operations/Schemas/Diagnostics; real runner pass/fail/details/confirmation screenshots in both themes                                                             | Verified                                                 |
| Native-only UI                                  | Fresh isolated release includes final CSS; native scenario passes Git/remote/diff, cookie edit/confirm, proto source/confirm, recovery, loaded fonts and completion-popup colors                                               | Verified                                                 |
| Regression/tooling                              | `bun run check`0/0, `bun run build`, `bun run test:ui:theme`, three saved native theme scenarios pass                                                                                                                          | Verified                                                 |

Screenshots in `artifacts/playwright/hoppscotch-theme/` are named by theme/surface. `result.json` records the latest run; the helper records failure status and a failure screenshot if assertions fail. Preview requests use an in-process Playwright route; no external API is called. This proves rendering of the response fixture, not native transport correctness.

## Final evidence — 2026-10-05

- Final embedded-frontend build: `artifacts/native-hoppscotch-theme-probe/build-state.json`, exit0, release build5m46s. Isolated identifier only; the executable is a test probe, not a production distribution.
- Native controls/font/popups/Git/cookies/proto/recovery: `artifacts/playwright/hoppscotch-native-theme-1791181270578/acceptance.json` and `result.json`, passed with app exit0.
- Native WS/SSE: `artifacts/playwright/hoppscotch-stream-theme-1791181509200/acceptance.json` and `result.json`.
- Native gRPC: `artifacts/playwright/hoppscotch-grpc-theme-1791181488890/acceptance.json` and `result.json`. Inspected light760 populated response; fixture sends a complete protobuf message and terminal status/trailers. It responds when a full input message arrives, rather than waiting for request stream closure.
- Static preview: `artifacts/playwright/hoppscotch-theme/result.json`, both themes; screenshot names identify every tested surface. Inspected shell alongside reference, syntax tooltip, runner assertion details, populated narrow design/tests and native stream/proto/recovery/completion surfaces.
- Source audit: components use central palette/font tokens. Remaining literal white action-label and black translucent backdrop/shadow values are intentional neutral treatments. No old component-specific accent palette remains.

The theme objective is complete across the existing application surfaces. Insomnium identity and its existing feature set remain; this is a visual-system adaptation of Hoppscotch, not an implementation of Hoppscotch's cloud/login features. The separate full migration and deferred reusable-input/workflow phase remain open.

Transport caveat discovered during visual verification: native gRPC can display `gRPC call cancelled.` after receiving a valid `0 OK` response. The scenario proves rendering of messages/metadata/trailers/error styles, not transport lifecycle parity. Track that existing completion/cancellation behavior in the migration status; it is not a theme acceptance claim.


</details>

<a id="record-nocturne-workspace"></a>

<details>
<summary>NOCTURNE-WORKSPACE</summary>

# Nocturne workspace UI

Owner request (2026-10-05): Git in the left rail with a familiar source-control workflow, original visual styling, reusable controls, and resizable panels. This explicitly starts the previously deferred component/workflow scope. Migration parity remains separate.

Latest Source Control follow-up: Before/After panes are replaced by one read-only unified diff, with old/new line numbers, red removed rows, green added rows and YAML syntax highlighting through the shared CodeEditor. Git bytes are displayed directly, not parsed and rewritten; legacy JSON paths retain JSON highlighting. The former Before/After divider is removed. Branch management is tucked into the additional-actions icon for a single local branch with no remote; it becomes prominent for multiple branches, a configured remote, detached HEAD or pending creation. The empty switch/delete controls are hidden for a single local branch. Remote setup remains available as “Set up remote”. See STATUS for fresh verification; earlier native evidence below predates this follow-up.

## Shared components

`src/lib/components/ui` contains Svelte JavaScript primitives. The follow-up owner correction expanded adoption to253 additional input/select/button sites and15 textareas, with a visible control redesign and data-driven Dropdown; see the component directory README for API/examples. `controls.css` is the central visual owner, imported after application layout CSS. Native attributes/events pass through controls; `value` is bindable for Input, Select and Textarea. Button defaults to `type="button"`; variants are primary, secondary, danger and ghost, with disabled/busy handling. Field associates an id with its label and renders description/error; callers connect `aria-describedby` to the rendered `<id>-description`/`<id>-error` when present. Native checkbox/file inputs keep their specialized behavior.

Modal owns native dialog open/cancel/close, heading association and focus restoration. Callers own state and submit behavior. Main application dialogs and Git branch/author/remote dialogs use it. Shared controls are also used by key/value editors across HTTP and gRPC.

SplitPane accepts `first`/`second` snippets, `storageKey`, accessible `label`, `axis`, initial percentage, pixel minima, optional stacking breakpoint and collapsed state. Drag the divider or focus it and use arrows (2%), Shift+arrows (10%), Home/End (bounds), Enter/double-click (reset). Only size preferences go into localStorage. Each content pane owns its scrolling. Applied to collection sidebar, request/response, gRPC, stream events/detail, GraphQL query/variables and schema explorer, API source/preview, test editor/results and Git sidebar/detail and changes/history. The unified diff itself uses one editor.

## Git behavior

- Ctrl+Shift+G opens Source Control; it is a workspace view, not a modal. Browser preview explains that repositories need the desktop app.
- Stage/unstage selects collection resources for the existing safe commit engine. Required collection metadata cannot be unstaged. Commit and Ctrl+Enter require author, message, branch and selected resources. No implicit commit-all.
- Draft message and staged selections survive tab navigation within the app session. Restoration compares repository, HEAD, and exact before/after content; changed resources require staging again. Draft resource contents are held in memory, never localStorage. These are collection-resource selections, not a general filesystem Git index or hunk staging system.
- History lanes derive from actual parent OIDs; details expose author, hash, parents and message. Pagination retains existing history limits. Branch creation/switch/delete and remote fetch reuse existing native coordinators. This change does not add push/pull/merge parity.

## References and checks

- Windows chrome uses the platform-specific `tauri.windows.conf.json` overlay (`decorations:false`), with minimize/maximize/restore/close controls after the theme switch. Header empty space is a Tauri drag region. Close calls `Window.close()` so the existing save/shutdown guard runs before destruction. Other desktop platforms retain their native decorations.
- [Window-state persistence](https://v2.tauri.app/plugin/window-state/) excludes `StateFlags::DECORATIONS`: saved geometry still restores, but old decorated state cannot override platform chrome configuration.
- Consulted [Tauri window customization](https://v2.tauri.app/learn/window-customization/) and [window API](https://v2.tauri.app/reference/javascript/api/namespacewindow/). Build command: `bun x --bun tauri build --no-bundle --config` with isolated probe identifier and `beforeBuildCommand:null` after frontend build. Saved native scenario: `bun tests/ui/window-controls.js`.
- Request names display as text until focus, then enter inline editing; blur/Enter saves and Escape cancels. Method/protocol selects center their labels and use Lucide chevrons while retaining native select keyboard behavior.

- [Svelte props](https://svelte.dev/docs/svelte/$props), [bindable](https://svelte.dev/docs/svelte/$bindable), [snippets](https://svelte.dev/docs/svelte/snippet).
- [WAI window splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) for focusable separator keyboard semantics; explicit compiler suppression documents this APG pattern.
- [VS Code staging workflow](https://code.visualstudio.com/docs/sourcecontrol/staging-commits), [history](https://code.visualstudio.com/docs/sourcecontrol/history): behavior reference only.
- `bun run check`, `bun run build`, `bun run test:ui:theme`, `bun tests/ui/nocturne-workspace.js`, `bun tests/ui/git-source-control.js`.
- Native scenario requires the isolated build record at `artifacts/native-nocturne-workspace-final/build-state.json`. See STATUS for actual execution results; a production installation is never used as a test fixture.

## Verified result

Final check reports0 errors/0 warnings; production frontend and isolated native build pass. Saved preview theme/workspace scenarios pass, including modal focus, responsive layout and splitter persistence. Final native source-control evidence: `artifacts/playwright/git-source-control-1791187244103/acceptance.json` (both modes,1440/900/760). Branch create/resume/forget/delete/stale protection, remote cancellation, checkout recovery, gRPC, WS/SSE and GraphQL schema splitter scenarios also passed; timestamps/build distinctions are recorded in STATUS.

Shared-control redesign follow-up: `artifacts/native-nocturne-controls-probe/build-state.json` is the current successful isolated build. Preview screenshots at `artifacts/playwright/nocturne-workspace/dropdown-dark.png`, `dropdown-light.png`, and `shared-settings.png` show the actual redesigned controls. Seven native regression scenarios passed with this build; see latest STATUS. Native fallback dropdown behavior on other engines is retained, but those engines were not visually tested in this Windows session.


</details>

<a id="record-tab-panel-keyboard"></a>

<details>
<summary>TAB-PANEL-KEYBOARD</summary>

# Shared tab panel keyboard entry

Text-only tab panels previously had no keyboard entry point. Merely adding tabindex failed because their shared CSS used display:contents, which has no focusable box. TabPanel now defaults to tabindex0, accepts an explicit numeric override and uses a column flex box with flexible sizing and zero minimum dimensions. Child editor/response scrolling and the existing common focus surface remain the owners of their behavior/presentation.

Consulted before implementation: [W3C APG Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/), keyboard interaction and note4. It recommends a tab stop when a panel has no focusable content or starts with meaningful non-focusable content. Existing subsystem reused; no generator/dependency needed. The shared change applies to request, response, API Design and gRPC panel callers.

```powershell
bun x --bun prettier --write src/lib/components/ui/TabPanel.svelte tests/ui/design-system.js tests/ui/nocturne-workspace.js
bun run check
bun run build
bun tests/ui/design-system.js
bun tests/ui/nocturne-workspace.js
```

The first design-system run76256 failed the actual Tab focus assertion despite tabindex0, exposing display:contents; its terminal assertion is recorded in STATUS. After correcting shared CSS, the same saved scenario57782 exited0/passed. `artifacts/playwright/design-system/tab-panel-focus.json` records actual Tab entry, Shift+Tab return and selected-tab labelling for dark/light at1440/900/760. The full retained design-system scenario also passed. The result path is reused by the existing helper and now contains the passing rerun, not the initial failure.

Fresh frontend build exited0. Saved workspace scenario exited0/passed12 checks; `artifacts/playwright/nocturne-workspace/tab-panels-{1440,900,760}.json` verifies positive request/response panel dimensions bounded by viewport and tabindex0. At760, request panel is490x280.5 and response panel490x306.5. The actual760 screenshot was inspected; no horizontal overflow or broken pane layout observed. Compiler2359 exited0/zero errors/warnings, formatting and diff checks pass. All verification handles terminal; shared browser helper uses fixed headless:true.

This is frontend/Chromium keyboard and layout acceptance. The prior packaged native executable predates this frontend change, and no new native/platform/assistive-technology acceptance is claimed. Other panel contents, content-dependent scrolling, full accessibility, shared ownership/adoption and all original migration/UX/CSS gates remain required.

## Subsequent Windows native acceptance

After the frontend commit, the existing saved native-theme scenario adds actual Tab/Shift+Tab entry/return, selected-tab labelling and request/response pane geometry in six dark/light1440/900/760 profiles. Its existing full workspace-preservation and Git HEAD checks remain. Compiler94405 exited0/zero errors/warnings and saved scenario formatting pass.

```powershell
$env:LIBCLANG_PATH='E:/.dvgamerr-app/insomnium-app/artifacts/tools/llvm-20.1.8/bin'
Remove-Item Env:INSOMNIUM_UI_LOW_MEMORY -ErrorAction SilentlyContinue
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/nocturne-native-theme.js
```

Build42964 exited0 in production release profile (started1791621031750/finished1791621420119). The priorc2fbaa43 executable/build state are preserved under `artifacts/native-tab-panel-baseline`. Independent `tab-panel-native-bind.mjs` binds703 current source hashes/probe identity/new executable SHA256 `82102013b54c056c38f306bfa7ae67c53d61fdd235027e6db766377b9d1e54b6` and verifies the preserved baseline. Source changes relative to the prior OAuth graph freeze are only TabPanel/navigation CSS/UI README and three saved UI scenarios. Initial preparation's expected-change list omitted the committed UI README; the assertion failed before copying/building and was corrected after inspecting that change. Vendor eventsource-stream warnings remain unrelated existing build output.

Saved native75462/artifact `artifacts/playwright/nocturne-native-theme-1791621431860` exited0/passed; native64136 exited0, rendering `native-hidden`, visible:false. It preserves12 workflow captures/10dialog profiles and adds6 actual keyboard/geometry profiles. At760, both themes have490px-wide request/response panels with positive heights265.1875/287.8125, bounded within900px viewport height. `bun artifacts/tab-panel-native-audit.mjs artifacts/playwright/nocturne-native-theme-1791621431860` verifies current703 hashes/executable/baseline, result/native visibility, six ordered profiles and all recorded pane dimensions. Source freeze: `artifacts/playwright/tab-panel-native-source-freeze.json`; cleanup: `tab-panel-native-cleanup.json`. Exact owned64136 and its WebView2 profile processes are absent. Both actual760 dark/light images were inspected without observed pane overflow.

This supersedes the earlier native-unverified state for the covered Windows scenario. It does not prove every panel content/scrolling shape, assistive technology, OS-close lifecycle or other platforms. Full migration/shared UI adoption/ownership/UX/CSS gates remain required. No live feature handles remain.


</details>

<a id="record-ui-design-system-debt"></a>

<details>
<summary>UI-DESIGN-SYSTEM-DEBT</summary>

# UI/UX: รวม components และ design system ให้ใช้ร่วมกัน

2026-10-10 named-example levels/source recovery: saved headless108checks/28controls
and6control profiles pass, including24 modern root/media data/serialized/external
cases with same-named refs/source preservation. Four current native versions
pass26Sends/44generated requests/24profiles/4worker refusals without writes,
then correction/regeneration preserves original resources and sends exact JSON.
Source edit/Git/reset, current668 app/scenario hashes, exact executable SHA and
owned cleanup audits pass; all actual handles terminal0/native-hidden. App/CSS
unchanged from3cdbd18; accepted production release reused with proven hash identity.
Compiler0/0, formatting/whitespace pass. Exact artifacts, retained first fixture
Git-metadata failure, commands and limits:
[API-DESIGN.md#record-named-example-recovery](API-DESIGN.md#record-named-example-recovery).
All original migration/OpenAPI/UX/CSS/provider/platform gates remain required.

2026-10-10 OpenAPI named examples: operation-scoped parameter/body choices and
body MIME selection use shared controls, persist with the document and retain
request provenance without modifying authored source/shared refs. Headless84
checks/28specific refusal controls/6control profiles and frozen production-profile
native20requests/24profiles across3.0.3/3.1.0/3.2.0/3.2.1 pass. Native includes
worker/persistence/reload/reset/Git/exact payload capture; modern versions also
send selected serialized JSON/whole-query. Independent source/build/bytes/Git
and owned cleanup audits pass, every scenario handle terminal0/native-hidden.
Compiler0/0; retained serialized/layout24 and formatting/whitespace pass.
Static inventory58Svelte/681shared/117tokens/1728CSS declarations (+9shared sites,
no new raw/style owner). Exact commands/artifacts/failures/limits:
[API-DESIGN.md#record-openapi-named-examples](API-DESIGN.md#record-openapi-named-examples).
All original migration/OpenAPI/UX/CSS/provider/platform gates remain required.

2026-10-10 API Design attachment layout: bounded setup scrolling and API-only
minimum split sizing preserve usable source/preview with expanded examples/refs.
Saved headless24 count/theme/width/height profiles and fresh native12 geometry/
keyboard-focus profiles pass, including600px height and760px width. Native
3.2.1 retains3byte request groups/4loading controls/management/refs/worker literals/
reload/Git; terminal0/native-hidden/visiblefalse, source/build/bytes/geometry
audits and owned cleanup pass. Compiler0/0; shared sites/tokens unchanged672/117,
feature CSS declarations+10 (1728total). Source preserved throughout fresh build
and native acceptance. Failures, exact artifacts, viewport scope and commands:
[API-DESIGN.md#record-api-design-layout](API-DESIGN.md#record-api-design-layout).
Full original migration/OpenAPI/UX/CSS/provider/platform gates remain required.

2026-10-10 OpenAPI external example byte assets (release0c2b79e): explicit local/HTTP(S) loading
preserves body bytes and UTF-8 query representation, with cancellation and
document-switch guards. Current typed-Object source and saved scenario are
accepted on production-profile build2203 across3.2.1/3.2.0/3.1.0/3.0.3:
12 request groups,16 loading controls,16 asset-management actions and8 worker
literal assertions. Independent bytes/SHA/source/reference/Git/build audits pass;
all scenario handles terminal0/native-hidden, owned processes/listeners gone.
Headless8+30 plus retained168+11+8/editor/body-Git pass; compiler0/0.
Static inventory57Svelte/672shared/117tokens/1718declarations; no new feature CSS.
Exact source/build/artifacts, failures, commands and limits:
[API-DESIGN.md#record-openapi-external-examples](API-DESIGN.md#record-openapi-external-examples).
The760px attachment compression recorded for that release is resolved by the
subsequent layout topic linked above. Full OpenAPI parity and every original
migration/UX/CSS/provider/platform gate remain required.

2026-10-09 FilePicker concurrent reset: older async callback completion no longer
erases a newer pending file. Saved controlled headless12 (six theme/width profiles
with both reset policies), retained full design-system and fresh native16/20MiB
selection/persistence/reload/wire checks pass. Compiler0/0, native-hidden/terminal0,
source/build/expected-hash audit and owned process/listener cleanup pass. Exact
retained baseline/native action timeout, corrected waits and scope limitations:
[UI-DESIGN-SYSTEM-DEBT.md#record-file-picker-concurrency](UI-DESIGN-SYSTEM-DEBT.md#record-file-picker-concurrency). Original migration and
full UI/CSS/workflow/platform/provider gates remain required.


2026-10-09 unused internal tokens: removed declaration-only code/font-size-14/space-30
(four declarations across theme/foundation). Current sourceSHA256
e15f0182538b7592d0946bfe335976989466235bee72a25479379dc7ab63d6ce:
117tokens/1718declarations, unused-var candidates0. Adoption/import/owner/raw
exception/dynamic-reference inventory unchanged; optional focus-danger-text
fallback remains visible. Compiler0/0, build0 and saved full design-system71649
terminal0/passed including66 filled foreground rows. Exact scope and remaining
gates: [UI-DESIGN-SYSTEM-DEBT.md#record-unused-ui-tokens](UI-DESIGN-SYSTEM-DEBT.md#record-unused-ui-tokens). Older source inventories below
are historical; full UI debt/migration remains required.


2026-10-09 filled foreground tokens: Primary/Send/brand, Danger hover/focus and
success/failure badges consume centralized on-accent/on-danger/on-success.
Optional focus-danger-text retains explicit override priority with scoped fallback.
Headless66/actual frontend26/native52 measured global/scoped/restoration rows pass;
native1791559328466 is terminal0/native-hidden/visiblefalse, with12 workflows/
10dialogs, unchanged Git HEAD, independent source/build audit and owned cleanup.
Compiler0/0. Exact corrected responsive-brand test failure, artifacts and limits:
[UI-DESIGN-SYSTEM-DEBT.md#record-filled-foreground](UI-DESIGN-SYSTEM-DEBT.md#record-filled-foreground). All original migration/UX/CSS and
remaining adoption/ownership/provider/platform gates stay required.


2026-10-09 shared Field descriptions: Input/Textarea/Select/Checkbox/FilePicker compose caller aria-describedby with reactive Field description/error IDs through one helper; stable reading order, deduplication and empty caller help retain validation feedback. Saved headless130 across5 controls/4 states/6 profiles and caller removal/replacement pass; independent120 raw-row audit and7 source hashes match. Native theme1791557144758 passes12workflows/10dialogs/6 Field+12 form profiles, terminal0/native-hidden/visiblefalse, unchanged Git HEAD and owned cleanup; relevant dark/light images inspected. Compiler0/0 and formatting pass. Body/Git dependency committed separately in a752707. Exact scope/commands/failures/limits: UI-DESIGN-SYSTEM-DEBT.md#record-field-descriptions/STATUS.md. Full migration/UX/CSS and remaining accessibility/platform/adoption/ownership gates stay required.

2026-10-08 validation hover ownership: generic and Select-shell hover border rules
previously overrode actual Field errors; baseline failure retained. controls.css
now owns both with :where() eligibility so semantic error states win, and the
variants.css competing border declaration is removed while surface hover remains.
Headless6 profiles/108 invalid+valid interaction measurements, compiler0/0,
actual headless application and current production native theme/workflow regression
pass; exact evidence/limits in STATUS/UI-TESTING. Declaration count is1713 with
unchanged adoption/token/import graph inventory. This closes the demonstrated
standard-control hover border defect, not the remaining full debt checklist.

2026-10-08 current AST inventory is in [UI-DESIGN-SYSTEM-DEBT.md#record-ui-inventory](UI-DESIGN-SYSTEM-DEBT.md#record-ui-inventory), generated
with `bun scripts/ui-inventory.js`:57 production Svelte files/661 direct shared
markup sites, only CodeEditor textarea outside primitives,14 feature scoped
style files/118 tokens/1714 declarations. The local application CSS graph has no
duplicate imports; no custom property has multiple owner files. Three no-var
reference token candidates and dynamic method colors are explicitly documented.
Use this source inventory instead of the historical A4 counts below for planning.
Runtime semantics, property-level duplication/literals and the full checklist
remain unclosed; this inventory does not relabel old runtime checks as new passes.

2026-10-08 shared form geometry: eight foundation tokens centralize standard control padding/line-height, Checkbox size, Field gaps and inline/dropzone FilePicker metrics, preserving defaults and explicit variant padding. Old Input override8/11vs6/17 failure retained; compiler0/0/headless design-system6 and actual theme regression pass. Fresh production release1791450919839/1791451297762/result0/native1791451311699 accepts12 actual Editor Preferences/cookie profiles (dark/light1440/900/760),6 Button/6 Select profiles,12 workflows/10 dialogs, exact no-workspace-mutation/fonts/locked recovery/unchanged HEAD; native-hidden/terminal0/exit0/no handles. Native restored cookie images inspected. Headless file geometry is not native OS-dialog acceptance; full UI debt/workflow/platform and original migration/UX gates remain required. Exact evidence and compact handoff in STATUS.

2026-10-08 shared Button padding ownership: actual old primary override failure7/12vs5/19 reproduced; shared controls now consume existing foundation button-padding with unchanged defaults, explicit Icon/Send/toolbar overrides preserved. Headless6 and fresh production release1791446220301/1791446646549/result0/native1791446699449 accept6 dark/light1440/900/760 profiles (three actual variants each),12 workflows/10 dialogs/6 Select profiles/fonts/locked recovery/unchanged Git HEAD; native-hidden/terminal0/exit0. Compiler0/0/frontend/headless application/format/diff pass; restored native dark/light900px cookie images inspected. Full debt and original migration/UX gates remain required; exact evidence/failure/compact handoff in STATUS.


2026-10-08 capability820aee4: fixed Field required context (previously decorative star only), native required inherited by5 controls/reactive optional/explicit false override, FilePicker Field error semantics, and actual Git author Preferences adoption of Field ID/required/busy ownership. Design-system native form submission contract and static dark/light1440/900/760 pass; fresh Windows production release1791407772794/1791408129110/result0 accepts native-theme1791408164309 (actual author browser validation before persistence IPC/full data preservation), Source Control and Push regressions. Current raw native-control inventory finds only specialized CodeEditor fallback outside primitives. This is one verified field semantics/adoption improvement; CSS tokens/literals/unused declaration and remaining workflow/interaction/full debt gates stay open. Exact evidence/limits/checkpoint in STATUS.

วันที่: 2026-10-05  
สถานะ: **บันทึกปัญหาและแผนแก้; ยังไม่ปิด debt**  
ฐานโค้ดของหลักฐานเดิม: `48030b1cffbd8ccb009992c306c81592dc18c92c`

## ปัญหาที่เจ้าของระบุ

UI/UX ดูเหมือนแต่ละส่วนแยกกันเขียน: บางจุดไม่ใช้ component กลาง, บางจุดสร้างรูปแบบใหม่, design system ไม่เป็นชุดเดียวกัน และเพิ่ม CSS ต่อกันโดยไม่แบ่งความรับผิดชอบให้ส่วนต่าง ๆ ใช้ร่วมกัน

เจ้าของเลือกให้ **บันทึกปัญหาและแผนแก้ใน docs** สำหรับงานนี้ การมี shared components อยู่ใน repository หรือเคย migrate controls จำนวนมาก ไม่เพียงพอที่จะถือว่าปัญหานี้แก้แล้ว ต้องย้าย consumers จริงและกำจัดความรับผิดชอบที่ซ้ำกันด้วย

เอกสารนี้เป็น architectural/UI debt เพิ่มเติมจาก [รีวิว repository](MIGRATION-REVIEW.md#record-review-2026-10-05) ไม่ได้เปลี่ยนข้อพบเดิมทั้งสี่ให้เป็นงานที่แก้แล้ว และไม่อ้างว่าได้ทดสอบหน้าตาหรือ usability ใหม่

เจ้าของเคยยืนยัน **“บันทึกปัญหาและแผนแก้ใน docs”** ต่อมาได้สั่งแก้โค้ดโดยตรงสำหรับ SVG arrow ของ dropdown ทุกจุด, การจัดข้อความ method/protocol กลางช่อง และ hover เต็มปุ่ม ขอบเขตนี้ดำเนินการใน shared Select และ styling owners ดูผลตรวจและข้อจำกัดใน [STATUS.md](STATUS.md) งาน consolidation ทั้งระบบยังต้องแยกจาก snapshot ของรีวิวเดิม และไม่ถือว่าการมีไฟล์ใหม่หรือย้าย consumers แล้วเป็นหลักฐานว่าปิด debt ได้

## งานแก้ dropdown ตามคำสั่งล่าสุด

- SVG chevron เป็นค่าเริ่มต้นของ shared Select/Dropdown จึงใช้ร่วมกันที่ collection, environment, No Body/JSON body type, authentication, redirects และ response history; native listboxes ไม่เพิ่มลูกศร dropdown
- Method/protocol ใช้ padding สองด้านเท่ากันและจัดข้อความตรงกลางทั้งแนวนอน/แนวตั้ง; dropdown อื่นจัดข้อความกลางแนวตั้ง
- Hover เปลี่ยนพื้นผิวทั้ง control รวม padding และปุ่มชนิด ghost/plain/send แทนเปลี่ยนเฉพาะสีข้อความ
- Shared history variant จำกัดความกว้างของ shell และ select ร่วมกัน เพื่อไม่ให้ SVG หลุดออกไปจากช่อง response/stream/gRPC history
- Saved scenarios เพิ่มการตรวจลูกศรจริงใน DOM, native picker-icon ที่ซ่อน, base-select, ตำแหน่ง SVG และ hover จากมุม padding ทั้ง dark/light ดูหลักฐานล่าสุดใน STATUS; การแก้จุดเหล่านี้ยังไม่ปิดรายการ A1–A6 ทั้งหมด

## Regression ที่ยืนยันจากรีวิว: Select svgArrow (P2 / R2)

- ตำแหน่งใน review comment: `src/lib/components/ui/Select.svelte:47` (รายงาน repository snapshot อ้างบรรทัด 49; เลขบรรทัดเปลี่ยนได้ตาม revision)
- บน Chromium/WebView2 ที่รองรับ `appearance: base-select` กฎ `appearance: none` ของ Select ที่มี SVG arrow มี specificity สูงกว่ากฎส่วนกลาง ทำให้ HTTP method และ Response mode ใช้ native popup แม้ `::picker(select)` ยังตั้งเป็น `base-select`
- ผลกระทบคือ dropdown สองจุดหลุดจาก themed picker และสูญเสีย popup styling ใน dark/light จึงไม่สอดคล้องกับ shared Select จุดอื่น
- แผนแก้: ให้ `appearance: none` ใช้เฉพาะ fallback; engine ที่รองรับต้องรักษา `base-select` และซ่อนลูกศรเดิมผ่าน `::picker-icon` ใน styling owner ของ Select แห่งเดียว
- เกณฑ์ปิด: saved scenario ต้องตรวจ computed appearance, popup theme, keyboard selection และการปิดด้วย Escape ของทั้งสอง consumers ใน dark/light พร้อมบันทึกขอบเขต fallback ที่ตรวจจริง การตรวจเฉพาะ SVG หรือ alignment ไม่เพียงพอ

ข้อพบนี้มาจากการรีวิว commit ล่าสุดและ source ที่เกี่ยวข้อง ไม่ใช่การรับรอง design หรือ technical debt ทั้งระบบ และรอบรีวิวเดิมไม่ได้ทดสอบ UI จริงหรือแก้ไฟล์ ดูหลักฐานและข้อจำกัดใน [R2 ของรายงานรีวิว](MIGRATION-REVIEW.md#record-review-2026-10-05รักษา-themed-picker-เมื่อเปิด-svgarrow)

## หลักฐานจาก snapshot ก่อน consolidation

รายการ A1–A6 และจำนวน markup ด้านล่างอ้างอิงฐานโค้ดเดิม ไม่ใช่ inventory ใหม่ของ working tree หลัง refactor ต้องสำรวจซ้ำก่อนรับงาน

### A1 — CSS ของ controls ยังมีเจ้าของมากกว่าหนึ่งแห่ง

[styles.css](../../src/lib/styles.css) มี 1,597 บรรทัดตามการแยกบรรทัดของไฟล์ ณ snapshot นี้ และรวมทั้ง tokens, native element styles, shell, API Design, GraphQL, key/value editor, streaming, response, forms, cookies และ responsive rules อยู่ไฟล์เดียว

ในไฟล์นี้มี `button`, `input`, `select`, `textarea` rules, `.primary-button`, `.secondary-button`, `.danger-button`, `.icon-button`, `.text-button`, `.form-panel` และ `.modal-actions` ขณะ [controls.css](../../src/lib/components/ui/controls.css) ก็กำหนด shared control variants/states และ modal presentation อยู่แล้ว ตัวอย่างการเป็นเจ้าของซ้ำคือ button size/padding/weight และ variant surfaces; `.modal-actions` มี declarations จากทั้งสองไฟล์

การรวม declarations ผ่าน cascade อาจตั้งใจในบางจุด แต่ตอนนี้การแก้ control ต้องรู้ทั้ง legacy/general rules กับ shared rules จึงเสี่ยงเพิ่ม override แทนการแก้ component ต้นทาง R2 เรื่อง Select appearance ในรายงานรีวิวเป็นตัวอย่างที่ยืนยันแล้วของผลกระทบจาก specificity ที่ข้ามส่วนกัน

### A2 — Tokens และมาตรวัดยังแยกเป็นหลายชุด

- `styles.css` กำหนด theme/syntax/method colors, `--radius: 4px` และ `--control-height: 32px`
- `controls.css` กำหนด `--ui-radius: 8px`, `--ui-height: 34px`, control surfaces/borders/popup/shadows และ light overrides
- [button-config.css](../../src/lib/components/ui/button-config.css) กำหนด button dimensions, spacing, typography และ radius อีกชุด
- Feature styles ยังมี literal spacing/typography เช่น Git heading `14px 18px`, runner toolbar `10px` และ gRPC message `14px`

การมี semantic tokens หลายประเภทหรือไฟล์ tokens หลายไฟล์ไม่ใช่ bug ในตัวเอง ปัญหาคือยังไม่มี ownership/mapping ที่ชัดเจนว่า scale ไหนเป็น foundation, ตัวไหนเป็น alias ของ component และ literal ไหนเป็นข้อยกเว้นที่จำเป็น การรวมระบบไม่ได้หมายความว่าทุก control ต้องมีขนาดหรือ radius เท่ากัน

### A3 — Shared Field ยังไม่ได้ใช้ทั่วระบบ

[Field.svelte](../../src/lib/components/ui/Field.svelte) มี label, required marker, description และ error แต่พบ usage ใน application เพียง **2 ตำแหน่งใน GitPanel** สำหรับ author name/email

Settings, auth, cookies, resource forms และ environment editor ยังประกอบ label/help/error ผ่าน `.form-panel`, `.name-label`, `.checkbox-label` หรือ markup เฉพาะหน้าเอง ทำให้ required/error/description และการเชื่อม `aria-describedby` ต้องจัดการซ้ำ และการปรับ form UX จาก Field กลางยังไม่มีผลทั่วระบบ

Field ปัจจุบันยังไม่ได้ทำให้การเชื่อม description/error กับ control เป็นอัตโนมัติ ผู้เรียกต้องกำหนด id และ attributes ให้ตรงกัน จึงต้องกำหนด contract ก่อนย้าย consumers ไม่เพียงครอบ markup เดิมด้วย component

### A4 — Control patterns บางประเภทไม่มี shared component ที่ใช้จริง

นับ static markup ใน `.svelte` นอก `components/ui` พบ:

| รายการ                             | จำนวนตำแหน่งใน source | หมายเหตุ                                                         |
| ---------------------------------- | --------------------- | ---------------------------------------------------------------- |
| Native `<button>`                  | 20                    | รวม tabs, navigation, selectable rows และ segmented choices      |
| Native `<input>`                   | 34                    | 22 checkbox และ 12 file input                                    |
| `<Field>`                          | 2                     | อยู่ใน GitPanel เท่านั้น                                         |
| Feature components ที่มี `<style>` | 13                    | ต้องแยก feature layout ที่เหมาะสมออกจาก primitive styling ที่ซ้ำ |

ตัวเลขเป็นจำนวน markup sites ไม่ใช่จำนวน controls ที่ render หลัง `{#each}` และ **native markup ไม่ใช่ข้อผิดพลาดทุกตำแหน่ง** เช่น CodeMirror textarea เป็น editor integration ที่มีเหตุผลเฉพาะ สิ่งที่ต้องทำคือกำหนด shared contract ให้ patterns ที่ซ้ำ และบันทึกข้อยกเว้นที่จำเป็น

| Pattern                                  | Consumers ที่ต้องพิจารณาย้าย                                                                                                     |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Editor/result tabs                       | RequestEditor, ResponsePane, StreamPane, GrpcPane, ApiDesign                                                                     |
| Segmented/view choices                   | GraphqlEditor Query/Schema, ResponsePane Pretty/Raw, stream selection controls                                                   |
| Checkbox                                 | Preferences, request/auth settings, OAuth/Hawk/OAuth1, key/value rows, cookie restore, Git recovery, gRPC auto-scroll            |
| File picker                              | Main import, ApiDesign source/refs, GraphQL schema, proto files/directory, request binary/multipart/cURL body, WebSocket payload |
| Labeled fields                           | Preferences, auth, cookies, environments, resources, Git author/remote forms                                                     |
| Toolbar/section/empty/error presentation | Request, GraphQL, response/stream/gRPC, API Design, Git, runner                                                                  |

หลาย tabs ใช้ `.editor-tabs` ร่วมกันอยู่แล้ว แต่ markup, selected state และ semantics ยังเขียนแยก การย้ายไป shared component ต้องรักษาพฤติกรรมที่แตกต่าง เช่น editor tabs, sent-message list และ mode toggle ไม่ควรบังคับให้ทุกอย่างเป็น tablist โดยไม่ตรวจ interaction

### A5 — Modal ใช้ presentation ร่วมบางส่วน แต่ lifecycle ยังแยกกัน

[Modal.svelte](../../src/lib/components/ui/Modal.svelte) ดูแล native dialog, Escape, heading/close button และ focus restoration ขณะที่ [TemplatePromptDialog.svelte](../../src/lib/components/TemplatePromptDialog.svelte) และ [GitRecovery.svelte](../../src/lib/components/GitRecovery.svelte) มี native dialog lifecycle ของตนเอง

Prompt ต้องผูก FIFO queue, active ID, abort และ completion; recovery มีข้อจำกัดการปิดและการยืนยันที่สำคัญ จึงไม่ควรย้ายทั้งสองเข้า generic Modal โดยสูญเสีย behavior แต่ควรใช้ dialog shell/focus/presentation contract ร่วม แล้วคง feature policies ไว้ใน feature adapter

### A6 — การโหลด styles และเอกสาร ownership ยังไม่ป้องกันการเขียนซ้ำ

[+page.svelte](../../src/routes/+page.svelte) import fonts, `styles.css` แล้ว `controls.css` ตามลำดับ การรักษาลำดับนี้เป็นส่วนหนึ่งของ cascade ปัจจุบัน แต่ยังไม่มี application style entry ที่แสดง dependency order และ owners ของแต่ละ layer อย่างชัดเจน

[UI README](../../src/lib/components/ui/README.md) ระบุว่า controls.css เป็นเจ้าของ controls และให้ feature layout อยู่กับ feature stylesheet แต่ source ยังมี ownership ซ้ำตาม A1 และยังไม่มี contract ครอบคลุม checkbox/file picker/tabs/form fields ทั้งระบบ การบันทึกว่าเคย migrate 253 controls จึงยังใช้เป็นเกณฑ์ปิด architectural debt นี้ไม่ได้

## เป้าหมายหลังแก้

1. มี design system เดียวที่อธิบาย foundations, semantic tokens, component variants/states และ composition patterns ได้
2. Primitive แต่ละชนิดมีเจ้าของ styling/behavior ชัดเจน Consumers ใช้ public props/variants แทนสร้างรูปแบบใหม่หรือ override internals
3. Feature CSS ดูแล layout และรายละเอียดเฉพาะ domain; common field, toolbar, tabs, dialog, feedback และ picker ใช้ pattern กลาง
4. แบ่ง stylesheet ตาม responsibility และโหลดผ่าน entry เดียวที่มีลำดับชัดเจน ไม่ย้ายกอง CSS ไปหลายไฟล์โดยยังมี duplicate ownership
5. ปรับ token/component จุดเดียวแล้ว consumers ที่เกี่ยวข้องเปลี่ยนสอดคล้องกันจริง พร้อมรักษา theme, keyboard, native bindings และข้อมูลเดิม

งานนี้เน้นรวม architecture และ UX consistency หน้าตาหรือ workflow ใหม่ที่เกินจากการรวมระบบต้องแยก scope ให้ชัดก่อน implementation Full migration parity ยังเป็นข้อกำหนดเดิม

## โครงสร้างที่เสนอ

โครงสร้างนี้เป็นเป้าหมายของแผนจาก snapshot เดิม; สถานะไฟล์ที่สร้างหรือย้ายระหว่าง consolidation ให้ตรวจจาก source และ STATUS:

```text
src/lib/styles/
  index.css                 # import order ของ application
  tokens/
    foundation.css          # spacing, typography, shape, motion scales
    theme.css               # dark/light semantic colors และ surfaces
  base.css                  # reset, inherited fonts, native baseline
  shell.css                 # application chrome/navigation layout
  features/                 # layout เฉพาะ request/response/graphql/etc.
src/lib/components/ui/
  Button / Input / Select / Textarea / Field
  Checkbox / FilePicker / Tabs / SegmentedControl
  DialogShell / Modal
  Toolbar / Section / EmptyState / Feedback
  styles/                   # styles ที่ primitive/pattern เป็นเจ้าของ
```

ชื่อและจำนวน components ต้องอิง inventory ที่ใช้จริง ให้ขยาย component เดิมก่อนสร้าง abstraction ใหม่ หาก pattern ไม่ได้แชร์ behavior/structure จริง ให้คง scoped feature component ไว้พร้อมเหตุผล ไม่สร้าง component กลางที่ไม่มี consumers

## แผนดำเนินการตามลำดับ

### 1. ทำ ownership inventory และ baseline

- ระบุทุก primitive/pattern, consumer, variant, styling owner และ feature exception เริ่มจากตาราง A4 แล้วตรวจ bindings/events จริง
- จัดประเภท CSS: foundation, primitive, shared pattern, shell, feature layout และ compatibility bridge
- เก็บ baseline ของ saved theme/workspace scenarios ที่ widths 1440/900/760 และทั้ง light/dark ก่อนย้าย ตรวจ product behavior ที่ scenario ครอบคลุมจริง
- บันทึกข้อบกพร่องที่มีอยู่แล้วแยกจาก regression ของการย้าย เช่น R2 themed select เพื่อไม่ตีความ baseline pass ว่าไม่มีปัญหา

### 2. รวม foundations และ style entry

- กำหนด semantic mapping ของ theme, surfaces, border, text, spacing, type, radius, sizes และ interaction states
- ย้าย tokens ไป owners ที่ชัดเจน และใช้ compatibility aliases เฉพาะช่วงย้าย ระบุ consumers ที่ยังใช้และเกณฑ์ลบแต่ละ alias
- แยก styles.css ตามหน้าที่ผ่าน application entry เดียว รักษา cascade order ระหว่าง migration และตรวจ styles หลัง build
- เปลี่ยน feature literals ที่เป็น shared design values ให้ใช้ tokens; domain dimensions เช่น editor min-size หรือ graph geometry ต้องมีเหตุผลรองรับ

### 3. กำจัด primitive styling ที่ซ้ำ

- ทำ Button/Input/Select/Textarea ให้เป็นเจ้าของ surface, variants และ hover/focus/disabled/read-only/invalid states
- ตรวจและลบ rules เก่าที่ซ้ำหลังย้าย consumers ห้ามใช้ specificity หรือ `!important` เพิ่มเพื่อกลบ ownership ที่ชนกัน
- แก้ R2 svgArrow ในเจ้าของ Select เดียว พร้อมตรวจ picker และ native fallback
- Feature overrides ที่ยังจำเป็นต้องเป็น layout contract เช่น full-width, compact placement หรือ fill-parent ไม่เปลี่ยน colors/states ของ primitive เอง

### 4. ย้าย specialized controls และ fields

- Checkbox: checked/indeterminate, native change event, controlled value และ bindable value, disabled/invalid, label/help/error
- FilePicker: native file input, keyboard activation, accessible label, multiple/directory flags, file reset/reselect และ callbacks ที่เดิมใช้; validation/byte limits อยู่ที่ feature policy หรือ helper เดิม
- Field: stable IDs, label/required, description/error association, disabled/read-only/loading contract และ accessibility ในทั้งสองธีม
- ย้าย preferences/auth/request/cookie/resource/environment/Git forms ให้ใช้จริง ตรวจ form submission, event.currentTarget และ numeric bindings ไม่เปลี่ยนจาก native semantics

### 5. รวม repeated compositions และ dialog shell

- ย้าย editor/result tabs และ segmented choices ให้ใช้ component contract ร่วม Selected state/keyboard/ARIA ต้องเหมาะกับชนิด navigation และสัมพันธ์กับ panel ที่แสดง
- รวม toolbar, section heading, empty/error/loading presentation ที่มีโครงสร้างซ้ำ โดยคง domain actions/data ไว้กับ feature
- แชร์ dialog presentation/focus/Escape ผ่าน shell หรือ composition โดยรักษา prompt queue/abort และ recovery lock/confirmation policies รวมถึง focus restoration
- ย้ายทีละ workflow แล้วลบ markup/styles เก่าของ workflow นั้นทันที ไม่ทิ้งระบบเก่าและใหม่ให้เลือกใช้คู่กัน

### 6. ตรวจ adoption และปิด debt ด้วยหลักฐาน

- สแกน consumers และ CSS อีกครั้ง ทุก raw control/shared selector ที่เหลือต้องมี owner และเหตุผลบันทึกไว้
- แก้/รัน saved scenarios เดิมสำหรับ behavior เดิม แยก scenario ใหม่เฉพาะส่วนที่ไม่มี coverage ตามข้อยกเว้นที่เจ้าของอนุญาต ใช้ Bun เท่านั้น
- บันทึก actual check/build/scenario results และส่วนที่ยังไม่ตรวจลง STATUS ไม่อ้าง historical passes เป็น verification ใหม่
- อัปเดต UI README ให้ API, style ownership, extension rules และ examples ตรงกับ implementation หลังย้าย

## รายการงานที่ต้องติดตาม

| งาน                        | ปัญหาที่แก้                                       | ผลลัพธ์ที่ต้องตรวจรับ                                                                 |
| -------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| R2 — Select picker         | Dropdown หลุดธีมจาก specificity                   | Themed picker และ fallback ถูกต้องตาม engine; HTTP method/Response mode ผ่าน scenario |
| A1/A6 — CSS ownership      | Global/component rules ซ้ำและ import order ไม่ชัด | Entry เดียว, owner ชัด, ลบ declarations ซ้ำ                                           |
| A2 — Foundations           | Tokens/scales และค่ารายหน้าคนละชุด                | Mapping กลาง; เปลี่ยน token แล้ว consumers เปลี่ยนร่วมกัน                             |
| A3/A4 — Component adoption | สร้าง controls/fields/tabs ซ้ำราย feature         | Public contracts, consumers จริง และรายการข้อยกเว้นพร้อมเหตุผล                        |
| A5 — Dialog composition    | Presentation/focus/lifecycle เขียนแยก             | Shell ร่วม; prompt queue/abort และ recovery lock ยังถูกต้อง                           |
| Verification/documentation | มี components แต่ยังยืนยันความสอดคล้องไม่ได้      | Inventory หลังย้าย, saved scenarios, check/build และ README/STATUS ตรง source         |

สถานะทุกงานยังไม่ถือว่าปิดในเอกสารรอบนี้ ให้บันทึกหลักฐานของ implementation แยกจากข้อพบเดิม และทำเครื่องหมายผ่านเฉพาะเกณฑ์ที่ตรวจจริง

## Checklist สำหรับปิด debt

### Shared dialog backdrop ownership — 2026-10-10

Theme dialog-backdrop and foundation dialog-backdrop-filter now own the two remaining shared backdrop literals, retaining the existing tint and6px blur. Saved pre-fix override reproduction50492 failed; current design-system48320 accepts24 normal/compact/locked dark/light1440/900/760/480 profiles, application theme99740 accepts10actual dialogs and compiler27067 passes0/0. Production build8123/native theme34598 accept10mounted remote/cookie/branch/recovery profiles plus12retained workflow captures, default/override/filter:none/restoration, fonts/locked Escape/retry/unchanged HEAD. Independent current682/executable/results audit and owned cleanup pass. Exact source, artifacts, commands and limits: [UI-DESIGN-SYSTEM-DEBT.md#record-dialog-backdrop](UI-DESIGN-SYSTEM-DEBT.md#record-dialog-backdrop). Other literals/aliases, adoption/ownership, platform/browser fallback, accessibility and full UX/CSS/migration requirements remain open; the checklist below is unchanged.

### Shared dialog geometry ownership — 2026-10-08

Current dialog.css still hardcoded radius, normal/compact/recovery widths,
viewport gutter, height cap and shadow. Saved design-system reproduction failed
with an unchanged14px radius after a7px override. These seven metrics now live
in foundation.css and apply through DialogShell/Modal size variants. Defaults
remain the existing desktop geometry; recovery also honors the viewport gutter.
The shared headless fixture accepts24 dark/light1440/900/760/480 profiles across
all three variants, with exact overrides/restoration and Escape/focus/locked
lifecycle. Actual headless application dialogs pass in both themes. Fresh native
build/theme acceptance1791437863369 passes10 actual remote/cookie/branch/recovery
geometry profiles and12 existing workflow captures in both themes, with loaded
fonts, locked recovery/retry and unchanged Git HEAD. Exact release and process
handoff is in STATUS; other backdrop/typography/spacing,
workflow/platform/alias/debt/full migration/UX gates remain open.

### Dense-caption and picker typography audit — 2026-10-08

Capability555b317 moves all5 hardcoded9px caption declarations (save/version,
search shortcut, GraphQL columns and shared count badges) to foundation
font-size-9. Select picker uses font-size-12/1.5 rather than a separate12px
shorthand. Old native failures reproduce both missing token contracts; static
headless themes1440/900/760 and current production native theme1791413525045
accept default sizes, token override/restoration for all matching captions and
actual ::picker(select), including both GraphQL columns/all Git count badges.
Existing native workflows/HEAD preservation and images pass; see STATUS.
Current font-pixel scan across styles/components leaves20px/48px on brand image
fallback typography. Those image-specific declarations are retained; this audit
does not close remaining spacing/geometry/aliases/workflow/platform/full debt.

### Current source audit — 2026-10-07

The earlier single-entry claim was contradicted by `+page.svelte`: it imported both `styles.css` and the standalone `ui/controls.css`. The second import and both obsolete wrapper entries (`ui/controls.css`, unused `ui/button-config.css`) are now removed. Application styling follows `styles.css` → `styles/index.css`; the saved component fixture already uses that same ordered entry. Compiled application CSS decreased from 57,787 to 54,038 bytes. This size comparison is supporting evidence of the removed entry, not visual acceptance by itself.

TabButton now owns selected presentation from aria-selected, with ten redundant consumer expressions removed. Saved design-system reproduction failed before this fix and passes afterward, including string/boolean selection, horizontal/vertical keyboard behavior and accent/selected token propagation. The original scope and the remaining checklist are unchanged.

All twelve feature/editor scoped style blocks were inspected. Their remaining ownership boundaries and concrete follow-up are:

| Scoped owner | Retained responsibility / remaining work |
| --- | --- |
| CodeEditor | CodeMirror engine DOM, syntax, completion/lint/documentation popup placement. Editor/lint font uses font-size-12; information radius uses radius-group; information/lint shadows use editor-popup-shadow. Completion popup/option padding follows space-2/space-4 and editor-completion-shadow preserves upstream2/3/5/.2 (1a73fad); current native GraphQL17 accepts network-schema and local-SDL dark/light overrides/restoration with unchanged defaults. Retain engine placement/max bounds, relative90% completion font and3/2px completion radii as upstream adapter geometry; this does not close every editor interaction/platform/debt gate. |
| GitPanel | Change/history/commit graph layout and selection of domain rows. Graph geometry and row layout retained; redundant button-radius declarations removed and mono status follows font-size-11 (c4ad941). Current native Source Control1791412051562 passes14 groups, including default11px/0px and token14px/7px propagation/restoration in both themes plus existing workflows/widths. This accepts these ownership changes; full CSS/debt/workflow acceptance remains open. |
| GitRecovery | Shared Field inline align=start now owns wrapped checkbox alignment/dimensions; feature gap/top margin retained. Dark/light shared geometry and native locked-dialog/retry pass. Actual retained-copy OS picker and reviewed-choice workflow acceptance remains open. |
| GitRemotePanel | Remote sections and bounded advertisement list layout; no primitive interaction override found. |
| GrpcPane | Method placement, response log/time/metadata layout. Hints use shared compact Feedback; message typography now follows font-size-12/font-mono, native token propagation/dark-light streaming acceptance passes. |
| KeyValueEditor | Multipart details margins now use foundation tokens with original3/9/24/6px sizes. Removed block override of shared Field inline/stacked layout; actual native checkbox/input layout and byte/metadata Send accepted. Feature retains only details placement/cursor responsibility. |
| OAuthEditor | Token panel/action layout and long-text wrapping; retain domain layout. |
| ProtoManager | Proto tree/source/preview/remove-confirm layout. Fixed scoped layout reaching shared Button (native flexGrow0 before,1 after); removed redundant background/border and adopted compact Feedback. Fresh native full-surface hover/source/removal acceptance passes. Baseline hover already passed; no reproduced hover defect claimed. |
| ResponsePane | Filter-row sizing and history placement; only control layout overrides found. |
| RunnerPane | Suite/test/result layout and domain pass/fail colors. Duplicate test-list flex removed; retained shared list/results sizing and domain Field/Select placement. Native runner lifecycle/Stop/reload/fresh run/dark-light widths pass. |
| RunnerSidebar | Suite row layout and parent selection surface; redundant zero button-radius declaration removed. Native runner lifecycle and both themes/widths pass. |
| SettingsPanel | Settings view, sidebar, section/grid layout; selected tab presentation is now shared, sidebar width remains a domain layout contract. |

Next implementation order for this debt: remaining token/literal/unused declaration cleanup, then remaining interaction/validation/native workflow coverage. Keep CodeMirror and domain graphs/tables as explicit adapters rather than forcing them into generic primitives. Native acceptance is tracked in STATUS; full migration priority also includes the missing selected Git restore UI.

2026-10-07 evidence update: current application has one ordered style entry (`src/lib/styles.css` → `styles/index.css`) and the shared-control consumer inventory/API/ownership is now recorded in `src/lib/components/ui/README.md`. Static scan finds only CodeEditor's engine-owned textarea as raw form/button markup outside `ui`. Current `bun tests/ui/design-system.js` passes shared field associations, numeric/checkbox bindings, file reselect and dialog/tab contracts. Settings theme/workspace scenarios also pass. Historical counts above remain the original review snapshot. Scoped feature CSS audit, remaining token/alias cleanup and broader native/workflow acceptance remain open; do not mark all checklist items complete from these narrower checks.

- [ ] มี inventory และ owner สำหรับ tokens, primitives, compositions และ feature exceptions
- [ ] Application style entry มีลำดับชัดเจน; styles ของแต่ละส่วนอยู่กับ owner ที่ตรงหน้าที่
- [ ] ลบ shared control declarations ที่ซ้ำกับ legacy/global styles และไม่มี variant colors/states ที่ feature แอบกำหนดเอง
- [ ] Checkbox/file picker/fields/tabs/dialog patterns มี public contract และ consumers จริงครบตาม inventory หรือ exception ที่อธิบายได้
- [ ] การปรับ shared token/component จุดเดียวมีผลกับ consumers ที่เกี่ยวข้องโดยไม่ต้อง patch รายหน้า
- [ ] Theme/width, keyboard/focus/Escape, validation/help/error, file reselect, checked/numeric bindings และ modal lifecycle ผ่าน saved scenarios ที่ครอบคลุมเรื่องนั้น
- [ ] `bun run check` และ `bun run build` ผ่าน; native acceptance สำหรับส่วนที่แตะ Tauri behavior มีหลักฐานตรงกับ build ที่ทดสอบ
- [ ] ไม่เหลือ scaffolds ที่ไม่มี adoption, obsolete CSS หรือ compatibility aliases ที่พ้นช่วงย้ายแล้ว
- [ ] UI README และ STATUS ตรงกับ source และระบุ remaining gaps โดยไม่ทำเครื่องหมาย full migration complete

2026-10-08 Select geometry evidence: shared select.css now consumes five foundation
tokens for picker/option radius, chevron offset and picker cap/viewport limit,
preserving10/6/9px/360px/60vh defaults. Actual old-CSS radius override fails10vs7;
saved headless6/current native6 dark/light1440/900/760 profiles check five mounted
controls each with all overrides/tighter viewport/restoration. Current native
release1791442836440/1791443403642/result0/evidence1791443414373 also accepts12
workflows/10 dialogs/fonts/locked recovery/unchanged HEAD, terminal0/hidden/exit0.
UI README records token ownership/API. These computed CSS metrics do not close
all popup/fallback/platform/adoption/interaction/alias/literal/full-debt gates;
the broader checklist remains open. Exact evidence and handoff in STATUS.

## การตรวจในงานบันทึกเดิม

อ่าน source ของ shared primitives, styles และ feature consumers; ใช้ `rg` และ inline `bun -e` เพื่อทำ markup inventory ไม่มีการแก้ source, สร้าง components, เปลี่ยน CSS, รันทดสอบ UI หรือ build ใหม่ ตัวเลขและตำแหน่งเป็น static snapshot ไม่ใช่ usability measurement

ก่อน implementation ต้องอ่านเอกสารทางการและบันทึก commands/references ตาม AGENTS.md แหล่งอ้างอิงที่เปิดอ่านระหว่างเตรียมแผนนี้:

- [Svelte bindable props](https://svelte.dev/docs/svelte/$bindable)
- [Svelte style directives](https://svelte.dev/docs/svelte/style)
- [CSS import order](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@import)

ห้ามใช้ browser-use หรือ ad-hoc browser automation การตรวจ UI ต้องใช้ saved Playwright JavaScript scenarios/helpers ตาม [POST-MIGRATION-UX.md](POST-MIGRATION-UX.md) และ AGENTS.md

## Shared focus ownership checkpoint — 2026-10-08

2026-10-08 shared focus surfaces: owner outline-free policy retained. One focus.css owner and six semantic theme tokens centralize native/shared surface and valid-control border feedback, primary/Send/secondary/danger variants, visible file wrapper and URL composition. Hover and selected vertical-tab styling no longer override keyboard focus; invalid borders preserved. Headless design-system12 horizontal/vertical dark/light1440/900/760 profiles ×18 enabled controls verifies combined hover/focus/default/six overrides/restoration/no outlines/shadows/geometry change, with existing field/file/tab/dialog contracts. Actual headless application theme85167 passes unchanged no-outline URL contract. Production release1791460819509/1791461231950/result0/hash14143658787539048835/native1791461477780 accepts18 actual Preferences/HTTP URL/Cookie focus profiles with exact full workspace guards, plus12 workflows/10 dialogs/6 Button/6 Select/12 form geometry profiles/fonts/author validation/locked recovery/unchanged HEAD. Compiler66452 terminal0/0errors0warnings, format/diff pass; native-hidden/native43356exit0/no live handles, dark/light760 URL PNGs inspected. This does not close full UI debt/WCAG/high-contrast/native picker/OS/provider/platform/full migration gates. Original owner no-outline source, superseded failures and exact handoff in STATUS.


</details>

<a id="record-ui-inventory"></a>

<details>
<summary>UI-INVENTORY</summary>

## Current certificate UI source inventory — 2026-10-13

Source hash01f03cd56053f354707c98417e20de8ae1cd9cf299d6bab7a2909223063231bc:65Svelte/745shared markup sites/119tokens/1894CSS declarations. Counts, CodeEditor raw-textarea exception, single Feedback dynamic owner and18feature scoped styles remain unchanged; no duplicate CSS imports or multi-owner tokens. Exact consumer CSS/normalgeometry and saved222 headless/fullshared/compiler/build acceptance are documented in TLS.md#record-certificate-picker-root-acceptance. Source inventory does not close OS/AT/platform/fullworkflow/debt/migration scope.

## Current production source inventory — 2026-10-13

Saved AST inventory script completed0 against current source44ecea959aa84ac4ce6836abc3a1aad4d5c5528ecc6424222a15ae268cec2e2a:65 Svelte files,745 shared markup sites,119 tokens and1894 CSS declarations across18 feature scoped style files. No duplicate CSS imports, multiple-owner token files or tokens without var references. The one feature raw control is CodeEditor's native textarea (line575), retaining its editor/fallback engine contract; Feedback owns the single dynamic element. Optional --focus-danger-text has the documented on-danger fallback; ResponsePane's --method- dynamic family remains explicit.

Evidence: artifacts/ui-current-root-inventory-20261013/{report.json,execution.json}. The original scripts/ui-inventory.js ran in an artifact copy with only its output directory changed; exact reverse comparison preserves all AST inventory logic and the older inventory report. Static launch inspection also finds only the shared launchUiBrowser chromium.launch with fixed headless:true, plus native-app's CDP attachment after hideOwnedWindow. No headed override was found in saved tests/scripts. These are source checks, not new runtime/OS/AT acceptance. No product/style edits, browser/native launch or rebuild. Remaining property-level CSS ownership, validation/lifecycle/keyboard/platform/fullworkflow and all original migration/UX gates stay open.

# Current shared UI source inventory

2026-10-09 FilePicker concurrency fix: current sourceSHA256
63fe2aa95337d367e20931144143646ae9d7228e4d8536158794cd308f8b8000.
Counts remain664shared/117tokens/1718declarations; no styling ownership change.
Exact acceptance and limits: [UI-DESIGN-SYSTEM-DEBT.md#record-file-picker-concurrency](UI-DESIGN-SYSTEM-DEBT.md#record-file-picker-concurrency).
Older source inventories below are historical.


2026-10-09 unused internal tokens: removed declaration-only code/font-size-14/space-30
(four declarations across theme/foundation). Current sourceSHA256
e15f0182538b7592d0946bfe335976989466235bee72a25479379dc7ab63d6ce:
117tokens/1718declarations, unused-var candidates0. Adoption/import/owner/raw
exception/dynamic-reference inventory unchanged; optional focus-danger-text
fallback remains visible. Compiler0/0, build0 and saved full design-system71649
terminal0/passed including66 filled foreground rows. Exact scope and remaining
gates: [UI-DESIGN-SYSTEM-DEBT.md#record-unused-ui-tokens](UI-DESIGN-SYSTEM-DEBT.md#record-unused-ui-tokens). Older source inventories below
are historical; full UI debt/migration remains required.


2026-10-09 filled foreground source inventory: sourceSHA256
60e841406d173995f8247dc7109c78fba7770945eae3d858cf4a375d8c2e8fbe,
57 production Svelte files/664 shared markup sites/14 feature scoped style files/
120 tokens/1722 CSS declarations. No multiple-owner token files or duplicate
local CSS imports. Unresolved --focus-danger-text is intentionally optional with
an explicit on-danger fallback, retained visibly in the report; three no-var
reference candidates and dynamic method colors remain. Runtime evidence/limits:
[UI-DESIGN-SYSTEM-DEBT.md#record-filled-foreground](UI-DESIGN-SYSTEM-DEBT.md#record-filled-foreground). Older inventory entries below are historical.


2026-10-09 form content media help: current sourceSHA256
`8c0c26467da06652318db79b0e42a55d39011ba59c27f9f20baa87b58af63829`.
Existing KeyValueEditor linked Feedback/grid now explains JSON/text form content.
Counts remain663shared sites/118tokens/1719declarations; no CSS owner changes.
Headless6 profiles/42 help rows pass; native acceptance remains tracked in
STATUS/API-DESIGN.md#record-openapi-form-content. Earlier hashes are historical.

2026-10-09 explicit form help: UI source SHA256
`9de439001ad6449ee61015114c28eae0fabf6e2a9819cf2cd93374f9eda02cfc`.
KeyValueEditor reuses its existing linked Feedback/help grid for generated form
rows and supplies destination-specific guidance. Counts remain663 shared sites/
118 tokens/1719 declarations; no CSS ownership or declaration changes.
Headless6 profiles/36 help rows pass; current native acceptance is tracked in
STATUS/API-DESIGN.md#record-openapi-form-body. Earlier inventory snapshots remain historical.

2026-10-09 raw binary body editor: source SHA256
`16ec60b7d991920a1a24bdef929c4a515b132e2b2f759da2e3df88d18fa2487c`.
The existing binary picker is reused; one shared Feedback displays its retained
Content-Type. Counts are663 external shared sites/118 tokens/1719 declarations,
with no CSS changes. Runtime build/scenario acceptance is tracked in STATUS and
API-DESIGN.md#record-openapi-binary-body; the earlier compact snapshot remains historical.

2026-10-08 final compact feedback source: SHA256 `a5dfa28c0bcfad8067157dd458a3c87cd0518641ee3e2daa3f774edaf0fa56e3`.
The explicit compound-hint separator adds no markup/style/token declarations;
counts remain662/118/1719. Earlier compact snapshot below is historical; final
native acceptance uses a fresh source build recorded in STATUS.

2026-10-08 compact feedback ownership, base `542c30c`: source SHA256
`78e101c491bee44b87299d9ddb3658bafab3f92dd739285aff05046f431ee136`.
Counts remain662 feature shared sites/118 tokens/1719 declarations. Field now
uses Feedback internally for SMALL description/error messages, so external
consumer counts do not change. One compact margin declaration replaces one
redundant Field line-height declaration. Feedback dynamic presentation now
includes small as well as p/pre/div/li. Runtime acceptance is tracked in STATUS.

2026-10-08 final reserved-help layout, base `3550494`: source SHA256
`345e4e9a6c39955ba672864a5cb9b3a44ac6e7b2ba776badea737aa9091df599`.
There are662 shared sites/118 tokens/1719 CSS declarations. Six additional
feature layout declarations keep help in the Value grid column and continue its
divider; ordinary/multipart controls retain their row layout. Prior snapshot
hashes/counts below are historical; runtime acceptance stays in STATUS.

2026-10-08 query reserved-value help, base `3550494`: refreshed source audit
SHA256 `16d142f2854f46b80e140fd23e3099663605486c616b3f648c47a3ba9e83ffe0`.
KeyValueEditor adds one conditional shared Feedback site:662 shared markup
sites across57 Svelte files,118 tokens and1713 CSS declarations. Existing
exceptions/debt/import-graph gates remain unchanged. Runtime help acceptance is
tracked in STATUS/OPENAPI-ALLOW-RESERVED; this audit is source evidence only.

2026-10-08 query delimiter correction, base `14535e9`: refreshed audit accepts
source SHA256 `159e4f6db0ca9d95a0039de4491894bb6925cc9084fd9f800fcfa69bafbd4056`.
The change is in query serialization; shared markup remains661 sites, tokens118
and CSS declarations1713. Previous snapshot hashes below remain historical.

2026-10-08 hover-border update, base `7b614af`: controls.css owns generic and
Select-shell hover borders with low-specificity eligibility; variants.css retains
only the shell hover surface. Re-running the same audit yields 1,713 declarations
and source SHA256 `d43de90766af4839561b03e6817a96e81550312c763a69897c5408056bd99572`.
All adoption, token, import-graph and exception counts below remain unchanged.
The previous snapshot's 1,714 declarations/hash below are historical evidence.

2026-10-08, production source at `56aed5e`. This replaces the old markup counts
for planning; the historical design-system debt report remains an accurate record
of its earlier snapshot.

Run `bun scripts/ui-inventory.js` from the repository root. The command uses
[Svelte compiler parse/parseCss](https://svelte.dev/docs/svelte/svelte-compiler)
with the modern AST and writes `artifacts/ui-inventory/report.json`. It parses
all 57 production Svelte files, follows imported shared component aliases, and
counts template sites rather than imports, comments, script strings or rendered
instances. Repeated/conditional markup counts once per source site. Internal
primitive compositions are recorded separately from feature consumers.

Accepted source SHA256:
`734cfee8ef5a4359797efd8288db718604ed070da4a337de9eae84eb3bbe3a3f`.
Svelte compiler `5.57.1`; 661 shared markup sites outside the UI directory.
The JSON includes each consumer path/line and primitive owner so subsequent
changes can be evaluated against actual adoption.

| Shared component | Feature sites | Consumer files |
| ---------------- | ------------: | -------------: |
| Button           |           204 |             29 |
| Checkbox         |            27 |             11 |
| DialogShell      |             7 |              7 |
| Dropdown         |             2 |              1 |
| EditableName     |             1 |              1 |
| EmptyState       |            16 |              9 |
| Feedback         |            42 |             22 |
| Field            |           132 |             24 |
| FilePicker       |            12 |              8 |
| FormPanel        |             7 |              4 |
| Input            |            82 |             24 |
| Modal            |             2 |              2 |
| SegmentedControl |             2 |              2 |
| Select           |            49 |             19 |
| SplitPane        |            10 |              7 |
| TabButton        |            10 |              6 |
| TabList          |             9 |              6 |
| TabPanel         |             9 |              6 |
| Textarea         |            19 |             14 |
| Toolbar          |            16 |              9 |
| UnifiedDiff      |             2 |              2 |
| WindowControls   |             1 |              1 |

## Native markup and exceptions

The sole feature-level native control is `CodeEditor.svelte:393`, its textarea
backing/fallback for CodeMirror. It binds the native element used by the editor,
preserves value/readOnly/input behavior and renders when editor initialization
fails. Replacing it with an ordinary field is not adoption work. UI primitives
own the other native input/select/textarea/button/dialog sites, including
EditableName's display button and DialogShell's native dialog.

The sole `svelte:element` site is Feedback, with the documented p/pre/div/li/small
presentation contract. This is a presentation exception, not a missing input
primitive. Counts do not prove label associations, keyboard behavior, domain
validation, imported-state compatibility or runtime focus behavior.

## Styles and tokens

The application has one local CSS entry import in `+page.svelte`:
`$lib/styles.css`, forwarding to `styles/index.css`. Its graph has 30 files
including the two entry wrappers; all local imports resolve, with no cycles or
duplicate file imports. The JSON records ordered traversal. Foundation and
theme load before base/native/common, feature/shell styles, form/navigation/
control/select/dialog/file/toolbar/empty/variant/focus/diff owners.

`editor-engine.js` separately imports five CodeMirror vendor stylesheets: core,
dialog, foldgutter, show-hint and lint. These belong to the editor integration;
they are not a second application control stylesheet. Package CSS and runtime
CodeMirror injected rules are outside this local stylesheet graph.

The stylesheet ASTs contain 1,714 declarations and 118 custom properties. No
custom property has definitions in more than one source file; dark/light values
within theme.css are expected. The report retains each declaration and value.
No unresolved complete literal var() name was found. ResponsePane assembles
`--method-` names dynamically with a syntax-keyword fallback; the audit records
this separately instead of reporting a partial name as undefined.

Twelve properties directly reference another token. They express shared metric
or semantic ownership: button-gap, control padding, dialog gutter, Field gaps,
focus surfaces/border and Select arrow offset. Their consumers are recorded;
these links are not automatically obsolete compatibility aliases.

Three properties have no literal production var() reference: `--code`,
`--font-size-14`, `--space-30`. These are cleanup candidates. This audit cannot
prove absence of external overrides or dynamically constructed uses; it does
not delete public scale/theme properties or claim runtime CSS reachability.

Fourteen feature components still own scoped styles:

| Feature files                                        | Intended responsibility to retain; review remaining declarations individually |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| ClientCertificates, SettingsPanel, OAuthEditor       | Certificate/settings/auth layout and feedback placement                       |
| CodeEditor                                           | Editor integration, fallback and completion presentation                      |
| GitPanel, GitPushReview, GitRecovery, GitRemotePanel | Source Control lists, review/remote/recovery layout and domain states         |
| GrpcPane, ProtoManager                               | Protocol/schema/message layout                                                |
| KeyValueEditor                                       | Editable row/list layout                                                      |
| ResponsePane                                         | Response viewers and metadata layout                                          |
| RunnerPane, RunnerSidebar                            | Runner result/tree layout                                                     |

This table identifies the review owners. It does not certify every scoped rule
as necessary or nonduplicated. Primitive surfaces/fonts/states and repeated
shared metrics still require property-level review against their shared owners.

## Acceptance and remaining work

`bun scripts/ui-inventory.js` completes successfully against all production
markup and stylesheet ASTs. `bun run check` returns zero errors/warnings;
formatting and diff checks pass. No application source/style/backend changes,
new dependency, browser launch or native rebuild is involved in this inventory.
Historical runtime evidence remains in STATUS/UI-TESTING and is not rerun or
presented as new runtime acceptance here.

Next review should use the report's declaration/consumer list to resolve
remaining feature literals and scoped primitive overrides, then verify changed
owners through the existing saved headless/native scenarios. Public contracts,
validation/keyboard interactions, OS dialogs, themes/fallback widths, workflows
and whole-debt completion remain open. All original PLAN/PARITY migration gates
remain required; this inventory does not narrow or complete the migration goal.


</details>

<a id="record-unused-ui-tokens"></a>

<details>
<summary>UNUSED-UI-TOKENS</summary>

# Unused internal UI tokens

2026-10-09, base `0ab97fe`. Removed `--code` from both themes and
`--font-size-14` / `--space-30` from foundation. AST inventory and source/tool/
scenario search found declarations only; the dynamic method-color family is
unchanged. Syntax colors retain their existing `--syntax-*` tokens.

The final source diff removes four declarations. An initial line-ending change
was corrected before saved acceptance. No replacement aliases or unused scale
entries were introduced. These removals cover internal application consumers;
they do not certify unknown external CSS consumers.

Validation: `bun run check` terminal exit 0, zero errors/warnings;
`bun run build` terminal exit 0; saved `bun tests/ui/design-system.js` handle71649
terminal exit 0, result passed, including six theme/width foreground profiles
(66 rows) and retained Field/form/keyboard/control contracts.

`bun scripts/ui-inventory.js` now reports 117 tokens and 1718 declarations,
with no unused-var candidates. Independent before/after audit verifies only
three token names/four declarations disappeared; Svelte/shared adoption/raw
control exceptions/feature scoped ownership/import graph/dynamic method sources
and optional fallback references are unchanged. Source SHA256:
`e15f0182538b7592d0946bfe335976989466235bee72a25479379dc7ab63d6ce`.

Artifacts: `artifacts/playwright/unused-token-baseline-inventory.json`,
`unused-token-final-audit.json`, current `artifacts/ui-inventory/report.json`
and saved design-system outputs. Native scenarios were not rerun for these
unused declarations; no fresh native or cross-platform acceptance is claimed.
The preceding native filled-foreground acceptance remains historical evidence
for its own frozen source, not acceptance of this source hash.

This closes the three unused-token candidates from the previous inventory.
Property-level duplicates/literals, compatibility aliases, shared compositions,
full workflow/platform checks and every remaining PLAN/PARITY requirement stay
required. It does not close the complete UI debt checklist or migration goal.


</details>
