# Original 26 root entries moved with checked absolute PowerShell paths.
bun docs/migration/archive.mjs verify
bun create tauri-app .migration-scaffold --manager bun --template svelte --identifier app.insomnium.desktop --tauri-version 2 --yes
# Generated files promoted to root without overwriting occupied destinations.
# package scripts changed to bun x --bun before installing.
bun install
bun run build
```

https://v2.tauri.app/start/create-project/
https://v2.tauri.app/start/frontend/sveltekit/
https://bun.sh/guides/ecosystem/vite

## Native dependencies

```powershell
bun run tauri add store
bun run tauri add dialog
bun run tauri add fs
bun run tauri add window-state
cargo add reqwest@0.12.28 --manifest-path src-tauri/Cargo.toml --no-default-features --features rustls-tls,json,multipart,cookies,gzip,brotli,deflate,stream
cargo add tokio --manifest-path src-tauri/Cargo.toml --features sync,time,macros
cargo add base64@0.22 --manifest-path src-tauri/Cargo.toml
cargo add atomic-write-file --manifest-path src-tauri/Cargo.toml
bun run tauri remove store
bun run tauri add single-instance
bun run tauri icon static/app-icon.png
```

Store was evaluated first from the official plugin. Source inspection found ignored load errors (`let _ = store_inner.load()`) and direct `fs::write`. It was replaced with app-owned atomic storage to avoid resetting damaged data or truncating workspace files.

https://v2.tauri.app/plugin/store/
https://v2.tauri.app/plugin/dialog/
https://v2.tauri.app/plugin/file-system/
https://v2.tauri.app/plugin/window-state/
https://v2.tauri.app/plugin/single-instance/
https://v2.tauri.app/develop/calling-rust/
https://v2.tauri.app/reference/javascript/api/namespacewindow/
https://v2.tauri.app/develop/icons/
https://v2.tauri.app/security/csp/
https://docs.rs/reqwest/0.12.28/reqwest/struct.ClientBuilder.html
https://docs.rs/reqwest/latest/reqwest/redirect/struct.Policy.html — custom redirect policy; keep the standard redirect count bound while restricting certificate-bearing redirects to the original origin.
https://docs.rs/atomic-write-file/0.3.1/atomic_write_file/

## Frontend and maintenance

```powershell
bun add -d @types/bun prettier prettier-plugin-svelte
bun x --bun prettier src scripts --write
bun run check
bun run build
cargo fmt --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
bun run tauri build --debug --no-bundle
bun run tauri build --bundles nsis --ci
```

https://svelte.dev/docs/svelte/$state
https://svelte.dev/docs/svelte/$derived
https://svelte.dev/docs/svelte/$props
https://bun.sh/docs/typescript
https://prettier.io/docs/cli
https://github.com/sveltejs/language-tools/blob/master/packages/svelte-check/README.md

`svelte-check --config ./svelte.config.js` prevents recursive discovery of the archived React/Vite configuration. `--fail-on-warnings` keeps diagnostics strict. TypeScript is pinned to 6.0.x for JS checking; frontend files are JavaScript/Svelte only.

## Legacy data evidence

- Legacy `common/database.ts`: `insomnia.${modelType}.db`, records have `type` rather than export `_type`.
- https://github.com/seald/nedb/blob/master/lib/persistence.js — last document version wins; deletion tombstones remove IDs; index records are metadata.
- https://github.com/seald/nedb/blob/master/lib/model.js — serialization format.
- Parser stops on malformed lines rather than silently dropping data. No database package is loaded.

## Collection management and Postman follow-up

- https://svelte.dev/docs/svelte/each — keyed resource rows retain identity when reordered.
- https://svelte.dev/docs/svelte/bind — form bindings and selects.
- https://svelte.dev/docs/svelte/$derived — computed siblings and destination lists.
- Legacy models/request-group.ts — metaSortKey and subtree duplication semantics.
- https://schema.postman.com/collection/json/v2.1.0/draft-07/collection.json — URL/query/path-variable, body disabled, raw headers, multipart file-array schema.
- https://learning.postman.com/docs/use/send-requests/create-requests/parameters — query and path parameters.

Used existing generated Svelte project; no further scaffold/dependency required. Ran `bun x --bun prettier --write src/lib src/routes/+page.svelte`, `bun run check` and direct inline Bun module inspection using synthetic data (no saved tests, no network requests).

## Persistent cookie manager

- https://docs.rs/cookie_store/latest/cookie_store/struct.CookieStore.html
- https://docs.rs/cookie_store/latest/cookie_store/struct.Cookie.html
- https://docs.rs/cookie_store/latest/cookie_store/serde/json/index.html
- https://docs.rs/reqwest/latest/reqwest/cookie/trait.CookieStore.html
- https://docs.rs/reqwest_cookie_store/latest/reqwest_cookie_store/ — reference adapter example (not installed).
- Read the installed official reqwest 0.12.28 cookie adapter and cookie_store 0.22.1 serde/domain/path source before implementing the custom per-request provider. Versioned web URLs were unavailable, so exact installed source was used to confirm APIs.

Executed `cargo add cookie_store@0.22.1 --manifest-path src-tauri/Cargo.toml --features serde_json`; cookie_store was already a reqwest dependency. Uses CookieStore parsing/matching and JSON serialization, not a hand-written cookie parser.

Cookie files are `cookies/<validated-collection-id>.json` under the new app data directory. Atomic writes and one pre-session backup per jar; unreadable/corrupt files fail visibly. Manual changes commit to disk before mutating the live jar. In-flight providers have a generation token so an edit/clear cannot be undone by an older response. HTTP completion/cancellation flushes cookies and reports persistence errors without hiding a successful HTTP response. Session cookies are intentionally retained for API-client continuity. Legacy cookie resources remain preserved but are not automatically converted yet.

## WebSocket / SSE

Official documentation consulted before implementation:

- https://v2.tauri.app/develop/calling-frontend/#channels — ordered Rust/JavaScript Channel and lifecycle.
- https://v2.tauri.app/plugin/websocket/ — evaluated official plugin; shared reqwest client chosen to retain the app’s custom TLS, proxy and per-collection cookie behavior.
- https://docs.rs/reqwest-websocket/latest/reqwest_websocket/ — upgrade request/response and message stream. Exact installed 0.5.1 source/examples consulted because latest 0.6 requires reqwest 0.13; this project uses reqwest 0.12.28. No unrelated major upgrade.
- https://docs.rs/eventsource-stream/latest/eventsource_stream/ — incremental parsing from reqwest bytes stream.
- https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream — UTF-8/BOM, CR/LF, data/event/id/retry fields.
- Legacy models/websocket-request.ts, websocket-payload.ts, main/network/websocket.ts and models/request.ts (SSE detected through enabled Accept header).

Executed:

```powershell
cargo info reqwest-websocket
cargo info reqwest-websocket@0.5.1
cargo info eventsource-stream
cargo add reqwest-websocket@0.5.1 --manifest-path src-tauri/Cargo.toml
cargo add eventsource-stream@0.2.3 --manifest-path src-tauri/Cargo.toml
cargo add futures-util --manifest-path src-tauri/Cargo.toml --features sink
cargo add tungstenite@0.27 --manifest-path src-tauri/Cargo.toml --no-default-features --features handshake
bun run check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

Uses documented library upgrade/parser APIs, not a custom WebSocket framing or SSE parser. Additional SSE guard limits line/data-event size without counting comments over connection lifetime. Tauri data packets carry sequence IDs; the backend waits for the matching acknowledgement and final drain before completion. Browser preview has no replacement streaming backend. No test scripts added.

## GraphQL schema and editor milestone (2026-09-24)

