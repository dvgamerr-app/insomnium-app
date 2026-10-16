# RESPONSES migration

Updated 2026-10-14. Current functional namespace20+88 passes on the integration identity; original XML18 is accepted. Current Windows original namespace operator source/package/kernel-process audit is verified; broader response/loader/linkage/all-birth/OS/platform requirements remain open.

See [current status](STATUS.md), [execution plan](PLAN.md) and [complete parity requirements](PARITY.md). No original scope was removed by consolidation.

## Durable response formatting — 2026-10-16

HTTP Pretty/Raw now reads `request_meta.previewMode` and persists changes through a guarded workspace action. Imported `raw` activates the original-body view. Choosing Pretty stores `friendly`; retained `source` metadata remains supported. Existing response/filter/pin/custom metadata is preserved, and unchanged/invalid/blocked actions do not save. HTML visual/source rendering is implemented below; other media and broader legacy rendering remain separate work.

Inline actual-action checks pass metadata preservation, saved-data validation/reload, import reference remapping and invalid/admission guards. Compiler/build pass. Mounted/native switching/reload, legacy visual/source rendering and complete response/platform acceptance remain open. Legacy reference: archived `models/request-meta.ts` and `common/constants.ts`. No new test files/native build.

## Sandboxed HTML response preview — 2026-10-16

`text/html` responses now offer Preview/Source/Raw through the existing persisted modes. Preview renders a local Blob document in an empty iframe sandbox, with a first restrictive CSP disabling scripts, connections, frames, objects, forms and base URLs; inline CSS and data images/media are allowed. Parent production/dev CSP permits only Blob frames, so response navigation to remote URLs stays blocked. No raw HTML enters the application DOM. Blob URLs retire on replacement/unmount; Copy/Save still use the response data and Source/Raw preserve exact text. The response-focus action can focus the preview iframe.

Existing saved `response-history-app.js` has a single opt-in `INSOMNIUM_RESPONSE_HTML_ONLY=1` branch, using the shared headless helper. It verifies static Thai HTML/inline CSS, script refusal, opaque-origin app-DOM refusal, zero observed response network attempts including image/frame/meta-refresh, exact Source, and Raw persistence/reload. Final run exits0 in~1.85s; receipt/screenshot `artifacts/playwright/response-html-preview/`. Screenshot inspected. Initial iframe animation-frame wait was interrupted and its owned Bun/Edge tree explicitly retired; its receipt is retained. A subsequent fixture failure was Playwright's seed running inside the sandbox; seeding now targets only the top frame, with assertions/sandbox retained and a10second branch deadline. Both failed/interrupted receipts remain. Final compiler0errors/0warnings, frontend build and locked Cargo check pass. No new scenario/artifact scripts, native release build or user profile changes. Native WebView/platform, other visual media and full response/migration acceptance remain open.

Official references: [iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox), [CSP frame-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-src), [Blob URL lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static). Existing browser APIs were used; no dependency or generator was needed.

## Saved image preview — 2026-10-16

Image MIME responses now use the same restrictive visual sandbox, embedding only the saved `bodyBase64` as a data image. MIME syntax and Base64 characters are constrained before constructing markup; missing/invalid bytes show an explicit unavailable message. The request URL and decoded text are never used as the image source. Existing Preview/Source/Raw metadata, exact textual representations and Save-original-bytes behavior remain.

The existing response-history-app visual branch also supports `INSOMNIUM_RESPONSE_IMAGE_ONLY=1`. One PNG from the existing local icon verifies decoded dimensions, exact data source, opaque origin/no observed network, Source text, Raw reload and unchanged saved Base64. PNG and existing HTML focused branches each exit0 in~2.24s; receipts/screenshots in `artifacts/playwright/response-image-preview/` and `response-html-preview/`, image screenshot inspected. Compiler0errors/0warnings/build pass. No new scenario/artifact scripts, dependency/native build/profile changes or live handles. Native WebView, other image formats/invalid decoder UX, additional media/platform and complete migration acceptance remain open.

## Saved audio preview — 2026-10-16

Audio MIME responses now render a browser audio player from constrained saved Base64 inside the same opaque sandbox. Controls are enabled, preload is metadata-only and autoplay is absent. The CSP permits data media only; external media, scripts and app-DOM access remain blocked. Source/Raw and saved bytes are unchanged. This follows the archived `response-viewer.tsx` audio branch without adding video or enabling response scripts.

Existing visual scenario adds `INSOMNIUM_RESPONSE_AUDIO_ONLY=1`, using one authored silent 10ms WAV. Final run exits0 in~5.2s, verifying metadata duration, paused/no-autoplay/controls, exact data source, opaque origin/no observed network and exact text/bytes after Raw reload. Receipt/screenshot: `artifacts/playwright/response-audio-preview/`; screenshot inspected. Initial scenario syntax error was corrected before browser launch; final compiler0errors/0warnings and frontend build pass. No new test/artifact scripts, dependency/native build/profile changes or live handles. Actual user playback/audio output, codecs, native/platform and remaining PDF/CSV/multipart/complete migration acceptance stay open.

## CSV response table — 2026-10-16

`text/csv` responses now use Papa Parse in a dedicated worker with the archive's `skipEmptyLines:true` and string-valued cells. Delimiter/newline detection, BOM and quoting use the library rather than a custom parser. The table renders 200 rows per page, with next/previous and direct page selection; the complete parsed row set remains reachable. Cells are escaped Svelte text, and parser issues are visible. Worker replacement/unmount terminates parsing; a10second deadline offers Source/Raw on timeout. CSV skips JSON filtering and preserves the saved body; Source/Raw remain available.

