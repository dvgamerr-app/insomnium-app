# cURL import migration

2026-10-01 finding: legacy default settingEncodeUrl:true is ignored by current Send (ported helper only serves template tags). Six of seven diagnostic URL cases differ. Restore original Send encoding/order next; raw URL fidelity still open. See STATUS.

2026-10-01 checkpoint: five-case native GET/file acceptance passed1790796856828 after315s build. Encoded bytes, HEAD/PATCH/no-body, NUL/refusal and saved state verified; raw Unicode/invalidUTF8 request-target fidelity and full parity remain open. See STATUS.

2026-10-01 raw-wire correction: TCP request-line capture (artifacts/curl-get-file-reference/raw-wire.json) proves curl sends raw Unicode/invalid-UTF8/quote bytes. Earlier Bun Request.url comparisons normalize these and do not establish exact wire fidelity. Current URL parser encodes Unicode/punctuation and refuses invalid UTF8; this full-parity gap remains open. Native GET build/scenario still pending; see STATUS.

2026-10-01 checkpoint: GET file-data query parser/editor/composer implemented;39 reference assertions and Bun check/build pass. Native GET acceptance and raw non-UTF8 URL fidelity remain pending; full parity open. See STATUS.

2026-10-01 checkpoint: fixed GET/data precedence over --url-query, including empty data and either option order. Seven actual curl comparisons plus --next reset and Bun check/build pass. GET file implementation/native query acceptance remain next. See STATUS.

2026-10-01 checkpoint: native16/20MiB selection/persistence/reload/Send SHA-256 passed1790796132115; mixed-body regression passed1790796180942 on fresh upload-size build. GET/file reference captured; query implementation and full parity remain next. See STATUS.

2026-10-01 checkpoint: recognized binary uploads separated from template text with aggregate20MiB byte validation;17 boundary assertions and Bun check/build pass. Native full-session/persistence/IPC maximum-size acceptance next; GET and other parity remain open. See STATUS.

2026-10-01 checkpoint: native multi-file scenario1790795545328 passed after successful315s build. Overlapping/stale reads, literal edit, reload and exact curl bytes accepted.16MiB upload/template size conflict reproduced; fix accounting and GET/query next. Full parity remains open. See STATUS.

2026-10-01 checkpoint: mixed literal/multiple-file body parser/editor/byte composer implemented; six actual curl comparisons plus missing-file/boundary checks pass, Bun check/build pass. Native picker/IPC, GET/query and template-size reconciliation remain next. See STATUS.

2026-10-01 checkpoint: Cookie native build exit0; saved five-group Import/reload/Send regression1790794877414 passed. Manual precedence, empty header, repeated values and --next reset accepted. Mixed-file implementation next; full parity remains open. See STATUS.

2026-10-01 checkpoint: fixed explicit Cookie header precedence over --cookie. Five actual curl/parser/composer wire comparisons and group-reset check pass; Bun check/build pass. Native Import acceptance of fix pending; cookie files/engine and other full parity remain open. See STATUS.

2026-10-01 native UI acceptance: bun tests/ui/curl-import-ntlm.js passed on artifacts/native-curl-ntlm-ui-probe/build-state.json. Evidence artifacts/playwright/curl-import-ntlm-1790794284777; validates imported explicit credentials with independent NTLMv2 proof, reload, connection binding, POST replay and manual Authorization suppression. Does not cover MIC/TLS binding/hosted provider/OS sign-in/proxy/mixed negotiation.

Updated: 2026-09-29. Status: PARTIAL — common literal HTTP commands implemented; single-file body support implemented; full legacy/mixed-file/desktop acceptance remains open.

## Transfer groups checkpoint — 2026-10-01

--next and -: create independent ordered request groups; method, body, headers, auth, query and redirect options reset. Multiple URLs in one group share its options. The separator is parsed as an option, so a literal option argument equal to --next is preserved. Accepted global presentation flags do not alter request semantics; unsupported globals remain errors. Empty transfer groups fail explicitly.

