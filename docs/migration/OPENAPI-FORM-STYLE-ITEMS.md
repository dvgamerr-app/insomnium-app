# OAS 3.2 form style array items

Newly generated OAS 3.2 requests apply an explicit form Encoding Object to each
top-level array item. Earlier OAS 3.0/3.1 requests keep their whole-property
expansion. For example, `form`, `explode: false`, and `["blue", "black"]` now
produce `color=blue&color=black` for 3.2, while 3.0/3.1 retain
`color=blue,black`.

## Rules and implementation

- [OAS 3.2.1 encoding by name](https://spec.openapis.org/oas/v3.2.1.html#encoding-by-name)
  specifies applying the Encoding Object separately to each top-level array item.
- [Encoding Object RFC6570 fields](https://spec.openapis.org/oas/v3.2.1.html#fixed-fields-for-rfc6570-style-serialization)
  make explicit style fields equivalent to query-schema expansion and make
  `explode` ineffective for `deepObject`.

The generator persists `formArrayItems`, `itemKind`, and `itemNullable` on 3.2
explicit-style array rows. The shared form serializer validates the array, splits
validated JSON without rewriting item lexemes, and applies the existing style
serializer to each item. Flat object and nested array items therefore use their
own RFC6570 expansion: non-exploded objects retain the parent field name;
exploded objects use member names. This combination of item mapping and style
expansion is the implementation's interpretation of the two specification rules;
broader provider interoperability remains unverified.

Scalar items with space/pipe styles have undefined style behavior and stay review
gated. Clearing the request's review flag does not bypass the runtime guard.
Disabling the row permits a manual replacement. DeepObject uses its defined
object expansion regardless of the persisted 3.2 explode flag.

Edited numeric scalar items preserve large integer and exponent spelling rather
than converting through JavaScript Number. JSON shape checks remain limited to
the existing kinds; this does not implement complete JSON Schema constraints,
scalar subtypes, nullable unions, or numeric precision inside compound values.

The value editor reuses the existing linked Feedback/grid for “Each array item”
guidance. No CSS, backend, dependency, or layout change is required. Existing
saved generated rows are not silently rewritten; regenerate a 3.2 specification
to obtain the new metadata. A complete saved-resource migration policy remains
an original migration gate.

## Verification

```powershell
bun run check
bun tests/ui/design-system.js
bun scripts/ui-inventory.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/openapi-form-body.js
bun tests/ui/openapi-query-serialization.js
bun tests/ui/url-encoding.js
```

Current inline evidence: 76 generation/wire cases across 3.0.3/3.1.2/3.2.1,
including two expected refusal cases, 76 Git body round trips, and an exact edited
large-integer/exponent case. Retained artifacts:
`artifacts/playwright/openapi-form-style-items-baseline.json` and
`artifacts/playwright/openapi-form-style-items-inline.json`. Compiler passes with
zero errors/warnings. Saved headless design-system acceptance passes eight help
rows across six profiles and the existing shared contracts. Final production
release1791485710424 finished1791486088181/result0/hash3674864577700837266.
Form1791486095526 accepts102 groups (20/34/48 by version), including explicit
review/runtime refusal, disable recovery, numeric edits, exact wire, persisted
resource/history guards and reload. Query1791487015175 accepts44 groups;
URL1791487423309 accepts41raw targets and38 independently verified signatures,
including four new non-exploded per-item form OAuth1 cases. All results are
terminal passed/native-hidden/visiblefalse/exit0; sequence6943 exits0 and no
feature-owned live handles remain. Actual3.2.1 light760 item-editor image was
inspected. Exact source hash, superseded build and handoff: STATUS.

All other OpenAPI media/body/schema/refs/Swagger/lint/version/provider/platform,
original migration, and centralized UX/CSS gates remain required.
