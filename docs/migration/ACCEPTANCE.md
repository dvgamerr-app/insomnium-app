# OAuth1 / NO_PREFIX acceptance gate

Implementation and direct inspections are complete; **native UI/provider acceptance is pending**. See OAUTH1-COMPATIBILITY.md.

1. In native Auth, create HMAC-SHA1/HMAC-SHA256/RSA-SHA1/PLAINTEXT requests; render environment values, set fixed nonce/time, then try generated values. Verify PEM errors and unsupported algorithms remain visible without sending.
2. Import original OAuth1 with/without Hash Body and duplicate/disabled form fields. Confirm visible legacy mode, unchanged source/export credentials, hash metadata and explicit RFC switch. Ambiguous query/property edge cases must explain how to proceed.
3. Import Postman inherited OAuth1: token maps to Token key, form mode is RFC, and URL/body placement or unsupported options stop sending until explicitly changed. Preserve original source on re-export.
4. Send HTTP/GraphQL/SSE/WebSocket to a real provider; verify same-origin redirect re-signing, cross-origin removal, cancellation/timeout, cookie/proxy/TLS settings and reload. Direct native loopback evidence covers transport core, not Tauri IPC or UI lifecycle.
5. OAuth2 Token prefix NO_PREFIX must send the raw validated token; other prefixes keep their normal behavior. Existing token expiry/ID-token consent rules still apply.

## Manual acceptance checklist

No new automated test scripts are authorized. Build checks are documented in STATUS. The items below are manual acceptance steps, not claims of completion.

## Local setup

Run `bun run desktop`. Use a disposable collection and a loopback-only API that echoes method, headers, query and body. Do not use a production endpoint for mutation checks. Browser preview cannot verify native networking or native persistence.

## Core desktop gate

- [ ] Compare dark UI with `_backup/legacy-electron/screenshots/v0.1.png`; check 1440×900 and 900×600, then light theme. Header/sidebar/tabs/editor/response remain usable without clipping.
- [ ] Create nested collections/folders; rename, duplicate subtrees, move requests/folders across collections, reorder siblings, delete with subtree confirmation. Reject self/descendant moves and deleting the last collection. Switch tabs and collections, filter, then close/reopen. Verify durable values and selection.
- [ ] Create/rename/duplicate/delete sub environments; edit base/sub environments and use nested variables in URL, query, body and auth. Missing/circular variables stop before transmission. Folder environment inheritance preserves overrides.
- [ ] Send HTTP GET, POST/JSON, URL-encoded with duplicate keys, multipart text/file, binary and GraphQL query/variables to local echo server.
- [ ] Verify Basic/Bearer/API key against echo server. Disabled headers/params are omitted. A manually entered unsupported imported auth method is not silently ignored.
- [ ] Verify 200/204/400/500, response headers including repeated Set-Cookie, body bytes/download, timings and history selection.
- [ ] Cancel a delayed response, timeout a stalled response, simulate refused connection, and send again. No stuck sending state or stale response replacing the new run.
- [ ] Redirect on/off, cookies within one collection and isolation across two collections, add/edit/delete/clear cookies; close/reopen and verify saved cookies, expiry and host-only/path scope. Check send-only and store-only requests, corrupt jar rejection and failed-save warnings. Clear/edit during a delayed request must prevent stale response cookies from repopulating the edited jar.
- [ ] Proxy and TLS: trusted server, invalid certificate rejected by default, custom CA, client certificate restricted to configured hostname, cross-origin redirects blocked when an identity is active, explicit settings survive reload.
- [ ] Native dialogs can read selected import files and save export/response files. Cancellation leaves current state unchanged.
- [ ] Atomic workspace storage: using copied disposable data, verify invalid JSON fails without overwrite, previous file is retained, save failure visible, close waits for saves, second app instance focuses first.

## GraphQL gate

Windows close/reopen evidence (2026-10-01): tests/ui/graphql-schema-close.js passes3+3 checks at artifacts/playwright/graphql-schema-close-1790809313945 and graphql-schema-close-reopen-1790809315639. WM_CLOSE→cancel_http/save_workspace/destroy, abort before fixture release and clean reopen/fresh fetch verified. Other OS lifecycle/export/visual/provider gates remain open.

Native cache evidence (2026-10-01): tests/ui/graphql-schema-cache.js passes6 checks at artifacts/playwright/graphql-schema-cache-1790808908649/acceptance.json. Covers request isolation,3-entry and aggregate20MiB eviction, replacement age and selected clear without request/history changes. CloseRequested lifecycle remains unverified.

