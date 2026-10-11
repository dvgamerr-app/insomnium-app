# OAuth preview-owned history keys

`createOAuthPreviewHistoryGuard` distinguishes exact history mutations published
by a preview from external response changes. The caller records the resulting
history and original input key before yielding. An exact match retains that key,
including history eviction; another history/body value produces its own SHA-256
key. This prevents a preview's native helper response from scheduling that same
preview repeatedly without suppressing external invalidation or history writes.

`bun tests/ui/plugin-oauth-preview.js` passes eight saved headless controls:
detached equality, owned append, owned eviction, external new response, external
body replacement, another preview origin, token-only source stability and OAuth
input edits. It uses the existing OAuth source contract and baseline model/hash
dependencies. The standalone topic contains the guard, fixture/scenario and this
document; broader editor/service integration remains part of the uncommitted
helper feature.

Integrated working-candidate evidence is separate: production
`20ab757ea334962177322637e29efa134d311e5d6f9d67e82b10220b44ee81c6`, native
`plugin-template-tags-1791683269931`, restoration
`plugin-workspace-helper-restoration-1791683269355`. Twenty-three checks, twelve
terminated workers and twenty-two real HTTP requests pass, including seven OAuth
cases and no repeated wire for750ms after ready. Independent62-source/build/byte/
token/context/history/model/store/two-buffer/653-cookie-file audit passes. This
is a full working-candidate acceptance, not a claim that this standalone commit
contains or completes all preview/helper activation. Final compiler39032 is0/0.

Source reactivity contract: [Svelte effect dependencies](https://svelte.dev/docs/svelte/$effect#Understanding-dependencies).
General preview callers, provider/lifecycle/deadline/cancellation/concurrency,
gRPC/native synchronous app/DOM/private/clipboard/platform and the original full
migration remain required before the shared-input UX/UI/CSS phase.
