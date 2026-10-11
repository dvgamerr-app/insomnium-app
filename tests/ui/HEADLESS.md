# Playwright execution policy

All saved browser scenarios use `launchUiBrowser` from `helpers/preview-app.js`, directly or through `withPreview` / `withComponentFixture`. The launcher fixes `headless: true`; it accepts no launch options or headed override. `INSOMNIUM_EDGE_PATH` only selects the browser executable.

Native Tauri scenarios use `withNativeApp`. WebView2 is attached through CDP after `hideOwnedWindow` has hidden the exact owned process window. Results report `renderingMode: "native-hidden"` and the hidden window state. This is distinct from launching a headless browser.

Verification on 2026-10-11:

- Source scan of saved JavaScript scenarios/helpers in `tests` and `scripts`: the only browser launch is the shared headless launcher; the only CDP attachment is the native helper. No `headless: false`, headed launch or persistent browser context found.
- `bun tests/ui/plugin-dom-dialog.js`: exit 0, ten saved UI lifecycle groups pass through the shared headless launcher. Evidence: `artifacts/playwright/plugin-dom-dialog/result.json`.
- Native hiding order and `native-hidden` reporting checked in source; no new native run is claimed by this verification.

Run saved scenarios with Bun. Do not use interactive browser tools or ad-hoc automation.
