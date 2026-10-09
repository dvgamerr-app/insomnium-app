# Dynamic schema reference sampling

Generated samples now choose dynamic targets per operation scope, including reuse of the same reader under different outer resources. Headless contracts and fresh four-version native worker/send acceptance pass. Full migration and UX/CSS goal is active.

Official sources consulted: [JSON Schema2020-12 core7.1,8.2.3.2,9.4](https://json-schema.org/draft/2020-12/json-schema-core#section-8.2.3.2), installed Scalar documented filesystem dereference API and installed [openapi-sampler](https://github.com/Redocly/openapi-sampler) source. No generator or new dependency.

Original typed schema nodes, resource bases, reference targets and dynamic anchors are captured before parser rewriting. Collision-free node bindings survive dereference, are collected into a Map and removed from resolved schemas. Analysis carries cloneable Maps so worker transport preserves schema identity. Original files and persisted resources retain authored text.

Each sample traverses the original reference graph with a fresh scope. The first resource defining a dynamic-anchor name wins. Only a plain-name reference initially targeting a dynamic anchor is overridden; static anchors, pointers and empty fragments retain their initial target. Branches receive independent scopes. Lexically enclosing resources are not introduced when evaluation starts directly in a nested resource. Referenced schemas and siblings combine with allOf rather than overwriting constraints. Recursive contexts share placeholders for the existing sampler's bounded recursive sample behavior.

Expansion allows10000 distinct node/scope contexts, depth100 and8MiB of copied literal string units per sample. Existing input8MiB/per-file200000nodes/depth100 and discovery100passes remain. Unsupported dialects/missing/nonobject targets still refuse. This is target selection for an approximate sampler, not full instance validation or complete schema compliance. Boolean references, other dialects, vocabulary discovery and broader URI policies remain required.

Saved commands:

```powershell
bun tests/ui/openapi-dynamic-schema.js
bun tests/ui/openapi-schema-resources.js
bun tests/ui/openapi-serialized-contract.js
bun tests/ui/openapi-named-examples.js
bun run check
bun tests/ui/build-recovery-copy-probe.js
```

75 dynamic checks cover three modern versions, six authored body shapes sampled directly/repeatedly/after structuredClone, source and Git preservation, static fallbacks, outermost/branch/lexical scopes, recursive siblings, attached schemas and refusal controls. The initial attached fixture failure is retained in artifacts/playwright/openapi-dynamic-schema-attached-fixture-failure.json; it described recursion by placing its dynamic anchor on the entire reference-bearing root, and was corrected to declare an anchored value subschema. Initial compiler undefined-target error was corrected; final compiler0errors0warnings. Static83, serialized and named-example regressions pass.

Frozen464app/212scenario files (676total), basef91fa3e. Fresh production build5039 terminal0/start1791584417815/finish1791584792031/native6776; executable SHA5720bbb99ed0f3751063ee8a4e35132383c84b0da33a77f6641f96cead3d0e77. FixtureHash9384957238430302815 alone does not identify application source. No app/scenario changes during build or acceptance. Existing frontend chunk advisory and5dependency eventsource-stream warnings, no build failure.

Native runs use the saved external-example scenario with INSOMNIUM_UI_BUILD_STATE=artifacts/native-recovery-copy-probe/build-state.json and INSOMNIUM_OPENAPI_VERSION set sequentially:

| Version | Actual handle | Artifact suffix | Owned PID | Fixture port | Wire / dynamic bodies |
| --- | --- | --- | --- | --- | --- |
| 3.2.1 | 61378 | 1791584804483 | 33680 | 55317 | 12 / 6 |
| 3.2.0 | 56633 | 1791585049857 | 61140 | 51698 | 12 / 6 |
| 3.1.0 | 27091 | 1791585293637 | 28244 | 56019 | 12 / 6 |
| 3.0.3 | 32256 | 1791585536523 | 55928 | 62509 | 4 / 0 |

All terminal0/resultpassed/nativeexit0/native-hidden/visible:false. Final native finish2026-10-09T22:42:20.614Z. Totals40wire/18dynamic/48theme-width-height geometry/16loading controls/16management actions/8worker literal fields. Dynamic attached-resource/recursive/lexical cases have headless coverage, not new native coverage. Existing approximate sampling is not instance validation.

Per-run dynamic-independent-audit.json independently reconstructs literal expected method/target/base64/SHA, asserts the authored dynamic graph, compares complete root/reference documents with the prior accepted fixture plus asserted additions, checks full-field canonical Git roundtrips, raw geometry/nonoverlap/focus,676source hashes and executable/build identity. Auditor initially assumed external JSON used body.text; that retained byte-preserving fixture stores binary/base64 and the auditor was corrected, without app/scenario changes. Headless audit reconstructs63body strings among75checks. Aggregate openapi-dynamic-schema-final-audit.json passes. Fresh dynamic-cleanup-audit.json files22:43:04Z confirm all owned PIDs/profiles/listeners absent. No live feature handle.

Actual3.2.1light760x600,3.2.0dark760x960,3.1.0dark760x600 and3.0.3light760x960 images inspected. These are pre-validation asset/layout captures; they do not prove full operation-preview, OS-close or every platform. No CSS changes or full migration claim. Remaining gates include boolean references, other dialects/vocabularies/URI policies, broader sampling/validation behavior and every original migration/UX/CSS requirement.
