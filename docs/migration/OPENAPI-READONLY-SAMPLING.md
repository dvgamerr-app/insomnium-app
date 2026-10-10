# Read-only properties in generated request samples

Verified implementation, saved headless contracts, compiler, fresh production build and focused native acceptance pass. Full migration and UX/UI/CSS scope stays active.

The existing request sampler deliberately uses `skipReadOnly: true`. A required property with `readOnly: true` and a false schema branch nevertheless made the new boolean preparation reject the entire body before that policy could apply. The reproduction is saved in `artifacts/playwright/openapi-readonly-before.json`; the expected generated body contains only the writable `name` property.

Primary references consulted before editing: [OpenAPI 3.2.1 annotation validation](https://spec.openapis.org/oas/v3.2.1.html#validating-readonly-and-writeonly), [JSON Schema 2020-12 metadata 9.4](https://json-schema.org/draft/2020-12/json-schema-validation#section-9.4), and [Redocly sampler](https://github.com/Redocly/openapi-sampler) plus its installed allOf/object traversal. Modern OAS treats direction keywords as annotations; omission here preserves this application's existing request-generation policy, rather than asserting that every modern OAS implementation must strip these fields. Existing dependencies were reused; no subsystem initializer or installation was needed.

Boolean sample preparation now omits read-only properties before evaluating impossible branches and excludes their names from request required lists. Its validator uses the same bounded root/allOf annotation lookup on the expanded reference graph. It follows resolved static/dynamic reference siblings and nested object properties, without treating literal payload keys or annotations under alternatives/not as unconditional property flags. Explicit examples that include a prohibited value still fail their assertions; required writable false properties still require review. No CSS, layout, CSP or dependency change.

The existing saved boolean scenario passes 253 checks: 175 retained and 78 new from 13 cases across three modern versions and direct/worker-style clone paths. New cases cover direct/allOf annotations, false static/dynamic reference siblings, nested requirements, writable false siblings, readOnly:false, alternative/not boundaries, valid omission/invalid explicit values, composed nonboolean properties and literal annotation-shaped data. Existing RequestEditor Settings acknowledgment, static 83, dynamic 75, serialized and named-example regressions pass. Final compiler reports zero errors and warnings.

Saved commands:

```powershell
bun tests/ui/openapi-boolean-schema.js
bun tests/ui/openapi-schema-resources.js
bun tests/ui/openapi-dynamic-schema.js
bun tests/ui/openapi-serialized-contract.js
bun tests/ui/openapi-named-examples.js
bun run check
bun tests/ui/build-recovery-copy-probe.js

$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_CASE_SET='readonly'
$env:INSOMNIUM_OPENAPI_VERSION='3.2.1' # then 3.2.0 and 3.1.0 sequentially
bun tests/ui/openapi-boolean-schema-native.js

# Clear the focused selection before the retained legacy scenario.
Remove-Item Env:INSOMNIUM_OPENAPI_CASE_SET
$env:INSOMNIUM_OPENAPI_VERSION='3.0.3'
bun tests/ui/openapi-external-example.js
```

The focused native selection tests 13 Sends/refusals per modern version. The real worker still generates and captures all 47 requests in 3.2.x or 45 in 3.1.0; independent source/body/Git audits inspect all records. Focused Send evidence does not prove every generated operation was sent.

Freeze `artifacts/playwright/openapi-readonly-source-freeze.json` records 465 application and 217 scenario hashes from base a21a205, with four intended changes. Production build session 14976 exited zero (native compiler 59960, start 1791590079335, finish 1791590454226). Executable SHA256 is `a197cae6ad70e43edb8be223a19a5d3cb729239a8dff8188cddf88949eed895b`; fixtureHash alone is not source identity. Application/scenario source stayed unchanged throughout acceptance.

| Version | Actual session (exit zero) | Artifact directory suffix | Generated records | Focused groups | Exact wire | Refusals | Git records |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3.2.1 | 15850 | 1791590482062 | 47 | 13 | 10 | 3 | 95 |
| 3.2.0 | 57396 | 1791590757481 | 47 | 13 | 10 | 3 | 95 |
| 3.1.0 | 45041 | 1791591061253 | 45 | 13 | 10 | 3 | 91 |

All three `openapi-boolean-schema-*` results are passed, native exit zero, `native-hidden` and `hiddenWindow.visible:false`. Their `readonly-independent-audit.json` files reconstruct complete authored source/reference/raw assets, all 139 generated original/durable bodies, all 281 full-field canonical Git records and focused exact wire/refusal results. There are 53 refused records across the full generated data; only nine are selected native refusal controls. The non-UI auditor `artifacts/playwright/openapi-readonly-independent-audit.mjs` uses independently authored literal expectations rather than importing fixture expectations.

Retained 3.0.3 session 20632 exited zero, artifact `openapi-external-example-1791591336257`, native PID 42396 and fixture port 54257. Its independent `readonly-regression-audit.json` passes four exact wire requests, 12 dark/light geometry profiles, four loading controls, four asset-management controls, two worker literal controls, five complete Git records and current source/build identity. Aggregate native scope is 34 exact wires and 286 Git records. The actual light 760x960 request-body images for 3.2.1 and 3.1.0 and dark 760x600 legacy asset-stage image were inspected; this is scoped layout evidence, not full UX acceptance.

`openapi-readonly-headless-audit.json` independently reconstructs 144 body strings, 78 refusal records and 31 other controls (253 total), retaining actual Settings acknowledgment. An initial auditor duplicate-variable error was corrected in the auditor only; no application/scenario correction or native retry was needed. Formatting and `git diff --check` pass. Production build retains existing chunk-size and eventsource-stream warnings; compiler checks have zero errors/warnings.

`openapi-readonly-cleanup-audit.json` confirms native PIDs 60140/49780/56780/42396, their exact WebView profiles and fixture listeners 64499/62793/52980/54257 are absent. No live feature handles remain. `openapi-readonly-final-audit.json` rechecks all 682 frozen source hashes, executable bytes, actual accepted results, aggregate counts and cleanup. These ignored artifacts remain local evidence; saved scenarios/helpers and this document are committed with the implementation.

Root/allOf request-sampling hints are the accepted scope of this implementation. Full instance-dependent annotation collection, conditional/alternative direction semantics, other schema dialects/vocabularies, resource/URI policies, processing budgets and every original migration/provider/platform/storage/plugin/transport/Git/recovery/CI/release/distribution/shared-UI/UX/CSS requirement remain required. Native Git synchronization and OS-close lifecycle are not proven by this topic. Record the actual topic commit and handoff in STATUS.md; this interface cannot invoke `/compact`, so no command-driven compaction is claimed.