Official reference: https://curl.se/docs/manpage.html#--next .18 inline checks include4 real curl loopback comparisons against production parser/composer. Compiler/build pass. Saved native UI Import/review/apply/reload/Send acceptance passed on2026-10-01: artifacts/playwright/curl-import-next-1790791796403/{acceptance,result}.json. It verifies three groups, atomic invalid-input refusal, no implicit network, preserved existing resources, exact native wire method/body/auth/header isolation and second reload. Inline evidence: artifacts/curl-next-check/acceptance.json. File/multipart and remaining options require separate acceptance.

## Explicit NTLM option — 2026-10-01

--ntlm with explicit --user username:password maps to existing native NTLM. DOMAIN\user, UPN, Unicode and password colons are preserved. Repeated flag/last credentials and --next reset are supported; manual Authorization overrides generated auth. Missing/empty username, OS sign-in, interactive password, proxy NTLM and mixed auth negotiation are rejected.27 inline checks and frontend build pass; native Import/handshake acceptance pending. Existing NTLM-COMPATIBILITY.md limitations remain.

## HTTP Bearer option — 2026-10-01

--oauth2-bearer maps to the existing Bearer token editor. Last token wins; transfer groups reset it; manual Authorization overrides it. Empty or multiline tokens fail. Combining with explicit --basic/--digest fails because curl negotiation cannot be represented by simply selecting one current auth model. --user user:password with Bearer is supported for HTTP and verified against curl.10 inline checks including4 real wire comparisons pass. Native six-group Import/reload/Send accepted2026-10-01 in artifacts/playwright/curl-import-next-1790793472875: repeated-token/user precedence, next-group reset, manual Authorization and persistence verified. See artifacts/curl-bearer-check/acceptance.json.

## Native file-content and body conversion acceptance — 2026-10-01

Corrected native build passed saved multipart scenario1790792888538: <file omits filename even with filename=, preserves exact selected bytes and respects explicit MIME without adding default MIME. Single-file body scenario1790792912164 compares all5 modes against actual curl with256 byte values after mounted selection/reload/native Send. Payload/Content-Type and JSON Accept match; stored conversion is not reapplied. Apps/servers closed. These close those specific earlier native-acceptance gaps; mixed/multiple files, remaining syntax/options and OS dialog interaction remain outstanding.

## File-content field implementation — 2026-10-01

field=<file now imports a required file selection with fileContent:true. Exact selected bytes use valueBase64 IPC independently from filename, so native can omit filename without text decoding. Selected MIME is omitted by default; explicit MIME takes precedence. Correction2026-10-01: curl ignores filename= for <file. Parser discards it and composer omits filename even if older data contains an override; UI hides filename overrides in this mode. File input replacement preserves mode. Browser fallback requires desktop for filename-free binary fields. No imported path is read automatically; stdin/nesting/multiple-file syntax remain unsupported.

Cargo/Bun compile checks,28 inline parser/composer checks and4 actual curl wire checks pass. Initial native regression exposed filename mismatch; corrected native build/scenario acceptance pending.30 corrected composition checks supersede earlier filename expectations; see STATUS. Earlier notes describing <file as wholly unsupported are historical.

## Native multipart acceptance — 2026-10-01

Saved tests/ui/curl-import-multipart.js passed on native-curl-import-ui-probe: artifacts/playwright/curl-import-multipart-1790791996313. Covers missing-file refusal/no implicit path read, mounted HTML input selection/replacement, preserved MIME/filename override, reload, exact native binary bytes, text MIME without filename, explicit empty filename and literal --form-string. OS chooser interaction, additional multipart syntax and single-file body conversions remain separate gates.

## Multipart metadata checkpoint — 2026-09-29

curl-form.js parses type= and filename= after shell tokenization, including quoted delimiters and escaped quotes/backslashes. --form-string stays literal. Unsupported attributes, MIME parameters, repeated attributes, nested multipart, multi-file lists and <file content fields fail visibly rather than losing data.

Selected-file metadata and explicit wire metadata are separate: fileName/contentType describe the selected upload; fileNameOverride/contentTypeOverride survive replacement and are editable under Part options. An explicit empty filename stays empty. Text with filename= is encoded to UTF-8/base64 for the existing native file-part contract. Text MIME without a filename uses the existing native text-part MIME support.

fileChanged has per-row selection tokens and an unmount guard. A new selection wins over an older read; removal/replacement suppresses stale writes/errors. Five inline checks execute the actual handler source; mounted UI still needs acceptance.

