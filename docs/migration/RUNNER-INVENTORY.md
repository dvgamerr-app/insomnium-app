# Collection Runner migration inventory

## Saved native runner lifecycle acceptance — 2026-10-07

`tests/ui/runner-lifecycle.js` now makes the earlier callback/Stop acceptance reproducible using the existing native-app and owned-collection fixtures plus a loopback HTTP server. It passed on the fresh native-ui-ownership-probe build at `artifacts/playwright/runner-lifecycle-1791349076305/{acceptance,result}.json`; the owned app exited0. Check passes0 errors/0 warnings.

- Direct `insomnia.sendRequest`, detached callback and replacement/delegation through `insomnia.send` cause exactly three real native HTTP sends with status/body/header assertions.
- A full suite persists two passing assertions and one deliberate failing assertion; a single-test run persists its exact test ID/count and does not run the callback test.
- A fresh document retains result history and displays the saved single-test result.
- Stop during a held native HTTP send closes the server-side connection, displays Run cancelled and leaves persisted result records and response history unchanged, including after reload.
- A fresh callback run after Stop succeeds through a new worker/native send (four successful fixture requests total).
- Runner layout has no workspace overflow in dark/light at1440/900/760; the dark760 screenshot was inspected.

Run with Bun: `bun tests/ui/runner-lifecycle.js`. The default build record is `artifacts/native-ui-ownership-probe/build-state.json`; `INSOMNIUM_UI_BUILD_STATE` may select another successful isolated build allowed by the shared native helper. Run sequentially with other native scenarios. No production app/data or external provider is used.

Remaining gates include original script/import/result compatibility, nested suites, deleted resources during execution, OAuth/cookie/dependent-request combinations, OS-close/crash/provider and other-platform acceptance. This saved scenario supplements the earlier cookie/script evidence; it does not establish full Runner or migration parity.

2026-09-29 checkpoint: Isolated native release build and real WebView Runner flow passed: cookie round-trip, passing/failing assertions, Stop without late saved result and fresh-document reload (2 results/3 history/4 fixture requests). Dark Runner screenshots inspected. Probe closed and fixture stopped. Native paste import gap found; full parity remains pending. See NATIVE-RUNNER-ACCEPTANCE.md.

Updated: 2026-09-29
Status: **Runtime/worker/shared sender/Tests UI implemented; full parity and native/visual acceptance pending.**

## Legacy contract

Sources under `_backup/legacy-electron/packages/insomnia/src/`:

- `models/unit-test.ts`: saved name/code/requestId, parent suite.
- `models/unit-test-suite.ts`: named suite, parent workspace; tests/suites can duplicate.
- `models/unit-test-result.ts`: results record; canDuplicate/canSync false.
- `models/workspace-meta.ts`: activeUnitTestSuiteId/activeRequestId; canDuplicate false.
- `ui/routes/actions.tsx`: Run all generates tests with defaultRequestId and saves result under workspaceId. Run one saves under unitTest.parentId (suite). Preserve both historical shapes.
- `ui/routes/{unit-test,test-suite,test-results}.tsx`: suite list, rename/delete/create, JavaScript editor, HTTP request selector, run suite/one, results/detail.
- `network/unit-test-feature.ts`: sends with selected request environment, rendering and plugin transforms. Returns status, statusMessage, UTF-8 data, lower-case header map (last duplicate wins), responseTime.

Engine sources under `_backup/legacy-electron/packages/insomnia-testing/src/`:

- `generate/generate.ts`: recursive describe, async arrow it, expect from chai; beforeEach clears active request, then per-test default request selected.
- `run/insomnia.ts`: insomnia.send(optional request ID), otherwise active request; missing request throws "No selected request".
- `run/run.ts`: Mocha/Chai, 60-second timeout, bail/filter; old Node globals/temp-file loading must be replaced.
- `run/javascript-reporter.ts`: tests/passes/failures/pending/stats; preserve assertion error own properties and result details.

## Implemented data correction

`src/lib/resources.js` now remaps activeRequestId and activeUnitTestSuiteId during additive imports.
Collection duplication excludes oauth2_token, unit_test_result and workspace_meta per archived model policy. Suites/tests and requestId links still copy. Import retains historical results and workspace metadata; literal script code and result payloads are unchanged.

Verified with 18 inline Bun assertions covering collection copy, suite/test/request references, original data preservation, both result parent shapes and imported token marker. No saved test scripts or user data changed.
Commands: `bun -e <inline resource assertions>`, `bun run check`, `bun run build`. Svelte 0 errors/0 warnings and production build passed.

