# Legacy DEFAULT_HEADERS built-in hook

Plugin inventory exposed a missing built-in behavior: rendered environment DEFAULT_HEADERS should add missing headers before transport. The shared Send path now applies this after detached request/environment rendering and disabled row removal, before automatic OAuth/transport composition. Saved resources remain unchanged. Template preview and explicit manual OAuth rendering do not run this Send hook; browser-preview Send does. No native backend, CSS, dependency or generator changes.

Source contract: archived plugins/index.ts getRequestHooks, context/request.ts, common/misc.ts filterHeaders and common/render.ts. Own keys retain order; existing request names win case-insensitively, including duplicate rows. The exact string null omits a default only after the existing-header check, so it never removes an explicit request header. Other values remain literal for existing transport conversion. Disabled rows are removed first, allowing a default to supply that name. A shared name index avoids repeated scans.

Consulted before implementation: [MDN Headers](https://developer.mozilla.org/en-US/docs/Web/API/Headers) for HTTP name matching and transport restrictions. This hook reproduces inspected legacy ordering rather than replacing the application's transport header list with a browser Headers object.

Direct14 assertions passed before index refinement. Final16 differential cases use the extracted actual legacy hook body with controlled request-context callbacks: absent/falsy/empty defaults, explicit duplicates/case precedence, string-null omission, zero/false/empty/actual-null values, case-colliding defaults, literal template output, arrays/string/number input. Result/hashes: `artifacts/playwright/default-headers-differential.json`. This is bounded helper evidence, not every malformed-header/provider case.

```powershell
bun run check
$env:LIBCLANG_PATH='E:/.dvgamerr-app/insomnium-app/artifacts/tools/llvm-20.1.8/bin'
Remove-Item Env:INSOMNIUM_UI_LOW_MEMORY -ErrorAction SilentlyContinue
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_TEMPLATE_DEFAULT_HEADERS='1'
Remove-Item Env:INSOMNIUM_TEMPLATE_OAUTH -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_OAUTH_GRAPH -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_CYCLES -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_SSE -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_ENVIRONMENTS -ErrorAction SilentlyContinue
bun tests/ui/template-response-send.js
Remove-Item Env:INSOMNIUM_TEMPLATE_DEFAULT_HEADERS
bun tests/ui/template-response-send.js
```

Production build24148 exited0 (started1791623121853/finished1791623573225), SHA256 `f7c8655031ecc4030071678cd50f99e33e4697a77f3e72b5ee46a5e5889f834f`. Binding verifies469app/235scenario704paths/probe identity/preserved9fc6a4b7 baseline under `artifacts/native-default-headers-baseline`. Source freeze: `artifacts/playwright/default-headers-source-freeze.json`. Only shared request-render integration/new helper/saved scenario changed from the prior accepted application.

First native artifact1791623588057 failed the expected caller default: the fixture's original env_trs belonged to the foreign collection. Corrected only the scenario after terminal, adding caller Base environment and updating the original foreign Base separately. First-run freeze is preserved as default-headers-first-run-freeze.json; unchanged application/executable verified before refreshing the scenario hash. Native69248 exited0; failed result retained. Final compiler2965 exited0/zero errors/warnings; formatting/diff checks pass.

Final defaults7798/artifact `artifacts/playwright/template-default-headers-1791623651139` exited0/passed3groups/4wire/5workers; native57656 exited0/native-hidden/visible:false. Independent default-headers-audit.mjs checks704source/executable/baseline, direct/absent/foreign literal headers/body/base64, explicit/sentinel precedence, disabled replacement, scalar values and caller/foreign Authorization scope, unchanged saved request headers/descriptions, four durable histories and UI selection.

Same-build ordinary response-template regression68709/artifact1791623681673 exited0/passed19groups/20wire/43workers plus held dependency; native70288 exited0/native-hidden/visible:false. The original audit is preserved; default-headers-http-audit.mjs uses the current freeze. Its copied hardcoded source-count metadata was corrected to derive704 from the verified hash maps. Literal extraction/refusals/trigger/nested/foreign/Cancel/stopped-worker checks pass. Current frontend saved headless workspace12 passed. All three exact owned PID/profile process sets are absent, recorded in `artifacts/playwright/default-headers-cleanup.json`; no live feature handles.

This accepts the covered built-in HTTP Send behavior, not arbitrary custom plugins or all protocol/auth/provider/platform cases. Custom discovery/store/hooks/actions, malformed/non-string header interoperability, assistive/platform/shared adoption/ownership and every original migration/UX/CSS gate remain required. See [PLUGIN-COMPATIBILITY.md](PLUGIN-COMPATIBILITY.md).
