# AUTHENTICATION migration

Updated 2026-10-14. Auth implementations and direct checks exist for Basic/Bearer/API key/Digest/OAuth1/OAuth2/AWS/Hawk/NTLM/netrc/ASAP. Real provider, browser/WebView callback and edge/platform acceptance remain required.

See [current status](STATUS.md), [execution plan](PLAN.md) and [complete parity requirements](PARITY.md). No original scope was removed by consolidation.

## Current implementation and remaining source gaps
OAuth asynchronous ownership (2026-10-17,parent1e8c27d1): manual Fetch/Refresh and saved-token adoption retain their workspace-data owner and run ID. Old failures cannot overwrite replacement feedback; cleanup removes only its own run/progress/completion promise. Retired rendering cannot start an exchange or adopt a token into replacement data. Shared exchange progress/results also check workspace identity and current operation/dependency owner. Existing oauthSourceContext checks continue reporting ordinary settings/environment changes. Existing plugin-oauth-preview scenario passes history8, mounted pause/resume and one combined operation-ownership check (queued render failure after data replacement, replacement-run cleanup and successful render with stale adoption refused). artifacts/playwright/plugin-oauth-preview/result.json has10checks. Compiler57969 exits0/0errors0warnings; frontend build0 after adding the final progress-data guard. No new runner/native build/provider calls/live handles. Real held provider progress/results, completion-overlap/provider/native/platform acceptance remains open.

Proxy work implements NTLMv2, challenge-only Basic fallback and now RFC7616 Digest for HTTP proxy requests/CONNECT. The vendored challenge callback receives exact method, request-target and buffered entity bytes; its default remains compatible with existing providers. Proxy Digest shares the origin parser/signer (MD5/SHA-256/SHA-512-256, supported session/qop variants, auth-int, UTF-8/NFC, userhash/username*) while using only Proxy-Authenticate/Proxy-Authorization and proxy credentials. NTLM selection remains first; a supported Digest challenge precedes Basic. Rejection never downgrades to Basic; one stale retry requires a new nonce with unchanged realm/algorithm, then the session is terminal. Existing replay/drain/TLS/socket/retry limits remain. Reference https://www.rfc-editor.org/rfc/rfc7616.html section3.8. cargo check --manifest-path src-tauri/Cargo.toml --locked exits0 (~8.5s), including the modified reqwest fork; Rustfmt/scoped diff check pass. Bounded Windows native acceptance now passes8groups using INSOMNIUM_PROXY_DIGEST=1 with the existing proxy-ntlm.js runner: mounted Preferences/Send/reload, independent exact-wire SHA-256/auth-int proofs for HTTP absolute targets and CONNECT authority targets, exact binary replay, one stale retry, rejection without Basic downgrade, Basic/NTLM controls and independent origin-Digest regression. Receipt artifacts/playwright/proxy-ntlm-1792191309663/acceptance.json; all20proxy attempts belong to sockets closed before cleanup, no proxy credentials reach origin. Host66456 native-hidden/visiblefalse exits0; full profile wrapper plus resource-manager-restoration-1792191309624 pass, both original buffers b06cdd2afff926e8a93ddfad2b7cb00b7f31bc8566c45e5a9beccb8407c1697c. Single native Cargo build6m55 at artifacts/native-proxy-digest-probe-attempt-2/build-state.json, appSHA1a2bcb538f4fc8e5baf65e8d0312e70ee691390f3d5453a5f23c8c3f0bce3ea0; final compiler43724 passes0errors0warnings. Existing integration producer adds INSOMNIUM_UI_NATIVE_PRODUCT_ONLY=1 to omit unused recovery JS; the first pre-Cargo PDF/Vite fixture-alias failure remains in artifacts/native-proxy-digest-probe. Product compiler profile/identity are unchanged; no new runner/provider call/full historical suite/live handles. Other Digest algorithms/session/Unicode/userhash/TLS-proxy variants, broader refusals/cancellation/platform/provider, full source/legal linkage and full prior30group replay remain unverified; prior30group NTLM evidence remains version-scoped. Negotiate/older NTLM/provider/platform and the complete proxy/authentication gate remain open.

Legacy libcurl-promise.ts:318 sets PROXYAUTH Any. Explicit HTTP(S) proxy credentials now use proxy_auth.rs and a vendored reqwest challenge transport, answering actual407 headers on an owned HTTP/1 sender. HTTP and HTTPS CONNECT keep the same socket throughout NTLM rounds. Proxy and origin credentials, nonces and TLS certificate bindings remain distinct. Fully drained final bodies can return the sender to a private per-client slot; incomplete responses and cancelled exchanges dispose it. CONNECT retains the configured User-Agent, connection metadata survives into Timeline, and provider Debug output is redacted. Ordinary proxies retain their existing transport.

Prior Windows release82636 passes30 saved groups at artifacts/playwright/proxy-ntlm-1791979742120 (host5300/native-hidden/exit0): mounted Preferences/Send/reload; all HTTP/HTTPS proxy/origin combinations; exact256-byte body replay, target/header/User-Agent/address preservation; independent NTLMv2 proofs and certificate AV10; strict TLS refusal and explicit bypass binding; Basic-only fallback; malformed/duplicate/repeated/oversized/closed challenges on HTTP and CONNECT; scheme-less credentials; distinct simultaneous origin NTLM; redirect, OAuth, incremental SSE and text/binary WS echo/history/disconnect; actual Git curl CONNECT control. All76 observed proxy attempts belong to sockets closed before fixture cleanup, and the scenario asserts the complete owned socket set is empty. Original profile bytes/layout are restored (resource receipt1791979742108). HTTP2/compression metadata9 plus restart and cURL TLS7 regressions pass the same current binary. These are owned IPv4 Windows fixtures, not hosted providers or other-platform acceptance.

Replay is bounded to20 MiB, challenge headers96 KiB, challenge drain1 MiB and3 retries. Unsupported authentication schemes fail explicitly. Initial public-doc lint, PEM newline/selector/history-URL/FIN assertions and curl prerequisite/revocation failures remain historical receipts; corrected assertions preserve the complete acceptance scope. Current clippy exits0 with a new large_enum_variant warning for the approximately1 KiB per-session state and3 pre-existing application warnings; eventsource-stream also retains its5 pre-existing dependency warnings. This is not a warning-free Rust quality receipt.

