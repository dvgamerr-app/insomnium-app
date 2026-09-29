# GraphQL introspection render integration

Updated: 2026-09-29. Endpoint schema fetch now shares async Send rendering. Full GraphQL/migration parity remains incomplete.

## Behavior

- introspectionRequest replaces the user query/body with getIntrospectionQuery and IntrospectionQuery before rendering. User query/variables are never evaluated, including malformed user JSON. Existing separate POST behavior and GraphQL Accept header remain. The renderer resolves URL, headers, auth and environment/dependent response tags; finite HTTP is forced even when the normal request is configured as SSE.
- workspace.execute now scopes both ordinary and introspection sends to the request's collection and owns cancellation before rendering. Both use the response dependency adapter, resolved OAuth and literal transport composition. The original raw request remains the OAuth stale-source reference.
- prepareIntrospection supports explicit resolved inputs while retaining its synchronous compatibility entry point. It strips Accept/Content-Length and installs the schema Accept header after transport composition.
- schemaContext is now a SHA-256 source identity, not a template execution. It includes scoped selected environment, settings, resources and token records; replaces this request with its generated introspection body and ignores its modified timestamp. Query-only edits preserve schema; URL/auth/environment/token changes invalidate it. GraphqlEditor uses this same function, so opening/checking the cache cannot execute prompt/dependent templates.
- Context is computed using the original request snapshot plus acquired snapshot tokens before dispatch and compared against current source after completion. Late results after edits/Stop are discarded. Normal user response/history and body are unchanged; dependent request histories still update normally.
- Guard is deliberately conservative across resources/settings. Unrelated resource changes can invalidate schema; dynamic external files, time/random/prompt values and independently updated response history are not re-evaluated to validate a cache. Refetch explicitly for those changes. No schema is persisted by this cache.

## Sources read before implementation

- https://www.graphql-js.org/api-v16/utilities/ — getIntrospectionQuery/buildClientSchema/introspectionFromSchema.
- https://graphql.org/learn/introspection/
- Archive packages/insomnia/src/ui/components/editors/body/graph-ql-editor.tsx fetchGraphQLSchemaForRequest: generated schema body then Send-purpose interpolation and auth/network pipeline. Original archive stays read-only.

No initialization/new subsystem generator needed; existing GraphQL dependency and renderer reused.

## Evidence

39 inline Bun assertions passed, no saved test scripts:
-18 compiled Svelte/local HTTP GraphQL cases: async URL/environment, cross-collection dependent header, finite POST/Accept/generated query, no user-body prompts/mutation, normal response/history preservation, UI cache match, query-only edits, header prompt Cancel/answer, changed source, HTTP/GraphQL errors, pending-wire Stop and cleanup.
-7 mocked-native introspection OAuth cases: template client ID, invalid user query ignored, token Authorization, cache after acquisition, token reuse/invalidation and cleanup.
-14 existing native dependency/cross-collection OAuth regressions.

Commands via node_repl execFile(shell:false,windowsHide:true): Bun directly launches Prettier on graphql.js/workspace.svelte.js, svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings (0/0), vite build (passed); git diff --check passed with pre-existing CRLF notices. Initial edit command failed parsing due to duplicate variable declarations before any writes, then split and rerun. One fixture assertion incorrectly expected variables to be absent instead of an empty object; corrected and rerun.

No native edits/dependencies/new installer or real user data writes. Fixtures stopped and workers0. WebView/provider/CSP acceptance remains pending.

## Next work

GraphQL editor Validate now uses async preview rendering (see milestone below). Manual OAuth actions, gRPC discovery/send and subsequent WebSocket payloads still need full shared-renderer integration. Streaming dependency completion, native cookie/User-Agent/URL parity and full PARITY.md acceptance remain required.

## GraphQL Validate preview renderer — 2026-09-29

- resolveQuery is now asynchronous, resolves only the GraphQL body with the shared preview session/environment layers, honors body-render opt-out and normalizes string/object variables. Does not evaluate unrelated URL/auth fields, acquire OAuth, open prompts or resend dependent requests; response tags read saved history.
- GraphqlEditor owns an AbortController/revision for Validate, displays pending state, suppresses stale results and disposes on body/context/history/schema change or unmount. Existing query/schema diagnostics remain.
-39 inline assertions passed:12 real-worker preview cases,9 compiled lifecycle cases extracted from the actual component block,18 introspection regressions. Svelte0/0, Vite production build and git diff --check passed. No saved tests/dependencies/native changes/installer; fixtures stopped/workers0.
- Sources read: https://svelte.dev/docs/svelte/$effect and https://www.graphql-js.org/api-v16/validation/ . Existing renderer reused; no initialization needed. Commands: Bun directly launches Prettier, svelte-check with existing flags, Vite build; git diff --check. Hidden node_repl launch rules retained.
- Probe corrections: schema-error fixture initially bypassed normalization and lacked variables; corrected to run resolveQuery first. Lifecycle probe had a string newline syntax error and an import rejected by the Svelte compiler; corrected to public Svelte import before compiling. Final probes passed.
- Full component DOM/WebView interaction still requires acceptance; extracted lifecycle verification is not a rendered UI test. Existing schema cache conservative/dynamic-source limitations remain. Next: manual OAuth Fetch/Refresh and gRPC/WS payload shared rendering, streaming dependency completion, native transport parity and full PARITY acceptance. Full migration incomplete.