## Implementation sequence and acceptance

1. Package actual Mocha browser runtime and Chai for isolated execution, using Bun commands after checking package/version docs. Official browser setup is mocha.setup followed by mocha.run; validate worker/QuickJS compatibility before choosing the final adapter. Do not replace full assertion semantics with a few hand-written checks.
2. Add a Runner-owned execution lifecycle: immutable suite/test input snapshot, per-test active request, 60-second timeout, Stop, bounded active execution/memory, error serialization and deterministic cleanup. Template renderer's short active-execution budget must not accidentally become the entire network-test timeout.
3. Extract/reuse the shared HTTP send path in workspace.svelte.js. Preserve environment/auth/cookies/proxy/TLS/dependencies/history/cancellation. Return the owned response directly; do not read a mutable editor response to obtain test results. Specify environment snapshot semantics before implementation.
4. Add Svelte suite/test CRUD, selected request, code editor, run suite/one, Stop, and result detail matching the original layout. User-authored API tests are product functionality, distinct from repository development test scripts.
5. Store results consistently for new runs, while reading imported workspace-parent and suite-parent history. Keep originals through import/export/reload. Define deleted-suite/request behavior and prevent late run completion from resurrecting data.
6. Verify real UI → IPC → native network flow, assertions (pass/fail/error/pending), timeout/infinite loop, async send, cancellation, auth/environment inheritance, duplicate/import/reload and closing the app mid-run.

## Documentation consulted