Sources consulted: [Hyper HTTP/1 connection API](https://docs.rs/hyper/latest/hyper/client/conn/http1/index.html), [Hyper upgrade ownership](https://docs.rs/hyper/latest/hyper/upgrade/index.html), [RFC9110 proxy challenges and CONNECT](https://www.rfc-editor.org/rfc/rfc9110.html), [RFC5929 certificate binding](https://www.rfc-editor.org/rfc/rfc5929.html), and pinned reqwest0.12.28/Hyper source. Commands: cargo check --manifest-path src-tauri/Cargo.toml --locked; bun tests/ui/build-recovery-copy-probe.js artifacts/native-proxy-ntlm-probe app.insomnium.probe.agentintegration20261014; run the saved proxy scenario with INSOMNIUM_UI_BUILD_STATE pointing to that build and INSOMNIUM_UI_PROBE_IDENTIFIER=app.insomnium.probe.agentintegration20261014. Build and native receipts must remain separate from compiler/source evidence.

OAuth1 addParamsToHeader=false is implemented across oauth1-model.js, OAuth1Editor.svelte and the Rust signer/redirect adapter. Following https://learning.postman.com/docs/use/send-requests/authorization/oauth-10, URL-encoded POST/PUT requests append signed OAuth parameters to the form; other requests append them to the URL query. Default/true keeps Authorization header placement. Existing query/body bytes are retained, generated parameters are encoded, form Content-Length is refreshed and limits remain64KiB auth/20MiB body. Each attempt signs a fresh request clone: generated parameters never accumulate in the redirect/retry source or automatic Referer, and signing remains original-origin only. Archived native get-token.ts always used oauth.toHeader; this closes a Postman compatibility gap rather than missing original native behavior. Frontend/Cargo checks and direct configuration checks pass; actual wire/signature/redirect/provider/native UI acceptance remains open. Existing url-encoding.js is the maintained native acceptance runner; no new runner was created. addEmptyParamsToSign and disableHeaderEncoding are now implemented too: empty token/version values participate in signing and URL/form placement, while the header omits empty values; raw-header mode changes only serialization (including realm), retaining canonical signature normalization and HeaderValue validation. Source contracts: https://raw.githubusercontent.com/postmanlabs/postman-runtime/develop/lib/authorizer/oauth1.js and node-oauth1@1.3.0 index.js (https://cdn.jsdelivr.net/npm/node-oauth1@1.3.0/index.js). Legacy version defaults remain1.0; standard empty version remains empty. Checkbox controls are available in Auth. Frontend/Cargo and configuration checks pass. Native-hidden Windows acceptance now verifies four local HTTP requests: baseline header, query destination, URL-encoded POST form (Unicode and exact Content-Length) and raw header with empty-token/version signing. Each signature matches an independent HMAC-SHA256 calculation from exact wire data. Command: INSOMNIUM_OAUTH1_OPTIONS=1 with INSOMNIUM_UI_BUILD_STATE=artifacts/native-namespace-audit-probe/oauth1-options-20261017-attempt-1/build-state.json, then bun tests/ui/url-encoding.js. Receipt artifacts/playwright/oauth1-options-1792188257440/oauth1-options-acceptance.json; host76376 native-hidden exits0; resource-manager-restoration-1792188257235 proves exact profile restoration. One release build (Cargo6m34) reused after test-only capture-helper corrections; initial failure1792188234756 retained. Redirect/retry, PUT/nonform/other signatures, actual UI checkbox editing, provider and platform acceptance remain open.

## Topic records

<a id="record-asap-compatibility"></a>

<details>
<summary>ASAP-COMPATIBILITY</summary>

# ASAP compatibility checkpoint

Updated 2026-09-24. Implemented and directly inspected; native UI/provider acceptance is pending.

## Behavior

- Native JWT generation is shared by HTTP, GraphQL, SSE and WebSocket. Enabled manual Authorization bypasses generation, including unused invalid credentials; disabled ASAP does nothing. Browser preview reports native-only support.
- Insomnium mode uses RS256, a 600-second default lifetime, sub defaulting to issuer, iat/nbf/exp and a 20-byte random hex jti. Additional JSON claims merge last, including registered claims. A fresh token is generated per operation, reused on same-origin redirects and removed outside the original origin. The original adapter created a new generator per invocation, so its nine-minute closure cache was not a global request cache.
- Postman import maps iss/sub/aud/kid/alg/claims/exp and selects explicit Postman mode. It uses truthy registered-claim fallbacks, UUID v4 jti, no default nbf or typ, default 3600-second duration and effective-issuer subject fallback. Claims exp is an absolute timestamp; configured expiry is a duration. Claims kid can override the configured header kid.
- Supported Postman algorithms: RS256/384/512, PS256/384/512, ES256/384/512. ES512 uses P-521 with SHA-512 and the 132-byte JWS signature format.
- Unencrypted RSA PKCS1/PKCS8 PEM and base64 DER/PEM are supported. Literal backslash-n and quoted PEM normalization match the original generator. ES256/ES384 use PKCS8 matching the selected curve. ES512 accepts P-521 PKCS8 or SEC1 PEM/DER; data URIs still require PKCS8. PKCS8 data URI decoding is explicit, including percent-encoded kid; a supplied Key ID must match its embedded kid, or can be blank to adopt it. The original UI advertised data URIs but its actual adapter did not call the parser.
- RSA keys are bounded to 2048–8192 bits, fields and generated tokens to 64 KiB, and shared replay bodies to 20 MiB. Private keys remain ordinary local request credentials; generated tokens are not persisted as OAuth resources. Errors omit private key/token values. Authorization HeaderValue is sensitive.

## Deliberate differences and remaining gaps

This API client preserves explicit custom/expired claims rather than enforcing every server-side ASAP protocol requirement. Numeric dates are required. Legacy object/array/falsy additional claims are supported; unsupported primitive/prototype-property cases stop explicitly. Postman validates issuer/subject/jti as non-empty strings and configured duration as 1–3600 seconds; unusual loose JavaScript coercions and unbounded/negative durations are not reproduced. Zero/invalid parsed duration falls back to 3600, following the original Postman default behavior.

Entirely percent-encoded PEM or an encoded data-URI prefix is not decoded. Encrypted keys, unusual Postman key/claim coercions, real provider compatibility, Tauri UI/IPC/reload, TLS/proxy/HTTP2 and persistent-cookie integration remain acceptance work. No provider keys, user credential files or production endpoints were read. JWT body bytes are not a signed payload hash; ASAP authenticates with JWT claims.

## Evidence

64 direct native cases passed using actual signing modules and HTTP builders compiled from stdin, 27 direct token cases and 21 loopback wire requests. Independent Bun crypto verification covered all eight supported algorithms, PKCS1/PKCS8/base64/data-URI formats, claim precedence/defaults, unique IDs, key/algorithm/input rejection, same-origin replay, cross-origin stripping, body-dropping redirects, limit/follow-off/401 behavior, SSE/WS and manual override. Pure JavaScript import/environment/browser checks also passed.

45 Hawk, 34 AWS and 14 manual-auth/Digest/OAuth1 regression cases passed against the same updated executable. Persistent jar was not attached. Svelte check returned zero errors/warnings; Rust clippy -D warnings and debug library build passed. No test script/source was saved. These inspections do not establish native UI/provider acceptance.

## Sources read before implementation

- Official ASAP protocol: https://s2sauth.bitbucket.io/spec/
- Pinned original library: https://unpkg.com/httplease-asap@0.6.0/lib/authHeaderGenerator.js and https://unpkg.com/httplease-asap@0.6.0/lib/parseDataUri.js ; package metadata identifies Atlassian's repository https://bitbucket.org/atlassianlabs/httplease-asap . Read only; no package JavaScript runtime was executed.
- Original JWT payload/key validation: https://raw.githubusercontent.com/auth0/node-jsonwebtoken/v9.0.0/sign.js
- Postman authorizer: https://raw.githubusercontent.com/postmanlabs/postman-runtime/develop/lib/authorizer/asap.js
- Rust JWT API: https://docs.rs/jsonwebtoken/11.1.0/jsonwebtoken/ and installed 11.1.0 encoding/RustCrypto implementation. RSA DER is converted to PKCS1; EC DER remains PKCS8. Exactly one crypto backend (rust_crypto) is selected.
- UUID API: https://docs.rs/uuid/latest/uuid/struct.Uuid.html#method.new_v4
- Documented dependency command: https://doc.rust-lang.org/cargo/commands/cargo-add.html
- Archived application: network/authentication.ts, models/request.ts, ui/components/editors/auth/asap-auth.tsx and ui/components/auth-private-key-row.tsx under _backup/legacy-electron/packages/insomnia/src.

## ES512 follow-up (2026-09-24)

Added p5210.14.0 as a direct dependency with ecdsa/pem/std; this version was already in Cargo.lock through SSPI. jsonwebtoken11.1.0 has no ES512 Algorithm variant, so only this variant uses RFC7515 compact JSON/base64url encoding with RustCrypto signing. Existing JWT algorithms retain jsonwebtoken. No elliptic-curve/signature arithmetic is implemented in the app. Header alg is fixed to ES512 and kid follows the existing claims/data-URI rules; Postman mode has no typ. Legacy mode remains RS256.

The existing shared key decoder handles normalization/base64/data URI before selecting a P-521 key. PKCS8 validates the selected curve; SEC1 uses the library decoder/curve checks. Public-only, encrypted, wrong-curve and mismatched data-URI keys stop with secret-free errors. No key files are generated or read by this signing path; credentials stay in the existing local request field.

Inspected official p5210.13.3 docs first, then cargo info showed0.14.0 already installed. The0.14.0 docs.rs pages failed to fetch; read the actual downloaded crate ecdsa.rs, elliptic-curve0.14.1 SecretKey decoding and ecdsa0.17.0 signer/PKCS8 implementations. Its RFC6979 example retains an old TODO comment; the compiled dependency matched the official RFC6979 A.2.7 P-521/SHA-512 sample signature exactly in an inline inspection. This result resolves that specific example concern; it is not a general cryptographic audit.

89 actual native cases passed: all previous ASAP cases plus ES512 key formats, claims/mode restrictions, wrong/encrypted/public keys, explicit P-521 data URI, HTTP body, redirects/follow-off/final401, SSE and WebSocket.35 direct token results verified independently using Bun crypto across nine algorithms, including fixed132-byte ES512 R||S;31 authenticated wire observations. Svelte check0/0, clippy -D warnings, debug library build and formatting passed. Postman ES512 import/environment preparation passed. Source compiled from stdin; no test scripts saved. Real UI/IPC/provider/TLS/proxy/persistent-jar gates remain pending.

Additional sources: https://www.rfc-editor.org/rfc/rfc7515.txt ; https://www.rfc-editor.org/rfc/rfc7518.txt section3.4 ; https://www.rfc-editor.org/rfc/rfc6979.txt appendixA.2.7 ; https://docs.rs/p521/0.13.3/p521/ecdsa/index.html ; installed p5210.14.0 source/examples after documented cargo info/add.

Windows release session57219 exited0 (Rust release4m11s); all 165 captured source hashes matched after packaging. BUILD.json records the executable/NSIS hashes. No installer execution or publication; CUA still has no apps/browsers for real UI/IPC acceptance.


</details>

<a id="record-auth-inventory"></a>

<details>
<summary>AUTH-INVENTORY</summary>

# Authentication parity inventory

Updated 2026-09-24. Keep the full legacy scope; entries below are not removed merely because a smaller implementation builds.

| Method  | Original fields/behavior                                                                                                                           | Current migration / next action                                                                                                                                                                                                                                                                    |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Basic   | username, password, useISO88591; UTF-8 default, Buffer latin1 when selected                                                                        | Implemented including low-byte conversion and UI toggle; 20 comparisons to original function pass. Enabled manual Authorization takes precedence. Native UI/reload pending                                                                                                                         |
| Bearer  | token, prefix; blank prefix defaults Bearer                                                                                                        | Implemented, prefix now editable; manual Authorization takes precedence. NO_PREFIX is special only for OAuth2, not ordinary Bearer                                                                                                                                                                 |
| API key | key, value, addTo=header/queryParams/cookie                                                                                                        | All three implemented; Cookie is explicit, separate from collection jar. Manual Authorization suppresses generated header/cookie, but query auth still applies. Header duplicate values retained; Cookie values combined in order with semicolons. Native UI/cookie integration acceptance pending |
| Digest  | username/password, libcurl challenge; manual Authorization suppresses automatic challenge                                                          | Native challenge/signing and manual header precedence implemented; remaining proxy-407/rspauth/cache/encoding edges documented in STATUS                                                                                                                                                           |
| OAuth1  | four methods and original body adapter quirks                                                                                                      | Implemented including manual header precedence; AUTHENTICATION.md#record-oauth1-compatibility                                                                                                                                                                                                                            |
| OAuth2  | grants/browser/tokens/prefix, manual header eventually wins in legacy parser                                                                       | Implemented including manual header precedence; Send skips unused automatic exchange, explicit Fetch/Refresh remains available. Real UI/provider acceptance pending; AUTHENTICATION.md#record-oauth-compatibility                                                                                                        |
| AWS IAM | accessKeyId, secretAccessKey, sessionToken, optional region/service; aws4 1.13.2 infers host/service/region, respects manual Host and content type | Header signing/editor/import implemented using aws-sigv4 1.6.0; actual-body signing, Host inference and redirect isolation directly verified. See AUTHENTICATION.md#record-aws-compatibility for CodeCommit GIT, URL differences and runtime gates                                                                       |
| Hawk    | id, key, algorithm=sha1/sha256, ext, validatePayload; original signs rendered body.text and MIME when enabled                                      | Implemented SHA1/SHA256, explicit legacy/actual/Postman modes, editor/import and native shared signing; 45 native cases plus 48 regressions passed. Real UI/provider gates and URL/body differences are in AUTHENTICATION.md#record-hawk-compatibility                                                                   |
| ASAP    | issuer, subject, audience, keyId, additionalClaims JSON, privateKey PEM/data URI; httplease-asap 0.6.0, 10-minute expiry / 9-minute cache config   | Implemented legacy RS256 and explicit Postman RSA/PSS/ES256/384/512 mode, key decoding, claims precedence and native origin isolation. ES512 follow-up passed89 native cases with independent nine-algorithm verification; real UI/provider acceptance pending. See AUTHENTICATION.md#record-asap-compatibility          |
| NTLM    | username/password; libcurl NTLM challenge when no manual Authorization and enabled                                                                 | NTLMv2 implemented with SSPI, guarded HTTP/1 connection and TLS binding. Direct native proof/MIC/wire checks passed; Type3 workstation, NTLMv1/407 and native/provider gates remain pending. See AUTHENTICATION.md#record-ntlm-compatibility                                                                             |
| netrc   | libcurl NETRC Required, no fields in original UI                                                                                                   | Implemented native discovery/parser/Basic and per-destination lookup;45 native cases and187 auth regressions passed. See AUTHENTICATION.md#record-netrc-compatibility; native UI/platform/provider acceptance pending                                                                                                    |

Legacy evidence: `network/authentication.ts`, `network/basic-auth/get-header.ts`, `network/bearer-auth/get-header.ts`, `main/network/parse-header-strings.ts`, `main/network/libcurl-promise.ts`, `models/request.ts`, and `ui/components/editors/auth/*` under `_backup/legacy-electron/packages/insomnia/src`.

## Basic/API-key decisions and limits

Latin-1 deliberately matches the original UTF-16 low-byte conversion, including out-of-range/surrogate truncation. No browser Buffer/polyfill/runtime dependency is added. A malformed imported encoding toggle stops sending until the user chooses a boolean option. Existing Basic colon/control input behavior is unchanged; this migration does not silently rewrite credentials.

Cookie authentication sends raw key=value, with no percent encoding, like the original adapter. Existing enabled Cookie values retain order; disabled rows are omitted. It is not inserted into the persistent jar. Explicit Cookie headers take precedence over automatic collection cookies and still send when the collection-cookie switch is off. A response can still set ordinary collection cookies if storage is enabled. Browser preview rejects explicit Cookie before fetch because browsers control that header. Normal native reqwest redirect/header policy remains in place; cookie persistence/TLS/proxy and UI acceptance are not proven by a direct header echo.

OpenAPI apiKey in:cookie now generates this supported auth mode. General OpenAPI cookie-parameter serialization and multi-scheme authentication remain separate outstanding mappings.

## Next implementation order

1. DONE in code/direct inspections: manual Authorization precedence for Digest/OAuth1/OAuth2 and explicit OAuth lifecycle. Native UI/IPC acceptance remains pending; verify it when a surface becomes available.
2. DONE in code/direct inspections: AWS IAM header signing. AUTHENTICATION.md#record-aws-compatibility tracks remaining legacy gaps and real AWS/UI/IPC acceptance.
3. Hawk is implemented and directly inspected (AUTHENTICATION.md#record-hawk-compatibility). ASAP is now implemented and directly inspected (AUTHENTICATION.md#record-asap-compatibility). NTLMv2 is now implemented and directly inspected (AUTHENTICATION.md#record-ntlm-compatibility). Netrc is now implemented/directly inspected (AUTHENTICATION.md#record-netrc-compatibility). Next: remaining NTLM/ASAP compatibility; keep UI and transport acceptance explicit for each. Update PARITY rather than declaring authentication complete after one method.

Official starting points: [Basic RFC7617](https://www.rfc-editor.org/rfc/rfc7617.html), [cookies RFC6265](https://www.rfc-editor.org/rfc/rfc6265.html), [libcurl HTTPHEADER](https://curl.se/libcurl/c/CURLOPT_HTTPHEADER.html), [libcurl NETRC](https://curl.se/libcurl/c/CURLOPT_NETRC.html), [Bun Buffer API](https://bun.com/reference/node/buffer), [OpenAPI security schemes](https://spec.openapis.org/oas/v3.1.1.html#security-scheme-object), [AWS Rust signing example](https://docs.rs/aws-sigv4/latest/aws_sigv4/http_request/index.html), [Hawk protocol/source](https://github.com/mozilla/hawk). The guessed Atlassian ASAP docs URL was unavailable; locate the current official specification before coding.

## Manual Authorization lifecycle

For Basic/Bearer/API-key/Digest/OAuth, enabled header presence wins, including an empty value, duplicate entries and environment-rendered/mixed-case names. Enabled AWS replaces manual Authorization as in the original AWS parser. Disabled rows do not override. Frontend leaves Digest/OAuth1 config absent and bypasses OAuth2 token validation for a manually authorized send; unused credential fields need not resolve. Native signed-request dispatch also preserves manual headers when directly supplied alongside credentials, and the client builder selects normal redirect policy for that path. Manual 401 is returned without automatic challenge; native redirects still remove sensitive headers on cross-origin changes.

Legacy network/authentication.ts calculated OAuth before the manual-header decision in parse-header-strings.ts. The migration deliberately avoids that unused work on Send: no automatic fetch, refresh or login window, and existing token records are retained. Explicit Auth Fetch/Refresh still validates its config, exchanges using a separate request with resource headers removed, and updates saved tokens. Disabling/removing the manual header restores ordinary automatic acquisition/refresh. This applies to HTTP, GraphQL introspection, SSE and WebSocket. Manual access-token override remains distinct and retains its existing Fetch/Refresh validation.

Compiled Svelte workspace with mocked IPC passed those lifecycle cases. Fourteen native loopback cases used the actual request types/build_client/build_request and signed executor compiled from stdin; persistent jar was not attached. Covered empty/duplicate headers, unused invalid credentials, redirect/follow-off/cross-origin, final 401, SSE/WS and automatic Digest/OAuth1 regressions. No saved test scripts; no real Tauri UI/IPC or TLS/proxy/persistence claim.

## AWS implementation references

Read upstream aws4 **v1.13.2** source before choosing settings: https://raw.githubusercontent.com/mhart/aws4/v1.13.2/aws4.js . Host matching covers amazonaws.com/.com.cn, reversed es/aoss labels, s3-region and bucket.s3 global forms; region falls back to us-east-1 and email service maps to ses. A non-AWS custom endpoint needs explicit service/region when inference cannot identify it. Original adapter only passes content type plus effective Host into aws4, not every manual header; record any corrected behavior explicitly.

Canonicalization differs for S3: path normalization disabled, single encoding/slash handling, first duplicate query value in the old library, explicit payload checksum header. Other services normalize paths and sort encoded query values. Do not apply one default blindly. Official SigningSettings has percent_encoding_mode, uri_path_normalization_mode, payload_checksum_kind and session_token_mode. The latest module/struct docs resolved to different cached versions (1.6.0/1.5.3); pin/read the installed crate API after documented cargo info/add, then implement. Implementation now uses the installed 1.6.0 API/source; see AUTHENTICATION.md#record-aws-compatibility for selected settings, differences and verification.

## Hawk research and implementation references

Read official protocol/API https://github.com/mozilla/hawk/blob/main/API.md and Rust candidate https://docs.rs/hawk/5.0.1/hawk/ . The candidate documents SHA256/384/512; legacy supports SHA1 and SHA256, so inspect its algorithm API before adopting it. Do not silently drop SHA1. Original dependency is hawk 9.0.1; authentication.ts lines 94 onward passes rendered body.text and body.mimeType only when validatePayload is true, plus id/key/algorithm/ext. It calls Hawk.client.header(url, method), not effective manual Host. Original UI fields are in ui/components/editors/auth/hawk-auth.tsx.

Next read pinned client/crypto source (URL/port normalization, ext/header escaping, nonce/timestamp and payload optionality), compare missing text for multipart/binary/form/GraphQL, and decide an explicit compatibility mode for exact-body signing. Retain manual Authorization precedence, disabled behavior and native redirect credential isolation. Official API includes published header/payload vectors for independent inspection. Hawk was implemented after the AWS checkpoint; see AUTHENTICATION.md#record-hawk-compatibility. No new dependency was required.

Pinned Hawk source read: https://raw.githubusercontent.com/mozilla/hawk/v9.0.1/lib/client.js and crypto.js. Client uses URL hostname and explicit port (http=80, otherwise443), retains trailing question mark, generates a six-character nonce, hashes only defined/non-null payload including an empty string, and escapes ext in both normalization and the header. SHA1/SHA256 are accepted. Confirm original request defaults before deciding absent-text behavior. Rust candidate 5.0.1 algorithm detail page could not be fetched; inspect official crate source via cargo info before dependency selection.

## ASAP research and implementation checkpoint

Official protocol located: https://s2sauth.bitbucket.io/spec/ (linked from https://s2sauth.bitbucket.io/). Read generation/transport sections: asymmetric signed compact JWT, mandatory kid/iss/aud/iat/exp/jti, Bearer header, RS256 recommended, lifetime at most one hour. Original adapter creates a new httplease-asap generator for each getAuthHeader invocation, with 10-minute expiry/9-minute cache settings; the closure therefore is not a global cross-request cache.

Inspected exact published httplease-asap 0.6.0 source read-only through https://unpkg.com/httplease-asap@0.6.0/lib/authHeaderGenerator.js and parseDataUri.js after registry metadata identified Atlassian repository https://bitbucket.org/atlassianlabs/httplease-asap (raw tag fetch unavailable). Generator fixes RS256, converts literal backslash-n and removes double quotes from PEM, defaults sub to issuer, creates 20-byte random hex jti plus nbf/iat/exp, then merges additionalClaims last (overrides standard claims). jsonwebtoken dependency is ^9.0.0. No package code/Node/npm was executed.

Data URI parser decodes URI text, expects application/pkcs8 with kid and base64 DER, uses PKCS8 private key and returns base64-encoded PEM. Inspect AuthPrivateKeyRow plus templating/base64 decode before implementing the complete data path; do not assume privateKey is already PEM or feed a data URI directly to RSA. Next inspect a documented Rust JWT library and key/claim validation options, preserve explicit legacy merge semantics, manual/disabled precedence and native origin isolation. No real keys or external user credential files were read.

Follow-up: AuthPrivateKeyRow only stores the edited text. A search of the actual insomnia/src tree found no parseDataUri call; the original getAuthHeader passes privateKey directly to the generator. Therefore the help text alone does not prove data URI worked in the original app. Distinguish this advertised capability from the implemented path, and implement a deliberate documented decode path. A separate guessed insomnia-inso/src path was absent; it is not evidence about the app.

Implementation followed this research with jsonwebtoken 11.1.0 RustCrypto and uuid 1.26.1 v4. AUTHENTICATION.md#record-asap-compatibility records exact semantics, inspected cases and remaining differences. Next inspect NTLM connection-bound transport and netrc discovery/parser rules without reading user credential files.

## NTLM/netrc research checkpoint (NTLM implementation subsequently added)

Original libcurl-promise.ts lines384–395 enables NTLM only without a manual Authorization header and when not disabled, using username/password (empty defaults). Netrc separately sets Required solely by auth type; it does not have that same disabled/manual guard. Its UI has no credential fields. Do not assume a generic auth toggle exactly reproduces this branch. Original package pins @getinsomnia/node-libcurl ^2.36.12; bundled libcurl version still needs inspection.

Official Microsoft connection-oriented flow uses NEGOTIATE, CHALLENGE and AUTHENTICATE messages: https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-nlmp/1f18ef3b-7d62-4e1a-a8a7-6bc0607fad70 . Protocol index is revision37.0 dated2026-03-30: https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-nlmp/b38c36ed-2804-4868-a9ff-8dd3182128e4 . HTTP server auth and proxy auth are separate in https://curl.se/libcurl/c/CURLOPT_HTTPAUTH.html . Connection reuse must remain credential-bound; upstream historical advisory illustrates the risk: https://curl.se/docs/CVE-2014-0015.html . A static header signer or arbitrary pooled retry is not a completed NTLM transport.

Rust candidate sspi offers platform-independent NTLM and channel bindings, with documented credential acquisition/security-context APIs: https://docs.rs/sspi/latest/sspi/ and https://docs.rs/sspi/latest/sspi/ntlm/struct.Ntlm.html . These latest URLs returned differing cached versions (0.21.3 and0.21.0); use documented cargo info and installed source before selection. Inspect minimal features/dependency footprint, NTLMv2/MIC/channel binding, domain/user parsing, existing working examples, explicit credentials versus OS default behavior and malformed challenge handling. Do not silently authenticate as the logged-in user for empty imported credentials.

Next design decision: guarantee HTTP/1 connection ownership across challenge rounds (including draining bounded responses/reconnect behavior), body replay, redirects, same-origin credential scope, deadline/cancel, TLS endpoint binding, proxy and WS upgrade. Compare dedicated Hyper connection with maintained Rust libcurl bindings; preserve existing cookie/TLS/response integration. No new transport/library selected yet.

Netrc docs: https://curl.se/libcurl/c/CURLOPT_NETRC.html . Current Windows lookup prefers HOME then USERPROFILE, .netrc then _netrc; NETRC filename environment override was added only in8.16.0. Required ignores URL credentials; machine matching is hostname-based across protocols/ports, with default entry, quoted escapes and skipped macdef blocks. This is current curl behavior, not proof of the old bundled version. Next inspect the pinned original libcurl and parser source, file-not-found/no-match/error behavior and redirects before defining compatibility. Raw curl8.16.0 netrc.c fetch failed through web; retry via official GitHub/source. Do not read user credential files during research or inspections; use in-memory synthetic fixtures. Existing configured netrc requests should be the explicit activation boundary.

Follow-up metadata: read-only registry lookup for @getinsomnia/node-libcurl2.36.12 identifies Kong/node-libcurl commit4ace7501b58e7b6de6924743c32e747d38a8cf2e. Its pinned README at https://raw.githubusercontent.com/Kong/node-libcurl/4ace7501b58e7b6de6924743c32e747d38a8cf2e/README.md lists an old prebuilt libcurl7.73.0 but notes build variation; inspect actual build configuration before treating this as the bundled version. Root package-lock/yarn/pnpm lockfiles are absent in the archive. Rust curl0.4.50 exposes Auth::ntlm with backend build requirements: https://docs.rs/curl/latest/curl/easy/struct.Auth.html#method.ntlm . No package runtime was executed and no new dependency selected.

NTLM implementation decision: retained the existing reqwest transport with a documented connector layer, dedicated HTTP/1 client and pre-connect refusal after Type2. Added SSPI0.22.0 and X509 parsing after inspecting installed API/examples. Exact behavior, evidence and gaps are in AUTHENTICATION.md#record-ntlm-compatibility. Netrc remains next; no user credential files have been inspected.

### Pinned netrc source identified

The package commit's .libcurl-version is7.86.0: https://raw.githubusercontent.com/Kong/node-libcurl/4ace7501b58e7b6de6924743c32e747d38a8cf2e/.libcurl-version . Its build-and-release.yaml reads that for Unix builds. Windows checks out curl-for-windows commit9e99250bc176129b29ef38cebec0c920381f6fb1, whose curl submodule iscd95ee9f771361acf241629d2fe5507e308082a2; include/curl/curlver.h labels it7.86.0-DEV. This is stronger pinned-source evidence than the stale README7.73 or unused WIN_DEPS7.79 text, though no installed legacy binary was executed.

Read https://raw.githubusercontent.com/curl/curl/cd95ee9f771361acf241629d2fe5507e308082a2/lib/netrc.c and release7.86.0 equivalent. Supports case-insensitive keywords/hostname, quoted escapes, comments, default and skipped macros; the old parser is a streaming state machine, not simply independent machine objects. It can retain partial credential fields between matching sections; do not accidentally infer modern semantics. Missing file and missing match both return positive; malformed quotes return negative. Windows checks HOME/USERPROFILE then .netrc, with _netrc fallback on positive status (including no host match), not only file absence. NETRC environment override was not present.

Read https://raw.githubusercontent.com/curl/curl/curl-7_86_0/lib/url.c around override_login. Required clears connection URL credentials, but separately preserved URL username can still influence matching. Positive parser result logs/defaults rather than immediately failing; negative returns CURLE_READ_ERROR. Netrc-derived credentials can be recalculated for redirect destinations. Before coding, decide and document exact legacy versus corrected behavior for partial entries, missing file/match, default credentials, URL userinfo and cross-origin redirects. Inspect the original header/manual/disabled branch rather than applying the other auth methods' defaults mechanically. Keep file access opt-in by netrc auth selection and errors secret-free; synthetic fixtures only during development. No netrc code/dependency has been added yet.

Netrc implementation followed the pinned/current-source comparison. It keeps per-host/section credentials independent, honors disable/manual auth, and bounds file/token reads; known curl redirect credential-retention defects are deliberately not reproduced. See AUTHENTICATION.md#record-netrc-compatibility for decisions, evidence and remaining acceptance.

### Next auth gap research (no implementation yet)

jsonwebtoken11.1.0 Algorithm still has ES256/ES384 but no ES512: https://docs.rs/jsonwebtoken/11.1.0/jsonwebtoken/enum.Algorithm.html . RustCrypto p5210.13.3 documents native ECDSA SigningKey/Signature with the ecdsa feature: https://docs.rs/p521/0.13.3/p521/ecdsa/index.html . Before adding a dependency, inspect cargo info/installed source and PKCS8 support, then RFC7518 section3.4 (P-521/SHA512, fixed-width R||S signature) and published vectors: https://www.rfc-editor.org/rfc/rfc7518#section-3.4 . Preserve the existing ASAP key/data-URI and claims semantics; do not substitute another alg or write elliptic-curve arithmetic. No P-521 dependency or source edit was made at the netrc checkpoint.

SSPI0.22.0 installed ntlm/messages/client/authenticate.rs explicitly leaves the workstation empty at lines53 and211. The NtlmConfig documentation fetch failed; installed source remains authoritative. A Type3 fix must incorporate workstation before offsets/MIC are calculated; rewriting signed token bytes afterward would be invalid. NTLMv1/proxy and real-provider acceptance remain separate work.

ES512 research above was implemented using p5210.14.0 already present via SSPI, after cargo info/source inspection.89 ASAP native cases and the exact RFC6979 sample signature passed; see AUTHENTICATION.md#record-asap-compatibility. No remaining ES512 unsupported-algorithm gate; key/claim edge cases and real provider/UI remain in scope.


</details>

<a id="record-aws-compatibility"></a>

<details>
<summary>AWS-COMPATIBILITY</summary>

# AWS IAM compatibility

Implemented 2026-09-24; native UI/provider acceptance remains pending.

## Implementation

- Legacy `authentication.type = iam`, enabled toggle and accessKeyId/secretAccessKey/sessionToken/region/service are retained. Every field renders with the existing environment resolver. No AWS environment/profile/metadata credential discovery or account access is performed.
- Native `aws-sigv4` 1.6.0 + `aws-credential-types` 1.3.0 sign the actual buffered bytes (20 MiB limit), after multipart encoding. Shared executor covers HTTP, GraphQL, SSE and WebSocket upgrade. OAuth2 token exchange/browser envelopes clear the AWS config. Browser preview rejects AWS signing.
- Same-origin redirects are signed again with the effective method, URL and body. The original effective Host is retained for signing at that origin. 303 and POST 301/302 switch to GET and drop body/content headers. Authorization/date/session-token/checksum are removed at every redirect; cross-origin requests get no generated AWS credentials. Client certificate origin restrictions, cancellation/deadline and redirect limit stay in the existing executor.
- As in the original AWS branch, enabled AWS replaces manual Authorization. It also replaces X-Amz-Date, X-Amz-Security-Token and X-Amz-Content-Sha256, avoiding stale or duplicate signing fields. The Auth editor states this explicitly. Disabled AWS leaves manual credentials intact. Digest/OAuth/Basic/Bearer/API-key manual-header rules are unchanged.
- Effective Host drives legacy endpoint inference: amazonaws.com/.com.cn, global bucket.s3, s3-region, reversed es/aoss, email→ses and default us-east-1. Explicit fields override inference; email also maps to ses when supplied explicitly. Custom endpoints need an explicit service; dualstack/FIPS/new endpoint forms should supply both service and region. A manual Host with a port is parsed as an authority; duplicate/invalid Host fails before sending.
- S3 uses single URI encoding, disabled path normalization and generated SHA-256 payload header; ordinary services use AWS SDK double encoding and normalization. Session token is included in the signature. The AWS SDK signs existing eligible headers, including custom x-amz fields/content type, while transport/proxy/WebSocket-mutated headers and collection Cookie are excluded. Generated headers are marked sensitive using the SDK flags.
- Postman awsv4 maps accessKey/secretKey and preserves the source fields. Its missing service/region use Postman's execute-api/us-east-1 defaults. Imported query signing stays visibly blocked until the user chooses signed headers. URLs already containing signing credentials fail with guidance to disable IAM for a presigned URL.

## Explicit differences and remaining scope

The old adapter supplied only Host/content type/body text to aws4 1.13.2. The new implementation signs actual bytes and eligible manual headers. It follows AWS SDK query canonicalization, including all duplicate query values and empty keys; old aws4's S3 branch took only the first duplicate value and discarded empty keys. Unusual percent-encoded/slash/path behavior is not claimed to be bit-for-bit compatible with the old URL parser. Review these cases against the intended AWS service, rather than assuming a matching build proves parity.

CodeCommit's special `GIT` signing is implemented as of 2026-10-01; six fixed-time aws4 reference signatures pass, while fresh native UI/wire/redirect/provider acceptance remains pending. SigV4a, presigned URL generation and chunk/event-stream body signing are not implemented. Ordinary pre-existing presigned URLs can be sent with IAM disabled. There is no automatic clock-skew retry or credential acquisition. The original Enable toggle is respected; the legacy unconditional AWS parser branch is not reproduced when disabled.

Real AWS endpoint acceptance, temporary credential expiration, TLS/proxy/HTTP2, cookie-provider interaction, UI/environment switching/reload and Tauri IPC remain unverified. CUA exposes no apps/browsers. No AWS account or real credentials were used; no installer was run.

## Verification

- Svelte check: zero errors/warnings; Rust check/build and clippy `-D warnings` passed.
- Actual request structs/builders, AWS/OAuth1/Digest modules compiled from stdin into an ignored inspection binary. Persistent jar deliberately not attached. No new test scripts saved.
- 34 native cases passed: independent Bun HMAC-SHA256 oracle reconstructed canonical requests from received wire headers/body; UTF-8 JSON/text, binary, multipart, escaped/duplicate query, S3 path, endpoint inference, manual Host, same-origin replay/303 conversion, cross-origin credential stripping, follow-off, 401, redirect limit, SSE/WS, no-session-token and malformed/missing/mixed credential rejection. Oversized signed body failed before send.
- Browser rejection, disabled auth, Postman mapping/query-signing retention were inspected directly. Existing 14 manual Authorization/Digest/OAuth1 native cases passed against the modified executor.
- Windows release/NSIS packaging passed session 36145 (Rust release 4m04s); all 157 captured source hashes matched after packaging. Exact artifact/source fingerprints are recorded in STATUS/BUILD.json. These checks do not establish the runtime gates above.

## Sources consulted before implementation

- https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-create-signed-request.html
- https://docs.rs/aws-sigv4/1.6.0/aws_sigv4/http_request/index.html (web fetch unavailable; read the official downloaded 1.6.0 crate source/settings/signing example)
- https://doc.rust-lang.org/cargo/commands/cargo-add.html
- https://raw.githubusercontent.com/mhart/aws4/v1.13.2/aws4.js
- https://learning.postman.com/latest-v-12/docs/use/send-requests/authorization/aws-signature
- https://raw.githubusercontent.com/postmanlabs/postman-runtime/develop/lib/authorizer/aws4.js

Installed API source: `D:/home/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/aws-sigv4-1.6.0`, plus aws-credential-types 1.3.0. Do not use a cached older SigningSettings page as evidence for the pinned API.

## 2026-10-01 evidence update

- Native UI import/reload/Send now accepted for S3/execute-api GET with encoding on/off and session tokens; independent wire SigV4 check: artifacts/playwright/url-encoding-1790798124712. This supersedes only those specific earlier UI/IPC gaps; provider/body/redirect/platform gates are unchanged.
- Legacy _getAwsAuthHeaders and AWSAuth UI never enable signQuery. Presigning remains an unsupported imported option, not evidence of a missing original UI feature. CodeCommit GIT is a confirmed original aws4 special path and remains explicitly rejected pending implementation.

- 2026-10-01: CodeCommit native helper matches6 aws4 1.13.2 fixed-time references (artifacts/codecommit-reference/native-acceptance.json); direct time dependency added by Cargo. Latest source is not yet included in an accepted native UI build.

- Native CodeCommit UI/wire checkpoint: artifacts/playwright/codecommit-1790798995356 passed4 requests/6 wire hops; body, independent signature, same/cross-origin307 and reload accepted.23-case ordinary auth regression1790799002871 passed. These results supersede the specific pending UI/307 gates above;303/provider/TLS/proxy/platform remain unverified.

- CodeCommit303 accepted1790799123253: same-origin GIT→GET switches to ordinary SigV4 with empty body; cross-origin strips credentials.6 total cases/10 wire requests pass. This supersedes pending303 notes above only; real provider/TLS/proxy/platform remain unverified.


</details>

<a id="record-hawk-compatibility"></a>

<details>
<summary>HAWK-COMPATIBILITY</summary>

# Hawk compatibility

Implemented 2026-09-24; real native UI/provider acceptance remains pending.

## Behavior

- Legacy auth type `hawk`, ID/key/algorithm/ext/validatePayload and disabled flag are preserved. SHA1 and SHA256 use existing RustCrypto hmac 0.12/sha1 0.10/sha2 0.10 dependencies. The inspected official hawk 5.0.1 crate has only SHA256/384/512; it was downloaded with cargo info for research but was not added as a dependency. No Node runtime/library or new crypto implementation is included.
- Frontend fields use existing environment rendering. New Hawk selections default to SHA256 and actual-request mode; imported Insomnium records without a mode retain legacy behavior. Malformed boolean/mode/algorithm values stop the request with a visible error.
- `legacy`: hashes rendered saved body.text with body.mimeType when validation is enabled. Absent/null text omits the hash; an empty string gets the empty payload hash. Form/multipart/binary do not automatically hash their wire bytes. GraphQL retains its saved JSON text. Host/port come from the request URL, ignoring manual Host, as in the original adapter.
- `standard`: hashes actual native body bytes and effective Content-Type, including empty bodies, binary and encoded multipart. A manual Host controls signature host/port. Duplicate Host or payload Content-Type fails visibly. Default ports follow HTTP/HTTPS; query order, duplicates, escapes and a trailing question mark are retained by the current URL representation.
- `postman`: imports authId/authKey/extraData/delegation/includePayloadHash into canonical fields, retains original fields, timestamp/nonce/app and sets this mode explicitly. Uses URL host/port and the explicit Content-Type before automatic body headers. Empty/multipart bodies omit payload hashes; other bodies use wire bytes. Matches the inspected Postman ext normalization (first backslash replacement), while ordinary Hawk uses global replacement. Postman's unused user field stays retained without affecting the signature.
- Optional nonce/timestamp inputs support imported fixed values; blanks produce fresh secure six-character nonce and Unix seconds per signature. Optional app/dlg follow the Hawk/Oz normalized suffix; delegation requires an application ID. Key is raw UTF-8, not a base64-decoded key. Ext uses quoted-header escaping; non-printable/non-ASCII attributes and unsafe ID/nonce/app/dlg quoting are rejected. Header limit is 4096 bytes; key is bounded to 64 KiB and buffered/legacy bodies to 20 MiB. Generated Authorization is marked sensitive.
- Enabled manual Authorization (including empty/duplicate/environment-rendered names) bypasses Hawk preparation/native signing. Disabled Hawk also bypasses unused credentials. Browser preview requires the desktop app for generated Hawk. The UI explains that Validate payload signs the request; it does not verify responses.

## Transport and compatibility limits

HTTP/GraphQL, SSE and WebSocket use the same native signer. Digest executor arguments are grouped into Auth through HttpRequest.signing(), preserving the existing authentication rules. OAuth2 token/browser envelopes clear Hawk configuration. No command/capability was added.

The executor buffers once, recomputes same-origin signatures after redirects, removes Authorization on every hop and signs only the original origin. POST 301/302 and non-HEAD 303 conversion drops the body and suppresses stale legacy payload hashes; actual mode signs the new empty body. The original curl path reused an already calculated header; this deliberate correction supports effective redirected method/URI/body. Existing cancellation/deadline, cookie and client certificate policies remain shared. WebSocket signing uses the HTTP(S) handshake URL/port.

This is not full byte-for-byte legacy URL/parser or Postman body serialization compatibility. Legacy IPv6 URL mode strips brackets as the original parser did; actual Host mode retains authority brackets. Leading-zero ports, unusual raw encodings and custom plugin transformations remain part of broader URL/plugin parity. Quoted ext matches client escaping but must still be accepted by the particular server parser. Invalid inputs fail before sending rather than producing a malformed legacy header. Fixed stale nonce/timestamp values are kept explicitly, not refreshed silently.

No response MAC validation, server clock-skew synchronization/retry, bewit or message authentication is added; the inspected original request adapter did not use those APIs. Provider interoperability, native editor/IPC/reload, TLS/proxy/HTTP2 and persistent cookie behavior still need actual acceptance. No real provider or account was contacted. CUA again exposed no apps/browsers.

## Verification

- Svelte check: zero errors/warnings. Rust clippy -D warnings and formatting passed.
- Actual native signer/request structs/client and request builders/executor compiled from stdin into an ignored binary. No persistent jar attached and no saved test scripts.
- 45 native cases passed, including two published protocol header/payload vectors. Independent Bun HMAC checks verified 38 local wire requests: SHA1/SHA256, three modes, ext/Oz, raw query order/escaped/trailing-question paths, manual Host, binary/multipart, absent/empty legacy payload, fresh nonces, same-origin replay/body drop, cross-origin stripping, follow-off/401/redirect limit, manual override, SSE/WS and invalid inputs.
- Existing 34 AWS and 14 manual-Authorization/Digest/OAuth1 native cases passed against the changed executor.
- Direct JS checks covered environment values, legacy GraphQL preparation, manual/disabled missing credentials, malformed payload boolean, Postman mapping/content-type/multipart, browser rejection and WebSocket preparation.
- Windows release/NSIS packaging passed session 97539 (Rust release 3m29s). All 160 captured source hashes matched after packaging; source/artifact hashes are recorded in STATUS/BUILD.json. Direct checks do not establish the pending native UI/provider gates above.

## Official sources read before implementation

- https://github.com/mozilla/hawk/blob/main/API.md (published protocol vectors)
- https://raw.githubusercontent.com/mozilla/hawk/v9.0.1/lib/client.js
- https://raw.githubusercontent.com/mozilla/hawk/v9.0.1/lib/crypto.js
- https://raw.githubusercontent.com/mozilla/hawk/v9.0.1/lib/utils.js
- https://raw.githubusercontent.com/hapijs/hoek/v9.3.0/lib/escapeHeaderAttribute.js
- https://docs.rs/hawk/latest/hawk/ and installed hawk-5.0.1/src/credentials.rs (DigestAlgorithm excludes SHA1)
- https://docs.rs/hmac/0.12.1/hmac/
- https://raw.githubusercontent.com/postmanlabs/postman-runtime/develop/lib/authorizer/hawk.js
- https://raw.githubusercontent.com/postmanlabs/postman-request/master/lib/hawk.js

Original local evidence: archived network/authentication.ts, network/network.ts, main/network/parse-header-strings.ts, models/request.ts and ui/components/editors/auth/hawk-auth.tsx. The reference application and legacy source/user data were not changed.


</details>

<a id="record-manual-oauth-rendering"></a>

<details>
<summary>MANUAL-OAUTH-RENDERING</summary>

# Manual OAuth rendering

## Explicit OAuth Fetch/Refresh shared renderer — 2026-09-29

- authorizeOAuth now owns a scoped snapshot, async OAuth rendering, dependent-response resolver and resolved token exchange/source guard. renderOAuthRequest renders URL/authentication only; unrelated body/header/query fields are not evaluated. Manual actions retain explicit override checks and do not dispatch the primary request or replace its response/history.
- OAuthEditor token status now uses a debounced, abortable preview of the same URL/authentication input and resolved token lookup. Preview never opens prompts or resends dependencies. Refresh can be attempted when a saved local refresh token exists; the action resolves the actual current context before selecting a token, so previous-setting tokens are not silently reused.
  -24 inline assertions passed:11 compiled manual action cases (dependency, auth templates, token storage/Refresh, prompt answer/Cancel, changed-source discard, native Stop and cleanup),6 actual-worker token preview cases,7 dependent interactive callback regressions. Svelte0/0, production Vite build and git diff --check passed. Fixtures/workers cleaned; no saved tests/dependencies/native edits/new installer.
- Read official Tauri channel and MDN AbortSignal.throwIfAborted docs plus archived o-auth-2-auth.tsx manual handleRender(authentication). One guessed archive filename was missing; located actual file with rg --files. A UI edit command had a quote syntax error before mutation, corrected using serialized source text. Final compiler check caught a missed snapshot declaration replacement in OAuthEditor; corrected and checks rerun successfully. Commands run via hidden node_repl direct Bun/program execution.
- Source newer than BUILD.json. Real WebView/provider/UI acceptance remains pending. Preview cannot prove token applicability when dynamic values cannot be resolved without interaction; explicit Fetch/Refresh performs authoritative Send-purpose resolution. Saved/imported token adoption still uses the old synchronous context and needs integration. Next: adoption, gRPC/WS payload rendering, streaming dependency completion, native transport parity and full PARITY acceptance. Full migration incomplete.

Official references consulted before implementation:

- https://v2.tauri.app/develop/calling-rust/#channels
- https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted

Validation commands: Bun directly launches existing Prettier, svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings, and vite build. git diff --check passed. No generator required for existing-subsystem integration.

## Saved OAuth token adoption shared renderer — 2026-09-29

- useSavedOAuth is now an asynchronous, cancellable tracked operation. It scopes the request environment, renders URL/authentication with prompt/dependency support, computes the resolved context and binds a new native record. Imported source records remain untouched; existing active native copies follow the prior replacement policy.
- Validates the chosen token before rendering; checks the current request/source hash and exact selected-token snapshot again before binding. Cancel, changed request/environment or changed/missing token prevents adoption. Disabled/non-OAuth requests and manual access-token overrides are rejected. Expiry/ID-token send rules remain in oauthHeader.
- UI awaits the adoption result, retains selection on failure and no longer blocks an explicit action solely because noninteractive preview cannot resolve its template. Save failure remains visible and returns false (in-memory change follows the existing persistence/recovery contract).
  -23 inline assertions passed:12 compiled Svelte adoption cases (resolved context, import retention, no primary send/unrelated body prompt, prompt answer/Cancel, token/request edits, Stop, manual override/disabled auth, explicit dependent response and worker cleanup),11 manual Fetch/Refresh regressions. Svelte0/0, production Vite build and git diff --check passed. No saved test scripts/new dependencies/native changes/installer; workers0 and no real-user-state writes.
- Consulted official https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted and https://svelte.dev/docs/svelte/$state before implementation. Reused existing renderer/token validation; no initialization needed. Commands: Bun launches Prettier, svelte-check with existing flags and Vite build; git diff --check. Hidden node_repl launch rules retained.
- Real WebView/provider/UI/persistence acceptance remains pending. Next: gRPC discovery/send and subsequent WebSocket payload shared rendering, streaming dependency completion, native cookie/User-Agent/URL parity and full PARITY acceptance. Full migration incomplete; source newer than BUILD.json.

## Explicit OAuth cookie rendering and legacy-source audit — 2026-09-29

2026-10-17 tag lookup follow-up: cookie tags and request-cookie references now select from rendered active-source/native snapshots through the native CookieStore matcher. Only the selected active source value is rendered; unrelated values do not trigger prompts or dependencies. Each render session captures one native snapshot and native lookup checks generation without mutating the live jar. Value-reference cycles fail explicitly. Cookie tags in source key/domain/path/expiry metadata are currently refused; ordinary environment/file/etc. rendering remains available there. Native matcher scope/secure/precedence/live-store/stale-generation controls pass, along with compiler/build. Real worker/native UI tag/value-chain/cycle acceptance remains open.

- Inspected legacy-cookies.js and LegacyCookieImport.svelte: original cookie_jar resources are retained as explicit Restore candidates, with preview/overwrite policy. They are not an active jar. Automatically overlaying all retained records on Send would resurrect deleted cookies or override later edits. Do not implement that blanket overlay.
- Existing valid template-bearing cookie values can be restored into the native jar and then participate in structured snapshot rendering. Follow-up 2026-10-17 adds an explicit active template-source model: CookieManager → Template cookie sources → load imported candidates or edit JSON → Preview → Save. Sources use separate marked cookie_jar resources; imported records stay inert. Edit/delete through the reviewed JSON, save [] to clear sources, or use Clear all for native cookies and active sources together. Saving sources bumps the native generation before persistence so previously prepared snapshots retire. Source cookies merge only into private request/OAuth snapshots and plugin model views; source scope/expiry is canonicalized after rendering. Active unexpired sources override native cookies with the same identity. Export/import strips activation, requiring review again. Max-Age must be converted to an absolute expiry; partitioned/custom-extension cookies remain unsupported and retained for manual migration.
- Added shared requestCookieSnapshot helper and an explicit includeCookies option to renderOAuthRequest. authorizeOAuth Fetch/Refresh opts in; URL/authentication and cookie snapshot render within the same owned Send session. Generation remains native metadata. Existing OAuth token envelope forwards the rendered snapshot into native transport.
- Preview and saved-token adoption do not opt into cookie loading/rendering; preview explicitly suppresses it even if requested. Cookie flags/global disable still skip snapshots. Cancellation is checked after lookup and session owns subsequent rendering cleanup. Unrelated request bodies/headers are still not rendered.
  -25 inline assertions passed:12 compiled explicit Fetch/Refresh cases including rendered native cookie envelope plus previous dependency/prompt/Stop/token-source guards;7 ordinary cookie snapshot regressions;6 OAuth preview regressions. Native IPC mocked; no actual provider/WebView claim. Workers0; no saved test scripts/real-user-state writes.
- Svelte0 errors/0 warnings, Vite production build and git diff --check passed. Bun ran Prettier/Svelte/Vite via hidden node_repl direct launch. No native change/dependency/new installer; source newer than BUILD.json.
- The extracted helper initially had a return newline causing ASI; compiler caught it, fixed and rerun. First fixture returned collection-A templates for collection B, failing dependency rendering; corrected the mock to scope cookies by collection and reran. A guessed oauth-exchange.js search path was absent; actual implementation is oauth.js.
- Official docs consulted before edits: https://v2.tauri.app/develop/calling-rust/#returning-data and https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted . Existing subsystem reused; no generator needed.
- Follow-up checks: compiler0errors0warnings/build0; saved headless cookie-template-sources.js passes mounted preview/save/edit/Clear all/reopen using controlled native mutation and actual preview persistence. Direct helper checks cover collection isolation, snapshot traversal with a controlled renderer, canonical scope/expiry, source preservation, clear without resurrection and inactive export/import. Actual native wire/template-worker/persistence/restart, OAuth/provider, failure/ownership races and remaining source formats require acceptance. Existing ordinary CookieStore.from_cookies insertion order is reused for source precedence (https://docs.rs/cookie_store/0.22.1/cookie_store/struct.CookieStore.html#method.from_cookies); no new native command or storage subsystem. Continue retained networking/runtime/platform and PARITY requirements; full migration remains incomplete.


</details>

<a id="record-netrc-compatibility"></a>

<details>
<summary>NETRC-COMPATIBILITY</summary>

# Netrc compatibility

Implemented 2026-09-24 in `src-tauri/src/netrc.rs`, the shared native signed-request executor, and the original-layout Auth selector. No extra dependency, command, permission, frontend credential reader or sidecar was added.

## Behavior

- Select **Netrc** in Auth. Enabled requests use native Basic authentication from the netrc file; browser preview reports that the desktop app is required. HTTP, GraphQL, SSE and WebSocket share the same native executor.
- Lookup starts in nonempty `HOME`; Windows falls back to nonempty `USERPROFILE`, Unix to Rust's home-directory lookup. Windows tries `.netrc`, then `_netrc` when there is no applicable entry (including when the first file is missing). No `NETRC` environment override or custom-path UI: these were not in the pinned old integration.
- Files are read once per operation on a blocking worker, with a 1 MiB limit each. Only regular files are accepted. File access/read errors stop the applicable lookup with a credential-free message; a failed unused Windows fallback does not invalidate a successful primary match. Cancellation/deadline can stop awaiting the worker, but cannot interrupt an already blocked OS filesystem read.
- Credentials are opaque bytes; quoted values support spaces, escaped quotes/backslashes and n/r/t escapes. Tokens, including individual credential fields, are limited to 16 KiB. Comments, CRLF, skipped `macdef` blocks and ignored `account` fields are supported. Malformed quoted/value syntax and NUL in parsed fields stop sending. Unknown tokens are ignored. Parsing stops after finding a complete applicable pair; later unrelated syntax is not validated.
- Machine and keyword comparison is ASCII case-insensitive; login selection is byte-exact. Ordered duplicate machine sections are retained. The first applicable section wins; an earlier `default` section can therefore win before a later machine section. Place defaults last. IPv6 lookup removes URL brackets.
- Initial URL username, percent-decoded, selects a matching login. URL password is discarded. A login-less section can provide a password for the selected username. Same-host redirects retain that selector; another host starts without it. Explicit credentials in redirect URLs remain rejected by the shared executor.
- A partial matching section uses an empty missing field. An empty section sends no Authorization; explicitly empty login/password fields send Basic for `:`. A missing file/no match sends no Authorization. Basic usernames containing a colon are rejected.
- Each redirect looks up its own target hostname, independent of protocol/port, from the operation's file snapshot. A default entry deliberately applies to arbitrary hosts. No password or login is borrowed from the previous destination or a separate partial section. Existing redirect limits, method/body rules, sensitive-header stripping and client-certificate origin guard still apply.
- Enabled manual Authorization, including an empty value, bypasses netrc file lookup entirely. Disabling authentication also prevents lookup. OAuth token/login requests explicitly clear the netrc flag. Netrc contents/generated credentials are never returned through IPC, copied into resources/history or written by the app. The native generated header is marked sensitive.

## Legacy evidence and deliberate differences

Original `main/network/libcurl-promise.ts` enabled `CurlNetrc.Required` based only on auth type; the old UI had no fields. The package was `@getinsomnia/node-libcurl ^2.36.12`; its pinned build evidence is recorded in AUTHENTICATION.md#record-auth-inventory. Both release and pinned Windows curl sources correspond to 7.86-era behavior.

The old branch did not honor the auth disabled flag. The migration honors it and avoids unused file reads with manual Authorization. Old missing/unreadable files generally behaved like no match; missing files still do, but other I/O errors now surface. Oversized files/fields, malformed missing-value syntax and colon usernames have explicit errors. The old parser had a 4096-byte line buffer and could combine partial matching sections; this implementation uses bounded tokens and keeps section credentials separate. No saved URL password is reused on a missing entry.

These changes intentionally avoid known curl credential-retention defects, rather than reproducing historical leaks: [CVE-2024-11053](https://curl.se/docs/CVE-2024-11053.html), [CVE-2025-0167](https://curl.se/docs/CVE-2025-0167.html). Other unusual legacy parsing/URL-username behavior remains a compatibility review item; this is not a claim of byte-for-byte curl emulation.

## Verification

- Svelte check: 0 errors / 0 warnings. Rust clippy with `-D warnings`, formatting and frontend production build passed.
- Compiled the actual request types/builders/netrc module/shared executor from stdin into ignored `artifacts/netrc-inspection.exe`; no test source/script was saved. Persistent jar was not attached.
- 45 synthetic native cases / 48 loopback wire requests passed: bytes/Unicode/quotes/comments/macros, machine/default/duplicates, URL selector/password removal, primary/fallback/no-match, partial/empty fields, malformed/oversized input, manual/disabled behavior, cross-host/cross-port redirects, both historical leak shapes, method/body replay/drop, follow-off and WebSocket handshake.
- 187 previous-auth cases passed against that helper: NTLM 30, ASAP 64, Hawk 45, AWS 34, manual-auth/Digest/OAuth1 14. Pure JS enabled/disabled/manual/native-only preparation checks passed.
- Every fixture was in a unique ignored workspace directory supplied only as the child process HOME/USERPROFILE. Files/directories and servers were removed after inspection. No real user's netrc file was read.
- Windows release session74624 passed (Rust release4m17s); all165 source hashes matched the captured snapshot. Current executable/NSIS hashes are in BUILD.json. Installer was not executed/published.
- Native Tauri IPC/UI/reload, installed-profile discovery, Unix fallback/platform matrix, proxy/TLS/persistent-jar combination and real-provider acceptance remain pending. CUA exposes no apps/browsers. Build/installer evidence belongs in BUILD.json/STATUS; do not infer full migration completion from it.

## Sources read before implementation

- https://curl.se/libcurl/c/CURLOPT_NETRC.html
- https://raw.githubusercontent.com/curl/curl/curl-7_86_0/lib/netrc.c
- https://raw.githubusercontent.com/curl/curl/curl-7_86_0/lib/url.c (override_login)
- https://raw.githubusercontent.com/curl/curl/master/lib/netrc.c (current behavior comparison)
- https://doc.rust-lang.org/std/env/fn.home_dir.html (Rust 1.98.1; Windows HOME precedence is implemented explicitly)

No generator is needed for this request-auth module. Reused existing reqwest, base64, percent-encoding and Tokio APIs/dependencies after reviewing their existing integration; package manager commands were not needed.


</details>

<a id="record-ntlm-compatibility"></a>

<details>
<summary>NTLM-COMPATIBILITY</summary>

# NTLM compatibility checkpoint

2026-10-01 native UI acceptance: bun tests/ui/curl-import-ntlm.js passed on artifacts/native-curl-ntlm-ui-probe/build-state.json. Evidence artifacts/playwright/curl-import-ntlm-1790794284777; validates imported explicit credentials with independent NTLMv2 proof, reload, connection binding, POST replay and manual Authorization suppression. Does not cover MIC/TLS binding/hosted provider/OS sign-in/proxy/mixed negotiation.

Updated 2026-09-24. NTLMv2 implemented and directly inspected; full legacy/native-provider parity remains pending.

## Architecture and behavior

Each operation has its own reqwest client and explicit SSPI credentials. HTTP/1.1, a one-idle-connection pool, disabled automatic retries and a connector guard keep the Type2→Type3 exchange on the same connection. The guard rejects a replacement connection before the underlying connector is called; a closed challenge connection stops with an explicit error. It is not merely a comparison of remote IP addresses. The actual inspected TCP source port also remained unchanged.

The first request is unauthenticated. After a 401 advertising NTLM, the executor sends Type1 and accepts a bounded Type2 challenge, then sends Type3. Final 401 returns normally. Negotiate/SPNEGO and Basic are never automatic fallbacks. Intermediate responses are drained to reuse the connection (maximum1MiB), and encoded request bodies are buffered once (maximum20MiB) for exact replay. The operation retains its existing overall deadline/cancellation; stream handshake deadlines remain separate from the stream lifetime. Request bodies accompany each authentication round, so application servers must honor 401 semantics before performing an operation.

All HTTP/GraphQL/SSE/WebSocket paths use this executor. Redirects retain the existing method/body/credential rules, reset the NTLM exchange, and never negotiate outside the original origin. Same-origin redirects may reuse the already-authenticated connection. Each request/credential selection gets a separate client; there is no global authenticated connection cache. Proxy transport uses existing reqwest configuration; proxy NTLM407 is not implemented.

Enabled manual Authorization takes precedence, including directly supplied native envelopes; unused credentials need not resolve. Disabled auth is omitted. Selected native NTLM strips URL userinfo before reqwest can turn it into preemptive Basic. The saved URL remains unchanged. Browser preview rejects NTLM explicitly.

Explicit DOMAIN\user, UPN and separate domain formats are handled by SSPI. UPN stays a full user principal name with an empty wire domain, rather than being split into a NetBIOS domain. Unicode credentials were independently verified. Empty username stops explicitly; no automatic OS account/SSO fallback. Credential fields are bounded16KiB and reject NUL. Passwords remain existing plaintext local request data. Generated messages are sensitive headers and are not persisted as token resources. Errors omit credentials/token bytes.

## TLS binding

HTTPS obtains the actual peer certificate through reqwest tls_info. x509-parser reads the signature algorithm (including RSA-PSS hash parameters), and existing SHA2 primitives implement RFC5929 tls-server-end-point. MD5/SHA1 certificate signatures select SHA256; SHA224/256/384/512 signatures use their hash. SSPI incorporates the resulting binding into Type3. Unsupported signature hashes or missing certificate metadata stop explicitly. Certificate trust/hostname validation remains the existing reqwest/rustls behavior. This is NTLM extended protection binding, not a replacement certificate verifier.

## Differences and outstanding work

- NTLMv1/LM compatibility, proxy407, OS default credentials and unusual server/username negotiation remain pending; no silent downgrade was added.
- SSPI0.22 sends configured workstation in Type1 only. Its Type3 workstation field is empty. UI states this clearly; imported Postman workstation is preserved. Type3 workstation parity must be implemented/verified before declaring full compatibility.
- A server that closes the connection after Type2 requires a new Send; Type3 is never retried on a new connection. Broader transparent restart/provider compatibility is pending.
- EdDSA/other certificate hash cases, native Tauri UI/IPC/reload, IIS/AD/real provider, proxy/custom client-certificate integration and persistent jar acceptance remain pending. Windows is the only compiled target; SSPI's platform dependencies still require Linux/macOS CI verification.
- SSPI supplies the NTLMv2/MIC cryptography. No bespoke NTLM password-hash or response implementation was added. Its optional network-client, smartcard, Kerberos resolver and default crypto-provider features are disabled; the crate still contains shared protocol dependencies.

## Inspection evidence

Thirty native cases passed with an independent Bun crypto NTLMv2 proof/MIC oracle and TCP source-port assertions (103 loopback wire requests). Includes Unicode/domain/UPN, raw/binary/multipart replay, same/cross-origin/body-dropping redirects, manual/disabled precedence, URL-userinfo override, follow-off/limit, final401, SSE/WS, malformed/missing/ambiguous challenges, oversized intermediate body/fields, empty username and closed-connection refusal. Postman field preservation and frontend/native-only preparation also passed.

Twenty-seven scenarios were additionally run over each of three disposable TLS configurations: RSA/SHA256, EC/SHA384 and RSA-PSS/SHA256 (81 case executions, 291 wire requests). The independent server checked the Type3 channel-binding AV pair, proof and MIC. Temporary certificate keys were created solely for these loopback checks; the OpenSSL input key files under artifacts were removed. The initial stdin-key attempt failed before any file was created. No user/provider keys were read.

Regression:64 ASAP +45 Hawk +34 AWS +14 manual-auth/Digest/OAuth1 cases passed against the updated executor. Svelte check0errors/0warnings, Rust clippy -Dwarnings and debug library build passed. No test scripts/source were saved; inspection helper compiled actual modules/builders from stdin. Persistent jar not attached, and these direct checks do not establish UI/IPC/provider acceptance.

## Sources and commands

- Microsoft connection-oriented flow: https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-nlmp/1f18ef3b-7d62-4e1a-a8a7-6bc0607fad70 ; full protocol index: https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-nlmp/b38c36ed-2804-4868-a9ff-8dd3182128e4
- reqwest connector layer and installed0.12.28 connect.rs/request.rs: https://docs.rs/reqwest/0.12.28/reqwest/struct.ClientBuilder.html#method.connector_layer
- SSPI official API and installed0.22.0 examples/client.rs plus ntlm client/identity source: https://docs.rs/sspi/0.22.0/sspi/
- Tower Layer: https://docs.rs/tower/latest/tower/trait.Layer.html
- RFC5929 binding: https://www.rfc-editor.org/rfc/rfc5929#section-4
- X509 parser: https://docs.rs/x509-parser/0.18.1/x509_parser/certificate/struct.X509Certificate.html
- Disposable certificate command options: https://docs.openssl.org/3.5/man1/openssl-req/
- Documented cargo commands: https://doc.rust-lang.org/cargo/commands/cargo-add.html ; cargo info sspi; cargo add sspi@0.22.0 --no-default-features --manifest-path src-tauri/Cargo.toml; cargo add tower@0.5 --no-default-features --manifest-path src-tauri/Cargo.toml; cargo add x509-parser@0.18 --no-default-features --manifest-path src-tauri/Cargo.toml; cargo fetch --locked --manifest-path src-tauri/Cargo.toml.
- Existing dependencies resolved tower0.5.3; new libraries sspi0.22.0 and x509-parser0.18.1. No Node/npm/Python runtime used. SSPI requires Rust1.93; workspace Rust1.98.1 satisfies it.


</details>

<a id="record-oauth-compatibility"></a>

<details>
<summary>OAUTH-COMPATIBILITY</summary>

# OAuth compatibility inventory

Reviewed 2026-09-24. Legacy evidence: `_backup/legacy-electron/packages/insomnia/src/network/o-auth-2/get-token.ts`, `main/authorizeUserInWindow.ts` and `network/authentication.ts`.

| Behavior                                                                                 | Current state / remaining work                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Client/password/refresh/Code/PKCE                                                        | Native implementation and direct checks passed; real app/provider acceptance pending                                                                                                                                                                                           |
| Implicit token/id_token/id_token token/none                                              | Implemented; ID-token credential use requires explicit selection, replacing silent legacy fallback; no OpenID identity verification                                                                                                                                            |
| Embedded window captures remote/custom navigation, redirect and unreachable callback URL | Optional Tauri window uses navigation/page-load and callback-popup hooks; pure policy checked, actual WebView/provider acceptance pending                                                                                                                                      |
| Shared persisted login session / Clear OAuth 2 session                                   | Separate shared profile and saved UUID rotation implemented; old profiles retained like legacy; runtime/restart acceptance pending; Apple isolated store requires recent OS                                                                                                    |
| Unspecified redirect lets provider choose its default                                    | Login window now requires exact configured redirect; unresolved legacy compatibility gap. System browser blank redirect uses documented allocated loopback                                                                                                                     |
| validateAuthSSL bypass / explicit client-certificate selection                           | Not migrated to embedded WebView; OS browser behavior applies. Native token-request CA/client certificate support is separate                                                                                                                                                  |
| Auxiliary provider login popups                                                          | Ordinary popup denied with system-browser guidance; callback-only popup can complete. Full provider-popup parity pending                                                                                                                                                       |
| tokenPrefix=NO_PREFIX                                                                    | Implemented: sends only the validated token; direct JS inspection passed, native UI pending                                                                                                                                                                                    |
| Manual Authorization header                                                              | Preserved, including empty/environment names. Send skips unused automatic OAuth acquisition; explicit Fetch/Refresh still manages saved tokens. This avoids the original adapter's unnecessary pre-header exchange. Direct compiled-workspace/native checks passed; UI pending |
| Refresh 401/invalid_grant retries original grant                                         | Current behavior stops request, retaining source token; explicit reauthorize exists. Automatic retry difference remains unresolved                                                                                                                                             |
| form_post callback body                                                                  | Legacy handler parses URL only; no body capture. Future extension, not an implemented legacy feature                                                                                                                                                                           |
| OS custom-scheme registration                                                            | Legacy captures URLs inside its own window; no registration in this flow. System-browser registration is an extension                                                                                                                                                          |
| Device flow/revocation/full OpenID relying-party verification                            | Extensions, not proof of baseline parity                                                                                                                                                                                                                                       |

OAuth1 is implemented with explicit body compatibility modes; see AUTHENTICATION.md#record-oauth1-compatibility. Next: remaining legacy authentication options and advanced methods. Keep all actual legacy differences and runtime gates visible; none is implicitly accepted as complete.


</details>

<a id="record-oauth-preview-history"></a>

<details>
<summary>OAUTH-PREVIEW-HISTORY</summary>

# OAuth preview-owned history keys

`createOAuthPreviewHistoryGuard` distinguishes exact history mutations published
by a preview from external response changes. The caller records the resulting
history and original input key before yielding. An exact match retains that key,
including history eviction; another history/body value produces its own SHA-256
key. This prevents a preview's native helper response from scheduling that same
preview repeatedly without suppressing external invalidation or history writes.

`bun tests/ui/plugin-oauth-preview.js` passes eight saved headless controls:
detached equality, owned append, owned eviction, external new response, external
body replacement, another preview origin, token-only source stability and OAuth
input edits. It uses the existing OAuth source contract and baseline model/hash
dependencies. The standalone topic contains the guard, fixture/scenario and this
document; broader editor/service integration remains part of the uncommitted
helper feature.

Integrated working-candidate evidence is separate: production
`20ab757ea334962177322637e29efa134d311e5d6f9d67e82b10220b44ee81c6`, native
`plugin-template-tags-1791683269931`, restoration
`plugin-workspace-helper-restoration-1791683269355`. Twenty-three checks, twelve
terminated workers and twenty-two real HTTP requests pass, including seven OAuth
cases and no repeated wire for750ms after ready. Independent62-source/build/byte/
token/context/history/model/store/two-buffer/653-cookie-file audit passes. This
is a full working-candidate acceptance, not a claim that this standalone commit
contains or completes all preview/helper activation. Final compiler39032 is0/0.

Source reactivity contract: [Svelte effect dependencies](https://svelte.dev/docs/svelte/$effect#Understanding-dependencies).
General preview callers, provider/lifecycle/deadline/cancellation/concurrency,
gRPC/native synchronous app/DOM/private/clipboard/platform and the original full
migration remain required before the shared-input UX/UI/CSS phase.


</details>

<a id="record-oauth1-compatibility"></a>

<details>
<summary>OAUTH1-COMPATIBILITY</summary>

# OAuth1 signing migration

Implemented in `src-tauri/src/oauth1.rs`, shared `digest::execute`, `src/lib/oauth1-model.js` and `OAuth1Editor.svelte`. This is request signing, matching the original manually supplied OAuth1 credentials; it does not add an automatic browser/token exchange.

## Supported behavior

- Enabled manual Authorization takes precedence, including empty or duplicate values. No OAuth1 signature or credential validation is performed on that path. Disabled manual rows restore normal signing. Native direct-input dispatch follows the same rule and uses normal client redirects; current manual-header loopback checks passed.

- HMAC-SHA1, HMAC-SHA256, RSA-SHA1 and PLAINTEXT. RSA accepts unencrypted PKCS#1/PKCS#8 PEM up to 8192 bits. RustCrypto performs cryptographic operations; application code normalizes OAuth protocol parameters.
- Consumer/token credentials, callback, verifier, realm, version, nonce and timestamp render environment variables. Blank nonce/time generate values per signed attempt. Blank version is omitted in RFC mode and defaults to 1.0 in legacy mode.
- New requests use RFC 5849 mode. Existing Insomnium OAuth1 resources with no bodyMode use explicit, visible legacy body mode. No imported credentials are rewritten or exchanged automatically.
- RFC mode collects duplicate query/form parameters, decodes UTF-8/form encoding, sorts percent-encoded names and values, then signs the effective method and URI. Realm is outside the signature. A manual Host header affects the base URI. Ambiguous duplicate Host/Content-Type headers and invalid UTF-8 fail explicitly.
- Optional body-hash extension signs buffered non-form wire bytes, including multipart boundary and binary content: SHA-1 for HMAC-SHA1/RSA-SHA1, provider-specific SHA-256 for HMAC-SHA256. Form + Hash Body and PLAINTEXT + Hash Body require explicit correction. This extension is a draft, not part of RFC 5849 itself.
- HTTP, GraphQL, SSE and WebSocket handshake share the native executor. Bodies buffer once, at most 20 MiB. Redirects re-sign the new method/URI only at the original origin; cross-origin requests lose Authorization/manual cookies/proxy auth. Existing redirect limit, client-certificate guard, timeout and cancellation wrappers remain. OAuth1 does not retry a 401 challenge.

## Original Insomnium body behavior

The archived adapter only supplied form data to oauth-1.0a when Hash Body was enabled. Without it, form fields were absent from the signature. With it, the original adapter constructed a JSON object containing configured callback/nonce/timestamp/verifier, followed by every form field, including disabled entries. Last duplicate wins; JavaScript property ordering applies. It hashed this JSON with the selected signature function, not an ordinary hash of transmitted bytes. Configured nonce/time then remain inside that JSON while fresh header values are generated; callback/verifier are absent from the header. Original PLAINTEXT returns the signature base string (or JSON for the body hash).

Legacy body mode preserves those behaviors visibly. It is not a claim of bit-for-bit compatibility with all original URL/parser bugs. Queries with literal plus, encoded names, empty segments, repeated empty values, literal extra equals or prototype-related edge cases are rejected for explicit review/RFC selection. A legacy form named **proto** also requires review. OAuth protocol parameters in URL/form must move to Auth. Percent encoding/canonical HTTP URI and header encoding follow the current native stack. Unusual legacy providers remain an acceptance gate.

## Postman import

Postman token maps to tokenKey and its form signing selects RFC mode; original source remains preserved. An absent/false addParamsToHeader means the original request used URL/form placement, so sending stops until Authorization header is selected explicitly. addEmptyParamsToSign and disableHeaderEncoding also stop sending until explicitly disabled. Unknown signature methods remain visible and fail; only the four methods above are implemented. Boolean strings true/false normalize; dynamic/invalid booleans require editing. As in Postman, imported form bodies do not use the body-hash extension.

## Verification and remaining gates

- Actual native modules compiled directly from stdin; 17 signature cases and 15 rejection cases passed. Included RFC 5849's POST example with verified erratum 2550, Unicode/duplicate parameters, HMAC-SHA256, both PEM formats independently verified by Bun crypto, PLAINTEXT, legacy JSON hashes and manual Host.
- Thirteen real loopback cases passed: same-origin 307 replay/303 GET, cross-origin removal and return, follow-off, client-certificate origin restriction, exact multipart hash, SSE, WebSocket upgrade, redirect cap, deadline, final 401 and Digest 401/200 regression. No test source/script saved.
- Direct JS preparation/import and compiled Svelte server rendering passed. This does not verify rendered WebView interactions, Tauri IPC, persisted reload, TLS/proxy/cookie integration or a real OAuth1 provider.
- Manual acceptance: create each method in Auth, import legacy/Postman samples, inspect unsupported options, send through a provider, cancel pending requests, reload/re-export credentials and verify no unexpected token/history record. Keep native UI and full legacy parity pending until exercised.

Sources: [RFC 5849](https://www.rfc-editor.org/rfc/rfc5849.html), [verified erratum 2550](https://errata.rfc-editor.org/search/?rfc_number=5849&presentation=records), [body-hash draft](https://www.ietf.org/archive/id/draft-eaton-oauth-bodyhash-00.html), [oauth-1.0a implementation](https://github.com/ddo/oauth-1.0a), [Postman runtime](https://github.com/postmanlabs/postman-runtime/blob/develop/lib/authorizer/oauth1.js). Archived source: `packages/insomnia/src/network/o-auth-1/get-token.ts` and its Auth editor.


</details>
