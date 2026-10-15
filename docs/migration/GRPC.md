# GRPC migration

Updated 2026-10-15. Original current Windows gRPC workflow and Proto36 receipts are accepted. Remaining JSON/shared-editor/compatibility, prospective terminal-classification and platform requirements remain open.

See [current status](STATUS.md), [execution plan](PLAN.md) and [complete parity requirements](PARITY.md). No original scope was removed by consolidation.

## Current embedded proto root correction

Legacy `proto_file` stores embedded `protoText` and `proto_directory` stores hierarchy; original `network/grpc/write-proto-file.ts` materializes these records rather than authorizing external source paths. The bounded correction at5fbb75a in `grpc-model.js`/`GrpcPane.svelte` isolates the selected root by resource ID before validation and derives parent-first DFS include paths in resource order, including empty directories under the256-directory bound. Optional UI choice enumeration skips invalid alternatives; default enumeration and the selected tree remain strict. The2 MiB source boundary remains unchanged. Official source consulted: [protox FileResolver](https://docs.rs/protox/latest/protox/file/trait.FileResolver.html); no new subsystem is added.

Actual NeDB decode/ID remapping/provenance regression passes7 controls at `artifacts/playwright/proto-manager-component/proto-root-model.json`; historical baseline `a147531` fails6 independent root-name/order/unsafe-name/picker/empty-directory-bound controls. Saved headless `--proto-component`73822 passes216 rows across6 profiles without errors/failures. Final compiler5404 passes0/0 and frontend build3332e6 passes; intermediate compiler16304's15 nullable-helper diagnostics were corrected with an asserting lookup. These are model/component/build proofs: no native build/run or profile handles were used for this feature; source/scenario commit is5fbb75a.

Genuine NeDB nested import → Rust method discovery/Echo → export/reimport remains open, including selected method/provenance preservation and native missing-import/root-isolation evidence. Existing [original Windows workflow](#record-current-original-grpc-native-acceptance) and [Proto36](#record-current-proto36-native-acceptance) remain accepted within their receipts. Remaining JSON/shared-editor/provider/platform and all retained [compatibility requirements](#record-grpc-compatibility) stay required.

## Topic records

<a id="record-agent-grpc-method-containment-20261013"></a>

<details>
<summary>AGENT-GRPC-METHOD-CONTAINMENT-20261013</summary>

# gRPC Proto selector painting containment — 2026-10-13

Actual native run30393 failed after17 UI rows/11 real Rust replies: both dark1440/900 profiles completed, dark760 reached replacement persistence/reload, then normal Load methods click was intercepted by Proto source SELECT. Originalstderr is preserved; root reports host/profile restoration passed, independent native acceptance remains separate. This feature does not rerun native or claim the old app contains the new CSS.

Saved reproduction uses SAME nocturne-grpc-theme.js optional --grpc-layout-component early-return, actual GrpcPane/workspace/Select and complete app styles, with an explicitly owned browser-only fixture. A330px sidebar reserves the narrow app-like content width; it is a constrained component fixture, not the entire native shell. Short11 and long51-character actual proto option names across dark/light1440/900/760×600 produce12 rows. No widget/CSS/transport/parser replacement, fakeTauri, or real Rust claim. Load methods runs the actual browser desktop-required path, and its feedback proves normal click handler execution; callback/resources/history/local persisted snapshot remain unchanged.

Negative measurements: four long900/760 rows hit Proto source over the button, although select/shell bounding rectangles are contained. At760, shell/control width169.671875 while scrollWidth284; shared min-width is already0. The inline-grid wrapper/flex layout constrains the box, but the customizable base-select contents paint/hit-test beyond it. Width changes would not fix the proven box-contained content spill. Initial negative and neutral-pointer V2 receipts/source snapshots remain immutable; neutral sidebar pointer/focus establishes like-for-like normal colors and avoids mixing prior interaction states.

Production delta is ONE local declaration in GrpcPane.svelte: .grpc-methods .ui-select-shell > .ui-select { overflow: hidden; }. It contains the selected content at its existing control boundary. No shared Select, grid/flex quotas/minimums/widths, palette/fonts/tokens, methods/options/IDs, backend or model changes. Removing this3-line rule restores entire root-before LF-normalized product; root raw beforeb0044c15a383d8ed74a727ac467c1694df96636f6e972b1c722f3ac748b27bc4 and original ownb647 line-ending difference are retained. The6-line saved entry branch reverses entire root8fc RAW entry including all original native and36-case assertions. New helper/fixture paths were absent in root.

SAME strict headless12 passes after correction: selector boxes contained, Load methods center hit actually belongs to button, unforced normal click executes, real ShiftTab/Tab keyboard focus stays visible, actual customizable select opens its picker and Escape preserves selected ID. Exact before/after rectangles, client width, fonts/colors/background/display/layout widths/grid tracks for button, toolbar, both selectors/shells match all12 rows. Internal scrollWidth is recorded separately: clipping changes shell overflow, and native selected-content scroll extent can include padding; it is not falsely called unchanged normal geometry. No forced click or keyboard bypass is used to accept the button. Six screenshots include viewed dark760; full selected option remains available in its actual popup.

Regression: full existing design-system.js session74178 terminal0, original shared controls/Field/FilePicker/multipart/keyboard/style assertions preserved. Final compiler11800 terminal0/0errors0warnings; syntax4/static inverses pass. Initial compiler exposed3 new fixture/helper type guards (corrected) plus4 pre-existing optional-fetch preview mismatch errors. Checks/scenarios used EXACT root preview5493d7352111fa95cd70ec41babf766045e106771f7f9cf6f29cd313aa8cabc7 as verification-only supplement; own3839 before bytes restored afterward, neither preview nor README offered/staged. Final source-input snapshots bind consumed preview-used bytes, not restored working bytes. No Vite/native/Cargo build was run; only authorized Bun component-fixture compilation and compiler/headless checks. Root fresh build/native acceptance is required after adoption.

Artifact native-instrumentation/proto-native-fields.js SHAddd03f81959b8b4bc68645062aa82031487412e489ed2f9db496db4e20e7f192 adds only JSON BEFORE original Load methods .click() to accepted cb92 helper. It persists actual selector/control/shell/value/selected text/:open, button, all ancestors, rect/client/scroll/padding/overflow/grid/viewport/DPR and elementsFromPoint hit stack. Removing insertion.txt reproduces entire cb92 RAW helper. Original unforced click/all36/Rust/data/restoration assertions remain unchanged. Instrumentation is runtime-only, unexecuted, to bind separately in the future fresh native app; compiled root077/oldcb92/aa4/fb83 proofs remain immutable.

Primary docs consulted: [CSS Overflow clipping/scrolling](https://drafts.csswg.org/css-overflow-3/#overflow-properties) and [customizable select mechanics](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select). Local containment preserves the popup behavior as tested instead of altering the shared primitive globally.

Offer6 tracked paths only: GrpcPane, existing native entry optional component branch, new grpc-method-layout helper, its .js/.svelte fixtures, this report; plus exact artifact native instrumentation separately. Final artifact audit pins complete consumed source/output/root-before hashes and both RED generations. Root writes nothing during own checks, all processes now terminal, profile unclaimed. Remaining: independent root replay/compiler/build and fresh native36/actual pointer/success/persistence/full profile13783Git/layout/current source/assets/sidecar/notices restoration; original full gRPC, fallback-native-browser/OS/AT/platform/full migration gates remain OPEN. /compact unavailable; explicit topic handoff, not claimed compaction.


</details>

<a id="record-agent-proto-native-fields-prep-20261013"></a>

<details>
<summary>AGENT-PROTO-NATIVE-FIELDS-PREP-20261013</summary>

# Native Proto Field acceptance preparation — 2026-10-13

This is a saved, unexecuted native acceptance supplement. No browser, native host, profile, Cargo/build, cache, or root source was changed. The original default gRPC scenario remains available; removing only the six-line optional `--proto-fields-native` branch reproduces its entire original LF-normalized body (root-before SHA46df527a3b4c225350880f2a7dcd3fbb2dae8541b2a8dd0267b2faff2b3a0f26). No assertion was removed.

Offer only tests/ui/nocturne-grpc-theme.js, new tests/ui/helpers/proto-native-fields.js, this report, and the artifact-local artifacts/proto-native-fields-preparation/native-preserved.mjs. Do not adopt existing shared imports, preview-app.js, README, or own STATUS. Product pins remain Proto8c9a08b4d4c40b60992220afe7290e021c77832f160e71a6e57d52efbe267827 and model4ee8be93e3caa5eab785ac89baa30b25994ed2b81df86607f09f8b5374b3c5ec; header authority is the accepted d9aefd1 generation. Fresh executable/source/assets/build-state acceptance belongs to root, not this preparation.

The six dark/light1440/900/760×600 profiles each retain six cases: first-field ownership/correction/unrelated edit; second-field earlier-authority retirement and explicit resubmit; duplicate pair distinct descriptions; long error wrapping; actual Rust malformed-schema global refusal; actual Rust valid replacement/persistence/reload. The total36 is proposed assertions, not36 executed receipts. Filename errors use actual current frontend validator; no source/model/Field shim. The replacement checks persisted IDs, parents, raw source bytes, foreign metadata and original resources/history, reads physical KnownFolder workspace-v1 JSON, reloads, and verifies real compiled Echo methods. CDP file bytes are explicitly not an OS chooser claim.

The malformed source is exactly `invalid`. The expected public Display is statically derived, not invented or replayed: archive protox0.9.1 and protox-parse0.9.0 from static.crates.io, verify Cargo.lock checksums4f25a07a… and072eee35…, inspect transparent Error→ErrorKind::Parse→ParseError→UnexpectedToken formatting. The upstream protox src/error.rs test parses exactly this source; its Debug assertion contains a filename/position prefix, while the explicit Display chain does not. parser-oracle.json pins both complete source files and the derived string. The actual passive native response must equal that exact string, the UI must match the real response, fields remain unmarked, and native/disk resources/history must remain unchanged. This oracle has not yet been exercised against Rust. A mismatch fails; arbitrary backend error is insufficient.

Preservation orders full protected654-cookie/store/buffer bytes and full pinned13783-file Git streaming hash BEFORE launching, then registered new non-Git collection BEFORE save, actual host-owned current3/legacy2 layout restoration in callback finally, then owned host exit, authoritative noHosts, full protected/Git/source/private/assets/sidecar/notices/executable postexit audit. Unknown files are never adopted or deleted. hostTerminal is true only after successful noHosts, otherwise false with restoration failure retained. Root must additionally bind native-app PID/exit receipts. Reference façade raw3d4d1f93… is preserved; reversal-v2 actual reverse patch reproduces entire LF-normalized reference text. Different raw line endings are acknowledged, not called byte-identical.

runProtoNativeFields() is root-only and requires INSOMNIUM_PROTO_NATIVE_RUN=reviewed-current-proto-fields, exact INSOMNIUM_PROTO_NATIVE_FACADE_SHA256, INSOMNIUM_PROTO_NATIVE_BINDING and INSOMNIUM_PROTO_NATIVE_BINDING_SHA256. Binding status reviewed-current-proto-native carries fixed identifier app.insomnium.probe.checkout20260929, exact sourceHashes, closurePath/SHA256, exeSHA256, buildState, Git metadata path/SHA256 and fresh output. withProtoNativePreserved(run) provides {original,readPersistedWorkspace}. Root creates/reviews the actual fresh binding; no runnable binding/executable is offered here.

Dependency reconciliation is explicit. ownImportClosure import-closure.json binds22 own bytes; rootConsumedClosure root-consumed-closure.json binds22 virtual post-adoption root bytes. Offered paths use new candidate bytes; every other dependency uses exact current root raw bytes, archived in root-consumed-snapshot. dependency-comparison.json retains both hashes/lengths and whole-LF equality:12 differences are newline-only; preview-app.js is substantively different (root5493d7352111fa95cd70ec41babf766045e106771f7f9cf6f29cd313aa8cabc7 versus own3839c23f…). Root preview WIP is preserved and consumed, never overwritten/staged. No path exemption or duplicate-path skip. Final snapshot guards both closures separately.

Static verification: Bun static-guards.mjs syntax/transpiler3, whole default-entry inverse,36-case code contract, registration/save ordering, resource/history checks, no transport/result/delay replacement, full preservation ordering and postexit asset checks passed. Two wrong-cwd refusal probes ran before any native/profile action. freeze-consumed.mjs rebuilt both22-path maps and verified parser source formatter proof. No compiler/build or actual native36 run occurred; these remain root acceptance gates. Original entire default gRPC workflow and native OS/AT/race/platform coverage remain open; no full migration closure claim.

Primary references: https://v2.tauri.app/develop/calling-rust/ ; https://playwright.dev/docs/api/class-locator#locator-set-input-files ; https://docs.rs/protox/0.9.1/src/protox/error.rs.html ; https://docs.rs/protox-parse/0.9.0/src/protox_parse/error.rs.html . Commands: bun artifacts/proto-native-fields-preparation/static-guards.mjs; bun artifacts/proto-native-fields-preparation/freeze-consumed.mjs. Full final source/output/root-before guards are in artifacts/proto-native-fields-preparation/final/audit.json. All prior proposals/product/measurement/native negatives remain immutable. No live handles/profile claim. /compact is unavailable in this agent interface; this is an explicit handoff, not claimed compaction.


</details>

<a id="record-agent-proto-pending-fields-fix-20261013"></a>

<details>
<summary>AGENT-PROTO-PENDING-FIELDS-FIX-20261013</summary>

# Proto pending filename Field ownership correction — 2026-10-13

Pending Proto path controls now use the geometry-verified caption-free existing Field composition. Invalid filenames own exact Field.error descriptions; duplicate names mark both authoritative rows with distinct IDs. Correcting the accepted issue retires only that owner. Generic context/read/backend/rename/topology feedback remains global. No shared Field API/default/density, backend/native, quota or persisted-data change.

## Authority and lifetime

`src/lib/grpc-model.js` registers metadata only for the actual existing filename Error inside `validateProtoFiles`. A private WeakMap associates the same Error object with frozen `{kind,name,rows}` metadata; exported `protoFilenameIssue(error)` returns null for an unregistered error. Backend strings or similarly shaped errors cannot gain a field owner. Duplicate indices are determined only when the existing duplicate branch actually fails. Count first, ordered filename-before-size checks, per-file/aggregate UTF8 limits, exact messages and post-loop file/directory collision checks remain unchanged. The same existing Error instance propagates through import/prepare change.

ProtoManager captures the submitted pending values, request ID, raw data identity and epoch. Only a current matching batch accepts a branded refusal; disposal, changed raw data/request/epoch or different current pending values decline it. A separate filename owner leaves global error state untouched. On edit it runs the actual complete validator: retain/update only the same kind and row ownership; otherwise retire the old owner without automatically publishing another unsubmitted issue. New selection/discard/success and actual owner retirement leave no stale local association. Existing key/tab/read cancellation and originating-picker focus guards remain unchanged.

Local display:contents and the existing five-pixel input-margin selector preserve normal geometry. Field feedback uses a local block/overflow-wrap:anywhere rule after a real long-error negative: a900-character name gave width5536.765625/right5552.765625 against previewright1432 at1440. The immutable `long-error-negative` captures source/output/log. The correction wraps within existing preview padding without changing shared feedback styles/font/color. Current1440 measurement width1408/right1424/height90 fits; all six widths/themes pass strict bounds.

[ECMAScript WeakMap specification](https://tc39.es/ecma262/multipage/keyed-collections.html#sec-weakmap-objects) governs private object-identity lookup; [Svelte lifecycle](https://svelte.dev/docs/svelte/lifecycle-hooks) and installed Field/context remain the existing rendering contracts. No dependency/subsystem initialization.

## Verification

SAME saved `bun tests/ui/nocturne-grpc-theme.js --proto-component` session98197 exits0:216 receipts across dark/light1440/900/760×600. Original174 categories/data/no-save/focus/generic checks remain; intended changed behavior requires exact current associations and retired corrected feedback. Duplicate presence wait now uses first only for waiting, followed by exact two-message count, distinct control/error IDs, matching descriptions and invalid flags; no refusal assertion is removed.

Additional42 UI receipts prove earlier changed authority retires old feedback without auto-publication, correction preserves unrelated real rename-global feedback, data/request/tab/new-selection retire owners, and long filename errors wrap within preview. Twelve originating-picker focus positives and36 focus-retirement checks remain. All six normal panel/control metrics and12 valid pending input rectangles/fonts/colors/background equal the immutable production negative exactly.

Sixteen actual-model pure receipts exercise false brands/lookalikes/cloned Error, immutable metadata, empty/257 count precedence, earlier per-file/aggregate size before later duplicate, invalid-name-before-size, exact duplicate indices, file/directory collision remaining global and exact/over UTF8 text byte limits. These run through the actual model, with no parser/error/transport substitution. Compiler32073 exits0/0errors0warnings; own application build exits0; SAME full saved design-system29530 exits0. Approved ignored preview5493 supplement restored3839, not offered. Initial long-error failure and five helper JSDoc compiler errors are preserved separately, not masked by retries.

## Guarded handoff

Final manifest `artifacts/proto-pending-fields-fix/final/audit.json` SHA `00a7c410517a234030ca5c24d3a5157298e638e306c0ade5a5968702b0f2737a`; independent313/313. Maps:

- source255 → `final/source/<path>` (captured cba+accepted50c focus, only current Proto/model deltas).
- harness10 → `final/harness/<path>`; output17 → `final/output/<name>`; bundle2 → `final/bundle/<name>`.
- verification10 → `final/verification/<name>`: logs/geometry/raw-root guards/shared result/actual preview supplement/baseline whole-LF equality.
- rootBefore6 → `final/root-before/<path>`; ownBefore5 → `final/own-before/<name>`; negative8 → `final/long-error-negative/<name>`.

Output17 includes16 current receipts/screenshots/results plus retained long-negative failure.png; it is not a current failure. Prior4eef/46787/4d554 and native/Cookie proofs remain immutable. Source generation is explicitly scoped, not a whole-current-root/native claim. The local build/shared checks do not establish a new native artifact.

Root raw guards: Proto50c24cb7; modelaf6ce60c; helperae9693a7. Own before model5996be09 is whole-file LF-equal to rootaf6 (both raw bytes retained). New pending-fields and filename-guards helpers are absent in root, although their predecessor measurement existed in this agent branch. Existing native entry46df and fixturesed378/bddd are unchanged and not offered. Root must use raw guards/absence plus declared LF equivalence, not broad cherry-pick.

Offer six paths only: ProtoManager (8c9a08b4…), grpc-model (4ee8be93…), component helper (a47acd4d…), pending-fields helper (b8ba22fc…), filename-guards helper (4ced6ce6…), and this report. Own STATUS is not a root overlay. No live process/browser/server/build/check handles, no root/native/profile/cache mutations/claims. Actual native/OS/AT/schema replacement, full production shell and every remaining migration gate remain OPEN. `/compact` unavailable; explicit topic/STATUS handoff instead.


</details>

<a id="record-current-grpc-assertions-and-quarantine-restoration"></a>

<details>
<summary>CURRENT-GRPC-ASSERTIONS-AND-QUARANTINE-RESTORATION</summary>

# Current original gRPC assertions and quarantine restoration

The original saved gRPC assertions passed against current edbb/f66 in native-hidden mode. Full workflow acceptance remains open because the Root process observer failed while authenticating a late WebView2 child. The failure is preserved; no missing physical proof is inferred from native exit or PID absence.

Root session 25857 and operator PID 62460 are terminal. Native host PID 54168 ran 11:28:37.480–11:29:53.665 UTC, status passed, exit 0 / null signal. Its owned window was hidden before attachment. The unchanged dffa entry covers unary success/failure, server/client/bidirectional streams, pending-prompt cancellation, transport cancellation, split behavior, dark/light themes and six response viewport captures. Acceptance records nine states; this is not nine viewport profiles or per-RPC raw transcript coverage. Explicit window cleanup does not prove OS-close lifecycle.

The Root observer retained the host and five children before exit, but a Win32 call for a sixth child returned 0. The old observer recorded only `AssertionError: 0 == true`, then closed handles after child termination without collecting wait results on its error path. Therefore kernel termination proof is unavailable for this attempt and the late child was not authenticated. Full recorded-child and physical-settlement predicates remain mandatory.

The facade independently retained successful original assertions, protected data and an exact committed fixture receipt. Real initialization returned null HEAD / branch main; the commit is `a2ab1c7af2ec9b343540e05145ad662d25d03966`, nine unique Git objects. Root rechecked the concrete ownership, four marker hashes, selected compiled initializer provenance, actual configuration policy, exact commit/object/reflog manifest, full original Git baseline with one registered candidate, natural native exit / no owned hosts, source and package authority, and same-volume absent destination. This admitted restoration-only quarantine without waiving workflow acceptance.

Root phase-two session 99141 / operator PID 52216 exit 0 executed the existing guarded no-replace `MoveFileW`. No deletion or alternate movement occurred. The fixture remains in its uniquely owned same-volume temporary quarantine. Original source is absent, destination manifest is exact, and the facade reports restoration only / full workflow acceptance false.

Independent Root audit session 7455 exit 0 verified all 656 protected files including 654 cookies, every 13,783 original Git file and exact original directory inventory, resources 43/history 20, current app/source/package inputs and actual layout before/after equality. A separate filesystem walker rechecked every quarantine file, directory, byte length, SHA and hardlink count; independent zlib/Git framing plus SHA-1 reproduced all nine object IDs. Exact original workspace bytes remain private local evidence. The newer explicit profile-release receipt releases the global claim; historical held claims remain unchanged. No process handles remain.

Root visually inspected actual dark/760 and light/1440 response screenshots: no obvious overflow in those captures. This is bounded visual review, not universal CSS/keyboard/AT/platform acceptance. All original migration/UX/source/legal/distribution gates remain open.

Evidence: `artifacts/grpc-drive-root-native-root-run/{run-result,physical-host-after-exit,root-concrete-quarantine-review,phase2-child-result,independent-restoration-audit,profile-release}.json`, `artifacts/grpc-drive-root-current-native-proof/{phase1-result,quarantine-review-required,layout-restored-before-host-exit,post-quarantine-full-restoration}.json`, and `artifacts/playwright/nocturne-grpc-theme-1791890917467/{result,acceptance}.json`. Commands: saved Root phase-one runner, `bun artifacts/finish-drive-root-grpc-quarantine-root.mjs`, then `bun artifacts/audit-release-drive-root-grpc-restoration-root.mjs`.

Next: independently review the frozen observer rewrite that records each failing API/phase/immediate error and settles every retained handle after the same child terminal, including on observation failure. Rerun the same saved workflow with fresh bindings, without ignored children or fabricated physical success. `/compact` cannot be invoked by this interface; STATUS and this report provide the feature handoff.


</details>

<a id="record-current-grpc-drive-root-repair"></a>

<details>
<summary>CURRENT-GRPC-DRIVE-ROOT-REPAIR</summary>

# Current gRPC drive-root repair

Root rehashed the frozen eleven-file offer `2d953321…a972f`, replayed its saved guards with PID 63260 / exit 0, and reproduced all 15 refusals and the whole original-source inverse. The fix replaces canonical identity checking only for closed DOS drive roots. Nonroot Bun equality, path attributes, reparse refusal, volume GUID/serial checks and no-replace movement remain intact.

The read-only root branch uses an existing-directory handle with read attributes, sharing 7, `OPEN_EXISTING`, backup semantics and open-reparse flags. It requires normalized extended DOS identity, directory/nonreparse attributes from the handle and matching volume serial, and closes the handle in finally. The helper is inline; the runtime ledger remains 42 files. Original failed runtime and receipts remain unchanged.

Root created a new runtime `grpc-drive-root-current-native-runtime` and serial auditor `grpc-drive-root-serial-audit-root`, rebasing only declared deployment paths. A separate read-once layout supplement retains the original equality assertion and serializes actual before/after maps. The original gRPC default entry still has exact SHA `dffa847c…e2d01` and all original unary/stream/cancel/prompt/split/theme assertions. New guard SHA `c519ca04…19475` binds ledger `a8619a01…bed19` before any authority import.

Fresh package capture PID 61976 and verification PID 63756 exit 0. Capture SHA `fcc07fdb24d787839e1e4308067635a6e8cc1dfd2750c51c45cc8f9439c116f7` binds the same three packages / 407 files and eight tools with the new guard/ledger. No old package receipt is relabeled as a new capture.

The saved Root input probe actually invoked the reviewed metadata helper for `C:\`, `E:\` and the nonroot workspace. Both drive handles returned exact `\\?\<drive>:\` identity, directory/nonreparse attributes and matching volume serial, and closed successfully. C: volume serial is DAA58548; E: is 8E230BB1. The nonroot observation retained its original canonical check. No application was launched or profile claimed. This is bounded local Windows metadata evidence, not universal filesystem/platform proof.

The new Root runner's whole inverse preserves the old runner apart from declared paths, requiring the latest failure release and capturing exact original workspace bytes before mutation. Launch preparation passed and produced review `0ddb6dd1…27588`, binding `161678f9…038fd`. It authorizes the original phase-one scenario only; full gRPC, concrete initializer/commit/quarantine receipts, final independent restoration and global release remain required.

Evidence: `artifacts/grpc-drive-root-identity-root-review/{root-source-review,root-input-probe,launch-source-review}.json`, new package capture, and `artifacts/grpc-drive-root-native-root-preparation/review.json`. Commands: `bun artifacts/review-stage-drive-root-grpc-runtime-root.mjs`, `bun artifacts/capture-probe-drive-root-grpc-inputs-root.mjs`, `bun artifacts/prepare-drive-root-grpc-launch-source-root.mjs`, and `bun artifacts/prepare-current-drive-root-grpc-launch-root.mjs`.

Official references reviewed before implementation: [directory handles](https://learn.microsoft.com/en-us/windows/win32/fileio/obtaining-a-handle-to-a-directory), [GetFinalPathNameByHandleW](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfinalpathnamebyhandlew). Full original migration/UX, source/legal, platform and distribution scope remains open. Root live handles: none; profile unclaimed. `/compact` cannot be invoked through this interface; STATUS and this report are the explicit feature handoff.


</details>

<a id="record-current-grpc-initializer-provenance"></a>

<details>
<summary>CURRENT-GRPC-INITIALIZER-PROVENANCE</summary>

# Current gRPC initializer provenance

Root independently reproduced the bounded initializer gate for the current Windows app `edbbac32` / closure `f66eaa2a`. This does not accept the full gRPC workflow or complete the migration.

`bun artifacts/reproduce-current-libgit2-symbol-proof-root.mjs` rehashed all 49 symbol-proof, 24 Cargo/archive and 20 PE/PDB offer files into a new owned directory. Unchanged saved inspectors ran with actual PIDs 35772 and 61000, both exit 0. Eight regenerated outputs matched the frozen offer; all 25 actual input pins remained unchanged. The copied proof was executed with Bun only, without executing the target application or linker.

Six object/image relocation graphs reproduce the initializer, version, config setter, options initializer, library initializer and template-directory functions. Repository initialization covers 12 sections, 284 independent public relocation targets and 19 private targets with body validation. The exact 22-byte version body implements 1.9.7. Three authentic source-template literals match compiled data and initializer references. Seventeen parser/body corruption guards pass, including private-target body tampering.

The matching PDB GUID is `A1DABC74-ED44-4A66-A524-1A77FD77EFD7`, age 1. Its real linker environment record is module 427, stream 415, offset 72, length 2548. Actual command SHA is `960ea1ddc32221847708142274798a8ce77373d02650e52cb4ff8627ef8fc179`; its library path matches the selected static archive. All 214 archive payloads occur exactly once in the persisted sys rlib. PDB module association supplies the separate rlib relation; the command itself does not name an rlib. The deleted transient rlib checksum was not observed.

`bun artifacts/bind-current-grpc-initializer-provenance-root.mjs` rehashed selected build output, generated features, Cargo fingerprint, archive and rlib; it bound real final-link metadata to provenance `e71a7645ad8c461489561048e2b59ab745ae7a3d613a2289041a75b7c3e16f29`. The unchanged initializer contract accepts 1.9.7 / vendored / no iconv / static git2. Binding supplement and final-link review are in `artifacts/grpc-current-initializer-root`.

`bun artifacts/preflight-current-grpc-runtime-root.mjs --source-only` passed all 42 declared runtime sources before any authority import. Original gRPC source assertions and deployment-import inverses remain intact. This preflight does not yet bind package/tool inputs or authorize launch.

Authoritative receipts: `artifacts/libgit2-current-symbol-root-reproduction/root-reproduction.json`, regenerated symbol-proof outputs, `artifacts/grpc-current-initializer-root/binding-supplement.json`, and `artifacts/grpc-current-serial-audit-root/before-import-source-preflight.json`. Raw PE/PDB/object binaries and large historical STATUS snapshots stay outside this topical commit; their exact pins remain in the frozen manifests and current local evidence.

Remaining gates: actual package/runtime binding; serial original full gRPC; retained physical process observation; concrete Git initializer/commit receipts; guarded same-volume quarantine; independent full restoration and explicit global profile release. Full-source attribution, all-function retention, legal, platform, distribution and every original migration/UX requirement remain open. No native launch, profile claim or live handles occurred. `/compact` cannot be invoked through this interface; this document supplies the feature handoff.

Reviewed format references: [Microsoft PE/COFF](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format), [LLVM public symbol stream](https://llvm.org/docs/PDB/PublicStream.html), and pinned LLVM 20.1.8 source references in the frozen offer. These define the parser formats; completion claims above come from actual local reproduction.


</details>

<a id="record-current-grpc-observer-restoration"></a>

<details>
<summary>CURRENT-GRPC-OBSERVER-RESTORATION</summary>

# Current gRPC observer diagnostic and restoration

The original saved scenario passed on native-hidden host 37996, which exited naturally with code 0. Root wrapper 67775 and phase1 operator 60864 refused full acceptance. Observer c5190d preserved the exact failing call: QueryFullProcessImageNameW returned 0 with immediate error 31 for startup child 62504. Required recorded renderer 36732 is a different process and was not authenticated. This does not prove an access-denied cause or establish that the failed process had already exited.

The host and five authenticated children each changed from unsignaled (258) to signaled (0) on their retained kernel objects after scenario child exit, and their handles closed. The failed partial attempt also closed its handle. These diagnostic improvements do not satisfy the full recorded-child gate.

Root concrete review bound review a58a813349fff24dc13a4193d804e36608a5e8d239906c5bbc91e3bbc1c54047 and ownership receipt f33e790580abf10f93bdd995cbc85a127cff6cfab9ab0c2fbe1a1d90b1db7882. The committed owned fixture 3abc64891c118413aa5dcc717ad0822e9f294107 contained nine objects. Root wrapper 1042 and phase2 child 60684 exited 0 after the existing same-volume no-replace quarantine workflow. No deletion was used.

Independent restoration wrapper 40183 exited 0: 656 protected files including 654 cookie files, 13,783 original Git files and exact directories, all 43 original resources and 20 history rows, layout, current authority, package inputs, and independently decoded nine quarantine Git objects passed. The explicit profile-release receipt is accepted; the original held claim remains as historical evidence. No Root live process handles remain. Private workspace snapshots stay local and unstaged.

Evidence is in artifacts/grpc-observer-native-root-run and artifacts/grpc-observer-current-native-proof. Full original gRPC physical acceptance, all remaining migration/distribution gates and subsequent UX work remain open. Source-only agents prepare the next observer proposal, independent XML auditor and frontend provenance collector. This interface cannot invoke /compact; STATUS supplies the explicit handoff.


</details>

<a id="record-current-grpc-package-preflight-and-root-refusal"></a>

<details>
<summary>CURRENT-GRPC-PACKAGE-PREFLIGHT-AND-ROOT-REFUSAL</summary>

# Current gRPC runtime preflight and drive-root refusal

Root independently rehashed the seven-file package preflight offer `53472d69…108dd` and replayed its 17 pure guards. Original capture refused before publication because the assumed PowerShell sibling `System.Management.Automation.dll` did not exist. That source, stderr and terminal receipt remain intact.

A separate read-only query of the selected standard PowerShell executable obtained its actual `[PSObject].Assembly.Location` in GAC_MSIL. A new collector changes only that literal; reversing the substitution reproduces the entire original source. All environment, resolver, lock, whole-package-tree, file, version and tool gates remain unchanged. The DLL SHA is `46d640a6…e5ba`, numeric version `10.0.26100.9549`. The query executes PowerShell for metadata; the collector itself reads tool binaries as data without executing them.

Actual capture PID 63000 and verification PID 62352 both exit 0. Capture SHA is `e69953489c73d9f7e5a525ba8efd9e7dc880cd11d10e5778dacae216fab69591`: playwright-core 1.63.0, yaml 2.9.1, noble hashes 2.4.0; 407 package files, four resolutions, eight tool files, 121,711,040 bytes. Source guard still verifies all 42 source hashes before importing authority. Registry archive equality, the entire Windows/CLR loader closure and general check-to-use race freedom are not claimed.

Saved launch preparation session 39542 exit 0 bound current edbb/f66 app, independently accepted initializer, complete declared runtime inputs and original assertions. Review SHA `a994643d…39867`; binding SHA `a4845119…e350f`. The saved Root runner verifies explicit pre-import roles and retains owned process handles through a separate read-only observer. It preserves the intentional phase-one child exit 1 while quarantine remains pending; it never treats that exit alone as success.

Actual Root session 53372 / PID 26640 and operator child PID 58804 exit 1 before native launch. The facade's `ordinaryParents(profile)` rejects `Bun.realpath('C:\\')` returning `C:\\C`. This happens before the facade's prelaunch output, temporary directory, registered fixture and `nativeWithApp` call. The physical observer correctly reports that it never saw a native host; no runtime acceptance is inferred. Original stderr, claim, review and physical receipts remain immutable.

Independent failure-restoration session 53198 exit 0 rechecks all 656 protected files including 654 cookies, every 13,783 original Git file and exact directory inventory, resources 43/history 20, current app/source authority and package/tool inputs. No native host or original runner/child PID remains. A newer explicit `profile-release.json` releases the global claim; the original held claim stays as historical evidence. Layout workflow was never entered; no UI/layout runtime acceptance is claimed.

Evidence: `artifacts/grpc-package-tool-preflight-preparation`, `artifacts/grpc-package-tool-preflight-root-reviewed-source`, `artifacts/grpc-package-tool-preflight-root/capture.json`, `artifacts/grpc-current-native-root-preparation`, and `artifacts/grpc-current-native-root-run/{run-result,failure-restoration-audit,profile-release}.json`. Commands: saved `review-capture-current-grpc-packages-root.mjs`, `repair-capture-current-grpc-sma-path-root.mjs`, `prepare-current-original-grpc-launch-root.mjs`, `run-current-original-grpc-phase1-root.mjs --phase1 <reviewSHA>`, and `audit-release-grpc-prelaunch-failure-root.mjs`, all through Bun.

Next: a new source-reviewed drive-root-only branch must obtain canonical directory identity through Win32 directory handles, retain nonreparse/volume checks, and close handles in finally. Ordinary nonroot Bun equality must remain unchanged. Use fresh runtime, binding, source ledger and package capture; preserve this refusal. Then rerun the same original full gRPC workflow, review concrete Git receipts, quarantine without replacement, independently audit full restoration and explicitly release the claim. All original migration/UX, full-source/legal, platform and distribution gates remain open.

References consulted: [Bun native APIs](https://bun.sh/docs/runtime/bun-apis), [Microsoft PE/COFF](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format). No process handles remain. This interface cannot invoke `/compact`; STATUS and this report provide the explicit feature handoff.


</details>

<a id="record-current-grpc-terminal-observer-preparation"></a>

<details>
<summary>CURRENT-GRPC-TERMINAL-OBSERVER-PREPARATION</summary>

# Prospective terminal startup observation

Root independently copied and rehashed all 17 frozen files from proposal c9e7e3b32e92dd714a0bb323e721e0418e31d04ec136d9c833f44aaa6732d3ef. The eight observer segments exactly invert to c5190d. Root replayed classifier guards (PID53852), orchestration guards (46724), and refined adapter guards (63512), all exit0: 17 classifier poisons, five orchestration cases, three required-child/error refusals, and 18 adapter poisons. All positives are synthetic; no native acceptance follows from them.

Only a non-host QueryFullProcessImageNameW zero/error31 may enter the new category. The next monitored call on the same open kernel handle must be immediate WaitForSingleObject(0) returning zero, followed by successful GetProcessTimes creation/exit and successful CloseHandle. Kernel creation must match the precise CIM snapshot interval and authenticated parent's creation. The parent snapshot must bind the actual retained parent receipt. Raw error, sequence and classification remain visible; imageAuthenticated and requiredChildProof stay false. Active or unknown attempts, host failures, unrelated errors, fabricated parent/handle/calls and any classified PID among required children refuse. Discovery continues to authenticate replacement children normally. Every recorded child still requires the complete original proof; old failed child62504 cannot be retroclassified.

Official contracts consulted: [WaitForSingleObject](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-waitforsingleobject), [GetProcessTimes](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes), [QueryFullProcessImageNameW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-queryfullprocessimagenamew). Error31 alone is never terminal proof.

The new source42 ledger a0e9d38a and source guard3023c84f preserve original scenario/auditor predicates and current edbb/f66/e71 initializer authority. Fresh package capture63408/verify45148 exit0 binds three packages,407 files,eight tools (67edf76a). Root launch review3d246c2e/binding81254bb4 pins classifier and refined adapter before any observer import. Runner/preparer/collector changes have exact whole inverses. No product source, original assertion, native executable or profile was changed during preparation.

Next: run the same saved original scenario serially, independently inspect raw object evidence, concrete same-volume no-replace quarantine, full restoration and independent original case audit before explicit global release. All migration/distribution/UX gates remain active. Root handles:none/profile unclaimed at this handoff. /compact cannot be invoked by this interface; STATUS records the handoff.


</details>

<a id="record-current-original-grpc-native-acceptance"></a>

<details>
<summary>CURRENT-ORIGINAL-GRPC-NATIVE-ACCEPTANCE</summary>

# Original current Windows gRPC workflow accepted

Root wrapper70509 exited0; operator55128 exited1 with the declared quarantine-required message after all original scenario assertions passed. Native-hidden host61704 exited naturally0/null signal, without intentional parent termination. Original body dffa847c and original audit/expectation predicates remain unchanged. Current app edbbac32, closure f66eaa2a and initializer provenance e71a7645 are unchanged.

Both themes, widths1440/900/760, nine original states, unary success/failure, server/client/bidirectional streams, completed-call prompt cancellation, transport cancellation, split behavior and six response captures passed. Original scenario output: artifacts/playwright/nocturne-grpc-theme-1791895288164. The assertions prove their saved-source scope; separate per-RPC wire transcripts were not invented.

Observer807dad and refined adaptera4be retained host61704 and all six recorded children (61004,60692,59532,61628,60348,63220) while alive. Every retained object had beforeWait258, after-child Wait0 and successful CloseHandle. Dense raw API sequences, opened handles, kernel/CIM identities, image hashes and exact required-child set passed. No firstFailure, errors or terminal-startup classification occurred in this actual run. The new classification branch remains only pure-tested and is not claimed as actual Windows acceptance. Unobserved fleeting births and universal PID/creation/OS behavior remain outside this receipt.

Quarantine receipt26ea9f264a544e0118c8ec16d9c082c85455b735dd5a12ad1da73b99ac17eb4d records owned commit fa2d52deb284d73b8afb7a56e41393087b90f684 and nine objects. Root concrete ownership/initializer/marker/manifest/ref/reflog/baseline/no-host/same-volume review passed. Wrapper23215 and phase2 child64272 exited0 after the existing no-replace move; no deletion, copy or replacement was used.

Independent restoration25910 exited0 and kept the claim held. It rehashed656 protected files including654 cookies and both workspace buffers, all13783 original Git files/exact directories, all43 original resources/20 history, five layout values, current source/package/provenance authority and the exact quarantine tree. Independently bounded zlib decoding and Git framing/SHA1 verified all nine objects. Source candidate is absent, owned host/recorded child/phase2 PIDs absent, retained handles closed. Raw original/changed workspace files remain local and unstaged.

The independently reviewed artifact-only case loader pins all42 sources, six extractor dependencies and Root pre-import review before importing project code. Its original audit and expectation bytes were independently compared with the actual Root audit, apart from the declared identity import. Root pure loader guard63996 exited0. Actual phase1 case auditor28776 and final case auditor62708 exited0; both preserve automaticClaimRelease:false. Final case audit validates actual raw before/after layout, protected/Git restoration, private before-workspace hash, original43/20 and physical settlement. Explicit separate Root release then passed, with fullScenarioAccepted:true and no live handles. Original held claim remains historical evidence.

Evidence: artifacts/grpc-terminal-native-root-run, artifacts/grpc-terminal-current-native-proof, artifacts/grpc-classified-evidence-root. Two bounded visual inspections (dark760/light1440) show no obvious overflow; this is not full UI/AT/platform coverage. Native result itself explicitly excludes OS-close lifecycle acceptance. Other migration, SDK/provider, Git remote, platform/signing/distribution/license and shared input/UX gates remain active. Next source review is the XML runtime/auditor integration; product role-alert adoption remains a separate feature requiring fresh app authority. /compact cannot be invoked here; STATUS contains the commit/evidence/gates/handles handoff.


</details>

<a id="record-current-proto36-native-acceptance"></a>

<details>
<summary>CURRENT-PROTO36-NATIVE-ACCEPTANCE</summary>

# Current Windows Proto36 native verification — 2026-10-13

The current `edbbac32` app / `f66eaa2a` closure passed the saved Proto36 scenario. Root wrapper session **41559** and native host **63144** physically exited **0**. The owned main window was hidden before CDP attachment; result mode is **native-hidden**.

The unchanged scenario body covers **36 cases**: dark/light × widths 1440/900/760 × six behaviors: first-field correction, earlier-field authority, duplicate pair correction, long error wrapping, actual Rust parser refusal and successful replacement/persist/reload. Actual replies total **30**: six parser refusals and twenty-four successes. Each profile receives one rejected base validation, successful base and side validations, an automatic refresh and an explicit unforced Load methods reply. Qualified Echo paths include the generated package; side-file methods are empty. The six toolbar geometry receipts show the actual Load methods button at the click point, including width 760.

Root independently reviewed thirty frozen source rows and twelve literal runtime dependencies. Only three imports and the facade path change in the copied helper; its whole inverse equals current helper `162b2fdb`. The root helper and historical facade remain untouched. Five current runtime modules are bound by reviewed binding `d9486fd7`; pre/post authority validates all **1,065 current sources**, emitted resources/assets, public notices, consumed/global private inputs and selected toolchain pins.

Independent live-file restoration audit passed: **654 cookies, 13,783 Git files, two workspace buffers, 43 resources, 20 history entries and five layout keys**. Both real plugin store files remain absent. Only the registered owned fixture cookie can be cleaned up. The same process object was retained while the image/hash matched and WaitForSingleObject returned 258; after scenario child exit it returned 0, the handle closed and no native host remained. The facade separately checked observed descendant exit.

Root independently rehashed the frozen sixty-one-file result-auditor offer and regenerated its complete expected map from six pinned product source inputs. Saved auditor CLI PID **53736** physically exited **0**, read seventy bounded raw receipts and accepted all 36 cases, 30 replies, six geometry groups and the independently checked restoration. Root then rechecked all receipt hashes and a fresh zero-host observation, and wrote explicit `profile-release.json`. The original held-claim receipt remains immutable historical evidence; the newer release receipt is authoritative. No live root handles remain.

Raw output: `artifacts/playwright/proto-native-fields-1791884763377`. Preservation: `artifacts/playwright/resource-manager-restoration-1791884763114`. Root receipts: `artifacts/proto36-current-native-root-run`; facade receipts: `artifacts/proto36-current-root-preservation`.

The saved helper asserts native workspace/disk equality and reload behavior, but does not serialize separate per-case raw disk snapshots or final UI option values. File inputs use CDP-injected bytes and actual File.text; this is not physical OS chooser, physical Rust entry timing, AT or universal platform proof. Those wider gates, original full gRPC, final-link/source provenance, full notices, distribution and remaining migration/UX scope stay open. Preserve the current layout; no redesign is claimed here. Commit verified work by topic. This interface cannot invoke `/compact`; STATUS supplies an explicit feature handoff.


</details>

<a id="record-grpc-compatibility"></a>

<details>
<summary>GRPC-COMPATIBILITY</summary>

# gRPC implementation and compatibility

2026-09-24. Native transport, legacy JSON and Svelte integration are implemented and directly inspected. Actual Tauri UI/IPC acceptance and full gRPC parity remain incomplete. BUILD.json is the authority for the last verified package.

## Current native contract

- `load_grpc_schema({request:{id,proto,connection,jsonMode},onStarted})` uses explicit proto input or server reflection. The required Channel receives null after registry insertion, so cancellation can retry safely. Proto input is `{entry,files:[{name,text}],includePaths}`. Names must be relative slash paths without dot/parent segments. Resolution checks exact name, explicit include directories, then built-in Google protos. No arbitrary disk/network imports. Returns base64 FileDescriptorSet and method path/input/output/streaming flags/default example. An unconstructible Any example has `exampleError` and does not hide the method.
- `connect_grpc({request:{id,connection,descriptorSet,method,body,jsonMode},onEvent})` validates the descriptor/method. Unary and server-streaming parse/send body once, then close their sending side. Client/bidi streams start with no messages. `send_grpc_message({id,text,finish:false})` sends one message; `{id,text:null,finish:true}` closes only the sending side. Call results continue until final status/error/cancel/deadline. The captured jsonMode is used for subsequent messages.
- `connection` includes URL, ordered metadata pairs, timeoutMs and optional caPem/identityPem. grpc/raw authority uses plaintext; grpcs uses TLS. HTTP/S schemes are also accepted. Host is parsed normally; method path is case-sensitive. Paths, userinfo, queries and fragments are rejected. Deadline is clamped to1ms–1hour. TLS uses webpki roots, optional CA and combined certificate/private-key PEM. No proxy or certificate-validation bypass setting is implemented.
- Events are `{event,sequence}` through a Tauri Channel: started, connected, metadata/headers, message/text, status/code/details/trailers. Every event awaits `acknowledge_grpc({id,sequence})`; acknowledgement timeout30s. Started permits cancellation retry after registry insertion. Outbound queue capacity1; sends and half-close are serialized. `cancel_http({id})` uses the shared registry and drops the live future. Registry cleanup covers ordinary terminal paths; poisoned-lock cleanup attempts all registries.
- Metadata permits128 rows/256KiB combined; names use gRPC characters, text must be printable ASCII. Protocol header overrides are rejected. Binary `-bin` input accepts padded/unpadded base64; responses split comma-joined values and normalize to padded base64. Invalid response binary values produce an error. Nonzero status retains separate grpc-status-details-bin bytes.
- Reflection uses generated v1 message types and wire-compatible v1alpha path after Unimplemented. Requests/responses are correlated, transitive imports fetched, duplicate descriptors checked, and listed services must exist in the resulting pool. Limits:1024 services/files,4096 queries,8MiB aggregate descriptor bytes. An empty service list is allowed.
- Limits:256 proto files/include directories,2MiB per source/8MiB total,8MiB descriptor and method-description budgets,4096 methods,20MiB wire and rendered JSON messages. JSON output is bounded during serialization. Local compilation runs on a blocking worker; cancelling the wait does not interrupt that worker.

## JSON modes and remaining differences

- Default `legacy` follows the archived protobuf.js7.2.4/Long5.3.2 fromObject/toObject pipeline: original field names, JS-like coercions, ignored unknown fields, defaults, decimal string longs, enum names and virtual oneof discriminators. Known Any values and WKT object forms are handled. Bytes render as numeric-key objects, matching Buffer becoming Uint8Array across Electron IPC before JSON.stringify. Int64 map keys follow the original eight-character hash representation. Proto2 required/default handling includes the original large-number rounding behavior.
- Explicit `protoJson` uses prost-reflect standard ProtoJSON parsing/WKT/base64 bytes, emitted defaults and original field names on output. Unknown input fields fail; virtual oneof discriminator fields are absent. Switching modes never rewrites saved bodies.
- Native prost-reflect continues to encode/decode protobuf; grpc_legacy.rs adapts JSON only. ryu-js supplies ECMAScript number formatting. No frontend protobuf.js dependency, eval permission or binary IPC mode was added. Reference-only libraries are under ignored artifacts/grpc-legacy-reference.
- Remaining edges: malformed/noncanonical base64 accepted by the old library may fail here; lone UTF-16 surrogates, unusual coercions/whitespace/array-like values, colliding map keys and JSON ordering need more comparison. Unknown extensions are not iterated. Reflection/custom google.protobuf.Value descriptors and unusual proto2 byte/default escapes need inspection. Multiple populated oneof members explicitly fail; the old library can encode them together. These are known differences, not full legacy equivalence.

## Svelte workflow

- September28 method presentation: package-grouped optgroups preserve discovery order and full-path values, with shortened labels/full-path tooltips and all four RPC kind labels. Retained sent messages also appear as Body/Stream N request tabs with timestamps/read-only content; selected event IDs safely fall back to Body if absent.10 inline grouping checks, Svelte0/0 and frontend build passed. Native keyboard/picker/tab interaction remains unverified. These frontend changes are newer than the last packaged BUILD.json.

- Original request layout now routes grpc_request to GrpcPane: URL, proto/reflection and method selection, body/metadata/proto/docs/settings tabs, send/cancel, client-stream Send message/Commit, unary response tabs and timestamped stream log with auto-scroll. History, metadata/trailers and JSON download reuse bounded persisted state.
- File/directory selection previews relative names before additive import into a fresh Imported protos directory. ProtoManager renders a keyed nested list with replace/refresh/delete actions. Refresh maps paths relative to the chosen saved folder, keeps IDs/unknown fields and absent old files, and validates every file in the affected root before commit. File replacement can update the basename while preserving its ID. Duplicate/file-directory collisions fail before mutation. Validation cancellation or changed saved protos discard the candidate; unrelated request edits survive. Source remains directly editable while repairing invalid legacy input.
- Subtree removal shows file count/affected requests and requires explicit in-app confirmation. All requests retain visible missing-file references after deletion. Replacement validation participates in shutdown/running tracking. Disk-save failures explicitly report in-memory changes; they are not claimed as durable. Selected top-level proto directories resolve in isolation; duplicate filenames from separate imports cannot leak across roots. Native picker/runtime directory behavior still needs verification.
- URL/metadata/body use the active environment; disabled metadata is skipped. Client/bidi initial connection skips body parsing until Send message. Global CA and exact-host TLS identity are supported; ordinary HTTP authentication/cookies/proxy are not applied. Schema cache is capped at three entries/20MiB; context hashes include relevant schema/settings/rendered values, not body. Endpoint/proto/environment/method changes cancel active calls. Local proto discovery works without an endpoint.
- Schema discovery and calls join running/completion tracking, cancellation and application shutdown. Start callbacks retry cancellation after native registration. Deleting a request cannot restore its response history after a successful close. Native-only browser guidance is explicit.

## Verification evidence

Actual source modules were compiled from Rust stdin using existing Cargo debug dependencies; Bun drove disposable loopback HTTP/2 servers with independently constructed protobuf frames. No saved test scripts were created.

- 38 protocol/wire cases:15 application calls and6 reflection streams; all four RPC shapes, multiple/zero/malformed response behavior, client half-close, fragmented frames, gzip, error status, initial/trailing metadata, binary joining/base64, schema imports, reflection v1/v1alpha and dependency fetches, response correlation, invalid inputs and dropped-call cancellation. Includes a legacy-mode bidi wire round trip with int64/bytes/Timestamp/oneof.
- 20 schema/metadata/bounds cases: Any discovery, scalar/enum/map/list defaults, unknown enum numbers, bad enum names, traversal/absolute names, malformed/cyclic imports, file/count/descriptor/message limits and metadata validation.
- 6 TLS cases: custom CA and mutual TLS successful over ALPN h2; untrusted certificate, wrong hostname, missing client identity and malformed identity rejected. Two successful TLS application calls. Synthetic RSA key was written only to a unique ignored fixture path for native OpenSSL certificate creation and removed immediately; servers were stopped.
- 97 differential legacy cases passed:81 coercion/message cases and16 proto2/WKT cases against pinned protobuf.js/Long, wire decode, structuredClone and JSON.stringify. Covers bounds, longs, bytes, enums, defaults, maps, Any and required fields; does not establish all edge parity.
- 75 frontend/workspace checks passed (including the original33), using actual Svelte-compiled workspace and grpc.js wrappers with mocked Tauri calls: context/cache, rendering, import/root isolation, streaming/half-close, cancellation registration, history deletion, shutdown and browser guidance. Added refresh/rename/merge retention, collision rejection, failed validation, concurrent saved-proto edits, independent request edits, subtree removal, save failure and cancellation/shutdown during validation. Real compiled Rust modules supplied schema compilation for valid refresh, broken unchanged-service dependency rejection and rename. This does not verify real IPC.
- Final Svelte check0/0, Prettier and git diff --check passed. Native source is unchanged from the prior clippy -D warnings/fmt checkpoint; earlier dependency regression checks passed89 ASAP plus14 manual-auth/Digest/OAuth1 cases. No saved test scripts. Current proto-manager snapshot artifacts/grpc-proto-source-snapshot.json contains178 files; packaging outcome is recorded separately in STATUS/BUILD.json.

## Remaining acceptance

Verify Tauri command ACLs, acknowledgement/backpressure and race cleanup through real IPC; direct helpers do not cover those. Compare imported messages and real service/reflection behavior, proxy/platform edges, reload/history and preserved layout, including proto management and method/sent tabs. Reflection sample generation is implemented with the deliberate oneof/bytes/visit corrections documented in GRPC.md#record-grpc-inventory. Finish shared editor/template support and JSON edges above. Archived local proto discovery does not supply examples; current local defaults are an extension. The original dropdown has no search control or protobuf-specific completion prop (GRPC.md#record-grpc-inventory). September28 CUA recheck exposes no apps/browsers. Full migration remains active.

Official sources and dependency commands: GRPC.md#record-grpc-inventory and COMMANDS.md. No external provider, installed legacy profile, publication or commit was touched.

## Reflection examples — September28

Reflection discovery now produces bounded, parse-validated legacy samples; local-proto defaults remain unchanged. Ordinary values follow archived automock, including UUIDs, enum declaration order and repeated/map samples. Oneof chooses one declared member; bytes use arrays; over-visited optional fields are omitted. Required-recursive and unrenderable Any examples surface exampleError without dropping methods. ProtoJSON conversion uses existing native serialization. Limits: four visits per field-name/full-type-name, depth16,1024 visited fields,128KiB conservative estimate and actual output cap.

15 native cases passed with wire roundtrips for successful samples, plus5 archived automock comparisons and5 independent protobuf.js wire decodes. Native clippy -D warnings passed. No saved inspection scripts; the ignored helper executable was compiled from Rust stdin. Package result and source fingerprint are recorded in STATUS/BUILD.json. This does not establish real Tauri IPC or exact parity with malformed archived examples.

Release checkpoint: session46089 exited0, Rust release5m29s and NSIS packaging passed. All179 source hashes matched snapshot4fc81a205bcd2b91815b6083e57b49791ed6dac628bf8a162b57ba07270456cb. BUILD.json updated; installer not executed/published. No active operations remain.


</details>

<a id="record-grpc-inventory"></a>

<details>
<summary>GRPC-INVENTORY</summary>

# gRPC migration starting inventory

Updated 2026-09-24: native core, legacy JSON adapter and Svelte/resource integration implemented. 64 native,97 legacy differential and33 mock-IPC checks passed. PARITY remains PARTIAL; native UI/IPC and remaining compatibility are not verified. See STATUS/BUILD.json for packaging.

## Proto management implementation and remaining acceptance

Re-read archived ui/components/proto-file/proto-file-list.tsx and network/grpc/proto-loader.tsx during release packaging. The original renders nested directories/files, re-discovers top-level directories, re-uploads individual files and deletes directories. Re-upload preserves the file ID while replacing basename/source after validation. Directory refresh merges existing names and adds new entries; it does not remove old files missing from the chosen directory. The old descendant lookup is broader than immediate children; do not reproduce accidental cross-directory matches.

1. IMPLEMENTED: ProtoManager.svelte nested saved browser in GrpcPane, per-file replace and per-directory refresh/delete. Directory rename is not evidenced as an original control in this list.
2. IMPLEMENTED: explicit bounded selection, relative-path preview, root-relative refresh into the selected directory, ID/reference/unknown-field/absent-file preservation. Reject duplicate/path/type collisions before mutation. Compile every file in the affected candidate root through load_grpc_schema before committing replacements; editable invalid imported legacy sources are retained. A dependency change cannot commit if an unchanged service no longer compiles.
3. IMPLEMENTED: subtree deletion shows descendant-file count and affected requests, with explicit confirmation. Requests retain visible missing references; context changes cancel calls. Replacement validation joins shared shutdown/cancel tracking and checks a saved-proto fingerprint before commit, preserving unrelated request edits. Persistence failure is reported as an in-memory change that is not saved.
4. DIRECT INSPECTION PASSED:75 compiled-workspace/model checks including the previous33; native Rust compiler used for successful refresh/rename and broken-dependency rejection. Svelte0/0, formatting and frontend build passed. No saved test scripts. Actual native selection/reload/layout/IPC remains pending; package state is in STATUS/BUILD.json.

Official sources read before this step: https://svelte.dev/examples/file-inputs (file bindings), https://svelte.dev/docs/svelte/each (keyed lists), https://v2.tauri.app/develop/calling-rust/#channels (existing compiler invocation), https://v2.tauri.app/plugin/dialog/ (multiple/directory picker) and https://v2.tauri.app/plugin/file-system/ (scoped reading). HTML File inputs provide bounded explicit reads; native absolute paths are not required merely to refresh saved resources. No new permissions/dependencies were added.

## Method presentation and reflection examples implemented

Read ui/components/dropdowns/grpc-method-dropdown/grpc-method-dropdown.tsx, the body section of grpc-request-pane.tsx and main/ipc/automock.ts during proto-manager packaging. The original groups methods by package, shortens displayed paths to /Service/Method when a package exists, retains the full-path tooltip and shows the four streaming-type tags. This dropdown source does not implement a search field; previous generic references to method-search were not evidence of a required legacy control.

The original body uses the shared CodeEditor with JSON mode, Nunjucks support and prettify; no protobuf-specific completion prop is passed here. Common editor/template completion remains part of the wider editor/template migration. Sent client messages appear as timestamp-ordered Stream N tabs. As of September28, GrpcPane has Body/Stream N tabs with read-only sent content and timestamp; the bounded Sent log remains available. Native UI acceptance is pending.

The example action replaces body only when clicked. Local-proto examples serialize an empty dynamic message with defaults. Reflection now uses the bounded generator described below. Original automock instead supplies sample scalar values (Hello, true, numeric values by scalar kind), one repeated item, nested/map examples, first numeric enum and UUIDv4 for string names beginning/ending in id. It has a shared per-name/type visit counter and skips directly self-recursive fields. Its map/oneof and Buffer examples can be unsendable after JSON conversion; inspect the exact main/ipc/grpc.ts example-return path and compare fixtures before deciding how to retain useful original behavior without creating invalid messages. Do not change request bodies automatically on schema load or method selection.

September28: implemented package grouping/short-path/full-path tooltip/type labels in Svelte using keyed optgroups;10 inline Bun cases and Svelte0/0/frontend build passed. Sources read before editing: https://svelte.dev/docs/svelte/each and https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/optgroup . Actual native dropdown/tab interaction remains pending.

Further archived evidence from main/ipc/grpc.ts: local loadMethods returns only type/fullPath (lines60–68); reflection constructs mockedRequestMethods[methodName](<>).plain (line106) and forwards example (line128). Thus legacy samples apply to reflection. Current native empty-message defaults also offered for local proto are an extension, not an original equivalence claim.

September28: grpc_example.rs implements reflection samples, validated through the legacy parser before optional ProtoJSON rendering. First declared oneof member and byte arrays intentionally correct unsendable archived examples; over-visited optional fields are omitted. Full type names prevent collisions. Limits are four visits per name/type, depth16,1024 fields and128KiB. Failed examples keep method discovery usable with exampleError.15 native cases and5 archived comparisons/independent wire decodes passed. Local-default extension remains unchanged.

Next: shared editor/template migration and real sent-tab interactions, then JSON adapter edges/native acceptance. Official sources read before edits: https://docs.rs/prost-reflect/latest/prost_reflect/struct.FieldDescriptor.html , https://docs.rs/prost-reflect/latest/prost_reflect/struct.MessageDescriptor.html and https://docs.rs/uuid/latest/uuid/struct.Uuid.html#method.new_v4 . Existing uuid dependency already supports v4.

## Original evidence

Paths relative to `_backup/legacy-electron/packages/insomnia/src`:

- `models/grpc-request.ts`: GrpcRequest / greq; name, URL, description, protoFileId, protoMethodName, body.text, metadata rows (name/value/description/disabled), metaSortKey, isPrivate. Default body is `{}`. No ordinary HTTP authentication field is defined here; metadata/rendering must be inspected before sharing HTTP auth behavior.
- `main/ipc/grpc.ts`: start/sendMessage/commit/cancel/closeAll, method discovery from saved proto files or server reflection; unary, client-streaming, server-streaming and bidi are all explicit method types. Reflection carries enabled metadata and selects TLS using parseGrpcUrl. Original protobuf loader uses keepCase, longs as strings, enum names, defaults and oneof flags. Its JSON representation needs deliberate mapping; standard protobuf JSON is not automatically equivalent.
- `network/grpc/proto-loader.tsx`: validate/import/update individual files and recursive .proto directories into saved protoText records; write-proto-file reconstructs the saved hierarchy. Inspect remaining file/import-resolution code before porting. Do not treat arbitrary external filesystem imports as already authorized by a resource reference.
- Additional inventory paths located: models/proto-file.ts, proto-directory.ts, grpc-request-meta.ts; network/grpc/parse-grpc-url.ts, write-proto-file.ts; ui/components/panes/grpc-request-pane.tsx, grpc-response-pane.tsx; proto-file/proto-file-list.tsx, buttons/grpc-send-button.tsx, main/ipc/automock.ts. Their contents still need detailed review.

## Official starting sources

- https://docs.rs/tonic/latest/tonic/client/struct.Grpc.html — returned tonic0.14.6; generic dispatcher takes a codec/path, supports all four RPC styles and separate encoding/decoding size limits.
- https://docs.rs/prost-reflect/latest/prost_reflect/ — runtime descriptors/DynamicMessage candidate. Compare serde options and well-known types to original loader behavior.
- https://docs.rs/protox/latest/protox/ — Rust proto compiler candidate; inspect in-memory resolver and version compatibility with prost-reflect before adoption.
- Guessed https://github.com/hyperium/tonic/tree/master/examples/src/dynamic failed to open. Find an actual maintained working dynamic client/example rather than assuming this path exists.

## Work sequence

1. Complete archived request/response/proto/import/rendering/status/trailer/cancellation/close inventory. Map preserved imported resource types into current collection tree without dropping legacy records.
2. Inspect official working dynamic-client and reflection examples, crate versions/features and TLS/proxy transport configuration. Use documented cargo info/add only after deciding compatible packages. No Node gRPC sidecar or code generation runtime.
3. Implement native descriptor/proto compilation and reflection, bounded request/response codecs, metadata (including binary metadata), statuses/trailers and all four streaming lifecycles. Reuse cancellation/shutdown/Channel flow control where appropriate; an HTTP request body is not a replacement for gRPC framing.
4. Port original request/proto/service-method/response UI into Svelte JavaScript, with collection persistence, imports and environment rendering.
5. Inspect real compiled native code against disposable local service/reflection fixtures, then Tauri UI/IPC/TLS/reload acceptance when a surface is available. Do not create saved development test scripts without owner request. Update PARITY/STATUS with exact evidence and gaps.

## Native implementation

- grpc_schema.rs: protox0.9.1 memory-only resolver, explicit include directories plus Google well-known types; prost-reflect0.16.5/prost0.14.4 dynamic codec. Up to256 files,2MiB each/8MiB aggregate,4096 methods,20MiB protobuf/JSON messages. No external protoc or filesystem import resolution. Default legacy mode delegates JSON adaptation to grpc_legacy.rs; explicit protoJson remains available. Known edge differences are in GRPC.md#record-grpc-compatibility.
- grpc_transport.rs: tonic0.14.6 channel with TLS roots/optional CA/identity; four RPC shapes through generic streaming dispatch with schema cardinality checks. Text/binary metadata, statuses/trailers, gzip decoding. Reflection v1 with Unimplemented fallback to v1alpha and bounded transitive descriptors. Protocol header overrides rejected. No proxy or disabled-certificate-validation option yet.
- grpc.rs: load_grpc_schema/connect_grpc/send_grpc_message/acknowledge_grpc; shared cancel_http network registry and deadlines. One outbound queued message; each incoming event awaits sequence acknowledgement. Finish only closes the sender. Local proto compilation runs on a blocking worker; cancellation stops waiting but cannot interrupt an already running compiler thread.
- Official sources additionally read: https://docs.rs/protox/latest/protox/struct.Compiler.html , https://docs.rs/prost-reflect/latest/prost_reflect/struct.DynamicMessage.html , https://docs.rs/tonic/latest/tonic/struct.Streaming.html , https://protobuf.dev/programming-guides/json/ , https://github.com/grpc/grpc-proto/blob/master/grpc/reflection/v1/reflection.proto and v1alpha/reflection.proto . Installed crate source confirms generated reflection types are available without server feature.
- Final clippy/fmt and Svelte check passed. Protocol/TLS, differential and mocked-IPC evidence is in GRPC.md#record-grpc-compatibility. Tauri IPC/UI remains unverified; BUILD.json records the last verified release separately from source progress.

## Frontend and JSON decisions (implemented)

1. Read protobuf.js official README, ext/README.md and src/type.js before choosing an adapter. Dynamic Type generation uses util.codegen; the WebView retains strict CSP. Implemented a native JSON adapter around prost-reflect encoding, with explicit legacy/protoJson modes. No production protobuf.js dependency or binary IPC mode was added.
2. Compared pinned protobuf.js7.2.4/Long5.3.2 source and behavior, including Electron structured clone. Installed those packages only under ignored artifacts/grpc-legacy-reference using Bun --exact --ignore-scripts. Added ryu-js1.0.3 through documented Cargo commands for JS number formatting. 97 differential cases passed; edge differences remain explicit.
3. Added grpc-model.js/grpc.js/GrpcPane.svelte; connected model.protocolFor, addRequest, execute and page routing. Saved hierarchy is retained; imports are additive with relative-path preview and root isolation. ProtoManager/proto-management now add tree/replace/refresh/delete workflows. Shared editor/template support and original method grouping/example behavior remain open.
4. Registered discovery/calls in workspace.running/completions, rendered environment-dependent inputs, serialized Send/Commit and added schema cache/context invalidation. Immutable method/config snapshots and context changes prevent sends through stale connections. Required onStarted/started Channel notifications close the cancellation-registration race. Browser guidance requires desktop execution.
5. Next: inspect native UI/IPC/ACL/backpressure/reload and original layout; close JSON coercion/WKT/extension edges and shared editor/example/method-grouping parity. Keep other PARITY work moving if no UI surface is available.

Additional official sources read before these changes:

- https://raw.githubusercontent.com/protobufjs/protobuf.js/protobufjs-v7.2.4/src/converter.js and wrappers.js — pinned fromObject/toObject and Any behavior; installed field.js and Long5.3.2 source supplied defaults/coercion details.
- https://docs.rs/prost-reflect/latest/prost_reflect/enum.Value.html and struct.FieldDescriptor.html — dynamic values/defaults.
- https://docs.rs/ryu-js/latest/ryu_js/ — ECMAScript number serialization.
- https://www.electronjs.org/docs/latest/tutorial/ipc and api/ipc-renderer — structured-clone IPC semantics.
- https://bun.sh/docs/pm/cli/add — exact and ignore-scripts flags.
- https://v2.tauri.app/develop/calling-rust/#channels and https://svelte.dev/docs/svelte/$derived — native channels and derived UI state.

## Follow-up inventory during ES512 packaging

Read the remaining main/ipc/grpc.ts: unary/server streaming send an initial JSON body; client/bidi start an empty outbound stream, accept explicit sendMessage actions and then commit to close only the sending side. All support cancel/closeAll. Response data, final status/details/metadata, errors and end are separate events. Preserve that distinction and clean up every terminal path. The old nextTick write workaround and incomplete error cleanup should not be copied literally. Metadata rows retain order and disabled flags; binary metadata needs explicit treatment because the original passes strings.

parseGrpcUrl lowercases input, strips grpc:// for plaintext or grpcs:// for TLS, and treats an unprefixed address as plaintext. Preserve service/method case in the migration. The original native client uses createSsl defaults or createInsecure; this path does not pass the HTTP custom-CA/client-identity settings.

write-proto-file reconstructs saved trees in a temporary cache and uses every created subdirectory as an include directory, making sibling-name resolution potentially ambiguous. ProtoFile stores name/protoText; GrpcRequestMeta stores pinned/lastActive. Prefer a bounded in-memory resolver if supported, preserving saved hierarchy and validating imported names.

common/render.ts renders the request with description separately and optional skipBody, then each client-stream message independently. grpc-response-pane shows unary responses in tabs and streaming responses in timestamped stacked JSON editors with auto-scroll and a status/details header. The request pane resets transient responses on request/environment/Git changes and has method/proto management. Detailed controls/template completion still need mapping.

Official working reference located and read: https://github.com/grpc/grpc-rust/blob/master/examples/routeguide-tutorial.md and https://raw.githubusercontent.com/grpc/grpc-rust/master/examples/src/routeguide/client.rs . It demonstrates all four RPC forms and documents cargo run --bin routeguide-server / routeguide-client; these commands have not been executed here. It uses generated messages, so dynamic descriptor/codec mapping remains separate work. Also read https://docs.rs/protox/latest/protox/struct.Compiler.html . tonic-reflection0.14.6 top-level docs expose generated pb types and the server module; guessed v1 client pages did not resolve. Inspect installed source before assuming a generated reflection client is exported. The old Granc client source path returned404 and must not be treated as a working reference.


</details>

<a id="record-grpc-method-containment-root-acceptance"></a>

<details>
<summary>GRPC-METHOD-CONTAINMENT-ROOT-ACCEPTANCE</summary>

# gRPC method selector containment

Root integrates the reviewed seven-file offer after closing the old32e diagnostic phase with v10's verified restoration. Open selection acceptance remains required against the next current executable. The old executable and raw proofs remain historical evidence.

GrpcPane now clips its method toolbar's shared select paint to the constrained selector box. At760px the long Proto filename previously intercepted the Load methods click. The existing layout, shared Select component and data flow remain unchanged. The default saved scenario gains the optional component entry; its Proto native helper compares integer scrollWidth with integer clientWidth and captures the original unforced click geometry. Root preserves the unrelated preview helper WIP unchanged at5493d7352111fa95cd70ec41babf766045e106771f7f9cf6f29cd313aa8cabc7.

Exact candidate and root-before guards passed before adoption. Root compiler82964 found three missing callback annotations;21827 found four DOM union/null typing errors after an overly narrow annotation. Root corrected only diagnostic JSDoc callback types. Final compiler84285 ended0 with zero errors/warnings. No runtime action or assertion was relaxed.

Saved command `bun tests/ui/nocturne-grpc-theme.js --grpc-layout-component` ended0. Root geometry receipt has12 dark/light×1440/900/760×short/long cases, unforced click, keyboard focus, picker preservation and unchanged data; component fixture uses shared launchUiBrowser headless:true. The dark760 screenshot was inspected. `bun tests/ui/design-system.js`, session61161, ended0 and its saved result reports passed. These are component/shared verification, not native Proto36 acceptance.

Evidence: artifacts/ui-seven-root-adoption/adoption.json; artifacts/playwright/grpc-method-layout/{result,geometry}.json; artifacts/playwright/design-system/result.json. Fresh source capture/build and actual native Proto36/current Open/TLS/original gRPC remain required alongside every original parity, platform, notice/linkage, distribution and migration/UX gate. The interface cannot invoke `/compact`; STATUS records the topic commit and explicit handoff.


</details>

<a id="record-grpc-rendering"></a>

<details>
<summary>GRPC-RENDERING</summary>

# gRPC render integration

## gRPC shared renderer integration — 2026-09-29

- gRPC discovery/call preparation now scopes the collection and renders URL/metadata through the shared Send session, including prompts and finite HTTP dependencies. Unary/server-streaming messages render after method discovery; client/bidirectional messages render on each explicit Send. Discovery and half-close do not evaluate message bodies.
- grpcConnection/grpcSchemaRequest/grpcContext/grpcBody accept explicit resolved inputs, avoiding a second interpolation of literal output. Existing synchronous composition remains for compatibility. grpcSourceContext supplies a noninteractive hash for UI/stale-call checks; excludes this request's body/method/modified fields so editing a streaming message remains possible. Method changes are checked separately.
- Schema cache stores both raw source context and resolved connection context. Repeated templates that resolve differently force discovery again. Metadata/environment/proto/settings changes discard stale preparations or close live calls; conservative changes to other source resources also invalidate. External dynamic inputs/history are not replayed during UI context checks.
- Client-message operations track shutdown completion, follow the connection signal, reject changed/closed/replaced runs before dispatch and clear sending state. Status/completion aborts pending render work. No native schema/codec/transport logic changed.
  -40 inline assertions passed:15 compiled gRPC/mocked-native cases (reflection, cache, unary, skipped discovery body, prompt Cancel, client messages/half-close, Stop, changed endpoint, dynamic metadata dependency, cleanup),7 composition/source checks (legacy compatibility, resolved literals, local proto and body/context edits),11 WebSocket regressions and7 OAuth introspection regressions. Svelte0/0, Vite build and git diff --check passed. A pure-probe tool call had a quoting syntax error before execution; corrected and rerun. No saved test scripts/new dependencies/native edits/installer; workers0, no real-user-state writes.
- Read official grpc.io core-concepts/reflection docs and archived grpc-request-pane.tsx getRenderedGrpcRequest/getRenderedGrpcRequestMessage/reflection interpolation before implementing. Existing subsystem reused; no generator needed. Bun directly runs Prettier, svelte-check with existing flags and vite build; git diff --check. Hidden node_repl program launch rules retained.
- Real WebView/native gRPC wire/proto/codec and call-end cancellation acceptance remains pending; mocked native checks prove frontend composition/lifecycle only. Source newer than BUILD.json. Next: streaming dependency completion and remaining stream behavior, native cookie/User-Agent/URL parity, then full runtime/UI/platform/packaging acceptance and other PARITY gaps. Full migration incomplete.

Official references consulted before implementation:

- https://grpc.io/docs/what-is-grpc/core-concepts/
- https://grpc.io/docs/guides/reflection/


</details>

<a id="record-proto-clientwidth-native-checkpoint"></a>

<details>
<summary>PROTO-CLIENTWIDTH-NATIVE-CHECKPOINT</summary>

# Compatible native Proto measurement and exposed layout failure — 2026-10-13

Root independently reviewed the29-file13e11af candidate and exact three-segment inverse to diagnostic aa4/whole077 saved helper. The new runtime-only cb92 helper captures clientWidth and compares scrollWidth<=clientWidth, with strict fractional parent containment and every original36 Field/Rust/data/persistence/reload assertion retained. Six agent guards distinguish real1px/50px overflow, parent escape/missingparent and the actual1082.796875/1083 valid measurement. Product/CSS/root077/8fc/compiled1046 source bytes and executable32e449/closure9c58/currentab928 remained unchanged. This artifact supplement does not yet replace the durable default helper.

Actual serial native-hidden root30393 ended1 after17 rows. Integer bounds pass on dark1440/900/760; full first two profiles include real malformed-parser/global-error and successful replacement/native persistence/reload/methods. The third profile completes five rows and successfully replaces/reloads the source, then unforced Load methods clicking times out because the Proto source Select intercepts its pointer. Raw call log records116 retries with the production Select subtree. No force click, keyboard substitution or CSS mutation bypassed this failure. Full36 acceptance and light profiles remain unverified.

Final passive trace has14 real observed Rust schema replies:3 exact published-parser rejections and11 successes. Three successes intentionally compile the side-only Extra message and have no services; eight base replies expose the exact package-qualified /owned_UUID.Sample/Echo. The17-row interim case snapshot contains11 replies and is retained separately; final trace14 is authoritative. Root auditor first wrongly expected all successful replies to expose Echo, then used an unqualified /Sample/Echo suffix. Both reviewer refusal source bodies are preserved; exact closed entry-specific side/base expectations and package-qualified method are corrected. A transform string quote mismatch also refused before write. No scenario assertion/result/product was changed by these reviewer corrections.

Independent postterminal raw audit58815 passes all17 row counts, three compatibleinteger receipts,14 real replies/source identities, originaldiagnostic hashes, current source/private/public/exe closure, full13783 Git reread and protected654 cookie file-set/bytes,43resources/20history and current3/legacy2layout restoration. Native host53124 exited0, claimreleased, no live root handles. Evidence: artifacts/proto-clientwidth-native-root-run/refusal-restoration-audit.json, final proto-native-trace and three raw before-assert geometry receipts referenced there. The new760 product CSS defect remains an authoritative negative, not accepted workflow evidence.

UIagent reproduces the real GrpcPane Select paint/hit overflow in a saved headless actual-component fixture and prepares a minimal local clipping rule with normalgeometry/keyboard/popup/shared regression checks. Root must independently review/adopt the production fix, migrate the corrected default helper, compile/build a fresh current source/resource closure and rerun actual36. Native Open controls need separate read-only semantic identity evidence; future tauri supplemental policy5 remains isolated. Full Open/Proto36/originalgRPC/OS/AT/platform/private/fullnotice/linkage/distribution/fullmigration/UX and all original gates remain open. /compact cannot be invoked here; explicit topic/status handoff follows.


</details>

<a id="record-proto-focus-root-acceptance"></a>

<details>
<summary>PROTO-FOCUS-ROOT-ACCEPTANCE</summary>

# ProtoManager Cancel focus acceptance — 2026-10-13

`ProtoManager` now restores the originating file picker's focus after Cancel removes the focused button, while request/data/collection/epoch/component ownership remains current. It waits for Svelte's public tick, requires the original input to remain connected/enabled, and only restores while focus is BODY. A new operation, another focus target, navigation, replaced data, tab removal or component disposal retires the continuation. Existing file reads/work-scope disposal/persistence/error handling and CSS declarations retain their behavior. Source newline normalization changes CRLF to LF; this is not byte-identical CSS, although normalized CSS text and all six normal geometry/font/color/background observations match exactly.

Independent root review rehashes the agent's290-file manifest `4eef3d3e`, immutable prior285-file/102-receipt measurement `f4035351`, and the actual keyed-parent fixture. All twelve historical Enter-Cancel→BODY failures remain archived. Generic read/backend errors and invalid filename/rename rollback diagnostics are separate from this focus correction. No global File.prototype/Tauri/IPC/provider replacement is used; only owned File instances control pending/rejected reads, with real browser workspace persistence.

Root session `38104` finished0: compiler0errors/0warnings, SAME saved `bun tests/ui/nocturne-grpc-theme.js --proto-component`138 receipts, full shared-controls scenario and frontend build all0. Independent `artifacts/proto-manager-focus-root-proof/root-audit.json` checks all original102 categories, twelve exact-picker focus positives,36 same-task scripted no-steal controls, six exact normal geometries,1019 frozen current inputs, current frontend assets and unchanged `ea21bd83` notice authority. Source inventory `d523cf3f` retains65 Svelte files/745 shared markup sites/119 tokens/1894 CSS declarations, no duplicate imports or multiple token owners.

Only ProtoManager product code changes; four reusable test entry/fixture/helper paths provide the additive component branch while preserving the full original native gRPC scenario. The root preview helper's existing unrelated WIP remains untouched. Initial root review incorrectly normalized only one side of the before-source comparison, then demanded raw CSS bytes; both refusals occurred before adoption and are retained. Correct both-sided LF comparison and explicit raw newline acknowledgement resolve those review mistakes.

Bounded component/browser evidence does not close native gRPC, real OS read faults, held backend apply/remove, physical-user timing, AT, other platforms or full-pane workflows. Invalid preview-path Field association/stale validation feedback remains open. The accepted `7fa8` native certificate generation predates this Proto delta; do not claim it contains this correction. Full migration/UX and all original notice/platform/distribution/private/SDK/Event/FIFO gates remain open. No live handles or native/profile claim; `/compact` is unavailable, so STATUS records the explicit feature handoff.


</details>

<a id="record-proto-pending-fields-root-acceptance"></a>

<details>
<summary>PROTO-PENDING-FIELDS-ROOT-ACCEPTANCE</summary>

# Pending Proto filename fields accepted on root — 2026-10-13

Invalid pending filenames now own their existing Field error descriptions. Duplicate names mark the authoritative pair with distinct IDs/descriptions. Correcting an owned condition clears its feedback, while unrelated generic context/read/backend/rename/topology errors remain global. The actual model's private WeakMap brands only the existing filename Error object; a read-only lookup rejects strings, clones and lookalike errors. Existing message/order/count/UTF8 size/collision semantics remain intact. Submitted values and request/data/epoch/component lifetime own the feedback. Editing runs the complete actual validator and retains/updates only the same issue kind/rows; changed earlier authority retires the old owner without publishing another unsubmitted error.

Caption-free Field composition preserves indexed names and normal input geometry. Feature-local display:contents and the existing five-pixel margins retain layout. A local block/overflow-wrap:anywhere rule fixes the actual900-character error that previously extended to5536px; all six profile bounds now fit. Shared Field defaults/density/backend/quota/persistence are unchanged. Only ProtoManager and grpc-model product files change, with three reusable saved test helpers and the isolated report.

Independent root review checks313 agent proof files, raw root-before guards, immutable174/30RED and the long-error/compiler negative. Root session35406 finishes0: compiler0errors/0warnings, SAME saved `bun tests/ui/nocturne-grpc-theme.js --proto-component`216 UI receipts and16 actual-model guards, full shared controls and frontend build all0. `artifacts/proto-pending-fields-root-proof/root-audit.json` verifies original174 categories plus42 authority/lifetime/global-feedback/wrapping receipts, all30 previous ownership failures corrected, six normal panel/control and12 valid pending-input metrics exactly preserved. Existing twelve Cancel focus positives and36 no-steal controls remain.

Current1022 source/report inputs are frozen; frontend assets and complete saved component/shared outputs are archived. Actual dark760 invalid-path screenshot was inspected: one error below its red-border input, preserved surrounding layout. UI inventory98ef69fb retains65 Svelte files/119 tokens/18 scoped feature styles, now746 shared markup sites and1897 CSS declarations (one Field site/three local declarations added), with no duplicate imports or multiple token owners. Current352f9d7f notices remain validated; no collection/native launch/profile claim occurs for this UI feature.

Actual native gRPC/schema replacement, OS/read faults, held backend apply/remove, AT, other platforms and full production-pane workflows remain open. Earlier7fa and1019 Open preparation precede these source changes; fresh final-source binding/build is required. Full migration/UX and original SDK/Event/FIFO/private/platform/distribution/notice coverage remain open. Handles:none. `/compact` is unavailable; STATUS records the explicit feature handoff. [Isolated implementation and proof contract](GRPC.md#record-agent-proto-pending-fields-fix-20261013) describes the exact owner policy and retained negatives.


</details>

## Current large sent-event retention correction

### gRPC large sent-event retention correction — verified utility scope 2026-10-15

Found a concrete shared-retention defect: sendGrpcMessage appends kind:sent/text, but appendStreamEvent treated only SSE/received-message kinds as payloads. A9MiB sent JSON event followed by status was removed entirely (sent0/kinds[status]/dropped1). Classify sent as a payload too, preserving the newest large outgoing gRPC message through metadata/status/error; a newer sent or received payload replaces the exception, while8MiB surrounding metadata and1000event limits remain. Native codec/transport and UI rendering are unchanged.

New bug regression tests/stream-retention.js exercises8groups: sent/message/SSE terminal retention, sent→small sent/received replacement, metadata byte/count budgets and WebSocket pong/close retention. artifacts/grpc-sent-retention/audit.json executes the same test against actual prior HEAD utility (only baseline model import redirected to unchanged real model) and current source: REDexit1/0!==1, GREENexit0/all8. Compiler97504 exits0/0errors/0warnings; strict test JS, formatting, frontend build and existing saved headless SSE raw history pass. This proves the pure retention behavior, not native gRPC wire/IPC/UI. Current source is newer than native candidate websocket-large-ui-attempt-1; its binary does not contain this correction. Native large outgoing gRPC interaction/history/reload remains required before claiming that lane verified. No live handles. Next actual gRPC large sent/response and JSON/shared-editor compatibility, plus remaining PLAN/PARITY. Full migration incomplete; /compact unavailable, explicit handoff.

## Current native large sent history

### Native large gRPC sent history — verified bounded milestone 2026-10-15

Actual native bidi Connect/Send message/Commit passes in legacy and protoJson modes. Each seeded JSON body9437196bytes contains9MiB ASCII string; independent peer verifies the exact single uncompressed protobuf/gRPC frame9437194bytes/SHA20e4312047ea3958e724fc1d8c597e348373fe63f73eb8151f6b1e1ffc613b86. Peer returns headers/trailers/status0 with no response payload, so sent remains the newest payload. Full sent text/body SHA b4ba1059bc599eb84729ca2517769eb0e5cca038d7a913f1bbc27239f045bc18 survives terminal persistence/exact reload; Stream1tab exists before/after reload. Requests are deleted through actual Manage/Delete and histories cannot resurrect; original histories remain exact. This provides bounded native acceptance for d0985b1 retention correction, superseding its prior pending statement only for these cases. Large sent-tab content rendering/editing, full response payloads/JSON edge semantics, provider/platform remain unverified.

Fixture tracks actual HTTP2 streams/sessions/socket tuples. Initial smoke reset before payload; removing event-order assumptions with the existing tuple-observer pattern gives exact9MiB/status0/1stream-session-socket smoke acceptance. Two actual native raw socket ECONNRESET events are retained and classified only for linked streams with exact verified request bytes, response finish/trailers/close before error and rstCode0; no force, FIN/physicalTCP or broader terminal-classification claim. Native UI watchdog never fired. First continuation63226/receipt1792065304943 reaches Legacy wire/history/reload then fails an absent direct Delete request control (gRPC uses Manage). Host2876 exit0/restoration1792065304713 exact/postclosure pass. One test-only deletion-route correction is explicitly hashed in v2-scenario-supplement.json; original source manifest/binary retained, no application drift/assertion relaxation.

Fresh candidate grpc-large-sent-attempt-1 build31612 exits0/Rust7m13, exeSHAb8f94d97cb0c5069bc5ca2214db97aa0383b6e74cd249f879eb3c56fa5971ff9, originalmanifestSHA23233aa5b58a3ee7652871840331e57ce5918c37f5a236c6cf46b14e2a047b9a. V2suite83819 exits0: gRPC1792065547558=2/largeWS1792065595017=3/SSEexact1792065636322=6/SSE1792065691820=8/WS1792065708933=6/mixed1792065720161=5. Hosts51704/59412/17708/58816/53404/36496 exit0/native-hidden; exact6original profiles restore. Original1410source/1319regular rows/all other source/package/private/tool/asset scopes close with exactly1declared test override. audit-acceptance-v2.mjs independently reconstructs wire prefix/JSON hashes and checks original manifest/executable, source supplement, receipts/profiles. Artifacts: artifacts/native-resource-crud-audit-probe/grpc-large-sent-attempt-1/. Strict3scenario-file JS/Prettier pass. No new production edit beyond d0985b1 and no live handles. Next large gRPC display/shared-editor and JSON compatibility variants, plus all remaining PLAN/PARITY. Full migration incomplete; /compact unavailable, explicit handoff.

Official references consulted before fixture implementation: [Bun HTTP2](https://bun.sh/reference/node/http2) and [Tonic dispatcher](https://docs.rs/tonic/latest/tonic/client/struct.Grpc.html).
