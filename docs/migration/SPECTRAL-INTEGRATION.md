# Spectral integration investigation — 2026-10-12

Latest measured direction: [SPECTRAL-HOST-DESIGN.md](./SPECTRAL-HOST-DESIGN.md). An isolated93,478,400-byte Windows Bun executable now proves12 successful default/custom/reference/parser/version/fallback executions plus entered-operation kill/reap and a clean subsequent job. It runs without a local Spectral package installation in its owned runtime directory. These architecture measurements supersede the earlier unresolved host feasibility question; native/app/platform/full semantic integration remains missing. Earlier browser CSP failures and their source/results stay immutable.

API Design currently uses generated structural validators in openapi-validation.js and an owned 15-second module worker; Spectral/default semantic rules and custom rules are still missing. This review keeps that complete requirement active. No app dependency, CSP, permission or production source changes.

## Legacy and official contract

Read-only archived insomnia/src/main/ipc/main.ts109–135 runs Spectral with the OAS ruleset, or loads the owning Git repository other/.spectral.yaml through bundleAndLoadRuleset; custom load failure falls back to OAS. design.tsx99 onward maps rule severity/message/range into clickable source diagnostics. This includes custom rule functions and file/remote resolution; supporting only static structural validation cannot close it.

Official [Spectral JavaScript API](https://raw.githubusercontent.com/stoplightio/spectral/develop/docs/guides/3-javascript.md) documents Spectral/Document, parsers, OAS object rulesets and custom loaders/resolvers. [Vite library build](https://vite.dev/guide/build.html#library-mode) supplies the documented bundling path used in this isolated review.

## Measured constraints

Installed only in ignored artifacts/spectral-browser-spike with Bun exact/ignore-scripts: spectral-core1.24.0, parsers1.0.5, rulesets1.23.0. App package/lock unchanged. Actual official API in Bun returns six expected semantic diagnostics for the same owned OpenAPI3.1 document: server/contact/info-description/operation-description/operation-ID/tags. This is one document, not full engine/version/custom-rule parity.

Saved headless module-worker scenario uses actual tauri.conf production CSP unchanged and terminates the worker after observation. Default Bun browser bundle builds but its UMD parser dependency fails dynamic require before lint. Documented Vite bundle resolves that; library mode requires explicit production NODE_ENV before browser execution. The final4.64MB Vite bundle then fails in Ajv Function compilation with an actual EvalError because script-src self/wasm-unsafe-eval does not permit JavaScript string evaluation. Exact failure is line19940; diagnostics never start. Initial app-bootstrap inline-script probe is a fixture-policy mismatch, preserved separately; final probe serves a pure owned document, avoiding confusion with Tauri injected script hashes.

Source/lock/bundle/config/actual results frozen in artifacts/spectral-browser-spike/proof/manifest.json. Earlier UMD/environment/bootstrap negatives remain separate. No network or user-spec inputs loaded in the browser probe.

## Next implementation gates

1. Preserve current cancellation/source identity, structural generation and attached-reference behavior. Add actual semantic diagnostics, severities/ranges and source navigation through the same worker lifetime.
2. Measure a build-time validator/query compilation path for trusted static rules. Spectral validates function schemas dynamically and Nimma compiles queries; fixing only one Ajv call cannot prove runtime compatibility. Custom rules/functions/ref loaders still need equivalent behavior under the application execution model.
3. If a complete CSP-compatible browser execution path cannot retain the official API, evaluate an owned bounded Bun host process with explicit resource/ref services and cancellation instead of changing CSP. The current test proves direct dependency adoption is insufficient; it does not select or implement that alternative.
4. Verify default rules/version/dialect, custom rules/functions/extends, error fallback, file/remote resolution and owned Git ruleset round-trip, cancellation/deadline/stale-source/privacy/native/platform behavior with saved scenarios before accepting full Spectral migration. Legacy fallback semantics and all original parity remain required.

Commands: bun add --exact --ignore-scripts (three packages above) inside the artifact directory; bun x --bun vite build --config artifacts/spectral-browser-spike/vite.config.js; set INSOMNIUM_SPECTRAL_BUNDLE to artifacts/spectral-browser-spike/vite-production-bundle/spectral-worker.js and run bun artifacts/spectral-browser-spike/saved-browser-csp.js. All review processes terminal. `/compact` unavailable; explicit handoff.
