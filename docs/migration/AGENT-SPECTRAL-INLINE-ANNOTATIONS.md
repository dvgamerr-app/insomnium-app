# Optional accepted semantic editor annotations — 2026-10-12

Scoped CodeEditor change; parent ApiDesign/Spectral producer owns source catalog, native job admission/cancellation/reap and accepted current workspace/source lifecycle. No ApiDesign, native, producer, dependencies, provider, CSP or vendor files changed here. Root baseline CodeEditor SHA2d3d4be9df682d2c77425f0a71f2718e9e5a8002ad4530d0ddee032e3c94df62 was captured byte-exact before edits.

## Prop and behavior

Optional `semanticAnnotations = { identity, source, diagnostics }`: identity is the existing editor identity; source is the exact raw displayed value snapshot. Parent passes only accepted diagnostics for that captured source. Each diagnostic has numeric severity0/1/2/3, optional string/number code, string message and zero-based `range.start/end.{line,character}`; optional source/path metadata stays on annotation but the editor never resolves/fetches a URI.

Marks apply only when identity and raw source match current props AND actual CM text matches the snapshot under CodeMirror line-ending interpretation. Canonicalization is comparison only: no raw value rewrite. Positions use actual CM lineCount/getLine and UTF16 character offsets, clamp oversized coordinates, reject invalid/noninteger/negative/reversed ranges (including reversal after clamping). Code0 survives. Plain-text tooltip messages show severity plus code/message; no messageHTML injection. Accepted readonly snapshots can show semantic marks.

Original GraphQL parser function is byte-exact apart from its name. Its mode/readOnly/size/template exclusions remain; optional annotations merge with parser findings. Omitted semantic prop leaves existing parser behavior intact. Parent presence/absence controls semantic preference; no invented persisted setting. Source/identity changes or real input remove stale marks; public performLint also handles an edit before parent props settle. Existing patched addon owns cleanup; lint:false/disposal clears marks and active popup.

## Measured glyph correction

V2 actual accepted info/hint markers were16×16 empty divs with background:none, while error/warning retained upstream PNGs. Root reviewed the measured gap before CSS changes. Local shared-code-editor selectors now render info `i` and hint `?` using existing accent/text/muted/font tokens, inside unchanged16×16 boxes. Nested multiple markers receive no duplicate pseudo glyph; original error/warning/multiple grouping stays intact. No new tokens, SVG generation/library, vendor modification or global DOM API change.

## Saved acceptance

SAME `bun tests/ui/nocturne-theme.js` extends only one import/call after all original Bun lint ownership cases. Existing lint-tooltip.svelte keeps default Query/Schema behavior and adds opt-in semantic fixture controls; new reusable helper semantic-inline.js verifies:

- Exact four numeric severities, numeric code0, optional code, full multiline positions with actual CM sticky:null metadata, CRLF/BOM/astral raw value retained and no annotation-driven onchange.
- Malformed/reversed/severity4 refusal; real user input and source/identity changes remove stale marks; readonly accepted source retains them; removing semantic prop keeps actual GraphQL parser syntax error. Both parser+semantic annotations coexist.
- Dark/light glyph token propagation, exact16×16 geometry, unchanged error/warning PNGs, one grouped severity glyph/no nested duplicate, and actual visible tooltip severity/code0 text.
- Semantic popup remains one after typography reflow. Keyboard invalidation of editor A while pointer stays over editor B preserves B popup/marks. Keyboard disposal closes active popup with bounded removal. The original standard two-editor stationary reflow/unmount oracle remains unchanged.

The semantic fixture supplies accepted-shaped data; it does NOT run the actual Spectral host, prove producer/native source acceptance or identify external sources. Its reflow case checks one popup across the transition; no extra claim of repeated trusted mouseovers. Original production theme verifies both themes and GraphQL selected controls; original Bun fixture shares the pinned addon generator. SAME workspace scenario retains API18/Runner18 carets, executed Runner6tests/6profiles, GraphQL12/4, collapse6/release12/storage48/origin9/heavy12/36/12reload assertions and exact private preview restoration.

Final compiler33605/17e807 terminal0errors/0warnings; fresh builda8b9f8 terminal0; source prelaunch4a1f69 freezes260source/23harness/49ordinary assets; theme70953/8efb58 terminal0; workspace97963/d9af97 terminal0. No overlapping own build/check/scenario or source edit while live. Audit1f5479 rehashes every input/current file/output and verifies original parser body and original saved theme body (minus the single added import/call).

