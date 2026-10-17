# PLUGINS migration

## Windows clipboard NUL admission — 2026-10-17

Plugin app.clipboard.writeText now reuses the native Copy validator through copyText for worker calls. Native event admission checks the same validator before returning a clipboard capability; the Rust guarded_mutation entry also rejects Windows NUL text before reading probe state or dispatching the ordinary clipboard API, so direct event POSTs cannot bypass the host check. CF_UNICODETEXT terminates at NUL; refusal prevents a successful-looking partial write. Clear, reads, owner/cancellation checks and non-Windows/browser paths retain their existing behavior. No new permissions, dependencies or native commands.

Direct Bun checks execute the actual createPluginNativeAppEndpoint with controlled native clipboard adapters: worker NUL rejection and event-admission rejection produce zero writes; complete Thai text passes; other-host/browser NUL dispatch remains unchanged; aborted owners cannot write. bun run check0errors0warnings; cargo check --locked0 (~3s; five existing dependency warnings); sequential bun run build0; rustfmt applied. No new test files/scripts/native release build or OS clipboard/profile mutation. Actual native event rejection/runtime/platform/full plugin parity remains open; current native binary predates this guard.



Updated 2026-10-14. Current ESM26, native event10, metadata9/restart and guarded clipboard receipts pass their bounded scope. Full legacy plugin/context/DOM/provider/platform compatibility remains open.

See [current status](STATUS.md), [execution plan](PLAN.md) and [complete parity requirements](PARITY.md). No original scope was removed by consolidation.

## Reload explicitly loaded plugins — 2026-10-16

Ctrl/Cmd+Shift+R now reloads previously ready plugin sessions through the existing registry. It closes old sessions, clears discovery, rereads packages and repeats normal admission with fresh snapshots. Other discovered packages are not automatically executed. Concurrent reload calls share one promise; each plugin failure is recorded while remaining plugins continue. Workspace/path/readiness changes cancel the operation and old callbacks remain invalidated. The page reports current-owner errors and retains all existing keyboard admission/modal guards; Preferences lists the shortcut.

Contract: archived common/hotkeys.ts plugin_reload and existing explicit registry admission. Inline Bun assertions against the actual registry with controlled adapters pass fresh revision2snapshots, old-session close, one discovery per reload, shared concurrent promise, unloaded-package exclusion, partial failure and changed-owner cancellation. This is registry-layer evidence, not native package execution/OS-keyboard acceptance. Compiler75507 exits0/0errors/0warnings; build exits0. No new test/artifact scripts/dependencies/native build/profile changes or owned live handles. Native reload integration and broader plugin/PLAN/PARITY gates remain open. /compact unavailable.

Reload recovery follow-up (source parent 8804c907): registry remembers prior successful admission through reload/session-recovery failures, so fixing a package and pressing reload retries it. Packages never successfully loaded stay excluded; explicit unload removes retry eligibility. Inline actual-registry controls pass failure→repair→reload, exact additional load, never-ready exclusion and unload exclusion. Compiler52828 exits0/0errors/0warnings; build exits0. No new test/artifact scripts/native/profile/live handles. Native execution/keyboard and full migration remain open. Variable source/value display remains an identified implementation gap; no setting-only substitute was added. /compact unavailable.

## Topic records

<a id="record-agent-event-api"></a>

<details>
<summary>AGENT-EVENT-API</summary>

# Event API parallel agent handoff — 2026-10-12

Isolated worktree: `E:\.dvgamerr-app\insomnium-agent-event-api`. Baseline HEAD: `25fa97a62e55fae680ff01809fc30119396703b8`, plus copied root WIP recorded in `artifacts/agent-baseline.json`. No baseline dirt staged or committed. Root agent owns integration and topic commit; this handoff is not a full Event/migration acceptance.

Implemented bounded constructor and native packet compatibility for UIEvent, MouseEvent, PointerEvent, KeyboardEvent and CustomEvent. Native retained callbacks now receive the actual subclass prototype while retaining the existing shared private Event identity/state. Readonly subclass getters use private branded state. Constructor inheritance, dictionary defaults, DOM string/integer/finite float conversions, keyboard constants, common modifier queries, UI/custom initializers and their receiver guards are present. Chromium differential evidence requires MouseEvent fractional coordinates to floor and button -1 to normalize to0; PointerEvent preserves fractional coordinates.

`event.view` uses a frozen isolated Window facade only when the host event's view is the owned node's actual Window. Constructor views admit null or the same facade and refuse fabricated views. Window/self/document references remain realm-local; DOM methods retain existing module-init/current-owner guards. Foreign host views expose no raw Window. Related targets are forwarded only when present in the owned graph. Native pointer coordinates retain their fractional values, and native page coordinates are forwarded separately.

Changed files to integrate (compare baseline hashes before copying; ordinary `git diff HEAD` includes preexisting WIP):

- `src/lib/plugin-guest-dom.js`
- `src/lib/plugin-dom-bridge.js`
- `src/lib/plugin-runtime.js` — narrow constructor/window/self bootstrap whitelist only
- `tests/ui/fixtures/plugin-guest-dom.js` — distinct subclass fixture/tag21 plus module-load differential
- `tests/ui/helpers/plugin-dom-event-subclass-cases.js` — new independent shared browser/guest exercise
- `tests/ui/plugin-dom-event-subclasses.js` — new saved production scenario
- `tests/ui/plugin-dom-event-surface.js` — retained tag now compared with the same actual host event's browser brand rather than assuming base Event
- This handoff document

Final compiler `bun run check`49343/f16e46 exits0, zero errors/warnings. Final `bun run build`5d1934 exits0. Actual emitted worker: `build/_app/immutable/workers/plugin.worker-bG5AK-mc.js`, SHA256 `54e274cc42a92c729bedc73d9f9a0f39587b7f3234e5248dfc1eaf4d02e21ca8`.

Final saved headless checks: subclass1d7a8a/4, existing surfacefb122d/15, shared identityd4a7b4/4, nesting31a827/12, listener lifecycle92806/fa9cf9/21: **56 groups passed**, all owned workers terminated. Subclass scenario compares all five constructor surfaces both at module load and live callback in CommonJS/ES module; malformed input/foreign view checks and actual trusted pointer/Shift+K keyboard observations match the browser. Native view ownership and scalar fields compare against the exact original host events. Every scenario uses shared headless launcher, no browser-use/ad-hoc steps. Result/source hashes: `artifacts/event-api-evidence.json`. Frozen integration source and original baseline hash manifest: `artifacts/event-api-handoff/`.

Initial constructor mismatch source/oracle/log are preserved under `artifacts/event-api-negative/`. A later saved coordinate probe caught PointerEvent fractional conversion and is recorded in `artifacts/event-api-coordinate-probe.log`; it used the previous emitted worker, not the final candidate. Compiler typing errors and an audit/formatter boundary mistake were corrected before final clean check/build. No product assertions were weakened. Existing surface brand became a dynamic native oracle because native click has PointerEvent brand.

Worktree dependencies were isolated after shared node_modules junction caused Vite config-temp resolution failures. The junction was verified then renamed to `node_modules-shared`; `bun install --frozen-lockfile --ignore-scripts` installed independent dependencies without lock changes. `--configLoader runner` alone did not resolve SvelteKit's second config load. No dependency target was modified deliberately; no live process handles remain.

References consulted: https://dom.spec.whatwg.org/#interface-customevent, https://w3c.github.io/uievents/#interface-mouseevent, https://w3c.github.io/pointerevents/#pointerevent-interface, https://vite.dev/config/.

Remaining gates: full Window API, Focus/Input/other event subclasses, extended modifier state, legacy mouse/keyboard initializers, pointer coalesced/predicted samples and advanced pointer fields, full synthetic dispatch/property handlers and multiple asynchronous frames, original held-provider owner regression, fresh native-hidden Tauri acceptance and whole migration parity. These are not removed from scope. No fresh native acceptance is claimed here. Commit this verified bounded API topic only after root integration checks; update STATUS with integrated commit/evidence/gates first. This interface cannot invoke `/compact`; this document is the explicit handoff, not a claim of compaction.

## Review follow-up accepted by strengthened existing oracle

Root review found three real differences, now corrected. UI/custom legacy initializers update private base state directly and never invoke an instance/prototype replacement of initEvent. Each constructor dictionary member is read once, in browser inherited dictionary order; coordinate conversion no longer re-reads input getters or numeric coercions. Native/chromium dictionary extension keys are read once and admitted values kept privately; full unsupported surfaces remain gated below. UI ignores constructor which input; mouse which is derived before its button -1 normalization, while keyboard uses its keyCode alias. Saved helper compares exact getter traces for all five constructors, replaced-method side effects, UI/custom resulting state, and mouse/pointer/keyboard alias matrices. Selected AltGraph/CapsLock/Fn/NumLock/ScrollLock/Symbol flags now use private constructor state and actual native getModifierState scalar snapshots.

Exact original failed source, emitted worker2f35657b, raw browser/guest observations and saved failure log remain under artifacts/event-api-dictionary-negative; earlier event-api-negative is untouched. Final 54e274cc candidate passes the strengthened subclass scenario and all previously listed regressions, 56 groups total. The integration manifest is refreshed against the same original root baseline hashes. Unsupported full sourceCapabilities facade, advanced pointer sample/angle public surfaces and remaining Event/Window/native/migration gates remain open. All handles terminal; root owns verified topic commit, STATUS update and compact handoff.


</details>

<a id="record-agent-event-callback-state"></a>

<details>
<summary>AGENT-EVENT-CALLBACK-STATE</summary>

# Event callback-state audit — 2026-10-12

The unchanged held-sync scenario still fails at `tests/ui/plugin-dom-terminal-owner.js:59`, but its cause is the native event capability refusal. The earlier idle callback rejection belongs to the deliberate second click in the queued-abort case. No dispatcher, permission, method allowlist, helper/CPU limit, production source or provider prototype changed during this instrumentation review.

The frozen trace `artifacts/callback-state-audit/proof/trace-second.log:44` records the earlier rejection: queued0, active callback2, active/requested lease1, waitingtrue, same retained owner, shared frame2/depth0, servicingfalse and no Window checkpoint. Only `sameLeaseWithoutCheckpoint` is true. The saved scenario accumulates this error in startupErrors, which previously obscured the later failure.

At held-sync, trace lines70–75 show every idle-rejection condition false, queued0, no active owner/frame and no closed/abort state. Callback2/lease1 enters the original worker with generation1 and pendingHelpers0. Its existing synchronous helper catch records `Native event capability is unavailable or expired`. The fixture catches that exception at `tests/ui/fixtures/plugin-dom-render-owner.js:36`, returns undefined and never starts the controlled `read_text` mock at line126. The original assertion at scenario line59 remains unchanged and RED; all10 preceding prerequisite observations completed.

The compatibility input is byte-exact current root `plugin-app-native.js`, SHA256 `9983f83c2d802f112bc0f376d97b63948a363c472d94fdde101dedbcd1ffeadf`. Its actual lines72/88 exclude the preview origin from acquiring a native event lease and reject an absent/expired lease. This source explains the observed refusal; it does not prove successful native transport or clipboard behavior. The historical endpoint differs cumulatively: original Abort reason propagation, an owner Abort consumer race with settled-once delivery, a pre-aborted listener guard and a post-retirement lease check. The808-file handoff's one-line baseline description is incomplete; the25-file instrumentation handoff's endpoint references73/87 are corrected to72/88 here. Both immutable proofs remain unchanged.

The saved headless fixture used the original installed engine and mocked host services; no native host, OS clipboard operation or external target was used. Private boolean/counter console traces exist only in copied host/worker/test code. Original admission logic and scenario assertions remain intact. The fixture's close returns void while disposal is asynchronous; passive observation after its original finally confirms19/19 workers terminated before browser close, with no teardown error. The original preview worker `8893751d2adb8de85ea905425a15694be6527817d19644e1f5dfe188383b2811` was restored. All task handles are terminal.

Independent reread/recomputation verified every SHA256 and byte length in both frozen manifests:25 instrumentation files (`8349aea9d065e6dd25a33d4b3219002778fe26dce5f44745d34f2c878562c38f`) and808 owned-checkpoint files (`fad32a6c30c1bb79d25f8f5bd1810e5409a73b8159ad21085192f86dd713ebaa`). Proof locations are the isolated event worktree's `artifacts/callback-state-audit/proof` and `artifacts/quickjs-owned-checkpoint-spike/proof`. Prior81/179 proofs were also verified during instrumentation freeze and remain untouched. Full held-sync/native/Event/migration acceptance and default engine adoption remain FALSE.

Reproduction: `bun artifacts/callback-state-audit/prepare.mjs`, then `bun artifacts/callback-state-audit/run.mjs`. The expected result is the unchanged line59 failure; private traces and teardown provide the corrected diagnosis. This note is a documentation-only handoff for root topic review/commit/STATUS. `/compact` is unavailable in this agent interface; no compaction is claimed.


</details>

<a id="record-agent-event-diagnostics-review"></a>

<details>
<summary>AGENT-EVENT-DIAGNOSTICS-REVIEW</summary>

# Root review of isolated C diagnostics prototype

# C stdio/assertion/abort topic handoff

Artifacts-only feature; default engine, dependencies/lock and production14source files are unchanged. Prior179-file matching-FFI proof remains immutable. All owned processes/worker/browser handles terminal. Interface cannot /compact; this frozen handoff does not claim compaction. Root owns topic review/commit/STATUS.

Saved original-engine headless differential now passes6groups/12terminatedworkers: real pinned C JS_FreeRuntime assertion has exact diagnostic expression/file/line/function/stderr and RuntimeError message; custom onAbort precedes custom printErr identically; actual native stdout/stderr fd_write imports match split UTF8 and NUL/newline boundaries with default/custom print handlers; actual native abort import matches default/custom diagnostics and exception. The stdio oracle captures the real installed Emscripten import during trusted worker instantiation, not a reimplementation. Raw import/memory access is trusted fixture-only and never guest exposed.

Original red is preserved in negative.log/negative-oracle.json/negative-variant.js/negative.wasm: original logged Aborted(Assertion failed...) and full RuntimeError; adapter emitted no diagnostics and only unreachable. Fix adds an artifacts-only assert.h shadow that imports the same assertion tuple, a native abort wrapper/import, and per-stdout/stderr native byte buffering to original print/printErr semantics. Private onAbort and terminal RuntimeError mirror pinned generated loader. Compiler file-prefix mappings preserve ../../vendor/quickjs/quickjs.c etc; #line after the earlier OS timezone adaptation restores original downstream diagnostic line numbers. No assertions weakened or new budgets/authority. Original68FFIinterface/core is reused;128MiB/512KiB/2s and16MiBinitial/2GiBmax/5MiBCstack remain.

Native WASM845536bytes SHA25627e223c738edfa7bcfd26a0d8f6dfb170aeac06e630d04ee755e3c7564ec2219, built by alreadyverified official Windows WASI SDK34/nativeClang via Bun, no forbidden generators. Additional regression evidence:14actualproductionVM/module/privacy/codec/CPUhostwait +7publicFFI +UTF8/Date2 =23original-engine oracle groups;28savedheadless production-worker groups (API4,hostwait4+guards6,Window owner guards8,retainedsession6) pass on derivedworker e3489c0be500a930d9ef73a0c1fcfa472a88c6ac92c5f5c71f7da78b0683e383. Together57groups. Preview restored original8893751d2adb8de85ea905425a15694be6527817d19644e1f5dfe188383b2811. Old proofs/production hashes checked before freeze.

Commands: bun artifacts/quickjs-diagnostics-spike/prepare.mjs (initial source copy, do not rerun over fixes); bun artifacts/quickjs-diagnostics-spike/build.mjs; bun artifacts/quickjs-diagnostics-spike/scenario.mjs; bun artifacts/quickjs-diagnostics-spike/regressions.mjs. All saved browser scenarios headless via shared launchUiBrowser. No native Tauri host launched/default profile touched.

This accepts only the bounded C diagnostics topic. General loader options/platform/libc/allocator-shape review from matching-FFI remains; no default adoption/fullengine/native/Event/Window acceptance. Native enqueue observer/exact one-job original-owner integration is the next isolated topic, not implemented here. Original strongFIFO/held-sync and async-provider completion outside a pumped frame remain RED. Keep them mandatory and do not infer broad acceptance from these57groups.

Official docs consulted: https://emscripten.org/docs/api_reference/module.html#Module.onAbort (abnormal termination is terminal; print/printErr callbacks); https://github.com/WebAssembly/wasi-libc/blob/main/libc-top-half/musl/include/assert.h (native assertion ABI); original installed0.32 generated loader and complete pinned C source. No upstream build generators executed.

Root independent review085587 verifies all81frozen files and byte counts, diagnostic6/oracle23 manifest fields and immutable proof hash at artifacts/quickjs-diagnostics-root-review.json. This verifies frozen evidence, not an independent root rerun of57groups. No production/default engine adoption. Native enqueue/one-job/original-owner FIFO/held-sync and async provider outside pumped-frame gates remain required. Root integration HEADdeef083 adds a separate already-aborted endpoint guard outside the14Event runtime sources; that must not be reverted by future integration.


</details>

<a id="record-agent-event-focus-input-dispatch"></a>

<details>
<summary>AGENT-EVENT-FOCUS-INPUT-DISPATCH</summary>

# Owned synthetic Focus/Input dispatch — guarded isolated handoff

2026-10-12. This incremental feature extends ONLY the existing owned synthetic DOM class/field transport. Root constructor/default feature bf77519 is the prerequisite. Official DOM dispatch and UI/Input definitions read before implementation: https://dom.spec.whatwg.org/#dom-eventtarget-dispatchevent, https://www.w3.org/TR/uievents/#interface-focusevent, https://www.w3.org/TR/input-events-2/#interface-InputEvent. No new dispatcher queue, privileged/provider/IPC/protocol/permission/admission/helper+CPU or default engine change.

Current approved root inputs were captured on HEAD8296fb5cd327b2e1eff6d0ee08e19fda380b5ae7 before synchronization. `artifacts/event-focus-input-dispatch-baseline/manifest.json` SHAae52066d0c11c9464fa3504746ac890b05178f11433c97a970a16e115950ae24 contains394 exact plugin/runtime/saved JS/config/package/lock inputs and immutable own-before bytes. Supplementary13 root Svelte fixtures preserve their own-before inputs separately: `artifacts/event-focus-input-dispatch-baseline-svelte/manifest.json`. Compiler initially identified two missing historical Svelte imports after the JS synchronization; exact current-root fixtures corrected the baseline input closure, without fixture logic changes. Root factory9983, current preview5493/component59dc, package and lock are now consumed byte-identically. `bun install --frozen-lockfile --ignore-scripts` checked249 installed packages with no changes. Unrelated app UI source remains the isolated worktree's captured source; no claim of whole-root frontend/native asset identity.

Frozen final proof: `artifacts/event-focus-input-dispatch-proof/manifest.json` SHA6a6e6ac8347d09783b3d1aefb6347fbe0c2661ef53b06f6e68834f645ec6fa7b,1599 files,99 passing groups across27 outputs,402 unchanged approved baseline guards. Exact5-file guarded delta against captured ROOT bytes: `src/lib/plugin-guest-dom.js`, `src/lib/plugin-dom-bridge.js`, `tests/ui/fixtures/plugin-guest-dom.js`, `tests/ui/helpers/plugin-dom-synthetic-cases.js`, `tests/ui/plugin-dom-synthetic-dispatch.js`. Each has original/current/frozen hashes. The product change is two files: known Focus/Input interface and scalar field lists, host constructor whitelist and nullable/string/boolean/defaultnull Input packet validation. Existing owned `node()` resolves Focus relatedTarget; unsupported transfer/range packets refuse. No owner/authority code or existing method allowlist is expanded. This document is a separate doc-only6th delta for root review.

SAME reusable saved synthetic scenario retains all original invoke/native-callback/host-wait modes and their assertions, adding three Focus/Input modes. SAME independent helper runs in the actual browser and retained production guest: Focus focus/blur/focusin/focusout, null and same-target relatedTarget, Input beforeinput/input nullable data and lone-surrogate Unicode, owned Window facade, cancelable/noncancelable defaults, same-event Focus AND Input redispatch, capture/target/bubble phases/this identity, recursive InvalidStateError, late currentTarget/phase/path cleanup and unchanged checkbox activation. Actual typed packets use branded default transfer null/ranges empty only. All rows match the browser oracle exactly. Four additional groups per typed mode exercise actual production bridge scalar/transfer/range/unknown-interface refusal, foreign relatedTarget refusal, foreign target refusal and retired owner refusal; these direct host harness guards supplement the retained-VM differential rather than claim guest/native provider completion.

Preserved first host-wait negative and exact script/helper/log inputs under proof evidence/artifacts/event-focus-input-dispatch-negative. Actual cause: new mode `focus-input-host-wait` missed the fixture's existing exact `host-wait` label selection, yielding original `Unexpected helper call`, prompt calls0/waitingfalse, owner closedfalse/no entry errors. TEST mode normalization reuses original event-host-wait owner/mocked prompt; helperCall/provider logic is unchanged. Existing-state diagnostic is harness-only. Host-only status positioning prevents focus callbacks moving pointer targets; guest style allowance/layout is unchanged. No old assertions were weakened.

Exact commands: `bun run build` exit0; `bun run check` exit0,0 errors/0 warnings; `bun tests/ui/plugin-dom-synthetic-dispatch.js` passes original9 plus new21 groups. Retained unchanged commands pass: `bun tests/ui/plugin-dom-event-subclasses.js`, `bun tests/ui/plugin-dom-event-surface.js`, `bun tests/ui/plugin-dom-event-identity.js`, `bun tests/ui/plugin-dom-listener-lifecycle.js` (all7 modes), `bun tests/ui/plugin-dom-late-event-controls.js`, `bun tests/ui/plugin-dom-synthetic-window-prefix.js`, `bun tests/ui/plugin-dom-event-nesting-guards.js`, `bun tests/ui/plugin-dom-event-host-wait-guards.js`, `bun tests/ui/plugin-dom-synthetic-window-guards.js`. Original helper expected250, foreign/close and original CPU/depth/helper/additional-async admission assertions stay unchanged and green. Every27 output is headless and binds actual built worker SHAda3834aa08cd163ab47b733b9d5ac220244b3069c3a745805c29c494230cabdd; full source/test/asset/results/log/baseline/negative closure is frozen. Every reported worker terminated; no live handles.

Limits remain explicit: nonnull owned DataTransfer, StaticRange/nonempty target ranges, Focus relatedTarget Window/EventTarget outside admitted nodes, full native current-field/dispatch acceptance, true cross-realm FIFO, native held-sync/provider completion, independent async frames, full Window/Event/SDK/migration parity. Native current717 predates this feature; native/full Event acceptance FALSE. Controlled app.prompt proves existing mocked host-wait dispatch, not privileged/OS/native held-sync transport. Previous759/772 Focus proofs and808/81/179/25 engine/callback proofs remain immutable; flagged provider WIP remains read-only. No root writes, stage or commit. Root owns guarded integration/replay/topic commit/STATUS. `/compact` is unavailable in this interface; this handoff records the limitation without claiming compaction. Live handles: none.


</details>

<a id="record-agent-event-focus-input"></a>

<details>
<summary>AGENT-EVENT-FOCUS-INPUT</summary>

# FocusEvent / InputEvent scoped constructor and native-field work

Latest guarded handoff after root review: artifacts/event-focus-input-default-proof/manifest.json SHAe4ba9752aa9ee1fe2ce447334dfdbcc5ee9de0f00bf16a727da1363888673fb7,772 frozen files and78 passing groups across24 replayed saved outputs. It supersedes the759-file constructor proof below for integration; that earlier proof remains byte-identical and immutable. Product delta remains the same6 guarded files against the same current-root baseline. InputEvent now includes branded readonly `dataTransfer` returning null for default/admitted cases, plus branded `getTargetRanges()` returning a fresh empty array each call. Nonnull DataTransfer and nonempty ranges still refuse. The SAME independent browser helper verifies defaults/null dictionaries, readonly getter, invalid Event/UIEvent receivers, method name/length, new-array identity and mutation isolation. No host objects or new authority are exposed.

Revised build/check and every retained command below pass on new worker SHAf9dd13e0dc4e4f2e6dcd68529211bf93953c9af85135534ce78560ab0877b701. This SHA is checked against all24 saved result files by the final hash audit. All handles terminal. Current native717 predates this feature; current-native/full InputEvent/full FocusEvent/full Event acceptance remains FALSE. Root integration/replay/topic commit and native verification remain required. DataTransfer/StaticRange OWNED facades and nonempty ranges remain open; their default null/empty surfaces are now implemented and tested.

2026-10-12. Root authorizes only private owned DOM constructors/fields, actual browser differential and the existing reusable saved subclass scenario. No provider/protocol/IPC/capability/permissions/admission/helper+CPU/engine changes. Earlier provider prototype remains read-only. Root owns integration/topic commit/STATUS; source changes stay isolated until guarded handoff.

Immutable current-root baseline: artifacts/event-focus-input-baseline/manifest.json SHA173edc3d422bebd2ef2b03584b2f63d7f23d32d2399ec4f302381032cf09d6ac,19 exact runtime/scenario/fixture/helper/package/lock inputs. Each records root hash plus own historical pre-sync hash. Only three permitted product files and existing subclass/fixture/helper/surface entry inputs were synchronized from this capture; package/dependencies/protected runtime/protocol remain untouched. Root's native builder captures old worker889 before future review of this separate delta.

Official sources read before implementation: W3C UI Events (2026-02-21), https://www.w3.org/TR/uievents/#interface-focusevent and https://www.w3.org/TR/uievents/#interface-inputevent; Input Events Level2 (2026-05-01), https://www.w3.org/TR/input-events-2/#interface-InputEvent. Both extend UIEvent. Focus relatedTarget uses only the existing admitted node/null graph. Input data/inputType/isComposing readonly defaults and dictionary conversion are the bounded field scope. Input dataTransfer/StaticRange APIs and Focus Window/EventTarget references outside the admitted node graph need separate scope/ownership review; no authority is added. Full synthetic dispatch of these two new types remains a separate gate; no dispatcher/protocol changes are included.

Preserve all original Event/UI/Mouse/Pointer/Keyboard/Custom assertions, native pointer/keyboard/module-load behavior and private guards. Add malformed/default/readonly/receiver/dictionary-getter/Unicode cases and actual owned focus/input observations in SAME saved helper/scenario, with new ownership-specific callback cases. Every saved browser run uses fixed launchUiBrowser headless:true. Native acceptance and full Event/migration are FALSE until independently reviewed.

Verified isolated handoff: artifacts/event-focus-input-proof/manifest.json SHA73c16cf4f782b6340a9b878e2593a6764f4be9f65af0ee9b8487d07787c8ba8b,759 frozen files and78 passing assertion groups across24 saved scenario outputs. Exact6-file guarded delta: src/lib/plugin-guest-dom.js, src/lib/plugin-dom-bridge.js, src/lib/plugin-runtime.js, tests/ui/fixtures/plugin-guest-dom.js, tests/ui/helpers/plugin-dom-event-subclass-cases.js, tests/ui/helpers/plugin-dom-event-subclass-scenario.js. Every delta has original ROOT hash, current hash and frozen copy; guarded remaining baseline inputs preserve their own original bytes. No dispatcher whitelist, provider, IPC, permission, capability, admission, lease, budget or engine changes. This document is a separate7th doc-only delta; root owns its integration/commit.

Commands (run with frozen product sources): `bun run build` exit0; `bun run check` exit0,0 errors/0 warnings; `bun tests/ui/plugin-dom-event-subclasses.js` passes7 groups, including old five constructor surfaces in both formats, owned Focus constructor identity/read-only/initUIEvent retention, actual trusted Focus relatedTarget to a known peer, actual trusted Input data/inputType and old pointer/keyboard observations. Same saved helper checks defaults/readonly/getter brands,10 malformed new dictionary errors, inherited getter order, Unicode/null data and51 inputType samples. The matching browser recognizes39 input types; unrecognized values become empty. It preserves lone surrogates in constructor data. W3C table names absent from Chromium remain absent here, evidenced by unchanged browser oracle. Preserved failed dictionary/inputType runs in evidence/artifacts/event-focus-input-negative; no prior assertions were weakened. Host-only fixture status layout avoids focus status text moving a pointer target; no guest style allowance was expanded.

Retained original commands also exit0: `bun tests/ui/plugin-dom-event-surface.js`, `bun tests/ui/plugin-dom-listener-lifecycle.js` (all7 modes), `bun tests/ui/plugin-dom-event-identity.js`, `bun tests/ui/plugin-dom-synthetic-dispatch.js` (all3 modes, including property handler getter/replacement/clearing/async return false), `bun tests/ui/plugin-dom-late-event-controls.js`, `bun tests/ui/plugin-dom-synthetic-window-prefix.js`, `bun tests/ui/plugin-dom-event-nesting-guards.js`, `bun tests/ui/plugin-dom-event-host-wait-guards.js`, `bun tests/ui/plugin-dom-synthetic-window-guards.js` (CPU/helper/foreign/close). Original helper expected250 and original authority/budget assertions stay unchanged. All passing outputs bind actual production-built worker SHA c49a315e8e71d378e00dc911921a8323975029a4f778a4e06d8bb5b0b0232834. Compiler log and run logs, actual build/source/test closure, complete saved outputs and negative evidence are frozen. Subclass teardown2/2 workers terminated; all live handles terminal.

Explicit compatibility limit: own protected endpoint source remains historical9c6990fe rather than root9983; own preview/component helper/package/lock bytes also remain historical and unchanged. The baseline manifest records BOTH own-before and current-root hashes. Current-root input is captured immutably, but this isolated preview result does not claim the root/native frontend source closure is identical. Root must replay after guarded integration; native candidate a97/worker889 predates this feature. Current-native acceptance FALSE. Root original held-sync assertion remains RED from the unchanged native transport mismatch; this feature does not implement or test a provider fix.

Remaining full scope: Focus relatedTarget outside the admitted node graph (including Window/EventTarget), Input DataTransfer/getTargetRanges/StaticRange ownership and nonempty ranges, full synthetic Focus/Input dispatch, full cross-realm checkpoint/native-held-sync/provider acceptance, full Event/SDK compatibility. Constructors reject unsupported nonnull DataTransfer/nonempty targetRanges rather than expose host objects. Broader owner/protocol/dispatch work is excluded. Previous immutable808/81/179/25-file proofs and flagged provider WIP remain untouched/read-only. No migration/full Event claim.

No commit/staging in isolated worktree; root reviews and commits this bounded topic with STATUS evidence. `/compact` cannot be invoked by this interface; this frozen handoff records the limitation rather than claiming compaction. Live process handles: none.

## Root integrated replay

Root independent hash/byte audit verifies both old759 and revised772 frozen files (1531total), guarded six deltas and every protected root input. Exact source integration preserves current root endpoint9983 and package/helper bytes; historical isolated endpoint9c6990fe is not adopted. Fresh root build34fb54/compiler22328 pass0/0errors0warnings. SAME ten saved commands produce24actual outputs/78groups with exact workerf9dd13e0. All original helper250/CPU/foreign/close/lease assertions remain unchanged. Full current root source/tests/assets/outputs frozen artifacts/event-focus-input-root-proof/root-audit.json. Native717 captures a97 before these constructors; new native field acceptance remains required. Root handles terminal; provider/protocol/permission/defaultengine untouched.


</details>

<a id="record-agent-event-synthetic-runner"></a>

<details>
<summary>AGENT-EVENT-SYNTHETIC-RUNNER</summary>

# Reusable saved synthetic scenario — test-only handoff

2026-10-12. Root authorizes ONLY extraction of the existing saved synthetic scenario for native-provider reuse. No product/provider/protocol/permission/authority/admission/budget/engine or held-sync adapter changes. Root current driver1915e4c9, helper3da28050 and fixture31356d63 were captured on HEAD517723ebebe797523912e082720667c5dd2b265b with own-before bytes. Baseline13 inputs: `artifacts/event-synthetic-runner-baseline/manifest.json` SHAf8077b33e6704e8eab5ddfbc37068c15a585e14ee1eca10f941d7aa0c0d1a7b6.

Exactly two test-file deltas: existing `tests/ui/plugin-dom-synthetic-dispatch.js` becomes the same six-mode saved headless entry; new `tests/ui/helpers/plugin-dom-synthetic-scenario.js` exports `runSyntheticDispatchScenario(page, output, {mode, nativeFixturePath?})`. Closed mode strings: invoke, native, host-wait, focus-input-invoke, focus-input-native, focus-input-host-wait. A mode named native denotes a browser-native callback; it does not itself mean Tauri acceptance. The runner returns its complete acceptance record. Preview entry awaits it without returning a value, preserving the shared fixture callback contract.

With `nativeFixturePath` omitted, fixture compilation is the original Bun/Svelte path and the runner writes result.json/headless. With a build-relative native fixture asset (for example `build/event-synthetic-fixture.js`), it reads captured local bytes, fetches that exact local served asset and asserts equal SHA before evaluation. It also fetches the actual served worker and checks against the derived filename/hash from the captured build worker bytes; no historical889/F9/DA hash is hardcoded. The native branch writes `native-synthetic-acceptance.json` and renderingMode native-hidden, leaving native-app result.json available for its wrapper. Genuine hide-before-CDP, capture/source/frontend identity, native host/profile/restoration and fresh host per mode are the native wrapper's responsibility; native_provider agreed to one fresh owned hidden host/preserver per mode. Wrapper must freeze/check its captured frontend/build bytes before calling the runner. Reusing a page with old oracle/listener/fixture mounts is not accepted.

Preservation audit `artifacts/event-synthetic-runner-audit.json` verifies all11 original assertion calls byte-exact and the independent browser oracle body byte-exact. Original helper/fixture and12 protected runtime/package/lock/test inputs are byte-identical to captured root. Invalid mode refuses before any page calls. Original nine groups and new typed21 groups remain unchanged: actual retained callbacks, browser propagation/identity/detail/cancellation, outer-stack defer, redispatch/default activation/late controls, Focus/Input relatedTarget/view/scalars/phase cleanup, malformed packet, foreign target/relatedTarget and retired-owner refusals. No original checks or helper250 assertions are changed.

Verified `bun tests/ui/plugin-dom-synthetic-dispatch.js`: six saved headless outputs/30 groups, each worker SHAda3834aa08cd163ab47b733b9d5ac220244b3069c3a745805c29c494230cabdd, all recorded workers terminated. `bun run check`:0 errors/0 warnings. `bun artifacts/event-synthetic-runner-audit.js` passes assertion/oracle/guard/closed-mode checks. A preview-wrapper Promise return mismatch was corrected by consuming the runner result; original assertions unchanged. No new product build is necessary for a test-only extraction; the verified unchanged product worker is recorded, not re-labelled as a newly built generation.

Frozen proof: `artifacts/event-synthetic-runner-proof/manifest.json` SHA7c19e8a82980ab359f16467422e5e0b09beeedc2c733a79bb59aa8fb96955114,750 files with exact baseline/current/frozen delta hashes, full source/test/assets/results/logs/preservation audit. Current-native acceptance FALSE; native option has not been executed in this lane. All prior1599/759/772/808/81/179/25 proofs remain immutable, flagged provider WIP read-only. Root must review/integrate before the next native source capture. Full Event/Window FIFO/native held-sync/provider/nonempty DataTransfer/ranges/FocusWindow/private/platform/migration gates remain open.

Separate doc-only third delta. No root/GraphQL writes, staging or commits. Root owns topic integration/replay/commit/STATUS. Live handles: none. `/compact` is unavailable here; this explicit handoff does not claim compaction.


</details>

<a id="record-agent-event-wheel"></a>

<details>
<summary>AGENT-EVENT-WHEEL</summary>

# Owned WheelEvent constructor/native-field/scalar-dispatch handoff

2026-10-12. Isolated incremental Event interface feature; root owns review/integration/topic commit. Exact baseline21 root inputs on bb75cb36859a35d54f10c5860b6c46ce4e592f28, with immutable own-before bytes: `artifacts/event-wheel-baseline/manifest.json` SHA9bd099950c7b89cbee44c0cd8a2493aa0949699f49d78a79e09db4ed581281c0. Factory9983, current runtime/worker/owner/lease/protocol, preview/component, package/lock match root. Native capture bb75 is a pre-Wheel generation; it cannot be relabelled Wheel acceptance.

Official references read before implementation: https://www.w3.org/TR/uievents/ (current version moved Wheel to Pointer Events4), https://www.w3.org/TR/pointerevents4/#interface-wheelevent, https://webidl.spec.whatwg.org/#es-double and https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/WheelEvent. Current Pointer Events4 §12.1 includes momentum boolean alongside deltaX/Y/Z restricted doubles, deltaMode unsigned long, MouseEvent inheritance and three DOM_DELTA constants. Browser oracle confirms momentum is supported here. Chromium's primary IDL/constructor sources explain its existing nonstandard numeric wheelDeltaX/Y dictionary members/aliases: https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/events/wheel_event_init.idl and https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/events/wheel_event.cc. Gitiles fetch failure distinguished from the successful official mirror. No copy of upstream native code or dependency/engine adoption.

Product changes exactly three files: private WheelEvent extends existing MouseEvent; private readonly deltaX/Y/Z/deltaMode/momentum and numeric legacy aliases; constants on constructor/prototype; bootstrap name; actual incoming native Wheel class/scalars; known synthetic class/field lists with finite/uint/boolean/int32 packet checks. Existing owned-node resolution carries relatedTarget; owned Window view remains the isolated facade. Malformed Wheel relatedTarget converts to TypeError during its Mouse dictionary member read, scoped to Wheel; old Mouse/Pointer behavior is unchanged. No queue/provider/protocol/permission/authority/admission/CPU/helper/budget/default-engine change. No new Window/EventTarget facade or capability is manufactured.