Papa Parse5.7.0 is pinned (within the archived ^5.6.0 range), with @types/papaparse5.5.2 for tooling. Versions were read using `bun info`; installation used `bun add --exact --ignore-scripts` and `bun add --dev --exact --ignore-scripts`. [Official parser options](https://www.papaparse.com/docs) and archived response-csv-viewer.tsx were consulted. The existing frontend-notice generator/validator passed for the new lock. Its first attempt correctly refused the prior provided-archive admission's old lock digest; that input was preserved, existing archive IDs were checked against the new lock, and a new lock-bound input was generated without relaxing archive checks. Generated/validated stage: `artifacts/frontend-notice-stages/85102edd-f728-4512-9d68-e1fb74bf2216/`. This is the existing candidate coverage, not full emitted/linkage/legal closure.

Existing response-history-app adds one `INSOMNIUM_RESPONSE_CSV_ONLY=1` case:208 rows, quoted comma/CRLF, Thai, leading zeros, large integer strings, escaped markup, page2's last row, direct page jump, Source/Raw/reload and exact saved BOM/CRLF body. It exits0 in~2.17s; receipt/screenshot `artifacts/playwright/response-csv-preview/`, screenshot inspected. Final compiler0errors/0warnings and frontend build pass. No new scenario/artifact scripts, native build/profile changes or live handles. Native/platform, malformed/large/wide-table performance and remaining PDF/multipart/full migration acceptance stay open.

## PDF response viewer — 2026-10-16

PDF responses now render saved Base64 bytes through PDF.js6.4.299 in a dedicated worker, with page navigation, zoom and accessible extracted page text. Fonts/CMaps/decoders are bundled locally using vite-plugin-static-copy4.1.1. Password prompting stays in memory; loading has a deadline, canvas allocation is bounded and replacement/unmount destroys the loading task and cancels rendering. No scripting/action/link viewer layer is installed. Source/Raw and original saved bytes remain available.

References consulted: [PDF.js examples](https://mozilla.github.io/pdf.js/examples/), [API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html), [static-copy plugin](https://github.com/sapphi-red/vite-plugin-static-copy#readme) and archived response-pdf-viewer.tsx. Dependencies were pinned with Bun --exact --ignore-scripts. Existing frontend notices generate/validate passed at artifacts/frontend-notice-stages/fee84ab3-b08b-44ef-8fd1-cf6a459f1a5d; the prior archive admission was preserved and rebound to the new lock after confirming its archive IDs. This retains the existing candidate coverage, not full legal/linkage closure.

Existing response-history-app with INSOMNIUM_RESPONSE_PDF_ONLY=1 passes one authored two-page PDF: rendered blue canvas pixel, text, next/previous,150% zoom, no executed document action, unchanged bytes and persisted Raw reload (~2.26s, headless). Receipt/screenshot: artifacts/playwright/response-pdf-preview/, screenshot inspected. Compiler31992 exits0/0errors/0warnings; sequential frontend build exits0. Initial compiler nullable-context error was fixed. Initial UI startup failed after concurrent check/build; retained failed-startup-result.json, then sequential build and focused scenario passed. No new scenario/artifact scripts or native build/profile changes. Password-protected/decoder variants and native/platform acceptance remain unverified; multipart and broader PLAN/PARITY gates remain open. No owned live handles; pre-existing Vite PID32520 untouched. /compact unavailable.

## Multipart response viewer — 2026-10-16

Multipart responses now expose a part selector, per-part headers and exact-byte Save part through the existing desktop/browser download path. Parsing uses saved Base64 bytes, preserving binary values and excluding boundary CRLF; quoted boundary/disposition parameters, folded headers, preamble/epilogue and charset decoding are supported. Invalid/missing/truncated boundaries show errors with Source/Raw available. Part JSON preserves numeric tokens through the existing formatter; HTML/media/PDF/CSV reuse existing viewers. Nested multipart recurses up to16levels, then exposes the part source and download. Saved response data is unchanged. No new dependencies.

Contract: archived response-multipart-viewer.tsx and [RFC2046 section5.1.1](https://www.rfc-editor.org/rfc/rfc2046#section-5.1.1). Inline Bun assertions pass Unicode, binary NUL/FF/CRLF, boundary-prefix lookalikes and missing closing-boundary refusal. Existing response-history-app with INSOMNIUM_RESPONSE_MULTIPART_ONLY=1 passes two-part JSON/binary selection, Unicode/exact large integer source, headers, actual downloaded5bytes/filename and unchanged original Base64 (~1.72s, headless). Receipt/screenshot: artifacts/playwright/response-multipart-preview/, inspected. Initial editor selectors addressed CodeMirror's input rather than stored value; both failed receipts retained, final selector reads the original source textarea. Build exits0; compiler82778 exits0/0errors/0warnings. No new test/artifact scripts/native build/profile changes or owned live handles. Native save dialog, nested/media/transfer-encoding variants and broader migration acceptance remain open. /compact unavailable.

## Response MIME inference — 2026-10-16

The preview now matches archived response-viewer.tsx _getContentType: valid JSON takes precedence over the declared MIME, then a HTML doctype in the first100UTF8bytes selects sandboxed HTML. Empty/unrecognized bodies retain the declared MIME. Original headers/download MIME and saved body/bytes are unchanged. HTTP and multipart parts share the same inference; CodeEditor receives the inferred MIME for JSON highlighting.

Inline Bun checks pass JSON-over-HTML precedence, HTML-over-text/plain, first100byte boundary, no-doctype fallback, empty media and original-source preservation. The existing HTML-only saved headless scenario now deliberately supplies text/plain and passes the original sandbox/script/network/Source/Raw/reload assertions (~2.11s). Prior explicit-MIME result retained as explicit-mime-result.json; final artifacts/playwright/response-html-preview/result.json passed. Compiler28507 exits0/0errors/0warnings; build exits0. No new dependency/script/native build/profile changes or owned live handles. Native/platform and broader PLAN/PARITY remain open. /compact unavailable.

## Response download filenames — 2026-10-16

Save response now uses Content-Disposition filename, preferring valid UTF8/ISO-8859-1 filename* and falling back to ordinary filename or response.bin. Quoted semicolons/escapes are parsed using the shared MIME parameter reader. Suggested names discard directory components, replace control/Windows-invalid characters and avoid reserved device names. Multipart Save part shares this handling. Exact saved Base64 remains the file source; server headers are unchanged.

Reference: archived request.tsx download naming and [RFC6266 section4.3](https://www.rfc-editor.org/rfc/rfc6266#section-4.3). Inline Bun controls pass UTF8 precedence, malformed extended fallback, quoted semicolon, Latin1, path removal, reserved name and absent-header fallback. Existing PDF-only scenario now also clicks actual Save response and verifies ไทย.pdf plus byte-exact downloaded PDF (~2.38s, headless), retaining page/pixel/navigation/zoom/Raw assertions. Receipt artifacts/playwright/response-pdf-preview/result.json; prior result preserved. Compiler29291 exits0/0errors/0warnings; build exits0. No dependency/new scenario/artifact script/native build/profile changes or owned live handles. Native dialog/platform and full migration remain open. /compact unavailable.

## Topic records

<a id="record-current-original-xml-native-acceptance"></a>

<details>
<summary>CURRENT-ORIGINAL-XML-NATIVE-ACCEPTANCE</summary>

# Original current XML workflow accepted after independent model repair

The saved original18-case scenario child61628 exited0 on native-hidden host62100 (natural0/null, no intentional parent termination). All original assertions passed. Parent80790/operator55864 rejected the first independent audit and remain exit1 in their original receipts. Neither that result nor the held claim was overwritten.

The first audit incorrectly expected unminified ParseError names and only three new resources. The authentic compiled worker names its parser error function p; String(error) emits that name. Switching away from the owned workspace legitimately creates one workspace_meta through model.js rememberEnvironment and workspace.svelte.js activateCollection. These are measured audit-model mismatches, not failed original UI assertions or permission to accept arbitrary errors/resources.

Root independently copied the sanitized20-file public proof ea094e9a. No actual original/changed workspace snapshots entered the public proof or Git index. Initial copy-path/whitelist refusals preceded project imports and were retained; existing partial files were admitted only after exact byte equality, with no deletion. Root replay57340 executed exact authenticated f66 worker87052/fbcacf92 in an inert private Bun node:vm context. It independently derived malformed and empty p-prefix errors and unchanged mixed-content Error text. Root replay48648 verified exact model/workspace source against f66 and exercised metadata creation/reuse in memory. Root readonly/pure replay53552 passed all actual18 cases,19 refusal poisons and eight syntax checks. Only two exact emitted-message expectations changed; the auditor5348 remains byte-identical, all six controlled errors remain strict.

The new ownership validator admits at most one exact six-key workspace_meta with fresh wrkm_UUID32 ID, the registered workspace parent, empty valid environment selection and bounded creation/modification times. All three primary fixture resources remain required. Any other extra resource, wrong schema/parent/id/count/time/environment, or modified original43/history20 fails. Actual metadata9c867504 matches that policy.

Independent final-restoration69817 exited0: protected656 including654 cookies/both buffers, original raw workspace hash, all13783 Git files and exact directories, original43 resources/20 history, five layout values, registered-only cleanup, current authority/package sources and absent owned processes passed. This intermediate receipt deliberately retained ownership/full-case pending flags until the separately reviewed repair; it was not silently changed.

Remedial review2a104908 pins the original bindinga5d02569, eight unchanged original execution receipts, all original28 source inputs/packagecae0, and six corrected dependencies before import. Full Root remedial auditor63184/physical wrapper2466 exited0: all18 cases, nine errors, six real Worker instances, six controlled cancellations, exact Git serialization/saved/reload/cancel/timer/late suppression behavior, three owned resources plus the authentic metadata, live profile/Git/current authority and physical settlement passed. No app/scenario source changed and no native rerun occurred. This is new independent post-run acceptance of the original passing scenario, not a claim that the originally pinned auditor accepted.

Separate explicit Root release then accepted fullOriginalXmlScenarioAccepted:true. Original operator refusal and held claim remain preserved. Remedial audit SHA1b6b3162; final-restoration SHA138feee0. No live Root handles/profile claim remain.

Evidence: artifacts/xml-current-native-root-run, artifacts/xml-remedial-root-review, artifacts/xml-emitted-error-repair and artifacts/playwright/xml-request-format-1791897552003. Private original/changed/context resource snapshots remain local and unstaged. The760 error screenshot was visually inspected; no obvious overflow, no complete theme/AT/UI claim. Limits: original f66 has no role-alert assertion; separate per-case physical disk snapshots and Rust-entry traces are not serialized; captured layout equality is before host exit; OS-close/unobserved births/universal platform remain open. The inherited auditor remaining-text mentioning full gRPC is historical wording: current original gRPC acceptance4999929 remains accepted. All other migration/distribution/UX gates remain active. Next current-native namespace review and eventual separate role-alert/fresh-app adoption. /compact cannot be invoked; STATUS records the handoff.


</details>

<a id="record-current-xml-native-preparation"></a>

<details>
<summary>CURRENT-XML-NATIVE-PREPARATION</summary>

# Current XML runtime preparation

Root independently rehashed the immutable runtime34 (161587a0), auditor20 (df0ebc12) and integration41 (0aa12242) snapshots. Initial copy refused before project import because snapshots reside under final/snapshot; a separate v2 retained that refusal and copied the declared bytes correctly. The original entry inverse is exact e14191d5. Product RequestEditor, XML worker, compiled app edbbac32 and closure f66eaa2a remain unchanged; the role-positive artifact is not product adoption.

The closed runtime ledger has28 files: six runtime modules/data, five independent auditor modules/data and17 existing Root source pins, with literal/dynamic-literal import edges and exactly three bare packages. Explicit binding-selected imports are included before any operator/auditor import. Guard9347e656 and collectorbe6bc92d have exact declared inverses against existing Root helpers. Fresh capture48724/verify65220 exited0, binding three packages (Playwright1.63.0, YAML2.9.1, xmldom0.9.12),362 files and eight Bun/PowerShell/CLR tools to capturecae0a52f. This is actual installed source-byte capture, not archive/SRI or whole Windows loader proof.

Root runtime pure replay passed. Auditor pure replay initially refused at a missing raw prior-manifest receipt, before native/profile actions; exact original manifests were supplied and original failure retained. Fresh v2 pure wrappers64056/60248/64784 all exited0: runtime40, auditor45 and recipe56 refusal checks, and their saved syntax checks passed. Positives are synthetic only. All11+Root17 and package inputs were checked before project import and unchanged afterwards.

Read-only preparation81395 exited0: actual KnownFolder profile has656 protected files including654 cookies,13783 original Git files and43 resources/20 history. Current compiled authority passed. Latest preceding owner release is the accepted original gRPC release, not the obsolete Proto release. Identifier and app SHA used by the recipe release projection derive from the actual previous claim; the original release/held claim are preserved. Actual no-host observation passed. Five layout values will be captured/restored by the saved facade after native launch; no preparatory live-DOM values are invented.

Fresh bindinga5d02569 and reviewe841a764 select the entire original18-case XML suite. Root parent runner verifies all dependency/package/baseline/release pins before spawning the reviewed saved operator, then checks unchanged inputs, independently audited case/restoration gates and baseline identity. No release operation is in that runner. A separate Root release follows actual case/physical/full-preservation acceptance. Preparation alone is not native XML acceptance.

Commands used Bun only: review-stage-xml-root-v2.mjs, prepare-xml-package-source-root.mjs, capture-current-xml-inputs-root.mjs, verify-current-xml-preparation-root-v2.mjs, prepare-current-xml-launch-root.mjs. Source authority and native helpers follow the existing reviewed contracts; reference [Bun file I/O](https://bun.sh/docs/api/file-io) and [child processes](https://bun.sh/docs/runtime/child-process). Source snapshots and receipts are in artifacts/xml-root-offer-review-v2 and artifacts/xml-current-native-root-preparation. Root handles:none/profile unclaimed at handoff. Actual XML run/release, role-alert product adoption, native namespace and every other migration/distribution/UX gate remain active. /compact cannot be invoked here; STATUS records the handoff.


</details>

<a id="record-http-response-metadata"></a>

<details>
<summary>HTTP-RESPONSE-METADATA</summary>

# Native HTTP response metadata

Native `send_http` now returns `httpVersion` from the final negotiated response and
`bytesRead` from the response payload before content decompression. Existing `size`
and `bodyBase64` continue to describe the decoded body. Headers, chunk framing and
redirect intermediate bodies do not contribute to the final payload count.

The vendored reqwest service wraps `FollowRedirect` before decompression with a
shared response-extension counter. Data frames increment the counter; pending,
errors, trailers, end-of-stream and size hints are forwarded. After draining the
body, native HTTP requires this counter rather than estimating from Content-Length
or decoded size. Synthetic responses constructed outside the service have no
counter. The pinned reqwest 0.12.28 dependency enables its documented `http2`
feature without changing its version or disabling existing features.

References: [libcurl downloaded payload size](https://curl.se/libcurl/c/CURLINFO_SIZE_DOWNLOAD_T.html),
[http-body frames](https://docs.rs/http-body/1.0.1/http_body/trait.Body.html),
[reqwest optional features](https://docs.rs/reqwest/0.12.28/reqwest/#optional-features).

## Verification checkpoint — 2026-10-11

- Production binary `d5a04def0a15d69f2247d7d3a49b688abd0b91db210e6e3545f296a11fb4b151`
  passes nine cases: plain, gzip, deflate, Brotli, chunked gzip with trailers,
  HTTP/1.0, HEAD, redirect and trusted-CA HTTP/2 gzip. Gzip encoded payload is
  116 bytes; decoded body is 8704 bytes. HEAD counts zero actual body bytes.
- Saved native metadata runs `1791675834445` and restart `1791675842597` cover
  IPC, genuine guest/model/body round trips, actual Send and file history,
  separate restart, 27 terminated workers and 30 native requests. The H2-only
  fixture records three native ALPN `h2` streams and one independent control,
  with zero fixture errors. Both original workspace buffers are restored.
- Independent current-worktree audit:
  `bun artifacts/audit-workspace-helper-http2-history.mjs artifacts/playwright/plugin-response-metadata-native-1791675834445 artifacts/playwright/plugin-response-metadata-restart-1791675842597 artifacts/playwright/plugin-response-metadata-restoration-1791675834264`
  passes 52 source/snapshot bindings, byte counts, build identity, history and
  restoration. The fixture and audit are preparation for the still-unfinished
  helper feature; they are not included in this native-only topic checkpoint.
- Windows and Linux Cargo checks pass. Linux source audit matches 275 actual
  source files and explicitly excludes four platform-generated schemas.
  Retained native save 12 groups and explicit main-window destroy also pass on
  this binary with source/workspace/selected-file audits.
- An isolated checkout of the staged native-only topic also passes locked Cargo
  checks on Windows (15.20 seconds) and Linux (22.15 seconds). Linux bindgen needs
  the installed library selected by `LIBCLANG_PATH=/usr/lib/llvm-14/lib`; the first
  automatic-discovery failure is retained. See the official
  [bindgen requirements](https://rust-lang.github.io/rust-bindgen/requirements.html).

HTTP/3, broader HTTP/2/proxy/provider/platform behavior and remaining migration
parity are not accepted by these fixtures. The generic HTTP/3 service branch is
wrapped consistently but its feature/runtime remains unverified. This topic
checkpoint does not complete the overall helper feature or migration. Full
helper activation, other protocols, DOM/private/sync/clipboard/platform gates and
the subsequent UX/CSS phase remain tracked in STATUS/PLAN/PARITY.


</details>

<a id="record-json-response-filter"></a>

<details>
<summary>JSON-RESPONSE-FILTER</summary>

# Mounted JSON response filter acceptance

Status: scoped native acceptance verified (2026-10-10).

Follow-up [RESPONSES.md#record-json-response-tools](RESPONSES.md#record-json-response-tools) now verifies body
replacement, controlled displayed Copy/original Save byte boundaries, history
capacity/selection/reload and six dark/light responsive profiles.
[RESPONSES.md#record-response-feedback](RESPONSES.md#record-response-feedback) subsequently verifies feedback
recovery/operation ownership and the retained26filter groups on a fresh release.
OS boundaries, keyboard/assistive technology, mutable streaming-body cases,
XPath and remaining editor/UX gates stay required.

Saved native handle 33624 finished with actual exit 0. Artifact:
`artifacts/playwright/json-response-filter-1791598329340`. Native PID 54624
exited 0, rendering `native-hidden`, owned window visible false. Acceptance records
26 groups, 11 real bundled worker creations and 21 native HTTP Sends. Independent
audit checks all 465 application/225 scenario hashes, unchanged executable SHA256
`89bbb5113131162b58a4d16b11586a90cc5efadb2c3839ec834939181f14cd18`, literal
numeric spellings/selection expectations, original body/base64, retained metadata
and history, cancellation timer causality, late callbacks and actual controlled
deadline timing. Owned Bun/native/WebView profile processes are absent; no live
handles remain. Compiler finishes with 0 errors/0 warnings. Five initial scenario
tuple inference diagnostics were corrected before launch; no native failure.

The September response filter implementation lacked native WebView/CSP,
mounted lifecycle, persistence and stale-generation acceptance. The saved
`tests/ui/json-response-filter.js` uses the shared hidden native host helper and
a local HTTP fixture. Existing application source and production executable are
unchanged from collection-index acceptance; source/executable hashes are checked
before reuse.

The scenario checks exact Pretty/Raw text including preserved numeric spelling,
original native body/base64, JSONPath selection and predicates, missing matches,
falsy roots, malformed JSON, filter history/unknown metadata/reload, real syntax
and match-count refusals. Controlled workers cover Raw/tab/Clear/path/request/
unmount/workspace cancellation and six fault branches with actual timer callback
tracking. Late callbacks target the cancelled generation explicitly. Fresh Send
requires a new persisted response ID and matching local wire body.

Commands: `bun run check`, `bun artifacts/playwright/freeze-json-response-filter.mjs`,
`bun tests/ui/json-response-filter.js`. Freeze:
`artifacts/playwright/json-response-filter-source-freeze.json`.
Independent audit: `bun artifacts/playwright/audit-json-response-filter.mjs artifacts/playwright/json-response-filter-1791598329340`.

References consulted before scenario implementation:
[JSONPath Plus](https://github.com/JSONPath-Plus/JSONPath),
[Playwright Worker](https://playwright.dev/docs/api/class-worker),
[HTML timers](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#timers).
No dependency/generator or application changes are required for this acceptance.

Controlled faults do not prove an actual hung worker. JSONPath values retain
JSON.parse numeric precision limitations; unfiltered token formatting preserves
numeric spelling. Response-body replacement during processing, copy/download,
history capacity boundaries, dark/light responsive filter geometry, OS
clipboard/save, XPath/XML, all editor/provider/platform
behavior and every remaining migration/UX/CSS gate remain required. No full
migration or redesign completion is claimed.


</details>

<a id="record-json-response-tools"></a>

<details>
<summary>JSON-RESPONSE-TOOLS</summary>

# Mounted response tools and responsive layout

Final current-source native 94277 finishes with actual exit 0. Artifact:
`artifacts/playwright/json-response-filter-1791599769200`, native 60352 exits 0,
`native-hidden`, visible false. Nine groups and three native HTTP Sends pass:
body replacement, Copy/Save boundaries, history and six layout profiles. Old
worker cancellation clears its real scheduled deadline at 2531ms before callback;
both old/current workers terminate, stale results are ignored and the original
versus replacement body/base64/response identity is retained. This is a local
dataset cancellation measurement, not general dispatch performance acceptance.

Copy captures filtered, Raw and Pretty text plus one refused attempt; Save has
three controlled dialog replies (success/cancel/refusal) and two exact original
152-byte write boundaries. Adapters restore fetch/clipboard and retain only
necessary payload headers. Imported twelve history entries remain on duplicate;
a new expression retains first ten plus new, eleven entries, through selection,
Clear and reload with unrelated metadata preserved. All five controls fit without
overlap/overflow at dark/light 1440/900/760; Help opens/closes in each profile.
Current dark/light760 images were inspected. No application/CSS change was needed.

Independent audit verifies 465 unchanged app/226 scenario files (691 total),
exact wire/body/base64/metadata/history/timers/payload/geometry/restoration and
unchanged executable SHA256
`89bbb5113131162b58a4d16b11586a90cc5efadb2c3839ec834939181f14cd18`.
Owned Bun/native/exact WebView profile processes are absent, no live handles.
Final compiler reports zero errors/warnings. Earlier 26-group response acceptance
is retained at its own source freeze; current tools mode acceptance covers these
nine groups, not a rerun of the default workflow.

Retained attempts: 83617/artifact1791599181191 failed the pre-deadline assertion
after a large workspace read in the held phase; moved snapshot/URL preparation
before hold and used immediate Send. 42074/artifact1791599284776 passed causal
body replacement but its direct-invoke Save adapter did not capture the transport;
replaced it with the established fetch transport fixture. Both native hosts exited
0, scenario wrappers exited1. 32543/artifact1791599481509 passed all nine groups
before diagnostic refinement; final94277 verifies current source. Initial scenario
nullability, fetch typing and optional-find diagnostics were corrected before
their corresponding runtime; no application bug inferred from those failures.

Continue the remaining JSON response gates from RESPONSES.md#record-json-response-filter using its
existing saved scenario. `INSOMNIUM_JSON_RESPONSE_TOOLS=1` selects the extension
after the shared native fixture and exact original response checks. Default mode
retains the prior 26-group workflow. This extension checks a real second HTTP
response while a controlled worker holds the previous body, stale callbacks,
displayed Copy/original byte Save boundaries, cancel/refusal feedback, imported
history preservation/first-ten-plus-new capacity/selection/reload and six mounted
dark/light 1440/900/760 geometry profiles with screenshots and Help controls.

Clipboard and Save adapters capture only those explicit boundaries and restore
original functions in finally. They do not access the user's clipboard, open an
OS picker or prove native filesystem writes. Other IPC/HTTP/metadata persistence
and bundled workers remain actual. OS clipboard/picker/write, real hung workers,
XPath/XML and all remaining migration/UX/CSS requirements remain open.

Commands: `bun run check`, `bun artifacts/playwright/freeze-response-tools.mjs`,
then set `INSOMNIUM_JSON_RESPONSE_TOOLS=1` and run
`bun tests/ui/json-response-filter.js`. Current unchanged application and
executable may be reused only after hash identity checks. No app/CSS acceptance
is claimed before runtime results.

Independent command: `bun artifacts/playwright/audit-response-tools.mjs artifacts/playwright/json-response-filter-1791599769200`.
Audit and cleanup records are in the accepted artifact directory. Freeze:
`artifacts/playwright/response-tools-source-freeze.json`.

Follow-up [RESPONSES.md#record-response-feedback](RESPONSES.md#record-response-feedback) reproduces and corrects
success-after-refusal recovery and verifies late Copy/Save ownership with23
groups on a fresh release, plus retained9tools/26filter regressions. The original
catch-only behavior described at this topic's checkpoint is superseded.
Keyboard/assistive technology, actual OS clipboard/picker/file writes, mutable
streaming-body cases, XPath/XML response and every remaining original
migration/shared UI/UX/CSS requirement remain active.

Official references consulted: [Playwright Page](https://playwright.dev/docs/api/class-page#page-evaluate),
[Tauri dialog](https://v2.tauri.app/plugin/dialog/). Installed Tauri plugin-fs
writeFile and dialog save implementations were read for command/payload mapping.


</details>

<a id="record-native-xml-current-acceptance"></a>

<details>
<summary>NATIVE-XML-CURRENT-ACCEPTANCE</summary>

# Current native XML response workflows — 2026-10-13

Saved original XML entry ran exclusively in three modes against unchanged bf5e compiled app/f569 sidecar and the990-source/52-asset closure. Compiler80766 passed0/0. Runtime-test-only harness preservation supplements are declared separately from compiled inputs; no product/backend change or stale binary relabeling.

| Mode | Terminal evidence | Verified boundary |
| --- | --- | --- |
| Full |3330 exit0; full-v1/root-audit.json |22 real HTTP requests/58 workers,7 selections, reload/clear,4 classifications, namespace classification, raw content preservation,4 refusals,4 controlled cancellations,6 controlled worker faults,6 layouts |
| Performance |19395 exit0; performance-v1/root-audit.json |3 HTTP requests/12 real bundled workers; five exact4000-sibling XPath selections and10001-match refusal each167–302ms, below existing3000ms deadline |
| Transfer |46451 exit0; transfer-v1/root-audit.json |1 HTTP request/8 workers;4 filtered transfers, raw/pretty copy, cancelled save and copy/write refusal recovery through controlled native-boundary adapters; fetch/clipboard adapters restored |

All paths are under artifacts/native-xml-current-proof/. Independent audits rehash original compiled sources/assets/exe/sidecar, declared supplement bytes, actual consumed saved harness and archived native/restoration outputs. Every host was hidden before CDP and exited0. Original43resources/20history, both workspace buffers/store/all654cookie bytes, managed Git names and exact three current SplitPane keys plus two legacy keys were restored in every run. Owned collections were registered before save and only their owned cookie additions retired. No live root process/profile claim remains.

The transfer auditor initially expected5 captured writes; it incorrectly omitted the controlled failing write attempt. Immutable audit-count-negative.mjs/json preserve that refusal. The saved scenario remained unchanged and passed. Correct count is6: four filtered attempts, one failing attempt, one recovery; all captured bytes equal original response. These are controlled boundary calls, not actual OS writes/clipboard/dialog acceptance.

Full fault/cancel checks use controlled worker adapters, not a genuinely hung worker. Performance uses actual bundled workers in controlled local Windows native conditions, not every expression/provider/platform. Namespace mapping separately accepted in RESPONSES.md#record-xpath-namespaces; native field-specific ARIA/focused removal/AT remain open. OS transfer, other native workflows, repository freshness correction, hard filesystem/process/platform/private/distribution/SDK/Event/FIFO/full notice/migration/UX gates remain open. Full migration is not complete.

Commit evidence by topic; STATUS records current commit/evidence/remaining gates/handles. This interface cannot invoke /compact, so this is the explicit feature handoff.


</details>

<a id="record-response-feedback"></a>

<details>
<summary>RESPONSE-FEEDBACK</summary>

# Response Copy/Save feedback recovery and ownership

Status: correction and scoped feedback/tools/filter regressions verified (2026-10-10).

Baseline52497/artifact `json-response-filter-1791600297879` exits1 while native
64284 exits0/hidden. Two Copy boundaries settle error then success, but oldErrorCount
stays1 and original numeric text remains. This proves the retry bug. Old production
executable89bbb511 and exact baseline source/build are retained in
`artifacts/native-response-feedback-baseline` and response-feedback-baseline-freeze.json.

ResponsePane now uses raw feedback records owned by a derived request/response
ID, original body/bytes and displayed text. Each operation gets a generation;
retry clears earlier feedback, old completion/timers cannot change a newer
owner/operation and onDestroy invalidates outstanding completions. Display owner
identity prevents feedback reappearing after request/Pretty-Raw round trips.
Existing filter-application errors use the same guard; errors pass role=alert to
the shared Feedback component. Layout/CSS, original-byte Save and displayed Copy
payloads remain unchanged. No reset effect or native/backend/dependency change.

Fresh saved production21725 exits0, started1791600646689/finished1791601074387,
executable SHA256 `20458ce222ec9977976c7dfdeee5be51ba0478feedff73d6f9d40fffa92920cb`.
Frozen692 app/scenario paths match with exactly one app file changed. Initial
scenario and application assignment/declaration diagnostics were corrected before
build; final compiler0/0. Unrelated Timeline formatter changes were reverted.
Saved current frontend headless workspace scenario exits0/eleven checks.

Native feedback11095/artifact `json-response-filter-1791601149652` exits0/native
51684 exit0/native-hidden/visible:false. Twenty-three groups prove two retry/alert
recoveries, cancelled Save, sixteen late success/error cases across request,
response, unmount and Pretty-Raw, two newer-operation guards, older timer and
normal success-icon timeout. The adapter captures18 Copy/15dialog/14write
boundaries (47total) and five actual HTTP Sends. Independent source/build/baseline
failure/literal body/base64/metadata/boundary/timer/restoration audit passes.

Native tools60210/artifact `json-response-filter-1791601261476` exits0/native23580
exit0/native-hidden, nine groups/three Sends/six dark-light width profiles pass.
Independent current692/fresh executable/payload/history/timer/geometry/restoration
audit passes; current dark/light760 images inspected.

Default regression91664/artifact1791601427607 exited0 with26groups, but the
independent audit rejected its workspace cancellation's late snapshot equality:
the destination's separately held worker timed out while native persistence was
read. The immediate stale-callback assertion had passed. Retain this failure;
it does not establish that the old worker changed the destination.

The saved fixture now completes that destination worker before injecting old
callbacks and records destination workspace/request/response/metadata before
and after. Corrected default55009/artifact `json-response-filter-1791602462836`
exits0, native60868 exits0/native-hidden/visible:false, with26groups/11real
workers/21HTTP Sends. The combined regression audit passes late preview equality
and exact destination state equality, plus literal body/base64/metadata,
cancellation/deadline/fault/history and all six responsive profiles. The explicit
acceptance freeze matches692current source paths and records only this default
scenario change; application, feedback helper and executable remain unchanged.
Feedback23 and tools9 remain tied to their earlier harness freeze, rather than
being described as rerun after the default-only fixture correction.

Owned cleanup confirms all five probe PIDs and their exact WebView profiles are
absent; all feature scenario/build handles are terminal. Other processes were
not terminated. Headless workspace eleven checks passed again after the owner
follow-up. Compiler/formatting and commit results are recorded in STATUS.

Previously ResponsePane catch handlers assigned copyError, but successful retries
did not reset it. Feedback/copied state lacked request/response and async
operation ownership. The existing saved JSON response scenario now has a
`INSOMNIUM_RESPONSE_FEEDBACK=1` extension to reproduce recovery before changing
application source, then verify Copy/Save recovery/cancellation, alert semantics,
late success/error after request/response/unmount, overlapping operations and
the normal success-icon timer. Clipboard/dialog/write boundaries are controlled;
other native IPC/HTTP/history remain actual. OS clipboard/picker/write and all
remaining editor/XPath/provider/platform/shared UI/UX/CSS requirements remain open.

Commands: `bun run check`, `bun artifacts/playwright/freeze-response-feedback-baseline.mjs`,
then set `INSOMNIUM_RESPONSE_FEEDBACK=1` and run
`bun tests/ui/json-response-filter.js`. Retain the old executable/build state
before correction and require a fresh production probe after application edits.

Fresh build: `bun tests/ui/build-recovery-copy-probe.js`; source freeze/build
binding: `bun artifacts/playwright/freeze-response-feedback.mjs` and
`bun artifacts/playwright/bind-response-feedback-build.mjs`.
Feedback audit: `bun artifacts/playwright/audit-response-feedback.mjs artifacts/playwright/json-response-filter-1791601149652`.
Acceptance freeze after the default-only correction:
`bun artifacts/playwright/freeze-response-feedback-acceptance.mjs`.
Regression audit:
`bun artifacts/playwright/audit-response-feedback-regressions.mjs artifacts/playwright/json-response-filter-1791601261476 artifacts/playwright/json-response-filter-1791602462836`.
Independent output: `artifacts/playwright/response-feedback-regression-audit.json`;
owned cleanup: `artifacts/playwright/response-feedback-cleanup.json`.

OS clipboard/picker/write, full keyboard/assistive-technology/platform acceptance,
mutable streaming-body cases, XPath/XML and every original migration/shared UI/
UX/CSS gate remain required. The tests control only side-effect boundaries;
native IPC/HTTP and mounted state remain actual. No full migration claim.

Official sources consulted before choosing Svelte state/lifecycle:
[$state/raw](https://svelte.dev/docs/svelte/$state),
[$derived](https://svelte.dev/docs/svelte/$derived),
[onDestroy](https://svelte.dev/docs/svelte/lifecycle-hooks#onDestroy).
Existing saved custom-protocol IPC adapters inform the controlled Save boundary;
no dependency/generator or native backend changes are currently needed.


</details>

<a id="record-response-history-keyboard"></a>

<details>
<summary>RESPONSE-HISTORY-KEYBOARD</summary>

# Response history keyboard and shared styling

2026-10-12: the existing response history popup left Escape unhandled when focus
was inside an item and rendered an interactive button inside each listbox option.
The saved component scenario reproduces the original Escape timeout. Exact old
source, fixture, result and screenshot are frozen at
`artifacts/response-history-negative/manifest.json`.

The popup uses shared Button for its trigger and actual focusable options, with
one option in the tab order and unique popup IDs. Arrow keys open on the current
response and move focus, Home/End move to the first/last entry, Escape closes and
returns focus, Enter/Space select exactly once, and leaving the popup or clicking
outside closes it. Moving focus never selects a response. History colors and
layout remain; feature CSS now has one owner at
`src/lib/styles/features/response-history.css` and uses existing shared tokens.

Contract reference: [W3C listbox keyboard and roles](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)
and [popup selection keyboard guidance](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/).
No new subsystem or generator was required. Svelte JavaScript and Bun only.

Saved commands: `bun tests/ui/response-history.js` (six theme/width profiles),
`bun tests/ui/response-history-app.js` (six actual production-app profiles),
`bun tests/ui/nocturne-theme.js`, `bun run check`, `bun run build`.
All browser launches use launchUiBrowser with headless:true. Actual app checks
select exact503/200 responses, exact rendered bodies, Space/Escape/focus, unchanged
full resources/history across each action, and reload. Theme persistence/setup
settles before each read-only action boundary; no workspace metadata is excluded.

An invalid object-header fixture failed because production response headers are
string tuples; subsequent textarea locator and rendered gutter assertions were
corrected to inspect actual CodeMirror content. These are scenario defects, not
product bugs. Original invalid-fixture result/PNG are retained with an explicit
provenance limitation: its scenario snapshot was captured after correction and
is not asserted to be the original consumed source. The original Escape product
negative has exact source/hash proof. No result is accepted based on those failures.

This is headless acceptance of the current history popup and shared styling.
Fresh native acceptance and broader history/platform/accessibility/whole UI
consolidation/full migration remain open. Existing baseline collection CSS and
other unrelated work are not included in this topic. `/compact` is unavailable;
commit/evidence/live handles and remaining gates are recorded in STATUS.


</details>

<a id="record-xml-request-format"></a>

<details>
<summary>XML-REQUEST-FORMAT</summary>

# Mounted XML request formatter acceptance

PLAN/PARITY's September 28 checkpoint left mounted cancellation, Undo and persistence acceptance unverified. Current source still uses the dedicated XML worker, content-preserving formatter, three-second deadline and workspace work scope. This topic adds saved native UI acceptance for that existing behavior, without modifying application code, CSS, dependencies or CSP.

Saved scenario: `bun tests/ui/xml-request-format.js` with `INSOMNIUM_UI_BUILD_STATE=artifacts/native-recovery-copy-probe/build-state.json`. It runs through `withNativeApp`, which hides its owned native window before CDP attachment. No browser-use or interactive automation was used. Official references consulted: [Playwright page evaluation](https://playwright.dev/docs/api/class-page), [HTML worker lifecycle](https://html.spec.whatwg.org/multipage/workers.html#dom-worker-terminate) and [CodeMirror 5.65.21 manual](https://github.com/codemirror/codemirror5/blob/5.65.21/doc/manual.html); installed editor/formatter source was inspected. No generator or installation was needed for the existing saved scenario infrastructure.

Three real bundled-worker controls cover application/xml, text/xml and a vendor +xml MIME with charset. Literal expected indentation is independent of the production formatter. Each verifies exact saved body, retained extra fields, complete canonical Git codec round-trip, keyboard Undo/Redo and reloaded formatted text. Three real-worker refusals cover malformed XML, empty source and mixed text, retaining the original body.

The explicitly controlled Worker adapter in `helpers/xml-worker-control.js` tests pending-button disabling and six cancellation boundaries: body edit, tab, MIME, request, view unmount and workspace switch. Deliberately delivered late result/error callbacks must not overwrite durable text or display stale feedback. Six controlled fault paths cover worker error/messageerror, response error, actual three-second UI deadline, constructor failure and postMessage failure. These are injected lifecycle/fault checks; they do not simulate a genuinely blocked native worker. Normal and XML refusal cases use the real bundled worker.

Initial native session 98636/artifact xml-request-format-1791593028197 exited one at the test's canonical Git comparison: decode correctly adds `type: Request`, which the assertion omitted. This occurred after real formatting/body preservation, before Undo; it is not accepted as full formatting workflow evidence. The assertion now includes canonical type. Initial compiler found nine missing JSDoc/empty-array/optional-result diagnostics in the new test files, corrected; final compiler has zero errors/warnings. No product correction or build rebuild was required.

Freeze `artifacts/playwright/xml-request-format-source-freeze.json` verifies unchanged 465 application hashes and previous 217 scenario hashes, adding the two new external scenario/helper hashes (219 scenario / 684 total). Reused production build 8123's executable SHA256 is `ca5d0a8f985d896f741dd0de98d421a16f638f7f5a2aa4ae8d432f300ae8abc8`; unchanged application identity, rather than fixtureHash alone, permits reuse. It contains the actual bundled XML worker. Full run67897/artifact1791593242328 is actual terminal0, native59932/exit0/native-hidden/visible:false, with18 recorded groups and six actual workers. Its six cancellation groups initially lacked causal deadline evidence, so their classification remains provisional.

Focused9507/artifact1791593981251 is actual terminal1, native12268/exit0/native-hidden/visible:false. Five cancellation groups met the elapsed<2900ms guard, but workspace switching failed that predicate. No timer-callback record existed to distinguish an executed deadline from a cleared delayed timer. The [HTML timers specification](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#timers) documents scheduling delay and timer cancellation. The revised saved helper observes the actual formatter timer's scheduling, callback and clearing, forwarding unchanged native timer semantics. Elapsed time remains diagnostic; cancellation requires callback never invoked and timer cleared. It also verifies complete secondary request and current editor preservation after deliberately delivered late callbacks. This change does not establish a product bug or accept workspace performance.

`xml-request-format-acceptance-freeze.json` preserves the elapsed-guard source. The new `xml-request-format-timer-freeze.json` preserves causal-guard source, verifies all465 application hashes and executable identity, and changes only the two external scenario files. Initial two JSDoc/timer overload diagnostics corrected; final `bun run check` passes0errors0warnings. Focused6case command: set `INSOMNIUM_XML_CASE_SET=cancellation` and run `bun tests/ui/xml-request-format.js`. Session57655/artifact1791594698016 is actual terminal0, native39976/exit0/native-hidden/visible:false. All six require timer cleared, callback never invoked, retained primary body/extra fields and unchanged complete secondary request/current mounted editor after late callbacks.

Workspace cancellation elapsed34970.5ms, compared with27–586ms for the other boundaries. It cleared the timer before callback invocation, so cancellation is accepted; collection-switch responsiveness is explicitly still REQUIRED. Synchronous snapshot/persistence is a candidate cause from source inspection, not an established diagnosis. No performance, actual hung-worker or OS-close acceptance follows from this result.

Independent audit `bun artifacts/playwright/xml-request-format-audit.mjs artifacts/playwright/xml-request-format-1791594698016` passes, producing xml-request-format-independent-audit.json. It compares independent literal text, full YAML Git fields, all465 application/current219 scenario hashes, preserved three freezes, build8123 and exact executable bytes, hidden-host/native exit metadata and the six timer/destination records. Accepted evidence is composite:12 retained full-run groups (3real-worker workflows,6controlled faults,3real refusals) plus6final causal cancellation groups; no claim that current source reran all18. The strengthened timeout callback assertion in defaultall is not exercised by the focused run; its retained deadline evidence is the original full run's actual timeout feedback/body preservation. All four owned native PIDs49072/59932/12268/39976, final Bun60316 and their exact WebView2 profiles were absent at cleanup inspection. No live feature handles remain. Original full760px mixed-text refusal screenshot inspected: original body and refusal feedback visible.

The full migration/UX/CSS goal stays active. These selected XML cases do not prove every XML document/MIME/large-input/platform policy, actual hung-worker termination, OS-close lifecycle, request Send bytes or native Git synchronization. Broader response XML/XPath/editor/template/provider/platform and all original migration/shared-UI/UX/CSS gates remain required. Record accepted evidence, actual commit and any live handles in STATUS before handoff; this interface cannot invoke `/compact`.


</details>

<a id="record-xml-response-filter"></a>

<details>
<summary>XML-RESPONSE-FILTER</summary>

# Mounted XPath/XML response acceptance

Follow-up [RESPONSES.md#record-xpath-performance](RESPONSES.md#record-xpath-performance) corrects repeated sibling
ordering scans. Fresh release6f744927 verifies4000sibling element/attribute/
scalar/union/reverse-axis outputs within the worker deadline and10001flat
match-count refusal, plus retained36XML/26JSON regressions. The earlier84.223s
Bun diagnostic and old native deadline below remain historical evidence; broader
expression/tree-shape performance and all remaining gates stay required. The
old20458ce2 executable is preserved in `artifacts/native-xpath-baseline`.

Corrected native session4106 finishes with actual exit0. Artifact:
`artifacts/playwright/xml-response-filter-1791603846571`; native67632 exits0,
`native-hidden`, visible:false. All36groups/58real bundled workers/22HTTP Sends
pass: preview, seven selections, reload/Clear, four classification cases,
namespace and mixed-content protection, four real refusals, four controlled
cancellations, six faults and six layout profiles. The independent audit matches
all694current source paths and the existing production executable SHA256
`20458ce222ec9977976c7dfdeee5be51ba0478feedff73d6f9d40fffa92920cb`.
Application/CSS/backend/dependencies are unchanged; the verified release is reused.

Literal output, original body/base64/metadata, history preservation, match-count
and real flat-sibling deadline refusals, old-generation suppression, actual
controlled3second deadline and nonoverlapping controls pass. Current dark/light
760px screenshots were visually inspected; all controls and Help fit. Compiler
70978 exits0 with0errors0warnings; scenario/fixture/doc formatting passes. Owned
cleanup confirms both native PIDs/profiles absent; no live feature handles.
These checks preserve the XML performance and other remaining gates below.

Existing XPath1.0/strict XML parsing and XML prettification are implemented in the
disposable response-filter worker. This feature adds a separate saved native
scenario and literal fixture, reusing the native-hidden launcher and shared
response-worker control. It verifies actual HTTP response bytes/metadata and
real bundled workers for element/attribute/text/scalar/empty selections,
namespace local-name/URI selection, MIME/declaration detection, Pretty/Raw,
reload without resend, Clear, mixed-content preservation and invalid/oversized
match refusal. Cancellation/fault/deadline cases use controlled worker boundaries;
six theme/width profiles capture existing Help and controls.

First native20185/artifact1791603401806 exits1 while native64996 exits0/hidden:
flat10001siblings hit the real3second worker deadline before the fixture's
expected match-count refusal. Eighteen earlier groups pass; retain this failure.
A Bun diagnostic reaches `10000 matches` after84222.954ms for flat `//item`;
its subsequent `/root/item` probe was intentionally stopped (exact owned PID58432,
session75805 terminal1, no second-selector completion claim). Grouped10001matches
reaches the match-count refusal in668ms. The revised fixture retains flat `/wide`
as an exact native deadline case and adds grouped `/many` for actual match-count
refusal. Large flat-sibling performance remains a required gate.

Command: `bun tests/ui/xml-response-filter.js`; production build state defaults
to `artifacts/native-recovery-copy-probe/build-state.json`. Reuse is conditional
on all465application paths and executable20458ce2 matching the accepted response
feedback release. Freeze command:
`bun artifacts/playwright/freeze-xml-response.mjs`. Do not edit frozen source
while the scenario is live. Compiler: `bun run check`.
Independent audit:
`bun artifacts/playwright/audit-xml-response.mjs artifacts/playwright/xml-response-filter-1791603846571`.
Audit and owned cleanup records are `independent-audit.json` and `cleanup.json`
inside the accepted artifact. Exact current freeze:
`artifacts/playwright/xml-response-source-freeze.json`.

Consulted official [XPath API/examples](https://github.com/goto100/xpath) and
[xmldom parser/serializer](https://github.com/xmldom/xmldom). Existing dependencies
and generators remain unchanged. Literal expected XML is stored in the fixture;
the mounted expectations do not invoke production format/filter functions.

XML Copy/Save side-effect boundaries, namespace mapping UI, actual hung workers/OS boundaries, full accessibility,
mutable streaming bodies, other platforms and every remaining original
migration/shared UI/UX/CSS requirement remain required. Current layout is preserved;
CSS corrections require observed evidence. Full migration is not accepted.


</details>

<a id="record-xml-response-transfer"></a>

<details>
<summary>XML-RESPONSE-TRANSFER</summary>

# XML response Copy/Save boundaries

The saved XML response scenario has a focused transfer mode. It exercises the mounted production Tauri response pane through a real HTTP Send and bundled XPath workers. The shared transfer adapter captures clipboard text, save-dialog options and file-write bytes; unrelated native IPC passes through unchanged. JSON tools uses the same adapter and retains its previous acceptance schema.

```powershell
bun run check
$env:INSOMNIUM_XML_RESPONSE_TRANSFER = '1'
bun tests/ui/xml-response-filter.js
Remove-Item Env:INSOMNIUM_XML_RESPONSE_TRANSFER
$env:INSOMNIUM_JSON_RESPONSE_TOOLS = '1'
bun tests/ui/json-response-filter.js
Remove-Item Env:INSOMNIUM_JSON_RESPONSE_TOOLS
```

XML checks cover element, text, scalar and empty XPath outputs; Copy receives the displayed result while Save receives the original UTF-8 response bytes. Raw and cleared Pretty have separate literal Copy expectations. Cancel produces no write. Clipboard and file-write refusals appear as alerts; successful retries clear them. Response history/body/base64 remains unchanged. Fetch and the clipboard descriptor are restored in finally and asserted after the scenario.

Artifacts include `copy-save-boundary.json`, `transfer-acceptance.json` and native `result.json`. Source freeze `artifacts/playwright/xml-transfer-source-freeze.json` binds 466 unchanged application files and 233 scenario files to executable SHA256 `6f74492748f828bc4344e435e13b172bd99da100ff104e3ec7cb34ca5e34d8ca`; no application or CSS change is involved.

This controlled transfer boundary does not prove actual OS clipboard, file picker, filesystem permissions or other platform behavior. Non-UTF-8/binary XML bodies, streaming, namespace mapping UI, accessibility, template Send integration and all other migration/UX gates remain required. Native hosts use `native-hidden`; browser scenarios retain shared `headless: true`.

XML session61262 completed with terminal0. Artifact `xml-response-filter-1791607405462` records8groups/8real workers/1HTTP Send, native32968 exit0/native-hidden/visible:false. Independent audit verifies699source paths, executable identity, literal8copies/7dialogs/6write payloads of original68bytes, durable response/meta and adapter restoration. Initial audit-only expected counts9groups/5workers were corrected to the scenario's actual8groups/8workers; no scenario failure or rerun occurred.

JSON tools93753 completed with terminal0. Artifact `json-response-filter-1791607507000` records9groups/3HTTP Sends/six dark-light1440/900/760 layouts, native53076 exit0/native-hidden/visible:false. Independent audit verifies original152byte write payloads, unchanged literal/body/base64, adapter restoration and raw control geometry. Current760dark/light screenshots were inspected; controls fit. Compiler0errors/0warnings and source/executable recheck pass. `artifacts/playwright/xml-transfer-cleanup.json` verifies both owned native PIDs and exact WebView profiles absent. Initial cleanup query matched its own PowerShell command text; restricting profile checks to WebView2 processes fixes that observation error without terminating any process. No live feature handles remain.


</details>

<a id="record-xpath-namespaces"></a>

<details>
<summary>XPATH-NAMESPACES</summary>

# XPath namespace migration

## Current state — 2026-10-14

Current original-profile acceptance is verified at source commit787cce7. Build66288/attempt-6 finishes0 after Rust9m52, with normal Tauri hook and immutable complete pre-Cargo source/package/lock/Cargo/tool/frontend/worker/notices/full-private inventories independently rechecked afterward. Actual exe SHA1e1510c3d67dced5debd1864361aa4430f224d9019499fcf735b2a4f5b025390. Operator78582 at artifacts/native-namespace-audit-probe/attempt-6/operator-1791992078954 passes original20/three actual sends/20 worker events and additive88 across8 dark/light profiles. Scenario xml-response-filter-1791992171965 uses original identity app.insomnium.probe.checkout20260929; native-hidden host648 exits0.

Independent audit confirms all20 original history rows survive the three sends under fixture-only capacity23, exact settings restoration, all5 actual post-restoration layout reads, ONE original resource preserver, complete protected/plugin/cookie baseline and13783 managed Git files. Host and all6 independently required children authenticate against retained kernel handles with dense call sequence and closed handles; terminal startup classification exempts no required child. Separate release19862 passes cleanupOnly:false/fullOriginalNamespaceScenarioAccepted:true/liveHandles:[] against externally reviewed binding SHA76b42885adb6334a6b579db8dd4c76432d9c1ebb19435fe8aeaddcfe8042326a. Claim remains preserved as historical evidence. Compiler72262 passes0 errors/0 warnings; saved environment guards12 and XPath296 comparisons/14709 positions/11 restorations/4 templates pass. This closes the named current Windows operator gate; universal loader/linkage/all-birth/physical-width/OS-close/AT and other-platform gates remain open.

Saved commands: bun tests/ui/build-namespace-probe.js <fresh-output-under-artifacts/native-namespace-audit-probe>; bun tests/ui/namespace-operator.js --run <actual-build-state.json>; after independent acceptance, bun tests/ui/namespace-operator.js --release <actual-build-state.json> <actual-operator-binding.json> <reviewed-binding-sha256>. A failed run may receive only an explicit --release-cleanup after restoration/physical checks; it cannot receive scenario acceptance. Original failed operator/release receipts remain immutable. Microsoft documents [CIM microsecond precision](https://learn.microsoft.com/en-us/windows/win32/wmisdk/cim-datetime) and [GetProcessTimes FILETIME](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes); process checks use the actual declared CIM interval. [Tauri beforeBuildCommand](https://v2.tauri.app/reference/config/#buildconfig) supplies the pre-Cargo boundary. Full Windows loader/linkage, all births, physical-width/OS-close/AT and other platforms remain separate gates.

### Retained build and scenario failures

First current build89944 stopped before Cargo/ledger publication at declared package resolution, without opening or claiming the original profile. Bun builtin names buffer/url require explicit installed browser entries; codemirror-graphql has no usable package root and the maintained editor uses eight specific imports. The guard now records both domains and all actual subpaths, checks them before expensive installed-tree hashing, and keeps lock identity and complete byte inventories mandatory. All48 declared non-type resolution probes pass. The corrected fresh output is artifacts/native-namespace-audit-probe/attempt-2; compiler45989 passes0 errors/0 warnings. Build-state byte descriptors and externally supplied release binding hashes are now enforced before imports.

Build3739/attempt-2 retained an immutable complete pre-Cargo ledger and compiled the actual release executable in8m34, then ended1 during post-Cargo validation: default Bun.which did not observe this Bun1.4.2 Windows process's updated PATH and reported link missing. Explicit PATH resolves the authentic MSVC linker. The hook's PATH also contains normal project/ancestor node_modules/.bin prefixes added by Bun CLI. Fixes must validate/replay only that recorded producer context, retain actual resolved tool-byte checks and the complete before/after comparison, and never rewrite the old ledger or accept this failed build. The original profile was not opened/claimed. [Bun.which explicit PATH](https://bun.sh/docs/runtime/utils#bun-which) documents the supported resolver argument.

The corrected guard supplies explicit PATH to every owned tool lookup, emits one canonical Windows PATH key (spreading process.env alone retained Path and lost the constructor's .PATH result), and permits only bounded project/ancestor .bin prefixes on the exact parent suffix. Revalidation temporarily restores the recorded producer PATH, hashes actual resolved tool bytes and the complete input scopes, compares the full environment, then restores parent PATH even on refusal. It never rewrites before-cargo.json. Saved bun tests/ui/native-build-environment.js passes10 groups: actual linker/idempotent setup, exact/known-prefix admission, foreign/relative/changed-parent/empty/bound controls, and early rejected capture with parent PATH restoration. Compiler42237 passes0 errors/0 warnings. These were guard-only receipts at that checkpoint; current operator acceptance is recorded above.

Build52126/attempt-3 compiled Rust in8m25 then ended1 at the complete Cargo metadata comparison. The metadata-only saved hook deliberately exits41 before compilation and reproduces the original pre-Cargo raw SHA ef5549b9a06d5be03bf9392d388a3ac7a701194ace7f172cf215aa86fba576d0; eight default parent reads consistently return f46126b3be720118092e44d88c0bc7483b89a75ee988efab1a0856fd7010a21a. Comparing parsed outputs finds3125 physically equivalent registry path spellings and zero other differences. Passing env:{...process.env} to the same parent metadata command produces the exact hook SHA, proving this Windows process's default subprocess environment did not reflect its updated CARGO_HOME. Use documented [Bun subprocess environment forwarding](https://bun.sh/docs/runtime/child-process), retain exact raw metadata checks and full parsed/raw diagnostics in future ledgers, and leave failed ledgers immutable. Evidence stays in attempt-3/metadata-hook-diagnostics.json, metadata-diagnostics.json and metadata-repeat-diagnostics.json. No native app or original profile was opened/claimed; every build/diagnostic process is terminal. Correction is verified: the fixed parent helper matches the actual hook raw SHA exactly, saved environment regression passes11 groups through an actual Bun child, and compiler30894 passes0 errors/0 warnings. All three owned subprocess sites explicitly forward current environment. Build10627/attempt-4 now finishes0 with full source closure verification after Rust8m58; the actual app SHA is b370b90a1d326aaa461e23aa7470341dd940410355883fd32dda9339a92cff6b. Operator8555 then fails before output/claim/app at a blanket recovery-filename prohibition. The exact reviewed baseline already contains repo-git_pw_1791356525503_83aca9b4/.git/insomnium-restore-ref-locks-v1.json (414bytes, SHA4762dac534b3ddb82e2e641424cc78a6827c366c448ed5164e471052b339af90). Preserve it and all baseline lease files; admit only the pinned path/hash while continuing to reject new/altered recovery records and compare all13783 files. No profile bytes were changed. Build success does not imply namespace acceptance; the corrected guard requires a fresh source-bound build. Exact historical admission and wrongpath/size/hash/suffix refusal pass the saved12-group regression; no profile writes occurred. Compiler47994 passes0 errors/0 warnings. Build67733/attempt-5 finishes0 after Rust8m48 and full closure checks. Operator39612 launches genuine native-hidden host28192/exit0; saved scenario xml-response-filter-1791990051820 fails peer-response isolation before additive88. Exact peer selection, actual200/127B/filtered2, correct peer metadata and retained original20+root2 history show a durable-persistence race: peer helper waits only preview and immediately reads disk once, while execute publishes response/remember before awaiting the serialized persistence queue. No product fix or history-capacity waiver is supported. The saved branch must additionally await fresh persisted peer response and one new owned wire entry. Cleanup release45951 independently passes full baseline restoration and every retained host/child handle; claim is preserved, no live handles, namespace acceptance stays false. Negative peerResponse:null receipt remains unchanged. The same helper is corrected in two segments (+44/-1) to verify selected peer and fresh durable history/URL/status/body/base64 plus one actual /mapped wire entry. Compiler72262 passes0 errors/0 warnings; existing XPath regression passes296 comparisons/14709 positions/11 restorations/4 templates. Helper SHA144b67d489fb30972c09de07d47e43ad613a5f9c1319f034c737f182b86fdaf8; Attempt-6 subsequently verified the complete original20+88 and separate release as recorded above.

Current functional native replay1791973441156 passes the original20 cases and additive88 field cases across8 dark/light width profiles on the integration identity:20 workers/3 HTTP sends, native-hidden host45832 exit0, exact original profile bytes/file set and layout restored. Current compiler validation passes0 errors/0 warnings. This earlier integration-only receipt is superseded for the original operator by the current acceptance above; it does not claim all process births, OS-close, physical screen width, AT or universal platform acceptance.

The maintained tests now include xml-response-namespace-fields.js; its promoted runtime initially matched the reviewed artifact helper after import relocation/type annotations. Native replay exposed an ordering assumption at the final save: Rust-loaded object key order differs from in-memory UI row order. The helper now reads the exact edited first prefix input instead of choosing the first native-object key; expected mapping, response preservation and durable reload assertions remain unchanged. Failed receipt1791973323389 and successful restoration are retained. The original failed frozen operator is not relabeled as passing.

Fresh current-source component replay: saved session91439 exited0; namespace-component-measurements.json independently confirms88 checks,8 theme/width profiles, zero failures and native:false. No native gate is closed by this component result.

Run the existing saved component scenario with bun tests/ui/xml-response-filter.js --namespace-component. Native execution additionally requires the matching executable, source/package closure, complete profile/history/Git/layout preservation, recorded-process audit and explicit release. An older passing executable does not close the current integration gate.

## Topic records

Historical and proposal records below retain their original scope and evidence. Their pending statements describe their own checkpoint; use the current-state section above for the next action. Source documents consolidated at commit414d712; original bytes remain available in Git.

## Namespace implementation and original acceptance


Focused acceptance: corrected native57329/artifact1791609117446/native68888 completed terminal0/exit0/native-hidden/visible:false,20groups/20real workers/3HTTP Sends/six layouts. Independent702source/release01515fc0/literal/body/base64/meta/request-isolation/generation/geometry audit passes. Old controlled worker was cancelled at1254.5ms, before its unchanged3s deadline; both deadlines are cleared before firing, and late message/error/messageerror callbacks do not replace current output. Current760dark/light dialog images inspected; inputs/buttons fit. Default XML56419/artifact1791609854193/native69468 completed terminal0/exit0/native-hidden/visible:false,36groups/58workers/22Sends/six layouts; independent literal/body/base64/meta/history/generation/deadline/all-six-control geometry audit passes. Current760dark/light pane images inspected; wrapping keeps all controls inside the pane.

Default JSON35666/artifact1791610359623/native62828 completed terminal0/exit0/native-hidden/visible:false,26groups/11workers/21Sends. Independent current702/release01515fc0/literal/body/base64/meta/history/destination/generation/deadline audit passes. `artifacts/playwright/namespace-cleanup.json` finds all six owned native PIDs and exact WebView profiles absent; no live feature handles remain. Final compiler83351 passes0errors/0warnings after a comment-only checks-array JSDoc fix (preceding2512 found2helperinferenceerrors). The prior helper bytes/hash match exactly after removing that one type annotation, retained in namespace-before-typing-comment.js/namespace-before-comment-freeze.json; application/runtime source unchanged. All three native independent audits were rerun against the final702binding and pass. Formatting and diff review are final commit gates.

The XML response filter now offers a Namespaces dialog. Mappings are saved locally in the selected request's `request_meta.responseXPathNamespaces` alongside its filter/history; unknown metadata stays intact. Clear removes only the expression. Add/remove/edit, Cancel/Escape and save validation use existing shared Input/Button/Feedback/Modal components. The response filter toolbar can wrap when its controls need more width.

The bounded response worker receives the mapping and uses the documented [`xpath.useNamespaces`](https://github.com/goto100/xpath#namespaces-with-easy-mappings) resolver inside the existing immutable document-order wrapper. [XPath 1.0](https://www.w3.org/TR/xpath-10/) resolves expression prefixes separately from document declarations; default XML namespaces need an expression prefix. Unprefixed names continue matching no namespace. Mapping changes form a new worker generation and invalidate the displayed result immediately; late old callbacks cannot replace current output. Template response extraction keeps its existing API/behavior.

Validation follows [XML namespace NCNames/reserved bindings](https://www.w3.org/TR/REC-xml-names/) and XML1.0 Fifth Edition NameChar ranges, with application limits32mappings/128prefixcharacters/4096URIcharacters. Blank editor rows are ignored; duplicate/invalid/empty bindings are rejected. URI comparison is literal, no network lookup. The `xml` prefix retains its standard binding; `xmlns` and the XMLNS URI are reserved. Null-prototype maps prevent inherited resolver lookups. Saved metadata is local, consistent with the existing request filter; request_meta is excluded from Git collection resources.

```powershell
bun run check
bun tests/xpath-select.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_XML_RESPONSE_NAMESPACES = '1'
bun tests/ui/xml-response-filter.js
Remove-Item Env:INSOMNIUM_XML_RESPONSE_NAMESPACES
bun tests/ui/xml-response-filter.js
bun tests/ui/json-response-filter.js
```

Saved focused native mode covers validation, default/multiple namespaces and alias prefixes, text/attribute/scalar/empty results, durable reload, cancelled edits/focus return, remapping/Clear, six theme-width dialog profiles, generation cancellation/late faults, removing all mappings and request isolation. Real Send and bundled workers handle normal cases; only the cancellation case uses the shared saved worker controller. Frozen inputs: `artifacts/playwright/namespace-source-freeze.json` (468app/234scenario702paths); old production6f744927 is preserved in `artifacts/native-xml-transfer-baseline` before the new build.

Preparation checks: initial compiler runs reported2declarationerrors/4initial-valuewarnings, then8helpertypingerrors; those were corrected and compiler0/0 passes. Retained XPath296results/1matching upstream refusal/14709position comparisons/11restoration fixtures/4template checks passes. Native acceptance and subsequent gates are recorded above; no general OS/accessibility/platform/streaming/template Send/full migration or UX completion is claimed. Historical attempts and corrections follow.

Initial build8419 was intentionally cancelled by stopping verified owned compiler59096/parent49128/launcher69352 after source review found the reactive mapping needed a snapshot before worker transfer. Its terminal1 state is retained in `artifacts/playwright/namespace-cancelled-build.json`; no acceptance was claimed. Mapping payload now uses `$state.snapshot`, refreshed702source freeze/compiler0/0 pass and corrected production2926/launcher69440 runs from those inputs. Saved headless workspace11 passes the corrected frontend.

Corrected production2926 completed terminal0/optimized6m18s, started1791608335505/finished1791608721445. Executable SHA256 `01515fc0526bc20cfc56ebf01005051805df164432b122877377ce44f81bdd08` binds to current702paths and the isolated probe identity in `artifacts/playwright/namespace-build.json`. After build terminal0, only exact XML/JSON controlled-worker payload assertions were updated to include optional `namespaces: undefined`; application/embedded fixture hashes remain unchanged. Original build inputs remain in `namespace-build-source-freeze.json`, execution harness in `namespace-source-freeze.json`.

First focused61020/artifact1791608745329 failed at the durable-map poll (actualterminal1, native64912 exit0/native-hidden). The saved helper initially compared JSON key order; native serialization can sort keys differently. It now compares exact prefix/URI content and records partial evidence in namespace-map-progress.json. Only this helper changed after the failed runtime ended; unchanged468application paths/executable01515fc0 and refreshed702binding pass, initial execution freeze retained in namespace-first-attempt-freeze.json. Corrected focused77549 is pending; no acceptance claimed yet.

Second focused77549/artifact1791608900063 completed terminal1/native68460 exit0/native-hidden after17partial groups, including real selections, reload, four UI refusals, Cancel/focus, remap/Clear and six layouts. Native progress confirms requested n,m mapping is persisted as sorted m,n. The controlled current worker expired during the helper's persistence wait; the real3s deadline stayed unchanged. The helper now edits the existing row and delivers the new controlled result before slow persistence polling, saving before-completion timer records. Only helper changes followed terminal failure; unchanged application/executable and refreshed702binding pass. Third focused57329 pending; no full acceptance claimed.

First default XML78448/artifact1791609305605 completed terminal1/native1188 exit0/native-hidden after all30workflow groups (progress records55workers/21Sends). Its first layout count still expected5controls while the new Namespaces button makes6. The saved scenario now expects6 and explicitly checks the Namespaces button; the independent audit compares every pair of all6controls. Only this XML scenario changed after terminal; application/helper/fixture/namespace branch and executable01515fc0 remain unchanged. Current702freeze preserves the pre-layout-refinement snapshot. Full default XML56419/artifact1791609854193 rerun pending; focused20 acceptance remains valid.

<a id="record-agent-namespace-fields-20261013"></a>

## AGENT-NAMESPACE-FIELDS-20261013


## Verified isolated implementation

After parent review of the frozen negative, ResponseNamespaces now adopts existing Field with additive `density="compact"`. Central forms.css owns compact6px gap and12px/18px normal caption, with inherited color; default Field DOM attribute omitted and existing default styles unchanged. No tokens/palette/global default changes. Exact numbered aria names remain stable valid/invalid. Typed NamespaceRowError carries authoritative row/field(s), preserving namespaceRows trimming, output, messages and precedence; duplicates mark all affected nonempty rows, reserved pairs mark prefix+URI, omitted blank rows are not attributed. Independent correction retains a still-invalid URI even if another prefix becomes invalid. Callback false/throw remains form-level. Focused removal chooses same-index surviving Remove, then previous, then Add; pointer/data/numbering/32cap preserved.

Final frozen `artifacts/namespace-field-proof/final/audit.json` SHA **503c1b034055c6b47571caeebf57c5f48f5a20a89e85eef721584a426ac2c117** binds677source/49frontend/66harness files (792total), exact11path guards, source and outputs. Mapping: sourceHashes under `final/source`, frontendHashes under `final/frontend`, harnessHashes relative to `final/` (`scenarios/...`, `verification/...`); `guards.json` binds exact current root originals/whole LF equality/new raw SHA. Nine existing originals match current root LF Git bytes; two namespace fixture paths must be absent. Earlier root original raw vs own CRLF bytes archived separately; no baseline product copies offered.

Terminal verification:

- `bun tests/ui/xml-response-filter.js --namespace-component`:4289 exit0,8profiles/88recorded checks,32refusals/48 exact affected field associations+distinct IDs,24 real keyboard removals/8 label clicks,512 exact32cap numbered textbox names,8 callback refusals+trimmed corrected saves/raw-response preservation. All earlier invalid/no-save/Escape assertions retained.
- `bun tests/ui/design-system.js`:98648 exit0, six compact/default profiles and all original assertions. SAME form-geometry now separately measures compact6px and default7→11px overridden token/restoration; default assertions remain intact.
- `bun tests/ui/resource-manager.js`:f0af7b exit0; previous accepted Field workflow unchanged.
- `bun run build`:d90ed6 exit0. `bun run check`:76937 terminal0errors/0warnings with explicitly isolated preview-helper supplement5493d735. Original own baseline has four preexisting fetch-option errors; initial40794 also exposed one new fixture type error, corrected before final acceptance. Supplement is consumed/frozen under final/source and original under final/verification, restored byte-exact before commit; `preview-restore.json` records restoration and it is NOT offered/staged. Ignored generators only; package/lock unchanged.
- Manual Bun receipts:11old/new validator output/message equivalences, structured duplicate indices, independent URI correction and omitted blank attribution; full geometry/style comparison EXACT for104controls/48captions/rows/dialog across8profiles.

Multiple legitimate field alerts require native helper presence `.first().waitFor()` instead of unique locator wait. Frozen audit proves entire original native helper body equal except this approved presence line, and original entry equal except explicit component branch; all original state/refusal/Escape/namespace assertions preserved. No native run or current native acceptance claimed.

Neutral geometry measurement uses a real hint click+pointer away. Earlier close-button-only background differences were keyboard focus modality (shared focus.css), not Field geometry; namespace rectangles/fonts/colors/backgrounds were exact throughout. Geometry comparison failures remain in the tool transcript; baseline and final exact metrics remain immutable. Design-default-only oracle failure is archived under `design-default-oracle-negative`. A corrected-save harness predecessor expected edits after Cancel had discarded them; archived under `corrected-save-harness-negative`, then actual accepted retry edited before Save with strict expected values retained. Caption comparison covers captured text/font/gap; caption color is inherited by scoped compact CSS and was not separately captured in the baseline.

Remaining gates: root guarded integration/current-root replay, fresh native namespace persistence/focus/generation, duplicate-announcement AT behavior, platform/private/global migration/UX. This isolated frontend is baseb95 plus owned accepted ResourceManager and this topic, not root's entire current runtime/native generation. All handles terminal; no profile claimed. Earlier Resource775 proofs immutable. `/compact` cannot be invoked by this interface; explicit handoff only.

## Original measurement checkpoint (immutable)

Measurement only, ui-next at 53ecbc0 before implementation. ResponseNamespaces and namespaceRows were unchanged. Current root raw originals are archived under `artifacts/namespace-field-proof/baseline`; every complete normalized LF source equals the corresponding own source. Root ResponseNamespaces raw SHA e1a5f076641835669a177027be855268618be6670662d2aba779553342bdca07; own raw SHA 1274a5aa94d88c46fe60f3b7cbd022121ca19e97f8333393b48c6bc8bb52d35d.

## Saved negative

`bun tests/ui/xml-response-filter.js --namespace-component` exited 1 (session43507). The explicit component branch exits before native execution. Actual component fixture, local snapshot only; no Tauri shim, workspace persistence, network, native profile or native acceptance. Existing native scenario body and helper assertions remain intact.

Frozen `artifacts/namespace-field-proof/negative/audit.json` SHA **0f9f7d94da432043225ab508758569bd28c00d238bded0300386180c787f80b4** binds source snapshots and exact emitted fixture bundle/result/measurements/failure screenshot. Eight profiles: dark/light ×1440/900/760/560, height600. 80 recorded checks and48 failures:

- 32 field association failures: duplicate prefix, invalid NCName, missing URI, reserved binding each refuse without save but have no input ID/aria-invalid/describedby. Exact numbered accessible names are already valid and stable; submit focus remains unchanged.
- 16 keyboard removal failures: after middle-row Enter removal preserves reused Remove2 focus, removing the last row with Space or the only row with Enter moves focus to BODY.
- Escape restores trigger focus and preserves local namespaces/save count/raw response. All32-cap cases disable Add and retain64inputs; no callback/data changes.

## Density contract measured before adoption

Labels and row gap are exactly6px, label font12px/18px normal; controls12px/16.8px, height34.796875px. At1440/900/760 the660px dialog has columns132.562/397.734/67.7031px. At560 it is528px wide and stacks into one478px column, within viewport and without horizontal overflow. Dark/light control colors/backgrounds and full rectangles are retained in measurements. Keep6px rather than adopting global Field7px implicitly; preserve exact control geometry and responsive breakpoint. Caption API changes require explicit review.

## Attribution boundaries for review

`src/lib/xpath-namespaces.js` validates trimmed nonempty rows, unique prefixes, XML NCName128, URI4096/no whitespace, reserved xml/xmlns pairs and32mapping cap. Duplicate and NCName failures identify prefix; URI failure identifies URI. Reserved bindings can involve either/both prefix and URI, so do not falsely classify them as prefix-only. Save callback false/throw remains form-level and must not mark local fields. Existing `namespaceRows` normalization and raw response/request metadata behavior must remain unchanged.

Proposed bounded correction after parent review: adopt existing Field locally with exact numbered accessible names/description IDs, scoped6px dense geometry, clear only corrected errors, and explicitly restore usable dialog focus after focused-row deletion. No global Field/tokens/styles changes. Next saved assertions should retain original four refusals/no-save/Escape, exact labels valid/invalid, correction and form-level callback failure, numbering,32cap and geometry.

## Documentation and gates

Primary sources consulted: [Svelte each/key semantics](https://svelte.dev/docs/svelte/each), [WAI description ID relationships](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA1), [WAI form labels](https://www.w3.org/WAI/tutorials/forms/labels/). These inform DOM identity and association; they do not establish platform acceptance.

At this original measurement checkpoint all handles were terminal, browser/server closed by shared fixture finally, and product correction/compiler/build were pending. The verified implementation above closes isolated compiler/build/component gates only. Earlier Resource775 proofs and e9c6099/53ecbc0 remain immutable; native/AT/platform/full migration still OPEN. /compact unavailable in this interface.

<a id="record-native-namespace-acceptance"></a>

## NATIVE-NAMESPACE-ACCEPTANCE


Compiler66233 completed with zero errors/warnings. Saved native-hidden90664 completed successfully using the unchanged bf5e compiled app, adjacent f569 sidecar and frozen 990-source/52-asset closure. The XML entry has an explicitly declared runtime-only preservation supplement; no product/backend changes.

Independent audit: artifacts/native-namespace-current-proof/runs/current-layout-v3/root-audit.json. Namespace mapping save/reload/replace/clear/remove, exact raw response and per-request isolation passed: three real HTTP requests, twenty workers, fifteen validator refusals and six layout profiles. Controlled worker-generation checks remain synthetic. This does not independently prove native field-specific ARIA, focused-row removal or assistive technology.

Original buffers, store, all 654 cookie bytes and managed Git names were restored. The owned collection was registered before mutation; only its owned cookie additions were archived and retired. Exact current SplitPane keys nocturne:split:workspace-left, nocturne:split:request-response and nocturne:split:design, plus two legacy keys, were captured/restored. Host exited successfully and profile claim is released; no live handles.

Correction: native structural commit542e177 and namespace preservation-v2 checked only legacy layout keys. Their other proofs remain valid; their layout claim does not cover current SplitPane storage. Original evidence is retained. The first namespace44479 failure occurred before fixture save because the wrapper invocation was omitted; immutable negative evidence remains available. Corrected27530 and90664 runs passed full preservation.

Commit by topic after verification. This interface cannot invoke /compact; this report and STATUS provide the explicit handoff. Full migration, production-shell parity, repository coherence, other native workflows, platform/private/distribution, SDK/Event/FIFO, complete notices and remaining UX gates stay open.

<a id="record-current-namespace-offer-review"></a>

## CURRENT-NAMESPACE-OFFER-REVIEW


Root independently copied and rehashed the immutable 21-file offer with manifest SHA256 `c0906dc141fa8d2e4212e07b2139818f78bfe6eccd2732d2fc8469f8273c2778`. All five current Root baselines and eight references match. Root pure child 55952 exited 0: 27 checks, whole original entry inverse, whole component prefix inverse and eight syntax checks pass. Post-check source hashes remain unchanged.

Evidence: `artifacts/namespace-offer-root-review/review.json`, manifest, saved snapshot and pure stdout/stderr. The initial Root review script used the wrong manifest property name and refused before imports/native/profile access; corrected to the actual `rootBaseline` array. No product changes or native acceptance result from this review.

Before execution, Root requires a new independently recorded host/descendant receipt and actual post-restoration layout serialization. native_provider is preparing those additions separately; the frozen offer remains unchanged. Actual literal source/package closure, fresh capture, parent-bound operator, original 20 plus additive 88 native groups, retained required process objects, complete filesystem/history/settings/layout restoration, independent case audit and explicit profile release remain open. Genuine production run-drain refusal remains a separate gate.

Root has no live handles and no profile claim. Commit verified work by topic. `/compact` is unavailable in this interface; this document is the feature handoff. Every remaining migration, distribution and UX/CSS requirement remains active.

<a id="record-current-namespace-identity-layout-review"></a>

## CURRENT-NAMESPACE-IDENTITY-LAYOUT-REVIEW


Root independently rehashed all 34 sources from manifest `3c445e4006534536b8664c04f84a144a52ed18b2d00ea4b13085a3b5db333601`, all 13 current Root references/baselines and the frozen original 21-file parent offer. Root children 36840 and 49432 exited 0: original 27 guards, 13 process identity refusal checks, four layout refusal checks, eight inherited and seven new syntax checks pass. Whole refined-entry → prior-entry → original-entry and component prefix inverses pass. Every source hash remains unchanged after replay.

The existing native callback supplies actual `pid`; the refined entry records owned host and transitive descendant CIM identity snapshots before first fixture save and before close. Those snapshots record parent/path/UTC creation and host executable hash, without claiming kernel settlement. The copied authenticated observer/classifier/adapter still requires every recorded child to match retained kernel-object receipts and dense raw calls, WAIT258→WAIT0 and successful close; classified terminal attempts cannot substitute for required children.

The original layout equality assertion is preserved. A single actual post-restoration localStorage read now feeds both that assertion and `restoredLayout` in the receipt. The old `after` field remains explicitly pre-restoration. No value is inferred from a passing flag.

Evidence: `artifacts/namespace-refinement-root-review/{manifest,review}.json`, frozen snapshot and two pure execution outputs. Root has not executed CIM, Win32 or native scenario for this offer. Final source/package capture must use the refined entry and actual outer operator dependencies; the earlier package discovery is not launch authority. Original 20 plus additive 88 cases, full filesystem/history/settings/Git/layout restoration, authentic required process proof, independent audit and separate profile release remain pending. Genuine production drain refusal is a separate open gate.

Root handles none/profile unclaimed. All migration/distribution/UX gates remain active. `/compact` unavailable; explicit feature handoff.


</details>

<a id="record-xpath-performance"></a>

<details>
<summary>XPATH-PERFORMANCE</summary>

# XPath document ordering performance

Status: correction and scoped native performance/XML/JSON regressions verified (2026-10-10).

Preserved old20458ce2 native baseline49969/artifact1791605011929 exits1 while
native69892 exits0/native-hidden/visible:false. Its first4000sibling //item
selection fails with `Wide XPath failed: Response filter exceeded 3 seconds`.
Independent current-harness/old-executable/failure audit passes. Baseline input
bytes are asserted by the saved native Send helper; no separate failure wire
snapshot or successful baseline4000selection is claimed.

Fresh saved production25226 exits0, started1791605131747/finished1791605608287.
Build binding matches all466application/231scenario paths (697total), retained
old executable and fresh production release SHA256
`6f74492748f828bc4344e435e13b172bd99da100ff104e3ec7cb34ca5e34d8ca`.
Final compiler74025 exits0/0errors0warnings; saved headless workspace11 passes.

Native performance35348/artifact1791605621469 exits0, native67280 exits0/hidden.
Six groups/12real bundled workers/3HTTP Sends pass: ordered4000elements1678.1ms,
attributes1584.6ms, count1882.1ms, reversed union1721.7ms, reverse-axis1506.2ms
and10001flat match-count refusal1774.5ms. These measure UI submission/poll/CDP
completion, not pure evaluator CPU time. Independent literal ordering/full body/
base64/meta/current697source/build/retained baseline failure audit passes.

Current default XML80452/artifact1791605753209 exits0, native62936 exits0/hidden,
with36groups/58real workers/22Sends/six layouts. Current-source/executable,
literal outputs/payload/meta/history/cancellation/deadline/geometry audit passes;
flat10001siblings now hit actual10000-match refusal. Current dark/light760px
images inspected; app layout/CSS preserved. Current JSON62554/
artifact1791606363642 exits0, native54024 exits0/hidden, with26groups/11real
workers/21Sends. Its independent697-source/build/literal body/base64/meta/history/
destination/worker/deadline audit passes. Aggregate cleanup confirms owned
native69892/67280/62936/54024 and all four exact WebView profiles absent; all
feature scenario/build/compiler handles are terminal. Unrelated processes were
not terminated. Formatting and diff checks pass; commit checkpoint is in STATUS.

The prior native XML scenario proved flat10001siblings hit the worker3second
deadline. A Bun diagnostic took84222.954ms before the match-count refusal.
Inspection identifies repeated sibling scans in xmldom compareDocumentPosition,
called by XPath's ordered node-set AVL tree. The new shared selectXmlPath builds
one iterative preorder/subtree index for each immutable parsed document and
uses constant-time comparisons. Attribute order/owner bits match native behavior;
synthetic namespace/foreign nodes use the original method. Every own descriptor
is restored in finally, including parse/evaluation failures. No global prototype,
dependency, timeout, size/match limit or UI/CSS change. Response pane and template
response extraction use the same helper.

Bug regression command: `bun tests/xpath-select.js`. Current296result comparisons,
one matching upstream namespace refusal,14709native-position comparisons,
eleven method/content-restoration fixtures and four template checks pass. Flat
10001element/attribute refusals take about93/102ms under Bun; these are local
diagnostics, not native acceptance.

Saved native command: set `INSOMNIUM_XML_RESPONSE_PERFORMANCE=1`, then
`bun tests/ui/xml-response-filter.js`. The existing scenario delegates to a
feature helper for4000flat siblings: full ordered element/attribute outputs,
scalar count, reversed union and reverse-axis predicate;10001siblings must hit
the match-count limit before the existing3second deadline. Original HTTP response
body/base64/meta remain actual. Preserve old20458ce2 release in
`artifacts/native-xpath-baseline` before `bun tests/ui/build-recovery-copy-probe.js`.
Native baseline failure, fresh source/build binding and performance/default XML
are verified above. Relevant JSON regression and aggregate cleanup also pass.
Template checks are direct Bun regression, not full template Send
integration acceptance.

Source freeze: `bun artifacts/playwright/freeze-xpath-performance.mjs`.
Fresh build binding: `bun artifacts/playwright/bind-xpath-build.mjs`.
Independent native audits:
`bun artifacts/playwright/audit-xpath-performance.mjs artifacts/playwright/xml-response-filter-1791605621469` and
`bun artifacts/playwright/audit-xpath-xml-regression.mjs artifacts/playwright/xml-response-filter-1791605753209`.
Audit JSON lives inside each accepted artifact. Keep current source frozen
until the last native regression is terminal. JSON audit:
`bun artifacts/playwright/audit-xpath-json-regression.mjs artifacts/playwright/json-response-filter-1791606363642`.
Aggregate cleanup: `artifacts/playwright/xpath-performance-cleanup.json`.

Sources consulted: [XPath API](https://github.com/goto100/xpath),
[xmldom](https://github.com/xmldom/xmldom),
[DOM position bits](https://dom.spec.whatwg.org/#dom-node-comparedocumentposition).
Existing parser/XPath dependencies are reused; no generator is needed.

All XPath expressions/tree shapes/namespace mapping UI, template Send integration,
OS/accessibility/provider/platform/streaming and every original migration/shared
UI/UX/CSS requirement remain required. No whole migration or universal performance
claim. Commits by topic and compaction/handoff follow STATUS.


</details>
