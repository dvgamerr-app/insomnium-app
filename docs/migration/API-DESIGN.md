# API DESIGN migration

Updated 2026-10-15. OpenAPI request generation and owned Spectral linting are implemented; custom QUERY/method and mixed-query-order receipts are verified. Remaining serialization/custom-rules/native/external-reference/provider/platform requirements remain open.

See [current status](STATUS.md), [execution plan](PLAN.md) and [complete parity requirements](PARITY.md). No original scope was removed by consolidation.

## Accepted import callback lifetime

Verified source:9638705. Document import, reference attachments and example files now retain their registered workspace work until the existing save promise settles. update() and API create() return that same promise; their synchronous mutations and one-save behavior are unchanged. Generation already awaited its accepted save. The persistence queue separately serializes transitions; this correction establishes callback ownership, not evidence of prior data loss.

The saved spectral-api-design entry uses actual production FilePicker callbacks and controls only the mocked save acknowledgment. Historical accepted-import-negative-pinned fails exactly because drain entered/finished before acknowledgment. accepted-import-three-positive passes document/reference/binary-example controls, exact accepted resources/history/selection, edit refusal and recovery. Binary bytes [0,255,13,10,128] round-trip independently. These are headless controlled-IPC proofs, not native storage or OS-close acceptance. Failure cleanup releases the held acknowledgment before closing the browser.

Commands: INSOMNIUM_API_IMPORT_DRAIN=1 with a fresh INSOMNIUM_UI_RUN_LABEL runs the focused controls; omit the first variable for the original full Spectral suite plus these controls. INSOMNIUM_SPECTRAL_FIXTURE_EXE points to the retained exact f5690ce1 sidecar at artifacts/spectral-native-external-root-candidate/spectral-linter.exe; the current generated sidecar has a different hash and is correctly refused by this historical strict fixture pin. Do not relax that pin or relabel historical executable acquisition.

Compiler24097 passes0 errors/0 warnings; frontend build and saved resource-manager-accepted-import-update-regression pass. Original full spectral-api-design-accepted-import-full passes before adding the final reference/binary controls. Final spectral-api-design-accepted-import-three-full (session10103) passes the original full suite plus all three controls; compiler58027 passes0 errors/0 warnings. All owned fixture/browser/host handles are terminal. Windows import save/drain ordering is now verified below; broader model/provider/platform/lifecycle gates remain required.

Native attempt1 uses normal-hook fixed-CRUD candidate artifacts/native-resource-crud-audit-probe/api-import-drain (build72767 terminal0/Rust6m42; executable SHA1aa4a6fb29d60b9129ce4f129be7a473294f64a99679db45813a19fe6bd92f31). A direct standalone preflight correctly refuses an unbound producer PATH before launching any host; runtime uses the maintained namespaceBuildEnvironment bootstrap. Native74356/receipt1792013703175 fails while waiting for the invoke observer to trigger drain; its changed workspace retains the actual imported document, not a passing drain proof. Host17300 exits0/native-hidden; restoration1792013702965 and independent currentf0/d8 hashes are exact. Post-failure fullsource closure47270 passes. The corrected observer uses the existing native Spectral fetch pattern, submits unchanged IPC first and observes the actual response without a gate/delay; the original failed receipt remains immutable. Native claims will remain limited to submitted IPC acknowledgement/callback ordering, distinct from physical write contention, OS picker dialog, timeout/OS-close and all-platform acceptance.
Native acceptance at scenario commit2e04de6/production9638705: normal-hook build83118 at artifacts/native-resource-crud-audit-probe/api-import-drain-attempt-2 finishes0/Rust6m41; executable SHA83e8a3a296bdc8cb6daa79e6b484c92ed60549a4fa15a61529cb7943003af66b. Runtime54964/receipt1792014602828 passes all3 document/reference/binary-example FilePicker callbacks. Each records unchanged native IPC submission, real drain/edit refusal, actual Tauri-Response:ok, then drain callback/completion. No mock, acknowledgment gate or added delay. Complete durable data equals accepted resources/history/settings/selection; original resources/settings/history remain exact. Binary bytes [0,255,13,10,128] and independent hash match. Import-only scope observes0 Worker constructions; it does not verify validation/generation worker loading.

The actual mounted fixture shares one compiled workspace singleton, preserves genuine Rust IPC, binds every emitted IIFE/CSS asset and unmounts through Svelte before restoring transport/shell/storage. Inspector-delivered fixture code adds no inline-script CSP permission; this is not a claim that fixture assets were embedded in production frontend. Native host30484 exits0/native-hidden. Restoration1792014602612 rehashes exact originalf0/d8 buffers and protected inventory, with two actual registered owned collections, no cleanup errors. Root independently confirms no owned host/WebView remains. Full post-native source closure54964 is terminal0; compiler97971 passes0/0, focused controls and full spectral-api-design-native-fetch-adapter-full-regression (15272) pass. Independent read-only audit validates emitted hashes, changed/original buffers, actual IDs and binary data. Physical disk contention, OS file-dialog automation, timeout refusal, OS-close, universal worker/process births and broader platform/provider acceptance remain required.

