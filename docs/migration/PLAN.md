# Insomnium → Tauri migration

2026-09-29 checkpoint: Explicit OAuth Fetch/Refresh renders cookie snapshots;25 inline checks and frontend build passed. Retained legacy Restore records must not be blindly overlaid on Send. See COOKIE-RENDERING.md for remaining template-source lifecycle work.

2026-09-29 checkpoint: Cookie snapshot key/value now render separately and rebuild through RawCookie builder without attribute reparsing;24 inline assertions and Cargo checks passed. See COOKIE-RENDERING.md. Legacy template-source overlay and native wire acceptance remain pending.

2026-09-29 checkpoint: Native cookie snapshots now render with Send and reach request-local providers, with generation/bounds checks;40 inline assertions and Cargo/frontend checks passed. See COOKIE-RENDERING.md. Structured legacy-cookie source equivalence and runtime acceptance remain incomplete.

2026-09-29 checkpoint: Native cookie providers now isolate per-request cookies and merge response deltas;8 native assertions and Cargo checks passed. See COOKIE-RENDERING.md. Pre-render cookie snapshot/template bridge and native wire acceptance remain pending.

2026-09-29 checkpoint: User-Agent suppression now reaches native build_client; enabled explicit headers retained.9 inline assertions, Cargo check/clippy/fmt and frontend checks passed. See USER-AGENT.md. Native wire acceptance and full parity remain incomplete.

2026-09-29 checkpoint: WebSocket payload Send now connects when idle, renders before handshake and dispatches once on open;28 inline checks, Svelte/build passed. See WEBSOCKET-RENDERING.md. Real native/WebView acceptance, SSE raw history and full migration remain incomplete.

2026-09-29 checkpoint: Browser preview now bounds response reads at20 MiB with cancellation and no partial success.15 inline checks and Svelte/build passed. See STATUS.md. Live SSE history/native transport/full runtime acceptance remain pending.

2026-09-29 checkpoint: SSE-labelled response dependencies now await complete raw HTTP bodies; 8 inline checks and Svelte/build passed. See DEPENDENT-RESPONSES.md. Live SSE history, preview size bounds and real native/WebView acceptance remain pending; full migration incomplete.

2026-09-29 checkpoint: gRPC discovery/calls/client messages use shared rendering, raw/resolved cache identities and connection-bound cancellation;40 inline assertions, Svelte0/0 and build passed. See GRPC-RENDERING.md. Streaming dependency completion, native transport parity and full WebView/platform acceptance remain incomplete.

Started: 2026-09-24. Owner requested implementation as well as a durable plan.

## Fixed decisions

- Tauri 2 native desktop shell; Svelte + plain JavaScript + Vite frontend.
- Bun only for dependency management, scripts, initialization, frontend build and Tauri CLI. Cargo/Rust handles native code; no Node runtime/sidecar.
- Local-first application with no login, telemetry, remote sync, or automatic calls to sample APIs.
- Preserve current Insomnium layout (collection sidebar, environment switcher, request tabs, URL/send row, response panes, purple accent). Owner explicitly confirmed this choice.
- `jirasync-hub-app` supplies known-working Bun/Tauri configuration patterns, not product identity.
- Move ALL original root contents except `.git` into `_backup/legacy-electron/`. Keep newly created AGENTS/docs outside backup. Restore a copy of LICENSE to root. Preserve a SHA-256 file manifest and original Git HEAD; no commit or push requested.
- Official generators first, then edits. No new test scripts.

## Ordered execution and exit criteria

1. **Inventory and documentation**: inspect models, networking, UI, importers, plugins, workflows; read official Tauri, Bun, Svelte docs; record feature parity and commands.
2. **Archive**: capture original HEAD/status and per-file hashes; move original files with checked absolute paths; compare manifest after move; add `/_backup/` ignore. Existing installed user data is not moved or modified.
3. **Official scaffold**: `bun create tauri-app .migration-scaffold --manager bun --template svelte --identifier app.insomnium.desktop --tauri-version 2 --yes`; promote generated files to root; change scripts to `bun x --bun`; `bun install`. Build the unmodified template before feature work.
4. **Design and architecture**: document tokens, components, state/data boundaries, native commands, resource mapping and data recovery. Implement usable shell matching approved UI direction.
5. **Core request workflow**: workspaces, folders, request CRUD/search/tabs, key-value editors, HTTP methods/body/auth/query, native HTTP transport, cancellation, response body/headers/timing/history, persistence. Verify against local Bun HTTP fixture, not production endpoints.
6. **Data and environments**: Insomnia export import/export, legacy NeDB read-only migration with preview/backup, environment inheritance/templating, cookies, history, settings. Reject unsupported formats visibly; preserve unknown legacy resources.
7. **Advanced networking and tooling**: GraphQL, multipart/binary, proxy/TLS/client certificates, OAuth and other auth, streaming/SSE/WebSocket/gRPC, OpenAPI/design/lint, Git and plugin compatibility. Consult docs per subsystem; follow PARITY.md.
8. **Desktop integration**: menus, shortcuts, native dialogs/files, window state, icons, themes, local preferences, packaging and CI using Bun/Cargo. No update endpoint until project release identity is established.
9. **Acceptance**: Svelte compilation, frontend build, Cargo check/clippy, native build/package, visual inspection and manual core/advanced flows. No new automated test files. Document platform-specific checks that cannot run here.
10. **Handoff**: update STATUS/PARITY/README with exact commands, verified results, outstanding work and next action. Full migration is not complete while parity items remain.

## Continuation protocol

Open `STATUS.md` first, then `PARITY.md`. Inspect working tree without reverting changes. Follow the listed next action. Read relevant official docs before edits. After every milestone update status with files, command and actual outcome. Record active process IDs if a compiler/server is running. Keep failures and limitations explicit. No need for previous chat session.

## Official sources consulted before initialization

- https://v2.tauri.app/start/create-project/ — Bun generator and Svelte JavaScript template.
- https://github.com/tauri-apps/create-tauri-app — generator options; verified with `bun create tauri-app --help` (4.7.4).
- https://v2.tauri.app/start/frontend/vite/ — fixed port, dev URL, dist folder and watcher exclusion.
- https://bun.sh/guides/ecosystem/vite — `bun x --bun` prevents following Node shebangs.
- https://svelte.dev/docs/svelte/overview and https://svelte.dev/docs/svelte/$state — Svelte components and reactive state.
- https://v2.tauri.app/develop/calling-rust/ — async native commands, invocation and channels.
- https://v2.tauri.app/plugin/http-client/ — native HTTP capability and API.
- https://v2.tauri.app/plugin/store/ — local persistent store.
- https://v2.tauri.app/plugin/dialog/ — native file selection.

## Reference findings

`jirasync-hub-app`: Bun scripts explicitly use `bun x --bun`; Vite 1420/1421; Rust plugins for HTTP/dialog/fs/window-state; React/TypeScript frontend is not copied. Its IndexedDB service boundary is useful, but this project needs richer API-client transport and legacy data compatibility.

