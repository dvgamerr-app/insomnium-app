# Plugin DOM dialog host lifecycle

The host mounts the original HTMLElement through a Svelte action, preserving
event listeners and live mutations. The legacy contract is a synchronous void
`app.dialog(title, body, {onHide, tall, skinny, wide})`; general preview does
not show UI. The archived app context and HtmlElementWrapper are the reference.

The owned host has singleton replacement, stale-close protection and owner
Abort/current-loss cleanup. It removes the body before invoking onHide once.
Reentrant callbacks can open a newer dialog without earlier cleanup removing it.
Mount owner-check errors release the request and report the error. Host unmount
and pagehide release the active request.

## Verification — 2026-10-11

`bun tests/ui/plugin-dom-dialog.js` passes ten saved headless groups with the real
Svelte component, shared DialogShell and application CSS. The cases exercise DOM
events, Unicode input, mutation, replacement, malformed arguments, stale close,
Close, Abort, owner loss, reentrant onHide, reuse of the same body, callback
errors, mount errors, preview suppression and actual component unmount.

`bun run check` is the compiler gate. Exact evidence is recorded in STATUS.md.
`bun artifacts/audit-plugin-dom-dialog.mjs --freeze` preserves source bytes and
the result under artifacts/playwright/plugin-dom-dialog; the same command without
the flag checks their hashes against current sources. Scope is local src and
tests/ui, not external dependencies, native executable or native acceptance.

## Remaining integration

This is the browser host layer; it is not mounted in the application route yet.
The isolated guest does not currently have a DOM object/event/function bridge.
That bridge must preserve node identity, mutations and events, retain an owned
VM lease for callbacks after the initiating callback returns, and release it on
close, replacement, Abort, unload or app destruction. Do not wire the host to a
short-lived render session that aborts immediately after returning void.

Generic HTML and private React/ReactDOM/axios compatibility, exact legacy dialog
geometry, actual plugin/native activation and provider/platform parity remain
required. This host evidence does not close the full app facade migration gate.

Implementation references: [Svelte actions](https://svelte.dev/docs/svelte/use)
and [DOM appendChild](https://developer.mozilla.org/en-US/docs/Web/API/Node/appendChild).
