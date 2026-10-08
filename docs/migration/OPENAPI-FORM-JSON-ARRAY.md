# Versioned JSON array form content

JSON content arrays in OAS3.0/3.1 now retain the entire JSON array as one form
value. An empty array is represented as `color=%5B%5D`. OAS3.2 continues encoding
one value per item, including omission of an empty property array.

## Sources and interpretation

- [OAS3.0.4 Encoding Object](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields-for-rfc6570-style-serialization)
  recommends content mode equivalent to a query Parameter Object using content.
- [OAS3.1.2 Encoding Object](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-for-rfc6570-style-serialization)
  specifies the same equivalence without the older recommendation qualification.
- [OAS3.2.1 encoding by name](https://spec.openapis.org/oas/v3.2.1.html#encoding-by-name)
  explicitly applies encoding per property array item, and to entire other values.
- [OAI discussion2789](https://github.com/OAI/OpenAPI-Specification/discussions/2789)
  links the clarification; earlier comments relying on implicit style defaults
  precede that clarification.

The older whole-JSON-value rule is an interpretation of the content-parameter
equivalence, not an explicit older per-array wire example. Apply it consistently
to the 3.0 family using the previously adopted 3.0.4 clarification. Default media
selection still uses the items schema. Explicit style/explode/allowReserved and
text arrays retain their existing behavior. Text-array mapping and broader
provider/version interoperability remain separate required gates. Do not claim
that the newer 3.2 per-item requirement proves older behavior.

Existing persisted generated rows are not rewritten. Their stored serialization
metadata remains authoritative; regeneration creates version-correct metadata.
Saved-resource migration policy remains required. This milestone supersedes the
older JSON-array convention in OPENAPI-FORM-CONTENT/LEGACY-CONTENT; earlier native
results remain historical. No UI/CSS/backend/dependency changes.

## Evidence and commands

- Baseline: artifacts/playwright/openapi-form-json-array-baseline.json proves
  repeated JSON members and omitted empty arrays for all four versions before fix.
- Inline generation/composition135 with8 expected review refusals across
  3.0.3/3.0.4/3.1.2/3.2.1 passes independent literal wire expectations.
  Artifact: openapi-form-json-array-inline.json.
- Eight edited lexical/empty controls preserve integer/exponent/string escapes:
  openapi-form-json-array-lexemes.json. Initial inline setup omitted timeout and
  failed the existing Preferences guard; rerun with timeout30000 passed.
- Git encode/decode135 request bodies preserve metadata:
  openapi-form-json-array-git.json passed.
- Compiler zero errors/warnings; selected formatting and diff checks pass.
- Production release1791492118810/finished1791492493741/result0 is current;
  all-version native form43899/1791492503995 terminal0 accepts180 actual records
  (49/49/34/48),8reviewed rows, empty arrays and edited lexemes. Result passed,
  native-hidden/visiblefalse/native51168exit0, owned processes/profile released.
  Fresh3.1.2 nullable and3.2.1 per-item light760 images inspected with intact
  guidance/layout. No feature-owned live handles remain.
- Existing URL scenario now adds four whole-JSON-array OAuth1 cases with independent
  wire bodies and signature calculation, alongside existing per-item/style cases.
  URL77353/1791494391567 ran sequentially after form cleanup and passed45 raw
  targets42independent signatures, including4whole-array legacy/standard OAuth1
  HMAC-SHA1/SHA256 cases. Terminal0/passed/native-hidden/visiblefalse/native43100
  exit0; owned processes/profile released. Compiler rerun0/0 passes.

```powershell
bun run check
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/openapi-form-body.js
bun tests/ui/url-encoding.js
```

Run the saved native form scenario for all four versions after the fresh build
finishes; verified180 artifact cases (49/49/34/48). Native host must hide before
CDP and report native-hidden. Browser scenarios stay headless:true. Full schemas,
binary/base64/media/nested encoding/provider/platform and every original
migration/UX/CSS/PLAN/PARITY requirement remain open until independently proven.
