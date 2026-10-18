# TEMPLATING migration

Updated 2026-10-15. Recursive Send, per-collection environment selection, finite cross-collection dependencies, introspection and tag/editor integrations exist. Remaining caller/protocol/concurrency/provider/platform compatibility stays required.

See [current status](STATUS.md), [execution plan](PLAN.md) and [complete parity requirements](PARITY.md). No original scope was removed by consolidation.

## Current environment lifecycle work

Verified source:6349100. The existing environment dialog now preserves imported textual property ordering and saves fresh recursive dataPropertyOrder; folder editing synchronizes environmentPropertyOrder with identical validation precedence/messages. Public/private creation and draft editing, color/save/clear, sorted lists and scoped reorder are implemented. Sub-environment duplication uses the audited14-model exclusion/subtree/reference policy, preserves ancestry/private data/order and fresh descendant IDs; Base duplication/deletion is disabled. Deleting a selected environment refreshes filtered HTTP responses when selection falls back to Base. Numeric/escaped/prototype keys, tied/missing sort keys and private Git serializer refusal have independent pure checks.

Legacy references: models/environment.ts:95–108; common/database.ts:127–150; workspace-environments-edit-modal.tsx:303–308/361–377/427–475/509–520; environment-edit-modal.tsx:42/60. Primary references: [Svelte state](https://svelte.dev/docs/svelte/$state), [derived state](https://svelte.dev/docs/svelte/$derived), [JSON.parse](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse), [Playwright input](https://playwright.dev/docs/input)/[locators](https://playwright.dev/docs/locators), and [Nunjucks configure](https://mozilla.github.io/nunjucks/api.html#configure). Legacy/current throwOnUndefined:true rejects direct null/missing output; actual refusal controls retain this behavior. Successful inheritance bodies author an explicit default filter while preserving stored null/false/zero values.

Final compiler54172 passes0 errors/0 warnings. Earlier compilers89051/9302/18636/73596/89734/91019 pass within their recorded source stages. Frontend build passes; headless template-tag-environment-environment-lifecycle-1792000001 retains original4 template/context checks plus Name6/JSON12 (0000 passed before the folder extension). Normalized original preview callback is byte-exact; native adapter preserves original Name assertions. Headless resource-manager-environment-lifecycle-1792000000 retains6groups/24refusals with exact corrected ordering metadata. Installed strict Nunjucks null/default/context checks independently pass. Saved fixture output labels are bounded ASCII; default paths remain unchanged and historical receipts are preserved.

Final normal-hook build74021 at artifacts/native-resource-crud-audit-probe/environment-lifecycle-attempt-5 finishes0/Rust6m41 with complete source/package/private-input closure. Executable SHAa2250634e247717bf7f761036139e80ead24706b11936283bf0f8f53c5a3a121. Final combined fullsource recheck96713 passes after allthree scenarios and before any source/doc edits. No owned build/native/profile handles remain.

| Final saved scenario | Direct evidence | Host/restoration |
| --- | --- | --- |
| Environment24598 | template-tag-environment-native-1792009827090:29checks; Name6/JSON12+4 nonobject refusals; strict null/missing2; exact inheritance5; remembered Base/sub selection; originalforeign4+held target-switch/edit snapshot1; selected subtree deletion/filter fallback;12 actual connections allclosed without force | Host38260 exit0/native-hidden; restoration1792009826867 exactf0/d8 buffers, original4resources/history0/protected inventory;2 registeredcollections/selective emptycookie cleanup |
| CRUD53012 | resource-manager-native-1792009801060: original6/field24/correction6/collection6, exact newly required folder ordering map,14 exclusions/15 references,1 actual Send/1 abort | Host25200 exit0/native-hidden; restoration1792009800837 exactf0/d8 buffers/protected inventory |
| HTTP79956 | response-history-native-1792009871527: originalseeded6/body36/controls18;54 actual sockets retire without force | Host42848 exit0/native-hidden; restoration1792009871312 exactf0/d8 buffers/protected inventory |

Root independently audits counts, actual current buffer hashes and absence of owned hosts; agent read-only audits independently rehash archived original buffers and compare source/receipts. Both original hashes remain f0b51e39011ac5a8beb8d2e4a364ffe1362bbea52f7c0c06ba1f12afc9b072b9/d8b032c2f61cb71a69d2576d9b250d390ec3b3a149b6574cc74f48b79e4befc2. Profile ownership is honestly reconstructed from10 retained proofs, never a fresh initial absence. Fixture servers stay alive through native host exit, then verify actual observed socket retirement before cleanup. Explicit window destroy does not establish OS-close lifecycle acceptance.

Limits remain explicit: the fixed profile has4 original resources/history0, not the separate global654 profile. Initial nested/folder topology is imported owned fixture data before actual edit/copy/select/Send. Caller-Base response reuse has an explicit imported history seed, not native acquisition. CSS widths are not physical-width/AT/platform proof; five entry layout keys are restored, not every beforebirth/WebView storage value. True callback-drain refusal, native Git privacy workflows, other protocols/providers/platforms and full migration gates remain required. HTTP18MiB proves visible-unsaved size/status/headers/budget behavior; both10MiB replies prove complete bytes/hash, as detailed in HTTP.md.

Commands: bun run check; bun run build; labeled bun tests/ui/template-tag-environment.js and bun tests/ui/resource-manager.js. Native: bun tests/ui/build-resource-crud-probe.js artifacts/native-resource-crud-audit-probe/environment-lifecycle-attempt-5; bun tests/ui/helpers/native-profile-ownership.js --reconstruct <newmarker> <finishedbuildstate>; set INSOMNIUM_UI_BUILD_STATE/INSOMNIUM_UI_PROFILE_OWNERSHIP to those owned artifacts and INSOMNIUM_ENVIRONMENT_NATIVE=1 for the saved environment entry. CRUD/HTTP use their unchanged saved entries with the same build/marker. Bun only; native hosts hide before CDP. This interface cannot invoke /compact; STATUS records the explicit feature handoff.

Earlier attempts remain immutable; failed receipts never become passing receipts:

| Attempt | Actual result and correction | Protection/source closure |
| --- | --- | --- |
|1:build53883/environment-lifecycle; exed464b15586630487d00be00eaa9181d72bafc1da3c2e5cf0b329ab8b50b779a6 | Build0/Rust6m41. Native42818/1792006279144 fails authored-data wait because JSON.stringify compares Rust key order. Changed workspace proves saved values/order; helper now uses semantic deep equality plus exact authored order before/after reload | Host16268 exit0/native-hidden,0sockets/no Send; restoration1792006278929 exact; postclosure18607 passes |
|2:build84002/environment-lifecycle-attempt-2; exe1f850dff26b7d33952238b2c873cdc1efcbe2c70ee211e934c13166cc2b7dff4 | Build0/Rust6m40. Native44525/1792007057243 passes Name6/JSON12 and appearance/order then fails expected emptystring color. Actual nullable null is correct; model/clear/copy expectations now exactnull and per-control progress is saved | Host35992 exit0/native-hidden,0sockets/no Send; restoration1792007057018 exact; postclosure13410 passes |
|3:build83190/environment-lifecycle-attempt-3; exeda9584df0db19a11c3e1fa3458fb2753ccd6decd45a8799c316e6595530715af | Build0/Rust6m40. Native68224/1792007933720 passes15 lifecycle checkpoints then correctly refuses bare-null output before dispatch. Refusal retained as an explicit control; successful wires author an explicit default, renderer unchanged | Host38996 exit0/native-hidden,0sockets/no Send; restoration1792007933502 exact; postclosure52968 passes |
|4:build2943/environment-lifecycle-attempt-4; exe082d58dd147d622c3bc5775cbed1187a9328a33cde5de330975caef096b4afd3 | Build0/Rust6m41. Environment8754/1792008802016 passes29/12sockets; HTTP85824/1792008882389 passes36/18/54sockets. CRUD1792008839627 fails only old exactsnapshot missing new environmentPropertyOrder.$ [corrected,retained]; exact map added without relaxing assertions | Hosts27692/33576/42732 exit0/native-hidden; restorations1792008801792/1792008882167/1792008839408 exact; combined postclosure27162 passes |

## Unrelated environment deletion follow-up

Final review of6349100 found refresh on every environment deletion could discard an unsaved HTTP response even when selection was unchanged. Verified follow-up eae4ac2 captures selectedEnvironmentRemoved before clearing selection and refreshes only that transition. It retains the selected-subtree/Base fallback contract and all source resources/history.

Saved controlled negative plugin-dom-render-owner-environment-delete-negative-1792010000 compiles ONLY pinned git show6349100 workspace source via documented first BunPlugin/compileModule (production file unchanged) and fails exact unsaved-response identity after unrelated deletion. Positive1792010001 passes old20/HTTP6/stream2 plus two environment contracts;41 workers retire. These are controlled state/IPC proofs, not native acquisition. Compiler85098 passes0/0. New native control deletes a separate owned environment while a real18MiB unsaved response remains visible, asserting selection/resources/history, status/size/headers/budgetnotice and zero extra wire before any reload. Existing10MiB hash/budget cases remain intact. Final normal-hook environment-retained-response build21824 exits0/Rust6m42; executable SHAe4fbc08e491d5b8107ac454f90928debf281ff255f6b8f986d000294363d0fe9. Final source closure13935 passes after all three native scenarios; no owned handles remain.

| Current native scenario | Verified scope | Host/restoration |
| --- | --- | --- |
| HTTP46364/response-history-native-1792011423234 | Original seeded6/body36 plus controls19; unrelated deletion preserves visible200/18,874,368bytes, selection/resources/history, zero extra wire and no reload;54 sockets close without force | Host33416 exit0/native-hidden; restoration1792011423014 exact originalf0/d8 and protected inventory |
| Environment12228/template-tag-environment-native-1792011582241 | Original29checks/Name6/JSON12, strict2/inheritance5/foreign4+held1 and12 retired sockets | Host23356 exit0/native-hidden; restoration1792011582018 exact |
| CRUD71374/resource-manager-native-1792011631508 | Original6/field24/correction6/collection6 retained | Host22884 exit0/native-hidden; restoration1792011631293 exact |

Independent read-only audit rehashes archived original buffers and verifies all54 observed sockets closed without force. The18MiB response has no actual full-body SHA and no durable history row; its visible size/status/headers/budget/no-loss assertions do not establish full-body integrity. Both10MiB response hashes remain verified, with newest retained decoded10,485,760bytes and serialized history24,526,570bytes. Owned window destruction/exit0 does not close OS-close/platform acceptance. All broader limits and remaining gates above remain required.

References for the maintained harness loader: [Bun plugins](https://bun.sh/docs/bundler/plugins), [Svelte compiler](https://svelte.dev/docs/svelte/svelte-compiler). Old negative/current positive receipts remain separate.

## Topic records

<a id="record-agent-environment-name-measurement-20261013"></a>

<details>
<summary>AGENT-ENVIRONMENT-NAME-MEASUREMENT-20261013</summary>

# Environment Name: local Field association and correction

## Verified Name-only correction after parent review

Typed nullable local `{environmentId,message}` state owns only the edited Name failure. JSON parsing/object validation still runs first; blank-name refusal preserves exact original visible `Error: Enter an environment name`. Existing Field.error plus explicit `label="Name"` keeps exact Name accessible label and associates the generated error ID. Only a nonblank Name input clears its local error; it cannot clear JSON/global feedback. Save resets prior validation feedback before synchronous validation; showModal/closeModal reset local ownership. Global JSON/nonobject/topology/persistence catch remains. No CodeEditor/parser/shared Field/global CSS/token/backend changes; default gap7px.

Final proof `artifacts/environment-name-proof/final/audit.json` SHA **7df86523afbe96ab2e7d9b7b54b1105cfde067c98e542113b7bd3be435c010a8** binds678source/49frontend/5harness files (732total). Mapping sourceHashes→`final/source`, frontendHashes→`final/frontend`, harnessHashes relative to`final/` (`scenario/`, `verification/`). `guards.json` binds original current root route73b83048/scenario3695dd5a and new own bytes; helper must be absent originally. Source bytes remain frozen; independent PowerShell rehash732/732 passed. Historical failure.png retained in scenario directory is the archived locator predecessor, not a failed final run; final result.json is passed. Original negativeba19 and initial metadata negative remain immutable.

Terminal gates: build2a0f81 exit0; compiler58919 terminal0errors/0warnings with explicit verification-only preview5493 supplement, restored exact3839c23f before commit/not offered. Normal own baseline four preexisting optional-fetch errors remain disclosed; this is not a whole-current-root compiler claim. SAME saved scenariofd438c exit0 with six Name profiles/12 actual malformed-JSON/nonobject precedence refusals plus every original template worker/Apply/save/reopen/folder/base-context assertion. Exact valid/invalid Name, one field alert/exact original message, ID/aria-invalid/describedby, still-blank error retention, valid correction/removal of descriptions, unrelated JSON alert retention, uncorrected error Escape/reopen lifecycle, accepted trimmed name/authored JSON/all other resources/history/no-save guards pass.

`geometry-receipt.json` proves all six Name control rectangles/colors/background/fonts, caption text/color, gap7px and entire660×528dialog metrics EXACT to frozen baseline. Only caption resolved font shorthand changes normal400→500, explicitly approved existing Field.label consolidation. No compact6px adoption or style override.

Saved relative-editor locator timeout3406 is retained under `negative-relative-editor-locator`; `.filter({has:dialog.locator(...)})` incorrectly scoped an ancestor inside its descendant. Reused the SAME original script's page-relative inner locator pattern; original assertions/data checks unchanged. No product fix for a harness locator issue. Earlier measurement report9fc91c77 is archived as `measurement-report-original.md`.

Primary documents before implementation: [Svelte state](https://svelte.dev/docs/svelte/$state), [WAI notifications](https://www.w3.org/WAI/tutorials/forms/notifications/); local Field/Input APIs inspected. All handles terminal/native profile unclaimed. Root guarded integration/current-root replay/fresh native environment persistence/AT/platform/private/full migration/UX remain OPEN; namespace/Resource proofs unchanged. Topic commit reported in STATUS/final handoff. `/compact` unavailable; no compaction claimed.

## Original measured baseline (immutable)

Measurement checkpoint after report topic57f3e15, before the approved correction above. Same saved `tests/ui/template-tag-environment.js` retains its entire original template worker/Apply/save/reopen/folder/base-context body and assertions. An appended reusable `helpers/environment-name.js` measures the actual compiled app; optional buildRoot stays within the existing preview helper's confined artifact rules. All original native entries untouched. Shared launcher is headless; no native/profile/provider work.

## Current source and immutable frontend

Route73b83048, Field306653ad, CodeEditor60e7bac7 and workspacec72a2a34 current root raw bytes are archived under `artifacts/environment-name-proof/baseline/root`; complete normalized LF equals own corresponding source. Existing49 frozen frontend files under namespace proof503c1b03 were all rehashed before run. This is own baseb95+Resource/namespace UI generation with focused source equivalence, not a claim of entire current-root runtime/native generation. Namespace/Resource proofs remain immutable.

Final preflight8456d6f0 binds exact consumed entry/helper/preview sources before the final run. Frozen negative `artifacts/environment-name-proof/negative/audit.json` SHA **ba19ba660c15660acff4fd100d0107c6496bb0f8abc775880f20356c44344901** binds10source inputs, scenario output hashes and all49 referenced frontend hashes. Source map lives under `negative/source`, output map under `negative/`, frontend reference remains immutable namespace final/frontend. Original-body receipt proves entire original normalized script equal after removing only measurement import/call and optional confined buildRoot.

## Exact result

SAME scenario final receiptba6f36 exited1 with12 deliberate failures across dark/light1440/900/760×600:

- Six authoritative blank-name refusals show global “Enter an environment name” feedback but no aria-invalid or described error ID on existing Name Field/Input.
- Six valid name corrections leave that same global alert displayed until Save/close. Correction alone performs no resource/save mutation.

All original template assertions passed before measurement. Exact accessible textbox name `Name` remains valid in both current valid/invalid states; existing generated input ID is nonempty. Every original implicit label click focuses that input. All six blank-name/no-save and unsaved corrected-name Escape cases preserve complete saved workspace data. Escape returns focus to Edit environment. Accepted corrected Save trims the name, preserves authored environment JSON and every other resource/history exactly.

Measured Name width610px/height34.796875px in660×528px dialog; x415/145/75 at1440/900/760, y296. Label gap7px, normal12px/18px Inter Variable, dark/light muted colors163/107; control font12px/16.8px with existing dark/light foreground/background. All measurements are retained by profile. No compact6px rollout or CSS adjustment is justified here.

## Retained setup negative and narrow proposal

Initial receiptb771d0 failed strict foreign-resource equality because the first accepted rename legitimately created workspace_meta missing from initial fixture data. Archived `negative-startup-metadata`. Source model `rememberEnvironment` creates that metadata through ordinary selection. Measurement now performs SAME actual Active environment selection of its current value before capturing the read-only baseline; saved metadata existence/selection is asserted. No metadata/resource exclusion or weakened equality was introduced. First measured12-failure run5ea36c is separately archived; final prebound rerun confirms the same actual defects.

Parent review requested before production edits. Suggested smallest change: authoritative name-only Field.error and correction, local explicit Name label to preserve exact valid/invalid accessible name, default7px geometry unchanged. JSON-first parsing/nonobject failures and topology/persistence/collection errors retain appropriate global/editor feedback; no CodeEditor/global Field/parser/template changes. Keep original all assertions plus this exact negative; require same six-profile/style/data/focus acceptance, compiler/build and current-root replay before a topic commit. Caption weight/layout differences must be measured and reviewed.

Primary form semantics previously consulted: [WAI labels](https://www.w3.org/WAI/tutorials/forms/labels/) and [description ID associations](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA1); applicable local Field contract inspected. No new subsystem initialized.

All handles terminal, browser/server closed by preview finally; fixture browser storage only. Product correction/acceptance, current native/environment persistence/AT/platform/private/full migration/UX remain OPEN. No completed product feature or compaction claimed; `/compact` unavailable, explicit measurement handoff.


</details>

<a id="record-collection-environments"></a>

<details>
<summary>COLLECTION-ENVIRONMENTS</summary>

# Per-collection environment selection

Updated: 2026-09-29. Retention and cross-collection finite HTTP dependency dispatch implemented. See TEMPLATING.md#record-dependent-responses for routing and validation.

## Contract

- Store activeEnvironmentId on workspace_meta resources, matching the archived WorkspaceMeta concept. Preserve other metadata fields.
- Existing explicit metadata wins on load, including an empty/null Base selection. Old schema-1 global activeEnvironmentId seeds metadata only when that collection has no explicit selection. Loading clones metadata and the resource array before normalization, preserving caller input.
- A selection must reference an environment belonging to that collection. Missing, foreign and wrong-type references fall back to Base. Invalid saved metadata is normalized on load.
- Dropdown updates both active UI selection and metadata. Collection/request-tab switching remembers the old collection and restores the target selection. Invalid collection targets are ignored.
- Removing an environment clears all metadata that references it. Imported metadata and duplicated collection selections remap activeEnvironmentId through the shared reference key list. Export already includes resources.
- No layout changes. No new dependencies or saved test scripts.

## Sources consulted before implementation

- https://svelte.dev/docs/svelte/$state — deep reactive state and snapshots.
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn — distinguish absent metadata field from explicit Base selection.
- Archived packages/insomnia/src/models/workspace-meta.ts and network/network.ts: collection-owned environment selection. Archive remains read-only.

## Validation

20 inline Bun assertions passed: old-global migration/input preservation, explicit Base precedence, foreign/wrong-type fallback, metadata preservation, duplicate/import ID mapping, compiled Svelte collection and request-tab actions, Base retention, active/inactive environment deletion, invalid collection target, serialization/reload.

Commands launched directly with shell:false/windowsHide:true through node_repl:

- bun node_modules/prettier/bin/prettier.cjs --write src/lib/model.js src/lib/resources.js src/lib/workspace.svelte.js src/routes/+page.svelte
- bun node_modules/svelte-check/bin/svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings — 0 errors, 0 warnings.
- bun node_modules/vite/bin/vite.js build — passed.
- git diff --check — passed (existing CRLF notices only).

No real user state loaded/saved, no native changes or new installer. Real WebView acceptance remains pending.

## Next steps

Scoped dependency routing, shared OAuth resources and target source guards are now implemented and checked (see TEMPLATING.md#record-dependent-responses). Continue streaming completion semantics, remaining renderer callers, native transport parity and real WebView/provider acceptance. Full migration remains incomplete.


</details>

<a id="record-dependent-responses"></a>

<details>
<summary>DEPENDENT-RESPONSES</summary>

# Dependent response requests

Updated: 2026-09-29. Same- and cross-collection finite HTTP dependencies are connected to HTTP/initial-stream Send. Full migration and response-tag parity remain incomplete.

## Legacy evidence and implementation

Read archived ui/components/templating/local-template-tags.ts response.run (around lines565-700), plugins/context/network.ts and network/network.ts fetchRequestData. Official sources consulted before implementation:

- https://mozilla.github.io/nunjucks/api.html#asynchronous-support
- https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static

The original uses environment-scoped latest history, then optionally sends before extracting the requested field. Trigger semantics retained:

- never/unknown string: read history only.
- no-history: send only when no response exists. A failed response still counts as history.
- when-expired: send when history is absent or ageSeconds > maxAgeSeconds (strict comparison, original numeric coercion). An omitted age does not expire an existing response; the legacy UI supplies60 as its default.
- always: send unless the requested ID is already in the current request chain.
- Truthy non-string trigger values fail. Preview never invokes the network callback regardless of trigger mode.

Root calls have independent initially empty chains, matching the inspected original. A child receives and shares its parent's mutable array; IDs are appended before send and never popped. If an ID is already present, use existing history; without history this fails instead of recursing. This also allows the archived root re-entry behavior: A→B→A can send an inner A once, then B's next occurrence reads history. Repeated root always tags are not globally deduplicated or memoized.

Files:

- template-response.js now separates reference validation, environment-scoped latest-response lookup and field extraction. Preview uses the same helpers. Existing body decoding/filter-worker bounds remain.
- template-response-send.js createResponseTemplateResolver snapshots resources/history/environment and tracks freshly received responses. Child sends receive a cloned source request, shared chain and AbortSignal. Incoming response identity/environment is checked; cancelled late results are not cached. Bounds are32 sends per root resolver,32 chain entries and40Mi serialized characters retained for newly received latest responses (in addition to the initial snapshot). These are explicit runtime limits, not proof of unbounded legacy parity.
- template-session.js accepts an application-owned responseResolver only for send purpose. Its awaited callback acquires/releases the existing reference-counted host-wait coordinator. This pauses ancestor active wall deadlines while preserving worker heartbeats, five-second watchdogs, VM execution limits and ten-minute session/hard limits. Guest code cannot publish wait notifications. Without an adapter, resend modes still reject explicitly; previews always read their saved snapshot.
- request-render.js forwards the resolver into its owned render session.
- workspace.svelte.js creates one resolver per root execute and recursively renders/sends dependencies through sendDependentRequest. Each dependency gets a unique native ID and an abort listener that calls cancel_http for that ID. Root Stop/timeout propagates through waiting workers to child rendering, OAuth and network dispatch. Dependencies use resolved OAuth, source-change guards and the same transport composer. Results update local response/history when the resource still exists; an independent currently running request's response pane is not overwritten. OAuth progress can be routed while the root owner is active, and only matching dependency progress is cleared.

## Verified evidence

38 inline assertions passed; no saved test scripts:
-17 policy/resolver cases: history and environment rules, strict expiry/omitted age, never/unknown modes, repeated always, mutable child chain, freshly received response reuse, preview non-send, cycles with/without history, abort/late result, identity mismatch, send cap and failed-history behavior.
-9 compiled Svelte execute cases through a real local Bun HTTP server and built workers: nested C→B→root wire sequence, JSONPath/header filtering, history and body values, no-history reuse, repeated root always behavior, network wait6.1seconds, held dependency, Stop preventing root send, and a child prompt answer reaching the wire. The fixture adapter loads both built template and response-filter workers.
-6 compiled execute/mocked-native cases: dependent OAuth acquisition, credential storage/header, token reuse, pending native send, both root and child cancel IDs, and worker/run cleanup.
-2 compiled mocked-native cycle cases: A→B→A retains archived history fallback/send order and cleans up.
-2 timing cases: accelerated ten-minute total cap cancels the dependent native request; dropping heartbeat notifications triggers the five-second watchdog during a network wait.
-1 malformed non-string trigger case.
-1 cross-collection guard case proves no dispatch occurs while routing is unsupported.

Svelte check0 errors/0 warnings and Vite production build passed. A search initially used an unescaped parenthesis and was corrected. One compilation diagnostic required an explicit missing-request guard after array lookup; corrected. Fixtures stopped, worker counts0. No dependency install, Rust changes, installer, commit, publication or real-user-state writes. All executions hidden node_repl execFile(shell:false,windowsHide:true); filesystem/scripts/tooling through Bun. Commands: Bun directly ran Prettier on changed JS, svelte-check with --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings, and vite build; git diff --check reported no whitespace errors.

## Remaining parity / next steps

1. Cross-collection finite HTTP routing is now implemented. selectedEnvironmentFor/requestDataScope selects target metadata, while response history lookup stays in the caller environment. Real WebView acceptance remains pending.
2. SSE-labelled HTTP dependencies now await completed raw HTTP responses under native timeout/body bounds; see the SSE completion checkpoint below. Live SSE history remains outstanding; browser-preview body bounds are implemented in the later checkpoint below.
3. The graph reads its initial history snapshot plus its own new responses; independently arriving UI history is not reread. Per-request dependent-run UI/cancellation controls, simultaneous OAuth progress for the same child, failed-dependency history/timeline and native cancellation registration races still need acceptance/reconciliation. Root cancellation and child native IDs are verified at the mocked boundary, not actual WebView/Rust/provider acceptance.
4. Preserve the callback/chain/wait contracts when integrating GraphQL introspection, manual OAuth actions, gRPC and subsequent WebSocket payloads. Native cookie snapshot/User-Agent and URL encoding parity remain separate outstanding work.
5. Source is newer than BUILD.json. No installer was rebuilt; no full migration completion claim.

## Cross-collection dependent HTTP routing — 2026-09-29

- Added request-scope.js: each send gets its collection's selected environment while resource replacements remain shared through accessor-backed snapshot views. Root/child OAuth records survive nested sends; active UI selection is not changed.
- Resolver history/new-response cache is keyed by request and caller environment. Sends validate/cache the target environment and return that immediate response. Thus foreign no-history may resend even when target-environment history exists; this preserves inspected original caller-versus-target semantics.
- Connected scoped routing in workspace.execute/sendDependentRequest and removed the temporary cross-collection guard. Source guards compare the current request's collection selection. Existing conservative all-resource/settings guard remains; unrelated edits can still discard a pending token.
- Fixed dependent manual OAuth callback authorization: progress carries its root owner; callbacks require the matching live non-aborted owner, and late/cancelled callbacks fail.
  -61 inline assertions passed:34 existing resolver/native OAuth/cycle/local HTTP regressions,7 three-collection local HTTP cases,8 foreign OAuth/shared tokens/source-change cases,7 manual callback/cancellation cases,5 scoped resolver/identity checks. Svelte0/0, Vite build and git diff --check passed. One JSDoc mismatch was corrected after the compiler identified it.
- No saved test scripts, dependency/native changes, real user data writes or installer. Fixture servers stopped, workers0. Real WebView/provider/native cancellation acceptance remains pending.
- Next: finite completion semantics for streaming dependencies and integration of introspection/manual OAuth/gRPC/WS payload renderers; native cookie/User-Agent/URL handling and full PARITY acceptance. Source newer than BUILD.json; full migration incomplete.

Official sources consulted before these edits:

- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty
- https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted
- https://v2.tauri.app/develop/calling-rust/#channels

Validation commands unchanged: Bun directly launches Prettier, svelte-check and Vite; inline Bun probes use compiled Svelte modules, built workers, local HTTP and mocked native IPC. git diff --check passes. No generator is needed for these existing-subsystem edits.

## SSE response dependency completion — 2026-09-29

- Inspected archived response.run and plugins/context/network.ts: response tags await the complete HTTP response before extracting any field, including headers. Raw returns complete SSE framing; it does not select the first event. WebSocket/gRPC resources are not response-tag targets in that legacy path.
- Removed the SSE rejection in sendDependentRequest. SSE-labelled HTTP requests now use the existing ordinary send path, preserving Accept: text/event-stream, raw body and Base64. They do not open a live stream pane. Native send_http already reads chunks with a 20 MiB bound, timeout and cancellation; an endless stream must fail or be stopped, with no partial success.
- 8 inline assertions passed against compiled workspace/Svelte, real local Bun HTTP and built workers: completed SSE dependency, raw framing/Base64, Accept header, ordinary history shape, header waits for EOF, EOF releases root, Stop prevents root dispatch, and timeout cleans workers. Workers0, server stopped, no real-user-state writes. The fixture initially collided with a variable name; its rename also changed the raw tag argument, then both fixture errors were corrected and rerun successfully.
- Svelte check0 errors/0 warnings and production Vite build passed. No saved test scripts, native edits, new dependencies or installer. Source remains newer than BUILD.json.
- Native size/cancellation behavior was inspected, not exercised in a real WebView/native wire run here. Browser-preview transport still reads arrayBuffer without the native 20 MiB accumulation bound; this is an outstanding transport discrepancy. Existing live SSE history (event log) versus completed raw HTTP history also needs reconciliation.
- Official docs consulted before implementation: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events and https://docs.rs/reqwest/latest/reqwest/struct.Response.html#method.chunk . Existing subsystem reused; no generator needed. Commands: Bun directly launches Prettier, svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings and vite build; git diff --check. Hidden node_repl execFile shell:false/windowsHide:true retained.
- Next: reconcile live SSE history and preview response bounds, WebSocket connect-and-send, native cookie/User-Agent/URL parity, then full runtime/UI/platform/packaging acceptance and remaining PARITY rows. Full migration remains incomplete.

## Browser-preview response bound — 2026-09-29

- Fixed transport.js preview send: replaced unbounded response.arrayBuffer with a ReadableStream reader. Count actual received bytes, grow a byte buffer up to20 MiB, accept exactly the limit and reject the first excess chunk with the native send_http error. Content-Length is not trusted. No partial successful response is returned.
- Fetch and body reads share the combined user/timeout signal. Check cancellation before/after reads, cancel the reader on failure without delaying the original error, and release its lock in finally. Empty responses and exact binary Base64 remain supported. Desktop invocation is unchanged.
- 15 inline assertions passed:7 direct local HTTP transport cases (binary,204,exact20 MiB,limit+1,body timeout,body abort,pre-abort) and8 compiled SSE-dependency regressions. Fixture servers stopped and template workers0. No saved test scripts or real-user-state writes.
- Svelte check0 errors/0 warnings, Vite production build and git diff --check passed. Bun launched Prettier, svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings and vite build through hidden node_repl execFile. No native changes/dependency installation/new installer; source newer than BUILD.json.
- Consulted official docs before editing: https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/getReader and https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultReader/cancel . Reused existing subsystem; no generator needed.
- The body limit is now enforced in preview as well as the inspected native implementation. Browser CORS/header/redirect restrictions remain distinct; Bun fetch checks do not establish real WebView acceptance. Next: live SSE raw history reconciliation, WebSocket automatic connect-and-send, native cookie/User-Agent/URL parity, then full runtime/UI/platform/packaging and remaining PARITY work. Full migration incomplete.


</details>

<a id="record-editor-template-inventory"></a>

<details>
<summary>EDITOR-TEMPLATE-INVENTORY</summary>

# Shared editor and template migration inventory

Updated: 2026-09-28. CodeMirror foundation implemented; template runtime remains pending. Preserve the original Insomnium layout. Current application textareas are not equivalent to the archived shared CodeEditor.

## Archived evidence

Paths are relative to _backup/legacy-electron/packages/insomnia/src.

| Area                 | Source                                           | Behavior to preserve                                                                                                                                                                                |
| -------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared editor        | ui/components/codemirror/code-editor.tsx         | CodeMirror5 fromTextArea; syntax modes, line numbers, active line, brackets, folding, editable/read-only modes, wrapping, indent preferences; YAML/OpenAPI disallow tab indentation                 |
| Keyboard             | Same file                                        | Ctrl/Cmd-F persistent search, Ctrl-Space completion, Ctrl-Q fold, comment/fold-all/unfold-all, indent selection; optional Vim/Emacs/Sublime keymaps                                                 |
| State                | Same file                                        | Cursor, selections, scroll, undo history and marks keyed by uniquenessKey; restore on re-entry; initial loading must not become user undo                                                           |
| Response tools       | Same file                                        | JSON/XML filters, filter history/help, format controls and pin-to-bottom; large-input lint suppression                                                                                              |
| Language integration | base-imports.ts and modes/                       | JSON/JS, XML/HTML, YAML, Markdown, GraphQL/variables and other language modes; custom OpenAPI, curl and Nunjucks modes                                                                              |
| Completion           | extensions/autocomplete.ts                       | Environment variables, tags, constants and snippets; flexible nested paths, completion trigger/delay, dropdown keyboard behavior                                                                    |
| Template UI          | extensions/nunjucks-tags.ts; templating controls | Tag widgets and editing/preview require further detailed inventory                                                                                                                                  |
| Template runtime     | templating/index.ts                              | Nunjucks browser renderer; root and underscore context aliases, asynchronous render modes (all/variables/tags), autoescape false, throwOnUndefined true, path/location errors and plugin extensions |
| Built-in tags        | ui/components/templating/local-template-tags.ts  | File contains native/crypto/history/cookie integration dependencies; beginning confirms base64 and timestamp options. Inventory all tag definitions before choosing runtime boundaries              |

Current src/lib/model.js render() only resolves dot paths, strips a leading underscore-dot alias, recursively substitutes at most12 times and rejects legacy block tags. Bracket paths, Nunjucks expressions/filters/comments and asynchronous tags are not implemented. Current native CSP allows script-src self and does not enable dynamic code evaluation.

## Official documentation read

- CodeMirror5 manual: https://raw.githubusercontent.com/codemirror/codemirror5/master/doc/manual.html . Documents fromTextArea, configuration, history/document APIs, modes, addons and cleanup. The codemirror.net manual returned403, so the official repository copy was read instead.
- CodeMirror6 migration guide: https://raw.githubusercontent.com/codemirror/website/main/site/docs/migration/index.md . Read as an alternative, not a selected dependency. Its extensions/state model requires deliberate mapping of the existing editor behavior.
- Nunjucks API: https://mozilla.github.io/nunjucks/api.html . Documents explicit environments, asynchronous filters/extensions, browser/precompile options and its execution model. Do not assume a browser renderer automatically fits the current CSP or native capability boundaries.

Selected CodeMirror5 to preserve the existing API/keymaps/theme structure. Executed bun add --exact codemirror@5.65.21 and bun add --dev @types/codemirror (5.60.18) after reading the documented Bun add command. No Node/npm/npx/yarn/pnpm/Python/pip runtime.

## Ordered implementation plan

1. Finish archived editor/theme/call-site and built-in-tag inventory. Map which settings/resources already persist and which need migration; preserve unknown settings. Read relevant official integration examples before edits.
2. Choose the editor based on preserved behavior and Svelte lifecycle integration. CodeMirror5 is the direct legacy match; CodeMirror6 requires explicit mapping. Record the decision and install through Bun before customizing. No handwritten replacement for an existing editor engine.
3. Add a shared Svelte JavaScript wrapper with mount/destroy cleanup, bounded document-state retention, request/resource identity, controlled external updates, read-only behavior and existing theme tokens. Keep editor content plain text; changing modes or selecting requests must not overwrite saved bodies or mix undo histories.
4. Integrate request body, gRPC and GraphQL editors first. Connect highlighting, search/folding/format, environment completion and schema-aware GraphQL completion. Then response, environment, OpenAPI and single-line fields. Preserve current pane/tab geometry and keyboard accessibility.
5. Resolve template execution separately from syntax/completion: compare original expressions, context merging, render modes, error paths, tags and async cancellation. Inspect compiler/CSP compatibility and native access boundaries before selecting a runtime. Do not silently treat unsupported tags as successful rendering or display secrets as completion detail.
6. Verify compilation/build and focused inline inspection only (no saved development test scripts). Real WebView acceptance must include IME, typing/cursor, undo across requests, external/import updates, theme/wrapping, hidden-pane resize, read-only selection, keyboard focus and persisted reload. Current CUA inventory exposes no apps/browsers.

This inventory does not remove template/plugin, response-filter, GraphQL or rich-editor requirements from PARITY. Full migration remains incomplete.

Additional inventory locations: original ui/css/main.css editor styles begin near line1326 (gutters, themes, search, read-only/single-line, hint popup); inspect them before replacing tokens. Built-in tag names found in local-template-tags.ts: base64, now, uuid, os, hash, file, jsonpath, cookie, prompt, response and request. These names are inventoried, not implemented; remaining bodies need review, especially response-trigger chaining and prompt storage.

## Implemented foundation

CodeEditor.svelte and editor-engine.js now supply browser-only lazy loading, lifecycle cleanup, original theme colors, syntax modes, gutters, bracket matching, search/fold/indent/comment shortcuts and alternate keymaps. HTTP body and gRPC body use it. editor-state.js caches up to16 inactive resource states with a4MiB serialized estimate; content mismatch invalidates restored undo. External edits are undoable; loading/switching does not emit user edits. Stored editor preferences are consumed, but full settings UI migration remains open.

Svelte0/0 and production frontend build passed;10 inline mode/cache assertions passed. Actual DOM lifecycle/typing/undo/IME/resize behavior is not verified. No saved test scripts. Next: environment completion, GraphQL schema-aware editing, read-only/response and other surfaces, editor settings, lint/filter/tag widgets and template runtime. Do not infer full parity from the wrapper build.

Additional official sources: https://svelte.dev/docs/svelte/lifecycle-hooks and https://bun.sh/docs/pm/cli/add .

## Environment completion checkpoint — 2026-09-28

Added show-hint integration and editor-completion.js for inherited environment names in HTTP/gRPC bodies. Ctrl-Space and delayed interpolation suggestions support current dot/numeric/underscore-alias rendering syntax, avoid duplicate closing braces and replace whole partially typed names. Names only; bounded traversal avoids getter execution/cycles. Original Tab behavior preserved through CodeMirror.Pass. Bracket/quoted paths, tags/snippets/constants, Nunjucks runtime and GraphQL completion remain pending.

Read archived extensions/autocomplete.ts and official https://raw.githubusercontent.com/codemirror/codemirror5/master/addon/hint/show-hint.js plus the official manual before edits. No new packages. Ran bun x --bun prettier --write, bun run check (final0 errors/0 warnings), bun run build (passed), and15 inline Bun boundary/name/limit assertions. No saved test scripts. Actual popup/IME/lifecycle acceptance remains unverified; source is not packaged.

## GraphQL editor checkpoint — 2026-09-28

Read official https://raw.githubusercontent.com/graphql/graphiql/main/packages/codemirror-graphql/README.md and installed using bun add codemirror-graphql (2.2.9). Connected GraphQL query/JSON variables to the shared editor, schema-aware query completion and live lint, with environment hints and separate undo identities. Lint skips large/read-only/unrendered-template content; explicit rendered validation remains. Six direct language-service assertions passed; Svelte0/0 and frontend build passed. Initial markup/type diagnostics fixed. No saved test scripts/native changes. Type hover/navigation, variable-specific suggestions/lint, template integration and real WebView acceptance remain pending. Source is newer than the packaged BUILD.json.

## GraphQL variables/navigation — 2026-09-28

graphql-editor.js derives input types from the selected operation; invalid/ambiguous selections yield no map. Connected installed variables mode/hint/lint and query jump to the current Schema view. JSON non-object roots and upstream lint exceptions become diagnostics. Parent/named type navigation works in source; directive-only/hover/field highlighting remain open. Variables linter does not check omitted required variables. Nine inline mapping/reference assertions passed; Svelte0/0, Prettier and frontend build passed. Lazy editor chunk now triggers the500kB build warning; split later without suppressing it. Actual DOM/IPC behavior remains unverified and source is unpackaged.

Official sources read: https://www.graphql-js.org/api-v16/utilities/ , https://raw.githubusercontent.com/graphql/graphiql/main/packages/codemirror-graphql/src/jump.ts and installed codemirror-graphql2.2.9 variables/hint.js, variables/lint.js, utils/collectVariables.js and utils/SchemaReference.js. The remote variables/hint and collectVariables paths failed to fetch; installed official package sources supplied the implementation evidence. Commands: bun x --bun prettier --write, bun run check, bun run build, git diff --check. No new dependencies/native changes/saved test scripts.

GraphQL hover/directives checkpoint (September28): editor-hover.js owns lifecycle while reusing official info rendering; upstream info addon was inspected and not enabled because its disable path does not own all document listeners/popups. Schema explorer includes directive descriptions/args/defaults/repeatability/locations and directive-reference navigation. Official source: https://raw.githubusercontent.com/graphql/graphiql/main/packages/codemirror-graphql/src/info.ts and installed info-addon.js/info.js. Four directive-format assertions, Svelte0/0, Prettier, frontend build and diff check pass. Actual WebView hover/disposal remains unverified;508.48kB editor chunk warning remains. No saved test scripts/new dependencies/native changes. Source remains unpackaged.

## Shared editor surfaces/settings — September28

Response preview/raw, environment draft and OpenAPI source now use CodeEditor. Preserved read-only response handling, explicit environment Save/Cancel, OpenAPI2MiB UTF-8 guard and diagnostic selection. Settings UI exposes keymap/indent/tabs/wrapping/autocomplete delay with archived defaults (2/tabs/true/1200ms), preserving stored overrides. Official CodeMirror manual and archived models/settings.ts were read first. Six inline settings assertions passed; Svelte0/0, Prettier, frontend build and diff check passed (last guard refinement rechecked with Svelte). Actual editor interaction/layout/reload remains unverified. No saved test scripts/new packages/native changes. Next split editor modules, package checkpoint, finish filters/remaining surfaces/template runtime.

Editor keymap split/packaging: read https://svelte.dev/docs/svelte/$effect and https://vite.dev/guide/features#dynamic-import first. Added selected-keymap dynamic imports with stale-result/disposal guard. Prettier, bun run check (0/0) and bun run build passed; main frontend chunk max343.22kB, no500kB warning. Captured186-source snapshot and started bun run tauri build --bundles nsis --ci (session31547); final outcome in STATUS/BUILD.json.

## Response filtering and formatting follow-up inventory

Read archived CodeEditor prettify/filter handlers, utils/xpath/query.ts, utils/prettify/json.ts and request-meta/response-pane. JSON filter uses JSONPath against the original response, wraps matches in an array and formats it; old parse/filter failures become an empty array. XML filter uses xmldom/xpath and wraps matched outer values in a result element; string-returning XPath is special-cased. Number/boolean XPath handling in the archived wrapper is incomplete. Do not silently treat a filter failure as a successful empty result in the migration.

Original filter draft applies on Enter; clearing restores the unfiltered body. History is stored in request_meta.responseFilterHistory, while responseFilter stores the active filter. Preserve imported metadata, bound new history and avoid mutating the history array when displaying reverse order. Copy/download behavior must distinguish displayed filtered text and original response bytes explicitly. The archived JSON formatter preserves Nunjucks tokens without parsing as JavaScript; current JSON.parse-based formatting does not provide that parity.

Official docs read September28 before future implementation: https://jsonpath-plus.github.io/JSONPath/docs/ts/index.html and https://developer.mozilla.org/en-US/docs/Web/API/Document/evaluate . JSONPath docs describe browser ESM and safe expression evaluation, but also state the project is not actively maintained. Inspect the selected package's actual browser evaluator and CSP behavior before adding it; do not assume the runtime matches documentation or replace full expression support with an undocumented subset. Native browser XPath is a candidate, not yet selected or verified against original namespace/attribute/text behavior. No filter dependencies installed and no filter implementation changed during editor packaging.

Next: inspect request_meta mapping and original response-copy/download paths, choose documented engines compatible with Bun/WebView/CSP, then implement filter UI/history/worker bounds and verify representative legacy expressions. Keep template-aware JSON formatting separate from template evaluation.

Additional September28 evidence: no responseFilter/request_meta consumer was found in current src/scripts; original response-pane persists responseFilter and a bounded history on request metadata. Map retained legacy metadata before adding filter storage. In-app browser creation was attempted and explicitly returned Browser is not available: iab, in addition to the empty surface inventory. Visual acceptance must also check dark/light hint popup colors after lazy CSS loading; addon/global theme selector ordering is not proven by compilation.

Final editor package: session37704 exited0 (Rust4m40s). All186 captured source paths/hashes matched fingerprint30cb52a7baa53a5adfc80565f9b13326282fe73d2d704be87aea7e9cb00eea6e. BUILD.json records exact EXE/NSIS hashes. Earlier31547 package was superseded by explicit Vim/lint disposal cleanup. Installer not run/published; no active operations. Real WebView/editor/IPC acceptance still pending.

## JSON formatter checkpoint — 2026-09-28

- Ported archived utils/prettify/json.ts to JavaScript using documented Bun.Transpiler({ loader: 'ts', target: 'browser' }).transformSync(source), then customized src/lib/json-prettify.js. Original attribution retained. No dependency or native changes.
- HTTP/gRPC Format now formats tokens without parsing numeric values or evaluating templates. Response/gRPC display validates JSON but formats the original string, preserving large integers, exponent spelling and negative zero. Non-JSON displays fall back to original data; copy/download behavior unchanged.
- Safe Unicode conversion occurs only inside quoted strings; control characters, quotes, backslashes and surrogate code units retain escapes. Matching template closing delimiters are required. Formatter is deliberately permissive like the archived implementation, not a JSON validator or template renderer.
- Bounds: 20 Mi UTF-16 code units for input/output, nesting 0..256, indentation up to16 spaces/tabs. Explicit Format reports errors and retains previous body; display catches errors and retains original text. This character bound is not a UTF-8 byte bound.
- All10 archived fixture pairs passed exactly, plus14 inline boundary/value-preservation assertions (24 total). No saved test scripts. bun run check:0 errors/0 warnings; bun run build passed; Prettier passed. Native WebView format/undo/display acceptance remains unverified.
- Source is newer than BUILD.json and the shared-editor installer; formatter is not yet packaged. No active processes. Next: response filter/history integration, XML formatting and remaining editor/template parity; full migration incomplete.

## JSON response filter checkpoint — 2026-09-28

- Added jsonpath-plus11.1.0 with documented bun add --exact jsonpath-plus after reading official JSONPath browser/eval/wrap docs, Bun add, Vite worker and Svelte effect/MDN termination docs. Inspected installed browser exports and Safe-Script evaluator. Native evaluation is never selected; CSP unchanged.
- HTTP response Preview now offers JSONPath input (Enter/apply), clear, history selection and inline examples. Filter is persisted per request using request_meta, including imported legacy metadata. Updates preserve unrelated metadata/ID and existing history on clear/duplicate; new unique filters use original first10-plus-new behavior (up to11). Request/body/filter identity and effect disposal guard stale worker replies.
- Evaluation runs in a disposable Vite module worker; terminated on success/error, request/body/filter/tab/raw changes, disposal or3-second deadline. Bounds:20 Mi UTF-16 input/result characters,4096-character path,10000 returned matches. Errors show [] plus visible error, rather than silently reporting no matches. Raw remains original; Copy uses displayed result; Save downloads original response bytes.
- Initial inline check caught JSONPath skipping falsy roots. Fixed explicit $ root selection for null/false/zero/empty string. Other falsy-root expressions retain upstream behavior; broader scalar-selector compatibility pending. JSONPath values use JSON.parse numeric semantics as legacy did, so filtered large numeric values can round; unfiltered formatter preserves numeric spelling. Do not claim lossless filtering.
  -27 browser-resolved JSONPath/metadata assertions passed,4 actual compiled Vite worker message round-trips passed in Bun, and3 follow-up history-preservation checks passed (34 total). No saved test scripts. Svelte check0/0; frontend build passed before final metadata-only history correction, followed by Svelte check again. Worker29.86kB; no node:vm import in worker. Native WebView CSP/worker timeout/stale-result/UI/reload acceptance not yet verified.
- No native changes or active operations. Source is newer than BUILD.json/shared-editor installer; JSON formatter and response filters are not packaged. Next: XPath/XML response formatting/filtering and UI acceptance, then remaining editor/template/runtime parity. Full migration remains incomplete.

## XPath response filter checkpoint — 2026-09-28

- Read official xmldom README/API types and goto100/xpath README, plus archived utils/xpath/query.ts and CodeMirror prettifyXML. Ran bun add --exact @xmldom/xmldom xpath (0.9.12/0.0.34); used documented DOMParser/XMLSerializer/xpath.select APIs. Initial yaronn/xpath docs URL failed; used maintained goto100 repository README instead.
- Added xml-response-filter.js and XML dispatch to existing disposable response worker. XML MIME types (text/xml, application/xml, +xml) or XML declaration select XPath UI/help. Same per-request filter/history/clear/raw/copy/download behavior; JSON branch remains. Selects legacy element/attribute/text node kinds under result wrapper; comments/other kinds omitted as before. Supports string/number/boolean function results; scalar text is XML-escaped. Namespaced selection via local-name()/namespace-uri() works; no namespace mapping UI yet.
- Strict parser rejects malformed XML instead of silent repair. Input/result bounds20 Mi characters, path4096 chars, selected-node cap10000 after evaluation;3-second worker deadline remains primary evaluation bound. Does not claim memory isolation or early node-selection cutoff. Error displays empty error element plus visible message. XML indentation/unfiltered prettification remains pending; selection output currently wraps serialized fragments without rewriting their internal whitespace.
- Initial Svelte check caught DOM type mismatch between xmldom and browser Node declarations; fixed explicit boundary cast. Initial direct inline probe stalled evaluating10001 sibling nodes; identified and stopped only its Bun run process46028. Build/check sequence then completed (session45106 exited0). Repeated cases through compiled worker with timeout.14 asserted compiled-worker cases passed: elements/attributes/text/functions/namespaces/empty/comment selection, invalid XML/path/length,3-second termination on large selection, JSON dispatch regression. These are Bun Worker checks, not mounted native WebView acceptance. No saved test scripts.
- Final Svelte check0/0 and frontend build passed; worker193.42kB. git diff --check passed with existing CRLF notices. No active task processes, native changes or new installer. Source newer than BUILD.json. Next: XML formatter, broader template/editor parity and actual WebView CSP/interaction/reload checks. Full migration incomplete.

## XML preview formatter checkpoint - 2026-09-28

- Read upstream vkBeautify source/API comments before installing the archived formatter via bun add --exact vkbeautify (0.99.3) and bun add --dev @types/vkbeautify (0.99.4). README URL failed, official source documentation succeeded.
- Added xml-prettify.js: parses before/after and compares XML node kinds/names/values/attributes, serialized doctype and child order; permits indentation in element-only containers, retains mixed text/CDATA and inherited xml:space=preserve semantics. Rejects content-changing formatting and retains original selected/unfiltered text with a visible warning. Bounds20 Mi characters,100000 visited nodes,96 nesting levels,1..16 indentation spaces/tabs.
- XML Pretty preview now runs through the disposable worker even without XPath; selected XPath fragments are formatted through the same guard. Raw/download remain original. Pending/error indicators and copy disable now cover unfiltered XML processing as well as filters. Request-body XML Format is still pending.
- Svelte check0/0 and frontend build passed, worker201.22kB.7 inline formatter checks and5 compiled-worker assertions passed in Bun (12 total). No saved test scripts. Native WebView interaction/CSP/timeout/layout acceptance remains unverified.
- New owner instruction received mid-turn: all shell calls now explicitly use C:\Windows\System32\cmd.exe with login:false; never invoke PowerShell/pwsh. Use Bun for scripting/files. Initial cmd inline quoting failed (unterminated JS string), then used a base64 data-module argument to bun -e; successful checks created no script files. Future sessions must follow new shell rule.
- No active task operations/native changes/new installer. Source remains newer than BUILD.json. Next: XML request-body Format and remaining editor/template/runtime parity, then native UI acceptance/package. Full migration incomplete.

## XML request Format checkpoint - 2026-09-28

- Added XML Format button for application/xml, text/xml and +xml request bodies. Uses dedicated xml-format.worker.js and existing content-preserving xmlPrettify. No dependency/native changes; existing layout retained.
- Worker terminates on reply/error/3-second deadline and effect teardown when request ID, text, MIME or tab changes or component unmounts. Callback independently compares current ID/text/MIME/tab before applying a result. Failures retain original body and display error. Pending button disabled. Exact mounted cancellation/Undo/persistence acceptance remains unverified.
- Read official Svelte effect lifecycle and Vite Web Worker docs before wiring. Svelte check0/0; frontend build passed (dedicated worker93.28kB). Five compiled-worker assertions passed for formatting, malformed/empty XML, mixed-text rejection and indentation. First assertion expected generic Error wording for empty XML, corrected to actual missing-root diagnostic and reran all five. No saved test scripts.
- CUA rechecked: apps=[]/browsers=[]. No active task processes; source newer than BUILD.json, no new installer. Next: remaining editor/template runtime parity and native UI acceptance/package. Full migration remains incomplete.

## Isolated Nunjucks engine foundation - 2026-09-28

The complete historical foundation contract, evidence and remaining gates, together with its official references, are retained in [TEMPLATE-RUNTIME](#record-template-runtime) below.

## Template worker and preview checkpoint - 2026-09-28

The full historical contract, evidence and remaining gates are retained once in [TEMPLATE-RUNTIME](#record-template-runtime) below.

## Worker-local built-in tags - 2026-09-28

The full historical contract, evidence and remaining gates are retained once in [TEMPLATE-RUNTIME](#record-template-runtime) below.

</details>

<a id="record-environment-rendering"></a>

<details>
<summary>ENVIRONMENT-RENDERING</summary>

# Recursive environment and value rendering

Checkpoint: 2026-09-28. Implemented in preview and shared session API; **actual Send still uses model.render**. Full migration is incomplete.

## Sources and commands

Read archived packages/insomnia/src/common/render.ts and templating/index.ts before implementation. The former is authoritative for merge/pass/disabled/path behavior.

Official references consulted:

- https://mozilla.github.io/nunjucks/api.html#asynchronous-support
- https://mozilla.github.io/nunjucks/templating.html#variables
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries
- https://github.com/develohpanda/json-order (README and installed source)
- https://bun.sh/docs/pm/cli/add and https://bun.sh/docs/pm/cli/remove

Tried documented bun add --ignore-scripts --exact json-order@1.1.3 first. Inline probes proved that incomplete property maps drop unlisted keys and own hasOwnProperty breaks ordering. Removed using bun remove --ignore-scripts json-order. No final dependency remains. Reference jirasync-hub-app has no environmentPropertyOrder/json-order implementation. A bounded own-key ordering adapter is necessary to preserve imported data without these defects.

All programs launched hidden through node_repl execFile(shell:false, windowsHide:true); Bun performs scripting and file writes. No saved test scripts, Node/npm/yarn/Python invocation, native change, installer, commit or publication.

## Implemented contract

- template-environment.js collects base environment, selected ancestry within the workspace (base not duplicated), then outer-to-inner request_group environments. A request without a resolvable workspace returns null for caller fallback. Cross-workspace selected environments are ignored, matching current model behavior. Preview uses authoritative resource layers; supplied context is the fallback only when no workspace resolves.
- Saved property maps use $ root and ~| separators, including array indexes. Specified existing own keys come first; duplicate/stale entries ignored and all omitted own keys appended. Numeric keys still obey JavaScript object enumeration. **proto**, constructor and hasOwnProperty stay ordinary own data properties. No map path is assigned through object prototypes.
- Stable ordering processes literal values before strings containing {{ or {%. Bare same-name interpolation is rendered against the parent value before overriding it. Nested plain objects merge; arrays/null/scalars replace. Regex metacharacters in key names are escaped. Parent same-name syntax retains the original narrow regex: underscore-alias self-overrides are not newly supported.
- After merge, three sequential self-render passes use KEEP_ON_ERROR. Unchanged top-level values skip further passes; objects are cloned each pass. Unresolved or cyclic template strings may remain, matching the original bounded algorithm. This is not a topological resolver.
- template-object.js clones values before rendering. Arrays/objects render sequentially, keys do not render, disabled objects and blacklisted paths skip, first-level underscore wrapper names are omitted from diagnostic paths. Date/RegExp/Error/boxed primitives are preserved by cloning. Complete variable/tag/comment delimiter pairs invoke the isolated renderer; otherwise text stays literal. A result containing a tag receives one additional render, retaining the first result if that second render fails under KEEP.
- Field errors have type=render, path, reason and optional multi-digit line/column. No source/context values are logged. Template language error messages can still contain user-authored text; do not export diagnostic text as telemetry.
- Abort, TimeoutError and TemplateLimitError propagate through KEEP. Bounds: 128 environment layers, depth64, 10000 visited values and20Mi aggregate string/key characters per input/result. Actual cyclic object data is rejected. Worker/VM bounds remain. Input layers are checked together before merging; final context checked after each pass.
- template-session.js snapshots optional environmentLayers. Preparation is lazy and happens once even for simultaneous field calls. Environment request-tag callbacks receive the current partial context directly, avoiding recursive preparation deadlock. The session exposes render(text, field?), renderValue(value, {path?, keepOnError?, blacklist?}) and getContext() (returns a clone), plus signal/dispose(). Caller without environmentLayers retains its supplied context behavior.
- All environment and field workers share session interaction/cancellation and aggregate1000-render limit. Each string/reference chain allows64 renders/depth12;16 workers active. Limit failure aborts the session. Preview now has a30-second whole-session cap; send remains10 minutes. Per-worker5-second active/heartbeat and VM2-second entry budgets remain. Application-side native callback interruptions preserve their error kind instead of passing them back as an ordinary tag error.

## Verification

49 inline assertions passed:
-22 isolated-VM/helper cases: property order/nested arrays/special own keys, same-name and deep inheritance, replacement and snapshot isolation, references/comments/unresolved/cyclic strings, resource layer ordering, disabled/blacklist/wrapper handling, error location, variable-to-tag extra pass/KEEP, incomplete delimiters, abort/timeout/cycle/layer bounds.
-7 compiled-worker session cases: preview with inherited environment and request reference during preparation, concurrent once-only prompt and snapshot, cloned context, recursive fields, disposal, cancellation during prepare, and field error cancelling the session. All workers disposed (live=0).
-8 boundary cases: depth/size/node caps, unchanged error called once, multi-digit location, abort after callback, special-key merge without prototype mutation, primitive/date cloning.
-2 compiled-client/session cases: native TimeoutError propagation and accelerated30-second preview total deadline, with cleanup.
-10 existing shared-session regression assertions including multi-level prompt waiting6.1seconds, snapshots, Cancel, preview, cycles and external cancellation.

Svelte check:0 errors/0 warnings. Vite production build passed. Exact executed validation uses Bun directly on node_modules/svelte-check/bin/svelte-check with --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings, and node_modules/vite/bin/vite.js build. Prettier applied to changed JS. Initial compilation found2 missing JSDoc index-type errors; fixed. Two inline file-construction attempts failed parsing before mutation (template-literal escaping); corrected. One assertion fixture omitted base64's kind argument; corrected to encode,normal,hi and reran all22 cases. No product change needed for that fixture.

## Next steps / acceptance gates

1. Build full request/cookieJar rendering around session.renderValue; preserve description KEEP, body rendering opt-out, GraphQL #} workaround, disabled-row removal and URL normalization. Register cancellation before preparation begins.
2. Implement dependent-response send callback, trigger modes, chain/cycle/cache ownership and network-wait timing. Current send-purpose response modes always/no-history/when-expired explicitly reject; never/default reads saved history.
3. Wire actual HTTP/auth/OAuth/GraphQL/gRPC/stream Send call sites to the shared rendered snapshot and prepared environment. Remove repeated synchronous model.render calls only after protocol payload/auth parity is verified. Editor completion still uses model.environmentFor for names.
4. Preserve prompt session cache lifecycle and disposal. Verify recursive field errors in the UI, actual WebView worker/WASM CSP, native tags and dialog interaction. Inline compiled-worker adapters are not real WebView acceptance.
5. Source is newer than BUILD.json; rebuild packaging only after the integration milestones. Do not claim current installer contains these changes or mark environment/full migration VERIFIED yet.


</details>

<a id="record-os-template"></a>

<details>
<summary>OS-TEMPLATE</summary>

# OS template compatibility

Updated: 2026-09-28. Implemented for desktop template preview; Send still uses the previous variable-only renderer. Full migration is incomplete.

## Behavior

The archived OS tag is in _backup/legacy-electron/packages/insomnia/src/ui/components/templating/local-template-tags.ts. The new Rust provider uses libuv directly, with no Node runtime or sidecar.

| Function | Native result                                                                                 |
| -------- | --------------------------------------------------------------------------------------------- |
| arch     | Build architecture mapped to legacy x64/ia32/arm64/ppc/ppc64/loong64 spellings                |
| platform | Build OS mapped to win32/darwin/sunos where required                                          |
| cpus     | Logical CPU array: model, MHz speed, user/nice/sys/idle/irq times in milliseconds             |
| freemem  | Free memory bytes reported by libuv; zero if unknown                                          |
| hostname | Native hostname                                                                               |
| release  | Native OS release from uv_os_uname                                                            |
| userInfo | Effective user uid/gid, username, home directory and shell; Windows uid/gid -1 and shell null |

Only these seven function names are accepted. CPU allocation is freed through RAII, as are user information strings. CPU lists are capped at 10,000 entries. The command runs blocking OS work away from the UI thread and is restricted to the main window. Aborting a preview discards its result; it does not forcibly cancel a native OS query already in progress.

Native JSON is normalized into legacy property order in the template worker before formatting. Only cpus/userInfo apply JSONPath. The first match is returned; strings remain text, other values are JSON. Empty matches preserve undefined behavior. Invalid queries retain the original value as in the archived implementation. Queries use the existing safe evaluator, with 4,096-character query, 10,000-match and 20-Mi-character matched-value bounds. Bound errors are not swallowed. Worker and VM deadlines continue to apply.

The application-owned handler supplies native values; no invoke function or OS API enters the guest VM. Query evaluation stays in the disposable worker. Browser preview has no native OS handler. No OS information is logged or persisted by this implementation.

## Dependency and build setup

Official sources consulted before implementation:

- https://v2.tauri.app/plugin/os-info/ — reviewed; the plugin does not provide the complete CPU/userInfo data required by the archived tag, so it was not installed.
- https://docs.libuv.org/en/v1.x/misc.html — CPU allocation/free, free memory, hostname, uname and effective-user APIs.
- https://github.com/bmatcuk/libuv-sys/blob/master/README.md and build.rs — Rust binding configuration and native build requirements.
- https://doc.rust-lang.org/cargo/commands/cargo-add.html — documented dependency command.
- https://rust-lang.github.io/rust-bindgen/requirements.html — libclang/MSVC requirements.
- https://nodejs.org/api/os.html — legacy data shape only; no Node program was executed.

Installed with cargo add libuv-sys2@~1.53.0 --features skip-pkg-config --manifest-path src-tauri/Cargo.toml. Cargo.lock resolves 1.53.0. skip-pkg-config builds the bundled libuv sources; this is a native library, not a JavaScript runtime. Existing MSVC Build Tools 2017/SDK 10.0.19041 compiled it successfully on Windows x64.

Bindgen additionally requires libclang >=9 at build time. LLVM 20.1.8 was downloaded from the official release, then only bin/libclang.dll and lib/clang/20/include/* were extracted with installed 7-Zip into ignored artifacts/tools/llvm-20.1.8. The installer was not run and no system PATH was changed.

Source: https://github.com/llvm/llvm-project/releases/download/llvmorg-20.1.8/LLVM-20.1.8-win64.exe

SHA-256: 3197846a2b19063687dd56e93e34cd941e3548d907f23a6131571321bdf9fe7b (matched official GitHub release asset digest).

For continuation on this workspace, add LIBCLANG_PATH=E:/insomnium/artifacts/tools/llvm-20.1.8/bin to the child-process environment used to launch Cargo/Tauri, alongside the documented CARGO_HOME/RUSTUP_HOME/MSVC PATH/LIB/INCLUDE settings. Other machines can use their installed LLVM following the bindgen guide. Clang is not a runtime dependency and artifacts are not part of the app bundle.

All commands in this session were launched directly through node_repl child_process with shell:false/windowsHide:true. Bun handled filesystem edits, downloads and inline assertions. No shell/Node/npm/Python was executed and no test scripts were created.

## Verification and remaining acceptance

- 22 inline OS formatting/legacy-algorithm comparisons and validation assertions passed.
- 8 assertions against the compiled template worker passed: primitives, nested CPU filter, encoded filter, user field, canonical user/CPU JSON order and unknown-function rejection. A Bun wrapper supplied fixture native replies and simulated browser WASM loading.
- 2 additional JSONPath query/result-bound assertions passed.
- An inline Rust source compiled through rustc stdin against the actual provider and linked dependency artifacts. Its ignored executable read all seven real Windows values, rejected an unknown function and repeated CPU/user/system reads 32 times. Only a success summary was printed, without host/user values. This verifies the provider, not Tauri IPC.
- Svelte check: zero errors/warnings. Vite production build, Cargo check, Cargo build --lib --locked and Clippy --lib --locked -- -D warnings passed. Initial JSONPath unknown-result/implicit callback annotations and one manual_range_contains lint were corrected.
- Main-window permission generation compiled. Actual WebView IPC/CSP, mounted UI behavior and Linux/macOS builds remain unverified. No new installer was produced; BUILD.json still describes an older checkpoint.

Next: interactive prompt waiting/cancellation/dialog lifecycle, recursive environment/request rendering, Send/auth/protocol call sites and dependent-response sending. Do not mark overall template or full migration parity complete.


</details>

<a id="record-prompt-template"></a>

<details>
<summary>PROMPT-TEMPLATE</summary>

# Interactive template prompts

Updated: 2026-09-28. Dialog/queue and direct renderer interaction are implemented. Actual Send integration is still pending.

## UI and lifecycle

TemplatePromptDialog.svelte is mounted once in the application page. It uses the existing modal, heading, input and action styles, title/label/default value, text/password input, focus/select and native modal behavior. All text is escaped by Svelte. It adds no preview-triggered prompts or new Send behavior.

template-prompt-dialog.js owns a FIFO queue and read-only Svelte store. Requests require an attached UI host. Only the active prompt ID can be answered; late answer/close events cannot affect a later prompt. Cancel, Escape, external AbortSignal, host unmount and native app close settle and remove pending entries. Global application shortcuts are disabled while a prompt is active. Queue defaults are limited to 32 requests / 4 Mi characters combined; labels/titles to4096 characters. Values are memory-only and are not logged. Empty text/password responses resolve normally; the archived empty-password submit could leave its callback unsettled.

promptTemplateTag now defaults its ask callback to this dialog service. Injected ask callbacks remain supported. Existing explicit/implicit cache behavior, generation-aware clear, masked preview and abort-before-cache checks remain in place. Preview never opens the dialog. Original send-session invalidation and plugin-store persistence are still pending.

## Timing policy

The application must opt into interactivePrompts:true when calling renderTemplate for an interactive flow. The option is not template-controlled. Default preview/noninteractive calls retain the five-second overall wait budget.

- VM execution retains the existing cumulative two-second elapsed budget while entering the VM,128MiB heap and512KiB stack.
- In interactive mode, client and core five-second active deadlines pause only while a direct prompt tag is pending. Pauses use remaining time and reference counting; completing one of several pending prompts cannot resume the clock early or reset the budget.
- While a prompt is pending, the worker sends a heartbeat once per second. The client terminates it after five seconds without a heartbeat. Host-library work that blocks the worker is therefore still bounded during interaction.
- Client and core additionally impose a ten-minute overall render limit, including all prompt/queue waiting. Completion/error/abort clears timers and terminates the worker. A cancelled prompt reaches the render caller as AbortError and aborts sibling application handlers.
- Cancellation discards late native responses; it does not forcefully cancel OS/file operations already running.

Shared sessions now propagate prompt waits across nested request-field renders; see the current session contract below. Dependent network sends still require integration. Background timer throttling/suspend behavior needs real WebView acceptance.

## Implementation references and commands

Official references read before implementation:

- https://svelte.dev/docs/svelte/stores
- https://svelte.dev/docs/svelte/$effect
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal
- https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted
- https://developer.mozilla.org/en-US/docs/Web/API/Performance/now
- https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage
- https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate

Read original ui/components/modals/prompt-modal.tsx and local-template-tags.ts under the archived source. Existing Svelte project/components were customized; no new subsystem generator or dependency was required.

Executed through hidden node_repl execFile with shell:false/windowsHide:true: Bun Prettier --write for changed JS/Svelte files; Bun node_modules/svelte-check/bin/svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings; Bun node_modules/vite/bin/vite.js build. Inline Bun -e assertions only; no saved test scripts, shell/Node/npm/Python execution or native source changes.

## Verification

36 inline assertions passed:

-20 queue/helper cases: unavailable host, FIFO, queued/active/pre-abort, empty response, stale events, count/character/label limits, cancel-all, default helper/UI hook, cache result, unmount and remount.
-4 active-deadline cases: paused time, overlapping pauses, remaining budget and disposal.
-8 compiled-worker/client/queue cases: prompt bridge,6.1-second human wait, answer/resume, external abort, opt-in requirement, missing heartbeat, ten-minute hard-cap cleanup (main timer accelerated to700ms for this check), recovery with no live workers.
-3 interactive isolation cases: non-prompt wait still expires, guest infinite loop still interrupts after prompt, repeated prompts resume correctly.
-1 user-Cancel case: AbortError reaches the caller, dialog queue clears and worker terminates.

Svelte check0 errors/0 warnings; Vite production build passed. The compiled-worker checks use Bun workers with simulated browser location/WASM loading. They do not prove DOM focus, Escape/native dialog events or WebView CSP behavior. CUA inventory was rechecked and returned apps=[]/browsers=[]; mounted visual/keyboard/native acceptance remains unverified. No new installer; source newer than BUILD.json.

## Shared request render sessions

createRequestRenderSession(context, options) in template-session.js owns a structured-cloned snapshot of context, resources, history and request/workspace/environment IDs. Options specify purpose preview/send and an AbortSignal; ask may be supplied by the application, defaulting to the mounted dialog service. Use await session.render(text, fieldName) for each field, then session.dispose() in finally. The returned signal represents the whole session. Do not pass Svelte proxies; take a state snapshot first, as the existing preview does.

Each top-level field is limited to64 recursive renders and depth12. The session allows1000 total renders and16 simultaneously active workers; the future field pipeline should sequence ordinary fields. A render failure, external abort or disposal cancels all remaining child work. Send-purpose sessions have a ten-minute total lifetime; expiry is exposed as TimeoutError rather than silently becoming a generic cancellation. Preview calls automatically dispose their session.

The interaction coordinator is private to the session. Only the application ask callback acquires a wait token. While any such token is held, all registered clients in that session pause their remaining active budgets and post boolean interaction notifications to their workers. The core subscribes before VM evaluation and immediately receives current wait state. Worker heartbeat state combines direct prompt waits and shared waits; a parent without its own prompt still has a watchdog while a descendant asks. Release tokens are idempotent and overlapping prompts cannot resume a parent prematurely. Different sessions do not share this state.

This replaces the previous nested-field timing limitation. It does not yet handle dependent network request execution or recursive environment values. Actual Send remains on the old renderer. The new send-purpose session explicitly rejects response trigger modes always/no-history/when-expired until dependent-send integration is implemented; default/never reads existing response snapshots. Preview behavior still ignores trigger modes and never sends.

Additional verification:19 assertions (10 compiled-worker session cases,7 coordinator lifecycle cases,2 nested timeout/watchdog cases) passed. Snapshots stayed unchanged after caller mutation; multi-level request/header/parameter parents survived6.1 seconds of prompt waiting and resumed; Cancel/error/timeout left no live workers or prompt entries. Timeout check accelerated the main session timer. Svelte0/0 and Vite build passed. No DOM/WebView acceptance is claimed.

References: https://mozilla.github.io/nunjucks/api.html#asynchronous-support , https://developer.mozilla.org/en-US/docs/Web/API/AbortController , https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage , https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone .

## Next steps in order

1. Shared preview/send session and nested field prompt propagation are implemented. Continue with recursive values and dependent network sends using the ownership/timing contract above.
2. Resolve recursive environment/request fields with cycle/budget limits and precise field errors. Integrate the async renderer across URL/query/header/body/auth and HTTP/GraphQL/gRPC/stream/OAuth call sites.
3. Register cancellation before rendering in Send, connect dependent-response sends with chain protection, and implement the original prompt-cache send-session lifecycle.
4. Verify actual WebView interaction/keyboard/cancellation and native workflows, then rebuild the installer. Continue all other PARITY items; this milestone does not complete migration.


</details>

<a id="record-send-rendering"></a>

<details>
<summary>SEND-RENDERING</summary>

# Send renderer integration

Updated: 2026-09-29. HTTP Send and initial SSE/WebSocket connection preparation now use the isolated async renderer. Full migration is incomplete.

## Implementation

- request-render.js renderSendRequest(data, request, signal) creates a send-purpose session from the snapshot's resources/history/environment layers and disposes it in finally immediately after request rendering. Network/OAuth cancellation remains owned by workspace.execute's existing controller. The running entry and completion handle are registered before any prompt or worker starts.
- workspace.svelte.js execute uses the rendered request for HTTP and initial SSE/WebSocket connection composition. It recalculates protocol after rendered headers are available, performs OAuth prevalidation, awaits OAuth if required, and calls prepareRenderedRequest with the resolved Authorization value. A signal check before dispatch prevents a cancelled renderer from launching a network request. Introspection remains on the previous pipeline; gRPC has separate callers and is not yet integrated.
- request-render.js preserves description KEEP, GraphQL comment workaround, body opt-out, disabled row/auth filtering and default protocol behavior described in the prior checkpoint. Unlike legacy's whitelist projection, migrated extra fields are retained. CookieJar can be rendered through renderRequestSnapshot, but current Send does not yet supply a native jar snapshot. suppressUserAgent is calculated but not consumed by Rust yet.
- oauth-model.js resolveOAuth, oauthContext, currentOAuthToken and oauthHeader accept an optional resolved flag. In this explicit application path, credentials and URLs are literal strings rather than templates. Existing callers keep their previous behavior; ordinary resolved credentials preserve existing token fingerprints.
- oauth.js prepareOAuthExchange accepts the same resolved option and composes its token request with prepareRenderedRequest. Manual Authorization still skips automatic token acquisition; explicit Fetch/Refresh still operates regardless of request headers. The existing grant, refresh, expiry, ID-token and token-prefix policies remain.
- oauthSourceContext hashes the raw request, active environment, settings and non-token resources. ensureOAuth compares that digest after a resolved exchange, instead of re-executing template tags or prompts. All token resources are excluded so other token updates do not invalidate the guard. This is intentionally conservative: unrelated resource/settings edits can discard a pending token. External file/OS values and prompt-cache changes are not re-read after the snapshot. The digest is used in memory; raw secrets are not logged or persisted by the guard.
- OAuth token records still bind to the resolved credentials/environment/recipient origin digest, separate from the source-change guard. Returned tokens are discarded if the caller cancels, deletes the request or changes source inputs during the exchange.

## Validation

27 inline assertions passed without saved test scripts:

-7 actual execute() lifecycle cases using Svelte compileModule, built disposable worker/WASM, and a Bun HTTP server bound to127.0.0.1: environment inheritance/tags reach the wire, response history environment and cleanup, literal body opt-out, running state before prompt, prompt answer reaches wire, Stop prevents dispatch, and field diagnostics prevent dispatch.
-12 compiled execute() cases with a mocked desktop IPC boundary: fetch then resource send, literal body/OAuth values, token storage and reuse, token-independent source guard, pending fetch, stale environment discard, cancellation discard, manual Authorization precedence, literal resolved config/exchange credentials and worker cleanup. These do not prove actual Rust IPC/provider/WebView behavior.
-8 pure compatibility cases: old/new ordinary OAuth config and token context equality, existing saved-token header/reuse, changed environment guard, explicit Fetch behavior with unrelated template headers in both modes, and NO_PREFIX.

Svelte check passed with0 errors/0 warnings; Vite production build passed. A missing fourth-argument-compatible conditional branch initially caused one compilation error; fixed by separating introspection and rendered transport calls. One command to construct an import failed quoting before any write; corrected. Initial inline Svelte module loading returned a Bun default export for the percent-encoded long data URL; base64 module import fixed the harness, after which all7 assertions passed. No saved tests, dependency install, native edits, installer or live fixture processes. No real user data was loaded/saved by the fixtures (workspace.ready=false); all worker counts returned to0.

Official sources read before implementation/validation:

- https://mozilla.github.io/nunjucks/api.html#asynchronous-support
- https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted
- https://svelte.dev/docs/svelte/svelte-compiler#compileModule
- Archived common/render.ts (request/environment pipeline) and current OAuth/transport lifecycle code.

Commands used hidden node_repl execFile with shell:false/windowsHide:true. Bun directly launched node_modules/prettier/bin/prettier.cjs --write, node_modules/svelte-check/bin/svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings, and node_modules/vite/bin/vite.js build. No Node/npm/yarn/Python runtime commands. Upstream build output suggests npm/node commands; those suggestions were not executed.

## Next actions

1. Same-collection finite HTTP dependent sends are implemented (TEMPLATING.md#record-dependent-responses). Complete per-collection environment routing, streaming dependencies and remaining history/UI/native acceptance; retain prompt/ref-count and worker watchdog guarantees.
2. Integrate renderer with GraphQL introspection/validation, manual OAuth Fetch/Refresh and saved-token adoption/display, gRPC discovery/call/message, and subsequent WebSocket payloads. The OAuth editor currently catches synchronous lookup errors but cannot determine the current token from arbitrary tags without a noninteractive preview policy; do not trigger a prompt from reactive UI rendering.
3. Connect native rendered cookie snapshot semantics and User-Agent suppression. Existing native collection cookies still function, but template-bearing cookie values are not yet supplied by this pipeline. Resolve native cancellation races and cookie-update ownership explicitly.
4. Reconcile URL/query encoding with archived smartEncodeUrl/request settings. Current prepareRenderedRequest uses the existing WHATWG URL transport composer. Preserve imported sendEmptyName/noValue/path parameters when resolving legacy differences.
5. Finish prompt cache lifecycle compatibility and native WebView/CSP/dialog/provider acceptance. Source is newer than BUILD.json. The installer has not been rebuilt for these changes.


</details>

<a id="record-template-oauth-graph"></a>

<details>
<summary>TEMPLATE-OAUTH-GRAPH</summary>

# OAuth resources within a dependent response graph

The existing saved `template-response-send.js` scenario now includes OAuth graph mode. It exercises mounted Windows Send, real bundled workers, native OAuth exchange and Rust HTTP transport using synthetic local credentials. Application, CSS and backend are unchanged.

```powershell
bun run check
$env:INSOMNIUM_TEMPLATE_OAUTH_GRAPH='1'
Remove-Item Env:INSOMNIUM_TEMPLATE_OAUTH -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_CYCLES -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_SSE -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_ENVIRONMENTS -ErrorAction SilentlyContinue
bun tests/ui/template-response-send.js
```

Three groups verify sequential dependencies within one root Send:

- Body and header independently send the same foreign request; one token acquisition serves both.
- An expired acquired token refreshes once; both sends use the rotated token and retain its record identity.
- A nested child acquires a token that the later direct root dependency reuses. The nested request receives `X-Nested` without inheriting the foreign Authorization header.

The refresh fixture changes only the acquired token's stored expiry. The third group removes only the scenario-owned foreign token to force acquisition. Native serialization traverses body before headers; nested wire order is token, foreign, nested, foreign, root. These are sequential snapshot-sharing checks. The synthetic client-credentials response supplies a refresh token for compatibility testing; consulted RFC6749 sources and that limitation are recorded in [TEMPLATING.md#record-template-response-oauth](TEMPLATING.md#record-template-response-oauth). This mode reuses the subsystem without dependencies or generators.

Accepted artifact: `artifacts/playwright/template-response-oauth-graph-1791620109619`. Native63420 exited0, passed, `native-hidden`, visible:false. Three groups/13 wire requests/three exchanges/38 workers pass. Independent `bun artifacts/template-oauth-graph-audit.mjs artifacts/playwright/template-response-oauth-graph-1791620109619` verifies703 source hashes and executable SHA256 `c2fbaa430547aa47b2247213cc9579119bb52aae66bf47025775a0e7de6989aa`, literal forms/credentials/scope/Bearer values/nested headers/root body, token context/identity/rotation, ten distinct durable histories and unchanged selection/descriptions. Freeze and cleanup: `artifacts/playwright/template-oauth-graph-source-freeze.json` and `template-oauth-graph-cleanup.json`. Exact owned PID/profile processes are absent.

Compiler89124 exited0 with zero errors/warnings; scenario formatting/diff checks pass. Unchanged468 application hashes bind the reused release. Browser scenarios remain headless; native hosts are hidden before CDP. Concurrent exchange coalescing, interactive/public providers, source races, late-provider completion, broader protocols/platform/accessibility and every original migration/shared UI/UX/CSS gate remain required.


</details>

<a id="record-template-response-cycles"></a>

<details>
<summary>TEMPLATE-RESPONSE-CYCLES</summary>

# Response-template dependency cycles

The cycle mode in the existing saved template-response-send scenario exercises shared mutable dependency chains through the actual mounted Windows native application, bundled template/filter workers and Rust HTTP transport. Application/CSS/backend are unchanged. Shared native-hidden helper remains; browser scenarios continue headless:true.

```powershell
bun run check
$env:INSOMNIUM_TEMPLATE_CYCLES='1'
Remove-Item Env:INSOMNIUM_TEMPLATE_SSE -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_ENVIRONMENTS -ErrorAction SilentlyContinue
bun tests/ui/template-response-send.js
```

Five groups cover self-reference without history, A→B→A without history, a real HTTP history seed for B, mutual root re-entry with B history and self root re-entry using the resulting A history. Missing-history cycles refuse before any wire dispatch/history mutation. Seeded mutual cycles send inner A, then B with X-Cycle from inner A, then outer A; self cycles send inner and outer A. No fake response history is seeded. Every case uses normal production workers and transport. The mutable chain suppresses another resend once a child ID is already present, while an independent root invocation can re-enter once; this preserves the documented TEMPLATING.md#record-dependent-responses contract.

Compiler59998 terminal0/0errors0warnings and formatting pass. Frozen468app/235scenario703paths bind unchanged productionc2fbaa430547aa47b2247213cc9579119bb52aae66bf47025775a0e7de6989aa; only this saved scenario changes relative to prior acceptance, so no native rebuild is needed. Baseline/current freeze: artifacts/playwright/template-cycles-baseline-freeze.json and template-cycles-source-freeze.json. Existing resolver/session/transport reused; no subsystem initialization or new dependency.

Native18909/artifact1791618775431 terminal0 accepts5groups/6wire/12workers; native53620 exit0/native-hidden/visible:false. `bun artifacts/template-cycles-audit.mjs artifacts/playwright/template-response-cycles-1791618775431` independently verifies current703source/executable, literal JSON/root bodies/base64, methods/query/case headers, missing-history refusals, real B seed, inner A→B→outer A order/X-Cycle value, self inner/outer A order, six unique durable history entries (four A/two B), unchanged request descriptions and UI selection. No fake history, controlled workers or mocked transport are used.

Exact owned53620 and its WebView2 profile are absent, recorded in artifacts/playwright/template-cycles-cleanup.json; no live feature handles remain. Compiler59998 terminal0/0errors0warnings, formatting and diff review pass. Application/CSS/backend unchanged; accepted productionc2fbaa43 reused with all468 app paths proven identical. Full provider/concurrency/chain/send limits/protocol/platform/accessibility/SSE history/body bounds/OS transfer/full XPath and original migration/shared UI/UX/CSS gates remain required. This accepts only the covered cycle workflows, not all dependency graphs or full migration.


</details>

<a id="record-template-response-environments"></a>

<details>
<summary>TEMPLATE-RESPONSE-ENVIRONMENTS</summary>

# Response templates across selected environments

The environment mode of the existing saved `tests/ui/template-response-send.js` scenario verifies a foreign collection with a selected child environment through the mounted Windows native application, real bundled workers and Rust HTTP transport. Shared native-hidden setup remains unchanged. Application/CSS/backend sources are unchanged.

```powershell
bun run check
$env:INSOMNIUM_TEMPLATE_ENVIRONMENTS='1'
bun tests/ui/template-response-send.js
```

Four groups cover selected environment variable override on actual wire, response history tagged with the target environment, repeated no-history sends because caller-scoped history is absent, never refusal despite target history, and caller-scoped history reuse without a dependency send. UI selection remains the original root request/collection/Base environment. Caller history is explicitly seeded; this does not claim a real user-generated foreign request response in the caller environment. Each configuration reloads the mounted application before Send.

Compiler2443 terminal0/0errors0warnings and formatting pass. The prior freeze proves all468 application paths unchanged and binds703 current application/scenario paths to optimized release SHA01515fc0526bc20cfc56ebf01005051805df164432b122877377ce44f81bdd08; no native rebuild needed.

First native8023/artifact1791616465601 terminal0 passes the four runtime groups and five wire requests, native51688 exit0/native-hidden/visible:false. Additional independent audit found the caller seed was appended to existing bounded history and evicted after root response persistence. Fixture insertion alone changed to unshift after terminal. The first attempt is retained; no durable caller seed acceptance is claimed from it.

Corrected native52641/artifact1791616642560 terminal0 accepts4groups/5wire/9workers; native68356 exit0/native-hidden/visible:false. Independent audit verifies current703 source hashes/production release SHA, wire order/query/method/literal bodies/base64, request descriptions, caller versus target history identities, repeated no-history sends, refusal without history mutation, durable caller seed and unchanged UI selection. Audit command: `bun artifacts/template-environments-audit.mjs artifacts/playwright/template-response-environments-1791616642560`; result is independent-audit.json in that directory. Exact owned51688/68356 and WebView2 profile processes are absent, recorded in artifacts/playwright/template-environments-cleanup.json. No live feature handles remain.

No subsystem is initialized; existing scope/resolver behavior is exercised. Existing documented API references remain applicable: [Playwright locators](https://playwright.dev/docs/locators), [Nunjucks asynchronous support](https://mozilla.github.io/nunjucks/api.html#asynchronous-support). Environment resolution and caller-versus-target history are intentionally separate, as documented in TEMPLATING.md#record-dependent-responses.

Remaining response-template gates include OAuth/provider updates, cycles, SSE completion/cancellation/framing, protocol/platform/accessibility and broader environment transitions. Original migration, shared UI adoption/ownership and UX/CSS gates remain active. This scenario proves selected child environment routing and the covered history behavior, not full migration.


</details>

<a id="record-template-response-oauth"></a>

<details>
<summary>TEMPLATE-RESPONSE-OAUTH</summary>

# Dependent response OAuth exchanges

OAuth mode in the existing saved template-response-send scenario runs real mounted Windows UI Send, bundled workers, native OAuth token exchange and Rust resource transport against controlled local endpoints. Synthetic owned credentials/tokens are used. It preserves application/CSS/backend and shared native-hidden setup; browser scenarios remain headless:true.

```powershell
bun run check
$env:INSOMNIUM_TEMPLATE_OAUTH='1'
Remove-Item Env:INSOMNIUM_TEMPLATE_CYCLES -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_SSE -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_ENVIRONMENTS -ErrorAction SilentlyContinue
bun tests/ui/template-response-send.js
```

Five groups cover foreign collection Base environment credentials/scope, client-credentials token acquisition and saved token reuse after reload, automatic refresh and rotated credentials, manual Authorization bypass despite a held token endpoint, and root Cancel disconnecting a pending native token exchange without resource/root dispatch or token/history mutation. Refresh uses a real acquired token; only its stored expiry is advanced to exercise refresh without waiting an hour. The local client-credentials response deliberately supplies a refresh token to test the application's compatibility path; this does not endorse issuing refresh tokens for that grant. No IPC or worker mocks, external accounts or interactive browser are used.

Sources consulted: [RFC6749 client credentials](https://www.rfc-editor.org/rfc/rfc6749.html#section-4.4), [refresh](https://www.rfc-editor.org/rfc/rfc6749.html#section-6). Existing subsystem reused; no generator/dependency needed. Compiler15021 terminal0/0errors0warnings and formatting pass. Frozen468app/235scenario703paths bind unchanged productionc2fbaa430547aa47b2247213cc9579119bb52aae66bf47025775a0e7de6989aa. Baseline/current freeze are template-oauth-baseline-freeze.json and template-oauth-source-freeze.json under artifacts/playwright.

First native70311/artifact1791619289509 terminal0 accepts5groups/10main wire/29workers plus one held token exchange; native64004 exit0/native-hidden/visible:false. Independent current703source/c2fbaa43/form/header/token resource/rotation/history/selection/socket Cancel audit passes. First-run freeze is retained in template-oauth-first-run-freeze.json. Before commit, the fixture now explicitly sets timeout30000ms instead of inheriting settings from previous scenarios; only that setup line changes after terminal. Refreshed source binding and formatting pass.

Final isolated-timeout native54969/artifact1791619533021 terminal0 accepts5groups/10main wire/29workers plus one held token exchange; native65112 exit0/native-hidden/visible:false. `bun artifacts/template-oauth-audit.mjs artifacts/playwright/template-response-oauth-1791619533021` independently verifies current703source/executable, two real native token exchanges, grant/client credentials/refresh forms, foreign scope/query, Bearer values and no root credential leak, persisted context/record identity/rotation/reuse, eight successful history entries, unchanged UI selection/request descriptions and actual token socket Cancel without token/history mutation. The held exchange is cancelled before any token response; late-provider success is not covered.

Final compiler30564 terminal0/0errors0warnings and formatting/diff review pass. Exact owned64004/65112 and both WebView2 profiles are absent, recorded in artifacts/playwright/template-oauth-cleanup.json; no live feature handles remain. Application/CSS/backend unchanged;468app source identity proves productionc2fbaa43 reuse. Interactive/public providers, concurrency/source races/within-root shared-token cases, protocol/platform/accessibility and every original migration/shared UI/UX/CSS gate remain required. This accepts only covered local OAuth dependent-send workflows.


</details>

<a id="record-template-response-send"></a>

<details>
<summary>TEMPLATE-RESPONSE-SEND</summary>

# Mounted native response template Send

The separate saved `tests/ui/template-response-send.js` scenario exercises the existing response-tag Send pipeline through the actual mounted application, production template/response-filter workers and Rust HTTP transport. It preserves the existing UI and application source. Fixtures own two collections, seven requests, local servers and native-hidden probe lifetime.

```powershell
bun run check
bun tests/ui/template-response-send.js
```

Planned19groups: two actual source Sends; literal JSONPath string/multiple/falsy/empty values, XPath text/attribute/element-inner-content/scalar values; header/URL/raw fields; four refusals with no root dispatch/history mutation; six trigger behaviors (no-history first/reuse, expired/fresh, unknown, repeated always); nested chain wire order; foreign collection base environment routing without changing UI selection; root Stop disconnecting an actual held native dependency; stopped body-worker late callbacks preserving a subsequent manual request-body edit. Normal cases use real bundled workers. Only the final late-callback case uses the shared saved response-worker controller, with the real3s deadline unchanged.

Sources consulted: [Nunjucks asynchronous support](https://mozilla.github.io/nunjucks/api.html#asynchronous-support), [AbortSignal.throwIfAborted](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted). No subsystem generator is needed for an existing saved UI acceptance scenario.

First native21533/artifact1791611378363 terminal1 after17groups/41workers/20wire. The saved scenario mistakenly located `Stop`, while the actual mounted HTTP action is `Cancel`; the held dependency eventually reached its native request timeout while the locator waited. Native69748 exited0/native-hidden. Only scenario selectors were corrected after terminal; unchanged468application paths/production01515fc0 and refreshed703binding pass. Compiler8091 terminal0/0errors0warnings. Corrected full native82773/artifact1791611900475 is running; outcome remains pending.

Corrected full native82773/artifact1791611900475 terminal0 accepts19groups/43workers/20wire requests plus one held dependency. Native70584 exit0/native-hidden/visible:false. Independent source/build/literal body/base64/history/trigger order/foreign-base routing/actual socket cancellation/worker generation and before-deadline audit passes. Stopped worker late message/error/messageerror callbacks preserve the subsequent manual edit without root dispatch/history mutation. Compiler8091 terminal0/0errors0warnings and formatting pass. Both attempts' owned native/profile processes are absent, recorded in template-response-send-cleanup.json; no live feature handles remain.

`artifacts/playwright/template-response-send-source-freeze.json` binds468unchanged application paths/235scenario703paths to existing optimized production release01515fc0; prior234scenario paths unchanged, only the saved scenario is added. Audit command: `bun artifacts/template-response-send-audit.mjs artifacts/playwright/template-response-send-1791611900475`. Broad OAuth/provider/cycle/SSE/protocol/platform/accessibility, selected foreign environments, unbounded dependency behavior and every original migration/shared UI/UX/CSS gate remain required. This does not claim full response-tag or full migration parity.


</details>

<a id="record-template-response-sse"></a>

<details>
<summary>TEMPLATE-RESPONSE-SSE</summary>

# SSE response-template completion

The SSE mode of the existing saved template-response-send scenario exercises SSE-labelled dependencies through real mounted Windows application, bundled template workers and Rust HTTP transport. The shared held HTTP helper optionally sends headers and a first body chunk while holding EOF. Other callers retain their previous behavior when that option is omitted. The native host is hidden before CDP attachment; browser scenarios continue using headless:true.

```powershell
bun run check
$env:INSOMNIUM_TEMPLATE_SSE='1'
Remove-Item Env:INSOMNIUM_TEMPLATE_ENVIRONMENTS -ErrorAction SilentlyContinue
bun tests/ui/template-response-send.js
```

Four groups cover complete literal SSE framing/base64 and Accept header, header extraction waiting for EOF despite available headers/first event, root Cancel disconnecting a partially received dependency, and real native1500ms timeout without root dispatch or partial-success history. The header case observes unchanged history/root wire and active Cancel before explicitly releasing EOF. Requests remain HTTP response-tag dependencies; they do not create a live SSE event pane.

Sources consulted: [MDN SSE format](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events). Existing subsystem/helper reused; no generator or dependency needed. Initial runs used production01515fc0526bc20cfc56ebf01005051805df164432b122877377ce44f81bdd08. The final native timeout fix changes only http.rs among468 application paths; frontend/CSS remain unchanged. Frozen source is artifacts/playwright/template-sse-source-freeze.json, binding468 app plus235 scenario paths.

Initial compiler33577 reported one possibly-undefined wire.at(-1) assertion. Native70736/artifact1791617044627 had already launched and finished terminal0/4groups, native56568 exit0/native-hidden/visible:false. After terminal the assertion was corrected to optional access and actual displayed timeout error text was added. Final compiler83371 terminal0/0errors0warnings and formatting pass. First-run source freeze is retained separately. Corrected native57151/artifact1791617243227 then failed as detailed below; initial runs do not accept the final timeout fix.

Live SSE event-log versus completed raw history reconciliation, endless body bounds, network faults/provider/protocol/platform/accessibility and all original migration/shared UI/UX/CSS gates remain required. This scenario does not establish full SSE or full migration parity.

Corrected native57151 terminal1 after three groups: its stronger displayed-timeout assertion exposes native `error decoding response body`, although timeout disconnect/no root/no partial history assertions pass. Reqwest Display discards the timeout cause category; pinned vendored0.12.28 Error::is_timeout traverses nested causes. Native http.rs now uses this classification for execute and chunk errors, reporting existing `Request timed out` text. Other error messages are retained. Reference: [reqwest Error::is_timeout](https://docs.rs/reqwest/0.12.28/reqwest/struct.Error.html#method.is_timeout). No UI/CSS change.

Fresh build command: `bun tests/ui/build-recovery-copy-probe.js`, production release/no low-memory override. Original release01515fc0 is preserved under artifacts/native-template-sse-baseline. Targeted `rustfmt --edition 2021 --check src-tauri/src/http.rs` passes; broader cargo fmt check reports existing unrelated formatting only. Initial freeze update rejected ArrayBuffer before write and was corrected to Buffer.

Build40937 finished terminal1: stale LIBCLANG_PATH E:/insomnium is absent after workspace relocation, and libuv bindgen failed. Failure state retained in artifacts/playwright/template-sse-build-clang-failure.json. Corrected invocation uses `$env:LIBCLANG_PATH='E:/.dvgamerr-app/insomnium-app/artifacts/tools/llvm-20.1.8/bin'`, then the same saved build command.

Build21161 completed terminal0/optimized release6m55s. Saved binding command `bun artifacts/template-sse-build-bind.mjs` verifies703 current hashes, isolated probe identity, preserved baseline and fresh executable SHA c2fbaa430547aa47b2247213cc9579119bb52aae66bf47025775a0e7de6989aa, recorded in template-sse-build.json. Saved headless workspace regression passes11 groups/current frontend/terminal0; compiler83371 and targeted Rust formatting pass.

Fresh native59161/artifact1791617973562 terminal0 accepts4groups/3wire/4workers; native67880 exit0/native-hidden/visible:false. `bun artifacts/template-sse-audit.mjs artifacts/playwright/template-response-sse-1791617973562` independently verifies current703 hashes/executable/raw framing/body/base64/EOF/history/selection/Cancel and actual displayed timeout text.

Ordinary HTTP regression25579/artifact1791618102468 terminal0 accepts19groups/43workers/20wire plus one held dependency on the same fresh release; native68164 exit0/native-hidden/visible:false. `bun artifacts/template-sse-http-regression-audit.mjs artifacts/playwright/template-response-send-1791618102468` independently verifies current703 hashes/executable/literal JSON/XML/header/raw values, trigger wire order, nested/foreign Base routing, native Cancel socket disconnect and stopped-worker late callbacks/manual edit preservation. The audit uses the current SSE freeze rather than the earlier release freeze. It proves the shared fixture's default no-initial-chunk cancellation behavior still works.

Exact owned56568/69328/67880/68164 and all four artifact WebView2 profiles are absent, recorded in artifacts/playwright/template-sse-cleanup.json. No live feature handles remain. Compiler83371 terminal0/0errors0warnings, targeted Rust formatting, scenario formatting, saved headless workspace11 and optimized production build pass. Scope is the native timeout identity fix and covered SSE completion/default HTTP regressions; remaining migration gates above stay active.


</details>

<a id="record-template-runtime"></a>

<details>
<summary>TEMPLATE-RUNTIME</summary>

## Isolated Nunjucks engine foundation - 2026-09-28

- Researched original templating/index.ts and official Nunjucks API/templating, QuickJS embedding/runtime limits and CSP WebAssembly documentation. Selected actual Nunjucks inside QuickJS/WASM for compatibility without frontend JavaScript unsafe-eval. This is a foundation decision, not completed request rendering.
- Installed nunjucks3.2.4 and quickjs-emscripten0.32.0 via direct Bun add --ignore-scripts --exact. No lifecycle shell commands. Added template-runtime.js using documented getQuickJS/newContext/evalCode APIs. Fresh VM per render; JSON-only input; no host functions, module loader, filesystem/network/Tauri APIs exposed. Bounds:128MiB VM heap,512KiB stack,2-second interrupt,20Mi-character serialized input/output. All handles/context disposed.
- Preserves original autoescape:false, throwOnUndefined:true, root and underscore context aliases, all/variables/tags delimiter modes and debug identity filter. Uses original Nunjucks filters, expressions, loops/macros/comments rather than a handwritten syntax subset.
  -10 inline Bun assertions passed (bracket/filters, loops, macros, comments, render modes, no autoescape, missing variable error, absent host APIs and infinite-loop interruption). Svelte check0/0 and frontend build passed. No saved test scripts.
- NOT integrated into application rendering yet: model.render remains unchanged. Browser WASM asset/loading/CSP, disposable worker/client, native built-in tag bridge, async request/environment rendering, cancellation/errors, template widgets and plugin compatibility remain required. Browser may need narrowly scoped wasm-unsafe-eval; current CSP has not changed. Nunjucks source parameter must remain trusted bundled code, never user-provided engine source.
- No active operations/new installer. Source newer than BUILD.json. Next: bundle production WASM with documented variant/loader, wire worker/client and verify actual browser acceptance; then bridge original tags and replace all render call sites with async pipeline. Full migration incomplete.

Official references

- https://mozilla.github.io/nunjucks/api.html
- https://mozilla.github.io/nunjucks/templating.html
- https://github.com/justjake/quickjs-emscripten
- https://raw.githubusercontent.com/justjake/quickjs-emscripten/main/README.md
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src#unsafe_webassembly_execution

## Template worker and preview checkpoint - 2026-09-28

- Read official QuickJS packaging/newVariant wasmLocation docs and Vite URL/raw asset docs. Replaced aggregate quickjs-emscripten dependency with pinned quickjs-emscripten-core0.32.0 and @jitl/quickjs-wasmfile-release-sync0.32.0 using direct Bun add/remove --ignore-scripts. Only release-sync WASM is bundled.
- template.worker.js imports trusted Nunjucks dependency as raw text and explicit WASM asset URL. Runtime accepts the initialized engine as first argument. WASM initializes inside the request try/catch so startup failures become worker error messages. No host APIs are exposed to guest templates.
- template-client.js creates one worker per render, supports AbortSignal, terminates on response/error/abort/5-second outer deadline and removes timer/listener. TemplatePreview.svelte is collapsed by default below HTTP text-body editor; opening renders inherited environment, changing text/context/identity cancels old work and closing disposes it. Source body stays unchanged and output is read-only. Preview explains current Send/custom-tag limitation.
- CSP/devCsp add only wasm-unsafe-eval to script-src; JavaScript unsafe-eval remains absent. This config change is not yet packaged or verified in native WebView. Worker275.68kB and one WASM503.13kB emitted; no other QuickJS variants in build.
- Initial direct Bun execution of browser artifact failed because Bun worker lacks self.location. Then exercised the unmodified built worker using an in-memory wrapper simulating browser location and fetching WASM bytes from the actual built asset. Four asserted production-worker cases passed (loop/filter, missing variable, unsupported custom tag, failed WASM load). This is NOT actual browser/CSP acceptance. Fixed potential startup unhandled rejection by moving WASM initialization inside handler, then final Svelte0/0/build passed. No saved test scripts.
- Send/model.render remains unchanged. Full environment expansion, built-in/native async tags, all request/auth/protocol call sites, template widgets and plugin compatibility remain required. Next: original tag/async render orchestration and Send integration, plus real WebView preview/abort/asset/CSP acceptance when a surface is available. No active task processes/new installer; source newer than BUILD.json. Full migration incomplete.

## Worker-local built-in tags - 2026-09-28

- Inspected original BaseExtension parser/run contract, decodeEncoding and local-template-tags implementations. Inventoried remaining render() callers: transport.js (URL/headers/body/auth), graphql.js, grpc-model.js, oauth-model.js and workspace.svelte.js; Send remains on existing renderer.
- Added template-tags.js with base64, now, uuid, hash and jsonpath. Preserves Base64 normal/URL encode and permissive decode, b64::...::46b argument decoding, date-fns2.30 timestamp/custom formats and rounded Unix seconds, UUID v1/v4, four UI hash algorithms (MD5/SHA1/SHA256/SHA512) and hex/base64/latin1, first JSONPath result/error on no results. Additional OpenSSL hash names accepted by the legacy implementation are not yet covered.
- Added a narrow synchronous QuickJS bridge: tag name whitelist, JSON arguments, up to32 args/1000 calls/20Mi argument/result characters. Guest cannot access Buffer/crypto/date libraries or host functions directly beyond this bridge. Nunjucks parses tag arguments using its original signature parser; run modes preserved. Missing-variable arguments serialized as null remain an edge to align with original undefined/default semantics.
- JSONPath uses browser safe evaluator with4096 query length/10000 matches/20Mi cumulative result limit. Host tag work runs inside disposable worker; VM memory/time limits do not independently constrain host-library allocations/execution. Outer worker deadline remains required. Native tags (os/file/cookie/prompt/response/request), asynchronous tag bridge and widgets are still pending.
- Read official buffer, noble-hashes, uuid v9 README and date-fns v2 format source before using APIs. Bun add --ignore-scripts --exact buffer@6.0.3 date-fns@2.30.0 uuid@9.0.1. Existing @noble/hashes and JSONPath reused. No Node runtime or shell invocation.
  -16 inline VM/tag assertions passed; one direct UUID-null guard check and one compiled-browser-worker tag check passed (18 total). Initial Svelte JSONPath return-type diagnostics fixed with runtime array narrowing; Svelte0/0/build passed (worker370.89kB, WASM503.13kB). Build precedes final UUID-null guard and comment-only correction; source remains unpackaged. No saved test scripts.
- Preview explains supported tags and remaining Send limitation. Native WebView/CSP/interaction acceptance remains unverified. No active processes/new installer. Next: asynchronous native tag bridge and environment/request render pipeline, then replace Send/auth/protocol callers without mutating stored request values. Full migration incomplete.


</details>

<a id="record-template-tag-editor"></a>

<details>
<summary>TEMPLATE-TAG-EDITOR</summary>

# Template tag picker and argument editor

## Accepted picker/editor feature — 2026-10-11

Implemented tag selection/raw fallback/exact ranges, eight typed arguments/defaults/overrides/UTF-8 base64, dynamic metadata, guarded debounced preview, store-only custom actions and Prompt Clear. Request fields, GraphQL, gRPC, WebSocket and environment JSON share the editor and preserve existing layout. Request models use collection-scoped folder ordering. Cancel/source replacement retains original text and guards late replies; Apply uses the existing field update once.

Final production48bc/current application source acceptance:

- `plugin-template-editor-1791657166203`:5groups/4real HTTP wires/4terminated workers/2held native reads/4unchanged package files, original workspace and exact store restoration. Six dark-light1440/900/760 profiles measure156controls. Independent editor audit passes.
- `template-tag-fields-1791657146877`:12real mounted native entrypoints/24genuine bundled template workers/six profiles/72controls, exact individual saved values and original workspace restoration. Independent field/source/executable audit passes.
- All12 retained plugin modes pass on48bc, including metadata refusals, catalog/source changes, restarts, store and workspace restoration. Retained HTTP `template-response-send-1791656420271` independently verifies19groups/20wire/43workers and held dependency; original workspace restored.
- Saved headless editor20groups/six profiles/150controls and environment4groups/12genuine workers pass again. Final compiler93550 reports0errors0warnings. Final native22805 terminal0; no owned native app/profile process remains. Scenario type diagnostics from compiler21081 were corrected with JSDoc and explicit owner checks; application source/executable stayed unchanged.

The earlier preparation/build/pending entries below are historical. OS dialog selection is controlled by the saved helper; native file/directory options and real action/store/worker/transport results are verified. Cross-platform/OS dialog lifecycle, full plugin run-helper contexts/hooks/menu actions/themes and the remaining original migration/UX/UI/CSS work remain separate required migration gates. This feature does not complete the full migration.

2026-10-11 native fields and geometry: set `INSOMNIUM_TEMPLATE_TAG_FIELDS_NATIVE=1` and run `bun tests/ui/template-tag-fields.js` (default current native-template-editor probe). Native output1791656812338 independently verifies12entrypoints/24genuine workers/six dark-light profiles/72controls, exact saved values and full workspace restoration. Same saved script supports headless built-browser mode without the variable. Custom native editor output1791656860388 verifies5groups/4wire/4workers/2held boundaries/six profiles/156controls/full store+workspace restoration on unchanged production48bc. Saved top/bottom760 images inspected. A scenario-only geometry revision is recorded against unchanged frozen application hashes; retained pre-revision freeze and audit-reference failure preserve provenance. Remaining retained suite and final cleanup/source checks precede feature commit.

2026-10-11 correction accepted on production `48bc825fc16f6fe924d292562de2add02ce247739d6e83811050be15068d561c` bound758source/scenario paths: `plugin-template-editor-1791656009276` passes5groups/4wire/4terminated workers/2held boundaries/4unchanged files, including argument-change action cancellation/no later store write and directory options. All12 retained native plugin modes/audits pass, with exact workspace/store restoration and hidden owned hosts. Current native screenshot inspected. Fresh `template-response-send-1791656420271` independently verifies19groups/20HTTP requests/43workers on48bc; exact workspace restored at `template-editor-http-restore-1791656492681`. Build61072 and suite86660 are terminal; the pending-build statements below are historical. Per-field native/source/visual/cleanup acceptance remains required before feature commit.

Native baseline verified on production336cb4e2/frozen758paths: editor4groups/4real HTTP requests/3terminated genuine plugin workers/1held native read/4unchanged package files, metadata8types/validation/base64/signed-zero/store-only action, actual Prompt Clear/next Send prompt and general environment custom catalog/n/a request meta pass. Native-hidden/visible:false/exit0; independent store-byte/workspace/worker/source/build audits and native image inspection pass. All12retained editor/rendering/operation/metadata/registry/values/session/store/runtime/formats/discovery/sources modes pass, including restarts. Metadata verifier initially lacked a historical beforeZeroBuild freeze reference; verified/restored the retained executable reference and re-audited the already-successful metadata output before resuming. This did not weaken native checks.

Draft-action correction: the action operation checked dialog/resource ownership but allowed argument changes during an in-flight action. The expanded saved scenario on old336cb4e2 captures a genuine forbidden native write after Text changes during a held read; evidence under `plugin-template-editor-1791655431650`, with exit0/hidden host/store restoration. Action current guard now also requires the original text. Add a second held boundary requiring actual guest termination and no later write before Load recovery. Correct the synthetic file argument to `itemTypes: ['file','directory']` and assert directory options as well as file filters. Retained old executable/source and exact pre-fix dialog under native-template-editor-before-draft; refreeze changes exactly one application guard and one native helper. Corrected production rebuild/five-group native acceptance remains pending; the earlier four-group pass does not accept the new guard or broader scenario.

Native acceptance preparation: set `INSOMNIUM_TEMPLATE_TAG_EDITOR=1` and `INSOMNIUM_UI_BUILD_STATE=artifacts/native-template-editor-probe/build-state.json` separately in PowerShell, then run the existing saved `bun tests/ui/plugin-template-tags.js`. Shared native helper declares a synthetic8type custom tag with metadata validation/actions and exercises real plugin/template workers/native store/loopback Send, one held successful native action read followed by cancellation, Prompt Clear and general environment source/meta. File selection alone uses the existing controlled native dialog helper. Default rendering mode remains the retained scenario. These gates are prepared, not accepted yet.

Consulted [official Tauri build CLI](https://v2.tauri.app/reference/cli/#build). `bun artifacts/build-template-editor-probe.mjs` reuses the established Windows toolchain with documented `bun x --bun tauri build --no-bundle --config`, probe identifier, production profile and fresh Bun frontend build. Frozen758source/scenario paths plus original probe-store presence/bytes are recorded before native acceptance; baseline040ad2f9 remains separate. Build/source binding and retained suite audits are required before a feature commit.

2026-10-11 environment/model update: Environment JSON captures an additional saved-environment owner. Legacy route context uses the active request and its folder environment when present; otherwise use actual collection layers and n/a request meta, with sourceResourceId retained through provider/render snapshots for source guards. No request is fabricated. JSON editors decode only the owning valid string, map logical tag offsets back to escaped source and escape Apply replacements, preserving neighboring properties and existing escaped arguments. Incomplete JSON retains raw authoring.

Request models traverse sorted folders (metaSortKey, descending-ID ties) and show legacy `[Folder] METHOD Name` prefixes. No snapshot mutation; unreachable/cyclic request entries omitted and unavailable selection checked against model type. Reference: archived tag-editor.tsx sortRequests/resolveRequestGroupPrefix, use-nunjucks.ts route context and common/sorting.ts metaSortKeySort.

Saved `bun tests/ui/template-tag-environment.js` passes4groups on the actual built application with12observed genuine template workers: environment Apply/Save, base64 preview, active-request folder context and no-request collection context. Editor20groups/six profiles/150controls also asserts literal hierarchy labels/order. Manual JSON/model23controls cover quotes/backslashes/Unicode/control text/quoted percent ends/exact selection/Unicode escapes/tree ties/orphan/cycle/type/no mutation. Current `template-tag-environment-model-audit.json` binds33source/scenario paths and compiled worker bytes; older audits remain historical. Native custom catalog/source/helper/action/Prompt/Send/per-field acceptance and frozen native suites remain required; no full feature/topic acceptance yet.

Implementation in progress, 2026-10-10, starting from `a33e415` (custom render topic `cde67af833a6fa5ebf7073341c4857aaa040f2ae`). This feature is not complete, committed or accepted in native UI yet. The existing Insomnium layout remains the reference; redesign follows full migration.

2026-10-11 UI preparation: real TemplateTagDialog is connected to the plain/serialized Body CodeEditor through the existing toolbar and Ctrl/Cmd+Alt+Space. It edits the block at the caret or exactly the selected range, applies one CodeMirror replacement and restores focus. Unknown/malformed tags retain raw fallback. Built-in metadata for all11 definitions is extracted from the archived declaration AST, excluding original run/action code; trusted pure metadata callbacks resolve through the existing metadata contract. Uncallable declared names report an authoring error and recover without a page exception. The selected tag uses resolved live/display labels; typed controls retain signed zero, string enum choices, base64 values and missing defaults. Model resources are collection-scoped; native file/folder selectors use declared filters. Parent text/identity changes close stale dialogs. The application session captures request/collection/environment, participates in workspace drain and retains tracked query/preview/path work until terminal after close. Root abort closes the dialog; per-draft preview abort and serialized/coalesced metadata refresh discard stale UI results.

Saved `bun tests/ui/template-tag-editor.js` now passes16groups on actual CodeEditor/TemplateTagDialog/shared UI/built-in metadata, with explicitly controlled custom metadata/preview/file/action adapters. Six full eight-type dark/light1440/900/760 profiles each measure25positive-width controls within the dialog (150controls total); current760top/bottom screenshots inspected. Checks cover quotes/backslashes/Unicode and surrounding text, signed zero/default enums, uncallable-name recovery, validation, variable/expression/model/file/folder controls, hide/disablePreview (no extra preview), controlled action dispatch, raw fallback, keyboard/focus, parent replacement and root abort after exactly1held preview begins. `template-tag-editor-ui-preparation-audit.json` independently validates literal counts/geometry and hashes11current source/scenario paths. This fixture does not prove genuine custom worker/native file/action/Send behavior. Separate manual built-in/range33controls cover11defaults, pure dynamic behavior and7block forms including quoted percent ends/regex/Unicode/quote-backslash public names/trim delimiters. Artifact `template-tag-editor-builtin-range-controls.json`. Retained catalog/render20controls pass.

Failure provenance: the first14group pass checked raw-profile bounds and its Rendering indicator did not prove entry into the held preview. Profiles now use the full eight-type form and the held fixture counts actual entry. Added keyboard/parent replacement uncovered a reopen timeout after external text changed. Waiting for CodeMirror/parent synchronization alone did not fix it. Signal-effect cleanup read the reactive signal prop during parent teardown; capturing its signal reference before cleanup fixes reopen, and all16groups including actual held entry pass. Failed result/screenshot/open-session trace and pre-fix source hashes are retained under `artifacts/playwright/template-tag-editor-before-signal-cleanup`. New failure diagnostics retain page errors/open traces. Compiler exposed stripped callback annotations in generated metadata, its inferred result shape and two harness array/null typing issues; fixed explicitly, without no-check directives. Final compiler/build/checkpoint evidence is recorded in STATUS.md.

2026-10-11 update: production action dispatch is implemented. Archived `templating/extensions/index.ts` defines the action context as store only; the session/runtime invoke the selected action with that frozen context and existing guarded store, independently from tag.run. Host/guest reject malformed index/argument/helper-context queries before store work. Catalog/registry preserve the captured winner and operation owner. Prompt Clear uses `clearPromptValues`. Actual QuickJS24controls verify3store calls,10invalid refusals, correct this binding/context, retained state, cancellation/0forbidden late writes and failure handling; artifact `template-tag-action-vm-controls.json`. Genuine production-worker/native/UI action and Prompt cache acceptance still remains. Full render helper app/network/util/model capabilities are separate remaining gates.

The shared Input/Textarea controller uses no DOM wrapper or layout change and opts in per request field. A keyed child captures the opening frame before reactive host teardown, while guarded Apply uses the existing input pipeline and restores native focus. URL/key-value/auth/GraphQL/gRPC/WebSocket entry points are connected; environment context and richer model hierarchy/order remain pending. Saved headless scenario now passes20groups including scalar caret replacement/one input/focus, parent replacement, CRLF parent identity and abort/reopen. Six full profiles still measure150bounded controls; `template-tag-field-preparation-audit.json` independently binds28source/scenario paths and action VM hashes. Current build/compiler/workspace/design-system pass; these are preparation evidence, not actual per-field/genuine-worker/native acceptance. Initial null-frame teardown failure is retained under `template-field-before-frame-capture`; a separate quote expectation and caret-at-tag-end fixture assumption were corrected. Previous11path audit remains historical.

Consulted official [Svelte shared state documentation](https://svelte.dev/docs/svelte/$state) and [lifecycle hooks](https://svelte.dev/docs/svelte/lifecycle-hooks) before the shared controller; use raw current-frame state and synchronous keyed owner capture. Commands: `bun run check`, `bun run build`, `bun tests/ui/template-tag-editor.js`, `bun tests/ui/nocturne-workspace.js`, `bun tests/ui/design-system.js`.

Fresh frozen native-hidden production acceptance with genuine plugin/template workers, actual metadata/action/Send/per-field boundaries and retained native suites remains required before accepting/committing this feature. Previous040ad2f9 is not evidence for current source. No migration/UX scope is removed.

The editor must provide tag selection, editing existing tags and raw fallback, all eight argument types, missing-argument defaults, variable/expression overrides, encoded arguments, file/directory filters and collection-scoped model selection. Dynamic labels/help/option labels/hide/validation/disablePreview must use the actual collision winner in its explicitly loaded guest session. Metadata querying supplies no helper/store context. Debounced query and preview results must belong to the same open editor, catalog, request/environment and draft version. Actions need the documented action helper contract before activation. Cancel must retain original text and focus; Apply must change only the selected range. Built-in definitions and their dynamic behavior remain necessary, alongside custom definitions. Shared UI components, keyboard operation, dark/light widths and saved reusable headless/native-hidden scenarios are required.

Prepared `src/lib/template-authoring.js`: data-only parsing/serialization/default-fill for string, number, boolean, variable, expression, enum, file and model. Untouched raw argument expressions retain spelling; nested function/array/object commas and regex literals are kept together. Literal strings escape Nunjucks quote/backslash/newline/tab/carriage return syntax rather than JSON unicode escapes. Numeric exponent output is expanded to decimal because the bundled Nunjucks lexer treats exponent text as symbols; finite signed zero is retained. Legacy enum defaults remain strings. Base64 uses UTF-8 and the existing sentinel; literal sentinel-shaped strings are wrapped once to survive the renderer's automatic decode. Parsing incomplete/unrecognized input refuses without evaluation so the UI can preserve it through raw fallback. Limits match the32argument bridge and bounded1Mi-character authoring input.

Captured registry tags now expose guarded metadata queries through the private session, using the same discovery/declaration collision winner as request rendering. The private dispatcher checks operation/catalog ownership again after completion and retains explicit Load recovery for closed guests. Metadata calls exclude render/helper context. The shared catalog checks request/environment source ownership and dialog AbortSignal/current guard before and after a query; resolved definitions retain the winning plugin/effective presentation priority. No automatic plugin loading or metadata execution on capture is introduced.

Manual Bun stdin controls pass on the actual QuickJS renderer:48controls for all eight defaults, signed zero/minimum/maximum finite/exponent/precision numbers, quotes/backslashes/Unicode/control text/literal sentinel/base64, nested and regex expressions, missing defaults and invalid input. Artifact `artifacts/playwright/template-authoring-model-controls.json`, source SHA256 `b945d7e29d4024d800e2f167f235dd06795eb44d7362d87c13b19f2b9ab02da5`. Initial manual control incorrectly expected direct custom runtime handlers to decode base64; decoding happens in template.worker.js. The corrected manual control explicitly models that existing worker boundary, with no renderer change.

Manual catalog controls pass10groups/3metadata calls/0helper contexts: discovery winner independent of Load order, correct metadata dispatch, stale dialog before/after a held reply, unchanged live session status on refusal, resource-source change, catalog invalidation, recovered winner and aborted signal. Artifact `template-authoring-catalog-controls.json` includes exact current registry/catalog hashes. Initial fake discovery omitted real admission identity fields; corrected its version/format/directory-qualified entry before querying, without weakening admission. Retained `bun artifacts/plugin-template-controls.mjs` passes20controls. Final `bun run check` handle19467 terminal0/0errors0warnings; formatter and diff checks pass. No native acceptance or mounted editor pass is claimed.

Consulted [official Nunjucks custom tags](https://mozilla.github.io/nunjucks/api.html#custom-tags), its installed lexer/parser and archived `templating/utils.ts`, `ui/components/templating/tag-editor.tsx` and local definitions before implementation. The official CodeMirror5 manual URL returned a retrieval error; use the installed show-hint source or official documentation before wiring completion. Tooling uses Bun only.

Before UI integration, consulted the [official CodeMirror5 manual in its repository](https://github.com/codemirror/codemirror5/blob/master/doc/manual.html) and [Tauri dialog documentation](https://v2.tauri.app/plugin/dialog/) for existing editor range/key APIs and file/directory/filter options. No package/generator/subsystem initialization was needed; existing shared components/helpers are reused.

Next: complete the built-in authoring definitions/dynamic behavior, dialog controller/component and actual CodeMirror/request field entry points; preserve whole-expression raw fallback, selected text and ownership. Then saved mounted headless scenarios, genuine plugin-worker/native Send/metadata/action boundaries, frozen fresh production/native acceptance, retained regressions and visual/cleanup audits. Commit the verified full feature by topic, record its actual SHA/evidence/remaining gates/live handles and provide the required compact handoff. This interface cannot invoke `/compact`. Every original migration/UX/UI/CSS requirement remains active.


</details>

## Request JSON formatting and escaped templates — 2026-10-16

HTTP/gRPC request Format now passes replaceUnicode:false to the existing token formatter. Decoding escaped braces/percent characters previously manufactured template delimiters and changed subsequent rendering. Authored Unicode escapes, integer tokens and intentional templates remain intact; response display formatting is unchanged. Reference: RFC8259 section7 (https://www.rfc-editor.org/rfc/rfc8259#section-7).

Inline Bun actual model.render comparison reproduces the old escaped-template expansion and verifies corrected literal/active-template behavior. Saved headless tests/ui/json-request-format.js verifies actual built-app Format/persistence/reload for HTTP and gRPC, exact escapes/large integer tokens and parsed JSON equality; both pass. Initial HTTP button label was corrected from Format to Format JSON. Frontend build passes; final check session67061 exits0 with0errors/0warnings after scenario typing corrections (including a previous legacy scenario's possibly undefined requests access). No native/network acceptance claimed or new artifact scripts. Full migration remains incomplete.

## Bracket-path environment completion — 2026-10-16

Synchronous caller follow-up: model.render now parses own-property dot/bracket lookups through template-variable-path.js rather than splitting on dots. Quote-aware interpolation boundaries support braces inside quoted keys; quoted escapes, empty/numeric keys and existing _ alias/nested depth behavior remain. No eval, filters/operators/functions or computed variable indexes are introduced. Inline bundled Nunjucks scalar-path comparisons and actual prepareRequest URL/header/body checks pass, along with unsupported-expression refusals. Build/check22429exit0/0errors/0warnings and existing headless environment-completion plus grpc-history-app scenarios pass. Native/wire/provider/platform and broader migration remain open; no live handles/new scripts.

Completion editing follow-up: partial quoted bracket keys now retain suggestions; choosing a path replaces the remaining key without removing surrounding JSON. Existing filters/operators remain after completion without an inserted premature closing delimiter. Reserved literal names true/false/none/null use quoted bracket lookup, including nested keys. Inline bundled-Nunjucks checks pass reserved-name values, partial/mid-key replacement and filter preservation. Existing headless environment-completion scenario now passes6cases (partial bracket, reserved key and filter controls added), build/check58225exit0/0errors/0warnings and scoped diff pass. No native/Send claim or new scripts; no live handles.

Shared environmentPaths now emits quoted bracket lookups for non-identifier keys, including numeric/empty/space/hyphen/quote keys, using the existing Nunjucks argument serializer. Root non-identifiers use the existing _ context alias. Completion accepts complete bracket segments, replaces bracket suffixes and avoids adding a second root alias. JSON editors escape inserted completion text through the existing owning-string detector. Names-only discovery, depth/count/cycle bounds and getter nonexecution remain intact. This also supplies paths to the template-tag variable datalist.

Official reference: https://mozilla.github.io/nunjucks/templating.html#variables. Inline Bun bundled Nunjucks rendering validates generated paths; cycle/getter controls pass. Saved headless tests/ui/environment-completion.js verifies actual shared CodeMirror selection of three hyphen/space/quote paths, valid JSON insertion and no displayed environment values: artifacts/playwright/environment-completion/result.json. Build and final scenario exit0; check25958 exits0/0errors/0warnings. The first inline completed-path probe used a cursor before the closing bracket; correcting its cursor to line.length passes. No Send/native/isolated-VM/provider/platform acceptance is claimed; broader migration stays open. No new artifact scripts or live handles.

## JSON-string template interpolation during Send — 2026-10-16

Follow-up to bracket completion: selecting a name containing apostrophes/backslashes produced valid JSON source, but whole-text Nunjucks could not interpret the JSON-escaped expression. HTTP JSON body rendering and unary/client-stream gRPC message rendering now opt into JSON-string interpolation through the existing renderTemplateValue traversal. The data-only scanner decodes only literal template expressions within valid JSON strings, renders them through the same guarded session and escapes their result back into the string. Other source tokens remain byte-for-byte, including large integer spellings and escaped literal braces. Field order, disabled/blacklisted behavior and source snapshots remain owned by existing traversal. Invalid JSON, blocks and comments retain whole-text rendering; this is not new block-template support. Interpolation count1000 and output20Mi character limits apply.

Inline Bun actual renderRequestSnapshot with a controlled bundled-Nunjucks session passes HTTP escaped paths, source preservation and skipBody; scanner controls pass quoted/backslash paths, escaped literal braces, integer/Unicode tokens, a single fallback and count/output budgets. Existing saved headless grpc-history-app.js producer scenario passes actual executeGrpc/template worker/Channel/history/reload and asserts the rendered quote-containing value plus exact9007199254740993 token at controlled IPC boundary: artifacts/playwright/grpc-history-producer/result.json. Native Rust/wire remains unverified for this revision. Final frontend build/scenario exit0; check94521exit0/0errors/0warnings, scoped diff clean. No new test/artifact scripts or live handles. References: Nunjucks variables and RFC8259 section7 above. Broader original migration gates remain open.


## Variable origin in template dialogs — 2026-10-16

Template dialogs now identify the winning environment/folder for plain variable references and variable tag arguments beside the existing rendered Preview. Environment values and provenance share one layer resolver, preserving base/selected-environment/folder shallow override order. Provenance carries resource identity/name/type, without duplicating values. Sessions snapshot it and retain existing stale-owner guards. Input/CodeEditor dialogs receive it through the same session props; test/custom sessions may omit it. The caret range finder now recognizes {{ variable }} as well as {% tag %}, including quoted delimiters and JSON source offsets; explicit selections and outer tag precedence remain.

Inline Bun controls pass overlay/value/provenance precedence, shallow nested-object replacement, unchanged source data and variable/tag/JSON/selection ranges. Existing template-tag-fields with INSOMNIUM_VARIABLE_SOURCES_ONLY=1 passes actual URL-caret opening, Base Environment origin, rendered Thai value and Cancel preserving source (~2.18s, headless). Receipt/screenshot artifacts/playwright/template-variable-sources/, inspected. Initial check exposed optional-session fixture compatibility (fixed without editing fixtures); initial UI exposed missing variable-caret handling (fixed, failed-variable-caret-result.json retained). Final compiler29487 exits0/0errors/0warnings; build exits0. No new dependencies/scenario/artifact scripts/native build/profile changes or owned live handles. Inline variable decorations/showVariableSourceAndValue toggle, broader expression provenance and native/platform/full migration remain open. /compact unavailable.


## CodeEditor variable value display — 2026-10-16

Editable CodeEditors with a template session can now display plain {{ variable }} lookups as rendered values prefixed by their environment/folder origin. Enable Show variable source and value in code editors in Preferences/Editor, or toggle the persisted showVariableSourceAndValue setting with legacy Alt+Shift+U. It defaults false. CodeMirror replacement marks change presentation only; original expressions remain editor/persistence/Send source and tooltip text. Values enter textContent, never HTML. Entering a mark exposes its original editable text. Non-lookup expressions and failed previews remain authored source. JSON-aware range mapping reuses the template authoring path.

Preview uses existing sessions (no prompts/dependent sends),200ms debounce and3second cancellation deadline. Changes/focus refresh marks; owner/session checks suppress late results and teardown aborts work, closes sessions and removes marks/listeners. No new runtime or dependency. References: archived nunjucks-tags.ts and official CodeMirror5 manual markText/clearOnEnter/replacedWith (codemirror.net returned403; read github.com/codemirror/codemirror5/blob/master/doc/manual.html).

Existing template-tag-fields with INSOMNIUM_INLINE_VARIABLES_ONLY=1 passes displayed Base Environment/Thai/escaped markup, original expression in getValue, persisted Alt+Shift+U toggle, reload and removal of marks on disable (~3.49s, headless). Receipt/screenshot artifacts/playwright/template-inline-variables/, inspected. First inline edit command had a duplicate constant declaration and made no integration changes; initial integrated compiler required adding the setting default. Final compiler34164 exits0/0errors/0warnings; build exits0. No new test/artifact scripts/native build/profile changes or owned live handles. Native Input/Textarea inline display, non-lookup expressions/tag decorations, controlled races/editing/Undo/native/platform and full migration remain open. /compact unavailable.


Inline expression follow-up (source parent d9496b2b): CodeEditor now passes non-lookup {{ expressions }} to the existing preview renderer as well. Only simple lookups receive a single environment/folder attribution; expressions are not falsely assigned one source. Failed/undefined expressions remain authored text. Existing focused headless case now includes {{ "hello" | upper }} → HELLO and missing-variable refusal alongside prior source/escaping/toggle/reload controls; passed~3.65s, prior plain-variable receipt retained. Compiler98790 exits0/0errors/0warnings; build exits0. No new scripts/dependencies/native/profile/live handles. Other Input/Textarea/tag decorations/native/platform/full migration gates remain open. /compact unavailable.


## Native variable-dialog integration — 2026-10-16

Normal maintained build-namespace-probe producer completed for application source b750dc5d (no build bypass/new runner). Candidate artifacts/native-namespace-audit-probe/response-editor-20261016-attempt-1/build-state.json reports finished/code0/sourceClosureVerified:true; app SHA a604aacddb535f31961629a3729aa9f919ce8efb27c65139e33077a7f96f7b6a. Cargo release took7m49; total producer~17m includes required hook/input inventory. Candidate notice coverage remains incomplete/targetLinkage unproven.

Existing template-tag-fields native source-only branch passed once (~7.49s total): actual Tauri storage, URL variable caret, dialog origin/Base Environment, rendered Thai preview, Cancel retaining original URL and no page errors. Host61436 was hidden before CDP (native-hidden), exited0 and is confirmed absent. Exact loaded-workspace object restoration passes in artifacts/playwright/template-tag-fields-1792163203880/restoration.json; screenshot inspected. This is not physical profile-byte/OS-close/other protocol or response-viewer acceptance. The shared native helper overwrote the branch result with its own passed host receipt; assertions still completed before helper success. The maintained scenario now records native mode correctly and writes branch details to acceptance.json in future runs; this report-only change postdates the compiled source, with no assertion/app change and no duplicate rerun. No new scripts/native rebuild/matrix expansion/live owned handles. Full migration and remaining inline/native/media gates stay open. /compact unavailable.

## Escaped JSON environment completion — 2026-10-18

Fixed a shared CodeEditor bug affecting HTTP/gRPC JSON bodies and JSON variable editors: a partially typed environment path containing quote/backslash escapes was matched against encoded JSON source and produced zero suggestions. Completion now matches the decoded owning string, maps its replacement range back to UTF-16 source boundaries and JSON-escapes insertion once. It preserves existing filter suffixes, readable name-only labels and surrounding source. Carets inside an escape are refused. Regular JSON completion scans only the owning editor line; custom template-range handling remains in place. The existing source mapper was extracted as jsonStringContext and reused by template authoring.

Before/after production-helper receipts reproduce the missing quoted-key suggestion and verify quote/backslash completion, filter preservation and escape-boundary refusal. Three direct comparisons against the Git HEAD templateEditorRange implementation preserve escaped owning-string/tag selection and malformed-JSON fallback. Reused tests/ui/environment-completion.js: its existing escaped-key case now starts from an encoded partial path; total remains6cases, with no new scenario/script/matrix. Actual saved headless CodeMirror Ctrl+Space/pick checks pass (2.79s), using shared launchUiBrowser(headless:true), including original reserved-key/nested/name-only/filter controls.

Final bun run check exits0/0errors/0warnings; production bun run build and saved scenario exit0; diffcheck passes. Evidence artifacts/editor-json-{completion-before,completion-control,authoring-equivalence,check,build,ui} and editor-json-verification.json; UI receipt artifacts/playwright/environment-completion/result.json. Official RFC8259 section7 consulted: https://www.rfc-editor.org/rfc/rfc8259#section-7 . CodeMirror manual URL returned403; installed official codemirror addon/hint/show-hint.js source was read for completion list/range behavior. Existing SDK/component integration needs no generator/new dependency.

No native backend/build/profile or provider/network Send acceptance claimed; actual gRPC/native/automatic-popup/IME/other-platform and every retained PLAN/PARITY gate remain open. No owned live handles; six unrelated dirty baseline paths preserved. Migration incomplete; /compact unavailable.
