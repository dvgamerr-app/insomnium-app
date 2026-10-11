# Native OAuth helpers and Auth preview

The same saved `plugin-template-tags.js` scenario now has optional
`INSOMNIUM_PLUGIN_HELPER_OAUTH=1`, with a separate reusable
`tests/ui/helpers/plugin-oauth-native.js` fixture. It owns a loopback token/resource
server and synthetic imported token. The plugin resolves actual workspace/request
models, sends its saved HTTP helper with extra information, checks real response
history and returns the response body as the OAuth client ID. Guest URL edits must
not become an alternate send endpoint.

## Verified negative (2026-10-11)

Executable `324eb45d9b1637b9e52d0d5cb6f573513a2380bc2a466fd7062810b7c46af425`
is reused from the previous cancellation candidate only after confirming product
source unchanged. Its separate probe retains original57 and live58 source snapshots.
Native session76520/`plugin-template-tags-1791681937004` fails saved-token adoption.
Manual Fetch succeeds first: one helper HTTP request and one genuine token exchange
with the rendered client ID. Auth preview then executes the same tag without helper
services, producing `cannot read property 'models' of undefined`, quarantining the
worker and causing `unknown block tag: oauthhelper` on adoption.

Restoration `plugin-workspace-helper-restoration-1791681936474` passes; both original
workspace buffers, plugin store and the cookie inventory match. The independent
`artifacts/audit-plugin-oauth-negative.mjs` audits historical58 snapshots, executable,
native-hidden exit0, one manual exchange/helper request, exact failure and restoration.
It explicitly does not claim current application source matches that older candidate.

## Candidate implementation / required native proof

- OAuth preview now obtains the same real saved-ID transport/model/cookie services
  through a registered editor work scope. Source key, Abort, workspace/collection
  owner and drain/disposal guards protect callbacks. Dependent sends check the
  preview owner before native send and before publishing response history.
- Preview-owned history writes acknowledge the exact resulting history before
  persistence yields. The input key survives those writes and eviction, while
  external history/body edits still invalidate it. Token-only updates recompute
  status from the resolved request without repeating helper execution. Acquisition
  and adoption suspend general rendering while their explicit owner runs.
- Saved `bun tests/ui/plugin-oauth-preview.js` passes eight guard controls.
  Compiler78210 passes zero errors and zero warnings. This is source/guard evidence,
  not native/component acceptance.
- Production build68716 under `artifacts/native-plugin-oauth-preview-probe` freezes
  62 sources, including OAuthEditor and oauth-model omitted from earlier manifests.
  No app/scenario source edits while build/native QA is live. Native acceptance
  must retain Fetch/adoption/actual bearer Send, imported source/history, both
  owner-Cancel prompt paths/no-wire/token preservation, recovery without Load,
  preview readiness/bounded side effects and exact owned-state restoration.

## Accepted candidate / isolated guard topic

Build68716 exits0 in384.571s; executable
`20ab757ea334962177322637e29efa134d311e5d6f9d67e82b10220b44ee81c6`.
After build and before native QA, the helper harness adds a750ms ready-state
stability assertion. Original62-source and initial-live snapshots are retained;
live62 differs only in that saved helper file, with application source unchanged.
Native11980/`plugin-template-tags-1791683269931` and restoration
`plugin-workspace-helper-restoration-1791683269355` exit0. Twenty-three checks,
twelve terminated workers, nineteen main HTTP plus three OAuth HTTP requests,
one WebSocket connection/two messages and seven OAuth cases pass. Eight OAuth
helper requests are observed; current saved helper history contains ten entries
under the configured global20-entry cap. Both real prompt owner-Cancel handlers
preserve active token and deny additional token/helper wire; recovery works
without Load. The original imported token remains unchanged. UI reports API token
ready, and no helper/token wire repeats during750ms after ready.

`artifacts/audit-plugin-oauth-preview.mjs` independently audits current62/exact/live/
original source snapshots, build/executable/worker assets, actual rendered grant
forms/two exchanges/one bearer GET, token/context binding, response/history bytes,
populated cookie model and exact store/two original buffers/all653 cookie files.
Owned cookie fixtures alone are removed after native-hidden/visiblefalse exit0.
Final compiler39032 passes0/0. The standalone history guard and eight saved controls
are isolated as a topic; editor/service/native scenario integration still belongs
to the unfinished helper feature. See OAUTH-PREVIEW-HISTORY.md for commit scope.

All actual gRPC protocol callers, other production preview callers/policies,
synchronous native app/clipboard/DOM/private APIs, broader helper/provider/platform
and original migration parity remain required before the shared-input UX/UI/CSS
phase. This candidate is not the completed helper feature and is not yet committed.

Official contracts consulted: [OAuth client credentials](https://www.rfc-editor.org/rfc/rfc6749.html#section-4.4),
[Svelte effect dependencies](https://svelte.dev/docs/svelte/$effect#Understanding-dependencies)
and [Svelte untrack](https://svelte.dev/docs/svelte/svelte#untrack).
