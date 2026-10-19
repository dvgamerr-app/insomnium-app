# RUNNER migration

Updated 2026-10-14. Runner and user assertions are implemented with scoped native lifecycle/resize/results receipts. Remaining script/import/provider/platform compatibility stays required.

See [current status](STATUS.md), [execution plan](PLAN.md) and [complete parity requirements](PARITY.md). No original scope was removed by consolidation.

## Topic records

<a id="record-agent-runner-content-resize"></a>

<details>
<summary>AGENT-RUNNER-CONTENT-RESIZE</summary>

# Runner ancestor clipping corrected; API/Test content matrix — 2026-10-12

Actual saved negative at dark900×600/Home: responsive Runner own width626 stacks at640, source-pane180px. Real CodeMirror Ctrl+End owns input and reaches line40/last40, but caret369.891–389.078 is clipped by test-list/split-content bottom353.781. Test code viewport220 exceeds actual available180; CodeMirror scrolls within its own220 viewport while ancestor list has scroll136/max177. This is a real clipped-content failure despite internal scrolling, not a textarea selection assumption. API Design18cases and Runner1440three cases pass before the original strict failure.

Minimal product correction is ONLY four CSS lines in `src/lib/components/RunnerPane.svelte`: test-list becomes size query container; test-code maximum height100cqh uses that actual pane's height. Default test-code220/min150/native vertical resize remain specified, shared CodeEditor180 remains unchanged. No viewport-derived size, fixture scrolling, excluded ancestor, tolerance relaxation or global editor change. Root explicitly authorized the scoped sizing after negative and official contract review. Existing flex context supplies container size; saved actual geometry proves no flex collapse or changed pane/results dimensions.

