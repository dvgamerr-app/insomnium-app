# Dependent response requests

Updated: 2026-09-29. Same- and cross-collection finite HTTP dependencies are connected to HTTP/initial-stream Send. Full migration and response-tag parity remain incomplete.

## Legacy evidence and implementation

Read archived ui/components/templating/local-template-tags.ts response.run (around lines565-700), plugins/context/network.ts and network/network.ts fetchRequestData. Official sources consulted before implementation:

- https://mozilla.github.io/nunjucks/api.html#asynchronous-support
- https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static

The original uses environment-scoped latest history, then optionally sends before extracting the requested field. Trigger semantics retained:

- never/unknown string: read history only.
- no-history: send only when no response exists. A failed response still counts as history.
- when-expired: send when history is absent or ageSeconds > maxAgeSeconds (strict comparison, original numeric coercion). An omitted age does not expire an existing response; the legacy UI supplies60 as its default.
- always: send unless the requested ID is already in the current request chain.
- Truthy non-string trigger values fail. Preview never invokes the network callback regardless of trigger mode.

Root calls have independent initially empty chains, matching the inspected original. A child receives and shares its parent's mutable array; IDs are appended before send and never popped. If an ID is already present, use existing history; without history this fails instead of recursing. This also allows the archived root re-entry behavior: A→B→A can send an inner A once, then B's next occurrence reads history. Repeated root always tags are not globally deduplicated or memoized.

Files:

- template-response.js now separates reference validation, environment-scoped latest-response lookup and field extraction. Preview uses the same helpers. Existing body decoding/filter-worker bounds remain.
- template-response-send.js createResponseTemplateResolver snapshots resources/history/environment and tracks freshly received responses. Child sends receive a cloned source request, shared chain and AbortSignal. Incoming response identity/environment is checked; cancelled late results are not cached. Bounds are32 sends per root resolver,32 chain entries and40Mi serialized characters retained for newly received latest responses (in addition to the initial snapshot). These are explicit runtime limits, not proof of unbounded legacy parity.
- template-session.js accepts an application-owned responseResolver only for send purpose. Its awaited callback acquires/releases the existing reference-counted host-wait coordinator. This pauses ancestor active wall deadlines while preserving worker heartbeats, five-second watchdogs, VM execution limits and ten-minute session/hard limits. Guest code cannot publish wait notifications. Without an adapter, resend modes still reject explicitly; previews always read their saved snapshot.
- request-render.js forwards the resolver into its owned render session.
- workspace.svelte.js creates one resolver per root execute and recursively renders/sends dependencies through sendDependentRequest. Each dependency gets a unique native ID and an abort listener that calls cancel_http for that ID. Root Stop/timeout propagates through waiting workers to child rendering, OAuth and network dispatch. Dependencies use resolved OAuth, source-change guards and the same transport composer. Results update local response/history when the resource still exists; an independent currently running request's response pane is not overwritten. OAuth progress can be routed while the root owner is active, and only matching dependency progress is cleared.

## Verified evidence

38 inline assertions passed; no saved test scripts:
-17 policy/resolver cases: history and environment rules, strict expiry/omitted age, never/unknown modes, repeated always, mutable child chain, freshly received response reuse, preview non-send, cycles with/without history, abort/late result, identity mismatch, send cap and failed-history behavior.
-9 compiled Svelte execute cases through a real local Bun HTTP server and built workers: nested C→B→root wire sequence, JSONPath/header filtering, history and body values, no-history reuse, repeated root always behavior, network wait6.1seconds, held dependency, Stop preventing root send, and a child prompt answer reaching the wire. The fixture adapter loads both built template and response-filter workers.
-6 compiled execute/mocked-native cases: dependent OAuth acquisition, credential storage/header, token reuse, pending native send, both root and child cancel IDs, and worker/run cleanup.
-2 compiled mocked-native cycle cases: A→B→A retains archived history fallback/send order and cleans up.
-2 timing cases: accelerated ten-minute total cap cancels the dependent native request; dropping heartbeat notifications triggers the five-second watchdog during a network wait.
-1 malformed non-string trigger case.
-1 cross-collection guard case proves no dispatch occurs while routing is unsupported.

Svelte check0 errors/0 warnings and Vite production build passed. A search initially used an unescaped parenthesis and was corrected. One compilation diagnostic required an explicit missing-request guard after array lookup; corrected. Fixtures stopped, worker counts0. No dependency install, Rust changes, installer, commit, publication or real-user-state writes. All executions hidden node_repl execFile(shell:false,windowsHide:true); filesystem/scripts/tooling through Bun. Commands: Bun directly ran Prettier on changed JS, svelte-check with --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings, and vite build; git diff --check reported no whitespace errors.

## Remaining parity / next steps

1. Cross-collection finite HTTP routing is now implemented. selectedEnvironmentFor/requestDataScope selects target metadata, while response history lookup stays in the caller environment. Real WebView acceptance remains pending.
2. SSE-labelled HTTP dependencies now await completed raw HTTP responses under native timeout/body bounds; see the SSE completion checkpoint below. Live SSE history remains outstanding; browser-preview body bounds are implemented in the later checkpoint below.
3. The graph reads its initial history snapshot plus its own new responses; independently arriving UI history is not reread. Per-request dependent-run UI/cancellation controls, simultaneous OAuth progress for the same child, failed-dependency history/timeline and native cancellation registration races still need acceptance/reconciliation. Root cancellation and child native IDs are verified at the mocked boundary, not actual WebView/Rust/provider acceptance.
4. Preserve the callback/chain/wait contracts when integrating GraphQL introspection, manual OAuth actions, gRPC and subsequent WebSocket payloads. Native cookie snapshot/User-Agent and URL encoding parity remain separate outstanding work.
5. Source is newer than BUILD.json. No installer was rebuilt; no full migration completion claim.

