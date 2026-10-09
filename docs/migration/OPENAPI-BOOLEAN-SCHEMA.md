# Boolean schema references and request samples

Typed `true` and `false` Schema targets now survive reference resolution and worker cloning in OpenAPI 3.1.0, 3.2.0 and 3.2.1. This closes the reproduced direct-false and boolean-reference generation failures for the covered cases. Full migration and UX/UI/CSS work remain active.

Official sources consulted before implementation: [JSON Schema 2020-12 boolean schemas](https://json-schema.org/draft/2020-12/json-schema-core#section-4.3.2), [OpenAPI 3.2.1 Schema Object](https://spec.openapis.org/oas/v3.2.1.html#schema-object), and [cfworker JSON Schema documentation](https://github.com/cfworker/cfworker/tree/main/packages/json-schema). Installed the interpreter using the documented command `bun add @cfworker/json-schema` (4.1.1). Bun postinstall regenerated the existing document validators without a tracked generated diff. Production CSP and CSS are unchanged.

Typed boolean placeholders adapt Scalar's object dereferencer; private metadata is removed from the resolved view. Original schema identity travels in a cloneable evaluation graph. Attached standalone boolean roots use explicit parsing permission; the primary API document still requires an object. Literal booleans remain data, authored source stays intact, and references outside Schema positions cannot use boolean targets.

Sample preparation handles optional forbidden properties, bodies and parameters, boolean branches/conditionals and array bounds. Impossible required values and contradictory explicit examples produce review issues. The interpreter checks generated and explicit JSON values against a bounded local-reference projection of the expanded graph; raw external and serialized JSON bytes are checked without being rewritten. The projection supports known assertions/applicators, treats formats as annotations, and excludes directly marked read-only properties from its required list. Other dialects/vocabularies, broader URI/resource policies, full sampling/instance validation, arbitrary serialized parameters and processing budgets remain required.

`_openapiSchemaIssues` survives canonical Git encoding and decoding. Transport and existing Settings review combine it with local `_openapiIssues`; deliberate manual acknowledgment clears both arrays. Native tests persist durable-only issues and reload before Send, which proves owned persistence and pre-network refusal. Actual native Git synchronization is a separate gate. Acknowledgment tests retain request fields and do not send an unchanged prohibited sample afterward.

## Saved verification

```powershell
bun tests/ui/openapi-boolean-schema.js
bun tests/ui/openapi-schema-resources.js
bun tests/ui/openapi-dynamic-schema.js
bun tests/ui/openapi-serialized-contract.js
bun tests/ui/openapi-named-examples.js
bun run check
bun tests/ui/build-recovery-copy-probe.js

$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSION='3.2.1' # then 3.2.0 and 3.1.0, sequentially
bun tests/ui/openapi-boolean-schema-native.js

$env:INSOMNIUM_OPENAPI_VERSION='3.0.3'
bun tests/ui/openapi-external-example.js
```

Headless 175 checks cover 24 authored body shapes through direct and worker-style clone paths, attachments, optional/required/explicit parameters, dynamic pointers, raw examples, literal data, full Git metadata and preflight refusal. The mounted RequestEditor fixture verifies durable-only Settings review and acknowledgment without changing body/URL/ID/name/headers/parameters. Retained static 83, dynamic 75, serialized and named-example scenarios pass. Final compiler reports zero errors and warnings; formatting and whitespace checks pass.

| Native version | Actual handle | Artifact suffix | Groups | Wire | Refusals |
| --- | --- | --- | --- | --- | --- |
| 3.2.1 | 5343 | 1791587896320 | 34 | 19 | 15 |
| 3.2.0 | 83924 | 1791588320698 | 34 | 19 | 15 |
| 3.1.0 | 54415 | 1791588737521 | 32 | 18 | 14 |
| 3.0.3 regression | 10988 | 1791589144533 | 4 wire cases | 4 | — |

All handles terminated with code zero, result passed and native exit zero. Native rendering is `native-hidden`, with each owned host confirmed invisible before CDP. Modern totals: 100 groups, 56 exact wire bodies/targets/methods and 44 durable-only refusals with no packet/history addition. Three manual review/reload checks pass. Retained 3.0.3 adds four wire cases, 12 raw geometry profiles, four loading controls, four asset-management actions and two worker literal fields.

Independent auditors reconstruct complete authored documents, attached references, raw example bytes, expected bodies, SHA-256 values, all canonical Git fields (208 records), current source hashes and executable identity. Three light 760×960 review captures were saved; 3.2.1 and 3.1.0 were inspected along with the retained dark 760×600 asset-stage image. The retained geometry evidence concerns source/asset layout, not full operation-preview or all review-theme/accessibility coverage.

Fresh production build 49406 terminated with code zero. Native compiler PID 60164; start 1791587241355, finish 1791587616712. Executable SHA-256: `9e65a82e18c50223d44e91811578acb5b2781c111c806cd6e1af07e0e10f1e2e`. The original freeze contains 465 application and 217 scenario hashes. A separate acceptance freeze records one scenario-only readiness/selector/diagnostic correction; all application hashes remained identical to the built source. Fixture hash alone is not application identity.

The initial native handle 63706 terminated with code one before Send: its 15-second Collections lookup expired after reload. Failure artifact 1791587673246 and screenshot are retained. Successful ARIA confirms the original accessible label; the saved scenario waits up to 60 seconds and selects the exact rendered request-name child. Earlier headless fixture-timeout and compiler corrections remain recorded in STATUS. No failed run is counted as accepted evidence.

Final audit: `artifacts/playwright/openapi-boolean-schema-final-audit.json`. Build/freezes/headless audit and each native independent audit remain under `artifacts/playwright`. Fresh cleanup at 2026-10-09T23:43:26Z confirms all five owned native PIDs, profile processes and fixture listeners absent. No feature process remains live. Broader schema, provider/platform/storage/plugin/transport/Git/recovery/CI/release/distribution and original migration/UX/CSS gates remain open. The owner requires a topic commit and compact handoff before the next feature; this interface cannot invoke `/compact`.