Additional native evidence (2026-10-01): tests/ui/graphql-schema-import.js passes12 import/browser checks at artifacts/playwright/graphql-schema-import-1790808738003/acceptance.json. Invalid/oversized imports preserve valid schema; raw introspection JSON, search, descriptions/defaults/deprecation, directive details and Clear schema accepted. Native export, cache eviction/close, visual/accessibility/provider/platform gates remain open.

2026-10-01 native Windows evidence: saved graphql-editor (15), graphql-schema-lifecycle (12), graphql-schema-context (6), graphql-execution (4) scenarios pass. Exact coverage/artifacts in GRAPHQL-RENDERING.md. Combined bullets below remain unchecked where any constituent acceptance is still outstanding.

- [ ] Use a disposable local GraphQL endpoint: query/variables and operation names via POST and GET, repeated URL parameters, environment expansion, auth and native proxy/TLS/cookies. GET encodes GraphQL fields in the URL without a body; use POST for mutations.
- [ ] Fetch schema explicitly; verify original query/variables/operation, prior response and history remain unchanged. HTTP/auth failure, disabled introspection, malformed JSON and GraphQL errors are visible. Cancel fetch and close the app while fetching.
- [ ] Change endpoint/headers/auth/settings/environment during/after fetch: ignore mismatched results and require refresh. No automatic network call when switching requests or opening Schema.
- [ ] Import introspection JSON (wrapped data and raw __schema) and SDL. Invalid or >20 MiB schema fails visibly without replacing a valid schema. Search types/fields, view descriptions/deprecations/defaults and export SDL. Clear schema; cache eviction/restart does not remove user request data.
- [ ] Format query, choose one of multiple operations, validate missing fields/required variables/types, verify error locations and partial GraphQL response errors. Validation leaves query/variables unchanged; no server custom scalar validation is claimed.
- [ ] Keyboard-select schema import and type search/list, resize, and verify dark/light original Insomnium styling. Native query/variable completion and hover type navigation passed; keyboard-only schema browsing and visual acceptance remain outstanding.

## Streaming gate

- [ ] Against a loopback WebSocket endpoint: connect with auth/query/headers/subprotocol, send text/JSON/binary/ping, receive text/binary/ping/pong/close. Verify original bytes on download, fragmented messages and server close reasons.
- [ ] Save/rename/duplicate/import WebSocket payloads; switching requests does not send a payload or open a connection. Verify environment substitution and invalid JSON/base64 errors.
- [ ] Against a loopback SSE endpoint: GET/POST, multiline data, event ID/type/retry, UTF-8 split across chunks, initial BOM, CR/LF/CRLF, comments and EOF. No automatic reconnect or request replay after close.
- [ ] Cancel during connection/handshake/read/send; reconnect and close the app with active streams. Final events/history persist before close; reopened history is disconnected.
- [ ] Verify streaming proxy, TLS/client certificate policy, auth and per-collection send/store cookies with disposable local endpoints.
- [ ] Send a fast stream with a slow UI: sequence acknowledgement bounds IPC data; filtering/follow/copy/export/history remain usable. Check 1,000-event/8 MiB retention, one large newest event, 20 MiB frame/event rejection and 40 MiB history budget.
- [ ] Browser preview shows the native-only limitation. Imported legacy Accept:text/event-stream selects SSE; explicit HTTP overrides detection.

## Data migration gate

- [ ] Import Insomnia collection twice; IDs are additive and references remain valid.
- [ ] Import Postman nested folders with inherited auth, variables, duplicate/disabled query fields, path variables, disabled bodies, multipart multiple files and script-dependent requests. Script-dependent requests are preserved and blocked until migrated.
- [ ] HAR preserves headers/body and arbitrary imported metadata.
- [ ] Select a copied set of legacy NeDB files: latest updates win, tombstones are removed, index metadata ignored, malformed lines stop import. Verify original file hashes unchanged.
- [ ] Check Workspace/Environment/RequestGroup/Request/WebSocketRequest/GrpcRequest and all unknown resource types in export. External body/certificate/proto references remain explicitly outstanding.
- [ ] Import rejects parent cycles/orphan request trees before adding any resources; unknown resource types remain in exports.
- [ ] Import copied legacy cookie jars, then use Cookies → Restore cookies from imported collections. Preview does not change the jar/file. Default keeps existing keys; explicit overwrite changes only matching name/domain/path entries. Check expiry/Max-Age original creation, session cookies, secure/httpOnly/SameSite, domain versus host-only, IPv6 and path scope. Source records and files remain unchanged.
- [ ] Restore duplicate saved cookie keys (including an expired last record); verify no resurrection of older values. Missing dates/custom extensions/partitioned cookies show issues. Native rejected candidates are reported. Retry restores, disk-write failure, corrupt existing jar, close/reopen and delayed in-flight responses must preserve the selected conflict policy and saved result.
- [ ] Empty uploads work; >20 MiB uploads show an error; history count and 40 MiB serialized-history budget apply without losing the currently displayed response.
- [ ] Validate migration on copies of representative real exports before claiming full compatibility. No original user data has been opened in the current task.