## Cross-collection dependent HTTP routing — 2026-09-29

- Added request-scope.js: each send gets its collection's selected environment while resource replacements remain shared through accessor-backed snapshot views. Root/child OAuth records survive nested sends; active UI selection is not changed.
- Resolver history/new-response cache is keyed by request and caller environment. Sends validate/cache the target environment and return that immediate response. Thus foreign no-history may resend even when target-environment history exists; this preserves inspected original caller-versus-target semantics.
- Connected scoped routing in workspace.execute/sendDependentRequest and removed the temporary cross-collection guard. Source guards compare the current request's collection selection. Existing conservative all-resource/settings guard remains; unrelated edits can still discard a pending token.
- Fixed dependent manual OAuth callback authorization: progress carries its root owner; callbacks require the matching live non-aborted owner, and late/cancelled callbacks fail.
  -61 inline assertions passed:34 existing resolver/native OAuth/cycle/local HTTP regressions,7 three-collection local HTTP cases,8 foreign OAuth/shared tokens/source-change cases,7 manual callback/cancellation cases,5 scoped resolver/identity checks. Svelte0/0, Vite build and git diff --check passed. One JSDoc mismatch was corrected after the compiler identified it.
- No saved test scripts, dependency/native changes, real user data writes or installer. Fixture servers stopped, workers0. Real WebView/provider/native cancellation acceptance remains pending.
- Next: finite completion semantics for streaming dependencies and integration of introspection/manual OAuth/gRPC/WS payload renderers; native cookie/User-Agent/URL handling and full PARITY acceptance. Source newer than BUILD.json; full migration incomplete.

Official sources consulted before these edits:

- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty
- https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted
- https://v2.tauri.app/develop/calling-rust/#channels

Validation commands unchanged: Bun directly launches Prettier, svelte-check and Vite; inline Bun probes use compiled Svelte modules, built workers, local HTTP and mocked native IPC. git diff --check passes. No generator is needed for these existing-subsystem edits.

## SSE response dependency completion — 2026-09-29

- Inspected archived response.run and plugins/context/network.ts: response tags await the complete HTTP response before extracting any field, including headers. Raw returns complete SSE framing; it does not select the first event. WebSocket/gRPC resources are not response-tag targets in that legacy path.
- Removed the SSE rejection in sendDependentRequest. SSE-labelled HTTP requests now use the existing ordinary send path, preserving Accept: text/event-stream, raw body and Base64. They do not open a live stream pane. Native send_http already reads chunks with a 20 MiB bound, timeout and cancellation; an endless stream must fail or be stopped, with no partial success.
- 8 inline assertions passed against compiled workspace/Svelte, real local Bun HTTP and built workers: completed SSE dependency, raw framing/Base64, Accept header, ordinary history shape, header waits for EOF, EOF releases root, Stop prevents root dispatch, and timeout cleans workers. Workers0, server stopped, no real-user-state writes. The fixture initially collided with a variable name; its rename also changed the raw tag argument, then both fixture errors were corrected and rerun successfully.
- Svelte check0 errors/0 warnings and production Vite build passed. No saved test scripts, native edits, new dependencies or installer. Source remains newer than BUILD.json.
- Native size/cancellation behavior was inspected, not exercised in a real WebView/native wire run here. Browser-preview transport still reads arrayBuffer without the native 20 MiB accumulation bound; this is an outstanding transport discrepancy. Existing live SSE history (event log) versus completed raw HTTP history also needs reconciliation.
- Official docs consulted before implementation: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events and https://docs.rs/reqwest/latest/reqwest/struct.Response.html#method.chunk . Existing subsystem reused; no generator needed. Commands: Bun directly launches Prettier, svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings and vite build; git diff --check. Hidden node_repl execFile shell:false/windowsHide:true retained.
- Next: reconcile live SSE history and preview response bounds, WebSocket connect-and-send, native cookie/User-Agent/URL parity, then full runtime/UI/platform/packaging acceptance and remaining PARITY rows. Full migration remains incomplete.

## Browser-preview response bound — 2026-09-29

- Fixed transport.js preview send: replaced unbounded response.arrayBuffer with a ReadableStream reader. Count actual received bytes, grow a byte buffer up to20 MiB, accept exactly the limit and reject the first excess chunk with the native send_http error. Content-Length is not trusted. No partial successful response is returned.
- Fetch and body reads share the combined user/timeout signal. Check cancellation before/after reads, cancel the reader on failure without delaying the original error, and release its lock in finally. Empty responses and exact binary Base64 remain supported. Desktop invocation is unchanged.
- 15 inline assertions passed:7 direct local HTTP transport cases (binary,204,exact20 MiB,limit+1,body timeout,body abort,pre-abort) and8 compiled SSE-dependency regressions. Fixture servers stopped and template workers0. No saved test scripts or real-user-state writes.
- Svelte check0 errors/0 warnings, Vite production build and git diff --check passed. Bun launched Prettier, svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings and vite build through hidden node_repl execFile. No native changes/dependency installation/new installer; source newer than BUILD.json.
- Consulted official docs before editing: https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/getReader and https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultReader/cancel . Reused existing subsystem; no generator needed.
- The body limit is now enforced in preview as well as the inspected native implementation. Browser CORS/header/redirect restrictions remain distinct; Bun fetch checks do not establish real WebView acceptance. Next: live SSE raw history reconciliation, WebSocket automatic connect-and-send, native cookie/User-Agent/URL parity, then full runtime/UI/platform/packaging and remaining PARITY work. Full migration incomplete.
