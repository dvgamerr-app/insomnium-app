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