Read before implementation:
- https://graphql.org/learn/introspection/ — schema queries and disabled introspection behavior.
- https://graphql.org/learn/serving-over-http/ — POST JSON, GET query/variables/operationName and response media types.
- https://www.graphql-js.org/api-v16/utilities/ — getIntrospectionQuery, buildClientSchema, buildSchema and printSchema.
- https://www.graphql-js.org/api-v16/language/ — parse/print and maxTokens.
- https://www.graphql-js.org/api-v16/validation/ — validate, specified rules and maxErrors.
- https://www.graphql-js.org/api-v16/execution/ — getVariableValues and package-root exports.
- https://bun.sh/docs/pm/cli/add — adding a versioned package using Bun.
- Legacy reference: ui/components/editors/body/graph-ql-editor.tsx (introspection clone, errors, local JSON import and operation editor).

Commands executed:
```powershell
bun add graphql@16
bun x --bun prettier --write src/lib/graphql.js src/lib/transport.js src/lib/workspace.svelte.js src/lib/components/GraphqlEditor.svelte src/lib/components/RequestEditor.svelte src/lib/components/ResponsePane.svelte src/lib/styles.css
bun run check
bun run build
bun run tauri build --bundles nsis --ci
```

Installed 16.14.2 from the documented v16 API line to retain the legacy API behavior. This is a JavaScript library bundled into the WebView; no server or Node executable is added. All GraphQL imports use the package root: a first inline Bun check caught CJS/ESM class duplication when a root ESM import was mixed with an extensionless execution subpath. Root exports resolved it. No package-manager command printed by library errors or Vite advice was executed.

A temporary Bun.serve loopback server and direct imported modules were exercised from stdin, then stopped. Introspection, POST/GET response agreement, unchanged source request, schema import, validation errors and context invalidation passed. No test files/scripts were created. Native IPC and visual workflows are still unverified. GraphQL cache is session-only and fetch is explicit; server query/validation rules and custom scalars remain authoritative.

## Legacy cookie restore milestone (2026-09-24)

Sources read before implementation:
- https://raw.githubusercontent.com/salesforce/tough-cookie/v4.1.4/lib/cookie.js — serialized attributes, fromJSON, Max-Age precedence, creation-anchored expiryTime, and default domain scope.
- https://github.com/salesforce/tough-cookie/blob/master/api/docs/tough-cookie.cookiejar.md — deserialization puts cookies in serialized order.
- https://docs.rs/cookie_store/0.22.1/cookie_store/struct.CookieStore.html — insert, matching keys, expiry and cloning.
- https://docs.rs/cookie_store/0.22.1/cookie_store/enum.CookieDomain.html — host-only versus domain scope.
- Installed official crate source cookie_store-0.22.1/src/cookie.rs, cookie_domain.rs — parser, owned cookies, URL matching and original effective expiry.
- Legacy common/cookies.ts and models/cookie-jar.ts — actual saved shape and loose jar settings.

No dependency or generator was needed: reuse installed cookie_store 0.22.1 and the documented Tauri command pattern. JavaScript maps saved attributes; Rust's library parses them and verifies no value/scope changes. No handwritten cookie-header parser. Expired entries are excluded without restarting Max-Age; no guessed creation time. Source resources are always retained. User explicitly previews and restores in Cookie manager; import preview explains this step.

Checks run: Bun Prettier, bun run check (0 errors/warnings), cargo fmt --check, cargo clippy -- -D warnings, git diff --check, and direct inline Bun inspection with synthetic cookies. No new test scripts/files. Native UI/disk/error acceptance remains in ACCEPTANCE.md. Windows release packaging uses bun run tauri build --bundles nsis --ci.

## OpenAPI/API Design milestone (2026-09-24)

Official sources read before implementation:
- https://swagger.io/specification/v3.1/ — parameters, servers, security and request bodies.
- https://raw.githubusercontent.com/scalar/scalar/main/packages/openapi-parser/README.md — filesystem/dereference APIs; no fetch plugins installed.
- https://raw.githubusercontent.com/scalar/scalar/main/packages/openapi-validator/README.md — schema and path validation.
- https://raw.githubusercontent.com/stoplightio/spectral/develop/docs/guides/3-javascript.md — evaluated lint API; Spectral/custom rules remain pending.
- https://eemeli.org/yaml/ — parseDocument, LineCounter and maxAliasCount.
- https://vite.dev/guide/features.html#web-workers — bundled module worker.
- https://raw.githubusercontent.com/Redocly/openapi-sampler/main/README.md — schema example generation.
- https://ajv.js.org/standalone.html — CSP-compatible precompiled validation.
- https://bun.sh/docs/bundler — browser ESM output from generated validators.

Commands executed:
~~~powershell
bun add @scalar/openapi-parser yaml
bun add @scalar/openapi-validator
bun add openapi-sampler
bun add --dev ajv ajv-draft-04 ajv-formats
bun run generate:openapi
bun run check
bun run build
bun run tauri build --bundles nsis --ci
~~~

Installed parser 0.29.5, validator 0.1.4, yaml 2.9.1, sampler 1.7.6 and Ajv 8.20.0. Parser validate was found to supply a missing info.version, so validation uses unmodified source with the strict official structural schemas instead. Runtime Ajv compilation requires dynamic Function and violates the existing CSP. scripts/build-openapi-validators.mjs uses documented Ajv standalone output plus Bun.build before the browser bundle, without relaxing CSP. The locked Scalar package supplies schema files through its installed dist/schemas paths (an internal package path; inspect again when upgrading). Generated src/lib/generated files and artifacts/openapi-build are ignored; bun install prepare regenerates them, or run bun run generate:openapi explicitly. No Node executable was run.

Direct synthetic inspections ran from Bun stdin, with no saved test files or user data. One inspection initially omitted required timeout settings; reran with initialData defaults successfully. Production worker was inspected for dynamic Function/eval and Node imports: none. Compiler and static build passed; native UI/Worker flows remain manually unverified.

## Digest authentication milestone (2026-09-24)

Official sources consulted before implementation:
- https://www.rfc-editor.org/rfc/rfc7616.html — challenge lists, auth/auth-int, algorithms, stale nonce and origin/protection space.
- https://docs.rs/digest_auth/0.3.1/digest_auth/ — AuthContext and prompt.respond; installed source inspected for algorithm/body hash and quoting.
- https://docs.rs/http-auth/0.1.10/http_auth/ — ChallengeParser supports combined RFC7235 challenge lists. Only its parser is enabled.
- https://docs.rs/http-body-util/latest/http_body_util/struct.Limited.html — bounded collection of an already-built multipart body.
- https://docs.rs/reqwest/0.12.28/reqwest/struct.RequestBuilder.html — build_split/from_parts, Request clone and shared client.
- Installed reqwest 0.12.28 redirect.rs/body.rs and reqwest-websocket 0.5.1 lib.rs/native.rs — actual redirect policy, body and UpgradeResponse behavior.
- Legacy ui/components/editors/auth/digest-auth.tsx, models/request.ts and network/authentication.ts — saved username/password/disabled fields and neighboring auth behavior.

Commands executed:
~~~powershell
cargo info digest_auth@0.3.1
cargo info http-auth@0.1.10
cargo add http-auth@0.1.10 --manifest-path src-tauri/Cargo.toml --no-default-features --features digest-scheme
cargo add http-body-util@0.1 --manifest-path src-tauri/Cargo.toml
cargo add digest_auth@0.3.1 --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo build --manifest-path src-tauri/Cargo.toml
bun run check
bun run tauri build --bundles nsis --ci
~~~

After inspecting the actual implementation, removed http-auth's digest-scheme feature from Cargo.toml: its auth-int path passes raw body bytes into H(A2), whereas RFC7616 requires H(entity-body). Use its challenge-list parser only, and digest_auth for the documented calculation including the body hash. This is why both dependencies exist. Session algorithms without qop cannot be serialized correctly by digest_auth and are rejected explicitly. No handwritten cryptographic algorithm or Basic fallback.

Bun orchestrated a one-off rustc compilation from stdin referencing actual src-tauri/src/digest.rs and existing Cargo dependency artifacts; no test script/source file was created. The ignored artifacts/digest-inspection.exe was called against disposable Bun loopback endpoints. Twenty cases passed, including all three hash families/session variants, multipart auth-int bytes, stale nonce, wrong credentials, redirects/cross-origin restrictions, timeout and WebSocket handshake/message. This proves the native executor path, not Tauri IPC or UI. Direct JS environment/import/browser-block checks also passed after correcting a fixture that accidentally added a second base environment. No live credentials or user data used. Build advice mentioning another package manager was not executed.