Original HEAD: `b49e4db` (`fix: repair updated CI workflows`). Original working tree was clean. Tools available: Bun 1.4.2, Rust/Cargo 1.98.1.

## OAuth migration steps

1. DONE: inspect legacy authentication/OAuth2Token models and official oauth2 crate/RFCs; preserve legacy resource fields.
2. DONE: native Client Credentials, legacy Password and Refresh Token exchanges using oauth2 5 + shared reqwest client; bounded responses, cancellation, no token redirects or history.
3. DONE: Svelte Auth editor, environment rendering, context fingerprint, manual override, automatic fetch/refresh before sends/introspection/streams, rotation and explicit imported token adoption; direct native/pure JS/mocked-IPC inspections passed. Native UI/reload acceptance remains pending.
4. IMPLEMENTED (native/UI acceptance pending): Authorization Code with PKCE, external system browser, exact redirect/state validation, callback timeout/cancel and close-time cleanup. Review existing tauri-plugin-oauth working example and RFC8252/7636 before choosing listener implementation; do not copy its unbounded single-read/first-callback lifecycle blindly. Keep fixed-port/custom redirect compatibility visible.
5. IMPLEMENTED (real browser/native UI acceptance pending): Implicit token/id_token/id_token token/none with loopback fragment relay or exact manual URL; explicit ID-token credential selection, nonce checks, default response modes and no-token completion. Direct core/JS inspections passed.
6. IMPLEMENTED (native WebView acceptance pending): optional legacy login window captures exact remote/custom callbacks and uses a separate persistent profile/session rotation. AppManifest permissions restrict all app commands to main. Inspected legacy has no form_post body capture or OS deep-link registration; those are extensions. See OAUTH-COMPATIBILITY.md for actual remaining legacy differences.
7. IMPLEMENTED (native UI/provider acceptance pending): OAuth1 four signature methods, explicit legacy/RFC body modes and shared HTTP/SSE/WebSocket signing; OAuth2 NO_PREFIX. See OAUTH1-COMPATIBILITY.md for direct verification, Postman blockers and remaining edge cases. Basic/API-key options and advanced-auth inventory are complete; implementation order is in AUTH-INVENTORY.md. Keep login-window/provider/certificate/popup gates pending; consult official docs and original modules first. ID-token collection does not establish a verified OpenID identity.
8. IMPLEMENTED (UI/cookie integration acceptance pending): Basic useISO88591, API-key Cookie/OpenAPI cookie auth, Bearer prefix input and Basic/Bearer/API-key manual header precedence. Digest/OAuth manual precedence is now implemented and directly inspected. AWS IAM header signing is implemented and directly inspected (AWS-COMPATIBILITY.md); CodeCommit GIT remains a gap. Hawk SHA1/SHA256 is implemented with explicit legacy/actual/Postman modes (HAWK-COMPATIBILITY.md). ASAP legacy/Postman modes are implemented and directly inspected (ASAP-COMPATIBILITY.md). NTLMv2 with a guarded connection and TLS binding is implemented/directly inspected (NTLM-COMPATIBILITY.md); Type3 workstation/NTLMv1/proxy/provider edges remain. Netrc discovery/parser/per-destination Basic is implemented and directly inspected (NETRC-COMPATIBILITY.md). Next follow AUTH-INVENTORY.md for remaining compatibility. Device flow/revocation are extensions, not proof of legacy parity.

Interactive implementation handoff: Frontend resolveOAuth preserves authorizationUrl/redirectUrl/state/usePkce/pkceMethod/responseType; native OAuthConfig now includes the browser/callback fields and exchange_code reuses the token HTTP adapter. oauth_callback.rs owns the pure builder/validator/listener, oauth_browser.rs owns Tauri browser/Channel/manual-callback state. Keep browser waiting and token HTTP deadlines distinct, include auth waiting in workspace.running/completions, and never persist verifier/code or callback URLs to history. Imported custom redirect URLs and disabled/plain PKCE must remain visible and explicitly handled; avoid silently substituting a loopback redirect. A callback with wrong state/path, duplicate parameters or a stale request must not save a token.

Authorization Code milestone: Hyper provides bounded callbacks and cancellation. Implicit and optional legacy login-window interception are now implemented and directly inspected. Follow OAUTH-COMPATIBILITY.md for actual remaining legacy differences and real browser/provider acceptance.


## gRPC follow-up

Archived inventory and official sources are in GRPC-INVENTORY.md. Native core, legacy JSON, Svelte/proto management, method package grouping and sent-message tabs are implemented. BUILD.json records the last package, which predates the method/tab changes. Remaining steps: original reflection sample generation; native UI/IPC/picker/reload; JSON edge/shared-editor gaps in GRPC-COMPATIBILITY.md. Full gRPC parity remains incomplete.


ASAP ES512 follow-up: P-521 signing/editor/key formats implemented and89 native cases plus RFC6979 vector verified. The previous ES512 algorithm gap is resolved in code; provider/UI acceptance remains. See ASAP-COMPATIBILITY.md for current supported algorithms and key formats.

September28 checkpoint: reflection examples now use the bounded native generator; preserve local-default behavior and saved bodies.15 native cases and5 archived comparisons/independent wire decodes passed. Package completion is tracked in STATUS. Next work remains shared editor/template inventory, JSON edges and actual native acceptance; full migration is not complete.

## Shared editor foundation — 2026-09-28

Selected the original CodeMirror5 architecture after official manual/Svelte lifecycle/Bun add documentation. Ran bun add --exact codemirror@5.65.21, bun add --dev @types/codemirror, bun x --bun prettier --write on modified JS/Svelte, bun run check (0/0), bun run build (passed), and git diff --check.10 inline Bun mode/cache assertions passed. No saved test scripts/native changes. Wrapper is integrated into HTTP/gRPC bodies; source is not yet packaged. Continue with EDITOR-TEMPLATE-INVENTORY.md.

## Environment completion checkpoint — 2026-09-28

Added show-hint integration and editor-completion.js for inherited environment names in HTTP/gRPC bodies. Ctrl-Space and delayed interpolation suggestions support current dot/numeric/underscore-alias rendering syntax, avoid duplicate closing braces and replace whole partially typed names. Names only; bounded traversal avoids getter execution/cycles. Original Tab behavior preserved through CodeMirror.Pass. Bracket/quoted paths, tags/snippets/constants, Nunjucks runtime and GraphQL completion remain pending.

Read archived extensions/autocomplete.ts and official https://raw.githubusercontent.com/codemirror/codemirror5/master/addon/hint/show-hint.js plus the official manual before edits. No new packages. Ran bun x --bun prettier --write, bun run check (final0 errors/0 warnings), bun run build (passed), and15 inline Bun boundary/name/limit assertions. No saved test scripts. Actual popup/IME/lifecycle acceptance remains unverified; source is not packaged.