Verification:33 multipart assertions +70 importer +28 file-body regressions +5 handler cases =136 inline checks passed. Six local wire comparisons against curl8.21.0 passed through an stdin-compiled Rust probe using the actual multipart builder extracted from http.rs and reqwest0.12.28 (manifest/.d paths confirmed). Compared header values and part bytes, ignoring header-name case and order. Includes filename delimiters, empty filename, text with filename, file MIME and text MIME. No Tauri IPC/WebView claim.

Bun browser FormData added charset=utf-8 for a text/plain file part during comparison. Browser wire equivalence remains unverified; no expectation was weakened to claim a pass. Custom text-part MIME without filename now fails in preview with a desktop-required message. Native comparison covered this case successfully.

Final Prettier, bun run check0/0 and bun run build passed. No dependency or Rust production changes, no saved test source. Synthetic file directory and probe EXE/PDB were deleted; server handles terminated with SIGTERM.

Official sources: [curl form manual](https://curl.se/docs/manpage.html#--form), [tool_formparse.c](https://raw.githubusercontent.com/curl/curl/master/src/tool_formparse.c), [reqwest Part methods](https://docs.rs/reqwest/latest/reqwest/multipart/struct.Part.html). Existing editor/transport reused; no subsystem generator applies.

Remaining: headers/encoder/content-type parameters, quoted/Unicode edge reconciliation, multi-file/nested forms, <file content, mixed data files, other curl options and actual desktop picker/IPC/save-reload acceptance. The earlier generic “multipart modifiers” gap is partially implemented, not fully closed.

## Single-file body checkpoint — 2026-09-29

Named single-file --data/-d, --data-ascii, --data-binary, --json and --data-urlencode inputs now import. name@file preserves the already-encoded field prefix. The request opens the existing binary-file picker; no imported path is read automatically. Send fails until a file is selected. Input is converted once at selection and stored as base64, so save/reload/send does not reapply transformations. Changing body type clears this imported conversion mode and converted bytes.

File data/ascii strips CR/LF/NUL. Binary/JSON preserves bytes. URL encoding handles arbitrary bytes directly, preserving invalid UTF-8 byte sequences as percent escapes; spaces become +. Source and encoded output each have a 20 MiB bound. A field prefix must be URL-encoded ASCII. The original imported arguments remain under _curlSource.

Enabled manual Content-Type now takes precedence for binary uploads, with octet-stream as fallback. Imported form/JSON/custom file content types therefore survive composition. Body selection checks request/body/selection ownership after reading and immediately before applying; component destruction invalidates pending work.

Verification: 28 new inline assertions plus70 updated importer regressions passed; seven real curl8.21.0 loopback comparisons matched bytes/method/Content-Type/Accept. Fixture included byte values0–255. File-mode/save-reload/limits and stale request/body/selection/unmount predicates were checked directly; the mounted picker and native IPC were not. Synthetic fixture was deleted; echo server ended with SIGTERM. Final bun run check0/0 and bun run build passed; no new test files or native/dependency changes.

Additional official sources: [Blob.arrayBuffer](https://developer.mozilla.org/en-US/docs/Web/API/Blob/arrayBuffer), [Svelte lifecycle/onDestroy](https://svelte.dev/docs/svelte/lifecycle-hooks#onDestroy), and the curl manual's data/file sections. Existing picker/upload pipeline reused; no generator applies.

Remaining file cases: mixed literal/file data, multiple files, --get with file data, stdin, header/cookie/config files, richer multipart modifiers and actual native picker/IPC acceptance. Single-file support does not close the full cURL parity item.

## User flow

Use Import, paste one or more cURL commands, choose Review import, then Import. File pickers also accept .curl and .txt. Requests enter a new collection through the existing additive ID remapping/topology validation. Preview never sends a request, executes a process, expands shell variables, or reads paths mentioned in a command.

Supported quoting is literal Bash/POSIX single/double quotes, backslash escapes/line continuations, and a bounded ANSI-C escape subset. Semicolon/newline-separated commands must each begin with curl or curl.exe. This is not PowerShell/cmd quoting. Unknown options and unsupported constructs stop the whole import before it changes workspace data.

## Implemented mappings

- Explicit HTTP/HTTPS URLs, multiple URLs/commands, query retention, attached short values, short flag clusters, long option=value, and -- argument terminator.
- --request/-X, --head/-I, --get/-G; body implies POST including an empty body. Explicit method spelling is retained. HEAD with a different explicit method is rejected.
- --header/-H, --user/-u with literal user:password, Basic/Digest, --cookie/-b literal cookies, --user-agent/-A and --referer/-e. Manual headers take precedence over the corresponding generated User-Agent/Referer. Empty Name; headers and User-Agent: suppression have distinct mappings.
- --data/-d, --data-ascii, --data-raw, --data-binary and --data-urlencode literal values. Data retains option order and equals/ampersands; an empty prefix does not introduce an extra separator.
- --json concatenates JSON fragments, sets default Content-Type/Accept, and does not validate JSON. Mixing --json with other data modes is currently rejected.
- --url-query, including raw + prefix; --get data becomes query data.
- --form/-F simple text/file fields and --form-string literal values. Files retain a filename placeholder and must be selected in the existing multipart editor before sending; no filesystem access occurs during parsing.
- --location/-L and --no-location map to per-request redirect settings. Without location, imported requests use redirects off.
- --globoff/-g permits literal URL braces/ranges; expansion itself is unsupported.
- CLI output flags -s/-S/-v/-i/-N and their named forms are accepted without transfer changes. App response presentation remains the existing response pane.

Raw URL-encoded data uses the text editor plus its explicit Content-Type header. Converting it into editable form rows would change bare fields, empty names, plus signs, percent spelling and repeated separators. Raw octet-stream/multipart/GraphQL MIME text also uses the plain text editor to avoid selecting unrelated binary-file/form/GraphQL serializers. This body representation choice is shown in import review.

Original parsed arguments are retained in _curlSource, like existing imported-source records. They may contain credentials and are included in ordinary local persistence/export.

Bounds: 1,048,576 UTF-16 input code units, 20,000 tokens, 1,000 requests and an 8,388,608-code-unit estimate of expanded command text checked before cloning resources. These are text/allocation guards, not an exact serialized-memory-byte limit.

## Evidence and corrections

- 70 inline Bun assertions passed: parser/quoting, request composition, body/query/header/auth/redirect semantics, multipart file selection guard, additive IDs, existing Postman regression, unsupported input rejection and bounds.
- Eight independent local network comparisons against Windows curl 8.21.0 passed. Imported resources went through parseImport and prepareRenderedRequest, then Bun fetch to a disposable loopback echo server. Compared method, path/query, body or parsed form, Content-Type, Basic Authorization and a custom header.
- Compared raw form bodies, mixed data flags, JSON fragments, GET query data, binary-text PATCH, Basic auth/header, multipart literal fields and url-query. These are not Tauri WebView/native transport tests.
- Initial checks caught a missing HEAD guard insertion; fixed. First wire comparisons caught spaces encoded as %20 rather than current curl's +, and appended query percent escapes needing uppercase hex. Confirmed against upstream tool_getparam.c/urlapi.c and fixed. Original URL query spelling remains unchanged.
- bun run check: zero errors/warnings. bun run build: passed. Prettier ran using Bun.
- No saved test scripts, dependencies, Rust changes, user-state writes or installer build. Local echo server was terminated; child handle reports SIGTERM.

## Remaining work (not removed from migration scope)

1. Full legacy import fixture reconciliation, including mixed/multiple --data file inputs and form/file modifiers. Original importer sometimes dropped equals, reordered flag families and lost file/body data; do not reproduce those corruption cases just to match a fixture.
2. Mixed-file/config/stdin import representation, richer multipart filenames/content types/headers/encoders, non-ASCII byte escapes and data file encoding. Current unsupported cases fail visibly.
3. Common unsupported options such as --compressed, --insecure, proxy/TLS/timeouts, upload-file, other authentication modes and curl default/config semantics. Do not silently accept options without a request-local mapping.
4. Header/cookie duplicate precedence and URL/userinfo/escaping edge parity; existing app defaults (cookie jar, timeout, proxy, user agent, certificates) still need a complete curl-versus-Insomnium policy review.
5. Full shell syntax is not executed. Variable/command substitution, pipelines/redirection and unsupported quoting are rejected; literal examples should use single quotes. PowerShell/cmd-style Copy as cURL support needs explicit parsing.
6. Actual Import UI review/apply, native HTTP/IPC, multipart file picker, save/reload/export and error recovery acceptance. No mounted UI claim.
7. Refresh installer and BUILD.json after remaining migration work.

## Sources consulted before implementation

- [curl official manual](https://curl.se/docs/manpage.html): option arguments, data modes, header suppression, forms, GET, JSON, URL query.
- [Bash quoting](https://www.gnu.org/software/bash/manual/html_node/Quoting.html), [double quotes](https://www.gnu.org/s/bash/manual/html_node/Double-Quotes.html), [ANSI-C quoting](https://www.gnu.org/software/bash/manual/html_node/ANSI_002dC-Quoting.html). Direct page retrieval failed; official indexed excerpts supplied quoting/escape rules. Open Group direct page also returned 403.
- [curl tool_getparam.c](https://raw.githubusercontent.com/curl/curl/master/src/tool_getparam.c): data_urlencode and set_data.
- [curl tool_operate.c](https://raw.githubusercontent.com/curl/curl/master/src/tool_operate.c): append2query.
- [curl urlapi.c](https://raw.githubusercontent.com/curl/curl/master/lib/urlapi.c): appended query percent normalization.
- Archived source: _backup/legacy-electron/packages/insomnia/src/utils/importers/importers/curl.ts and curl.test.ts (read-only).

No generator applies to this parser extension. Reused the existing import dialog/resource pipeline. Programs ran directly through node_repl with shell:false/windowsHide:true; Bun handled JavaScript and filesystem operations.

## Next action

Complete remaining common option/file mappings and native import acceptance without weakening explicit unsupported handling. Continue cookie template-source lifecycle, URL/SSE parity, Runner/Git/plugins and all other PARITY gates; full migration is incomplete.

## Mixed literal/file body implementation sequence — 2026-10-01

Status: design/reference evidence only; not implemented. Existing binary body stores one selected upload. Inspected curl-import.js, uploads.js, RequestEditor.svelte, transport.js, request-render.js and template-object.js.

1. Add an ordered body segment representation for mixed/multiple file inputs, retaining option mode, literal value or named-file placeholder and stable row identity. Keep existing single-file saved records compatible. Import must never read referenced paths.
2. Reuse file conversion from uploads.js per selected segment; preserve bytes and transform once. Store selected converted base64 independently for each row. Missing selections must refuse Send. Do not collapse file contents to UTF-8 text.
3. Add per-row file replacement and literal editing using existing Insomnium styles. Fence reads by request/body/row identity, selection generation and workspace work scope. A selection on one row must not cancel another row. Clear segment state when switching body kind.
4. Compose ordered bytes in transport, using ampersand only when accumulated non-JSON data is nonempty; JSON fragments concatenate directly. Enforce both per-file and aggregate/encoded size bounds before allocations. Preserve manual MIME and existing request method/auth behavior.
5. Integrate with renderer and persistence/export. Base64 contains no template delimiters, but literal segments need existing render/disable-body semantics. checkTemplateValue currently has a20MiB character bound including base64, smaller than20MiB binary; reconcile advertised/actual limits instead of ignoring this conflict.
6. Implement --get file-data query composition with correct fragment/query ordering and byte escaping; compare --url-query interaction and explicit method. Do not treat arbitrary raw binary as a Unicode URL without evidence.
7. Validate inline parser/composer/ownership boundaries, then saved Playwright Import/select/replace/reload/native Send with all256byte fixture, multiple files, literals before/between/after, empty values, JSON, data-urlencode, GET and cancellation/stale selection.

Official sources consulted: https://curl.se/docs/manpage.html#--data , #--data-binary , #--data-urlencode , #--json . Six actual curl loopback reference executions are recorded in artifacts/curl-mixed-design/reference.json: data strips CR/LF/NUL per file, binary preserves bytes, empty initial literal adds no leading ampersand, JSON concatenates, URL-encoded file preserves invalid UTF-8 as percent bytes, GET has query and no body/Content-Type. These are curl reference observations, not app acceptance. Synthetic fixture removed/server stopped.
