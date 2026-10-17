# GRAPHQL migration

## Referenced type navigation — 2026-10-16

Introspection target follow-up — 2026-10-17: explicitly selected introspection types now remain eligible in the explorer instead of silently falling back to an unrelated first type. Searching a name beginning with __ also exposes introspection definitions. Their referenced-type links can traverse other introspection types (for example __Type→__Field); ordinary schema lists continue hiding them. Back restores prior selection/filter eligibility. Final compiler0errors0warnings/build0; the existing headless INSOMNIUM_GRAPHQL_NAVIGATION=1 bun tests/ui/graphql-editor.js passes (~2.3s), adding actual jump-callback __Type selection, __Field traversal, Back, hidden default and explicit search checks. No new runner/native build; physical gesture/native/provider/platform and complete GraphQL parity remain open.



Member navigation follow-up — 2026-10-17: CodeMirror Field/Argument/EnumValue references now retain their exact field, field/directive argument or enum member as plain-name navigation state. The Schema definition highlights the AST name range and scrolls it into view; Back restores the previous member, and manual type/directive changes clear it. Descriptions/repeated names cannot capture the wrong text. Directive description prefixes are excluded before SDL parsing. Malformed or over10,000-token definitions still open without a highlight. Existing schema/request replacement resets member history. Installed codemirror-graphql2.2.9 SchemaReference/jump sources and GraphQL AST locations are the implementation contract; no new dependency or generator.

Direct Bun actual-schema checks pass all four reference shapes, repeated description names, absent members/invalid SDL and plain type controls. Final bun run check0errors0warnings; bun run build0. INSOMNIUM_GRAPHQL_NAVIGATION=1 bun tests/ui/graphql-editor.js passes the maintained headless component scenario (~2.3s), invoking the registered CodeMirror jump callback with real schema references, checking all member targets and exact Back restoration alongside prior search/focus/schema-replacement/held-fetch cases. Receipt artifacts/playwright/graphql-navigation/result.json. This does not exercise a physical Ctrl-click gesture, native WebView/network/provider/platform or complete navigation/completion parity. No new test scripts/native build/clipboard operations.



Schema explorer now offers Referenced types links for fields/arguments, implemented interfaces, input fields, union members and directive arguments. Named targets unwrap list/non-null types, deduplicate, omit self-links and sort. Clicking uses the existing schema navigation handler, clears search/directive selection and opens the referenced definition without network access. Sidebar links have bounded scrolling; main layout is preserved. `bun run check` passes0errors/0warnings; `bun run build` passes. An inline Bun inspection verified object/input/interface/union/directive targets against an actual GraphQL schema. Headless mounted reference navigation/Back has bounded coverage in the maintained graphql-navigation fixture; broader legacy/native navigation parity remains unverified; no new test/audit scripts or native matrix. Official type API: https://www.graphql-js.org/api-v16/type/ .

Updated 2026-10-14. Introspection rendering and saved editor/schema workflows are implemented. Historical Windows SDL cancellation/exact UTF8/write-refusal acceptance exists; complete query/schema/import/export/provider/platform parity remains open.

See [current status](STATUS.md), [execution plan](PLAN.md) and [complete parity requirements](PARITY.md). No original scope was removed by consolidation.

## Topic records

<a id="record-agent-graphql-responsive-fix"></a>

<details>
<summary>AGENT-GRAPHQL-RESPONSIVE-FIX</summary>

# GraphQL responsive editor height and captured resize — 2026-10-12

GraphQL panes could clip the real final caret at600px window height because shared CodeEditor host, fallback textarea and CodeMirror imposed180px minimum while the GraphQL split could be120px. The correction is exclusively `src/lib/styles/features/graphql.css`: contextual GraphQL selectors allow those three editor elements min-height0; stacked GraphQL columns use existing space4 padding. Wide columns retain space10, all shared CodeEditor180 defaults and GraphQL panel180/split120 minima remain byte-identical. Fonts/colors/orientation policy/tokens remain unchanged.

The unchanged strict saved caret assertion originally fails at1440×600 (caret481.797–500.984 beyond split bottom445.797). Min-height0 resolves wide query/variables. Stacked space10 leaves17.5px editor viewport smaller than19.1875px caret; reviewed space8 gives21.5px but variables caret still exceeds top by1.4375px. All three source/result/screenshot generations remain frozen separately. Root-approved space4 gives29.5px viewport, accommodating one line plus CodeMirror line padding. No tolerance relaxation, font change or global editor minimum reduction.

SAME reusable split-pane/nocturne-workspace scenario exercises real multiline query and variables, final CodeMirror cursor/input, all clipping ancestors and viewport bounds at1440/900/760×600, dark/light. Twelve caret rows pass. Orientation follows actual split width640 threshold, not window width. Active-axis arrows/focus work; other-axis arrows leave value unchanged. Equality is accepted only when actual min==max (stacked150/150 minima on120px split correctly clamp50/50); original incorrect unconditional-decrease failure remains preserved. This follows existing contract rather than inventing ratio rollback.