## Release gate

- [ ] Install/uninstall the Windows NSIS artifact in a disposable environment; verify application launch, offline startup, existing-data preservation and WebView2 handling.
- [ ] Build and verify macOS/Linux on their respective hosts.
- [ ] Complete every TODO/PARTIAL in PARITY.md or obtain an explicit owner scope change before declaring full migration.

## OpenAPI/API Design gate

- [ ] Open API Design in light/dark themes, resize and keyboard-navigate source/preview/diagnostics. Native module Worker starts under production CSP; cancel/timeout does not freeze the editor.
- [ ] Create/import YAML and JSON, rename/edit/export, close/reopen and verify source and attached files persist. Existing imported legacy api_spec opens in its owning collection. Global import adds a new design collection and opens Design.
- [ ] Validate missing required fields, duplicate operation IDs, duplicate YAML keys, missing path parameters, recursive schemas and unresolved refs. Diagnostics leave source unchanged; edited source invalidates stale preview/generation.
- [ ] Attach nested relative reference files, edit their names, remove one and verify visible failure. No network access or automatic local file reads. Check file/count/combined-size limits and 15-second cancellation.
- [ ] Generate into a new folder twice, verifying separate IDs and unchanged prior requests. Check server precedence/override/variables, scalar path/query/header parameters, JSON/form/multipart/binary body and auth placeholders against a disposable local echo server through native IPC.
- [ ] Complex serialization, structured XML/non-JSON bodies, missing Swagger host and unsupported auth show request Settings issues and block Send until corrected/acknowledged. Existing Postman script blockers remain after OpenAPI acknowledgement. Generated provenance survives export/import and collection duplication.
- [ ] Confirm descriptions are plain text and do not execute markup/scripts. No automatic request execution on validation, preview or generation. Full Spectral/custom rules and 3.2 additional operations remain explicitly unsupported.

## Digest authentication gate

- [ ] Select Digest in Auth, configure literal/environment username/password, enable/disable, save/reopen and import legacy/Postman Digest. Manual Authorization is removed while Digest is enabled. Browser preview fails before any request.
- [ ] Through Tauri IPC, send HTTP/GraphQL, SSE and WebSocket to disposable local Digest endpoints. Check MD5/SHA-256/SHA-512-256/session variants with auth/auth-int, combined challenge headers, escaped realm/opaque, UTF8/userhash, decomposed NFC credentials, username*, escaped Unicode and malformed/unsupported challenge errors. Direct executor checks passed, but this application UI/IPC gate remains unchecked.
- [ ] Verify body replay preserves exact JSON/form/binary/multipart bytes and boundary. Check empty bodies, encoded path/query, 20 MiB body cap and displayed final response/history. Initial 401 and stale retry must not create duplicate response history entries.
- [ ] Wrong credentials stop after the authenticated response; stale=true permits one more retry. No automatic Basic fallback. Session variants without qop and proxy 407 remain explicit unsupported cases.
- [ ] Verify redirect on/off, 307 body preservation, 302 POST/303 conversion, ten-redirect limit, cookie rules and original-origin credential scope. Cross-origin destination must not receive Digest credentials or manually specified cookies. Client-certificate redirect restriction remains in force.
- [ ] Cancel during challenge/retry/body read and close during a Digest stream handshake. Total HTTP timeout covers all attempts; stream handshake timeout does not stop an established stream. Cookie flush/reload and proxy/TLS checks still need native application acceptance.
- [ ] Authentication-Info/rspauth validation, legacy non-UTF8 header encodings, nonce caching and proxy Digest require follow-up before claiming complete legacy authentication parity.

## OAuth token exchange gate

