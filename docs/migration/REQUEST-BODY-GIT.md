# Request body clearing and Git snapshots

Status: verified and committed in a752707; checkpoint ff3d051. Field composition is a separate topic using the same tested release.

Changing Body type passed binary/serialized/cURL properties as undefined, then
merged them into the live body object. Persistence JSON omitted these keys,
while Git snapshots correctly reject non-JSON values. Opening Source Control
before reload therefore failed with JSON-compatible values error.

RequestEditor now applies undefined body patch values by deleting the key.
Explicit values and unrelated fields remain. This corrects the editor mutation
boundary; Git resource validation is unchanged. GraphQL selection still
initializes its existing blank query/variables model.

Evidence:

- Native theme16599/artifact1791556213497 failed after initial native controls
  and completion checks at Source Control Changes wait60s. Actual failure PNG
  shows Git JSON-compatibility error. Native48704 exit0/native-hidden/visiblefalse;
  owned Bun40696/native gone and scoped WebView0. Failed artifact retained.
- Existing saved openapi-serialized-contract.js now mounts real RequestEditor
  via request-body-git.svelte. Baseline rejects ordinary Body type change with
  own binary/_openapiSerialization undefined keys. Original result/progress/PNG
  preserved in artifacts/playwright/request-body-git-baseline; PNG inspected.
- Corrected scenario terminal0: ordinary/serialized/cURL to Text or GraphQL
  gives6 cases. Cleared keys are absent immediately in memory; MIME/text follow
  existing UI behavior, unknown nested data retained, actual Git encode/decode
  round trip succeeds. Original168 composer/11 refusal/8 signing controls pass.
- Independent request-body-git-audit.json verifies six unique cases and literal
  body text/metadata deletion/unknown data round trips. An unrelated undefined
  unknown body field still fails strict Git validation.
- Fixture decode invocation/type annotations were corrected after initial
  harness failure. The initial expectation to retain raw text for GraphQL was
  wrong: existing selection initializes blank query/variables; corrected
  expectation follows the source. These failures are not product regressions.
- Final compiler zero errors/warnings. Seven app hashes, including unchanged
  six Field files and corrected RequestEditor, are frozen in
  artifacts/playwright/request-body-git-source-freeze.json.

Saved commands:

```powershell
bun tests/ui/openapi-serialized-contract.js
bun run check
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/nocturne-native-theme.js
```

Native2580/artifact1791557144758 terminal0/passed14:45:45.162Z–14:49:39.844Z on frozen build1791556752062/finished1791557135005/result0/hash16674050803735312688.12 workflow captures,10 dialogs,6 Field feedback/12 form profiles pass; Git HEAD unchanged. Independent acceptance/seven-source-hash audit passes. Actual dark/light Git900 and cookie images inspected. Native61208 exit0/native-hidden/visiblefalse; owned Bun42584/native gone and scoped WebView0; no live handles.

The tested working set includes the six Field composition files plus corrected
RequestEditor; seven source hashes document the exact release. Body and Field
changes are committed separately by topic. This does not claim a test of the
body commit in isolation from the tested Field working set.

Native checks include opening Source Control immediately after actual Body
type change, before reload; corrected Git Changes and YAML diff render. Native
bridge dialogs/proto/cookie/recovery are retained workflow regression, not real
provider/network or OS file-dialog acceptance. All original migration, UI/CSS,
platform and distribution gates remain required. Commit/checkpoint: STATUS.md.