Exact guarded9 source/test deltas: src/lib/plugin-guest-dom.js, src/lib/plugin-dom-bridge.js, src/lib/plugin-runtime.js, tests/ui/fixtures/plugin-guest-dom.js, tests/ui/helpers/plugin-dom-event-subclass-cases.js, tests/ui/helpers/plugin-dom-event-subclass-scenario.js, tests/ui/helpers/plugin-dom-synthetic-cases.js, tests/ui/helpers/plugin-dom-synthetic-scenario.js, tests/ui/plugin-dom-synthetic-dispatch.js. Root original/current/frozen hashes accompany every file;12 remaining captured inputs are unchanged. This document is a separate doc-only tenth delta.

SAME independent subclass helper/browser oracle verifies eight subclass surfaces in CommonJS/module and actual trusted wheel from saved Playwright mouse.wheel, retaining all prior seven constructor/focus/input/pointer/keyboard assertions. New Wheel probes cover inheritance, all readonly getters and wrong Mouse receivers, three constant descriptors/readonly flags, inherited Mouse coordinates/which/modifier behavior, getter-read order,22 malformed constructor cases, finite coercion/default/null/negative zero,9 uint conversion samples and10 numeric legacy combinations including int32 clamping. Browser momentum, which and alias behavior are observed rather than hardcoded oracle values. x/y signed zero normalizes positive via constructor compatibility; z signed zero survives the existing codec unchanged.

SAME reusable synthetic runner preserves all six previous modes/30 groups and adds wheel-invoke, wheel-native and wheel-host-wait (21 groups). Native here means browser-native callback, not Tauri. Independent Wheel program compares standard/momentum/legacy scalars, owned relatedTarget/view, capture/target/bubble this/identity, cancellation/noncancelable defaults/unchanged checkbox activation, same Wheel redispatch, recursive InvalidStateError, signed deltaZ and deferred phase/currentTarget/path cleanup. Actual bridge malformed finite/mode/momentum/legacy/interface packets, foreign relatedTarget/target and retired-owner dispatch refuse. Closed mode list adds exactly the three saved Wheel modes; no runtime method permission changes. New mode label normalization reuses existing controlled app.prompt owner; helperCall/provider logic unchanged. The native runner option remains genuine-capture dependent and does not claim current native execution.

Commands on final frozen sources: `bun run build` exit0; `bun run check` exit0,0 errors/0 warnings; `bun tests/ui/plugin-dom-event-subclasses.js`8 groups; `bun tests/ui/plugin-dom-synthetic-dispatch.js`51 groups. Retained unchanged commands all pass: `bun tests/ui/plugin-dom-event-surface.js`, `bun tests/ui/plugin-dom-event-identity.js`, `bun tests/ui/plugin-dom-listener-lifecycle.js` (all7 modes), `bun tests/ui/plugin-dom-late-event-controls.js`, `bun tests/ui/plugin-dom-synthetic-window-prefix.js`, `bun tests/ui/plugin-dom-event-nesting-guards.js`, `bun tests/ui/plugin-dom-event-host-wait-guards.js`, `bun tests/ui/plugin-dom-synthetic-window-guards.js`. Original helper250 and CPU/depth/foreign/close/additional-async guard assertions remain unchanged. Total121 groups/30 saved headless outputs bind actual production-built worker SHAe97193465f35adaad738f8daea26d9887c504e40f1bb2c0443312df72aec1d3b; original Focus/Input99 and extraction30 are retained within this total. Reported workers terminate; all handles terminal.

Frozen proof: `artifacts/event-wheel-proof/manifest.json` SHA5389be107b504beae31afdd2a3aa039a830b3165f9ce9660568e735db5e4cce6,874 source/test/build/result/log/baseline/negative files. Final result records, not historical intermediate logs, are authoritative for the final worker binding. Preserved valid constructor-first/legacy-oracle and malformed relatedTarget negatives. First attempted replay overlapped a still-running build; it is explicitly excluded, with log preserved under negative/overlap-first. No source or final scenario changed during live final checks. No original assertion was weakened. All previous proofs/negative files remain immutable; flagged provider WIP is untouched/read-only.

Remaining gates: root fresh integration/replay and actual native generation after this feature; browser/native platform/runtime-flag differences for momentum; native scrolling/default wheel transactions; inherited unsupported modifier/legacy initializers, sourceCapabilities/Window/EventTarget outside owned nodes, DataTransfer/StaticRange, full cross-realm FIFO and native held-sync/outside-provider/independent async frames/private/SDK/full Event/migration. Current-native/full Event acceptance FALSE. No root/native/GraphQL/profile operations, stage or commit. Root updates STATUS and commits the verified topic. `/compact` is unavailable here; this handoff records the limitation without claiming compaction. Live handles: none.

## Root integrated replay

Root independently rehashes874 frozen inputs and12 protected current inputs, reviews the3 product deltas and integrates only9 guarded source/test paths plus this report. Current Runner/source work is preserved. Fresh root builda7733c/compiler67495 pass0 errors/0 warnings. Ten saved commands in root91183 pass30 outputs/121 groups, all bound to actual e9719346 worker. Original Focus/Input/identity/lifecycle/CPU/helper250/foreign/close/async guard assertions remain; no engine/provider/protocol/permission/budget changes. Full current source/tests/assets/results: artifacts/wheel-root-proof/root-audit.json. Native588/bb75 predates Wheel and Runner; constructor7/synthetic30 and later GraphQL evidence are scoped historical acceptance, not current Wheel acceptance. Native/current full Event/FIFO/held-sync and all original gates remain open. All root handles terminal; /compact unavailable, explicit handoff.


</details>

<a id="record-agent-synthetic-dispatch"></a>

<details>
<summary>AGENT-SYNTHETIC-DISPATCH</summary>

# Synthetic dispatch continuation — work in progress

Worktree: `E:\.dvgamerr-app\insomnium-agent-event-api`. Root integrated the API baseline in commit `3694764`; exact source/result/worker baseline remains immutable in `artifacts/event-api-proof/` (worker54e274cc). This continuation is not committed, full synthetic/outer-Window checkpoint acceptance remains open.

Implemented actual owned host dispatch from guest Event objects. A bounded synthetic token links callbacks to the original private guest Event; CustomEvent.detail functions/cycles never leave the VM. Actual native DOM decides capture/target/bubble/default activation/cancellation. Synchronous return value, redispatch, private identity/state, recursion exception and malformed receiver/Event checks compare to browser. Arbitrary owned custom event names are allowed as bounded strings; no app-document/window capability is introduced. Supported property handlers (onclick/oninput/onchange/onkeydown/onkeyup/onfocus/onblur) retain actual guest functions, keep native handler slot ordering across replacement, clear non-callable values, bind this, and implement immediate false cancellation while ignoring Promise return values.

Saved `plugin-dom-synthetic-dispatch.js` passes9groups across direct ordinary guest invoke, trusted native click callback, and continuation after real owned app.prompt host wait. Each compares all raw observations exactly with independent browser, including cyclic/function detail identity, capture/this/object listener, three redispatches, canceled flags, native checkbox activation, late cancellation and property handler order/replacement/clear/async return behavior. All owned workers terminate.

Partial Window checkpoint adoption is implemented: an untrusted original host Event listener publishes only its synchronous prefix; original owner/generation/capabilities/CPU/helper frame stays live. Other callbacks enter raw retained functions without draining pending jobs. The owning Window posts a guarded resume at its checkpoint. Runtime does not gain a fresh VM/budget. Shared Window prefix/peer/resume CPU/helper guards, foreign-owner refusal and owner-close suppression pass8groups in `plugin-dom-synthetic-window-guards.js`; CPU guard runs500ms prefix+700ms peer and1000ms continuation, refuses before completion under shared original CPU budget. Helper guard performs250provider calls across prefix/peer, then original256total helper cap refuses before another continuation provider call. These are not proof of cross-realm job FIFO.

Original saved outer-Window mismatch c2b1f7 froze exact source/actualworkerbc45ee15/raw oracle/failure in `artifacts/synthetic-window-negative/`. Initial Window stack tests passed before stronger review requirements. Stronger SAME saved `plugin-dom-synthetic-window-stack.js` now includes actual host queueMicrotask/Promise jobs before/between/after owned listeners and guest G1→G2 chains; it is **RED**: Hbetween/Hpromise/Hafter observe G1 in native browser, while candidate host jobs see noG1 because asynchronous postMessage resume runs later. Exact pre-fix stronger candidate/currentworker1523c15e/oracle/log are frozen in `artifacts/synthetic-fifo-negative/`. No assertion weakened. Earlier tests must not be cited as full Window checkpoint acceptance.

Late native Event controls now use graph-owned WeakRefs/FinalizationRegistry. Only current idle events whose target still belongs to the same graph can mutate original native canceled/stop flags; no raw Event/Window escapes. `plugin-dom-late-event-controls.js` passes2groups: after-dispatch guest preventDefault reaches the actual retained host Event, then SAME host Event redispatch returnsfalse and preserves guest identity/detail mutations. Original native default activation is never undone after it already happened.

Latest completed compiler50025/6a8c40 exits0/zero errors/warnings; build46f24b exits0, current emitted worker SHA256 `8893751d2adb8de85ea905425a15694be6527817d19644e1f5dfe188383b2811`. Saved final new ordinary dispatch321fa0/9 + prefix921125/2 + Window guards99955/543461/8 + late controlscb82c2/2 pass:21newgroups. API4/base15, host-wait4/guards6, ready checkpoint3, identity4, nesting12/guards4, listener21, leases6, genuine guest/cancel/clipboard/dataset/tokens/dialog68 and collections32 regressions pass on this candidate ; final guarded inventory records219passedgroups, including independent standalone/lease workers with their own SHA256 values.

Unchanged original owner143554/14975 still fails line59 controlled held synchronous clipboard IPC after10owner/store prerequisites; no owner full-suite acceptance. All saved handles currently terminal. No fresh native-hidden Tauri acceptance of this continuation is claimed.

Root review correctly requires full cross-realm FIFO, not merely deferring all guest jobs until after Window dispatch returns. Installed quickjs-emscripten0.32 documented API exposes hasPendingJob and executePendingJobs(max), with no native job-enqueue observer/count hook. Promise.then shims cannot cover native await. A viable full solution likely needs native JS_EnqueueJob notification routed synchronously through original owned native mailbox at enqueue time and exactly one admitted native job executed per owning Window microtask, with original owner/generation/budgets. Engine binding/build changes require coordinated ownership; no dependency/engine variant change has yet been made. C/LLVM/Emscripten commands are not installed in PATH; upstream default generator scripts use Yarn/Node/Python and cannot be used under Bun-only owner policy. A Bun-driven native hook build must be made concrete and tested, not claimed from theory.

References: https://dom.spec.whatwg.org/#dom-eventtarget-dispatchevent, https://html.spec.whatwg.org/multipage/webappapis.html#clean-up-after-running-a-callback, https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-idl-attributes, https://github.com/justjake/quickjs-emscripten, https://bellard.org/quickjs/quickjs.html.

Remaining required scope includes cross-realm FIFO/native await, additional independent async host-wait frames, full property/event/platform/private/provider gates, original held-provider regression and fresh native acceptance. `/compact` is unavailable here; this progress document is not a compaction claim or completed-feature handoff.

## Frozen verified-topic handoff to root

`artifacts/synthetic-handoff/manifest.json` records fourteen changed/new files with original/current raw hashes, baseline copies and219accepted result groups (21newgroups). Apply only after raw baseline guards; root current continuation48df68e is newer than API3694764 but root reports these runtime paths unchanged. `source/` contains exact source files and `evidence/` contains saved results, compiler/build logs, strongFIFO currentred observations and unchanged held-sync owner failure. Allnew scenario files are included, so root neednot depend on transient agent generation scripts. Engine spike remains separate in artifacts only.

Commands to replay: bun run check; bun run build; bun tests/ui/plugin-dom-synthetic-dispatch.js; bun tests/ui/plugin-dom-synthetic-window-prefix.js; bun tests/ui/plugin-dom-synthetic-window-guards.js; bun tests/ui/plugin-dom-late-event-controls.js. These pass. bun tests/ui/plugin-dom-synthetic-window-stack.js intentionally stillfails the full FIFO browser oracle; bun tests/ui/plugin-dom-terminal-owner.js stillfails unchanged held-sync gate after10prerequisites. Full Window acceptance/eventFeatureComplete/native/fullmigration remainfalse.

Review correction: an earlier separately written Window harness set cancelabletrue only in the oracle; that mismatch was a fixture mistake, corrected beforefinalproof. Both Window scenarios now execute exactly the same exerciseWindowOuter function around the native browser and actual guest callbacks, with identical event options, host queueMicrotask/Promise placements andsameEvent redispatch. Prefix-only case passes; strongFIFO stillfails with native G1/Hbetween/Hpromise/G2 ordering discrepancy. The dedicated late-control browser differential independently proves actual host cancellation. Historical negatives remain untouched. StrongFIFO finalcandidate8893751d, identical-program oracle/raw guest andfailure log are frozen separately in the handoff evidence.

No live handles remain. Root owns review,topiccommit,STATUS commit/evidence/gatesandcompacthandoff; thisagent interface cannotinvoke /compact anddoesnotclaim itoccurred.


</details>

<a id="record-plugin-app-facade"></a>

<details>
<summary>PLUGIN-APP-FACADE</summary>

# Production synchronous plugin app facade candidate

## Current acceptance — 2026-10-11

Fresh production30522 terminal0/573.815s; executable SHA256
624e14fa23a7ce9a3fd7cf8672e2a2ac88f54682ed2cf767905b2a23e9b10d29.
Saved native86216/1791731186321/restoration1791731185729 terminal0 passes37checks,
14terminated workers/54actual HTTP requests and retained gRPC reflection,
streaming, owner Cancel/recovery, OAuth preview/adoption/prompt Cancel, cookies
and ordinary tag matrix. Three new cases accept actual c.app native metadata and
Desktop path, immediate non-Promise/frozen/detached values, unknown-path refusal
and retained previous-generation object refusal. No native clipboard read/write.

Independent656source current/exact/live/original snapshots, production build,
executable/assets, wire/history/metadata/OAuth/model/cookies and native-hidden
exit0/visiblefalse/state audit passes. Both original workspace buffers, plugin
store and all653original cookie files restored. Manifest covers application src,
backend src/permissions, UI scenarios/helpers, scripts and named root build/dependency
configuration. It does not claim every vendored/native dependency or generated
source was independently frozen. Initial-live656snapshots preserved; only main
scenario differs after build by restoring its canonical root body before the
existing final assertion. The independent auditor checks that exact one-line
harness change, and every other source matches the original build snapshot.

Old20ab757e negative35909/1791730722575/restoration1791730721760 terminal1 reaches
new ownedappinfo and fails not-a-function after retained gRPC/OAuth prefix success.
Separate current-harness/old-executable/exact-state negative audit passes, not a
current-source application acceptance claim. First new87834/1791731081366
native app-info three cases pass, but final suite fails because added cases leave
ownedappstale body instead of dup. Original state restored; final canonical-body
harness fix rerun passes without any application source change after build.

Compiler30542/73240 zero errors/warnings; saved headless sync94342 passes11isolated
controls/non-isolated refusal through actual c.app, helper renderer94750 and
dialogs14688 pass. All handles terminal; no live handles from this acceptance.
The commit topic contains the standalone synchronous helper factory, reusable
native info fixture and this evidence document. Runtime/renderer/native adapter/
main scenario/dependency activation remains with the uncommitted wider helper
feature. This does not claim standalone committed production facade activation.

The retained callback runtime already had guarded synchronous RPC, but actual
callbacks received only async app dialogs. The template tag provider also omitted
the native synchronous endpoint. The candidate composes getInfo/getPath/live
clipboard helpers into the actual frozen c.app with existing async dialogs when
the operation owns a sync capability. It passes the captured syncCall through the
provider/registry and creates the native endpoint for the same renderer operation
owner and AbortSignal. Metadata callbacks still receive no helper capabilities.

Each helper closure captures the real callback generation. Retained objects fail
after generation change, rather than dispatching into a newer callback. Native
API promises stay on the host, while the dedicated worker waits through the
existing bounded mailbox; the QuickJS guest gets synchronous values or errors.
Native endpoint checks the actual owner before dispatch and after completion.
Information is detached, Desktop accepts the existing case-insensitive contract,
and unsupported paths are rejected before native dispatch.

Saved plugin-app-sync fixture now exercises actual c.app rather than injecting a
separate factory. Eleven isolated headless controls plus non-isolated refusal
pass; retained helper-render and async-dialog scenarios pass. Those controlled
services do not prove native OS clipboard behavior. New saved main-scenario
mode INSOMNIUM_PLUGIN_APP_INFO=1 compares getInfo/getPath to actual native APIs,
checks synchronous/frozen/detached results and previous-callback refusal. It does
not read or mutate the native clipboard. Native app information/path acceptance
above is bounded; full facade/platform acceptance remains required.

Full app DOM/events/onHide/private compatibility, exact original-format clipboard
restoration, native late mutation/cancellation/concurrency/provider/platform
policy and all original migration parity remain required. Shared-input UX/UI/CSS
is still the subsequent phase. This is not complete app/helper/migration parity.

