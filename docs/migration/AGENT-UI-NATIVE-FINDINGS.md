# Current native UI findings and verified Button correction

2026-10-12. Native candidate copied byte-identically from the provider lane:
`artifacts/native-integrated-3694764-20261012`, root runtime `3694764`,
exe SHA256 `1084af43fcda16310d762478543c3ddc5487aafd52f4b55d7104798535cef6ff`,
worker `54e274cc`, 740 source files and 52 frontend assets. Old candidate and
its provider/API audits remain immutable. It predates the Button correction below.

## Exact provenance

`artifacts/current-ui-native-proof/prelaunch.json` verifies actual runtime import
closure of native rename/GraphQL scripts via Bun.Transpiler.scanImports, exact
captured helper/source bytes, all archived frontend hashes and exe. Regex-based
first auditor mistakenly followed JSDoc type imports; replaced with actual JS
import scanning. Initial local checkout differences were fully checked as ENTIRE
UTF-8 bytes equal after CRLF normalization before copying exact snapshot bytes
into isolated local support/helper paths. Both original bytes/SHA and exact
captured SHA are retained in `line-ending-original/` and
`line-ending-alignment.json`; no functional content was replaced.

The explicitly supplemental profile-preservation wrapper SHA45c74016 is frozen
separately. It is not claimed to belong to the old 740-source snapshot.

## Native negative and conditional GraphQL success

- `run-current-ui-native.mjs` 7e9a59 exits1: native rename56716 exits0,
  native-hidden/visiblefalse, first original unchanged case fails its retained
  exact display text assertion: `" Owned name"` versus `"Owned name"`.
  New focus/no-reopen and workspace checks before that assertion pass; no complete
  native rename acceptance. Outer restoration result
  `resource-manager-restoration-1791779546879` passes: both workspace buffers and
  cookie/store inventory restored/unchanged.
- Independent native GraphQL first0d7a5e exits1: its host exits0/hidden, reads
  intermediate animated color104/133/166 rather than exact101/132/163. Existing
  helper waited only background completion. First restoration1791779771287 passes.
- Root-approved helper now waits BOTH exact foreground/background before the
  unchanged strict color assertion. Supplemental helperE5470f60 is frozen and
  audited4f6848 against every other original consumed hash/exe/preservation wrapper.
- Replay40005/82d641: actual GraphQL host51844 exits0, native-hidden/visiblefalse,
  **17 existing editor groups +8 new Query/Schema profiles pass** in
  `graphql-editor-1791779904906`. Outer runner still exits1 because preservation
  detects one new empty cookie file. Both workspace buffers restore exactly and
  all original653 cookie files/plugin-store hashes are unchanged.

Retained cleanup gate: `wrk_0932ea6647744debbf6e4fdb3e488b1b.json`, 2 bytes `[]`,
SHA4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945,
mtime1791779913722.8076 within the exclusive owned host run. The original scenario
did not capture its imported fixture collection ID and wrapper did not save changed
workspace before restoring, so no authoritative ID-to-filename ownership binding
remains. Root explicitly required retaining the file; **nothing deleted**.
The original failed restoration result and cookie-delta.json stay immutable.
No full GraphQL native acceptance claimed while this cleanup gate is open.
Future wrapper work must capture changed workspace and register actual fixture IDs
before restoration, retaining/failing unknown new files rather than guessing.

Both native negative result/images and original script/helper/Button bytes are
preserved under `artifacts/current-ui-native-negative/`.

## Product correction / saved headless verification

Shared Button's whitespace between its busy conditional and rendered children
injected a leading text node after EditableName adopted the primitive. Root
authorized correcting snippet adjacency rather than trimming the assertion.
Button now preserves exact caller text in both busy states; CSS gap still owns
loader spacing. No layout/token/native/backend changes.

Headless original rename scenario extended with the same exact text assertion
reproduces failure e848c8; source/result/image retained under
`artifacts/button-child-text-negative/`. Corrected rename6b2eff exits0, 18 original
cases +8 keyboard profiles including legacy padded/empty/Unicode names. Saved
design-system58178/110537 exits0:12 busy/nonbusy ×theme/width rows preserve exact
padded Unicode children, spinner/disabled/focus behavior and one Enter callback,
plus the full previous shared control contracts. Check52550/b26eda exits0/0errors/
0warnings; build17998/eb144e exits0; targeted whitespace cceef8 passes.

| Own delta against prior integrated UI/native-prep topics | SHA256 |
| --- | --- |
| `src/lib/components/ui/Button.svelte` | `f91130df73086ca0e04eb8669de34bb6566b14c516db83dd4769a066bf103f04` |
| `tests/ui/editable-name.js` | `bee8247390167c0c41244b6f551c4a8dae9b556490388ea7f7c28fb8736fc891` |
| `tests/ui/design-system.js` | `56090317ea560ba5cc4ef51969c3dcae8808f2712f92b829e824da7e0d1d8091` |
| `tests/ui/fixtures/design-system.svelte` | `bce53304459f7e0e5a061d65bb9808e265816927062fa4925ba52f5efb9c23a2` |
| `tests/ui/helpers/graphql-segmented.js` | `e5470f6031fdff03cb857173e65167cd0446cdeee66db92e8a7cd1c2623d9082` |

Integrate these five paths plus this report only. Do not integrate CRLF-only
provenance alignments or overwrite old proof/candidate directories.

All own task handles terminal, native lane released with its explicit cleanup
gate. Product source frozen for root review/integration. Fresh audited native UI
assets/exe are required before claiming corrected native rename acceptance.
CRUD remains prepared/unrun; isolated last-collection native gate still required.
Full original UI/CRUD/GraphQL/provider/platform/migration scope remains active.
`/compact` unavailable; this is the handoff, not compaction.
