# OpenAPI 3.2 HTTP operations

Status: verified implementation, direct/compiler/Git checks, full native methods
acceptance and fresh generated-query regression.

Analysis now includes QUERY and additionalOperations in validation, preview and
explicit request generation, replacing the prior blanket unsupported diagnostic.
Custom method capitalization is retained in preview, request and native transport
input. Fixed fields keep uppercase wire methods and lowercase sourceOperation
keys. Additional operations retain sourceOperation.additional:true, distinguishing
fixed GET from custom get at the same path. Existing requests are not rewritten.

The installed Scalar path validator visits only the eight original methods.
Each extra operation is projected into GET validation with the same path-level
parameters; diagnostic paths are restored to the real source location. Strict
schema/version validation still rejects invalid tokens, forbidden fixed-method
keys and extra methods on older versions. Duplicate operationId checks include
all operations. Servers, inherited/overridden parameters, bodies and security
use the existing generation pipeline. Current layout/CSS is unchanged.

Primary sources consulted before implementation:

- [OpenAPI 3.2.1 Path Item Object](https://spec.openapis.org/oas/v3.2.1.html#path-item-object)
- [RFC 9110 method semantics](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.1)
- [RFC 10008 QUERY](https://www.rfc-editor.org/rfc/rfc10008.html)
- Installed Scalar official implementation:
  node_modules/@scalar/openapi-validator/dist/validate-path-parameters.js.

Verification:

- openapi-method-baseline.json records prior QUERY/custom refusal.
- openapi-method-source-identity-baseline.json records the initial GET/get metadata
  collision; corrected generation adds the additional-operation marker.
- openapi-method-direct.json passes12 generated/composed targets and12Git round
  trips across3.2.0/3.2.1, with exact case and source identities. Six fixtures are
  GET/QUERY/COPY/custom-METHOD/get/M!x; five of six have JSON bodies. Eleven
  negative controls cover older3.0.3/3.0.4/3.1.2, forbidden POST/QUERY keys,
  invalid/empty tokens, missing QUERY/custom path parameters, unmapped custom
  path parameter and duplicate operationId, with source diagnostic assertions.
- Latest bun run check:0errors0warnings; selected formatting/diff checks pass.
- Fresh production release1791530305299/finished1791530675793/result0,
  fixtureHash4196347993003912469; build65789 terminal0, owned launchers38132/50096
  gone. Source stayed frozen throughout native methods/query acceptance runs.
- Saved native methods20732/artifact1791530863993 passes all6methods/5JSON bodies,
  07:27:44.004Z–07:31:53.081Z. It checks actual owned worker generation, exact
  dropdowns, raw TCP method/target/body, inherited/overridden parameters and
  persisted resources/reload without resend. Independent-method-audit.json
  checks literal methods/targets/bodies, preview labels and distinct metadata.
  Actual custom-heading760 image inspected. Native42480 exit0/native-hidden/
  visiblefalse; Bun51068/native gone, owned WebView profile0, fixture62592
  listeners0. No passing methods scenario restarted.
- Sequential saved query20668/artifact1791531154973 passes all44groups on the
  same build,07:32:34.985Z–07:55:31.074Z, terminal0/native-hidden/visiblefalse.
  Independent-query-audit.json checks33literal generated targets,11edit/runtime
  controls and5pre-network refusals; saved scenario checks persisted resources
  and reload without resend. Both actual760 help images and geometry inspected.
  Native49216 exit0; Bun53956/native gone, owned WebView profile0, actual fixture
  57113 listeners0. Selection recoveries0: conditional timeout recovery branch
  was not exercised. Fresh native coverage is3.2.1; no fresh all-version claim.

Retained attempts and repairs:

- Build75560/start1791529822961/finished1791530240471/result0 preceded the metadata
  repair. Its owned launchers25648/52956 are gone; it is superseded and was never
  accepted for this final feature. Source edits occurred only after terminal.
- Methods84325/artifact1791530686285 failed before wire cases at a whitespace-
  sensitive raw preview-label assertion. Failure image/snapshot showed all six
  exact case labels and diagnostic0; owned-generation-audit.json confirms six
  requests for sourceSpecId spc_f6465f98a45c48f0902a5411c17539ff with correct
  methods/markers. Native45556 exit0/native-hidden/visiblefalse; Bun33000/native/
  profile gone, fixture55714 listeners0. First-attempt raw label bytes were not
  captured. Saved scenario now records raw and whitespace-normalized labels,
  asserting exact full method/path/name. Accepted retry preview-labels.json
  proves newlines between method/path; case is unchanged. Test-only repair,
  compiler0/0, production build/source unchanged. This attempt remains failed.
- The saved preview revalidates after API Design remount before checking labels
  and the exact custom heading; it uses persisted source, not previous view state.
- Initial inline fixture omitted timeout and expected empty GET body text;
  corrected to timeout30000 and existing null-body semantics without product
  workaround. Initial compiler5JSDoc/type errors were repaired; final0/0 above.

Commands:

```powershell
bun run check
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE = 'artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/openapi-methods.js
$env:INSOMNIUM_OPENAPI_VERSION = '3.2.1'
bun tests/ui/openapi-query-serialization.js
```

Saved scenarios use Bun/shared helpers only: browser headless:true, native-hidden,
no browser-use. This feature does not prove provider/proxy/auth-signature/HTTP2
interop, full OpenAPI schemas/media/refs/lint, saved-generation policy, other
platforms or full migration/UX/CSS. Existing method-specific auth policies remain
separate gates. Only QUERY/custom-operation capability is accepted here; all remaining original
migration/UX/CSS gates stay required.
