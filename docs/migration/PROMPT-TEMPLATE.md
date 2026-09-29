# Interactive template prompts

Updated: 2026-09-28. Dialog/queue and direct renderer interaction are implemented. Actual Send integration is still pending.

## UI and lifecycle

TemplatePromptDialog.svelte is mounted once in the application page. It uses the existing modal, heading, input and action styles, title/label/default value, text/password input, focus/select and native modal behavior. All text is escaped by Svelte. It adds no preview-triggered prompts or new Send behavior.

template-prompt-dialog.js owns a FIFO queue and read-only Svelte store. Requests require an attached UI host. Only the active prompt ID can be answered; late answer/close events cannot affect a later prompt. Cancel, Escape, external AbortSignal, host unmount and native app close settle and remove pending entries. Global application shortcuts are disabled while a prompt is active. Queue defaults are limited to 32 requests / 4 Mi characters combined; labels/titles to4096 characters. Values are memory-only and are not logged. Empty text/password responses resolve normally; the archived empty-password submit could leave its callback unsettled.

promptTemplateTag now defaults its ask callback to this dialog service. Injected ask callbacks remain supported. Existing explicit/implicit cache behavior, generation-aware clear, masked preview and abort-before-cache checks remain in place. Preview never opens the dialog. Original send-session invalidation and plugin-store persistence are still pending.

## Timing policy

The application must opt into interactivePrompts:true when calling renderTemplate for an interactive flow. The option is not template-controlled. Default preview/noninteractive calls retain the five-second overall wait budget.

- VM execution retains the existing cumulative two-second elapsed budget while entering the VM,128MiB heap and512KiB stack.
- In interactive mode, client and core five-second active deadlines pause only while a direct prompt tag is pending. Pauses use remaining time and reference counting; completing one of several pending prompts cannot resume the clock early or reset the budget.
- While a prompt is pending, the worker sends a heartbeat once per second. The client terminates it after five seconds without a heartbeat. Host-library work that blocks the worker is therefore still bounded during interaction.
- Client and core additionally impose a ten-minute overall render limit, including all prompt/queue waiting. Completion/error/abort clears timers and terminates the worker. A cancelled prompt reaches the render caller as AbortError and aborts sibling application handlers.
- Cancellation discards late native responses; it does not forcefully cancel OS/file operations already running.

Shared sessions now propagate prompt waits across nested request-field renders; see the current session contract below. Dependent network sends still require integration. Background timer throttling/suspend behavior needs real WebView acceptance.

## Implementation references and commands

Official references read before implementation:

- https://svelte.dev/docs/svelte/stores
- https://svelte.dev/docs/svelte/$effect
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal
- https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted
- https://developer.mozilla.org/en-US/docs/Web/API/Performance/now
- https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage
- https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate

Read original ui/components/modals/prompt-modal.tsx and local-template-tags.ts under the archived source. Existing Svelte project/components were customized; no new subsystem generator or dependency was required.

Executed through hidden node_repl execFile with shell:false/windowsHide:true: Bun Prettier --write for changed JS/Svelte files; Bun node_modules/svelte-check/bin/svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings; Bun node_modules/vite/bin/vite.js build. Inline Bun -e assertions only; no saved test scripts, shell/Node/npm/Python execution or native source changes.

## Verification

36 inline assertions passed:

-20 queue/helper cases: unavailable host, FIFO, queued/active/pre-abort, empty response, stale events, count/character/label limits, cancel-all, default helper/UI hook, cache result, unmount and remount.
-4 active-deadline cases: paused time, overlapping pauses, remaining budget and disposal.
-8 compiled-worker/client/queue cases: prompt bridge,6.1-second human wait, answer/resume, external abort, opt-in requirement, missing heartbeat, ten-minute hard-cap cleanup (main timer accelerated to700ms for this check), recovery with no live workers.
-3 interactive isolation cases: non-prompt wait still expires, guest infinite loop still interrupts after prompt, repeated prompts resume correctly.
-1 user-Cancel case: AbortError reaches the caller, dialog queue clears and worker terminates.

Svelte check0 errors/0 warnings; Vite production build passed. The compiled-worker checks use Bun workers with simulated browser location/WASM loading. They do not prove DOM focus, Escape/native dialog events or WebView CSP behavior. CUA inventory was rechecked and returned apps=[]/browsers=[]; mounted visual/keyboard/native acceptance remains unverified. No new installer; source newer than BUILD.json.

## Shared request render sessions

createRequestRenderSession(context, options) in template-session.js owns a structured-cloned snapshot of context, resources, history and request/workspace/environment IDs. Options specify purpose preview/send and an AbortSignal; ask may be supplied by the application, defaulting to the mounted dialog service. Use await session.render(text, fieldName) for each field, then session.dispose() in finally. The returned signal represents the whole session. Do not pass Svelte proxies; take a state snapshot first, as the existing preview does.

Each top-level field is limited to64 recursive renders and depth12. The session allows1000 total renders and16 simultaneously active workers; the future field pipeline should sequence ordinary fields. A render failure, external abort or disposal cancels all remaining child work. Send-purpose sessions have a ten-minute total lifetime; expiry is exposed as TimeoutError rather than silently becoming a generic cancellation. Preview calls automatically dispose their session.

The interaction coordinator is private to the session. Only the application ask callback acquires a wait token. While any such token is held, all registered clients in that session pause their remaining active budgets and post boolean interaction notifications to their workers. The core subscribes before VM evaluation and immediately receives current wait state. Worker heartbeat state combines direct prompt waits and shared waits; a parent without its own prompt still has a watchdog while a descendant asks. Release tokens are idempotent and overlapping prompts cannot resume a parent prematurely. Different sessions do not share this state.

This replaces the previous nested-field timing limitation. It does not yet handle dependent network request execution or recursive environment values. Actual Send remains on the old renderer. The new send-purpose session explicitly rejects response trigger modes always/no-history/when-expired until dependent-send integration is implemented; default/never reads existing response snapshots. Preview behavior still ignores trigger modes and never sends.

Additional verification:19 assertions (10 compiled-worker session cases,7 coordinator lifecycle cases,2 nested timeout/watchdog cases) passed. Snapshots stayed unchanged after caller mutation; multi-level request/header/parameter parents survived6.1 seconds of prompt waiting and resumed; Cancel/error/timeout left no live workers or prompt entries. Timeout check accelerated the main session timer. Svelte0/0 and Vite build passed. No DOM/WebView acceptance is claimed.

References: https://mozilla.github.io/nunjucks/api.html#asynchronous-support , https://developer.mozilla.org/en-US/docs/Web/API/AbortController , https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage , https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone .

## Next steps in order

1. Shared preview/send session and nested field prompt propagation are implemented. Continue with recursive values and dependent network sends using the ownership/timing contract above.
2. Resolve recursive environment/request fields with cycle/budget limits and precise field errors. Integrate the async renderer across URL/query/header/body/auth and HTTP/GraphQL/gRPC/stream/OAuth call sites.
3. Register cancellation before rendering in Send, connect dependent-response sends with chain protection, and implement the original prompt-cache send-session lifecycle.
4. Verify actual WebView interaction/keyboard/cancellation and native workflows, then rebuild the installer. Continue all other PARITY items; this milestone does not complete migration.
