# OpenAPI 3.2 dataValue selection

Verified data-form selection on release1791545416430 (finished1791545802407,
result0). Both saved native versions and independent audits pass; full migration/
UX/CSS remains active. Base:9132519.

The generator selects the first Example Object's own dataValue in3.2.0/3.2.1
before schema sampling, preserving false, zero, empty string, null, arrays and
objects. Media examples remain preferred; when no explicit media value exists,
3.2 content parameters may use their parameter-level example. Earlier versions
retain shorthand/value behavior. Normal serializers and existing UI remain.

This topic verifies data-form selection only. serializedValue wire preservation,
externalValue loading, example selection UI, schema-example precision and full
example/schema validation remain required. When dataValue and serializedValue
coexist, this generator selects dataValue; authored serialized wire is a pending
gate. All original migration/provider/platform/UX/CSS scope remains active.

Primary references consulted before implementing:
https://spec.openapis.org/oas/v3.2.1.html#example-object
https://spec.openapis.org/oas/v3.2.1.html#parameter-object-examples

Corrected baseline openapi-data-value-baseline.json records12 wrong selections
across both3.2 versions, including false becoming schema-default true and zero
becoming7. An initial harness assumed a resources property instead of the actual
generator array return; its invalid artifact is retained separately. Only the
corrected baseline is evidence. Direct body selection12 now passes.

Fixture preflight160 covers20 cases/two versions/both URL/cURL modes; actual
Git encode/decode40 and legacy value24 controls pass. An initial inline preflight
assumed composed body.text rather than the actual text body; corrected the
harness before claiming acceptance. Compiler0errors0warnings and selected
formatting/diff checks pass.

Saved tests/ui/openapi-data-value.js uses shared native-hidden launch and actual
owned worker generation.20 cases cover query/header/path/cookie, JSON content,
whole-query JSON/empty UTF-8 text/form, six JSON body shapes, UTF-8 text/form
bodies, parameter-level fallback and media precedence. It checks selected values,
literal raw TCP targets/bodies/owned header fields, persistence and reload
without resend. Cookie checks only the owned pair. Actual fixture port is saved
before generation; observed selection recoveries are recorded. Both native
runs, independent wire audits and owned cleanup are complete; evidence follows.

```powershell
bun run check
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSION='3.2.1'
bun tests/ui/openapi-data-value.js
$env:INSOMNIUM_OPENAPI_VERSION='3.2.0'
bun tests/ui/openapi-data-value.js
```

Freeze application source through the fresh build and native acceptance.
Record terminal evidence, current commit, remaining gates and live handles in
STATUS before the topic commit/compact handoff. This interface cannot invoke
/compact; do not claim it occurred.

Native3.2.1/20 handle54000/artifact1791545851817 is terminal0/passed on
release1791545416430,11:37:32.233Z–11:49:52.985Z. Independent literal wire audit
checks20 groups and frozen hashes. Generation recovery1 checks exact accepted
source identity; selection recoveries0. Native55384 exit0/native-hidden/visiblefalse;
Bun56360/native/profile processes and actual fixture60698 released.
Native3.2.0/20 handle97865/artifact1791546686546 is also terminal0/passed,
11:51:26.558Z–12:04:05.513Z, on the same release. Independent literal audit
checks20 groups and frozen hashes; generation recovery1 and selection recoveries0.
Native43992 exit0/native-hidden/visiblefalse; Bun50120/native/profile processes
and actual fixture58149 released. Combined native evidence40 groups.
All feature-owned handles are terminal; no passing run was restarted.

Artifacts are under artifacts/playwright/. Each native root contains
independent-data-value-audit.json, acceptance.json, result.json, fixture.json and
its observed openapi-generation-recovery.json. Source hashes are in
openapi-data-value-source-freeze.json. No serializedValue/external-example, full
precision/schema/media/provider/platform or full migration/UX/CSS claim.
