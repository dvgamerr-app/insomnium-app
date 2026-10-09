# OpenAPI JSON request bodies

Request generation, editor modes and Format JSON now share validated media type
recognition. Case variants and parameterized application/json preserve JSON string
quoting. Structured +json bodies use generic JSON representation; text/json retains
legacy compatibility. Misleading json substrings such as application/jsonp and
text/plain; note=json do not select JSON handling. Original MIME strings remain
stored and sent unchanged.

Selection prefers exact application/json, then valid application/json variants,
then other recognized JSON representations, then the first offered media type.
Recognized schema-free JSON remains an editable text body. Explicit legacy binary
schemas retain the file workflow. Content parameters/form fields retain their
separate application/json rule.

Primary references:

- [RFC9110 media types](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.1)
  defines type/subtype matching and parameter syntax.
- [RFC6839 JSON suffix](https://www.rfc-editor.org/rfc/rfc6839.html#section-3.1)
  permits generic underlying JSON processing for +json representations.
- [RFC8259 registration](https://www.rfc-editor.org/rfc/rfc8259.html#section-11)
  defines application/json without media parameters. Charset does not change the
  UTF-8 output used by the application.
- [OAS3.1.2 request body](https://spec.openapis.org/oas/v3.1.2.html#request-body-object)
  defines offered content entries. JSON preference is application policy.

## Evidence — 2026-10-09

Base commit6ec693a. Baseline artifact openapi-json-body-baseline.json demonstrates
unquoted Application/JSON string examples, false application/jsonp recognition
and text/plain selected before offered Application/JSON.

New saved scenario initially produced20 JSDoc compiler errors in two test files.
After correcting annotations, bun run check passed0errors0warnings.
openapi-json-body-inline.json verifies80 literal generation/editor-mode/wire
goldens across3.0.3/3.0.4/3.1.2/3.2.1, including MIME preservation, strings,
arrays/objects/null/empty/false/zero/Unicode, schema-free JSON and selection.
Current openapi-json-body-parser-current.json passes68 strict field comparisons
against HEAD and10 body controls; retained historical native field evidence is
not current release proof.
Current openapi-json-body-field-regression.json passes419 field generation/wire
and body/parameter/header/path metadata Git comparisons, including52 expected
refusals. These composition checks do not replace fresh native acceptance.
openapi-json-body-git.json compares all serialized fields for499 requests
(80body155form264parameters), excluding documented Git-local fields.

Fresh production build session40465 completed terminal0:
release1791503770124/finished1791504136984/fixtureHash3522250952580057695.
Native body session51147 completed terminal0/passed; artifact1791504156325 has84
actual groups,21 per3.0.3/3.0.4/3.1.2/3.2.1. Native53136 exited0/native-hidden,
hiddenWindow.visible=false. Qualified native/profile process and listener60002
cleanup counts are0. All8 quoted/suffix760 images were inspected. Original MIME,
body/editor modes, literal wire representations, persisted Format JSON and
reloadWithoutResend passed. Independent acceptance audit matches all84 records
against literal fixtures. Binary session14536 completed terminal0/passed:
artifact1791505281485 has21 actual groups9/6/6 across3.0.3/3.1.2/3.2.1, including
explicit legacy JSON binary schemas,256 raw bytes, manual Content-Type and exit
from binary mode. Native51736 exited0/native-hidden/visiblefalse; qualified
native/profile processes and listener61448 counts0. All3 binary760 images were
inspected. URL/signing session82223 completed terminal0/passed on the same release:
artifact1791505704198 has5 checks,45 raw targets and42 independently verified
signatures, including4 whole-content controls. Native47896 exited0/native-hidden,
hiddenWindow.visible=false; owned scenario49272/native/profile processes and
listener52524 counts0. All feature build/native handles are terminal; no owned
live process remains. Production source stayed frozen across these native runs.

Fresh build and JSON body acceptance passed. Reproduction:

```powershell
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/openapi-json-body.js
bun tests/ui/openapi-binary-body.js
bun tests/ui/url-encoding.js
```

The body scenario accepts84 actual send/reload groups across four versions,
including one persisted Format JSON edit per version. Browser scenarios use the
fixed headless shared helper; native scenarios hide their owned host before CDP
and report native-hidden. Compiler, selected format/diff checks and native
acceptance are complete for this feature. Full migration completion is unproven.

Non-UTF8 text/media-specific semantics, ranges/lists, interactive content choice,
field suffixes, older text-array/provider interoperability, saved generated-row
migration policy, binary/base64/full schemas/precision/references/Swagger and all
original PLAN/PARITY migration/UX gates remain required. No saved rows are silently
rewritten; existing UI/layout and the subsequent redesign sequence are preserved.
