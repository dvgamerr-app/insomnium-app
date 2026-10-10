# Response-template dependency cycles

The cycle mode in the existing saved template-response-send scenario exercises shared mutable dependency chains through the actual mounted Windows native application, bundled template/filter workers and Rust HTTP transport. Application/CSS/backend are unchanged. Shared native-hidden helper remains; browser scenarios continue headless:true.

```powershell
bun run check
$env:INSOMNIUM_TEMPLATE_CYCLES='1'
Remove-Item Env:INSOMNIUM_TEMPLATE_SSE -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_ENVIRONMENTS -ErrorAction SilentlyContinue
bun tests/ui/template-response-send.js
```

Five groups cover self-reference without history, A→B→A without history, a real HTTP history seed for B, mutual root re-entry with B history and self root re-entry using the resulting A history. Missing-history cycles refuse before any wire dispatch/history mutation. Seeded mutual cycles send inner A, then B with X-Cycle from inner A, then outer A; self cycles send inner and outer A. No fake response history is seeded. Every case uses normal production workers and transport. The mutable chain suppresses another resend once a child ID is already present, while an independent root invocation can re-enter once; this preserves the documented DEPENDENT-RESPONSES.md contract.

Compiler59998 terminal0/0errors0warnings and formatting pass. Frozen468app/235scenario703paths bind unchanged productionc2fbaa430547aa47b2247213cc9579119bb52aae66bf47025775a0e7de6989aa; only this saved scenario changes relative to prior acceptance, so no native rebuild is needed. Baseline/current freeze: artifacts/playwright/template-cycles-baseline-freeze.json and template-cycles-source-freeze.json. Existing resolver/session/transport reused; no subsystem initialization or new dependency.

Native18909/artifact1791618775431 terminal0 accepts5groups/6wire/12workers; native53620 exit0/native-hidden/visible:false. `bun artifacts/template-cycles-audit.mjs artifacts/playwright/template-response-cycles-1791618775431` independently verifies current703source/executable, literal JSON/root bodies/base64, methods/query/case headers, missing-history refusals, real B seed, inner A→B→outer A order/X-Cycle value, self inner/outer A order, six unique durable history entries (four A/two B), unchanged request descriptions and UI selection. No fake history, controlled workers or mocked transport are used.

Exact owned53620 and its WebView2 profile are absent, recorded in artifacts/playwright/template-cycles-cleanup.json; no live feature handles remain. Compiler59998 terminal0/0errors0warnings, formatting and diff review pass. Application/CSS/backend unchanged; accepted productionc2fbaa43 reused with all468 app paths proven identical. Full provider/concurrency/chain/send limits/protocol/platform/accessibility/SSE history/body bounds/OS transfer/full XPath and original migration/shared UI/UX/CSS gates remain required. This accepts only the covered cycle workflows, not all dependency graphs or full migration.
