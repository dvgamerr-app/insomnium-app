# OpenAPI external example byte assets

API Design accepts explicitly attached byte files and explicitly requested HTTP(S)
downloads separately from JSON/YAML reference documents. Names resolve against the
containing document URI. Analysis never downloads external examples automatically.
Missing selected assets produce request review issues or parameter-generation
refusal rather than silently substituting schema samples. Unused response examples
do not require loading before request generation.

Request bodies retain base64 bytes, including JSON whitespace, unsafe-integer
spelling and non-UTF8 binary data. Parameter examples currently require UTF-8 and
use the existing serialized parameter metadata. The first named example is used;
choosing another named example remains required work. Example assets persist in
API specifications and round trip through the Git resource codec.

Loaded assets require canonical base64 and distinct resolved URI names, with at
most 32 files and 2 MiB per file. Specifications containing assets also limit the
combined serialized source/reference/example snapshot to 8 MiB. Existing
no-asset specification limits remain. Downloads use the existing transport's
20 MiB response cap before the stricter asset validation; the 2 MiB asset limit
is not a streaming download limit.

The UI uses existing FilePicker, Input, Button and Toolbar components. Downloads
disable cookie sending and storage. Cancel example load cancels owned workspace
work and native HTTP transport. Source/document/collection identity guards reject
stale download results. No new feature CSS is introduced.

Official references:

- [Example Object](https://spec.openapis.org/oas/v3.2.1.html#example-object)
- [Relative references and containing-document bases](https://spec.openapis.org/oas/v3.2.1.html#relative-references-in-api-description-uris)
- [Components Object](https://spec.openapis.org/oas/v3.2.1.html#components-object)
- [Media Type Object](https://spec.openapis.org/oas/v3.2.1.html#media-type-object)

## Typed Object binding

The resolver follows explicit OpenAPI Object fields and typed references,
including structural JSON Pointer targets. It preserves extensions, Link body
data, schemas and arbitrary literal content while retaining valid names beginning
`x-` in component/header/example maps. It follows only references whose source
establishes an appropriate OpenAPI Object role, including actual Example Objects.
Iterative traversal avoids recursive reference descent and limits processing to
200000 node roles.

Saved controls cover component/Paths extension literals, Link requestBody data,
itemSchema and standalone Schema custom vocabulary, requestBody/pathItem/parameter
pointers, response/nested-encoding Header names, root Example documents, escaped
JSON Pointer keys, chains and component names matching literal field names.

## Verified byte-feature release (0c2b79e)

`bun tests/ui/openapi-serialized-contract.js` passes headless, exit0:
8 body/composer/Git byte checks and30 controls, retaining168 serialized checks,
11 controls,8 signing controls and mounted editor/body-Git checks.
`bun run check` reports0 errors/warnings. Selected application/scenario
Prettier checks pass.

Production-profile isolated build2203 finished successfully, start1791567368376 /
finish1791567787504 / fixture hash16865883508688182456. App and scenario source
stayed frozen through all four current runs:

| OpenAPI | Terminal handle | Artifact suffix | Native PID | Fixture port |
| ------- | --------------- | --------------- | ---------- | ------------ |
| 3.2.1   | 9018            | 1791567828962   | 40252      | 51447        |
| 3.2.0   | 32763           | 1791568042370   | 55312      | 59043        |
| 3.1.0   | 22934           | 1791568256225   | 48480      | 56650        |
| 3.0.3   | 26363           | 1791568600076   | 28152      | 50357        |

Artifacts are under `artifacts/playwright/openapi-external-example-<suffix>`.
Each saved scenario and owned native process exits0, with resultpassed,
`native-hidden` and `visible:false`. Read-only checks confirm all four owned
native/profile processes and fixture listeners are gone.

Each run verifies three actual binary/JSON/query request groups, four loading
controls, rename/restore/remove/reattach, persistence/reload, two FilePicker
reference documents and worker Link/response-extension literals. Per-run
`independent-audit.json` checks method/target/base64/SHA-256, authored source/ref
text, asset/reference Git round trips and exact frozen app/scenario/build identity.
Current `artifacts/playwright/openapi-external-final-audit.json` independently
repeats all four audits and current source/build equality:12 request groups,
16 loading controls,16 management actions and8 worker literal assertions.

Current3.2.1 dark/light1440/900/760 images and other three versions' dark760
images were inspected. At760px, expanded three assets plus reference summary
compress editor/preview and clip the empty preview heading. Controls fit, but full
visual acceptance is incomplete. Bounded attachment management/editor-preview
sizing is the required next UI/CSS topic.

Static UI inventory:57 Svelte files,672 shared markup sites,117 tokens and1718
declarations; shared sites increase by8 without new feature CSS or raw controls.
Source hash:
1b03450703f146c001adfd769b2ee821a6b84302194a7508ffb1d97d408acfe3.
Static inventory does not prove runtime, accessibility or full CSS acceptance.

## Retained failures and superseded evidence

Semantic audit reproduced literal mutation and missed typed references before
commit. Failing/fixed controls remain in `artifacts/playwright`, including
components-extension and typed-role cases. Current source/build/final audit are
separate from `-pre-typed-role.json` snapshots. Prior native build14552 and
runs73733/26765/78250/38753/57719 prove only the superseded source; their aggregate
is archived in `openapi-external-final-audit-pre-typed-role.json`.

First-release source/build snapshots use `-first.json`. The later refs/cancel
release and failed native artifact1791564322464 are retained. That scenario failed
during document switching because the fixture request timed out while waiting
for a New document click acknowledgement. Its failure image was inspected.
The corrected scenario creates the destination before downloading and then
selects it, with explicit fixture idle timeout.

The test-only Git JSON key-order comparison was replaced by semantic field
comparison; encoded fields were intact. Harness timeout, duplicate variable and
compiler annotation/formatting failures were corrected. Failed harness runs
are not product acceptance.

## Saved commands

Build the isolated production-profile probe:

```powershell
bun tests/ui/build-recovery-copy-probe.js
```

After the same build handle terminates successfully, use its saved build state:

```powershell
$env:INSOMNIUM_UI_BUILD_STATE = 'artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSION = '3.2.1'
bun tests/ui/openapi-external-example.js
```

Repeat the saved scenario sequentially for3.2.0,3.1.0 and3.0.3. It owns its fixture
and isolated Tauri host. Four loading controls cover HTTP503, pending-download
cancellation, document switching during download and oversized local attachment.

## Remaining gates

Full OpenAPI parity remains required: named-example selection, non-UTF8 parameter
semantics, URI/base/fragment policies, compound media/charset semantics, broader
external parameter-location/native coverage and schema/example precision.
Byte checks do not prove HTTP framing/header fidelity or arbitrary providers.
Download buffering and metadata expansion need bounded-resource review.

The760px panel compression is resolved by the subsequent
[API Design layout topic](API-DESIGN-LAYOUT.md), with fresh geometry/byte evidence.
Every original migration/UX/CSS/provider/platform requirement remains required.
The full migration is incomplete. `/compact` is
unavailable in this agent interface; STATUS records the handoff and actual handles.