- [Mocha browsers](https://mochajs.org/running/browsers/) — browser bundle/setup/custom reporter; this does not prove QuickJS compatibility.
- [Chai BDD API](https://www.chaijs.com/api/bdd/) — full chainable assertions.
- [JavaScript Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) — explicit key mapping for references.

A guessed singular Mocha browser URL was inaccessible; followed the official homepage link to the plural URL above. No packages installed during that inventory milestone. See the later compatibility checkpoint below.

## QuickJS compatibility evidence — 2026-09-29

- Confirmed archived insomnia/package.json uses chai ^4.5.0 and mocha ^10.8.2. Installed exact chai4.5.0/mocha10.8.2 to preserve that baseline. Registry latest was newer; no compatibility claim for those newer major versions.
- Command: `bun add --exact --ignore-scripts mocha@10.8.2 chai@4.5.0`. No Mocha CLI or Node executable was run. Package manager added79 packages; production browser code must use the browser bundles only.
- Inline Bun probe loaded actual `mocha/mocha.js` and `chai/chai.js` inside fresh QuickJS0.32, with128 MiB memory/1 MiB stack and10-second interrupt deadline. Supplied guest timers, a no-op console and empty location.search. Host pumped executePendingJobs and disposed timer handles/context.
- First attempt failed because Mocha's browser run reads location.search. An empty guest-only location fixed it; do not expose the desktop location.
- Six cases completed: deep equality, Promise/async and delayed timer passed; deliberate assertion failure retained actual1/expected2; unresolved Promise timed out at50ms; skipped case reported pending. Seven host assertions checked this report. This establishes basic compatibility, not the finished runtime.
- The probe's interval alias was only a temporary fixture. Production timer adapter must implement correct repeating/cancellation behavior or explicitly establish which timer surface is required. It also needs stop/timeout cleanup, pending host-send disposal, interrupt/error handling and worker packaging.
- `bun run check` (0 errors/0 warnings) and `bun run build` passed. Bundles are not yet integrated into Vite/worker output, so this build does not prove their WebView loading.
- No saved test scripts, UI implementation, actual HTTP send, Tauri acceptance or installer rebuild in this milestone.
- Next: implement the actual isolated Runner worker/runtime and insomnia.send Promise bridge, then connect owned shared transport and UI. Keep full Runner parity TODO until end-to-end behavior is verified.

Sources consulted before installation/probe: [Bun add](https://bun.sh/docs/pm/cli/add), [Mocha browsers](https://mochajs.org/running/browsers/), [QuickJS upstream](https://github.com/justjake/quickjs-emscripten). Follow the upstream deferred-promise/job-pumping and handle-disposal APIs for the send bridge.

## Isolated runtime implementation — 2026-09-29

Implemented `src/lib/runner-runtime.js` exporting runSuiteIsolated(engine, sources, suite, send, options).

- Fresh QuickJS VM and real Mocha/Chai browser bundles. Suite snapshot, async per-test code, default/explicit insomnia.send, selected-request reset, filter/bail and legacy-shaped tests/passes/failures/pending/stats.
- Host send callback receives request ID and per-test AbortSignal. Deferred QuickJS promises serialize bounded response JSON; pump jobs in bounded batches. Timed-out/ended tests discard late host responses without waking stale script continuations.
- Actual repeating timers with clear support. User timers are scoped to their test and cleared at test boundaries; Mocha captures independent scheduler functions before user timer wrappers replace globals.
- Stop rejects the run and aborts transport; final cleanup disposes VM, timer handles and pending deferred promises. Host must observe the AbortSignal; runtime cannot forcibly stop an arbitrary callback that ignores cancellation.
- Limits:128 MiB VM memory,1 MiB stack,2 Mi characters source,1000 tests/timers,100 concurrent sends/10000 total sends,20 Mi characters response/results. Default test timeout60 seconds (configurable1–600000ms). VM entry interrupt at min(timeout,2 seconds), distinct from awaited network time. Whole-run watchdog covers scheduling stalls.
- Initial reporter missed error payload because it did not inherit Base; fixed by capturing fail-event error. Initial infinite-loop probe expected a rejected run; actual Mocha reports it as a failed test with interrupted error, now verified explicitly. A malformed tool string failed before writing and was corrected.
- Twenty inline assertions passed against actual module/QuickJS/bundles:9 report/send/interval checks,11 lifecycle checks (Stop/abort, delayed response and stale timer suppression, infinite loop failure, filter, bail, empty suite). No saved test scripts.
- Prettier, bun run check (0/0), bun run build passed. Module is not yet imported by application UI, so build does not establish worker/WebView packaging.
- Remaining before feature completion: worker loading/termination and hard Stop while synchronous guest executes; shared native HTTP sender and environment semantics; suite/test UI CRUD and results persistence; nested suites, rich error/result edge cases, resource exhaustion and real Tauri acceptance. Do not mark Runner parity complete.

## Worker and supervisor — 2026-09-29

- Added runner.worker.js: Vite raw imports of actual Mocha/Chai browser bundles, QuickJS WASM URL using the existing template-worker pattern, one run per worker, send-result routing, per-request abort notifications and cleanup.
- Added runner-client.js: runSuiteInWorker plus supervisor. Stop terminates the worker directly and aborts every pending host transport, without waiting for guest JavaScript to cooperate. Result/error/message decode failure/postMessage failure/deadline all dispose worker and requests.
- Supervisor enforces sequential unique request IDs, request/concurrency bounds, source size, startup15-second deadline and overall run watchdog. Late host completion cannot post into a finished/aborted run.
- 14 inline supervisor assertions passed with a message stub: success, transport failure, cancellation before dispatch, pending transport abort, stale completion suppression, duplicate IDs, post failure and termination.
- Vite programmatic build (configFile:false, worker.format:es, build.write:false, lib.entry runner-client.js) emitted the worker and its WASM/browser support assets. A temporary ignored artifacts directory then held those exact outputs for an actual Bun Worker probe. Six assertions passed: async request/response and deep assertion results, plus hard Stop during an infinite guest loop with pending transport aborted in under1 second. Directory removed in finally. No saved test scripts.
- This verifies real built-worker execution under Bun, not a Tauri WebView or native request. Application UI still does not import this entry. No package/dependency changes this milestone.
- Prettier, bun run check0/0 and application bun run build passed.
- Next: connect the shared owned HTTP sender/environment selection, suite/test UI and persistent results; then real WebView/native lifecycle acceptance. Existing timeout/limit and error serialization edge cases remain in scope.
- Docs read before implementation: [Vite workers](https://vite.dev/guide/features.html#web-workers), [Worker terminate](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate).

## Shared HTTP sender and saved results — 2026-09-29

- Added workspace.runTests(suiteId, optional testId), reusing sendDependentRequest rather than a separate fetch path. That path already performs shared rendering, response dependencies, OAuth/source guards, native request preparation, cookies/proxy/TLS, HTTP history and cancellation.
- Suite name/test code/default request IDs snapshot at run start. Each insomnia.send reads current request/environment state (including per-collection selection), matching archived getSendRequestCallback lookup. Response dependencies share that Send snapshot. Editing environment between Sends therefore affects the next Send; changing OAuth source while its token is pending retains existing rejection behavior.
- Run owner lives in workspace.running[suiteId], so existing OAuth dependency-owner progress/manual callback checks and Stop/shutdown work with the suite. Shutdown completion waits for outstanding sender promises after worker termination.
- Track suite/tests and requested/dependency IDs. Existing remove() stops any affected Runner before removal. Results are written only if owner/suite/test membership survives completion; cancellation/deletion does not add a new result.
- New results use workspace parent plus unitTestSuiteId/unitTestId. Added unitTestId import remapping. runner-model.js selects suites, converts status/statusMessage/UTF-8 data/lower-case last-wins headers/responseTime, and reads both legacy result parent shapes. Byte decoding retains a UTF-8 BOM like legacy Buffer.toString.
- 13 inline model assertions passed, including BOM/invalid bytes/header duplicate/import references. Executed the actual runTests source with mocked worker/sender and real model/scope/resolver: verified two Sends observe different selected environments, owned sender routing, result persistence, cancellation, deleted-test rejection and completion cleanup. This is action wiring evidence, not native HTTP execution.
- Prettier, bun run check0/0 and bun run build passed. No saved tests or installer build.
- Next: suite/test Svelte UI with original layout, select/rename/create/delete, one/all runs, Stop, result detail and persistence/reload acceptance. Also verify pending dependencies, auth/provider/cookie flows and hard Stop through real Tauri IPC. Result retention/deletion UX and nested suite semantics remain to review.
- Docs consulted before integration: [AbortSignal.any](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static), [Svelte state/snapshot](https://svelte.dev/docs/svelte/$state).

## Tests UI — 2026-09-29

- Added Tests navigation to the existing app shell. Environment/cookie controls remain available; Tests replaces request-tree content with RunnerSidebar and main content with RunnerPane. This follows the archived suite sidebar / test editor / result pane organization and existing theme variables.
- Added suite create/select/rename/delete and test create/name/code/request/delete; saved selection lives in workspace_meta.activeUnitTestSuiteId, with first-suite fallback. Existing CodeEditor provides JavaScript editing. Destructive clicks show inline confirmation; switching suites clears it.
- Connected one-test/all-suite Run, Stop and error display to real workspace actions/worker. Code/name/request edits are disabled while that suite runs. Active suites retain a sidebar Stop button.
- Results show pass/fail/pending counts, duration, failure message/actual/expected/stack, saved run time and single-test label. Previous result remains explicitly labeled while running. Reporter now retains state/pending fields to distinguish same-named tests for new runs.
- Request-only Ctrl+Enter/N/P shortcuts are gated to Requests view, preventing an unrelated hidden request from being sent while editing Tests.
- 12 inline CRUD/selection checks passed, including metadata environment preservation and JSON reload.11 runtime/report checks passed including explicit passed/failed states.
- Prettier, bun run check0/0 and bun run build passed. Production output includes build/_app/immutable/workers/runner.worker-6Ih3vBWF.js and workers/assets/emscripten-module-uFzwHH0Y.wasm. Initial assets-directory lookup was empty; rg --files located the actual workers directory.
- CUA getState returned apps:[]/browsers:[]; mounted UI/visual and native end-to-end acceptance is unavailable through that tool. Do not claim interaction or pixel parity verified. An initial malformed tool string failed before writes and was corrected.
- Next: real Tauri/browser interactions and wire verification, result history/retention/deletion UX, nested/imported suite handling and script compatibility edge cases. Full migration remains incomplete; other PARITY rows remain required.
- Official Svelte derived/each documentation read before implementation: https://svelte.dev/docs/svelte/$derived and https://svelte.dev/docs/svelte/each .

## Compiled workspace integration evidence — 2026-09-29

Executed actual workspace.svelte.js compiled with Svelte compileModule(client) and Vite library build, plus emitted Runner/template workers and QuickJS/Mocha/Chai/Nunjucks. No runner, renderer, request composer or sender was stubbed.

- Local Bun.serve loopback server received four real requests: two successful templated POST sends, one deliberate failed-assertion request, one cancelled slow request.
- Verified per-Send environment changes reached request header/body; Basic authorization matched fixture credentials; response header/status/data reached guest assertions; shared HTTP history updated.
- Deliberate status200-versus500 assertion retained failed state, actual/expected and single-test reference in saved result.
- Stop during pending HTTP cancelled the run, cleared running state, and added neither response history nor test result for that cancelled operation.
- Then enabled actual persist/initialize against an in-memory localStorage fixture. Save serialization, validation/load and restored result/history/error details passed. No user workspace storage was read or written.
- Total25 host assertions passed, alongside guest Chai assertions. Uses browser-preview transport via Bun fetch, not native Rust/Tauri IPC; does not prove CORS/WebView/UI/provider/TLS acceptance.
- First temporary library build used absolute /assets worker paths and failed loading E:/assets. Set base:'./' in the probe build only; production config unchanged. Subsequent runs passed. An exploratory rg included a nonexistent template.js path; corrected by reading the actual template-client implementation.
- Temporary artifact directory removed and loopback server stopped in finally on both failures and success. Bun process exited0 after final run. No saved development test scripts, app source changes, dependencies or installer build this milestone.
- Commands/APIs: Bun -e inline probe; Vite build({configFile:false,base:'./',plugins:[compileModule transform],worker:{format:'es'},build:{write:false,lib:{entry:'src/lib/workspace.svelte.js',formats:['es']}}}); Bun.serve on127.0.0.1 ephemeral port; app.runTests/persist/initialize/shutdown.
- Official docs consulted: [Vite build API](https://vite.dev/guide/api-javascript.html#build), [Bun HTTP server](https://bun.sh/docs/runtime/http/server), [Svelte compiler](https://svelte.dev/docs/svelte/svelte-compiler).

Next acceptance: mounted Tests UI, Tauri IPC/native HTTP, OAuth/cookies/dependencies, deleted resources mid-run, nested suites and result-history management. Keep PARITY partial.

## Public sendRequest compatibility — 2026-09-29

Recovered workspace access after the Windows sandbox launcher failure; no files were changed during failed launcher attempts. Re-read STATUS/PLAN/PARITY and current runtime before continuing.

Archived insomnia-testing/src/run/insomnia.ts exposes sendRequest as the supplied callback. Its send() delegates through this property. The migrated guest omitted it and called the bridge directly, breaking direct calls, detached callbacks and script wrappers/replacements.

Added an async guest sendRequest callback backed by the existing owned __runnerSend bridge; send() now delegates through this.sendRequest. No native API, Node runtime or extra capability is exposed. Existing bridge cancellation, bounds and response handling still apply.

Verification used the actual archived Insomnium class under Bun and actual new runtime with Mocha/Chai in QuickJS:

- Direct callback, detached callback, replacement/delegation, active request selection/clear, host rejection and between-test active reset: legacy 6 passed; before fix new runtime 2 passed/4 failed; after fix new runtime 6 passed/0 failed.
- Five additional host assertions checked direct-callback cancellation, one host call, aborted transport signal and successful fresh context after cancellation.
- bun run check: 0 errors/0 warnings; bun run build passed and emitted updated worker assets. Build's npm/Node suggestions were not executed.
- No saved development test scripts, dependency change, native rebuild or installer in this milestone. Earlier native Runner evidence predates this callback correction and does not verify it.

Sources consulted before editing: archived insomnia.ts/generate.ts/run.ts and current runner-runtime.js; official [Mocha browser setup](https://mochajs.org/running/browsers/) and [Chai BDD assertions](https://www.chaijs.com/api/bdd/). No generator is needed for this existing-runtime fix.

Next: native callback/script acceptance and remaining legacy script/import/result semantics, then other PARITY gaps. Full migration remains incomplete.

## Native sendRequest callback acceptance — 2026-09-29

The callback probe build completed successfully (6m31s compile) using the documented isolated overlay. Verified the new executable timestamp and embedded identifier before copying; running app returned app.insomnium.probe.runner20260929. Official WebView2 environment/debugging and CDP Runtime docs were consulted again.

Actual Tests UI in the native WebView, production CSP unchanged:

- Added a new Native Callback Acceptance collection with local HTTP request, suite and test, preserving existing probe collections.
- One test exercised direct insomnia.sendRequest(id), detached callback, then an overridden callback invoked by insomnia.send(). Status/body assertions and delegation count passed: UI 1 passed / 0 failed, local server exactly 3 /echo requests.
- Changed only this fixture's request/code to direct sendRequest against /slow. Waited for fourth server request, clicked Stop, and waited 8.5 seconds past the server delay. UI reported Run cancelled; saved result count and entire persisted history were unchanged.
- Reloaded a new document using an unload marker guard; persisted result count/history remained unchanged and UI showed the prior passing result.
- Inspected callback-reload.png. It shows the edited cancellation script alongside the prior passing result, not a new result for that edited script.
- Idle probe destroy completed exit 0 at 09:17:55 UTC; fixture process confirmed gone. This is not normal OS-close-during-work acceptance.

Evidence in ignored artifacts/native-callback-probe: build/app logs and state, before-stop.json (includes the passing callback script), callback-result.json, fixture-count.json (4 total), stop-evidence.json, reload-evidence.json and callback-reload.png. The new collection has one saved result; no cancellation result was added. No saved development test script or installer was created. Production BUILD.json remains older.

This closes native acceptance for the latest sendRequest fix only. Broader Runner script/import/result/lifecycle parity, real OS picker/legacy imports, Git/plugin and other PARITY items remain incomplete.