Digest follow-up evidence: direct native inspection of an escaped ASCII realm and userhash passed. A Thai UTF8 realm failed because http-auth 0.1.10 ChallengeParser explicitly disallows non-ASCII (documented in its installed parser.rs implementation notes). Keep this as a compatibility gap; do not claim UTF8 realm support or weaken parsing with a handwritten challenge splitter. No additional network or test source files were used.

## Digest Unicode/NFC fix (2026-09-24)

Sources read before changes:
- https://www.rfc-editor.org/rfc/rfc7616.html — section 4: charset=UTF-8 is case-insensitive, NFC username/password and username*.
- https://www.rfc-editor.org/rfc/rfc5987.html — UTF-8 extended parameter encoding.
- https://doc.rust-lang.org/cargo/reference/overriding-dependencies.html — documented [patch.crates-io] path override.
- https://docs.rs/unicode-normalization/latest/unicode_normalization/ — UnicodeNormalization::nfc.
- https://docs.rs/http-auth/0.1.10/http_auth/ and installed parser/lib/table source — ASCII limitation and quoted-pair handling.
- https://docs.rs/digest_auth/0.3.1/digest_auth/struct.WwwAuthenticateHeader.html and installed source — public prompt fields and calculation API.
- https://bun.sh/docs/runtime/networking/tcp — disposable raw TCP endpoint, needed to preserve actual UTF8 header bytes.

Commands: cargo info www-authenticate; cargo info www_authenticate_parser@1.0.2 (evaluated only, not added), cargo add unicode-normalization --manifest-path src-tauri/Cargo.toml, cargo add percent-encoding --manifest-path src-tauri/Cargo.toml, cargo fmt, cargo clippy -- -D warnings, cargo build, and bun run tauri build --bundles nsis --ci.

Copied installed http-auth 0.1.10 source and both upstream licenses using Bun into src-tauri/vendor/http-auth. UPSTREAM.json records original file SHA-256 and commit 4f39f8be586b7cc29c97c0bad27e73aa4534293e. Applied the documented Cargo path patch. Only three upstream source files differ (14 additions/9 deletions): obs-text classification inside quoted values, Unicode-safe quoted-pair unescape, documentation and one explicit lifetime. No local registry files changed. No fork published. Original upstream embedded tests are retained; no new test scripts authored.

The application now maps parsed parameter values directly to digest_auth public fields, avoiding its text parser's character/byte offset mismatch. Cryptographic calculation remains in that library. UTF8 credentials are NFC-normalized without changing stored values; non-ASCII unhashed usernames use RFC5987 username*. Unknown qop values are ignored when a supported option exists, duplicate keys are rejected and unsupported charsets fail visibly.

Native verification: 17 direct header/hash cases and 8 malformed/unsupported cases passed, with SHA values independently calculated in Bun. A final actual reqwest exchange against a raw Bun loopback TCP endpoint passed Thai realm/body, NFC credentials, username*, auth-int and encoded URI with exactly 401 then 200. Helpers were compiled by rustc from stdin under Bun orchestration; no source test files were created. One initial helper compilation used JavaScript-style Unicode escapes inside a Rust string; corrected the ephemeral helper to Rust brace escapes and reran successfully. No application code failure or user data involved. These checks do not exercise Tauri IPC or UI.

## OAuth token exchange foundation (2026-09-24)

Sources read before implementation:
- https://docs.rs/oauth2/5.0.0/oauth2/ and trait.AsyncHttpClient.html — documented grant builders/custom async HTTP adapter. Installed source was inspected for RFC6749 Basic encoding, response parsing and token types.
- https://www.rfc-editor.org/rfc/rfc6749.html — client/password/refresh grants, token responses and rotation.
- https://www.rfc-editor.org/rfc/rfc8252 and https://www.rfc-editor.org/rfc/rfc9700 — native external-browser/PKCE and legacy grant considerations for the next phase.
- https://github.com/FabianLars/tauri-plugin-oauth and its v2/src/lib.rs — real Tauri loopback example inspected; not installed in this milestone. Callback validation, blocking read and first-callback lifetime require further evaluation.
- https://github.com/paulmillr/noble-hashes#usage — synchronous sha256/subpath imports for persisted context fingerprints.
- https://raw.githubusercontent.com/postmanlabs/postman-runtime/develop/lib/authorizer/oauth2.js — accessToken/headerPrefix/addTokenTo/tokenType behavior.
- https://doc.rust-lang.org/cargo/commands/cargo-add.html — Cargo dependency command.

Commands: cargo add oauth2@5.0.0 --no-default-features --manifest-path src-tauri/Cargo.toml; cargo fetch --manifest-path src-tauri/Cargo.toml; bun add @noble/hashes (resolved 2.4.0); bun x --bun prettier --write <changed frontend files>; bun run check; cargo check/build/clippy/fmt with the same manifest. oauth2 uses the existing reqwest 0.12 client via a custom bounded AsyncHttpClient; no second HTTP runtime or Node sidecar.

Initial async closure produced a Rust Send/lifetime diagnostic under Tauri; replaced it with the library-documented explicit AsyncHttpClient implementation. Svelte check initially required a return-type annotation on savedOAuthTokens; fixed. Final checks passed. Bun compiled the actual native oauth.rs from Rust stdin into ignored artifacts/oauth-inspection.exe, then drove 20 cases through disposable local HTTP endpoints. No test source/scripts were created. Pure JS modules and compiled Svelte client state were inspected from inline Bun with mocked IPC. The first ephemeral module resolver used a file path instead of a directory; corrected the helper and reran successfully. Neither this helper nor direct native exchange proves Tauri IPC/UI. CUA still reports no enabled surfaces.

Preparation for the next interactive phase also consulted https://docs.rs/axum/latest/axum/fn.serve.html (0.8.9; serve has no connection configuration), https://docs.rs/oauth2/5.0.0/oauth2/struct.PkceCodeChallenge.html (library-generated S256 verifier/challenge), and https://v2.tauri.app/plugin/opener/ (external browser through installed opener plugin). No callback-server dependency or interactive flow has been added yet.

Public-client follow-up: omit client_secret from body authentication when empty, while explicitly selected Basic still sends the empty password. The actual native source passed both cases after recompiling the stdin helper. Clippy passed again. First OAuth release session 27477 passed; final packaging is repeated to include this correction.

Final OAuth release (including public-client correction) passed in session 56212. BUILD.json records the matching 133-file source manifest and executable/NSIS hashes. Installer was not launched or published.

## Authorization Code / PKCE (2026-09-24)

Sources read before implementation: https://hyper.rs/guides/1/server/hello-world/ and https://docs.rs/hyper/latest/hyper/server/conn/http1/struct.Builder.html (official server/service/TokioIo example and connection limits); https://docs.rs/oauth2/5.0.0/oauth2/struct.PkceCodeChallenge.html and installed builder/secret-trait sources; https://www.rfc-editor.org/rfc/rfc8252.html; https://v2.tauri.app/plugin/opener/. The earlier tauri-plugin-oauth example was evaluated but not added. Hyper enables bounded concurrent callbacks and cancellation without copying its single blocking read.

Documented dependency commands: cargo add hyper@1 --features server,http1 --manifest-path src-tauri/Cargo.toml; cargo add hyper-util@0.1 --features tokio --manifest-path src-tauri/Cargo.toml; cargo add tokio@1.53.1 --features sync,time,macros,net,rt --manifest-path src-tauri/Cargo.toml; cargo add oauth2@5.0.0 --no-default-features --features pkce-plain,timing-resistant-secret-traits --manifest-path src-tauri/Cargo.toml. Hyper/Hyper-util were already reqwest dependencies; server support adds httpdate.

