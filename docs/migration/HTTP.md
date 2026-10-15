# HTTP migration

Updated 2026-10-15. Native transport, cookie management, multipart, proxy/TLS settings and streams have scoped implementations/receipts. Windows manual body/send/cancel/history has bounded acceptance below; complete legacy-cookie/proxy/platform/stream compatibility stays required.

See [current status](STATUS.md), [execution plan](PLAN.md) and [complete parity requirements](PARITY.md). No original scope was removed by consolidation.

## Current manual HTTP workflow

Verified source:7a0e9e3. Ordinary HTTP now persists actual transport errors/Cancel, rejects a late successful native reply after abort, retains history per request/optional environment, and persists nonlatest selection in a separately validated responseSelections map. Public environment filtering updates both history and displayed selection. Preflight refusals remain history-free; deleted requests cannot resurrect; streams/introspection remain unchanged. Global40MiB serialized safety admission remains. Configured maxHistory1..100 corrects legacy's incidental preinsertN-plus-new-row count; bucket counts precede global budget admission.

Legacy evidence: main/network/curl.ts:273–284; models/response.ts:181–193; ui/routes/request.tsx:81/414; response-history-dropdown.tsx:57; settings/general.tsx:191. References consulted: [AbortSignal.throwIfAborted](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted), [Playwright input actions](https://playwright.dev/docs/input), [Bun HTTP server](https://bun.sh/docs/runtime/http/server), [HTTP response close events](https://nodejs.org/api/http.html#event-close_2). Fixtures execute with Bun only; shared browser launch remains headless, native host hidden before CDP.

Compiler24524 passes0 errors/0 warnings. Controlled receipt plugin-dom-render-owner-http-workflow-1792000002 retains original20/stream2 plus HTTP6 (late IPC after Cancel, durable failure hydration, no-send preflight, deleted-owner resolve/reject and save failure after success);42 workers retire. Earlier0001 passed before selection extension (41 workers); failed0000 retains the plain-JS Svelte rune mistake, corrected with JSON state projection. Initial compiler26123 annotation errors were corrected;16913/66992 also passed within their earlier scope.

Normal-hook build91016 at artifacts/native-resource-crud-audit-probe/http-workflow-attempt-2 exits0/Rust6m55 with full source/package/private-input closure. Executable SHA4e83e47347f716c8b8b2297e654e0ab90bd17c9ed2f844d034e7b8852b0c03bc. Native67507 at artifacts/playwright/response-history-native-1792004571680 passes original seededhistory6 unchanged,36 actual manual-body rows (JSON/text/XML/form/multipart/binary ×dark/light1440/900/760 CSS profiles), and18 controls. Controls cover file refusal/no partial upload, held Cancel/fresh recovery, actual503/404/200 keyboard selection/reload, destroy/timeout/partial headers, perrequest/environment quota/filter/reload, captured Send during edit/switch, aggregate budget and deletion without resurrection. All54 actual connections close without forced destruction. Host39808 exits0/native-hidden; restoration1792004571456 restores exact f0b51/d8b032 original buffers, protected inventory and selective fixture cleanup. Independent read-only audit confirms receipt counts and ownership.

Both10MiB persisted replies compare full text/base64 and actual SHA256 to independently generated fixture bytes. The18MiB unsaved case proves visible200, size/content-length/token and budget refusal, but does not compare/hash the complete unsaved native body. CSS widths are not physical OS-picker/AT/platform acceptance. Layout checkpoint covers the manual-entry state, not whole WebView/beforebirth storage. Explicit window destroy is not OS-close lifecycle acceptance; universal loader/linkage/all-birth/callback-drain/legal/platform gates remain open.

CRUD regression91711 at artifacts/playwright/resource-manager-native-1792004773396 passes original6/field24/correction6/collection6, one actual Send/abort; host43064 exits0/native-hidden with exact baseline restoration. Full post-HTTP closure91280 and post-regression72066 pass before any source/doc edits. No native/profile/build handles remain.

Immutable first build69654/http-workflow exits0/Rust6m40; native55411/receipt1792002717530 fails at ambiguous Preferences after body36/file4. Host39808 exits0,36 sockets retire, restoration1792002717304 returns exact baseline, and source recheck18980 passes. Preferences is now scoped to Main navigation; fresh attempt2 replays all cases. Failed receipts remain failed and retained.

## Current WebSocket runtime lifecycle

Windows native-hidden acceptance is bounded-verified for the saved websocket-runtime-native.js scenario. Connect and send upgrades once and preserves exact rendered Unicode JSON (including large integer text), headers/query/subprotocol; saved text/binary/ping payloads and actual pong/peer bytes match. Invalid JSON has no handshake; invalid base64 and oversized ping leave the connection usable. Peer close code/reason, durable403/retry, held-handshake cancellation/no late Send, nonlatest choice/reload/filter-off, and deleting a live request without history resurrection are verified.

Fixed an environment completion defect: changes during a live A connection preserve its pane, but completion now reconciles only that request against the current environment. A→empty-B peer-close and client Disconnect both select empty B; returning A restores its histories. Same-environment terminal results are left intact, including unsaved responses; the overbudget and populated-B/error/concurrent-request variants remain runtime verification gaps.

Compiler75213 passes0/0; strict targeted JavaScript check passes; normal-hook build43163 finishes0/Rust7m40. Candidate artifacts/native-resource-crud-audit-probe/websocket-runtime-attempt-1, executable SHA cd0800c7ae65fb55227b27b9360f4d564cb40092e5a4a222c1ea076d46bbbad5. Original run82221/receipt1792037836062 fails at ambiguous Preferences after four groups; strict post-native closure passes and original failure stays immutable. One test-only selector change scopes Preferences to Main navigation. test-selector-supplement.json reconstructs the exact captured original23363 bytes/SHAaf7feafa840c67bb48199de7ebbc11dfddb42302ecf2336e45a554b890b98efc; current test23470 bytes/SHAc20925dc502ed2ff806a59c67bbad3c4e4219887e75946afb1134b18084611d4. Original before-cargo manifest remains unchanged. This is an explicit harness generation supplement, not unchanged original test bytes.

Corrected run74929 exits0; receipt artifacts/playwright/websocket-runtime-native-1792037919014 passes6 groups. Host22132 exits0/native-hidden. Restoration1792037918779 restores exact originalf0b51/d8b032 buffers and protected resources. All7handshakes/5opened/5closed/1heldabort retire without force/errors/open/unsettled peers. Post-selector closure98802 passes all1242 source rows with only the exact declared test-file override and all other source/package/private/tool/asset scopes unchanged; native-run-selector-supplement.json records the result. Independent read-only audit verifies host/restoration/retirement and reconstructs the test delta. Actual events screenshot inspected. Headless legacy-websocket-import regression exits0 (3portable/7refusals/1003→1000, binary/budgets/selection roundtrip). No product source changes followed native closure.

RED diagnostics used the older legacy-WebSocket candidate with declared source/scenario drift:1792037114436 reproduces stale A after switchB, host45248 exits0 and restoration1792037114210 passes. Earlier selector/message failures1792037034227/1792037049141/1792037088402 remain failed evidence. No original receipt is relabeled.

Commands: bun run check; bun x --bun tsc --noEmit --allowJs --checkJs --strict --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --types bun tests/ui/helpers/websocket-runtime-native-cases.js tests/ui/websocket-runtime-native.js; bun tests/ui/build-resource-crud-probe.js artifacts/native-resource-crud-audit-probe/websocket-runtime-attempt-1; INSOMNIUM_WEBSOCKET_RUNTIME_NATIVE=1 with explicit build-state/profile ownership then bun tests/ui/websocket-runtime-native.js; bun tests/ui/legacy-websocket-import.js. Official references: https://bun.sh/docs/runtime/http/websockets, https://playwright.dev/docs/input, https://docs.rs/reqwest-websocket/latest/reqwest_websocket/, https://svelte.dev/docs/svelte/$state.

Limits: loopback Windows scope; no universal WebSocket/provider/platform, loader/linkage, OS-close or complete migration acceptance. Explicit native window destruction is cleanup. SSE, broader protocol/legacy/provider and every remaining PARITY gate stay open.

## Topic records

<a id="record-agent-cookie-fields-20261013"></a>

<details>
<summary>AGENT-COOKIE-FIELDS-20261013</summary>

# Cookie Field validation — isolated verified candidate

Preceding preparation4b2ef6a/STATUS3d7bcc4; immutable724-file36-RED proof remains intact. Production changes only CookieManager.svelte; no CSS/shared primitive/backend/parser/quota/provider/dependency edits or native/profile/root build.

Only exact captured scheme/raw-byte-limit messages from a pending change_cookie command and actual form patch receive local Field errors. Form owner, exact submitted URL/raw/previous identity and existing workspace/disposal scope still gate publication. Admission/pre/post-command or non-form errors stay global; no substring matching. Explicit Cookie URL/Set-Cookie value labels preserve exact accessible names and descriptions in both states. Default7px is retained; existing explicit-caption weight400→500 is the sole approved normal visual change.

Correction only clears that authoritative local error when native URL validity plus HTTP/HTTPS protocol, or raw UTF8 length at/below8192, resolves its condition. This does not prevalidate/refuse a command, parse cookies, rewrite raw values, or change backend rules. Unrelated global feedback survives local correction. Edit/New/success reset the local owner; existing scope disposal suppresses late results. Original busy behavior and raw previous edit keys are preserved. No autofocus/autoscroll or global style workaround.

## Verification

SAME saved `bun tests/ui/nocturne-native-theme.js --cookie-component` final562ec7 exits0: six dark/light1440/900/760×600 profiles resolve all36 original failures with original assertions intact. Added gates verify still-invalid corrections retain errors, non-form known-message failures remain global, unrelated global operation error survives local correction, held New-cookie ownership and actual Escape/disposal suppression. Actual malformed native HTML URL validation still prevents invoke; trusted Input Enter issues exactly1 request per refusal case. Raw/URL/previous keys and no jar/committed-write mutation on refusals remain exact. These are controlled component outcomes, not native Rust/jar acceptance.

Portable `cookie-normal-geometry.json` is exactly derived from immutable36-RED data. Whole normal dialog, both fields and controls retain exact rectangles/fonts/colors/backgrounds,7px and caption colors; actual caption glyph position/height is exact, with approved weight/glyph-width changes measured separately. Each new local feedback rectangle fits every actual clipping ancestor, no horizontal overflow, bottoms431.890625/559.890625 within600. Only existing error-space expansion occurs; no geometry assertion was relaxed.

Full original shared-control `bun tests/ui/design-system.js`16582 passes with original Field/FilePicker/Select/dialog/theme/focus/serialization/multipart assertions. Cookie phase marker was subsequently tightened to the native await only; this component is not imported by the shared fixture, and unchanged helper/control bytes remain bound. Final compiler5007 passes0errors/0warnings using approved preview5493 verification-only supplement; restored3839 byte-exact and excluded from offered changes. Normal old-worktree four fetch-option errors remain disclosed. Final `bun run build`de3d30 passes,49 emitted frontend files frozen. All checks were serialized with source frozen while live.

Original entire current-root native entry reconstructs whole-LF exactly after removing only the Cookie import/early-exit branch; no native body/assertion/restoration edits or execution. Default shared fixture body reconstructs whole-LF exactly after removing only optional Bun plugins passthrough. Alias stays confined to the exact CookieManager importer; no global Tauri/workspace replacement, parser or unknown-command transport. Four preparation negatives/first36-RED and all prior Resource/Namespace/Environment/Multipart proofs remain immutable. Historical failure.png files are preserved in their negative archives, excluded from final-pass output maps.

## Frozen handoff

`artifacts/cookie-field-proof/final-v2/audit.json` SHA **3f5552dc7c9df47f4031cec790cab51bf7107b954f14de12417c4a79c4c765a2** independently rehashes824 files:285source,402harness,49frontend,80outputs,8verification. Maps sourceHashes→source/, harnessHashes→harness/, frontendHashes→build/, outputHashes→scenario/, verificationHashes→verification/. `guards.json` SHA **63e2d90207ef4c83caeb88cf5557a6da48f446d745413133e6c90dd68f979024** binds nine intended paths: one product, seven preparation fixture/helper paths, one golden JSON; final report is offered separately. Cookie raw root-before6ba64655/own-before0ac9ff05 and entire normalized equality are archived in verification. No unrelated isolated product/preview/STATUS overlay; full source/assets are an isolated generation, not current whole-root/native runtime acceptance.

The first824-file final proof remains immutable. Final-v2 corrects only guard metadata: ownBefore now binds the actual consumed724-file preparation, distinct from rootBefore. Product/source/output hashes and verified gates are unchanged.

References read: existing Field/local Nocturne contracts; [HTML URL validity](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/url), [URL protocol](https://developer.mozilla.org/en-US/docs/Web/API/URL/protocol), [TextEncoder UTF8](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder), [Svelte lifecycle/proxies](https://svelte.dev/docs/svelte/lifecycle-hooks), [Bun fixture plugin hooks](https://bun.sh/docs/bundler/plugins). No new subsystem/dependency initialization.

Handles:none; profile:none. Root independent integration/current-root replay, fresh native exact Rust error/UTF8/scheme/precedence/jar/restoration, OS/AT/platform/private/full UI/migration remain OPEN. An old bf5e executable cannot accept these changes. STATUS records verified topic/evidence and explicit handoff because `/compact` is unavailable.


</details>

<a id="record-agent-multipart-fields-20261013"></a>

<details>
<summary>AGENT-MULTIPART-FIELDS-20261013</summary>

# Multipart file row validation and removal focus — isolated verified candidate

Worktree `insomnium-agent-ui-next`, preceding checkpoint8125b76. Only production paths are `src/lib/components/KeyValueEditor.svelte` and `src/lib/styles/features/key-value.css`. Root/native90664 and original profiles were untouched. No shared primitive/API/token/editor/upload quota/provider/backend changes.

The editor uses existing Field's explicit empty-label div, nested existing display:contents wrapper and native FilePicker. Indexed `File value N` accessible names stay exact while visible filenames remain unchanged; Select stays outside Field context. Feature-owned rules hide only that empty caption, retain display:contents and wrap feedback below its controls with full basis/order. Valid row/control geometry, fonts, colors and backgrounds exactly match the frozen original six-profile measurement. Error rows expand; file/type controls keep their original sizes.

Only errors thrown within readUpload's limit/read stage become row-local Field errors. Admission and later onchange exceptions remain form-level. Captured original row/selection/workspace scope still guard every result. Success clears only its own file error; unrelated invalid rows keep theirs. Name/disabled changes transfer errors to the actual accepted parent row, including its Svelte state proxy; external row replacement prunes stale feedback. No errors or identities enter persisted rows. Caller exceptions after a caller has already changed state remain subject to the original current-row suppression guard; this feature does not redefine caller transaction semantics.

Focused removal waits for Svelte tick then targets the same-index survivor, previous survivor, or Add when empty. Unfocused removal does not request focus. Existing data/callback structure, multipart options, serialization help and all original saved control assertions remain intact.

## Evidence and exact mapping

Final `artifacts/multipart-field-proof/product-candidate/final-v2/audit.json` SHA **1a452788a7403fc45d407265d4809a7ff1dd581bfcdd102fe5a435eccc62b11f** independently rehashes785 files:285source,396harness,49frontend,51outputs,4verification. Map sourceHashes→`source/`, harnessHashes→`harness/`, frontendHashes→`build/`, outputHashes→`scenario/`, verificationHashes→`verification/`. `guards.json` SHA **953a95464fd7eea23f81dcb422d4b091869f6fd0a87c652ca2f27eded69fe36d** lists seven source/harness delta guards and both original root/own hashes. New helpers and experimental fixture have ABSENT original guards. Preserve all other source baselines; these isolated whole-tree assets are not a current-root Event/native generation claim.

SAME `bun tests/ui/design-system.js`30915 exits0: original full suite plus six dark/light1440/900/760×600 multipart profiles, actual20MiB+1 refusals and actual bytes, controlled owned-File read failures, same-row correction, other-row retention, name/disabled cloning, external resets, public workspace admission, actual editor disposal, stale reads, callback exceptions and three keyboard removal routes. Original saved scenario body is whole-LF identical after removing only appended multipart imports/block. The final aggregate assertions still demand zero production and zero experiment failures. Frozen-original valid geometry comparison is exact. Actual production error bounds are independently measured at all six profiles: file/type width, height and font stay exact, feedback has no horizontal overflow and remains within600px, indexed names stay exact and the Type selector remains outside file error context. Preliminary785-file proof under final/ and prior58332 pass remain immutable; final-v2 adds those actual-production receipts without product changes. Experimental composition remains explicitly experimental rather than an alternate production implementation.

Final compiler93195 exits0 with0errors/0warnings using the parent-approved verification-only preview helper5493d735; final build3417a3 exits0 after restoring preview3839c23 byte-exact. Both helper bytes are frozen under verification. Normal unsupplemented old-worktree check has four preexisting fetch-option errors; this helper is neither staged nor offered as a feature delta. Compiler21177's six experiment-helper string-index errors were corrected only with a const-tuple JSDoc, with all assertions intact.

Immutable negatives:63-file6aa138ab,66-filecf575330,69-file044bed8a and unwrapped29130 geometry failure remain unchanged. New strict row-clone negative27840 at `product-candidate/row-clone-negative` retains KeyValue SHA9cb81691, source and failure screenshot. Temporary spread-object ownership failed unchanged Name/disabled assertions; corrected code uses actual accepted rows[index]. Initial91750 pass predates pruning; it is archived separately, not final acceptance. Final output omits the historical failure.png already archived in the row-clone negative; final result.json says passed.

Official references read before implementation: [Svelte lifecycle/tick](https://svelte.dev/docs/svelte/lifecycle-hooks), [bindings](https://svelte.dev/docs/svelte/bind), [state proxies and raw state](https://svelte.dev/docs/svelte/$state), [native focus](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus). Existing local Field/FilePicker API and Nocturne ownership docs were read. No subsystem/dependency was initialized.

All handles terminal, no browser/server/profile/native process remains. Root independent integration/replay, fresh native file-picker/OS failure, assistive technology/platform/private and full migration remain OPEN. This does not accept native behavior against an older executable. STATUS records the topic checkpoint and explicit handoff because `/compact` cannot be invoked in this interface.


</details>

<a id="record-cookie-fields-root-acceptance"></a>

<details>
<summary>COOKIE-FIELDS-ROOT-ACCEPTANCE</summary>

# Cookie field correction accepted on root — 2026-10-13

CookieManager associates only exact URL-scheme and raw-byte-limit errors from its actual pending form command with the relevant existing Field. It preserves submitted raw values/previous keys and the workspace/disposal scope; stale form owners cannot publish local feedback. Correcting the authoritative HTTP/HTTPS or UTF8 byte-length condition clears that local error while unrelated global feedback survives. Other parser, disk, admission and non-form failures remain global. Edit/New/success reset local ownership. Backend parsing/quota/command behavior is unchanged.

Root independently rehashed824 candidate files/nine raw root guards/report and reconstructed the entire original native entry and default fixture body before integration. Product changes only src/lib/components/CookieManager.svelte. Existing Field explicit labels provide exact Cookie URL/Set-Cookie value accessible names and associated descriptions; default7px remains. The approved caption400→500 is the sole normal visual change. No CSS/global primitive/backend/dependency/provider change.

Current root compiler12430 completed0errors/0warnings. Serial2219 completed the SAME saved nocturne-native-theme.js --cookie-component, full design-system.js shared-control regression and actual frontend build, all terminal0. All1008 current source inputs stayed frozen;49 frontend assets and complete scenario outputs archived. Independent artifacts/cookie-fields-root-proof/root-audit.json proves six dark/light1440/900/760 profiles, eighteen controlled refusal cases resolving all36 original association/correction failures, actual Input Enter exactly1 invocation, native HTML malformed URL noinvoke, raw8194UTF8bytes/previous identity/no jar or committed-write mutation on refusal, exact normal geometry/styles except approved caption, relevant-invalid correction retention/global error preservation/new-owner/disposal suppression. Local feedback bottoms431.890625/559.890625 fit actual clipping ancestors and viewport with no horizontal overflow. Narrow dark scheme/light byte-limit screenshots were visually inspected.

The transport alias is confined to the exact CookieManager importer; workspace code and other core imports remain real, without global Tauri replacement. Refusal outcomes and combined precedence are explicitly preset from inspected Rust ordering, not execution of native Rust. The original724-file/36-RED measurement and four preparation negatives remain immutable. Agent final-v2 corrects only consumed own-before metadata, preserving firstfinal/product/output bytes. Root initial auditor used full tests/ui prefixes inside the harness directory instead of the manifest's harness-relative paths; the refusal occurred before adoption and was corrected without changing candidate bytes or assertions.

Current native error/UTF8/scheme/precedence/jar persistence/restoration, OS/AT/platform and broader production workflows remain open. Historicalbf5e lacks this feature. A fresh native generation must include this current source closure; the separately accepted managed-read implementation still requires original61+62 actual binding refusal/UI0. Root handles:none; native profile untouched. All original migration/UX/private/distribution/SDK/Event/FIFO/fullnotice gates remain open. Topic commit and STATUS handoff recorded; /compact cannot be invoked by this interface, and no compaction is claimed.


</details>

<a id="record-cookie-model-snapshot"></a>

<details>
<summary>COOKIE-MODEL-SNAPSHOT</summary>

# Native cookie model snapshots

The request snapshot continues to omit expired cookies. Model readers can opt into
`snapshot_request_cookies({ workspaceId, includeExpired: true })` to inspect every
entry currently retained in the jar. The command retains its main-window ownership
guard and snapshot size limits. Callers omitting the option keep the existing
request behavior.

The disk loader uses `cookie_store::serde::json::load_all` so an expired entry
already present in a persisted file remains available to model readers after a
fresh native process. The pinned cookie_store 0.22.1 serializer documents that
`load` skips expired cookies, while `load_all` loads both expired and unexpired
entries. Primary API: <https://docs.rs/cookie_store/0.22.1/cookie_store/serde/json/fn.load_all.html>.
The installed crate source was consulted; the web fetch was unavailable.

`PersistentJar::save` also serializes `iter_any`, retaining session and expired
entries through subsequent writes. This follows legacy `common/cookies.ts` and
`network/set-cookie-util.ts`, which serialize `store.getAllCookies` after adding
response cookies. The request snapshot and provider continue filtering expired
cookies independently. Broader cookie editing and actual request-header/provider
parity remain required migration gates.

## Subsequent-write persistence acceptance

The saved restart scenario supports `INSOMNIUM_COOKIE_RESTART_WRITE=1`: load the
controlled three-entry file, add an unrelated cookie through native `change_cookie`,
inspect the resulting file and model, then launch a second fresh native process.

- Prior production `4d956946` fails at the disk assertion: live model four,
  request snapshot three, persisted file three. Native `1791678025285`, restoration
  `1791678025154`, and `artifacts/plugin-cookie-write-negative-1791678025285`
  preserve the negative control and exact 54-source/harness snapshots.
- New production `05b8f4ad4821ad5f201b4772766dc5a5c190b403ad26c86c124e54d55d4d3dfd`
  passes native `1791678453748`, subsequent restart `1791678454838`, restoration
  `1791678453617`: persisted/model four, request three, original expired timestamp
  unchanged through the unrelated write and fresh process.
- Independent audit verifies the initial backup bytes, written file, both native
  results and hidden hosts, current/exact 54-source snapshots, original plugin
  store and both workspace files, plus all 653 original cookie files. It removes
  only the two absent-before, scenario-owned cookie files after owned native exit.
- Compiler passes with zero errors/warnings; Windows release build exits zero.
  Linux locked Cargo check passes in 18.27s with 275 actual source files matching
  the host, excluding four generated schemas explicitly. Evidence lives under
  `artifacts/native-plugin-cookie-persistence-probe` and
  `artifacts/linux-cookie-model-persistence-*`.
- Genuine guest helper rerun `1791678473871` / restoration `1791678473356`
  passes 13 checks, nine terminated workers and nine native requests, with
  populated cookie attributes, live expiry and exact owned-state restoration.
- Retained H2/metadata/history/restart `1791678513193` / `1791678521334` /
  restoration `1791678513011` passes nine cases, 27 workers and 30 native requests.
  Both suites have independent current/exact 54-source audits.
- Isolated staged-topic Linux locked check passes in 18.76s with 272 source files
  bound to the checkout before Cargo generates platform schemas. The pre-check
  manifest contains no generated schema files. The
  isolated Windows check was not rerun after the preceding topic's libclang
  discovery failure; full candidate Windows release/runtime evidence is separate.

The library documents `iter_any` for all retained entries and `matches` for
unexpired request-compatible entries:
<https://docs.rs/cookie_store/0.22.1/cookie_store/struct.CookieStore.html>.
The legacy model read matches the store's all-cookie operation:
<https://github.com/salesforce/tough-cookie/blob/master/api/docs/tough-cookie.store.getallcookies.md>.
The next section records separate acceptance for clear/delete/replacement,
response-driven writes and actual provider headers. Broader platform/migration/helper
parity remains required.

## Native provider acceptance

`INSOMNIUM_COOKIE_RESTART_PROVIDER=1` runs the existing saved restart scenario
with reusable `tests/ui/helpers/cookie-provider-cases.js`. Run it separately from
the write mode. It uses an owned loopback Bun HTTP fixture and the same unique
collection/main/previous files already protected by the restoration wrapper.

Production `05b8f4ad` passes 11 groups and 12 real native HTTP requests:

- Expiry, foreign-host and exact path-boundary filtering; expired entries remain
  visible to the model but absent from native Cookie headers, including when an
  explicitly supplied model snapshot contains them.
- Send off/store on, store off, cookies entirely disabled, actual response cookie
  persistence with HttpOnly, redirect-local cookies without model persistence,
  and explicit Cookie header precedence.
- Replace an existing cookie, refuse a stale snapshot generation before any wire
  request, delete an expired model entry, and clear the model/file/header. A
  second fresh native process confirms clear remains empty on disk.

Evidence: native `1791678832786`, fresh restart `1791678834794`, restoration
`1791678832680`. Independent audit checks all wire header pairs, snapshots,
persisted bytes, stale native error, original backup, both hidden/exit-zero
processes, both workspace files, plugin store and all 653 original cookie files.
The 55-source snapshot explicitly binds the two changed harness files to the
unchanged production source/binary. Compiler reports zero errors/warnings.
Retained write/restart regression `1791678872082` / `1791678872964` / restoration
`1791678871974` also passes with an independent 55-source audit.

Initial scenario `1791678749004` incorrectly expected Secure exclusion on
loopback HTTP. Pinned cookie_store `utils::is_secure` explicitly treats localhost
and loopback IPs as secure, so the corrected fixture expects Secure transmission
there. Subsequent `1791678796739` reached stale-generation rejection but failed
because Playwright flattened the native structured rejection to `evaluate: Object`;
the saved fixture now captures that native error inside the page and asserts its
actual message plus absence of a wire request. Both failures preserve owned-state
restoration and their source snapshots; neither is claimed as a product fix.

These gates are accepted for the controlled Windows loopback fixture only.
Non-loopback insecure exclusion, HTTPS transmission, actual domain suffix
matching across subdomains, equal-path ordering, concurrent/provider/proxy/platform
cases, import/edit UI and full helper/migration parity remain required.

## Verification on 2026-10-11

- Old production `d5a04def` negative control: persisted fixture has three entries;
  fresh native request/model snapshots both return two. Evidence:
  `artifacts/playwright/plugin-cookie-restart-native-1791677130952` and restoration
  `plugin-cookie-restart-restoration-1791677130846`; independent restart audit passes.
- New production `4d95694614ad04bba082e1e3098663bab707a653fe6951e6e9a711bb2e036e0d`:
  the same saved `tests/ui/plugin-cookie-restart-native.js` returns request two,
  model three with the original expired timestamp. Evidence: native
  `1791677644754`, restoration `1791677644597`, independent 54-source audit.
- Genuine mounted Send/guest helper rerun: `plugin-template-tags-1791677659246`,
  restoration `plugin-workspace-helper-restoration-1791677658727`; 13 checks,
  nine terminated workers and nine native requests. Host-only/default-path/session,
  suffix/explicit-path/persistent, Secure/HttpOnly and live expiry are independently
  checked in guest model, native snapshots and owned persisted fixture bytes.
- Both original workspace files, plugin store and all 653 original cookie files
  remain unchanged. Only scenario-owned fixture files are removed after owned
  native exit. All native hosts are hidden before CDP and report `native-hidden`.
- Windows release build exits zero; Linux locked Cargo check exits zero in 7.35s,
  with 275 actual source files matching the host (four generated schemas explicitly
  excluded). Exact snapshots and audits are retained under
  `artifacts/native-plugin-cookie-restart-probe` and `artifacts/linux-cookie-model-restart-*`.
- Retained HTTP metadata/H2/history/restart passes nine cases, 27 terminated workers
  and 30 native requests; native `1791677698553`, restart `1791677706722`, restoration
  `1791677698353`, independent 54-source audit.
- Retained Windows save chooser passes 12 groups (`1791677743512`), and explicit
  host destroy passes (`1791677854723`), with owned exit and original workspace
  restoration. Clipboard remains untouched by these scenarios.
- Isolated staged-topic Linux locked Cargo check passes in 9.50s. The isolated
  Windows check fails bindgen's libclang discovery; this is recorded separately
  from the successful full candidate Windows release/native tests. The topic
  checkout and check evidence remain under `artifacts/native-cookie-model-staged-check.json`.

Run the restart scenario with Bun and an explicit current build-state path plus
`INSOMNIUM_COOKIE_RESTART_FIXTURE` pointing to the controlled three-entry fixture
under `artifacts/playwright`. The scenario refuses paths outside that directory,
uses a unique absent collection file, and restores owned state after native exit.
This checkpoint does not complete the full plugin helper feature or migration.


</details>

<a id="record-cookie-rendering"></a>

<details>
<summary>COOKIE-RENDERING</summary>

# Cookie request rendering and isolation

## Per-request native cookie isolation — 2026-09-29

- Inspected original common/render.ts getRenderedRequestAndContext and libcurl-promise.ts cookie initialization: each request begins with a cookie snapshot, then learns redirect cookies. Current native CookieProvider instead reread the collection's shared store on every hop, allowing concurrent requests to change its outgoing cookies.
- CookieProvider now clones the current CookieStore when the provider is created. Outgoing cookies read that private store. Received Set-Cookie updates the private store when sending is enabled, even if persistence is disabled. With store enabled, only received cookie deltas merge into the live collection jar; an old snapshot never replaces newer unrelated entries.
- Existing collection generation invalidation remains: edit/clear/import invalidates older providers, prevents further sends from that snapshot and blocks late response writes. Lock order is consistently collection then private request store. No changes to disk format, Cookie UI or parser scope/expiry matching.
  -8 native inline assertions passed against the actual provider function/struct/trait implementation extracted from cookies.rs, compiled via rustc stdin and existing release dependency rlibs: concurrent isolation, response learning, delta merge preserving a newer session, local-only redirect cookie, no persistence when disabled, store-only mode, later provider visibility, and clear invalidating old sends/writes. In-memory fixture only; no app/user cookie data touched. Temporary executable/PDB removed; no saved test source/scripts.
- Cargo fmt -- --check, cargo check --locked, cargo clippy --locked -- -D warnings and git diff --check passed. Native-only change; no unnecessary frontend rerun or installer. Hidden node_repl direct programs and Bun filesystem operations retained.
- Official docs consulted before editing: https://docs.rs/cookie_store/0.22.1/cookie_store/struct.CookieStore.html (clone/parse/request values). Attempted exact reqwest CookieStore trait page was unavailable; existing provider trait implementation and compiled crate validate its contract. Reused existing subsystem, no generator/dependency needed.
- A guessed src/lib/cookies.js read/search path was absent; rg --files located legacy-cookies.js. No source edit failure.
- This isolates native request-time state; full cookie rendering parity remains incomplete. renderSendRequest currently receives no cookieJar, and workspace ignores its returned cookieJar. Next: expose a bounded native cookie snapshot with generation, render it in the same request session, pass validated rendered cookies as request-local input, and merge only response deltas without writing template-expanded seed values into durable source data. Retain original template-bearing legacy records, cookie flags, secure/domain/path/expiry behavior, cancellation and generation invalidation. Native provider creation currently snapshots after rendering, unlike the original pre-render snapshot.
- Real WebView/native redirects/HTTP/SSE/WebSocket acceptance, cookie template bridge, URL encoding, live SSE raw history and all remaining PARITY rows remain pending. Source newer than BUILD.json; full migration incomplete.

## Cookie snapshot renderer/native bridge — 2026-09-29

- Added main-window snapshot_request_cookies command and registration. Returns unexpired native cookie_store records plus collection generation, with10,000-cookie/8 MiB serialized bound. Snapshot includes native absolute expiry/scope metadata rather than reparsing relative Max-Age on every send.
- renderSendRequest obtains the collection snapshot before constructing its render session when cookies are enabled. Renders it alongside the request with the same environment/dependency/prompt context; preserves the original generation as ownership metadata and attaches the rendered cookieSnapshot to the outgoing request. Cancellation after snapshot lookup prevents rendering/dispatch. Cookie reads do not change UI collection selection or persist expanded source values.
- transport forwards cookieSnapshot; HttpRequest accepts an optional snapshot (older/internal callers fall back to native provider-time snapshots). build_client passes it to CookieProvider, which bounds it again, rejects stale generation and uses it only for the private request store. Received Set-Cookie still merges only response deltas. Cookie-disabled requests omit loading/sending snapshots.
  -40 inline assertions passed:7 compiled workspace/mocked IPC cookie cases (environment render, generation/collection, source immutability, flags/global disable, failure, cancellation),12 WebSocket initial-message regressions,9 User-Agent regressions (native mocks now return empty snapshots),12 actual native snapshot/provider assertions including serde roundtrip, rendered private cookies, source jar retention, oversized/stale snapshots and previous concurrency/redirect/clear behavior. Native probe used rustc stdin and existing dependency rlibs; temporary EXE/PDB removed. No saved test scripts, app/user-state writes or live fixture workers.
- Cargo check --locked, clippy --locked -- -D warnings, fmt -- --check, Svelte0/0, Vite build and git diff --check passed. Bun Prettier/Svelte/Vite and direct Cargo/rustc via hidden node_repl launch rules; no dependency/generator/new installer. Source newer than BUILD.json.
- Consulted official https://v2.tauri.app/develop/calling-rust/ before command work. Cookie documentation page failed to load; inspected installed official cookie_store0.22.1 src/cookie.rs serde contract and previously consulted CookieStore clone/from_cookies docs. Native serde preserves raw_cookie plus path/domain/expiry.
- Remaining cookie parity: legacy cookie_jar resource records containing templates that native import cannot represent are not yet overlaid; native raw_cookie string templating is not proven equivalent to original separately rendered key/value/domain/path fields (attribute delimiters need reconciliation). Manual OAuth token exchanges still use their existing native provider-time snapshot; no explicit cookie template renderer added there. Real WebView/IPC/network/redirect/header/SSE/WebSocket acceptance remains pending. Do not mark full cookie parity verified.
- Next: reconcile legacy structured cookie source/native serialization and template-bearing imports, then URL encoding, live SSE raw history, full runtime/UI/platform/packaging acceptance and every remaining PARITY row. Full migration incomplete.

## Structured cookie snapshot fields — 2026-09-29

- Replaced cookie_store raw_cookie strings in the new snapshot IPC with SnapshotCookie fields: key/value, typed domain/path/absolute expiry, secure/httpOnly. Generic request renderer now sees key/value separately. No frontend source change was needed.
- Provider rebuilds RawCookie through the documented builder, never parsing expanded values as Set-Cookie attributes. It then restores typed scope and expiry explicitly. Rendered header control characters fail before sending. Source/native durable cookies remain untouched; request-local snapshot and delta merge contract retained.
  -24 inline assertions passed:7 compiled frontend snapshot/IPC cases updated for the structured shape and17 native assertions against actual provider/snapshot conversion source. Native cases include prior generation/bounds/isolation behavior plus semicolon/Domain/Path-looking values staying literal, preserved domain/path/absolute expiry/secure/httpOnly, serde roundtrip and invalid-header rejection. This proves internal value/scope preservation, not how a server interprets a semicolon inside an outgoing Cookie header.
- Cargo check --locked, fmt -- --check, clippy --locked -- -D warnings and git diff --check passed. Initial check found two borrowed CookieExpiration values requiring clone; fixed and rerun. Native-only source change; no frontend build repeat or installer. Native probe compiled via rustc stdin with existing rlibs, EXE/PDB cleaned; no saved test source or real-user-state writes.
- Before implementing, consulted https://docs.rs/cookie/latest/cookie/struct.CookieBuilder.html and installed official cookie_store0.22.1 lib.rs/cookie.rs/cookie_path.rs/domain/expiration definitions. Online cookie_store index failed; installed crate source confirmed public reexports, builder conversion and clone/serde behavior. No generator/dependency needed; hidden node_repl/Bun/direct Cargo rules retained.
- This supersedes the prior raw_cookie interpolation limitation. Full legacy cookie parity remains incomplete: imported cookie_jar template records not representable in native persistent storage need structured overlay; tagged native domain/path/expiry representation differs from legacy fields, and template-bearing scope/expiry/import behavior needs reconciliation. Manual OAuth cookie rendering and real WebView/HTTP/SSE/WebSocket/redirect acceptance remain pending.
- Next: legacy cookie source/overlay semantics, URL encoding and live SSE raw history, then full runtime/UI/platform/packaging acceptance and remaining PARITY rows. Source newer than BUILD.json; full migration incomplete.

## Explicit OAuth cookie rendering and legacy-source audit — 2026-09-29

The complete historical OAuth cookie-rendering contract, source audit, evidence and remaining gates are retained in [AUTHENTICATION — manual OAuth rendering](AUTHENTICATION.md#record-manual-oauth-rendering).

</details>

<a id="record-default-headers"></a>

<details>
<summary>DEFAULT-HEADERS</summary>

# Legacy DEFAULT_HEADERS built-in hook

Plugin inventory exposed a missing built-in behavior: rendered environment DEFAULT_HEADERS should add missing headers before transport. The shared Send path now applies this after detached request/environment rendering and disabled row removal, before automatic OAuth/transport composition. Saved resources remain unchanged. Template preview and explicit manual OAuth rendering do not run this Send hook; browser-preview Send does. No native backend, CSS, dependency or generator changes.

Source contract: archived plugins/index.ts getRequestHooks, context/request.ts, common/misc.ts filterHeaders and common/render.ts. Own keys retain order; existing request names win case-insensitively, including duplicate rows. The exact string null omits a default only after the existing-header check, so it never removes an explicit request header. Other values remain literal for existing transport conversion. Disabled rows are removed first, allowing a default to supply that name. A shared name index avoids repeated scans.

Consulted before implementation: [MDN Headers](https://developer.mozilla.org/en-US/docs/Web/API/Headers) for HTTP name matching and transport restrictions. This hook reproduces inspected legacy ordering rather than replacing the application's transport header list with a browser Headers object.

Direct14 assertions passed before index refinement. Final16 differential cases use the extracted actual legacy hook body with controlled request-context callbacks: absent/falsy/empty defaults, explicit duplicates/case precedence, string-null omission, zero/false/empty/actual-null values, case-colliding defaults, literal template output, arrays/string/number input. Result/hashes: `artifacts/playwright/default-headers-differential.json`. This is bounded helper evidence, not every malformed-header/provider case.

```powershell
bun run check
$env:LIBCLANG_PATH='E:/.dvgamerr-app/insomnium-app/artifacts/tools/llvm-20.1.8/bin'
Remove-Item Env:INSOMNIUM_UI_LOW_MEMORY -ErrorAction SilentlyContinue
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_TEMPLATE_DEFAULT_HEADERS='1'
Remove-Item Env:INSOMNIUM_TEMPLATE_OAUTH -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_OAUTH_GRAPH -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_CYCLES -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_SSE -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_ENVIRONMENTS -ErrorAction SilentlyContinue
bun tests/ui/template-response-send.js
Remove-Item Env:INSOMNIUM_TEMPLATE_DEFAULT_HEADERS
bun tests/ui/template-response-send.js
```

Production build24148 exited0 (started1791623121853/finished1791623573225), SHA256 `f7c8655031ecc4030071678cd50f99e33e4697a77f3e72b5ee46a5e5889f834f`. Binding verifies469app/235scenario704paths/probe identity/preserved9fc6a4b7 baseline under `artifacts/native-default-headers-baseline`. Source freeze: `artifacts/playwright/default-headers-source-freeze.json`. Only shared request-render integration/new helper/saved scenario changed from the prior accepted application.

First native artifact1791623588057 failed the expected caller default: the fixture's original env_trs belonged to the foreign collection. Corrected only the scenario after terminal, adding caller Base environment and updating the original foreign Base separately. First-run freeze is preserved as default-headers-first-run-freeze.json; unchanged application/executable verified before refreshing the scenario hash. Native69248 exited0; failed result retained. Final compiler2965 exited0/zero errors/warnings; formatting/diff checks pass.

Final defaults7798/artifact `artifacts/playwright/template-default-headers-1791623651139` exited0/passed3groups/4wire/5workers; native57656 exited0/native-hidden/visible:false. Independent default-headers-audit.mjs checks704source/executable/baseline, direct/absent/foreign literal headers/body/base64, explicit/sentinel precedence, disabled replacement, scalar values and caller/foreign Authorization scope, unchanged saved request headers/descriptions, four durable histories and UI selection.

Same-build ordinary response-template regression68709/artifact1791623681673 exited0/passed19groups/20wire/43workers plus held dependency; native70288 exited0/native-hidden/visible:false. The original audit is preserved; default-headers-http-audit.mjs uses the current freeze. Its copied hardcoded source-count metadata was corrected to derive704 from the verified hash maps. Literal extraction/refusals/trigger/nested/foreign/Cancel/stopped-worker checks pass. Current frontend saved headless workspace12 passed. All three exact owned PID/profile process sets are absent, recorded in `artifacts/playwright/default-headers-cleanup.json`; no live feature handles.

This accepts the covered built-in HTTP Send behavior, not arbitrary custom plugins or all protocol/auth/provider/platform cases. Custom discovery/store/hooks/actions, malformed/non-string header interoperability, assistive/platform/shared adoption/ownership and every original migration/UX/CSS gate remain required. See [PLUGINS.md#record-plugin-compatibility](PLUGINS.md#record-plugin-compatibility).


</details>

<a id="record-multipart-fields-root-acceptance"></a>

<details>
<summary>MULTIPART-FIELDS-ROOT-ACCEPTANCE</summary>

# Multipart file fields: current root acceptance — 2026-10-13

KeyValueEditor now composes existing Field/FilePicker with exact indexed File value N names. Only readUpload limit/read failures attach to the owned row; work-admission and caller failures remain form-level with original current-row suppression semantics. Another row succeeding preserves the invalid row's error; correcting that row clears it. Name/disabled clones transfer feedback to the actual accepted parent proxy, while external row replacement removes stale feedback. No error or identity is persisted. Focused removal returns to same-index/previous survivor or Add after tick; normal callback/data/upload/serialization behavior is retained.

Production changes are limited to KeyValueEditor and feature key-value.css. Empty caption hidden through the explicit existing Field div branch, nested display:contents FilePicker and feedback wrapping preserve valid geometry; only error rows expand. Shared primitives/APIs/tokens, upload quotas, parser/editor/backend/permissions/dependencies are unchanged.

Root independently rehashed785 agent source/harness/build/output/verification files, seven exact raw current-root delta guards and report1645cb3f before adoption. The entire original saved design-system body is equal after removing only two appended imports/four additive test lines. Preview helper is excluded; root existing WIP remains untouched. Immutable63/66/69 negatives and row-clone RED are retained. Read-only LF-block guard first refused CRLF input before any adoption; log-directory preparation failed before scenario launch; root auditor initially used an array index for the recorded errorGeometry object. These instrumentation failures and original scripts are retained in the root proof; no production/scenario assertions were relaxed.

Root compiler2641 completed0errors/0warnings. Serial16983 SAME full headless design-system and actual root build both completed0. All713 source inputs stayed exact through both commands and49 frontend assets were archived. Independent artifacts/multipart-field-root-proof/root-audit.json verifies six dark/light1440/900/760 profiles with zero failures; full original row/control coordinates, sizes, fonts, colors and backgrounds exactly match the immutable V2 negative. Actual production error-state FilePicker183.984375×35/type45.96875×35 and their styles remain exact; feedback18/18/36px has no horizontal overflow and remains below600px. Actual20MiB+1 refusal, accepted AEH/ bytes, controlled owned-File read fault, other-row retention/same-row correction/name-disabled transfer/external reset/public workspace admission/editor disposal/stale-read suppression/caller exception classification and all three keyboard-removal routes pass alongside the complete original suite. Prototype composition remains a separately labeled experiment.

No native host/profile or root process remains. Current bf5e binary predates these product changes, so prior XML/namespace/structural native proofs remain bound to their unchanged generation. Fresh native file picker/OS read failure/assistive technology/platform and full migration/repository/SDK/Event/FIFO/notice/private/distribution/remaining UX remain open. Native freshness correction and authentic archive-bound collector validation proceed in isolated worktrees.

Commit by topic; STATUS contains evidence, remaining gates and handles. This interface cannot invoke /compact; this report is the explicit feature handoff.


</details>

<a id="record-native-cookie-fields-root-acceptance"></a>

<details>
<summary>NATIVE-COOKIE-FIELDS-ROOT-ACCEPTANCE</summary>

# Actual native Cookie field validation accepted — 2026-10-13

The current native CookieManager now has actual Rust/WebView2 evidence for its URL and byte-limit field errors. On fresh app e56723deefd14a53834b23dfdb1ee7b17938022af6dcb7e66af29f7f18def352, the saved scenario captures25 unmodified native custom-protocol replies and verifies18 form refusals across dark/light1440/900/760×600: FTP scheme,8194-byte UTF8 raw value and combined invalid scheme/large raw. Combined failure actually returns the Rust byte-limit error first. Every refusal preserves the exact seeded previous keys, live jar/generation and current/previous disk text. The correct field has its exact accessible name, invalid flag and unique error description; one local alert fits every clipping ancestor. Still-invalid correction retains it, valid correction clears it without invoking a command. Default7px remains.

Six keyboard rows verify native malformed HTML URL causes no IPC, trusted Input Enter issues exactly one real refusal, settled New cookie clears ownership/fields and Escape returns focus. These are actual backend results, not controlled presets. No Tauri/global IPC/fetch/result replacement or network server is used; passive Playwright request/response events are required and observed. The underlying Rust, product and CSS remain unchanged from the already accepted current generation.

V1 session25200 failed before fixture creation because the existing Git inventory exceeds the saved reader's10000-file cap. Its native host exited and all protected profile bytes restored; the complete negative is retained. Metadata inspection identifies13783 files,15865 directories and8504236 bytes, maximum2164811 bytes. The reviewed metadata SHA fdcb53ab7bc5511fbc73bba59adccc80c6729370621530e2efca6ae77a2c2b43 pins every exact path/size including hidden .git. The saved Git-only reader checks the complete metadata set before content reads, streams each file with one64KiB buffer, checks file identity/time/size before and after and rechecks the full set. Unknown/missing paths fail. Cookie inventory bounds and all original cases remain unchanged.

V2 native-hidden34526 completed0,24 rows/25 protocol replies. Independent artifacts/cookie-native-current-root-v2/root-audit.json rehashes consumed current e567 source/runtime harness/receipts/outputs and verifies host exit0/profile release. Root saved driver compares ALL13783 Git byte hashes before native startup and after host exit, strengthening callback-only preservation. Original43 resources/20 history, both exact workspace buffers, plugin store, complete654-cookie filename set/bytes and current3+legacy2 layout keys are restored. Actual newly seeded collection ID/name is registered before saving; only its owned cookie files are retired by the existing preservation helper. No unknown original file is removed.

The existing Nocturne entry gained only an optional cookie-native-fields early branch. Its entire original native body and earlier controlled Cookie branch reconstruct exactly. Executed artifact copies differ only by explicit import rebasing; this test-only runtime supplement leaves the1013-input compiled native product closure immutable. Three saved test paths are now adopted for reuse, and current compiler53258 passes0errors/0warnings with1010 source inputs frozen. Exact test before/after hashes are recorded in saved-test-adoption.json. Metadata baseline stays an owned artifact supplied through explicit source/executable/build/pin environment guards; no generic environment override or arbitrary baseline is accepted.

The entered-response New-owner and modal-disposal races remain explicitly unexecuted. A quick completed refusal is not proof of an entered response still pending during the owner change. Native pixel measurements use WebView2;760 is CSS-emulated viewport coverage, not a physical native minimum-window claim. OS picker/AT/platform/other production workflows, full SDK/Event/FIFO/private/distribution/notice/migration/UX scopes remain open. Source/corpus resource-copy and narrow Cookie acceptance do not imply complete migration.

Root handles:none; profile released. Verified topic commit and STATUS handoff follow this feature. This interface cannot invoke /compact; handoff is recorded without claiming compaction.


</details>

<a id="record-native-cookie-pending-ui-root-acceptance"></a>

<details>
<summary>NATIVE-COOKIE-PENDING-UI-ROOT-ACCEPTANCE</summary>

# Actual native Cookie UI pending ownership — 2026-10-13

Saved native-hidden scenario now verifies New cookie and modal close while the real UI is awaiting a native scheme refusal. Twelve additive cases cover both actions in dark/light at1440/900/760×600. The original24 cases and25 replies remain separately mapped; total37 unmodified replies are observed. Product, Rust, CSS, executable e56723de and sidecar a5ec393d remain unchanged.

Each case uses scripted form.requestSubmit(actualSaveButton), one existing Svelte microtask checkpoint, actual New/close button.click and one reset/unmount checkpoint. The form is HTML-valid. Actual URL/raw/save controls are disabled and Save reads Saving… before action. New clears fields while still pending; close removes the actual modal subtree. Passive request ownership and exposed observer checkpoints require pending-ui→post-action→protocol-response order. No sleep, transport interception, response substitution or delay is added. requestSubmit's actual SubmitEvent reports isTrusted:true, while click isTrusted:false; scripted initiation is not trusted keyboard evidence.

Actual Rust replies reject the exact scheme message with original previous-cookie keys. Live jar generation and both owned disk texts remain unchanged; settled New/fresh reopen has no stale field/global feedback or notice. Root independently checks all12 receipts,36 ordered events,37 replies and the original18 scheme/8194-byte/precedence refusals plus six keyboard/reset cases. Physical Rust entry/reply-production timing remains unobserved, and its gates stay open.

V3 session73374 ended1 because unsupported Playwright page.removeExposedFunction threw in cleanup. It observed24/12 rows but lacked final trace/preservation receipts; root refused full acceptance. Full raw negative and independently verified profile restoration are retained. V4 changes exactly that unsupported cleanup line to a comment documenting the existing owned context lifecycle; all timing/assertion code is identical. The unique exposed binding ends with the owned context. Installed Playwright1.63 types and official [exposeFunction documentation](https://playwright.dev/docs/api/class-page#page-expose-function) were reviewed. Initial root manifest/snapshot-generation pairing refusal is separately retained and corrected using final-relative frozen paths.

V4 root driver44998 authoritatively completed0, native host hidden/exited0. Independent artifacts/cookie-native-current-root-v4/root-audit.json rehashes runtime/source/resource/private authority and archives final outputs. The terminal driver verifies all13783 Git file bytes before startup/after host exit; exact654 original-cookie file set/bytes, both workspace buffers, plugin store,43 resources/20 history and current3+legacy2 layout keys are restored. Profile is released; no live root handles.

Only tests/ui/helpers/cookie-native-fields.js is adopted: b48abe8c→ce743446, additive pending checks plus supported context-lifetime cleanup. Saved entry/Git helper and product remain unchanged. Current root compiler76719 completed0 with0 errors/0 warnings, and1010 current input snapshots are frozen/rehashed. Original compiled1013-input generation and earlier V1/V2/V3 negative/positive evidence remain immutable; this is a declared saved-test supplement.

OS/AT/platform/physical Rust-entry/trusted keyboard races, other production workflows and all original SDK/Event/FIFO/private/distribution/fullnotice/migration/UX gates remain open. Next root topic is exact-three notice transition adoption and deliberate765 recollection; isolated57-group proof is ready, actual root58 remains pending. This interface cannot invoke /compact; STATUS records the topic commit/evidence/gates/empty handles handoff.


</details>

<a id="record-query-row-order"></a>

<details>
<summary>QUERY-ROW-ORDER</summary>

# Mixed query row order

Status: verified implementation, direct checks, full native URL/signing acceptance
and fresh generated-query regression.

Previously, legacy URL construction grouped ordinary query rows before generated
OpenAPI rows. An API-key append in the cURL encoding-off path also reserialized
the preceding query through URLSearchParams. Both could change the raw target
that authentication signs.

The transport now appends enabled row fragments in their displayed order when
generated or explicitly empty-name rows are present. Array expansion stays at
its originating row. Generated nullable omission and represented empty values
retain their existing serializer semantics. Manual rows retain the selected
legacy or form codec. An explicitly enabled empty name survives automatic
encoding. The API-key pair follows the row stream without reserializing it.

The source URL still uses the existing selected URL codec. cURL GET-derived
query data is appended to that source query before the ordered row stream.
Ordinary named rows without generated metadata retain their existing pipeline.
Generated allowReserved fragments keep their existing delimiter behavior.
The source URL, editor layout and CSS are unchanged.

Standards consulted before implementation:

- [WHATWG URL / URLSearchParams](https://url.spec.whatwg.org/#urlsearchparams):
  updating searchParams serializes the list using form encoding.
- [RFC 3986 query component](https://www.rfc-editor.org/rfc/rfc3986.html#section-3.4).

Verification so far:

- `bun run check`: 0 errors, 0 warnings after the final scenario assertions.
- Selected source/scenario Prettier checks pass.
- `query-order-expanded-direct.json`: eight literal target comparisons.
- `query-order-boundary-direct.json`: eight cURL GET/empty-name boundaries and
  52 comparisons against the committed legacy URL codec.
- `query-order-style-direct.json`: 33 existing style goldens in all four
  encoding/cURL contexts (132 targets), interleaved between manual rows, pass.
- `query-order-scenario-preflight.json`: all 82 planned signed/API-key targets
  match independent literal goldens before native execution.

The saved `tests/ui/url-encoding.js` retains 46 original signing regressions and
adds 32 ordered Hawk/OAuth cases across SHA1/SHA256, initial legacy/standard signing,
encoding on/off and ordinary/cURL contexts. Four API-key cases and three
original setting toggles bring the planned total to 85 wire targets and 78
signatures and eight legacy OAuth1 refusal/recovery controls. Its Hawk oracle
also rejects changing only the order of two pairs; OAuth verification retains
its standard sorted normalization. Ambiguous legacy OAuth1 queries must refuse
before TCP delivery. The saved UI explicitly selects RFC 5849 in Auth, verifies
that choice and the unchanged parameters across reload, and then sends the same
rows. Acceptance distinguishes the initial and effective signing modes.

Fresh production probe build: `bun tests/ui/build-recovery-copy-probe.js`,
started 1791522146028. Use its successful build record before running:

```powershell
$env:INSOMNIUM_UI_BUILD_STATE = 'artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/url-encoding.js
```

The corrected native URL run `url-encoding-1791524903364` finished successfully
on this build: 85 targets, 78 runtime signature assertions, seven checks and
eight pre-network legacy refusal/explicit RFC recovery controls. The independent
saved-wire audit rechecks counts, four API-key goldens, all 32 new signatures,
initial/effective signing modes, Hawk pair-order rejection and refusal records.
The native host exited0, its owned processes/profile closed, and the actual
wire fixture port52389 has no listener. No passing URL run was restarted.

The sequential saved `openapi-query-serialization.js` regression1791527884678
passes all44groups on OpenAPI3.2.1 and the same unchanged build (session86758
terminal0; started06:38:04.691Z, finished07:00:36.799Z). Independent-query-audit.json
checks33literal generated targets and11edit/runtime controls, including5
pre-network refusals. Saved assertions verify resources and reload without
resend. Both actual760px linked-help images and geometry were inspected. Native
51152 exited0/native-hidden/visiblefalse; Bun35200, native host, owned WebView
profile and actual wire listener56199 are gone. Selection recoveries0: the
conditional timeout recovery branch was not exercised by this accepted run.
This new run does not claim a fresh check of every other OpenAPI version.
Native scenarios remain `native-hidden`; saved
browser scenarios use the fixed headless helper. This document does not close
any broader migration, platform or UX/CSS requirement.

The first native attempt `url-encoding-1791522580937` failed at a composite
accessible-name lookup after reload. Its screenshot, text snapshot and owned
profile show the correct active GET request. The saved selector now matches the
exact descendant request name and retains method, unique-row, persisted active
ID and rendered-selection checks with a bounded 60-second reload wait. The
failed run is retained and its host/fixture listener closed.

The next attempt `url-encoding-1791522895225` reached 69 targets, completing all
46 original signatures and 16 new Hawk cases, then failed because its first new
legacy OAuth1 query was refused by the existing ambiguity guard. The fixture's
generated `empty=` duplicates the source URL's empty value, and cURL encoding-off
also introduces plus ambiguity. The failure screenshot/text and native
`oauth1.rs` guard confirm the required explicit RFC selection. That attempt is
retained as failed; its host exited0 and listener63527 closed. The saved scenario
now asserts all eight refusals and explicit persisted UI recovery instead of
waiting for a request that policy prohibits. The full corrected retry passed as
recorded above; the earlier attempts remain failures.
Production source/build is unchanged by these test-only repairs.

The first fresh generated-query attempt1791527266978 timed out at the shared
15-second persistence predicate after generation. Its screenshot shows33
requests, and the subsequently read owned profile has exactly33requests for
the precise sourceSpecId. Host exit0/native-hidden and fixture49309closure
were verified. The saved shared helper now allows60seconds for the same exact
sourceSpecId/count predicate; compiler0/0 and formatting pass. The full3.2.1
retry runs on the unchanged production build. URL acceptance remains valid.

The generated-query retry1791527558730 passed the generation wait and three
wire groups, then its15second click timed out after form-exploded-object had
already become the exact persisted/rendered active request. Screenshot and
owned profile confirm this. Native host exited0 and fixture57705closed. The
saved scenario now verifies unique source/name/method selection, skips restored
active rows, bounds clicks at60seconds and only records timeout recovery when
both persisted active ID and rendered class already match. Other errors fail.
Compiler0/0 passes. The full44group retry passed as recorded above; no passing
URL coverage was restarted and the production source/build remained unchanged.

Reproduce the saved generated-query regression after the same fresh build:

```powershell
$env:INSOMNIUM_UI_BUILD_STATE = 'artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSION = '3.2.1'
bun tests/ui/openapi-query-serialization.js
```


</details>

<a id="record-unix-socket"></a>

<details>
<summary>UNIX-SOCKET</summary>

# Unix socket transport implementation notes

## Current evidence (2026-10-01)

- Legacy URL parsing and socketPath IPC are connected; native reqwest unix_socket is cfg(unix). Windows currently refuses explicitly. This is incomplete parity, not a platform exclusion.
- Host has Windows curl8.21.0 with UnixSockets. Only Rust targets installed: wasm32-unknown-unknown, x86_64-pc-windows-msvc. WSL dockerman-backend reports Linux but has no cargo/rustc/bun; it is an infrastructure distro, not an established development runner. No toolchain installed or distro modified.
- reqwest0.12.28 source has a Windows named-pipe connector, not Windows AF_UNIX. Named pipes must not be substituted for the legacy socket path. Its public connector_layer requires Response=sealed Conn and request=Unnameable, so a normal app-owned Tower layer cannot supply arbitrary replacement transport streams.
- uds_windows1.2.1 official source is already downloaded in Cargo registry but not built into app release deps. It exposes real AF_UNIX UnixStream/UnixListener on Windows; dependencies memoffset0.9,tempfile3,windows-sys>=0.60<0.62. Actual connectivity and async/TLS integration are NOT verified yet.

## Next implementation decision

1. Prove Windows AF_UNIX connect/read/write and cancellation with uds_windows against a local listener and curl; run with Rust/Bun only.
2. Validate an asynchronous adapter into the existing reqwest local-transport TLS path. Public connector_layer cannot construct its sealed connection; evaluate a focused version-pinned reqwest patch versus a dedicated Hyper client carrying every existing cookie/auth/redirect/TLS/cancel behavior. Do not replace the client with a smaller HTTP-only substitute or a TCP/named-pipe bridge without preserving the contract.
3. Preserve DNS/proxy bypass, effective HTTP host for TLS/signing/cookies, configured request timeout/cancel, stream behavior and same/cross-origin rules.
4. Establish Unix target compilation/runtime on a suitable owned runner/container; existing Windows cargo check does not cover cfg(unix). Keep this gate open while making Windows progress.

## Sources

- https://docs.rs/reqwest/0.12.28/reqwest/struct.ClientBuilder.html#method.unix_socket
- Installed reqwest0.12.28 src/connect.rs connect_local_transport and src/async_impl/client.rs connector_layer bounds
- https://docs.rs/uds_windows/1.2.1/uds_windows/struct.UnixStream.html
- https://docs.rs/crate/uds_windows/1.2.1/source/README.md

## Windows runtime evidence

2026-10-01: uds_windows1.2.1 compiled and inline native probe passed65536-byte async echo through Tokio from_std after unique socket-handle ownership transfer, pending-read timeout, drop→peer EOF and curl.exe UnixSockets interoperability. Evidence artifacts/unix-socket-reference/windows-uds-probe.json. Connect was synchronous; cancellable connect and TLS are not verified. Root cfg(windows) dependency is staged for integration; reqwest/app routing still needs implementation. No probe socket/process remains.

## Nonblocking connect recipe and evidence — 2026-10-01

Evidence: artifacts/unix-socket-reference/windows-uds-nonblocking-probe.json. socket2 0.6.5 already has a release rlib. Rust probe compiled from stdin.

1. Socket::new(Domain::UNIX, Type::STREAM, None).
2. set_nonblocking(true) BEFORE connect(SockAddr::unix(path)).
3. Return errors except WouldBlock; remember pending state.
4. Safe socket.into() conversion to std::net::TcpStream then Tokio TcpStream::from_std within runtime.
5. If pending, await writable, then fail on any take_error() value.
6. Future owns stream: dropping Pending closes socket. Existing reqwest timeout must wrap this future.
7. Use resulting stream in existing local-transport TLS branch; preserve effective TLS hostname and all HTTP semantics.

Actual pending connect succeeded; explicit Pending future drop produced peer EOF. Missing endpoint returned OS10061. Overloaded listener, TLS, full-app cancellation and non-Windows acceptance remain unverified. Root uds_windows dependency remains staged; final adapter may use socket2 instead.

Sources:

- https://docs.rs/socket2/latest/socket2/struct.Socket.html#method.connect
- https://docs.rs/socket2/latest/socket2/struct.SockAddr.html#method.unix
- Installed socket2-0.6.5/src/socket.rs and src/sockaddr.rs API docs (versioned web fetch failed).
- https://docs.rs/tokio/latest/tokio/net/struct.TcpStream.html#method.from_std
- https://docs.rs/tokio/latest/tokio/net/struct.TcpStream.html#method.writable

## Windows AF_UNIX connected to patched reqwest — 2026-10-01

- Previous goal turn made progress: nonblocking connection/cancellation proof. Revalidated STATUS/PLAN/PARITY and pinned reqwest connector source; consulted Cargo patch documentation before changes.
- Vendored crates.io reqwest0.12.28 at src-tauri/vendor/reqwest with licenses and INSOMNIUM-PATCH.md provenance. Root exact =0.12.28 requirement plus [patch.crates-io] applies to shared dependency graph. Registry untouched.
- Async unix_socket API/path now available on Windows. Connector drops proxies and selects AF_UNIX before named pipe/TCP. socket2 Windows-only dependency creates nonblocking STREAM, awaits writable and checks SO_ERROR; owned stream drops with cancelled future. Existing TLS wrappers reused in a Windows-specific function, preserving effective URI hostname and TLS config; Unix/named-pipe paths untouched.
- Application build_client now enables socket routing on Windows as well as Unix. Token envelopes still clear socket path. Cargo check --offline updated lock to local package; rustfmt and cargo check --locked --offline then passed (reqwest, reqwest-websocket, app). Root uds_windows dependency from earlier fixture proof remains staged.
- NEXT compile release connector and prove real HTTP/HTTPS, proxy/DNS bypass, body/redirect/auth/cookie/stream/timeout/cancel through patched client, then saved native UI scenario/new isolated build. Native executable still predates this patch. Native-TLS feature variant and non-Windows platform compilation/runtime remain unverified. Full migration open; no live build/process/server.

Source: https://doc.rust-lang.org/cargo/reference/overriding-dependencies.html#the-patch-section

## Patched Windows AF_UNIX HTTP accepted; proxy-header leak fixed — 2026-10-01

- Previous goal turn made progress (patched reqwest integration). Revalidated STATUS/PLAN/PARITY and patch provenance.
- cargo build --release -p reqwest initially ambiguous because graph also includes0.13.5; corrected to -p reqwest@0.12.28 --manifest-path src-tauri/Cargo.toml --locked --offline. Release patched crate built.
- First actual HTTP probe exposed Proxy-Authorization despite connector proxy bypass. Fixed vendor async_impl/client.rs to clear client proxy matcher list before Arc construction whenever unix_socket is configured (Unix and Windows). This prevents generated proxy auth/custom headers, retaining manually supplied request headers. Connector-only bypass was insufficient.
- Inline Rust stdin probe against real uds_windows listener passed: exact POST65536 binary body/response, escaped target/effective Host/Bearer header, unresolved .invalid host and dead authenticated proxy bypass, no Proxy-Authorization or custom X-Proxy-Only header, Set-Cookie/replay,302 redirect and chunked response via chunk(). Compile/run exit0, evidence artifacts/unix-socket-reference/windows-uds-http-probe.json.
- Request timeout returns is_timeout and peer EOF after client drop with runtime continuing100ms. Initial cleanup probe stopped driving current-thread Tokio before waiting on server, causing peer read timeout; corrected fixture to let runtime drive background cleanup. This proves cleanup with client drop, not pooled-client reuse or app Cancel yet.
- cargo check --locked --offline passes after fix. No saved non-UI test scripts; only stdin probe and ignored evidence/exe. No live process/server/build.
- NEXT HTTPS certificate/hostname/TLS info acceptance with trusted/untrusted local fixture, then native UI request/cancel/auth/redirect matrix and isolated full build. Unix platform runtime, native-TLS feature and full migration scope remain open.

## Windows AF_UNIX HTTPS certificate validation accepted — 2026-10-01

- Previous goal turn made progress (HTTP acceptance and proxy-header fix). Revalidated STATUS/PLAN/PARITY and consulted official rustls StreamOwned, reqwest tls_info, OpenSSL req/x509 docs before fixture implementation.
- Generated local P-256 CA and server certificate with Git OpenSSL3.5.7 using documented req/x509 commands. SAN uds-only.invalid, CA:FALSE/serverAuth leaf,2-day lifetime. Files are under ignored artifacts/unix-socket-reference; no OS trust-store change. Exact argument arrays stored tls-fixture-commands.json; regenerate after expiry. server.ext specifies SAN, basicConstraints, digitalSignature, serverAuth.
- Inline Rust stdin probe uses real uds_windows listener + rustls StreamOwned and patched reqwest release crate. Three HTTPS cases pass: explicit local CA + correct host returns TLS OK, server sees expected SNI/Host, TlsInfo peer certificate exactly matches fixture DER; trusted CA + wrong host fails NotValidForName; untrusted CA fails UnknownIssuer. Negative handshakes fail before any HTTP bytes, not on timeout.
- Evidence artifacts/unix-socket-reference/windows-uds-tls-probe.json compile/run exit0, no warnings. No product edit/rebuild this turn; no saved non-UI test script. Probe closes listeners/removes socket paths. No live process/build/server.
- NEXT saved Playwright native scenario using fresh isolated app build: original Unix URL syntax, HTTP/HTTPS settings, response, persistence, app Cancel and socket path mapping on Windows. Shared app auth/redirect/cookie semantics and Unix platform runtime still require their acceptance. TLS probe establishes patched client behavior only, not full native UI/migration completion.

- https://docs.rs/rustls/0.23.45/rustls/struct.StreamOwned.html
- https://docs.rs/reqwest/0.12.28/reqwest/struct.ClientBuilder.html#method.tls_info
- https://docs.openssl.org/3.5/man1/openssl-req/
- https://docs.openssl.org/3.5/man1/openssl-x509/

## Native Unix socket Send/Cancel accepted; auth regressions passed — 2026-10-01

- Previous goal turn made progress (saved scenario/fixture) and verified live build. Revalidated STATUS/PLAN/PARITY; continued polling same supervisor33312, never restarted. Build finished exit0 at1790800783641 (~329s), fresh artifact artifacts/native-unix-socket-ui-probe/insomnium-fetch-recovery-probe.exe.
- bun tests/ui/unix-socket.js passed1790800806086: real AF_UNIX slash-rooted Windows path from original http://unix:/socket:/host/path syntax, import/reload retains original URL, exact encoded request target and effective Host, response text, Cancel→peer EOF and successful Send afterward. Three wire requests. Script/native app/fixture exits0; no forced cleanup. Evidence artifacts/playwright/unix-socket-1790800806086/{acceptance,result}.json.
- Existing url-encoding scenario passed1790800826812 on same build (23 Settings/Hawk/OAuth1/AWS wire cases); codecommit passed1790800842685 (6 cases/10 requests including307/303 same/cross-origin). Used INSOMNIUM_UI_BUILD_STATE=artifacts/native-unix-socket-ui-probe/build-state.json. These are TCP regressions, not all auth modes over AF_UNIX.
- No product/test edits this turn. No live build/app/fixture remains. Build handle nativeUnixSocketBuild terminal exit0; authoritative build-state finished/result0.
- NEXT extend saved Unix socket scenario for native HTTPS trust/hostname/settings and auth/redirect/cookie behavior; retain prior patched-client TLS evidence but do not conflate it with UI acceptance. Unix target compilation/runtime, other platform behavior and all remaining full PARITY scope stay open. Deferred UX starts only after full migration.

## Native Unix socket HTTPS Preferences acceptance passed — 2026-10-01

- Previous goal turn made progress (native Send/Cancel and auth regressions). Revalidated STATUS/PLAN/PARITY and inspected Preferences/transport CA and validateCertificates bindings.
- Added saved tests/ui/unix-socket-tls.js: Bun orchestration with embedded Rust AF_UNIX rustls fixture, fresh OpenSSL P-256 local CA/server cert generated each run using previously documented req/x509 commands, no system trust changes. Uses successful native-unix-socket-ui-probe build; no product edits or new app build.
- Through actual Preferences UI, edits Custom CA (PEM)/Validate TLS certificates, verifies persisted settings, reloads then Sends original legacy HTTPS Unix URL. Four cases pass: trusted matching hostname; trusted wrong hostname rejected; unknown issuer rejected; explicit validation disabled succeeds. Fixture verifies SNI/Host on success and zero HTTP bytes before rejection; UI displays actual error sending request for negative cases. Original CA/validation settings restored in finally; original request URL persists.
- Initial run passed1790801006282; strengthened negative UI assertion from broad certificate/TLS regex (could match scenario name) to error sending request, rerun passed1790801034434. Use latter evidence artifacts/playwright/unix-socket-tls-1790801034434/{acceptance,result}.json. Script/app/fixture exit0; no forced cleanup. bun run check passes0 errors/warnings before regex-only assertion tightening.
- No live process/build/server. NEXT native AF_UNIX auth/cookie/redirect/stream acceptance; Unix target compilation/runtime and remaining full PARITY still open. TLS UI acceptance is not proof of full migration. Deferred shared UI/UX remains subsequent phase.

## Native AF_UNIX auth/cookie/redirect routing accepted — 2026-10-01

- Previous goal turn made progress (native HTTPS4-case acceptance). Revalidated STATUS/PLAN/PARITY, inspected frontend auth and native cookie/redirect routing; consulted RFC9110 redirection semantics.
- Extended existing tests/ui/unix-socket.js (same scenario reused) with same-host302+Set-Cookie, cookie replay after page reload, cross-host302, and Basic auth. Fixture records exact HTTP headers over one real AF_UNIX path; verifies original saved legacy URLs stay unchanged.
- Same-host redirect retains Bearer and sends newly received host cookie. Cross-host redirect changes effective Host to other.invalid and omits original Authorization/Cookie even though socket path stays identical. Basic header matches independent Base64 fixture. Cookie replay succeeds after frontend reload; this does NOT prove restart-from-disk persistence. Existing Send/Cancel/Send cases remain.
- bun run check0 errors/warnings; bun tests/ui/unix-socket.js passes1790801156250 (9 wire requests total). Evidence artifacts/playwright/unix-socket-1790801156250/{acceptance,result}.json. Script/native/fixture exits0; no forced cleanup. No product edits or native rebuild; same accepted native-unix-socket-ui-probe used.
- NEXT cover remaining AF_UNIX streaming/protocol and signed/challenge-auth integration as warranted by original contract, and establish Unix target compilation/runtime. Raw unencoded URL fidelity and remaining full PARITY scope remain open; full migration not complete. No live build/process/server.

Reference: https://www.rfc-editor.org/rfc/rfc9110.html#name-redirection-3xx

## Native AF_UNIX SSE parsing and Disconnect accepted — 2026-10-01

- Previous goal turn made progress (native auth/cookie/redirect acceptance). Revalidated STATUS/PLAN/PARITY; inspected protocolFor/StreamPane and official WHATWG SSE interpretation before scenario extension.
- Extended existing tests/ui/unix-socket.js with SSE request and real AF_UNIX chunked event-stream fixture. Payload includes keepalive comment, id uds-1, event update and multiline Thai/ASCII data, divided into2-byte HTTP chunks crossing UTF-8 and field boundaries.
- Native UI Connect receives event; selected event body exactly equals Thai greeting plus newline second line; ID displayed, keepalive absent from event list. Wire verifies GET /sse, Accept:text/event-stream and Bearer. Disconnect results in peer EOF and UI leaves running state.
- bun run check0 errors/warnings; full extended native scenario passes1790801282297 (10 wire requests including previous Send/Cancel/auth/cookie/redirect cases). Evidence artifacts/playwright/unix-socket-1790801282297/{acceptance,result}.json. Script/app/fixture exits0, no forced cleanup. Existing accepted native build reused; no product changes or rebuild.
- NEXT investigate remaining platform acceptance (actual Unix cfg/runtime) and challenge/signed auth gaps against original contract. Current SSE evidence covers parsing/delivery/cancel, not reconnection/Last-Event-ID history or every streaming protocol. Raw URL fidelity and all other full PARITY scope remain open. No live processes/build/server.

Source: https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation

## Owned Linux runner established; reqwest Unix build running — 2026-10-01

- Previous goal turn made progress (native Windows SSE acceptance). Revalidated STATUS/PLAN/PARITY. Windows PATH lacks docker/podman; read-only WSL inspection discovered /usr/bin/docker in dockerman-backend. Docker daemon26.1.5 is operational. No toolchain installed into base distro; unrelated running container untouched.
- Consulted official Docker run/bind-mount docs and Rust official image page. Host rustc1.98.1; pulled matching rust:1.98.1-bookworm successfully. Immutable image rust@sha256:93ce27a88655056a51dbdd8f5f2d7ddc071c7b0070fb288a37b5a285fc83971e recorded artifacts/unix-socket-reference/linux-image.json.
- Created owned container insomnium-unix-acceptance-20261001 (ID ea7163baa47f7c4c8d81c18ef22ad9a965fe2567b81753bd81816d120e4f0485),2 CPUs/2GiB memory; /mnt/e/insomnium bound readonly at /work, CARGO_TARGET_DIR=/target. No published ports. Keeps sleep infinity while acceptance runs. Docker notes swap-limit unavailable; memory limit still applied.
- LIVE build handle linuxReqwestBuild PID28568, result linuxReqwestBuildResult:null and exitCode:null last direct poll. Command: wsl -d dockerman-backend --exec docker exec insomnium-unix-acceptance-20261001 cargo build --manifest-path /work/src-tauri/Cargo.toml -p reqwest@0.12.28 --locked. Continue polling same handle; do not restart on timeout.
- NEXT after build completion inspect result, compile stdin Unix variant of prior HTTP/TLS probe using /target/debug/deps in same container, run actual std::os::unix listener/client acceptance. Rust source via stdin avoids saved non-UI test script. Source is readonly; build caches stay inside owned container. Full Tauri Linux app compilation/runtime remains separate gate.
- Remove only this named owned container after evidence is extracted and acceptance finishes (or recorded terminal failure); never stop/prune unrelated resources. Windows regressions remain accepted, full migration open.

- https://docs.docker.com/engine/containers/run/
- https://docs.docker.com/engine/storage/bind-mounts/
- https://hub.docker.com/_/rust

## Linux Unix socket HTTP/TLS runtime accepted; full-app prerequisites installing — 2026-10-01

- Previous goal turn made progress (owned Linux runner) and verified build wait. Revalidated STATUS/PLAN/PARITY and same linuxReqwestBuild handle: terminal exit0. Compiled patched reqwest/Tokio/rustls libraries exist in /target/debug/deps.
- Adapted prior inline HTTP/TLS probes to std::os::unix::net and /tmp socket files; compiled Rust via stdin inside owned Linux container, no saved non-UI test script. Both compile/run exit0. Evidence artifacts/unix-socket-reference/linux-runtime.json.
- Real Linux HTTP: exact65536-byte POST/response, Host/Bearer, DNS/dead authenticated proxy bypass with no generated proxy headers, cookie/302 redirect/chunked stream and request deadline cleanup. TLS: trusted CA/SNI/hostname/exact peer certificate success; wrong hostname and unknown issuer rejected before HTTP. This proves cfg(unix) patched-client runtime, NOT full Tauri Linux application.
- Retaining owned insomnium-unix-acceptance-20261001 container for next full-app platform gate instead of removing/recreating it. Read-only source mount unchanged. Consulted https://v2.tauri.app/start/prerequisites/#linux.
- apt-get update in container passed. LIVE linuxDeps handle PID22552: apt-get install -y --no-install-recommends libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libclang-dev. DEBIAN_FRONTEND=noninteractive. First9 packages follow Tauri Debian docs; libclang needed by existing bindgen dependency. No packages installed into base WSL/Windows.
- NEXT poll same linuxDeps/linuxDepsResult; after success cargo check --manifest-path /work/src-tauri/Cargo.toml --locked (target /target, use low jobs/debug info if memory requires). If build needs generated source files, copy only required project subtree to owned container workspace rather than make host mount writable. Full Linux compile/runtime, installer/platform matrix and all remaining PARITY scope stay open.
- No native app/server running. Owned container and dependency installation are live; remove only owned container after full platform evidence extracted. Never prune unrelated resources.


</details>

<a id="record-user-agent"></a>

<details>
<summary>USER-AGENT</summary>

# User-Agent transport parity

## Native implicit User-Agent suppression — 2026-09-29

- transport.js now forwards suppressUserAgent from the rendered snapshot to the native HTTP envelope. Direct synchronous composition also recognizes a disabled literal User-Agent row, case-insensitively. Enabled explicit User-Agent rows remain in headers, including an empty value.
- HttpRequest adds a serde-defaulted suppress_user_agent boolean so older/internal envelopes remain compatible. build_client sets its implicit Insomnium agent only when suppression is false. Shared HTTP/SSE/WebSocket HTTP-client preparation receives the flag; gRPC has a separate transport and is unchanged.
- Browser preview rejects suppression without an enabled explicit User-Agent because browser-controlled headers cannot guarantee omission. Desktop dispatch remains native. Existing default identity/version unchanged.
- Read archived common/render.ts suppression computation and main/network/libcurl-promise.ts USERAGENT behavior. Consulted exact-version official docs before editing: https://docs.rs/reqwest/0.12.28/reqwest/struct.ClientBuilder.html#method.user_agent . No new subsystem/generator/dependency.
  -9 inline assertions passed using compiled workspace and built template workers/mocked send_http: no header, disabled mixed-case header, enabled custom header, disabled+enabled coexistence, explicit empty value, unrelated disabled header, direct composer, preview rejection and worker cleanup. No saved test files or real-user-state writes.
- Cargo fmt -- --check, cargo check --locked, cargo clippy --locked -- -D warnings, Svelte0/0, Vite build and git diff --check passed. Bun ran Prettier/svelte-check/Vite through hidden node_repl; Cargo launched directly with documented MSVC/SDK/CARGO_HOME/RUSTUP_HOME/LIBCLANG_PATH child environment. No installer rebuilt; source newer than BUILD.json.
- An archive search included generated source maps and hit its output buffer; narrowed evidence to original render.ts/libcurl-promise.ts. No code mutation failed.
- Native compiler/lint and frontend envelope checks do not prove on-wire omission/redirect/handshake behavior. Real WebView/native HTTP, SSE and WebSocket header acceptance remains pending. Next: rendered cookie snapshot/native jar parity, URL encoding, live SSE raw history, then runtime/UI/platform/packaging acceptance and remaining PARITY rows. Full migration incomplete.


</details>

<a id="record-websocket-rendering"></a>

<details>
<summary>WEBSOCKET-RENDERING</summary>

# WebSocket payload rendering

## WebSocket payload shared renderer — 2026-09-29

- sendPayload now snapshots payload/current collection environment and renders text/JSON/ping with the shared Send session and dependent-response adapter. Binary Base64 remains literal. JSON is validated after rendering. Request URL/auth/body are not rerendered for subsequent messages.
- Each payload operation captures its connection ID, follows its AbortSignal and rechecks matching active/open response/run and resource existence before dispatch. Replaced/closed connections never receive a late rendered message. One payload operation per request is allowed; operation completion participates in shutdown. Payload/environment edits after clicking Send use the captured snapshot; deletion/connection replacement cancels dispatch.
- Native closed events and execute finalization abort the connection owner to release pending prompt/render/dependency work. Existing native message format/size handling is unchanged.
  -22 inline assertions passed:11 compiled payload cases (text/JSON/binary/ping, prompt, duplicate-send guard, Stop, replacement connection, dependency and cleanup),5 actual execute/mocked-native close/shutdown cases,6 dependent OAuth cancellation regressions. Svelte0/0, Vite build and git diff --check passed. No saved test files/dependencies/native edits/installer; workers0, no real-user-state writes.
- Consulted official Tauri channels and MDN AbortController.abort plus archived main/network/websocket.ts and ui/components/websockets/websocket-request-pane.tsx interpolation/send sequence. A guessed archive path was absent and an rg expression had an unmatched parenthesis; located actual file and reran search. No source edit failures.
- Real WebView/Rust WebSocket wire acceptance remains pending; mocked IPC proves frontend ownership only. Automatic connect-and-send behavior from the archive and advanced stream parity still need reconciliation. Next: gRPC discovery/send/client-stream message renderer, streaming dependency completion, native cookie/User-Agent/URL parity and full PARITY acceptance. Full migration incomplete; source newer than BUILD.json.

Official references consulted before implementation:

- https://v2.tauri.app/develop/calling-rust/#channels
- https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort

Commands: Bun directly runs Prettier on request-render.js/workspace.svelte.js; svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings; vite build. git diff --check passes. All program launches use node_repl execFile(shell:false,windowsHide:true); no new generator required for existing renderer integration.

## WebSocket automatic connect-and-send — 2026-09-29

- sendPayload now starts a WebSocket connection when idle. Captures the selected payload at click time, reserves the message operation and tracks its completion for shutdown. An already preparing connection rejects a second Send; an open connection retains the existing message path.
- execute accepts an internal initial-payload operation. Renders the payload before URL/headers/auth preparation, matching archived websocket-request-pane.tsx interpolateOpenAndSend. JSON is validated before handshake; binary stays literal. It uses the shared Send renderer and dependency resolver with the connection owner's cancellation signal.
- Initial payload dispatch happens once on the owning open event. Checks cancellation and payload existence before dispatch; duplicate open events do not resend. Stop, failed handshake, closed connection or missing/deleted payload settle the waiting UI action. Native send acknowledgement resolves Send without waiting for connection closure. Message operation participates in shutdown completion.
- WebSocketMessageEditor enables the idle action as Connect and send and retains Send message for an open connection. Pending connection/message actions stay disabled; manual Connect still opens without sending.
- 28 inline assertions passed:12 compiled Svelte/mocked-native initial-message cases (wait for open, overlap guard, click snapshot, duplicate open, existing send, prompt before handshake, Stop and cleanup, invalid JSON, handshake failure, deleted payload, no leaked runs/workers),11 existing payload regressions and5 connection-close/shutdown regressions. No saved test scripts, real-user-state writes or active fixture workers.
- Svelte0 errors/0 warnings, Vite production build and git diff --check passed. No native edits/dependencies/new installer; source newer than BUILD.json. Commands: Bun directly launches Prettier, svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings and vite build; git diff --check, all via hidden node_repl execFile shell:false/windowsHide:true.
- Official docs consulted before editing: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send and https://v2.tauri.app/develop/calling-rust/#channels . Inspected archived interpolateOpenAndSend and native streaming.rs sender registration before open-event delivery. No generator needed for this existing subsystem.
- Mocked IPC proves frontend ordering/ownership only. Real WebView/Rust WebSocket send/close/provider/UI acceptance remains pending. Next: reconcile live SSE raw history, native cookie/User-Agent/URL parity, then runtime/UI/platform/packaging acceptance and every remaining PARITY row. Full migration incomplete.


</details>
