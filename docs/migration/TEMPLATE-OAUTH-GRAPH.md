# OAuth resources within a dependent response graph

The existing saved `template-response-send.js` scenario now includes OAuth graph mode. It exercises mounted Windows Send, real bundled workers, native OAuth exchange and Rust HTTP transport using synthetic local credentials. Application, CSS and backend are unchanged.

```powershell
bun run check
$env:INSOMNIUM_TEMPLATE_OAUTH_GRAPH='1'
Remove-Item Env:INSOMNIUM_TEMPLATE_OAUTH -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_CYCLES -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_SSE -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_ENVIRONMENTS -ErrorAction SilentlyContinue
bun tests/ui/template-response-send.js
```

Three groups verify sequential dependencies within one root Send:

- Body and header independently send the same foreign request; one token acquisition serves both.
- An expired acquired token refreshes once; both sends use the rotated token and retain its record identity.
- A nested child acquires a token that the later direct root dependency reuses. The nested request receives `X-Nested` without inheriting the foreign Authorization header.

The refresh fixture changes only the acquired token's stored expiry. The third group removes only the scenario-owned foreign token to force acquisition. Native serialization traverses body before headers; nested wire order is token, foreign, nested, foreign, root. These are sequential snapshot-sharing checks. The synthetic client-credentials response supplies a refresh token for compatibility testing; consulted RFC6749 sources and that limitation are recorded in [TEMPLATE-RESPONSE-OAUTH.md](TEMPLATE-RESPONSE-OAUTH.md). This mode reuses the subsystem without dependencies or generators.

Accepted artifact: `artifacts/playwright/template-response-oauth-graph-1791620109619`. Native63420 exited0, passed, `native-hidden`, visible:false. Three groups/13 wire requests/three exchanges/38 workers pass. Independent `bun artifacts/template-oauth-graph-audit.mjs artifacts/playwright/template-response-oauth-graph-1791620109619` verifies703 source hashes and executable SHA256 `c2fbaa430547aa47b2247213cc9579119bb52aae66bf47025775a0e7de6989aa`, literal forms/credentials/scope/Bearer values/nested headers/root body, token context/identity/rotation, ten distinct durable histories and unchanged selection/descriptions. Freeze and cleanup: `artifacts/playwright/template-oauth-graph-source-freeze.json` and `template-oauth-graph-cleanup.json`. Exact owned PID/profile processes are absent.

Compiler89124 exited0 with zero errors/warnings; scenario formatting/diff checks pass. Unchanged468 application hashes bind the reused release. Browser scenarios remain headless; native hosts are hidden before CDP. Concurrent exchange coalescing, interactive/public providers, source races, late-provider completion, broader protocols/platform/accessibility and every original migration/shared UI/UX/CSS gate remain required.