## GraphQL editor checkpoint — 2026-09-28

Read official https://raw.githubusercontent.com/graphql/graphiql/main/packages/codemirror-graphql/README.md and installed using bun add codemirror-graphql (2.2.9). Connected GraphQL query/JSON variables to the shared editor, schema-aware query completion and live lint, with environment hints and separate undo identities. Lint skips large/read-only/unrendered-template content; explicit rendered validation remains. Six direct language-service assertions passed; Svelte0/0 and frontend build passed. Initial markup/type diagnostics fixed. No saved test scripts/native changes. Type hover/navigation, variable-specific suggestions/lint, template integration and real WebView acceptance remain pending. Source is newer than the packaged BUILD.json.

GraphQL variables/navigation checkpoint: see STATUS.md for completed wiring and remaining hover/directive/mounted-editor work. Continue broader editor/template migration; source remains newer than installer.

GraphQL hover/directive browser/navigation implemented in source; WebView acceptance and full editor/template parity remain pending. Next shared-editor surfaces/settings/bundle split: see STATUS.md.

Shared editor surfaces/settings connected for response/environment/OpenAPI; bounds/save/readonly/diagnostic behavior retained in source. Runtime/layout verification and full editor/template parity remain open; next checkpoint in STATUS.md.

Final editor package: session37704 exited0 (Rust4m40s). All186 captured source paths/hashes matched fingerprint30cb52a7baa53a5adfc80565f9b13326282fe73d2d704be87aea7e9cb00eea6e. BUILD.json records exact EXE/NSIS hashes. Earlier31547 package was superseded by explicit Vim/lint disposal cleanup. Installer not run/published; no active operations. Real WebView/editor/IPC acceptance still pending.

## JSON formatter checkpoint — 2026-09-28

- Ported archived utils/prettify/json.ts to JavaScript using documented Bun.Transpiler({ loader: 'ts', target: 'browser' }).transformSync(source), then customized src/lib/json-prettify.js. Original attribution retained. No dependency or native changes.
- HTTP/gRPC Format now formats tokens without parsing numeric values or evaluating templates. Response/gRPC display validates JSON but formats the original string, preserving large integers, exponent spelling and negative zero. Non-JSON displays fall back to original data; copy/download behavior unchanged.
- Safe Unicode conversion occurs only inside quoted strings; control characters, quotes, backslashes and surrogate code units retain escapes. Matching template closing delimiters are required. Formatter is deliberately permissive like the archived implementation, not a JSON validator or template renderer.
- Bounds: 20 Mi UTF-16 code units for input/output, nesting 0..256, indentation up to16 spaces/tabs. Explicit Format reports errors and retains previous body; display catches errors and retains original text. This character bound is not a UTF-8 byte bound.
- All10 archived fixture pairs passed exactly, plus14 inline boundary/value-preservation assertions (24 total). No saved test scripts. bun run check:0 errors/0 warnings; bun run build passed; Prettier passed. Native WebView format/undo/display acceptance remains unverified.
- Source is newer than BUILD.json and the shared-editor installer; formatter is not yet packaged. No active processes. Next: response filter/history integration, XML formatting and remaining editor/template parity; full migration incomplete.

JSON response filter checkpoint: JSONPath worker, per-request imported/new metadata, Enter/clear/history/help implemented.34 inline assertions/worker checks; Svelte0/0. Native UI/CSP/reload and XPath/XML remain pending; source unpackaged. See latest STATUS.md for bounds and precision limitations.

XPath response filter implemented with xmldom/xpath inside disposable worker;14 compiled-worker checks and Svelte/build passed. XML prettification, native UI/CSP/reload and namespace mapping UI remain pending; see STATUS.md for strict-parser/timeout behavior. Source unpackaged.

XML preview formatter implemented with original vkbeautify plus content-preservation guard, inside worker.12 inline/helper/worker assertions and Svelte/build passed. Request XML Format and native UI acceptance remain pending; source unpackaged. Shell must explicitly be cmd.exe/login:false per updated owner rules. See STATUS.md.

## XML request Format checkpoint - 2026-09-28

- Added XML Format button for application/xml, text/xml and +xml request bodies. Uses dedicated xml-format.worker.js and existing content-preserving xmlPrettify. No dependency/native changes; existing layout retained.
- Worker terminates on reply/error/3-second deadline and effect teardown when request ID, text, MIME or tab changes or component unmounts. Callback independently compares current ID/text/MIME/tab before applying a result. Failures retain original body and display error. Pending button disabled. Exact mounted cancellation/Undo/persistence acceptance remains unverified.
- Read official Svelte effect lifecycle and Vite Web Worker docs before wiring. Svelte check0/0; frontend build passed (dedicated worker93.28kB). Five compiled-worker assertions passed for formatting, malformed/empty XML, mixed-text rejection and indentation. First assertion expected generic Error wording for empty XML, corrected to actual missing-root diagnostic and reran all five. No saved test scripts.
- CUA rechecked: apps=[]/browsers=[]. No active task processes; source newer than BUILD.json, no new installer. Next: remaining editor/template runtime parity and native UI acceptance/package. Full migration remains incomplete.

## Isolated Nunjucks engine foundation - 2026-09-28

- Researched original templating/index.ts and official Nunjucks API/templating, QuickJS embedding/runtime limits and CSP WebAssembly documentation. Selected actual Nunjucks inside QuickJS/WASM for compatibility without frontend JavaScript unsafe-eval. This is a foundation decision, not completed request rendering.
- Installed nunjucks3.2.4 and quickjs-emscripten0.32.0 via direct Bun add --ignore-scripts --exact. No lifecycle shell commands. Added template-runtime.js using documented getQuickJS/newContext/evalCode APIs. Fresh VM per render; JSON-only input; no host functions, module loader, filesystem/network/Tauri APIs exposed. Bounds:128MiB VM heap,512KiB stack,2-second interrupt,20Mi-character serialized input/output. All handles/context disposed.
- Preserves original autoescape:false, throwOnUndefined:true, root and underscore context aliases, all/variables/tags delimiter modes and debug identity filter. Uses original Nunjucks filters, expressions, loops/macros/comments rather than a handwritten syntax subset.
-10 inline Bun assertions passed (bracket/filters, loops, macros, comments, render modes, no autoescape, missing variable error, absent host APIs and infinite-loop interruption). Svelte check0/0 and frontend build passed. No saved test scripts.
- NOT integrated into application rendering yet: model.render remains unchanged. Browser WASM asset/loading/CSP, disposable worker/client, native built-in tag bridge, async request/environment rendering, cancellation/errors, template widgets and plugin compatibility remain required. Browser may need narrowly scoped wasm-unsafe-eval; current CSP has not changed. Nunjucks source parameter must remain trusted bundled code, never user-provided engine source.
- No active operations/new installer. Source newer than BUILD.json. Next: bundle production WASM with documented variant/loader, wire worker/client and verify actual browser acceptance; then bridge original tags and replace all render call sites with async pipeline. Full migration incomplete.

