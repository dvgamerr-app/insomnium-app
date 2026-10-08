# OpenAPI query schema allowReserved

## Contract and scope

Query schema parameters retain `allowReserved: true` in their editable
`_openapiSerialization` metadata. Form scalars, joined/exploded flat arrays and
objects, spaceDelimited, pipeDelimited and deepObject use reserved expansion for
data, including object property names. Root parameter names retain strict data
encoding. Valid percent triples retain their spelling/case; malformed percent,
Unicode and control characters are encoded. False/default keeps regular encoding.

The application encodes query-invalid `#`, `[` and `]` before URL assembly.
Reserved `&`, `=`, `+` and commas retain their syntax; users must pre-encode
literal data delimiters. Structural pipe/bracket/space separators remain encoded.
HTTP WHATWG URL parsing canonicalizes raw apostrophes to `%27`. The serializer's
pre-URL result and actual HTTP target have separate independent expectations;
this work does not claim raw-apostrophe HTTP wire preservation or a universal
inverse decoder for ambiguous delimiters.

Shared KeyValueEditor/Feedback links these rules to the actual value input.
Nullable rows retain their JSON/null help alongside the reserved help; compound
values use JSON. Existing editor metadata persists through editing, disabling,
reload and Git encode/decode.

Native screenshot review exposed horizontal help shrinking the value input.
Feature-owned key-value layout now gives help a second grid track in the Value
column. Name/enable/remove remain aligned with the full-width input. Existing
field/spacing/divider tokens own layout; ordinary/multipart rows preserve their
layout. The shared saved geometry helper checks actual bounds and ARIA-owned
help in browser and native scenarios. Six headless theme/width profiles cover30
ordinary/nullable/content/reserved/combined rows and12 multipart text/file pairs.

## Primary references

- [OAS 3.0.3 Parameter Object](https://spec.openapis.org/oas/v3.0.3.html#parameter-object)
- [OAS 3.1.2 Parameter Object and Appendices C/E](https://spec.openapis.org/oas/v3.1.2.html)
- [OAS 3.2.0 Parameter Object and Appendices C/E](https://spec.openapis.org/oas/v3.2.0.html)
- [RFC6570 reserved expansion](https://www.rfc-editor.org/rfc/rfc6570.html#section-3.2.3)
- [WHATWG special query encoding](https://url.spec.whatwg.org/#special-query-percent-encode-set)
- [RFC3986 query grammar](https://www.rfc-editor.org/rfc/rfc3986.html#section-3.4)
- [RFC5849 parameter normalization](https://www.rfc-editor.org/rfc/rfc5849.html#section-3.4.1.3)

No subsystem initialization, dependency or native transport change.

## Verification commands

Run saved scenarios with Bun, sequentially against the successful current
production probe. Native hosts are hidden before CDP; browser fixtures are
headless through the shared helper.

```powershell
bun run check
bun tests/ui/design-system.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
foreach ($version in @('3.0.3','3.1.2','3.2.1')) {
  $env:INSOMNIUM_OPENAPI_VERSION=$version
  bun tests/ui/openapi-query-serialization.js
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
bun tests/ui/openapi-nullable-serialization.js
bun tests/ui/url-encoding.js
```

Exact run states, evidence directories and remaining handles are in STATUS.
`progress.json` reports verified groups only; terminal `result.json` and
`acceptance.json` are required for scenario acceptance. The original reload
timeout was fixed by reopening Query through the actual UI after each reload.
The extended signing scenario exposed a verifier bug: splitting a target on
every `?` truncated legal query data. OAuth1/AWS verification now separates path
and query at the first delimiter only. Production signer/query code was unchanged;
the failed run is retained and acceptance requires the corrected native rerun.
The inline baseline proves the prior generator review refusal. Current inline
artifact `openapi-allow-reserved-inline.json` accepts99 groups across3 versions:
generation, independent serializer/URL targets, metadata Git round trip, encoding
off and composition with existing query/fragment. Saved native query scope is33
generation cases plus11 editor/refusal controls per version. Existing URL signing
scope adds6 reserved-query cases to20 original independent MAC checks.

## Remaining gates

Current production release1791471551768/finished1791472025898/result0 and
fixtureHash8274825441464047177 passed the final saved native scenarios:
query44 groups each for3.0.3/3.1.2/3.2.1 (132 total), nullable50, and URL29 raw
targets with26 independent Hawk/OAuth1/AWS signature cases. Query evidence:
1791472042644/1791472417460/1791472802645; nullable1791473316531;
corrected signing retry1791474770986. Each terminal result passed with native
host hidden/visiblefalse/exit0. Failed signing1791473674729 remains historical
evidence of the verifier bug; the retry supersedes it. Headless design-system
result passed with30 value rows/6 profiles/12 multipart pairs. Final source
compiler41455 passed0errors0warnings; final test-only verifier check is recorded
in STATUS. No production changes occurred after the accepted build started.

Other parameter locations, content/body encodings, Swagger2, full schema/union/
reference/example/name/version/provider/platform interop, other style/explode
combinations (including the existing exploded-flat deepObject guard), and raw reserved wire
interop remain separate gates. This topic does not close OpenAPI, general URI,
UI debt or full migration. All PLAN/PARITY requirements still in the owner's scope
remain required; this topic removes no scope.
