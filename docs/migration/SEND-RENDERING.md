# Send renderer integration

Updated: 2026-09-29. HTTP Send and initial SSE/WebSocket connection preparation now use the isolated async renderer. Full migration is incomplete.

## Implementation

- request-render.js renderSendRequest(data, request, signal) creates a send-purpose session from the snapshot's resources/history/environment layers and disposes it in finally immediately after request rendering. Network/OAuth cancellation remains owned by workspace.execute's existing controller. The running entry and completion handle are registered before any prompt or worker starts.
- workspace.svelte.js execute uses the rendered request for HTTP and initial SSE/WebSocket connection composition. It recalculates protocol after rendered headers are available, performs OAuth prevalidation, awaits OAuth if required, and calls prepareRenderedRequest with the resolved Authorization value. A signal check before dispatch prevents a cancelled renderer from launching a network request. Introspection remains on the previous pipeline; gRPC has separate callers and is not yet integrated.
- request-render.js preserves description KEEP, GraphQL comment workaround, body opt-out, disabled row/auth filtering and default protocol behavior described in the prior checkpoint. Unlike legacy's whitelist projection, migrated extra fields are retained. CookieJar can be rendered through renderRequestSnapshot, but current Send does not yet supply a native jar snapshot. suppressUserAgent is calculated but not consumed by Rust yet.
- oauth-model.js resolveOAuth, oauthContext, currentOAuthToken and oauthHeader accept an optional resolved flag. In this explicit application path, credentials and URLs are literal strings rather than templates. Existing callers keep their previous behavior; ordinary resolved credentials preserve existing token fingerprints.
- oauth.js prepareOAuthExchange accepts the same resolved option and composes its token request with prepareRenderedRequest. Manual Authorization still skips automatic token acquisition; explicit Fetch/Refresh still operates regardless of request headers. The existing grant, refresh, expiry, ID-token and token-prefix policies remain.
- oauthSourceContext hashes the raw request, active environment, settings and non-token resources. ensureOAuth compares that digest after a resolved exchange, instead of re-executing template tags or prompts. All token resources are excluded so other token updates do not invalidate the guard. This is intentionally conservative: unrelated resource/settings edits can discard a pending token. External file/OS values and prompt-cache changes are not re-read after the snapshot. The digest is used in memory; raw secrets are not logged or persisted by the guard.
- OAuth token records still bind to the resolved credentials/environment/recipient origin digest, separate from the source-change guard. Returned tokens are discarded if the caller cancels, deletes the request or changes source inputs during the exchange.

## Validation

27 inline assertions passed without saved test scripts:

-7 actual execute() lifecycle cases using Svelte compileModule, built disposable worker/WASM, and a Bun HTTP server bound to127.0.0.1: environment inheritance/tags reach the wire, response history environment and cleanup, literal body opt-out, running state before prompt, prompt answer reaches wire, Stop prevents dispatch, and field diagnostics prevent dispatch.
-12 compiled execute() cases with a mocked desktop IPC boundary: fetch then resource send, literal body/OAuth values, token storage and reuse, token-independent source guard, pending fetch, stale environment discard, cancellation discard, manual Authorization precedence, literal resolved config/exchange credentials and worker cleanup. These do not prove actual Rust IPC/provider/WebView behavior.
-8 pure compatibility cases: old/new ordinary OAuth config and token context equality, existing saved-token header/reuse, changed environment guard, explicit Fetch behavior with unrelated template headers in both modes, and NO_PREFIX.

Svelte check passed with0 errors/0 warnings; Vite production build passed. A missing fourth-argument-compatible conditional branch initially caused one compilation error; fixed by separating introspection and rendered transport calls. One command to construct an import failed quoting before any write; corrected. Initial inline Svelte module loading returned a Bun default export for the percent-encoded long data URL; base64 module import fixed the harness, after which all7 assertions passed. No saved tests, dependency install, native edits, installer or live fixture processes. No real user data was loaded/saved by the fixtures (workspace.ready=false); all worker counts returned to0.

Official sources read before implementation/validation:
- https://mozilla.github.io/nunjucks/api.html#asynchronous-support
- https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted
- https://svelte.dev/docs/svelte/svelte-compiler#compileModule
- Archived common/render.ts (request/environment pipeline) and current OAuth/transport lifecycle code.

Commands used hidden node_repl execFile with shell:false/windowsHide:true. Bun directly launched node_modules/prettier/bin/prettier.cjs --write, node_modules/svelte-check/bin/svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings, and node_modules/vite/bin/vite.js build. No Node/npm/yarn/Python runtime commands. Upstream build output suggests npm/node commands; those suggestions were not executed.

## Next actions

1. Same-collection finite HTTP dependent sends are implemented (DEPENDENT-RESPONSES.md). Complete per-collection environment routing, streaming dependencies and remaining history/UI/native acceptance; retain prompt/ref-count and worker watchdog guarantees.
2. Integrate renderer with GraphQL introspection/validation, manual OAuth Fetch/Refresh and saved-token adoption/display, gRPC discovery/call/message, and subsequent WebSocket payloads. The OAuth editor currently catches synchronous lookup errors but cannot determine the current token from arbitrary tags without a noninteractive preview policy; do not trigger a prompt from reactive UI rendering.
3. Connect native rendered cookie snapshot semantics and User-Agent suppression. Existing native collection cookies still function, but template-bearing cookie values are not yet supplied by this pipeline. Resolve native cancellation races and cookie-update ownership explicitly.
4. Reconcile URL/query encoding with archived smartEncodeUrl/request settings. Current prepareRenderedRequest uses the existing WHATWG URL transport composer. Preserve imported sendEmptyName/noValue/path parameters when resolving legacy differences.
5. Finish prompt cache lifecycle compatibility and native WebView/CSP/dialog/provider acceptance. Source is newer than BUILD.json. The installer has not been rebuilt for these changes.