Four real captured viewport transitions1440↔760 in both themes pass: actual pointer ID and hasPointerCapture true before resize, actual x↔y orientation changes while dragging, finite bounded ratio, capture false after real mouse-up, focus retained, content clicks work, pointer-events restored, no later resize on unpressed hover. This covers browser Chromium, not native/OS cancellation. Query/variables original values, theme/viewport and split resets are restored in finally.

Retained SAME workspace regression passes collapse6, release12 (6actual release/6synthetic cancel wiring only), storage48/origin refusals9, heavy12profiles/36states/12reloads. SAME saved nocturne-theme baseline passes full current surfaces and16GraphQL selected/focus/token rows. Neither heavy35d7 nor preview5493 nor selected helpere547 changes. Native graphql-editor full acceptance of this NEW product generation remains OPEN; no native launch/profile claim.

Terminal commands/evidence: build e576c2 exit0; first full workspace76507/e465cc exit0; strengthened final workspace2946/79ab1d exit0; full theme57229/ae3581 exit0; final compiler75203/bf0aa7 exit0errors0warnings; standalone saved workspace five-module Bun compile exit0 (61d09f). Independent final audit7c20cf validates259exact F9 source/config/package/lock inputs with only graphql.css changed,48emitted assets/actual workerF9,14imported harness/package/lock files and all raw outputs. `artifacts/graphql-split-proof/final/audit.json` and source/frontend/harness snapshots bind the final proof. Earlier audit schema mismatch for theme result (`passed:true`, not workspace `status`) corrected in artifact auditor only; no saved assertion changed.

Guarded deliverable paths ONLY:

- `src/lib/styles/features/graphql.css`: current root baseline `3db07397bba03caf1351e677ec1bb0c22493c9359f79a583a8fbb92c03ba4bc3` → final `ea1924c592a19ca2a336706f973736641f15abead05a47fa562c86b177450508`.
- `tests/ui/helpers/split-pane.js`: baseline `d68e1b0ec57721dd267a123cffda662f70f97d569edc9af67dbd3adc38da9c5f` → final `2b72a8c5141f3f929160339d3597a6b934b9eac8c85317c8e9ebbc6c9558f859`.
- `tests/ui/nocturne-workspace.js`: baseline `96d8f61ea41bc44029153fcf24d4e1d6990f618332e38f465bcf04cc95e2b2a9` → final `63eaf31a3679855c044df3fca20844da645b992e45e2a4b4e763922a6efaa4a1`.
- This report; previous negative/pending reports may integrate as immutable historical evidence if desired.

Own stale source was archived and replaced with exact immutable root event-focus-input proof259supporting inputs to make compiler/build meaningful. This is NOT a root deliverable overlay: root must retain its newer Event dispatch/runtime work and integrate ONLY the guarded CSS/test delta. Root F9 source generation is explicit; no claim current newer root/native candidate contains this CSS. Baseline/archive and all original negative proofs preserved. Full migration/platform/accessibility/native/historical cookie gates remain open.

All own handles terminal; source frozen for guarded root review/integration/replay/topic commit. Parent owns STATUS and commits. `/compact` unavailable in this agent interface; explicit handoff supplied.

## Root integrated replay

Root independently rehashes259 supporting source inputs,48 assets and14 harness inputs, then integrates ONLY guarded CSS/test paths, preserving newer517723e owned synthetic Event runtime. Fresh root build8ef43b and final compiler43908 pass0 errors/0 warnings. SAME saved workspace5382 passes12 actual query/variables caret rows,4 captured responsive orientation transitions, retained collapse6/release12/storage48/origin9/heavy12profiles36states12reloads. SAME full theme73079 passes baseline and16 GraphQL selected/focus rows.

Original root theme36318 fails strict locator because two lint tooltip elements coexist during typography mutation. Original result/screenshots/source and exact installed CodeMirror addon are preserved under artifacts/graphql-responsive-root-proof/theme-negative. CodeMirror showTooltip writes inline opacity1; hideTooltip writes opacity0 and removes after600ms. Saved theme selector now requires inline opacity1, retaining all original exact background/font/shadow assertions and strict uniqueness. This excludes fading old nodes; no app/source style or tolerance change. Independent exact6-selector-only replacement guard recorded. Current full source/tests/frontend/results: artifacts/graphql-responsive-root-proof/root-audit.json. Native acceptance of this generation remains open. All root handles terminal; /compact unavailable, explicit handoff.


</details>

<a id="record-agent-shared-ui-graphql"></a>

<details>
<summary>AGENT-SHARED-UI-GRAPHQL</summary>

# Shared UI agent — GraphQL selected foreground ownership

2026-10-12. Worktree `E:\.dvgamerr-app\insomnium-agent-shared-ui`.
Root committed the previous rename feature as `af49d71`; this worktree still has
its older HEAD plus copied baseline and that frozen rename delta. Integrate only
the four paths below plus this report. Do not reinclude previous rename files or
any copied baseline. None of the existing three paths is listed in the copied
`artifacts/agent-baseline.json`; their HEAD-relative changes are this topic only.

## Change

GraphqlEditor's Query/Schema SegmentedControl uses the shared selected
presentation. `styles/variants.css` nevertheless overrode its selected foreground
with `--accent`, bypassing the shared `--accent-text` contract from
`styles/navigation.css`. Removed only that four-line rule. Layout, density,
interaction handlers and both selection surfaces are unchanged.