Native command: set INSOMNIUM_API_IMPORT_NATIVE=1 and exact INSOMNIUM_UI_BUILD_STATE/INSOMNIUM_UI_PROFILE_OWNERSHIP for the fresh fixed CRUD candidate, then run the saved entry under the maintained namespaceBuildEnvironment bootstrap. Normal builder and ownership reconstruction commands remain tests/ui/build-resource-crud-probe.js and tests/ui/helpers/native-profile-ownership.js --reconstruct; use a fresh candidate/marker and retained raw ownership proofs, not a fabricated initial absence.
Official references consulted: [Playwright file input](https://playwright.dev/docs/input#upload-files), [waitForFunction](https://playwright.dev/docs/api/class-page#page-wait-for-function), [Svelte testing](https://svelte.dev/docs/svelte/testing). No new application subsystem, dependency, native command or test entry was introduced.
## Topic records

<a id="record-agent-native-structural-preparation"></a>

<details>
<summary>AGENT-NATIVE-STRUCTURAL-PREPARATION</summary>

# Native structural source/range preparation — 2026-10-13

Test-only native-next preparation against root accepted V2/18cb285; no product/backend/producer/dependency/permissions changes, native build, host or profile launch. Own supporting ResourceManager/namespace generation is older and is not offered. Earlier structural V2 and native external proofs stay immutable. This is not actual native acceptance.

Frozen handoff: artifacts/native-structural-preparation/handoff/manifest.json SHA bbd03bb3316b35d6febf91d09638bc59990afeaba22e1ecc6e93de681cc954ac. Six patch paths and 747 archived outputs; ten exact root review snapshots are rehashed against current root before freezing. Only the five existing saved adapters plus one new pure guard entry are offered. Whole current root 73-assertion oracle and both owned POST sourceSpecId filters remain unchanged; native original48 checkpoint runs before the additive cases.

The existing native entry first proves original48 Rust jobs/7 cancellations/12 external profiles/36 loopback reads, every actual observed producer physically settled and original resources/history unchanged. It then invokes the SAME structural assertion runner with native:true and explicit owned referenceOrigin, adding12 attached/HTTP × dark/light × 1440/900/760 profiles and one ambiguous-origin case (13 jobs/18 reads, total61/54). Trusted Enter checks full raw BOM/CRLF/astral source selection, actual CodeMirror endpoints/marks/focus, foreign readonly and main editable source. Same-task stale click/workspace replacement is explicitly synthetic wiring, not native admission. Unknown truly ambiguous source is disabled. Every final job must again be physically observed/settled; original saved resources/history are checked again.

The native fixture reuses shared structuralFiles/structuralSource and registered saved fixture IDs. Its three structural controls seed the real saved managed binding; attached files remain in memory. The closed structural-http mode reuses warnings rules with no additional repository path writes. HTTP representation is explicitly schema or structural, separate from existing one/two revision. Exactly the original three GET names are accepted, raw bytes and receipts are preserved, and the filesystem allowlist remains45 paths. No authority or fetch expansion. Native never disables IPC/isTauri. Browser-only fallback/parser section remains unchanged behind native:false; it is distinct acceptance. Width760 is CDP CSS viewport, not physical native host width below minimum.

Existing wrappers remain responsible for exact two buffers/store/all654 cookies/original43 resources/20 history/Git directories/layout restoration, fixture ID registration, unknown cookie refusal, contained owned repository archive/individual retirement only after host exit. Sidecar f569/source-receipts limitations remain. No clipboard/Send claim.

Verification: compiler42576 terminal0/0 errors/0 warnings; SAME full headless30925 terminal0 with61 actual normal producer processes/all closed/7 settled cancellations/54 HTTP reads, original oracle plus structural preview and fallback unchanged. New pure guards18 terminal0 verify closed HTTP mode/revision, exact ArrayBuffer raw BOM bytes/receipt hashes, foreign route/method refusal, explicit native loopback rejection and whole73 oracle+ownership filters. Existing refusal guards9 terminal0. Actual native fixture Bun compilation terminal0; no host. Compiler62807 one narrow-key annotation error and84853 two new guard annotation errors are retained. First pure HTTP test used Response.text(), which strips BOM; its negative is retained and corrected to raw ArrayBuffer equality, without altering fixture/producer. No source writes occurred while own handles were live.

Root fresh-generation recipe: baseline-guard only six offered paths against their manifest before bytes; preserve namespace/Resource and all newer production source. Run root compiler/new guards/SAME full headless. Capture current root selected source, exact generated validators/Buffer, ordinary frontend/worker assets and native fixture/openapi worker import closure. Use current documented native build wrapper preserving real producer/notices hook; embed freshly compiled native fixture before Cargo and copy emitted adjacent f569 sidecar and notices. Strict prelaunch must bind current exe/frontend/fixture/worker/sidecar/source bytes and owned identity. Then root exclusively executes the saved native entry with registered preservation wrappers and audits original48 checkpoint, total61/54, all physical settlement/hostexit/restoration/cleanup. Historical a00/d478 is not current native structural acceptance.

Official APIs remain the accepted [YAML nodes/ranges/Alias.resolve](https://eemeli.org/yaml/) and [Scalar public dereference hook](https://github.com/scalar/scalar/blob/main/packages/openapi-parser/README.md), plus existing saved Playwright/native hidden helper contracts. Full current native structural acceptance, consumed-read lease, private/platform/distribution/SDK/Event/FIFO/full migration/UX gates stay open. No live handles or profile claim. /compact is unavailable; this frozen handoff does not claim compaction.


</details>

<a id="record-agent-spectral-api-design"></a>

<details>
<summary>AGENT-SPECTRAL-API-DESIGN</summary>

# Spectral parent UI acceptance — saved actual-producer fixture

2026-10-12. Test-only handoff; no copied production baseline belongs in this topic. Run `bun tests/ui/spectral-api-design.js` from the project root. The saved entry builds the real ApiDesign/CodeEditor components with the existing Bun Svelte fixture plugin and pinned lint ownership adapter, builds the real OpenAPI worker, and runs `launchUiBrowser` headless. The fixture sets `isTauri=true`; its closed invoke allowlist sends reserve/run/cancel/save_workspace only to the owned same-origin Bun server. Workspace saves are detached fixture snapshots, never native application data.

The producer is the actual compiled Windows executable referenced by root `artifacts/spectral-producer/final-v2/manual-receipt.json`, SHA256 `6231e95ddd20cd9122edea33f342bba52feef3c16dd832849118eb714bca6e78`. The server verifies and copies those bytes before use. Fixed owned custom/warnings/fallback/held repositories remain under the scenario output. Each normal executable process uses `windowsHide:true`, one closed input/output frame, bounded output/time, and awaited child close. This is **native=false** and does not establish Rust reservation, process-tree, registered Git, private credentials or native UI acceptance.

Final parent baseline is `ApiDesign.svelte` `85730ff478ba0780a1f098b4f88b900851103f0ce93b23ec3a79c7e372161de6`; client `3b1cfa5fcbe4b1f2bda394943784606c7ab0939caeaa332606991437166dbc5a`; source catalog `c8ece861c3b7371bd1de5b6bb94d23afc3f1ed847bb058c985743f7f28ac1b5f`; CodeEditor `60e7bac747d49ff5fdc894fd0aadc3fbdee0206c9f0f6f1b5bb4478dd50753ba`. The four exact root bytes were captured read-only. Supporting local source is explicitly pinned; this is not a whole-current-root or native-generation claim.

## Verified result

Own compiler **54303** exited 0, zero errors/warnings. Saved final scenario **45503** exited 0. Six dark/light × 1440/900/760 × 600 profiles retain original dropdown/Select geometry oracles and verify actual severity 0/1/2/3, code zero, inline annotation identity/code/message/full range, real keyboard selection/focus, every clipping ancestor, responsive separator orientation, and both distinct same-basename attached sources. Original BOM/CRLF/astral text and resource/history bytes survive readonly reference navigation and Back to OpenAPI. SDK code zero is the actual string `"0"`; numeric zero was separately covered by the previously committed editor fixture, not fabricated here.

Default/custom/fallback are actual host outcomes. Actual error severity zero disables Generate. Warnings permit Generate; a fresh rules change introducing error zero refuses publication, proving generation re-lints. Allowed generation creates two resources and the owned save contains exactly the current resources. Parser structural failure still invokes the actual producer and blocks generation.

Seven entered actual held jobs are cancelled after source edit, attached reference mutation, spec removal, workspace object replacement, active workspace switch, explicit Cancel, and destruction. All physically exit; no cancelled result, stale finding, pending semantic notice, generated resource or history mutation survives. All **20** owned processes exited. Final exact executable-path process audit found zero matches. Browser/server closed, no live handles, no default/CRUD profile claims.

## Preserved failures and root correction

`artifacts/spectral-api-design-proof/negative-missing-isTauri` preserves the fixture shim failure (zero host jobs). `negative-source-cancel` preserves original parent `3b84c0a1...` and strict replay **32159**: a real source edit changed the document while the held host completed naturally without cancel. Root corrected active `workerWork` to reactive state and pending notice/error cleanup; this lane did not edit parent source or weaken cancellation. `negative-mark-pos-shape` preserves a harness shape mismatch: CodeMirror Pos includes `sticky:null`; the oracle compares the same exact logical line/ch coordinates as selection. Earlier pass **27172** is archived in `pass-v1`; final receipt includes the added pending-notice/resource/history guards.

## Exact handoff

Only these five new test files and this report are offered. Root paths were absent before integration.

| Path | SHA256 |
| --- | --- |
| tests/ui/spectral-api-design.js | d4c6d519fd43f56ba8d5c031ae670b15572a092162501a45b9a06e35208499ba |
| tests/ui/helpers/spectral-api-design.js | efa5d75ce7eebf62d3d5ec9ee13663dbb78e82621d594aaee7d565a3e9d29082 |
| tests/ui/helpers/spectral-fixture-host.js | b18ad101c579abb774957ff3b269f0992100789a0e8b954da9934ac220ae3f03 |
| tests/ui/fixtures/spectral-api-design.js | fa882fd18258b4b9d6de44bca563a5424a81fff4a491abdd0d87ac6c13ce4166 |
| tests/ui/fixtures/spectral-api-design.svelte | 8d86775f500eaadb4db3911950e90b3c5ab154efbf31f0c30ee8a7ede74dbf4b |

Final immutable proof: `artifacts/spectral-api-design-proof/final/audit.json`. `delta` maps guarded handoff bytes in `final/handoff/<path>`; `outputHashes` maps `final/run/<name>`. Preflight hashes bind **642** frozen inputs (excluding mutable jobs receipt). Source/harness bytes map `run/input-snapshot/<original relative path>`; emitted assets map `run/bundle`, executable and owned rules map `run/host`. The original mutable jobs receipt's preflight hash is explicitly excluded from frozen-input recheck and separately bound by final output hash. Final acceptance `793aaf4d...`, preflight `fb7d39bb...`, jobs `13ed4271...`; full hashes/byte counts are in audit.json.

The helper signature is `exerciseSpectralApiDesign(page, output, origin)` and currently depends on the explicit saved fixture's `/__state`, `/__case`, snapshot output and lifecycle controls. Native acceptance needs an explicit reviewed adapter providing equivalent actual Rust/job/workspace observations; these stand-in endpoints cannot substitute for it. Parent-root original workspace/layout regressions, full native Spectral integration, repository generation lease, packaged executable and cross-platform gates remain open outside this fixture.

Primary implementation references: [Bun Node compatibility](https://bun.sh/docs/runtime/nodejs-compat), [Bun child process windowsHide](https://bun.sh/reference/node/child_process/SpawnOptionsWithoutStdio/windowsHide). Runtime used Bun 1.4.2; no Node executable was launched.

Root owns topic integration/commit and STATUS update. This interface cannot invoke `/compact`; this frozen handoff is provided instead of claiming compaction.

## Root acceptance checkpoint

Root compiler73350: terminal0, zero errors/warnings. Same saved scenario23389: terminal0, headless six profiles/seven lifecycle cases, twenty actual6231e95d hosts all closed, zero owned live processes. All 677 root preflight inputs independently rehashed; fresh root jobs.json was created after preflight and its final hash is recorded separately in the root audit. Agent replay excluded its existing mutable receipt as documented above. Root parent85730 fixes original reactive cancellation defect. Relative target executable lookup with explicit environment override replaces machine-specific TEMP dependency; strict executable hash and all acceptance assertions retained. Original workspace/layout99049 terminal0; build e2233e terminal0. Proof artifacts/spectral-parent-root-proof-v2/root-audit.json. Browser fixture native:false: actual Rust IPC, fresh native candidate, repository consumed-read receipts and full platform/distribution/migration remain open. No root live handles. /compact unavailable; explicit handoff.


</details>

<a id="record-agent-spectral-external-join"></a>

<details>
<summary>AGENT-SPECTRAL-EXTERNAL-JOIN</summary>

# Captured external references → structural preview/generation

2026-10-12, isolated shared-ui handoff against root e762057. Product changes are restricted to ApiDesign's check pipeline, optional structural source input, the existing worker, and one pure source adapter. No backend/provider/SDK/dependency/style/native profile changes.

## Behavior and authority

Native Validate/Generate first awaits a fresh accepted Spectral job, then posts that same validated captured catalog to the structural worker. Main/attached bytes must exactly match the captured raw saved input; external bytes come only from the returned catalog. The adapter revalidates URI/name/origin/uniqueness through the existing catalog utility, puts main first, parses bounded raw bytes into Scalar's existing filesystem API, and never fetches or persists references. Original source, attachments and example metadata remain unchanged. Browser fallback omits the optional input and keeps original attached-only analysis.

Existing source/workspace/repository/options guards remain. The native await holds workspace work until physical host settlement, including cancellation; structural analysis/generation is not dispatched after a stale or cancelled reply. Original non-check ApiDesign bytes are preserved. Shared editor/layout/tokens remain unchanged.

Capacity: **32 attached files**, not 32 total external files. No new external-count cap is introduced. Each parsed document remains limited to2MiB; captured raw aggregate and existing parsed aggregate remain limited to8MiB. Producer source/result/transport limits, worker15s deadline and native CPU/process quotas remain unchanged. A real catalog with main+40 repository references validates and generates successfully. This is bounded capacity evidence, not unlimited/exhaustive reference parity.

## Evidence

- Strict predecessor scenario4771 failed after all original six profiles/seven cancellations: actual producer returned repository main/three external sources with warnings only, while Generate remained disabled. Immutable negative: `artifacts/spectral-external-join-proof/negative-disconnected-catalog`.
- Initial fixed replay97694 passed UI assertions but exited1 because the source freeze checker correctly detected the deliberate owned fixture `nested/value.yaml` revision change. Preserved in `negative-deliberate-fixture-mutation`; not accepted as a green run. The new saved entry declares exactly one owned mutable fixture path with both known revision hashes. Every other source, ruleset, executable and emitted asset remains byte-frozen. No blanket directory exclusion.
- Final compiler45526: exit0, zero errors/warnings. Final saved scenario7672: exit0, six original profiles/seven lifecycle cancellations plus12 repository/HTTP×dark/light×1440/900/760×600 profiles. Actual producer6231e95d returned complete ranges and distinct same-basename/nested sources; readonly navigation and raw persistence checks pass. Changing external bytes between Validate and Generate changes the generated JSON body to the freshly linted `two😀` value. Exact36 HTTP reads belong to two actual producer jobs per HTTP profile; the worker performs zero extra fetches.
- Main+40 repository references validates and actually generates; captured attachment at the same URI overrides an existing repository file and actually generates `attached😀`. All48 normal owned executable processes physically exited; seven cancelled jobs publish no result. Browser/server closed; exact executable-path process audit finds zero live matches. These fixtures are explicitly **native=false**, not Rust/jobtree/registered-Git acceptance.
- Retained saved schema-resources:83 checks, exit0 (`d33e76`). Retained serialized contract:168 checks/11controls/8signing controls plus8external/68controls, exit0 (`4137cb`). Frontend `bun run --bun build`: exit0 (`1ddb28`),49 emitted files. Manual Bun eval13 guards bind actual41-source host output and verify last-schema resolution, main ordering, raw immutability, mismatch/duplicate/unknown/missing refusal, unresolved-reference/browser fallback,32attached/2MiB/8MiB bounds, with fetch replaced by a throwing guard.

## Frozen handoff and replay

Run `bun tests/ui/spectral-api-design.js` with `INSOMNIUM_SPECTRAL_FIXTURE_EXE` pointing to the exact6231e95d executable, or use root's target-specific default binary path. This lane used root's existing `src-tauri/binaries/spectral-linter-x86_64-pc-windows-msvc.exe`; the scenario verifies its full SHA before copying it to the owned fixture. No new tracked test script beyond the existing saved scenario/fixture/helper edits.

Final audit: `artifacts/spectral-external-join-proof/final/audit.json`, SHA256 `5df64fd25ca49a0d7ee39b97c8aa032b731a5fef3061200bf04f82dce387739a`. Eight guarded path originals/new SHA/byte counts are in `delta`; frozen offered bytes map `final/handoff/<path>`. Exact688 input hashes map `final/run/preflight.json`, source/harness snapshots `final/run/input-snapshot/<original path>`, emitted fixture/worker `final/run/bundle`, actual executable/rules/files/jobs `final/run/host`, frontend hashes `final/frontend/<path>`, retained scenario outputs `final/regressions`, and manual receipt `final/manual-guards.json`. `outputHashes` binds acceptance/process/job receipts. All inputs and proof are frozen; no live handles.

| Offered path | New SHA256 |
| --- | --- |
| src/lib/components/ApiDesign.svelte | 224f996048c2d62c73691818367c374daf168c890b5595efe9db1a6d192daae7 |
| src/lib/openapi.js | cf135bd8add1423491b4c0d85778af3c1bb1792a9a48d467a75dd189da6c86ec |
| src/lib/openapi.worker.js | a688808eeec147657b7274ba8eff310afb4f51c6f4fb52f100734cea1c8f0b39 |
| src/lib/openapi-captured-sources.js (new) | b4ae4aec89b1e1d07b2f76bad3a5b6ee214515ca81f67a6ce8d24bf54123a848 |
| tests/ui/spectral-api-design.js | e90054427851ef53562dd86660d5b2565227999796ddc693c3c5394695873b3d |
| tests/ui/helpers/spectral-api-design.js | 05c63484078a6ca3f9a37adb0fd8d2a66885e2ec337be309371a261bca9de831 |
| tests/ui/helpers/spectral-fixture-host.js | 906079f032c79ad3d699166972b68b4adbb5a85ac0401b65430629ddc58db07b |
| tests/ui/fixtures/spectral-api-design.svelte | 7874ccea2cd22099e9bff8d67a6c7e268f0fd5026f6275a8d1b9e0b59c08002c |

Copied CodeEditor/catalog/client and prior dirty baseline are not offered. Supporting isolated source closure is explicit, not a whole-current-root or current native-generation claim. Prior Spectral/GraphQL/Runner/CRUD proofs remain immutable.

Primary source consulted before implementation: [Scalar official parser README](https://github.com/scalar/scalar/blob/main/packages/openapi-parser/README.md), installed0.29.7 README and `dist/utils/dereference.js`/`make-filesystem.js`. Its filesystem dereference contract supplies the existing local-data resolver; no fetch/read plugins were added.

Remaining gates: current-root independent integration/replay; fresh native candidate and real Rust commands; repository consumed-read/generation lease; full reference/version/platform/distribution parity. Structural diagnostics still use main-document positions and need a separate source-aware/full-range topic. Full migration remains open. Root owns topic commit and STATUS update. `/compact` is unavailable in this interface; this handoff replaces any claim of compaction.

## Root integrated captured-source checkpoint — 2026-10-13

Root independently verifies agent687 immutable inputs plus one exact two-revision owned fixture (688 checked inputs), output hashes/frontend49 and eight offered byte guards. Current native helper9943 callbacks are preserved through the exact efa5-based differential; three added case controls route through optional revision callback, and four spec identity assertions use the actual adapter identity/default original preview identity. Git-applied CRLF whitespace is normalized before adapter plumbing; original partial copy/patch hash guards passed before resume. New producer f5690ce1 strict pin is preserved over old6231 frozen proof. No assertion removed or count weakened.

Root compiler85618 exits0/0errors/0warnings; SAME whole saved headless scenario37161 exits0: six original profiles/seven cancellations,12external profiles,48actual f569 hosts all closed,36HTTP reads, main+40 actual Generate and attached precedence. Schema83 (3150ad), serialization168/11/signing plus external8/68 (f37e78) pass. Root production build7c120d exits0; manual actual-capacity/no-fetch/raw equality/order/missing/duplicate/unknown/unreturned/fallback/2MiB/8MiB/32attachment13 guards pass. Selected source hashes remain unchanged. Full archived root source/assets/results/guard/regression proof: artifacts/spectral-external-root-proof/root-audit.json.

This accepts the current frontend/captured-source structural slice, explicitly native:false. Prior d478/f569 native20 accepted85730 and is historical after this parent/worker change. Native external adapter preparation bf28f056/eightpaths/doc c661cd57 is frozen but requires independent integration and a fresh app/frontend/worker/source/sidecar capture before actual48native jobs/restoration. Repository consumed-read/in-flight changes, full structural diagnostic source/ranges, versions/platform/private/distribution/full original migration and UX remain OPEN. License override handoff efb06999 is separate. All root/agent handles terminal, no native profile claim. /compact unavailable; explicit handoff.


</details>

<a id="record-agent-spectral-held-rule-preparation"></a>

<details>
<summary>AGENT-SPECTRAL-HELD-RULE-PREPARATION</summary>

# Owned held-rule mutation negative preparation — 2026-10-13

TEST-ONLY preparation against current root542e177 native structural checkpoint. No producer/backend/product/SDK/permissions/dependency changes or native app/profile/build launch. Frozen manifest artifacts/spectral-held-rule-preparation/manifest.json SHA6e697eec5829678c26c36fa417a8a99f804b43090ae6920cdf5efdfc20299436 binds6testpaths/4exact root-before baselines/748outputs. Old preparations/negatives remain immutable. Actual stale-rule native negative has NOT been executed.

The existing saved native entry defaults to the identical original61 workflow. Whole entry equality after removing only the opt-in additions/formatting proves all36 original entry assertion calls and exact original body retained; shared73 oracle remains unchanged. Explicit closed environment INSOMNIUM_SPECTRAL_NATIVE_NEGATIVE=held-rule-mutation adds one case ONLY after original61/7cancel/54reads/12structural profiles acceptance and restoration guards. It does not change existing fixture code or producer function's original four-second timer, release an event, inject a result or cancel the job.

Case uses existing held configureCase before RUN, seeds registered saved Repository fixture, records source/binding/workspace/save snapshots, validates through actual Rust and waits for its actual entered marker. Native trace maps server-reserved UUID to current case marker and its retained process observer. New alive() requires the exact retained process object nonsignaled, unique sidecar, captured creation/image/hash identity; marker PID/entered time must match that object/reservation. Trace's private observer map authenticates the same job again immediately before writer replacement. PID or shape alone is not authority. The existing configureCase no-live-observer refusal is unchanged.

Separate repository closure writer derives the same exact KnownFolder/fixed profile/registered managed repository established initially absent and native initialized. It rechecks actual saved binding equality/unique nativeRepositoryId/workspace, ordinary nonlink canonical directory/file chain and previous owned A SHA. The only replacement path is other/.spectral.yaml; B is one fixed warning rule with no pause function. Exact A/B text+SHA, UUID/marker/process identity/time are saved. Prior owned write map and a new fixed spectral-case-N.json update the existing exact post-exit cleanup receipt to B; no arbitrary path or profile adoption, deletion or extra authority is introduced. Same registered repo/Git/layout/buffer/store/cookie restoration wrappers run after the owned host exits, including when the negative assertion fails.

Case waits ordinary completion and retained physical process retirement without cancellation, checks unchanged in-memory source/binding/workspace and saved workspace, captures real returned diagnostics plus actual rendered row count and current B receipt, then asserts stale A publication must be refused. Assertion message REPOSITORY_READ_GATE is expected RED on current backend if the concrete gap is observed. Missing/expired/live-identity timing guards are different failures and must not be reported as stale-publication evidence. The original four-second hold may legitimately finish before slow authorization; do not relax the hold or budgets to manufacture RED. Root can preserve timing refusal and rerun a new proof only after cleanup under exclusive profile ownership.

Preparation verification: compiler66119 exit0/0 errors/0 warnings; SAME full headless88364 exit0,61actual normal producer processes/all closed/7cancel-settled/54HTTPreads (no native negative). New pure guard14 refusals and existing ownership9 refusals pass. Pure fake shape inputs are explicitly NOT live-object proof. Native entry bundle17modules passes with existing runtime playwright-core external. Initial full bundling failed its optional chromium-bidi imports; failure retained, no dependency install or source-check exclusion. Initial compiler8262 had14 new guard callback JSDoc errors, corrected only after all own handles terminal. Full compiler covers all source, whole original entry equality passes. No actual new native function/mutation/publication acceptance inferred from these preparation checks.

Root must baseline-guard six paths only, preserve newer app/Environment/namespace/Resource sources, repeat compiler/guards and existing headless, bind current accepted candidate/exe/frontend/worker/f569sidecar and supplemental harness bytes, and execute the explicit negative exclusively. Keep original61 acceptance separate from the additional62nd job's RED evidence; require full physical host/process and original profile/Git restoration even after failure. Report captures content-coherence A-result/current-B mismatch only; declared dependency read receipts, fallback outcomes, monotonic app-mutation lease/externalABA/arbitrary trusted JS ambient effects and all original migration/private/platform/distribution/SDK/Event/FIFO/UX gates remain open.

Official [WaitForSingleObject](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-waitforsingleobject) documents zero-time state checks/WAIT_TIMEOUT and process-object waits; existing observer holds SYNCHRONIZE handles. No live handles or profile claim. /compact is unavailable; this is the explicit frozen preparation handoff, not compaction or actual negative acceptance.

## Layout safety supplement and historical scope correction

Root found that native542e177 and the prior preparation entry's layout proof checked only insomnium.requestResponseSplit.v1 and insomnium.apiSourcePreviewSplit.v1. Those are obsolete keys; that proof did NOT establish preservation of actual SplitPane localStorage. Earlier evidence/manifest remains immutable and must not be relabeled as full layout restoration. SplitPane reads/writes nocturne:split: plus storageKey; current +page.svelte uses workspace-left/request-response and ApiDesign uses design.

The saved native entry now captures/restores exact original values for nocturne:split:workspace-left, nocturne:split:request-response and nocturne:split:design in addition to both legacy keys, through the same try/finally exact equality check. Whole original entry equality passes after excluding ONLY explicit layout safety and the opt-in negative additions; observer/ownership/original61 and shared73 guards are unchanged. This is future native safety preparation, not proof that a native run restored the three real keys.

New proof artifacts/spectral-held-rule-layout-preparation/manifest.json binds current six-path preparation closure, immutable previous6e697e manifest, exact read-only root-before entry SHA dd737e912e23c17c2b43cdd651c2401f1cd7f8e0ac0954c43c1a0b94948eab95 and separate own-before entry. Compiler16286 terminal0/0; SAMEheadless28524 terminal0 (61closed/7cancel/54reads);14 pure refusals plus exact three key presence guards/whole-entry equality pass. No native build/app/profile, product/backend changes or live handles. Root namespace session remains exclusive; actual layout/held-rule negative acceptance remains OPEN. /compact unavailable; explicit frozen supplement handoff.


</details>

<a id="record-agent-spectral-inline-annotations"></a>

<details>
<summary>AGENT-SPECTRAL-INLINE-ANNOTATIONS</summary>

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


</details>

<a id="record-agent-spectral-jobs"></a>

<details>
<summary>AGENT-SPECTRAL-JOBS</summary>

# Spectral owned job lifecycle bugfix handoff

2026-10-12. Own worktree only; root integration and topic commit remain parent-owned. V6 and every earlier native/UI proof remain immutable. No Spectral Tauri application/profile or packaged producer was launched in this lane.

## Frozen deliverables

The exact ten backend inputs and byte hashes are in `artifacts/spectral-manager-fix-20261012/final-audit.json`; immutable files are under `final-handoff-source/`. This supersedes V6 manager implementation, not its historical verification record. New `src-tauri/src/spectral_jobs.rs` contains the pure manager shared by production and the artifact harness.

Core manager SHA256: `6ea60a708a8c70585f96a5d1bd0cb58a7fd06a6381b51047a7a6d54c4d08c67b`.

Command wrapper SHA256: `a66d0c18b14b505e88082046e9dc8be41f7fcf3a6819b4c85fe4e395e17ed86a`.

Final Windows executor SHA256: `e6bf39484b98e66dbefe018ed4fe4649f61746bb89f4cd7c0fd33bee1a09c8e7`.

App lifecycle wiring SHA256: `c09627b658aa77eba0f4b8dbfe81036a462a54ed2d439e9ba2a6a4bd92b64bdd`.

## Behavior

RESERVE validates scalar identity, byte limits, owner and active capacity, then returns a server UUID promptly without Git/filesystem admission. A dedicated expiry/reaper retires abandoned in-memory payloads after thirty seconds even with no subsequent command. Eight active entries and two owned worker threads are separate bounds; retired refusal metadata is limited to 128 entries/sixty seconds and contains no document body.

RUN accepts the absolute fifteen-second deadline before queue, binding, executable validation, serialization and spawn. Metadata-only admission uses cancellable `try_lock` loops in Git then Storage order. Source remains manager-owned until successful admission and a live/deadline check. Workers are dedicated bounded threads, independent of Wry and Tokio's blocking pool. CANCEL flags the known job immediately and removes any pending body before awaiting a shared asynchronous watch completion; no waiting thread is allocated per cancellation RPC.

Success and cancellation settle under the same registry mutex. A late cancel after successful settlement returns false; a true accepted cancellation cannot coexist with published success. Normal ExitRequested prevents exit and joins timer/workers/processes on one owned coordinator, then preserves the requested exit code. Tauri's forced restart sentinel ignores prevent_exit; forced restart/final Exit retains the explicitly documented synchronous fallback. Hard interruption of filesystem/libgit2/kernel calls is not proven.

Pipe writer/read failures signal the monitor promptly. Windows processes remain suspended until job assignment, limited inherited handles, eight active processes, aggregate 512 MiB and no breakaway. Ambient Bun/Node option injection is filtered. The monitor/pre-termination step captures actual process objects with SYNCHRONIZE/query rights, verifies membership in this exact Job Object, and retains PID plus creation FILETIME identity. Cleanup waits these observed objects after root wait/accounting zero. Observation/retention buffers are sixteen entries; these are bookkeeping bounds, not changes to the eight-process execution allowance. Overflow kills/errors the operation. Missed fleeting births remain an open containment/physical-reap guarantee; no missing-birth permanent wait or accounting-count equality proof is claimed.

## Verification and immutable negatives

All handles listed below are terminal. Saved logs, source snapshots, compiled binaries and hashes are bound by `final-audit.json` (ten source files, twenty-six evidence files).

- Cargo check `94176`: exit 0. Generation-1 manager tests `64677`: exit 0, eleven cases, actual idle expiry 30.25 seconds. Tests cover eight finished jobs followed by a ninth reservation, active/running limits, cancel-before-start, immediate cancellation while a binding mutex remains held, sixty-four cancellation/success races, absolute run budget, bounded tombstones, off-thread shutdown and shared watch completion. Production calls the same tested owner/lock helpers.
- Final Clippy: exit 0 with `--no-deps -- -D warnings`; five existing vendored eventsource warnings remain. Initial manager and observed-object generations were independently checked before later edits.
- Final exact executor `executor-4`, build `80152` and replay `24620`: exit 0, eleven groups. Original strict early/success/tree/deadline/stdout/stderr/memory/fresh/environment/combined quota cases are retained, plus actual closed-stdin producer failure. The root/child/grandchild strict dead-process assertion passes; combined quota retains refusal, one to seven created children and every recorded PID dead. Fifteen-second timeout, output budgets and environment filtering are unchanged. The Win32 closed-stdin producer remains alive before cancellation and yields process failure/reaped root in 119 ms.
- `executor-1/run.log` is the original strict tree negative: accounting zero/root wait returned while a descendant was briefly unsignaled. The artifact observer proves this with exact process handles opened before cancellation and verified in the actual job: observation seven was `[true,false,true]` at executor return, then the child signaled after a further 1 ms. Nine completed observations are preserved. Its later empty-marker parse failure/timeout is separately retained and is not acceptance.
- `executor-io-1` preserves the invalid fixture assumption: Bun `closeSync(0)` did not demonstrate closing Win32 inherited stdin; result was timeout. `executor-io-2` closes `GetStdHandle(STD_INPUT_HANDLE)` with Bun FFI/CloseHandle and asserts success before its entry marker; all six isolated IO/default/budget/environment groups pass. The final fixture is byte-identical to this corrected compiled fixture.
- `executor-2` preserves the eight-ID observation buffer negative: nine groups, including the strict tree, passed before quota failed to write its expected count. `membership-diagnostic-1` proves ERROR_MORE_DATA at the process-list query. Windows documents that failed limit associations temporarily increase accounting/list membership. The final sixteen-entry observation/retention correction passes the unchanged quota oracle. `executor-3` is build-only, never launched.
- Initial failed audit preparation used incorrect non-autogenerated permission paths and wrote only a partial `handoff-source` directory; it is not accepted evidence. Only `final-handoff-source` plus `final-audit.json` constitutes this delivery.

Commands use Cargo and Bun only. The artifact manager package compiles the exact production manager file; the executor package compiles the exact final manager/executor with production numeric limits and owned compiled Bun fixtures. Observer/diagnostic derivatives are explicitly separate artifacts, not production acceptance or packaged-producer acceptance.

## Repository source acceptance remains open

Read-only audit found `GitState(Arc<Mutex<()>>)` with no repository generation. Current binding checks whole saved resource identity/private/registration and managed path before RUN; the mutex is released before producer execution. Neither ID nor HEAD detects changes to `other/.spectral.yaml`, custom functions/imports or referenced working-tree files, including external edits or trusted custom-function effects.

Actual Spectral ruleset bundler 1.8.0 paths were inspected: YAML migration/extends use supplied `fs.promises.readFile`; the Node preset installs only its URL plugin. Rollup default loading reads local function/import files outside that supplied filesystem wrapper. Package imports are externalized and loaded through `createRequire` in `loader/node.js`. Current producer reference catalog captures document-reference contents, not the complete ruleset/import/function closure. A filesystem wrapper alone therefore cannot establish this gate.

Proposed scoped acceptance: collect content read receipts for ruleset/migration/import closure, Rollup-loaded modules and actual repository references, including fallback/missing outcomes; native reacquires cancellable Git->Storage before publication and revalidates whole binding plus each captured content receipt against current managed files. Explicitly distinguish these declared lint inputs from arbitrary trusted custom-function filesystem/network effects, which legacy permits. Do not add a sandbox or pretend ambient effects are deterministic. A whole-tree before/after hash alone misses transient ABA reads and poorly bounds large modules; no token/receipt implementation or full same-source assertion is claimed here.

## Primary references and remaining gates

- [Tokio watch](https://docs.rs/tokio/latest/tokio/sync/watch/index.html): shared async completion without per-RPC wait threads.
- [Rust JoinHandle](https://doc.rust-lang.org/std/thread/struct.JoinHandle.html): physical owned thread joining, not detach-on-drop.
- [Windows process termination](https://learn.microsoft.com/en-us/windows/win32/procthread/terminating-a-process): process-object signaling proves observed process termination.
- [Job accounting](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_accounting_information): failed associations are included and temporarily affect active accounting.
- [Process-ID lists](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_process_id_list): variable-size membership lists.
- [Job completion notifications](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_associate_completion_port): ordinary lifecycle notification delivery is not guaranteed, and PID reuse requires retained objects.
- [TerminateJobObject](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-terminatejobobject): termination request is analogous to individual TerminateProcess calls.

OPEN: actual Tauri command admission/Git locks/window destroy/restart, packaged producer integration, native total deadline under blocked filesystem/kernel calls, unobserved fleeting process births, repository input receipt/revalidation, Unix containment/platform parity. Original Event held synchronous Promise IPC/FIFO gates remain RED, unrelated to this lane. No full migration, Event, provider, private/platform or native Spectral acceptance claim.

No live process handles and no profile claim. Parent should review/integrate ten exact backend files by topic and update STATUS before continuing. This interface cannot invoke `/compact`; this document supplies the handoff instead.

## Root guarded integration

Root independently rehashes10exactbackend snapshots and26evidence files, reviews four existing native-file deltas (only three closed commands/state/lifecycle and WindowsAPI features), and integrates the frozen generation. Actual root Cargo test26316 exit0,11manager tests pass in30.31s, including realidleexpiry/cancel/settlement/bounds/shutdown. Existing57autogenerated permission files and Cargo.lock remain byte-exact; only3newgenerated commands added. Root audit artifacts/spectral-native-root-proof/root-audit.json. Agent exactexecutor11/Clippy acceptance stays bounded artifact scope; no root nativeapp/packagedproducer launch. Unobservedbirths/hardFS/restart/repositoryreceipts/platform/currentnative remain OPEN. Root handles terminal, UI/receipt agents continue separate work; /compact unavailable explicit handoff.


</details>

<a id="record-agent-spectral-managed-read-fix"></a>

<details>
<summary>AGENT-SPECTRAL-MANAGED-READ-FIX</summary>

# Managed repository read freshness correction

2026-10-13. Isolated implementation; no native app, profile, Tauri release build or root source writes. Root owns fresh compiled native acceptance. Historical actual62 RED and all previous proofs remain unchanged.

## Result and contract

The producer records exact bytes consumed through public ruleset IO and Rollup loader hooks, plus managed repository reference reads and missing direct fallback dependencies. The native internal stdin/stdout protocol is version2. Outer ASCII metadata carries UTF16LE/base64 managed-relative paths, consumed canonical targets, role, outcome, byte count and SHA256. The public command result remains exactly `{jobId,resultJson}`; Rust never parses or rewrites diagnostic JSON. Version1 producer requests retain their original public result and omit instrumentation.

After physical process retirement, native success reacquires existing Git→Storage locks, rechecks the full saved binding/root, then verifies receipts against current managed content before settling success under those locks. Different bytes, missing files becoming present, target changes, conflicting consumed snapshots and nonregular files refuse publication as `binding`. Hashing checks the existing cancellation/deadline token in fixed64KiB chunks. No new file path authority, concurrency/deadline/output budget or dependency was added. Both pre-open path metadata and post-open handle metadata must identify a regular file.

Producer source identity now includes `tools/spectral-linter/read-receipts.js`, preventing bundle reuse after changing only the receipt implementation. This delta is based on exact current-root `scripts/spectral-artifact.mjs`; concurrent notices work must reconcile this explicit additional input without replacing the root notice authority.

The SAME held-rule scenario keeps its actual entered UUID/process ownership, A/B writer guard, four-second timer, unchanged inputs/binding/workspace and physical retirement assertions. Future green requires actual Rust `binding` refusal, zero stale finding rows and no accepted cancellation; protocol/process errors do not pass. A client cleanup cancel returning false after already-failed settlement is recorded separately.

## Evidence

`artifacts/spectral-managed-read-fix/final/manifest.json` SHA `b52d81be86c23e8e97d18e74c6db71a2d805f8d89a41befcaacebf75b480b22c` binds eight source deltas, exact root-before baselines,776 output files, all60 generated permission TOMLs and verification package bytes. Permission TOMLs are whole normalized-text AND parsed-TOML equal to root, with raw before/after hashes; they are not topic changes. Package/lock whole normalized text is identical; raw CRLF differences are recorded.

- Compiler33122 exit0,0 errors/0 warnings.
- Cargo70001 six receipt/protocol unit tests passed; full library88551 exit0,17 tests passed, including the original eleven manager/cancellation/30-second idle-expiry tests. Existing five vendor warnings retained. Windows nonregular directory replacement is tested. Unix FIFO test is included but not executed on Windows.
- Actual compiled producer V3 SHA `f50d6d889949c8f8d2cc0891db1a3a890b7adc50308fe7b92f7a6c4da76978d1`: version1/version2 result equality, custom function/static import/raw reference hashes, missing fallback receipt and successful nested YAML extends receipt. Nested extends selects custom without fallback. Proof `producer-1791838997813/acceptance.json` and raw frames.
- Approved verification-only original saved headless scenario65914 exit0:61 jobs all exited,7 cancellations,54 owned HTTP reads, unchanged original oracle. Its copied host uses one exact V3 executable pin; the original f569 helper is unchanged. `replay-preflight.json`/`replay-source` bind producer build sources, compiled dist/binary and test supplement. This is version1 producer/UI compatibility, not Rust/native receipt acceptance.
- Retained SAME six-group packaging audit passes with every original assertion retained and two added stale receipt implementation/bundle refusal checks. ELF controls are mocked, not Linux installation acceptance. Root retained source and transformed guard/provenance are saved.

Initial direct compile bypassed the documented jsonc-parser ESM bundling plugin and produced a real startup failure (`Cannot find ./impl/format`); old executable and reproduced raw error remain preserved. The corrected route is `bun tools/spectral-linter/build.mjs`, followed by Bun compilation of `tools/spectral-linter/dist/host.js`. Initial Cargo failures lacked generated sidecar/notices and did not reach crate verification. A mistaken `spectral_receipts` filter ran zero tests and is not counted. Subsequent correct `spectral::` and full-library runs are the evidence above. Packaging fixture path/dependency-layout and pinned-license byte failures were retained; current audit uses fresh short owned fixture paths and regenerated own verification notices. Borrowed/root and regenerated notices/icons are verification-only build inputs, not new sidecar distribution acceptance.

## Limits and remaining gates

Fresh root app/backend/sidecar/notices closure and actual native original61 plus62nd held-rule refusal remain OPEN. Root actual negative is `artifacts/held-rule-root-proof/native-negative-v1/root-audit.json`: authenticated A→B during held job, old finding published, no cancellation, all62 physically settled and full restoration. No historical result is relabeled green.

Static local loader reads and supplied IO/reference reads are covered. External packages/builtins, remote contents, dynamic/ambient trusted custom JS effects and unresolved filesystem resolution are classified conservatively; existing trusted JS semantics remain supported. No forced package bundling, private require patches or sandbox. No universal external ABA/watcher guarantee: A→B→A between consumed/current checks remains undetected. Filesystem TOCTOU, uninterruptible OS syscalls and unsupported platform execution remain explicit open gates. HTTP source catalog bytes remain captured snapshots; this correction does not refetch them or assert remote freshness.

Primary API references: [Rollup public load/resolve hooks](https://rollupjs.org/plugin-development/), [Bun runtime plugins](https://bun.sh/docs/runtime/plugins), [Rust File metadata](https://doc.rust-lang.org/std/fs/struct.File.html#method.metadata), [Rust filesystem metadata](https://doc.rust-lang.org/std/fs/fn.metadata.html). Pinned bundler implementation was inspected: Node preset has URL plugin, local default loader consumes UTF8 filesystem bytes, runtime bare packages remain external. The implementation does not assume supplied YAML IO covers all custom imports.

All owned handles terminal; no native/profile claim. Topic commit follows exact-path staging only. `/compact` is unavailable in this interface; this report and STATUS provide the handoff instead.


</details>

<a id="record-agent-spectral-native-cleanup"></a>

<details>
<summary>AGENT-SPECTRAL-NATIVE-CLEANUP</summary>

# Native Spectral repository cleanup supplement

2026-10-12. Explicit test-only successor to initial seven-path preparation audit `089957ea...`; that original audit/source/doc remains immutable. Six original paths and all ten delivered backend files are unchanged. Only the host-side native entry is revised; the native fixture JS/Svelte/product/frontend bytes are unaffected.

Frozen supplement: `artifacts/spectral-native-adapter-preparation/cleanup-supplement/manifest.json`, with three exact source snapshots: new `tests/ui/helpers/spectral-native-cleanup.js`, revised `tests/ui/spectral-api-design-native.js`, and saved refusal guards `tests/ui/spectral-native-preparation-guards.js`.

The entry binds cleanup immediately after the existing real registered fresh native Git initialization and before rule/UI edits. The binder rechecks the original repository-absent proof, exact KnownFolder/fixed profile/ID-derived managed repository and ordinary canonical parents. It captures the complete native-created `.git` hashes and directory inventory plus the empty already-owned rule directories. The ownership marker is new and cannot overwrite/adopt another marker.

Cleanup runs in the outer entry's finally block only after `withNativeApp` finishes its real host exit/result handling; the reviewed resource wrapper subsequently restores exact original workspace buffers/store/cookies. Cleanup requires the exact scenario/native-hidden/PID/exit0 result and no intentional parent termination. A live or recycled PID refuses; an inability to open a PID is accepted only for Windows ERROR_INVALID_PARAMETER, not access denial.

It verifies current repository identity, original absence proof hash, unchanged baseline Git files/directories, and only the two allowlisted current rule files against the saved case-writer hash registry. Unknown additions, changed files, directories, links, aliases or missing files refuse before deletion. The fresh init/rules inventory is bounded to 256 files, 128 directories and 8 MiB, with size checks before allocation; these are test archive bounds, not changes to native input/process budgets.

After exact native host exit, every current file and directory is archived under the owned native scenario output with SHA verification. A new before-cleanup proof records ownership, actual host result, full final inventory and archive path. The complete live inventory is rechecked unchanged. Files are then individually rechecked and unlinked; only verified empty directories are removed deepest first with `rmdir`. No recursive deletion is used. The parent `git-v1` directory/profile and all unknown/preexisting repositories are preserved. The final cleanup record proves the exact initially absent owned repository is gone and the archive remains. There is no general native forget command; unrelated fetch/push staging cleanup commands are not reused.

Preparation verification is complete, actual deletion/native execution is not: compiler61711 and final10070 are terminal exit0, zero errors/warnings; revised entry Bun compile succeeds. Saved nine refusal guards pass with no native/profile writes: one allowed ID, six invalid IDs, foreign marker refusal and an intentionally forged exit0 record targeting the still-live owned Bun process refused before any profile lookup/deletion. The forged record is explicitly unit-negative evidence outside native scenario output, not a native-hidden acceptance record.

Root's acknowledged fresh d478 candidate remains parent-owned; this lane did not build or launch it. Before root launch, bind the revised entry/cleanup helper as an explicit harness supplement against the old entry snapshot, run root checks/guards and retain the exact candidate's current sources/assets/sidecar/notices closure. Passive trace/process observation, actual repository archive/removal, original exact resource/cookie restoration and the twenty-job native component oracle remain unexecuted acceptance gates until that run.

No product/permission/provider/SDK or physical viewport-width claim. No clipboard/Send/profile claim or live process handles. Initial original54 UI oracle assertions remain unchanged. Parent owns STATUS/topic commits; `/compact` is unavailable here, and this report supplies the handoff.

## Root Windows native component acceptance — 2026-10-13

Fresh locked explicit-target native build77253 terminal0 binds d4787e22 app/806 selected source inputs/52 frontend assets. Original JS/CSS output naming collision remains preserved. First actual native run failed virtual-host API HTTP fetch before Spectral; zero-case cleanup initially refused. Saved harness now fetches assets in the real WebView with unchanged status/SHA gates, restores layout in nested finally, and permits zero-case cleanup only on exact unchanged registered init inventory. That original fixture was archived/retired after exact host exit; both negative proofs remain immutable.

Second actual run passed six diagnostic profiles/default/fallback/fresh Generate/parser, then held ruleset fell back. Identical compiled6231 host ordinary-path/Windows namespace-path probes prove the resolver difference; public Rust canonicalize docs confirm extended Windows path syntax. Producer now passes resolve(repositoryRoot,other,.spectral.yaml) from its already fs.realpath-validated root to the unchanged stock bundler. Original absolute/exact frame binding checks remain. New standalone sidecar f5690ce1/93486080bytes passes both ordinary/namespaced actual entered-function probes; original6231/d478 negative remains unchanged.

New external-component composition explicitly keeps the exact d478 native executable/backend/frontend and replaces only the independently compiled sidecar plus declared saved-harness/source snapshots. No old artifact acceptance is relabeled. Saved native41874 terminal0: six theme/width profiles,20 real Rust jobs and7 entered-before-cancel functions; exact retained process objects already signaled at settlement, no cancelled results. Host hidden before CDP/native-hidden; width760 is CSS emulation, not physical host width. Actual app exits0; original43 resources/20history, both raw workspace buffers,654 original cookies/immutable bytes and managed Git directory set restored. Registered fresh repo7 files/12 dirs archived then individually retired; parents/unknown repositories preserved.

Compiler87227 terminal0/0errors/0warnings; SAME headless scenario92142 terminal0 with new sidecar20 hosts/7cancellations. Root independently rehashes selected sources/assets/harness/outputs and current restoration bytes: artifacts/spectral-native-root-sidecar-fix/root-audit.json. Initial54 UI assertions/native callbacks retained; nine refusal guards pass. All root handles terminal/profile claim released. Full production-shell Spectral, external structural join/native acceptance, consumed repository/ruleset reads, fleeting unobserved births/hardFS/restart/platform/install/sign/update/private/full original parity and UX remain open. /compact unavailable; explicit handoff.

Primary references: https://doc.rust-lang.org/std/fs/fn.canonicalize.html and https://v2.tauri.app/develop/sidecar/.


</details>

<a id="record-agent-spectral-native-prep"></a>

<details>
<summary>AGENT-SPECTRAL-NATIVE-PREP</summary>

# Saved native Spectral adapter preparation

2026-10-12. Preparation only: no native build/application/profile or Spectral producer was launched. Root owns fresh candidate construction, integration, profile assignment and actual native acceptance. Old588/bb75 and all previous proofs remain immutable.

## Frozen seven-path delivery

`artifacts/spectral-native-adapter-preparation/audit.json` binds seven source snapshots under `final-source/`:

- `tests/ui/helpers/spectral-api-design.js`: exact root efa5d75 oracle with optional `state`, `setCase`, `configureCase`, `snapshot`, `native` callbacks. Default HTTP/DOM behavior remains. The entire assertion/oracle body reverses byte-exact to the original after undoing three allowed plumbing substitutions; all 54 assertion calls remain.
- `tests/ui/helpers/spectral-native-fixture.js`: additive real saved/loaded workspaces, spec, Git binding; complete created-ID registry and actual two-collection registration before Git/UI operations. Original resource rows/history are checked unchanged. Existing real `git_repository_init` creates only a fresh unique registered repository. Actual Tauri AppData directory must equal Windows KnownFolder plus the fixed probe identity. Every ancestor, repository and `.git` must be canonical ordinary directories; no adoption of preexisting paths. Only `other/.spectral.yaml` and `other/functions/pause.js` are written, with prior hash/regular-file checks. The trusted held function writes its PID/entry marker to a unique owned artifact path via atomic `.pending` publication, then holds four seconds; no generic filesystem IPC or new production permission.
- `tests/ui/helpers/spectral-native-process.js`: saved read-only Windows Toolhelp observer, exact owned app parent PID, fixed adjacent sidecar path/SHA and process creation time, retained SYNCHRONIZE/query object handles. Settlement requires an already-signaled object and real exit code; a missed process observation fails. Process observation is explicitly not proof of custom-function entry.
- `tests/ui/helpers/spectral-native-trace.js`: saved passive custom-protocol fetch trace forwarding real Rust requests/responses, no stand-in invoke/shim/result/producer spawning. Real reserved UUID/input and opaque Rust `resultJson` are recorded in JavaScript; cancellation/physical producer object settlement are actual facts. Held marker PID must match the observed native process. Original user resource values are omitted from final trace evidence, while in-memory lastSave supports the unchanged oracle.
- `tests/ui/spectral-api-design-native.js`: requires fresh root audited source/frontend/fixture/exe/sidecar closure, actual embedded Spectral commands, exact adjacent producer hash and actual served native fixture JS/CSS bytes. Runs the same six theme/viewport profiles, default/custom/fallback/parser/fresh Generate and seven lifecycle cancellations against real native IPC. Uses the reviewed preservation wrapper for exact two buffers/store/cookies, and records/restores layout keys.
- `tests/ui/fixtures/spectral-api-design-native.js` and `.svelte`: actual compiled ApiDesign component with real native IPC, additive saved seed and same fixture controls. Never installs the preview `__TAURI_INTERNALS__` shim. This is native component/command acceptance preparation, not full production shell acceptance. A 760 CSS viewport is CDP-emulated and does not prove physical native host width below its minimum.

Root producer remains exact `6231e95d...` at the acknowledged checkpoint; the future candidate must bind actual current producer/frontend/native bytes. No old native executable or old fixture blob is eligible. Native fixture served filenames are closed to `spectral-api-design-native.js` and `spectral-api-design-native.css`. The fresh build must preserve current producer/notices hooks, embed the freshly compiled fixture/structural worker, and copy the validated adjacent sidecar/notices rather than reuse old exe-only builders.

## Checks and remaining launch gates

Compiler65677 exit0/0warnings covered initial fixture/process preparation. Later compiler negatives80151/27925 are preserved (JSDoc inference and Bun fetch typing); corrected12235 exit0/0warnings. Final21957 is terminal exit0, zero errors/warnings. Native entry Bun compile succeeds with external packages. The first unexternalized compile failed on Playwright's optional chromium-bidi imports and is not accepted verification; no dependency change was made. Audit proves seven snapshots, all54 assertions/body reversal and ten delivered backend files unchanged. No live process handles.

The full native entry and callbacks have not run. Root must review/integrate the seven paths, construct/freeze the fresh candidate, audit complete fixture import/worker/source/sidecar/asset closure and assign exclusive default profile before launch. Passive transport parsing and OS process observation still require actual native verification; no synthetic producer telemetry is permitted if observations fail. Headless oracle default behavior was accepted by root before extraction, but this preparation does not claim an additional headless/native replay.

Direct actual native main-owner/private unsaved memory, admission/running limits, stale binding, idle expiry, total deadline and actual window-destroy boundaries need separate saved acceptance beyond the twenty-job component oracle. Foreign-window owner rejection is not proven by changing JavaScript metadata; it requires a real authorized Wry window or remains open. View unmount in the component oracle is not actual native host destruction. No scope reduction or full private/platform/Spectral claim follows.

## Repository cleanup handoff

Read-only backend inspection found no general `git_repository_forget` deleting a managed repository; fetch/push staging cleanup commands are unrelated and must not be repurposed. The existing resource preservation wrapper restores workspace/cookies but does not remove the new `git-v1/repo-<ownedID>` directory. Therefore native launch remains gated on a separate saved cleanup wrapper after exact owned native host exit. The initial absence/registration/native AppData/canonical repository proof is already saved. Root authorized preserving an exact final repository tree/hash archive and then removing only that verified contained newly created repository path. Never adopt/remove unknown or preexisting state; no blind computed recursive deletion. This supplemental cleanup is not yet implemented in these seven frozen files and must be bound separately before execution.

No native profile is claimed. No clipboard/network Send/provider/SDK/product change. Full repository declared-read receipts, unobserved fleeting process births, hard syscall deadline, restart/platform, Event/FIFO/held-sync and full migration gates remain open. Parent owns STATUS/topic commits. `/compact` is unavailable here; this report supplies the handoff.

Primary OS interfaces consulted: [Process32FirstW](https://learn.microsoft.com/en-us/windows/win32/api/tlhelp32/nf-tlhelp32-process32firstw), [PROCESSENTRY32W](https://learn.microsoft.com/en-us/windows/win32/api/tlhelp32/ns-tlhelp32-processentry32w), [QueryFullProcessImageNameW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-queryfullprocessimagenamew), plus existing process-object signaling references in `API-DESIGN.md#record-agent-spectral-jobs`.

## Root Windows native component acceptance — 2026-10-13

</details>

<a id="record-agent-spectral-packaging"></a>

<details>
<summary>AGENT-SPECTRAL-PACKAGING</summary>

# Spectral producer packaging — guarded handoff

2026-10-12. Isolated packaging implementation against root producer9326928. No root writes, native application/profile/browser/dev server launch, build.rs/Cargo/capability overlap or SDK/provider changes. Root owns integration/commit/STATUS. /compact unavailable; this document is the handoff. All own process handles terminal.

## Change and ownership

Nine code paths only: src-tauri/tauri.conf.json (build hooks and externalBin ONLY); new scripts/tauri-spectral-hook.mjs, spectral-artifact.mjs, linux-elf-inputs.mjs, linux-elf-closure.mjs; existing build-desktop.mjs and three generate-{deb,rpm,appimage}-config.mjs. This report is the tenth guarded path. Original UI/security/CSP/permissions and desktopwrapper CLI parsing/config merging remain unchanged.

Captured root/own-before bytes in artifacts/spectral-packaging-baseline/manifest.json. Root producer script and five tool package files are byte-identical read-only prerequisites, never integration deltas. Frozen-lockfile ignored-script installation uses independent own tools/spectral-linter/node_modules; no shared/root dependencies were modified. The unadopted stock-readiness source and prior immutable proofs remain separate and unchanged. Frontend compilation here does not adopt that unrelated worktree candidate or claim current-root native/UI acceptance.

## Build/dev/bundle behavior

Tauri externalBin points to the UNSUFFIXED logical binaries/spectral-linter; existing producer emits spectral-linter-<Rust-triple>[.exe]. The new Bun hook rejects absent/unknown TAURI_ENV_TARGET_TRIPLE, passes the exact supported triple as argv to the unchanged producer, and awaits successful producer completion before frontend build OR dev server startup. No shell interpolation or generic command permission. Child signal forwarding retains CLI shutdown behavior.

After successful production, a separate .packaging.json records current producer source identities and binary hash. Bundle-only hook launches NO producer/frontend command: it validates target/Bun target/version/size/binary SHA, lock SHA and six producer input hashes against the original producer manifest/stamp. Missing, changed-source, changed-binary, wrong target and stale artifacts fail before bundling. This covers standalone tauri bundle via beforeBundleCommand. It validates unsigned BUILD inputs; signed/installed binary integrity remains a separate policy/gate, not claimed by the producer hash.

Supported producer triples and existing Bun targets:

| Rust triple | Bun target |
| --- | --- |
| x86_64-pc-windows-msvc | bun-windows-x64 |
| x86_64-unknown-linux-gnu | bun-linux-x64-baseline |
| aarch64-unknown-linux-gnu | bun-linux-arm64 |
| x86_64-apple-darwin | bun-darwin-x64 |
| aarch64-apple-darwin | bun-darwin-arm64 |

Windows ARM64, musl and macOS universal remain explicit unsupported producer/platform gates; no host fallback manufactures them. Installed sidecar is spectral-linter.exe on Windows and spectral-linter on Unix. Native backend owner confirmed current_exe.parent()/spectral-linter.exe agrees; backend resource/name/protocol integration remains independently reviewed. No shell plugin was added.

## Linux dependency closure

Original build--no-bundle → exact reported app path → dependency overlays → bundle flow and custom config/dependency merging remain. Wrapper passes main ELF AND the validated sidecar to all three scanners. Default sidecar triple derives from the completed ELF ABI, not the build host; explicit --target/-t continues to take precedence. Wrong ABI/output collision refuses.

All three generators inspect the transitive DT_NEEDED closure with binutils readelf and ldconfig, matching every dependency's ELF class/endianness/machine and resolving RPATH/RUNPATH ORIGIN paths/cache. Missing dependencies refuse. Readelf inspects files without executing the candidate ELF. Each generator emits an adjacent .dependencies.json audit. DEB stages each ELF for combined dpkg-shlibdeps requirements; RPM passes all ELF inputs to rpmdeps. AppImage retains original architecture-matched dlopen GLES and notice handling. Tauri stages external binaries in AppDir before linuxdeploy's dependency pass; no bulk glibc copying or removed license checks. Actual Linux package installation/closure execution and oldest-supported-host ABI acceptance are NOT verified on this Windows machine.

## Actual evidence

- Two real Windows build-hook executions pass0; final producer93486080bytes SHA95d012bc074cb956d76d79799e601afb59f457182a8814b83588b99e97185789, Bun1.4.2, unchanged lock2b647d41. Worktree-path-specific artifact is distinct from root6231e95d; no byte-identity claim. Final log records producer-ready at line8, frontend command line9, completed frontend line108. No executable/native app was run.
- Final compiler24869 exit0:0 errors/0 warnings. Final hook48605 exit0; earlier42612/72217 terminal. Source frozen during own checks/builds. Standalone hook validation exit0/no child; actual unsupported universal CLI exit1 preserved. Actual desktopwrapper --help delegates to Tauri without native app launch.
- Six saved artifact audit groups pass: build/dev/bundle order; producer failure prevents dev; missing/stale/binary checks; original CLI/Cargo/merge controls; real header ABI/output collision; mocked readelf/cache main+sidecar+shared transitive closure and missing library. These mocks are not actual Linux package evidence. A repeated audit initially saw a previous fixture stamp; each run now uses a fresh owned directory, preserving that tooling negative and all assertions.
- Root prerequisite hashes rechecked; config comparison permits only the four build/externalBin field changes. No broad permissions/CSP or protected runtime deltas. Proof manifest records exact before/current hashes, commands/results/generated artifact and remaining gates.

Commands (Bun only): set TAURI_ENV_TARGET_TRIPLE=x86_64-pc-windows-msvc for `bun scripts/tauri-spectral-hook.mjs build`; `bun scripts/tauri-spectral-hook.mjs bundle`; `bun scripts/build-desktop.mjs --help`; `bun run check`; `bun artifacts/spectral-packaging-baseline/audit.mjs`. No Node/npm/Python launch. Linux production scanners require binutils, ldconfig and the applicable dpkg-dev/rpm tools.

## Official references and remaining gates

[Tauri sidecar naming](https://v2.tauri.app/develop/sidecar/) and [target-aware build hooks](https://v2.tauri.app/reference/config/#beforebuildcommand); [standalone bundle hook implementation](https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-cli/src/bundle.rs); [Bun executable cross targets](https://bun.sh/docs/bundler/executables); [binutils readelf](https://sourceware.org/binutils/docs/binutils/readelf.html); [Tauri AppImage staging](https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-bundler/src/bundle/linux/appimage/linuxdeploy.rs) and [linuxdeploy existing-AppDir dependencies](https://docs.appimage.org/packaging-guide/from-source/linuxdeploy-user-guide.html).

Root must guard/review/integrate before native source capture. Actual current backend/client/Spectral process behavior, target-specific installed sidecar launch, Linux DEB/RPM/AppImage, macOS signed/notarized bundles, Windows installer/signing, final signed provenance, notices/licenses, updater/distribution/full-platform/fullmigration acceptance remain OPEN. No native/Spectral/fullmigration completion claim.

## Root current packaging checkpoint

Root independently rehashes82frozen files/prerequisites and guards10deltas/config-only fourallowedfields. SAME sixgroup artifact audit passes after importpaths are rebound from savedbody location to root eval cwd; assertions unchanged. Actual root targethook16806 exit0: producer before frontend, source unchanged and standalone targetartifact validation pass; compiler18732 exit0errors/0warnings. Generated root93486080byte executable remains EXACT6231e95d exercised17producer cases (own95d artifact not substituted). Root primary CLI Rust env/dev/build/bundle sources additionally confirm targetenvironment forwarding and beforeBundleCommand invocation. Proof artifacts/spectral-packaging-root-proof/root-audit.json. No native app/profile/bundle/install/sign/update/actual Linux proof. Notices inventory is separate: lock186keys/185identities, Windows184pinned identities, fseventsabsent, unpinnedtypeextrasexcluded;4licensefile gaps and completeBunruntime notices remain OPEN. Root handles terminal; UI/receipt agents continue. /compact unavailable; explicit handoff.


</details>

<a id="record-agent-spectral-sources"></a>

<details>
<summary>AGENT-SPECTRAL-SOURCES</summary>

# Accepted Spectral source catalog utility — 2026-10-12

Only NEW `src/lib/spectral-sources.js` and this report are deliverables. No ApiDesign/CodeEditor/native/runtime/dependency/test-script changes, browser/native/profile launch or URI fetch/file open. Parent owns accepted job/source/workspace/repository lifecycle and Generate policy. Root CodeEditor topic2f2746a and opaque client17ca33a remain separate.

## API

`createSpectralSourceCatalog(captured, hostSources, rawDiagnostics = [])` takes captured `{fileName,contents,files:[{name,contents}]}`, not the whole api_spec resource. Returns `{mainUri,sources,diagnostics,unresolvedDiagnostics,lookup(uri),diagnosticsFor(uri)}`.

- Canonical URI identity follows host memory/file/http/https policy, strips fragments and honors declared OpenAPI3.2 `$self`. Attachments resolve against the declared main URI and may themselves declare3.2 `$self`; older versions ignore that field. Existing yaml dependency and apiDocumentBaseUri are reused. Partial malformed YAML can retain top-level identity fields, matching measured pinned SDK behavior; identity conversion failures refuse rather than guessing.
- Main/attached host metadata must contain exactly uri/name/origin, and agree with identities and original names derived ONLY from captured input. Contents hydrate from that captured input. Every captured entry must appear once; duplicate declared identities, duplicate/noncanonical catalog URIs, missing/wrong metadata and injected main/attached contents refuse.
- Returned external entries contain uri/name/origin/contents only. Remote permits http/https, repository permits memory/file; name equals canonical URI. Contents come only from the returned catalog. No click-triggered fetch/disk resolution or fallback to private filesystem.
- Catalog and complete raw diagnostics are detached clones with frozen nested objects/arrays. Numeric severity0–3, optional code including0, full ranges, paths and extra raw metadata are retained. Invalid known diagnostic fields refuse. Lookup resolves URI references against accepted main URI and strips fragments; missing/unsupported/unknown source returns null or empty findings. Missing diagnostic.source is unresolved, never implicitly main. Unresolved diagnostics remain in the complete diagnostics array, so the parent can still display/count/error-gate them.

`spectralRangeOffsets(rawSource, range)` returns frozen `{start,end}` UTF16 offsets for default CodeMirror canonical LF text. It splits CRLF/loneCR/LF as pinned CM does, retaining BOM and astral UTF16 characters. Ordered nonnegative integer coordinates clamp to actual line/character bounds; malformed/raw-reversed or reversed-after-clamp ranges throw. No source mutation. Parent can pass offsets to current public setSelectionRange; it must retain source identity checks and handle refused navigation visibly.

`canonicalSpectralUri(name, base = 'memory:///')` is also exported for deterministic identity only. It performs no IO. Canonicalization mirrors the host's URL href keys; it does not invent percent-decoding/filesystem alias equivalence or repository permissions.

## Verification

Final manual Bun `--eval` receipt e48c40 exit0 has31checks:

- Eight URI identity cases compared with ACTUAL pinned Spectral Document/Yaml:3.1 ignore$self;3.2 relative fragment;HTTP/default-port/case canonicalization;file URI;HTTP retrieval+relative$self;partial malformed YAML;scalar input;merged YAML alias. Each also hydrates an attached source under the resulting base.
- Complete raw severity/code0/path/range/documentation data, same-named files in distinct directories, missing/unsupported source nonnavigation, returned remote/repository contents, caller-mutation isolation and nested freezing.
- Exact canonical UTF16 offsets/selected text with BOM/astral/CRLF/loneCR, empty document and oversized positions; five malformed/reversed cases.
- Eleven malformed/duplicate/mismatched catalog controls; duplicate captured declared identity; malformed diagnostic severity/code; an armed fetch refusal while external accepted contents are used. No network/native/UI operation.

`artifacts/spectral-sources-proof/final/manual-receipt.txt` is an ignored artifact containing the exact manual eval command body, not a new tracked test script. Replay with `bun --eval (Get-Content -Raw -LiteralPath artifacts/spectral-sources-proof/final/manual-receipt.txt)` from the isolated worktree; SDK imports point read-only to the root's pinned tools package. The fixture sources are owned synthetic data. Parent should rebind a copied command's SDK path if replaying from its different directory. No Node/npm/Python execution.

Initial29receipt815147/source3853de7a is preserved under v1. Compiler71559/6826e7 then reported two implicit-any helper parameters only; JSDoc annotations changed without behavior change. Final31receipt includes two additional diagnostic refusals. Final compiler51704/883aee passes0errors/0warnings. No build needed for this pure unused utility; application integration/build/native acceptance remain separate. All own handles terminal; no sources changed while checks ran.

Independent audit91a381 verifies current source/frozen copy/receipt and freezes dependencies. Imported openapi-document.js SHA96ce5790414a622eaede16c6d6623fec867b16a628ead6fdc007657402cde9d4 is byte-identical to current root. Dependencies snapshot records existing yaml/CodeMirror package identities, pinned SDK Document/Yaml parser and current host sourceDocument/catalog policy. These references are evidence only, no SDK import or new dependency in the utility.

## Exact guarded handoff

- NEW `src/lib/spectral-sources.js`:c8ece861c3b7371bd1de5b6bb94d23afc3f1ed847bb058c985743f7f28ac1b5f; root path was absent before integration.
- NEW this report: final SHA supplied in handoff.
- `final/receipt.json`:67cd7830edb5483763a22a4d6da03a9d19cfe01cb226795b044f79de7c013f4b.
- `final/manual-receipt.txt`:c8e90213638c6589213181839fc15fd12548483c44dea9b7ccb7ad7adb1574fd.
- `final/audit.json`:b0169e016bbec84028e5b7f93c0efb3e0667bcfeea30d15c6462be71ce039697; dependency hashes map to final/dependencies; output hashes map to final files; final/spectral-sources.js is the frozen source copy.

Official/pinned references read before implementation: [OpenAPI3.2 base URI/$self](https://spec.openapis.org/oas/v3.2.0.html#establishing-the-base-uri), [YAML Document/toJS API](https://eemeli.org/yaml/#documents), actual pinned Spectral Document/parseWithPointers and host sourceDocument policy, and CodeMirror5.65.21 lib/codemirror.js splitLinesAuto. Public [pinned CodeMirror source](https://github.com/codemirror/codemirror5/tree/5.65.21/src) supplies the corresponding implementation.

This verifies bounded pure catalog/range behavior, not full YAML/Spectral/dialect conformance or SDK/native acceptance. Root parent must still reject source/workspace/job/repository stale results, prove repository/ruleset generation, render/read-only navigate sources, error-gate Generate, preserve original structural worker and validate packaged host/privacy/platform workflows. No current full-root/Event runtime or full migration/UX completion claim. Original inline/Runner/lint/native proofs remain immutable. Root owns topic commit/STATUS; `/compact` is unavailable, so this is the explicit handoff.

## Root utility acceptance

Root independently rehashes every frozen source/output/dependency and replays SAME manual Bun eval body against currentroot utility/pinnedSDK:31checks exit0. Current compiler1256 terminal0errors/0warnings; earlier61750 reported only parent readonly-array prop mismatch, corrected by copying accepted array, not utility behavior. Root parent ApiDesign remains uncommitted and is not accepted by this utility checkpoint. Proof artifacts/spectral-sources-root-proof/root-audit.json. No browser/native/profile/fetch/testscript/dependency change; full parent/native/repository generation gates remain OPEN. Root handles terminal; /compact unavailable, explicit handoff.


</details>

<a id="record-agent-structural-source-ranges"></a>

<details>
<summary>AGENT-STRUCTURAL-SOURCE-RANGES</summary>

# Structural diagnostics retain source and complete range — 2026-10-13

Isolated native-next feature after 0bac235/1ed4a72. No root/native build/profile/clipboard/Send/producer/backend/permissions/editor changes. Supporting worktree still has older ResourceManager; root a881ed6 Resource changes are not offered or overwritten. Root57 native48 is historical once these new parent/worker files are integrated; this report does not claim new native acceptance.

The original analyzer locates every diagnostic against the main YAML AST and emits only one point. Exact attached warning reproduction exits1: the operation in a/shared.yaml has no source/range. One repro filename was accidentally reused by the first fixed replay; fixed output is preserved separately and the exact committed analyzer negative was regenerated with an explicit label, not presented as the original immutable file. Original terminal1 assertion remains recorded. All later UI negatives are archived independently.

Scalar0.29.7 internally structured-clones and merges referenced objects. Its documented public onDereference callback provides schema/ref/resolved; pathless parser errors provide no source/path and deduplicate messages. New openapi-origins indexes exact lexical file/path and original keys under one globally collision-safe scalar-ID property while Scalar clones. Callback captures inherited field origins, own siblings retain their own source, and genuinely mixed missing-key containers remain unresolved. Both resolved schema AND original protected roots retained by schemaEvaluation are stripped before restoration/validators/generation. No marker enters schema, examples, diagnostics, raw sources or generated rows. It does not alter reference resolution or add fetch authority.

Raw source AST nodes supply complete range[0..1] and LineCounter UTF16 coordinates. The accepted spectralRangeOffsets maps those raw BOM/CRLF/astral coordinates into CodeMirror canonical LF; raw bytes never change. Existing severity/message/path/1-based line/column compatibility remains, with source/sourcePath/range added when authoritative. Strict main validator paths, actual path-parameter validator paths (previously discarded), duplicate operation IDs and operation warnings resolve to raw source owners. Known typed-reference protection errors gain parallel site metadata while original errors strings remain. Truly pathless/ambiguous errors have no source/range and a disabled Source unavailable row; there is no message-text matching.

YAML syntax errors preserve their original message/throw behavior, with additive actual error.pos metadata. Analysis/worker can return a safe invalid analysis and known raw source for navigation. Declared URI comes from actual AST conversion, matching the existing $self policy. Duplicate identity keys/unconvertible identity refuse source/range rather than choosing a URI. Parser diagnostics retain the existing500-row display bound. Browser attached-only fallback now retains structural source selection without a semantic catalog; input/workspace/result identity guards clear stale selections/annotations. Source editor and layout components are unchanged; structural data uses their existing annotation/readonly/full-selection contracts.

Final V2 evidence in artifacts/structural-source-range/final-v2 (V1 final and negatives remain immutable):

- Source freeze binds676 current input files including ignored validators/Buffer. Current root54df helper and1b257 fixture are explicit test-only baselines, preserving both sourceSpecId filters and foreign literal POST sentinel. Entire original73-call UI oracle is unchanged after removing the additive call/property and formatting. Old native0bac proof remains immutable.
- SAME saved schema scenario retains83 original assertions and adds32 guards: nested/same-basename, full raw BOM/CRLF/astral range, strict main scalar, typed foreign ref scalar, captured repository, marker-like user keys/values, array clone/strip, own/inherited/mixed unknown, main/attached parser/$self, ambiguous identity refusal. Headless exit0.
- Paired exact committed-b95 analyzer code versus the new pipeline, sharing current additive parser/ref metadata helpers, checks83 existing schemas/evaluation graphs and46 generation calls. Schemas/schemaEvaluation are exactly equal, valid/throw behavior unchanged, generated rows equal except fresh IDs/timestamps. Near8MiB raw input remains valid and schema-equal; input/parsed budgets are enforced before instrumentation.
- SAME actual pinned f569 producer UI89024 exits0: retained original6 profiles/7 lifecycle cancellations/12 external profiles/capacity41/attached precedence plus12 structural attached/HTTP×dark/light×1440/900/760 profiles.61 normal owned producer hosts exit; worker/navigation performs no extra reference reads (36 original+18 structural). Trusted Enter selects exact full main/foreign CodeMirror ranges with focus/readonly/raw resource/history preservation. Explicit same-task synthetic stale-navigation wiring rejects an old result. Unknown source is disabled. Real browser isTauri:false fallback adds zero IPC jobs and selects attached raw source and actual parser EOF range. These are native:false, not Rust/tree/admission acceptance.
- Compiler11087 exits0/0errors/0warnings; isolated Bun/Vite frontend build exits0/49 assets. SAME serialized scenario retains168checks/11controls/8signing +8external/68controls and passes. Body/ownership/equivalence/budget guards pass.

Preserved negatives: UI68588 cursor position observation included unrelated sticky:null; correction measures line/ch explicitly. UI56370/9420 expected a bare annotation message whereas the existing editor prefixes severity/code; correction retains full endpoints and waits for the same existing prefixed message. UI12384 removed IPC but left the fixture isTauri flag true; correction uses the actual library detection contract and restores both flags. Compiler68347 boolean-site type,7993 URI annotation and61007 cast formatting negatives are retained. First frontend build through the verification-only dependency junction failed Vite temp resolution; after all handles terminal, only own junction metadata was renamed with contained-path verification and own frozen-lockfile/scripts-disabled Bun dependencies installed. Package/lock versions unchanged. No root target deletion or cleanup; preview WIP remains explicit verification-only and excluded from commits.

Official sources consulted: [Scalar public dereference/onDereference](https://github.com/scalar/scalar/blob/main/packages/openapi-parser/README.md), installed pinned implementation, [YAML content nodes/ranges/errors/LineCounter](https://eemeli.org/yaml/). No private loader patches or new dependencies.

Root must integrate under baseline hashes, preserve newer Resource/global UI, rerun current-tree compiler/build/full saved scenarios and inspect source/evaluation stripping before topic acceptance. Fresh current native structural adapter/candidate, repository consumed-read/generation/inflight changes, broader dialect/error classes, private/platform/distribution, unobserved-birth/hardFS/restart, SDK/Event/FIFO/full migration and authorized subsequent UX gates remain open. New structural UI cases are explicitly preview-only; native48 oracle remains retained until separately reviewed structural native fixtures are supplied. No live handles/profile claim. /compact is unavailable; this immutable report/STATUS handoff does not claim compaction.

V2 review fixes are measured, not guessed. SAME saved browser control accepts the original 400079-byte/200000-element array, while the instrumented V1 strip failed V8 with RangeError (Bun JSC accepted it). Iterative per-value traversal now passes both array and 200000-property object strip without spread argument limits. The stopped expensive broad-YAML manual run was inconclusive and is not used as proof. Public YAML Alias.resolve maps known alias diagnostics to the exact lexical anchor AST definition, including duplicate scalar operation IDs; it does not select an arbitrary alias use-site. Unsupported post-protection shared graphs propagate ambiguity to descendants and remain unresolved. Boolean true/false targets are checked through actual modern typed-reference boxing, Scalar callback, strip and primitive restoration; parent-held value provenance retains the target source and exact Boolean raw AST range. All markers are stripped before validation/schemaEvaluation/generation; original83 paired analyses/46 generations and near8MiB budget proof pass again.

V2 compiler11087 terminal0/0, source-range browser83+32 terminal0, serialized terminal0, fullUI89024 terminal0 and ordinary build terminal0. Final manifest SHA912026641c11ebc00ad3b562cedf9d3a3ba5aa79c2fd6e488986caed7770c17f binds15 patch paths,676 frozen inputs and808 archived output entries; fullUI events61reserved/61spawned/61closed/7cancel-settled/54reference-http. Source-freeze SHA3365976f9483475856ada4d08a717e8f9e7239b2caa898053e772f98fab321d6. Exact patch baselines are committed own1ed4a72, except explicit root54df/1b257 UI ownership baselines. Original73 assertions/two ownership filters/foreign POST sentinel survive. Root newer ResourceManager and namespace source is outside this patch and must be preserved. Current native structural acceptance remains OPEN. No live handles or native/profile claim; /compact cannot be invoked here, so this is the explicit feature handoff.

</details>

<a id="record-api-design-layout"></a>

<details>
<summary>API-DESIGN-LAYOUT</summary>

# API Design attachment layout

Expanded example/reference lists previously consumed the flex column and
compressed source/preview. The saved production-component fixture reproduces
source/preview13.6875px at760px width with three example and two reference files
open; its heading lies outside the preview pane. At1440px, preview only uses138px
rather than filling its pane.

API filename/validation/loading/example/reference management now sits in a named
scroll region capped at min(240px,25vh). It keeps its bounded height rather than
shrinking to zero. Top navigation and generation toolbars keep their height.
Source/preview minimum split height is240px horizontally and366px stacked;
preview fills its pane. The page scrolls vertically when the host is shorter
than the combined controls and panes. Existing shared controls/layout remain.

The API-only sizing selectors explicitly outrank Svelte's scoped SplitPane
defaults. This avoids load-order dependence without changing the shared
component or using !important.

## Saved headless evidence

bun tests/ui/api-design-layout.js passes24 unique profiles:
dark/light ×1440/900/760 widths ×960/600 heights ×3example+2reference or32+32files.
Both lists are expanded. Each verifies source/preview>=160px, the heading within
its preview, no horizontal overflow and keyboard focus revealing each list's
last input through all scroll ancestors. Controlled shell geometry mounts the
production ApiDesign/CodeEditor/SplitPane and shared controls; it is not native
acceptance. api-design-layout-headless-audit.json independently checks all24
recorded profiles and the exact source/scenario freeze.

Final compiler reports0errors0warnings; selected Prettier check passes.
Inventory has57Svelte/672shared sites/117tokens/1728CSS declarations,10 additional
feature layout declarations, with no new raw control or style owner. Source hash:
0be51b9a0d96b290397b3210395bf0ff93c8cd309cafcca716bb43937c78fadf.
Static inventory does not prove full runtime/accessibility/CSS acceptance.

## Native acceptance

Current production-profile build12655 is terminal0: start1791569928400 /
finish1791570301584 / hash17938830593973612643. Current source/scenario hashes
independently match api-design-layout-source-freeze.json, base0723d8b; successful
build saved in api-design-layout-build.json.

Saved native3.2.1 scenario23669/artifact1791570317843 is terminal0/passed,
18:25:18.236Z–18:28:27.901Z. Owned native56252 exits0, native-hidden/visible:false.
It accepts12 dark/light ×width ×height geometry/focus profiles with both lists
expanded, retaining3byte request groups/4loading controls/management/refs/
worker literals/persistence/send checks.

Per-run layout-independent-audit.json checks all12 geometry profiles, headless24,
exact source/scenario/build and method/target/base64/SHA-256, original source/ref
text and asset/reference Git round trips. cleanup-audit.json records owned
native/profile processes absent and fixture65053 listener gone. Final
artifacts/playwright/api-design-layout-final-audit.json repeats source identity
and combines those acceptance/cleanup gates. No live feature process handle.
Actual native dark1440×960, light900×960, dark760×960 and dark/light760×600
screenshots were inspected; source/preview headings remain usable. Shorter hosts
use page scrolling to reach setup and generation controls.

## Retained failures

Baseline result/metrics/PNG are retained in
artifacts/playwright/api-design-layout-baseline-760 and-baseline-1440; both images
were inspected. Initial960px layout passed, but cascade review showed shared
scoped defaults could override feature minima. That first build15457 is terminal0
(start1791569389374/finish1791569764257/hash17938830593973612643); its source/build
snapshots are archived as api-design-layout-*-first.json and do not prove final
source.

After strengthening selectors, the600px regression found setup flex-shrinking to
zero. api-design-layout-short-height-failure preserves result/metrics/PNG, which
was inspected. Keeping setup's bounded flex size fixes that failure. Sources
changed only after the earlier build terminated.

## Saved commands

```powershell
bun tests/ui/api-design-layout.js
bun run check
bun tests/ui/build-recovery-copy-probe.js
```

After the exact native build handle terminates successfully:

```powershell
$env:INSOMNIUM_UI_BUILD_STATE = 'artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSION = '3.2.1'
bun tests/ui/openapi-external-example.js
```

Run app/scenarios unchanged through build and native acceptance. Browser fixtures
use launchUiBrowser with fixed headless:true. Native helpers hide their owned host
before CDP and report native-hidden/visible:false.

## Documentation consulted and remaining scope

- [CSS overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow)
- [CSS min-height](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/min-height)
- [Svelte scoped style specificity](https://svelte.dev/docs/svelte/scoped-styles)

Full migration/OpenAPI/UX/CSS/provider/platform requirements remain active.
This bounded attachment fix is not full UI, accessibility, small-host or platform
acceptance. /compact is unavailable in this interface; STATUS carries the handoff.


</details>

<a id="record-named-example-recovery"></a>

<details>
<summary>NAMED-EXAMPLE-RECOVERY</summary>

# Named example levels and edited-source recovery

Verified scope below; full migration/UX/UI/CSS remains active. This extends the saved
named-example scenarios from implementation3cdbd18/checkpoint636ed50. App code
has not changed in this topic.

Official references consulted before the work:
[OpenAPI 3.2.1 Parameter Object](https://spec.openapis.org/oas/v3.2.1.html#parameter-object),
[serialization and examples](https://spec.openapis.org/oas/v3.2.1.html#serialization-and-examples),
[3.0.3 parameters](https://spec.openapis.org/oas/v3.0.3.html#parameter-object) and
[3.1.0 parameters](https://spec.openapis.org/oas/v3.1.0.html#parameter-object).
The modern dual-level cases distinguish parameter representation from media
representation and preserve the named map's referenced objects.

`bun tests/ui/openapi-named-examples.js` currently passes108checks/28controls and
six dark/light1440/900/760 actual shared-control profiles. New24checks cover
3.2.0/3.2.1 with same-named referenced root/media dataValue, serializedValue and
externalValue examples, default/explicit choices and source immutability. An
explicit root false remains false beside a media true; serialized/external
media JSON retains the unsafe numeric spelling before outer URL encoding.
Shared dropdown values distinguish the two levels. `bun run check` is0/0;
selected formatting/whitespace passes. Independent headless audit:
`artifacts/playwright/openapi-named-recovery-headless-audit.json`.

Reuse `bun tests/ui/openapi-named-example.js` for native acceptance; set
INSOMNIUM_OPENAPI_VERSION to each version. It adds modern competing-level choices,
then edits the actual CodeMirror source to remove the selected body example,
checks unavailable-choice Field feedback and worker refusal without resource
writes, corrects the choice, generates one new set while retaining original
requests, sends corrected JSON bytes, checks Git and resets choices. Source
comparison expects exactly the owner's edit, not an unchanged original document.

Production build59214 is reused because all462app hashes equal its accepted
source, build state equals the original successful record and exact executable
SHA-256 is a665b19e4b77872f0d1e9d588b03ab51e9083332312fc49c47002cf6199c4541.
New freeze `openapi-named-recovery-source-freeze.json` records those app hashes
and206 executable/fixture scenario hashes, excluding documentation README.
No scenario/app edits may occur during a live acceptance handle.

Retained first failure: native68913/artifact1791574555002 terminal1/native49780
exit0/native-hidden. The fixture expected a whole Git-decoded object to equal
the live resource, but canonical Git adds type:ApiSpec; request Git also omits
local _openapiIssues. Expected canonical metadata now matches the existing
codec's format without weakening field comparison or changing the codec. Failure
image inspected; owned49780/profile/listener59898 absent. Original freeze archived
with -first; scenario corrected only after the original handle was terminal.

Current native3.2.1 rerun17085/artifact1791574925196 terminal0/native36536/port63002:
8 Sends,14generated requests,6profiles and1worker refusal without writes. Recovery
audit verifies exact method/target/base64/SHA/header/cookie, original-resource
preservation, authored edit, corrected provenance, canonical Git and frozen
source/executable. Owned cleanup passes. Actual light760 image inspected.
The remaining current runs also pass:

| Version | Artifact suffix | Handle | Native PID | Fixture port | Sends | Generated |
| ------- | --------------- | ------ | ---------- | ------------ | ----- | --------- |
| 3.2.1   | 1791574925196   | 17085  | 36536      | 63002        | 8     | 14        |
| 3.2.0   | 1791575168203   | 37940  | 49260      | 58392        | 8     | 14        |
| 3.1.0   | 1791575401274   | 18512  | 60900      | 51912        | 5     | 8         |
| 3.0.3   | 1791575612022   | 3011   | 58432      | 52682        | 5     | 8         |

Every actual handle reached terminal0/native-hidden/visible:false/nativeexit0,
totaling26 Sends,44 generated resources of request type,24 native control profiles,
4 refusals without resource writes and4 corrected Sends. Per-run
recovery-independent-audit.json checks all payload groups, exact author's source
delta, canonical Git, preserved original resources, current668 hashes and exact
executable SHA. Final openapi-named-recovery-final-audit.json passedtrue combines
all4 runs with headless108/28/6. Both individual cleanup audits and final
openapi-named-recovery-cleanup-audit.json confirm all owned PIDs/profiles/listeners
are absent. No live feature process handles remain.

Current3.2.1 light760 and3.2.0/3.1.0/3.0.3 dark760 actual images inspected; no
arbitrary-viewport/full-UI claim. Source/app/CSS ownership is unchanged from the
accepted3cdbd18 implementation. No fresh build was required or claimed in this
topic; acceptance reuses the explicitly matched production release above.

This does not prove arbitrary viewport, OS-close/file-dialog/provider/platform
acceptance, native custom-method selection, every older content/example policy,
nonUTF8/external locations/base/fragment/media/charset/schema/resource policies
or the full original migration/UX/CSS. These gates remain required. /compact is
not callable in this interface; STATUS will hold the feature handoff.


</details>

<a id="record-named-method-examples"></a>

<details>
<summary>NAMED-METHOD-EXAMPLES</summary>

# Native named examples for custom HTTP methods

This extends the existing saved raw-TCP method scenario. Application/CSS code is
unchanged from3cdbd18. Full migration and UX/CSS remain active.

Official reference consulted:
[OpenAPI3.2.1 Path Item Object](https://spec.openapis.org/oas/v3.2.1.html#path-item-object).
additionalOperations keys retain exact method capitalization.

Commands:

```powershell
bun run check
$env:INSOMNIUM_OPENAPI_VERSION = '3.2.1'
bun tests/ui/openapi-methods.js
$env:INSOMNIUM_OPENAPI_VERSION = '3.2.0'
bun tests/ui/openapi-methods.js
```

The optional named fixture creates conflicting first/second examples. The actual
native UI selects17 operation-scoped choices. Fixed GET chooses second path/query,
while additional lowercase get explicitly chooses first path/query; both choices
use the same source method spelling but distinct additional-operation identity.
QUERY/COPY/custom-METHOD/M!x select second examples and five JSON bodies retain
their operation-specific kind. An inherited query parameter is overridden for
custom-METHOD. Raw TCP captures exact case-sensitive method/target/body.

Inline preflight12 selected cases across both modern versions passes; default
first/wrong controls prove selection affects generation rather than merely
preserving an unchanged sample. Original singular fixture remains available.
Initial4 fixture JSDoc compiler errors were corrected; compiler0errors0warnings.

Accepted production build59214 is reused with exact original successful build
state and unchanged462 app hashes. Executable SHA-256:
a665b19e4b77872f0d1e9d588b03ab51e9083332312fc49c47002cf6199c4541.
openapi-named-method-source-freeze.json records462app/206scenario hashes at
base0d441cb. No app/scenario edits during native acceptance.

Native3.2.1 handle32872/artifact1791576458500 passed6cases/17choices, terminal0,
native2076 exit0/native-hidden/visible:false. Independent audit checks literals,
source/preferences, canonical Git, provenance and current source/build hashes.
Each Send preserves resources and reload does not resend. Owned native2076,
matching WebView profile and fixture listener54839 are absent. Existing helper
recovered one New document click timeout after exactly one owned document was
persisted and selected; no duplicate click. Actual760 image inspected: exact
custom method heading is visible, example controls are below the fold. This
does not constitute additional control geometry or full layout acceptance.

Native3.2.0 handle62408/artifact1791576794148 also passed6cases/17choices,
terminal0/native6932exit0/native-hidden/visible:false, finished20:18:34.830Z.
Independent source/build/literal/provenance/Git audit passes; owned6932, matching
WebView profile and listener64040 absent. Existing helper recovered one owned
New document acknowledgement timeout without duplicate creation. Actual760 image
inspected with the same viewport limits above. Both saved handles reached exit0;
no live feature handles. Aggregate openapi-named-method-final-audit.json passedtrue
combines12cases/34choices with both per-run source/build and owned cleanup audits.
Artifacts are under artifacts/playwright/openapi-methods-<suffix>; each contains
acceptance.json, fixture.json, result.json, named-method-independent-audit.json
and named-method-cleanup-audit.json.

Remaining required scope: external parameter locations/nonUTF8, URI/base/fragment
and media/charset/schema/resource policies, older content/example policies and
all original provider/platform/storage/plugin/transport/Git/recovery/CI/release/
distribution/migration/UX/CSS gates. No broader interoperability/HTTP2/OS-close
claim. /compact is unavailable in this interface; STATUS records the handoff.


</details>

<a id="record-native-held-rule-negative"></a>

<details>
<summary>NATIVE-HELD-RULE-NEGATIVE</summary>

# Native held ruleset mutation evidence — 2026-10-13

Root independently verified745 frozen agent outputs, six test sources, four exact root baselines and the entire original native entry after removing only the explicit opt-in/layout supplement. Compiler80766 completed0/0; root saved headless38796 passed, fourteen new evidence refusals and nine original ownership refusals passed. The initial command used a nonexistent preflight filename and exited1 without running a scenario; the corrected existing preparation-guards entry passed. Test-only source additions preserve existing configureCase no-live-observer guard and the original four-second held function.

Exclusive native-hidden69504 executed the unchanged bf5e app/f569 producer, immutable990-source/52-asset compiled closure and declared runtime-test-only supplements. Original48 checkpoint/73oracle and full61 jobs/7 physical cancellations/54 HTTP reads passed before one additive actual job. The62nd job read ruleset A, entered its actual custom function, and remained authenticated by the retained live process object. The registered ordinary owned ruleset was replaced by fixed B with A-hash and saved-binding checks immediately before writing. The process completed normally, without cancellation. The result contained Owned delayed finding and the actual UI displayed one such row while current ruleset was B; source, binding and saved workspace stayed unchanged. The expected REPOSITORY_READ_GATE assertion failed: this is a reproduced product content-coherence defect, not a passing product feature.

Independent evidence: artifacts/held-rule-root-proof/native-negative-v1/root-audit.json and its archived native-output/restoration-output. All62 exact producers physically settled; hidden host37952 exited0. Original43resources/20history, both buffers/store/all654cookie bytes, managed Git names and three current nocturne:split keys plus two legacy keys were restored. Owned repository was archived and individually retired (50files/16directories) after exact host exit, no recursive deletion; claim released and root handles:none. Original prior negatives and compile evidence remain immutable.

This proves declared ruleset A-result/current-B mismatch, not universal externalABA, all consumed-read receipts or full production shell/platform/AT/distribution/migration acceptance. Native agent now prepares the isolated consumed-read/binding freshness correction with bounded outer metadata while preserving opaque resultJson and trusted custom JavaScript compatibility. Root requires saved old61+new62 proof and a fresh compiled candidate after product changes. All other original migration/UX/notice/SDK/Event/FIFO/private/platform gates remain open.

Verified test preparation and negative evidence are committed as one topic. /compact is unavailable in this interface; STATUS records the explicit handoff before the next feature.


</details>

<a id="record-native-managed-read-root-acceptance"></a>

<details>
<summary>NATIVE-MANAGED-READ-ROOT-ACCEPTANCE</summary>

# Fresh native managed-read refusal accepted — 2026-10-13

The actual Windows native app now refuses a completed Spectral job when its consumed managed ruleset changed during execution. The saved 62nd case authenticates the entered job, retained process identity and ordinary owned A ruleset before writing fixed B during the existing four-second custom function. Rust returns binding after normal physical producer exit; the stale A finding is not published and the UI contains zero stale finding rows. No accepted cancellation is used to obtain the result. The earlier actual69504 A-result/current-B failure remains immutable.

Root release build62029 completed0 in7m07s with existing five vendor warnings. New app SHA e56723deefd14a53834b23dfdb1ee7b17938022af6dcb7e66af29f7f18def352 and adjacent root producer a5ec393d48c9c8f46ed6fe207ffa423b7d1b6b4684211fa440b07d88b2faaca9 are bound to1013 exact source inputs,52 frontend assets,1946 complete actual emitted notice files and764 private source/admission inputs. Current Cookie implementation is included in this generation. The actual build hook runs producer/notice authority/frontend before compiling the saved native fixture and worker and invoking locked Cargo. Complete emitted native and Spectral notices match generated authoritative bytes; native admitted receipt700b438375749e6f400ecd72e4df4b040974dbd892ffd098d68a7b97d3942db1 remains bound to762 immutable archives. Three recovered Cargo sources are not yet admitted. This proves resource-copy coherence, not complete target linkage or legal/distribution coverage.

Independent prelaunch audit rehashed the full source/snapshot/assets/resources/private admission/exe/sidecar closure and exact probe overlay. All36 saved prototype syntax/path/receipt guards passed. Offered wrapper bytes remain archived; operational hashing uses standard createHash under Bun after a previously retained CryptoHasher crash. Read-only receipt review found restoration result exposes passed:true/errors:[] rather than status. A declared metadata-only runner supplement checks that actual schema; original frozen wrapper and every other assertion remain intact.

Exclusive saved native-hidden42258 completed0. Original48 checkpoint retains73 oracle assertions, seven entered cancellations, twelve external profiles and36 HTTP reads. Original61 plus structural additions retain54 reads, twelve full raw-range navigation cases, capacity41, attached precedence, unknown-disabled behavior and original UI/body assertions. All62 actual sidecar jobs were physically observed and exited; cancelled results are absent. Final jobfa0c80d3-d51d-4dfc-baab-3e6fc78754e4 enters before the guarded A→B write, executes its fixed4s function, exits0 normally and returns binding. Source/spec/binding/saved workspace stay unchanged; cleanup cancellationfalse after settled refusal is recorded separately.

Independent artifacts/spectral-managed-read-native-root-candidate/root-audit.json rechecks original frontend/harness/protected profile/process/HTTP/cleanup/range receipts. Native host38036 was hidden before CDP and exited0. Original43 resources/20 history, both exact workspace buffers, plugin store, all654 cookie files and their complete filename set are restored. Existing Git directory names are restored; the newly registered owned repository is archived and retired file-by-file after host exit, with no recursive deletion. All three current SplitPane keys and two legacy keys are restored. Profile claim is released; root handles:none.

This accepts the measured managed ruleset content-coherence correction on the fresh native generation. It does not prove universal ambient/package/dynamic/remote/resolution coverage, external A→B→A, filesystem TOCTOU/hard syscall interruption, unobserved process birth/restart, unsupported platforms or the full production shell. Including Cookie sources does not verify its native workflow; exact Rust URL/UTF8/precedence/jar restoration, OS/AT and other current native/UI workflows remain open. Every original SDK/Event/FIFO/private/platform/distribution/fullnotice/migration/UX gate is retained.

Root owns verified topic commits and records evidence/gates/process handles in STATUS. This interface cannot invoke /compact; this report and STATUS provide an explicit feature handoff, without claiming compaction.


</details>

<a id="record-native-structural-acceptance"></a>

<details>
<summary>NATIVE-STRUCTURAL-ACCEPTANCE</summary>

# Current native structural source-range acceptance

2026-10-13. Fresh root product generation after Environment c54efd4 and source ranges18cb285, native adaptersceb72ee. This is actual compiled ApiDesign component and real Rust IPC/registered repository/packaged sidecar acceptance, not full production shell or complete migration.

Fresh locked Windows release25960 exits0 in7m07s. App SHA256 bf5e866ccf306cfee3f0c365d1e35a1448cbbd26c4f4e8fb0a115cbac3dda3c3; adjacent sidecar f5690ce1dc4136c9604964cdf2b2e490442581437db453b14c1f340c2a8d962a. Independent990source inputs include all four local Cargo patches, native icons, permissions, raw notice candidate inputs and generated validators/Buffer;52frontend/fixture/worker assets bind actual compiled generation. Producer→notices→provenance→frontend hook and saved native fixture/worker run before Cargo. Original historical a00/d478 proofs untouched.

Saved native-hidden26453 exits0, owned host hidden before CDP and physically exits0. Original48jobs/7entered cancellations/12externalprofiles/36HTTPreads/73oracle checkpoint passes before additive12structural profiles+unknown13jobs/18reads; total61realRustjobs/54reads. Every producer physically observed and settled, cancellations publish no result. Capacity41/attached precedence retained. Trusted Enter selects full BOM/CRLF/astral raw main/foreign ranges with focus, foreign readonly, resources/history unchanged; unknown origin disabled. Same-task stale workspace control is explicitly synthetic wiring, not trusted native admission;760 width is CDP CSS viewport, not physical host width. Browser fallback/parser controls remain separate headless evidence.

Full original43resources/20history/two workspace buffers/store/654cookies/Git directory set/layout restored. Registered initially absent repository archived and individually retired after exact host exit, no recursive deletion; exclusive profile claim released. Root independently checks all source/asset/exe/sidecar/harness/output/process/HTTP/restoration bytes in artifacts/spectral-native-structural-root-candidate/root-audit.json. No live handles/profile claim.

Current native Environment/namespace/Resource full workflows and assistive technology, consumed repository-read receipts/generation/inflight ABA, full production shell, hard filesystem/unobserved process birth/restart/platform/private/distribution/signing/install/updater/notice coverage, SDK/Event/FIFO and every original migration/shared UI/UX requirement remain open. Shipping new code in this executable is not proof those other workflows passed. Source/file snapshots and passed tests are bounded evidence only.

Topic checkpoint recorded in STATUS. Interface cannot invoke /compact; explicit handoff, no compaction claimed.


</details>

<a id="record-openapi-allow-reserved"></a>

<details>
<summary>OPENAPI-ALLOW-RESERVED</summary>

# OpenAPI query schema allowReserved

## Contract and scope

Query schema parameters retain `allowReserved: true` in their editable
`_openapiSerialization` metadata. Form scalars, joined/exploded flat arrays and
objects, spaceDelimited, pipeDelimited and deepObject use reserved expansion for
data, including object property names. Root parameter names retain strict data
encoding. Valid percent triples retain their spelling/case; malformed percent,
Unicode and control characters are encoded. False/default keeps regular encoding.

The application encodes query-invalid `#`, `[` and `]` before URL assembly.
Reserved `&`, `=`, `+` and commas retain their syntax; users must pre-encode
literal data delimiters. Structural pipe/bracket/space separators remain encoded.
HTTP WHATWG URL parsing canonicalizes raw apostrophes to `%27`. The serializer's
pre-URL result and actual HTTP target have separate independent expectations;
this work does not claim raw-apostrophe HTTP wire preservation or a universal
inverse decoder for ambiguous delimiters.

Shared KeyValueEditor/Feedback links these rules to the actual value input.
Nullable rows retain their JSON/null help alongside the reserved help; compound
values use JSON. Existing editor metadata persists through editing, disabling,
reload and Git encode/decode.

Native screenshot review exposed horizontal help shrinking the value input.
Feature-owned key-value layout now gives help a second grid track in the Value
column. Name/enable/remove remain aligned with the full-width input. Existing
field/spacing/divider tokens own layout; ordinary/multipart rows preserve their
layout. The shared saved geometry helper checks actual bounds and ARIA-owned
help in browser and native scenarios. Six headless theme/width profiles cover30
ordinary/nullable/content/reserved/combined rows and12 multipart text/file pairs.

## Primary references

- [OAS 3.0.3 Parameter Object](https://spec.openapis.org/oas/v3.0.3.html#parameter-object)
- [OAS 3.1.2 Parameter Object and Appendices C/E](https://spec.openapis.org/oas/v3.1.2.html)
- [OAS 3.2.0 Parameter Object and Appendices C/E](https://spec.openapis.org/oas/v3.2.0.html)
- [RFC6570 reserved expansion](https://www.rfc-editor.org/rfc/rfc6570.html#section-3.2.3)
- [WHATWG special query encoding](https://url.spec.whatwg.org/#special-query-percent-encode-set)
- [RFC3986 query grammar](https://www.rfc-editor.org/rfc/rfc3986.html#section-3.4)
- [RFC5849 parameter normalization](https://www.rfc-editor.org/rfc/rfc5849.html#section-3.4.1.3)

No subsystem initialization, dependency or native transport change.

## Verification commands

Run saved scenarios with Bun, sequentially against the successful current
production probe. Native hosts are hidden before CDP; browser fixtures are
headless through the shared helper.

```powershell
bun run check
bun tests/ui/design-system.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
foreach ($version in @('3.0.3','3.1.2','3.2.1')) {
  $env:INSOMNIUM_OPENAPI_VERSION=$version
  bun tests/ui/openapi-query-serialization.js
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
bun tests/ui/openapi-nullable-serialization.js
bun tests/ui/url-encoding.js
```

Exact run states, evidence directories and remaining handles are in STATUS.
`progress.json` reports verified groups only; terminal `result.json` and
`acceptance.json` are required for scenario acceptance. The original reload
timeout was fixed by reopening Query through the actual UI after each reload.
The extended signing scenario exposed a verifier bug: splitting a target on
every `?` truncated legal query data. OAuth1/AWS verification now separates path
and query at the first delimiter only. Production signer/query code was unchanged;
the failed run is retained and acceptance requires the corrected native rerun.
The inline baseline proves the prior generator review refusal. Current inline
artifact `openapi-allow-reserved-inline.json` accepts99 groups across3 versions:
generation, independent serializer/URL targets, metadata Git round trip, encoding
off and composition with existing query/fragment. Saved native query scope is33
generation cases plus11 editor/refusal controls per version. Existing URL signing
scope adds6 reserved-query cases to20 original independent MAC checks.

## Remaining gates

Current production release1791471551768/finished1791472025898/result0 and
fixtureHash8274825441464047177 passed the final saved native scenarios:
query44 groups each for3.0.3/3.1.2/3.2.1 (132 total), nullable50, and URL29 raw
targets with26 independent Hawk/OAuth1/AWS signature cases. Query evidence:
1791472042644/1791472417460/1791472802645; nullable1791473316531;
corrected signing retry1791474770986. Each terminal result passed with native
host hidden/visiblefalse/exit0. Failed signing1791473674729 remains historical
evidence of the verifier bug; the retry supersedes it. Headless design-system
result passed with30 value rows/6 profiles/12 multipart pairs. Final source
compiler41455 passed0errors0warnings; final test-only verifier check is recorded
in STATUS. No production changes occurred after the accepted build started.

Other parameter locations, content/body encodings, Swagger2, full schema/union/
reference/example/name/version/provider/platform interop, other style/explode
combinations (including the existing exploded-flat deepObject guard), and raw reserved wire
interop remain separate gates. This topic does not close OpenAPI, general URI,
UI debt or full migration. All PLAN/PARITY requirements still in the owner's scope
remain required; this topic removes no scope.


</details>

<a id="record-openapi-binary-body"></a>

<details>
<summary>OPENAPI-BINARY-BODY</summary>

# OpenAPI raw binary request bodies

Valid OAS 3.0 `image/png` with a string schema and `format: binary` previously
generated an octet-stream body, losing its selected Content-Type. A schema-less
raw file in OAS 3.1+ also went through the example sampler instead of a file
selection contract.

Generated raw binary bodies now preserve their selected `mimeType` and carry
`binary: true`. A shared `isBinaryBody` predicate connects the existing native
file picker, late-selection guard, upload/template separation and request
transport. Bytes come from the selected file; examples and external file paths
are not read as local files. Send refuses before a file is selected. The body
editor shows Binary File with the actual Content-Type through shared Feedback.
Choosing another body type clears the explicit binary mode. Manual Content-Type
headers keep their existing precedence over the inferred media type.

OAS 3.0 binary schemas use the existing format convention. OAS 3.1/3.2 schema-less
non-text/non-JSON/non-XML/non-form media use raw file bodies (including image,
PDF, octet-stream and custom concrete media). Modern format alone is not a
transfer encoding declaration. Existing cURL file modes and octet-stream body
representation remain compatible. No native backend or dependency changes.

## References and commands

- [OAS 3.0 file uploads and specific media types](https://spec.openapis.org/oas/v3.0.3.html#considerations-for-file-uploads)
- [OAS 3.1 schema-less binary file bodies](https://spec.openapis.org/oas/v3.1.2.html#considerations-for-file-uploads)

```powershell
bun run check
bun tests/ui/design-system.js
bun scripts/ui-inventory.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/openapi-binary-body.js
bun tests/ui/curl-import-file-body.js
bun tests/ui/curl-import-mixed-body.js
```

Reusable saved cases cover seven OAS 3.0 and four each OAS 3.1/3.2 concrete media
bodies (15), with actual worker generation, empty-selection refusal, all 256
byte values independent of browser file MIME, exact wire Content-Type, resource
preservation and reload without resend. The native scenario additionally covers
manual header precedence and switching to Text without sending cached file bytes.
Inline source checks cover generation, preparation, upload/template separation,
stale-body refusal and 15 Git YAML round trips. Eight additional modern format
and invalid/stale-selection controls pass. Final compiler58610 returns0/0;
format/diff and headless design-system65886 pass.

Fresh production release1791478485955/finished1791479037902/result0,
fixture hash10572976255433141081 accepts native binary1791479046614:
21 groups (9 OAS3.0.3,6 OAS3.1.2,6 OAS3.2.1). Same-release cURL file1791479287906
accepts5 modes/4 checks and mixed-body1791479337589 accepts6 checks, including
overlapping file reads, latest selection, conversion/reload and body-type reset.
Sequence71237 terminal0. All three terminal native results passed,
native-hidden/visiblefalse/exit0 (PIDs50268/51520/14260). Owned loopback servers
close in finally. The actual OAS3.0.3 and3.2.1 light760 images were inspected:
retained Content-Type and existing file-picker layout remain readable. This is
Windows viewport evidence, not all-theme/OS-dialog/platform acceptance. Exact
history, errors, release and remaining gates are retained in STATUS.

Other body media, media negotiation/ranges, base64/contentEncoding transformations,
multipart arrays/encoding/headers, form serialization, complete schema validation,
required/optional body policy, Swagger, external examples, platform/provider and
every original migration/UX/PLAN/PARITY gate remain required. This feature does
not close full OpenAPI or UI debt.


</details>

<a id="record-openapi-boolean-schema"></a>

<details>
<summary>OPENAPI-BOOLEAN-SCHEMA</summary>

# Boolean schema references and request samples

Typed `true` and `false` Schema targets now survive reference resolution and worker cloning in OpenAPI 3.1.0, 3.2.0 and 3.2.1. This closes the reproduced direct-false and boolean-reference generation failures for the covered cases. Full migration and UX/UI/CSS work remain active.

Official sources consulted before implementation: [JSON Schema 2020-12 boolean schemas](https://json-schema.org/draft/2020-12/json-schema-core#section-4.3.2), [OpenAPI 3.2.1 Schema Object](https://spec.openapis.org/oas/v3.2.1.html#schema-object), and [cfworker JSON Schema documentation](https://github.com/cfworker/cfworker/tree/main/packages/json-schema). Installed the interpreter using the documented command `bun add @cfworker/json-schema` (4.1.1). Bun postinstall regenerated the existing document validators without a tracked generated diff. Production CSP and CSS are unchanged.

Typed boolean placeholders adapt Scalar's object dereferencer; private metadata is removed from the resolved view. Original schema identity travels in a cloneable evaluation graph. Attached standalone boolean roots use explicit parsing permission; the primary API document still requires an object. Literal booleans remain data, authored source stays intact, and references outside Schema positions cannot use boolean targets.

Sample preparation handles optional forbidden properties, bodies and parameters, boolean branches/conditionals and array bounds. Impossible required values and contradictory explicit examples produce review issues. The interpreter checks generated and explicit JSON values against a bounded local-reference projection of the expanded graph; raw external and serialized JSON bytes are checked without being rewritten. The projection supports known assertions/applicators, treats formats as annotations, and excludes directly marked read-only properties from its required list. Other dialects/vocabularies, broader URI/resource policies, full sampling/instance validation, arbitrary serialized parameters and processing budgets remain required.

`_openapiSchemaIssues` survives canonical Git encoding and decoding. Transport and existing Settings review combine it with local `_openapiIssues`; deliberate manual acknowledgment clears both arrays. Native tests persist durable-only issues and reload before Send, which proves owned persistence and pre-network refusal. Actual native Git synchronization is a separate gate. Acknowledgment tests retain request fields and do not send an unchanged prohibited sample afterward.

## Saved verification

```powershell
bun tests/ui/openapi-boolean-schema.js
bun tests/ui/openapi-schema-resources.js
bun tests/ui/openapi-dynamic-schema.js
bun tests/ui/openapi-serialized-contract.js
bun tests/ui/openapi-named-examples.js
bun run check
bun tests/ui/build-recovery-copy-probe.js

$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSION='3.2.1' # then 3.2.0 and 3.1.0, sequentially
bun tests/ui/openapi-boolean-schema-native.js

$env:INSOMNIUM_OPENAPI_VERSION='3.0.3'
bun tests/ui/openapi-external-example.js
```

Headless 175 checks cover 24 authored body shapes through direct and worker-style clone paths, attachments, optional/required/explicit parameters, dynamic pointers, raw examples, literal data, full Git metadata and preflight refusal. The mounted RequestEditor fixture verifies durable-only Settings review and acknowledgment without changing body/URL/ID/name/headers/parameters. Retained static 83, dynamic 75, serialized and named-example scenarios pass. Final compiler reports zero errors and warnings; formatting and whitespace checks pass.

| Native version | Actual handle | Artifact suffix | Groups | Wire | Refusals |
| --- | --- | --- | --- | --- | --- |
| 3.2.1 | 5343 | 1791587896320 | 34 | 19 | 15 |
| 3.2.0 | 83924 | 1791588320698 | 34 | 19 | 15 |
| 3.1.0 | 54415 | 1791588737521 | 32 | 18 | 14 |
| 3.0.3 regression | 10988 | 1791589144533 | 4 wire cases | 4 | — |

All handles terminated with code zero, result passed and native exit zero. Native rendering is `native-hidden`, with each owned host confirmed invisible before CDP. Modern totals: 100 groups, 56 exact wire bodies/targets/methods and 44 durable-only refusals with no packet/history addition. Three manual review/reload checks pass. Retained 3.0.3 adds four wire cases, 12 raw geometry profiles, four loading controls, four asset-management actions and two worker literal fields.

Independent auditors reconstruct complete authored documents, attached references, raw example bytes, expected bodies, SHA-256 values, all canonical Git fields (208 records), current source hashes and executable identity. Three light 760×960 review captures were saved; 3.2.1 and 3.1.0 were inspected along with the retained dark 760×600 asset-stage image. The retained geometry evidence concerns source/asset layout, not full operation-preview or all review-theme/accessibility coverage.

Fresh production build 49406 terminated with code zero. Native compiler PID 60164; start 1791587241355, finish 1791587616712. Executable SHA-256: `9e65a82e18c50223d44e91811578acb5b2781c111c806cd6e1af07e0e10f1e2e`. The original freeze contains 465 application and 217 scenario hashes. A separate acceptance freeze records one scenario-only readiness/selector/diagnostic correction; all application hashes remained identical to the built source. Fixture hash alone is not application identity.

The initial native handle 63706 terminated with code one before Send: its 15-second Collections lookup expired after reload. Failure artifact 1791587673246 and screenshot are retained. Successful ARIA confirms the original accessible label; the saved scenario waits up to 60 seconds and selects the exact rendered request-name child. Earlier headless fixture-timeout and compiler corrections remain recorded in STATUS. No failed run is counted as accepted evidence.

Final audit: `artifacts/playwright/openapi-boolean-schema-final-audit.json`. Build/freezes/headless audit and each native independent audit remain under `artifacts/playwright`. Fresh cleanup at 2026-10-09T23:43:26Z confirms all five owned native PIDs, profile processes and fixture listeners absent. No feature process remains live. Broader schema, provider/platform/storage/plugin/transport/Git/recovery/CI/release/distribution and original migration/UX/CSS gates remain open. The owner requires a topic commit and compact handoff before the next feature; this interface cannot invoke `/compact`.


</details>

<a id="record-openapi-data-value"></a>

<details>
<summary>OPENAPI-DATA-VALUE</summary>

# OpenAPI 3.2 dataValue selection

Verified data-form selection on release1791545416430 (finished1791545802407,
result0). Both saved native versions and independent audits pass; full migration/
UX/CSS remains active. Base:9132519.

The generator selects the first Example Object's own dataValue in3.2.0/3.2.1
before schema sampling, preserving false, zero, empty string, null, arrays and
objects. Media examples remain preferred; when no explicit media value exists,
3.2 content parameters may use their parameter-level example. Earlier versions
retain shorthand/value behavior. Normal serializers and existing UI remain.

This topic verifies data-form selection only. serializedValue wire preservation,
externalValue loading, example selection UI, schema-example precision and full
example/schema validation remain required. When dataValue and serializedValue
coexist, this generator selects dataValue; authored serialized wire is a pending
gate. All original migration/provider/platform/UX/CSS scope remains active.

Primary references consulted before implementing:
https://spec.openapis.org/oas/v3.2.1.html#example-object
https://spec.openapis.org/oas/v3.2.1.html#parameter-object-examples

Corrected baseline openapi-data-value-baseline.json records12 wrong selections
across both3.2 versions, including false becoming schema-default true and zero
becoming7. An initial harness assumed a resources property instead of the actual
generator array return; its invalid artifact is retained separately. Only the
corrected baseline is evidence. Direct body selection12 now passes.

Fixture preflight160 covers20 cases/two versions/both URL/cURL modes; actual
Git encode/decode40 and legacy value24 controls pass. An initial inline preflight
assumed composed body.text rather than the actual text body; corrected the
harness before claiming acceptance. Compiler0errors0warnings and selected
formatting/diff checks pass.

Saved tests/ui/openapi-data-value.js uses shared native-hidden launch and actual
owned worker generation.20 cases cover query/header/path/cookie, JSON content,
whole-query JSON/empty UTF-8 text/form, six JSON body shapes, UTF-8 text/form
bodies, parameter-level fallback and media precedence. It checks selected values,
literal raw TCP targets/bodies/owned header fields, persistence and reload
without resend. Cookie checks only the owned pair. Actual fixture port is saved
before generation; observed selection recoveries are recorded. Both native
runs, independent wire audits and owned cleanup are complete; evidence follows.

```powershell
bun run check
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSION='3.2.1'
bun tests/ui/openapi-data-value.js
$env:INSOMNIUM_OPENAPI_VERSION='3.2.0'
bun tests/ui/openapi-data-value.js
```

Freeze application source through the fresh build and native acceptance.
Record terminal evidence, current commit, remaining gates and live handles in
STATUS before the topic commit/compact handoff. This interface cannot invoke
/compact; do not claim it occurred.

Native3.2.1/20 handle54000/artifact1791545851817 is terminal0/passed on
release1791545416430,11:37:32.233Z–11:49:52.985Z. Independent literal wire audit
checks20 groups and frozen hashes. Generation recovery1 checks exact accepted
source identity; selection recoveries0. Native55384 exit0/native-hidden/visiblefalse;
Bun56360/native/profile processes and actual fixture60698 released.
Native3.2.0/20 handle97865/artifact1791546686546 is also terminal0/passed,
11:51:26.558Z–12:04:05.513Z, on the same release. Independent literal audit
checks20 groups and frozen hashes; generation recovery1 and selection recoveries0.
Native43992 exit0/native-hidden/visiblefalse; Bun50120/native/profile processes
and actual fixture58149 released. Combined native evidence40 groups.
All feature-owned handles are terminal; no passing run was restarted.

Artifacts are under artifacts/playwright/. Each native root contains
independent-data-value-audit.json, acceptance.json, result.json, fixture.json and
its observed openapi-generation-recovery.json. Source hashes are in
openapi-data-value-source-freeze.json. No serializedValue/external-example, full
precision/schema/media/provider/platform or full migration/UX/CSS claim.


</details>

<a id="record-openapi-dynamic-schema"></a>

<details>
<summary>OPENAPI-DYNAMIC-SCHEMA</summary>

# Dynamic schema reference sampling

Generated samples now choose dynamic targets per operation scope, including reuse of the same reader under different outer resources. Headless contracts and fresh four-version native worker/send acceptance pass. Full migration and UX/CSS goal is active.

Official sources consulted: [JSON Schema2020-12 core7.1,8.2.3.2,9.4](https://json-schema.org/draft/2020-12/json-schema-core#section-8.2.3.2), installed Scalar documented filesystem dereference API and installed [openapi-sampler](https://github.com/Redocly/openapi-sampler) source. No generator or new dependency.

Original typed schema nodes, resource bases, reference targets and dynamic anchors are captured before parser rewriting. Collision-free node bindings survive dereference, are collected into a Map and removed from resolved schemas. Analysis carries cloneable Maps so worker transport preserves schema identity. Original files and persisted resources retain authored text.

Each sample traverses the original reference graph with a fresh scope. The first resource defining a dynamic-anchor name wins. Only a plain-name reference initially targeting a dynamic anchor is overridden; static anchors, pointers and empty fragments retain their initial target. Branches receive independent scopes. Lexically enclosing resources are not introduced when evaluation starts directly in a nested resource. Referenced schemas and siblings combine with allOf rather than overwriting constraints. Recursive contexts share placeholders for the existing sampler's bounded recursive sample behavior.

Expansion allows10000 distinct node/scope contexts, depth100 and8MiB of copied literal string units per sample. Existing input8MiB/per-file200000nodes/depth100 and discovery100passes remain. Unsupported dialects/missing/nonobject targets still refuse. This is target selection for an approximate sampler, not full instance validation or complete schema compliance. Boolean references, other dialects, vocabulary discovery and broader URI policies remain required.

Saved commands:

```powershell
bun tests/ui/openapi-dynamic-schema.js
bun tests/ui/openapi-schema-resources.js
bun tests/ui/openapi-serialized-contract.js
bun tests/ui/openapi-named-examples.js
bun run check
bun tests/ui/build-recovery-copy-probe.js
```

75 dynamic checks cover three modern versions, six authored body shapes sampled directly/repeatedly/after structuredClone, source and Git preservation, static fallbacks, outermost/branch/lexical scopes, recursive siblings, attached schemas and refusal controls. The initial attached fixture failure is retained in artifacts/playwright/openapi-dynamic-schema-attached-fixture-failure.json; it described recursion by placing its dynamic anchor on the entire reference-bearing root, and was corrected to declare an anchored value subschema. Initial compiler undefined-target error was corrected; final compiler0errors0warnings. Static83, serialized and named-example regressions pass.

Frozen464app/212scenario files (676total), basef91fa3e. Fresh production build5039 terminal0/start1791584417815/finish1791584792031/native6776; executable SHA5720bbb99ed0f3751063ee8a4e35132383c84b0da33a77f6641f96cead3d0e77. FixtureHash9384957238430302815 alone does not identify application source. No app/scenario changes during build or acceptance. Existing frontend chunk advisory and5dependency eventsource-stream warnings, no build failure.

Native runs use the saved external-example scenario with INSOMNIUM_UI_BUILD_STATE=artifacts/native-recovery-copy-probe/build-state.json and INSOMNIUM_OPENAPI_VERSION set sequentially:

| Version | Actual handle | Artifact suffix | Owned PID | Fixture port | Wire / dynamic bodies |
| --- | --- | --- | --- | --- | --- |
| 3.2.1 | 61378 | 1791584804483 | 33680 | 55317 | 12 / 6 |
| 3.2.0 | 56633 | 1791585049857 | 61140 | 51698 | 12 / 6 |
| 3.1.0 | 27091 | 1791585293637 | 28244 | 56019 | 12 / 6 |
| 3.0.3 | 32256 | 1791585536523 | 55928 | 62509 | 4 / 0 |

All terminal0/resultpassed/nativeexit0/native-hidden/visible:false. Final native finish2026-10-09T22:42:20.614Z. Totals40wire/18dynamic/48theme-width-height geometry/16loading controls/16management actions/8worker literal fields. Dynamic attached-resource/recursive/lexical cases have headless coverage, not new native coverage. Existing approximate sampling is not instance validation.

Per-run dynamic-independent-audit.json independently reconstructs literal expected method/target/base64/SHA, asserts the authored dynamic graph, compares complete root/reference documents with the prior accepted fixture plus asserted additions, checks full-field canonical Git roundtrips, raw geometry/nonoverlap/focus,676source hashes and executable/build identity. Auditor initially assumed external JSON used body.text; that retained byte-preserving fixture stores binary/base64 and the auditor was corrected, without app/scenario changes. Headless audit reconstructs63body strings among75checks. Aggregate openapi-dynamic-schema-final-audit.json passes. Fresh dynamic-cleanup-audit.json files22:43:04Z confirm all owned PIDs/profiles/listeners absent. No live feature handle.

Actual3.2.1light760x600,3.2.0dark760x960,3.1.0dark760x600 and3.0.3light760x960 images inspected. These are pre-validation asset/layout captures; they do not prove full operation-preview, OS-close or every platform. No CSS changes or full migration claim. Remaining gates include boolean references, other dialects/vocabularies/URI policies, broader sampling/validation behavior and every original migration/UX/CSS requirement.


</details>

<a id="record-openapi-external-examples"></a>

<details>
<summary>OPENAPI-EXTERNAL-EXAMPLES</summary>

# OpenAPI external example byte assets

API Design accepts explicitly attached byte files and explicitly requested HTTP(S)
downloads separately from JSON/YAML reference documents. Names resolve against the
containing document URI. Analysis never downloads external examples automatically.
Missing selected assets produce request review issues or parameter-generation
refusal rather than silently substituting schema samples. Unused response examples
do not require loading before request generation.

Request bodies retain base64 bytes, including JSON whitespace, unsafe-integer
spelling and non-UTF8 binary data. Parameter examples currently require UTF-8 and
use the existing serialized parameter metadata. Operation-scoped named choices are implemented and verified in
[the named-example topic](API-DESIGN.md#record-openapi-named-examples). Example assets persist in
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

Full OpenAPI parity remains required: non-UTF8 parameter
semantics, URI/base/fragment policies, compound media/charset semantics, broader
external parameter-location/native coverage and schema/example precision.
Root/attached OpenAPI3.2 declared bases are implemented and verified in
[the $self topic](API-DESIGN.md#record-openapi-self-base); this does not close every URI/fragment policy.
Byte checks do not prove HTTP framing/header fidelity or arbitrary providers.
Download buffering and metadata expansion need bounded-resource review.

The760px panel compression is resolved by the subsequent
[API Design layout topic](API-DESIGN.md#record-api-design-layout), with fresh geometry/byte evidence.
Every original migration/UX/CSS/provider/platform requirement remains required.
The full migration is incomplete. `/compact` is
unavailable in this agent interface; STATUS records the handoff and actual handles.


</details>

<a id="record-openapi-form-body"></a>

<details>
<summary>OPENAPI-FORM-BODY</summary>

# OpenAPI explicit form-body styles

An explicit `style: form, explode: true` array previously required whole-request
review and, after review, sent one JSON-array field. It now generates an editable
JSON row carrying form serialization metadata and sends repeated field names.
Flat objects, non-exploded lists, space/pipe delimiters and deepObject expansion
also use their Encoding Object settings.

`openapi-style.js` owns flat RFC6570 value expansion shared by query and form.
Each destination owns its atom encoding. Form preserves allowed reserved syntax
and valid percent triples when requested, while encoding literal `&`, `=` and
`+` so they retain data meaning. Root names remain strictly encoded. Nullable
form values/empty containers follow the existing explicit omission strategy;
represented empty strings, false and zero stay distinct. Nested values and invalid
JSON/kinds/undefined style combinations refuse before dispatch. Ordinary manual
body rows keep URLSearchParams serialization and can mix with generated rows.

The generator records `formBody` on rows with explicit style/explode/allowReserved
Encoding Object fields. Their contentType is ignored in accordance with this
mode. Remaining default/content-based form properties retain their review gate.
The shared KeyValueEditor links JSON/style/null/reserved guidance using existing
Feedback and owner-spaced help geometry, with form-specific delimiter advice.
Editing and disabling preserve metadata; no new styling owner or CSS override.

## References and saved commands

- [OAS 3.0 Encoding Object](https://spec.openapis.org/oas/v3.0.3.html#encoding-object)
- [OAS 3.1 Encoding Object](https://spec.openapis.org/oas/v3.1.2.html#encoding-object)
- [OAS 3.1 form percent-encoding](https://spec.openapis.org/oas/v3.1.2.html#appendix-e-percent-encoding-and-form-media-types)
- [OAS 3.2 URL percent-encoding](https://spec.openapis.org/oas/v3.2.1.html#url-percent-encoding)
- [RFC5849 form-body signature parameters](https://www.rfc-editor.org/rfc/rfc5849.html#section-3.4.1.3.1)

```powershell
bun run check
bun tests/ui/design-system.js
bun scripts/ui-inventory.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/openapi-form-body.js
bun tests/ui/openapi-query-serialization.js
bun tests/ui/url-encoding.js
```

Baseline source evidence is retained in
`artifacts/playwright/openapi-form-body-baseline.json`. Current inline checks
accept45 form generation/wire examples,45 Git metadata round trips,99 existing
query cases and8 refusal/manual-mix/disable controls. Compiler returns0/0;
headless design-system accepts36 linked-help rows across6 theme/width profiles,
12 multipart pairs and prior shared UI contracts. Fresh production release
1791480370156/finished1791480783337/result0/hash15359465130268573711 accepts
native form1791480842884/60 groups across3.0.3/3.1.2/3.2.1. Its terminal result
is passed/native-hidden/visiblefalse/native46268exit0. Actual light760 images
for3.0.3 and3.2.1 were inspected. Same-release query1791481315749 accepts44
groups (3.0.3); URL1791481663110 accepts33 raw targets/30 independently checked
Hawk/OAuth1/AWS signatures, including four form-body HMAC-SHA1/SHA256 cases in
legacy/RFC modes. Both terminal results are passed/native-hidden/visiblefalse/
exit0 (52372/47480). Sequence9404 exits0; owned listeners close and no
feature-owned build/compiler/native/scenario handles remain. Browser scenarios
remain headless:true; native hosts hide before CDP attachment.

The saved native scenario checks15 generated fields plus5 edit/refusal/disable
controls per version (60 across3.0.3/3.1.2/3.2.1), actual linked help and raw HTTP
body, exact resource/history refusal guards and reload without resend. Query and
signature regression scenarios run sequentially on the same artifact.
The existing URL scenario additionally verifies four OAuth1 HMAC-SHA1/SHA256
form bodies in legacy/RFC modes from complete raw wire bodies, with generated
and manual duplicate names; its existing26 signing cases remain. Native acceptance
includes33 raw targets/30 independent signature cases as audited above.

Default/contentType form encoding, arrays of JSON/media values, binary/base64,
multipart fields/parts/headers, required-body policy, complete schemas/unions/
numeric precision, Swagger, external examples, other media negotiation/ranges,
provider/platform/raw interoperability and every original PLAN/PARITY migration/
UX/CSS gate remain required. This feature does not close full OpenAPI or UI debt.


</details>

<a id="record-openapi-form-content"></a>

<details>
<summary>OPENAPI-FORM-CONTENT</summary>

# OpenAPI form content/default values

JSON media recognition supports legal case variants and parameters. Fresh native
form acceptance covers208 groups across3.0.3/3.0.4/3.1.2/3.2.1; see
API-DESIGN.md#record-openapi-json-media for exact evidence and limits. Parameter content also passes
239 groups; current signing regression accepts45 raw targets/42 independent
signatures. Earlier native results below do not cover these new media variants.

JSON-array mapping update accepted: API-DESIGN.md#record-openapi-form-json-array distinguishes
whole JSON values in3.0/3.1 from3.2 per-item content. The earlier shared-array
convention and native evidence below are historical for affected JSON arrays;
current fresh-build180 native and45targets42signatures acceptance is in STATUS.

Modern form properties without explicit style/explode/allowReserved now carry
editable content metadata. Their JSON or text/plain representation is produced
before WHATWG form encoding. An explicit JSON string includes its quotation
marks; a default object retains nested JSON. Array properties encode each item
under the same field name rather than putting the whole array in one field.

The generator derives default media from the declared property/items type:
objects and nested arrays use JSON, ordinary primitives use text/plain, and
absent types or contentEncoding retain the unsupported binary/media review gate.
An explicit application/json type also supports unrestricted JSON values.
Unsupported media, complex text/plain and nested Encoding Objects remain review
gated, with persisted row metadata preventing dispatch after request-level review.

JSON values reuse the existing content serializer's kind checks and lexical
compaction. Validated array text is split without re-stringifying numeric or
string-escape lexemes. Edited large integers, exponents and escape spelling can
therefore reach the wire exactly, including within nested JSON items. Empty
arrays emit no field; allowed JSON null is represented as null, while nullable text null
uses the existing omission strategy. Ordinary manual and explicit-style rows
keep their separate serialization behavior.

KeyValueEditor uses its existing linked Feedback/help grid to explain the media
type and JSON editing. No CSS owner, backend or dependency changes are introduced.

## Primary references

- [OAS 3.0 Encoding Object and default form style](https://spec.openapis.org/oas/v3.0.3.html#encoding-object)
- [OAS 3.1 content versus style mode](https://spec.openapis.org/oas/v3.1.2.html#encoding-object)
- [OAS 3.1 form JSON example](https://spec.openapis.org/oas/v3.1.2.html#example-url-encoded-form-with-json-values)
- [OAS 3.2 encoding by name and repeated array items](https://spec.openapis.org/oas/v3.2.1.html#encoding-by-name)
- [OAS 3.2 default media types](https://spec.openapis.org/oas/v3.2.1.html#encoding-object)

OAS3.0 default-style semantics differ from the modern clarified content mode;
their existing review gates remain. OAS3.2 also applies explicit styles per array
item, which requires a separate correction to the prior whole-property style
behavior; this is an original version/style interoperability gate, not complete.

## Verification commands and current bounds

```powershell
bun run check
bun tests/ui/design-system.js
bun scripts/ui-inventory.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/openapi-form-body.js
bun tests/ui/openapi-query-serialization.js
bun tests/ui/url-encoding.js
```

Baseline evidence is retained in
artifacts/playwright/openapi-form-content-baseline.json. Current-source inline
generation/wire65 and Git body-metadata65 round trips pass, plus9 lexical/type/
media/binary/nested/null/name controls. Compiler is0errors0warnings and the saved
headless design-system scenario passes42 linked-help rows across6 profiles,
12 multipart pairs and the prior shared contracts. Native release1791482486447
finished1791482863725/result0/hash18022374636632659402. Native form1791482881448
accepts88 generation/edit/refusal/disable/reload groups (3.0.3/20,3.1.2/34,
3.2.1/34), including both modern lexical JSON item controls. Terminal result
is passed/native-hidden/visiblefalse/native24388exit0; both modern light760
content-editor images were inspected. Same-release query1791483623219 accepts44
groups (3.0.3); URL1791483997582 accepts37raw targets/34independent signatures,
including4JSON-content and4explicit-style form cases. Both terminal results
are passed/native-hidden/visiblefalse/exit0 (52736/32692). Sequence40001 exits0;
owned listeners close and no feature-owned build/compiler/native/scenario
processes or handles remain. Browser scenarios remain headless:true; native
hosts hide before CDP attachment.
The existing URL scenario now includes four JSON form-content OAuth1 HMAC-SHA1/
SHA256 cases in legacy/RFC modes, with quoted repeated values and a manual
duplicate. Independent normalization uses complete raw form bodies; accepted37
raw targets/34 signatures including4content and4style form cases.

Binary/base64 and other form media/ranges, OAS3.0 defaults, OAS3.2 explicit-style
item semantics, multipart parts/headers/nesting, full schema/union validation,
source example numeric precision, external examples/refs/Swagger/lint/provider/
platform/raw interoperability and every original PLAN/PARITY migration/UX/CSS
gate remain required. This feature does not establish full form or OpenAPI parity.


</details>

<a id="record-openapi-form-defaults"></a>

<details>
<summary>OPENAPI-FORM-DEFAULTS</summary>

# OAS 3.0 default form style

This is a historical milestone. Its default-style behavior is superseded by the
3.0.4 clarification adopted in [API-DESIGN.md#record-openapi-form-legacy-content](API-DESIGN.md#record-openapi-form-legacy-content).
The original evidence below is retained; it does not describe current generation.

Newly generated OAS 3.0 form requests without explicit encoding fields now keep
editable style metadata. Primitive arrays produce repeated field names, flat
objects expand member names, and represented null/empty containers are omitted.
For example, `["a +", "b&="]` produces
`color=a%20%2B&color=b%26%3D`, rather than a JSON string under `color`.

## Primary rules and scope

[OAS 3.0.3 form request bodies](https://spec.openapis.org/oas/v3.0.3.html#support-for-x-www-form-urlencoded-request-bodies)
identify `form` as the default serialization strategy. The
[Encoding Object](https://spec.openapis.org/oas/v3.0.3.html#encoding-object)
uses query-style defaults, including `explode: true` for form. The generator now
selects the existing form serializer when `style`, `explode`, `allowReserved`,
and `contentType` are absent. Both an empty encoding map and a completely absent
encoding field are covered. Explicit styles and modern 3.1/3.2 content/default
rules retain their existing behavior.

Nested objects and object-array values have no supported flat RFC6570 expansion;
generation flags them for review and the runtime guard still refuses after the
request review flag is cleared. Default binary properties and binary array items
retain row-level review metadata instead of silently becoming ordinary text.
Disable the unsupported row and provide a manual replacement to recover.
The value editor uses the existing linked form/nullable/review help and layout;
no component CSS, backend, or dependency change is needed.

Explicit OAS3.0 contentType handling and interoperability remain distinct gates;
this feature does not resolve every ambiguity between style and media fields.
Existing saved generated requests are not rewritten automatically; regenerate
the specification to obtain metadata. Complete saved-resource version migration,
schema constraints/unions, compound numeric precision, binary/media/multipart,
provider/platform/raw interoperability, and all original migration/UX/CSS gates
remain required.

## Verification

```powershell
bun run check
bun tests/ui/design-system.js
bun scripts/ui-inventory.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSIONS='3.0.3'
bun tests/ui/openapi-form-body.js
```

Current baseline is retained in
`artifacts/playwright/openapi-form-defaults-baseline.json`. Current inline
generation/wire88 cases across3.0.3/3.1.2/3.2.1 include5 expected refusals,88Git
body round trips,1 exact numeric edit and2 omitted-encoding cases. Compiler
passes with zero errors/warnings after correcting a fixture-only delete
annotation. Headless design-system terminal artifact passes the existing48help
rows/six profiles and shared contracts for unchanged UI components. Production
release1791488156977 finished1791488544091/result0/hash3674864577700837266.
Native form1791488554266 accepts35 groups for3.0.3, including earlier explicit
styles, default bodies, review/runtime refusal, disable recovery, exact wire,
state/history guards and reload. Terminal result is passed/native-hidden,
visiblefalse/native27220exit0; build68226 and scenario11009 exit0. No feature-owned
processes or live handles remain. Actual default flat-object light760 image was
inspected, with complete linked help and intact layout. The saved all-version
scenario defines117 groups; previous3.1/3.2/query/signature native acceptance is
historical, not new evidence from this build. Exact source hash and handoff:
STATUS.


</details>

<a id="record-openapi-form-json-array"></a>

<details>
<summary>OPENAPI-FORM-JSON-ARRAY</summary>

# Versioned JSON array form content

JSON content arrays in OAS3.0/3.1 now retain the entire JSON array as one form
value. An empty array is represented as `color=%5B%5D`. OAS3.2 continues encoding
one value per item, including omission of an empty property array.

## Sources and interpretation

- [OAS3.0.4 Encoding Object](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields-for-rfc6570-style-serialization)
  recommends content mode equivalent to a query Parameter Object using content.
- [OAS3.1.2 Encoding Object](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-for-rfc6570-style-serialization)
  specifies the same equivalence without the older recommendation qualification.
- [OAS3.2.1 encoding by name](https://spec.openapis.org/oas/v3.2.1.html#encoding-by-name)
  explicitly applies encoding per property array item, and to entire other values.
- [OAI discussion2789](https://github.com/OAI/OpenAPI-Specification/discussions/2789)
  links the clarification; earlier comments relying on implicit style defaults
  precede that clarification.

The older whole-JSON-value rule is an interpretation of the content-parameter
equivalence, not an explicit older per-array wire example. Apply it consistently
to the 3.0 family using the previously adopted 3.0.4 clarification. Default media
selection still uses the items schema. Explicit style/explode/allowReserved and
text arrays retain their existing behavior. Text-array mapping and broader
provider/version interoperability remain separate required gates. Do not claim
that the newer 3.2 per-item requirement proves older behavior.

Existing persisted generated rows are not rewritten. Their stored serialization
metadata remains authoritative; regeneration creates version-correct metadata.
Saved-resource migration policy remains required. This milestone supersedes the
older JSON-array convention in OPENAPI-FORM-CONTENT/LEGACY-CONTENT; earlier native
results remain historical. No UI/CSS/backend/dependency changes.

## Evidence and commands

- Baseline: artifacts/playwright/openapi-form-json-array-baseline.json proves
  repeated JSON members and omitted empty arrays for all four versions before fix.
- Inline generation/composition135 with8 expected review refusals across
  3.0.3/3.0.4/3.1.2/3.2.1 passes independent literal wire expectations.
  Artifact: openapi-form-json-array-inline.json.
- Eight edited lexical/empty controls preserve integer/exponent/string escapes:
  openapi-form-json-array-lexemes.json. Initial inline setup omitted timeout and
  failed the existing Preferences guard; rerun with timeout30000 passed.
- Git encode/decode135 request bodies preserve metadata:
  openapi-form-json-array-git.json passed.
- Compiler zero errors/warnings; selected formatting and diff checks pass.
- Production release1791492118810/finished1791492493741/result0 is current;
  all-version native form43899/1791492503995 terminal0 accepts180 actual records
  (49/49/34/48),8reviewed rows, empty arrays and edited lexemes. Result passed,
  native-hidden/visiblefalse/native51168exit0, owned processes/profile released.
  Fresh3.1.2 nullable and3.2.1 per-item light760 images inspected with intact
  guidance/layout. No feature-owned live handles remain.
- Existing URL scenario now adds four whole-JSON-array OAuth1 cases with independent
  wire bodies and signature calculation, alongside existing per-item/style cases.
  URL77353/1791494391567 ran sequentially after form cleanup and passed45 raw
  targets42independent signatures, including4whole-array legacy/standard OAuth1
  HMAC-SHA1/SHA256 cases. Terminal0/passed/native-hidden/visiblefalse/native43100
  exit0; owned processes/profile released. Compiler rerun0/0 passes.

```powershell
bun run check
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/openapi-form-body.js
bun tests/ui/url-encoding.js
```

Run the saved native form scenario for all four versions after the fresh build
finishes; verified180 artifact cases (49/49/34/48). Native host must hide before
CDP and report native-hidden. Browser scenarios stay headless:true. Full schemas,
binary/base64/media/nested encoding/provider/platform and every original
migration/UX/CSS/PLAN/PARITY requirement remain open until independently proven.


</details>

<a id="record-openapi-form-legacy-content"></a>

<details>
<summary>OPENAPI-FORM-LEGACY-CONTENT</summary>

# OAS 3.0 form contentType clarification

Generation now adopts the OAS 3.0.4 clarification for the 3.0 family. Without
explicit style/explode/allowReserved, form fields use contentType and its defaults:
JSON objects retain their parent field name, JSON strings include quotation marks,
and ordinary text uses form-urlencoded space/plus handling. Explicit style fields
continue selecting the existing RFC6570 serializer and supersede contentType.

## Primary source and decision

[OAS 3.0.4 RFC6570-style fields](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields-for-rfc6570-style-serialization)
identify the ambiguity in 3.0.3 and earlier and recommend contentType-only
serialization when all style fields are absent. The clarification is a
recommendation; this implementation adopts it consistently for 3.0.3 and 3.0.4
generation. The earlier default-style milestone is superseded, rather than a
claim of current conformance. Its original evidence remains in STATUS and
API-DESIGN.md#record-openapi-form-defaults.

[The JSON form example](https://spec.openapis.org/oas/v3.0.4.html#example-url-encoded-form-with-json-values)
distinguishes raw text from a JSON string including quotes. The existing modern
JSON/text form serializer now handles legacy generation as well, including
validated lexical JSON edits and represented JSON null/empty objects. Its repeated
array-item mapping convention is shared with the existing modern form behavior;
broader version/provider/raw interoperability remains a required gate.

Legacy string formats `binary` and `byte`, including array item formats, retain
review metadata. This does not implement arbitrary file/base64/media transport.
Clearing the request review flag does not bypass the row guard; disabling the row
allows a manual replacement. Media lists/ranges/parameters, full JSON Schema,
compound numeric precision, advanced encodings, binary/multipart/provider/platform
and every original migration/UX/CSS requirement remain open.

Nullable content guidance must retain both the JSON/null instruction and media
type. The saved headless fixture reproduced the missing media hint before the UI
fix; it extends existing linked Feedback/grid coverage without a CSS change.
Existing saved generated rows are not silently rewritten. Regeneration obtains
the new metadata; a complete saved-resource migration policy remains required.

## Verification

```powershell
bun run check
bun tests/ui/design-system.js
bun scripts/ui-inventory.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSIONS='3.0.3,3.0.4'
bun tests/ui/openapi-form-body.js
```

Baseline: `artifacts/playwright/openapi-form-legacy-content-baseline.json`.
Current inline generation/composition135 across3.0.3/3.0.4/3.1.2/3.2.1 includes8
expected refusals,135Git body round trips,1 exact numeric edit and4 omitted-encoding
cases; artifact: `openapi-form-legacy-content-inline.json`. Nullable help failure
is retained in `openapi-form-legacy-content-help-baseline.json/png`. Compiler
passes with zero errors/warnings. Final headless96643 passes54 help rows across6
profiles, including explicit nullable JSON media guidance. Production release1791489924836/finished1791490302230/result0 accepts native
form1791490308816:98 artifact cases (49each3.0.3/3.0.4), terminal passed,
native-hidden/visiblefalse/native52400exit0. Both nullable editor images exist;
3.0.4 light760 guidance/layout was reinspected. No feature-owned handles remain.
The saved full scenario defines180 groups (49/49/34/48); prior planned108/190
counts were incorrect and have been superseded by actual records/scenario audit. Previous modern/query/signature acceptance is historical.


</details>

<a id="record-openapi-form-style-items"></a>

<details>
<summary>OPENAPI-FORM-STYLE-ITEMS</summary>

# OAS 3.2 form style array items

Newly generated OAS 3.2 requests apply an explicit form Encoding Object to each
top-level array item. Earlier OAS 3.0/3.1 requests keep their whole-property
expansion. For example, `form`, `explode: false`, and `["blue", "black"]` now
produce `color=blue&color=black` for 3.2, while 3.0/3.1 retain
`color=blue,black`.

## Rules and implementation

- [OAS 3.2.1 encoding by name](https://spec.openapis.org/oas/v3.2.1.html#encoding-by-name)
  specifies applying the Encoding Object separately to each top-level array item.
- [Encoding Object RFC6570 fields](https://spec.openapis.org/oas/v3.2.1.html#fixed-fields-for-rfc6570-style-serialization)
  make explicit style fields equivalent to query-schema expansion and make
  `explode` ineffective for `deepObject`.

The generator persists `formArrayItems`, `itemKind`, and `itemNullable` on 3.2
explicit-style array rows. The shared form serializer validates the array, splits
validated JSON without rewriting item lexemes, and applies the existing style
serializer to each item. Flat object and nested array items therefore use their
own RFC6570 expansion: non-exploded objects retain the parent field name;
exploded objects use member names. This combination of item mapping and style
expansion is the implementation's interpretation of the two specification rules;
broader provider interoperability remains unverified.

Scalar items with space/pipe styles have undefined style behavior and stay review
gated. Clearing the request's review flag does not bypass the runtime guard.
Disabling the row permits a manual replacement. DeepObject uses its defined
object expansion regardless of the persisted 3.2 explode flag.

Edited numeric scalar items preserve large integer and exponent spelling rather
than converting through JavaScript Number. JSON shape checks remain limited to
the existing kinds; this does not implement complete JSON Schema constraints,
scalar subtypes, nullable unions, or numeric precision inside compound values.

The value editor reuses the existing linked Feedback/grid for “Each array item”
guidance. No CSS, backend, dependency, or layout change is required. Existing
saved generated rows are not silently rewritten; regenerate a 3.2 specification
to obtain the new metadata. A complete saved-resource migration policy remains
an original migration gate.

## Verification

```powershell
bun run check
bun tests/ui/design-system.js
bun scripts/ui-inventory.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/openapi-form-body.js
bun tests/ui/openapi-query-serialization.js
bun tests/ui/url-encoding.js
```

Current inline evidence: 76 generation/wire cases across 3.0.3/3.1.2/3.2.1,
including two expected refusal cases, 76 Git body round trips, and an exact edited
large-integer/exponent case. Retained artifacts:
`artifacts/playwright/openapi-form-style-items-baseline.json` and
`artifacts/playwright/openapi-form-style-items-inline.json`. Compiler passes with
zero errors/warnings. Saved headless design-system acceptance passes eight help
rows across six profiles and the existing shared contracts. Final production
release1791485710424 finished1791486088181/result0/hash3674864577700837266.
Form1791486095526 accepts102 groups (20/34/48 by version), including explicit
review/runtime refusal, disable recovery, numeric edits, exact wire, persisted
resource/history guards and reload. Query1791487015175 accepts44 groups;
URL1791487423309 accepts41raw targets and38 independently verified signatures,
including four new non-exploded per-item form OAuth1 cases. All results are
terminal passed/native-hidden/visiblefalse/exit0; sequence6943 exits0 and no
feature-owned live handles remain. Actual3.2.1 light760 item-editor image was
inspected. Exact source hash, superseded build and handoff: STATUS.

All other OpenAPI media/body/schema/refs/Swagger/lint/version/provider/platform,
original migration, and centralized UX/CSS gates remain required.


</details>

<a id="record-openapi-json-body"></a>

<details>
<summary>OPENAPI-JSON-BODY</summary>

# OpenAPI JSON request bodies

Request generation, editor modes and Format JSON now share validated media type
recognition. Case variants and parameterized application/json preserve JSON string
quoting. Structured +json bodies use generic JSON representation; text/json retains
legacy compatibility. Misleading json substrings such as application/jsonp and
text/plain; note=json do not select JSON handling. Original MIME strings remain
stored and sent unchanged.

Selection prefers exact application/json, then valid application/json variants,
then other recognized JSON representations, then the first offered media type.
Recognized schema-free JSON remains an editable text body. Explicit legacy binary
schemas retain the file workflow. Content parameters/form fields retain their
separate application/json rule.

Primary references:

- [RFC9110 media types](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.1)
  defines type/subtype matching and parameter syntax.
- [RFC6839 JSON suffix](https://www.rfc-editor.org/rfc/rfc6839.html#section-3.1)
  permits generic underlying JSON processing for +json representations.
- [RFC8259 registration](https://www.rfc-editor.org/rfc/rfc8259.html#section-11)
  defines application/json without media parameters. Charset does not change the
  UTF-8 output used by the application.
- [OAS3.1.2 request body](https://spec.openapis.org/oas/v3.1.2.html#request-body-object)
  defines offered content entries. JSON preference is application policy.

## Evidence — 2026-10-09

Base commit6ec693a. Baseline artifact openapi-json-body-baseline.json demonstrates
unquoted Application/JSON string examples, false application/jsonp recognition
and text/plain selected before offered Application/JSON.

New saved scenario initially produced20 JSDoc compiler errors in two test files.
After correcting annotations, bun run check passed0errors0warnings.
openapi-json-body-inline.json verifies80 literal generation/editor-mode/wire
goldens across3.0.3/3.0.4/3.1.2/3.2.1, including MIME preservation, strings,
arrays/objects/null/empty/false/zero/Unicode, schema-free JSON and selection.
Current openapi-json-body-parser-current.json passes68 strict field comparisons
against HEAD and10 body controls; retained historical native field evidence is
not current release proof.
Current openapi-json-body-field-regression.json passes419 field generation/wire
and body/parameter/header/path metadata Git comparisons, including52 expected
refusals. These composition checks do not replace fresh native acceptance.
openapi-json-body-git.json compares all serialized fields for499 requests
(80body155form264parameters), excluding documented Git-local fields.

Fresh production build session40465 completed terminal0:
release1791503770124/finished1791504136984/fixtureHash3522250952580057695.
Native body session51147 completed terminal0/passed; artifact1791504156325 has84
actual groups,21 per3.0.3/3.0.4/3.1.2/3.2.1. Native53136 exited0/native-hidden,
hiddenWindow.visible=false. Qualified native/profile process and listener60002
cleanup counts are0. All8 quoted/suffix760 images were inspected. Original MIME,
body/editor modes, literal wire representations, persisted Format JSON and
reloadWithoutResend passed. Independent acceptance audit matches all84 records
against literal fixtures. Binary session14536 completed terminal0/passed:
artifact1791505281485 has21 actual groups9/6/6 across3.0.3/3.1.2/3.2.1, including
explicit legacy JSON binary schemas,256 raw bytes, manual Content-Type and exit
from binary mode. Native51736 exited0/native-hidden/visiblefalse; qualified
native/profile processes and listener61448 counts0. All3 binary760 images were
inspected. URL/signing session82223 completed terminal0/passed on the same release:
artifact1791505704198 has5 checks,45 raw targets and42 independently verified
signatures, including4 whole-content controls. Native47896 exited0/native-hidden,
hiddenWindow.visible=false; owned scenario49272/native/profile processes and
listener52524 counts0. All feature build/native handles are terminal; no owned
live process remains. Production source stayed frozen across these native runs.

Fresh build and JSON body acceptance passed. Reproduction:

```powershell
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/openapi-json-body.js
bun tests/ui/openapi-binary-body.js
bun tests/ui/url-encoding.js
```

The body scenario accepts84 actual send/reload groups across four versions,
including one persisted Format JSON edit per version. Browser scenarios use the
fixed headless shared helper; native scenarios hide their owned host before CDP
and report native-hidden. Compiler, selected format/diff checks and native
acceptance are complete for this feature. Full migration completion is unproven.

Non-UTF8 text/media-specific semantics, ranges/lists, interactive content choice,
field suffixes, older text-array/provider interoperability, saved generated-row
migration policy, binary/base64/full schemas/precision/references/Swagger and all
original PLAN/PARITY migration/UX gates remain required. No saved rows are silently
rewritten; existing UI/layout and the subsequent redesign sequence are preserved.


</details>

<a id="record-openapi-json-media"></a>

<details>
<summary>OPENAPI-JSON-MEDIA</summary>

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


</details>

<a id="record-openapi-literal-references"></a>

<details>
<summary>OPENAPI-LITERAL-REFERENCES</summary>

# Typed references and literal payloads

Implementation, headless and fresh four-version native acceptance pass.
Full migration/UX/CSS goal remains active. Schema resource $id/anchors/dynamic
references are still required; this fixes a prerequisite reference-role bug.

Native attempt1 uses normal-hook fixed-CRUD candidate artifacts/native-resource-crud-audit-probe/api-import-drain (build72767 terminal0/Rust6m42; executable SHA1aa4a6fb29d60b9129ce4f129be7a473294f64a99679db45813a19fe6bd92f31). A direct standalone preflight correctly refuses an unbound producer PATH before launching any host; runtime uses the maintained namespaceBuildEnvironment bootstrap. Native74356/receipt1792013703175 fails while waiting for the invoke observer to trigger drain; its changed workspace retains the actual imported document, not a passing drain proof. Host17300 exits0/native-hidden; restoration1792013702965 and independent currentf0/d8 hashes are exact. Post-failure fullsource closure47270 passes. The corrected observer uses the existing native Spectral fetch pattern, submits unchanged IPC first and observes the actual response without a gate/delay; the original failed receipt remains immutable. Native claims will remain limited to submitted IPC acknowledgement/callback ordering, distinct from physical write contention, OS picker dialog, timeout/OS-close and all-platform acceptance.
Native acceptance at scenario commit2e04de6/production9638705: normal-hook build83118 at artifacts/native-resource-crud-audit-probe/api-import-drain-attempt-2 finishes0/Rust6m41; executable SHA83e8a3a296bdc8cb6daa79e6b484c92ed60549a4fa15a61529cb7943003af66b. Runtime54964/receipt1792014602828 passes all3 document/reference/binary-example FilePicker callbacks. Each records unchanged native IPC submission, real drain/edit refusal, actual Tauri-Response:ok, then drain callback/completion. No mock, acknowledgment gate or added delay. Complete durable data equals accepted resources/history/settings/selection; original resources/settings/history remain exact. Binary bytes [0,255,13,10,128] and independent hash match. Import-only scope observes0 Worker constructions; it does not verify validation/generation worker loading.

The actual mounted fixture shares one compiled workspace singleton, preserves genuine Rust IPC, binds every emitted IIFE/CSS asset and unmounts through Svelte before restoring transport/shell/storage. Inspector-delivered fixture code adds no inline-script CSP permission; this is not a claim that fixture assets were embedded in production frontend. Native host30484 exits0/native-hidden. Restoration1792014602612 rehashes exact originalf0/d8 buffers and protected inventory, with two actual registered owned collections, no cleanup errors. Root independently confirms no owned host/WebView remains. Full post-native source closure54964 is terminal0; compiler97971 passes0/0, focused controls and full spectral-api-design-native-fetch-adapter-full-regression (15272) pass. Independent read-only audit validates emitted hashes, changed/original buffers, actual IDs and binary data. Physical disk contention, OS file-dialog automation, timeout refusal, OS-close, universal worker/process births and broader platform/provider acceptance remain required.

Native command: set INSOMNIUM_API_IMPORT_NATIVE=1 and exact INSOMNIUM_UI_BUILD_STATE/INSOMNIUM_UI_PROFILE_OWNERSHIP for the fresh fixed CRUD candidate, then run the saved entry under the maintained namespaceBuildEnvironment bootstrap. Normal builder and ownership reconstruction commands remain tests/ui/build-resource-crud-probe.js and tests/ui/helpers/native-profile-ownership.js --reconstruct; use a fresh candidate/marker and retained raw ownership proofs, not a fabricated initial absence.
Official references consulted:
[OpenAPI Schema Object](https://spec.openapis.org/oas/v3.2.1.html#schema-object),
[JSON Schema reference/applicator roles](https://json-schema.org/draft/2020-12/json-schema-core#section-8.2),
and the installed Scalar README/source for its documented filesystem
dereference API. No new dependency or generator was required.

Before the fix, a valid JSON body example containing
$ref:unattached.json#/literal made analysis fail an external-reference lookup.
Retained reproduction: artifacts/playwright/openapi-literal-ref-before.json.

prepareApiReferences follows typed OpenAPI/Schema fields and reference targets.
It protects literal $ref members before Scalar's otherwise generic traversal.
Reserved-key collisions are avoided; JSON Pointer targets through a property
named $ref are translated for the parser and restored afterward. Renaming
preserves JSON member order and avoids **proto** setters. Diagnostics remove
internal marker names. Bounded JSON copies separate YAML aliases used as both
genuine schemas and literal data; existing8MiB document snapshot and per-file
200000node/depth100 processing bounds still apply. Source text is preserved.

```powershell
bun run check
bun tests/ui/openapi-serialized-contract.js
bun tests/ui/openapi-named-examples.js
bun tests/ui/build-recovery-copy-probe.js
```

Compiler initially reported one possibly undefined resolved.schema; guarded it.
Final compiler0errors0warnings. Headless8byte checks/68controls pass, retaining
168serialized/11controls/8signing/editor/body-Git and named108/28/6profiles.
24new controls across3.0.3/3.1.0/3.2.0/3.2.1 cover literal examples/defaults,
real schema references, properties named $ref and pointers into them, YAML
schema/literal aliases and missing-target diagnostics. Payload checks include
numeric, prototype and authored reserved marker names and exact member order.

The existing native external scenario adds a fourth literal JSON POST containing
$ref and adds $ref to Link/extension data. It retains binary/JSON/query byte
groups, root/child $self declarations for modern versions, loading controls,
asset management, twelve bounded layout/focus profiles, worker literal preview,
source/ref persistence and reload. All four versions passed fresh acceptance.

Source freeze openapi-literal-ref-source-freeze.json records463app/206scenario
raw-byte hashes at basef00b05f, including the new openapi-references.js module.
Fresh production build handle10673 actual terminal0/start1791579497029/finish1791579870051/native54344. All669 raw source hashes stayed unchanged through build and native acceptance. Executable SHA09ca26d29eec630a4528478d402aa7089023c80491fb676d7d0d62d2cb2af801 is bound in openapi-literal-ref-build.json and source freeze.

Native runs (each actual terminal0/resultpassed/native-hidden/visible:false):

- 3.2.1: handle72100, artifact1791580029103, native60552, fixture51246.
- 3.2.0: handle12644, artifact1791580459635, native45548, fixture55469.
- 3.1.0: handle24598, artifact1791580671405, native57228, fixture57073.
- 3.0.3: handle18709, artifact1791580881887, native54828, fixture63141.

Each run passes4exact method/target/base64/SHA groups,12layout/focus profiles,4loading controls,4asset management actions and2worker literals. Independent audit reconstructs payload/member order, source/reference definitions and full-field canonical Git resources, and matches current669/executable/build identity. Aggregate16wire/48layout/16loading/16management/8worker checks; all owned native/profile/listener sets absent in final read-only audit. Actual native3.2.1 light760x600,3.2.0 dark760x960,3.1.0 dark760x600 and3.0.3 light760x960 images inspected. No arbitrary viewport/full UI/platform acceptance claim.

Saved native command (repeat versions3.2.1/3.2.0/3.1.0/3.0.3):

```powershell
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSION='3.2.1'
bun tests/ui/openapi-external-example.js
```

Artifacts: openapi-literal-ref-headless-audit.json, openapi-literal-ref-source-freeze.json, openapi-literal-ref-build.json, openapi-literal-ref-final-audit.json, openapi-literal-ref-cleanup-audit.json and per-run literal-independent-audit.json/literal-cleanup-audit.json. Formatting/whitespace checks pass. No live feature handles.

Remaining required scope: schema IDs/anchors/dynamic refs, broader URI/
fragment/charset/resource policies and every original provider/platform/
migration/UX/CSS requirement. This does not prove all schema or URI semantics.
/compact is unavailable; STATUS records accepted handles, no live feature processes and the next required gate.

The installed Scalar JSON Pointer resolver still uses inherited-property lookup. Full own-property/resource policies, boolean/nonobject reference targets and unknown schema vocabulary/resource indexing remain required alongside schema IDs/anchors/dynamic refs. This feature does not establish complete reference compliance.

2026-10-10 follow-up: static schema-resource traversal now validates own-property targets before calling Scalar. The installed Scalar implementation itself is unchanged. Static resource/anchor acceptance and the remaining dynamic/boolean/dialect/vocabulary/URI gates are recorded in API-DESIGN.md#record-openapi-schema-resources.


</details>

<a id="record-openapi-methods"></a>

<details>
<summary>OPENAPI-METHODS</summary>

# OpenAPI 3.2 HTTP operations

Status: verified implementation, direct/compiler/Git checks, full native methods
acceptance and fresh generated-query regression.

Analysis now includes QUERY and additionalOperations in validation, preview and
explicit request generation, replacing the prior blanket unsupported diagnostic.
Custom method capitalization is retained in preview, request and native transport
input. Fixed fields keep uppercase wire methods and lowercase sourceOperation
keys. Additional operations retain sourceOperation.additional:true, distinguishing
fixed GET from custom get at the same path. Existing requests are not rewritten.

The installed Scalar path validator visits only the eight original methods.
Each extra operation is projected into GET validation with the same path-level
parameters; diagnostic paths are restored to the real source location. Strict
schema/version validation still rejects invalid tokens, forbidden fixed-method
keys and extra methods on older versions. Duplicate operationId checks include
all operations. Servers, inherited/overridden parameters, bodies and security
use the existing generation pipeline. Current layout/CSS is unchanged.

Primary sources consulted before implementation:

- [OpenAPI 3.2.1 Path Item Object](https://spec.openapis.org/oas/v3.2.1.html#path-item-object)
- [RFC 9110 method semantics](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.1)
- [RFC 10008 QUERY](https://www.rfc-editor.org/rfc/rfc10008.html)
- Installed Scalar official implementation:
  node_modules/@scalar/openapi-validator/dist/validate-path-parameters.js.

Verification:

- openapi-method-baseline.json records prior QUERY/custom refusal.
- openapi-method-source-identity-baseline.json records the initial GET/get metadata
  collision; corrected generation adds the additional-operation marker.
- openapi-method-direct.json passes12 generated/composed targets and12Git round
  trips across3.2.0/3.2.1, with exact case and source identities. Six fixtures are
  GET/QUERY/COPY/custom-METHOD/get/M!x; five of six have JSON bodies. Eleven
  negative controls cover older3.0.3/3.0.4/3.1.2, forbidden POST/QUERY keys,
  invalid/empty tokens, missing QUERY/custom path parameters, unmapped custom
  path parameter and duplicate operationId, with source diagnostic assertions.
- Latest bun run check:0errors0warnings; selected formatting/diff checks pass.
- Fresh production release1791530305299/finished1791530675793/result0,
  fixtureHash4196347993003912469; build65789 terminal0, owned launchers38132/50096
  gone. Source stayed frozen throughout native methods/query acceptance runs.
- Saved native methods20732/artifact1791530863993 passes all6methods/5JSON bodies,
  07:27:44.004Z–07:31:53.081Z. It checks actual owned worker generation, exact
  dropdowns, raw TCP method/target/body, inherited/overridden parameters and
  persisted resources/reload without resend. Independent-method-audit.json
  checks literal methods/targets/bodies, preview labels and distinct metadata.
  Actual custom-heading760 image inspected. Native42480 exit0/native-hidden/
  visiblefalse; Bun51068/native gone, owned WebView profile0, fixture62592
  listeners0. No passing methods scenario restarted.
- Sequential saved query20668/artifact1791531154973 passes all44groups on the
  same build,07:32:34.985Z–07:55:31.074Z, terminal0/native-hidden/visiblefalse.
  Independent-query-audit.json checks33literal generated targets,11edit/runtime
  controls and5pre-network refusals; saved scenario checks persisted resources
  and reload without resend. Both actual760 help images and geometry inspected.
  Native49216 exit0; Bun53956/native gone, owned WebView profile0, actual fixture
  57113 listeners0. Selection recoveries0: conditional timeout recovery branch
  was not exercised. Fresh native coverage is3.2.1; no fresh all-version claim.

Retained attempts and repairs:

- Build75560/start1791529822961/finished1791530240471/result0 preceded the metadata
  repair. Its owned launchers25648/52956 are gone; it is superseded and was never
  accepted for this final feature. Source edits occurred only after terminal.
- Methods84325/artifact1791530686285 failed before wire cases at a whitespace-
  sensitive raw preview-label assertion. Failure image/snapshot showed all six
  exact case labels and diagnostic0; owned-generation-audit.json confirms six
  requests for sourceSpecId spc_f6465f98a45c48f0902a5411c17539ff with correct
  methods/markers. Native45556 exit0/native-hidden/visiblefalse; Bun33000/native/
  profile gone, fixture55714 listeners0. First-attempt raw label bytes were not
  captured. Saved scenario now records raw and whitespace-normalized labels,
  asserting exact full method/path/name. Accepted retry preview-labels.json
  proves newlines between method/path; case is unchanged. Test-only repair,
  compiler0/0, production build/source unchanged. This attempt remains failed.
- The saved preview revalidates after API Design remount before checking labels
  and the exact custom heading; it uses persisted source, not previous view state.
- Initial inline fixture omitted timeout and expected empty GET body text;
  corrected to timeout30000 and existing null-body semantics without product
  workaround. Initial compiler5JSDoc/type errors were repaired; final0/0 above.

```powershell
bun run check
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE = 'artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/openapi-methods.js
$env:INSOMNIUM_OPENAPI_VERSION = '3.2.1'
bun tests/ui/openapi-query-serialization.js
```

Saved scenarios use Bun/shared helpers only: browser headless:true, native-hidden,
no browser-use. This feature does not prove provider/proxy/auth-signature/HTTP2
interop, full OpenAPI schemas/media/refs/lint, saved-generation policy, other
platforms or full migration/UX/CSS. Existing method-specific auth policies remain
separate gates. Only QUERY/custom-operation capability is accepted here; all remaining original
migration/UX/CSS gates stay required.


</details>

<a id="record-openapi-named-examples"></a>

<details>
<summary>OPENAPI-NAMED-EXAMPLES</summary>

# OpenAPI named example selection

Verified selection scope below; the full original migration and UX/UI/CSS goal
remains active.

API Design exposes named example choices per effective request parameter and
body media type, using shared Field/Select/Toolbar controls. Choices belong to
the document resource, keyed by path, method, additional-operation identity and
parameter location/name (case folded for headers). A request records only its
chosen example provenance. Generation uses shallow copies of the example maps;
shared resolved references and authored source text stay unchanged.

Default behavior still selects the first example under the preferred body MIME.
Changing MIME resets the named choice to that MIME's default. An empty example
name has a distinct encoded option. Unavailable saved choices produce Field
feedback and block generation until corrected or globally reset. The worker
captures preferences and rejects a result if those preferences changed while
generation was pending. Choice metadata is limited to 10000 entries or 1 MiB.

Official documentation consulted before implementation:
[OpenAPI 3.2.1 Example Object](https://spec.openapis.org/oas/v3.2.1.html#example-object),
[Parameter Object](https://spec.openapis.org/oas/v3.2.1.html#parameter-object) and
[Media Type Object](https://spec.openapis.org/oas/v3.2.1.html#media-type-object).
Named Example Objects differ from schema example arrays. The existing
dataValue/value, serializedValue and explicit external asset representation
selectors remain responsible for request representation.

Saved commands and current evidence:

- `bun tests/ui/openapi-named-examples.js`: headless 84 generation/composition/Git
  checks and 28 specific refusal controls. Four versions 3.0.3/3.1.0/3.2.0/3.2.1
  cover effective path/query/header/cookie choices, component-ref isolation,
  content examples, exact external body bytes, MIME changes and empty/prototype/
  numeric names. Modern versions additionally cover 12 serialized cases each.
  Lowercase additional get and custom-METHOD preserve separate choices, source
  identities and method casing without changing the shared parameter source.
- The same scenario mounts the actual ApiExampleChoices component and shared
  controls in six dark/light 1440/900/760 profiles, testing choices, MIME reset,
  disabled controls, accessible stale-choice errors, correction and reset.
  Artifacts: `artifacts/playwright/openapi-named-examples`.
- `bun tests/ui/openapi-serialized-contract.js`: retained serialized/editor/
  external/body-Git scenario passes. `bun run check`: zero errors/warnings.
- `bun tests/ui/openapi-named-example.js`: saved native scenario passes across
  all four versions. Its cases use actual API Design choices,
  worker generation, IPC persistence/reload, transport bytes/header/query capture
  and Git round trips. Modern versions also send chosen serialized JSON and
  whole-query examples. It uses the shared native-hidden helper.
- `bun tests/ui/build-recovery-copy-probe.js`: required fresh production-profile
  isolated build before native acceptance. App/scenario files must stay frozen
  throughout the build and acceptance; require the same process terminal0.

Fresh build59214 reached terminal0/start1791572626421/finish1791573002345,
production release profile, embedded fixture hash5230209974452422699. Frozen
source record `openapi-named-source-freeze.json` base0b2b435 includes462app and
207scenario SHA-256 hashes. They match throughout all current runs. Build record:
`artifacts/playwright/openapi-named-build.json`.

Native artifacts under `artifacts/playwright/openapi-named-example-`:

| Version | Artifact suffix | Scenario handle | Native PID | Fixture port | Requests |
| ------- | --------------- | --------------- | ---------- | ------------ | -------- |
| 3.2.1   | 1791573014945   | 35302           | 60036      | 58581        | 6        |
| 3.2.0   | 1791573191991   | 15017           | 25732      | 56510        | 6        |
| 3.1.0   | 1791573389510   | 25283           | 58464      | 53375        | 4        |
| 3.0.3   | 1791573577866   | 76244           | 55856      | 57444        | 4        |

All actual scenario handles reached terminal0/native-hidden/visible:false/native
exit0, totaling20 requests and24 dark/light 1440/900/760 native control profiles.
Per-run `independent-audit.json` checks method/target/base64/SHA-256/header/cookie,
source/preferences/assets/Git/provenance/reset and frozen source/build identity.
`cleanup-audit.json` confirms each owned native PID/profile/listener is absent.
Final `openapi-named-final-audit.json` passedtrue combines these with headless
84/28/6 and retained serialized and layout24 acceptance. No live feature handles.

Implementation committed in3cdbd18. Post-acceptance documentation added the
summary to tests/ui/README.md, which the broad freeze also includes. The final
audit initially refused this documentation hash change. Corrected per-run/final
audits verify the original README against the base0b2b435 Git blob and report
that one documentationChanges entry; all executable/app hashes still must match.
Historical freeze/build records are preserved, and all four audits/final
aggregate passed again. Final cleanup aggregate is openapi-named-cleanup-audit.json.
No callable /compact is exposed; STATUS contains the explicit feature handoff.

Inspected actual native3.2.1 light760/dark1440 and3.2.0/3.1.0/3.0.3 dark760 images,
plus controlled light760. This verifies those images, not every UI surface or
arbitrary viewport. Static inventory sourcec3f9e7b599843b9a3e308b0abe137e96831b7783c003556ab1138201335817dd:
58Svelte/681shared/117tokens/1728CSS declarations, +9 shared sites/no new raw or
style owner. Static inventory does not prove full runtime ownership/accessibility.

Retained failures: the baseline always generated first despite a second choice.
The expanded fixture initially threw before rendering evidence; compiler typing
was corrected and failure evidence is now rendered explicitly. Git canonical
key ordering exposed an order-sensitive comparator; the saved comparator now
compares sorted object members and retains array order. The body composer returns
text in body and external binary in bodyBase64; the serialized test was corrected
to inspect the corresponding field. A proposed arbitrary 80px minimum rejected
an otherwise fitting 78px selector; acceptance checks shared control minimum40px
and viewport bounds. The actual failure image and light760 controls were inspected.

These fixtures do not prove arbitrary viewport or all OpenAPI precision/media/
schema/resource handling. Additional/custom selection identity is verified in
headless generation; native custom-selection still needs acceptance. The later
[API-DESIGN.md#record-named-example-recovery](API-DESIGN.md#record-named-example-recovery) verifies3.2 simultaneous
parameter/media data/serialized/external choices and four-version native stale
source/refusal/correction/reset, without changing the application. Further external locations,
non-UTF8, URI/base/fragment policy and broader original parity/UX/CSS/provider/
platform/distribution gates remain required until separately evidenced. No full
migration completion claim.


</details>

<a id="record-openapi-query-uri-encoding"></a>

<details>
<summary>OPENAPI-QUERY-URI-ENCODING</summary>

# OpenAPI query delimiters on the wire

2026-10-08. Base `14535e9`; this corrects supported query styles without changing
serialization metadata, editing controls, native transport or ordinary request
query handling.

`openapi-query.js` previously constructed literal pipe separators and deepObject
brackets. The raw TCP native fixture proves that these reached the server without
encoding. Earlier style-table wire expectations accepted this behavior; they are
superseded by the corrected expectations.

| Style               | Old request query          | Correct request query        |
| ------------------- | -------------------------- | ---------------------------- |
| pipeDelimited array | `color=blue\|black\|brown` | `color=blue%7Cblack%7Cbrown` |
| deepObject          | `color[R]=100`             | `color%5BR%5D=100`           |

The change follows [RFC3986 query syntax](https://www.rfc-editor.org/rfc/rfc3986.html#section-3.4)
and [OpenAPI 3.2 Appendix E.6](https://spec.openapis.org/oas/v3.2.0.html#appendix-e-percent-encoding-and-media-types):
structural pipe/bracket characters need URI percent encoding. Names and data are
encoded independently before assembling the structural delimiters. Space
separators remain `%20`; form separators remain comma, equals and ampersand.

Literal delimiter characters in names/data can become ambiguous after decoding.
The specification calls for pre-encoding data separately to distinguish it from
delimiter syntax. The fixture covers both raw delimiters and already encoded
input; ordinary expansion encodes the percent sign in such input. Exact wire
bytes are verified, not a universal inverse decoder or provider-specific parsing
policy. `allowReserved` is still a separate required implementation gate.

## Saved scenarios and evidence

Run `bun tests/ui/build-recovery-copy-probe.js` and require the exact builder's
terminal0 plus finished/result0 in its build-state before native tests. Set
`INSOMNIUM_UI_BUILD_STATE=artifacts/native-recovery-copy-probe/build-state.json`.
Run native entries sequentially under the shared native-hidden policy.

The existing `bun tests/ui/openapi-query-serialization.js` now accepts
`INSOMNIUM_OPENAPI_VERSION` values `3.0.3`, `3.1.2`, `3.2.1` (default `3.0.3`).
Each run contains 18 generation/wire cases and three edited/disabled/malformed
controls, with exact resource preservation and reload without resend. Additional
cases cover literal/pre-encoded data and a parameter name containing delimiters.
The TCP fixture compares raw HTTP targets, independently of URL decoding.

Baseline `openapi-query-serialization-1791466263026` failed on the previous
successful production artifact: the pipe target was unescaped. Native41312 was
hidden and exited0; the listener closed. This is evidence of the original defect,
not acceptance of the new source.

Inline Bun checks pass 54 generation/transport cases across the three versions
and 54 Git parameter/URL round trips (`openapi-query-delimiters-inline.json`).
Another 108 controls verify encoding-off and existing-query composition
(`openapi-query-delimiters-compose.json`). Artifacts are under artifacts/playwright.
Compiler95823 and final9796 return zero errors/warnings; format/diff checks pass.
Production release1791466592294/1791467057064/result0/hash5977586194741203322
accepts all three saved native query runs:1791467115683 (3.0.3),1791467246960
(3.1.2),1791467383520 (3.2.1),21 groups each/63 total. Same-release nullable
1791467572020 accepts50 and URL1791467870516 accepts5 checks/23 targets/20
independent Hawk MAC cases. All native runs are hidden/visiblefalse/terminal0,
with parent exit0 and listeners closed. No live owned process/tool handles.
Exact process IDs/build records and scope are retained in STATUS/UI-TESTING.

The full OpenAPI/migration goal remains incomplete. `allowReserved`, content and
body encoding, advanced schemas/refs/examples, Swagger, lint, provider/version/
platform interoperability, URL/auth integration and every other PLAN/PARITY gate
remain required. This correction does not replace those requirements with the
smaller set of fixtures above.


</details>

<a id="record-openapi-querystring"></a>

<details>
<summary>OPENAPI-QUERYSTRING</summary>

# OpenAPI 3.2 whole query parameters

Verified feature on release1791535554156 (finished1791535923874/result0).
This closes the supported whole-query gate only; the full migration/UX/CSS
objective remains active.

## Behavior

The generator retains `in: querystring` as one editable Query row. Its name is
only a label. Application/json serializes the entire JSON value without an outer
name; UTF-8 text preserves query delimiters and valid percent escapes; UTF-8 form
media serializes object members with existing form encoding rules. Empty text
and empty form objects preserve a bare `?`; nullable text/form null omits the
query, while JSON null remains represented. Editing preserves numeric and JSON
lexemes. Duplicate form member names refuse before network.

Compact serialization metadata retains relevant schema and encoding fields,
without copying a dereferenced schema graph. Effective inherited parameters may
contain at most one whole-query parameter and may not mix it with named query
parameters. Same-name operation overrides remain valid. Malformed parameter
entries produce strict-validator diagnostics rather than throwing in this
inheritance check. Unsupported media/byte/nested encoding remains reviewed and
runtime refused after clearing request-level review; disabling the row permits
recovery.

Linked Query help explains label, JSON/text and encoding semantics. Existing
editor layout is preserved. Chromium drops a represented-empty query through
the search setter; the composer preserves it through href parsing, including
fragments, existing bare queries and later ordinary rows. No native dependency
change was needed.

## Primary references and saved commands

References consulted before implementation:

- https://spec.openapis.org/oas/v3.2.1.html#parameter-object
- https://spec.openapis.org/oas/v3.2.1.html#extending-support-for-querystring-formats
- https://spec.openapis.org/oas/v3.2.1.html#encoding-by-name
- https://url.spec.whatwg.org/#dom-url-search

Run JavaScript tooling with Bun. Saved browser scenarios use the shared fixed
headless helper. Native scenarios hide their owned host before CDP attachment
and report `native-hidden`.

```powershell
bun run check
bun tests/ui/openapi-querystring-contract.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSION='3.2.1'
bun tests/ui/openapi-querystring.js
$env:INSOMNIUM_OPENAPI_VERSION='3.2.0'
bun tests/ui/openapi-querystring.js
bun tests/ui/url-encoding.js
$env:INSOMNIUM_OPENAPI_VERSION='3.2.1'
bun tests/ui/openapi-query-serialization.js
```

## Accepted evidence

Five application source hashes in
`artifacts/playwright/openapi-querystring-source-freeze.json` match the final
release throughout all accepted native runs. No passing run was restarted.

- Saved headless contract:60 composer controls (14 media definitions across both
  URL/cURL settings, plus four empty-query boundaries) and four malformed
  parameter controls. Direct generation preflight112 across3.2.0/3.2.1,
  boundary7 literal targets/Git7, seven serializer refusals and inheritance4
  (three invalid/one valid override), signing-composition12 and malformed4 pass.
  Compiler has zero errors/warnings; selected formatting and diff checks pass.
- Native3.2.1 handle68209/artifact1791535934518:
  08:52:14.907Z–09:06:10.240Z, terminal0/passed.
- Native3.2.0 handle63902/artifact1791536829429:
  09:07:09.440Z–09:20:56.368Z, terminal0/passed.
  Each version passes25 groups,18 raw targets,7 pre-network refusals,
  14 metadata rows and four linked-help layouts. Independent audits check
  literal wire, persistence/reload and frozen hashes. All eight actual760px
  images were inspected. Native28036/52392 exit0/native-hidden/visiblefalse;
  owned processes/profiles and actual fixtures52539/59515 are released.
- Signing handle23182/artifact1791537744405:
  09:22:24.415Z–10:41:13.227Z, terminal0/passed,
  165 raw targets/158 signatures/8 checks.
  The saved scenario retains78 signatures and adds80 whole-query controls:
  48 JSON/text/form with source queries plus32 represented-empty text/form
  queries, across Hawk SHA1/SHA256 and RFC5849 OAuth1 HMAC-SHA1/SHA256,
  both URL encoding and cURL settings.
  Independent saved-wire audits recompute all80 new signatures (40 Hawk,
  40 OAuth),32 retained ordered-query signatures,4 API-key controls and
  8 legacy OAuth1 refusal/recovery controls. Empty-query Hawk MAC differs from
  absent-query MAC; OAuth canonicalization does not distinguish these.
  Native51072 exit0/native-hidden/visiblefalse; Bun/native/profile processes
  and actual fixture62697 are released.
- Retained named-query3.2.1 handle75394/artifact1791542745015:
  10:45:45.027Z–11:09:57.317Z, terminal0/passed.
  Independent audit verifies33 generated cases/11 edits/5 refusals, two help
  geometries/760px PNG widths and frozen hashes. Both actual PNGs were inspected.
  Generation/selection recoveries0: timeout-recovery branches are not exercised
  by this accepted run. Native51400 exit0/native-hidden/visiblefalse;
  Bun51196/native/profile processes and actual fixture58767 are released.

Artifact paths are under `artifacts/playwright/`. Independent audit filenames:
`independent-querystring-audit.json` in each core native artifact,
`independent-querystring-signing-audit.json` and
`independent-querystring-ordered-regression-audit.json` in the signing artifact,
and `independent-query-audit.json` in the retained named-query artifact.

## Retained failures and harness corrections

The baseline omitted three supported media. Initial direct style-array golden
incorrectly expected whole-array expansion; corrected to the documented3.2
per-item rule without changing product behavior. Initial JSDoc errors were
corrected. The inline preflight's unused settingImportedFromCurl flag was
replaced by actual _curlSource;112 controls reran. Saved browser controls already
used the correct flag.

First release1791534153396 (finished1791534524353/result0) was superseded:
native16916/artifact1791534546737 failed after three supported groups when
empty text lost its trailing `?`. All three available760px images were inspected;
owned host/profile/fixture64801 were released. The saved headless contract
reproduced8 empty-query failures before the href repair. Bun URL behavior alone
did not expose the Chromium bug.

Release1791535131083 (finished1791535500827/result0) was also superseded after
the malformed-null inheritance guard. Its build became terminal before that
source fix. Final release1791535554156 includes both repairs; no acceptance is
claimed for superseded releases.

Retained-query80355/artifact1791542518304 failed before any query group,
10:41:58.316Z–10:42:57.571Z: New document click timed out15s after delivery.
The inspected failure image and exact owned persisted state show one created,
selected default document. Owned Bun34296/native52312/profile/listeners were
released. The saved generation helper now checks one newly created owned spec,
active workspace, selected document, mounted contents and final edited-source
identity. Only a Timeout may recover through those checks; it never clicks
again and records recovery when output is available. Application source was
unchanged. The subsequent accepted75394 run uses this helper's normal path;
its timeout-recovery branch remains unexercised.

## Remaining scope and handoff

Modern Example Object dataValue/serializedValue/external examples, non-UTF8 and
broader media/byte coverage, full schema constraints/precision/refs, saved
generated-resource migration, provider/platform interoperability and every
remaining original PLAN/PARITY migration gate remain required. Subsequent
centralized UX/CSS and redesign follow full migration completion per
POST-MIGRATION-UX.md. This feature is not full parity.

Commit verified work by topic and record the implementation commit, evidence,
remaining gates and live handles in STATUS.md before the next feature.
This interface has no callable `/compact`; provide the committed handoff
instead of claiming compaction. All feature-owned handles are terminal.


</details>

<a id="record-openapi-readonly-sampling"></a>

<details>
<summary>OPENAPI-READONLY-SAMPLING</summary>

# Read-only properties in generated request samples

Verified implementation, saved headless contracts, compiler, fresh production build and focused native acceptance pass. Full migration and UX/UI/CSS scope stays active.

The existing request sampler deliberately uses `skipReadOnly: true`. A required property with `readOnly: true` and a false schema branch nevertheless made the new boolean preparation reject the entire body before that policy could apply. The reproduction is saved in `artifacts/playwright/openapi-readonly-before.json`; the expected generated body contains only the writable `name` property.

Primary references consulted before editing: [OpenAPI 3.2.1 annotation validation](https://spec.openapis.org/oas/v3.2.1.html#validating-readonly-and-writeonly), [JSON Schema 2020-12 metadata 9.4](https://json-schema.org/draft/2020-12/json-schema-validation#section-9.4), and [Redocly sampler](https://github.com/Redocly/openapi-sampler) plus its installed allOf/object traversal. Modern OAS treats direction keywords as annotations; omission here preserves this application's existing request-generation policy, rather than asserting that every modern OAS implementation must strip these fields. Existing dependencies were reused; no subsystem initializer or installation was needed.

Boolean sample preparation now omits read-only properties before evaluating impossible branches and excludes their names from request required lists. Its validator uses the same bounded root/allOf annotation lookup on the expanded reference graph. It follows resolved static/dynamic reference siblings and nested object properties, without treating literal payload keys or annotations under alternatives/not as unconditional property flags. Explicit examples that include a prohibited value still fail their assertions; required writable false properties still require review. No CSS, layout, CSP or dependency change.

The existing saved boolean scenario passes 253 checks: 175 retained and 78 new from 13 cases across three modern versions and direct/worker-style clone paths. New cases cover direct/allOf annotations, false static/dynamic reference siblings, nested requirements, writable false siblings, readOnly:false, alternative/not boundaries, valid omission/invalid explicit values, composed nonboolean properties and literal annotation-shaped data. Existing RequestEditor Settings acknowledgment, static 83, dynamic 75, serialized and named-example regressions pass. Final compiler reports zero errors and warnings.

```powershell
bun tests/ui/openapi-boolean-schema.js
bun tests/ui/openapi-schema-resources.js
bun tests/ui/openapi-dynamic-schema.js
bun tests/ui/openapi-serialized-contract.js
bun tests/ui/openapi-named-examples.js
bun run check
bun tests/ui/build-recovery-copy-probe.js

$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_CASE_SET='readonly'
$env:INSOMNIUM_OPENAPI_VERSION='3.2.1' # then 3.2.0 and 3.1.0 sequentially
bun tests/ui/openapi-boolean-schema-native.js

# Clear the focused selection before the retained legacy scenario.
Remove-Item Env:INSOMNIUM_OPENAPI_CASE_SET
$env:INSOMNIUM_OPENAPI_VERSION='3.0.3'
bun tests/ui/openapi-external-example.js
```

The focused native selection tests 13 Sends/refusals per modern version. The real worker still generates and captures all 47 requests in 3.2.x or 45 in 3.1.0; independent source/body/Git audits inspect all records. Focused Send evidence does not prove every generated operation was sent.

Freeze `artifacts/playwright/openapi-readonly-source-freeze.json` records 465 application and 217 scenario hashes from base a21a205, with four intended changes. Production build session 14976 exited zero (native compiler 59960, start 1791590079335, finish 1791590454226). Executable SHA256 is `a197cae6ad70e43edb8be223a19a5d3cb729239a8dff8188cddf88949eed895b`; fixtureHash alone is not source identity. Application/scenario source stayed unchanged throughout acceptance.

| Version | Actual session (exit zero) | Artifact directory suffix | Generated records | Focused groups | Exact wire | Refusals | Git records |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3.2.1 | 15850 | 1791590482062 | 47 | 13 | 10 | 3 | 95 |
| 3.2.0 | 57396 | 1791590757481 | 47 | 13 | 10 | 3 | 95 |
| 3.1.0 | 45041 | 1791591061253 | 45 | 13 | 10 | 3 | 91 |

All three `openapi-boolean-schema-*` results are passed, native exit zero, `native-hidden` and `hiddenWindow.visible:false`. Their `readonly-independent-audit.json` files reconstruct complete authored source/reference/raw assets, all 139 generated original/durable bodies, all 281 full-field canonical Git records and focused exact wire/refusal results. There are 53 refused records across the full generated data; only nine are selected native refusal controls. The non-UI auditor `artifacts/playwright/openapi-readonly-independent-audit.mjs` uses independently authored literal expectations rather than importing fixture expectations.

Retained 3.0.3 session 20632 exited zero, artifact `openapi-external-example-1791591336257`, native PID 42396 and fixture port 54257. Its independent `readonly-regression-audit.json` passes four exact wire requests, 12 dark/light geometry profiles, four loading controls, four asset-management controls, two worker literal controls, five complete Git records and current source/build identity. Aggregate native scope is 34 exact wires and 286 Git records. The actual light 760x960 request-body images for 3.2.1 and 3.1.0 and dark 760x600 legacy asset-stage image were inspected; this is scoped layout evidence, not full UX acceptance.

`openapi-readonly-headless-audit.json` independently reconstructs 144 body strings, 78 refusal records and 31 other controls (253 total), retaining actual Settings acknowledgment. An initial auditor duplicate-variable error was corrected in the auditor only; no application/scenario correction or native retry was needed. Formatting and `git diff --check` pass. Production build retains existing chunk-size and eventsource-stream warnings; compiler checks have zero errors/warnings.

`openapi-readonly-cleanup-audit.json` confirms native PIDs 60140/49780/56780/42396, their exact WebView profiles and fixture listeners 64499/62793/52980/54257 are absent. No live feature handles remain. `openapi-readonly-final-audit.json` rechecks all 682 frozen source hashes, executable bytes, actual accepted results, aggregate counts and cleanup. These ignored artifacts remain local evidence; saved scenarios/helpers and this document are committed with the implementation.

Root/allOf request-sampling hints are the accepted scope of this implementation. Full instance-dependent annotation collection, conditional/alternative direction semantics, other schema dialects/vocabularies, resource/URI policies, processing budgets and every original migration/provider/platform/storage/plugin/transport/Git/recovery/CI/release/distribution/shared-UI/UX/CSS requirement remain required. Native Git synchronization and OS-close lifecycle are not proven by this topic. Record the actual topic commit and handoff in STATUS.md; this interface cannot invoke `/compact`, so no command-driven compaction is claimed.


</details>

<a id="record-openapi-schema-resources"></a>

<details>
<summary>OPENAPI-SCHEMA-RESOURCES</summary>

# Static schema resource identities

2026-10-10 follow-up: dynamic target selection for generated samples is implemented and verified in [API-DESIGN.md#record-openapi-dynamic-schema](API-DESIGN.md#record-openapi-dynamic-schema). The dynamic refusal below describes the prior static-only checkpoint. Full schema validation and the other documented parity gates remain open.

Canonical schema$id and scoped anchors now drive generated request samples, including schemas in attached files. Implementation, headless and fresh four-version native acceptance pass. Full migration/UX/CSS remains active; dynamic-scope reference evaluation is required next and explicitly refused until supported.

Native attempt1 uses normal-hook fixed-CRUD candidate artifacts/native-resource-crud-audit-probe/api-import-drain (build72767 terminal0/Rust6m42; executable SHA1aa4a6fb29d60b9129ce4f129be7a473294f64a99679db45813a19fe6bd92f31). A direct standalone preflight correctly refuses an unbound producer PATH before launching any host; runtime uses the maintained namespaceBuildEnvironment bootstrap. Native74356/receipt1792013703175 fails while waiting for the invoke observer to trigger drain; its changed workspace retains the actual imported document, not a passing drain proof. Host17300 exits0/native-hidden; restoration1792013702965 and independent currentf0/d8 hashes are exact. Post-failure fullsource closure47270 passes. The corrected observer uses the existing native Spectral fetch pattern, submits unchanged IPC first and observes the actual response without a gate/delay; the original failed receipt remains immutable. Native claims will remain limited to submitted IPC acknowledgement/callback ordering, distinct from physical write contention, OS picker dialog, timeout/OS-close and all-platform acceptance.
Native acceptance at scenario commit2e04de6/production9638705: normal-hook build83118 at artifacts/native-resource-crud-audit-probe/api-import-drain-attempt-2 finishes0/Rust6m41; executable SHA83e8a3a296bdc8cb6daa79e6b484c92ed60549a4fa15a61529cb7943003af66b. Runtime54964/receipt1792014602828 passes all3 document/reference/binary-example FilePicker callbacks. Each records unchanged native IPC submission, real drain/edit refusal, actual Tauri-Response:ok, then drain callback/completion. No mock, acknowledgment gate or added delay. Complete durable data equals accepted resources/history/settings/selection; original resources/settings/history remain exact. Binary bytes [0,255,13,10,128] and independent hash match. Import-only scope observes0 Worker constructions; it does not verify validation/generation worker loading.

The actual mounted fixture shares one compiled workspace singleton, preserves genuine Rust IPC, binds every emitted IIFE/CSS asset and unmounts through Svelte before restoring transport/shell/storage. Inspector-delivered fixture code adds no inline-script CSP permission; this is not a claim that fixture assets were embedded in production frontend. Native host30484 exits0/native-hidden. Restoration1792014602612 rehashes exact originalf0/d8 buffers and protected inventory, with two actual registered owned collections, no cleanup errors. Root independently confirms no owned host/WebView remains. Full post-native source closure54964 is terminal0; compiler97971 passes0/0, focused controls and full spectral-api-design-native-fetch-adapter-full-regression (15272) pass. Independent read-only audit validates emitted hashes, changed/original buffers, actual IDs and binary data. Physical disk contention, OS file-dialog automation, timeout refusal, OS-close, universal worker/process births and broader platform/provider acceptance remain required.

Native command: set INSOMNIUM_API_IMPORT_NATIVE=1 and exact INSOMNIUM_UI_BUILD_STATE/INSOMNIUM_UI_PROFILE_OWNERSHIP for the fresh fixed CRUD candidate, then run the saved entry under the maintained namespaceBuildEnvironment bootstrap. Normal builder and ownership reconstruction commands remain tests/ui/build-resource-crud-probe.js and tests/ui/helpers/native-profile-ownership.js --reconstruct; use a fresh candidate/marker and retained raw ownership proofs, not a fabricated initial absence.
Official references consulted:

- [JSON Schema2020-12 core8.2/9.2](https://json-schema.org/draft/2020-12/json-schema-core#section-8.2)
- [OAS3.2.1 Schema Object](https://spec.openapis.org/oas/v3.2.1.html#schema-object) and AppendixF
- [Official OAS dialect iterations](https://spec.openapis.org/oas/)
- Installed Scalar README/source for its documented filesystem dereference API.

No new dependency or generator. The old canonical lookup failure is retained in artifacts/playwright/openapi-schema-resource-before.json.

Typed traversal registers static resources and plain anchors, inherits relative schema bases, discovers detached typed fragments to a fixed point, and translates targets into Scalar's filesystem. Anchors are scoped to the nearest resource; $dynamicAnchor can be used by static$ref. JSON Pointer own-property lookup rejects inherited targets before Scalar. Literal identifiers are not indexed in ordinary payload/default/extension positions, and literal$ref member protection remains. Document source is not rewritten.

Current policy reports errors for unknown resource dialects, duplicate IDs/anchors, document/schema identity collisions, malformed declarations, missing/nonobject targets and dynamic refs. This does not classify every refused document as normatively invalid. Boolean schema references, dynamic scope, other drafts/dialects, unknown vocabulary indexing, rare reserved-fragment pointer spellings and broader URI/fragment/identity policies remain required before full schema/reference parity. Supported static core dialects: JSON Schema2020-12 and published OAS3.1 base/2024-10-25/2024-11-10 plus OAS3.2 2025-09-17/2026-02-26.100discovery passes and prior200000node/depth100 per-file/8MiB snapshots remain. No full schema evaluation/compliance claim.

```powershell
bun tests/ui/openapi-schema-resources.js
bun tests/ui/openapi-serialized-contract.js
bun tests/ui/openapi-named-examples.js
bun run check
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSION='3.2.1'
bun tests/ui/openapi-external-example.js
```

Repeat the saved native scenario for3.2.0/3.1.0/3.0.3. Modern versions add two schema sends to four retained literal/byte groups;3.0.3 retains four groups.

83controlled headless checks (46positive/37negative) pass. Includes canonical/nested/attached/retrieval/recursive/escaped/ref-named/scoped/static-dynamic-anchor/literal/dialect cases and refusal boundaries. Retained8byte/68controls,168serialized/11controls/8signing/editor/body-Git and named108/28/6 pass. Initial helper14implicit-JSDoc errors corrected; final compiler0errors0warnings. Target caching before protection retains pointer-named$ref; normalized schemaOrArray roles prevent repeated relative$id; explicit empty fragment permits Scalar standalone-root recursive refs. Initial inline native auditor brace syntax failed before execution; corrected command passed without source edits.

Source freeze openapi-schema-resource-source-freeze.json records463app/209scenario raw hashes/baseabbe3ae. Fresh production build70362 actualterminal0/native58376/start1791582005332/finish1791582380613. All672 hashes unchanged through build/native acceptance. Executable SHA330f5d2b38b095042d8133f759e6337df9612b4260298fad941b9c2ceb669262 is bound in freeze/openapi-schema-resource-build.json. Fixture hash alone is not app identity. Existing chunk/dependency warnings; no build failure.

Native runs (all actualterminal0/resultpassed/native-hidden/visible:false):

- 3.2.1: handle3242, artifact1791582396641, native48300, fixture59361, 6wire groups.
- 3.2.0: handle55151, artifact1791582634895, native39272, fixture63604, 6wire groups.
- 3.1.0: handle18428, artifact1791582857516, native51624, fixture62428, 6wire groups.
- 3.0.3: handle20808, artifact1791583079137, native60476, fixture58144, 4wire groups.

Aggregate22wire/6new schema groups/48layout profiles/16loading controls/16management actions/8worker literal checks. Independent audits reconstruct exact body bytes/member order, complete authored main/reference documents, root/attached schema resource IDs/dialects, full-field canonical Git and current672/build/executable identity. Headless audit independently reconstructs83expected samples/refusals. Final aggregate audit and fresh owned process/profile/listener cleanup pass. No live feature handles.

Actual3.2.1light760x600,3.2.0dark760x960,3.1.0dark760x600,3.0.3light760x960 images inspected. Bounded setup geometry/focus profiles remain usable; no arbitrary viewport/full UI/OS-close/platform acceptance claim. No CSS changes.

Artifacts: openapi-schema-resource-source-freeze.json, openapi-schema-resource-build.json, openapi-schema-resource-headless-audit.json, openapi-schema-resource-final-audit.json, openapi-schema-resource-cleanup-audit.json and per-run schema-independent-audit.json/schema-cleanup-audit.json. Formatting/whitespace checks pass. Commit and checkpoint by topic; /compact is not callable, no compaction claimed. Every original migration/provider/platform/UX/CSS and remaining schema/dynamic/resource gate stays required.


</details>

<a id="record-openapi-self-base"></a>

<details>
<summary>OPENAPI-SELF-BASE</summary>

# OpenAPI3.2 declared document bases

Implementation, headless checks and fresh native acceptance pass.
Full migration and UX/CSS remain active.

[OpenAPI3.2.1 document identity](https://spec.openapis.org/oas/v3.2.1.html#openapi-object)
and [base URI rules](https://spec.openapis.org/oas/v3.2.1.html#establishing-the-base-uri)
require API-description references to use the declared $self when present.
Relative declarations resolve against the containing document URI.

Before this fix, a specification retrieved as https://retrieval.example/api.yaml
with $self:https://canonical.example/docs/api.yaml and externalValue:bytes.bin
looked up https://retrieval.example/bytes.bin. The asset attached as
https://canonical.example/docs/bytes.bin was missed. Retained reproduction:
artifacts/playwright/openapi-self-base-before.json.

Description filesystem identities now use the root OpenAPI3.2 $self. Attached
complete OpenAPI documents also use their own declarations; fragmentary objects
retain their attachment URI. Reference preparation and typed external-example
binding share those identities. Canonical document collisions refuse instead
of ambiguously choosing a document. API server URL handling is separate.

Root-relative example attachment names and asset refresh use the same declared
base as externalValue. Invalid/incomplete source can still prepare attachments
using its filename base; analysis must successfully parse/validate it before
generation. Non-OpenAPI literal $self fields do not alter document identity.
Source text and attached file text are preserved.

```powershell
bun run check
bun tests/ui/openapi-serialized-contract.js
bun tests/ui/build-recovery-copy-probe.js
```

Compiler0errors0warnings and headless8byte checks/44controls pass, retaining
168serialized checks/11controls/8signing controls plus mounted editor/body-Git.
14new controls cover both3.2.0/3.2.1 absolute/relative root declarations, attached
documents with absolute/relative declarations, incorrect retrieval-base shadow
bytes, canonical identity collisions, asset refresh, incomplete author source
and literal roles. Retained named108checks/28controls/6profiles also pass; independent
openapi-self-headless-audit.json verifies current668 hashes and exact base literals.
Initial inline reproduction brace syntax was corrected
before collecting evidence; no mutation occurred from that failed command.

The existing saved native external scenario now uses a root declaration,
an attached complete OpenAPI document with a distinct relative $self, and
relative external values from that referenced document. It retains actual
local/HTTP attachments, three request groups, loading/management controls,
bounded source/preview geometry, typed worker literals, source/ref persistence
and reload. Acceptance must use a freshly built frozen source release.

openapi-self-source-freeze.json records462app/206scenario raw-byte hashes at
base7e47a68. Fresh production probe handle64344 reached actualterminal0,
started1791577573621/finished1791577948614/native52888/fixtureHash9384957238430302815.
Executable SHA-256 ad385f02e704915d43b5411246d3f99444c5ac763e5544a9a91737bb414630b6.
All668 source hashes matched after build. Native3.2.1 handle66175/artifact1791577977014 reached actualterminal0,
native21416exit0/native-hidden/visible:false, finished20:36:13.224Z. Independent
self-independent-audit.json passes3wire groups/4loading/4management/2worker literal/
12layout profiles/source/ref/canonical Git and current668/executable identity.
Owned21416/profile/listener60827 absent; self-cleanup-audit.json passedtrue.
Actual light760x600 image inspected; no arbitrary viewport/platform claim.
Native3.2.0 handle64918/artifact1791578201212 also reached actualterminal0,
native18244exit0/native-hidden/visible:false, finished20:39:55.097Z. Same3wire groups,
12layout profiles/4loading/4management/2worker literals/source/ref/canonical Git and
current668/executable audit pass. Owned18244/profile/listener61848 absent. Actual
dark760x960 image inspected. Both handles terminal0; no live feature handles.
Aggregate openapi-self-final-audit.json passedtrue combines6groups24layout profiles,
8loading8management4worker literals plus headless/source/build/Git/wire audits.
Fresh read-only aggregate cleanup returns0owned/0profiles/0listeners. No app/scenario
edits during build/acceptance. Do not reuse previous native build59214 for this
application change.

Still required: schema $id/anchors/dynamic
references, broader URI/fragment/charset/resource policies, nonUTF8/all parameter
locations and all original provider/platform/migration/UX/CSS gates. This does
not prove full URI/OpenAPI interoperability. /compact is unavailable in this
interface; STATUS records exact live handles and next steps.


</details>

<a id="record-openapi-serialized-example"></a>

<details>
<summary>OPENAPI-SERIALIZED-EXAMPLE</summary>

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


</details>

<a id="record-openapi-text-content"></a>

<details>
<summary>OPENAPI-TEXT-CONTENT</summary>

# UTF-8 text content parameters

Verified, 2026-10-09. Scalar UTF-8 text content parameter coverage, cookie regression and URL signing are accepted on the same frozen production build. Implementation topic b02386b and supporting helper e5b4cbb are committed; STATUS records the verified handoff. Full migration/UX/CSS remains incomplete.

## Behavior

Scalar text/plain content parameters now work in query, header, path and cookie. Legal MIME case and one UTF-8 charset retain their original media string. Existing application UTF-8 behavior for absent charset is preserved. Explicit non-UTF8, malformed/list/duplicate media and text compounds require review; byte encoders and arbitrary media representations remain outstanding.

Nullable editor values use JSON representation, keeping strings, null, false and zero distinct. Text strings serialize without JSON quotes. Nullable null omits query/header/cookie and substitutes an empty path value under the existing omission policy; JSON content still represents JSON null. Nonnullable raw inputs preserve literal null, empty strings and explicitly quoted text. Edited numeric/exponent lexemes remain exact. Query/path encode URI data; header controls and invalid Cookie octets are refused before network activity. Cookie content has no automatic quoting or URI encoding.

New canonical text cookies retain content style and original media metadata. Persisted old text/plain cookie style remains supported; saved resources are not automatically migrated. Shared editor help describes raw versus nullable text encoding. App layout and CSS remain unchanged.

## Official references

- [OpenAPI content parameters](https://spec.openapis.org/oas/v3.2.1.html#fixed-fields-for-use-with-content): selected media representation, separate from schema style expansion.
- [HTTP field values](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.5): header character constraints.
- [Cookie syntax](https://www.rfc-editor.org/rfc/rfc6265.html#section-4.1.1): Cookie octets and explicit quoted values.
- [Playwright locator click](https://playwright.dev/docs/api/class-locator#locator-click) and [actionability](https://playwright.dev/docs/actionability): bounded Import completion with normal actionability checks.

## Accepted verification

- Fresh production release: build1791510352616, finished1791510732643, result0, fixtureHash12278268661298828977, production release profile. Build25432 terminal0; app source remained frozen through native verification. Build record: artifacts/native-recovery-copy-probe/build-state.json.
- Main artifact openapi-content-serialization-1791510748915: handle18882 terminal0/passed; independent-audit.json accepts295 groups:208 generated (52 per3.0.3/3.0.4/3.1.2/3.2.1),19 reviewed refusals,19 disabled-row recovery,4 scalar edits/help,4 exact numeric edits and41 retained JSON/runtime controls. Native37876 exit0/native-hidden/visiblefalse; owned processes/profile and listener52427 released. Four actual light760 parameter images inspected.
- Raw supplement openapi-content-serialization-1791516439448: handle63710 terminal0/passed, started03:27:19.462Z/finished03:41:51.091Z. Independent-audit.json accepts28 groups:16 generated (four raw cases per four versions), plus12 literal-null/empty/quoted edits with help/persistence/reload checks. Native50412 exit0/native-hidden/visiblefalse; scenario5708/owned native/profile process count0, listener58324 count0. All four raw light760 images inspected: complete help and aligned controls.
- Combined295+28 proves323 focused text groups. Generated cases cover all four versions; edit/review/disable runtime controls run once on the last version3.2.1. It does not prove each runtime control per version or unfiltered all-content/native-dark/platform acceptance. The main run loaded the pre-extension52text/118total fixture; its source hashes remain in loaded-source.json. It was neither restarted nor narrowed after adding the raw supplement.
- Current fixture122total/56text. Inline488 generated compositions pass376accepted112refused (text148accepted76refused), including runtime refusal after clearing request-level review. Git488 preserves complete parameter fields. Artifacts: openapi-text-content-inline.json and openapi-text-content-git.json under artifacts/playwright.
- Inline form/cookie regression252 passes201accepted51refused (195form57cookie), including new canonical cookie metadata. Direct48 controls cover compounds with review removed, MIME refusal, nullable versus literal-null, finite/exact numeric lexemes, Unicode URI goldens, header controls and old cookie style. Raw-edit48 comparisons cover four locations × four versions × three raw values. Artifacts: openapi-text-content-regression.json, openapi-text-content-direct.json, openapi-text-content-raw-edits.json.
- Saved design-system final44605 terminal0/passed:78 measured rows,13 per six dark/light1440/900/760 profiles. All four individual text-help dark/light760 row11/12 images inspected. Whole-region images can clip rows through the existing scroll container and are not evidence for unseen content. Shared browser launcher is fixed headless:true; native results use native-hidden.
- Latest bun run check terminal0:0errors0warnings after the URL Import persistence repair; earlier93523 also passed after the raw reload fix. Selected formatting/diff checks passed. Inventory sourceHashbfd7776bb65b7a506d706c6ded5703a158c1266e6063a9732b10ba5ad076c79e,663markup118tokens1719CSS declarations; no CSS change.

## Retained failures and corrections

Artifact1791515042339 failed at Import click15s before API Design/source generation. The owned workspace was persisted/selected, but source count0 proves no raw acceptance. Failure image inspected; native52324 exit0 and owned processes released. Shared generation helper now bounds only Import/dialog completion at60s, verifies the exact owned selected workspace, and scopes source persistence to that parent. No force, repeated click or blanket timeout expansion.

Artifact1791515819305 failed at the next raw Value1 fill15s after reload restored the default Body tab. Failure screenshot showed the selected query request and200 response with Body active. Native47980 exited0 and owned scenario/profile released; that PID was briefly reused by a compiler Bun process. The saved scenario now reselects the request and opens Query/Headers before each raw edit. The full corrected28-group retry supersedes this failure without reducing coverage or changing app source/build.

Initial compiler2 nullable-return errors and9 test-only JSDoc errors were fixed before accepted checks. Inline harness initially used the wrong analyzeSpec argument, omitted defaults and compared Cookie name case; corrected harnesses passed. Older472 inline/Git results (360accepted112refused;text132accepted76refused) are archived as .before-raw.json and are superseded by488. Intermediate headless16849/67741 passed;44605 provides the final individual help images.

URL failures are retained:1791518724482 failed Import click15s before wire acceptance (native44004/listener63816 released);1791518869751 passed Import but failed a redundant baseline click after reload (native51488/listener62767 released);1791519043761 failed the same redundant click in the signed loop after recording partial wire progress (native54068/listener55455 released). All native exits0/native-hidden/visiblefalse and all failure images were inspected. No partial run is treated as53/50 acceptance.

Saved URL Import now bounds only click/dialog completion at60s and checks the exact selected owned workspace/51request persistence. Its shared request selection function asserts method, persisted activeRequestId and rendered active row before/after reload for baseline and every signed case; real selection changes use normal clicks. No force/global timeout or coverage reduction. The older plain-query golden applies only to original cases; new text cases retain their full literal golden and all cryptographic checks. Formatting and compiler0/0 pass.

## Commands and remaining migration gates

Cookie regression22171 is terminal0/passed: artifact openapi-cookie-serialization-1791517344223 independently accepts55 groups:45generated (12/12/21),4edits and6jar/composition. Canonical text metadata assertions run for four cases per version. ownedJarRestored:true; native51412 exit0/native-hidden/visiblefalse; owned process/profile count0 and listener50074 count0.

URL artifact1791519298954/handle77518 is terminal0/passed:53 raw targets,50 independent runtime signature cases and5 retained checks. The independent artifact audit verifies counts, all four text-query targets and modes, and recomputes four OAuth1 HMAC-SHA1/SHA256 signatures from saved owned wire headers; modified messages produce different MACs. Native42636 exit0/native-hidden/visiblefalse; owned processes/profile and fixture listener55826 counts0. Exact start04:14:58.965Z/finish04:35:46.629Z. The four text cases retain Unicode, duplicate key, false and nullable omission goldens. Original signing regressions remain intact.

The URL golden records current ordinary-before-generated query order. This feature does not fix that transport order. Mixed manual/generated row-order preservation is REQUIRED in PARITY, alongside every original full migration gate.

PowerShell commands (run native scenarios sequentially):

    $env:INSOMNIUM_UI_BUILD_STATE="artifacts/native-recovery-copy-probe/build-state.json"
    $env:INSOMNIUM_OPENAPI_VERSIONS="3.0.3,3.0.4,3.1.2,3.2.1"
    $env:INSOMNIUM_OPENAPI_CONTENT_KIND="text" # accepted main fixture revision
    bun tests/ui/openapi-content-serialization.js
    $env:INSOMNIUM_OPENAPI_CONTENT_KIND="raw-text" # accepted supplemental revision
    bun tests/ui/openapi-content-serialization.js
    bun tests/ui/openapi-cookie-serialization.js
    bun tests/ui/url-encoding.js

The current focused text selection alone plans323 groups; raw-text selects28 and skips repeating already accepted41 JSON/46 nullable controls. Retained all|text|raw-text|json selectors and version selection do not replace the default all-content coverage.

Verified work is committed by topic after the final evidence audit; STATUS records commit, proof, remaining gates and no live feature handles. This interface has no callable /compact; provide the committed handoff and explicitly report the limitation before another feature. Every original PLAN/PARITY migration/media/schema/provider/saved-resource/platform/recovery/distribution/UX/CSS gate remains required. Non-UTF8 byte encoding, arbitrary media and text compounds, provider interoperability, saved-resource policy and schema validation remain outstanding. Hoppscotch-inspired redesign follows full migration; this feature preserves the current Insomnium UI.


</details>

<a id="record-openapi-text-form-media"></a>

<details>
<summary>OPENAPI-TEXT-FORM-MEDIA</summary>

# Plain-text media in form content fields

Encoding Object fields previously accepted only exact text/plain. Legal case and
UTF-8 parameter variants were review gated. Form generation and runtime now share
validated text/plain recognition; original media strings remain in row metadata
and help. Scalar text keeps its unquoted representation, arrays retain repeated
item fields, and empty arrays/nullable text retain existing omission behavior.

The media parser now exposes validated, unescaped parameters. Media names and
JSON body recognition remain equivalent to the previous implementation. Text
charset names match case-insensitively; absent charset preserves existing form
UTF-8 behavior. One explicit UTF-8 charset is accepted. Other/duplicate charsets,
malformed media, lists, compound text values and legacy binary schemas retain
review/runtime guards. Non-UTF8 byte encoding remains a required separate gate.
This feature does not add text content parameters at other locations, body-media
selection, general media semantics or saved generated-resource rewriting.

## Primary references

- [RFC9110 media types and parameters](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.1)
- [OAS3.0.4 Encoding Object](https://spec.openapis.org/oas/v3.0.4.html#encoding-object)
- [OAS3.1.2 Encoding Object](https://spec.openapis.org/oas/v3.1.2.html#encoding-object)
- [OAS3.2.1 encoding by name](https://spec.openapis.org/oas/v3.2.1.html#encoding-by-name)

UTF-8 form behavior is the existing application convention. This does not claim
that every text media type defaults to UTF-8 or that text/plain registration
parameters can be ignored as application/json parameters can.

## Verified evidence — 2026-10-09

Base1597c8b/topicbd1cafe. Baseline openapi-text-form-baseline.json demonstrates
three valid variants refused while canonical text/plain sends color=a+%2B.
Compiler0errors0warnings passes after final fixture/scenario changes.
openapi-text-form-inline.json passes539 generation/wire/full-field Git cases
(195form264parameters80JSONbody),72 refusals and4 edited text-array lexical
controls across3.0.3/3.0.4/3.1.2/3.2.1. Large integer/exponent spelling survives;
string JSON escapes decode to the represented text. Non-finite text-number
validation remains enforced.
openapi-text-form-parser.json passes100 media-name and100 JSON-body comparisons
against HEAD,12 text controls,3 direct runtime charset guards,1 nullable omission
and1 legacy binary guard. An initial test fixture used edit instead of editText;
corrected before acceptance. An invalid patch hunk was rejected before applying;
the corrected patch applied successfully.
openapi-text-form-metadata.json independently checks original media and review
flags for all40 new generated text-media cases across four versions.
openapi-text-form-long-parser.json passes a65536-character quoted parameter and
a dangling-escape refusal. These controls do not prove arbitrary input budgets.

Saved form-body now accepts an optional case prefix for reproducible focused
feature acceptance. All fixture operations are generated; selection limits the
main acceptance loop, and existing edited/refusal/disable runtime controls still
run. Artifacts record casePrefix explicitly. Unfiltered full-scenario evidence
must not be inferred from a focused run. New text-media cases add64 groups to the
historical208 full scenario; focused text-media acceptance expects100 actual
groups25 per version, including lexical edits and request-review refusal/disable
controls. Both planned counts must be checked against actual artifacts.

```powershell
bun run check
bun tests/ui/design-system.js
bun scripts/ui-inventory.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_CASE_PREFIX='text-media-'
bun tests/ui/openapi-form-body.js
Remove-Item Env:INSOMNIUM_OPENAPI_CASE_PREFIX
bun tests/ui/url-encoding.js
```

Headless design-system33163 completed terminal0/result passed; independently
audited66 help rows (11×6 profiles), including original parameterized text media.
Source inventory14451fa109a1588659898b5f8f50466afdf4d5c09230cb530f773aec8d34b9cb
retains663 markup sites118 tokens1719 CSS declarations. Selected format/diff pass.
Fresh build68090 completed terminal0, release1791506667570/finished1791507034333/
result0/fixtureHash18324578121437904848. Focused native form43995 completed
terminal0/passed: artifact1791507041545/casePrefix=text-media- has100 actual groups,
25 per version. Independent audit checks40 selected fixture rows,20 reviewed
refusals,20 disable recoveries,4 lexical edits and36 retained runtime controls.
Native44688 exit0/native-hidden/visiblefalse; qualified native/profile processes
and listener59844 counts0. All4 quoted text-media760 images inspected. This proves
focused acceptance, not the unfiltered272-group scenario. Signing88453 completed
terminal0/passed: artifact1791508848934 has49 raw targets46 independently verified
signatures5 checks, including4 text-content HMAC-SHA1/SHA256 legacy/standard cases.
Native52940 exit0/native-hidden/visiblefalse; scenario50272/native/profile processes
and listener53164 counts0. Final feature-owned process/listener audits0. No live
build/headless/form/signing handles remain. Production source stayed frozen.
Saved URL/signing now adds4 parameterized UTF-8 text-array controls with independent
literal raw bodies (Unicode, number, boolean and duplicate manual field), covering
OAuth1 HMAC-SHA1/SHA256 in legacy/standard modes. Actual49 raw targets46 independent
signatures passed fresh native acceptance. Compiler after this saved-scenario
change passes0errors0warnings; production source remains frozen.
Production source must stay frozen during native acceptance. All browser launches
use the shared fixed headless helper; native hosts hide before CDP and report
native-hidden. Preserve existing UI/layout; no CSS/backend/dependency change.
Every original PLAN/PARITY migration/UX gate remains required, including older
text-array/provider interoperability, non-UTF8, all locations/media/ranges/lists,
saved-resource policy, schemas/precision/refs/Swagger/binary/base64 and broader
TLS/Git/storage/CI/release/desktop/platform/UX-CSS gates. No full completion claim.


</details>

<a id="record-spectral-client"></a>

<details>
<summary>SPECTRAL-CLIENT</summary>

# Owned frontend Spectral client

`src/lib/spectral-client.js` uses the documented [Tauri command API](https://v2.tauri.app/develop/calling-rust/) and the installed `@tauri-apps/api/core` invoke/isTauri implementation. JavaScript sends only the captured workspace/spec identifiers, opaque source JSON and registered Git binding. Native commands choose executable, repository root, ruleset and server UUID.

The client reserves before RUN. Abort before admission creates no reservation; abort during reserve waits for its UUID and retires the pending reservation without starting RUN. Abort during RUN immediately requests CANCEL, but the result promise waits for RUN and CANCEL settlement. The component must keep its workspace work registered until this promise settles; a signal event alone is not completion. Late successful replies after abort are refused. Separate jobs share no mutable cancellation state.

Native manager/process acceptance remains required to prove the physical guarantees behind command settlement. The browser preview has no implicit alternate engine. Source-catalog validation, same-workspace/source/repository generation acceptance and the Generate gate belong to the parent integration. No arbitrary repository paths, worker budgets, permissions or CSP changes are introduced.

Result JSON remains opaque across Rust IPC, preserving Unicode including lone surrogates. The client checks UUID identity, bounded result bytes and top-level diagnostic/catalog/ruleset/fallback shape; the accepted catalog layer validates sources. Backend failures map to fixed messages without raw native/spec content.

## Verified component checkpoint — 2026-10-12

Thirteen manual Bun --eval cases exercise detached binding capture, raw severities/code0/fullrange/lone surrogate, preabort, reserve-in-flight abort, RUN abort with late success/latecancel:false, owned sanitized CANCEL rejection while RUN stays pending, malformed UUID/JSON/ruleset/reply identity, inner UUID isolation, desktop unavailable, RUN capacity refusal with pending reservation retirement, and exact independent two-job cancellation. Final source/receipt: artifacts/spectral-client-proof/final. Compiler81104 terminal0errors/0warnings. No new tracked test script. Initial Bun --eval stdin dash invocation refused before code ran; corrected to an explicit PowerShell here-string argument. Earlier11-case/source proof remains immutable. Native and actual Spectral host were not used; process settlement guarantees remain pending native acceptance. Native replay exposes descendant-process object signaling gap; ActiveProcesses0 alone is insufficient. Parent/source/repository generation integration remains open. Root handles terminal; agent executor/packaging/source work continues. /compact unavailable; explicit handoff.


</details>

<a id="record-spectral-host-design"></a>

<details>
<summary>SPECTRAL-HOST-DESIGN</summary>

# Spectral host direction and measured gates — 2026-10-12

Develop an owned Bun linter host for the complete desktop Spectral integration. The browser CSP stays unchanged. This is an implementation direction backed by the measurements below; no host command, application dependency, sidecar packaging or frontend integration has been adopted yet. Structural validation and every original semantic/custom-rule parity requirement remain active.

## Actual executable evidence

The ignored `artifacts/spectral-host-spike` package pins core1.24.0, parsers1.0.5, rulesets1.23.0, ruleset-bundler1.8.0 and ref-resolver1.0.5. Bun1.4.2 is the actual compiler/runtime. Root application package.json/bun.lock and production CSP remain unchanged.

An actual Windows x64 executable runs from a fresh temporary directory containing only the executable and owned fixture files. Its size is 93,478,400 bytes. Default semantic diagnostics return six expected findings. Custom YAML inheritance, local JS ruleset imports, validated function options, an async custom function and resolved-file diagnostic ranges produce ten findings; the complete custom result exactly matches the unbundled official API as parsed JSON in the same source context.

Twelve terminal successful executions cover default/custom, unbundled comparison, invalid custom-loader fallback to the same default diagnostics, actual loopback HTTP reference and ruleset inheritance requests, missing-file reference diagnostics, malformed YAML parser diagnostics, OAS3.0.3/3.1.0/3.2.0, Swagger2.0 and a fresh job after cancellation. The version cases demonstrate real invocation and operation diagnostics for those sample documents, not exhaustive dialect conformance. Actual HTTP requests are recorded for `/base.yaml` and `/shared.yaml`; external diagnostic source/range and error severity are checked.

A separate owned infinite custom function emits an entry marker before entering its loop. The parent observes that marker, kills the actual child, waits for terminal143 and records empty result output. A fresh custom job then reproduces the original result. This proves termination of this single owned executable operation on Windows. It does not prove native Tauri cancellation, process-tree cleanup, memory limits or arbitrary custom child-process cleanup.

Measured successful standalone job times are about368–507ms in this environment. The executable adds about89MiB before installer compression. These are material packaging/startup tradeoffs; cross-platform release and signing remain unverified.

`artifacts/spectral-host-spike/proof/manifest.json` independently freezes/rehashes5,939 source/package/lock/result inputs and binds the actual executable and isolated runtime fixture bytes. All measurement children and loopback server are terminal. Native bb75 browser acceptance is a separate generation and does not contain Spectral.

## Failures retained and corrected

- Initial direct Bun compilation refuses optional macOS `fsevents`. The probe excludes that optional Rollup watch dependency; it never starts watch mode. This is not proof of macOS compatibility.
- Direct compiled JSONC UMD fails dynamic `./impl/format` resolution. A documented Bun `onResolve` plugin selects the same package's published ESM entry. Dependency files are unchanged.
- The ordinary node ruleset-loader preset leaves Spectral package imports external in generated ruleset code. The compiled executable cannot resolve those package imports as physical package files. The package's exported `plugins/builtins` plugin, passed to its public loader plugin argument, supplies the already embedded official modules. Valid custom rules then run successfully; invalid custom loading still falls back.
- One orchestration attempt incorrectly passed input to FileSink.end rather than write; its empty-input EOF failures are retained separately. Later measurements write the request and then close stdin.
- The first isolated-fixture copy omitted hidden `.spectral.yaml`; that ENOENT failure is preserved. The final copy includes hidden files and uses a new output directory. No missing-input failure was relabeled as custom-rule acceptance.

Earlier browser UMD/environment/Ajv-CSP failures remain immutable under `spectral-browser-spike`. The native host direction does not weaken browser script policy.

## Production implementation sequence

1. Build and package a pinned target-specific executable through Bun. Follow [Bun standalone executable](https://bun.sh/docs/bundler/executables) and [plugin API](https://bun.sh/docs/bundler/plugins) contracts, plus [Tauri external binary packaging](https://v2.tauri.app/develop/sidecar/) target-triple naming. Verify installation paths, app shutdown, signing/update/resource layout and supported platform/runtime artifacts. Disable implicit dotenv/bunfig loading; hide the Windows host. Do not expose a general shell command to the frontend.
2. Implement a Rust-owned job lifecycle with closed commands and validated source/collection/repository association. Enforce input/output limits before accumulation, bounded concurrent jobs and deadlines. Drain streams without deadlock. Cancellation, workspace change, disposal and app exit must kill and physically reap the owned operation before releasing its job; define and verify process-tree handling for custom functions that create children. The prototype's post-read8MiB check and kill143 alone are insufficient production guarantees.
3. Preserve `ApiDesign.svelte`'s current source snapshot, beginWorkspaceWork lifecycle,15-second deadline, cancellation and stale-output refusal. Existing structural/request-generation worker remains authoritative for those behaviors. Join semantic results with the same current input; an old spec/result must never update a new selection or save resources. No redesign or new implementation-detail UI flow.
4. Run actual Spectral `Document` diagnostics with severity/code/message/source/range mapping and source navigation. Keep in-memory document/attached-reference data private and avoid plaintext staging of private specs. Retain32attached-files/8MiB and2MiB document bounds. Define resolver precedence between attached files, owning Git working tree and remote references; preserve current structural reference/generation behavior.
5. Resolve the owning registered Git repository before loading `other/.spectral.yaml`; do not accept arbitrary repository paths from a frontend job. Preserve legacy custom-loader failure fallback, functions/options/inheritance/local JS and file/remote resolution. Verify third-party module loading and custom-function logging/result framing; the four owned custom rules are not exhaustive custom API parity. Do not mistake process separation for a sandbox.
6. Verify the complete behavior using reusable saved headless/native-hidden scenarios: semantic findings/source clicks, Git rule edits/round-trip/fallback, reference resolution, private data preservation, cancellation of an actually entered job, deadline/close/replacement/source change, no stale diagnostics, exact profile restoration and packaged release execution. Keep full migration/Spectral marked incomplete until these gates pass.

The current code locations are `src/lib/components/ApiDesign.svelte`, `src/lib/openapi.worker.js`, `src/lib/openapi.js`, `src/lib/openapi-references.js` and native Git bindings. `src-tauri/src/git_remote_job.rs` provides an existing bounded child/reap pattern, including Windows CREATE_NO_WINDOW; it is read-only reference, not proof of a Spectral implementation.

Official API/function contracts: [Spectral JavaScript API](https://github.com/stoplightio/spectral/blob/develop/docs/guides/3-javascript.md), [custom functions](https://github.com/stoplightio/spectral/blob/develop/docs/guides/5-custom-functions.md). Published package exports and actual installed implementation are frozen in the proof.

Commands, inside the isolated package: `bun install --ignore-scripts`; `bun bundle.js`; `bun build host-esm-bundle.js --compile --external fsevents --no-compile-autoload-dotenv --no-compile-autoload-bunfig --outfile spectral-host-final-probe.exe`; `bun measure.js`; `bun freeze.js`. No Node/npm/Python or browser-use tools.

`/compact` cannot be invoked from this interface. This document is the explicit architecture handoff; full implementation and acceptance remain required.


</details>

<a id="record-spectral-integration"></a>

<details>
<summary>SPECTRAL-INTEGRATION</summary>

# Spectral integration investigation — 2026-10-12

Latest measured direction: [API-DESIGN.md#record-spectral-host-design](./API-DESIGN.md#record-spectral-host-design). An isolated93,478,400-byte Windows Bun executable now proves12 successful default/custom/reference/parser/version/fallback executions plus entered-operation kill/reap and a clean subsequent job. It runs without a local Spectral package installation in its owned runtime directory. These architecture measurements supersede the earlier unresolved host feasibility question; native/app/platform/full semantic integration remains missing. Earlier browser CSP failures and their source/results stay immutable.

API Design currently uses generated structural validators in openapi-validation.js and an owned 15-second module worker; Spectral/default semantic rules and custom rules are still missing. This review keeps that complete requirement active. No app dependency, CSP, permission or production source changes.

## Legacy and official contract

Read-only archived insomnia/src/main/ipc/main.ts109–135 runs Spectral with the OAS ruleset, or loads the owning Git repository other/.spectral.yaml through bundleAndLoadRuleset; custom load failure falls back to OAS. design.tsx99 onward maps rule severity/message/range into clickable source diagnostics. This includes custom rule functions and file/remote resolution; supporting only static structural validation cannot close it.

Official [Spectral JavaScript API](https://raw.githubusercontent.com/stoplightio/spectral/develop/docs/guides/3-javascript.md) documents Spectral/Document, parsers, OAS object rulesets and custom loaders/resolvers. [Vite library build](https://vite.dev/guide/build.html#library-mode) supplies the documented bundling path used in this isolated review.

## Measured constraints

Installed only in ignored artifacts/spectral-browser-spike with Bun exact/ignore-scripts: spectral-core1.24.0, parsers1.0.5, rulesets1.23.0. App package/lock unchanged. Actual official API in Bun returns six expected semantic diagnostics for the same owned OpenAPI3.1 document: server/contact/info-description/operation-description/operation-ID/tags. This is one document, not full engine/version/custom-rule parity.

Saved headless module-worker scenario uses actual tauri.conf production CSP unchanged and terminates the worker after observation. Default Bun browser bundle builds but its UMD parser dependency fails dynamic require before lint. Documented Vite bundle resolves that; library mode requires explicit production NODE_ENV before browser execution. The final4.64MB Vite bundle then fails in Ajv Function compilation with an actual EvalError because script-src self/wasm-unsafe-eval does not permit JavaScript string evaluation. Exact failure is line19940; diagnostics never start. Initial app-bootstrap inline-script probe is a fixture-policy mismatch, preserved separately; final probe serves a pure owned document, avoiding confusion with Tauri injected script hashes.

Source/lock/bundle/config/actual results frozen in artifacts/spectral-browser-spike/proof/manifest.json. Earlier UMD/environment/bootstrap negatives remain separate. No network or user-spec inputs loaded in the browser probe.

## Next implementation gates

1. Preserve current cancellation/source identity, structural generation and attached-reference behavior. Add actual semantic diagnostics, severities/ranges and source navigation through the same worker lifetime.
2. Measure a build-time validator/query compilation path for trusted static rules. Spectral validates function schemas dynamically and Nimma compiles queries; fixing only one Ajv call cannot prove runtime compatibility. Custom rules/functions/ref loaders still need equivalent behavior under the application execution model.
3. If a complete CSP-compatible browser execution path cannot retain the official API, evaluate an owned bounded Bun host process with explicit resource/ref services and cancellation instead of changing CSP. The current test proves direct dependency adoption is insufficient; it does not select or implement that alternative.
4. Verify default rules/version/dialect, custom rules/functions/extends, error fallback, file/remote resolution and owned Git ruleset round-trip, cancellation/deadline/stale-source/privacy/native/platform behavior with saved scenarios before accepting full Spectral migration. Legacy fallback semantics and all original parity remain required.

Commands: bun add --exact --ignore-scripts (three packages above) inside the artifact directory; bun x --bun vite build --config artifacts/spectral-browser-spike/vite.config.js; set INSOMNIUM_SPECTRAL_BUNDLE to artifacts/spectral-browser-spike/vite-production-bundle/spectral-worker.js and run bun artifacts/spectral-browser-spike/saved-browser-csp.js. All review processes terminal. `/compact` unavailable; explicit handoff.


</details>

<a id="record-spectral-managed-read-root-acceptance"></a>

<details>
<summary>SPECTRAL-MANAGED-READ-ROOT-ACCEPTANCE</summary>

# Managed repository read correction accepted on root — 2026-10-13

Spectral now records consumed managed ruleset/module/reference bytes and missing fallback dependencies through public IO/loader hooks. After physical producer settlement, Rust rechecks saved repository binding under the existing Git→Storage locks, verifies current managed content against bounded receipts and settles success while holding those locks. Changed bytes, targets, newly present missing dependencies and conflicting consumed snapshots refuse publication as binding. Pre-open path metadata and post-open handle metadata require regular files; cancellation/deadline checks remain active during hashing. Diagnostic resultJson stays opaque and the public command remains {jobId,resultJson}. Internal native protocol2 requires outer receipts; standalone protocol1 preserves compatibility.

Root independently rehashed all776 agent outputs/eight source snapshots/five raw baselines, sixty unchanged command permission TOMLs and package/lock verification bytes before guarded adoption. Only eight offered paths plus the agent report were adopted. The native collector remains unchanged. Producer artifact identity includes read-receipts.js, and the retained packaging fixture now copies this explicit input. No dependency, permission or global UI change was made.

Current root compiler58768 completed0errors/0warnings. Serial83187 completed actual build hook+frontend, validation-only bundle hook, actual newly compiled producer contract, all17 Rust library tests and the SAME saved headless61 compatibility scenario. Existing five vendor warnings remain. Root producer SHA a5ec393d48c9c8f46ed6fe207ffa423b7d1b6b4684211fa440b07d88b2faaca9 is its own generation, distinct from isolatedf50 and historicalf569. A verification-only copied host pins this exact producer; original saved entry/helper remain unchanged, with explicit import adapter forwarding the actual structural fixture. All61 jobs physically exited, seven cancellations and twelve external scenarios passed. This headless branch uses protocol1 and does not prove Rust/native receipt acceptance.

Serial91695 then passed the SAME47 native notice checks,185-identity Spectral audit and six retained packaging groups with all25 original-plus-new assertions. Changing only receipt implementation refuses both artifact and bundle. Hook-order mocks explicitly supply closed native preparation/validation noops; native47 separately checks actual native hook ordering/authority. The additional saved fixture input is the only post-main-freeze source delta. Both phases freeze1002 inputs, and independent root-audit.json rehashes consumed source/private-admission snapshots and archived outputs. Current native and Spectral authority validate. Headless outputs, generated notices/frontend and private source receipts are retained under artifacts/spectral-managed-read-root-proof.

Initial root auditor referenced root-before under final instead of its actual sibling; refusal occurred before adoption. A subsequent Bun CryptoHasher segmentation fault was terminal before source writes; the same authentic bytes were verified with standard createHash under Bun. Final auditor initially read scenario progress instead of owned host/jobs.json and used an incorrect receipt result key; corrected against actual retained files, without scenario or assertion relaxation. Original auditor versions/terminal outputs remain retained.

Fresh native app/backend/sidecar/resources closure and original61 plus actual62nd held-rule binding refusal/zero UI findings remain OPEN. The previous real A→B stale-result negative stays immutable; historicalbf5e executable predates these changes. The new collector was deliberately recollected by actual hook for this changed project identity; recovered3 source archives are still not admitted. Unix FIFO is unexecuted on Windows. Ambient/package/dynamic/remote/resolution effects, external ABA, hard filesystem interruption/TOCTOU and all original SDK/Event/FIFO/private/platform/distribution/migration/UX/notice-linkage gates remain open.

Root live handles:none; native profile untouched. Commit verified work by topic, record evidence/gates/handles in STATUS before next feature. This interface cannot invoke /compact; this is an explicit handoff, not a compaction claim.


</details>

<a id="record-spectral-native-external-acceptance"></a>

<details>
<summary>SPECTRAL-NATIVE-EXTERNAL-ACCEPTANCE</summary>

# Native captured external references — 2026-10-13

Root independently accepts the current compiled ApiDesign component with real Rust reservation/run/cancel commands and packaged Spectral sidecar. This does not establish full production-shell, migration or platform parity.

Fresh locked Windows release build3943 completes successfully (Cargo7m12). Exact app `a00e1ff80c448a4717ed130477cf7be927819be287d3c695499d7d4c19f7ea1e`, sidecar `f5690ce1dc4136c9604964cdf2b2e490442581437db453b14c1f340c2a8d962a`,820 selected source snapshots and52 emitted frontend assets are captured in `artifacts/spectral-native-external-root-candidate/closure.json`. Production hook builds producer, notices/provenance and frontend before saved native fixture/worker and Cargo. Permissions/CSP/app identity are unchanged except the existing fixed probe identity overlay. All selected source bytes remain exact after build.

Initial saved run11241 reaches46 actual jobs, seven entered cancellations and twelve external profiles, then fails capacity request lookup. The shared oracle searches all POST requests and selects an original foreign request with plain-text body; actual saved generated capacity request already contains `{"label":"many-0"}`. Preserve this negative, including native host exit0, full restoration and owned repository cleanup. It is not accepted as a green run.

Root changes only two generation lookups to require the actual `sourceSpecId`. All73 original assertions remain; a browser fixture foreign POST sentinel reproduces the ownership condition. Compiler69577 reports0errors/0warnings, refreshed saved guards pass71, and SAME headless8230 passes48 jobs with sentinel unchanged. Runtime supplement explicitly binds these two test-only files; compiled app/frontend/worker/sidecar and original build provenance stay unchanged. No product behavior or native rebuild is inferred from the harness correction.

Saved native-hidden37495 passes six retained profiles and twelve repository/HTTP profiles,48 actual Rust-owned producer jobs, seven entered-before-cancel jobs with exact retained process objects already signaled on native settlement,36 actual owned loopback reads and no worker reads. Nested/same-basename source findings/navigation, raw BOM/CRLF/astral preservation, fresh Generate `two😀`, main+40-reference catalog41/Generate `many-0` and actual attached override `attached😀` all pass the unchanged assertions. Width760 is CDP-emulated CSS viewport, not physical native window width.

Independent audit verifies hidden host before CDP/exit0, original43 resources/20 history, exact two buffers and immutable store/cookies654, layout restoration and managed Git directory names. Exact registered initially absent repository files are archived and individually retired after host exit. Unknown profile files are not removed. Profile claim released; all root handles terminal. Evidence and complete output archives: `artifacts/spectral-native-external-root-candidate/runs/owned-post-v1/root-audit.json`.

Remaining gates retain full production-shell/current future structural-source-range generation, consumed repository/ruleset reads and generation/inflight changes, ambient custom JS, unobserved process births/hard syscall/forced restart/platform/private/distribution, SDK/Event/FIFO and every original migration/shared UI/UX requirement. License and newer source-range/UI agent handoffs are separate topics. `/compact` cannot be invoked in this interface; STATUS provides the explicit handoff after the topic commit.


</details>

<a id="record-spectral-producer"></a>

<details>
<summary>SPECTRAL-PRODUCER</summary>

# Spectral producer implementation

The JavaScript producer lives in `tools/spectral-linter`, with its own exact dependency versions and lockfile. Root frontend dependencies and CSP stay unchanged. It consumes one UTF-8 NDJSON frame followed by EOF, returns one frame followed by EOF, and never writes specification source to temporary files. Rust owns reservation IDs, repository association, process limits, cancellation and physical retirement; application integration is still pending.

Input: `{protocol:1,jobId,sourceJson,repositoryRoot,rulesetPath}`. The opaque `sourceJson` parses to `{fileName,contents,files:[{name,contents}]}`. Bound stream accumulation48MiB before decoding, inner JSON24MiB, main/each attached source2MiB,32attached files and8MiB serialized attachments. Exact field names/type checks reject malformed frames. Native derives optional repository/ruleset paths; producer rechecks their shape, then resolves repository-relative references within the actual managed root. No arbitrary executable or frontend filesystem path is introduced.

Output: `{protocol:1,jobId,resultJson}` or sanitized `{protocol:1,jobId,error:{code}}`. Inner results8MiB and outer frame16MiB; errors contain closed ASCII codes, never raw exceptions, source or custom stderr. Ordinary custom console logging is routed to the private stderr pipe. Low-level arbitrary custom stdout writes remain subject to native strict framing rejection; a custom ruleset is trusted JavaScript, not a sandbox.

Results preserve official numeric severities, codes (including numeric0), path segments, source URI, full zero-based range and other diagnostic fields. Source catalog identities match the actual documents, including OpenAPI3.2 `$self`: main/attached contents remain in the caller's captured snapshot; remote/repository contents are returned in memory with BOM/line endings preserved for faithful source navigation. Attached sources take precedence. Relative memory references use the resolver's public `transformRef` hook; stock resolution only absolutizes HTTP/filesystem references. HTTP(S) and managed repository references use bounded reads. YAML parsing also accepts JSON, matching legacy `spectral.run(string)`.

Default rules are the pinned OAS ruleset. The registered Git `other/.spectral.yaml` uses the public ruleset loader and embedded builtins plugin, preserving custom functions, options, local imports, inheritance and async execution. Custom load failure falls back to default OAS and reports `fallback:true`; it is not a successful empty semantic result. Third-party module packaging, all-source navigation bounds, release platforms and full native/UI acceptance remain explicit gates.

Scaffold: `bun init --minimal --yes tools/spectral-linter`, then customize the generated package/lock for JavaScript only and remove its newly generated TypeScript configuration. Install with `bun install --ignore-scripts`; reproducible rebuilds use `--frozen-lockfile --ignore-scripts`. The producer bundle selects jsonc-parser's published ESM entry without vendor edits, preserving the earlier standalone compatibility result.

Build: `bun scripts/build-spectral-linter.mjs [Rust-target-triple]`. Without a target it reads `rustc -vV`. Closed target mappings cover Windows x64 MSVC, Linux x64/arm64 and macOS x64/arm64; only an actual executed target counts as verified. The target-suffixed binary is generated in `src-tauri/binaries` with a manifest recording Bun version, lock digest and executable digest. Compilation disables implicit dotenv/bunfig loading and embeds `--no-install`, so missing custom dependencies cannot trigger implicit package installation. Standard Console methods use private stderr; the host flushes its one frame then exits even when a custom function leaves timers alive. Tauri externalBin wiring and native closed commands remain a subsequent integration gate.

Official references: [Bun init](https://bun.com/docs/runtime/templating/init), [standalone executables](https://bun.com/docs/bundler/executables), [Bun plugins](https://bun.sh/docs/bundler/plugins), [Tauri sidecars](https://v2.tauri.app/develop/sidecar/), [Spectral API](https://github.com/stoplightio/spectral/blob/develop/docs/guides/3-javascript.md), [custom functions](https://github.com/stoplightio/spectral/blob/develop/docs/guides/5-custom-functions.md), [resolver API](https://github.com/stoplightio/json-ref-resolver/blob/master/README.md). Matching installed package declarations/source are authoritative for the pinned API.

No full Spectral/migration completion claim. `/compact` is unavailable; root records each verified topic commit, evidence and remaining gates in STATUS before its handoff.

## Verified Windows producer scope

Final Windows x64 executable SHA6231e95ddd20cd9122edea33f342bba52feef3c16dd832849118eb714bca6e78 is93,486,080bytes. Seventeen actual terminal manual executions from a fresh TEMP with only executable/owned repository fixtures prove default6/custom10/official-unbundled exact JSON equality/attached precedence/OpenAPI3.2$self/HTTP source BOM+CRLF/fallback6; duplicate identities,2MiB source,32file/8MiB references,48MiB wire/24MiB inner JSON/multiple frames/invalidUTF8 refuse. Actual custom findings preserve severities0–3 and lone surrogate, all Console methods stay private, left timers do not hold host alive. Actual repository-installed lodash/get and validated custom options run from the compiled host. This proves the measured installed module, not every third-party/native package.

Preflight source freeze precedes these runs. Lock workspace name subsequently corrected without dependency changes; rebuilt executable is BYTE-IDENTICAL to the one exercised. Root frontend package/lock remain exact. Root compiler19650 exits0/0errors0warnings. Evidence artifacts/spectral-producer/final-v2/{preflight,manual-receipt,extra-receipt}.json; frozen complete dependency/source/results manifest is produced at checkpoint. All root children and HTTP server are terminal. No native IPC/profile/manager/platform/install/signing/update/fullSpectral acceptance follows. Manager review found capacity/expiry/cancel/queue deadline/IO/settlement/exit issues; fixes and native UI integration remain required.

## Root Windows native component acceptance — 2026-10-13

</details>
