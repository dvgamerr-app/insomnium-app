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