Verification: cargo check/clippy -D warnings/debug build, cargo fmt and bun run check passed. A Bun-orchestrated rustc stdin helper compiled actual oauth.rs/oauth_callback.rs into ignored artifacts/oauth-code-inspection.exe. Real local flows verified the PKCE verifier independently with Bun SHA-256, redirects, validation/retry, denial, parallel incomplete TCP headers and timeout cleanup. The first helper incorrectly expected at least 32 state characters; inspected the library 16-byte random state and corrected the expectation to its 22-character unpadded base64url representation, then reran successfully. The helper deadline ended the abandoned first attempt; final helper runs include explicit process cleanup. No app bug or real user/provider data involved. Compiled Svelte module state was inspected from memory with mocked IPC, including invalid callback retry, error-order race, cancellation, stale results and send ordering. No test source/scripts were saved. A multi-file patch initially had a mismatched UI context and made no edits; reapplied with the actual context. Actual browser/IPC/UI still await an enabled CUA surface.

Legacy parity follow-up: the original get-token.ts also sends a configured state in the code token form. Preserved that field only when explicitly configured (generated random state remains internal); direct native Unicode/empty-state cases passed. Inspected oauth2 RedirectUrl::new versus from_url: new retains the original registered text. Explicit redirect text now survives default ports, host/scheme case and percent escapes in both authorization and token requests; only an allocated ephemeral port changes it. Three native builder/token exchanges passed these cases. Final clippy passed; release 63143 completed before these follow-ups, so final packaging is repeated.

Final Authorization Code/PKCE release session 27943 passed after both legacy parity corrections. The 135 application source hashes remained unchanged through packaging. Executable and NSIS SHA-256 are in BUILD.json; neither installer execution nor real browser/Tauri IPC acceptance was performed.

## Implicit OAuth callbacks (2026-09-24)

Official sources consulted: https://www.rfc-editor.org/rfc/rfc6749.html#section-4.2 ; https://openid.net/specs/openid-connect-core-1_0.html#ImplicitFlowAuth ; https://openid.net/specs/oauth-v2-multiple-response-types-1_0.html ; https://docs.rs/oauth2/5.0.0/oauth2/struct.AuthorizationRequest.html ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src ; https://docs.rs/http-body-util/latest/http_body_util/struct.Limited.html . Existing oauth2/hyper/base64/serde dependencies suffice; no new dependency or generator needed. Original get-token.ts response variants/nonce/id_token fallback were inspected before changes.

Used documented AuthorizationRequest::set_response_type, library CsrfToken, Hyper service and Limited body collector. Default response modes are retained (token variants fragment; none query), avoiding redundant response_mode per the encoding specification. ID-token use is explicit API credential collection, with transaction nonce/syntax checks but no claim of signature/identity validation.

Commands: bun x --bun prettier --write <changed JS/Svelte>; bun run check; cargo fmt --manifest-path src-tauri/Cargo.toml; cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings; bun run tauri build --bundles nsis --ci (session 8065). Inline Bun compiled actual Rust modules from stdin into ignored inspection binaries and drove native TCP cases; inline Bun also compiled Svelte state in memory with mocked IPC and executed exact relay JS in an isolated JS context. No saved test script/source was created. One read-only shell command used unsupported PowerShell brace syntax, then a stale storage.js path; corrected to explicit paths/persistence.js without file changes. CUA still reports no enabled surfaces.

Final Implicit release session 8065 exited 0. All 137 captured source hashes matched after packaging; BUILD.json records executable/NSIS sizes and SHA-256. No installer launch or real browser/Tauri UI acceptance was performed.

## Legacy login window (2026-09-24)

Inspected original main/authorizeUserInWindow.ts and o-auth-2/get-token.ts first. Official sources: https://docs.rs/tauri/latest/x86_64-pc-windows-msvc/tauri/webview/struct.WebviewWindowBuilder.html (navigation/page-load/popup hooks, blocking-worker creation, data directory/store); https://v2.tauri.app/security/capabilities/ (AppManifest command generator/main permissions); https://docs.rs/tauri-plugin-window-state/latest/tauri_plugin_window_state/struct.Builder.html (with_filter). Existing dependencies suffice.

Used documented tauri_build::try_build and AppManifest::commands; cargo check generated 13 permission TOMLs before use. Commands: cargo fmt/check/clippy -D warnings with src-tauri/Cargo.toml; bun x --bun prettier --write changed JS/Svelte/JSON; bun run check; bun run tauri build --bundles nsis --ci (session 47190).

Bun orchestrated actual native modules compiled from stdin. First helper's Unicode literal was emitted as Rust-incompatible escapes; corrected ephemeral helper to Rust brace escapes and reran successfully. ACL helper initially assumed another manifest key and one capability; inspected generated __app-acl__ and both capabilities, then verified all 13 commands/main-local grants. No application compiler findings. Some read-only searches used stale/glob paths; corrected through inventory. A long documentation-writing shell command was rejected by policy before execution; applied the authorized documentation updates as explicit file patches instead. No test scripts saved. Compiled Svelte/mock-IPC checks passed; CUA remains unavailable.

Legacy login-window release session 47190 exited 0. All 152 source hashes matched captured inputs after packaging; executable/NSIS hashes are in BUILD.json. Real window/provider/IPC/installer acceptance remains pending.
# OAuth1 signing and NO_PREFIX (2026-09-24)