- In native Auth, use a local provider for Client Credentials, Password and Refresh with Basic/body credentials. Check scope, audience/resource, Origin, proxy, custom CA, exact-host certificate and collection cookie send/store switches.
- Fetch token must preserve the current resource response/history. Send, introspection and stream Connect must acquire/refresh before using the Authorization header. No token response body may appear in history. Token-endpoint ID tokens must remain separate; Implicit ID-token use requires the explicit option and visible credential label.
- Verify valid/unknown/zero expiry, rotation and refresh response without a replacement refresh token; invalid_grant blocks the resource without retrying another grant. Clear removes only the active copy. Restart confirms atomic persistence.
- Change environment, credentials, auth type, recipient origin or relevant network settings while token fetch is pending: discard the result and do not send. Cancel/delete/close must drain pending work without saving late results. Check two clicks do not create concurrent token requests.
- Import legacy/native exports: tokens remain unbound until explicit review/adoption, source record survives Fetch/Clear, and duplicate request/folder/collection has no token copy. Check malformed token fields fail visibly.
- Verify Postman header prefix/manual override; unsupported query-token destination and MAC type must block until explicit correction. Browser preview must reject OAuth before fetch.
- Current evidence: 20 direct native loopback cases plus pure JS and compiled Svelte state inspections with mocked IPC passed. Native WebView/UI/IPC/reload/TLS/proxy/cookies not yet verified. Authorization Code/PKCE and Implicit are now implemented with separate direct-core evidence below; actual browser acceptance is still pending.

Public-client follow-up: omit client_secret from body authentication when empty, while explicitly selected Basic still sends the empty password. The actual native source passed both cases after recompiling the stdin helper. Clippy passed again. First OAuth release session 27477 passed; final packaging is repeated to include this correction.

Final OAuth release (including public-client correction) passed in session 56212. BUILD.json records the matching 133-file source manifest and executable/NSIS hashes. Installer was not launched or published.

## Authorization Code / PKCE gate

- Use an actual native app and local provider. Authorize must open the OS browser, display the exact redirect/waiting status, capture the callback and exchange code with exact redirect_uri and correct S256 verifier. Check explicit plain and disabled PKCE separately.
- Verify default random state across attempts, configured state, optional expected issuer, fixed IPv4/localhost/IPv6 redirect, static query and occupied port. Wrong state/host/path/duplicate params/mixed response must not consume the waiting attempt.
- In system-browser mode, remote/custom redirects must retain their registered URI, show manual instructions and accept only a matching final URL. Bad paste remains editable; valid denial must persist as an error even if command results race. form_post and OS deep-link automation remain pending.
- Cancel, delete request and close app during setup/wait/exchange; ensure listener/manual registration/connection tasks and UI status drain. Verify five-minute browser deadline independently of token timeout. Change credentials/environment during login: no token save or resource send after stale result.
- Verify ordinary Send and GraphQL/stream Connect wait for token; later refresh does not reopen the browser. Native reload/persistence and system-browser versus collection-cookie isolation remain required.
- Evidence so far: real native core loopback/manual exchanges and mocked Svelte IPC state passed. OS browser launch, actual Tauri channels/manual command and rendered UI have not been verified; CUA reports no enabled surfaces.

Legacy parity follow-up: the original get-token.ts also sends a configured state in the code token form. Preserved that field only when explicitly configured (generated random state remains internal); direct native Unicode/empty-state cases passed. Inspected oauth2 RedirectUrl::new versus from_url: new retains the original registered text. Explicit redirect text now survives default ports, host/scheme case and percent escapes in both authorization and token requests; only an allocated ephemeral port changes it. Three native builder/token exchanges passed these cases. Final clippy passed; release 63143 completed before these follow-ups, so final packaging is repeated.

Final Authorization Code/PKCE release session 27943 passed after both legacy parity corrections. The 135 application source hashes remained unchanged through packaging. Executable and NSIS SHA-256 are in BUILD.json; neither installer execution nor real browser/Tauri IPC acceptance was performed.

## Implicit callback gate

- In the native app with a disposable provider, authorize token, id_token, id_token token and none. Verify response modes, scope/audience/resource, exact redirect/state/issuer and fresh nonce. ID-only requires explicit ID-token credential selection; combined defaults to access_token. No claim of OpenID identity verification.
- Real browser follows fragment redirect to local callback, receives nonce-CSP page, clears fragment and delivers same-origin POST. Check CSP, IPv4/localhost/IPv6, static query, occupied port, failed relay/manual fallback and five-minute/cancel/close cleanup. Actual browser execution remains unchecked.
- Wrong secret/Origin/state/nonce/path, oversized URL/body, duplicate/mixed response, malformed ID token and provider denial must not save a token. Invalid callbacks keep waiting; valid denial ends the attempt. form_post and automatic remote/deep-link interception remain pending.
- No token URL is required for initial Implicit authorization; refresh requires it. none must save no token and block automatic resource Send. Cancel/stale settings cannot save a late token. Tokens stay out of response history. Verify persistence/reload, exported credentialKind and explicit consent when reusing imported ID-token credentials.
- Direct actual-module native TCP/validation checks and compiled Svelte/mock-IPC inspections passed; no saved test sources. This evidence does not close rendered UI/Tauri IPC/provider acceptance.

