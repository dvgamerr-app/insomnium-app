# Plugin helper protocol activation candidate

Root request Send and introspection already carried workspace plugin services.
Initial and connected WebSocket payloads, gRPC connection/unary/client-stream
payloads, manual OAuth acquisition and saved-token selection omitted them.
The candidate passes the same captured workspace services, actual operation owner
and AbortSignal into those seven renderer calls. Model reads also check the
workspace owner before reading live history.

Message, gRPC and GraphQL wrappers now call `capturePluginRenderOptions` before
awaiting and forward the complete detached options, including `pluginExtraInfo`.
Previously they forwarded services/path but discarded extra information.
Saved `INSOMNIUM_PLUGIN_EXTRA_INFO=1 bun tests/ui/plugin-helper-render.js` failed
at message rendering with a null extra-info value before the fix. The corrected
six-wrapper matrix passes host/guest mutation checks with actual workers/VMs.

## Current evidence on 2026-10-11

- Compiler reports zero errors and warnings. Saved headless helper renderer passes
  27 checks with 94 terminated workers; retained helper context passes 17 checks.
  These use controlled services and do not prove native gRPC/OAuth/preview callers.
- Native old production `05b8f4ad` fails initial WebSocket payload because guest
  `util.models` is unavailable. Native `1791679376754` / restoration
  `1791679376238` preserve the failure and independent historical production-source
  audit. Both original workspace buffers, store and 653 cookie files are restored.
- New production `621f8ccc42932aa4edc898915b40313268d670458f05034801f6bb0c80400ca6`
  builds successfully. Frozen 56-source snapshots bind the application and test
  inputs; live QA changes only the saved scenario's modal cancellation/recovery
  handling, preserving original and intermediate snapshots separately.
- Native `1791680089413` / restoration `1791680088875` passes 16 checks,
  ten terminated workers and 11 native HTTP requests, plus one actual WebSocket
  connection and two messages. Both initial and connected payloads use the actual
  workspace model and saved-ID child HTTP request, forward ExtraRenderInfo, read
  the native response body, and persist three distinct helper response histories.
  The original populated-cookie/model/Prompt/HTTP matrix remains in the same run.
- During the real payload prompt, the saved scenario dispatches the actual
  Disconnect button handler programmatically because `showModal` makes the
  underlying UI inert. It proves owner Abort closes the prompt without additional
  HTTP/message leakage. This is not pointer interaction through the modal.
- Independent 56-source/current/exact-snapshot/build/worker/wire/history/model/
  cookie-file/store/workspace audit passes. Native hosts are hidden before CDP and
  exit zero; only scenario-owned cookie files are removed after owned exit.
- Retained H2/metadata/history/restart passes nine cases, 27 workers and 30 native
  requests: native `1791680138905`, restart `1791680147083`, restoration
  `1791680138712`, with independent 56-source/build/byte/history/restoration audit.

## Remaining gates

Owner Abort tears down the guest and invalidates its catalog. Native
`1791679924738` reached successful payload/Abort checks, then the ordinary tag
regression failed with unknown block tag `UnicodeTag`. The passing combined run
explicitly reloads the package through Preferences before the retained suite.
Automatic catalog recovery remains unproven and must be reconciled with legacy
behavior; manual reload is not treated as completing lifecycle parity.

The first live run `1791679837536` failed the Disconnect locator's exact text regex
(icon/whitespace), and restored both workspace files/store/cookies. Subsequent
saved selector uses the real send-button class plus partial text. Auditors were
updated to expect three helper histories, reflecting the two added payload sends.

Actual native gRPC discovery/unary/client-stream and manual/saved-token OAuth
helper acceptance remain required, as do production preview/read-helper policy,
synchronous app facade, DOM/events/onHide/private compatibility, clipboard with
exact original-format restoration, broader ancestry/deadline/Cancel/platform/
provider gates and every original migration requirement. UX/UI/CSS and shared
input work remain part of the overall owner goal. This candidate is uncommitted
preparation of the same incomplete full helper feature.

Official references consulted before changing the subsystem:
<https://svelte.dev/docs/svelte/$state> and
<https://v2.tauri.app/reference/javascript/api/namespacecore/>.
