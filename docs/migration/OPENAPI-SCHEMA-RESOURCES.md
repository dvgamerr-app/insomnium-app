# Static schema resource identities

2026-10-10 follow-up: dynamic target selection for generated samples is implemented and verified in [OPENAPI-DYNAMIC-SCHEMA.md](OPENAPI-DYNAMIC-SCHEMA.md). The dynamic refusal below describes the prior static-only checkpoint. Full schema validation and the other documented parity gates remain open.

Canonical schema$id and scoped anchors now drive generated request samples, including schemas in attached files. Implementation, headless and fresh four-version native acceptance pass. Full migration/UX/CSS remains active; dynamic-scope reference evaluation is required next and explicitly refused until supported.

Official references consulted:

- [JSON Schema2020-12 core8.2/9.2](https://json-schema.org/draft/2020-12/json-schema-core#section-8.2)
- [OAS3.2.1 Schema Object](https://spec.openapis.org/oas/v3.2.1.html#schema-object) and AppendixF
- [Official OAS dialect iterations](https://spec.openapis.org/oas/)
- Installed Scalar README/source for its documented filesystem dereference API.

No new dependency or generator. The old canonical lookup failure is retained in artifacts/playwright/openapi-schema-resource-before.json.

Typed traversal registers static resources and plain anchors, inherits relative schema bases, discovers detached typed fragments to a fixed point, and translates targets into Scalar's filesystem. Anchors are scoped to the nearest resource; $dynamicAnchor can be used by static$ref. JSON Pointer own-property lookup rejects inherited targets before Scalar. Literal identifiers are not indexed in ordinary payload/default/extension positions, and literal$ref member protection remains. Document source is not rewritten.

Current policy reports errors for unknown resource dialects, duplicate IDs/anchors, document/schema identity collisions, malformed declarations, missing/nonobject targets and dynamic refs. This does not classify every refused document as normatively invalid. Boolean schema references, dynamic scope, other drafts/dialects, unknown vocabulary indexing, rare reserved-fragment pointer spellings and broader URI/fragment/identity policies remain required before full schema/reference parity. Supported static core dialects: JSON Schema2020-12 and published OAS3.1 base/2024-10-25/2024-11-10 plus OAS3.2 2025-09-17/2026-02-26.100discovery passes and prior200000node/depth100 per-file/8MiB snapshots remain. No full schema evaluation/compliance claim.

Saved commands:

```powershell
bun tests/ui/openapi-schema-resources.js
bun tests/ui/openapi-serialized-contract.js
bun tests/ui/openapi-named-examples.js
bun run check
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSION='3.2.1'
bun tests/ui/openapi-external-example.js
```

Repeat the saved native scenario for3.2.0/3.1.0/3.0.3. Modern versions add two schema sends to four retained literal/byte groups;3.0.3 retains four groups.

83controlled headless checks (46positive/37negative) pass. Includes canonical/nested/attached/retrieval/recursive/escaped/ref-named/scoped/static-dynamic-anchor/literal/dialect cases and refusal boundaries. Retained8byte/68controls,168serialized/11controls/8signing/editor/body-Git and named108/28/6 pass. Initial helper14implicit-JSDoc errors corrected; final compiler0errors0warnings. Target caching before protection retains pointer-named$ref; normalized schemaOrArray roles prevent repeated relative$id; explicit empty fragment permits Scalar standalone-root recursive refs. Initial inline native auditor brace syntax failed before execution; corrected command passed without source edits.

Source freeze openapi-schema-resource-source-freeze.json records463app/209scenario raw hashes/baseabbe3ae. Fresh production build70362 actualterminal0/native58376/start1791582005332/finish1791582380613. All672 hashes unchanged through build/native acceptance. Executable SHA330f5d2b38b095042d8133f759e6337df9612b4260298fad941b9c2ceb669262 is bound in freeze/openapi-schema-resource-build.json. Fixture hash alone is not app identity. Existing chunk/dependency warnings; no build failure.

Native runs (all actualterminal0/resultpassed/native-hidden/visible:false):

- 3.2.1: handle3242, artifact1791582396641, native48300, fixture59361, 6wire groups.
- 3.2.0: handle55151, artifact1791582634895, native39272, fixture63604, 6wire groups.
- 3.1.0: handle18428, artifact1791582857516, native51624, fixture62428, 6wire groups.
- 3.0.3: handle20808, artifact1791583079137, native60476, fixture58144, 4wire groups.

Aggregate22wire/6new schema groups/48layout profiles/16loading controls/16management actions/8worker literal checks. Independent audits reconstruct exact body bytes/member order, complete authored main/reference documents, root/attached schema resource IDs/dialects, full-field canonical Git and current672/build/executable identity. Headless audit independently reconstructs83expected samples/refusals. Final aggregate audit and fresh owned process/profile/listener cleanup pass. No live feature handles.

Actual3.2.1light760x600,3.2.0dark760x960,3.1.0dark760x600,3.0.3light760x960 images inspected. Bounded setup geometry/focus profiles remain usable; no arbitrary viewport/full UI/OS-close/platform acceptance claim. No CSS changes.

Artifacts: openapi-schema-resource-source-freeze.json, openapi-schema-resource-build.json, openapi-schema-resource-headless-audit.json, openapi-schema-resource-final-audit.json, openapi-schema-resource-cleanup-audit.json and per-run schema-independent-audit.json/schema-cleanup-audit.json. Formatting/whitespace checks pass. Commit and checkpoint by topic; /compact is not callable, no compaction claimed. Every original migration/provider/platform/UX/CSS and remaining schema/dynamic/resource gate stays required.
