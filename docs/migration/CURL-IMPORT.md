# cURL import migration

Updated 2026-10-14. Parser, single-file, mixed-file and GET/file workflows are implemented. Full cURL parity remains incomplete. This replaces repeated chronological checkpoints; original records and reference observations remain in Git at6245b4d and ignored artifacts.

## Request TLS validation

-k/--insecure and --no-insecure are implemented, with last flag wins and --next isolation. Imported curl requests explicitly validate certificates when insecure is absent, even if the app global preference is off. Ordinary requests continue inheriting global preferences. Request Settings provides on/off/global validation through existing Field/Select; invalid stored values refuse Send. The official contract was checked before implementation at [curl --insecure](https://curl.se/docs/manpage.html#--insecure); no new subsystem/generator applies.

Current saved native curl-import-tls.js passes7 groups on release59801 (receipt1791976007258): actual untrusted HTTPS refusal/success, option reset, mounted UI/reload, strict and permissive global policies without request-induced global changes, and an independent async curl control. Native39896 exits0/native-hidden;5 fixture HTTP requests; exact profile restored. Current mixed-body regression1791976035634 passes6 groups and compiler28963 passes0/0. Initial Settings role/label refusals and synchronous loopback control timeout are retained failures; each restored the profile. The label uses explicit Field.label, and the control awaits curl asynchronously so the loopback server can respond. Other TLS/proxy/provider/platform gates remain open.

## Current behavior

Paste import parses literal commands; it never launches a shell, expands variables or reads imported paths. Import review must be confirmed before resources are added. Named files are placeholders until explicitly selected in the request editor; unselected files refuse Send.

Supported mappings include explicit HTTP/HTTPS URLs; multiple commands/URLs; --next option reset; request/head/get; Basic/Digest/NTLM with explicit credentials; headers/cookies/User-Agent/Referer; redirect on/off; literal data/data-ascii/data-raw/data-binary/data-urlencode/json/url-query; multipart text/file fields; and presentation flags. Manual headers retain precedence. MIME parameters, explicit filenames including empty filenames, literal --form-string and single-file conversion are preserved by the existing parser/editor/composer.

Quoted literal Bash input and bounded ANSI-C escapes are supported. The parser additionally normalizes the implemented cmd caret and PowerShell continuation subset; this is not general shell execution or full shell grammar. Substitution, pipelines, redirection and unknown options refuse the whole import.

Mixed data records use ordered curlSegments with stable row identities. Literal segments remain editable/renderable; selected file bytes are converted once per segment. Data/data-ascii strip CR/LF/NUL; binary/json retain bytes; data-urlencode encodes bytes without UTF-8 decoding. Non-JSON fragments use ampersands when accumulated data is nonempty; JSON fragments concatenate. Independent row selections may overlap; stale same-row selections cannot replace newer results. Changing body type clears imported segment metadata.

GET/file sends composed bytes in query data, preserves fragment placement and the saved source URL, sends no request body, and replaces the competing --url-query as curl does. HEAD and explicit method remain explicit. NUL truncation is intentional curl C-string compatibility. Raw spaces/control bytes and invalid UTF-8 are refused where the current URL transport cannot preserve them; use data-urlencode. Raw non-UTF-8 and Unicode request-target fidelity remains required work.

Bounds:1MiB pasted input,20000 tokens/body segments,1000 requests,8Mi code-unit expanded command estimate and20MiB combined body bytes. Encoded output has its own bound. These are application limits, not unbounded legacy parity. Original _curlSource arguments may contain credentials and remain part of ordinary local persistence/export.

## Verified current native workflows

| Saved scenario | Receipt | Verified scope |
| --- | --- | --- |
| tests/ui/curl-import-mixed-body.js | artifacts/playwright/curl-import-mixed-body-1791973695180 |6 groups: missing selections/no path read; overlapping reads; latest same-row selection; literal edit/reload; all256-byte native body comparison with actual curl; body-type cleanup |
| tests/ui/curl-import-get-file.js | artifacts/playwright/curl-import-get-file-1791973709667 |6 groups: missing-file refusal; mounted selection/reload/native Send; all256-byte URL-encoding; HEAD/PATCH/no body; NUL/raw-space behavior; unchanged saved URL/bytes |

The two file scenarios below were verified on their stated binary; their older receipts remain scoped evidence. Both hosts are native-hidden and exit0. Their maintained scenarios now register imported fixture collections before Send, preserve the selected matching profile and restore workspace buffers, owned cookie additions, window state and the full original profile byte/file layout. Unknown changes are retained and fail restoration. Compiler check passes0 errors/0 warnings. No new app build was needed for scenario-only fixes.

Run serially:

```powershell
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-curl-tls-probe/build-state.json'
$env:INSOMNIUM_UI_PROBE_IDENTIFIER='app.insomnium.probe.agentintegration20261014'
bun tests/ui/curl-import-tls.js
bun tests/ui/curl-import-mixed-body.js
# GET/file receipt above uses the earlier integration binary; rerun when affected.
```

Historical multipart, cookie, NTLM, option-reset and single-file receipts establish their stated earlier scope; they are not fresh current-source acceptance. Existing saved scenarios cover those topics and must be rerun when affected. OS chooser operation is separate from HTML file selection.

## Remaining requirements

1. Reconcile all legacy importer fixtures and flag-family ordering without reproducing lost equals, dropped/reordered file data or other corruption.
2. Finish raw Unicode/invalid-UTF-8 request-target fidelity with actual TCP wire comparisons; normalized Request.url is insufficient evidence.
3. Finish stdin/config/header/cookie file representations and non-ASCII shell byte escapes. Never implicitly read imported paths.
4. Finish richer multipart headers/encoders/content-type parameters, quoted/Unicode filename edges, multiple-file/nested forms and content-only file cases beyond accepted scenarios.
5. Finish --compressed, remaining request-local proxy/TLS/timeouts, upload-file and remaining authentication/default/config semantics. Unsupported options must continue failing visibly until their complete mapping exists.
6. Complete duplicate header/cookie, URL/userinfo/escaping and app-default policy reconciliation (cookie jar, timeout, proxy, user agent, certificates).
7. Finish true OS picker selection/cancellation, alternate formats, multiple legacy .db import, file read/error recovery, maximum-size full-session/native IPC acceptance and broader save/reload/export compatibility. Current mounted file selection is narrower evidence.
8. Finish PowerShell/cmd Copy-as-cURL grammar beyond the implemented literal normalization subset.
9. Refresh release installer/BUILD.json after migration; all other PARITY, legal, platform and deferred UX gates remain required.

## Sources and implementation

Current files:curl-import.js, curl-form.js, curl-body.js, uploads.js, binary-body.js, transport.js, request-render.js, template-object.js and RequestEditor.svelte. Original reference:_backup/legacy-electron/packages/insomnia/src/utils/importers/importers/curl.ts and curl.test.ts (read-only).

Official references consulted for the implementation: [curl manual](https://curl.se/docs/manpage.html), [tool_getparam.c](https://github.com/curl/curl/blob/master/src/tool_getparam.c), [tool_operate.c](https://github.com/curl/curl/blob/master/src/tool_operate.c), [urlapi.c](https://github.com/curl/curl/blob/master/lib/urlapi.c) and [Bash quoting](https://www.gnu.org/software/bash/manual/html_node/Quoting.html). Historical reference artifacts retain exact tool/version observations; no claim that current upstream behavior was newly checked here.

## URL glob import — 2026-10-18

Implemented literal URL sets, numeric/alphabetic ranges, steps, leading-zero padding and Cartesian order in the existing importer. Numeric ranges use BigInt to preserve exact integers above 2^53. Escaped delimiters, IPv6/empty brackets and request-local --globoff/--next behavior are retained. Expanded transfers become independent ordinary editable requests; filling one existing request refuses a multi-URL expansion. Malformed/nested/descending/zero-step/oversized ranges refuse before resource creation. Named globs remain an explicit refusal. No shell, filesystem expansion or imported-path read is performed.

The existing global 1,000-request/8MiB projected-command budget now counts expanded URLs before request construction; the helper also bounds intermediate URL strings before multiplication/padding. Actual importer output matches curl.exe for eight representative patterns, including escapes and above-2^53 integers; inline controls cover --next/globoff, independent resources, malformed patterns, exact/over count, Cartesian and intermediate-memory limits. Receipt artifacts/curl-glob-20261018/verification.json records final source hashes and commands' bounded scope. Curl controls use closed loopback port1 only (expected transfer refusal, URL expansion observable); no external API or app-native transfer claimed. Final bun run check51457:0errors/0warnings; bun run build:0; Prettier/helper and diffcheck pass. No new testcase/script/fixture/dependency or native build. Native UI/Send/export/reimport, named/output globs and other remaining cURL/PLAN/PARITY gates remain open.

Primary contract consulted before implementation: https://everything.curl.dev/cmdline/urls/globbing.html and https://raw.githubusercontent.com/curl/curl/master/src/tool_urlglob.c . Existing architecture needs no generator.

## Inline multipart part headers — 2026-10-18

Implemented inline ;headers= on cURL form arguments, including repeated attributes/duplicate header values, quoted semicolon values and --form-string literal isolation. Imported headers persist as editable partHeaders text under existing Part options. The existing renderer resolves that text at Send; transport parses it to bounded header pairs and native reqwest Part.headers sends them independently of top-level request headers. Old native callers default to no extra headers. Browser preview refuses custom headers rather than silently dropping them. Imported @header-file paths remain inert and explicitly refuse; no implicit file access.

Header names/values are validated on both sides. Per-part128row/64KiB bounds apply. Empty values and duplicate values are retained. Content-Disposition/Content-Type/Content-Transfer-Encoding/Content-Length raw overrides remain explicit refusals; existing filename/content-type options own framing, and transfer encoding is not claimed. Header files, raw framing overrides, nested/multi-file forms, encoders and all other retained cURL/PLAN/PARITY requirements remain open.

Inline Bun actual curlResources/prepareRequest checks verify duplicate headers with existing MIME/value preservation, empty/colon values, form-string isolation, file-path/framing/control/row/byte refusals and source nonmutation. No new testcase/script/fixture. Evidence artifacts/multipart-headers-20261018/verification.json records exact source hashes/scope. bun run check77343 exits0/0errors0warnings; cargo check --manifest-path src-tauri/Cargo.toml --locked exits0/6.89s; bun run build0; helper Prettier/scoped Rust format/diffcheck pass. Five preexisting vendor warnings remain. No native UI/IPC/wire/provider/profile/clipboard operation or live handles; actual Send/reload/export/reimport/platform acceptance remains required.

Official contract consulted before implementation: https://curl.se/docs/manpage.html#--form and https://docs.rs/reqwest/latest/reqwest/multipart/struct.Part.html#method.headers ; installed reqwest0.12.28 multipart source confirms custom headers append after generated MIME headers, so conflicting framing overrides must remain explicit refusals. No new dependency/subsystem/generator.

## Multipart transfer encodings — 2026-10-18

Source parent7249fbba. Implemented cURL ;encoder= and editable per-part Transfer encoding through the existing parser/render/composer/native multipart path. Supported encodings: binary/8bit preserve bytes with their Content-Transfer-Encoding;7bit rejects high-bit bytes; Base64 wraps at76columns; quoted-printable preserves CRLF, escapes lone CR/LF/high/control/equal bytes and trailing whitespace, with bounded soft line breaks. Original file selections/filename/MIME/custom part headers remain; old IPC inputs default to no encoding. --form-string remains literal. Unknown/repeated encoder attributes refuse, browser preview refuses encoding, and raw transfer-header overrides remain refused so bytes cannot contradict their declared encoding.

Production multipart_encoding.rs has20MiB input/output guards, including precomputed Base64 expansion and incremental quoted-printable limits. No dependency or new test/scenario script. A Rust stdin driver compiles the exact production helper against existing Cargo dependencies. It matches real curl.exe loopback multipart bytes for all five encodings, including all256byte values, CRLF/lone newlines,76/77column boundaries and trailing whitespace. Actual curl transfer headers are observed; high-bit7bit/unknown/input-over/output-over cases refuse. Actual Bun curlResources/prepareRequest verifies all five mappings with existing value/MIME/header preservation, no mutation, form-string literal and unknown refusal. No app-native IPC/UI/wire claim.

Evidence artifacts/multipart-encoding-20261018/verification.json records final six source hashes, exact payload sizes/hashes, preflight launcher string-stdin failure (corrected to Buffer before compilation), source-helper/curl comparisons and bounds. Frontend check4780 exits0/0errors0warnings; Cargo check --locked exits0/4.79s; production build0; helper Prettier/scoped rustfmt/diffcheck pass. Five preexisting vendor warnings remain. All owned curl/server/compiler/check handles terminal; no installed profile/clipboard/provider operation.

Official contract consulted before implementation: https://curl.se/docs/manpage.html#--form and https://raw.githubusercontent.com/curl/curl/master/lib/mime.c . Existing reqwest multipart APIs are reused; no generator applies. Actual native Send/encoding header-body integration/reload/export/reimport/platform, raw framing overrides/header files/nested multipart and every retained PLAN/PARITY requirement remain open.

## Current native multipart headers/encoders — 2026-10-18

Application source c3b5e6f6 unchanged. Prebuild14421 exits0; saved product-only production release/--locked build17050 exits0 (Cargo6m55s), artifacts/native-multipart-current-20261018/build-state.json. provenance.json binds application head, unchanged-source check, executable bytes/SHA256, saved scenario/helper hashes and exact acceptance scope. No bundled recovery fixture, installer/full legal/source-package acceptance.

Maintained curl-import-multipart.js with INSOMNIUM_CURL_PART_ENCODING=1 reuses its original single import/file-selection/send/reload flow and six existing parts. No new case/fixture/runner/matrix. Default prior import/assertions remain; encoding mode applies base64/quoted-printable/7bit/8bit/binary to five existing parts, keeps form-string literal and asserts real transfer headers/payloads. Existing Part options actually toggle the upload encoding and edit duplicate/custom headers before sending. Shared profile/resource preservation now registers only real newly imported collections before Send, restores exact buffers/owned cookie additions, and verifies complete original profile file/layout/hash equality after host exit.

First frontend42553 fails a new implicit-any callback; JSDoc-only correction gives53333 exits0/0errors0warnings, Prettier/diffcheck pass. Native50185 exits0: artifacts/playwright/curl-import-multipart-encoding-1792312368753/{result,acceptance}.json passes seven original flow checks plus encoding/header assertions, actual hidden host107336 exits0/no parent termination. Peer observes exact Base64 binary payload, all five transfer-encoding headers, duplicate X-Owned and mounted X-Edited header; unencoded literal/filename/MIME/file-content and both durable reload checks pass. Resource restoration1792312368708/result.json passes; outer full-profile guard succeeds. Saved screenshot inspected: new options retain the existing pane layout and scrolling. Five preexisting vendor warnings remain. All owned handles terminal; no clipboard/provider operation.

This closes bounded Windows native source-to-UI-to-wire/persistence acceptance for the current header/encoder implementation. It does not verify app-native high-bit7bit/limit refusals, full large MIME wrapping, every header/encoder/template combination, export/reimport, physical OS picker/close/provider/platform, cURL glob UI or other retained PLAN/PARITY requirements. Reuse this native candidate while application source stays unchanged. /compact unavailable; explicit handoff.
