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
