# OpenAPI explicit form-body styles

An explicit `style: form, explode: true` array previously required whole-request
review and, after review, sent one JSON-array field. It now generates an editable
JSON row carrying form serialization metadata and sends repeated field names.
Flat objects, non-exploded lists, space/pipe delimiters and deepObject expansion
also use their Encoding Object settings.

`openapi-style.js` owns flat RFC6570 value expansion shared by query and form.
Each destination owns its atom encoding. Form preserves allowed reserved syntax
and valid percent triples when requested, while encoding literal `&`, `=` and
`+` so they retain data meaning. Root names remain strictly encoded. Nullable
form values/empty containers follow the existing explicit omission strategy;
represented empty strings, false and zero stay distinct. Nested values and invalid
JSON/kinds/undefined style combinations refuse before dispatch. Ordinary manual
body rows keep URLSearchParams serialization and can mix with generated rows.

The generator records `formBody` on rows with explicit style/explode/allowReserved
Encoding Object fields. Their contentType is ignored in accordance with this
mode. Remaining default/content-based form properties retain their review gate.
The shared KeyValueEditor links JSON/style/null/reserved guidance using existing
Feedback and owner-spaced help geometry, with form-specific delimiter advice.
Editing and disabling preserve metadata; no new styling owner or CSS override.

## References and saved commands

- [OAS 3.0 Encoding Object](https://spec.openapis.org/oas/v3.0.3.html#encoding-object)
- [OAS 3.1 Encoding Object](https://spec.openapis.org/oas/v3.1.2.html#encoding-object)
- [OAS 3.1 form percent-encoding](https://spec.openapis.org/oas/v3.1.2.html#appendix-e-percent-encoding-and-form-media-types)
- [OAS 3.2 URL percent-encoding](https://spec.openapis.org/oas/v3.2.1.html#url-percent-encoding)
- [RFC5849 form-body signature parameters](https://www.rfc-editor.org/rfc/rfc5849.html#section-3.4.1.3.1)

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

Baseline source evidence is retained in
`artifacts/playwright/openapi-form-body-baseline.json`. Current inline checks
accept45 form generation/wire examples,45 Git metadata round trips,99 existing
query cases and8 refusal/manual-mix/disable controls. Compiler returns0/0;
headless design-system accepts36 linked-help rows across6 theme/width profiles,
12 multipart pairs and prior shared UI contracts. Fresh production release
1791480370156/finished1791480783337/result0/hash15359465130268573711 accepts
native form1791480842884/60 groups across3.0.3/3.1.2/3.2.1. Its terminal result
is passed/native-hidden/visiblefalse/native46268exit0. Actual light760 images
for3.0.3 and3.2.1 were inspected. Same-release query1791481315749 accepts44
groups (3.0.3); URL1791481663110 accepts33 raw targets/30 independently checked
Hawk/OAuth1/AWS signatures, including four form-body HMAC-SHA1/SHA256 cases in
legacy/RFC modes. Both terminal results are passed/native-hidden/visiblefalse/
exit0 (52372/47480). Sequence9404 exits0; owned listeners close and no
feature-owned build/compiler/native/scenario handles remain. Browser scenarios
remain headless:true; native hosts hide before CDP attachment.

The saved native scenario checks15 generated fields plus5 edit/refusal/disable
controls per version (60 across3.0.3/3.1.2/3.2.1), actual linked help and raw HTTP
body, exact resource/history refusal guards and reload without resend. Query and
signature regression scenarios run sequentially on the same artifact.
The existing URL scenario additionally verifies four OAuth1 HMAC-SHA1/SHA256
form bodies in legacy/RFC modes from complete raw wire bodies, with generated
and manual duplicate names; its existing26 signing cases remain. Native acceptance
includes33 raw targets/30 independent signature cases as audited above.

Default/contentType form encoding, arrays of JSON/media values, binary/base64,
multipart fields/parts/headers, required-body policy, complete schemas/unions/
numeric precision, Swagger, external examples, other media negotiation/ranges,
provider/platform/raw interoperability and every original PLAN/PARITY migration/
UX/CSS gate remain required. This feature does not close full OpenAPI or UI debt.
