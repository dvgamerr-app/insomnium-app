# Legacy plugin compatibility inventory

Retained callback core now executes seven contribution kinds in owned isolated sessions with all six durable context.store methods. Production9e3c459d native/restart and retained regressions pass independent audits. This is a callable core with a required live-owner guard; product registries/Send hooks/action menus/themes, full argument/value encoding beyond JSON-only, admission/disable/reload ownership and other context adapters remain required. [PLUGIN-SESSION.md](PLUGIN-SESSION.md).

2026-10-10 inventory from the read-only archive and current source. This is an implementation inventory, not completed custom-plugin parity. No archive files or installed user plugins are changed.

The first admission milestones now have covered Windows native acceptance: read-only package metadata/Preferences status reporting, persistent custom paths/explicit legacy import/actual restart, bounded entry normalization/file-index-fallback lookup, nearest-scope format and isolated CJS/ESM export inspection. See [PLUGIN-DISCOVERY.md](PLUGIN-DISCOVERY.md), [PLUGIN-FOLDERS.md](PLUGIN-FOLDERS.md), [PLUGIN-ENTRIES.md](PLUGIN-ENTRIES.md), [PLUGIN-FORMATS.md](PLUGIN-FORMATS.md) and [PLUGIN-RUNTIME.md](PLUGIN-RUNTIME.md). All eight contribution arrays have metadata inspection; their activation, complete module admission/lifecycle, duplicate-winner policy, package installation and the six custom context namespaces remain required.

The archived `packages/insomnia/src/plugins/index.ts` loads directories with package.json containing an `insomnia` field, traverses scoped package directories, clears CommonJS require caches and evaluates the module through global.require. Settings supports install/reload/disable/configuration. The archived installer uses Electron/child_process and a package-manager flow; those mechanisms cannot be copied into the Bun-only Tauri runtime.

| Legacy contribution | Current implementation | Required continuation |
| --- | --- | --- |
| templateTags | Bundled base64/now/uuid/hash/jsonpath and application-owned OS/file/cookie/prompt/request/response bridges | Custom package discovery, registration, declared tag argument metadata, collision policy, reload/disable and error reporting |
| requestHooks | Legacy built-in DEFAULT_HEADERS now has covered native Send acceptance in shared preparation | Custom ordered hooks with explicit request/context mutation and cancellation before transport |
| responseHooks | No custom hook dispatcher | Ordered response transforms and original-byte/history policy |
| themes | Owner-directed shared Nocturne dark/light system | Explicit theme compatibility handling; arbitrary legacy plugin themes are not silently applied |
| requestGroupActions | No custom action registry/UI | Group/request snapshot context, explicit actions and stale-owner checks |
| requestActions | No custom action registry/UI | HTTP/WebSocket/gRPC action routing and explicit mutations |
| workspaceActions | No custom action registry/UI | Collection-owned action context and persistence ownership |
| documentActions | No custom action registry/UI | API document context, parsed source and hideAfterClick behavior |

The six archived context namespaces are independent requirements:

| Context | Source and contract | Current boundary |
| --- | --- | --- |
| app | context/app.tsx: alert/dialog/prompt, getPath/getInfo, Save dialog, clipboard, deprecated generic modal and private renderer-module/axios bridges | Built-in prompt/native APIs exist; no custom plugin context; Electron/React/Node access cannot silently leak into the renderer |
| data | context/dataInit.ts: URI/raw import and collection/ HAR export, active-project ownership | Product import/export exists; no custom context adapter |
| network | context/network.ts: sendRequest uses target environment, rendering, request hooks, transport, response hooks and saved history | Owned dependent sender exists; no general plugin network adapter |
| request | context/request.ts: ID/name/URL/method/environment, cookie/settings/header/parameter/authentication/body/text access and mutations, readOnly behavior | Detached Send snapshots exist; no plugin facade |
| response | context/response.ts: request ID/status/message/bytes/time/body/body stream/headers and body replacement | Product response tools exist; no plugin facade or Node Buffer/stream compatibility |
| store | context/store.ts and models/plugin-data.ts: plugin-scoped hasItem/setItem/getItem/removeItem/clear/all; PluginData is local-only/non-sync | Durable six-method native/host facade accepted with real restart/fault/isolation controls; guest binding and legacy PluginData import remain required. [PLUGIN-STORE.md](PLUGIN-STORE.md) |

Current isolation lives in template-runtime.js/template.worker.js/template-client.js: fresh QuickJS VM and disposable worker, trusted bundled Nunjucks source, explicit host tag allowlist and JSON bridge. Guest templates have no module/file/network APIs. Do not broaden that boundary by executing imported JavaScript in the Svelte renderer, exposing raw invoke, or reviving Node/Electron. A custom-plugin implementation must define a separate package admission/execution contract while preserving the existing template bounds and owner Bun-only rule. Unsupported dependencies/contributions must be reported explicitly, with package/store bytes preserved.

The default-headers hook source is plugins/index.ts getRequestHooks: read rendered DEFAULT_HEADERS, iterate own keys in order, skip existing names case-insensitively, treat the exact string null as omission only after the existing-header check, append other values literally. Archived common/render.ts removes disabled header rows before hooks; the new shared Send path has the same order. This built-in gap has covered native acceptance recorded in [DEFAULT-HEADERS.md](DEFAULT-HEADERS.md) and does not implement custom module loading.

Next sequence: complete package admission and compatibility reporting; implement isolated custom tag lifecycle, bind the accepted durable host store to guest context and import legacy PluginData; integrate ordered hooks and action registries; then verify reload/disable/mutation/cancellation/UI/provider/platform cases. Every original plugin contribution/context remains required unless explicitly removed by the owner. Inventory does not remove scope or complete migration/UX/CSS.