Official references read before adoption: [CSS Conditional Rules5 container-relative lengths](https://drafts.csswg.org/css-conditional-5/#container-lengths), [container-type documentation](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/container-type), [container sizing guide](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_size_and_style_queries). Size containment enables block/inline size-relative descendants; contextual sizing is necessary to avoid collapse. Actual saved Chromium checks require size/unit support and computed container type. No other-engine/native acceptance inferred from documentation.

SAME reusable `exerciseWorkspaceEditorContent` in split-pane helper runs after existing API/Test normal split checks in nocturne-workspace. Dark/light1440/900/760×600×Home/End/Enter produces API18 + Runner18 cases. Actual final caret, owning input, finite ratio bounds/orientation, all clipping/scroll ancestors and viewport bounds pass. API uses real multiline12-operation document, Validate & preview, keyboard End selection and actual final operation docs. Tests creates one real saved UI fixture test, edits multiline code and proves test-name content clicks; results coverage is empty-state only. Runner executor/content-heavy results and native code-box resize behavior remain OPEN.

Saved sizing assertions: roomy test-list398.203px/code220px; compact900/Home list179.984/code179.984px; shared CM minimum180px. Former failing caret now329.891–349.078 fits all ancestors. Actual CSS rounding leaves CodeMirror180px inside179.984px box within original1px geometry tolerance; no tolerance change. Independent audit compares all recorded initial four original pane metrics exactly to fixed cases: width/height/axis/bounds/value/focus unchanged. Test results/other split children dimensions are also recorded. Original editor text is explicitly cleared then restored and compared even if empty, with separate API/Test restoration JSON.

Source generation is honest: immutable own F9 root input plus already-approved GraphQL CSS. Current root API/Runner/API-style bytes matched own before measurement; newer root Event5ae18d1 runtime is NOT claimed tested by this build. Final manifest binds259supporting product/config/package/lock inputs and48emitted assets/actual F9 worker. Only Runner product source differs from prior GraphQL final manifest. Root must retain newer Event and integrate ONLY guarded topic paths, never supporting worktree source overlay. All original GraphQL proofs remain unchanged.

Commands/evidence: original scenario6ed4e8 exits1; compiler69148/330c59 exits0errors0warnings. Original negative `artifacts/workspace-editor-content-proof/negative/audit.json`/seven-file harness/root UI source snapshots/raw API18/Runner3pass+1fail/screenshot are immutable. Scoped build149dce exits0; first workspace46028/937bf0 passes; strengthened workspace17546/61ba32 passes; final workspace99701/2f87de passes after explicit text-restoration assertions. Final compiler80838/42c6ae reports0/0. Standalone saved workspace five-module Bun compile passes d99681.

Theme first58962/873383 encounters known two-tooltip strict-selector race and is frozen. One unchanged retry86475 was already live before root's message and exits0 (01add8), retained separately. Root's exact approved current theme124fa file copied only after all jobs terminal: six selectors select visible opacity1 tooltip, original typography/color/shadow assertions remain. That parent-owned source change is NOT this lane's delta; before/current bytes and guard are saved under theme-root-sync. Updated SAME theme70279/44edb3 exits0, compiler27899/d1fbfd0/0. No further known-race retry or assertion change.

Final retained acceptance: GraphQL12caret/4real captured viewport transitions, segmented16; collapse6/release12/storage48/origin9/heavy12profiles/36states/12reloads and full theme. Final independent audit d99681 at `artifacts/workspace-editor-content-proof/final/audit.json` SHA `4dd51b057bf2de402eb29b29a4befbf52547fcbd3d2ce1f3a145081397401587`, plus exact source/frontend/harness14/workspace/theme snapshots and raw restoration evidence.

Guarded deliverable hashes:

- RunnerPane baseline `9c0127103f49bcc6cde0f91f8146718717f9e12ece60cc8b8b88dac0c4333244` → final `efa54e3afaf7512acde001183eb1f77c2b03353c6309c2a5a45925eb34f26d72`.
- split-pane helper baseline `2b72a8c5141f3f929160339d3597a6b934b9eac8c85317c8e9ebbc6c9558f859` → final `90a2d3c26eca40768e0ccefdbf5b91a28d645b762d1c4a2216ced76cd55d6b43`.
- workspace baseline `63eaf31a3679855c044df3fca20844da645b992e45e2a4b4e763922a6efaa4a1` → final `191237b7228f214ff9ca0464c7a3796f225a8e084ef5318f2d06c39f00d304ac`.
- This report. No GraphQL CSS, heavy helper, parent theme fix or other supporting sources are topic deltas.

All own handles terminal; source frozen for guarded root review/replay/topic commit. No native profile claim/launch; this new product generation needs fresh native acceptance. Full UI/platform/executor/results/native/migration and historical cookie cleanup remain open. Parent owns STATUS/commits. `/compact` unavailable; explicit handoff supplied.

## Root integrated scope and broader theme failure

Independent259source/48asset/14harness review confirms only Runner product source differs from approved GraphQL generation; guarded3path integration preserves newer root Event runtime. Fresh root build64b4c4 and compiler32099 pass0 errors/0 warnings. SAME workspace27266 passes API18/Runner18 actual final caret and all ancestors, original editor text restoration, GraphQL12/4 and all retained collapse/release/storage/origin/heavy reload assertions. Current full source/tests/assets/workspace proof: artifacts/runner-content-root-proof/root-audit.json.

Broader root theme5134 exits1: even the previous opacity1-only tooltip selector resolves two active matching elements during artificial shared typography mutation. Original failure, source and installed CodeMirror addon are frozen under theme-negative. The earlier fading-node selector fix is insufficient for this additional case; no retry is used as closure. This broader gate remains OPEN and assigned as a separate saved-theme diagnostic/correction topic, retaining original strict/style assertions. Agent own theme pass remains historical isolated evidence; it is not current-root full-theme acceptance. Scoped Runner36-case regression/build/compiler prove this correction; full UI/migration acceptance is not claimed. Native bb75 captured before this product change and cannot accept it. All root handles terminal; /compact unavailable, handoff recorded.


</details>

<a id="record-agent-runner-executed-results"></a>

<details>
<summary>AGENT-RUNNER-EXECUTED-RESULTS</summary>

# Runner executed result interaction — 2026-10-12

Test-only acceptance extends the SAME `tests/ui/nocturne-workspace.js` through a reusable `tests/ui/helpers/runner-results.js`. No product CSS, runtime, layout, provider or dependency changed. Six owned pure-Chai authored tests run through the actual Run Tests action and emitted QuickJS/Mocha/Chai worker: one pass/five rich failures, exact24-line actual/expected arrays, result suite/collection/single-run identity and exact persisted record after a new document. These tests perform no HTTP; original history remains exact.

Current root immutable `artifacts/lint-root-proof/{snapshot,preflight.json}` was captured/independently rehashed into own `artifacts/runner-results-proof/current-root`:693 files including49 emitted assets. This is the current root e971 generation, not older own F9 build. Actual emitted runner worker SHA780d4646473481c23a9d8275b0bd9e820bfde62d90d09e494a6dccf8388b5fce; plugin worker e97193465f35adaad738f8daea26d9887c504e40f1bb2c0443312df72aec1d3b. Supporting model77d089/preview5493/split90a2/heavy35d7 are byte-identical to captured root. Own check verifies the added JS harness against own existing application sources; it does not relabel own stale Event sources as current root. Actual browser executes current-root frozen emitted assets.

## Actual acceptance and retained negatives

Dark/light1440/900/760×600: six profiles verify native summary Enter opens, Space closes/reopens, exact failure payload, trusted wheel reaches last stack line inside all six clipping ancestors and viewport, real click on visible result text, summary focus retention and editor-side input click. Axes remain vertical at1440 and horizontal at900/760. Final stack bottom530.390625 or530.484375 is below568 pane limit. Original pure assertion data/result IDs survive reload; finally restores exact original resources/history AND entire private localStorage inventory byte-for-byte, including split keys. No native profile/store/cookie is touched.

- V1 strict-locator failure53f714: summary and fullTitle paragraph share the authored name. Scope SAME locator to native summary, not product change. Six actual results/reload/restoration already passed. Source/output preserved under measurement-v1.
- V2 strict geometry failure478f4c: stack height407.81 exceeds398 pane; Playwright scrollIntoViewIfNeeded centers oversized pre, bottom572.39 vs568 pane. No real scroll had been exercised. Source/geometry/screenshot/results/restoration preserved under measurement-v2. Do not claim a product clipping bug from automatic centering.
- V3 actual trusted wheel with SAME strict bounds passes6518/61e2c5. Source/output preserved under measurement-v3. It proves diagnostics reachable through existing pane scrolling; no CSS correction needed.
- Initial compiler41799 rejects eight implicit-any callbacks in new helper. Corrected JSDoc only; subsequent39100/26858/1540 and final21384 pass0errors/0warnings.

Final saved scenario78557/1f7454 terminal0; final compiler21384/d3c59d terminal0/0. Source freeze acd93c precedes launch; no source changes or overlapping own check/build/scenario. Final independent audit d0038f passes693 captured files/49 assets/six current harness snapshots/actual result+restoration+six profiles; stripping ONLY one import and one call leaves the original workspace scenario byte-identical after whole-text CRLF normalization. Every original API18/Runner18 caret, GraphQL12/4capture, collapse6/release12/storage48/origin9/heavy12/36/12reload assertion remains and passes in SAME final run. Product build is reused exactly, no new build needed for this test-only feature.

## Exact handoff

- `tests/ui/nocturne-workspace.js`: baseline191237b7228f214ff9ca0464c7a3796f225a8e084ef5318f2d06c39f00d304ac →8922f2c91fbaba85892e16eb21a8e1e6a0ce9dbb573dcd92baae6fcd110a08d5 (only import/call).
- NEW `tests/ui/helpers/runner-results.js`:eaa9abdc885e5c39d58e5e6212e115975bc5a02096d028c4cdb513d5ecf1a54c.
- This report is third deliverable; root obtains its final SHA independently. No other production/tests/helper overlay.

Saved command: set `INSOMNIUM_UI_PREVIEW_BUILD=artifacts/runner-results-proof/current-root/snapshot/build`, then `bun tests/ui/nocturne-workspace.js`. Standard root command remains `bun tests/ui/nocturne-workspace.js` against its own current build. Shared launchUiBrowser is headless:true; no headed/browser-use/ad hoc runner. Original `bun tests/ui/runner-lifecycle.js` remains separate native-hidden HTTP/cancellation acceptance and is unchanged.

Final audit `artifacts/runner-results-proof/final/audit.json` SHAe18ae30fb6c3b4f01718cdc134836497dbc296b729d4107ecf307bb2904bb1ee. Its sourceHashes map to `current-root/snapshot/[path]` (includes build paths), harnessHashes map to `final/harness-snapshot/[path]`, outputs map to `final/output/[path]`. Final output includes exact execution, six geometry rows, result/reload/restoration and retained workspace results. Prior failure.png is excluded from final output and retained in immutable negatives.

## Remaining original scope

No native current-generation Runner UI/vertical codebox-resize, network request/callback/cookie/OAuth/dependent-request, cancellation, crash/OS-close, import/nested-suite/deleted-resource/script compatibility, other-engine/platform or full migration/UX claim. Historical runner-lifecycle30305 native acceptance remains valid for its exact generation and960px scopes. PLAN/PARITY remain PARTIAL. Root owns integration/topic commit/STATUS. No live own handles, listeners/native hosts or native namespace claim. Existing lint/GraphQL/Runner/CRUD proofs remain immutable. `/compact` is unavailable in this interface; explicit frozen handoff replaces it without claiming compaction.

## Root current acceptance

Root rehashes693capturedinputs/49assets/sixharness/output and independently verifies original saved scenario byte-exact after removing only import/call. Guarded3path test-only integration preserves current7fdcbc4 product. Root compiler58906 0errors/0warnings and SAMEsavedworkspace12583 exit0: actual6workerresults/six600px profiles, keyboard details/trustedwheel/contentclick/persistedreload, entirelocalStorage exact restore and all originalworkspace regressions pass. Current proof artifacts/runner-results-root-proof/root-audit.json. No product fix needed. Native and original broader Runner/migration scopes remain OPEN. Allroot handles terminal; /compact unavailable, explicit handoff.


</details>

<a id="record-native-runner-acceptance"></a>

<details>
<summary>NATIVE-RUNNER-ACCEPTANCE</summary>

# Native Runner acceptance

Updated: 2026-09-29. In progress; not proof of complete migration.

## Build and isolation

Use the existing compiled frontend and an application identifier reserved for this probe:

```text
bun x --bun tauri build --no-bundle --config '{"identifier":"app.insomnium.probe.runner20260929","productName":"Insomnium Native Probe","build":{"beforeBuildCommand":null}}'
```

Launch Bun directly through node_repl child_process, with shell:false/windowsHide:true. The null hook prevents the CLI from invoking a shell build hook; run the documented Bun frontend build separately when frontend changes. This overlay does not edit production tauri.conf.json. Do not launch the production identifier against user data for fixture acceptance.

The probe overwrites the usual release executable output. Until a production-config build is made again, do not distribute that output or describe it as a production build. BUILD.json still refers to the older production package.

The existing local native environment needs all of:

- CARGO_HOME D:/home/.cargo and RUSTUP_HOME D:/home/.rustup.
- PATH including MSVC bin/Hostx64/x64, Windows SDK bin/10.0.19041.0/x64 and Cargo bin.
- LIB including MSVC lib/x64 and Windows SDK Lib/10.0.19041.0/{ucrt,um}/x64.
- INCLUDE including MSVC include and Windows SDK Include/10.0.19041.0/{ucrt,shared,um,winrt}.
- LIBCLANG_PATH E:/insomnium/artifacts/tools/llvm-20.1.8/bin.

Installed MSVC root: C:/Program Files (x86)/Microsoft Visual Studio/2017/BuildTools/VC/Tools/MSVC/14.16.27023. SDK root: C:/Program Files (x86)/Windows Kits/10. These are machine-specific paths, not portable prerequisites.

## Observed build failure and correction

The original child exited 1 while a callback-based variable still read null; child.exitCode established termination. A retry with durable logs showed ring failing on stddef.h and vswhom-sys failing on windows.h because INCLUDE was missing. Verified installed SDK headers, then supplied INCLUDE only in the child environment. Do not replace libraries or alter application code to work around this environment error.

The retry records stdout/stderr in artifacts/native-runner-probe/build.log and completion in build-state.json; the preceding failure is in previous-build.log / previous-build-state.json. Files are ignored build artifacts. Check actual process liveness together with these records before restarting; a running status file alone is not evidence of a live process.

## Command permission correction

snapshot_request_cookies already existed in Rust and frontend callers but was missing from the application command manifest and capability. Added it to src-tauri/build.rs and src-tauri/capabilities/default.json. Build generated permissions/autogenerated/snapshot_request_cookies.toml with allow/deny entries. Native invocation still needs verification; no prior runtime failure is claimed without observation.

## Acceptance sequence

1. Confirm successful native build and isolate/copy the resulting probe executable.
2. Launch only the probe identifier. Enable WebView2 remote debugging via child-local WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS on an available loopback port, with an isolated WebView data folder.
3. Inspect loaded UI and native app identity/path before writing fixture data.
4. Run controlled local HTTP requests from Tests UI, verifying actual Rust IPC, cookie snapshot capability, template worker/WASM, result display, Stop and persisted reload.
5. Capture visual/runtime evidence, close the probe, stop fixture servers and record exact remaining gaps.

Do not bypass CSP to obtain a passing result. No application credentials or production service endpoints are required.

## Official sources consulted

- [Tauri CLI](https://v2.tauri.app/reference/cli/) — build/config/no-bundle.
- [Tauri permissions](https://v2.tauri.app/security/permissions/) — command manifest/capability.
- [Microsoft compiler environment](https://learn.microsoft.com/en-us/cpp/build/reference/cl-environment-variables?view=msvc-170) — INCLUDE search paths.
- [WebView2 debugging](https://learn.microsoft.com/en-us/microsoft-edge/webview2/how-to/debug-visual-studio-code) — child environment remote debugging.
- [DevTools Runtime](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/) and [Page](https://chromedevtools.github.io/devtools-protocol/tot/Page/) — evaluation and screenshot evidence.

## Native acceptance observed — 2026-09-29

The corrected build finished with code 0 at 08:01:17 UTC (release compilation 6m02s). Executable size 13,259,776 bytes; the probe identifier was present in the binary and returned by the running native app via plugin:app|identifier. Copied it to artifacts/native-runner-probe/insomnium-native-probe.exe. Production config was unchanged; no installer was built.

Launched the copied executable with an isolated WebView profile and child-local debugging port. Used Bun WebSocket/CDP against that app's loopback debugging endpoint. The real page loaded at http://tauri.localhost with the production CSP; no CSP bypass or browser transport mock was used.

Created a separate **Native Runner Acceptance** collection through UI controls, then edited the local request URL, suite, request selection and JavaScript test through the mounted inputs/CodeMirror. Tests used a Bun server bound to 127.0.0.1 on an ephemeral port. Other collection history visible in the probe was excluded from these assertions and left intact.

Verified:

- Run Tests executed real Mocha/Chai/QuickJS worker/WASM and shared native HTTP sender.
- Two HTTP requests returned 200 and the expected response header/body; Set-Cookie from the first request was sent as runner_cookie=native on the second.
- Native saved workspace contained one passing result and two history entries for this fixture; cookie snapshot permission did not block Send.
- Run this test produced a deliberate 200-versus-500 assertion failure, with Expected/Actual/stack shown and the explicit single-test reference persisted.
- Stop during a received /slow request displayed Run cancelled. After the server's 12-second response delay elapsed, no extra result or history was saved.
- Fresh-document reload retained exactly two results (one pass, one deliberate failure) and three history entries. The latest failure was shown in Tests after navigation.
- Four controlled fixture requests were observed in total: three /echo and one /slow.
- Captured and visually inspected native screenshots of passing and failed result layouts. This is evidence for this dark-theme Runner view, not full original-UI parity.

Evidence is in ignored artifacts/native-runner-probe: build-state.json/build.log, app-state.json, requests.json, runner-evidence.json, lifecycle-evidence.json, failure-ui.json and runner-{passed,failed,stopped}.png. The fixture JavaScript was entered into the product's API-test editor; no saved development test script was added.

Probe corrections/limits:

- Initial reload observer raced the outgoing DOM; changed it to require a new document marker and then rechecked successfully. No application change was needed for that probe error.
- Programmatic plugin:window|close was denied by the existing ACL. The probe was idle and persistence already checked; cleanup used the existing allowed destroy command. App exited 0 at 08:08:05 UTC; fixture server stopped with SIGTERM and liveness check confirmed it gone. Normal OS close/shutdown-during-work remains unverified.
- Native Import opens the file picker; the paste/review branch currently opens only in browser preview. No desktop paste import was proven. Review this UI gap next rather than assuming preview behavior establishes native parity.
- This proves a bounded native Runner/HTTP/cookie/persistence flow, not provider auth, proxy/TLS, all protocols, all Runner script semantics, install/upgrade or full migration.

Next: address the native paste-import gap, finish Runner legacy/script/history compatibility and remaining PARITY acceptance. Keep the isolated probe identity for later runs, preserve existing probe data or create a fresh identity, and do not distribute this executable as the production app.

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


</details>

<a id="record-runner-inventory"></a>

<details>
<summary>RUNNER-INVENTORY</summary>

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

2026-09-29 checkpoint: Isolated native release build and real WebView Runner flow passed: cookie round-trip, passing/failing assertions, Stop without late saved result and fresh-document reload (2 results/3 history/4 fixture requests). Dark Runner screenshots inspected. Probe closed and fixture stopped. Native paste import gap found; full parity remains pending. See RUNNER.md#record-native-runner-acceptance.

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

- Added a new Native Callback Acceptance collection with local HTTP request, suite and test, preserving existing probe collections.
- One test exercised direct insomnia.sendRequest(id), detached callback, then an overridden callback invoked by insomnia.send(). Status/body assertions and delegation count passed: UI 1 passed / 0 failed, local server exactly 3 /echo requests.
- Changed only this fixture's request/code to direct sendRequest against /slow. Waited for fourth server request, clicked Stop, and waited 8.5 seconds past the server delay. UI reported Run cancelled; saved result count and entire persisted history were unchanged.
- Reloaded a new document using an unload marker guard; persisted result count/history remained unchanged and UI showed the prior passing result.
- Inspected callback-reload.png. It shows the edited cancellation script alongside the prior passing result, not a new result for that edited script.
- Idle probe destroy completed exit 0 at 09:17:55 UTC; fixture process confirmed gone. This is not normal OS-close-during-work acceptance.

</details>

## Legacy guest timer overflow behavior — 2026-10-19

Runner guest setTimeout/setInterval now use Node-compatible delay conversion: values outside1..2147483647 (including NaN/Infinity) become1ms, and valid fractional values truncate. Previously a large/Infinity delay saturated to2147483647 and could make a script wait until the runner deadline. Internal run watchdog bounds are unchanged. Reference: https://github.com/nodejs/node/blob/main/doc/api/timers.md .

Actual production runSuiteIsolated with installed QuickJS/Mocha/Chai completes one guest flow containing large/Infinity/NaN/negative timeout callbacks and an Infinity interval that clears itself:1pass/0fail/~150ms, artifacts/runner-timer-clamp-20261019.json. Frontend check0errors/0warnings/build0. No saved testcase/scenario created/modified or existing suite rerun; no transport/provider/native UI operation. Worker/HTTP cancellation/native/platform and all retained runner/migration gates remain open.

Runner response empty-header compatibility: archived network/unit-test-feature.ts reduces captured headers from an empty array, so a valid header-less response exposes headers=[] while nonempty responses expose the lowercase last-value map. runnerResponse now preserves that distinction. Production adapter matches archived reduction for empty headers, duplicates and literal __proto__ key, retaining UTF8 BOM; artifacts/runner-response-headers-20261019.json. Check0errors/0warnings/build0; no saved testcase/scenario changes/runs. Actual native header-less HTTP/worker UI and broader runner/migration gates remain open.

Guest timer validation follow-up: shared bootstrap/test timer wrapper now validates callback type synchronously before delay coercion, returning TypeError with ERR_INVALID_ARG_TYPE. Delay uses ToNumber via unary plus, so BigInt/Symbol reject rather than Number(BigInt) silently accepting it. Valid string delay and callback arguments remain supported. Official legacy Node18 sources: https://github.com/nodejs/node/blob/v18.15.0/lib/timers.js and https://github.com/nodejs/node/blob/v18.15.0/lib/internal/timers.js . Exact diagnostic wording and Node Timeout-object methods are not established by this change.

Actual production QuickJS/Mocha flow verifies callback validation/error code before valueOf, BigInt/Symbol refusal and string-delay arguments:1pass/0fail, artifacts/runner-timer-validation-20261019.json. Check0errors/0warnings/build0; no saved testcase/scenario changes/runs, transport/native UI/provider work. Broader runner/migration gates remain open.

Current production-worker integration (2026-10-19, source8cfeb064): unchanged INSOMNIUM_RUNNER_MODULES=1 bun tests/ui/runner-management.js passes headless/2.02s, using current built runner.worker-D4AF0JSF.js. Real browser Worker/Mocha reports2pass/0fail for Chai, shared Buffer/node:buffer Unicode behavior and unsupported host-module/process isolation. artifacts/runner-current-worker-integration-20261019.json binds source/scenario/worker-entry hashes and exact result. This retains existing integration after timer/response changes; it does not add timer cases or prove native IPC/HTTP cancellation. No scenario changes, native/profile/provider operation or owned live handles; full migration remains incomplete.

Runner interval cadence follow-up: guest repeating timers now use the host interval instead of starting a new timeout after guest callback/pending-job execution. This avoids adding callback runtime to every requested period. Explicit cancellation and test/VM teardown use clearInterval; one-shot timeout behavior is unchanged. Actual QuickJS/Mocha flow repeats then clears an interval and creates a second interval retired at test boundary, leaving zero owned host intervals. artifacts/runner-interval-cadence-20261019.json; check0errors/0warnings/build0. No saved testcase/scenario changes/runs. No strict wall-clock precision, Node event-loop phase, native worker/UI or full migration completion claim.
