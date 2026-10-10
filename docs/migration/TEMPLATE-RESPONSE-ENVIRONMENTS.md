# Response templates across selected environments

The environment mode of the existing saved `tests/ui/template-response-send.js` scenario verifies a foreign collection with a selected child environment through the mounted Windows native application, real bundled workers and Rust HTTP transport. Shared native-hidden setup remains unchanged. Application/CSS/backend sources are unchanged.

```powershell
bun run check
$env:INSOMNIUM_TEMPLATE_ENVIRONMENTS='1'
bun tests/ui/template-response-send.js
```

Four groups cover selected environment variable override on actual wire, response history tagged with the target environment, repeated no-history sends because caller-scoped history is absent, never refusal despite target history, and caller-scoped history reuse without a dependency send. UI selection remains the original root request/collection/Base environment. Caller history is explicitly seeded; this does not claim a real user-generated foreign request response in the caller environment. Each configuration reloads the mounted application before Send.

Compiler2443 terminal0/0errors0warnings and formatting pass. The prior freeze proves all468 application paths unchanged and binds703 current application/scenario paths to optimized release SHA01515fc0526bc20cfc56ebf01005051805df164432b122877377ce44f81bdd08; no native rebuild needed.

First native8023/artifact1791616465601 terminal0 passes the four runtime groups and five wire requests, native51688 exit0/native-hidden/visible:false. Additional independent audit found the caller seed was appended to existing bounded history and evicted after root response persistence. Fixture insertion alone changed to unshift after terminal. The first attempt is retained; no durable caller seed acceptance is claimed from it.

Corrected native52641/artifact1791616642560 terminal0 accepts4groups/5wire/9workers; native68356 exit0/native-hidden/visible:false. Independent audit verifies current703 source hashes/production release SHA, wire order/query/method/literal bodies/base64, request descriptions, caller versus target history identities, repeated no-history sends, refusal without history mutation, durable caller seed and unchanged UI selection. Audit command: `bun artifacts/template-environments-audit.mjs artifacts/playwright/template-response-environments-1791616642560`; result is independent-audit.json in that directory. Exact owned51688/68356 and WebView2 profile processes are absent, recorded in artifacts/playwright/template-environments-cleanup.json. No live feature handles remain.

No subsystem is initialized; existing scope/resolver behavior is exercised. Existing documented API references remain applicable: [Playwright locators](https://playwright.dev/docs/locators), [Nunjucks asynchronous support](https://mozilla.github.io/nunjucks/api.html#asynchronous-support). Environment resolution and caller-versus-target history are intentionally separate, as documented in DEPENDENT-RESPONSES.md.

Remaining response-template gates include OAuth/provider updates, cycles, SSE completion/cancellation/framing, protocol/platform/accessibility and broader environment transitions. Original migration, shared UI adoption/ownership and UX/CSS gates remain active. This scenario proves selected child environment routing and the covered history behavior, not full migration.
