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