Official documentation consulted before activating this subsystem:
[Tauri app APIs](https://v2.tauri.app/reference/javascript/api/namespaceapp/),
[Tauri path APIs](https://v2.tauri.app/reference/javascript/api/namespacepath/),
[Atomics.wait dedicated-worker contract](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics/wait),
and the previously initialized [Tauri clipboard plugin](https://v2.tauri.app/plugin/clipboard/).
Commands: bun run check; bun tests/ui/plugin-app-sync.js;
INSOMNIUM_PLUGIN_EXTRA_INFO=1 bun tests/ui/plugin-helper-render.js;
bun tests/ui/plugin-app-dialogs.js; bun x --bun tauri build --no-bundle with isolated
probe identifier and beforeBuildCommand=bun run build. Native scenarios use the
saved byte-preserving runner; browsers stay headless and native hosts hide before
CDP. No Node/npm/Python tooling or browser-use.


</details>

<a id="record-plugin-cancel-recovery"></a>

<details>
<summary>PLUGIN-CANCEL-RECOVERY</summary>

# Plugin catalog recovery after callback cancellation

Cancellation retires the callback's worker to deny late guest replies. It must
leave the admitted package's template definitions available to subsequent requests,
as legacy `getTemplateTags()` collects definitions from active plugin modules.
The previous registry instead marked any closed worker as an error, so native
WebSocket Disconnect during a plugin prompt made the next HTTP Send fail with
`unknown block tag UnicodeTag` until the package was loaded again.

The session now records its first close reason. Only trusted host `AbortError`
closure permits automatic recovery; worker errors, malformed replies and time
limits still quarantine the package. Recovery creates a new worker lazily from
the original admitted source snapshot. It never replays the cancelled callback or
rereads changed source. One shared recovery promise handles concurrent callers.
Recovered metadata must match the admitted catalog exactly. Owner/configuration,
Disable/Unload and catalog guards remain required before and after recovery.
Arguments and callback context are detached before awaiting recovery. Late
rejections from a retired worker cannot quarantine a replacement worker.

## Verified evidence (2026-10-11)

- Saved `INSOMNIUM_PLUGIN_CANCEL_RECOVERY=1 bun tests/ui/plugin-helper-render.js`
  before the fix failed: parent status `error`, expected `ready`. Tool session
  19538 exited 1. Existing native negative evidence is retained under
  `artifacts/playwright/plugin-template-tags-1791679924738`.
- Fixed saved scenario 75594 passes 22 checks / 91 terminated workers. Final
  `INSOMNIUM_PLUGIN_CANCEL_RECOVERY=1 INSOMNIUM_PLUGIN_EXTRA_INFO=1` run 29122
  passes 28 checks / 97 terminated workers, including retained CPU quarantine.
  The Windows command sets those environment variables in PowerShell first.
- `bun run check` session 40386 passes with zero errors and zero warnings.
- Production candidate `artifacts/native-plugin-cancel-recovery-probe` freezes
  57 source files, including the registry omitted from the older 56-file freeze.
  Build 90723 exits 0 in 382.689 seconds; executable SHA-256
  `324eb45d9b1637b9e52d0d5cb6f573513a2380bc2a466fd7062810b7c46af425`.
- Native 23272 exits 0: scenario `plugin-template-tags-1791681123981` and
  restoration `plugin-workspace-helper-restoration-1791681123398`. The same
  saved scenario now omits the explicit Preferences/Load after Disconnect.
  Sixteen checks / ten terminated workers / eleven native HTTP requests plus
  one WebSocket connection and two messages pass. The ordinary Unicode tag
  response is sent after cancellation with no reload. Independent audit passes
  all 57 current/exact snapshots, owned hidden host exit, worker assets, response
  bytes/history, populated cookie model, store and both workspace buffers;
  all 653 original cookie files remain unchanged. Owned cookie fixtures alone
  are removed after the host exits. Auditor initially expected eleven workers;
  ten is correct because automatic recovery replaces the prior manual Load.
- Separate saved `bun tests/ui/plugin-cancel-recovery.js` passes six controls
  with five real guest workers, all terminated: active cancellation, pinned
  source, shared concurrent recovery/detached arguments, guest quarantine,
  owner loss during recovery and mismatched metadata refusal.
- The same six controls pass with `INSOMNIUM_PLUGIN_RECOVERY_STAGE` pointing
  at `artifacts/plugin-cancel-recovery-topic/bundle`: HEAD session plus only
  cancellation-reason changes, HEAD callback-context contract and the registry
  recovery changes. The current production worker asset is used. This proves
  the isolated host topic without claiming a separate staged production build.
  Final compiler 58070 passes zero errors/warnings. An initial dedicated harness
  referenced a Node-side variable in page.evaluate; corrected directly. Initial
  compiler diagnostics were confined to this harness's JSDoc types and fixed.

Full helper activation, gRPC/OAuth/preview, synchronous native app/clipboard,
DOM/private APIs, broader platform/provider parity and the complete migration
remain required. The shared-input UX/UI/CSS phase remains in the full objective.

Official lifetime contracts consulted: [HTML Worker termination](https://html.spec.whatwg.org/multipage/workers.html#dom-worker-terminate)
and [DOM AbortSignal](https://dom.spec.whatwg.org/#abortsignal). Recovery policy
above is application behavior; termination alone does not reload a package.


</details>

<a id="record-plugin-compatibility"></a>

<details>
<summary>PLUGIN-COMPATIBILITY</summary>

# Legacy plugin compatibility inventory

2026-10-10 custom tag definitions: all eight argument types, typed defaults/options/file filters/actions and dynamic metadata callbacks preserved in isolated sessions; initial metadata value codec retains signed zero. Productione10918eb/current739source/native18refusals/20workers/40files/0store IPC/full workspace plus registry+restart/values/session/store/runtime/formats/discovery/sources+restart audits pass; compiler0/0/headless12/owned cleanup/native-hidden/visible:false/exit0. This accepts descriptor/query capability; product collision/priority registration/tag editor/resource contexts/Send/menu integration and every original migration/UX/UI/CSS gate remain required. [PLUGINS.md#record-plugin-tag-metadata](PLUGINS.md#record-plugin-tag-metadata).

2026-10-10 application plugin registry: explicit isolated Load/Unload with admission identity, dedup and saved disable/reload/path/config/root ownership verified on production8c3c04f6/current736source. Native4groups/6real terminated workers/8files/six layouts/0store IPC plus actual restart/full workspace restoration, retained values/session/store/runtime/formats/discovery/sources+restart audits pass. Compiler0/0/headless workspace12/owned cleanup pass; native-hidden/visible:false/exit0. Contributions remain inactive. Tag argument/collision registration, resource/callback contexts, other context adapters, Buffer-stream/legacy import, ordered Send hooks/action menus/themes, complete admission and every original migration/UX/UI/CSS gate remain required. [PLUGINS.md#record-plugin-registry](PLUGINS.md#record-plugin-registry).

Covered callback data transport now preserves undefined/nonfinite/-0/bigint/sparse/cyclic/shared/Date/Map/Set/binary views/RegExp through a bounded graph codec; native48checks and retained session/store/package/restart audits pass on corrected production3a34fbbf/current734source. Unsupported values explicitly refuse. Legacy Buffer/stream compatibility, product admission/registries/other contexts/lifecycle and full plugin/migration/UX/CSS scope stay required. [PLUGINS.md#record-plugin-values](PLUGINS.md#record-plugin-values).

Retained callback core now executes seven contribution kinds in owned isolated sessions with all six durable context.store methods. Production9e3c459d native/restart and retained regressions pass independent audits. This is a callable core with a required live-owner guard; product registries/Send hooks/action menus/themes, full argument/value encoding beyond JSON-only, admission/disable/reload ownership and other context adapters remain required. [PLUGINS.md#record-plugin-session](PLUGINS.md#record-plugin-session).

2026-10-10 inventory from the read-only archive and current source. This is an implementation inventory, not completed custom-plugin parity. No archive files or installed user plugins are changed.

The first admission milestones now have covered Windows native acceptance: read-only package metadata/Preferences status reporting, persistent custom paths/explicit legacy import/actual restart, bounded entry normalization/file-index-fallback lookup, nearest-scope format and isolated CJS/ESM export inspection. See [PLUGINS.md#record-plugin-discovery](PLUGINS.md#record-plugin-discovery), [PLUGINS.md#record-plugin-folders](PLUGINS.md#record-plugin-folders), [PLUGINS.md#record-plugin-entries](PLUGINS.md#record-plugin-entries), [PLUGINS.md#record-plugin-formats](PLUGINS.md#record-plugin-formats) and [PLUGINS.md#record-plugin-runtime](PLUGINS.md#record-plugin-runtime). All eight contribution arrays have metadata inspection; their activation, complete module admission/lifecycle, duplicate-winner policy, package installation and the six custom context namespaces remain required.

The archived `packages/insomnia/src/plugins/index.ts` loads directories with package.json containing an `insomnia` field, traverses scoped package directories, clears CommonJS require caches and evaluates the module through global.require. Settings supports install/reload/disable/configuration. The archived installer uses Electron/child_process and a package-manager flow; those mechanisms cannot be copied into the Bun-only Tauri runtime.

| Legacy contribution | Current implementation | Required continuation |
| --- | --- | --- |
| templateTags | Bundled base64/now/uuid/hash/jsonpath and application-owned OS/file/cookie/prompt/request/response bridges | Custom package discovery, registration, declared tag argument metadata, collision policy, reload/disable and error reporting |
| requestHooks | DEFAULT_HEADERS native acceptance retained; loaded custom hooks now run sequentially after rendering/default headers and before transport, using detached request/environment data and existing guarded sessions | Native DOM dialogs, later payload-profile validation, larger bodies and broader protocol/provider/platform coverage remain open |
| responseHooks | Loaded hooks captured at Send run sequentially after HTTP completion and before history publication for normal/dependent requests; readonly request facade, duplicate response headers, realm-local readable-stream body streams and exact Buffer body replacement retain network size separately | Native hook DOM-dialog integration acceptance, broader stream/module compatibility and payloads beyond the bounded 8 MiB hook codec envelope remain open |
| themes | Owner-directed shared Nocturne dark/light system | Explicit theme compatibility handling; arbitrary legacy plugin themes are not silently applied |
| requestGroupActions | Loaded actions in folder management use detached group/direct HTTP request arguments sorted by metaSortKey, with existing helpers/Cancel/source guards | Broader native cancellation/reload/protocol/provider coverage, full data mutation namespace and provider/platform compatibility |
| requestActions | Loaded actions appear in request management for HTTP/WebSocket/gRPC models; guarded existing VM dispatch with detached saved request argument, prompt/render/network/store capabilities and Cancel | Broader native cancellation/reload/protocol/provider coverage, complete data mutation namespace, protocol/provider/platform compatibility |
| workspaceActions | Loaded actions in collection management receive workspace/groups/non-private descendant HTTP requests; shared explicit dispatch and ownership guards | Broader native cancellation/reload/protocol/provider coverage, full data mutation/persistence namespace and provider/platform compatibility |
| documentActions | API Design menu dispatches loaded document actions with legacy parsed/raw/format/version data; metadata preserves hideAfterClick and menu honors it; direct network helper absent/denied | Broader native cancellation/reload/protocol/provider coverage, full data namespace, provider/platform compatibility |

The six archived context namespaces are independent requirements:

| Context | Source and contract | Current boundary |
| --- | --- | --- |
| app | context/app.tsx: alert/dialog/prompt, getPath/getInfo, Save dialog, clipboard, deprecated generic modal and private renderer-module/axios bridges | Built-in prompt/native APIs exist; no custom plugin context; Electron/React/Node access cannot silently leak into the renderer |
| data | context/dataInit.ts: URI/raw import and collection/ HAR export, active-project ownership | Product import/export exists; no custom context adapter |
| network | context/network.ts: sendRequest uses target environment, rendering, request hooks, transport, response hooks and saved history | Owned dependent sender exists; no general plugin network adapter |
| request | context/request.ts: ID/name/URL/method/environment, cookie/settings/header/parameter/authentication/body/text access and mutations, readOnly behavior | Detached Send snapshots exist; no plugin facade |
| response | context/response.ts: request ID/status/message/bytes/time/body/body stream/headers and body replacement | Product response tools exist; no plugin facade or Node Buffer/stream compatibility |
| store | context/store.ts and models/plugin-data.ts: plugin-scoped hasItem/setItem/getItem/removeItem/clear/all; PluginData is local-only/non-sync | Durable six-method native/host/isolated guest bridge accepted with actual restart/fault/isolation and core live-owner controls; product lifecycle ownership and legacy PluginData import remain required. [PLUGINS.md#record-plugin-store](PLUGINS.md#record-plugin-store), [PLUGINS.md#record-plugin-session](PLUGINS.md#record-plugin-session) |

Current isolation lives in template-runtime.js/template.worker.js/template-client.js: fresh QuickJS VM and disposable worker, trusted bundled Nunjucks source, explicit host tag allowlist and JSON bridge. Guest templates have no module/file/network APIs. Do not broaden that boundary by executing imported JavaScript in the Svelte renderer, exposing raw invoke, or reviving Node/Electron. A custom-plugin implementation must define a separate package admission/execution contract while preserving the existing template bounds and owner Bun-only rule. Unsupported dependencies/contributions must be reported explicitly, with package/store bytes preserved.

The default-headers hook source is plugins/index.ts getRequestHooks: read rendered DEFAULT_HEADERS, iterate own keys in order, skip existing names case-insensitively, treat the exact string null as omission only after the existing-header check, append other values literally. Archived common/render.ts removes disabled header rows before hooks; the new shared Send path has the same order. This built-in gap has covered native acceptance recorded in [HTTP.md#record-default-headers](HTTP.md#record-default-headers) and does not implement custom module loading.

Next sequence: complete package admission and compatibility reporting; implement isolated custom tag lifecycle, bind the accepted durable host store to guest context and import legacy PluginData; integrate ordered hooks and action registries; then verify reload/disable/mutation/cancellation/UI/provider/platform cases. Every original plugin contribution/context remains required unless explicitly removed by the owner. Inventory does not remove scope or complete migration/UX/CSS.


</details>

<a id="record-plugin-discovery"></a>

<details>
<summary>PLUGIN-DISCOVERY</summary>

# Plugin package discovery

2026-10-10 covered Windows native discovery and Preferences controls verified. This is the first package-admission milestone from [PLUGINS.md#record-plugin-compatibility](PLUGINS.md#record-plugin-compatibility); custom plugin execution and full migration remain incomplete.

Preferences now has a Plugins page with Inspect folder, Reload plugins and Default folder. Opening the page inspects the app-data plugins folder; the folder is not created if absent. A selected package folder can be inspected directly, or a container is searched for direct children, scoped packages and node_modules children. Folder selection is transient and does not rewrite legacy pluginPath/pluginConfig or PluginData. Saved disabled configuration is displayed without claiming activation. Existing shared buttons, feedback, tabs, scroll layout and theme tokens are used.

The native discover_plugins command reads package.json and entry metadata only. It never imports code, runs an installer, writes packages or activates contributions. Results distinguish pending execution, invalid names/missing entries, non-JavaScript entries, duplicate package names and per-folder/manifest failures. Ordinary libraries without their own insomnia field are omitted. Description fallback, version, CommonJS/module entry format and dependencies/optional/peer names are reported. Duplicate names retain every candidate; no arbitrary winner is activated.

Inspection is bounded by a 256 KiB manifest, 512 directory entries across the scan and 128 packages. Truncation is explicit through complete:false and a visible warning. Package manifests and resolved entries must stay inside the package's canonical directory. Linked package directories outside a container can be inspected directly, with an explicit message in the container report. Entry lookup covers main or index.js, extension fallback and directory index files. Nested directory-package main resolution, complete dependency admission, all malformed/platform/filesystem cases, persistent custom search paths and npm installation remain required work. Invalid entry metadata does not imply that code has been evaluated; module contribution types cannot be inferred from this static inspection.

Official documentation consulted before implementation:

- [Tauri commands](https://v2.tauri.app/develop/calling-rust/): separate Rust module, async IPC and spawn_blocking for file work; existing Tauri command registration/permission generator is extended without a new dependency or subsystem generator.
- [Rust read_dir](https://doc.rust-lang.org/std/fs/fn.read_dir.html): per-entry errors and nondeterministic enumeration; complete results are sorted and scan limits are reported.
- [Package metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/): main, type and dependency fields. No npm executable is used.

Saved native scenario: `bun tests/ui/plugin-discovery.js` with INSOMNIUM_UI_BUILD_STATE pointing to the freshly built isolated probe. It uses the shared native-hidden helper and reusable package/dialog fixtures. The accepted corpus has13 plugins,2 manifest errors, direct/scoped/node_modules roots, explicit duplicates/invalid/unsupported entries, dependency metadata, a513-entry truncation control and code-execution marker. Mounted controls cover cancel/select/reload/direct-package/missing-folder/default recovery, six dark/light width profiles and unchanged package/workspace data. Native OS dialog replies are controlled by the existing helper; this is not OS dialog surface acceptance.

Initial compiler67648 failed with7 JS scenario annotation errors; fixed JSDoc without changing app behavior. Final compiler62823 passed0errors/0warnings; formatting and diff checks passed. Fresh production build/native acceptance are pending. Custom runtime/registration/store/hooks/actions and all six contexts/eight contribution types remain required, alongside every original full migration/UX/CSS gate.

Current source freeze is `artifacts/playwright/plugin-discovery-source-freeze.json`:471application/237scenario paths before the expected generated discover_plugins permission is produced by the frozen build.rs. Prior accepted f7c86550 executable/build-state are preserved under `artifacts/native-plugin-discovery-baseline`. Production build52765 started1791624824203, using the workspace LLVM20.1.8 LIBCLANG_PATH and no low-memory override. Current headless workspace12 passes on the new frontend. App/scenario edits are frozen until build/scenario is terminal; independent source/build/package-byte/marker/layout/native-hidden audit is prepared in artifacts/plugin-discovery-audit.mjs.

Retained saved headless theme scenario21273 exited0/result passed:true on the new frontend: dark/light1440/900/760,19 covered surfaces and persistence. Its result is `artifacts/playwright/nocturne-theme/result.json`. This is the retained browser regression, not native Plugins acceptance.

First production52765 finished0 in7m33s and bound709source/generated permission/probe/originalf7 baseline; executable SHA25629bb3dbb138563094a5a1b65f7e8301069c42ea0f67dc878efedb14fb645ecde. No native scenario was run on it. Review identified failed filesystem entries did not consume the global scan budget; after terminal, changed only plugins.rs to count both successful and failed entries. First executable/state/freeze retained under `artifacts/native-plugin-discovery-first-build` and `artifacts/playwright/plugin-discovery-first-build-freeze.json`; current709source freeze refreshed for the one Rust edit. New production34734 started1791625367426. Native acceptance remains pending on the corrected source.

## Final acceptance

Corrected production34734 finished0 (finished1791625836149), SHA256 `75d118b3c4031831e7afe2417cc539be23c957159ce65ebe8e0563ab8bcaf4ce`. The source/build binding passes709paths/probe identity/production release profile/preservedf7 baseline, including the permission generated from the frozen build.rs.

First native artifact `artifacts/playwright/plugin-discovery-1791625844709` passed13packages/2manifest errors/six profiles; native66652 exited0/native-hidden/visible:false and independent audit passed. Visual inspection found the light1440 frame captured during theme saving. After terminal, changed only the saved scenario to wait for persisted theme and hidden Saving status before capture; application/executable hashes stayed unchanged. First native freeze is retained as plugin-discovery-first-native-freeze.json. Final compiler37951 exited0/0errors0warnings.

Final native artifact `artifacts/playwright/plugin-discovery-1791625981694` passed on the same executable; native67284 exited0/native-hidden/visible:false. Independent audit verifies709current source hashes/executable/baseline,13package statuses/literal manifest names/versions/entry containment,2manifest errors,513-entry truncation, all28fixture file hashes unchanged and execution marker absent, six measured profiles and saved images. The saved scenario compares actual persisted workspace values before/after and restores the original theme. All six final images were inspected: no panel overflow, readable wrapped paths and settled controls in dark/light1440/900/760. Exact owned66652/67284 and WebView profile processes are absent, recorded in plugin-discovery-cleanup.json. No live feature handles remain.

```powershell
$env:LIBCLANG_PATH='E:/.dvgamerr-app/insomnium-app/artifacts/tools/llvm-20.1.8/bin'
Remove-Item Env:INSOMNIUM_UI_LOW_MEMORY -ErrorAction SilentlyContinue
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/plugin-discovery.js
```

Acceptance covers the listed fixture/Windows controls, not arbitrary module/dependency execution or all discovery filesystems. Parent segments in main are currently refused even if they would normalize inside the package; nested package-directory main lookup, linked package variants, manifest/dependency policy,128-package cap/platform/permission failures and close-during-inspection controls still need completion/verification. Persistent search-path/imported pluginPath migration, installation/reload/disable activation, isolated custom tags/store/hooks/actions and all eight contributions/six contexts remain required. Every original migration/UX/CSS gate remains active.


</details>

<a id="record-plugin-dom-callback-leases"></a>

<details>
<summary>PLUGIN-DOM-CALLBACK-LEASES</summary>

# Retained guest callback leases for DOM dialogs

Current working session integration is documented in [PLUGINS.md#record-plugin-dom-session](PLUGINS.md#record-plugin-dom-session).
Its actual production worker/client scenario adds capability-frame, queue and
trusted interaction acceptance. Runtime assembly remains uncommitted; the initial
standalone acceptance below is historical. The pump now accepts trusted idle and
deadline predicates so host RPC drain/prompt waiting obey the runtime's policy.

DOM event listeners and onHide must survive the callback that opens a dialog.
The existing callback runtime removes helper privileges on return; directly
reusing that operation would make retained callbacks stale or close UI as soon
as the render session finishes. The new lease manager retains actual QuickJS
function handles with their lexical state and captures a trusted host owner.
Functions are not serialized through the value codec or recreated from source.

Each invocation copies argument values before queueing, rechecks ownership at
execution, and drains guest Promise jobs serially. The immutable guest dispatch
bridge only calls the currently executing handle. Release/Abort/current-loss
dispose idle handles; in-flight cancellation, guest failure or CPU interruption
revoke all leases and notify the caller after active handles are released.
The caller must replace the terminal VM. Queue/function limits bound retained
resources. The lease manager owns its polling timer, not the VM itself.

## Saved verification — 2026-10-11

`bun tests/ui/plugin-dom-callback-leases.js` runs headless through the shared
launcher with three dedicated, genuine QuickJS workers. Six groups prove retained
closure state after the original function handle is disposed, Promise results,
serialized overlapping messages, detached argument values/signed zero, idle
release/Abort/current-loss refusal, active Promise cancellation and terminal
guest exception/CPU interruption. The fixture verifies three worker terminations.
The fetched worker hash matches its saved compiled bundle. Compiler and audit
results are recorded in STATUS.md.

`bun artifacts/audit-plugin-dom-callback-leases.mjs --freeze` preserves local
src/tests-ui sources, the compiled worker and both original/served WASM bytes.
Without the flag it checks current/snapshot/result hashes and the acceptance
assertions. This does not bind a native executable or every external dependency.
All scripts use Bun.

## Integration still required

This manager is not connected to production plugin-session-runtime/worker/client
yet. Integration must share their single exclusive VM queue, bind leases to the
original capability owner, restore only its authorized helper frame while a
retained callback runs, and preserve the dialog owner's lifetime beyond the
short-lived render operation. VM replacement must release its DOM roots and
recover the admitted plugin catalog. Do not run two operation pumps on one VM.

Guest DOM nodes/mutations/event transport, event target/this semantics,
exactly-once onHide dispatch, generic HTML/private APIs, actual app route/native
activation and complete app facade parity remain required. This is foundational
callback lifetime evidence, not full DOM or product activation acceptance.

Reference: [QuickJS handles and async host interoperability](https://github.com/justjake/quickjs-emscripten).
DOM bridging references consulted: [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
and [Document.createElement](https://developer.mozilla.org/en-US/docs/Web/API/Document/createElement).


</details>

<a id="record-plugin-dom-collections"></a>

<details>
<summary>PLUGIN-DOM-COLLECTIONS</summary>

# Owned DOM collections parity

Status2026-10-12: supported owned DOM collection and reflection slice accepted in frontend and fresh native execution; topic commit pending. Full DOM/private parity remains open.

## Final native acceptance and handoff

Final builder50514 exits0 (165aa5); executable1bafb30ec172a41709876a3adce4a25ccc6bab8c48f0fd7d8963d5fc9d7a6440 binds684source files and49frontend/generated files. `bun artifacts/freeze-plugin-dom-collections-reflection-frontend.mjs` freezes the frontend; `bun artifacts/run-plugin-dom-collections-reflection.mjs` exits0 (68049) with scenario1791749757649 and restoration1791749757073. Native-hidden/visible:false/exit0,68checks/27terminated plugin workers/102HTTP plus gRPC/reflection/WS/SSE pass. Three added collection groups compare all28browser groups on actual native Send using module-captured reflection, verify live membership after independent host append in the retained callback after Send completion, and read live/static membership in detached async onHide. Earlier terminal12cases retain12original detached nodes/count1; nine healthy cleanups finish, three deliberate error/CPU/unsettled cases report bounded failure.

`bun artifacts/audit-plugin-dom-collections-reflection-native.mjs artifacts/playwright/plugin-template-tags-1791749757649 artifacts/playwright/plugin-dom-collections-reflection-restoration-1791749757073` exits0 (f440ef). It verifies all684current/frozen sources,49frontend/generated files, served-worker/executable identity, collection oracle equality, retained/cleanup controls, original protocol/terminal evidence and restoration of both original workspace buffers/store/all653cookie files; only the owned new cookie file is removed. The first audit c101e2 stopped at a copied100wire count: added collection Send and dialog Send prove exactly two additional requests; the corrected102count is independently checked against these exact bodies. Original audit preserved in native-plugin-dom-collections-reflection-probe/audit-before-wire-count.mjs. No product/scenario change or native rerun was needed. Expected SSE failure-control stderr remains intentional; actual native suite and error-history evidence pass.

Frontend32checks/CommonJS+ES module/48regressions/compiler0errors/0warnings/build0 and positive626/five-negative snapshot audit pass. All builder/compiler/scenario handles are terminal. Native method-capture execution is CommonJS; ES capture is separately genuine frontend VM acceptance, not a claimed native ES run. Broader DOM properties/events/default cancellation/HTML/private dependencies/module-load DOM, OS clipboard/save platform/provider/full migration and shared-input UX/UI/CSS remain required. `/compact` cannot be invoked through this interface; STATUS records the feature handoff.

## Early realm reflection and current acceptance

Latest update: constructibility review fixed before native acceptance. Object-method wrappers have the original names/argument counts, no own prototype and reject Reflect.construct/new. Saved e534e0 now passes28browser groups and32checks, including full module-captured CommonJS/ES comparisons; compiler85316/0errors/0warnings and48current regressions pass. Independent frontend audit verifies positive626current/frozen files plus all five negative manifests and684native candidate sources. Current worker4c3118edf28d38c749f6b6f882b87de49e8dffc0b20fd76cfe14a81df14471a5. Original native builder63324 finished0 and is intermediate evidence only; final candidate684source/build50514 lives in native-plugin-dom-collections-reflection-probe. Poll existing50514, freeze frontend after completion, run its saved restoration wrapper, then audit native collections/protocol/terminal/restoration evidence. No final native collection acceptance/commit claimed yet; all original broader gates remain required.

`createPluginVm` initializes the inert owned DOM facade before evaluating CommonJS or ES modules. Its private WeakMap brands distinguish actual collections from ordinary objects and prototype spoofs. The guarded DOM transport is bound later by the callback runtime; bootstrap itself performs no host operations and does not accept module-load DOM access. Immutable global facade/constructors prevent replacement of the trusted collection identity. Ordinary Object/Reflect definitions delegate to captured intrinsics. Owned collection descriptors preserve key conversion, ordered HasProperty/Get validation, omitted fields, callable accessor validation and two-stage defineProperties conversion/application. Browser throwing Object definitions reject read-only indexes/names; nonthrowing Reflect definitions ignore them and report success. No read-only member is made a nonconfigurable backing property.

Primary algorithms consulted: [ToPropertyDescriptor](https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-topropertydescriptor) and [ObjectDefineProperties](https://tc39.es/ecma262/multipage/fundamental-objects.html#sec-objectdefineproperties). Saved oracle exposed the throwing/nonthrowing distinction; the first early bootstrap attempt remains preserved in artifacts/plugin-dom-collections-proof/early-reflection-negative (source and actual failed comparison/result). No assertion removed.

Current saved headless run5afa34 passes27browser groups, complete CommonJS and ES module comparisons with module-captured intrinsics, retained host mutation, detached async cleanup and five graph refusals (31checks). Compiler48405/70461 exits0 with0errors/0warnings; build171a6a exits0. Current guest6/terminal15/owner20/session7 regressions all pass48checks. New native collection helper adds actual native Send/full WebView2 oracle comparison and retained/cleanup cases to the existing protocols/terminal suite. Native source684files frozen; builder session63324 is live and must be polled, not restarted. No native collections acceptance claimed yet.

## Requirements and original failure

Legacy app.dialog mounts the actual supplied HTMLElement through HtmlElementWrapper, so plugin-visible collections have ordinary browser DOM behavior. Existing guest children/childNodes/querySelectorAll returned Array snapshots. Saved `bun tests/ui/plugin-dom-collections.js` executes the same reusable test function against real browser DOM and the genuine production guest VM/owned host graph. Original326e11 failure proves Array brands, missing constructors/item/namedItem, unstable children/childNodes object identity and stale membership after append/reorder. Exact620source/config/scripts/build/generated/result/comparison files are frozen in artifacts/plugin-dom-collections-proof/negative.json, baseline76c89a9. No synthetic guest node model is used.

Standards consulted before implementation: [DOM collections](https://dom.spec.whatwg.org/#old-style-collections), [NodeList](https://dom.spec.whatwg.org/#interface-nodelist), [HTMLCollection](https://dom.spec.whatwg.org/#interface-htmlcollection), and [ECMAScript Proxy DefineOwnProperty](https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html#sec-proxy-object-internal-methods-and-internal-slots-defineownproperty-p-desc). The WebIDL legacy-platform-object page failed to load; do not claim it was read. No dependency or new subsystem initialized.

## Earlier implementation and failure evidence

Three product files add NodeList/HTMLCollection globals, SameObject children/childNodes references, live scoped tag/class descendants, static querySelectorAll NodeLists, item/namedItem, numeric/named properties, iteration/forEach, constructor/receiver brands and read-only indexed membership. Every live read resolves against the actual owned host subtree, preserving node identity and existing owner/node/call/time/text budgets. Text nodes have childNodes but no children. Named IDs never shadow collection prototype methods. The read-only dom.collection transport is admitted during the existing exact detached onHide cleanup phase; no global host document/window endpoint is exposed.

Latest saved scenario d78c10 still exits1 on an explicit non-configurable indexed descriptor difference. Nineteen of20browser comparison groups match. It independently reaches and records a retained original guest callback after actual host DOM append, live length2/static length1/identity/native-facade version, detached async onHide reading the same collections, five malformed/foreign graph refusals and all owned workers terminated before the final unchanged full comparison assertion fails. Controls: artifacts/playwright/plugin-dom-collections/controls.json. Advancing that assertion after controls does not remove or weaken it.

Independent `bun artifacts/audit-plugin-dom-collections-in-progress.mjs` validates five preserved negative snapshots, all625current/frozen source/config/build/generated/control/regression files, original core files against76c89a9, the actual current worker hash and exact19matching/one failing group. It reports collectionsComplete:false/nativeCollectionsAccepted:false/migrationComplete:false. Intermediate define-negative/descriptor-negative/invariant-negative snapshots each preserve620files before the next change. The initial test-helper typing errors37218 (three) and guest rest-parameter error40348 (one) are fixed; final compiler69026 exits0/0errors/0warnings. Final build84c518 exits0; current plugin worker f174163e50ac35d98f7d98103e38f56ad96525a3b8197ced2f97240539d860b1. Current guest DOM6groups, terminal15groups65291, owner20groups and session7groups84132 pass (48regression checks). One intermediate scenario launched while build16930 was still rewriting build and failed ENOENT; that run is not acceptance. Subsequent scenarios ran only after build completion.

## Earlier reflection constraint and remaining broad work

Browser Reflect.defineProperty(nodeList,'0',{value:other,configurable:false}) returns true and ignores replacement, retaining a configurable read-only indexed descriptor. Returning false from a JS Proxy differs; returning true triggers QuickJS's Proxy invariant TypeError. Both are reproduced in preserved comparisons. Do not delete the assertion or declare the simpler Proxy facade complete. Determine an implementation that provides the required legacy platform-object reflection without altering membership, weakening owner guards or silently changing ordinary object reflection. The installed quickjs-emscripten public FFI has ordinary QTS_NewObject/QTS_NewObjectProto but no advertised custom exotic-class creation API; this is an implementation constraint, not a missing user approval.

A late global Object/Reflect shim is insufficient: createPluginVm executes plugin modules before createPluginCallbackRuntime installs the DOM facade, so a module can capture original intrinsics first. Any realm bootstrap approach must preserve ordinary object behavior, initialize before guest module evaluation and cover descriptor conversion/validation, Object.defineProperty/defineProperties/Reflect.defineProperty, captured functions, prototype collisions, dynamic removal and all required invariant/retirement controls. A native VM exotic-object approach requires documented engine support and verified handle/GC ownership. Investigate these paths before choosing, instead of assuming a wrapper makes the gate green.

Then pass the full differential scenario and retained/terminal/foreign-graph controls, compiler/build/current regressions, freeze positive evidence, and verify fresh native collections on a new executable with restoration. Oldb0652290/native65 binds76c89a9 and predates the current guest/bridge/runtime edits; it is historical for collections. Commit only verified work by topic. Property handlers, synchronous event cancellation/default actions, broader DOM/HTML/private React/ReactDOM/module-load DOM, actual clipboard/platform/provider/all original migration and shared-input UX/UI/CSS remain required. All current handles terminal. Interface cannot invoke /compact; this is an unfinished-work handoff, not a compaction or completion claim.


</details>

<a id="record-plugin-dom-dataset"></a>

<details>
<summary>PLUGIN-DOM-DATASET</summary>

# Owned HTMLElement.dataset / DOMStringMap

2026-10-12: owned dataset frontend and fresh native acceptance verified. Baseline `7038da6`. This feature does not close full DOM/event/private dependencies, clipboard, save platform/provider, migration or UX/UI/CSS gates.

Builder87621 exits0 (Cargo6m51s), executable SHA-256 `1b697418c0c4acdfb16ea3aadb5ad977228ef800ef81aa1b4eb969954d887e82`. Native wrapper25726 exits0; scenario `artifacts/playwright/plugin-template-tags-1791752955026` and restoration `artifacts/playwright/plugin-dom-dataset-restoration-1791752954439` accept75checks/26terminated workers/107HTTP plus gRPC/reflection/WS/SSE. Dataset14value/mutation groups and four reflection groups match the native WebView2 oracle through identical JSON wire serialization. Retained actual original DOMStringMap observes independent host writes and guest callback mutation after Send; detached async onHide reads/writes it successfully. Original tokens/collections/12terminal cases pass. Native-hidden, visible:false, exit0; both original workspace buffers/store/all653cookie files unchanged; only owned new jar removed.

Independent native auditf067b4 passes690source/49frontend/generated/exe/served-worker/wire/full restoration identities. Frontend auditb86d0b checks2513frozen files across four manifests, original7038da6 product baseline,690current native sources,23headless/108regression checks and current worker. Initial auditor9331d2 attempted to find original browser-build chunks after Tauri regenerated frontend assets; original positive hashes remain verified in their snapshot and final49native assets are separately frozen/audited. No differing worker is accepted by this correction. Expected SSE fixture failure stderr is deliberate and verified by error-history controls; actual native suite/wrapper exit0. All build/compiler/scenario handles terminal.

Consulted the [HTML DOMStringMap and dataset algorithms](https://html.spec.whatwg.org/multipage/dom.html#dom-dataset) before implementation. The owned guest element caches a branded DOMStringMap facade. Reads/enumeration reflect the actual owned host element; named writes/delete use its native dataset. Host dispatch validates owner, node type, action and arguments, and charges the unchanged cumulative 8 MiB write budget before mutation. No app document/window access is added. DOMString conversion, dash/lowercase SyntaxError, invalid attribute name DOMException, Unicode/empty/punctuation names and prototype collisions are compared with browser DOM.

Captured Object/Reflect definitions use the same private pre-module reflection bridge as existing collections. Tests cover readonly flags, empty descriptors, accessor refusal/no-op, complete descriptor conversion before application, alternate Reflect.set receivers, illegal constructor, getter brands and SameObject identity. Ordinary reflection still delegates to captured intrinsics.

The initial missing dataset failure and two genuine helper-call-limit failures are preserved in `artifacts/plugin-dom-dataset-proof/{negative,define-negative,descriptor-negative}` with their manifests. The expanded oracle reached the existing 256-helper-call limit even after removing redundant descriptor reads. The saved case now runs value/mutation controls and enumeration/receiver controls as two independent operations; all original enumeration keys and assertions remain. Product quotas and deadlines are unchanged. Compiler57392 failed on four optional-getter typing diagnostics; explicit getter existence check resolves these. Compiler16420 and final65182 exit0 with zero errors/warnings; build6fe7c9 exit0.

`bun tests/ui/plugin-dom-dataset.js` ddacca exits0: 18 browser groups plus five lifecycle/control groups (23 checks), actual production QuickJS worker, CommonJS and ES module captured intrinsics, retained independent host mutation and guest callback write, detached async onHide, eight malformed/foreign graph refusals and quota refusal without partial write. Two workers terminate. Worker SHA-256 `68533ae46f19d08371d01d4c82180f94dcfb29e571a6eb29304d628b4625ecdd`. Token28 + collection32 + guest6 + terminal15 + owner20 + session7 =108 regression checks pass under the same worker. All browser launches use the shared fixed headless launcher.

Positive632source/result/build files and native690source/backend/config/lock files are frozen. Saved native dataset helper extends the existing protocol, terminal, collection and token suite with two actual Send/oracle comparisons and a retained dialog/cleanup case. Fresh native acceptance and full restoration now pass as described above. Native execution is CommonJS; ES module behavior is separately verified in the actual frontend VM.

Commands: `bun run check`, `bun run build`, `bun tests/ui/plugin-dom-dataset.js`, the six saved regression scenarios, `bun artifacts/freeze-plugin-dom-dataset.mjs positive`, `bun artifacts/prepare-plugin-dom-dataset-native.mjs`, `bun artifacts/build-plugin-dom-dataset-probe.mjs`. After build: `bun artifacts/freeze-plugin-dom-dataset-frontend.mjs`, `bun artifacts/run-plugin-dom-dataset.mjs`, `bun artifacts/audit-plugin-dom-dataset-native.mjs <scenario> <restoration>`.

Topic commit follows verified native acceptance and audits. The interface cannot invoke `/compact`; record commit, evidence, remaining gates and live handles in STATUS and provide that handoff before the next feature.


</details>

<a id="record-plugin-dom-dialog"></a>

<details>
<summary>PLUGIN-DOM-DIALOG</summary>

# Plugin DOM dialog host lifecycle

The host mounts the original HTMLElement through a Svelte action, preserving
event listeners and live mutations. The legacy contract is a synchronous void
`app.dialog(title, body, {onHide, tall, skinny, wide})`; general preview does
not show UI. The archived app context and HtmlElementWrapper are the reference.

The owned host has singleton replacement, stale-close protection and owner
Abort/current-loss cleanup. It removes the body before invoking onHide once.
Reentrant callbacks can open a newer dialog without earlier cleanup removing it.
Mount owner-check errors release the request and report the error. Host unmount
and pagehide release the active request.

## Verification — 2026-10-11

`bun tests/ui/plugin-dom-dialog.js` passes ten saved headless groups with the real
Svelte component, shared DialogShell and application CSS. The cases exercise DOM
events, Unicode input, mutation, replacement, malformed arguments, stale close,
Close, Abort, owner loss, reentrant onHide, reuse of the same body, callback
errors, mount errors, preview suppression and actual component unmount.

`bun run check` is the compiler gate. Exact evidence is recorded in STATUS.md.
`bun artifacts/audit-plugin-dom-dialog.mjs --freeze` preserves source bytes and
the result under artifacts/playwright/plugin-dom-dialog; the same command without
the flag checks their hashes against current sources. Scope is local src and
tests/ui, not external dependencies, native executable or native acceptance.

## Remaining integration

This is the browser host layer; it is not mounted in the application route yet.
The isolated guest does not currently have a DOM object/event/function bridge.
That bridge must preserve node identity, mutations and events, retain an owned
VM lease for callbacks after the initiating callback returns, and release it on
close, replacement, Abort, unload or app destruction. Do not wire the host to a
short-lived render session that aborts immediately after returning void.

Generic HTML and private React/ReactDOM/axios compatibility, exact legacy dialog
geometry, actual plugin/native activation and provider/platform parity remain
required. This host evidence does not close the full app facade migration gate.

Implementation references: [Svelte actions](https://svelte.dev/docs/svelte/use)
and [DOM appendChild](https://developer.mozilla.org/en-US/docs/Web/API/Node/appendChild).


</details>

<a id="record-plugin-dom-events"></a>

<details>
<summary>PLUGIN-DOM-EVENTS</summary>

# Full guest event compatibility in progress

Base Event interface continuation: consulted DOM Event/interface and listener invoke algorithms at https://dom.spec.whatwg.org/#interface-event and https://dom.spec.whatwg.org/#concept-event-listener-inner-invoke. Guest runtime now exports Event with private WeakMap receiver state instead of a mutable packet spread. Constructor/options/DOMString refusal, prototype readonly getters, own nonconfigurable isTrusted, constants, aliases, controls, initEvent and owned composedPath are implemented. Incoming native Event has the base brand and target/currentTarget identities; after listener return currentTarget null/phase0/pathempty and retained target/canceled state survive. Keyboard primitives remain forwarded, but keyboard/mouse/pointer subclass identities are not implemented. Shared native event object identity across multiple listeners/redispatch remains required; no acceptance claimed. Synthetic dispatch and module-load constructors remain open (constructor timeStamp currently requests owned host clock).

Saved `bun tests/ui/plugin-dom-event-surface.js`822ca1 evaluates the same independent exerciseEventSurface on browser native Event and genuine production QuickJS/Event. Twelve synthetic interface groups compare exactly, plus trusted pointer/this/target/currentTarget/phase/read-only/trust/owned path/original checkbox cancellation and post-await retained state:13groups/one terminated worker. Compiler51722/22758 exits0/0errors/0warnings; builda6220f0. Five unchanged saved guest/cancellation/clipboard-routing/dataset/tokens scenarios pass61checks against current94718e592fd7ff637c5537fc6f46d7f00615b96e9ead0f6893fe6f98f1144b58worker. `bun artifacts/audit-plugin-dom-event-surface.mjs`0c39eb freezes/verifies722current sources/config/results/actual worker/browser oracle/retained native Event/regressions, preserves711historical native source snapshot and explicit held-provider failure. Audit sharedNativeEventIdentityAccepted:false/eventSubclassesAccepted:false/nativeCurrentSurfaceAccepted:false/fullFeature:false. Oldd6152898native proof is historical after guest/runtime source changes. No native current surface acceptance, full event completion or topic commit. All task handles terminal; full original scope persists.

Actual production OS clipboard event acceptance: Windows private-station eligibility probes fail safely (PowerShell file policy983ee4; Bun named station access5/35b334; unnamed CREATE_ONLY existing183/da2c04). No policy/ACL escalation or reuse of unknown station. Read-only formatc962d5 identifies current complete four HGLOBAL formats13/16/1/7 (Unicode/locale/text/OEM),192bytes. Fail-closed native preserver uses owned message-only window, captures/preallocates/verifies all current format bytes in owner-process memory only, rejects unsupported/missing/changed data before mutation, and accepts only original sequence or owned fixture/empty state for restoration. Capture41b907 and actual original-data-only roundtripb4a784 fully match all4formats/order/192bytes; post-owner-exit preflightfd3dbe remains complete. This is current-set support, not arbitrary rich-format support; bytes/plaintext never persisted/logged.

Installed clipboard-manager2.4.0 serializes arboard3.6.1 ContentNotAvailable as an exact known string. Ordinary native endpoint and background event reader map only this exact variant to legacy empty string; other failures propagate. Root native event test covers ordinary SDK seed write/read, then actual registry/request renderer/owner/session/retained guest/native pointer read/write/read/clear/empty-read, undefined mutations, original default cancellation, owner Abort and worker retirement. Native outcomes serialize only booleans, never clipboard plaintext. Original current full clipboard set restored after owned process cleanup; unknown/concurrent state refuses overwrite.

Native builder48645 exits0/Cargo6m36s; executable d615289890722f10371ee64d020b606e180a7cfe18774e2c05ceb93291ea0ec0,711source/50frontend+exe freeze. First actual run1791761672800/restoration1791761672283 fails because experimental two-argument tag omitted comma; SDK seed already succeeded, and4formats/192bytes/all workspace data restored/app0. Original source/binary/failed evidence preserved. Only fixture comma plus explicit saved evaluated-bundle variant corrected; two UI harness source variants/v1-v2 manifests frozen. Current scenario handles either old embedded comma variant or future correctly embedded fixture without change. No production source/executable edits or weakened assertion.

`bun artifacts/run-plugin-dom-event-clipboard-native.mjs` succeeds twice (46542/87985; scenarios1791761763041/1791761987751; restorations1791761762534/1791761987242),2checks/2workers each/native-hidden/visible:false/app0. Four complete original clipboard formats/192bytes byte-verified restored; two workspace buffers/store/653cookies unchanged/no new cookie files/stderr empty. Same binary actual info/Desktop/trusted cancellation/21s renewal/request Abort rechecked via metadata wrapper17376/scenario1791762143355/restoration1791762142840,3checks/2workers. `bun artifacts/audit-plugin-dom-event-clipboard-native.mjs artifacts/playwright/plugin-dom-event-clipboard-restoration-1791761987242 artifacts/playwright/plugin-dom-event-clipboard-metadata-restoration-1791762142840` audit294269 verifies711frozen/current-with-explicit-harness-variants/50assets/exe/served workers/exact one-comma bundle/native outcomes/all restoration. Final compiler8082/e422190errors/0warnings; fresh guest6/routing3/original cancellation1 pass on exactb167cd29native worker. Native test and metadata processes terminal.

Full event feature still unfinished/uncommitted: original held-sync controlled Promise-provider test43349/2f2b17 remains red at unchanged assertion. Native quick clipboard IO acceptance does not solve this held-provider/cancellation gate. Actual busy/nested callback/capability frames, correct asynchronous listener checkpoint/default-action ordering, full Event identity/property handlers/once/removal/passive, other-platform/dev-origin/private/all migration and deferred shared-input UX/UI/CSS remain required. All task handles terminal; /compact unavailable.

Private clipboard test design research (not executed): Microsoft documents that each window station contains its own clipboard, and only WinSta0 is interactive: https://learn.microsoft.com/en-us/windows/win32/winstation/window-stations. CreateWindowStationW naming requires Administrators membership; CWF_CREATE_ONLY must refuse existing stations, and null security attributes grant broad access, so an owned-only descriptor is needed: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-createwindowstationw. Verify actual eligibility and private station/Desktop/WebView2 startup/owned host hiding before any clipboard mutation. Do not substitute a different desktop within WinSta0, which would share that station's clipboard. The attempted process/desktop guide URL was unavailable; no behavior inferred from that missing page. No isolation success or OS clipboard acceptance claimed.

Clipboard candidate update: consulted ClipboardExt/Clipboard APIs at https://docs.rs/tauri-plugin-clipboard-manager/latest/tauri_plugin_clipboard_manager/trait.ClipboardExt.html and https://docs.rs/tauri-plugin-clipboard-manager/latest/tauri_plugin_clipboard_manager/struct.Clipboard.html, plus documented asynchronous URI responder at https://docs.rs/tauri/latest/tauri/struct.Builder.html#method.register_asynchronous_uri_scheme_protocol. Installed2.4.0 desktop/error source confirms synchronous read_text/write_text/clear and the main-thread Linux warning. Handler now clones trusted app/window label, responds through spawn_blocking, and keeps the native event loop available. No new dependencies.

begin_plugin_event_transport optionally admits clipboardAccess, default false for existing read-only callers. New GET clipboard/read and POST clipboard/write+clear validate origin/window/token/expiry/method/body1MiB/exact keys before API calls. Mutation holds lease admission lock through dispatch but never while querying the native event loop; reads allow independent retirement then revalidate before publication. Current window/origin/lease/expiry are checked again after operations. Already-dispatched mutation cannot be undone by Abort, matching ordinary helper policy; stale return values are denied. Worker POST body is constructed from original validated args, without double-encoding clipboard text inside the host reply, and void results normalize back to undefined. URLs stay private to host/worker.

`bun tests/ui/plugin-dom-event-clipboard.js`97c901 passes3saved routing groups using the actual production session/retained guest/real original pointer checkbox and an independent real Bun HTTP fixture, not OS clipboard. Eight exact GET read/POST write/GET read/POST clear operations, fresh external fixture update, Unicode and void mutation results all finish before native cancellation. One worker terminates. Cargo checkb29a54 exits0/dev9.23s (existing five vendor warnings); rustfmtbba4dd0; compiler83518/88409 exits0/0errors/0warnings; build5dee210. Guest6/cancellation1/standalone16/session7 regressions30 pass. `bun artifacts/audit-plugin-dom-event-clipboard.mjs`7ab5a2 verifies707current files and b167cd291910eb1762c61ebbf6628a78c7db1317d5c904a11dfc3c836ede811f production worker, preserves701historical native and706original-negative snapshots, and explicitly reports routing-only/nativeOsClipboardAccepted:false. Earlier nativebaae766f/source701 is historical after protocol/backend changes, not current acceptance.

No OS clipboard API has run in these checks. Original held-sync provider cancellation remains red with unchanged source/assertions; empty/non-text legacy read behavior and native read/write/clear/current-owner/expiry/retirement/error/void/live semantics remain unaccepted. Next verify saved private Windows window-station clipboard isolation and native-hidden WebView2/owned-process lifecycle before actual OS mutation, or prove complete all-format preservation for shared clipboard first. User clipboard of every format must remain intact. Complete busy/nested frames, async checkpoints/default action, Event identity/property handlers/once/removal/passive, native/platform/private/full migration and subsequent UX/UI/CSS still required. All task handles terminal; feature unfinished/uncommitted.

Current read-only production provider acceptance: `createPluginNativeAppEndpoint` captures owner-checked prepareEvent/eventCall closures. Initial callbacks await preparation outside native dispatch; admitted local native origins acquire20s leases, renew every10s and retire on owner Abort. Worker receives only a private native URL envelope, performs live synchronous XHR and checks the original retained owner before publishing the decoded value to guest. Ordinary Promise helpers remain separate. No metadata/Desktop values cached. Preview contexts never acquire native capabilities; other native/dev origins and platforms remain unaccepted. Clipboard operations deliberately refuse until independently implemented and verified.

The original guest DOM getInfo listener regression now passes6checks using an explicit controlled live event adapter; its original ordinary Promise provider/assertions remain. Original request-render owner scenario passes20checks; unchanged pointer cancellation1check passes. Initial prepareEvent incorrectly attempted native admission in non-native renders (a0bdad/101387); origin admission corrected. Original held-sync clipboard scenario still fails at its unchanged controlled-IPC assertion (54650/7aaf11), so the full regression suite and feature remain incomplete.

Fresh `bun artifacts/build-plugin-dom-event-production-probe.mjs` builder57662 finishes0/Cargo6m48s, executable baae766f875ea35f1c5a9ae68c7b7a012c6c16c538ddedb962e38b517012c98b.701sources/50frontend+exe bytes frozen. `bun artifacts/run-plugin-dom-event-production.mjs` wrapper91576 exits0; tests/ui/plugin-dom-event-provider-native.js uses the actual registry/request renderer/render-independent owner/session/retained guest/native Event rather than the custom prototype adapter. Three checks verify fresh Rust info/Desktop before trusted pointer cancellation, repeat after21s (beyond initial20s lease), and request Abort/detached suppression. Two workers terminate, native-hidden/visible:false/app exit0. Both original buffers/store/653cookies unchanged; no new cookie files; stderr empty. `bun artifacts/audit-plugin-dom-event-production-native.mjs artifacts/playwright/plugin-dom-event-production-restoration-1791757533505` auditb9eee6/656c02 matches all sources/assets/exe/served workers/actual values/owner/renewal/restoration, and27refreshed headless checks use the same native production worker bytes. Compiler87352 exits0/0errors/0warnings. All task handles terminal. Full clipboard/busy+nested frames/async checkpoints/default-action/Event identity/property handlers/once/removal/passive/platform and original migration/deferred UX/UI/CSS scope remains required; full event feature uncommitted.

Production integration update: actual retained callback leases now signal completion of the listener's synchronous prefix immediately after evaluating its real guest function, before executing QuickJS Promise jobs. Existing owned async continuation remains queued. Host session's invokeEvent services owned DOM requests on the original native event stack, with ephemeral event IDs enabling preventDefault/stop/stopImmediate on the actual host Event. Guest currentTarget resets on return, passive and once options are forwarded. Root queue busy/nested handling and complete Event identity/property handlers are pending. Production mailbox uses existing4MiB payload/4s host-wait/5s callback bounds; prototype keeps64KiB/500ms.

The original unchanged `bun tests/ui/plugin-dom-event-cancellation.js` is now GREEN on actual production1c3197a2601a9607d25f0610bf5dc9737eee3358105a8d4d99c0de2b3ae1bd96 worker: original native pointer checkbox remains unchecked and guest status is cancelled. Initial2f9f4845 prefix worker also passed. Compiler8725/final7452 and frontend builds pass0/0/exit0. Standalone candidate16groups passes; current dataset23/tokens28/session7 regressions pass. However original guest DOM getInfo-in-listener and terminal held-sync clipboard Promise-IPC scenarios fail (8086/17242 timeouts), because synchronous event dispatch currently permits only DOM operations. These are required regressions, not accepted negative controls. No full production event/native acceptance.

First exact706source/config/result snapshot preserves prefix success and both failures under artifacts/plugin-dom-event-production-prefix/manifest.json. `bun artifacts/audit-plugin-dom-event-production-prefix.mjs` verifies706historical files, the original red proof,11current files/worker/results and standalone rebuilt worker, and reports partial-regression-failure. Prior700source/a21969a1 native prototype acceptance remains preserved but is historical: changed production sources do not match that executable. No source snapshots overwritten. All task handles terminal. Native app operations need independently admitted capabilities captured from actual plugin/request/VM frames, including fresh clipboard semantics and late-owner suppression; controlled held-provider cancellation must remain verified without prematurely returning original native event or dropping its existing assertions. Then busy/nested session-frame/async checkpoint/full Event/property-handler acceptance, fresh native build and complete regressions/restoration before topic commit. Full migration/private/platform/provider and deferred shared-input UX/UI/CSS remain intact.

Fresh native candidate accepted: builder46340 terminal0/Cargo6m51s; executable a21969a1ffcb8104518df355af517ae2f75d48e77844c33f37f1e87e70745be1.700frozen/current source files and52frontend/executable files match independent audit. Wrapper5492/scenario1791755912074/restoration1791755911561 terminal0;10checks/5terminated workers, native-hidden/visible:false/app exit0. Actual embedded assets are byte-checked before execution. Worker synchronous XHR obtains live Rust info/Desktop matching ordinary existing native providers while original native event is active, then performs owned DOM access/cancellation. Trusted pointer and retained one/two-level callback counts pass. Unknown operation, bad/retired/expired capability and invalid TTL refuse. Both original buffers, store and653cookie files are unchanged; zero new cookie files. Independent `bun artifacts/audit-plugin-dom-event-native.mjs artifacts/playwright/plugin-dom-event-transport-restoration-1791755911561` passes, including actual provider/nested/asset/source/restoration identities. Clipboard not touched. Production Event facade/session/root plugin capability ownership remains pending; original production cancellation is still red. All task handles terminal, feature unfinished/uncommitted.

Current continuation: the saved candidate passes16groups. Pre-shared same-owner nested mailboxes let the waiting worker invoke the same retained QuickJS closure recursively without restarting the VM or relying on queued postMessage. Actual owned button clicks cause native nested listeners on one and two levels; observed closure counts1,2 then4,3,6,5 prove retained state and depth-first return. Every inner native event is canceled and the outer checkbox stays unchecked. Four guards reject foreign publish/claim, overlap and abandoned reuse. Production Event identity, callback capability frames and scheduler are pending.

`bun artifacts/audit-plugin-dom-event-nested.mjs` passes against700current/frozen native source files and589historical candidate snapshots. It independently rebuilds current worker5e3ca026, checks16groups/six nested observations/four guards and preserves the production-red assertion. Old589-source proof and negatives remain unchanged; they are historical rather than current-worker proof. Latest compiler22397 exits0/0errors/0warnings.

Read-only native protocol candidate uses documented Tauri `register_uri_scheme_protocol`, `UriSchemeContext`, and `PathResolver.desktop_dir`. Local-main-window leases expire in100..20000ms, bounded128, and permit only GET info/Desktop with exact token. Native destruction clears leases. Clipboard mutations and production plugin-root ownership remain pending. Cargo check54913 passes; fresh WebView2 acceptance is pending. Saved tests/ui/plugin-dom-event-native.js checks embedded assets, ordinary-native-provider equivalence, trusted cancellation, nested callbacks and invalid/retired/expired tokens. Restoration wrapper checks both original workspace buffers, store and all cookies. Commands: `bun artifacts/prepare-plugin-dom-event-native.mjs`, `bun artifacts/build-plugin-dom-event-transport-probe.mjs`, then `bun artifacts/run-plugin-dom-event-transport.mjs`. Snapshot700 sources; builder46340 live, Bun38416/native42348. Keep source frozen until build/scenario end.

Baseline `25fa97a`; this feature remains unfinished and uncommitted. Dataset acceptance and all original migration/UX/UI/CSS requirements remain intact. Event cancellation, synchronous propagation, property handlers, native default actions, asynchronous callbacks, queue/reentry ownership and native helpers require genuine product acceptance.

Consulted [DOM dispatch and event controls](https://dom.spec.whatwg.org/#concept-event-dispatch), [HTML event handlers](https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-processing-algorithm), [ECMAScript agent blocking restrictions](https://tc39.es/ecma262/2024/#sec-atomics.wait), [worker XMLHttpRequest](https://xhr.spec.whatwg.org/) and [Tauri custom URI protocols](https://docs.rs/tauri/latest/tauri/struct.Builder.html#method.register_uri_scheme_protocol). No subsystem generator or dependency was added; the candidate builds with existing Bun/QuickJS/Playwright tooling. Tauri protocol and direct native helpers are research directions, not accepted implementations.

`bun tests/ui/plugin-dom-event-cancellation.js` reproduces the product failure using the real production worker, session, retained guest listener, actual mounted dialog and a saved pointer click. Checkbox activation remains checked:true; guest reports `Synchronous event cancellation is not bridged yet`. The unchanged assertion requires checked:false and a successful cancellation. Worker68533ae4 terminates. Exact failure/observation are in `artifacts/playwright/plugin-dom-event-cancellation`; this red scenario must become green in the final implementation, rather than accepting the unsupported result.

`src/lib/plugin-dom-event-channel.js` is an unactivated transport candidate. Its host-side mailbox permits the browser's original event stack to service worker DOM requests synchronously before returning to native dispatch. The worker may wait with Atomics; Window never calls Atomics.wait. Identity, payload and elapsed-time controls apply, with terminal abandonment preventing late publication. The experimental500ms bound is not a change to production helper/deadline policies. Existing production worker/session/runtime/guest facade/native providers remain unchanged.

Saved `bun tests/ui/plugin-dom-event-channel.js` verifies13groups using an actual QuickJS VM, production owned DOM graph, real checkbox activation and a trusted Playwright pointer click. Cancellation and stop/stopImmediate effects occur before peer/parent listeners. Passive/uncancelable events retain native activation. Six invalid/foreign/retired mailbox controls, payload limit, silent worker and CPU interruption refuse/terminate within the bound. Six owned workers terminate. This fixture uses a custom event-control adapter; it does not implement the production guest Event facade or retained callback scheduler.

Two explicit controls expose remaining architectural constraints. A host dispatcher returning Promise cannot complete inside the synchronous event pump; existing native app providers await Tauri invoke/path/clipboard APIs. A second callback queued while the worker waits for an outer DOM reply cannot run through that same message queue. Both controls remain in the saved scenario. Async listener completion/checkpoints, guest-owned Event identity/currentTarget lifetime and event-phase/default behavior must be implemented correctly; replaying a click or substituting cached metadata/clipboard does not accept parity.

A dedicated-worker synchronous XMLHttpRequest receives a live JSON reply from the real Bun fixture server while the browser event stack remains active, then continues owned DOM reads/writes and cancels the original checkbox. This demonstrates an independent transport path, without claiming a Tauri protocol or native app helper implementation. The version is a fresh fixture value and wire count is one. Worker XHR capability remains outside guest code. The first routed cross-origin attemptcca65e failed to load; its source/result is preserved in direct-negative. Replacing Playwright interception with real same-origin HTTP succeeds; the precise original failure cause was not independently isolated. The shared preview helper now accepts an optional saved fixture fetch handler, while retaining the single fixed headless launcher.

Initial77a8ec/21527 hung awaiting worker readiness with unsupported route bodies. Exact four candidate sources/owned process tree were preserved before terminating only Bun44360 and its seven browser descendants. The saved fixture now bounds startup at10seconds, serves real worker/WASM bytes with matching COOP/COEP, and injects the production value codec. Intermediate bd07f3 worker-error and0cc5c0 missing-codec failures were corrected. Compiler25205/68510/95915 failed on optional captured VM and JSDoc typing; final64949 exits0/0errors/0warnings. Latest9716c5 probe exits0; four saved regression scenarios pass67checks (guest6, dataset23, tokens28, dialog10). All production worker checks retain68533ae4.

Frozen589current sources/config/lock/results and both negative source sets are in `artifacts/plugin-dom-event-channel-proof/candidate.json`. Initial independent auditor3c73b3 suffered a terminal Bun1.4.2 segmentation fault; rerunning the identical audit65a3b0 passed without source changes. The audit checks unchanged25fa97a production implementations, the red production scenario, all candidate native event effects/controls, real HTTP wire and67regressions. It explicitly reports eventParityComplete:false/nativeProtocolAccepted:false.

Strengthened audit372cc4 also reads the actual current production worker and independently rebuilds the candidate worker, matching its observed `2b0002256ea5e1479e9b5087bc0a4e8b6074187a8d467d09bd7afa6ae8634345` hash. Its first c3fe56 attempt used unavailable BuildArtifact.bytes; the audit-only read now uses text output. Product/fixture/worker sources were unchanged, and all589frozen/current comparisons pass.

Cleanup limitation: automatic review rejected removal of the exact owned temporary profile `C:\Users\dvgamerr\AppData\Local\Temp\playwright_chromiumdev_profile-MvvEFw` with `blocked by policy`. No retry/circumvention. Recorded cleanup confirms no browser process uses that profile; the directory remains. Current build/compiler/scenario handles are terminal. No native event acceptance, topic completion/commit or compaction is claimed.

Next: verify a documented independent native protocol path with fresh native build/restoration, actual live metadata/Desktop/clipboard semantics, CSP/isolation and explicit current-owner admission/refusal; implement nested callback processing on the blocked worker stack with correct capability frames. Then integrate the original guest Event facade, property handlers, once/removal/passive, asynchronous listener prefix/checkpoints and native default actions into the production session queue. Pass the unchanged production cancellation scenario plus broader saved browser/native cases, regression and source/worker/restoration audits before topic commit. HTML/private dependencies/module-load DOM, OS clipboard/platform/provider/all migration and shared-input UX/UI/CSS remain required. `/compact` is unavailable in this interface; a completed feature must receive its recorded handoff.
## Production native nesting on the existing VM — 2026-10-12

Saved `bun tests/ui/plugin-dom-event-nesting.js` runs the same listener program in actual browser DOM and production QuickJS/session/owned graph. An outer callback calls inner.click, which calls deep.click. Native target/bubble callbacks synchronously reenter the existing retained VM; child return restores outer Event state, child microtasks wait until outer JS stack empties. Three modes cover original trusted pointer, continuation after real owned host Promise release, and direct ordinary template invocation. Each compares fourteen raw observations exactly, including trust/target/currentTarget/phase/owned path/default state/checked values/order. Late outer preventDefault after host waiting correctly cannot undo an already-run default; inner defaults still cancel. Seven foreign-owner probes refuse before graph mutation. References: https://html.spec.whatwg.org/multipage/interaction.html#dom-click and https://html.spec.whatwg.org/multipage/webappapis.html#clean-up-after-running-a-callback.

The host pre-shares seven4MiB frames per active DOM operation (root plus six nested entries). Event and ordinary sync callers poll only those trusted buffers; no guest buffer capability is exposed. Exact owner/generation/capability checks precede reentry. Retained handle/caller/ID/depth restore on every return, existing queue stays intact. Nested native listener return values are ignored and ready jobs stay on the outer queue, matching DOM invocation semantics. Scoped checkpoint begin/end hooks use private VM handles, are absent from public facade/module globals, and dispose with VM. Host-wait credit excludes nested guest CPU and already-credited child waits; nested entry does not reset budgets.

Original production nesting failure is preserved with726source/config/AGENTS/test/oracle/actual worker/failure files. Saved `bun tests/ui/plugin-dom-event-nesting-guards.js` verifies child1.1s execution remains charged to original2sVM CPU budget (outer spin terminates within2.5s total), six-nested depth refuses before a deeper guest entry, original VM stays usable after depth refusal, and handles/workers release. These4groups plus12nesting/106retained/16independent standalone groups/compiler0/0/build0 pass. Audit initially corrected a mistaken ordinary-invoke state assumption against actual browser oracle, then regenerated the unpersisted standalone worker and required exact emitted hash; no scenario assertion weakened.

`bun artifacts/audit-plugin-dom-event-nesting.mjs` freezes/verifies771current source/config/results/workers/Wasm files,138passed groups and10owner pre-gate controls, all752previous host-wait files and726negative files unchanged. Currentworker1cb6a3ad; no fresh native Tauri/full Event acceptance. Original held-provider failure still unchanged; multiple unrelated async frames/same-lease async overlap/full synthetic dispatch/subclasses/property handlers/once/removal/passive/late controls remain required alongside full original migration/private/platform/provider/deferred UX/UI/CSS scope. Full feature unfinished/uncommitted.

## Distinct ready listener entry during a host wait — 2026-10-12

`bun tests/ui/plugin-dom-event-host-wait.js` runs the same independent listener installer on browser DOM and actual production guest VM. First listener awaits a controlled real owned app.prompt helper Promise; peer cancels original native pointer and parent bubbles with the same Event; first continuation resumes after host release with currentTarget null/phase0/path empty/canceled checkbox. Original failure (busy refusals/unchecked cancellation missing) is frozen with722source/config/test/oracle/actual worker/failure files before product changes. The initial post-fix semantic-locator timeout is retained separately; assertions stay unchanged.

Host temporarily suspends only a published waiting event operation with identical trusted retained owner, preserves the original queue and restores that operation. Worker validates exact parent callback ID and restores caller/ID frames. Lease scheduler enters only between guest job turns, saves/restores actual retained handles, and runtime requires original generation/capability flags. Existing CPU deadline and256-helper budget stay shared; no reset. This path does not enter a blocked native/VM stack and does not support another callback waiting on a further host Promise.

Foreign owner refuses before any guest graph mutation. Owner close suppresses held late delivery after actual VM termination. `bun tests/ui/plugin-dom-event-host-wait-guards.js` proves original CPU budget despite600ms prior wait, actual248info calls before shared helper quota refusal, terminal worker retirement/unchanged detached status after late delivery, and additional-async refusal before a second host dispatch. Same-lease overlap refuses before entering the VM; otherwise queued-abort previously introduced an unsupported async frame, closed the VM, and broke the next lifecycle case. Eight exact worker/test/fixture/progress/failure/image files preserve that regression; full source snapshot of that intermediate candidate is not claimed. Owner assertions remain unchanged, with added diagnostics proving9lifecycle actions and late-store suppression restored before required held-sync failure.

Saved host-wait4/guards6 plus retained96groups/compiler0/0/build0 pass. `bun artifacts/audit-plugin-dom-event-host-wait.mjs` verifies752current files/actual4c62fa05worker,736previous checkpoint proof files,722initial negative files and8lifecycle regression files unchanged,106passed groups and10owner pre-gate controls. No full owner-suite/current-native/full Event acceptance. Multiple asynchronous frames/same-lease concurrency, blocked-stack native nesting, synthetic outer-stack checkpoints, subclasses/synthetic dispatch/property handlers/once/removal/passive and original held-provider gate remain required alongside all original migration/private/platform/provider/deferred UX/UI/CSS scope. Full feature unfinished/uncommitted.

## Ready async listener native checkpoint — 2026-10-12

The same saved `installEventCheckpoint` runs on actual browser DOM and actual production VM. Original trusted pointer enters an async listener, awaits two ready Promise microtasks, cancels the Event, then enters peer/parent listeners. Browser keeps currentTarget/phase/owned path active through both awaits; peer/parent see cancellation and checkbox rolls back after dispatch. The original guest implementation cleared state before the awaits, so cancellation stayed local and native default ran. This exact negative is frozen with721source/config/actual worker/test/oracle/failure files in artifacts/plugin-dom-event-checkpoint-negative. Initial separate harness wrong-graph read failure is also retained.

Guest wrappers queue their Event state reset; trusted VM/lease scheduler ends that checkpoint only after ready jobs drain, before native return or genuine host waiting. On settled rejection the checkpoint also ends. The surface probe previously treated immediate await as post-dispatch; browser oracle disproves that timing. Its original reset assertions now run in a later callback after actual dispatch, while the new scenario checks the active microtask state directly. References: https://html.spec.whatwg.org/multipage/webappapis.html#clean-up-after-running-a-callback and https://dom.spec.whatwg.org/#concept-event-listener-inner-invoke.

`bun tests/ui/plugin-dom-event-checkpoint.js` passes3groups; identity4/surface15/production68/dedicated lease6/compiler0/0/build0 pass. `bun artifacts/audit-plugin-dom-event-checkpoint.mjs` binds736current source/config/result/worker files,731prior identity proof and721negative files unchanged, actual browser equality/cancellation/post-dispatch reset/retirement and retained regressions. Currentworker3422e71d has no fresh native acceptance. Original held-provider gate still fails unchanged. Held host-provider callbacks, guest/synthetic dispatch with an outer JS stack, busy/nested same-VM frames and full Event subclass/synthetic/property-handler/once/removal/passive/native/migration/deferred UX/UI/CSS requirements remain open; no full feature completion/commit.

## Ready callbacks share native Event identity — 2026-10-12

Host WeakMap IDs identify the actual Event across native listeners and redispatch; VM WeakRef entries preserve the guest object/expandos while retained, with finalization cleanup that checks the exact reference before removing it. The installed engine provides both WeakRef and FinalizationRegistry. Listener packet refreshes target/currentTarget/phase/cancellation/stop state for the same object. Reference: https://tc39.es/ecma262/multipage/managing-memory.html#sec-weak-ref-objects.

The initial actual session test rejects the second target listener and parent listener because synchronous prefix completion leaves the callback active. Its exact compiled worker/test/fixture/negative observations/result/image are frozen separately in artifacts/plugin-dom-event-identity-negative (six files; complete source snapshot not claimed). Ready guest jobs now drain before the unfinished-prefix signal; a fully settled callback clears the worker frame, publishes complete result through the event mailbox, and the host settles only the matching owned frame on the original native stack. Held host waits continue through unfinished-prefix handling and remain an adoption gate. This does not accept all async Event state/default-action semantics.

`bun tests/ui/plugin-dom-event-identity.js` passes four groups: real trusted pointer/two target listeners/parent bubbling/shared object/expando/cancellation/currentTarget/phase, distinct Event identity, same native object redispatch, and no queue refusal/worker termination. Surface15/production regressions68/dedicated lease6/compiler0/0/build0 pass. `bun artifacts/audit-plugin-dom-event-identity.mjs` verifies731current source/config/result/worker files, all723prior module-clock proof files and6negative files unchanged. Currentworker628a0e1b has no fresh native acceptance. Original held-provider unchanged assertion still fails. Full Event feature remains unfinished/uncommitted; busy/nested/held-async/async Event checkpoint/subclasses/synthetic/property handlers/once/removal/passive and full migration/deferred UX/UI/CSS remain required.

## Module initialization constructor clock — 2026-10-12

`Event` construction uses a private trusted VM clock installed before module loading; the temporary global is deleted before package code executes. The session supplies its owning Window time origin and the worker translates its monotonic clock to that origin. Metadata inspection defaults to its own worker origin. No DOM/helper RPC is needed; initialization DOM remains guarded. The former `dom.event-clock` capability is removed. Timestamp semantics: https://dom.spec.whatwg.org/#dom-event-timestamp.

Saved `bun tests/ui/plugin-dom-event-surface.js` now verifies fifteen groups, including actual CommonJS and ES module initialization, browser oracle equality, retained Event/cancellation, bounded Window timestamps, monotonic later construction, hidden clock and refused initialization DOM. Three workers terminate; compiler/build and61saved regressions pass. `bun artifacts/audit-plugin-dom-event-module-clock.mjs` freezes723current files/results/worker and verifies all722prior surface snapshots unchanged. Currentworkerf7381f1b has no current native acceptance; full feature remains unfinished/uncommitted. Shared identity/subclasses/synthetic dispatch/nested+busy frames/async default ordering/property handlers/once/removal/passive and original held-provider cancellation remain required.


</details>

<a id="record-plugin-dom-listener-lifecycle"></a>

<details>
<summary>PLUGIN-DOM-LISTENER-LIFECYCLE</summary>

# Owned listener lifecycle checkpoint — 2026-10-12

This browser checkpoint preserves native synchronous default cancellation, private Event identity/state, ready microtask checkpoints and bounded same-owner nested retained callbacks. It does not complete the full Event feature or migration. Native provider wiring is committed separately in94b8d06.

Removing an executing listener now revokes future entry while preserving its borrowed active handle until return/continuation. Same-stack once re-registration retains its new lease immediately through the existing native frame, before admitting the new listener. Trusted owner/generation/capability guards remain required; no new CPU/helper budget is granted. A removed lease cannot enter again.

Saved `bun tests/ui/plugin-dom-listener-lifecycle.js` compares actual production guest callbacks to independent native browser behavior for self-removal, self-removal across controlled host waiting, once nested entry, once re-registration, peer removal, peer addition and passive cancellation. All7modes/21checks pass; checked state, exact observations and stale-entry refusal match, every worker terminates. Current worker SHA256:06d0dab348d6a68eb54ad8f03042d262e49b96210d5a23380cc953d84766b699.

Current retained acceptance: host-wait4, host-wait guards6, checkpoint3, identity4, Event surface15, six production regressions68, retained lease6, nesting12, nesting guards4, standalone transport16. Together with listener21:159passed groups. Original terminal-owner replay25086/268120 exits1 at its unchanged held-sync controlled clipboard IPC assertion after10owner/store prerequisite controls; full suite acceptance is not claimed. Root compiler0errors/0warnings, production build0 and Cargo check0 are recorded in STATUS.

`bun artifacts/audit-plugin-dom-listener-lifecycle.mjs`60582/5c3802 exits0 and freezes789exact source/config/scenario/results/actual-worker/Wasm files in `artifacts/plugin-dom-listener-lifecycle-proof`. It verifies all771previous nesting proof files unchanged plus two729file listener failure snapshots. Both initial self-removal and same-stack once re-registration failures are preserved; no assertion was weakened.

Still required: additional unrelated asynchronous callback frames and same-lease async overlap, full synthetic dispatch and outer Window-stack semantics, subclasses/property handlers/full listener-option and Event controls, original held-provider cancellation, fresh native acceptance of current frontend, full private/platform/provider and all other migration/UI/CSS parity. Agent Event API work continues in an isolated worktree. No current native acceptance is inferred from this headless proof.

Topic commit is a verified browser checkpoint, not full Event completion. Root has no live process handles at this checkpoint; agents may have separately recorded handles. `/compact` is unavailable through this interface; this file and STATUS provide the explicit handoff.


</details>

<a id="record-plugin-dom-nested-owner"></a>

<details>
<summary>PLUGIN-DOM-NESTED-OWNER</summary>

# Dialog ownership across dependent response sends

A root request using the built-in response tag can send a dependent request whose plugin opens a dialog. Previously, both HTTP requests returned200, but successful disposal of the root field worker aborted the signal owning the dependent dialog. The saved actual-workspace scenario reproduced the disappearing dialog before this fix (83231 exit1); its negative result/diagnostics are preserved in `artifacts/plugin-dom-nested-owner-proof`.

Each field renderer now links its private signal to the caller's signal. On successful completion it uses the existing trusted host completion registry while still aborting ordinary field work. Error, timeout and Cancel use ordinary revocation. A completed child signal retains all parent authority: completion does not revive an aborted parent or grant access to a new caller.

Captured plugin services now optionally provide `isCurrent`. Capture validates/freezes the function and supplies a true guard when omitted by existing controlled adapters. Real workspace services expose their original root/workspace/source guard, and nested owners preserve it. A retained dependent dialog therefore closes while idle if either its own request source or the root's source changes; it need not wait for a helper event to notice invalid authority.

The existing saved scenario was extended, rather than replaced with interactive browser automation. Its provider now checks the actual request ID/source. It uses genuine production plugin/template workers, registry, request rendering, built-in response resolver, dependent browser HTTP and workspace persistence. The root Cancel case holds only the root browser transport through a fixture shim after the real dependent HTTP response completes; it then invokes the actual workspace stop operation. This verifies the host lifecycle, not native IPC or a pointer Cancel click.

## Verification — 2026-10-12

- `bun run check`: final64099 exit0/zero errors/warnings; `bun run build`:32483 exit0/8.34s.
- `bun tests/ui/plugin-dom-render-owner.js`: exit0/fourteen fixed-headless groups/33terminated workers (three plugin/thirty template). Retained real guest helper after dependent field, root field, render-session and root HTTP completion passes. Idle root-source loss, independent dependent-source loss and actual root Cancel after completed dependency all close the owned dialog. Cancel remains aborted and not marked complete. Captured/default service guard and four malformed guard refusals also pass.
- Saved helper renderer98139, Cancel recovery, callback session and async app dialog regressions all exit0.
- `bun artifacts/audit-plugin-dom-nested-owner.mjs --freeze` and subsequent read-only audit pass612exact local source/config/script/frontend-build/generated-Buffer snapshots, five result hashes, the preserved negative result and both actual worker hashes. Full source of the initial negative fixture was not separately frozen; its negative output and diagnostics are retained, with baseline product commitb249c91. Positive current source/build bytes are frozen completely within the listed scope.

Initial compiler41646 caught the optional guard annotation; using the validated captured guard with optional type access fixed it. Initial post-fix UI91300 tried clicking the dialog after idle root-source loss had already closed it; the test now checks idle closure directly. Compiler23563 caught the browser fetch shim conflicting with Bun's global fetch typing; the explicit browser-shim annotation fixes this fixture type only. Final checks pass without product fallbacks.

## Native acceptance — 2026-10-12

Fresh release builder79345 exits0 and produces `artifacts/native-plugin-dom-nested-owner-probe/insomnium-plugin-dom-nested-owner-probe.exe`, SHA256 `d2c20319f7bfa305f43d6a6f7d4406601e39284e826cab43304b71711c8a1641`. This executable includes the field-lifetime/source-guard fix. Native427cf713 remains historical for the changed host code.

The saved native scenario extends the existing suite with a real built-in response tag, saved dependent request, native HTTP and actual workspace persistence. Four new groups verify completed root/child retain genuine guest callbacks, normal detached onHide3, idle root-source loss, independent child-source loss, and real root Cancel after the dependency completes. Cancel invokes the actual button handler programmatically because the owned modal blocks pointer input; it is not pointer acceptance. The root transport is held by the real local server, then deliberately released after Cancel. For750ms, no additional helper wire or dialog appears and the failure state persists. This verifies late-result suppression, not observation of a network Abort event or ordered terminal onHide.

- `bun artifacts/run-plugin-dom-nested-owner.mjs`: positive54957 exit0/scenario1791741720994, 45checks/14terminated plugin workers/79HTTP plus WebSocket/ninegRPC/v1reflection; eight retained native dialog callbacks. Owned native window is hidden before CDP, result `native-hidden`/visible:false/native exit0.
- Restoration1791741720470 passes: both original workspace buffers byte-identical, plugin store and all653original cookie files unchanged, owned new cookie jar removed. Clipboard is untouched.
- Compiler43332 exits0/0errors/0warnings after the final harness adjustment. Saved headless owner result00:55:47 passes14groups/33terminated workers.
- `bun artifacts/audit-plugin-dom-nested-owner-native.mjs artifacts/playwright/plugin-template-tags-1791741720994 artifacts/playwright/plugin-dom-nested-owner-restoration-1791741720470` independently verifies678original/current source/backend/config/lock/UI snapshots,49frontend/generated snapshots, one explicit harness variant, both worker hashes/exe identity and all acceptance/restoration evidence.

Initial native54276 exit1/scenario1791741608253 showed the prior owner-loss scenario intentionally left the root URL at `/edited`; the new scenario expected `/render`. The helper now initializes its own root URL through the actual UI and waits for native persistence. This one-file harness-only variant is frozen separately; original source snapshots and failed output remain preserved, and product/executable source did not change. The failed run also exited native0/hidden and restoration1791741607632 passed. No failed run is counted as acceptance.

Stream terminal lifetimes, ordered guest onHide before Abort/unload, full DOM/private/clipboard/save platform/provider/all migration gates remain open before deferred shared-input UX/UI/CSS. Normal Close is covered; terminal ordered onHide is not claimed. All process handles from this checkpoint are terminal. The interface cannot invoke `/compact`; STATUS records the commit/evidence/open gates and handoff.


</details>

<a id="record-plugin-dom-render-owner"></a>

<details>
<summary>PLUGIN-DOM-RENDER-OWNER</summary>

# Plugin dialog ownership after rendering and Send

The working integration gives a dialog a separate host controller, helper dispatcher and interaction lifetime. It binds once to the exact admitted plugin VM and captured request/environment source. Successful field-render disposal releases short rendering work without releasing an active dialog. Normal Close waits for the genuine detached guest `onHide` before releasing the owner; idle owners are released immediately.

`plugin-request-lifetime.js` records explicit host completion by exact signal identity. Ordinary listeners still receive Abort during cleanup. Retained UI may survive that completion, but an already cancelled signal cannot be promoted, even when its reason says “Request completed”. Derived signals retain their parent authority; completing a child does not let it escape a later parent cancellation. Host owner factories capture their options instead of consulting a mutable caller DTO.

The working workspace integration marks completed HTTP/gRPC work explicitly and permits its retained helper services to use the captured owner after the running entry is removed. It checks the original workspace identity, collection and request/environment source before granting this continuation. Nested service owners keep that guard. Failed/cancelled operations retain ordinary revocation. The application route mounts the real plugin dialog host.

Documentation consulted before implementation: [AbortController.abort](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort) and [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). Abort is terminal for ordinary operations; completion authority here is a host lifecycle policy, not a browser API feature. No generator is required for this JavaScript module.

## Verified current working integration

- `bun run check`: zero errors/warnings; `bun run build`: exit 0.
- `bun tests/ui/plugin-dom-render-owner.js`: eleven headless groups, three genuine production plugin workers and fifteen template workers, all terminated. Actual registry admission, render-session disposal, retained guest click/`util.render`, Close/guest `onHide`, fresh Send, request-source loss, Abort, parent revocation, preview, field failure, unload/reload and disposal pass.
- The same saved scenario invokes actual workspace `execute`, request rendering, browser HTTP transport and persistence: response 200 and no running entry, followed by a new successful guest helper callback. A later actual workspace request edit rejects the old helper authority and retires its VM/dialog.
- Saved callback-session, guest DOM, async app dialog and helper-renderer regressions pass. `bun artifacts/audit-plugin-dom-render-owner.mjs` verifies 610 exact current/local source and frontend-build snapshots, five preserved result hashes and both production worker hashes. Evidence lives in `artifacts/playwright/plugin-dom-render-owner/{source-manifest.json,accepted,sources}`.
- Initial full-workspace scenario failed because its fixture omitted the environment variable read by the guest callback. Adding the real base-environment resource made that scenario pass; no product fallback was added.

## Commit and remaining gates

This topic commits the lifetime/owner foundations, owned DOM close hooks, route host and saved acceptance/documentation. Broader runtime/session/registry/template/provider/workspace/helper/Buffer dependency assembly remains uncommitted in the shared working tree. This topic alone does not activate the complete feature from clean HEAD; acceptance above binds the exact current assembly, not just committed files.

Nested response-tag short-signal lifetimes, WebSocket/SSE terminal lifetimes and ordered guest `onHide` before Abort/unload revocation remain open. Full DOM/live collections/property handlers/event cancellation, generic HTML/private modules, clipboard restoration, provider/platform parity and every other migration requirement still precede the deferred shared-input UX/UI/CSS phase.

## Native HTTP/gRPC completion accepted — 2026-10-12

Fresh release executable `artifacts/native-plugin-dom-owner-probe/insomnium-plugin-dom-owner-probe.exe`, SHA256 `427cf71314428028e13129017aaa76f01fa1eebc8cfea4c41cec792d845bb8de`, uses isolated identifier `app.insomnium.probe.checkout20260929`. Builder68952 exited0; Cargo release compilation took6m51s. Both native runs hid their owned host before CDP and exited0. The saved combined acceptance passes41checks/14terminated production plugin workers/68real HTTP requests plus WebSocket, nine gRPC calls and v1 reflection.

The new reusable native helper verifies two genuine retained event callbacks after each completed HTTP/gRPC Send. They render the captured `scope` environment, reload the real saved request model and send child HTTP through native IPC, with ExtraRenderInfo/raw body/response buffer and guest `this`/event target identity assertions. Six callback child requests pass. A later gRPC unary reads `1:true` from the genuine detached guest onHide state; HTTP reads its fresh VM baseline and then exactly one/two detached hides across repeated Send, without plugin Load.

Retained `util.render` now starts its nested session from the already resolved context without rebuilding environment layers. This preserves the same behavior as ordinary field helpers and prevents same-plugin environment tags from reentering their VM. The saved browser workspace fixture now includes such an environment tag; it passes, along with the helper-renderer regression. Compiler5669/75361 exited0 with zero errors/warnings.

Commands and evidence:

- `bun artifacts/prepare-plugin-dom-owner-probe.mjs`, `bun artifacts/build-plugin-dom-owner-probe.mjs` and `bun artifacts/freeze-plugin-dom-owner-frontend.mjs` preserve677local app/backend/UI/script/config/lock files plus49complete frontend/generated-Buffer snapshots. Vendor/transitive dependencies outside these snapshots are not claimed.
- `bun artifacts/run-plugin-dom-owner.mjs`: successful scenario `artifacts/playwright/plugin-template-tags-1791738747567`, restoration `artifacts/playwright/plugin-dom-owner-restoration-1791738747021`.
- `bun artifacts/audit-plugin-dom-owner-native.mjs artifacts/playwright/plugin-template-tags-1791738747567 artifacts/playwright/plugin-dom-owner-restoration-1791738747021` passes original/current source hashes, frontend/generated bytes, both worker hashes, native-hidden/visible:false/exit0, six retained native callback requests, normal guest onHide and retained protocol/OAuth/cookie/info controls. Both original workspace buffers are byte-identical after exit; original store and all653original cookie files are unchanged; the owned new jar is removed.

The first native run59454 failed a harness counter assertion: OAuth Cancel recovery replaced the plugin VM between gRPC and HTTP, so the earlier hide count was no longer applicable. Product callbacks had worked. Negative scenario1791738572745/restoration1791738572140 are retained and restoration passes. Three exact saved harness variants separately preserve the correction: HTTP reads the current VM baseline; gRPC reads onHide before VM replacement. `harness-variant.json` and both old/new harness byte snapshots distinguish this from a product/executable change. Second run1881 passed; no rebuild or product mutation occurred after the original native source freeze. Independent audit initially used an absent OAuth control field; corrected to the actual recorded cancellation/preservation and settled-preview controls, then passed.

This topic records native acceptance and its saved fixture/regression. Core runtime/session/registry/template/workspace/helper/Buffer/native dependency assembly and the main combined scenario assembly remain uncommitted. Native acceptance binds that exact working assembly; it does not claim complete clean-HEAD activation or full migration. No native clipboard operation was performed. Next is the complete integration/dependency commit, followed by the remaining dialog/provider/platform gates above and all original migration requirements before UX/UI/CSS.


</details>

<a id="record-plugin-dom-session"></a>

<details>
<summary>PLUGIN-DOM-SESSION</summary>

# Retained DOM callback production session candidate

The working callback runtime, production worker and host session now admit
retained guest functions only during an explicitly enabled, guarded helper
operation. Host callbacks receive opaque invoke/release capabilities instead of
trusting guest-supplied owner data. Ordinary and retained invocations share the
same host queue and worker running guard, so only one VM operation executes.

The runtime captures the original helper generation and activation flags.
The client captures the original current guard, helper/sync endpoints and
interaction subscription. It restores them only while that retained callback
runs. An ordinary later callback cannot revive a saved old app facade. Nested
retention captures the original operation owner rather than depending on the
lifetime of its parent function handle. Release/owner loss revoke idle handles;
active owner loss or guest failure closes the worker. Late host replies cannot
reach a replaced or terminated callback.

The lease pump waits for pending helper RPC even when the guest did not await
the returned Promise. Trusted prompt waiting shares the existing deadline pause
and ten-minute total limit; ordinary guest execution remains bounded. Runtime
bootstrap/failure/dispose also release the lease manager and its timer.

## Verification — 2026-10-11

`bun run build` produces the current application and production plugin worker.
`bun tests/ui/plugin-dom-session.js` passes seven fixed-headless groups through
that actual worker plus current bundled host client/QuickJS runtime: original
helper capability/closure state across ordinary callbacks, opt-in refusal,
nested lease after parent release, explicit/root release, unawaited helper
drain, prompt waiting for 5.3 seconds, idle current-loss refusal, active Abort
and late helper suppression, guest exception and CPU timeout. Four real workers
are observed terminated; the fetched worker hash matches the build artifact.

Saved plugin-app-sync, plugin-app-dialogs, plugin-helper-render,
plugin-cancel-recovery and standalone plugin-dom-callback-leases also pass.
Compiler is zero errors/warnings. `bun artifacts/audit-plugin-dom-session.mjs
--freeze` preserves local source/scripts/configuration, complete frontend build
bytes and six acceptance results. Run without the flag to audit current/exact
snapshots and worker hash. This does not prove native executable acceptance or
every external dependency. Exact counts/commit/handles are in STATUS.md.

## Commit and remaining scope

The topic commit contains the lease-pump idle/deadline extension and saved
production integration fixture/scenario/evidence document. Runtime/client/worker
assembly remains uncommitted with the broader helper runtime: those files also
contain earlier helper, sync mailbox and generated Buffer integration whose
dependency/generator/provider gates remain open. Do not claim this topic alone
activates the production feature from a clean checkout.

Actual guest DOM node/mutation/event/target/this transport, c.app.dialog binding,
exactly-once onHide, long-lived dialog ownership beyond render completion,
generic HTML/private APIs and app route/native activation still remain. The
existing native624e14fa proof predates this callback integration. Broader provider,
clipboard-format restoration, native save/platform and original migration
parity remain required before the deferred shared-input UX/UI/CSS phase.

Reference: [QuickJS guest handles and promise jobs](https://github.com/justjake/quickjs-emscripten).


</details>

<a id="record-plugin-dom-stream-owner"></a>

<details>
<summary>PLUGIN-DOM-STREAM-OWNER</summary>

# Dialog ownership after WebSocket and SSE completion

The actual workspace stream callback previously aborted its root controller as soon as a `closed` event arrived. A plugin dialog opened while rendering the connection URL therefore disappeared before the stream command returned. This differs from the retained ownership already supported for successful HTTP and gRPC completion.

The callback now records the closed connection state without aborting the root. After `connectStream` resolves, the workspace checks cancellation, records/persists the response and marks successful completion through the existing host-only lifetime registry. Cancel, command rejection and persistence failure remain ordinary revocation. A close notification alone does not grant completion authority; late command success cannot promote an already-cancelled signal.

Implementation uses the existing documented command/channel contract: [calling Rust](https://v2.tauri.app/develop/calling-rust/) and [JavaScript core API](https://tauri.app/reference/javascript/api/namespacecore/). No subsystem or generator is initialized. Verification commands are `bun run check`, `bun run build`, `bun tests/ui/plugin-dom-render-owner.js`, `bun tests/ui/plugin-cancel-recovery.js` and `bun tests/ui/plugin-dom-session.js`.

## Verification — 2026-10-12

The existing saved owner scenario and fixture now cover both WebSocket and SSE using Tauri's installed `mockIPC` API. Production workspace execution, request rendering, registry, genuine plugin/template workers, dialog and captured environment helper remain real; stream command/channel delivery, cookie snapshot and persistence are controlled adapters. This is frontend ownership evidence, not an actual native connection.

For each protocol, the scenario verifies the dialog remains through a closed notification while the command is unsettled, survives successful command/persistence and running-entry removal, and executes a genuine guest callback using the captured environment. Idle request-source change closes it. Actual workspace Cancel followed by late closed/success remains aborted and not completed, with `cancel_http` observed. Closed followed by command rejection closes the dialog and retains error state. Result `streamControls` records success/Cancel/error signals, state and IPC command inventory.

- The negative run after adding the required empty cookie-snapshot adapter reproduces dialog count0 instead of1 at the closed event. Exact pre-fix workspace/fixture/scenario and negative result/diagnostics are frozen under `artifacts/plugin-dom-stream-owner-proof/negative`; baseline commit38ecf33. Earlier3428/1951 fixture timeouts lacked the cookie-snapshot adapter and are not product-regression evidence.
- Compiler73261 before the product fix and final65889 both exit0/0errors/0warnings. Final build exits0/6.73s.
- Final saved owner scenario exits0:20fixed-headless groups/41terminated real workers (three plugin/thirty-eight template). Saved Cancel recovery and callback-session regressions exit0.
- `bun artifacts/audit-plugin-dom-stream-owner.mjs --freeze` and subsequent read-only audit pass613exact source/config/script/frontend/generated snapshots, three accepted result hashes, preserved negative source/result hashes, both worker hashes and both protocols' recorded controls. Accepted manifests are never overwritten.

## Native acceptance — 2026-10-12

Fresh builder9779 exits0/Cargo6m45s, producing `artifacts/native-plugin-dom-stream-owner-probe/insomnium-plugin-dom-stream-owner-probe.exe`, SHA256 `237f89d3b674bb32e297f80891efaa5ea71433f37c109b8e4b858ee6490a42ab`. It includes the committed8a02bc3 workspace fix. Executabled2c20319/native45checks remains historical for the changed host code.

The saved native suite now uses separate real local WS/SSE peers implemented with documented Bun APIs: [ServerWebSocket close/terminate](https://bun.com/reference/bun/ServerWebSocket), [SSE streaming/cancellation](https://bun.com/guides/http/sse). These peers control the remote endpoint; plugin/runtime, request rendering, native connection, channel, workspace persistence, model/environment helper and saved-ID child sends remain real. No product subsystem or generator was initialized.

For each protocol, a plugin opens its genuine dialog while rendering the URL. The actual server sees the rendered `native-dialog-value`, sends `native-stream-value` and closes normally. Native persisted history contains the received message/event and closed state; the Connect button reappears before two real retained helper callbacks send `from-extra` to the saved HTTP child request. A second completed connection verifies idle URL-source loss through the actual input handler and persisted workspace. Separate active connections verify the actual Disconnect handler and an abrupt remote transport failure (WS terminate, SSE stream error), with dialog cleanup and closed/error history respectively.

Disconnect is invoked programmatically because the owned modal blocks pointer input. Both real peers acknowledge client termination before a server finish attempt: WS close1000/`Disconnected by client`, SSE cancel callback; the attempt records `alreadyEnded:true`. For750ms no dialog/helper wire reappears. This is cleanup/no-late-helper evidence, not a delivered post-disconnect network frame. The earlier controlled-IPC scenario separately covers late successful command settlement after Cancel. Terminal ordered guest onHide and pointer Disconnect are not claimed.

- `bun artifacts/run-plugin-dom-stream-owner.mjs`:46196 exit0/scenario1791743153278,53checks/14terminated plugin workers/83HTTP plus WS/ninegRPC/v1reflection,12retained native dialog callbacks. Eight new groups/real stream connections cover both protocols' completion/source/Disconnect/error. Native-hidden/visible:false/native exit0.
- Restoration1791743152719 passes both original workspace buffers, original plugin store/all653cookie files unchanged and owned new cookie jar removed. Clipboard is untouched.
- Final compiler51114 exits0/0errors/0warnings; fresh saved headless owner exits0/20groups/41terminated real workers against the new frontend build. Frontend/generated49snapshots preserved.
- `bun artifacts/audit-plugin-dom-stream-owner-native.mjs artifacts/playwright/plugin-template-tags-1791743153278 artifacts/playwright/plugin-dom-stream-owner-restoration-1791743152719` verifies679original/current source/backend/config/lock/UI snapshots,49frontend/generated snapshots, one explicit helper variant, both workers/exe identity, all protocol/helper/Cancel/error evidence and original byte restoration.

Compiler75003/25067/55487/93950 failed on Bun's upgrade data generic: `any` still selected the undefined-data overload. A concrete StreamPeer annotation resolves it. Builder had already begun before resolving that harness-only type error; source stayed frozen until it exited. One helper variant preserves original679snapshot bytes and product/executable unchanged, with typed optional peer fields initialized on first use and accurate late-finish-attempt wording. Failed compiler attempts are not acceptance. The deliberately induced SSE error prints `Native fixture stream failure` in server stderr; native error history and overall scenario/restoration exit0 are verified.

Ordered guest onHide before terminal Abort/unload, full DOM/private/clipboard/save platform/provider/all original migration remain open before deferred shared-input UX/UI/CSS. Normal dialog Close is covered; terminal ordered onHide is not claimed. All current handles are terminal. STATUS records commit/evidence and handoff; the interface cannot invoke `/compact`.


</details>

<a id="record-plugin-dom-synthetic"></a>

<details>
<summary>PLUGIN-DOM-SYNTHETIC</summary>

# Owned synthetic dispatch and property handlers

2026-10-12 root integration of the frozen Event agent handoff. Real owned DOM dispatch supplies capture/target/bubble/default behavior. Bounded synthetic tokens preserve the original private guest Event and VM-local cyclic/function CustomEvent.detail. Supported property handlers retain native slot ordering, replacement/clear behavior, this binding and immediate false cancellation. Graph-owned WeakRefs support late cancellation of retained idle native Events without exposing host objects or undoing an already executed default action.

Root checked all fourteen original/new/frozen SHA256 guards before integration. Compiler26780 exits0, zero errors/warnings; production build65093 exits0. Saved headless runner71465 exits0:219accepted groups, including21new synthetic/property/late-control/partial-prefix/CPU/helper/foreign/close groups. Current production worker: `8893751d2adb8de85ea905425a15694be6527817d19644e1f5dfe188383b2811`. All scenarios assert their browser oracle/owner/termination contracts.

Independent auditor50f5c5 exits0, verifies every current/frozen source in artifacts/synthetic-root-proof, the copied219result groups, actual emitted worker/QuickJS Wasm, and all796immutable prior API proof files. It also freezes exact negative observations/logs. The unchanged original owner reaches10prerequisites then fails the same held synchronous clipboard IPC gate. The stronger identical-program Window oracle remains RED: host Hbetween/Hpromise/Hafter see guestG1 in the browser but not in the candidate. These are deliberate unresolved gates, not passing acceptance tests.

Partial Window prefix retention preserves the original generation/capabilities/helper/CPU budget and refuses foreign/closed ownership. It does **not** implement the required cross-realm job FIFO. Native await/job enqueue observation, additional independent async frames/same-lease overlap, broader Event/Window/private/platform/provider behavior, original held-sync acceptance and fresh native-hidden acceptance remain required. The engine prototype is isolated in agent artifacts and has not changed dependencies or the default engine. No full Event, Window, native-current-surface or migration completion is claimed.

Replays: `bun run check`; `bun run build`; the standalone saved commands in PLUGINS.md#record-agent-synthetic-dispatch. Root's initial artifact runner includes22saved positive scripts and two separately recorded required negative scenarios. It refuses accepted-proof overwrite; a future runner invocation requires a fresh INSOMNIUM_SYNTHETIC_PROOF_DIR. The independent auditor verified current files before checkpoint documentation changed; historical source snapshots remain immutable and are not assertions that later working files remain unchanged. The agent handoff records the original fixture correction.

Root handles terminal. Fresh native build waits for the separately verified Button whitespace fix; previous1084/4e6c candidates do not contain this worker. `/compact` unavailable; STATUS records the explicit topic handoff.


</details>

<a id="record-plugin-dom-terminal-owner"></a>

<details>
<summary>PLUGIN-DOM-TERMINAL-OWNER</summary>

# Ordered terminal dialog cleanup

Status2026-10-12: frontend implementation and fresh native terminal acceptance verified. Broader DOM/private/app/platform parity and full migration remain incomplete.

## Fresh native acceptance

New release b06522907daf8968fc6ea616ed2a59c0726f63160c593f692c3f80876b96d9a9 contains490d8da cleanup implementation. Builder70484 exits0; Cargo release takes6m59s. Source681files were frozen before build;49frontend/generated files and fresh headless owner20groups were frozen afterward. Compiler95450/71236/25776 all exits0/0errors/0warnings; terminal15headless21647 passes. Exact source, lock/config, product and frontend worker bytes are bound by independent audit.

`bun artifacts/run-plugin-dom-terminal-owner.mjs` restoration wrapper98618 exits0, native scenario1791746689370. The same saved plugin-template-tags suite reruns HTTP/gRPC/OAuth/WS/SSE and adds12terminal groups: source/unload/active-source/active-unload/root Cancel/active root Cancel/queued event suppression/normal Close awaiting real native helper before unload/valid Close/exception/CPU/unresolved promise. It passes65checks/26terminated plugin workers/100HTTP requests plus ninegRPC/reflection and the real stream controls. The12original bodies are captured at actual worker termination with detached:true/count1; nine healthy callbacks finish cleanup:true before remote held replies are released, and three deliberately faulty callbacks report bounded failure. Fresh native evidence also binds the exact served production worker bytes.

Every native terminal group observes750msno additional wire, no forbidden dialog reopen and no forbidden native store entry. Five real native child requests reach a held local peer; the queued old event produces no second child request. Root/child replies are released after cleanup/retirement. This proves ownership cancellation and no late helper effect; it does not prove a payload was delivered through a cancelled native command. Programmatic real Cancel and Preferences actions under the modal do not prove pointer access to those underlying controls. The normal Close path does perform a real native helper from onHide before unload.

Native result is native-hidden/visible:false/owned exit0. Restoration1791746688745 verifies both original workspace buffers, original plugin store and all653original cookie files unchanged, and removes only the owned new cookie jar. No OS clipboard touched. The deliberate SSE server-error prints Native fixture stream failure to stderr; suite0 and the independently audited native error history are the acceptance evidence, not silence on stderr.

Owner headless run c3d389 originally failed only the fixed3worker assertion, recording5terminated owned workers and only the intentional owned field failure after all20behavior groups. That failure and original scenario are retained. A sole test-only variant replaces the timing-sensitive count with at-least3, all-owned termination and exactly the intentional failure; fresh8961 passes (20groups). No product/executable change is included in that variant. Independent `bun artifacts/audit-plugin-dom-terminal-owner-native.mjs artifacts/playwright/plugin-template-tags-1791746689370 artifacts/playwright/plugin-dom-terminal-owner-restoration-1791746688745` verifies all681original snapshots/one exact test variant/49frontend/executable/workers/protocol and terminal observations/restoration. Audit: artifacts/native-plugin-dom-terminal-owner-probe/native-audit.json.

Saved Playwright behavior follows [ElementHandle documentation](https://playwright.dev/docs/api/class-elementhandle): handles intentionally observe the same original element after detachment and are disposed afterward. Locators operate application controls. Native attachment uses the existing [connectOverCDP API](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp) after hiding the owned window; no new browser automation framework was initialized.

## Verified frontend cleanup phase

The host closes the real dialog first, removes listeners and revokes ordinary owner authority immediately. Its captured onHide callback then uses a host-only frame on the exact retained worker/lease and detached owned graph. The bridge awaits that frame before releasing callbacks/nodes; the session awaits owner disposal before terminating the worker. Guest operation data cannot select cleanup mode. Revoked cleanup may read/write/query existing owned nodes, but cannot create nodes, listeners or dialogs, or use helper/native/store capabilities. A valid normal Close still uses the original capabilities.

Worker retirement rejects pending helper/store promises before draining the active frame. The host wakes validated pending synchronous mailboxes with cancellation, so a worker blocked in Atomics.wait can process retirement before an external native reply arrives. Every awaited privileged result is checked again before delivery. If an already-active onHide loses its original owner, the session enters the same retirement path instead of waiting for a held store reply. Safely settled cancellation rejection can drain before onHide; interrupted/unsettled execution remains subject to hard retirement and an explicit cleanup failure.

Saved `bun tests/ui/plugin-dom-terminal-owner.js` passes15groups/27terminated workers, observing15original detached nodes with onHide count1 at worker retirement. Twelve healthy nodes receive cleanup:true; deliberate exception/CPU/unresolved-promise controls enter cleanup and report bounded failure. Nine lifetime cases cover Abort/source/catalog loss, active helper cancellation with caught and uncaught rejection, suppression of queued old events, queued Close/unload, active onHide/unload, and normal valid Close. Store and synchronous clipboard IPC controls keep native replies unresolved until detached cleanup completes, then deliver poison values and verify suppression. Both IPC adapters are controlled; the clipboard control does not access the OS clipboard.

An intermediate stronger store control failed45170 because the first implementation waited for its held reply. Exact617files are preserved in artifacts/plugin-dom-terminal-owner-proof/store-negative/manifest.json. The final original-owner check fixes that gap; final15groups pass2262. Original negative617files/e406c4c remain untouched. Independent `bun artifacts/audit-plugin-dom-terminal-positive.mjs` verifies both negative snapshots, original core files against Git e406c4c, all623current/positive source/config/script/build/generated/result hashes, both worker identities, permissions/held-reply/fatal controls and retirement snapshots. The positive snapshot includes existing unrelated worktree files; the topic commit includes only cleanup implementation, saved scenarios and current documentation checkpoints.

Final compiler86114 exits0/0errors/0warnings; build296078 exits0. Retained owner20groups/41workers97207, session7groups11496, helper renderer21groups/88workers84736, app dialogs11groups25926 and Cancel recovery6groups21bc16 all exit0. Browser runs use fixed headless:true. The separate save-client scenario also passes after regenerating build, resolving the observed startup error without a startup source change. These checks verify the frontend phase; native237f89d3/53checks predates changed session/worker code and is historical for this gate.

Implementation uses QuickJS's documented distinction between settled guest promise rejection and failed/pending execution: [quickjs-emscripten](https://github.com/justjake/quickjs-emscripten) and [QuickJSRuntime pending jobs](https://github.com/justjake/quickjs-emscripten/blob/main/doc/quickjs-emscripten-core/classes/QuickJSRuntime.md). No new dependency or subsystem was initialized.

The saved `bun tests/ui/plugin-dom-terminal-owner.js` uses the existing genuine registry/render/session/worker fixture and mounted production dialog host. Its guest onHide reads the original body's disconnected state, awaits a guest Promise microtask and writes `cleanup:true` on that same detached node. The test retains a host ElementHandle only to observe this write after the dialog disappears. It does not replace the guest callback or the DOM transport.

The first Abort case fails45783: the dialog detaches, but the write never arrives. Exact617source/config/scripts/frontend/generated/negative-result/diagnostic snapshots are preserved under `artifacts/plugin-dom-terminal-owner-proof/negative`, manifest `negative.json`, baseline e406c4c. Compiler15244 exits0/0errors/0warnings; existing saved owner scenario still passes20groups. Source-loss/unload/active-helper-Abort cases are saved in the same new scenario, but the first failure prevents reaching them. None of those later cases is claimed as tested.

## Original investigation and required behavior

- Host dialog close already removes the actual body before invoking onHide. Legacy `plugins/context/app.tsx` attaches options.onHide to HtmlElementWrapper unmount. Preserve this ordering and actual guest function identity.
- Idle Abort/source loss makes the retained callback's ordinary owner guard false. The bridge calls hidden.invoke, which rejects; bridge disposal then releases the lease and clears nodes. The VM may still be alive. This is distinct from active operation Abort or catalog unload, which can terminate the entire worker immediately.
- Retire ordinary authority immediately: cancel held network/dialog helpers, suppress late replies and make old UI listeners inert. Delaying the helper Abort until onHide finishes would deadlock an active retained callback waiting on a helper ahead of onHide in the shared queue.
- Keep the admitted onHide lease and owned detached DOM graph until the callback settles. A host-only cleanup frame may access that graph after ordinary authority is revoked; it cannot revive network/native/store/reopen capabilities. Normal valid Close should retain its existing permissions. Guest operation data must not select cleanup mode or forge a lease/owner.
- The session must keep the exact worker alive through a serialized cleanup phase even after catalog authority is tombstoned. Ordinary invoke must reject promptly. Cleanup completion or a bounded hard failure then releases callbacks/nodes and terminates the worker. A queued valid Close racing with unload must remain observable; bridge disposal must await already-started onHide as well as a still-open dialog.
- For an active guest awaiting an owned helper, reject its worker-side pending helper promises and drain that original frame before invoking onHide. Preserve only safely settled cancellation frames for teardown; a CPU-interrupted/damaged VM requires bounded hard retirement and explicit cleanup failure evidence. Do not reactivate ordinary guest/store/native helpers to get a green test.
- Session owner timers currently release invalid callback IDs before disposing invalid DOM owners, while worker.onmessage rejects all replies once the catalog guard fails. Both paths must distinguish admitted cleanup transport from privileged dispatch without accepting stale native/helper/store values.

## Remaining broader parity

The supported owned-graph terminal lifecycle is now accepted in frontend and fresh Windows native scenarios. Full/live DOM collections and property handlers, synchronous browser event cancellation/default actions, generic HTML/private React/ReactDOM/module-load DOM, actual OS clipboard format/read/write/clear/restoration, save chooser/lifecycle on other platforms and complete provider/ancestry/concurrency parity remain separate required gates. Frontend controlled store/SAB native replies prove transport revocation, not actual OS clipboard behavior or every native pending IPC operation. Never reuse old237f89d3 for this changed-worker gate.

Full DOM/private/clipboard/save platform/provider/all original migration and deferred shared-input UX/UI/CSS remain required. All current verification handles are terminal. The interface cannot invoke `/compact`; this native checkpoint is the handoff before the next feature, not a claim of full migration completion or compaction.


</details>

<a id="record-plugin-dom-tokens"></a>

<details>
<summary>PLUGIN-DOM-TOKENS</summary>

# Owned DOM classList and token semantics

Status2026-10-12: supported owned classList/token slice verified in frontend and fresh native execution; topic commit pending. Full DOM/migration parity remains open.

## Final native acceptance

Builder49091 exits0/c9b69a; production executable34fbb1e62c97ff1a48415f8fcf582d18c96a7d3ddd1696d5167b4b5c2469e08d binds687source/49frontend/generated files and worker984f896dec5983688ea21f02113ce7713412bbc6c5e3baaf613fc76cbb4d6f08. Final wrapper42658 exits0/scenario1791751352804/restoration1791751352276 accepts71checks/27terminated workers/104HTTP plus gRPC/reflection/WS/SSE. Native-hidden/visible:false/app exit0. Three added token groups compare all23browser oracle groups on actual native Send, read/modify the original live facade after independent host class mutation following Send completion, and read/update that same classList during detached async onHide. Original collection and12terminal cleanup cases retained (12original detached nodes/count1, nine healthy cleanup writes, three bounded intentional failures).

First wrapper19652 exits1/scenario1791751185366 after exact Send JSON-string equality passed: parsed guest JSON omits undefined error-code fields but raw browser oracle retained them. Native result and both restored workspace buffers/store/cookies preserved. Sole test-only variant normalizes that raw oracle with the same JSON roundtrip before structured equality; source factory/plugin body/VM/product/worker/executable unchanged. Exact one-file replacement and hash preserved in harness-variant.json/harness-variant/tests/ui/helpers/plugin-dom-tokens-native.js. No product change or native rebuild; the saved whole scenario reruns successfully. Native JSON representation is accepted; the richer frontend value-codec comparison separately proves undefined field preservation.

`bun artifacts/audit-plugin-dom-tokens-native.mjs artifacts/playwright/plugin-template-tags-1791751352804 artifacts/playwright/plugin-dom-tokens-restoration-1791751352276` e9f623 exits0 and verifies687original source/frozen files, the one exact JSON-only harness variant,49frontend/generated files, actual executable and served workers, token/collection/protocol/terminal evidence and original workspace/store/all653cookie file restoration. Only the owned new cookie file removed. Frontend audit24ed8b verifies originalc4645cf product baseline/all four snapshots/28checks/80regressions/retained/guard/quota controls. Expected SSE failure-control stderr remains intentional and error-history checks pass; not a silently ignored suite failure. Native token execution is CommonJS; ES token behavior is separately genuine frontend VM acceptance, not a native ES claim. All original broader migration and UX/UI/CSS gates remain required; `/compact` unavailable and handoff is recorded in STATUS.

The legacy dialog mounts an actual HTMLElement, so its classList is a live DOMTokenList. Baselinec4645cf guest graph exposes className but no classList. `bun tests/ui/plugin-dom-tokens.js` f8292a fails with guest `{missing:'Element.classList'}` against the actual browser oracle. Exact623source/config/build/generated/result/comparison files frozen in artifacts/plugin-dom-tokens-proof/negative.json. No synthetic guest node model or browser-use tooling.

Standards consulted before implementation: [DOMTokenList](https://dom.spec.whatwg.org/#interface-domtokenlist), [mutation algorithms](https://dom.spec.whatwg.org/#dom-domtokenlist-add), and [DOMException WebIDL binding](https://webidl.spec.whatwg.org/#idl-DOMException). Guest validation converts arguments before mutation, distinguishes ASCII whitespace from other Unicode, handles omitted/undefined force, and preserves SyntaxError/InvalidCharacterError DOMException identity/legacy codes. A private branded Error object preserves Error inheritance while the public DOMException constructor retains Function.prototype inheritance. All25legacy constants are readonly on constructor/prototype. Serializable error transport/full generic DOMException bindings are not accepted by this slice.

`Element.classList` caches one facade per owned node, maps numeric reads to actual host token values, and forwards assignment to the actual class attribute. Iteration, keys/entries/forEach, item, contains/add/remove/toggle/replace/supports, raw value/stringifier, duplicates/order/Unicode, readonly indexed reflection and constructor/receiver behavior are compared against browser DOM. Stringifier rejects foreign receivers and reads the actual attribute even if an expando shadows value. Constructor names/lengths are stabilized explicitly because production minification changes internal class identifiers. General NodeList/HTMLCollection reflection uses the same private owned-collection brand with unchanged ordinary object delegation.

Host dom.tokens validates the exact owned Element/action/args, refuses malformed/foreign/text/unknown IDs and prototype actions, performs mutations on the actual classList, and charges cumulative writes before mutation. Existing256call/2048node/8MiBwrite/deadline bounds remain. Exact detached onHide cleanup may read/mutate existing class attributes but cannot create new UI/callbacks.

First14groups passed59a764; expanded optional-force/DOMException prototype controls exposed two differencese94da1, frozen623define-negative files. Expanded constructor/stringifier controls368b58 exposed production-minified name/length and spoof/shadow stringifier differences, frozen623descriptor-negative files. No assertions removed. Initial compiler80367 rejected unchecked dynamic DOMTokenList action; validated dispatch cast fixed. Later53182 rejected ambiguous SVG/HTMLElement className write in saved scenario; setAttribute preserves the identical actual host mutation and fixes typing. Both failures retained in tool evidence.

Final headless eeea8f passes23browser groups/28checks with actual production QuickJS worker, CommonJS+ES modules, independent retained host mutation+guest write, detached async cleanup, eight malformed/foreign graph refusals, exact8MiBtoken-write exhaustion/no partial mutation, and all workers terminated. Current collection32fef8dd, terminal15, owner20, guest6 and session7 regressions pass80checks; compiler52919/25185 exits0/0errors/0warnings, build371ebe exits0. Positive token evidence frozen separately. Native source687files frozen in artifacts/native-plugin-dom-tokens-probe; builder49091 is live and must be polled, never restarted merely on observation timeout. After successful exit freeze frontend, run the saved restoration wrapper and audit actual token/protocol/terminal/collection/native identity/restoration evidence. Prior1bafb30e native collections acceptance predates token/runtime/constructor changes and is historical for this feature.

Remaining: fresh native token acceptance/audit/topic commit, then broader DOM properties/event handlers/synchronous cancellation/default actions/HTML/private React/ReactDOM/module-load DOM, actual OS clipboard/save platforms/lifecycle/provider/all migration and shared-input UX/UI/CSS. Interface cannot invoke `/compact`; record exact commit/evidence/gates/process handles in STATUS before the next feature.

Independent `bun artifacts/audit-plugin-dom-tokens-frontend.mjs` f17665 exits0:687current/frozen candidate sources, original product baselinec4645cf, all four frozen snapshots (three623negative/629positive), CommonJS+ES oracle equality,28checks/80regressions/retained cleanup/8guards/quota/all termination and actual worker984f896dec5983688ea21f02113ce7713412bbc6c5e3baaf613fc76cbb4d6f08 bound. Report explicitly nativeAccepted:false/migrationComplete:false. Builder49091 still live in last exact pollb52ab0; no final native result claimed.


</details>

<a id="record-plugin-entries"></a>

<details>
<summary>PLUGIN-ENTRIES</summary>

# Plugin entry resolution

2026-10-10 covered Windows entry workflows verified. Continues the original plugin admission gate after persistent folders2209d8b/checkpointc021119. Source discovery found no applicable Claude files; worktree was clean at feature start.

Production1913 terminal0, started1791629852998/finished1791630302386, SHA f30d346f190ab0f1b651fd82fdb01af5688e62324820037e490bc666a0d41b1e; current713source/build/baseline binding passes. Saved entries1791630309344/native50924 accepts21literal path/status cases,47unchanged fixture files and external bytes, absent marker, unchanged full workspace values and mounted21card read-only UI. Independent entry/source/build/file audit passes. Retained discovery1791630322146/native12240 accepts13packages/2manifest errors/28files/six profiles and independent audit. Source1791630339308/native59712 plus actual restart1791630343709/native66236 accept seven checkpoints/home expansion/max14packages/30files/six profiles/full-value persistence and original restoration; linked audit adapted to current713source passes. All four native hosts exit0/native-hidden/visible:false. Entry screenshot, source dark/light760 and restarted screenshot inspected; no UI/CSS changes in this feature. Exact expected process-name/ID/WebView-profile cleanup finds no live handles. Compiler19917 passes0/0; targeted Rust formatting/diff pass.

Freeze: artifacts/playwright/plugin-entries-source-freeze.json; baseline executable retained in artifacts/native-plugin-entries-baseline. Verifiers: plugin-entries-bind.mjs, plugin-entries-audit.mjs, plugin-entries-discovery-audit.mjs, plugin-entries-sources-audit.mjs; cleanup plugin-entries-cleanup.json. Commands use Bun and saved build-recovery-copy-probe.js with LLVM20.1.8 LIBCLANG_PATH/no low-memory override, then existing plugin-discovery.js selecting entries/ordinary/sources mode separately. Native chooser replies are controlled, not OS chooser acceptance.

The archived loader calls global.require(modulePath), so entry lookup follows directory CommonJS resolution. Consulted primary [CommonJS resolution](https://nodejs.org/api/modules.html#all-together) and [Rust path components](https://doc.rust-lang.org/std/path/enum.Component.html) before implementing. No Node runtime or new dependencies are introduced. Native read-only lookup normalizes internal parent segments, appends .js/.json/.node to unresolved file names (including names with other suffixes), preserves exact-file priority, checks directory index and package-root fallback. Absent/null/empty main use index lookup. Canonical entries must remain inside the package; absolute/escaping paths and external junctions refuse explicitly even if a fallback exists. JSON/native/bare entries remain explicitly unsupported for plugin registration.

The previous handoff named nested-directory main resolution. Primary algorithm inspection clarifies that root main pointing to a directory uses LOAD_INDEX at that directory, not another nested package.json main. The implementation preserves that original behavior; saved fixtures assert that nested main and nested escaping main are ignored when the directory index exists. Full dependency module resolution, closest-scope type policy, module execution/install/store/hooks/actions and all eight contributions/six contexts remain required.

Saved mode in the existing plugin-discovery.js: set INSOMNIUM_PLUGIN_ENTRIES=1 with the isolated recovery-copy production probe. Shared plugin-entries.js prepares21 fixtures for internal parents/directory indices/extension and exact-file priorities/root fallback/empty-null-absent main/outside paths/self directory/cjs/mjs/missing/external junction. It checks native literal paths/statuses, mounted read-only Preferences results, full workspace values, fixture/external bytes and absence of execution marker. Remove the variable for ordinary discovery; source mode continues to cover persistence/restart separately. Native OS chooser responses are controlled. Source/build/payload audit and images/cleanup/commit remain pending. Compiler19917 passes0errors0warnings; targeted Rust formatting/diff pass.


</details>

<a id="record-plugin-folders"></a>

<details>
<summary>PLUGIN-FOLDERS</summary>

# Persistent plugin folders

2026-10-10 covered Windows persistence/import/UI workflows verified. This continues [PLUGINS.md#record-plugin-discovery](PLUGINS.md#record-plugin-discovery) toward the original plugin compatibility scope.

Final production22512 terminal0, started1791628955011/finished1791629448791, SHA5b495c839480bb4fb188cae0e2fcca62fc665d4a0c4b60a9fe8ebe4536fe9f00. Current712source/executable/original baseline binding passes. First bind invocation hit a Bun1.4.2 segmentation fault; rerun of the unchanged verifier passed. Final sources1791629460236/native68272 and restart1791629465907/native69188 pass; independent linked audit verifies distinct exited processes, seven persistence checkpoints, max14packages,30unchanged fixture files, home expansion and exact retained workspace values after actual restart. The second saved callback restores and compares original workspace values. Retained discovery1791629484151/native56164 passes13packages/2manifest errors/28files/six profiles and its independent audit. All three hosts are native-hidden/visible:false/exit0. All six final source theme-width images plus restart image inspected; one saved list, readable wrapped paths, positive dimensions and no horizontal overflow. Exact process-name/ID/profile cleanup finds no live owned handles (old compiler PID reuse excluded).

Commands: set INSOMNIUM_UI_BUILD_STATE=artifacts/native-recovery-copy-probe/build-state.json; set INSOMNIUM_PLUGIN_SOURCES=1 then `bun tests/ui/plugin-discovery.js`; remove the sources variable and rerun the same saved scenario. Ignored verifiers: plugin-folders-bind.mjs, plugin-folders-audit.mjs with first/restart output paths, plugin-folders-discovery-audit.mjs with regression output. Freeze: artifacts/playwright/plugin-folders-source-freeze.json; cleanup: plugin-folders-final-cleanup.json. Compiler65366 passes0/0. Production build uses saved build-recovery-copy-probe.js with workspace LLVM20.1.8 LIBCLANG_PATH and no low-memory override.

Plugins Preferences now offers Save inspected folder, a saved folder list with Remove folder, and a combined default/saved/legacy search view. Inspect folder remains transient until saved. Removing a folder removes only its configuration entry; it does not delete packages. Changes are validated by the native source scanner before modifying settings and use the existing persistence queue/transition guard. Failed persistence retains the unsaved values and offers Retry saving folders; closing the component or changing settings ownership during validation prevents a late mutation.

New settings are pluginDirectories (an array of separate paths) and pluginPathMigrationVersion (1 after explicit legacy import). No default fields are injected into existing data merely by reading folders. Legacy pluginPath is read without modification and included until Import legacy folders is invoked. Import saves resolved folders in the new array and sets the migration marker while retaining the original pluginPath/pluginConfig/resources/history values. This does not migrate plugin execution or PluginData storage.

First production e80923d0 and native sources1791627589235/native68204 plus retained discovery1791627631870/native32156 passed, with independent712source/30fixture-file audits and exact owned cleanup. Image inspection found a redundant saved-source list burying detected packages. After terminal jobs, the UI now shows one saved list, legacy-only import roots and a detected-package count with compact feedback spacing. Windows path keys normalize separators and extended prefixes so home-expanded missing default paths de-duplicate correctly. Saved coverage now checks home expansion and a second native process reading the retained settings, then restores the original workspace with a saved fallback scenario on failure.

Compiler65366 terminal0/0errors0warnings. Targeted Rust formatting and diff checks pass; whole-crate cargo fmt check reports existing unrelated formatting differences, so no unrelated files are rewritten. Corrected712source freeze retains first build under artifacts/native-plugin-folders-first-build and original75d118b3 baseline. New production build22512 is running; app/scenario frozen. Native acceptance, linked actual-restart audit, all six final images, cleanup and topic commit remain pending.

The native discover_plugin_sources command resolves canonical folders, expands ~/ and ~\\ against Tauri's home directory, combines default/legacy/saved roots, de-duplicates overlapping package directories and reports duplicate package names across distinct physical packages. A missing custom folder remains saved and produces a visible issue while other roots are inspected. Legacy ':' lists preserve Windows drive colons; modern saved arrays avoid delimiter ambiguity. The raw legacy input is never rewritten. Limits are32 source folders including default,32 saved/legacy input items,16 KiB legacy list,8192-byte individual path and128 retained packages across sources; the existing512-entry/256 KiB/128-package per-root scanner bounds remain. Truncation/errors are explicit. Missing/inaccessible-folder variants, unusual colon-bearing/quoted paths, directory aliases/platform cases and full admission remain required verification.

Consulted before implementation:

- [Rust split_paths](https://doc.rust-lang.org/std/env/fn.split_paths.html): OS PATH delimiters differ, so it cannot directly decode the archived colon-only setting while preserving Windows drives.
- [Tauri path API](https://v2.tauri.app/reference/javascript/api/namespacepath/) and local tauri2.12.2 path/desktop.rs home_dir signature: home-directory expansion without shell variables/commands.
- [Svelte lifecycle](https://svelte.dev/docs/svelte/lifecycle-hooks): component-owned native result acceptance and teardown.

Saved mode reuses `tests/ui/plugin-discovery.js` with INSOMNIUM_PLUGIN_SOURCES=1 and shared plugin-sources/plugin-packages/dialog fixtures. Planned controls: two legacy Windows-drive roots are readable without writes, explicit import preserves configuration, fresh reload retains roots, chooser cancel/inspection remain transient, overlapping roots avoid duplicate package rows, distinct folders with the same package name remain explicit duplicates, reload/removal recover, source-limit/missing-folder refusal, six settled theme-width profiles and unchanged fixture bytes. The source mode restores the owned probe workspace; remove the mode variable to rerun original discovery regression. Native OS picker responses are controlled, not OS surface acceptance.

Earlier compiler9426/81718 failed2 setting-shape annotation errors; fixed local dynamic-setting JSDoc without injecting defaults into imported data. Compiler12824/34247/92310 and final65366 passed0errors0warnings. Final production/native/source binding/audits/images/cleanup evidence is recorded above. Custom runtime/install/dependencies/store/hooks/actions/eight contributions/six contexts and every original migration/UX/CSS gate remain required.


</details>

<a id="record-plugin-formats"></a>

<details>
<summary>PLUGIN-FORMATS</summary>

# Plugin entry module formats

2026-10-10 covered Windows declared-format workflows verified. Continues entry resolutionad072e7/checkpointf09371b. Previous goal turn made progress with verified/committed entry lookup and retained native regressions. Scoped Claude discovery found none; worktree clean at feature start. Current STATUS/PLAN/PARITY and native scanner/saved scenario inspected.

Production75695 terminal0, started1791630624901/finished1791631014688, SHA551bbbcee1506a2d556dc94e2354f2548b258d5312b81165b3fc198501aa9b7d. Current713source/build/originalf30d baseline binding passes. Formats1791631021497/native56080 accepts31literal path/status cases including eight declared-format assertions and two invalid-scope variants,76unchanged fixture files/external bytes/absent marker/full workspace preservation/mounted read-only results; independent audit passes. Retained discovery1791631036088/native34272 accepts13packages/2manifest errors/28files/six profiles with independent audit. Sources1791631050683/native54348+actual restart1791631054632/native64648 accept seven checkpoints/home expansion/max14packages/30files/six profiles/exact full workspace values and original restoration with linked audit. All four hosts exit0/native-hidden/visible:false. Formats image, source760dark-light and restart image inspected. Exact name/ID/WebView-profile cleanup empty; no live feature handles. No application UI/CSS changes in this feature. Compiler55797 0/0/targeted Rust/diff pass.

Freeze plugin-formats-source-freeze.json; baseline artifacts/native-plugin-formats-baseline; audit scripts plugin-formats-bind/audit/discovery-audit/sources-audit.mjs; cleanup artifacts/playwright/plugin-formats-cleanup.json. Coverage is declared format reporting, not executing a module or accepting arbitrary filesystem/runtime/provider/platform cases.

The scanner formerly used top-level package type for every .js entry, which misreports nested scopes. Consulted primary [package type rules](https://nodejs.org/api/packages.html#type) before implementation. Declared format now follows the nearest bounded readable package.json between canonical entry and package root, with node_modules stopping outer inheritance. A closer manifest without type resets to CommonJS. Explicit .cjs/.mjs suffixes override declared type. No source syntax detection or execution is performed; this is declared metadata compatibility for the original runtime, not proof that a module can activate. Nested malformed/oversized/unreadable manifests report invalid package with the resolved entry retained. Existing256KiB manifest and canonical scope containment apply; scope ascent is capped128directories with an explicit error.

Saved plugin-discovery.js adds INSOMNIUM_PLUGIN_FORMATS=1 using the existing entry helper. Original21entry cases remain, extended by10cases: nested module/CommonJS/untyped/inherited type, explicit cjs/mjs, malformed/oversized scope, dependency boundary and nearest nested scope. Asserts literal reported format for eight valid additions and invalid status for two manifest errors, plus all existing path/status/file/workspace/mounted checks. Compiler11991 first failed6fixture shape annotations; explicit fixture JSDoc fixes them without application TypeScript. Fresh native production/source binding/formats+ordinary discovery/source restart/audits/images/cleanup/topic commit remain pending.

Remaining scope: dependency/package admission and install, syntax/runtime lifecycle/custom registration/PluginData/store/ordered hooks/actions/eight contributions/six contexts, manifest/path/fault/platform variants and all original migration/UX/CSS/provider/platform/accessibility/CI/shared adoption/ownership gates. No scope is removed.

Final compiler55797 passes0errors0warnings, targeted Rust/diff pass. Production75695 started1791630624901/current713source freeze, originalf30d346f baseline preserved. App/scenario frozen while build/native runs. Verification commands: saved build-recovery-copy-probe.js with workspace LLVM20.1.8 LIBCLANG_PATH and no low-memory override; set INSOMNIUM_UI_BUILD_STATE=artifacts/native-recovery-copy-probe/build-state.json and INSOMNIUM_PLUGIN_FORMATS=1, run `bun tests/ui/plugin-discovery.js`; remove formats mode for ordinary discovery, use sources mode for persistence/restart. Ignored bind/formats/discovery/sources audits use plugin-formats-source-freeze.json and output paths.


</details>

<a id="record-plugin-grpc-helpers"></a>

<details>
<summary>PLUGIN-GRPC-HELPERS</summary>

# Native gRPC plugin helper acceptance

## Reflection fixture contract

Accepted native55259/1791685937788/restoration1791685937267 terminal0:
34checks/14terminated workers/52HTTP, retained WS/OAuth/Cancel/streaming and seven
ordinary gRPC calls/eight inputs plus one reflection RPC/two actual queries.
Thirty gRPC childHTTP requests carry12URL/8body/5metadata-key/5metadata-value.
v1 list-services and file-containing-symbol(helper.Sample) reach the server with
owned-helper=plugin-render-accepted; the actual descriptor loads Echo, unary
response appears in native UI/status0, and unchanged resolved context uses the
loaded schema with no second reflection RPC. Reflection stream closesRST8 after
discovery; any associated completed-session ECONNRESET is separately recorded.
Independent64current/exact/live/wire/query/metadata/descriptor-backed unary/
history/cookie/OAuth/native hidden exit0/visiblefalse/state restoration audit
passes. All653original cookie files, plugin store and both workspace buffers
restored. Compiler25008 terminal0/zero errors/warnings. Original62production
bounded-manifest limits apply; same20ab757e executable reused unchanged.

First31534/1791685799445 fails the generic error assertion on completed reflection
session retirement after successful discovery/unary; first64snapshots preserved
and exact restoration passes. Second28361/1791685871582 native passes but
compiler17759 finds optional stream.session type; second64snapshots preserved.
Explicit owned-session assertion fixes the compiler; the final rerun binds the
committed fixture to exact native evidence. No product source changes or plugin
Load workaround. v1alpha fallback/dependencies/refusal/cancellation policy and
other provider/ownership/parity still remain; accepted v1 positive scope only.

`tests/ui/helpers/grpc-reflection-wire.js` answers the canonical v1 service-list
and file-containing-symbol queries on the owned HTTP/2 server. It returns an
actual FileDescriptorProto for helper.Sample/Echo and echoes original_request
for native response matching. The saved native case changes Proto source to
Server reflection, loads methods through real helper URL/metadata rendering,
then sends unary through the reflected descriptor and checks UI protobuf output
and absence of redundant discovery.

The fixture records completed reflection transport retirement separately from
errors: only ECONNRESET on its exact session after both validated queries qualifies;
other session errors still fail. Stream closure/RST code and the retirement event
are retained as evidence. This does not waive early reset, malformed descriptor,
unrelated session failure or any failed native/UI assertion.

Official protocol sources consulted before implementation:
[canonical gRPC reflection v1](https://github.com/grpc/grpc-proto/blob/master/grpc/reflection/v1/reflection.proto)
and [protobuf descriptor](https://github.com/protocolbuffers/protobuf/blob/main/src/google/protobuf/descriptor.proto).

## Metadata and streaming accepted — 2026-10-11

Native28073/1791685588503/restoration1791685587968 terminal0 passes32 checks,
14 terminated workers,45 actual HTTP requests and retained WS/OAuth/Cancel cases.
Six actual gRPC calls carry seven protobuf input messages (cancelled Collect
carries zero). New Watch receives one helper-derived input and emits two actual
responses displayed by the native UI. Chat independently renders two helper
inputs and displays each actual response before Commit, then finishes status0.
Both transport headers carry `owned-helper: plugin-render-accepted`, with the
metadata name and value each resolved by a separate genuine saved-ID HTTP helper.
Twenty-three gRPC childHTTP requests: ten URL, seven body, three metadata-name,
three metadata-value renders (including local schema reload). These counts and
the actual per-transport metadata/path/message/end state pass the independent
63-source audit, along with retained cancellation/OAuth/history/model/cookie/
worker/native hidden exit0/visiblefalse and exact original two-buffer/store/all653
cookie preservation. Same20ab757e product reused, bounded-manifest limits apply.
Compiler32391 terminal0/zero errors/warnings. First native2960/1791685527612
failed only at the new metadata field's accessible label (`Metadata 1`, not
`Name 1`); first63 snapshots preserved and owned state restored. Corrected saved
selector rerun passes. No product source changes or headed browser launch.

This test topic still excludes main scenario/helper production integration,
which remains uncommitted with the wider helper feature. Reflection and broader
provider/concurrency/platform parity remain open; this does not complete migration.

## Owner cancellation and automatic recovery accepted — 2026-10-11

Saved native29237 /1791685319112/restoration1791685318560 terminal0 passes
29 checks /14 terminated workers /33 actual HTTP requests, retained WS/OAuth
cases, and four gRPC calls/four messages. Client-stream prompt Cancel detaches
the real dialog, closes the zero-message Collect transport with RST8 and observes
750ms without any new child HTTP or gRPC message. Connection rendering through
Load methods is cancelled during its real prompt, with 750ms without a new child
HTTP request or native connection. A fresh unary resolves the real helper and
finishes status0 after both owner cancellations, without plugin Load or Reload.
Changing the URL requires normal schema loading before Send; this is distinct
from reloading a plugin.

Both Cancel operations dispatch the actual gRPC Cancel handler programmatically
while showModal blocks pointer input. This does not claim pointer interaction
through a modal. Eleven gRPC child requests carry seven connection and four body
values; all use actual saved-ID HTTP/models/history/body/ExtraRenderInfo services.
The independent63source/current/snapshot/wire/transport/worker/OAuth/history/
cookie/store/two-buffer audit passes, all653 original cookie files restored.
Same20ab757e executable reused with identical previously frozen application
sources; bounded manifest limits below still apply. Compiler73938 terminal0,
zero errors and warnings. No live build/native/compiler handles from this run.

First cancellation run76334/1791685136445 passed zero-message client transport
reset but attempted disabled Send after URL invalidated schema. Second91290/
1791685208034 reached both cancellations but recovery retained the old body when
editing the CodeMirror textarea. Saved fixture now uses the same CodeMirror
setValue and native persisted-body polling as the root scenario. First/second63
snapshots preserve both failed harness versions; all three native runs restore
original workspace/store/cookies. No product source changed for this topic.

The reusable `tests/ui/helpers/plugin-grpc-native.js` fixture owns a Bun HTTP/2
server and genuine plugin tags. Both tags read the actual workspace and saved
HTTP request, modify only the detached guest URL, send by saved ID with
ExtraRenderInfo, check native response history, and read the real response body.
`grpcurl` resolves the connection address; `grpcbody` resolves protobuf input.
There are no mocked plugin services or guest-purpose bypasses.

The working `tests/ui/plugin-template-tags.js` integrates this fixture behind
`INSOMNIUM_PLUGIN_HELPER_GRPC=1` and `INSOMNIUM_PLUGIN_HELPERS=1`. This fixture topic
is committed separately; that main scenario's wider helper/OAuth/protocol
integration and the production helper feature remain uncommitted.

## Accepted scope on 2026-10-11

- Compiler `82578` and final `30130` exit zero: no errors or warnings.
- Native `87609` exits zero; saved scenario output
  `artifacts/playwright/plugin-template-tags-1791684892949`, restoration
  `artifacts/playwright/plugin-workspace-helper-restoration-1791684892420`.
- Combined acceptance passes 26 checks / 12 terminated plugin workers / 29 actual
  HTTP requests, one WebSocket connection / two payloads, plus two actual gRPC
  calls / three protobuf messages. Retained seven OAuth cases and populated-cookie,
  root HTTP, ownership and automatic catalog recovery cases also pass.
- Local proto import and Load methods resolve the connection through actual
  helpers. Unary `/helper.Sample/Echo` receives `plugin-render-accepted` and status
  zero. Connected `/helper.Sample/Collect` independently renders and sends two
  messages, Commit closes the sender, and the joined response finishes with status
  zero. Seven child HTTP requests carry four `grpcurl` and three `grpcbody` bodies.
- Independent `artifacts/audit-plugin-grpc-helper.mjs` checks the actual recorded
  protobuf paths/messages/end states, child HTTP methods/bodies, native hidden
  host exit0/visiblefalse, workers, histories, cookie projection/disk, OAuth form,
  token context, active token preservation and no-wire cancellation. Both original
  workspace buffers, plugin store and all 653 original cookie files are restored;
  only the owned new cookie file is removed after native exit.
- Executable SHA256
  `20ab757ea334962177322637e29efa134d311e5d6f9d67e82b10220b44ee81c6` is reused from
  the successful OAuth production build, not claimed as a fresh gRPC build.
  The 63-source live manifest extends the prior 62-source manifest with this
  fixture; changes are restricted to this fixture and the main saved scenario.
  Every previously frozen application source is identical to the built snapshot.
  This is a bounded manifest, not a claim that every transitive gRPC source was
  independently frozen at the earlier build.

The first native run `62270` / `1791684828885` exited one after the server received
the correct unary message. Its fixture waited for request half-close before
responding, leaving unary pending. The corrected fixture responds upon the unary
message, following the existing saved gRPC fixture, while Collect waits for Commit.
Original first-run snapshots are preserved under first-live-source-snapshot and
first-live-source-freeze.json. Both runs restore the original owned-profile files.

## Remaining gates

gRPC reflection v1alpha fallback/dependency/refusal/owner policy, late native/provider completion policies,
concurrent owners, ancestry/deadline and
other provider/platform cases still need their own helper acceptance. Broader
preview, synchronous app facade, DOM/events/onHide/private compatibility,
clipboard restoration, native chooser platforms and all original migration items
remain required before the deferred shared-input UX/UI/CSS phase.

Use the saved native scenario through the byte-preserving runner
`bun artifacts/run-plugin-grpc-helper.mjs`, with helper, cookie, protocol, OAuth
and gRPC flags enabled separately in PowerShell. Its build record selects only
the existing isolated probe executable. Native hosts hide before CDP and report
`native-hidden`; browser fixtures continue through fixed-headless launchUiBrowser.

Official references consulted before fixture implementation:
[Bun HTTP/2 compatibility](https://bun.com/docs/runtime/nodejs-compat#node-http2)
and [HTTP/2 server stream API](https://nodejs.org/api/http2.html).
JavaScript tooling and scenarios run with Bun only.


</details>

<a id="record-plugin-guest-dom"></a>

<details>
<summary>PLUGIN-GUEST-DOM</summary>

# Guest DOM to actual dialog host candidate

The guest now uses synchronous node references to a host-owned DOM graph.
Creation and DOM operations execute on actual browser Nodes; the bridge does
not clone/stringify the body or maintain a separate DOM model. Guest references
preserve identity across parent/child/query results and Node/HTMLElement checks.
Style references preserve identity and route supported CSS properties to the
original element. All operations remain inside the admitted owner's graph.

The working production runtime composes `c.app.dialog` with its existing app
facade only when the host enables DOM transport and callback retention. Dialog
returns void. Real host event listeners enqueue retained guest functions using
the original capability frame and map event target/currentTarget/this to the
same node references. Duplicate registration is inert and removal releases its
function lease. Actual Close removes the original body before enqueueing one
guest onHide callback. Preview dialog does not replace an active Send dialog.

The bridge exposes explicit DOM members and control elements. It rejects app
document/prototype access, unknown node IDs, executable elements, event string
attributes and executable HTML. Host graphs bound nodes/listeners and use an
8MiB cumulative text-write budget, including replacements/clone text, to avoid
unbounded retained orphan data. Owner disposal removes owned listeners/roots
and releases function handles. These are capability boundaries, not full DOM
API or event semantic parity.

## Verification — 2026-10-11

`bun run build` creates the current production plugin worker.
`bun tests/ui/plugin-guest-dom.js` uses that actual worker/VM, current host client,
Svelte PluginDomDialogHost/DialogShell and built application CSS. Six headless
groups verify actual DOM/void/identity, click/input/Unicode/live mutation and
original app metadata frame, duplicate/remove listeners, preview suppression,
one detached guest onHide, nine ownership/executable-content refusals and the
actual host text-write boundary. One genuine worker is verified terminated.

Saved production callback session, sync app, async dialogs, helper renderer,
Cancel recovery and host DOM lifecycle regressions also pass. Compiler is zero
errors/warnings. `bun artifacts/audit-plugin-guest-dom.mjs --freeze` preserves
local source/scripts/configuration, complete frontend build and seven results.
Without the flag it checks current/exact sources, result and worker hashes.
Exact evidence/commit/handles are recorded in STATUS.md. This does not prove a
current native executable or every external dependency.

## Required remaining work

This topic commits the guest reference adapter/validator, actual host graph and
saved end-to-end fixture/scenario. Runtime/client/worker DOM composition remains
with the broader uncommitted helper/sync/Buffer assembly. The app route and render
session provider do not yet activate it. The fixture retains an explicit owner;
production must preserve a dialog owner beyond render completion and provide
ordered shutdown/onHide before terminal owner revocation.

Complete DOM member coverage/live collections, synchronous event cancellation
and dispatch semantics, property event handlers, focus/default-action behavior,
generic HTML/private React/ReactDOM/axios, exact legacy geometry, replacement/
reentrancy/reuse/owner shutdown through the guest, native acceptance and wider
provider/platform/parity gates remain required. Unsupported HTML setters and
event cancellation currently throw explicitly. This does not close full DOM
or app facade parity. Full migration precedes shared-input UX/UI/CSS redesign.

References: [DOM appendChild](https://developer.mozilla.org/en-US/docs/Web/API/Node/appendChild),
[Document.createElement](https://developer.mozilla.org/en-US/docs/Web/API/Document/createElement),
[Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy),
and [QuickJS retained handles](https://github.com/justjake/quickjs-emscripten).


</details>

<a id="record-plugin-helper-context"></a>

<details>
<summary>PLUGIN-HELPER-CONTEXT</summary>

# Plugin run helper contexts — work in progress

2026-10-11 protocol helper candidate (uncommitted full helper scope): seven actual workspace payload/gRPC/OAuth calls wired, message/gRPC/GraphQL extraInfo capture fixed. Saved six-wrapper renderer27/94workers and context17/compiler0/0 pass; fresh production621f8ccc actual WS initial/connected payload/owner Abort plus retained populated helper16/10workers/11HTTP/one WS/two messages and H2/history9/27workers/30wire pass56source/restoration audits. Combined suite explicitly reloads catalog after Abort; automatic recovery remains required and is next. Actual gRPC/OAuth/preview/native sync/DOM/private/clipboard/platform/full migration/UX/UI/CSS gates remain open. See STATUS and PLUGINS.md#record-plugin-protocol-helpers.

2026-10-11 native cookie provider acceptance committeded3eaba: unchanged production05b8f4ad passes11groups/12wire/two fresh hidden hosts, including expiry/path/domain/send-store/response/redirect/header/replace/stale/delete/clear and fresh empty jar. Independent55source/product/file/store/workspace/653cookie audits and retained write/restart plus compiler0/0 pass. Loopback Secure exception and structured-error fixture corrections preserved. Remaining wider cookie/helper/protocol/DOM/private/sync/clipboard/platform/migration/UX/UI/CSS scope and /compact limitation recorded in STATUS.

2026-10-11 subsequent cookie-write persistence committeda59febf: iter_any save retains expired model entry through unrelated native edit and second fresh process (model4/request3/disk4), old binary negative disk3. Production05b8f4ad/54source audit, genuine helper13/9workers/9wire, retained H2/history9/27workers/30wire, exact owned-state restoration and isolated staged Linux272source locked check pass. Actual clear/delete/replacement/response cookie/provider and wider helper/migration/UX/UI/CSS remain required; STATUS records handoff and /compact limitation.

2026-10-11 cookie model snapshot topic committed90e4daf: fresh native restart now returns model3/request2, populated genuine guest helper13/9workers/9wire and retained H2/history9/27workers/30wire/save12/destroy pass on production4d956946 with54source/restoration audits. Exact staged Linux locked check passes; isolated Windows libclang discovery failure recorded separately. Subsequent-write expiry persistence and wider helper/cookie/provider/platform/migration then UX/UI/CSS remain required. STATUS records exact evidence, commit and /compact limitation.

2026-10-11 metadata topic checkpoint committed as 2c2fac1e4c471a3fd16a068443a25449eb5009f8; isolated staged Windows/Linux locked Cargo checks and272source Linux audit pass. Current candidate native helper13/9workers/9wire, H2 metadata9/27workers/30wire/history/restart and retained save12/destroy audits pass with exact workspace/store restoration. Full helper/cookie/protocol/DOM/private/sync/clipboard/platform/provider/migration and later UX/CSS gates remain open. STATUS records handoff and /compact interface limitation.

2026-10-11 actual workspace helper candidate: root HTTP Send/dependencies capture real model/history/saved-ID native send/cookie jar services and root ownership; detached ExtraRenderInfo/getExtraInfo forwarded. Optional expired native cookie model snapshot preserves normal unexpired request behavior. Windows/Linux Cargo and compiler/build pass; retained headless renderer21/context17/workspace12 and52source audits pass. Fresh production76861 live; actual native acceptance and full protocol/preview/sync/DOM/private/clipboard/cookie/provider/platform gates remain open. STATUS records exact live handle, frozen source and fixture ancestry concern; do not claim completion or edit source during build.

2026-10-11 production async app facade: explicitly enabled guest context now exposes existing alert/prompt/save RPC facade; renderer dispatcher captures real dialog endpoint with child owner/signal/trusted interaction. Saved headless helper-render21groups/88terminated workers passes actual c.app.prompt long wait/root Cancel; retained context17/dialog11groups pass, compiler/build0/0, independent46source/current-worker/result audit retained at artifacts/plugin-app-renderer-acceptance-1791674896110. Controlled network/model services; this is not full actual workspace/native/service activation or complete DOM/private/sync helper parity. Prior native55b0a44d evidence remains bound to previous worker/source snapshot. See STATUS for retained failures and next gates.

## Genuine native metadata/history checkpoint — 2026-10-11

Same productiona970d362/worker3ef8db1e now passes saved8cases/24terminated workers/27real wire requests: direct native IPC, genuine QuickJS guest network send/model/body reads with detached mutation, actual mounted App Send, actual persisted history file, separate native restart and guest model/body reads of native-loaded history. Independent39source/exact snapshot/encoded compression/body/build/owned exit/workspace bytes restoration audit and compiler0/0 pass. Both workspace originals captured before runs/changed bytes retained/restored exactly after exit. Full product helper service activation/ancestry/deadline/native/retained/provider, HTTP2/H3, GTK chooser/macOS, DOM/dialog/events/onHide/private/clipboard/exact-format restoration and full migration/UX gates remain required. Exact commands/artifacts/handoff: STATUS.md.

## Native response metadata checkpoint — 2026-10-11

Productiona970d362 accepts real final HTTP version and pre-decompression downloaded payload counts: native eight raw wire/IPC/adapter cases (plain/gzip/deflate/Brotli/chunked/HTTP1.0/HEAD/redirect), independent compression/27source/executable/workspace audit, corrected retained save12groups/10workers and separate main-destroy/exit0 pass. Compiler0/0; current harness-only readiness correction and prior failure retained. Actual GTK check/link and Linux current metadata compile pass; chooser/macOS/native clipboard/DOM/private/real service activation/genuine guest metadata/history/restart/HTTP2/H3/full migration/UX gates remain required. All build/native handles terminal; STATUS contains exact commands/artifacts/handoff.

## Current cross-platform save preparation — 2026-10-11

Linux owned GTK chooser candidate now compiles on actual Debian12/GTK3.24.38 with locked Cargo check exit0; independent274source binding audit passes. Executable linking is live35207 against isolated snapshot/read-only current source, with logs/handles in STATUS. Fresh Windowse4edc9e2 accepts saved12groups/10workers plus explicit main destroy/owned exit0 and20source/workspace/29byte audits. Current client15 controlled groups remain headless. Linux actual GTK runtime and macOS owned cancellation are still required; no full app/helper activation or full migration/UX completion is claimed. Earlier Windows92d346 evidence below remains historical evidence for its exact binary.

## Current Windows native save evidence — 2026-10-11

Production92d346f4 and saved plugin-save-native.js pass12groups/10workers, including actual Cancel/owner loss/parallel isolation/Unicode path/exact selected-file fs scope/default folder/overwrite No+Yes/real document unload and recovery. plugin-save-destroy-native.js passes explicit host destroy with live chooser/worker and owned exit0. Independent current19source snapshots/build/workspace/29byte audits and compiler0/0 pass; all handles terminal. Earlier statements below about unavailable Windows cancellation are historical preparation. Other-platform fallback closure, complete DOM/events/onHide/private/app activation/clipboard/exact restoration/service/metadata/native/retained/provider/full migration/UX gates remain required. Exact artifacts/limits/commands: STATUS.md.

## Synchronous app/clipboard channel preparation — 2026-10-11

- Previous goal turn made progress: trusted host interaction deadlines passed actual-worker/genuine Prompt controls with full helper17/renderer19 preparation. Continued the same unfinished complete helper feature at HEAD5e7fdca; no live job resumed. Root/ancestor/relevant Claude discovery none; STATUS/PLAN/PARITY read. Full migration and subsequent UX/UI/CSS goal remain active.
- Added dedicated-worker SharedArrayBuffer mailbox outside QuickJS/data codec. Explicit per-operation syncCall is captured before queueing and allowed only with guarded template helper capabilities. Five strict synchronous operations (getInfo/getPath and clipboard readText/writeText/clear) share the existing256call/64pending limits. Current callback/generation, increasing call IDs, fixed4MiB mailbox size/ownership and reply state are checked. Caller waits at most4s; timeout abandons that unique buffer and closes the VM/owned worker while preserving the original timeout. Caller cannot reuse an abandoned buffer or receive a later owner/callback reply.
- Internal synchronous app factory performs actual host calls every time, preserves desktop-only case-insensitive path, detached version/platform info, fresh clipboard reads, immediate write/clear completion and void return values. It is preparation for the full app facade; c.app is not activated in product renderers. No clipboard snapshot/promise-return substitute is exposed. Native clipboard plugin/adapters are not installed/connected yet and OS clipboard has not been touched by these tests.
- Trusted worker accounting excludes bounded host waiting from the two-second guest execution budget; no clock control enters the guest. A2.5s delayed synchronous response succeeds, but a guest CPU loop after that response is still interrupted. Timeout forces interruption/terminal containment even if guest tries to catch its exception. Existing five-second host callback and ten-minute trusted interaction ceilings remain.
- Consulted official Tauri HTTP-header example and Atomics worker-wait documentation. Added COOP same-origin/COEP require-corp to Tauri production and Vite development configuration; saved preview helper can explicitly apply these headers. Cargo76683 terminal0/34.30s validates native/config build (five existing eventsource vendor warnings). Actual production WebView2 isolation/IPC/provider/other-platform behavior still requires fresh frozen native/retained acceptance; Cargo does not prove it.
- Fresh build terminal0/423SSR+1112client. Saved bun tests/ui/plugin-app-sync.js final62675 terminal0 passes11headless groups with genuine production worker/QuickJS and controlled host app services: ordered/fresh Unicode clipboard, detached info/path, caller endpoint mutation, stale facade and preflight/input/method refusal, host exception,100000-code-unit UTF-8 value, codec size refusal, slow host/CPU boundary, Cancel/catalog owner loss/timeout/no late publication and fresh VM recovery. Separate non-isolated1group refuses before any host dispatch. Manual mailbox10controls cover invalid kind/size/owner/ID overflow, publication, duplicate/abandoned/error and oversize no publication.
- Retained direct helper26684 terminal0/headless17groups retains full20MiB/107chunk/reuse/terminal containment. Renderer99888 terminal0/headless19groups/84terminated workers retains all six wrappers and genuine long/overlap Prompt/CPU/ownership controls. Compiler11637 terminal0/0errors0warnings. Current plugin SHAda7f5d7ab877c7e9bfd7d773a2fa0216297ae5f5566c4549a7a6e201a9562ec0; template unchanged4e2fff42f3f6f09211b401d951e3bf691f0ec250fcaf041541583a0f95cf4419. Earlier workspace12 passes; new sync audit binds18files and both retained preparation audits bind34files. All handles terminal.
- Retained failure: browser TextDecoder rejects a SharedArrayBuffer view (failed-shared-text-decoder.json). Fixed by copying only atomically published bytes before UTF-8 decoding. Initial fixture records JSDoc2errors corrected; final compiler clean. This was a real browser transport defect, not native clipboard evidence.
- Next connect documented native clipboard/info/desktop adapters and verify native isolation, then complete async alert/prompt/save and DOM/dialog/event/onHide contract with trusted ownership; activate the complete app/network/cookie/protocol services, accurate native response metadata and privileged ancestry/wait policy. Fresh frozen native wire/history/cookie/workspace/source/restoration and all retained/provider/platform gates stay required. No complete-helper feature commit, scope reduction, full migration or UX redesign completion. Interface cannot invoke /compact; do not claim compaction occurred.


## Trusted plugin interaction deadlines — 2026-10-11

- Previous goal turn made progress: callback-retained body cache and exact old-native probe recovery accepted in preparation. Continued the same unfinished complete plugin-helper feature at HEAD5e7fdca; no live job resumed. Applicable Claude discovery none; STATUS/PLAN/PARITY read. Original migration and subsequent UX/UI/CSS goal remain active.
- Guarded template callback operations can now capture an explicit trusted host interaction subscription outside the value codec. Catalog/registry forward it from Send render sessions; preview, metadata and store-only actions do not acquire human-dialog control. Host five-second active deadline pauses/resumes with overlapping application waits, retaining a separate ten-minute total ceiling, live owner polling and Abort. Subscription/deadline cleanup accompanies success/failure/owned worker termination.
- Host-to-worker interaction messages carry the current callback ID and explicit activation; stale IDs cannot affect a later callback. VM callback elapsed deadline excludes only trusted idle waiting. QuickJS interruption still enforces the original two-second budget: synchronous evaluate/promise-job execution is measured and charged while waiting; guest loops cannot exploit a paused dialog. No waiting method is added to guest RPC/facade. Remaining app dialog/save adapters must use this same trusted state when activated.
- Saved headless renderer36919 terminal0 now passes19groups/84owned terminated workers. A genuine TemplatePromptDialog compiled with the shared fixture helper uses its injected bundle's own queue on the built app; this is real component/renderer/production-worker code with controlled helper services, not actual workspace/native activation. Nested Prompt stays open5500ms and succeeds; two concurrent nested prompts stay paused through6600ms and both release; actual root Cancel/catalog loss hide the owned Prompt and terminate the exact guest; guest CPU loop during a host-confirmed dialog wait is interrupted and terminated. Existing14 wrapper/render/ownership groups remain accepted.
- Saved direct helper60778 terminal0/headless17groups retains full20MiB/107chunk transfer/reuse, stale/body isolation and all terminal containment/recovery. New forged interaction RPC is refused before host dispatch. Playwright clock installed through beforeNavigate before app timers; advancing main-page time601000ms proves the host total ceiling and exact worker termination. Worker/QuickJS clocks remain real; this is not a ten-minute real-time or independently accelerated worker-clock test.
- Current plugin SHAff8c37fcd3340a08625d938d062705b854d68be214fca401baf81386976e5882; template unchanged4e2fff42f3f6f09211b401d951e3bf691f0ec250fcaf041541583a0f95cf4419. Fresh build terminal0/421SSR+1110client. Compiler48013 terminal0/0errors0warnings, retained headless editor20/workspace12 pass. Both preparation audits bind28current source/dependency/generated/scenario/shared-clock/dialog files. Diff check passes; every build/test handle terminal.
- Retained failures: first added Prompt case had no host for its injected module queue (failed-prompt-host.json); mounted the genuine component through reused shared Svelte fixture compilation. First Cancel assertion selected an older idle guest (failed-prompt-owner-selection.json); now binds to the callback with a current trusted-wait control. Initial runtime/fixture JSDoc diagnostics corrected. Passing late-clock-install result superseded because official Clock instructions require installation before timers; final60778 installs before navigation. No production regression is inferred from these harness failures.
- Next complete app info/path/dialog/save/DOM and synchronous clipboard contracts; accurate native response metadata; actual workspace/network/cookie/protocol service activation and privileged ancestry, including operation-owned network wait policy. Then fresh frozen native wire/history/cookie/workspace/source/restoration and retained acceptance. No complete-helper topic commit yet or scope reduction/full migration/UX redesign claim. Interface cannot invoke /compact; feature remains unfinished.


## Callback-retained bytes and common entrypoints — 2026-10-11

- Retained VM owns a private64MiB admitted-body cache; each callback gets a fresh ownership guard. Package-saved responses can be read synchronously by a later current facade without host refetch. Independent copies, old-facade refusal, unknown-path fallback and separate-VM isolation remain enforced. Bytes release with VM disposal/owned worker termination. Legacy getBodyBuffer reads a saved bodyPath synchronously, so per-callback-only caches were incompatible with module-retained response values.
- All six production render wrappers (HTTP/OAuth/message/gRPC/GraphQL/preview) carry helper capabilities/path. HTTP/OAuth capture before their first cookie-snapshot await. Actual app callers still do not activate services; complete app and native contracts remain required.
- Fresh build421SSR+1110client, compiler65967/0errors0warnings, direct actual-worker saved15groups/full20MiB/subsequent reuse/terminal containment and renderer14groups/69terminated workers pass headless. Plugin SHAb38201b18958713b93742507a8b051591bf5ec3679cb917f560e94345c6443b0; unchanged template SHA4e2fff42f3f6f09211b401d951e3bf691f0ec250fcaf041541583a0f95cf4419. Both preparation audits now bind20files. Network/cookie are controlled and no fresh native acceptance is claimed.
- Consulted official QuickJS context isolation and explicit handle/context disposal guidance: https://github.com/justjake/quickjs-emscripten/blob/main/doc/README.md. Commands: bun run build; bun tests/ui/plugin-helper-context.js; bun tests/ui/plugin-helper-render.js; bun run check; bun tests/ui/template-tag-editor.js. STATUS records old-native GraphQL failure and exact probe-state recovery.
- Still required before feature commit: trusted interaction deadline pause, complete app/path/dialog/save/DOM/clipboard APIs, native metadata, workspace/protocol/network/cookie activation, fresh native/source/restoration/retained acceptance. No feature/migration completion.


## Renderer helper plumbing and nested ancestry — 2026-10-11

- Previous goal turn made progress: terminal callback failure preserved, separate cleanup diagnostic retained and owned worker termination/recovery verified12groups. Continued the same unfinished full helper feature at HEAD5e7fdca; no live job resumed. Applicable Claude discovery none; STATUS/PLAN/PARITY read. Original migration/UX/UI/CSS goal stays active.
- Request render sessions now accept explicit trusted pluginServices, capture all three endpoint functions and detach initial guest ancestry. Incomplete services/invalid ancestry refuse before render work. Catalog handlers pass a separate per-callback helperCall with combined catalog/resource/root/child guards; registry forwarding retains it outside the data codec. Each custom guest gets a real dispatcher against supplied model data. util.render invokes the actual request template renderer with the same context, root signal, request-field chain/shared render budget and extended package ancestry. Built-in request-field recursion also preserves that ancestry; sender receives the immutable ancestry separately from guest extraInfo.
- Saved bun tests/ui/plugin-helper-render.js passes8headless groups through real registry admission/catalog/session/production plugin worker/QuickJS and production template worker/Nunjucks. Two distinct guest packages render inherited variables, model lookup, cookie result and synchronous network-response Buffer. Separate sibling callbacks stay usable. Same-package/different-tag and two-package recursion refuse before queued guest re-entry. Caller service replacement and ancestry-array mutation cannot change captured endpoints/path. Actual root Cancel and catalog root invalidation terminate the exact held parent guest before fixture cleanup and reject late replies; all27owned workers terminate. Network/cookie services are controlled: actual native wire/persistence are not accepted by this scenario.
- Production plugin worker SHAa0b8008b0e3271fe2bce8a6f28c911792a091ea1d07538e75c73334dfb997ccb; template worker SHA4e2fff42f3f6f09211b401d951e3bf691f0ec250fcaf041541583a0f95cf4419. Saved scenario compares served bytes to build bytes. Fresh build terminal0/421SSR+1110client, compiler79889 terminal0/0errors0warnings, retained headless editor20 and workspace12 pass. Earlier recursive-return and fixture dictionary/JSDoc diagnostics corrected; initial scenario generation newline/identifier escaping errors corrected before execution.
- Actual application activation remains pending: workspace does not yet supply complete pluginServices. Request/protocol/dependency sender integration must propagate privileged ancestry, with fresh native wire/history/cookie/resource restoration acceptance. Complete app info/path/dialog/save/DOM and synchronous clipboard contracts, trusted human-interaction deadline pause, cross-callback body semantics/metadata and remaining helper/retained gates remain required. No full helper feature commit or compact; no scope reduction, full migration completion or UX redesign acceptance.

## Terminal helper failure containment — 2026-10-11

- Previous goal turn made progress: response/Buffer adapters and full20MiB transfer passed saved7groups. Continued the same unfinished full helper feature at HEAD5e7fdca; no live job resumed, root/relevant Claude discovery none, STATUS/PLAN/PARITY read. Full migration and later UX/UI/CSS scope remain active.
- Added CPU loop, indefinitely held helper, CPU loop after delayed host reply, and full Buffer conversion interruption to the saved actual-worker scenario. Simple CPU/held failures already disposed cleanly. The full Buffer conversion reproducibly replaced the original error with a QuickJS gc_obj_list disposal assertion; failed-buffer-interruption.json retains the failure. A delayed host reply alone can legitimately succeed below the5s total budget; corrected the initial scenario assumption and added actual subsequent CPU work instead.
- Runtime now preserves its original terminal callback Error if vm.dispose throws and attaches a bounded separate cleanupError diagnostic. Worker and session carry that diagnostic, then existing host close terminates the exact owned worker before rejecting. Closed VM is never reused. A fresh independently owned session successfully runs and closes after the terminal Buffer case. This is containment of an observed engine cleanup defect, not a claim that QuickJS disposal was repaired.
- Consulted installed QuickJS deferred-promise lifecycle, official SDK source and upstream issue269 (allocation during promise jobs can assert during disposal); its symptoms are consistent with this reproduction. Installed wasm is2025-09-13+f1139494; primary package registry still reports0.32.0 as latest, so no speculative runtime upgrade. Original failure remains interrupted, separate cleanup diagnostic records the engine assertion, and actual worker termination/recovery are checked. Saved scenario also records expected engine console diagnostics and rejects unrelated console errors.
- Fresh build terminal0/418SSR+1107client; compiler75508 terminal0/0errors0warnings. Final saved headless acceptance and current source hashes are recorded in plugin-helper-context artifacts. No helper feature commit/compact yet: app/renderer activation, synchronous clipboard/cross-callback body compatibility, trusted human-interaction deadline pause, app paths/dialogs/save/DOM contract, real network/history/cookie persistence/nested re-entry, metadata and fresh native/retained/source/restoration acceptance remain required.

References: [QuickJS deferred promise lifecycle](https://github.com/justjake/quickjs-emscripten/blob/main/packages/quickjs-emscripten-core/src/deferred-promise.ts), [upstream allocation/disposal report269](https://github.com/justjake/quickjs-emscripten/issues/269). Actual reproduced cleanup error remains observable; host worker termination releases the isolated module. Saved timeout-controls.json records all four primary errors, any cleanup diagnostics and recovery.

## Response/Buffer adapters and full-size transfer — 2026-10-11

- Continued the same unfinished plugin helper feature at HEAD 5e7fdca080373a8305a3e32e33f2ed1e08cd48b3. Previous turn completed the requested headless-policy verification (workspace12 passed); no headed browser override exists. Full migration and subsequent UX/UI/CSS scope remain active. No live job resumed; relevant Claude discovery found none.
- Buffer6.0.3 is a direct exact dependency. Bun browser-IIFE generator runs from prepare, embeds buffer/base64-js/ieee754 MIT notices and supplies the canonical Buffer only inside each QuickJS VM. The generated file remains ignored/reproducible. Legacy HTTP response aliases, synchronous independent Buffer reads/fallback/empty body and callback-generation refusal implemented. Network replies now use the same response packet/cache as history, preserving typed detached request/options and renderer ancestry.
- Added operation-owned response transfers: each decoded body is capped at the native HTTP20MiB limit; admitted body paths only, aligned262144-character chunks, bounded64MiB retained caches. Public getBodyBuffer remains synchronous because async response retrieval completes prefetch first. Internal readBodyChunk is not exposed in util.models. Worker-to-VM chunks use documented newArrayBuffer and native ArrayBuffer copies, avoiding expensive guest base64/copy loops; the general1MiB value codec and existing deadlines are unchanged.
- Fresh build terminal0/418SSR+1107client. Saved headless plugin-helper-context passes7groups on actual bundled worker/session/VM, including20MiB/107chunk transfer and Cancel during held body transfer/no later chunk/actual worker termination. Controlled service response, not native HTTP acceptance. Current worker SHA f6234cbaa2acc8071a4fc7ad4c33bc6a2a161158f67f88f2397a236edff00f6a; full transfer artifact measured1636.5068ms. Manual adapter9 and transfer5 controls pass; transfer controls independently reconstruct every byte of a20MiB varying-binary body through unchanged codec round trips and reject foreign/unaligned/out-of-range/malformed/oversized input.
- Retained failure: initial guest base64/copy implementation hit the2s deadline at about3MiB and QuickJS teardown asserted gc_obj_list. failed-full-body.json/body-transfer-failure.json preserve evidence. Full-size success now avoids that path, but error/timeout teardown needs a separate regression and resolution before acceptance. Earlier optional body packet/scenario JSDoc compiler diagnostics corrected.
- Remaining: real app/renderer/catalog activation and ownership, app platform/path/dialog/save/clipboard/trusted interaction deadline behavior, actual network wire/history/cookie persistence, complete response metadata and cross-callback body semantics, nested re-entry propagation, timeout cleanup, fresh production/native/source-byte/restoration and retained suites. No helper feature commit or compact yet; the feature is incomplete.

Consulted official [QuickJS newArrayBuffer API](https://github.com/justjake/quickjs-emscripten/blob/main/doc/quickjs-emscripten/classes/QuickJSContext.md) and installed0.32.0 declaration accepting ArrayBufferLike; [buffer browser usage](https://github.com/feross/buffer#usage) documents the buffer/ import, and [Bun bundler](https://bun.sh/docs/bundler) supports the browser IIFE generator. Commands: bun add buffer@6.0.3; bun scripts/build-plugin-buffer.mjs; bun run build; bun tests/ui/plugin-helper-context.js; bun run check. Older preparation entries below are historical.

2026-10-11 bridge preparation: session captures an explicit host helperCall per operation; it is allowed only for guarded template runs. Worker messages have separate monotonic helper IDs and current callback ownership, with the bounded value codec for requests/results. VM helper facades are frozen and created per callback generation; a retained reference from an earlier callback is refused before host dispatch. Shared256call/64pending/16Mi-character bridge limits and existing five-second deadline remain; metadata cannot activate helpers and actions retain store-only context.

Saved `bun tests/ui/plugin-helper-context.js` passes4headless groups using the genuine bundled production worker/session/QuickJS VM and controlled helper services: model lookup/nested-render/network-shaped typed values, frozen facade/stale reference refusal, metadata/action/unguarded activation refusal, held helper Abort/late reply/no next dispatch and source-owner invalidation/actual worker termination. Worker bytes are checked against build output; preparation-audit.json binds seven source/scenario hashes. Actual app/network/native services are not connected or accepted. Manual actual QuickJS7helper controls and9retained store/action/metadata controls pass; build91947 terminal0/418SSR+1107client and compiler57008 terminal0/0errors0warnings.

Compatibility still required: app information/path/dialog/save/clipboard interactions, real network response/wire/history, bounded nested render and same-guest re-entry detection, all model adapters/cookie-jar mutation, legacy response shape and Buffer behavior. The RPC facade is internal preparation; synchronous legacy body-buffer/clipboard reads require explicit compatible adapters before application activation. Human interactions also need documented trusted pause/deadline behavior; current five-second bridge must not be passed off as completed app prompt parity.

After picker/editor commits0f81387/5e7fdca, the next feature covers the complete legacy run-helper contract: app, network, util.render and util.models, integrated with operation ownership, rendering and saved native acceptance. This is not accepted or committed complete. Existing UI/layout stays unchanged; full migration and subsequent UX redesign remain required.

Reference inventory: archived `templating/base-extension.ts`, `plugins/context/app.tsx`, `plugins/context/network.ts`, `models/response.ts`, `models/o-auth-2-token.ts`, `common/database.ts` and `models/settings.ts`. Legacy util.models exposes request.getById/getAncestors, workspace.getById, oAuth2Token.getByRequestId, cookieJar.getOrCreateForWorkspace and response.getLatestForRequestId/getBodyBuffer. Ancestors run nearest parent to workspace, excluding the request. Response model environment filtering is optional and defaults false; this differs from the already-verified strict response template tag selection. Preserve both contracts.

Consulted [official QuickJS host functions/promises and handle lifetime documentation](https://github.com/justjake/quickjs-emscripten/blob/main/doc/README.md). Reuse the retained worker and transaction/owner boundaries; no new runtime or package initialization is needed. Only Bun tooling/scripts are permitted.

Initial implementation: `src/lib/plugin-model-reads.js` resolves five read-only model methods against an explicit operation snapshot, checks method/arity/IDs, follows the supplied request document's parent as legacy does while looking up ancestors only in the snapshot, detects cycles, applies legacy response setting semantics and clones every result. It is not connected to guests yet. Cookie jar creation, response legacy shape/body-buffer compatibility, full guarded helper RPC, app interactions/platform/path/clipboard, network sends and nested rendering remain part of this same unfinished feature. Do not expose substitute or silently incomplete helper APIs.

Next connect the complete helper dispatcher through the real session/worker/VM and renderer operation. Retain metadata no-context and actions store-only contracts. Then saved reusable headless/native-hidden scenarios must verify genuine guest calls, wire/history/store/workspace results, ownership/cancellation/re-entry and cleanup. Freeze fresh production app source, build with Bun/Tauri, run retained suites, commit the verified feature by topic and provide compact handoff. The interface cannot invoke `/compact`.

Trusted deadline references: [QuickJS runtime interrupt handler and explicit promise-job execution](https://github.com/justjake/quickjs-emscripten/blob/main/doc/README.md), [Playwright Clock installation order and fastForward](https://playwright.dev/docs/clock). Reused existing createRenderDeadline/createTemplateInteraction; no new engine/package. Commands: bun run build; bun tests/ui/plugin-helper-render.js; bun tests/ui/plugin-helper-context.js; bun run check; bun tests/ui/template-tag-editor.js; bun tests/ui/nocturne-workspace.js.

Synchronous channel references: [Tauri isolation headers and Vite setup](https://v2.tauri.app/security/http-headers/), [Atomics.wait dedicated-worker behavior](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics/wait), [SharedArrayBuffer isolation and sharing](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer). Native clipboard follow-up uses the [official Tauri clipboard plugin](https://v2.tauri.app/plugin/clipboard/) generator/API; not initialized in this preparation. Commands: bun run build; bun tests/ui/plugin-app-sync.js; bun tests/ui/plugin-helper-context.js; bun tests/ui/plugin-helper-render.js; bun run check; cargo check --manifest-path src-tauri/Cargo.toml. No engine variant/package migration was made.
## Async app dialog preparation — 2026-10-11

Internal createPluginAppAsyncHelpers and createPluginAppDialogEndpoint prepare alert/prompt/save; product c.app remains unactivated pending the complete DOM/events/onHide/private and native contracts. Actual queue renders literal alerts, supports bounded text/custom submit and legacy browser/checkbox/decimal input behavior, and hides owned UI on Abort or owner loss. Trusted purpose/interaction/services remain outside guest values. Saved `bun tests/ui/plugin-app-dialogs.js` passes11headless groups/8terminated workers; its action-purpose controls still use a template callback and a controlled save service. Native save uses [official Tauri API](https://v2.tauri.app/reference/javascript/dialog/), but an already-dispatched native chooser cannot yet be closed on root Cancel. Late-result suppression is accepted only with a controlled adapter. Current SHA3ef8db1e43cf9a0a5e37b27811af7810bcef093a6472740c194407fdc02667ab; retained helper17/renderer19/sync11+non-isolated1/compiler0/0 pass. Native actual clipboard/exact-format restoration, full app/DOM/private/service/native metadata/current binary/provider/platform and all original migration/UX gates remain required. STATUS records source audits, retained failure and exact evidence.



</details>

<a id="record-plugin-helper-integration"></a>

<details>
<summary>PLUGIN-HELPER-INTEGRATION</summary>

# Owned plugin helper integration

The runtime, worker/session transport, registry and request renderer now activate the previously verified helper foundations together. Real request services supply captured model/history/cookie data and saved-ID native sends; guest data never supplies host capabilities. ExtraRenderInfo, nested helper ancestry, callback generations, interaction waits, synchronous app calls and retained DOM callbacks use the original operation owner. HTTP/gRPC completion permits owned dialog continuation without promoting cancellation. OAuth preview uses its registered editor lease and history guard.

The integration includes the isolated Buffer generator/dependency lock, clipboard-manager native registration and permissions, operation-owned save commands and their platform source, COOP/COEP prerequisites, app dialog/prompt component support, and saved helper/native acceptance assembly. It preserves the existing application layout. Response history menu and collections CSS changes are separate pending work.

## Reproducible checkout verification — 2026-10-12

The staged application, backend, generator/dependency and scenario files were exported with `git checkout-index` into `artifacts/plugin-helper-integration-checkout`. That checkout started without `node_modules`, `.svelte-kit`, `build` or generated sources. It contains the proposed Git tree, rather than a copy of the entire dirty workspace. The verified code tree was `20d97f74b86173d5f89601a85842601880ef05b7`; final commit adds this documentation and migration checkpoint entries.

Commands executed inside that checkout:

- `bun install --frozen-lockfile`: exit0,248packages, prepare generated OpenAPI validators and the isolated Buffer source.
- `bun run check`: exit0,zero errors/warnings.
- `bun run build`: exit0,frontend build17.12s.
- Saved headless scenarios: `bun tests/ui/plugin-dom-render-owner.js`, `plugin-helper-render.js`, `plugin-app-sync.js`, `plugin-dom-session.js`, `plugin-app-dialogs.js`, `plugin-save-client.js`, `plugin-helper-context.js` and `plugin-cancel-recovery.js` all exit0.
- Windows `cargo check --manifest-path <checkout>/src-tauri/Cargo.toml --release --locked`: exit0. It uses the existing compiler/dependency cache, MSVC/SDK and an explicitly configured external LLVM, as documented in TEMPLATING.md#record-os-template. First Cargo attempt failed because the clean checkout had no ignored LLVM tool directory; setting LIBCLANG_PATH to the existing external installation fixed that build prerequisite. The application source was unchanged.

`bun artifacts/audit-plugin-helper-integration.mjs` verifies all64proposed code/dependency/scenario/historical topic-document files against both the staged Git blobs and isolated checkout (normalizing Git checkout line endings), and preserves their exact exported bytes. Fresh generated Buffer bytes match the previously accepted artifact. Both built workers match native acceptance: plugin4b6a566bd674472269eb5e2f95d2103c8e2f2561cd11aa52ca82fddcc7592197/template4e2fff42f3f6f09211b401d951e3bf691f0ec250fcaf041541583a0f95cf4419. Eight result hashes and successful Windows Cargo logs/state are retained in `artifacts/plugin-helper-integration-proof/manifest.json`, `accepted` and `sources`.

The backend/runtime/provider/helper files in this checkout match the exact native source snapshots and explicit three-file harness variant accepted by native427cf713. That native acceptance proves41checks/14terminated plugin workers/68HTTP, WebSocket/ninegRPC/reflection, six post-completion guest/native child-send callbacks, normal onHide and two workspace buffers/store/all653original cookie files restored. See PLUGINS.md#record-plugin-dom-render-owner. The prior native executable contains the broader working UI, including pending response-history/CSS changes; no new native executable or native run of this isolated checkout is claimed. This checkout proves fresh dependency/generator/frontend/worker/headless/compiler/native-check activation of the committed integration.

## Remaining scope

Committing this assembly closes the missing clean-checkout integration/dependency gate. It does not close the entire helper/app facade or migration. Nested response-tag and stream lifetimes, ordered guest onHide before terminal revocation, full DOM/live collections/property handlers/event cancellation, generic HTML/private React/ReactDOM/axios, complete native clipboard-format restoration, save platform/runtime gates and all remaining provider/migration parity stay open. Linux/macOS runtime acceptance is not inferred from Windows Cargo check. The deferred shared-input and UX/UI/CSS phase still follows full migration, per POST-MIGRATION-UX.md.

No live processes remain from this checkpoint. This interface cannot invoke `/compact`; STATUS.md records the current commit/evidence/remaining gates and handoff before the next feature.


</details>

<a id="record-plugin-oauth-helpers"></a>

<details>
<summary>PLUGIN-OAUTH-HELPERS</summary>

# Native OAuth helpers and Auth preview

The same saved `plugin-template-tags.js` scenario now has optional
`INSOMNIUM_PLUGIN_HELPER_OAUTH=1`, with a separate reusable
`tests/ui/helpers/plugin-oauth-native.js` fixture. It owns a loopback token/resource
server and synthetic imported token. The plugin resolves actual workspace/request
models, sends its saved HTTP helper with extra information, checks real response
history and returns the response body as the OAuth client ID. Guest URL edits must
not become an alternate send endpoint.

## Verified negative (2026-10-11)

Executable `324eb45d9b1637b9e52d0d5cb6f573513a2380bc2a466fd7062810b7c46af425`
is reused from the previous cancellation candidate only after confirming product
source unchanged. Its separate probe retains original57 and live58 source snapshots.
Native session76520/`plugin-template-tags-1791681937004` fails saved-token adoption.
Manual Fetch succeeds first: one helper HTTP request and one genuine token exchange
with the rendered client ID. Auth preview then executes the same tag without helper
services, producing `cannot read property 'models' of undefined`, quarantining the
worker and causing `unknown block tag: oauthhelper` on adoption.

Restoration `plugin-workspace-helper-restoration-1791681936474` passes; both original
workspace buffers, plugin store and the cookie inventory match. The independent
`artifacts/audit-plugin-oauth-negative.mjs` audits historical58 snapshots, executable,
native-hidden exit0, one manual exchange/helper request, exact failure and restoration.
It explicitly does not claim current application source matches that older candidate.

## Candidate implementation / required native proof

- OAuth preview now obtains the same real saved-ID transport/model/cookie services
  through a registered editor work scope. Source key, Abort, workspace/collection
  owner and drain/disposal guards protect callbacks. Dependent sends check the
  preview owner before native send and before publishing response history.
- Preview-owned history writes acknowledge the exact resulting history before
  persistence yields. The input key survives those writes and eviction, while
  external history/body edits still invalidate it. Token-only updates recompute
  status from the resolved request without repeating helper execution. Acquisition
  and adoption suspend general rendering while their explicit owner runs.
- Saved `bun tests/ui/plugin-oauth-preview.js` passes eight guard controls.
  Compiler78210 passes zero errors and zero warnings. This is source/guard evidence,
  not native/component acceptance.
- Production build68716 under `artifacts/native-plugin-oauth-preview-probe` freezes
  62 sources, including OAuthEditor and oauth-model omitted from earlier manifests.
  No app/scenario source edits while build/native QA is live. Native acceptance
  must retain Fetch/adoption/actual bearer Send, imported source/history, both
  owner-Cancel prompt paths/no-wire/token preservation, recovery without Load,
  preview readiness/bounded side effects and exact owned-state restoration.

## Accepted candidate / isolated guard topic

Build68716 exits0 in384.571s; executable
`20ab757ea334962177322637e29efa134d311e5d6f9d67e82b10220b44ee81c6`.
After build and before native QA, the helper harness adds a750ms ready-state
stability assertion. Original62-source and initial-live snapshots are retained;
live62 differs only in that saved helper file, with application source unchanged.
Native11980/`plugin-template-tags-1791683269931` and restoration
`plugin-workspace-helper-restoration-1791683269355` exit0. Twenty-three checks,
twelve terminated workers, nineteen main HTTP plus three OAuth HTTP requests,
one WebSocket connection/two messages and seven OAuth cases pass. Eight OAuth
helper requests are observed; current saved helper history contains ten entries
under the configured global20-entry cap. Both real prompt owner-Cancel handlers
preserve active token and deny additional token/helper wire; recovery works
without Load. The original imported token remains unchanged. UI reports API token
ready, and no helper/token wire repeats during750ms after ready.

`artifacts/audit-plugin-oauth-preview.mjs` independently audits current62/exact/live/
original source snapshots, build/executable/worker assets, actual rendered grant
forms/two exchanges/one bearer GET, token/context binding, response/history bytes,
populated cookie model and exact store/two original buffers/all653 cookie files.
Owned cookie fixtures alone are removed after native-hidden/visiblefalse exit0.
Final compiler39032 passes0/0. The standalone history guard and eight saved controls
are isolated as a topic; editor/service/native scenario integration still belongs
to the unfinished helper feature. See AUTHENTICATION.md#record-oauth-preview-history for commit scope.

All actual gRPC protocol callers, other production preview callers/policies,
synchronous native app/clipboard/DOM/private APIs, broader helper/provider/platform
and original migration parity remain required before the shared-input UX/UI/CSS
phase. This candidate is not the completed helper feature and is not yet committed.

Official contracts consulted: [OAuth client credentials](https://www.rfc-editor.org/rfc/rfc6749.html#section-4.4),
[Svelte effect dependencies](https://svelte.dev/docs/svelte/$effect#Understanding-dependencies)
and [Svelte untrack](https://svelte.dev/docs/svelte/svelte#untrack).


</details>

<a id="record-plugin-operations"></a>

<details>
<summary>PLUGIN-OPERATIONS</summary>

# Plugin operation ownership

Verified 2026-10-10 on production `282341ffb727d6511a0bf99ec1fbbd32c7b60671952b5f3be3a3a1f5410317d4`, frozen741 source/scenario paths. The previous metadata topic is `b8bc93e5bdda645b8ad7eea4013f0a386009bba4`, with checkpoint `9b4d5babddc05d0cfc527cc19480bbb69b6f630d`.

Each retained session callback can capture a separate live-owner guard and AbortSignal. Queued cancellation rejects that callback without closing an unrelated active callback. Stale queued guards refuse before dispatch. Aborting or invalidating an active callback terminates the retained worker, rejects its result and prevents subsequent host calls or delivery of a held store response. Native writes already dispatched cannot be undone. Canceled queue entries retain their slot until reaching the queue head; the active callback has the existing five-second bound.

Callback data accepts detached `context`, `meta` and `renderPurpose` (`send`, `general`, `no-render`). Nonempty helper data requires a per-operation guard. The shared bounded value envelope preserves aliases across args/helper data and signed zero. Guest callbacks receive the frozen outer helper plus the independently installed store facade. Helper data cannot inject host capabilities. Metadata queries refuse helper data and retain their no-store contract.

The saved `bun tests/ui/plugin-operations.js` scenario uses real production workers and successful native store replies held by the shared fixture. It covers 14 preflight refusals, original data after mutation, alias/signed-zero retention, three queued cancellation/guard controls and two active cancellation controls. It verifies no rejected preflight dispatch/store call, worker termination, unchanged package/workspace and restores exact original probe-store bytes or absence. Browser launches remain headless; native attachment remains `native-hidden`.

Commands: `bun run check`; `bun tests/ui/nocturne-workspace.js`; `bun tests/ui/build-recovery-copy-probe.js`; set `INSOMNIUM_UI_BUILD_STATE=artifacts/native-recovery-copy-probe/build-state.json`, then run the saved scenario. Compiler67985 0 errors/0 warnings and inline actual QuickJS six context checks passed before source freeze. Further actual QuickJS7kinds×3purposes/21 controls and controlled client7/preflight14 passed. These module controls complement native acceptance; they do not prove product integration.

Production handle4148 finished1791646045914/code0. Source/build binding preserves accepted e10918eb under `artifacts/native-plugin-operations-baseline`. Focused native artifact `artifacts/playwright/plugin-operations-1791646053924` (PID66772) passes20 checks/14preflight refusals/3terminated genuine workers/5store reads/0writes/2unchanged files and full workspace. The independent `artifacts/plugin-operations-audit.mjs` checks literal helper graph/alias/-0, exact refusal list, worker bytes, source/build, store messages and unchanged workspace/package files.

`artifacts/playwright/plugin-operations-suite-state.json` is terminal/passed1791646155425. The sequential suite ran the saved focused scenario and retained metadata8types/18refusals/20workers/40files; registry4groups/6workers/8files and actual restart; values48checks/12roundtrips/12input+5result refusals/6workers; session6groups/14workers/7kinds/6methods/26files and actual restart; store8groups/23refusals/8conversions/32writes and actual restart; runtime14packages/11workers/34files; formats31cases/76files; discovery13packages/2errors/28files; sources7checkpoints/30files and actual restart. Each has independent source/build/literal/restoration audits on the same production release. All native results are terminal0/`native-hidden`/visible:false. Exact scenario directories/PIDs/audit summaries are in the suite state. `plugin-operations-cleanup.json` confirms owned build/suite/native PIDs and14profiles absent. Application layout/CSS are unchanged. Final compiler/headless workspace recheck and topic commit are recorded in STATUS.

References: [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal), [abort event](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/abort_event), archived legacy `templating/base-extension.ts` and `common/render.ts`. This extends the existing session subsystem; it does not yet register custom tags or implement application/network/model/render helper capabilities. Collision/priority compatibility, tag editor, resource owners, Send/hooks/action menus, other contexts/admission/legacy data, provider/platform/accessibility and every original migration/UX/UI/CSS gate remain required. The full redesign follows migration.


</details>

<a id="record-plugin-protocol-helpers"></a>

<details>
<summary>PLUGIN-PROTOCOL-HELPERS</summary>

# Plugin helper protocol activation candidate

Root request Send and introspection already carried workspace plugin services.
Initial and connected WebSocket payloads, gRPC connection/unary/client-stream
payloads, manual OAuth acquisition and saved-token selection omitted them.
The candidate passes the same captured workspace services, actual operation owner
and AbortSignal into those seven renderer calls. Model reads also check the
workspace owner before reading live history.

Message, gRPC and GraphQL wrappers now call `capturePluginRenderOptions` before
awaiting and forward the complete detached options, including `pluginExtraInfo`.
Previously they forwarded services/path but discarded extra information.
Saved `INSOMNIUM_PLUGIN_EXTRA_INFO=1 bun tests/ui/plugin-helper-render.js` failed
at message rendering with a null extra-info value before the fix. The corrected
six-wrapper matrix passes host/guest mutation checks with actual workers/VMs.

## Current evidence on 2026-10-11

- Compiler reports zero errors and warnings. Saved headless helper renderer passes
  27 checks with 94 terminated workers; retained helper context passes 17 checks.
  These use controlled services and do not prove native gRPC/OAuth/preview callers.
- Native old production `05b8f4ad` fails initial WebSocket payload because guest
  `util.models` is unavailable. Native `1791679376754` / restoration
  `1791679376238` preserve the failure and independent historical production-source
  audit. Both original workspace buffers, store and 653 cookie files are restored.
- New production `621f8ccc42932aa4edc898915b40313268d670458f05034801f6bb0c80400ca6`
  builds successfully. Frozen 56-source snapshots bind the application and test
  inputs; live QA changes only the saved scenario's modal cancellation/recovery
  handling, preserving original and intermediate snapshots separately.
- Native `1791680089413` / restoration `1791680088875` passes 16 checks,
  ten terminated workers and 11 native HTTP requests, plus one actual WebSocket
  connection and two messages. Both initial and connected payloads use the actual
  workspace model and saved-ID child HTTP request, forward ExtraRenderInfo, read
  the native response body, and persist three distinct helper response histories.
  The original populated-cookie/model/Prompt/HTTP matrix remains in the same run.
- During the real payload prompt, the saved scenario dispatches the actual
  Disconnect button handler programmatically because `showModal` makes the
  underlying UI inert. It proves owner Abort closes the prompt without additional
  HTTP/message leakage. This is not pointer interaction through the modal.
- Independent 56-source/current/exact-snapshot/build/worker/wire/history/model/
  cookie-file/store/workspace audit passes. Native hosts are hidden before CDP and
  exit zero; only scenario-owned cookie files are removed after owned exit.
- Retained H2/metadata/history/restart passes nine cases, 27 workers and 30 native
  requests: native `1791680138905`, restart `1791680147083`, restoration
  `1791680138712`, with independent 56-source/build/byte/history/restoration audit.

## Remaining gates

Owner Abort tears down the guest and invalidates its catalog. Native
`1791679924738` reached successful payload/Abort checks, then the ordinary tag
regression failed with unknown block tag `UnicodeTag`. The passing combined run
explicitly reloads the package through Preferences before the retained suite.
Automatic catalog recovery remains unproven and must be reconciled with legacy
behavior; manual reload is not treated as completing lifecycle parity.

The first live run `1791679837536` failed the Disconnect locator's exact text regex
(icon/whitespace), and restored both workspace files/store/cookies. Subsequent
saved selector uses the real send-button class plus partial text. Auditors were
updated to expect three helper histories, reflecting the two added payload sends.

Actual native gRPC discovery/unary/client-stream and manual/saved-token OAuth
helper acceptance remain required, as do production preview/read-helper policy,
synchronous app facade, DOM/events/onHide/private compatibility, clipboard with
exact original-format restoration, broader ancestry/deadline/Cancel/platform/
provider gates and every original migration requirement. UX/UI/CSS and shared
input work remain part of the overall owner goal. This candidate is uncommitted
preparation of the same incomplete full helper feature.

Official references consulted before changing the subsystem:
<https://svelte.dev/docs/svelte/$state> and
<https://v2.tauri.app/reference/javascript/api/namespacecore/>.


</details>

<a id="record-plugin-registry"></a>

<details>
<summary>PLUGIN-REGISTRY</summary>

# Application plugin admission and session lifecycle

Verified final production56718 terminal0, SHA256 `8c3c04f6e65b956873201283e2d9a141352ae92952c114e39a14ef86c51bdbce`, bound736 source paths. Actual mounted product registry1791642195351/PID67660 and restart1791642199467/PID65880 pass independent audit4groups/6initialized-and-terminated genuine workers/8unchanged package files/six theme-width profiles/0store IPC/full persisted workspace equality and original restoration. Ready empty-string manifest version loads correctly; duplicates have no Load controls; real native source reply after Disable creates no worker. Loaded/failed discovery contradictions are absent. Actual dark/light760 captures show loaded controls inside viewport and were inspected.

Saved commands use PowerShell `$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'`, then `bun tests/ui/plugin-registry.js`, `bun tests/ui/plugin-values.js`, `bun tests/ui/plugin-session.js`, `bun tests/ui/plugin-store.js`. Run `bun tests/ui/plugin-discovery.js` separately with exactly one of `INSOMNIUM_PLUGIN_RUNTIME=1`, `INSOMNIUM_PLUGIN_FORMATS=1`, `INSOMNIUM_PLUGIN_SOURCES=1`, or no mode for ordinary discovery. Build uses `bun tests/ui/build-recovery-copy-probe.js` with `LIBCLANG_PATH` set to `artifacts/tools/llvm-20.1.8/bin`; compiler `bun run check`, headless `bun tests/ui/nocturne-workspace.js`.

Final retained acceptance artifacts under `artifacts/playwright`:

| Scenario | Main / actual restart suffix | Independent acceptance |
| --- | --- | --- |
| values | 1791642214313 | 48checks,12roundtrips,12input/5result refusals,6workers,0store IPC |
| session | 1791642220925 / 1791642229764 | 6groups,14workers,7callback kinds,6store methods,26files |
| store | 1791642235936 / 1791642237704 | 8groups,23refusals,8conversions,32concurrent writes |
| runtime | 1791642241165 | 14packages,11workers,8contribution metadata kinds,34files,6profiles |
| formats | 1791642251805 | 31cases,76files |
| discovery | 1791642258224 | 13packages,2manifest errors,28files,6profiles |
| sources | 1791642265977 / 1791642270399 | 7checkpoints,max14packages,30files,6profiles,persisted full values |

Each `plugin-registry-*-audit.mjs` in ignored artifacts verifies current source/build binding and acceptance values; the focused audit takes absolute main/restart artifact paths. Retained callbacks/store and package/workspace restoration audits all pass. Native hosts are native-hidden/visible:false/exit0; shared browser helper remains fixed headless:true. Compiler85040 0errors0warnings, current headless workspace12 and diff pass. Exact current/prior feature PID names and owned WebView profiles are absent (`plugin-registry-cleanup.json`); all job handles terminal. Preserved baseline, first784e4bfc and pre-message fa470d51 candidates/failures remain available. This accepts application admission/session lifetime and metadata only; all contribution/context/full migration/UX/UI/CSS requirements below remain required.

Current production56718 is rebuilding a message correction, with sources frozen. Candidate fa470d51 (85329 terminal0) passed corrected native registry1791641588680/PID71608 and restart1791641592308/PID71676, focused audit4groups/6terminated workers/8files/six profiles/0store IPC/full workspace preservation and restoration. First fa470d51 scenario1791641520181/restart1791641524238 passed its then-weaker assertions, but audit found2of4 initialization results: Unload is available during loading. Saved waits now require the actual Loaded paragraph before Disable/Reload/restart Unload. Both prior artifacts and freeze retained. ArrayBuffer hash recorder failed before mutation; corrected Uint8Array recorder established unchanged app/executable after terminal execution. Compiler1332 0/0.

Retained fa470d51 values1791641537450 (48checks/6workers), session1791641613774+restart1791641622919 (6groups/14workers), store1791641629405+restart1791641631510 (8groups/23refusals/32writes) passed independent audits; runtime1791641650374 scenario passed, audit pending. Image review found old discovery text claiming “this package has not been run” under Loaded/failed state. Current PluginsPanel suppresses that discovery message while a registry record exists; saved scenario asserts absence and scrolls loaded controls into screenshots. Compiler85040 0/0. Preserve fa470d51 build/executable/freeze under native-plugin-registry-before-message; current736-source refreeze changes only PluginsPanel/scenario. Current build/native/regression/visual/cleanup/commit gates remain pending; candidate results do not prove the corrected application.

2026-10-10 prepared; native acceptance pending. Previous value codec e4aa645/checkpoint06f2f99 is accepted. STATUS/PLAN/PARITY/archived plugin cache/configuration contracts and applicable Claude discovery read (none found). Official [Svelte effect dependency tracking](https://svelte.dev/docs/svelte/$effect) and [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) consulted before implementation.

The application workspace owns one registry; closing Preferences unsubscribes its view without disposing loaded modules. Root component effect observes workspace owner/readiness/transition/configuration/paths; app teardown/HMR disposes all sessions. Only explicit Load plugin executes a module, in its isolated production worker. Source discovery and Check exports remain separate read-only operations. Admission uses actual persisted folders rather than a user-supplied package directory; complete discovery, unique supported package status, canonical entry/name/format/manifest version agreement and post-await ownership guards precede worker launch. Unload/Reload/disable synchronously abort and close owned sessions. Disabled settings and configuration/path/root replacement also refuse stale native replies/session dispatch. Duplicate winners remain an unresolved legacy compatibility policy; all duplicates refuse activation rather than silently selecting a different winner.

Concurrent same-name preparation shares its admission promise; successful loads retain module/cache state and metadata until invalidation. Failures expose bounded errors; at most32 retained/loading/error records, with explicit unload/reload recovery. Enabled/disabled state preserves custom plugin configuration and persists through the existing workspace queue; failed writes have a retry control. Direct Inspect folder mode offers no Load or configuration buttons. Loaded status explicitly says hooks/actions are not connected yet; no Send/menu/tag registration, callback execution or other context facade is claimed. Resource-level callback ownership remains required when those dispatchers are added; currently no registry callback API bypasses that gate.

Controlled inline adapters pass discovery/session dedup, disabled pre-refusal/live guard, duplicate/incomplete refusal, late discovery after reload refusal, changed root/paths invalidation and dispose (3opened/3closed). These are core controls, not real native application acceptance. Compiler67585 caught two pluginConfig annotations, fixed;51907/89625 pass0errors0warnings. Formatter touched unrelated pre-existing workspace/page formatting, removed those changes while retaining only registry integration. Compiler48613 caught14saved scenario annotations, fixed; final8329 pending. Saved plugin-registry.js uses actual mounted Load/Unload/Enable/Disable/Reload, observes unchanged genuine workers/native replies, holds a real read_plugin_package success to disable before acceptance, verifies configuration/persistence/full workspace/package preservation, unsupported module refusal, Preferences lifetime, reload/new-process restart and six theme-width profiles. Native freeze/build/acceptance/retained regressions/audits/cleanup/topic commit pending.

Remaining full scope: complete admission/dependency/assets/links/TLA and legacy duplicate-winner policy, tag argument/collision/registration, actual resource/callback mutation/cancellation ownership, six context adapters/legacy Buffer-stream/PluginData import, ordered Send hooks/action menus/themes, provider/platform/accessibility/CI/shared adoption and every original migration/UX/CSS gate. No scope removed; preparing a module is not activating its contributions.

First production53914 terminal0/784e4bfc/current736source binding passed. After terminal, standalone scenario recorded actual original/seed/persisted/restored workspace and embedded/local worker bytes; a misplaced restore insertion was corrected before execution. Scenario-only source correction retained with app hashes unchanged; compiler37851 0errors0warnings. Native1791640853220/PID60652 failed before worker launch because two Preferences entry buttons matched the strict selector; restored native1791640855290 succeeded. Reused existing saved .first() Preferences selector with separate correction/freeze record. Next native1791640900424 exposed actual DataCloneError: structuredClone cannot clone Svelte's reactive pluginDirectories proxy; restored1791640916803 succeeded. All owned native runs exited0/native-hidden/visible:false; first attempts do not prove registry acceptance.

Corrected registry uses Array.from for the configured directory entries, preserving plain native-command data without proxy cloning. Manifest version agreement now follows native type semantics, including empty strings; the native ready fixture uses an empty version. Card status now reflects actual loading/ready/error. Inline proxy-array/empty-version controls pass (one admission/worker adapter), compiler19698 terminal0/0errors0warnings. Original784e4bfc executable/build/failed freezes retained under native-plugin-registry-first-build; current736source refrozen with changes exactly plugin-registry.js/PluginsPanel.svelte/plugin-registry.js scenario. Corrected production85329 running; compiled application/scenario frozen. Native registry/restart, all retained regressions/audits, cleanup/topic commit remain required. No feature completion or compaction claimed.


</details>

<a id="record-plugin-runtime"></a>

<details>
<summary>PLUGIN-RUNTIME</summary>

# Isolated plugin export inspection

2026-10-10 covered Windows native export-inspection acceptance. Previous goal turn made progress with format427fe3d/checkpoint4d7a9a6 and clean worktree. Scoped Claude discovery found none. Read STATUS/PLAN/PARITY/plugin inventory/archived loader and all eight contribution contracts before extending the existing QuickJS dependency. Primary references: [QuickJS runtime/module loader/memory/interrupt API](https://github.com/justjake/quickjs-emscripten), [CommonJS resolution](https://nodejs.org/api/modules.html#all-together), [package type](https://nodejs.org/api/packages.html#type). No new runtime/dependency/Node process introduced.

Native read_plugin_package supplies a read-only UTF-8 snapshot of .js/.cjs/.mjs/.json sources below a canonical valid plugin root and declared entry. It refuses linked paths/outside canonical paths,2048visited entries,128source files,1MiB per source and8MiB aggregate. .git content is skipped. Existing manifest bounds and entry/scope rules remain. Generated command permission follows the documented existing tauri_build pattern. Asset/native/bare source entries, links, external sibling dependencies and packages exceeding these bounds require continued admission support; errors are explicit, no package bytes are changed.

Preferences Check exports explicitly reads the selected package and creates a disposable separate worker/QuickJS VM. CommonJS relative/bare in-package node_modules resolution, JSON/default CJS imports into ES modules, CommonJS cycle caching and named ES module exports are implemented. VM has128MiB memory/512KiB stack/2s interrupt budget; client bounds completion5s and terminates on result/error/cancel. No filesystem/network/raw invoke/host process APIs are exposed. UI retains only declarative names/labels/counts for eight known contribution arrays; functions remain in the guest and are never invoked by inspection. Closing the component aborts; settings-owner changes reject late UI results. Disabled/duplicate/invalid packages cannot be inspected through this action. Reload clears reports. Check exports does not activate contributions, install packages or modify configuration/store bytes.

Remaining runtime scope includes retained lifecycle/registration, complete argument metadata/collision policy, async initialization/TLA, CommonJS require of ES modules and named CJS exports into ESM, full dependency/asset/linked package admission, durable PluginData and all six contexts, tag/ordered hook/action integration/reload/disable/cancellation and all original migration/UX/CSS gates. No scope is removed or marked fully complete.

Compiler82932/16975/34175 pass0errors0warnings; inline Bun QuickJS6+1 controls verify actual CJS/ESM/relative/default CJS+JSON imports, fs refusal, infinite-loop interruption and no fetch/process. Saved plugin-discovery.js gains INSOMNIUM_PLUGIN_RUNTIME=1 with shared14package fixture: eight contributions, ES imports/dependency label, bare dependency/directory main, cycle/no-host, builtin/throw/missing/invalid tag/infinite/syntax, source-size/link refusal and disabled setting. Real bundled worker observer forwards unchanged operations/messages and records termination/metadata;11actual workers expected (two native admission refusals and one disabled skip). Full workspace values/fixture/external hashes, six theme-width profiles and original restoration asserted. Controlled native picker replies, not OS dialog acceptance.

Production build started1791632679079/finished1791633123735 terminal0, release profile, executable SHA256 `6321d47edca292d2d4e2166a76a53c8110601f1805ef7c6f58965933fbff0e67`. Source binding independently verifies721paths and original551bbbce baseline. Compiler67861 terminal0/0errors0warnings; targeted Rust formatting and diff checks pass. Native runtime artifact `artifacts/playwright/plugin-runtime-1791633138250`/PID64808 accepts14packages/11real terminated workers/eight contribution kinds/34unchanged fixture files/external preservation/absent marker/full workspace restoration and six theme-width profiles. Independent `bun artifacts/plugin-runtime-audit.mjs` passes. All six runtime screenshots were inspected: checked/failed statuses, single error text, human contribution names in two columns and compact buttons remain readable without horizontal overflow at1440/900/760 in both themes.

Retained same-build modes: formats1791633159849/PID72320 accepts31cases/76files; discovery1791633176363/PID71228 accepts13packages/2manifest errors/28files/six profiles; sources1791633195135/PID49716 plus actual restart1791633199267/PID50104 accept seven checkpoints/max14packages/30files/six profiles/exact persisted full workspace values and restoration. All hosts terminal0/native-hidden/visible:false. Independent formats/discovery/linked source-restart audits pass. Formats audit initially received a relative output path; its absolute-entry assertion failed, corrected invocation with an absolute path passes without source changes. Native scenarios themselves passed throughout.

First production96c5b06d and its freeze are retained under artifacts/native-plugin-runtime-first-build and artifacts/playwright/plugin-runtime-first-build-freeze.json. First native runtime1791632369429/formats1791632389298/discovery1791632403980/sources1791632484721/restart1791632488794 passed, but image inspection found duplicated error prefixes, stale status, raw labels and stretched buttons. Only panel/worker/saved runtime fixture changed after those jobs ended. Compiler84094 caught a label-map annotation, corrected before the accepted build. Build/scenario source remained frozen during final native acceptance. Exact owned process-name/PID and WebView profile checks are empty; no live feature handles remain.

Commands use Bun, saved build-recovery-copy-probe.js with workspace LLVM20.1.8 LIBCLANG_PATH/no low-memory override and isolated INSOMNIUM_UI_BUILD_STATE. Select only one plugin mode: INSOMNIUM_PLUGIN_RUNTIME=1, INSOMNIUM_PLUGIN_FORMATS=1, INSOMNIUM_PLUGIN_SOURCES=1 or no flag, followed by `bun tests/ui/plugin-discovery.js`. Binder: `bun artifacts/plugin-runtime-bind.mjs`; audits: plugin-runtime-audit.mjs, plugin-runtime-formats-audit.mjs, plugin-runtime-discovery-audit.mjs, plugin-runtime-sources-audit.mjs (last requires both absolute parent and restart outputs). Never mutate application/scenario while its build/native job is active. This acceptance proves loading and metadata inspection only; every integration/context/install/lifecycle/full migration/UX/CSS gate above remains required.


</details>

<a id="record-plugin-session"></a>

<details>
<summary>PLUGIN-SESSION</summary>

# Retained plugin callback and store bridge

The original JSON-only callback encoding described below is superseded by the covered bounded data graph in [PLUGINS.md#record-plugin-values](PLUGINS.md#record-plugin-values). Public callback args remain arrays; the internal worker wire is a versioned string. Existing six-method store bridge and ownership controls retain same-build native/restart acceptance. Product registry/context/legacy Buffer-stream compatibility remains required.

2026-10-10 covered Windows native acceptance. Prior storeb0e5419/checkpointcc7d1b5 is verified and committed. Scoped Claude discovery found none; STATUS/PLAN/PARITY/legacy callback+store contracts read. Primary reference: [QuickJS promises, pending jobs and handle lifetime](https://github.com/justjake/quickjs-emscripten). Existing release-sync dependency is reused; no Node/Electron/raw native invoke enters the guest.

The package loader is shared by metadata inspection and retained callbacks. Inspection still creates/disposes a VM without invoking contributions. A separate worker session retains module/cache/global state until close/error/cancel/owner invalidation. It serializes at most64queued callbacks, detaches JSON arguments, and dispatches tag run, request/response hooks or one of four action callbacks with context plus positional args. Themes remain metadata only. Callback JSON arguments/results are bounded1MiB, store bridge JSON16MiB; VM remains128MiB/512KiB stack/2s interrupt and each operation5s host deadline. Callback store calls are bounded256total/64pending. A failure closes the session; no reuse of a failed VM.

context.store has all six async legacy methods and String(value) conversion within the guest. The bridge carries only method/string args; host validates exact shape, allowlist, arg count/types, strictly increasing RPC ID and active callback ID. The namespace is bound by the host snapshot, never accepted from the guest. A required isCurrent guard and optional AbortSignal protect initialization, dispatch and response acceptance; a100ms watchdog closes an idle stale owner. Queued operations recheck their owner. These are core guard seams; automatic product admission/disable/reload/workspace/resource ownership integration still needs the registry lifecycle.

Promise handles are disposed on settlement/close, pending QuickJS jobs are pumped in bounded batches, and fire-and-forget store operations are settled before returning a successful callback. Closed/failing runtimes refuse queued store dispatch. Cancellation cannot undo native mutations already dispatched: their durable side effect may complete while the stale callback response is rejected. Tests must prove this boundary rather than claim rollback.

Prepared-stage evidence: inline Bun actual QuickJS controls passed metadata/retained state/native-promise adaptation/undefined return/rejection/fire-and-forget settlement/close during pending call. Additional flood control proved zero host dispatch after VM failure and invalid metadata cleanup. Compiler28204/38590 0errors0warnings;97650 caught19fixture tuple/type annotations, fixed (one atomic patch context mismatch made no mutation). The saved scenario was prepared for the acceptance below; native binding/audit were pending at that checkpoint.

Acceptance uses production release `9e3c459da247f2ec41254d71e4c29c2e4541077e8d69bd209d34b871af2322ba`, frozen732source paths. `bun tests/ui/plugin-session.js` with `INSOMNIUM_UI_BUILD_STATE=artifacts/native-recovery-copy-probe/build-state.json` passes six groups/seven callback kinds/six store methods/13terminated workers plus one after actual app restart. Artifacts: plugin-session-1791637356081/PID72400 and plugin-session-restart-1791637365143/PID71192. Independent plugin-session-audit passes literal values, queue detachment, retained/reset counters, exception/loop/unsettled/flood errors, forged/pre-dispatch0IPC, committed late mutation/rejected callback, active/queued cancellation, embedded/local worker SHA equality,26unchanged package files, full workspace preservation and exact original absent store restoration. Both native-hidden/visible:false/exit0.

Same-build regression acceptance/audits pass: store1791637400385/PID63900 +restart1791637403012/PID70144 (8groups/23refusals/8conversions/32concurrent writes); runtime1791637415230/PID64608 (14packages/11workers/34files/six profiles); formats1791637431756/PID56852 (31cases/76files); discovery1791637450520/PID69000 (13packages/2errors/28files/six profiles); sources1791637465438/PID69736 +restart1791637469913/PID71376 (seven checkpoints/max14packages/30files/six profiles/full values). All native-hidden/visible:false/exit0. Runtime dark/light760 images inspected. Compiler30529 terminal0/0errors0warnings; saved headless workspace12 and diff checks pass. Exact owned PID/name/WebView profile inspection is empty in plugin-session-cleanup.json; no feature handles remain live.

Retained first failure plugin-session-1791637090362/PID44056 exited0/native-hidden: injected IIFE contained unused import.meta.url before callback execution. Standalone fixture now uses documented [Bun define](https://bun.sh/docs/bundler#define) to replace that URL base; injected factory still constructs the genuine production worker. Compiled application hashes remained unchanged and scenario correction/previous freeze are retained. An ignored audit helper initially passed ArrayBuffer to createHash; corrected to Uint8Array. Its first failure did not stop the PowerShell sequence, so the correction record was written after the native run; all final source/build hashes were checked against the accepted artifacts. Audit invocation mistakes (relative path for formats, slash form for sources, PowerShell brace expansion) were corrected to exact absolute Windows paths without modifying assertions.

Remaining scope: full callback argument/value encoding beyond the current JSON-only contract, product registration/activation/tag argument and collision policies, full admission/dependency/asset/link/TLA initialization, all app/data/network/request/response adapters, legacy PluginData import, hook/action Send/menu integration and themes; actual product disable/reload/resource ownership/cancellation/fault/provider/platform/accessibility/CI/shared adoption/full migration/UX/CSS. This core session milestone does not complete custom plugin parity or remove any gate.


</details>

<a id="record-plugin-store"></a>

<details>
<summary>PLUGIN-STORE</summary>

# Local PluginData store

2026-10-10 durable host store covered Windows native acceptance. Read the archived context/store.ts and models/plugin-data.ts: hasItem/getItem/setItem/removeItem/clear/all, plugin-name isolation, String(value), null for missing values and canSync=false. Existing native storage uses atomic-write-file and Tauri managed mutex state. Primary references consulted before extending them: [Tauri state management](https://v2.tauri.app/develop/state-management/), [AtomicWriteFile commit](https://docs.rs/atomic-write-file/latest/atomic_write_file/struct.AtomicWriteFile.html).

Prepared fixture corrections and retained failures: first productiondfffa71f built successfully/current727source. First native1791634306391/PID72388 failed before writing because inline DOM bundle injection violated unchanged CSP. Saved helper now evaluates the actual bundled adapter with [Playwright page.evaluate string-expression API](https://playwright.dev/docs/api/class-page#page-evaluate), preserving production CSP/native invoke. The standalone scenario also refuses linked/non-file existing probe stores before preparing fault controls. These scenario-only corrections happened after the first build ended, with unchanged compiled app hashes and retained freezes. Second native1791634358228/PID71112 exposed a genuine malformed-command bug: Serde ignored extra fields for unit Clear despite deny_unknown_fields; fixed Clear/All as empty struct variants to invoke field checking. References: [Serde container attributes](https://serde.rs/container-attrs.html), [enum representations](https://serde.rs/enum-representations.html). Both failed hosts exit0/native-hidden/visible:false and restored the original missing store. Compiler35916 failed13fixture annotations/release-method errors, fixed;27389 final0errors0warnings. The corrected production and complete saved acceptance are recorded below.

The native plugin_store command uses its own managed mutex and app-data plugin-data-v1.json. It re-reads validated schemaVersion1 string maps under the mutex and commits through the existing atomic_write helper. Workspace resources/settings/history, Git journals and export serializers never contain this store. Independent local store writes do not depend on a workspace Git transition. Missing remove/clear and unchanged set are no-ops; mutations remove empty namespaces. Every plugin's keys are literal strings, including empty and __proto__; all returns key/value records in stable key order. Legacy all ordering is not specified by the context contract.

Bounds are explicit: valid package name,256plugin namespaces,4096items per plugin,8192UTF-8 bytes per key,1MiB per value,8MiB complete serialized file. Bounded reads refuse malformed/future/unknown-field schema, non-string persisted values, links/folders and oversized files without repair/overwrite. Atomic replacement failures leave the original file visible and no cache is advanced. These bounds require further admission support for larger existing stores; they do not silently truncate data. Concurrent operations are serialized in the single-instance application. Other-process external writers, filesystem link-swap races, OS power-loss and platform fault variants remain unverified.

createPluginStore binds the host facade to one plugin name, keeps native invoke inside the host, uses String(value) as in legacy and returns the six async methods. Pre-aborted execution refuses before native dispatch. Cancellation cannot revoke a native mutation already dispatched; future runtime ownership/bridge policy must account for this. This feature provides the durable host adapter; guest context.store binding, retained plugin execution/lifecycle, legacy PluginData migration/import, disabled/admission/duplicate ownership policies and the other five contexts/contribution activation remain required. No scope is removed or called fully complete.

Saved `bun tests/ui/plugin-store.js` uses the actual adapter bundled by Bun and unchanged native invoke in two owned native-hidden processes. It accepts missing/CRUD/String(value)/Unicode/empty/prototype-key/isolation controls,32concurrent distinct writes, exact UTF-8 boundaries, pre-dispatch cancellation, malformed operation and byte-preserving native refusals. Faults cover damaged/future/unknown/non-string/invalid-plugin/oversized files, plugin/item/aggregate bounds, directory refusal and real Windows replacement lock/retry. The exact isolated probe store is restored after both processes exit; workspace values remain unchanged.

Accepted corrected production22713: started1791634480800/finished1791634939292/terminal0/release profile, executable SHA256 `ce666983a441fcd4eae447188511e0aae115ed95048457730ed610c0bbbdc147`,727frozen source paths and preserved6321d47e baseline. Compiler27389 terminal0/0errors0warnings/targeted Rust/diff pass. Store artifact1791634945779/native71020 plus actual restart1791634948065/native72336 accept8groups/23explicit refusals/eight literal value conversions/32concurrent writes/two retained namespaces. All native-hidden/visible:false/exit0. Independent audit compares literal conversions/known refusals/final retained records/different-process restart/exact original store absence and every source/executable/baseline hash. Store persistence is in the dedicated file; full workspace values are independently compared before/after and on restart.

Retained same-build native runtime1791634964492/PID70772 accepts14packages/11workers/eight metadata kinds/34files/six profiles; formats1791634981135/PID70120 accepts31cases/76files; discovery1791634995560/PID32640 accepts13packages/2errors/28files/six profiles; source1791635018527/PID51152 plus restart1791635022683/PID68616 accept seven checkpoints/max14packages/30files/six profiles/exact workspace preservation. All terminal0/native-hidden/visible:false; independent source/build/fixture/layout/linked restart audits pass. Current dark/light760 runtime images inspected; no UI/CSS source changed in this store feature. Exact expected PID/name/profile cleanup is empty, artifacts/plugin-store-cleanup.json; all feature sessions terminal/no live handles.

Commands: workspace LIBCLANG_PATH=E:/.dvgamerr-app/insomnium-app/artifacts/tools/llvm-20.1.8/bin, no INSOMNIUM_UI_LOW_MEMORY override, `bun tests/ui/build-recovery-copy-probe.js`; binder `bun artifacts/plugin-store-bind.mjs`. Set INSOMNIUM_UI_BUILD_STATE=artifacts/native-recovery-copy-probe/build-state.json, run `bun tests/ui/plugin-store.js`. Audit `bun artifacts/plugin-store-audit.mjs <absolute-store-output> <absolute-restart-output>`. Retained plugin modes use saved plugin-discovery.js with one runtime/formats/sources flag or no flag and matching plugin-store-runtime/formats/discovery/sources-audit.mjs scripts. Freeze artifacts/playwright/plugin-store-source-freeze.json; first build and failure freezes retained under native-plugin-store-first-build and playwright/plugin-store-*-freeze.json. No raw guest invoke or plugin activation is introduced; all remaining gates above stay required.


</details>

<a id="record-plugin-tag-metadata"></a>

<details>
<summary>PLUGIN-TAG-METADATA</summary>

# Custom template tag definitions

Verified corrected production36040 terminal0, executable SHA256 `e10918eb4e97c7c5bd64e40127aa4870ae5f4dfb5c7f5d2258947e264c3c6d5b`, current739 frozen source paths. Saved native metadata1791644213336/PID6832 and independent audit accept all eight argument types, literal complete initial/resolved metadata and optional fields, dynamic retained callbacks, typed empty/false/0 defaults, signed-negative and positive zero defaults/options/priority,18refusals including real infinite-function interruption,20terminated genuine workers,40unchanged package files,0store IPC and full original/persisted workspace equality. Initial inspection invokes no metadata/run/action callbacks; explicitly requested metadata queries do not invoke tag run/actions through the dispatcher or host store. Counters show26metadata callbacks from three explicit queries and four independently requested run controls,0actions. Detached host definition mutation cannot alter guest definitions; stale-owner query refuses. Primary acceptance values are encoded in valueWire so JSON artifact storage preserves signed zero.

Saved command: set PowerShell `$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'`, then `bun tests/ui/plugin-tag-metadata.js`. Fresh production uses `bun tests/ui/build-recovery-copy-probe.js` with `LIBCLANG_PATH` resolving `artifacts/tools/llvm-20.1.8/bin`. Compiler `bun run check`, current saved headless `bun tests/ui/nocturne-workspace.js` (12checks). Focused ignored `plugin-tag-metadata-audit.mjs` verifies complete literal decoded primary values, signed-zero signs, current source/build/baseline/embedded-worker bytes, refusal IDs/errors, counters and package/workspace preservation. Retained audits use the same current freeze and executable:

| Scenario | Main / actual restart artifact suffix | Acceptance |
| --- | --- | --- |
| registry | 1791644234159 / 1791644238638 | 4groups,6workers,8files,6profiles,full persistence/restoration |
| values | 1791644245559 | 48checks,12roundtrips,12input/5result refusals,6workers,0store IPC |
| session | 1791644252192 / 1791644261149 | 6groups,14workers,7kinds,6methods,26files |
| store | 1791644267568 / 1791644269561 | 8groups,23refusals,8conversions,32concurrent writes,exact original store restoration |
| runtime | 1791644290792 | 14packages,11workers,8contribution metadata kinds,34files,6profiles |
| formats | 1791644301735 | 31cases,76files |
| discovery | 1791644308350 | 13packages,2manifest errors,28files,6profiles |
| sources | 1791644316087 / 1791644320408 | 7checkpoints,max14packages,30files,6profiles,full persistence/restoration |

Every retained independent audit passes. All native-hidden/visible:false/exit0. Compiler91918 0errors0warnings/headless12/diff pass. Current registry760dark/light captures inspected; application UI/CSS unchanged. Exact first/current feature PID names and owned WebView profiles absent (`artifacts/playwright/plugin-tag-metadata-cleanup.json`); all handles terminal. First8d56a6db source/build/executable is preserved with its confirmed initial signed-zero defect and no native acceptance claim. The historical pending/build notes below document the progression; final acceptance is the corrected e10918eb candidate only. Custom tag registration/editor/context/Send/menu integration and every full migration/UX/UI/CSS requirement remain outstanding.

Live handoff: corrected36040 started1791643766993/nativeStarted1791643772978; exact launcher68096/Bun71380/cargo46940/53532/rustc12924 confirmed live, handle polled without restart. Current corrected headless workspace12/diff/compiler91918 0/0 pass. Frozen739 app/scenario paths unchanged; no native acceptance/commit yet. Poll existing handle/current descendants to terminal, bind, run saved focused metadata and retained registry/value/session/store/runtime/formats/discovery/source+restart audits, then cleanup/topic commit/handoff. The full goal remains active.

Current corrected production36040 is running with739 paths refrozen. First86166 terminal0/8d56a6db/source binding is preserved under native-plugin-tag-metadata-before-zero, with no native acceptance claim. Actual QuickJS reproduction confirmed signed-zero loss in default/option/priority; initial metadata now uses the existing bounded value codec instead of JSON.stringify/parse. The256KiB serialized metadata cap includes the codec envelope and its graph/string bounds. Corrected literal descriptor/dynamic query/18refusals/0store controls pass with both -0 and positive0. Saved native scenario explicitly compares them and stores primary values as a codec wire string so artifact JSON does not lose their signs, and records full original/persisted workspace. Compiler58098 two scenario typing diagnostics corrected; final91918 0errors0warnings. Current native/retained regressions/audits/cleanup/commit remain pending; keep sources frozen until terminal.

Historical review before correction identified a wire defect: inspectPluginVm used JSON serialization for initial metadata, so finite signed zero was lost there despite the factory and later query value codec preserving it. Build86166 was then live/frozen, so correction waited until terminal and preserved that candidate/freeze. The original inline controls did not prove signed-zero initial transport. The corrected native build still requires acceptance before committing.

Final compiler8104 terminal0/0errors0warnings, current headless workspace12 and diff checks pass. Source freeze739paths preserves accepted8c3c04f6 build/executable. Production86166 started1791643105879/nativeStarted1791643113018; owned launcher72432/Bun45548/cargo69264/49800/rustc48220 confirmed live. Keep application/scenario frozen. Focused audit prepared for literal complete definitions/resolved metadata/counters,20terminated genuine workers/18refusals/40unchanged files/0store IPC/current source/build/worker-byte binding; actual native acceptance and retained regressions remain pending. Poll the current handle to terminal; never restart solely because observation expires.

2026-10-10 prepared; production/native acceptance pending. Previous registry topic `1e0e084` and handoff `409c6dc` are accepted, clean, with no live handles. Scoped Claude discovery found none; STATUS/PLAN/PARITY and archived `templating/extensions/index.ts`, `templating/utils.ts`, `base-extension.ts`, `templating/index.ts`, and `ui/components/templating/tag-editor.tsx` were read. Consulted official [QuickJS runtime/interrupt documentation](https://bellard.org/quickjs/quickjs.html#Execution-timeout-and-interrupts) and [Nunjucks custom extensions](https://mozilla.github.io/nunjucks/api.html#custom-tags) before changing the existing VM boundary.

`plugin-tag-metadata.js` is a self-contained factory also embedded inside QuickJS. Initial inspection preserves tag description, priority including0, deprecated includingfalse, static label/displayName, declared argument types (`string`, `number`, `boolean`, `variable`, `expression`, `enum`, `file`, `model`), values/defaults includingempty/0/false, variable/encoding/quote hints, descriptions/placeholders, model type, file/directory filters and extensions, typed enum options and action name/icon/index. Optional fields remain optional. Dynamic tag displayName/liveDisplayName/disablePreview/validate, argument displayName/help/hide/validate and option displayName are listed as callback names rather than dropped or transferred as functions. Initial inspection never invokes these callbacks, run or actions. Own accessors on recognized fields and sparse definitions refuse rather than invoking getters or silently losing metadata; inherited/proxy definitions remain compatibility gates.

The retained session accepts explicit `invoke('templateTagMetadata', tagIndex, [parsedArguments, validationValues?, tagValue?])`. Parsed arguments match the legacy tokenizer data (`type` plus primitive `value`); optional validationValues are already decoded strings corresponding to all declared arguments. The optional third value requests tag-level validation. Resolution calls dynamic metadata functions within the same bounded guest and returns data-only results; synchronous typed string/boolean/null validation contracts are enforced, and promise-returning metadata refuses because legacy editor metadata is synchronous. The dispatcher invokes no tag run/action callback. Metadata callbacks may mutate their own module state, as ordinary guest functions; the host store bridge is disabled for this operation, so they receive no native store capability. The existing current-owner guard, detached value codec, serialized64-entry queue, watchdog and VM time/memory/stack bounds still apply. Failure closes the affected session.

Definition limits:32arguments,256enum options per argument,64actions,64file filters/extensions,8192characters per metadata string (256name,1024action name/entry labels), finite numeric values/priority, total initial256KiB-character metadata budget plus existing VM memory/interrupt limits. Query results use the existing bounded value codec. These are explicit admission/transport limits, not a claim that every legacy package shape is supported.

Inline factory controls pass eight types/dynamic values/empty-0-false defaults/accessor refusal. Actual QuickJS controls pass complete literal initial definition, no initial callback execution, typed dynamic values/validation, ten explicitly requested callbacks and18refusals with0store calls, including a real interrupted infinite metadata callback. Saved `tests/ui/plugin-tag-metadata.js` uses actual native read-only source snapshots and genuine production worker/client, unchanged packages/full workspace, literal full definition/resolved expectations, retained callback counters, no run/actions triggered by metadata evaluation, detached host definition mutation, stale-owner refusal and18failure controls. Compiler85417 found6scenario typing errors, corrected;93771 0errors0warnings, final8104 pending. Existing runtime invalid-tag error wording retained after reviewing its saved regression. Source freeze/fresh production/native/retained registry+restart/value/session/store/runtime/formats/discovery/sources+restart audits/cleanup/topic commit remain required.

Remaining full scope: this descriptor/guest query seam does not register custom tags with Nunjucks or add a tag editor. Product tag collision/priority policy, editor discovery/default-fill/validation/action UI, resource/callback contexts and cancellation ownership before Send/menu dispatch, six context adapters/legacy Buffer-stream/PluginData import/ordered hooks/actions/themes, complete dependency-assets-links-TLA admission/duplicate-winner compatibility, provider/platform/accessibility/CI/shared adoption and every original migration/UX/UI/CSS gate remain required. No scope removed, no compaction or full migration completion claimed.


</details>

<a id="record-plugin-template-render"></a>

<details>
<summary>PLUGIN-TEMPLATE-RENDER</summary>

# Custom plugin tags in request rendering

Verified 2026-10-10 on operation ownership topic `82f02bc1716e734120f728e7f46e64b23fb7e8ef`, checkpoint `7f47464`. Corrected production40648 finished successfully; executable SHA256 `040ad2f9bb98d17cfdba2c81dd618e67bee95ace0384348a075c610a011cf198` is bound to the frozen744 application/scenario paths. Topic commit is recorded in STATUS.md.

Argument correction: first87168 is terminal0/finished1791648080627 and bound744source/executable70b5c6af, preserved under native-plugin-template-before-args with the original freeze, without native acceptance. Actual QuickJS demonstrated custom argument JSON loss (-0→0, NaN/Infinity→null; undefined retained). The custom-only path now uses the existing bounded value codec through VM→worker→host; built-in/native argument envelopes remain unchanged. Four literal native argument controls plus exact held-hook counts and observed forbidden-key absence pass on corrected production. Refreeze744 records exactly runtime/client/worker/scenario pre/post hashes. Corrected production40648 finished1791648901804/exit0. Final compiler55287 has0errors0warnings;20 independent catalog/registry/render/source/limit/argument controls pass.

Only explicitly loaded plugin sessions enter a captured catalog. Discovery order controls collisions regardless of Load order or priority; the last definition wins within a package. All11 legacy local built-ins retain precedence. Effective priority follows legacy `priority || declarationIndex || -1` presentation behavior. The catalog exposes detached definitions and guarded invocation closures, never sessions/controllers. A catalog change invalidates captured operations. Closed retained guests become visible registry errors and require explicit Load; canceling a queued operation does not mark an unrelated live session failed.

The application installs a provider through a lightweight shared module, avoiding a workspace/renderer import cycle. Each request render session captures the catalog and its exact request, collection and inherited environment source key, normalizing empty/no selected environment equivalently. History, OAuth-token and unrelated-request changes do not invalidate it. Request/environment edits, root/path/config changes, disable/unload/reload and cancellation refuse stale callback dispatch, results and later store calls. Native writes already dispatched cannot be undone. Helper context preserves root variables and `_`, with request/workspace meta and send/general purpose. Application/network/models/nested render helper capabilities remain required.

Nunjucks extensions use generated internal compiler keys, because its compiler embeds extension keys without escaping. Public plugin names remain bounded data, preserving Unicode, dollar signs, prototype-like names and quote/backslash symbols. Nunjucks still decides which public names can parse; an unparseable declared name does not block unrelated tags. Custom callback results use the same non-null String coercion as a non-autoescaped CallExtensionAsync output before the JSON worker bridge, preserving bigint/nonfinite/collections/typed-array output. All existing renderer execution, memory, interaction and call limits remain. The catalog permits53 custom names plus11 built-ins within64 registrations.

Saved scenario: `bun tests/ui/plugin-template-tags.js` with successful shared production probe build state. It uses the real application Load/Unload/Enable/Disable, body/URL editors, Send/Cancel, genuine bundled plugin/template workers, loopback raw wire, successful native store replies held by the shared helper, unchanged package sources and exact original workspace/store restoration. Prepared controls cover discovery/internal collisions, built-in collisions, nine public symbol names, inherited environment and metadata, thirteen output representations, store persistence, unloaded/disabled refusals, held reply Cancel/request edit/unload/disable and guest-error Load recovery. Native browser mode is `native-hidden`; saved browser scenarios remain fixed headless.

Acceptance: suite53960 finished1791649030029/exit0. Focused native `plugin-template-tags-1791648918063`/PID61160 passes12checks/7real HTTP requests/9terminated genuine workers/9public names/13output representations/4argument values/4held boundaries/4unchanged package files. Every held Cancel/request-edit/unload/disable branch observes exactly1call/1hook and no forbidden store write. Independent source/build/worker/literal audit passes. The same production passes retained operations20checks/14refusals, metadata8types/18refusals/20workers, registry4groups with restart/six layouts, values48checks, session6groups with restart, store8groups with restart, runtime14packages, formats31cases, discovery13packages and sources7checkpoints with restart. Exact paths, PIDs and audit evidence: `artifacts/playwright/plugin-template-suite-state.json`.

Existing HTTP template Send regression10960 finished1791649087058/exit0: `template-response-send-1791649064215`/PID69456 passes19groups/20real HTTP requests/1held dependency/43workers with independent source/build/literal/history/cancellation audit. Its wrapper snapshots and restores the full original workspace through native IPC. Focused and retained runs report native-hidden/visible:false/exit0. Post-exit disk equality and original store restoration pass (`plugin-template-post-exit-restoration.json`). Exact owned build/suite/native processes and18WebView profiles are absent (`plugin-template-cleanup.json`); no live feature handles remain.

Commands: `bun run check` (final55287 0errors0warnings), actual QuickJS nine public name checks, `bun artifacts/plugin-template-controls.mjs` (20controls), `bun artifacts/plugin-template-regressions.mjs`, `bun artifacts/plugin-template-http-regression.mjs`, and `bun tests/ui/nocturne-workspace.js` (12checks, including the final headless rerun). Current dark/light760px Plugins screenshots inspected: ready text/buttons fit, layout/CSS preserved. Frozen744 source hashes and `git diff --check` pass. Earlier compiler70000 exposed optional-handler typing and87610 an implicit callback type; both corrected. The inline stale-catalog assertion initially passed a synchronously throwing handler directly to assert.rejects; it now wraps the handler in an async function. No application defect was hidden by that harness correction.

Consulted [official Nunjucks custom extensions](https://mozilla.github.io/nunjucks/api.html#custom-tags) before implementation, plus bundled `src/compiler.js`, `src/lexer.js`, `src/runtime.js` and archived `templating/index.ts`, `base-extension.ts`, `ui/components/templating/local-template-tags.ts` and `common/render.ts`. Every remaining custom tag picker/argument editor/default-fill/dynamic metadata validation/actions, helper capabilities, ordered Send hooks/actions/theme/admission/legacy data, duplicate package winner, other protocol/provider/platform/accessibility and original migration/UX/UI/CSS gate remains required. The full redesign follows migration; current layout/CSS are preserved.


</details>

<a id="record-plugin-values"></a>

<details>
<summary>PLUGIN-VALUES</summary>

# Plugin callback value transport

2026-10-10 covered Windows native acceptance. Previous session5168bdd/checkpoint7f3da9c is accepted. STATUS/PLAN/PARITY/legacy base-extension callback and response Buffer contracts read; matching Claude instruction discovery found none. Official references: [structured clone types and cycles](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm), [QuickJS language/runtime](https://bellard.org/quickjs/quickjs.html). This data codec is an explicit VM bridge, not a claim of full browser structured-clone or Node Buffer/stream compatibility.

Corrected production36258 terminal0/`3a34fbbf9012e80bba83ce3267031396b4a21b97ec70f7a9b616b5880a807b81`/current734source binding passes with preserved first65d1bb16 and original9e3c459d. Native plugin-values1791639290928/PID38376 accepts48checks/12round trips/12input refusals/5guest-result refusals/six terminated genuine workers/0store IPC. Exact UTF-8 wire boundary, malformed-envelope guards, literal supported types/reference identity/detached bytes/queue arguments/undefined versus sparse/null/prototype keys/large numeric named array property, unchanged package bytes/full workspace and embedded/local worker SHA audit pass. Unsupported host arguments invoke no getter/toJSON/guest callback and leave the session usable; unsupported guest results close their worker. All native-hidden/visible:false/exit0.

Same corrected build retains session1791639305033/PID66812 +restart1791639313812/PID64072 (6groups/14workers/7callback kinds/6store methods/26files), store1791639321689/PID69252 +restart1791639323481/PID69188 (8groups/23refusals/8conversions/32concurrent writes/exact original absent-store restoration), runtime1791639340214/PID62400 (14packages/11workers/34files/six profiles), formats1791639359930/PID69836 (31cases/76files), discovery1791639373084/PID55344 (13packages/2errors/28files/six profiles), sources1791639388203/PID71532 +restart1791639392210/PID7464 (seven checkpoints/max14packages/30files/six profiles/full values). Independent audits pass; all native-hidden/visible:false/exit0. Current runtime dark/light760 images inspected. Compiler55176 0errors0warnings, current headless workspace12 and diff checks pass; exact first/current host/build PID-name/profile inspection empty, plugin-values-cleanup.json. No live feature handles remain.

The old callback JSON bridge replaced undefined array values with null, discarded undefined object fields and changed nonfinite numbers/-0, dates and typed arrays. The shared self-contained codec now carries a versioned data graph as a bounded string, embedded verbatim into the guest and decoded by the host. It preserves primitive undefined/null/boolean/string/number/NaN/infinities/-0/bigint, sparse arrays/enumerable own data properties, plain/null-prototype objects, cycles/shared references, Date including invalid dates, Map/Set identity, ArrayBuffer and standard typed/DataView offsets/shared backing buffers, and RegExp source/flags/lastIndex. UTF-8 wire limit1MiB, visited values10000/depth64 and aggregate array slots10000; aggregate string payload budget refuses before unbounded final serialization. Binary hex counts within the same wire limit. Host args encode synchronously before queueing, preserving detachment; only the internal string travels between client/worker/VM.

Enumerable accessors, symbol values/keys, functions, custom prototypes, WeakMap/WeakSet, Node Buffer/streams, SharedArrayBuffer, DOM/browser-only objects and unsupported typed constructors are refused explicitly. Data properties are recreated with defineProperty to preserve literal __proto__ safely. The codec does not execute enumerable getters or toJSON; intrinsic built-in getters read byte views and regexp fields. Proxy traps are not detectable by this JavaScript codec; automatic product caller ownership/admission remains required. Own property descriptor flags/nonenumerable fields/arbitrary class behavior are not transferred. No global Node/Electron/native capabilities are added, and store's existing String(value)/six-method bridge is unchanged.

Actual inline Bun QuickJS round trip passes cycle/shared Map/bytes/bigint/invalid Date/-0/own undefined, sparse holes and11unsupported/malformed controls. Initial compiler40547 found two typing diagnostics, fixed with never-return annotation and intrinsic view getter access; compiler13617 found three scenario annotation/command-signature diagnostics, fixed. Compiler1004 and3099 pass0errors0warnings; final16897 pending. Saved plugin-values.js constructs literal typed values inside the page before calling the real client to avoid Playwright's own serialization. It uses genuine production worker/native package snapshot, zero store IPC,12round trips/10input refusals/5unsupported guest result failures/six terminated workers; wire schema/UTF-8 exact boundary controls, package bytes/full workspace/embedded worker evidence. Production freeze/build/native/regressions/audits/cleanup/topic commit pending.

Final compiler16897 terminal0/0errors0warnings. Current734source frozen in artifacts/playwright/plugin-values-source-freeze.json, previous9e3c459d executable/build retained under native-plugin-values-baseline. Saved production command: workspace LIBCLANG_PATH=artifacts/tools/llvm-20.1.8/bin, no low-memory override, `bun tests/ui/build-recovery-copy-probe.js`. Build56199 currently running; application/scenario frozen until terminal. Binder/audits prepared; native runs must use the explicit recovery-copy build state and genuine embedded worker bytes.

Remaining gates: product admission/registry/tag argument/collision/disable/reload/resource ownership, app/data/network/request/response adapters and complete legacy Buffer/stream compatibility, legacy PluginData import, ordered Send hooks/action menus/themes, dependencies/assets/links/TLA/provider/platform/accessibility/CI/shared adoption and every original full migration/UX/CSS requirement. This bridge closes covered data encoding defects without completing plugin parity or removing scope.

First candidate56199 terminal0/production65d1bb164be6b8821030b4e97e4fe6cc0d0c2e77837079b967f08cf660fed686 passed independent frozen734source/build binding. Native values1791638654846/PID48824 passed45checks/12round trips/10input refusals/5guest-result refusals/6terminated real workers/0store IPC/two unchanged files/full workspace. Session1791638668434/PID67724 +restart1791638677252/PID53764 passed six groups/14workers/seven kinds/six methods; store1791638685518/PID54600 +restart1791638687399/PID36620 passed8groups/23refusals/8conversions/32concurrent writes. Runtime1791638712008/PID32264, formats1791638731681/PID68304, discovery1791638744300/PID70152, sources1791638759327/PID60544 +restart1791638763804/PID61056 passed retained independent audits. All native-hidden/visible:false/exit0; actual runtime dark/light760 images inspected.

Final review found Array subclasses were accepted as ordinary arrays and DataView numeric own extensions could be omitted; both are now explicitly refused. Large numeric array property4294967295 is a named property rather than an array index and must survive decoding. Saved controls add both refusals and the named-property assertion (48checks/12input refusals expected). Inline controls pass; corrected compiler55176 terminal0/0errors0warnings. One atomic patch mismatch made no mutation. First executable/build/freeze retained under native-plugin-values-first-build and plugin-values-first-build-source-freeze.json. Refreeze changes exactly plugin-values.js plus two saved scenario files; current734source is frozen again. Corrected production36258 running; all current native acceptance/regressions/audits/cleanup/topic commit remain required. First-candidate results do not prove the corrected application.


</details>

Response body streams use pinned `readable-stream@4.7.0` (upstream bundled README and `lib/ours/browser.js`), with its standard Readable.from binary API. Scheduling uses guest Promise jobs under the existing QuickJS budgets, with no host process/timers. This supplies body-stream events and async iteration; it does not admit Node builtin modules or prove all Node stream scheduling/provider behavior.

Bounded Native Send acceptance (2026-10-16): maintained `plugin-template-tags.js` with `INSOMNIUM_PLUGIN_HOOKS=1` passes ordered request mutations on one actual HTTP request, two response hooks including stream reads/shared environment/body replacement, durable history/source isolation, and a second Send refused before transport. Receipt: `artifacts/playwright/plugin-template-tags-1792168737233/hook-acceptance.json`; host result is native-hidden/exit0. Native hook cancellation and DOM dialogs remain separate open gates.

Native hook cancellation is now bounded by `plugin-template-tags-1792168889193`: root Stop during request-hook Prompt emits no HTTP; root Stop during response-hook Prompt publishes no successful result; both recover with a fresh Send in the admitted catalog. Four actual HTTP requests across the retained success/cancel/recovery/refusal branch; native-hidden host exits0. DOM dialogs and large payloads remain open.

Hook callback transport now selects an explicit 8 MiB wire profile end to end (host admission/recovery, guest arguments/results, host result decode). Template tags, store/helper RPC and retained DOM events keep the standard 1 MiB profile; graph/depth/VM CPU/memory bounds remain. Response bodies travel as ArrayBuffer to avoid enumerating every typed-array index. Hex conversion uses bounded chunks and linear validation. Actual QuickJS accepts a768KiB exact binary body whose wire representation exceeds1MiB; standard codec still refuses it. This does not prove all payloads below8MiB, remove the remaining larger-payload requirement or provide native acceptance of this later source change.

Hook CPU accounting now aligns the VM interrupt deadline with the existing5second hook callback watchdog; initialization and non-hook callbacks retain2seconds. ASCII wire size counting avoids guest per-character loops and hex decode avoids per-byte substring allocation, preserving UTF-8 byte limits. Actual QuickJS2MiB binary body round trip passes in~2.2s; native coverage of these later changes and larger-body/chunking compatibility remain open.

`context.data.export.insomnia(options)` now returns JSON/YAML v4 text through the existing guarded helper bridge, without a Save dialog. It resolves an optional workspace by saved ID, defaults to excluding private resources, follows request ancestry plus legacy auxiliary model types, resets workspace parentId, and omits response history/unsupported model types. `includePrivate:true` opts in. Empty workspaces follow legacy request-driven export selection. Raw import now uses the shared application parser/commit/persistence path for explicit Send/actions; preview sessions do not receive mutation capability. URI import, HAR export, larger transfers and native acceptance remain open.

`context.data.export.har(options)` now routes through saved workspace/private selection, request rendering/hooks and wire preparation, then emits HAR1.2 with same-environment saved response history, cookies, duplicate query rows, form/multipart data and timings. Private selected environments fall back to base unless includePrivate is true. It never transmits the exported root request. Native signer/challenge auth exports (digest/OAuth1/AWS/Hawk/ASAP/NTLM/netrc) currently refuse explicitly; native/UI acceptance, reentrant plugin render compatibility, binary/large-body and broader cookie/provider cases remain required. URI import remains open.

`context.data.import.uri(uri)` now resolves HTTP(S), GitHub blob-to-raw URLs, decoded file URI paths and percent-encoded raw content, then reuses raw import validation/commit/persistence. HTTP uses a temporary GET through shared transport without cookies/history or request hooks; cancellation calls native cancel and content is rechecked before commit. File reads use existing Tauri FS permissions and ordinary-file/64MiB limits; no new filesystem scope is granted. Preview mutation remains unavailable. Actual Bun HTTP/QuickJS import-export and held-response cancellation pass; native HTTP/file permissions, redirects/TLS/provider/platform and larger imports remain open.

Headless action-component acceptance: `INSOMNIUM_PLUGIN_ACTION_UI=1 bun tests/ui/plugin-app-dialogs.js` uses a fixture registry with real admission/session dispatch and the production worker. Request/folder/collection/document actions show owned alerts, preserve arguments and honor document hideAfterClick. Guest quarantine now leaves error feedback visible even when the action catalog empties. Receipt: `artifacts/playwright/plugin-resource-actions/action-ui-acceptance.json`; screenshot inspected. Native app IPC is replaced only in the fixture; full-page placement/native persistence/file adapters remain unverified.

Combined native acceptance (2026-10-17): `INSOMNIUM_PLUGIN_ACTIONS=1` on admitted `plugin-actions-data-20261017-attempt-1` passes real ResourceManager request/folder/collection actions and API Design document action/alerts, scoped/private JSON export, HAR latest-history selection, raw/HTTP/app-data-file URI imports, durable count3, unchanged active collection and detached request argument. Exactly two HTTP requests (baseline Send plus URI GET); HAR adds none. Receipt: `artifacts/playwright/plugin-template-tags-1792173897080/actions-acceptance.json`; native-hidden host75456 exits0, owned URI fixture absent, existing finally restores original loaded workspace and plugin store. This does not close larger payloads, native signing, external-file grants, cancellation/reload/retained DOM or broader protocol/provider/platform parity.