Before implementation: read RFC 5849 and verified erratum 2550 (https://www.rfc-editor.org/errata/rfc5849), https://www.ietf.org/archive/id/draft-eaton-oauth-bodyhash-00.html, https://docs.rs/hmac/0.12.1/hmac/, https://docs.rs/rsa/latest/rsa/, https://docs.rs/oauth1-request/0.6.1/oauth1_request/, original o-auth-1 adapter/editor and https://github.com/ddo/oauth-1.0a. Read Postman runtime authorizer before import mapping: https://github.com/postmanlabs/postman-runtime/blob/develop/lib/authorizer/oauth1.js. Inspect installed crate source when a docs page is unavailable.

Commands: cargo info oauth1-request@0.6.1 (inspection only); cargo add hmac@0.12 sha1@0.10 sha2@0.10 --manifest-path src-tauri/Cargo.toml; cargo add rsa@0.9 --features sha1,pem --manifest-path src-tauri/Cargo.toml. Adding sha1@0.10 with oid failed because Cargo consulted earliest version feature metadata; corrected to cargo add sha1@0.10.6 --features oid --manifest-path src-tauri/Cargo.toml, then cargo fetch. Lockfile resolves hmac 0.12.1, sha1 0.10.7, sha2 0.10.9 and rsa 0.9.10. No new JS package or alternative OAuth library dependency.

Validation: cargo check/build (debug session 3578 exited 0), cargo fmt, cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings; bun run check; bun x --bun prettier --write/check changed JS/Svelte; final bun run tauri build --bundles nsis --ci (session 23465). Generated Vite output prints npm preview advice; it was not executed.

Fixed two JS nullable-metadata diagnostics and Clippy's checked Option expect finding before final checks. Inline inspection initially mistyped the RFC token (two k characters instead of three), corrected the fixture and confirmed official erratum 2550's POST signature. Svelte SSR inspection initially used auth instead of the component's authentication prop; corrected the ephemeral invocation. Some read-only rg paths used unsupported shell globs; corrected using file inventory. These helper failures did not indicate provider success or native UI coverage.

Inline Bun compiled actual oauth1.rs and digest.rs from Rust stdin into an ignored binary; no test script/source was saved. Seventeen signature cases + fifteen rejection cases passed, then thirteen real native loopback cases including multipart/SSE/WebSocket/Digest regression passed. Pure JS preparation/import/NO_PREFIX and in-memory compiled Svelte SSR passed. Snapshot captures 155 source files before packaging; finalize BUILD.json only after terminal success and matching hashes.

Read-only preparation for the next milestone while packaging: RFC 7617 (https://www.rfc-editor.org/rfc/rfc7617.html) and RFC 6265 (https://www.rfc-editor.org/rfc/rfc6265.html); original network/authentication.ts, basic-auth/get-header.ts and models/request.ts. Confirmed useISO88591 selects Buffer latin1 encoding and API-key Cookie returns an explicit Cookie header. No implementation of those next options is included in the OAuth1 snapshot. Inspect low-byte/truncation semantics and cookie/header precedence before porting; do not silently treat imported Latin-1 credentials as UTF-8.

OAuth1 release session 23465 exited 0 (Rust release 4m11s). All 155 source hashes matched the captured input after packaging. BUILD.json records fingerprint 2d4bff312e6c2f903dcd4e75ebed6da1c334f9e89894f62ac8e89f53ab91e42a, executable 8,652,800 bytes and NSIS 3,271,956 bytes with individual SHA-256. No installer launch/publish, commit or native UI verification. Disposable inspection servers stopped; unrelated older Cargo processes were left alone.

## Documentation and command log

Date: 2026-09-24. Commands were executed using PowerShell/Bun/Cargo; no Node/npm/npx/yarn/pnpm/Python/pip commands were run. CLI output sometimes prints upstream suggestions for other managers; those suggestions were not executed.

## Initialization (already completed — do not run again)

```powershell
bun create tauri-app --help
bun docs/migration/archive.mjs capture

## Basic/Bearer/API-key compatibility (2026-09-24)

Inspected original network/authentication.ts, basic-auth/get-header.ts, bearer-auth/get-header.ts, main/network/parse-header-strings.ts, libcurl-promise.ts, and original Auth editors. Official docs before changes: https://www.rfc-editor.org/rfc/rfc7617.html ; https://www.rfc-editor.org/rfc/rfc6265.html ; https://bun.com/reference/node/buffer ; https://curl.se/libcurl/c/CURLOPT_HTTPHEADER.html ; https://curl.se/libcurl/c/CURLOPT_COOKIE.html ; https://spec.openapis.org/oas/v3.1.1.html#security-scheme-object . No new dependency/init required.

Commands: bun x --bun prettier --write/check changed JS/Svelte; bun run check; git diff --check; bun run tauri build --bundles nsis --ci (session 97455). Fixed one implicit-any callback diagnostic with a JSDoc annotation. Some read-only searches used absent/glob paths; corrected with file inventory. Native inspection helper initially rejected a null Digest field (helper expected omitted field); omitted that null in the helper input and reran successfully. No application native failure.

Inline Bun compared the actual archived Basic function in 20 cases, inspected request/import/OpenAPI preparation and browser refusal before fetch. Three native wire echoes used the existing stdin-compiled actual executor helper, with no auth signing configured. No saved test scripts/source; no new Rust code/dependencies. CUA again returned empty apps/browsers, so actual UI/Tauri IPC remains pending. Source snapshot: artifacts/simple-auth-source-snapshot.json, 155 files. Finish BUILD.json only after packaging exits successfully and hashes match.

Read-only advanced-auth inventory: original AWS/Hawk/ASAP/NTLM/netrc editors/transport; official aws-sigv4 signing example, Mozilla Hawk repository and libcurl NETRC documentation. Recorded fields, unsupported behaviors and next order in AUTH-INVENTORY.md. The guessed Atlassian ASAP docs URL was unavailable; locate the current protocol before implementation. Microsoft MS-NLMP index: https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-nlmp/b38c36ed-2804-4868-a9ff-8dd3182128e4 .

Simple-auth release session 97455 exited 0 (Rust release 3m58s). All 155 captured source hashes matched after packaging. Only three application inputs changed since OAuth1: RequestEditor.svelte, openapi.js and transport.js. BUILD.json records source fingerprint 3402244eb02668c643f89c189e38e0b68271670a311a659d140b758cbcf864a8, executable 8,652,800 bytes and NSIS 3,272,699 bytes with individual SHA-256. No installer execution/publication, native UI verification, commit or push.

## Manual Authorization precedence (2026-09-24)

Inspected original parse-header-strings.ts, libcurl-promise.ts, authentication.ts and current OAuth/workspace/GraphQL preparation. Official source: https://curl.se/libcurl/c/CURLOPT_HTTPHEADER.html . A Tauri calling-Rust docs request timed out; no new Tauri API/command is used. Fixed frontend Digest/OAuth1/OAuth2 precedence, skipped unused automatic OAuth acquisition, and kept explicit Fetch/Refresh. Native signed dispatch and redirect policy agree with that precedence.

Commands: bun x --bun prettier --write changed JS/Svelte; bun run check (0 errors/warnings); cargo fmt; cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings (passed); git diff --check; bun run tauri build --bundles nsis --ci (session 66146). First patch had stale UI context and was rejected atomically; inspected exact source and applied the corrected patch. No new dependencies.

Inline Bun compiled actual Svelte workspace in memory with mocked Tauri APIs. Verified manual HTTP/GraphQL/SSE/WS sends skip all OAuth calls, explicit Fetch/Refresh still exchange/save, expired tokens are untouched during manual sends, and disabling the header restores automatic refresh. Empty/duplicate/environment names and unused invalid credentials passed. Native inspection compiled actual request structs/client and request builders plus signed executor from stdin. A placeholder persistent-jar type only satisfied the unused None branch; no jar/storage path was exercised. Fourteen actual TCP cases passed, including same/cross-origin redirects/follow-off, final 401, SSE/WS, and Digest/OAuth1 auto regressions. No saved test scripts/source.

Source snapshot: artifacts/manual-auth-source-snapshot.json, 155 files. Await terminal success and hash match before updating BUILD.json. Read-only next-AWS preparation inspected aws4 v1.13.2 constructor/matchHost/prepareRequest/canonicalString from upstream raw source and official aws-sigv4 SigningSettings. Notes in AUTH-INVENTORY.md; no AWS dependency/code yet.

Manual-auth release session 66146 exited 0 (Rust release 3m55s). All 155 source hashes matched captured inputs. BUILD.json records fingerprint 09a510d0b4eb2120611f093b4ec97a1101b71796bfccbbe2b6a883e79c488886, executable 8,652,288 bytes and NSIS 3,271,627 bytes with individual SHA-256. Original common/misc.ts confirms empty Authorization still counts by header presence. No installer launch/publish, commit/push or actual UI verification.

## AWS IAM header signing — 2026-09-24

Read official AWS signing instructions, aws-sigv4 crate API/source, Cargo add docs, original aws4 1.13.2 and Postman runtime before editing (links in AWS-COMPATIBILITY.md). Pinned API requires Rust >= 1.94.1; installed 1.98.1 satisfies it.

- cargo info aws-sigv4@1.6.0
- cargo add aws-sigv4@1.6.0 aws-credential-types@1.3.0 --manifest-path src-tauri/Cargo.toml
- cargo fetch --manifest-path src-tauri/Cargo.toml --locked
- cargo check --manifest-path src-tauri/Cargo.toml --locked
- cargo build --manifest-path src-tauri/Cargo.toml --lib --locked (session 92158 exited 0)
- cargo clippy --manifest-path src-tauri/Cargo.toml --locked -- -D warnings
- cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
- bun x --bun prettier --write <changed JS/Svelte files>; bun run check (0/0)
- Inline Bun/stdin rustc: actual native modules/builders; 34 AWS cases with independent wire HMAC oracle and 14 manual-auth/Digest/OAuth1 regression cases passed. Environment/import/browser rejection inspected. No saved test scripts. Persistent jar not attached; no real UI/provider claim.
- CUA getState: no apps/browsers.
- One documentation apply_patch had stale context and was rejected atomically; corrected against current content. No application edit failed.
- Release command: bun run tauri build --bundles nsis --ci; session 36145 exited 0 (Rust 4m04s), all 157 source hashes matched. Final source/artifact hashes recorded in STATUS/BUILD.json.

## Hawk signing — 2026-09-24

- Read pinned Hawk 9.0.1 client/crypto/utils, Hoek escaping, published API vectors, Postman runtime/client source and RustCrypto HMAC docs; links in HAWK-COMPATIBILITY.md.
- cargo info hawk@5.0.1: downloaded for inspection only. Its DigestAlgorithm lacks SHA1; no Cargo dependency added. Existing RustCrypto SHA1/SHA256/HMAC are reused.
- cargo fmt --manifest-path src-tauri/Cargo.toml; cargo clippy --manifest-path src-tauri/Cargo.toml --locked -- -D warnings: passed.
- bun x --bun prettier --write <changed JS/Svelte files>; bun run check: passed, zero errors/warnings.
- Inline Bun/stdin rustc using actual modules/builders: 45 Hawk cases (two published vectors, independent wire oracle) plus 34 AWS and 14 manual-auth/Digest/OAuth1 regressions passed. Pure JS environment/import/mode/browser checks passed. No saved test scripts or persistent jar/provider/UI claims.
- One frontend patch failed atomically due to changed Prettier line layout; corrected against current source before compiler checks.
- CUA getState: no apps/browsers.
- git diff --check and cargo fmt --check: passed.
- Release command: bun run tauri build --bundles nsis --ci; session 97539 exited 0 (Rust 3m29s). All 160 source hashes matched; source/artifact hashes recorded in STATUS/BUILD.json.

## ASAP signing — 2026-09-24

- Read official ASAP, pinned httplease-asap 0.6.0/JWT9, Postman runtime and installed jsonwebtoken API/source before implementation; source links in ASAP-COMPATIBILITY.md.
- Documented commands: cargo info jsonwebtoken; cargo add jsonwebtoken@11.1.0 --features rust_crypto --manifest-path src-tauri/Cargo.toml; cargo fetch --manifest-path src-tauri/Cargo.toml --locked; cargo add uuid@1 --features v4 --manifest-path src-tauri/Cargo.toml. Resolved JWT11.1.0 and UUID1.26.1.
- bun x --bun prettier on changed JS/Svelte; bun run check: zero errors/warnings. cargo fmt and cargo clippy --manifest-path src-tauri/Cargo.toml --locked -- -D warnings passed (session78917). Debug library build session7114 exited0 in 1m06s.
- Inline Bun/rustc stdin inspection: 64 ASAP cases, independent eight-algorithm signature oracle; 45 Hawk +34 AWS +14 manual-auth/Digest/OAuth1 regressions passed. No saved test scripts. Temporary keys only in memory; disposable loopback servers stopped.
- CUA recheck: apps/browsers empty. Native UI/IPC/provider/TLS/proxy/persistent-jar acceptance remains pending.
- Release bun run tauri build --bundles nsis --ci: session21055 exited0, Rust4m52s; all163 captured source hashes matched. BUILD.json records the executable/NSIS sizes and SHA-256. Installer not run/published.

## NTLMv2 — 2026-09-24

Read official MS-NLMP, reqwest connector-layer, SSPI installed examples/source, Tower, RFC5929 and X509 docs before implementation; exact cargo add commands/sources are in NTLM-COMPATIBILITY.md. First cargo check session36403 found two API spelling/mutability errors, fixed. Clippy -D warnings passed; debug build session97251 exited0 (1m10s). Svelte check0/0. Inline native inspection passed30 cases, plus27 scenarios over three TLS certificate variants and157 previous-auth regressions. Temporary synthetic keys removed; no saved test scripts. Windows packaging session59352 exited0 (Rust release5m18s);164 source hashes matched artifacts/ntlm-source-snapshot.json. BUILD.json records executable/NSIS hashes; installer not run/published.


## Netrc checkpoint

Read CURLOPT_NETRC, pinned curl7.86 netrc.c/url.c, current parser, curl credential-leak advisories and Rust1.98 home_dir docs before implementation (links in NETRC-COMPATIBILITY.md). No extra dependency or generator needed. Ran cargo fmt, bun x --bun prettier --write on modified frontend files, cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings, bun run check; all passed. Compiled actual native modules/builders from rustc stdin using Bun;45 synthetic netrc cases and187 existing-auth regressions passed. No saved test scripts or user netrc reads. Ran bun run tauri build --bundles nsis --ci; session74624 exited0 (Rust release4m17s). All165 captured source hashes matched after packaging; executable/NSIS hashes recorded in BUILD.json.


## ASAP ES512 follow-up

Read official JWS/JWA/RFC6979, p521 API/examples and installed source first. Ran cargo info p521@0.13.3, then cargo info p521@0.14.0 after inspecting the existing Cargo.lock. Selected the already-present0.14.0 and ran cargo add p521@0.14.0 --no-default-features --features ecdsa,pem,std --manifest-path src-tauri/Cargo.toml. No additional lockfile package versions were needed. Ran cargo fmt, Bun Prettier, cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings, bun run check and cargo build --manifest-path src-tauri/Cargo.toml --lib (session2294 exited0,40.80s). Actual native code compiled from stdin;89 ASAP cases and RFC6979 vector passed, plus ES512 import/environment checks. No saved test scripts. Windows release session57219 exited0 (Rust release4m11s). All165 captured source hashes matched; executable/NSIS hashes are recorded in BUILD.json. Installer not executed or published.

## gRPC native core — 2026-09-24

Read Tonic/protox/prost-reflect APIs, installed crate sources, official gRPC reflection/protocol definitions and RouteGuide working example first (GRPC-INVENTORY.md). Ran cargo info for tonic0.14.6, protox0.9.1, prost-reflect0.16.5 and tonic-reflection0.14.6, then documented dependency commands:

```powershell
cargo add tonic@0.14.6 --no-default-features --features channel,codegen,tls-ring,tls-webpki-roots,gzip --manifest-path src-tauri/Cargo.toml
cargo add protox@0.9.1 prost@0.14 prost-types@0.14 tonic-prost@0.14.6 tokio-stream@0.1 --manifest-path src-tauri/Cargo.toml
cargo add prost-reflect@0.16.5 --features serde --manifest-path src-tauri/Cargo.toml
cargo add tonic-reflection@0.14.6 --no-default-features --manifest-path src-tauri/Cargo.toml
cargo fetch --manifest-path src-tauri/Cargo.toml --locked
cargo check --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo build --manifest-path src-tauri/Cargo.toml --lib --locked
bun run check
bun x --bun prettier --check src-tauri/capabilities/default.json
git diff --check
```

Initial check/clippy passed. Inline inspection found metadata ASCII/base64 joining and Any-example edge cases; fixed and rechecked. Final debug library build session42794 exited0 (31.37s), Svelte0/0. Native source compiled via rustc stdin, orchestrated only with Bun;63 gRPC cases and103 existing-auth regressions passed. No saved test scripts, external protoc, Node runtime or real credentials. Synthetic TLS key removed and all servers stopped.172-file debug snapshot is artifacts/grpc-core-source-snapshot.json; no gRPC release build was performed. BUILD.json/installer remain the previous ES512 checkpoint.

Additional primary sources read during inspection: https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-HTTP2.md and https://bun.sh/reference/node/http2 . At this earlier native-core checkpoint, protobuf.js adaptation was still a candidate. The subsequent implementation is recorded below; existing CSP remains enforced.

## gRPC method presentation — 2026-09-28

After workspace returned to E:\insomnium and full filesystem access was restored, read STATUS/PLAN/PARITY and original grpc-method-dropdown/body controls. Consulted official Svelte keyed-each and MDN optgroup docs (GRPC-INVENTORY.md). Added package grouping/type labels and Body/Stream N sent tabs. Ran bun x --bun prettier --write src/lib/grpc-model.js src/lib/components/GrpcPane.svelte; bun run check (0 errors/0 warnings); bun run build (session2682 exited0); git diff --check.10 inline Bun grouping cases passed: discovery order, package/no-package/fallback, equal short names with distinct full paths, four RPC kinds, no mutation and empty list. No saved tests or dependency changes. No installer rebuild; BUILD.json remains the prior proto-manager package.

## gRPC proto management — 2026-09-24

Read archived proto-file-list.tsx/proto-loader.tsx and official Svelte keyed-each/file-input/Tauri Channel docs before editing (GRPC-INVENTORY.md). No dependency or native API additions. Added proto-management.js/ProtoManager.svelte and integrated workspace/GrpcPane. Used bun x --bun prettier --write on modified files, bun run check, bun run build and git diff --check. Initial JS inference errors on a spread resource _id were fixed with a JSDoc resource type; final Svelte check0 errors/0 warnings.

75 inline Bun model/compiled-workspace inspections passed, including33 previous checks and actual native compiler validation of successful refresh/rename and an unchanged service broken by a changed dependency. Covered preservation, collisions, cancellation/shutdown, concurrent changes, missing references and save failure. No test script files were created. Snapshot artifacts/grpc-proto-source-snapshot.json:178 files, fingerprint71e5d6e653edd3fb110a197a92c366b878dfdb0325ea3f6076b83f7964c78e2a. Ran bun run tauri build --bundles nsis --ci; session59731 exited0 (Rust release5m01s), frontend and NSIS builds passed. All178 hashes matched. BUILD.json records EXE11,984,896 bytes/SHA256 1fa659f33557e9f75110f4a93164bdda2d85e456702d2d1bd59934df40501c06 and installer4,335,750 bytes/SHA256 483639bc52587e5c7a92021ac58f59b6e8eb43c026b20bae4daa7ad2a766c5ef. Installer not executed/published.

## gRPC legacy JSON and Svelte integration — 2026-09-24

Read the pinned protobuf.js converter/wrapper/default sources, Long5.3.2, prost-reflect values/descriptors, Electron structured-clone IPC, ryu-js, Bun add, Tauri Channels and Svelte derived-state docs first (links in GRPC-INVENTORY.md). Used documented commands:

```powershell
cargo info ryu-js@1.0.3
cargo add ryu-js@1.0.3 --manifest-path src-tauri/Cargo.toml
# Reference-only cwd: E:\insomnium\artifacts\grpc-legacy-reference
bun add --exact --ignore-scripts protobufjs@7.2.4 long@5.3.2
# Main project cwd: E:\insomnium
cargo fmt --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
bun run check
bun run build
git diff --check
bun run tauri build --bundles nsis --ci
```

Reference packages remain ignored and are not production dependencies. Prettier formatted modified JS/Svelte files through bun x --bun. Fixed required Channel deserialization and a moved Rust connection value during compilation; final clippy passed. Svelte check found a directory-picker attribute type issue, fixed to a boolean; final0 errors/0 warnings. Final deletion/history guard was followed by formatting/Svelte/Rust-format/diff checks.

Inline Bun/rustc-stdin inspections passed97 legacy differential,64 protocol/schema/TLS and33 compiled-workspace/mock-IPC cases. Existing manual-auth JS regression passed. No saved test scripts, real credentials or provider requests. Temporary synthetic TLS key was removed and fixture servers stopped. Snapshot artifacts/grpc-source-snapshot.json records176 source files. Release session24009 exited0 (Rust release6m38s); frontend build and NSIS packaging passed. All176 hashes matched after packaging. BUILD.json records EXE11,980,800 bytes/SHA256 b4fd6f8fbf163b7309052e121cca62aa070445a44d7408d0f16e4a94964548f9 and installer4,333,598 bytes/SHA256 17b2cde6340285c0965e44d9da70572870ab895e677b84ee189be48f49264ff5. Installer not run/published. CUA still exposes no apps/browsers.

## gRPC reflection examples — 2026-09-28

Read archived automock/reflection IPC and official prost-reflect FieldDescriptor/MessageDescriptor and UUID new_v4 docs (GRPC-INVENTORY.md) before editing. Used existing dependencies; no installation required. Ran cargo fmt --manifest-path src-tauri/Cargo.toml and cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings; session98006 exited0. Compiled actual native modules from Rust stdin using existing debug rlibs and drove15 inline Bun cases; all passed. Five archived automock comparisons and independent protobuf.js wire decodes also passed after correcting inspection expectations for float32 rounding and proto3 default omission. No saved test scripts.

Captured179-source snapshot artifacts/grpc-example-source-snapshot.json and started bun run tauri build --bundles nsis --ci, session46089. Final outcome is in STATUS/BUILD.json.

Release checkpoint: session46089 exited0, Rust release5m29s and NSIS packaging passed. All179 source hashes matched snapshot4fc81a205bcd2b91815b6083e57b49791ed6dac628bf8a162b57ba07270456cb. BUILD.json updated; installer not executed/published. No active operations remain.

## Shared editor foundation — 2026-09-28

Selected the original CodeMirror5 architecture after official manual/Svelte lifecycle/Bun add documentation. Ran bun add --exact codemirror@5.65.21, bun add --dev @types/codemirror, bun x --bun prettier --write on modified JS/Svelte, bun run check (0/0), bun run build (passed), and git diff --check.10 inline Bun mode/cache assertions passed. No saved test scripts/native changes. Wrapper is integrated into HTTP/gRPC bodies; source is not yet packaged. Continue with EDITOR-TEMPLATE-INVENTORY.md.

## Environment completion checkpoint — 2026-09-28

Added show-hint integration and editor-completion.js for inherited environment names in HTTP/gRPC bodies. Ctrl-Space and delayed interpolation suggestions support current dot/numeric/underscore-alias rendering syntax, avoid duplicate closing braces and replace whole partially typed names. Names only; bounded traversal avoids getter execution/cycles. Original Tab behavior preserved through CodeMirror.Pass. Bracket/quoted paths, tags/snippets/constants, Nunjucks runtime and GraphQL completion remain pending.

Read archived extensions/autocomplete.ts and official https://raw.githubusercontent.com/codemirror/codemirror5/master/addon/hint/show-hint.js plus the official manual before edits. No new packages. Ran bun x --bun prettier --write, bun run check (final0 errors/0 warnings), bun run build (passed), and15 inline Bun boundary/name/limit assertions. No saved test scripts. Actual popup/IME/lifecycle acceptance remains unverified; source is not packaged.

## GraphQL editor checkpoint — 2026-09-28

Read official https://raw.githubusercontent.com/graphql/graphiql/main/packages/codemirror-graphql/README.md and installed using bun add codemirror-graphql (2.2.9). Connected GraphQL query/JSON variables to the shared editor, schema-aware query completion and live lint, with environment hints and separate undo identities. Lint skips large/read-only/unrendered-template content; explicit rendered validation remains. Six direct language-service assertions passed; Svelte0/0 and frontend build passed. Initial markup/type diagnostics fixed. No saved test scripts/native changes. Type hover/navigation, variable-specific suggestions/lint, template integration and real WebView acceptance remain pending. Source is newer than the packaged BUILD.json.

## GraphQL variables/navigation — 2026-09-28

graphql-editor.js derives input types from the selected operation; invalid/ambiguous selections yield no map. Connected installed variables mode/hint/lint and query jump to the current Schema view. JSON non-object roots and upstream lint exceptions become diagnostics. Parent/named type navigation works in source; directive-only/hover/field highlighting remain open. Variables linter does not check omitted required variables. Nine inline mapping/reference assertions passed; Svelte0/0, Prettier and frontend build passed. Lazy editor chunk now triggers the500kB build warning; split later without suppressing it. Actual DOM/IPC behavior remains unverified and source is unpackaged.

Official sources read: https://www.graphql-js.org/api-v16/utilities/ , https://raw.githubusercontent.com/graphql/graphiql/main/packages/codemirror-graphql/src/jump.ts and installed codemirror-graphql2.2.9 variables/hint.js, variables/lint.js, utils/collectVariables.js and utils/SchemaReference.js. The remote variables/hint and collectVariables paths failed to fetch; installed official package sources supplied the implementation evidence. Commands: bun x --bun prettier --write, bun run check, bun run build, git diff --check. No new dependencies/native changes/saved test scripts.

GraphQL hover/directives checkpoint (September28): editor-hover.js owns lifecycle while reusing official info rendering; upstream info addon was inspected and not enabled because its disable path does not own all document listeners/popups. Schema explorer includes directive descriptions/args/defaults/repeatability/locations and directive-reference navigation. Official source: https://raw.githubusercontent.com/graphql/graphiql/main/packages/codemirror-graphql/src/info.ts and installed info-addon.js/info.js. Four directive-format assertions, Svelte0/0, Prettier, frontend build and diff check pass. Actual WebView hover/disposal remains unverified;508.48kB editor chunk warning remains. No saved test scripts/new dependencies/native changes. Source remains unpackaged.

## Shared editor surfaces/settings — September28

Response preview/raw, environment draft and OpenAPI source now use CodeEditor. Preserved read-only response handling, explicit environment Save/Cancel, OpenAPI2MiB UTF-8 guard and diagnostic selection. Settings UI exposes keymap/indent/tabs/wrapping/autocomplete delay with archived defaults (2/tabs/true/1200ms), preserving stored overrides. Official CodeMirror manual and archived models/settings.ts were read first. Six inline settings assertions passed; Svelte0/0, Prettier, frontend build and diff check passed (last guard refinement rechecked with Svelte). Actual editor interaction/layout/reload remains unverified. No saved test scripts/new packages/native changes. Next split editor modules, package checkpoint, finish filters/remaining surfaces/template runtime.

Editor keymap split/packaging: read https://svelte.dev/docs/svelte/$effect and https://vite.dev/guide/features#dynamic-import first. Added selected-keymap dynamic imports with stale-result/disposal guard. Prettier, bun run check (0/0) and bun run build passed; main frontend chunk max343.22kB, no500kB warning. Captured186-source snapshot and started bun run tauri build --bundles nsis --ci (session31547); final outcome in STATUS/BUILD.json.

Final editor package: session37704 exited0 (Rust4m40s). All186 captured source paths/hashes matched fingerprint30cb52a7baa53a5adfc80565f9b13326282fe73d2d704be87aea7e9cb00eea6e. BUILD.json records exact EXE/NSIS hashes. Earlier31547 package was superseded by explicit Vim/lint disposal cleanup. Installer not run/published; no active operations. Real WebView/editor/IPC acceptance still pending.

## JSON formatter — 2026-09-28

Docs consulted before port: https://bun.sh/docs/runtime/transpiler (loader/target and transformSync), https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse (numeric precision on parsing). Archived source/fixtures inspected read-only.

Initialization used inline JavaScript through PowerShell here-string piped to bun run -:

```js
const source = await Bun.file('_backup/legacy-electron/packages/insomnia/src/utils/prettify/json.ts').text();
const output = new Bun.Transpiler({ loader: 'ts', target: 'browser' }).transformSync(source);
await Bun.write('src/lib/json-prettify.js', '// Ported from Insomnium utils/prettify/json.ts (MIT); original formatter attribution: jsonlint.\n' + output);
```

Then customized JS bounds/Unicode handling/JSDoc and connected three Svelte surfaces. Ran bun x --bun prettier --write src/lib/json-prettify.js src/lib/components/RequestEditor.svelte src/lib/components/GrpcPane.svelte src/lib/components/ResponsePane.svelte; bun run check; inline Bun assertions against10 existing fixture pairs plus14 boundary/value cases; bun run build. All passed. No saved test scripts or forbidden runtimes executed. Vite prints its generic npm preview suggestion; that command was not run. No new installer; BUILD.json describes the previous shared-editor package.

## JSON response filters — 2026-09-28

Official references read before implementation:
- https://jsonpath-plus.github.io/JSONPath/docs/ts/index.html (browser export, eval:safe, wrap; project states not actively maintained)
- https://bun.sh/docs/pm/cli/add
- https://vite.dev/guide/features.html#web-workers
- https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate
- https://svelte.dev/docs/svelte/$effect

Commands: bun add --exact jsonpath-plus (resolved11.1.0; Bun prepare regenerated unchanged validators); bun x --bun prettier --write on modified files; bun run check; bun run build; inline Bun.build target:browser/write:false and assertions; compiled Vite worker invoked using Bun Worker. Initial falsy-root assertion failed, fixed explicit root handling and reran successfully.27 helper cases+4 compiled-worker cases+3 history cases passed. No saved test scripts, forbidden runtimes, native package or publication. Current installed Safe-Script source, not older docs' Node-safe wording, was inspected; browser bundle independently exercised. UI/real CSP acceptance remains open.

## XPath filters — 2026-09-28

Sources read before implementation: https://github.com/xmldom/xmldom (README and installed index.d.ts parser onError docs), https://raw.githubusercontent.com/goto100/xpath/master/README.md (select and namespace/function examples), archived utils/xpath/query.ts and CodeMirror prettifyXML. Earlier https://github.com/yaronn/xpath fetch failed.

Ran bun add --exact @xmldom/xmldom xpath; bun x --bun prettier --write on changed files; bun run check (initial Node type mismatch fixed, final0/0); bun run build (passed, worker193.42kB); inline Bun compiled-worker probes and14 assertions; git diff --check. Direct non-worker10001-node probe stalled and its exact process was stopped, then confirmed3-second termination through compiled worker. No saved test scripts or forbidden runtimes; no installer update.

## XML preview formatter - 2026-09-28

Official documentation: https://raw.githubusercontent.com/vkiryukhin/vkBeautify/master/vkbeautify.js (API usage xml(text, indent), source behavior); README URL failed. Commands: bun add --exact vkbeautify; bun add --dev @types/vkbeautify; bun x --bun prettier --write modified files; bun run check; bun run build. Final check/build and12 inline checks passed. After owner updated instructions, every shell call uses C:\Windows\System32\cmd.exe and login:false. Inline Bun -e quoting initially failed, resolved with base64 data-module import argument, no saved test scripts. No PowerShell calls after updated rule, no forbidden runtimes or new package artifact.

## XML request Format - 2026-09-28

Read https://svelte.dev/docs/svelte/$effect and https://vite.dev/guide/features.html#web-workers before wiring. Ran bun x --bun prettier --write modified JS/Svelte; bun run check (0/0); bun run build (passed); five inline compiled-worker assertions (passed after correcting empty-XML diagnostic expectation); git diff --check. All shell calls explicit cmd.exe/login:false, inline Bun data-module execution, no saved tests/dependencies/native package.

Current execution rule (owner update): Do not use shell execution tools or cmd/PowerShell. Launch Bun and other programs directly through node_repl with node:child_process execFile/spawn, shell:false and windowsHide:true. Bun handles scripts/filesystem operations. This supersedes historical cmd.exe instructions below.


Nunjucks foundation: direct node_repl execFile Bun add --ignore-scripts --exact nunjucks quickjs-emscripten; direct Bun entrypoints node_modules/prettier/bin/prettier.cjs --write, node_modules/@sveltejs/kit/svelte-kit.js sync, node_modules/svelte-check/bin/svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings, node_modules/vite/bin/vite.js build. All launched shell:false/windowsHide:true.10 inline Bun assertions passed; no saved test scripts. References/next steps in TEMPLATE-RUNTIME.md.

Template worker/preview: read https://raw.githubusercontent.com/justjake/quickjs-emscripten/main/README.md packaging and WebAssembly loading, installed CustomizeVariantOptions declarations, https://vite.dev/guide/assets.html#explicit-url-imports . Direct Bun add --ignore-scripts --exact quickjs-emscripten-core@0.32.0 @jitl/quickjs-wasmfile-release-sync@0.32.0; remove --ignore-scripts quickjs-emscripten. Direct Bun Prettier, svelte-kit sync, svelte-check and vite build entrypoints passed. Four final compiled-worker assertions via in-memory browser-location/fetch wrapper passed; no actual WebView verification. All launchers node_repl execFile shell:false/windowsHide:true, no saved test scripts.

Built-in tags: official references https://github.com/feross/buffer , https://github.com/paulmillr/noble-hashes , https://github.com/uuidjs/uuid/tree/v9.0.1 , https://raw.githubusercontent.com/date-fns/date-fns/v2.30.0/src/format/index.ts . Bun add --ignore-scripts --exact buffer@6.0.3 date-fns@2.30.0 uuid@9.0.1; direct Bun Prettier/svelte-check/vite entrypoints.18 inline checks passed; no saved test scripts. Shell-free node_repl execFile windowsHide:true launch throughout.