Final Implicit release session 8065 exited 0. All 137 captured source hashes matched after packaging; BUILD.json records executable/NSIS sizes and SHA-256. No installer launch or real browser/Tauri UI acceptance was performed.

## Legacy login-window gate

- Select Login window in native Auth and authorize Code/PKCE and Implicit using remote/custom/loopback registered redirects. Verify navigation/redirect/unreachable/fragment callbacks are captured before loading their destination; no code/token is in logs, titles, window-state or history.
- Wrong callback stays pending with warning; valid denial ends flow. Verify manual fallback, user close/cancel/timeout/delete/main close, creation/completion races and no orphan window.
- Verify separate shared cookies persist after restart. Fresh login session rotates only this profile and preserves API tokens. Check concurrent logins, reset restrictions and platform-specific profile storage.
- Try every application command from the login window, including after navigation to local app content: all must be denied; main commands must still work. Generated permission inspection does not prove actual IPC enforcement.
- Check popup limitation/guidance, callback-only popup, downloads, OS client-certificate behavior and unresolved legacy certificate/validateAuthSSL differences.
- Direct actual-module navigation/profile checks and compiled Svelte/mock-IPC checks passed. Real WebView/IPC/provider/session-reload/close acceptance remains pending; CUA has no enabled surfaces.

Legacy login-window release session 47190 exited 0. All 152 source hashes matched captured inputs after packaging; executable/NSIS hashes are in BUILD.json. Real window/provider/IPC/installer acceptance remains pending.

## Basic/Bearer/API-key acceptance gate

Direct preparation and native header echoes passed; native rendered UI/IPC/reload remain pending. Toggle Basic ISO 8859-1 and compare accented credentials; verify a default UTF-8 request is unchanged. Edit Bearer prefix and environment values. Import/re-export these auth settings. Add API-key Cookie with existing/disabled Cookie rows, test collection-cookie sending off/on and response storage, same/cross-origin redirects, SSE/WebSocket and a real provider. Browser preview must fail before sending an explicit Cookie. Verify manual Authorization takes precedence for Basic/Bearer/API-key headers, while API-key query remains present. Generate an OpenAPI apiKey in:cookie request and supply its environment value. See AUTH-INVENTORY.md; Digest/OAuth manual precedence is still outstanding.

## Manual Authorization acceptance gate

Native UI/IPC remains pending. Enable a manual Authorization for Digest/OAuth1/OAuth2, including empty/mixed-case/environment names and duplicate rows; it must be preserved without generated signing/challenges. HTTP/GraphQL/SSE/WS Send must not acquire/refresh OAuth or open login while manual auth is present. Explicit Fetch/Refresh must still manage saved tokens with resource headers excluded from the token request. Disable/remove the manual header and verify normal signing/refresh returns. Confirm manual 401 does not retry Digest, follow-off remains off, same-origin redirects retain the header and cross-origin removes it. Direct compiled workspace/native-core evidence is in AUTH-INVENTORY.md; it does not prove WebView UI, persistent cookies, TLS/proxy or provider behavior.

## AWS IAM native acceptance (pending)

Direct 34-case wire/signature inspection and 14 prior-auth regressions passed; see AWS-COMPATIBILITY.md. Still verify in the actual desktop app:

- Original Auth layout, masked fields, enabled toggle, environment changes, persistence/reload and Insomnia/Postman import; manual Authorization replacement notice.
- HTTP/GraphQL/SSE/WS signed requests, temporary token, exact UTF-8/binary/multipart, S3 paths/queries, explicit region/service, custom Host, same-origin redirect re-sign and cross-origin token removal.
- Provider success/error/expired credentials, cancel/timeout, TLS/HTTP2/proxy/client certificate and persistent collection cookies. Use an owner-authorized endpoint for any real AWS mutation.
- Imported query signing/malformed setting has an explicit signed-header action; existing presigned URL works with IAM disabled; CodeCommit GIT gives a visible unsupported error.
- Compare unusual legacy aws4 path/query cases before declaring full compatibility. No actual AWS account/provider or installer has been exercised.