Saved actual-application regression fails before the fix at
`dark/1440/Query semantic selected foreground`: actual `rgb(10, 20, 30)` from
overridden accent versus expected `rgb(101, 132, 163)` from semantic foreground.
Original rule, helper/scenario, failed result and screenshot remain in
`artifacts/graphql-segmented-negative/`.

The reusable saved helper checks the actual GraphqlEditor Query/Schema choices
with Space/Enter activation, exactly one pressed button, real consuming view
change, retained focus-visible, independent local accent/selected/focus tokens,
hover while focused and selected background after focus leaves. Token values and
priorities, theme and viewport restore afterward; Query view restores before
the existing scenario continues. Existing actual-app headless theme and native
GraphQL scripts call the same helper; no new scenario entry point.

## Four changed paths / SHA256

| File | SHA256 |
| --- | --- |
| `src/lib/components/ui/styles/variants.css` | `8ee7386db19ade5fbcac95d4a118d2b1d7cd36e767461ccf7411bbf589b09bc7` |
| `tests/ui/helpers/graphql-segmented.js` (new) | `ad1e9353d06c15f8d18911b45482520c1eaf98b104c2352425e26b238f974284` |
| `tests/ui/nocturne-theme.js` | `b672b3316de1d6ff11c032209e94dd96c0cf735f070d95108c96f4a5c8276c3e` |
| `tests/ui/graphql-editor.js` | `c91ee1e650f0c087da5216f3c556ba1b5f72d2044527d0cc4547f6486cbe29bc` |

## Verification / handoff

- `bun run build`: 335c2b terminal 0, current production static app.
- `bun run check`: session 7147/e2a0e7 terminal 0, 0 errors / 0 warnings.
- `bun tests/ui/nocturne-theme.js`: final session 14495/5f5712 terminal 0,
  existing whole actual-application theme scenario passed. The new helper records
  16 raw rows (8 dark/light ×1440/760×Query/Schema profiles repeated in the two
  existing theme workflows) under
  `artifacts/playwright/nocturne-theme/graphql-segmented.json`; overall result
  under `result.json`. Initial post-fix c4796a/288244 also passed before the
  additional actual-view assertion was added.
- Additional-view assertion initially queried textbox instead of the operation
  name's actual datalist combobox semantics. 528189 failed that selector; corrected
  to its accessible label, without weakening the view-switch assertion. Exact
  helper/result/image preserved in
  `artifacts/graphql-segmented-view-selector-negative/`.
- `git diff --check` for existing paths: 70c9b7 terminal 0.

Product source remained frozen throughout build/compiler/live scenarios. All
agent task handles are terminal; saved fixture browser/server cleanup completed.
Ready for root integration checks/topic commit. Native GraphQL replay of this new
helper was not run; it requires a newly built current Tauri executable and remains
an explicit native gate. No full UI debt or migration acceptance is claimed.

No new subsystem or dependency was introduced; existing shared selected/focus
ownership is documented in the UI README and UI-DESIGN-SYSTEM-DEBT.md.

`/compact` cannot be invoked by this interface. This is the handoff, not compaction.
No following feature was started.


</details>

<a id="record-graphql-rendering"></a>

<details>
<summary>GRAPHQL-RENDERING</summary>

# GraphQL introspection render integration

Updated: 2026-09-29. Endpoint schema fetch now shares async Send rendering. Full GraphQL/migration parity remains incomplete.

## Behavior

- introspectionRequest replaces the user query/body with getIntrospectionQuery and IntrospectionQuery before rendering. User query/variables are never evaluated, including malformed user JSON. Existing separate POST behavior and GraphQL Accept header remain. The renderer resolves URL, headers, auth and environment/dependent response tags; finite HTTP is forced even when the normal request is configured as SSE.
- workspace.execute now scopes both ordinary and introspection sends to the request's collection and owns cancellation before rendering. Both use the response dependency adapter, resolved OAuth and literal transport composition. The original raw request remains the OAuth stale-source reference.
- prepareIntrospection supports explicit resolved inputs while retaining its synchronous compatibility entry point. It strips Accept/Content-Length and installs the schema Accept header after transport composition.
- schemaContext is now a SHA-256 source identity, not a template execution. It includes scoped selected environment, settings, resources and token records; replaces this request with its generated introspection body and ignores its modified timestamp. Query-only edits preserve schema; URL/auth/environment/token changes invalidate it. GraphqlEditor uses this same function, so opening/checking the cache cannot execute prompt/dependent templates.
- Context is computed using the original request snapshot plus acquired snapshot tokens before dispatch and compared against current source after completion. Late results after edits/Stop are discarded. Normal user response/history and body are unchanged; dependent request histories still update normally.
- Guard is deliberately conservative across resources/settings. Unrelated resource changes can invalidate schema; dynamic external files, time/random/prompt values and independently updated response history are not re-evaluated to validate a cache. Refetch explicitly for those changes. No schema is persisted by this cache.

## Sources read before implementation

- https://www.graphql-js.org/api-v16/utilities/ — getIntrospectionQuery/buildClientSchema/introspectionFromSchema.
- https://graphql.org/learn/introspection/
- Archive packages/insomnia/src/ui/components/editors/body/graph-ql-editor.tsx fetchGraphQLSchemaForRequest: generated schema body then Send-purpose interpolation and auth/network pipeline. Original archive stays read-only.

