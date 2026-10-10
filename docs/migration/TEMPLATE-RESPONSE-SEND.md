# Mounted native response template Send

The separate saved `tests/ui/template-response-send.js` scenario exercises the existing response-tag Send pipeline through the actual mounted application, production template/response-filter workers and Rust HTTP transport. It preserves the existing UI and application source. Fixtures own two collections, seven requests, local servers and native-hidden probe lifetime.

```powershell
bun run check
bun tests/ui/template-response-send.js
```

Planned19groups: two actual source Sends; literal JSONPath string/multiple/falsy/empty values, XPath text/attribute/element-inner-content/scalar values; header/URL/raw fields; four refusals with no root dispatch/history mutation; six trigger behaviors (no-history first/reuse, expired/fresh, unknown, repeated always); nested chain wire order; foreign collection base environment routing without changing UI selection; root Stop disconnecting an actual held native dependency; stopped body-worker late callbacks preserving a subsequent manual request-body edit. Normal cases use real bundled workers. Only the final late-callback case uses the shared saved response-worker controller, with the real3s deadline unchanged.

Sources consulted: [Nunjucks asynchronous support](https://mozilla.github.io/nunjucks/api.html#asynchronous-support), [AbortSignal.throwIfAborted](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted). No subsystem generator is needed for an existing saved UI acceptance scenario.

First native21533/artifact1791611378363 terminal1 after17groups/41workers/20wire. The saved scenario mistakenly located `Stop`, while the actual mounted HTTP action is `Cancel`; the held dependency eventually reached its native request timeout while the locator waited. Native69748 exited0/native-hidden. Only scenario selectors were corrected after terminal; unchanged468application paths/production01515fc0 and refreshed703binding pass. Compiler8091 terminal0/0errors0warnings. Corrected full native82773/artifact1791611900475 is running; outcome remains pending.

Corrected full native82773/artifact1791611900475 terminal0 accepts19groups/43workers/20wire requests plus one held dependency. Native70584 exit0/native-hidden/visible:false. Independent source/build/literal body/base64/history/trigger order/foreign-base routing/actual socket cancellation/worker generation and before-deadline audit passes. Stopped worker late message/error/messageerror callbacks preserve the subsequent manual edit without root dispatch/history mutation. Compiler8091 terminal0/0errors0warnings and formatting pass. Both attempts' owned native/profile processes are absent, recorded in template-response-send-cleanup.json; no live feature handles remain.

`artifacts/playwright/template-response-send-source-freeze.json` binds468unchanged application paths/235scenario703paths to existing optimized production release01515fc0; prior234scenario paths unchanged, only the saved scenario is added. Audit command: `bun artifacts/template-response-send-audit.mjs artifacts/playwright/template-response-send-1791611900475`. Broad OAuth/provider/cycle/SSE/protocol/platform/accessibility, selected foreign environments, unbounded dependency behavior and every original migration/shared UI/UX/CSS gate remain required. This does not claim full response-tag or full migration parity.
