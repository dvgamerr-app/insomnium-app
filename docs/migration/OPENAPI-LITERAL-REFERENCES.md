# Typed references and literal payloads

Implementation, headless and fresh four-version native acceptance pass.
Full migration/UX/CSS goal remains active. Schema resource $id/anchors/dynamic
references are still required; this fixes a prerequisite reference-role bug.

Official references consulted:
[OpenAPI Schema Object](https://spec.openapis.org/oas/v3.2.1.html#schema-object),
[JSON Schema reference/applicator roles](https://json-schema.org/draft/2020-12/json-schema-core#section-8.2),
and the installed Scalar README/source for its documented filesystem
dereference API. No new dependency or generator was required.

Before the fix, a valid JSON body example containing
$ref:unattached.json#/literal made analysis fail an external-reference lookup.
Retained reproduction: artifacts/playwright/openapi-literal-ref-before.json.

prepareApiReferences follows typed OpenAPI/Schema fields and reference targets.
It protects literal $ref members before Scalar's otherwise generic traversal.
Reserved-key collisions are avoided; JSON Pointer targets through a property
named $ref are translated for the parser and restored afterward. Renaming
preserves JSON member order and avoids **proto** setters. Diagnostics remove
internal marker names. Bounded JSON copies separate YAML aliases used as both
genuine schemas and literal data; existing8MiB document snapshot and per-file
200000node/depth100 processing bounds still apply. Source text is preserved.

Saved commands:

```powershell
bun run check
bun tests/ui/openapi-serialized-contract.js
bun tests/ui/openapi-named-examples.js
bun tests/ui/build-recovery-copy-probe.js
```

Compiler initially reported one possibly undefined resolved.schema; guarded it.
Final compiler0errors0warnings. Headless8byte checks/68controls pass, retaining
168serialized/11controls/8signing/editor/body-Git and named108/28/6profiles.
24new controls across3.0.3/3.1.0/3.2.0/3.2.1 cover literal examples/defaults,
real schema references, properties named $ref and pointers into them, YAML
schema/literal aliases and missing-target diagnostics. Payload checks include
numeric, prototype and authored reserved marker names and exact member order.

The existing native external scenario adds a fourth literal JSON POST containing
$ref and adds $ref to Link/extension data. It retains binary/JSON/query byte
groups, root/child $self declarations for modern versions, loading controls,
asset management, twelve bounded layout/focus profiles, worker literal preview,
source/ref persistence and reload. All four versions passed fresh acceptance.

Source freeze openapi-literal-ref-source-freeze.json records463app/206scenario
raw-byte hashes at basef00b05f, including the new openapi-references.js module.
Fresh production build handle10673 actual terminal0/start1791579497029/finish1791579870051/native54344. All669 raw source hashes stayed unchanged through build and native acceptance. Executable SHA09ca26d29eec630a4528478d402aa7089023c80491fb676d7d0d62d2cb2af801 is bound in openapi-literal-ref-build.json and source freeze.

Native runs (each actual terminal0/resultpassed/native-hidden/visible:false):

- 3.2.1: handle72100, artifact1791580029103, native60552, fixture51246.
- 3.2.0: handle12644, artifact1791580459635, native45548, fixture55469.
- 3.1.0: handle24598, artifact1791580671405, native57228, fixture57073.
- 3.0.3: handle18709, artifact1791580881887, native54828, fixture63141.

Each run passes4exact method/target/base64/SHA groups,12layout/focus profiles,4loading controls,4asset management actions and2worker literals. Independent audit reconstructs payload/member order, source/reference definitions and full-field canonical Git resources, and matches current669/executable/build identity. Aggregate16wire/48layout/16loading/16management/8worker checks; all owned native/profile/listener sets absent in final read-only audit. Actual native3.2.1 light760x600,3.2.0 dark760x960,3.1.0 dark760x600 and3.0.3 light760x960 images inspected. No arbitrary viewport/full UI/platform acceptance claim.

Saved native command (repeat versions3.2.1/3.2.0/3.1.0/3.0.3):

```powershell
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSION='3.2.1'
bun tests/ui/openapi-external-example.js
```

Artifacts: openapi-literal-ref-headless-audit.json, openapi-literal-ref-source-freeze.json, openapi-literal-ref-build.json, openapi-literal-ref-final-audit.json, openapi-literal-ref-cleanup-audit.json and per-run literal-independent-audit.json/literal-cleanup-audit.json. Formatting/whitespace checks pass. No live feature handles.

Remaining required scope: schema IDs/anchors/dynamic refs, broader URI/
fragment/charset/resource policies and every original provider/platform/
migration/UX/CSS requirement. This does not prove all schema or URI semantics.
/compact is unavailable; STATUS records accepted handles, no live feature processes and the next required gate.

The installed Scalar JSON Pointer resolver still uses inherited-property lookup. Full own-property/resource policies, boolean/nonobject reference targets and unknown schema vocabulary/resource indexing remain required alongside schema IDs/anchors/dynamic refs. This feature does not establish complete reference compliance.

2026-10-10 follow-up: static schema-resource traversal now validates own-property targets before calling Scalar. The installed Scalar implementation itself is unchanged. Static resource/anchor acceptance and the remaining dynamic/boolean/dialect/vocabulary/URI gates are recorded in OPENAPI-SCHEMA-RESOURCES.md.