No initialization/new subsystem generator needed; existing GraphQL dependency and renderer reused.

## Evidence

39 inline Bun assertions passed, no saved test scripts:
-18 compiled Svelte/local HTTP GraphQL cases: async URL/environment, cross-collection dependent header, finite POST/Accept/generated query, no user-body prompts/mutation, normal response/history preservation, UI cache match, query-only edits, header prompt Cancel/answer, changed source, HTTP/GraphQL errors, pending-wire Stop and cleanup.
-7 mocked-native introspection OAuth cases: template client ID, invalid user query ignored, token Authorization, cache after acquisition, token reuse/invalidation and cleanup.
-14 existing native dependency/cross-collection OAuth regressions.

Commands via node_repl execFile(shell:false,windowsHide:true): Bun directly launches Prettier on graphql.js/workspace.svelte.js, svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings (0/0), vite build (passed); git diff --check passed with pre-existing CRLF notices. Initial edit command failed parsing due to duplicate variable declarations before any writes, then split and rerun. One fixture assertion incorrectly expected variables to be absent instead of an empty object; corrected and rerun.

No native edits/dependencies/new installer or real user data writes. Fixtures stopped and workers0. WebView/provider/CSP acceptance remains pending.

## Next work

GraphQL editor Validate now uses async preview rendering (see milestone below). Manual OAuth actions, gRPC discovery/send and subsequent WebSocket payloads still need full shared-renderer integration. Streaming dependency completion, native cookie/User-Agent/URL parity and full PARITY.md acceptance remain required.

## GraphQL Validate preview renderer — 2026-09-29

- resolveQuery is now asynchronous, resolves only the GraphQL body with the shared preview session/environment layers, honors body-render opt-out and normalizes string/object variables. Does not evaluate unrelated URL/auth fields, acquire OAuth, open prompts or resend dependent requests; response tags read saved history.
- GraphqlEditor owns an AbortController/revision for Validate, displays pending state, suppresses stale results and disposes on body/context/history/schema change or unmount. Existing query/schema diagnostics remain.
  -39 inline assertions passed:12 real-worker preview cases,9 compiled lifecycle cases extracted from the actual component block,18 introspection regressions. Svelte0/0, Vite production build and git diff --check passed. No saved tests/dependencies/native changes/installer; fixtures stopped/workers0.
- Sources read: https://svelte.dev/docs/svelte/$effect and https://www.graphql-js.org/api-v16/validation/ . Existing renderer reused; no initialization needed. Commands: Bun directly launches Prettier, svelte-check with existing flags, Vite build; git diff --check. Hidden node_repl launch rules retained.
- Probe corrections: schema-error fixture initially bypassed normalization and lacked variables; corrected to run resolveQuery first. Lifecycle probe had a string newline syntax error and an import rejected by the Svelte compiler; corrected to public Svelte import before compiling. Final probes passed.
- Full component DOM/WebView interaction still requires acceptance; extracted lifecycle verification is not a rendered UI test. Existing schema cache conservative/dynamic-source limitations remain. Next: manual OAuth Fetch/Refresh and gRPC/WS payload shared rendering, streaming dependency completion, native transport parity and full PARITY acceptance. Full migration incomplete.

## Native GraphQL editor acceptance — 2026-10-01

- Previous turn progressed through package dependency fixes. Read current STATUS/PLAN/PARITY, GRAPHQL-RENDERING, CodeEditor/GraphqlEditor and existing native saved-scenario helper. Switched to original application parity while external CI/platform gates remain open.
- Consulted official Playwright keyboard/file upload docs and GraphQL utilities before implementation: https://playwright.dev/docs/api/class-keyboard , https://playwright.dev/docs/input#upload-files , https://www.graphql-js.org/api-v16/utilities/ .
- Added owner-authorized saved Playwright JS scenario tests/ui/graphql-editor.js and package script test:ui:graphql-editor. Bun loopback fixture only, actual native Windows WebView/Tauri IPC via isolated existing probe identity; no browser-use/Computer Use/ad-hoc browser tool.
  -14 accepted checks in artifacts/playwright/graphql-editor-1790807788569/acceptance.json: authenticated native introspection, user-body preservation, schema type browser, query completion, operation-variable completion, nested input completion, enum completion, non-object variable lint, rendered validation, hover type navigation+popup cleanup, unknown-field diagnostic, native POST payload/response, reload persistence+session-cache reset, local SDL import.
- Command bun tests/ui/graphql-editor.js actual0. First attempt failed because test expected sidebar POST rather than GQL; second expected word valid instead of real success sentence. Corrected test only; subsequent run passed and expanded14-case run passed. Failure artifacts retained1790807703302/1790807737007. Product code unchanged.
- Accepted artifact artifacts/native-unix-socket-ui-probe/insomnium-fetch-recovery-probe.exe, build-state1790800454260→1790800783641, identity app.insomnium.probe.checkout20260929. Latest packaging changes do not alter GraphQL frontend/native request behavior. This is acceptance on that recorded artifact, not proof of an unbuilt production installer.
- Prettier applied to saved scenario; package script added. Fixture stopped in finally, helper closed owned probe. Scope still PARTIAL: multiple-operation switching, schema invalidation/cancel/errors, JSON schema import/SDL export, GraphQL GET and broader native provider/TLS/platform acceptance remain open. Fixture returns known response; it does not independently execute arbitrary GraphQL queries.
- NEXT extend saved GraphQL scenarios for remaining acceptance, then other original feature parity. CI remote execution/artifact retention/platform distribution remain open; no scope removal. Shared inputs/UX deferred.

