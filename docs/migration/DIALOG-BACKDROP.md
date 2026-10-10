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
