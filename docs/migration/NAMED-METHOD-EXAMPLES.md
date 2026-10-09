# Native named examples for custom HTTP methods

This extends the existing saved raw-TCP method scenario. Application/CSS code is
unchanged from3cdbd18. Full migration and UX/CSS remain active.

Official reference consulted:
[OpenAPI3.2.1 Path Item Object](https://spec.openapis.org/oas/v3.2.1.html#path-item-object).
additionalOperations keys retain exact method capitalization.

Commands:

```powershell
bun run check
$env:INSOMNIUM_OPENAPI_VERSION = '3.2.1'
bun tests/ui/openapi-methods.js
$env:INSOMNIUM_OPENAPI_VERSION = '3.2.0'
bun tests/ui/openapi-methods.js
```

The optional named fixture creates conflicting first/second examples. The actual
native UI selects17 operation-scoped choices. Fixed GET chooses second path/query,
while additional lowercase get explicitly chooses first path/query; both choices
use the same source method spelling but distinct additional-operation identity.
QUERY/COPY/custom-METHOD/M!x select second examples and five JSON bodies retain
their operation-specific kind. An inherited query parameter is overridden for
custom-METHOD. Raw TCP captures exact case-sensitive method/target/body.

Inline preflight12 selected cases across both modern versions passes; default
first/wrong controls prove selection affects generation rather than merely
preserving an unchanged sample. Original singular fixture remains available.
Initial4 fixture JSDoc compiler errors were corrected; compiler0errors0warnings.

Accepted production build59214 is reused with exact original successful build
state and unchanged462 app hashes. Executable SHA-256:
a665b19e4b77872f0d1e9d588b03ab51e9083332312fc49c47002cf6199c4541.
openapi-named-method-source-freeze.json records462app/206scenario hashes at
base0d441cb. No app/scenario edits during native acceptance.

Native3.2.1 handle32872/artifact1791576458500 passed6cases/17choices, terminal0,
native2076 exit0/native-hidden/visible:false. Independent audit checks literals,
source/preferences, canonical Git, provenance and current source/build hashes.
Each Send preserves resources and reload does not resend. Owned native2076,
matching WebView profile and fixture listener54839 are absent. Existing helper
recovered one New document click timeout after exactly one owned document was
persisted and selected; no duplicate click. Actual760 image inspected: exact
custom method heading is visible, example controls are below the fold. This
does not constitute additional control geometry or full layout acceptance.

Native3.2.0 handle62408/artifact1791576794148 also passed6cases/17choices,
terminal0/native6932exit0/native-hidden/visible:false, finished20:18:34.830Z.
Independent source/build/literal/provenance/Git audit passes; owned6932, matching
WebView profile and listener64040 absent. Existing helper recovered one owned
New document acknowledgement timeout without duplicate creation. Actual760 image
inspected with the same viewport limits above. Both saved handles reached exit0;
no live feature handles. Aggregate openapi-named-method-final-audit.json passedtrue
combines12cases/34choices with both per-run source/build and owned cleanup audits.
Artifacts are under artifacts/playwright/openapi-methods-<suffix>; each contains
acceptance.json, fixture.json, result.json, named-method-independent-audit.json
and named-method-cleanup-audit.json.

Remaining required scope: external parameter locations/nonUTF8, URI/base/fragment
and media/charset/schema/resource policies, older content/example policies and
all original provider/platform/storage/plugin/transport/Git/recovery/CI/release/
distribution/migration/UX/CSS gates. No broader interoperability/HTTP2/OS-close
claim. /compact is unavailable in this interface; STATUS records the handoff.