## Native GraphQL operation/schema lifecycle and GET acceptance — 2026-10-01

- Previous goal turn made progress with14 native editor checks. Revalidated STATUS/PLAN/PARITY and source schema/current-request guards. Consulted https://graphql.org/learn/queries/#operation-name and https://bun.sh/docs/runtime/http/server before extending fixtures.
- Extended existing tests/ui/graphql-editor.js with multiple-operation variable completion: Other suggests id without filter; switching Find restores filter scope. Full15-check scenario passes at artifacts/playwright/graphql-editor-1790807942978/acceptance.json.
- Added saved tests/ui/graphql-schema-lifecycle.js and bun run test:ui:graphql-schema.12 checks pass at artifacts/playwright/graphql-schema-lifecycle-1790808126132/acceptance.json: native schema fetch; query-only edits retain cache; URL edits invalidate; pending response discarded after source change; HTTP503/GraphQL errors/malformed JSON diagnostics; Cancel closes native request (fixture abort signal asserted BEFORE releasing held response); fresh fetch after Cancel ignores late schema and clears errors; schema actions preserve prior response/history; introspection JSON import; native GET has encoded query/variables/operationName exactly once, preserves original URL query, and sends no body.
- Earlier12-case run1790808068468 passed; expanded abort assertion rerun also passed. One text-edit anchor failed after Prettier changed indentation, before writes; inspected current file and applied corrected anchor. Product code unchanged.
- Accepted same isolated Windows native artifact as preceding GraphQL milestone; fixture uses127.0.0.1 only. Saved scenarios run via Bun/Playwright, no browser-use/CUA. Owned app and fixture close in helper/finally. No real endpoint or production profile used.
- Scope remains PARTIAL: native SDL export/file-dialog acceptance, header/auth/environment-specific schema invalidation, mutation/subscription/protocol/provider/TLS/other-platform and visual parity remain open. URL invalidation does not prove every source dimension; GET fixture verifies transport encoding and response display, not arbitrary server execution.
- Commands: bun tests/ui/graphql-editor.js; bun tests/ui/graphql-schema-lifecycle.js; Bun Prettier; targeted git diff --check. CI/platform/artifact retention and all other original parity remain required; no redesign/shared input implementation before full migration.

## Native GraphQL source context and execution acceptance — 2026-10-01

- Previous goal turn progressed with15 editor +12 lifecycle checks. Revalidated STATUS/PLAN/PARITY and actual header/auth/environment UI/source before continuing. Read https://graphql.org/learn/introspection/ and https://www.graphql-js.org/api-v16/graphql/ before fixture implementation.
- Added saved tests/ui/graphql-schema-context.js:6 checks pass at artifacts/playwright/graphql-schema-context-1790808288788/acceptance.json. Native introspection renders inherited URL and selected environment token/header; header edit and bearer token edit invalidate schema and refetch uses updated wire values; environment switch and active environment JSON edit invalidate and update rendered fields; stored template source remains unchanged.
- Added tests/ui/graphql-execution.js using actual GraphQL.js parse/validate/execute in Bun loopback fixture (not predetermined response):4 cases pass at artifacts/playwright/graphql-execution-1790808380972/acceptance.json. Selected named operation with Unicode variables; serial mutation aliases produce2 then5; partial data plus resolver error displayed in dedicated GraphQL error UI; invalid Int variable fails before mutation (counter remains5). All four native POST payloads and persisted history bodies match independently executed results.
- Commands bun tests/ui/graphql-schema-context.js and bun tests/ui/graphql-execution.js actual0; package scripts test:ui:graphql-context and test:ui:graphql-execution added. Prettier applied. Owner-authorized saved Playwright only; no browser-use/CUA/new product edits.
- Same recorded isolated Windows probe as prior GraphQL milestones; fixtures stopped/owned apps closed. Combined current GraphQL evidence:15 editor,12 schema lifecycle/GET,6 source-context and4 execution cases. Case counts are not a full-parity claim.
- Remaining GraphQL gate includes raw __schema import, oversized/invalid-schema preservation, SDL export/native dialog, close while fetching/cache eviction, richer schema docs/search/a11y/theme/resize, provider/proxy/TLS/cookies and other platforms. Subscription/protocol scope remains as original inventory. CI remote/artifact/platform and all non-GraphQL parity still open.
- NEXT remaining import/schema-browser acceptance, then other missing feature implementation/acceptance from PARITY. Shared inputs/UX remains after full migration.

## Native GraphQL schema import and browser acceptance — 2026-10-01

