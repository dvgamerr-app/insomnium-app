# OAS 3.0 form contentType clarification

Generation now adopts the OAS 3.0.4 clarification for the 3.0 family. Without
explicit style/explode/allowReserved, form fields use contentType and its defaults:
JSON objects retain their parent field name, JSON strings include quotation marks,
and ordinary text uses form-urlencoded space/plus handling. Explicit style fields
continue selecting the existing RFC6570 serializer and supersede contentType.

## Primary source and decision

[OAS 3.0.4 RFC6570-style fields](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields-for-rfc6570-style-serialization)
identify the ambiguity in 3.0.3 and earlier and recommend contentType-only
serialization when all style fields are absent. The clarification is a
recommendation; this implementation adopts it consistently for 3.0.3 and 3.0.4
generation. The earlier default-style milestone is superseded, rather than a
claim of current conformance. Its original evidence remains in STATUS and
OPENAPI-FORM-DEFAULTS.md.

[The JSON form example](https://spec.openapis.org/oas/v3.0.4.html#example-url-encoded-form-with-json-values)
distinguishes raw text from a JSON string including quotes. The existing modern
JSON/text form serializer now handles legacy generation as well, including
validated lexical JSON edits and represented JSON null/empty objects. Its repeated
array-item mapping convention is shared with the existing modern form behavior;
broader version/provider/raw interoperability remains a required gate.

Legacy string formats `binary` and `byte`, including array item formats, retain
review metadata. This does not implement arbitrary file/base64/media transport.
Clearing the request review flag does not bypass the row guard; disabling the row
allows a manual replacement. Media lists/ranges/parameters, full JSON Schema,
compound numeric precision, advanced encodings, binary/multipart/provider/platform
and every original migration/UX/CSS requirement remain open.

Nullable content guidance must retain both the JSON/null instruction and media
type. The saved headless fixture reproduced the missing media hint before the UI
fix; it extends existing linked Feedback/grid coverage without a CSS change.
Existing saved generated rows are not silently rewritten. Regeneration obtains
the new metadata; a complete saved-resource migration policy remains required.

## Verification

```powershell
bun run check
bun tests/ui/design-system.js
bun scripts/ui-inventory.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSIONS='3.0.3,3.0.4'
bun tests/ui/openapi-form-body.js
```

Baseline: `artifacts/playwright/openapi-form-legacy-content-baseline.json`.
Current inline generation/composition135 across3.0.3/3.0.4/3.1.2/3.2.1 includes8
expected refusals,135Git body round trips,1 exact numeric edit and4 omitted-encoding
cases; artifact: `openapi-form-legacy-content-inline.json`. Nullable help failure
is retained in `openapi-form-legacy-content-help-baseline.json/png`. Compiler
passes with zero errors/warnings. Final headless96643 passes54 help rows across6
profiles, including explicit nullable JSON media guidance. Production release1791489924836/finished1791490302230/result0 accepts native
form1791490308816:98 artifact cases (49each3.0.3/3.0.4), terminal passed,
native-hidden/visiblefalse/native52400exit0. Both nullable editor images exist;
3.0.4 light760 guidance/layout was reinspected. No feature-owned handles remain.
The saved full scenario defines180 groups (49/49/34/48); prior planned108/190
counts were incorrect and have been superseded by actual records/scenario audit. Previous modern/query/signature acceptance is historical.
