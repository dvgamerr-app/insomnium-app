# Plugin catalog recovery after callback cancellation

Cancellation retires the callback's worker to deny late guest replies. It must
leave the admitted package's template definitions available to subsequent requests,
as legacy `getTemplateTags()` collects definitions from active plugin modules.
The previous registry instead marked any closed worker as an error, so native
WebSocket Disconnect during a plugin prompt made the next HTTP Send fail with
`unknown block tag UnicodeTag` until the package was loaded again.

The session now records its first close reason. Only trusted host `AbortError`
closure permits automatic recovery; worker errors, malformed replies and time
limits still quarantine the package. Recovery creates a new worker lazily from
the original admitted source snapshot. It never replays the cancelled callback or
rereads changed source. One shared recovery promise handles concurrent callers.
Recovered metadata must match the admitted catalog exactly. Owner/configuration,
Disable/Unload and catalog guards remain required before and after recovery.
Arguments and callback context are detached before awaiting recovery. Late
rejections from a retired worker cannot quarantine a replacement worker.

## Verified evidence (2026-10-11)

- Saved `INSOMNIUM_PLUGIN_CANCEL_RECOVERY=1 bun tests/ui/plugin-helper-render.js`
  before the fix failed: parent status `error`, expected `ready`. Tool session
  19538 exited 1. Existing native negative evidence is retained under
  `artifacts/playwright/plugin-template-tags-1791679924738`.
- Fixed saved scenario 75594 passes 22 checks / 91 terminated workers. Final
  `INSOMNIUM_PLUGIN_CANCEL_RECOVERY=1 INSOMNIUM_PLUGIN_EXTRA_INFO=1` run 29122
  passes 28 checks / 97 terminated workers, including retained CPU quarantine.
  The Windows command sets those environment variables in PowerShell first.
- `bun run check` session 40386 passes with zero errors and zero warnings.
- Production candidate `artifacts/native-plugin-cancel-recovery-probe` freezes
  57 source files, including the registry omitted from the older 56-file freeze.
  Build 90723 exits 0 in 382.689 seconds; executable SHA-256
  `324eb45d9b1637b9e52d0d5cb6f573513a2380bc2a466fd7062810b7c46af425`.
- Native 23272 exits 0: scenario `plugin-template-tags-1791681123981` and
  restoration `plugin-workspace-helper-restoration-1791681123398`. The same
  saved scenario now omits the explicit Preferences/Load after Disconnect.
  Sixteen checks / ten terminated workers / eleven native HTTP requests plus
  one WebSocket connection and two messages pass. The ordinary Unicode tag
  response is sent after cancellation with no reload. Independent audit passes
  all 57 current/exact snapshots, owned hidden host exit, worker assets, response
  bytes/history, populated cookie model, store and both workspace buffers;
  all 653 original cookie files remain unchanged. Owned cookie fixtures alone
  are removed after the host exits. Auditor initially expected eleven workers;
  ten is correct because automatic recovery replaces the prior manual Load.
- Separate saved `bun tests/ui/plugin-cancel-recovery.js` passes six controls
  with five real guest workers, all terminated: active cancellation, pinned
  source, shared concurrent recovery/detached arguments, guest quarantine,
  owner loss during recovery and mismatched metadata refusal.
- The same six controls pass with `INSOMNIUM_PLUGIN_RECOVERY_STAGE` pointing
  at `artifacts/plugin-cancel-recovery-topic/bundle`: HEAD session plus only
  cancellation-reason changes, HEAD callback-context contract and the registry
  recovery changes. The current production worker asset is used. This proves
  the isolated host topic without claiming a separate staged production build.
  Final compiler 58070 passes zero errors/warnings. An initial dedicated harness
  referenced a Node-side variable in page.evaluate; corrected directly. Initial
  compiler diagnostics were confined to this harness's JSDoc types and fixed.

Full helper activation, gRPC/OAuth/preview, synchronous native app/clipboard,
DOM/private APIs, broader platform/provider parity and the complete migration
remain required. The shared-input UX/UI/CSS phase remains in the full objective.

Official lifetime contracts consulted: [HTML Worker termination](https://html.spec.whatwg.org/multipage/workers.html#dom-worker-terminate)
and [DOM AbortSignal](https://dom.spec.whatwg.org/#abortsignal). Recovery policy
above is application behavior; termination alone does not reload a package.
