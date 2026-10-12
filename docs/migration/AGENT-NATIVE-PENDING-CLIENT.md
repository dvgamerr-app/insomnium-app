# Pending native clients and pre-aborted endpoint subscription

2026-10-12. Actual native pending-client checks expose and fix a constructor
subscription defect: creating an endpoint with an ALREADY-aborted owner added a
lease Abort listener that can never fire. The existing live-owner handler already
uses once:true and cleans up correctly; the earlier permanent-listener hypothesis
was disproved by the preserved native baseline. Only the already-aborted case is
changed: `if(!signal.aborted)` guards the existing lease subscription.

Root owns topic integration and STATUS. No Event engine, Rust, identity,
permission, dependency or clipboard changes. Default profile explicitly claimed
after root authorization, baseline/fixed hosts run serially, full restoration
audited, then default ownership released. Cold CRUD namespace untouched; all
own process handles terminal.

## Delta and saved verification

| File | Result SHA256 |
| --- | --- |
| `src/lib/plugin-app-native.js` |9983f83c2d802f112bc0f376d97b63948a363c472d94fdde101dedbcd1ffeadf|
| `tests/ui/plugin-dom-event-provider-native.js` |4e5e14559bd8e188cce87cdfcaab9d03cb670f8af6427bf3d642941f3b14fbef|
| new `tests/ui/fixtures/plugin-native-provider-pending-native.js` |7c6c9c07569acf3c5b081ba66adb18538ce802990c1e30d029563a800019b067|

Existing native scenario adds an optional explicit fixture branch under
INSOMNIUM_NATIVE_PROVIDER_PENDING=1; all original provider/renewal/Abort/default
cancellation assertions remain unchanged. Fixture uses REAL readonly getInfo/
Desktop IPC and real owned AbortSignal/EventTarget dispatch. Only subscription
methods on that fixture's own Signal are observed; no IPC, browser globals or
native provider results are mocked. No paths/tokens/private provider values are
printed by new fixture; fresh controls publish only type booleans.

- 10 real native client calls (2 methods x zero/false/empty/Error/defaultAbort)
  remain client-pending in the owning Window turn before immediate owner Abort;
  rejection reasons preserve exact identity/value, and no native value publishes.
- 2 owner-generation changes happen after real dispatch but before awaited native
  completion; the post-native current-owner check suppresses each actual value.
- Already-aborted owner retains no subscription, returns its exact reason and
  refuses native Event preparation. Fresh native owner controls complete, dispose
  subscriptions and show no unhandled rejection during bounded100ms observation.
- Native client cancellation does not prove Rust was still running at Abort or
  that an already dispatched native operation can be interrupted. Original held
  synchronous Window-provider gate and full Event/Window/private/platform remain.

Compiler55151/6b69bb terminal0errors/0warnings; prior baseline compiler91390/954391
also0/0. Saved provider-owner headless16 regression fc9279 exit0 includes exact
falsy reasons/late result+late error/generation refusal/Abort during old-lease
retirement and no renewal timer resurrection. Its output bytes match original
root regression result SHAfeabdcae; immutable copy is in new fixed proof.

## Native baseline and fixed supplemental factory

New proof directory `artifacts/native-provider-pending-current-20261012/` contains
separate baseline/fixed755-file source snapshots, bundle copies, logs, results and
saved independent audit. Audit e84623 exit0 proves the ONLY baseline-to-fixed
source difference is the exact one-line product subscription guard; new scenario
assertions/fixture are identical across negative and positive phases.

| Phase | Terminal | Native output | Restoration |
| --- | --- | --- | --- |
| original subscription negative |87a8d5 exit1|plugin-dom-event-production-1791785488567|resource-manager-restoration-1791785487919|
| fixed pending4 + original provider4 |69424/3d9f71 exit0|plugin-dom-event-production-1791785661626|resource-manager-restoration-1791785660988|

All output directories are under own artifacts/playwright. Negative fails the
new unchanged strict already-aborted subscription assertion at line26:1!=0;
both native values/reasons and ordinary live-owner listener cleanup already pass.
It is retained, never rewritten as acceptance. Both owned hosts exit0/native-hidden;
fixed run terminates both original owned production/template workers. Each phase
restores exact2 workspace buffers/store/ALL654 baseline cookies; changed buffers
captured before restore, zero registered persisted fixtures/new-cookie cleanup,
historic unbound empty cookie untouched. No clipboard operations.

Existing9b3f executable/51 immutable frontend assets/worker889 are unchanged.
Supplemental baseline bundleddd43117 and fixed bundle6b5428fc are compiled from
explicit source snapshots and evaluated in the actual owned WebView. This proves
the revised factory against actual native backend, NOT that existing9b3f frontend
embeds the new guard. A freshly integrated frontend/native binding remains a new
gate after root topic integration; full Event/migration acceptance remains false.

Official references consulted: [DOM listener once semantics](https://dom.spec.whatwg.org/#dom-addeventlisteneroptions-once),
[Tauri invoke Promise API](https://v2.tauri.app/reference/javascript/api/namespacecore/#invoke).
Bun-only build/check/scenario tools, headless browser regression/native-hidden
owned hosts, source frozen during every live handle. `/compact` unavailable;
this is the explicit handoff for parent STATUS/topic commit.