## Hawk native acceptance (pending)

Direct native protocol/wire checks passed (HAWK-COMPATIBILITY.md). Verify in actual desktop UI/IPC: fields/default SHA256, masked key, legacy import default, environment changes/reload, all three signing modes, Postman mapping, manual/disabled precedence, fixed/generated timestamp/nonce, ext/Oz and visible malformed-input errors. Exercise HTTP/GraphQL/SSE/WS, exact binary/multipart, Host/port and Content-Type, redirect re-sign/body conversion/cross-origin stripping, cancellation/deadline and response history. Check provider compatibility including ext parser, TLS/HTTP2/proxy/client certificate/persistent jar. Payload validation means request hash only; no response-auth claim. Compare unusual legacy URLs and Postman serialization before declaring full parity.

## ASAP native acceptance (pending)

1. Use Auth → ASAP with a disposable provider key, legacy/Postman mode and environment-rendered issuer/audience/key. Verify Send, GraphQL introspection, SSE and WebSocket through real Tauri IPC.
2. Confirm claims, key ID/data URI matching, PEM editor/reload, ES512 P-521 PKCS8/SEC1 selection and wrong-curve/malformed-input errors. Verify manual/disabled auth bypass and no token resource persistence.
3. Confirm same-origin reuse and cross-origin credential stripping with TLS/proxy/cookies, cancellation and settings changes. Check source exports/imports preserve unknown original auth fields.
4. Direct native signature/wire checks passed; they do not satisfy UI/reload/provider or OS integration. See ASAP-COMPATIBILITY.md for all differences.

## NTLM native acceptance (pending)

1. Verify rendered Auth editor, environment credentials, domain/UPN, manual/disabled behavior and reload with disposable provider credentials. Workstation Type3 is explicitly pending.
2. Verify real IIS/AD authentication and WS/SSE via Tauri IPC, cancellation/deadlines, TLS/custom CA/client certificate/proxy and persistent cookies.
3. Verify original-origin redirects, closed-connection error and no Type3 on a replacement connection. Direct HTTP/TLS loopback evidence is in NTLM-COMPATIBILITY.md; it does not satisfy provider/UI acceptance.
4. Resolve NTLMv1/LM, proxy407, Type3 workstation and unusual certificate/username cases before marking full parity.

## Netrc native acceptance (pending)

1. Use a disposable profile with synthetic .netrc/_netrc and verify HTTP/GraphQL/SSE/WebSocket sends through real Tauri IPC, disabled/manual override, cancellation, reload and credential-free history/export/errors.
2. Verify HOME precedence, USERPROFILE fallback, missing/unreadable files, Windows fallback and Unix home lookup in packaged apps. Do not inspect existing user credential files as a development fixture.
3. Exercise TLS/proxy/persistent-cookie combinations and redirects with destination-specific/default/partial/empty entries. Source-host credentials must never be borrowed for another destination. Native loopback proof and explicit behavior differences are in NETRC-COMPATIBILITY.md.

## gRPC native acceptance (integration implemented; real UI/IPC pending)

1. Verify default legacy JSON and Svelte integration with existing grpc_request/proto_file/proto_directory records without changing saved bodies, hierarchy or method selection. Compare original layout, additive imports, nested tree, file replacement, directory refresh preserving IDs/absent old files, confirmed subtree deletion, invalid-schema/cancel/concurrent-change handling, source editing, method discovery, environment changes and persisted reload. Close remaining JSON/method/example/editor edges listed in GRPC-COMPATIBILITY.md.
2. Exercise unary/server/client/bidi through Tauri IPC: Send, repeated messages, Commit half-close, cancel, deadline, method/context change, close/shutdown and late events. Verify acknowledgements bound delivery and no stale sender/registry remains after errors.
3. Exercise reflection v1/v1alpha, local hierarchy imports, stale schema invalidation, binary/text metadata, initial/trailing metadata, errors and saved responses. Use custom CA/client identity and real providers/platforms after the local protocol checks.
4. Compare original response defaults, WKT, bytes, oneof flags, longs/enums and invalid/coerced input behavior; verify native-only browser guidance and preserved Insomnium layout.64 native cases,97 legacy differential and75 frontend/workspace checks passed (including native compiler validation), but do not establish UI/IPC/reload/provider parity. See GRPC-COMPATIBILITY.md.
