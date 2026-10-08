# OAS 3.0 default form style

This is a historical milestone. Its default-style behavior is superseded by the
3.0.4 clarification adopted in [OPENAPI-FORM-LEGACY-CONTENT.md](OPENAPI-FORM-LEGACY-CONTENT.md).
The original evidence below is retained; it does not describe current generation.

Newly generated OAS 3.0 form requests without explicit encoding fields now keep
editable style metadata. Primitive arrays produce repeated field names, flat
objects expand member names, and represented null/empty containers are omitted.
For example, `["a +", "b&="]` produces
`color=a%20%2B&color=b%26%3D`, rather than a JSON string under `color`.

## Primary rules and scope

[OAS 3.0.3 form request bodies](https://spec.openapis.org/oas/v3.0.3.html#support-for-x-www-form-urlencoded-request-bodies)
identify `form` as the default serialization strategy. The
[Encoding Object](https://spec.openapis.org/oas/v3.0.3.html#encoding-object)
uses query-style defaults, including `explode: true` for form. The generator now
selects the existing form serializer when `style`, `explode`, `allowReserved`,
and `contentType` are absent. Both an empty encoding map and a completely absent
encoding field are covered. Explicit styles and modern 3.1/3.2 content/default
rules retain their existing behavior.

Nested objects and object-array values have no supported flat RFC6570 expansion;
generation flags them for review and the runtime guard still refuses after the
request review flag is cleared. Default binary properties and binary array items
retain row-level review metadata instead of silently becoming ordinary text.
Disable the unsupported row and provide a manual replacement to recover.
The value editor uses the existing linked form/nullable/review help and layout;
no component CSS, backend, or dependency change is needed.

Explicit OAS3.0 contentType handling and interoperability remain distinct gates;
this feature does not resolve every ambiguity between style and media fields.
Existing saved generated requests are not rewritten automatically; regenerate
the specification to obtain metadata. Complete saved-resource version migration,
schema constraints/unions, compound numeric precision, binary/media/multipart,
provider/platform/raw interoperability, and all original migration/UX/CSS gates
remain required.

## Verification

```powershell
bun run check
bun tests/ui/design-system.js
bun scripts/ui-inventory.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSIONS='3.0.3'
bun tests/ui/openapi-form-body.js
```

Current baseline is retained in
`artifacts/playwright/openapi-form-defaults-baseline.json`. Current inline
generation/wire88 cases across3.0.3/3.1.2/3.2.1 include5 expected refusals,88Git
body round trips,1 exact numeric edit and2 omitted-encoding cases. Compiler
passes with zero errors/warnings after correcting a fixture-only delete
annotation. Headless design-system terminal artifact passes the existing48help
rows/six profiles and shared contracts for unchanged UI components. Production
release1791488156977 finished1791488544091/result0/hash3674864577700837266.
Native form1791488554266 accepts35 groups for3.0.3, including earlier explicit
styles, default bodies, review/runtime refusal, disable recovery, exact wire,
state/history guards and reload. Terminal result is passed/native-hidden,
visiblefalse/native27220exit0; build68226 and scenario11009 exit0. No feature-owned
processes or live handles remain. Actual default flat-object light760 image was
inspected, with complete linked help and intact layout. The saved all-version
scenario defines117 groups; previous3.1/3.2/query/signature native acceptance is
historical, not new evidence from this build. Exact source hash and handoff:
STATUS.