- Added saved tests/ui/graphql-schema-import.js and package command bun run test:ui:graphql-import. Native Windows probe passes all12 checks: SDL descriptions/defaults/deprecation; hidden introspection types; case-insensitive field/description search with empty/reset states; custom directive details; malformed JSON/SDL, unknown type, GraphQL errors and20MiB+1 byte file rejected while retaining valid schema; raw __schema JSON replacement/error reset; unchanged request/history; Clear schema.
- Evidence: artifacts/playwright/graphql-schema-import-1790808738003/acceptance.json. Command bun tests/ui/graphql-schema-import.js actual0. Same recorded isolated native artifact and helper as preceding GraphQL milestones; no production installer claim. Owned app closed by helper. No product changes or browser-use.
- Official upload documentation consulted before scenario implementation: https://playwright.dev/docs/input#upload-files . Saved buffer-based file fixtures use documented locator.setInputFiles. Prettier applied. An initial read-only script invocation failed because JavaScript String.replace interpreted a replacement-string token; corrected to a replacement callback, no files changed by that failure.
- Combined current GraphQL evidence:15 editor +12 lifecycle +6 context +4 execution +12 import/browser checks. Counts do not establish full parity.
- Remaining GraphQL acceptance: native SDL export/file dialog, close while fetching/cache eviction, keyboard/a11y/theme/resize and provider/proxy/TLS/cookies/other platforms. CI remote execution/artifact retention, packaging platform gates and all other PARITY scope remain open.
- Confirmed AGENTS.md and POST-MIGRATION-UX.md retain owner instructions: reusable input components in src/lib/components/ui and redesigned UX with possible Hoppscotch reference only AFTER full migration. No browser-use; saved per-feature Playwright via Bun.
- NEXT inspect remaining schema cache/lifecycle gates and extend the relevant saved scenario, then continue outstanding original parity. Do not start deferred UX or mark migration complete.

## Native GraphQL cache acceptance — 2026-10-01

- Previous goal turn made progress with12 schema import/browser checks. Revalidated STATUS/PLAN/PARITY, cacheSchema and native scenario helper; consulted https://playwright.dev/docs/input#upload-files before fixture implementation.
- Added saved tests/ui/graphql-schema-cache.js and bun run test:ui:graphql-cache.6 checks pass at artifacts/playwright/graphql-schema-cache-1790808908649/acceptance.json: three request-scoped schemas survive switching; fourth evicts oldest load; replacing a schema refreshes load age without another slot; two11MiB description schemas exceed combined20MiB SDL budget and evict older large entry while retaining fitting small entry; Clear affects selected request only; all four request bodies/history unchanged.
- First run1790808874997 failed only at final body comparison because importer normalizes body with params: []. Recorded failure below and corrected test baseline to actual persisted post-import resources. Full rerun actual0. Product implementation unchanged; same recorded isolated Windows native artifact, not a new production installer. Owned probe closed by helper.
- Commands: bun tests/ui/graphql-schema-cache.js; bun x --bun prettier --write tests/ui/graphql-schema-cache.js package.json. Native cache count and aggregate-byte gates now have UI evidence; remaining GraphQL includes SDL export/native dialog, true close-while-fetching, accessibility/theme/resize and provider/proxy/TLS/cookies/other platforms. Explicit helper window-destroy cleanup does not verify CloseRequested lifecycle.
- Inspection found frontend onCloseRequested handler in src/routes/+page.svelte and capability core:window:allow-destroy; next inspect exact native close permissions/event path before implementing saved close-while-fetching acceptance. Do not bypass lifecycle using force-kill and call it graceful close.
- All other original PARITY and CI/platform gates remain open. Migration goal active; shared components/UX redesign remains deferred.

## Native GraphQL close-while-fetching and reopen acceptance — 2026-10-01

- Previous turn made progress with cache6 checks. Revalidated STATUS/PLAN/PARITY and real +page.svelte onCloseRequested→shutdown→destroy path. Tauri close requires extra permission; destroy bypasses close-request. Product permissions unchanged.
- Added tests/ui/graphql-schema-close.js and bun run test:ui:graphql-close. First phase3 checks pass at artifacts/playwright/graphql-schema-close-1790809313945/acceptance.json: genuine WM_CLOSE reaches frontend shutdown; observed real IPC commands cancel_http, save_workspace, plugin:window|destroy in order; held fixture request aborts BEFORE response release; owned process exits0 without forced cleanup. Second phase3 checks pass at artifacts/playwright/graphql-schema-close-reopen-1790809315639/acceptance.json: request/body/URL persist with no schema response history, session schema absent, fresh native introspection succeeds without error.
- tests/ui/helpers/native-app.js now exposes opt-in requestNativeClose. tests/ui/helpers/native-window-close.js uses Bun FFI user32.dll with exact owned PID, visible/unowned observed Tauri Window class, exactly-one candidate, immediate PID recheck and bounded enumeration. No global broadcasts/title selection/foreign-window actions. Windows x64 only. This is a saved UI test helper; no Computer Use/browser-use tooling or Node/Python.
- Guarded failures are retained below. Early windows included single-instance and Tao event-target windows; class diagnostics resolved main selection. Tauri invoke property is nonwritable/nonconfigurable, so discarded mutation-based observer; final scenario uses documented passive Playwright network events and first proves observer with real load_workspace. No product failure established by those test-harness attempts.
- Existing schema-import12 checks rerun after shared-helper change and pass at artifacts/playwright/graphql-schema-import-1790809349262/acceptance.json. Bun commands actual0; Prettier applied. All owned apps exited and fixture stopped. Same recorded isolated native artifact; no fresh production package claim.
- Scope: Windows WM_CLOSE with active GraphQL introspection accepted; does not establish OS shutdown/power-loss/macOS/Linux close behavior. Remaining GraphQL includes native SDL export/file dialog, keyboard/accessibility/theme/resize, provider/proxy/TLS/cookies and other-platform coverage. Full CI/platform/original feature parity remains open; shared input/UX redesign deferred.
- NEXT continue native export/remaining GraphQL gates where tooling permits, or outstanding original feature work in PARITY. No completion claim.

