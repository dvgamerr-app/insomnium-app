# Plugin dialog ownership after rendering and Send

The working integration gives a dialog a separate host controller, helper dispatcher and interaction lifetime. It binds once to the exact admitted plugin VM and captured request/environment source. Successful field-render disposal releases short rendering work without releasing an active dialog. Normal Close waits for the genuine detached guest `onHide` before releasing the owner; idle owners are released immediately.

`plugin-request-lifetime.js` records explicit host completion by exact signal identity. Ordinary listeners still receive Abort during cleanup. Retained UI may survive that completion, but an already cancelled signal cannot be promoted, even when its reason says “Request completed”. Derived signals retain their parent authority; completing a child does not let it escape a later parent cancellation. Host owner factories capture their options instead of consulting a mutable caller DTO.

The working workspace integration marks completed HTTP/gRPC work explicitly and permits its retained helper services to use the captured owner after the running entry is removed. It checks the original workspace identity, collection and request/environment source before granting this continuation. Nested service owners keep that guard. Failed/cancelled operations retain ordinary revocation. The application route mounts the real plugin dialog host.

Documentation consulted before implementation: [AbortController.abort](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort) and [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). Abort is terminal for ordinary operations; completion authority here is a host lifecycle policy, not a browser API feature. No generator is required for this JavaScript module.

## Verified current working integration

- `bun run check`: zero errors/warnings; `bun run build`: exit 0.
- `bun tests/ui/plugin-dom-render-owner.js`: eleven headless groups, three genuine production plugin workers and fifteen template workers, all terminated. Actual registry admission, render-session disposal, retained guest click/`util.render`, Close/guest `onHide`, fresh Send, request-source loss, Abort, parent revocation, preview, field failure, unload/reload and disposal pass.
- The same saved scenario invokes actual workspace `execute`, request rendering, browser HTTP transport and persistence: response 200 and no running entry, followed by a new successful guest helper callback. A later actual workspace request edit rejects the old helper authority and retires its VM/dialog.
- Saved callback-session, guest DOM, async app dialog and helper-renderer regressions pass. `bun artifacts/audit-plugin-dom-render-owner.mjs` verifies 610 exact current/local source and frontend-build snapshots, five preserved result hashes and both production worker hashes. Evidence lives in `artifacts/playwright/plugin-dom-render-owner/{source-manifest.json,accepted,sources}`.
- Initial full-workspace scenario failed because its fixture omitted the environment variable read by the guest callback. Adding the real base-environment resource made that scenario pass; no product fallback was added.

## Commit and remaining gates

This topic commits the lifetime/owner foundations, owned DOM close hooks, route host and saved acceptance/documentation. Broader runtime/session/registry/template/provider/workspace/helper/Buffer dependency assembly remains uncommitted in the shared working tree. This topic alone does not activate the complete feature from clean HEAD; acceptance above binds the exact current assembly, not just committed files.

Fresh native HTTP/gRPC Send acceptance remains required. Browser transport evidence does not prove native IPC or gRPC. Nested response-tag short-signal lifetimes, WebSocket/SSE terminal lifetimes and ordered guest `onHide` before Abort/unload revocation remain open. Full DOM/live collections/property handlers/event cancellation, generic HTML/private modules, clipboard restoration, provider/platform parity and every other migration requirement still precede the deferred shared-input UX/UI/CSS phase.
