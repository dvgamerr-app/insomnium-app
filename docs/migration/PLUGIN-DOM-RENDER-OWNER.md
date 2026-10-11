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

Nested response-tag short-signal lifetimes, WebSocket/SSE terminal lifetimes and ordered guest `onHide` before Abort/unload revocation remain open. Full DOM/live collections/property handlers/event cancellation, generic HTML/private modules, clipboard restoration, provider/platform parity and every other migration requirement still precede the deferred shared-input UX/UI/CSS phase.

## Native HTTP/gRPC completion accepted — 2026-10-12

Fresh release executable `artifacts/native-plugin-dom-owner-probe/insomnium-plugin-dom-owner-probe.exe`, SHA256 `427cf71314428028e13129017aaa76f01fa1eebc8cfea4c41cec792d845bb8de`, uses isolated identifier `app.insomnium.probe.checkout20260929`. Builder68952 exited0; Cargo release compilation took6m51s. Both native runs hid their owned host before CDP and exited0. The saved combined acceptance passes41checks/14terminated production plugin workers/68real HTTP requests plus WebSocket, nine gRPC calls and v1 reflection.

The new reusable native helper verifies two genuine retained event callbacks after each completed HTTP/gRPC Send. They render the captured `scope` environment, reload the real saved request model and send child HTTP through native IPC, with ExtraRenderInfo/raw body/response buffer and guest `this`/event target identity assertions. Six callback child requests pass. A later gRPC unary reads `1:true` from the genuine detached guest onHide state; HTTP reads its fresh VM baseline and then exactly one/two detached hides across repeated Send, without plugin Load.

Retained `util.render` now starts its nested session from the already resolved context without rebuilding environment layers. This preserves the same behavior as ordinary field helpers and prevents same-plugin environment tags from reentering their VM. The saved browser workspace fixture now includes such an environment tag; it passes, along with the helper-renderer regression. Compiler5669/75361 exited0 with zero errors/warnings.

Commands and evidence:

- `bun artifacts/prepare-plugin-dom-owner-probe.mjs`, `bun artifacts/build-plugin-dom-owner-probe.mjs` and `bun artifacts/freeze-plugin-dom-owner-frontend.mjs` preserve677local app/backend/UI/script/config/lock files plus49complete frontend/generated-Buffer snapshots. Vendor/transitive dependencies outside these snapshots are not claimed.
- `bun artifacts/run-plugin-dom-owner.mjs`: successful scenario `artifacts/playwright/plugin-template-tags-1791738747567`, restoration `artifacts/playwright/plugin-dom-owner-restoration-1791738747021`.
- `bun artifacts/audit-plugin-dom-owner-native.mjs artifacts/playwright/plugin-template-tags-1791738747567 artifacts/playwright/plugin-dom-owner-restoration-1791738747021` passes original/current source hashes, frontend/generated bytes, both worker hashes, native-hidden/visible:false/exit0, six retained native callback requests, normal guest onHide and retained protocol/OAuth/cookie/info controls. Both original workspace buffers are byte-identical after exit; original store and all653original cookie files are unchanged; the owned new jar is removed.

The first native run59454 failed a harness counter assertion: OAuth Cancel recovery replaced the plugin VM between gRPC and HTTP, so the earlier hide count was no longer applicable. Product callbacks had worked. Negative scenario1791738572745/restoration1791738572140 are retained and restoration passes. Three exact saved harness variants separately preserve the correction: HTTP reads the current VM baseline; gRPC reads onHide before VM replacement. `harness-variant.json` and both old/new harness byte snapshots distinguish this from a product/executable change. Second run1881 passed; no rebuild or product mutation occurred after the original native source freeze. Independent audit initially used an absent OAuth control field; corrected to the actual recorded cancellation/preservation and settled-preview controls, then passed.

This topic records native acceptance and its saved fixture/regression. Core runtime/session/registry/template/workspace/helper/Buffer/native dependency assembly and the main combined scenario assembly remain uncommitted. Native acceptance binds that exact working assembly; it does not claim complete clean-HEAD activation or full migration. No native clipboard operation was performed. Next is the complete integration/dependency commit, followed by the remaining dialog/provider/platform gates above and all original migration requirements before UX/UI/CSS.