### Official references consulted for saved close scenario

- https://tauri.app/reference/javascript/api/namespacewindow/
- https://v2.tauri.app/reference/acl/core-permissions/
- https://bun.com/docs/runtime/ffi
- https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-gettopwindow
- https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindow
- https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowthreadprocessid
- https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getclassnamew
- https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-postmessagew
- https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-close
- https://playwright.dev/docs/network#network-events

## Native GraphQL schema keyboard acceptance — 2026-10-02

- Extended existing tests/ui/graphql-schema-import.js with three keyboard checks: Tab from search to types, Home/End selections compared with exact GraphQL printType output, Tab to directive selection, and Shift+Tab back through types to search without a focus trap. Existing import/error/history/clear checks retained.
- Final saved native Windows scenario passes all 15 checks at artifacts/playwright/graphql-schema-import-1790959173048/acceptance.json; result.json confirms successful owned-process exit. Commands: bun tests/ui/graphql-schema-import.js; bun x --bun prettier --write tests/ui/graphql-schema-import.js. Preliminary expanded run also passed at artifacts/playwright/graphql-schema-import-1790959141501; strengthened exact-definition assertions then reran successfully.
- Official reference consulted: https://playwright.dev/docs/api/class-keyboard . Existing isolated native artifact and saved Playwright helper reused; product code/UI unchanged. Node REPL is only the available tool bridge launching Bun; project scripts execute under Bun.
- Scope is keyboard navigation within the loaded schema explorer only, not complete accessibility acceptance. Native export/file dialog, import-button keyboard reachability, screen-reader/focus visibility, theme/resize, provider/proxy/TLS/cookies and other platforms remain open. Full original parity and CI gates remain open; shared input/UX redesign remains deferred.
- NEXT continue remaining GraphQL acceptance or outstanding original feature implementation from PARITY.

## Native GraphQL keyboard import and theme checks — 2026-10-02

- Existing saved schema-import scenario now passes 17 checks: keyboard import activation via real filechooser event, focus-within outline, schema explorer traversal, and light/dark switching preserves exact schema documentation and request/history while changing text color. Final artifacts: artifacts/playwright/graphql-schema-import-1790959400822/acceptance.json, result.json, theme-styles.json, schema-light.png and schema-dark.png. Owned native process exited0.
- Both screenshots inspected: toolbar buttons and import focus outline visible in light/dark at 1440x900; schema pane remains scrollable. Theme screenshots explicitly scroll the import label into view after focusing. Earlier screenshots1790959359548 showed toolbar outside the scrolled viewport, so these checks DO NOT establish automatic keyboard focus visibility after scrolling; investigate that separately. No full visual, contrast, screen-reader or resize acceptance claim.
- Product code unchanged; same isolated native artifact. Commands: bun tests/ui/graphql-schema-import.js; bun x --bun prettier --write tests/ui/graphql-schema-import.js. Official sources: https://playwright.dev/docs/api/class-filechooser and https://playwright.dev/docs/api/class-locator#locator-press . Playwright chooser interception is not an OS file-picker interaction test.
- Native SDL save dialog, automatic focus scrolling, full accessibility/resize/provider/proxy/TLS/cookies/other platforms and all remaining original parity/CI gates remain open. Shared input/UX redesign deferred.

## GraphQL import focus visibility fixed — 2026-10-02

- Reproduced native failure without test-assisted scroll at artifacts/playwright/graphql-schema-import-1790959506379. Hidden absolute file input was not anchored to its label. Scoped src/lib/styles.css rules position the GraphQL import label relatively and stretch its transparent input over that label. Existing visual layout preserved; API Design styles unchanged.
- Fresh isolated native release build finished0 in7m56s: artifacts/native-graphql-focus-ui-probe/build-state.json/build.log and insomnium-graphql-focus-probe.exe. Production config unchanged; this overwrites usual target/release output with probe identity and MUST NOT be distributed as production.
- Saved schema-import scenario passes all17 checks against that new artifact at artifacts/playwright/graphql-schema-import-1790960162694/acceptance.json. Removed scrollIntoView workaround; elementFromPoint now proves focused label visibility in both themes. Screenshots inspected after native run. Keyboard file chooser and schema/browser/error/persistence checks retained. Owned app exit0.
- Frontend build passes. bun run check initially81 errors; corrected all8 errors in edited scenario using JSDoc/tuple types and nullable schema assertions. Remaining73 errors in6 other GraphQL scenarios are recorded in artifacts/native-graphql-focus-ui-probe/check.log. No clean global-check claim; NEXT address those errors, then SDL save dialog/resize/full a11y/provider/platform/original parity.
- Commands: bun run check; bun run build; bun x --bun prettier --write src/lib/styles.css tests/ui/graphql-schema-import.js; documented Bun Tauri build --no-bundle with isolated identifier and beforeBuildCommand:null; INSOMNIUM_UI_BUILD_STATE=artifacts/native-graphql-focus-ui-probe/build-state.json bun tests/ui/graphql-schema-import.js. Official CSS source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position .
- Migration remains incomplete; shared inputs and UX redesign remain deferred.

