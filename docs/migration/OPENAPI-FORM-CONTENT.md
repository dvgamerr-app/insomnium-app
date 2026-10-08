# OpenAPI form content/default values

JSON media recognition supports legal case variants and parameters. Fresh native
form acceptance covers208 groups across3.0.3/3.0.4/3.1.2/3.2.1; see
OPENAPI-JSON-MEDIA.md for exact evidence and limits. Parameter content also passes
239 groups; current signing regression accepts45 raw targets/42 independent
signatures. Earlier native results below do not cover these new media variants.

JSON-array mapping update accepted: OPENAPI-FORM-JSON-ARRAY.md distinguishes
whole JSON values in3.0/3.1 from3.2 per-item content. The earlier shared-array
convention and native evidence below are historical for affected JSON arrays;
current fresh-build180 native and45targets42signatures acceptance is in STATUS.

Modern form properties without explicit style/explode/allowReserved now carry
editable content metadata. Their JSON or text/plain representation is produced
before WHATWG form encoding. An explicit JSON string includes its quotation
marks; a default object retains nested JSON. Array properties encode each item
under the same field name rather than putting the whole array in one field.

The generator derives default media from the declared property/items type:
objects and nested arrays use JSON, ordinary primitives use text/plain, and
absent types or contentEncoding retain the unsupported binary/media review gate.
An explicit application/json type also supports unrestricted JSON values.
Unsupported media, complex text/plain and nested Encoding Objects remain review
gated, with persisted row metadata preventing dispatch after request-level review.

JSON values reuse the existing content serializer's kind checks and lexical
compaction. Validated array text is split without re-stringifying numeric or
string-escape lexemes. Edited large integers, exponents and escape spelling can
therefore reach the wire exactly, including within nested JSON items. Empty
arrays emit no field; allowed JSON null is represented as null, while nullable text null
uses the existing omission strategy. Ordinary manual and explicit-style rows
keep their separate serialization behavior.

KeyValueEditor uses its existing linked Feedback/help grid to explain the media
type and JSON editing. No CSS owner, backend or dependency changes are introduced.

## Primary references

- [OAS 3.0 Encoding Object and default form style](https://spec.openapis.org/oas/v3.0.3.html#encoding-object)
- [OAS 3.1 content versus style mode](https://spec.openapis.org/oas/v3.1.2.html#encoding-object)
- [OAS 3.1 form JSON example](https://spec.openapis.org/oas/v3.1.2.html#example-url-encoded-form-with-json-values)
- [OAS 3.2 encoding by name and repeated array items](https://spec.openapis.org/oas/v3.2.1.html#encoding-by-name)
- [OAS 3.2 default media types](https://spec.openapis.org/oas/v3.2.1.html#encoding-object)

OAS3.0 default-style semantics differ from the modern clarified content mode;
their existing review gates remain. OAS3.2 also applies explicit styles per array
item, which requires a separate correction to the prior whole-property style
behavior; this is an original version/style interoperability gate, not complete.

## Verification commands and current bounds

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

Baseline evidence is retained in
artifacts/playwright/openapi-form-content-baseline.json. Current-source inline
generation/wire65 and Git body-metadata65 round trips pass, plus9 lexical/type/
media/binary/nested/null/name controls. Compiler is0errors0warnings and the saved
headless design-system scenario passes42 linked-help rows across6 profiles,
12 multipart pairs and the prior shared contracts. Native release1791482486447
finished1791482863725/result0/hash18022374636632659402. Native form1791482881448
accepts88 generation/edit/refusal/disable/reload groups (3.0.3/20,3.1.2/34,
3.2.1/34), including both modern lexical JSON item controls. Terminal result
is passed/native-hidden/visiblefalse/native24388exit0; both modern light760
content-editor images were inspected. Same-release query1791483623219 accepts44
groups (3.0.3); URL1791483997582 accepts37raw targets/34independent signatures,
including4JSON-content and4explicit-style form cases. Both terminal results
are passed/native-hidden/visiblefalse/exit0 (52736/32692). Sequence40001 exits0;
owned listeners close and no feature-owned build/compiler/native/scenario
processes or handles remain. Browser scenarios remain headless:true; native
hosts hide before CDP attachment.
The existing URL scenario now includes four JSON form-content OAuth1 HMAC-SHA1/
SHA256 cases in legacy/RFC modes, with quoted repeated values and a manual
duplicate. Independent normalization uses complete raw form bodies; accepted37
raw targets/34 signatures including4content and4style form cases.

Binary/base64 and other form media/ranges, OAS3.0 defaults, OAS3.2 explicit-style
item semantics, multipart parts/headers/nesting, full schema/union validation,
source example numeric precision, external examples/refs/Swagger/lint/provider/
platform/raw interoperability and every original PLAN/PARITY migration/UX/CSS
gate remain required. This feature does not establish full form or OpenAPI parity.
