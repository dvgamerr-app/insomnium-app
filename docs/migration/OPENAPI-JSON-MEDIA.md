# OpenAPI JSON media type recognition

## Behavior

Before this change, content parameters and form fields recognized only the exact
string `application/json`. Legal case variants and parameterized JSON media types
became review rows and scalar examples lost JSON quoting. The shared classifier
now recognizes one syntactically valid `application/json` media type, preserving
the original string in editable serialization metadata and help text.

Query, header, path and cookie content parameters and form field content use the
same classifier. JSON validation, exact edited numeric/string lexemes, location
encoding, Cookie octet validation and review refusals remain enforced. Older
form JSON arrays retain whole-value serialization; OAS3.2 retains per-item rules.
Persisted generated rows are not silently rewritten.

## Primary references and implementation

- [RFC9110 media types](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.1)
  specifies case-insensitive type/subtype matching.
- [RFC9110 parameters](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.6)
  defines token/quoted values, semicolon sections and no whitespace around `=`.
- [RFC8259 JSON registration](https://www.rfc-editor.org/rfc/rfc8259.html#section-11)
  defines no JSON media parameters; a charset parameter has no effect on compliant
  recipients. Recognition does not reinterpret JSON bytes using that charset.

The helper scans parameters linearly. It accepts quoted commas/semicolons,
quoted pairs, legal optional whitespace and empty semicolon sections. It refuses
CR/LF, control characters, unterminated quotes, missing values, trailing junk,
unquoted media lists, wildcards and unrelated media types. Original metadata is
preserved rather than normalized destructively.

## Current evidence — 2026-10-09

- `openapi-json-media-inline.json`: 155 form plus264 parameter generation/wire
  cases across3.0.3/3.0.4/3.1.2/3.2.1;52 expected refusals.
- `openapi-json-media-git.json`:419 round trips compare every serialized request
  field except documented Git-local fields, including original media metadata.
- `openapi-json-media-parser.json`:8 valid/15 invalid/1 long-input controls.
- `openapi-json-media-quoted-pairs.json`:4 additional quoted-pair/obs-text/DEL/
  dangling-escape controls pass.
- `openapi-json-media-array-variants.json`:36 independent literal wire controls
  cover all three valid media variants across four versions with nonempty arrays,
  empty arrays and nullable root null. Original metadata and older whole-value/
  newer per-item behavior remain correct. These are inline composition checks.
- Saved `bun tests/ui/design-system.js`, session92370 terminal0/result passed:
  six headless profiles, ten help rows each, including complete original quoted
  parameterized media text. This does not prove native execution.
- Final `bun run check`:0errors0warnings. Selected Prettier checks passed.
- `bun scripts/ui-inventory.js`: sourceSHA256
  `60fc3f5aafef64a726858f23bb25925c269248d72a9d600f17a9de7bf5a39b19`,
  663 shared markup sites/118 tokens/1719 CSS declarations; no CSS change.

Fresh `bun tests/ui/build-recovery-copy-probe.js` session55774 completed terminal0:
release1791496205618/finished1791496581659/result0/hash16164581620064366542.
All-version native form session25193 completed terminal0/result passed:
artifact1791496588035 contains208 actual records56/56/41/55, with all28 new
valid-media/refusal/disable groups. Native50240 exited0/native-hidden/visiblefalse;
owned scenario/profile processes and HTTP listener were released. Quoted-media
760px images inspected across all four versions with intact quotation marks and
original media guidance. Native content82566 completed terminal0/result passed:
artifact1791499051682 contains239 actual records (66 per3.0.3/3.1.2/3.2.1 plus41
controls). All36 new media groups cover query/header/path/cookie9 each, preserving
original metadata and exact wire values with reloadWithoutResend. Native46316
exited0/native-hidden/visiblefalse; owned scenario/native/profile processes are
absent and raw server cleanup completed. Native URL13405 completed terminal0:
artifact1791501791897 accepts45 raw targets and42 independent signatures,
including4 whole-content controls. Native52788 exited0/native-hidden/visiblefalse;
owned scenario35332/native52788/profile processes are absent. No feature-owned
live handle remains. Reproduction commands for sequential saved
verification against its build-state with `INSOMNIUM_UI_BUILD_STATE`:

```powershell
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSIONS='3.0.3,3.0.4,3.1.2,3.2.1'
bun tests/ui/openapi-form-body.js
Remove-Item Env:INSOMNIUM_OPENAPI_VERSIONS
bun tests/ui/openapi-content-serialization.js
bun tests/ui/url-encoding.js
```

Form208, content239 and URL45 raw targets/42 independent signatures have been
audited against terminal artifacts. Native scenarios hide their owned window
before CDP and report `native-hidden`; all three ended successfully with cleanup.

## Remaining gates

Whole request-body MIME entry selection, text media parameters/non-UTF8 behavior,
structured suffixes, media ranges/lists, binary/base64, nested Encoding Objects,
full schemas/unions/precision, saved-resource migration policy and provider/raw
interoperability remain open. Every original PLAN/PARITY migration, TLS, Git,
storage, desktop, CI/release/platform and UX/CSS gate remains required. Existing
UI layout stays preserved; the subsequent redesign phase remains deferred until
full migration acceptance.
