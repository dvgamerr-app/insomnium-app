# Shared tab panel keyboard entry

Text-only tab panels previously had no keyboard entry point. Merely adding tabindex failed because their shared CSS used display:contents, which has no focusable box. TabPanel now defaults to tabindex0, accepts an explicit numeric override and uses a column flex box with flexible sizing and zero minimum dimensions. Child editor/response scrolling and the existing common focus surface remain the owners of their behavior/presentation.

Consulted before implementation: [W3C APG Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/), keyboard interaction and note4. It recommends a tab stop when a panel has no focusable content or starts with meaningful non-focusable content. Existing subsystem reused; no generator/dependency needed. The shared change applies to request, response, API Design and gRPC panel callers.

Commands:

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