## Template worker and preview checkpoint - 2026-09-28

- Read official QuickJS packaging/newVariant wasmLocation docs and Vite URL/raw asset docs. Replaced aggregate quickjs-emscripten dependency with pinned quickjs-emscripten-core0.32.0 and @jitl/quickjs-wasmfile-release-sync0.32.0 using direct Bun add/remove --ignore-scripts. Only release-sync WASM is bundled.
- template.worker.js imports trusted Nunjucks dependency as raw text and explicit WASM asset URL. Runtime accepts the initialized engine as first argument. WASM initializes inside the request try/catch so startup failures become worker error messages. No host APIs are exposed to guest templates.
- template-client.js creates one worker per render, supports AbortSignal, terminates on response/error/abort/5-second outer deadline and removes timer/listener. TemplatePreview.svelte is collapsed by default below HTTP text-body editor; opening renders inherited environment, changing text/context/identity cancels old work and closing disposes it. Source body stays unchanged and output is read-only. Preview explains current Send/custom-tag limitation.
- CSP/devCsp add only wasm-unsafe-eval to script-src; JavaScript unsafe-eval remains absent. This config change is not yet packaged or verified in native WebView. Worker275.68kB and one WASM503.13kB emitted; no other QuickJS variants in build.
- Initial direct Bun execution of browser artifact failed because Bun worker lacks self.location. Then exercised the unmodified built worker using an in-memory wrapper simulating browser location and fetching WASM bytes from the actual built asset. Four asserted production-worker cases passed (loop/filter, missing variable, unsupported custom tag, failed WASM load). This is NOT actual browser/CSP acceptance. Fixed potential startup unhandled rejection by moving WASM initialization inside handler, then final Svelte0/0/build passed. No saved test scripts.
- Send/model.render remains unchanged. Full environment expansion, built-in/native async tags, all request/auth/protocol call sites, template widgets and plugin compatibility remain required. Next: original tag/async render orchestration and Send integration, plus real WebView preview/abort/asset/CSP acceptance when a surface is available. No active task processes/new installer; source newer than BUILD.json. Full migration incomplete.

## Worker-local built-in tags - 2026-09-28

- Inspected original BaseExtension parser/run contract, decodeEncoding and local-template-tags implementations. Inventoried remaining render() callers: transport.js (URL/headers/body/auth), graphql.js, grpc-model.js, oauth-model.js and workspace.svelte.js; Send remains on existing renderer.
- Added template-tags.js with base64, now, uuid, hash and jsonpath. Preserves Base64 normal/URL encode and permissive decode, b64::...::46b argument decoding, date-fns2.30 timestamp/custom formats and rounded Unix seconds, UUID v1/v4, four UI hash algorithms (MD5/SHA1/SHA256/SHA512) and hex/base64/latin1, first JSONPath result/error on no results. Additional OpenSSL hash names accepted by the legacy implementation are not yet covered.
- Added a narrow synchronous QuickJS bridge: tag name whitelist, JSON arguments, up to32 args/1000 calls/20Mi argument/result characters. Guest cannot access Buffer/crypto/date libraries or host functions directly beyond this bridge. Nunjucks parses tag arguments using its original signature parser; run modes preserved. Missing-variable arguments serialized as null remain an edge to align with original undefined/default semantics.
- JSONPath uses browser safe evaluator with4096 query length/10000 matches/20Mi cumulative result limit. Host tag work runs inside disposable worker; VM memory/time limits do not independently constrain host-library allocations/execution. Outer worker deadline remains required. Native tags (os/file/cookie/prompt/response/request), asynchronous tag bridge and widgets are still pending.
- Read official buffer, noble-hashes, uuid v9 README and date-fns v2 format source before using APIs. Bun add --ignore-scripts --exact buffer@6.0.3 date-fns@2.30.0 uuid@9.0.1. Existing @noble/hashes and JSONPath reused. No Node runtime or shell invocation.
-16 inline VM/tag assertions passed; one direct UUID-null guard check and one compiled-browser-worker tag check passed (18 total). Initial Svelte JSONPath return-type diagnostics fixed with runtime array narrowing; Svelte0/0/build passed (worker370.89kB, WASM503.13kB). Build precedes final UUID-null guard and comment-only correction; source remains unpackaged. No saved test scripts.
- Preview explains supported tags and remaining Send limitation. Native WebView/CSP/interaction acceptance remains unverified. No active processes/new installer. Next: asynchronous native tag bridge and environment/request render pipeline, then replace Send/auth/protocol callers without mutating stored request values. Full migration incomplete.

## Async template extension checkpoint — 2026-09-28

