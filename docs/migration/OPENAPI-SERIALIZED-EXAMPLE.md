# OpenAPI 3.2 serialized examples

Status: implemented and verified for the scoped serialized-example feature. Base: `00e1a0f`.

OpenAPI 3.2 Example Objects can provide `serializedValue` alongside `dataValue`.
The first authored serialized example now takes precedence over sampling and
data serialization. Parameter examples already contain the HTTP representation;
media examples contain the document before its destination's outer encoding.
Both levels retain their text and metadata in editable rows. Earlier versions
keep their existing example behavior.

Primary references consulted before implementation:

- https://spec.openapis.org/oas/v3.2.1.html#parameter-object-examples
- https://spec.openapis.org/oas/v3.2.1.html#example-object
- https://www.rfc-editor.org/rfc/rfc5849.html#section-3.4.1.3.1

Query/path examples retain valid authored escapes. Named media query/path values
receive outer URI encoding. Whole-query JSON preserves the authored document,
whole-query form preserves serialized fields, and whole-query text preserves
query delimiters and valid escapes. Empty whole-query text produces a bare `?`.
Header/cookie examples preserve their representation with destination validation.
Raw parameter query/cookie names are labels because names belong in their value.

Bodies preserve authored JSON whitespace, large integer and exponent spelling,
UTF-8 text, form, GraphQL and multipart documents. The composer avoids converting
them into structured form or GraphQL models. Multipart requires one valid boundary.
Body type changes clear the serialized metadata. The existing body code editor
and row Feedback components explain the representation; layout/CSS is retained.

Runtime validation also runs after clearing the request review marker. Malformed
URI escapes, URL parser rewriting (including raw query apostrophes), header
controls, invalid cookie octets, invalid JSON, unpaired surrogates, unsupported
or duplicate charsets and unknown media byte mappings require correction/review.
UTF-8 and US-ASCII media are supported; non-ASCII US-ASCII text is refused.
Fully serialized parameter examples can use media without a data-model mapping.

Verified evidence:

- Corrected baseline openapi-serialized-baseline.json:14 authored representations
  were lost or refused. Initial harness lacked timeout settings; only corrected
  output supports the finding.
- Saved headless openapi-serialized-contract.js:168 literal composer cases
  (21 examples/two versions/two URL modes/two cURL modes),11 direct/runtime
  refusals with review cleared,8 OAuth1 preparation controls, actual row editing
  and linked help at1440/760. Actual760 PNG inspected.
- Git encode/decode42, retained dataValue160/Git40/legacy24, retained whole-query
  headless60+4 and legacy OAuth preparation3 regressions pass. Evidence files:
  openapi-serialized-git-preflight.json,
  openapi-serialized-retained-data-value-preflight.json and
  openapi-serialized-oauth-legacy-regression.json under artifacts/playwright.
- A raw form has no legacy field object: baseline
  openapi-serialized-legacy-hash-baseline.json prepared unrelated empty-object
  hash. The media-aware guard requires explicit RFC mode. Standard native form
  signing requires Hash Body off under existing policy.
- Frozen build1791550545542 finished1791550921642/result0,
  hash5955604144708389583;10 source hashes independently match
  openapi-serialized-source-freeze.json.
- Native3.2.1: artifact1791551656747/handle47459, terminal0/passed,
  13:14:16.757Z–13:28:35.828Z. Native3.2.0: artifact1791554117214/handle91010,
  terminal0/passed,13:55:17.224Z–14:10:04.963Z. Each accepts21 literal groups,
  3 editor/refusal/recovery controls and24 standard Hawk/OAuth1 signatures.
  Independent raw-wire/source/editor/signing identity/generation recovery audits
  pass. Generation recovery1 per version matches accepted sourceSpecId with
  duplicateClickfalse; selection recoveries0. Import-dialog timeout recovery
  branch was not exercised in the passing3.2.0 run.
- All eight actual760px help PNGs inspected. Both natives exit0,
  native-hidden/visiblefalse; owned Bun/native processes and scoped WebViews
  released, fixture59846/51487 listeners0. No live feature handles remain.

Native bridge signatures use generated snapshots and independently recompute
MACs/signatures from captured wire; they do not prove Auth UI interaction.
Cookie assertions cover owned pairs. Editor controls cover invalid query
pre-network refusal/history preservation, disable recovery, raw form editing,
body type metadata clearing and persistence/reload without resend. Native
window cleanup is explicit destroy, not OS-close lifecycle acceptance.

Saved commands (Bun only, native versions sequential):

```powershell
bun tests/ui/openapi-serialized-contract.js
bun tests/ui/openapi-querystring-contract.js
bun run check
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSION='3.2.1'
bun tests/ui/openapi-serialized-example.js
$env:INSOMNIUM_OPENAPI_VERSION='3.2.0'
bun tests/ui/openapi-serialized-example.js
```

Retained failures and corrections:

- Cookie CR/LF negative control exposed trim masking invalid characters.
  Artifact openapi-serialized-cookie-control-failure retained. Full field guard
  and untrimmed values corrected; fresh168+11/editor scenario passes.
- Builds1791549638100 and1791550089167 finished successfully but were superseded
  before native execution by Cookie and OAuth fixes respectively. Their build
  records/source freezes remain; neither supports native acceptance.
- Native3.2.1/artifact1791550991089 failed after12 groups at saved POST
  body-graphql selector; actual sidebar uses GQL. Selector corrected only after
  cleanup, then fresh3.2.1 passed. Four760 PNGs and failure PNG inspected.
- Native3.2.0/artifact1791552654681 failed at15s Body-tab click after raw form
  edit/reload, after21 groups, with no final acceptance artifact. Scenario now
  waits up to60s for owned request/source/text and Body tab, skips an already
  selected tab, verifies body type and checkpoints signatures/edits. Four760
  PNGs and failure PNG inspected.
- Native3.2.0/artifact1791553727170 failed at Import collection click15s before
  generation. Failure PNG inspected. Shared helper uses60s and accepts timeout
  only with exactly one mounted dialog, visible input and Review import button;
  never clicks twice. This branch remains unexercised by passing acceptance.
- All failed native artifacts retained; native exit0/native-hidden/visiblefalse,
  owned processes/profile/fixture ports61301,50351,62745 released. Application
  source unchanged throughout native harness corrections. Passing3.2.1 was not
  restarted after the later wait/checkpoint changes; test revisions differ,
  while application and asserted behavior match the same frozen release.

External examples, selection UI, complete schemas, arbitrary media/charset/byte
mappings, saved-resource/provider interoperability and every remaining original
PLAN/PARITY/UX/CSS gate remain required. Only this feature is verified; the full
migration goal remains active. Commit/checkpoint: STATUS.md.
