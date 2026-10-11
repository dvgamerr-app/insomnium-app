# Guest DOM to actual dialog host candidate

The guest now uses synchronous node references to a host-owned DOM graph.
Creation and DOM operations execute on actual browser Nodes; the bridge does
not clone/stringify the body or maintain a separate DOM model. Guest references
preserve identity across parent/child/query results and Node/HTMLElement checks.
Style references preserve identity and route supported CSS properties to the
original element. All operations remain inside the admitted owner's graph.

The working production runtime composes `c.app.dialog` with its existing app
facade only when the host enables DOM transport and callback retention. Dialog
returns void. Real host event listeners enqueue retained guest functions using
the original capability frame and map event target/currentTarget/this to the
same node references. Duplicate registration is inert and removal releases its
function lease. Actual Close removes the original body before enqueueing one
guest onHide callback. Preview dialog does not replace an active Send dialog.

The bridge exposes explicit DOM members and control elements. It rejects app
document/prototype access, unknown node IDs, executable elements, event string
attributes and executable HTML. Host graphs bound nodes/listeners and use an
8MiB cumulative text-write budget, including replacements/clone text, to avoid
unbounded retained orphan data. Owner disposal removes owned listeners/roots
and releases function handles. These are capability boundaries, not full DOM
API or event semantic parity.

## Verification — 2026-10-11

`bun run build` creates the current production plugin worker.
`bun tests/ui/plugin-guest-dom.js` uses that actual worker/VM, current host client,
Svelte PluginDomDialogHost/DialogShell and built application CSS. Six headless
groups verify actual DOM/void/identity, click/input/Unicode/live mutation and
original app metadata frame, duplicate/remove listeners, preview suppression,
one detached guest onHide, nine ownership/executable-content refusals and the
actual host text-write boundary. One genuine worker is verified terminated.

Saved production callback session, sync app, async dialogs, helper renderer,
Cancel recovery and host DOM lifecycle regressions also pass. Compiler is zero
errors/warnings. `bun artifacts/audit-plugin-guest-dom.mjs --freeze` preserves
local source/scripts/configuration, complete frontend build and seven results.
Without the flag it checks current/exact sources, result and worker hashes.
Exact evidence/commit/handles are recorded in STATUS.md. This does not prove a
current native executable or every external dependency.

## Required remaining work

This topic commits the guest reference adapter/validator, actual host graph and
saved end-to-end fixture/scenario. Runtime/client/worker DOM composition remains
with the broader uncommitted helper/sync/Buffer assembly. The app route and render
session provider do not yet activate it. The fixture retains an explicit owner;
production must preserve a dialog owner beyond render completion and provide
ordered shutdown/onHide before terminal owner revocation.

Complete DOM member coverage/live collections, synchronous event cancellation
and dispatch semantics, property event handlers, focus/default-action behavior,
generic HTML/private React/ReactDOM/axios, exact legacy geometry, replacement/
reentrancy/reuse/owner shutdown through the guest, native acceptance and wider
provider/platform/parity gates remain required. Unsupported HTML setters and
event cancellation currently throw explicitly. This does not close full DOM
or app facade parity. Full migration precedes shared-input UX/UI/CSS redesign.

References: [DOM appendChild](https://developer.mozilla.org/en-US/docs/Web/API/Node/appendChild),
[Document.createElement](https://developer.mozilla.org/en-US/docs/Web/API/Document/createElement),
[Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy),
and [QuickJS retained handles](https://github.com/justjake/quickjs-emscripten).