Failures retained: first24775 compiler rejects seven new helper typing/font-evaluate errors;5459 later rejects one callback cast after formatting; corrected through named typed element without assertion changes. V1 theme59923 has correct actual ranges but fails exact endpoint equality because CM adds sticky:null; V1 source/result/bundle/screenshot preserved, expected metadata explicitly added. V2 passes complete mappings/lifecycle but exposes invisible info/hint glyphs; old V2 source/styles/results preserved before reviewed correction. V3 glyph/cross-owner pass preserved before final extra token-color/visible-code assertions. No product failure was hidden by relaxing ranges or original ownership assertions.

## Exact guarded handoff

- `src/lib/components/CodeEditor.svelte`:2d3d4be9df682d2c77425f0a71f2718e9e5a8002ad4530d0ddee032e3c94df62 →60e7bac747d49ff5fdc894fd0aadc3fbdee0206c9f0f6f1b5bb4478dd50753ba.
- `tests/ui/fixtures/lint-tooltip.svelte`:37c7733742e0979c042a703566e80c6a34ad073d5ffbfbbea5bf312957e2604a →60a8d016ce1185fd572448dc6abfe514ca80fae6033b2095c3a53da21541a970.
- `tests/ui/nocturne-theme.js`:e21ef689939b3a3f830f2ff61d48dbc849cbf17275e3d9da6bae82e5f999a5d5 →f8dd04dceab9fe618d8e0519c262cfa84b4d44f4efbda77865fbe4cdfbe72e9c (only one import/call).
- NEW `tests/ui/helpers/semantic-inline.js`:bbd230730c378813a8c900b0540857d98e5568281a3add2cb6fafc80947184ee.
- This report is fifth deliverable. Do not carry copied baselines/stale Event/runtime or unrelated worktree differences into root.

Final `artifacts/semantic-inline-proof/final/audit.json` SHA0bc7742d7da224e96cc128a9af63c939a79bbdffa31a20a505f8d04f7d8467ae. Mapping sourceHashes→final/source-snapshot, harnessHashes→final/harness-snapshot, assets→final/frontend-snapshot, outputs→final/output; baseline hashes/files under baseline; V1/V2/V3 immutable evidence nearby. Production source closure remains own previous F9 generation plus this scoped UI delta; whole newer root Event generation is explicitly NOT claimed. Root must integrate guarded delta preserving current e971/Spectral/Runner and build its current generation; native588 predates this change.

Official contracts consulted: [pinned CodeMirror lint addon](https://raw.githubusercontent.com/codemirror/codemirror5/5.65.21/addon/lint/lint.js), [Svelte effects](https://svelte.dev/docs/svelte/$effect), [Spectral API](https://raw.githubusercontent.com/stoplightio/spectral/develop/docs/guides/3-javascript.md) and actual pinned @stoplight/types zero-based positions/severity enums. Existing addon/license pins and Vite/Bun shared transform remain unchanged.

Remaining: parent native host/source-catalog acceptance, actual SDK→ApiDesign list/range/reference navigation/generation refusal, source/workspace stale native lifecycle and privacy, packaged/native/platform acceptance and original full migration/UX scope. No native profiles/hosts/claim, no live own process handles/listeners. Root owns topic commit/STATUS. `/compact` is unavailable; explicit frozen handoff without claiming compaction.

## Root current acceptance

Root independently rehashed complete agent immutable source/harness/assets/output and guarded five paths. Original saved theme body remains exact after removing only added import/call; current e971 Wheel, Runner helper/workspace, native factory, Vite and root dependency files stay byte-exact. Fresh root compiler72605 has0errors/0warnings; build96962 terminal0. Frozen generation before saved suite49400; production theme plus Bun fixture and workspace both exit0. Full severity/range/BOM/CRLF/astral/stale identity/input/readonly/parser coexistence/glyph/ownership checks pass; original Runner execution and workspace restoration remain exact. Proof artifacts/semantic-inline-root-proof/root-audit.json. This accepts editor rendering only, not actual native Spectral integration. Allroot handles terminal. Native repository/ruleset generation acceptance remains open; parent audit requires more than binding ID or HEAD. /compact unavailable; explicit handoff.