## GraphQL scenario compiler gate restored — 2026-10-03

- Fixed all73 remaining Svelte check errors across six saved GraphQL scenarios with explicit fixture event/parameter/tuple JSDoc types, a typed callback holder for held close response, and assertions for required wire events/response release callbacks. No ts-ignore, check exclusions, TypeScript application files or removed assertions. Product source unchanged this milestone.
- bun run check passes0 errors/0 warnings. Prettier and targeted git diff --check pass. An initial inline edit script had escaping syntax errors before writing any file; corrected and applied successfully.
- Reran all six edited native scenarios sequentially against artifacts/native-graphql-focus-ui-probe/build-state.json. Every command exited0; seven phase result files confirm owned app exit0. Evidence:
- graphql-editor: 15 checks, E:/insomnium/artifacts/playwright/graphql-editor-1790960356786/acceptance.json
- graphql-execution: 4 checks, E:/insomnium/artifacts/playwright/graphql-execution-1790960368583/acceptance.json
- graphql-schema-cache: 6 checks, E:/insomnium/artifacts/playwright/graphql-schema-cache-1790960387942/acceptance.json
- graphql-schema-context: 6 checks, E:/insomnium/artifacts/playwright/graphql-schema-context-1790960403760/acceptance.json
- graphql-schema-lifecycle: 12 checks, E:/insomnium/artifacts/playwright/graphql-schema-lifecycle-1790960424489/acceptance.json
- graphql-schema-close: 3 checks, E:/insomnium/artifacts/playwright/graphql-schema-close-1790960434035/acceptance.json
- graphql-schema-close-reopen: 3 checks, E:/insomnium/artifacts/playwright/graphql-schema-close-reopen-1790960435988/acceptance.json
- Commands: bun run check; bun x --bun prettier --write <six edited tests/ui/graphql*.js>; INSOMNIUM_UI_BUILD_STATE=artifacts/native-graphql-focus-ui-probe/build-state.json bun tests/ui/<scenario>.js. No new build needed for these test-only fixes.
- NEXT remaining SDL native save dialog, resize/accessibility, provider/proxy/TLS/cookies and other platforms; all other original PARITY/CI gates remain open. Full migration incomplete and shared input/UX redesign deferred.


</details>

<a id="record-graphql-sdl-export"></a>

<details>
<summary>GRAPHQL-SDL-EXPORT</summary>

# Native SDL export lifecycle

2026-10-12: scoped Windows native-hidden acceptance on root generation5c884ed,
executable9b3f05686b830b8dae5140daca7b68a548ce764ab5d87d40df42f1a5e10c1bda,
worker8893751d2adb8de85ea905425a15694be6527817d19644e1f5dfe188383b2811.

Saved scenario: `bun tests/ui/graphql-sdl-export-native.js`, with explicit
`INSOMNIUM_UI_BUILD_STATE=artifacts/native-current-root-5c884-20261012/build-state.json`.
The shared native helper hides its owned host before CDP attachment. The scenario
self-wraps exact workspace/store/cookie preservation and registers the actual
persisted fixture collection before introspection. It tests a real owned Windows
dialog cancellation, exact Unicode UTF8 SDL output, and actual file sharing write
refusal (`os error 32`); each case verifies return focus and unchanged workspace.
Exactly one introspection request and one native reply per dialog case occur.

Runner80120 and host50968 exit0; three groups pass. Compiler95021 reports0errors,
0warnings. Independent auditor357890 freezes the exact consumed sources, results,
saved output and denial sentinel at `artifacts/native-sdl-proof/audit.json`.
Both original buffers, plugin store and654baseline cookies match original hashes;
only one before-absent cookie bound to the registered collection in the changed
persisted workspace is removed. Clipboard is untouched.

The initial filename-readiness failure is retained in
`artifacts/native-sdl-negative-first/manifest.json`. The test polls only the strict
zero-matches filename-control assertion before any filename mutation. Ambiguous
controls, foreign dialogs and other errors still fail immediately. Existing
native chooser ownership helpers and product behavior are unchanged.

Official contract: [Tauri dialog save](https://v2.tauri.app/reference/javascript/dialog/)
and [filesystem API](https://v2.tauri.app/reference/javascript/fs/). Save returns
a selected path or cancellation; actual native write errors remain observable.
No subsystem was initialized and no generator was required.

This accepts the Windows SDL dialog lifecycle only. Full GraphQL parity, other
platforms and full migration remain open. The historical unbound empty cookie is
retained unchanged; its cleanup is not retroactively accepted. Root has no live
handles. `/compact` cannot be invoked by this interface; this is the handoff.


</details>
