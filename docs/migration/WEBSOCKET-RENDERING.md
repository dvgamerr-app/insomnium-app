# WebSocket payload rendering

## WebSocket payload shared renderer — 2026-09-29

- sendPayload now snapshots payload/current collection environment and renders text/JSON/ping with the shared Send session and dependent-response adapter. Binary Base64 remains literal. JSON is validated after rendering. Request URL/auth/body are not rerendered for subsequent messages.
- Each payload operation captures its connection ID, follows its AbortSignal and rechecks matching active/open response/run and resource existence before dispatch. Replaced/closed connections never receive a late rendered message. One payload operation per request is allowed; operation completion participates in shutdown. Payload/environment edits after clicking Send use the captured snapshot; deletion/connection replacement cancels dispatch.
- Native closed events and execute finalization abort the connection owner to release pending prompt/render/dependency work. Existing native message format/size handling is unchanged.
-22 inline assertions passed:11 compiled payload cases (text/JSON/binary/ping, prompt, duplicate-send guard, Stop, replacement connection, dependency and cleanup),5 actual execute/mocked-native close/shutdown cases,6 dependent OAuth cancellation regressions. Svelte0/0, Vite build and git diff --check passed. No saved test files/dependencies/native edits/installer; workers0, no real-user-state writes.
- Consulted official Tauri channels and MDN AbortController.abort plus archived main/network/websocket.ts and ui/components/websockets/websocket-request-pane.tsx interpolation/send sequence. A guessed archive path was absent and an rg expression had an unmatched parenthesis; located actual file and reran search. No source edit failures.
- Real WebView/Rust WebSocket wire acceptance remains pending; mocked IPC proves frontend ownership only. Automatic connect-and-send behavior from the archive and advanced stream parity still need reconciliation. Next: gRPC discovery/send/client-stream message renderer, streaming dependency completion, native cookie/User-Agent/URL parity and full PARITY acceptance. Full migration incomplete; source newer than BUILD.json.

Official references consulted before implementation:
- https://v2.tauri.app/develop/calling-rust/#channels
- https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort

Commands: Bun directly runs Prettier on request-render.js/workspace.svelte.js; svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings; vite build. git diff --check passes. All program launches use node_repl execFile(shell:false,windowsHide:true); no new generator required for existing renderer integration.

## WebSocket automatic connect-and-send — 2026-09-29

- sendPayload now starts a WebSocket connection when idle. Captures the selected payload at click time, reserves the message operation and tracks its completion for shutdown. An already preparing connection rejects a second Send; an open connection retains the existing message path.
- execute accepts an internal initial-payload operation. Renders the payload before URL/headers/auth preparation, matching archived websocket-request-pane.tsx interpolateOpenAndSend. JSON is validated before handshake; binary stays literal. It uses the shared Send renderer and dependency resolver with the connection owner's cancellation signal.
- Initial payload dispatch happens once on the owning open event. Checks cancellation and payload existence before dispatch; duplicate open events do not resend. Stop, failed handshake, closed connection or missing/deleted payload settle the waiting UI action. Native send acknowledgement resolves Send without waiting for connection closure. Message operation participates in shutdown completion.
- WebSocketMessageEditor enables the idle action as Connect and send and retains Send message for an open connection. Pending connection/message actions stay disabled; manual Connect still opens without sending.
- 28 inline assertions passed:12 compiled Svelte/mocked-native initial-message cases (wait for open, overlap guard, click snapshot, duplicate open, existing send, prompt before handshake, Stop and cleanup, invalid JSON, handshake failure, deleted payload, no leaked runs/workers),11 existing payload regressions and5 connection-close/shutdown regressions. No saved test scripts, real-user-state writes or active fixture workers.
- Svelte0 errors/0 warnings, Vite production build and git diff --check passed. No native edits/dependencies/new installer; source newer than BUILD.json. Commands: Bun directly launches Prettier, svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings and vite build; git diff --check, all via hidden node_repl execFile shell:false/windowsHide:true.
- Official docs consulted before editing: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send and https://v2.tauri.app/develop/calling-rust/#channels . Inspected archived interpolateOpenAndSend and native streaming.rs sender registration before open-event delivery. No generator needed for this existing subsystem.
- Mocked IPC proves frontend ordering/ownership only. Real WebView/Rust WebSocket send/close/provider/UI acceptance remains pending. Next: reconcile live SSE raw history, native cookie/User-Agent/URL parity, then runtime/UI/platform/packaging acceptance and every remaining PARITY row. Full migration incomplete.