- Owner confirmed preserving the original Insomnium UI/layout. jirasync-hub-app remains a read-only architectural reference.
- Consulted official [Nunjucks async extension API](https://mozilla.github.io/nunjucks/api.html#asynchronous-extensions) and [QuickJS embedding/lifetime documentation](https://raw.githubusercontent.com/justjake/quickjs-emscripten/main/README.md), plus installed Nunjucks browser scheduler and archived BaseExtension, before implementation.
- template-runtime.js now uses CallExtensionAsync and callback-based rendering. Trusted application code may register async handlers; names are validated, capped at64 including built-ins, and cannot replace built-ins. Worker/client do not yet expose native handlers. No file/network/Tauri capabilities added to guest.
- Argument envelopes preserve top-level undefined versus null. Empty calls use the original __EMPTY_NUNJUCKS_ARG__ sentinel/filter: initial inline execution exposed Nunjucks's empty async argument compiler failure; matched archived parser and reran successfully.
- Bounded one-shot callback scheduling supports the browser ASAP timeout/interval fallback. These are scheduling shims, not general-purpose timer semantics (delay/repeating behavior not implemented). All retained guest callbacks/timers are disposed on success/failure/timeout; late extension resolution checks liveness before touching VM. Falsy Promise rejections retain failure status.
- Existing128MiB heap/512KiB stack/2-second wall-clock interrupt,20Mi-character bounds and1000 tag-call bound retained. Scheduler capped at1000 registrations; host completion deadline5seconds plus outer disposable worker deadline. Await time counts toward2seconds: interactive prompts need explicit future cancellation/time policy. Host extension work is not itself cancelled by VM disposal.
- Validation:16 inline async VM assertions,3 rejection/late-disposal assertions and3 compiled worker assertions passed (22 total); no saved test scripts. Production-worker checks simulate browser location/fetch in Bun, not native WebView/CSP acceptance. Initial14 JS annotation diagnostics fixed; final Svelte0 errors/0 warnings and Vite build passed. Worker373.15kB/WASM503.13kB.
- Commands launched directly with node_repl execFile(shell:false,windowsHide:true): Bun node_modules/prettier/bin/prettier.cjs --write src/lib/template-runtime.js; Bun node_modules/svelte-check/bin/svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings; Bun node_modules/vite/bin/vite.js build. Inline inspections used Bun -e. No shell, Node, npm, Python or new dependency executed/installed.
- Next: worker/main native-tag request/reply protocol with cancellation; implement original os/file/cookie/prompt/response/request semantics, decoded argument handling and request/environment orchestration; replace Send/auth/GraphQL/gRPC/WebSocket render call sites without mutating saved inputs. Native preview/IPC/CSP acceptance and full PARITY remain pending.
- No active task processes/new installer. Source is newer than BUILD.json; full migration remains IN PROGRESS.


## Native tag messaging checkpoint — 2026-09-28

- Read official [Worker.postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage) and [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) documentation before implementation. No generator or dependencies needed for these Web APIs.
- template-client.js now accepts application-owned handlers for os/file/cookie/prompt/response/request. Only registered names cross to template.worker.js; functions stay in the application. Message types render/tag/tag-result/result and per-render call IDs separate requests from final output. Worker accepts one render only; duplicate/late results are ignored.
- Client rejects unregistered/duplicate/invalid calls, caps1000 calls and32 arguments, JSON-normalizes handler results with20Mi-character bound, preserves errors including falsy rejections. Worker decodes original b64 argument encoding before invoking native handlers, while structured clone retains undefined/null arguments. Existing local tags remain available without handlers.
- Finishing, timeout or external AbortSignal terminates the disposable worker and aborts the handler signal. Late replies are ignored. Native handlers must actually observe this signal; terminating a worker does not independently cancel native operations. Current2-second VM wall-clock/5-second outer deadlines remain unsuitable for interactive prompt waiting until future policy work.
- Four initial JavaScript annotation diagnostics fixed. Final Svelte0 errors/0 warnings, frontend build passed (template worker373.96kB);14 inline assertions through actual compiled worker + source client passed, including async replies, encoded/missing/null args, native failure, nonserializable result, loop, preabort, pending abort, late completion and zero remaining workers. Bun wrapper simulates browser location/WASM fetch; real WebView/CSP/IPC remains unverified. No saved test scripts.
- Direct hidden execFile Bun commands: node_modules/prettier/bin/prettier.cjs --write src/lib/template.worker.js src/lib/template-client.js src/lib/template-tags.js; node_modules/svelte-check/bin/svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings; node_modules/vite/bin/vite.js build. Inline validation via Bun -e. No shell/Node/npm/Python.
- This implements the transport contract only: no native handler enabled in UI yet. Next implement original os/file/cookie/prompt/response/request handlers using existing native services and original semantics, connect preview context/purpose, then environment/request orchestration and Send callers. Keep original Insomnium UI. No new installer/active processes; source newer than BUILD.json. Full migration remains incomplete.


## Native file template tag checkpoint — 2026-09-28

- Added src-tauri/src/template.rs read_template_file command, registered in lib.rs/build.rs and main-window capability. Uses spawn_blocking and standard File/Read::take, ordinary-file metadata checks before/after open,20MiB byte cap including growth during read, and UTF-8 replacement decoding. Relative paths use native process cwd as legacy did; symlinks to regular files remain usable.
- Added template-native.js file handler and connected desktop TemplatePreview. Handler checks AbortSignal before and after invoke. Browser preview registers no file handler; original layout retained and support hint updated. No file chooser/tag widget yet.
- Cancellation drops late results but does NOT cancel an already running blocking OS read. Regular network-mounted files may outlive the preview deadline; special-file race and native resource concurrency policy need review before broader Send integration. Existing VM2-second wall time and worker5-second deadline remain. No request sending added.
- Consulted official Tauri commands/spawn_blocking, Rust Read::take and String::from_utf8_lossy docs before implementation: https://v2.tauri.app/develop/calling-rust/ ; https://docs.rs/tauri/latest/tauri/async_runtime/fn.spawn_blocking.html ; https://doc.rust-lang.org/std/io/trait.Read.html#method.take ; https://doc.rust-lang.org/std/string/struct.String.html#method.from_utf8_lossy . Compared archived file tag (fs.readFileSync(path,'utf8')).
- Validation: Svelte check0/0, Vite production build and cargo check --manifest-path src-tauri/Cargo.toml --locked passed. rustfmt --edition2021 src-tauri/src/template.rs passed. No new dependencies or saved test scripts. Actual file-byte behavior through native IPC/WebView, missing-file/directory/oversize interactions and preview cancellation remain unverified; compiler success is not runtime acceptance.
- Initial native launches failed because default Rustup home was unset, then MSVC linker was absent from process PATH. Fixed process-local environment using existing installs; no toolchain downloaded/configuration changed. node_repl has no process global, so selected ordinary environment variables were obtained through Bun before launching binaries.
- Repeat native commands via node_repl execFile(shell:false,windowsHide:true), executable D:/home/.cargo/bin/cargo.exe or rustfmt.exe. Set CARGO_HOME=D:/home/.cargo and RUSTUP_HOME=D:/home/.rustup. MSVC root: C:/Program Files (x86)/Microsoft Visual Studio/2017/BuildTools/VC/Tools/MSVC/14.16.27023. SDK root: C:/Program Files (x86)/Windows Kits/10, version10.0.19041.0. PATH adds MSVC bin/Hostx64/x64 and SDK bin/10.0.19041.0/x64. LIB adds MSVC lib/x64 and SDK Lib/10.0.19041.0/ucrt/x64 plus um/x64. INCLUDE adds MSVC include and SDK Include/10.0.19041.0/ucrt, shared, um. Do not invoke vcvars/cmd/PowerShell. Launch Bun directly for Prettier/Svelte/Vite as previous checkpoint.
- Next: remaining native tags (os/cookie/prompt/response/request), cancellation/time-budget policies and environment/request render pipeline, Send/auth/protocol integration, tag widgets and real native acceptance. Source newer than BUILD.json; no installer or live task processes. Full migration incomplete.


## Native cookie template tag checkpoint — 2026-09-28

- Implemented read_template_cookie in cookies.rs and registered its command/permission for main window. Uses existing collection CookieState/PersistentJar and CookieStore::matches for unexpired domain/path/HTTPOnly/Secure eligibility. Does not write cookies or send requests. HTTP/S URL required; URL20KiB/name8KiB limits.
- Prefers longer cookie paths like archived tough-cookie. Equal-path precedence uses native CookieDomain ordering; original creation timestamps are not retained. This is an explicit remaining parity gap; native outgoing Cookie header currently retains its existing ordering. Missing-cookie messages are simplified and do not list available names.
- template-native.js cookie handler uses application-owned request/workspace metadata, checks AbortSignal before/after invoke and preserves original null result without request/workspace metadata. RequestEditor passes workspaceFor(resources,request._id); TemplatePreview captures collection context and advertises desktop cookie support. Browser preview still registers no native handlers.
- Consulted official https://docs.rs/cookie_store/0.22.1/cookie_store/struct.CookieStore.html#method.matches and https://v2.tauri.app/develop/calling-rust/ before implementation; read archived cookie tag. Reused installed dependencies; no generator/new package needed.
- Cargo check --manifest-path src-tauri/Cargo.toml --locked passed; rustfmt applied cookies.rs. Initial frontend error identified incorrect workspaceFor argument/result shape; fixed to its actual ID contract. Final Svelte check0/0 and Vite build passed. No saved test scripts. Native cookie selection/IPC, collection switching, cancellation and mounted preview acceptance remain unverified; compile checks do not prove runtime parity.
- Direct node_repl hidden execFile commands with existing Rust/MSVC environment from prior checkpoint; Bun runs Prettier/Svelte/Vite. No shell/Node/npm/Python. No live task processes/new installer; source newer than BUILD.json.
- Next: os/prompt/response/request handlers, original creation-order cookie parity, interactive time/cancellation policy, recursive environment/request rendering and Send/auth/protocol callers, real native verification. Full migration incomplete.


## Request field template preview checkpoint — 2026-09-28

- Added template-request.js for original request name/folder/header/parameter attributes. Folder ancestry includes request_group/workspace and detects cycles. Header/parameter names and values render asynchronously in inherited environment; case-insensitive first match and inclusion of disabled rows follow archived request tag behavior. Unknown attributes return null. URL/cookie/OAuth reference attributes explicitly report pending migration.
- Added template-preview.js orchestration and connected TemplatePreview with a resource snapshot supplied by RequestEditor. Resources remain outside VM. Each nested field renders through the same worker/client and native handlers; branch field identifiers detect recursive references, depth12/total64 render limits bound work. AbortSignal propagates through nested workers. Request field preview also works in browser mode; native file/cookie remain desktop-only.
- Consulted https://mozilla.github.io/nunjucks/api.html#renderstring and https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted ; compared original request tag and current transport/OAuth contracts. No generator/new package needed.
-12 inline helper assertions passed (metadata/ancestry/case-insensitivity/disabled fields/missing values/unsupported attributes/no mutation);4 orchestration assertions passed through compiled workers with simulated browser location/WASM fetch (nested header→parameter→environment, recursion error, worker cleanup, preabort). Final Svelte0/0 and Vite build passed. No saved test scripts; actual mounted/native acceptance remains pending.
- Updated preview hint to accurately list partial request support. Send still uses existing variable-only renderer. Existing2-second VM wall time/5-second worker limits include child waits, so large valid reference trees may time out; shared engine/session and interactive policy need further work.
- Commands: direct hidden node_repl execFile Bun Prettier --write on four changed JS/Svelte files; Bun svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings; Bun Vite build. Inline checks via Bun -e. No native changes/new installer/live task processes.
- Next: request URL serialization and cookie/OAuth references, response/OS/prompt tags, recursive environment pipeline and Send integration, then native verification. Source newer than BUILD.json; full migration remains incomplete.


## Request URL/cookie reference checkpoint — 2026-09-28

- Ported original utils/url/querystring.ts and protocol.ts into JavaScript template-url.js using documented Bun.Transpiler({loader:'ts',target:'browser'}).transformSync first, then added JS annotations and explicit url/url.js browser-package import. Removed unused extraction/segment helpers via transpiler export elimination; original project attribution retained.
- Read https://bun.sh/docs/runtime/transpiler , https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent and upstream https://github.com/defunctzombie/node-url before porting. Raw README URL initially failed; upstream repository documentation succeeded. Installed bun add --ignore-scripts --exact url@0.11.4; it is bundled JavaScript, no Node runtime invoked.
- request tag URL now renders base URL and each parameter name/value through the recursive renderer, joins query before fragment, applies original default protocol/settingEncodeUrl and encoding semantics. Like the archived tag, includes disabled parameter rows, omits unnamed strict rows, and emits bare name for empty value. This differs from current Send preparation; transport URL unification remains required.
- request cookie uses the same rendered URL and native cookie handler with propagated signal; browser reports desktop requirement. OAuth references remain explicitly pending. UI hint updated.
-28 inline assertions passed:20 URL comparisons against archived implementation (encoding enabled/disabled, spaces, Unicode, percent escapes, duplicate/empty query, credentials, IPv6, fragments and empty input),3 query-builder comparisons,5 request URL/cookie routing checks. The original reference ran under Bun's URL compatibility API; its deprecation warning did not involve Node execution.
- Initial generated-JS annotation diagnostics resolved; a missing await-parenthesis in the editing command was corrected. Final Svelte0/0 and Vite build passed. No saved test scripts/native changes. Real WebView/IPC/URL-cookie lookup acceptance pending. New browser package is not assumed identical for every malformed URL; broader differential coverage required before shared Send use.
- Next: OAuth reference policy/context, response/OS/prompt tags, time/cancellation budgets, shared environment/request rendering and Send/auth/protocol integration. No new installer/live processes; source newer than BUILD.json. Full migration incomplete.


## Saved OAuth request references — 2026-09-28

- request tag now supports oauth2/oauth2-identity/oauth2-refresh through existing savedOAuthTokens lookup. Selects latest record belonging to request (obtainedAt/modified ordering), including imported records; accessToken must exist as in original tag, then returns requested field. Missing optional field remains undefined, empty remains empty, malformed non-text field reports an error.
- This is explicit reading of saved data, not Authorization selection: no expiry/context validation, refresh, network call or identity verification occurs, matching original single-record tag semantics. Current authorization binding/expiry rules remain unchanged. Multiple-record latest selection is migration-specific because original getByParentId assumed one record; documented in preview hint.
- Read archived o-auth-2-token.ts/getByParentId and local-template-tags.ts, current OAuth model and official https://mozilla.github.io/nunjucks/api.html#custom-tags before implementation. No dependency/generator needed.
-10 inline synthetic-record assertions passed: three fields, request isolation/latest ordering, imported+expired saved value, empty/undefined optional fields, missing access token, invalid type and no mutation. No real credentials used/output; no saved test scripts. Svelte0 errors/0 warnings and Vite build passed.
- Direct hidden node_repl execFile Bun Prettier, Svelte check, Vite build and inline Bun -e checks. No native changes/new installer/live processes; source newer than BUILD.json. Mounted/native preview and persistence acceptance still pending.
- Next: response/OS/prompt tags, interactive time/cancellation budgets, recursive environment rendering, shared request serialization and Send/auth/protocol integration. Full migration remains incomplete.


## Response history template preview — 2026-09-28

- Added template-response.js and response handler in preview orchestration. Supports saved URL, case-insensitive first header and raw body. Preview ignores resend arguments as original preview did; no dependent network calls occur. Body JSONPath/XPath explicitly remains pending.
- Found current HTTP history did not retain environment identity. New successful HTTP entries now record environmentId from the send's dataSnapshot (not current selection at completion). Preview selects latest matching request+environment HTTP record; unknown-environment older history is excluded with actionable resend message. Existing history is retained unchanged. validateData preserves the new field.
- Raw body decodes original bodyBase64 bytes using Content-Type charset via TextDecoder with UTF-8 fallback; bounded20MiB bytes/28Mi base64 text. Text-only history falls back to stored body with20Mi-character limit. TextDecoder encoding coverage/mappings are not assumed identical to original iconv-lite; further parity review pending.
- Read official https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder , https://github.com/JSONPath-Plus/JSONPath , https://github.com/goto100/xpath and inspected current response/history/filter structures before implementation. No new dependencies/generator required.
-16 inline assertions passed for URL/header/raw, Windows-1251/UTF8/unknown charset, text fallback, latest selection, environment isolation/base environment, unknown history, missing request/header, errors/status and streaming exclusion. Svelte0/0 and Vite build passed. No saved test scripts. New history environment attribution was inspected in source; native IPC/persistence/reload/selection interaction remains unverified.
- Direct hidden node_repl execFile Bun Prettier/Svelte/Vite and inline Bun -e. No native changes/new installer/live processes; source newer than BUILD.json.
- Next: response JSONPath/XPath extraction in disposable worker, then response resend behavior/requestChain in Send, OS/prompt tags, time/cancellation policy and shared recursive environment/request pipeline. Full migration incomplete.


## Response template body filters — 2026-09-28

- Added template-response-filter.js and kind:template branch in existing response-filter.worker.js. JSONPath reuses safe evaluator/match limits and returns single string unchanged, other single values as JSON, multiple matches as JSON array; no results error. Numeric parsing retains original JSON.parse precision limitations.
- XPath selects element/attribute/text; element returns serialized children, attribute value, text trimmed serialization. Rejects zero/multiple supported nodes. Scalar functions return text (fixes the archived branch's attempted array.filter on scalar). Strict XML parsing differs from original permissive recovery; malformed XML errors explicitly.
- template-response-filter-client.js gives each extraction a disposable worker,3-second deadline and AbortSignal cleanup. responseTemplatePreview decodes body then delegates body filter to worker; nested template cancellation propagates. Preview does not resend dependencies.
- Bounds:20Mi body/output characters,4096 query characters,10000 selected nodes/matches. XML selection cap is checked after evaluation; worker deadline remains needed, not a heap isolation guarantee. Parent VM2-second wall clock can still expire before worker3-second deadline; unified timing policy remains pending.
- Read upstream JSONPath-Plus, goto100/xpath and xmldom README/API docs before implementation: https://github.com/JSONPath-Plus/JSONPath ; https://github.com/goto100/xpath ; https://github.com/xmldom/xmldom . Existing dependencies reused.
-18 inline helper assertions plus6 compiled-worker/client assertions passed (24 total): JSON scalar/object/multiple/root/no results, XML inner content/attribute/text/scalar/multiple/malformed/limits, history integration, cancellation and worker cleanup. Final Svelte0/0 and Vite build passed. No saved test scripts. Bun workers exercise production artifact; actual WebView/CSP/native acceptance remains unverified.
- Commands: hidden direct node_repl execFile Bun Prettier on changed files, svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings, Vite build; inline assertions Bun -e. No native changes/new installer/live processes; source newer than BUILD.json.
- Next: OS/prompt tags, charset parity, shared render timing/cancellation and recursive environment/request orchestration; integrate response dependency resend/requestChain and all Send/auth/protocol call sites. Full migration incomplete.


## Prompt preview and cache lifecycle — 2026-09-28

- Added template-prompt.js with original title→MD5/requestId implicit key, explicit storage key, cached/default/saveLastValue behavior and application-supplied async ask callback contract. Session Map is memory-only, capped1000 entries/4Mi value characters; title/key4096 characters. No credentials persisted/logged.
- Preview handler never opens a prompt. Masked prompts return a placeholder (original tag editor disables masked preview); explicit/cached plaintext remains available for unmasked tags. Clear prompt values control clears cache and rerenders preview. Clear increments generation so already pending replies cannot repopulate cache; aborted replies are discarded.
- Interactive ask contract is implemented as a reusable helper but NOT connected to UI/Send. Caller must observe signal to close/settle an open dialog; current renderer deadlines still preclude normal interactive waiting. No claim of completed prompt/send parity or original plugin-store persistence.
- Read archived prompt run/disablePreview/cache logic and official Nunjucks custom tag / AbortSignal.throwIfAborted docs before implementation. Reused existing noble-hashes md5; no new dependency/generator.
-17 inline lifecycle assertions passed: defaults, implicit request scoping, explicit key reuse, masking, saveLastValue, empty value retention, clear, late-clear reply, aborted reply and title validation. Svelte0/0 and Vite build passed. No saved test scripts; mounted clear action and WebView preview remain unverified.
- Commands through hidden node_repl execFile: Bun Prettier, svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings, Vite build and inline Bun -e checks. No native changes/new installer/live processes; source newer than BUILD.json.
- Next: OS tags; render execution-vs-wait timing policy; interactive Svelte prompt dialog/queue/cancellation and send-session cache lifecycle; recursive environment/request pipeline and Send/auth/protocol integration with response dependencies. Full migration incomplete.


## Template execution and wait timing — 2026-09-28

- VM execution now accumulates elapsed time across evalCode and every retained callback via performance.now(), excluding asynchronous host waits. The aggregate execution budget remains 2 seconds; core and outer-worker wall deadlines remain 5 seconds. This measures time inside VM entry (including synchronous bridges), not OS CPU time. It does not yet support human-duration interactive prompts.
- Fixed callback handle JSDoc typing exposed by closure wrapping. Initial check had four implicit-any diagnostics; final Svelte check reports zero errors/warnings. One inline editing command failed on newline escaping before writing; corrected with a raw string.
- Nine inline assertions passed: ordinary render, 2.3-second asynchronous tag success, infinite guest-loop interruption and bound, never-resolving tag timeout, three successful renders after failure, and cumulative execution exhaustion across two asynchronous callbacks. No saved test scripts created. Vite production build passed; native WebView/CSP verification remains outstanding.
- Official references: https://github.com/justjake/quickjs-emscripten#runtime and https://developer.mozilla.org/en-US/docs/Web/API/Performance/now . No dependency or scaffold change.
- Commands: hidden node_repl execFile of Bun -e inline checks; Bun node_modules/prettier/bin/prettier.cjs --write src/lib/template-runtime.js; Bun node_modules/svelte-check/bin/svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings; Bun node_modules/vite/bin/vite.js build. All launches shell:false/windowsHide:true.
- Next: define explicit interactive waiting/cancellation policy, implement Svelte prompt dialog queue and connect send-session prompt cache lifecycle; OS tags; recursive environment/request render pipeline and Send/auth/protocol/dependent-response integration. Current Send still uses the old variable-only renderer. Full migration remains incomplete; no new Windows installer, source newer than BUILD.json.


## Native OS template tag — 2026-09-28

- Added native libuv provider for all seven archived OS functions (arch/cpus/freemem/hostname/platform/release/userInfo), main-window read_template_os command/permission, application handler and worker JSONPath formatting. CPU/user allocations use RAII; names are allowlisted and CPU count bounded. JSON property order and first-match/invalid-filter fallback preserve legacy behavior; JSONPath stays in the disposable worker.
- Installed libuv-sys2 1.53.0 via documented cargo add with skip-pkg-config. Bindgen requires Clang at build time: official LLVM20.1.8 DLL/headers extracted under ignored artifacts/tools/llvm-20.1.8; installer not executed, no system PATH change, release SHA-256 verified. Set child-process LIBCLANG_PATH=E:/insomnium/artifacts/tools/llvm-20.1.8/bin before future native builds. See OS-TEMPLATE.md for exact setup, references and compatibility boundaries.
- Verification: 22 inline format/parity assertions,8 compiled-worker assertions and2 limit assertions passed. Inline rustc-stdin probe exercised all7 actual Windows provider values and32 repeated reads without printing identities. Svelte0/0, Vite build, Cargo check, Cargo build --lib and Clippy --lib --locked -- -D warnings passed. Initial JSONPath typing diagnostics and one range lint fixed. No saved test scripts.
- Desktop preview is connected; Send remains on old variable-only renderer. Actual WebView/IPC/CSP and Linux/macOS acceptance are unverified. Abort discards a late native result but does not cancel OS work already running. No installer/commit/push; no live task processes; source newer than BUILD.json.
- Next: interactive wait/cancellation policy and Svelte prompt queue, send-session cache lifecycle, recursive environment/request rendering and Send/auth/protocol/dependent-response integration. Full migration remains incomplete.


## Prompt dialog and interactive renderer timing — 2026-09-28

- Added FIFO prompt service and mounted Svelte dialog using existing Insomnium modal styles. Supports title/label/default/text/password, active-ID protection, Cancel/Escape/abort/unmount/native-close cleanup and application shortcut suppression. promptTemplateTag defaults to the dialog service; previews remain noninteractive. Queue32/default-text4Mi/label-title4096 limits; no logging/persistence.
- Added explicit interactivePrompts policy: core/client five-second active budgets pause only on direct prompt waits, keeping remaining time across overlaps. Worker heartbeat1s/watchdog5s and total ten-minute cap preserve bounded waiting; VM execution2s/memory bounds remain. Cancel is propagated as AbortError and disposes the worker/other handlers. Details in PROMPT-TEMPLATE.md.
-36 inline assertions passed across queue/cache lifecycle, deadline accounting, compiled worker/client integration (including6.1s wait), watchdog/hard-cap cleanup and guest-loop/non-prompt bounds. Hard-cap timer was accelerated for verification. Svelte0/0 and Vite production build passed. No saved test scripts/new dependency/native changes.
- Actual Send is NOT connected. Nested request/response parent waits do not yet inherit child interaction pauses; resolve this in the shared send-render session. Send cache invalidation, recursive environments/fields, dependent sends and protocol/auth integration remain. CUA apps=[]/browsers=[]; actual dialog focus/Escape/WebView/CSP acceptance unverified.
- Official Svelte store/effect and MDN dialog/AbortSignal/worker/timing docs consulted first. All execution via hidden node_repl with Bun. No active task processes/new installer; source newer than BUILD.json. Full migration remains incomplete.
- Next: shared preview/send render session with interaction-wait propagation and cancellation, recursive environment/request fields, then all Send/auth/protocol call sites and dependent responses. See PROMPT-TEMPLATE.md for ordered steps.


## Shared request render session and nested interaction — 2026-09-28

- Added template-session.js createRequestRenderSession(context, options) with preview/send purpose, structured-cloned context/resources/history/metadata, owned AbortController, render(text, field?) and idempotent dispose. Preview now uses this session with automatic disposal. Each top-level field allows64 nested renders/depth12; session1000 renders/16 active workers. Any field failure cancels the session's other work. Send-purpose session has a ten-minute total cap, preserving TimeoutError on expiry.
- Added application-owned template-interaction.js. Actual ask callbacks acquire/release a reference-counted wait; only clients in that session subscribe. Parent/child client and core active deadlines receive shared wait transitions, including subscription during an existing wait. Every paused worker still emits heartbeats and keeps its own five-second watchdog, VM execution budget and hard deadline. Guest templates cannot publish wait notifications.
-19 inline assertions passed:10 compiled session cases (multi-level request/header/parameter prompt waiting6.1s, ancestor resume, snapshot isolation, dispose/late work, nested Cancel, noninteractive preview, cycle and external abort),7 interaction lifecycle/isolation cases and2 nested watchdog/session-timeout cases. Hard cap was accelerated for verification. Svelte0/0 and production Vite build passed. No saved test scripts/new dependency/native changes.
- One initial edit stopped because its expected runtime insertion marker did not match; only the new interaction helper had been written. Inspected the actual initialization block and completed the edit. No abandoned running processes.
- Actual Send remains unconnected. Recursive environment/field pipeline and dependent-response sends are still required. The new send-purpose session currently rejects response trigger modes always/no-history/when-expired explicitly; default/never reads saved responses. This is an integration gap, not a scope removal. Shared prompt timing for nested fields is fixed; dependent network waits still need their own integration.
- See PROMPT-TEMPLATE.md for current session ownership/timing contract. Official Nunjucks async API and MDN AbortController/Worker.postMessage/structuredClone docs consulted before edits. All launch/edit/check work used hidden node_repl and Bun. No new installer or live task processes; native WebView acceptance still unverified; source newer than BUILD.json. Full migration incomplete.
- Next: recursive environment/request-field rendering with field diagnostics, dependent-response send callback/chain/cache semantics, then wire Send/auth/GraphQL/gRPC/stream/OAuth pipelines with cancellation registered before render. Preserve shared-session ownership and existing watchdogs.


## Recursive render integration checkpoint — 2026-09-28

Environment/value helpers and preview integration implemented; actual Send pending. Follow ENVIRONMENT-RENDERING.md ordered next steps: request/cookieJar pipeline, dependent-response sends and timing/cache lifecycle, all protocol/auth/OAuth call sites, then real WebView verification. Keep environment parity PARTIAL until integration and acceptance pass.

## HTTP/initial stream Send checkpoint — 2026-09-29

Async request rendering and resolved OAuth are connected to execute(). Follow SEND-RENDERING.md for remaining dependent-send orchestration, other protocol/manual OAuth callers, native cookie/User-Agent and URL parity, then native acceptance. Full migration remains incomplete.

## Dependent response checkpoint — 2026-09-29

Same-collection finite HTTP response triggers are connected. Follow DEPENDENT-RESPONSES.md: implement per-collection environment retention/routing before foreign dependencies; retain trigger/chain/wait/cancellation contracts while integrating remaining protocol callers; native acceptance remains pending.
