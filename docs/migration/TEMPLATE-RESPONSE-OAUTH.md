# Dependent response OAuth exchanges

OAuth mode in the existing saved template-response-send scenario runs real mounted Windows UI Send, bundled workers, native OAuth token exchange and Rust resource transport against controlled local endpoints. Synthetic owned credentials/tokens are used. It preserves application/CSS/backend and shared native-hidden setup; browser scenarios remain headless:true.

```powershell
bun run check
$env:INSOMNIUM_TEMPLATE_OAUTH='1'
Remove-Item Env:INSOMNIUM_TEMPLATE_CYCLES -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_SSE -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_ENVIRONMENTS -ErrorAction SilentlyContinue
bun tests/ui/template-response-send.js
```

Five groups cover foreign collection Base environment credentials/scope, client-credentials token acquisition and saved token reuse after reload, automatic refresh and rotated credentials, manual Authorization bypass despite a held token endpoint, and root Cancel disconnecting a pending native token exchange without resource/root dispatch or token/history mutation. Refresh uses a real acquired token; only its stored expiry is advanced to exercise refresh without waiting an hour. The local client-credentials response deliberately supplies a refresh token to test the application's compatibility path; this does not endorse issuing refresh tokens for that grant. No IPC or worker mocks, external accounts or interactive browser are used.

Sources consulted: [RFC6749 client credentials](https://www.rfc-editor.org/rfc/rfc6749.html#section-4.4), [refresh](https://www.rfc-editor.org/rfc/rfc6749.html#section-6). Existing subsystem reused; no generator/dependency needed. Compiler15021 terminal0/0errors0warnings and formatting pass. Frozen468app/235scenario703paths bind unchanged productionc2fbaa430547aa47b2247213cc9579119bb52aae66bf47025775a0e7de6989aa. Baseline/current freeze are template-oauth-baseline-freeze.json and template-oauth-source-freeze.json under artifacts/playwright.

First native70311/artifact1791619289509 terminal0 accepts5groups/10main wire/29workers plus one held token exchange; native64004 exit0/native-hidden/visible:false. Independent current703source/c2fbaa43/form/header/token resource/rotation/history/selection/socket Cancel audit passes. First-run freeze is retained in template-oauth-first-run-freeze.json. Before commit, the fixture now explicitly sets timeout30000ms instead of inheriting settings from previous scenarios; only that setup line changes after terminal. Refreshed source binding and formatting pass.

Final isolated-timeout native54969/artifact1791619533021 terminal0 accepts5groups/10main wire/29workers plus one held token exchange; native65112 exit0/native-hidden/visible:false. `bun artifacts/template-oauth-audit.mjs artifacts/playwright/template-response-oauth-1791619533021` independently verifies current703source/executable, two real native token exchanges, grant/client credentials/refresh forms, foreign scope/query, Bearer values and no root credential leak, persisted context/record identity/rotation/reuse, eight successful history entries, unchanged UI selection/request descriptions and actual token socket Cancel without token/history mutation. The held exchange is cancelled before any token response; late-provider success is not covered.

Final compiler30564 terminal0/0errors0warnings and formatting/diff review pass. Exact owned64004/65112 and both WebView2 profiles are absent, recorded in artifacts/playwright/template-oauth-cleanup.json; no live feature handles remain. Application/CSS/backend unchanged;468app source identity proves productionc2fbaa43 reuse. Interactive/public providers, concurrency/source races/within-root shared-token cases, protocol/platform/accessibility and every original migration/shared UI/UX/CSS gate remain required. This accepts only covered local OAuth dependent-send workflows.
