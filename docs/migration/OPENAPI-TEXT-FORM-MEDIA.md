# Plain-text media in form content fields

Encoding Object fields previously accepted only exact text/plain. Legal case and
UTF-8 parameter variants were review gated. Form generation and runtime now share
validated text/plain recognition; original media strings remain in row metadata
and help. Scalar text keeps its unquoted representation, arrays retain repeated
item fields, and empty arrays/nullable text retain existing omission behavior.

The media parser now exposes validated, unescaped parameters. Media names and
JSON body recognition remain equivalent to the previous implementation. Text
charset names match case-insensitively; absent charset preserves existing form
UTF-8 behavior. One explicit UTF-8 charset is accepted. Other/duplicate charsets,
malformed media, lists, compound text values and legacy binary schemas retain
review/runtime guards. Non-UTF8 byte encoding remains a required separate gate.
This feature does not add text content parameters at other locations, body-media
selection, general media semantics or saved generated-resource rewriting.

## Primary references

- [RFC9110 media types and parameters](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.1)
- [OAS3.0.4 Encoding Object](https://spec.openapis.org/oas/v3.0.4.html#encoding-object)
- [OAS3.1.2 Encoding Object](https://spec.openapis.org/oas/v3.1.2.html#encoding-object)
- [OAS3.2.1 encoding by name](https://spec.openapis.org/oas/v3.2.1.html#encoding-by-name)

UTF-8 form behavior is the existing application convention. This does not claim
that every text media type defaults to UTF-8 or that text/plain registration
parameters can be ignored as application/json parameters can.

## Verified evidence — 2026-10-09

Base1597c8b/topicbd1cafe. Baseline openapi-text-form-baseline.json demonstrates
three valid variants refused while canonical text/plain sends color=a+%2B.
Compiler0errors0warnings passes after final fixture/scenario changes.
openapi-text-form-inline.json passes539 generation/wire/full-field Git cases
(195form264parameters80JSONbody),72 refusals and4 edited text-array lexical
controls across3.0.3/3.0.4/3.1.2/3.2.1. Large integer/exponent spelling survives;
string JSON escapes decode to the represented text. Non-finite text-number
validation remains enforced.
openapi-text-form-parser.json passes100 media-name and100 JSON-body comparisons
against HEAD,12 text controls,3 direct runtime charset guards,1 nullable omission
and1 legacy binary guard. An initial test fixture used edit instead of editText;
corrected before acceptance. An invalid patch hunk was rejected before applying;
the corrected patch applied successfully.
openapi-text-form-metadata.json independently checks original media and review
flags for all40 new generated text-media cases across four versions.
openapi-text-form-long-parser.json passes a65536-character quoted parameter and
a dangling-escape refusal. These controls do not prove arbitrary input budgets.

Saved form-body now accepts an optional case prefix for reproducible focused
feature acceptance. All fixture operations are generated; selection limits the
main acceptance loop, and existing edited/refusal/disable runtime controls still
run. Artifacts record casePrefix explicitly. Unfiltered full-scenario evidence
must not be inferred from a focused run. New text-media cases add64 groups to the
historical208 full scenario; focused text-media acceptance expects100 actual
groups25 per version, including lexical edits and request-review refusal/disable
controls. Both planned counts must be checked against actual artifacts.

```powershell
bun run check
bun tests/ui/design-system.js
bun scripts/ui-inventory.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_CASE_PREFIX='text-media-'
bun tests/ui/openapi-form-body.js
Remove-Item Env:INSOMNIUM_OPENAPI_CASE_PREFIX
bun tests/ui/url-encoding.js
```

Headless design-system33163 completed terminal0/result passed; independently
audited66 help rows (11×6 profiles), including original parameterized text media.
Source inventory14451fa109a1588659898b5f8f50466afdf4d5c09230cb530f773aec8d34b9cb
retains663 markup sites118 tokens1719 CSS declarations. Selected format/diff pass.
Fresh build68090 completed terminal0, release1791506667570/finished1791507034333/
result0/fixtureHash18324578121437904848. Focused native form43995 completed
terminal0/passed: artifact1791507041545/casePrefix=text-media- has100 actual groups,
25 per version. Independent audit checks40 selected fixture rows,20 reviewed
refusals,20 disable recoveries,4 lexical edits and36 retained runtime controls.
Native44688 exit0/native-hidden/visiblefalse; qualified native/profile processes
and listener59844 counts0. All4 quoted text-media760 images inspected. This proves
focused acceptance, not the unfiltered272-group scenario. Signing88453 completed
terminal0/passed: artifact1791508848934 has49 raw targets46 independently verified
signatures5 checks, including4 text-content HMAC-SHA1/SHA256 legacy/standard cases.
Native52940 exit0/native-hidden/visiblefalse; scenario50272/native/profile processes
and listener53164 counts0. Final feature-owned process/listener audits0. No live
build/headless/form/signing handles remain. Production source stayed frozen.
Saved URL/signing now adds4 parameterized UTF-8 text-array controls with independent
literal raw bodies (Unicode, number, boolean and duplicate manual field), covering
OAuth1 HMAC-SHA1/SHA256 in legacy/standard modes. Actual49 raw targets46 independent
signatures passed fresh native acceptance. Compiler after this saved-scenario
change passes0errors0warnings; production source remains frozen.
Production source must stay frozen during native acceptance. All browser launches
use the shared fixed headless helper; native hosts hide before CDP and report
native-hidden. Preserve existing UI/layout; no CSS/backend/dependency change.
Every original PLAN/PARITY migration/UX gate remains required, including older
text-array/provider interoperability, non-UTF8, all locations/media/ranges/lists,
saved-resource policy, schemas/precision/refs/Swagger/binary/base64 and broader
TLS/Git/storage/CI/release/desktop/platform/UX-CSS gates. No full completion claim.
