# Native cookie model snapshots

The request snapshot continues to omit expired cookies. Model readers can opt into
`snapshot_request_cookies({ workspaceId, includeExpired: true })` to inspect every
entry currently retained in the jar. The command retains its main-window ownership
guard and snapshot size limits. Callers omitting the option keep the existing
request behavior.

The disk loader uses `cookie_store::serde::json::load_all` so an expired entry
already present in a persisted file remains available to model readers after a
fresh native process. The pinned cookie_store 0.22.1 serializer documents that
`load` skips expired cookies, while `load_all` loads both expired and unexpired
entries. Primary API: <https://docs.rs/cookie_store/0.22.1/cookie_store/serde/json/fn.load_all.html>.
The installed crate source was consulted; the web fetch was unavailable.

This does not change persistence pruning: `PersistentJar::save` still serializes
`iter_unexpired`. Preserving expired model entries through subsequent writes,
broader cookie editing policy, and actual request-header/provider parity remain
required migration gates. Cookie-provider matching remains independent of the
model snapshot option.

## Verification on 2026-10-11

- Old production `d5a04def` negative control: persisted fixture has three entries;
  fresh native request/model snapshots both return two. Evidence:
  `artifacts/playwright/plugin-cookie-restart-native-1791677130952` and restoration
  `plugin-cookie-restart-restoration-1791677130846`; independent restart audit passes.
- New production `4d95694614ad04bba082e1e3098663bab707a653fe6951e6e9a711bb2e036e0d`:
  the same saved `tests/ui/plugin-cookie-restart-native.js` returns request two,
  model three with the original expired timestamp. Evidence: native
  `1791677644754`, restoration `1791677644597`, independent 54-source audit.
- Genuine mounted Send/guest helper rerun: `plugin-template-tags-1791677659246`,
  restoration `plugin-workspace-helper-restoration-1791677658727`; 13 checks,
  nine terminated workers and nine native requests. Host-only/default-path/session,
  suffix/explicit-path/persistent, Secure/HttpOnly and live expiry are independently
  checked in guest model, native snapshots and owned persisted fixture bytes.
- Both original workspace files, plugin store and all 653 original cookie files
  remain unchanged. Only scenario-owned fixture files are removed after owned
  native exit. All native hosts are hidden before CDP and report `native-hidden`.
- Windows release build exits zero; Linux locked Cargo check exits zero in 7.35s,
  with 275 actual source files matching the host (four generated schemas explicitly
  excluded). Exact snapshots and audits are retained under
  `artifacts/native-plugin-cookie-restart-probe` and `artifacts/linux-cookie-model-restart-*`.
- Retained HTTP metadata/H2/history/restart passes nine cases, 27 terminated workers
  and 30 native requests; native `1791677698553`, restart `1791677706722`, restoration
  `1791677698353`, independent 54-source audit.
- Retained Windows save chooser passes 12 groups (`1791677743512`), and explicit
  host destroy passes (`1791677854723`), with owned exit and original workspace
  restoration. Clipboard remains untouched by these scenarios.
- Isolated staged-topic Linux locked Cargo check passes in 9.50s. The isolated
  Windows check fails bindgen's libclang discovery; this is recorded separately
  from the successful full candidate Windows release/native tests. The topic
  checkout and check evidence remain under `artifacts/native-cookie-model-staged-check.json`.

Run the restart scenario with Bun and an explicit current build-state path plus
`INSOMNIUM_COOKIE_RESTART_FIXTURE` pointing to the controlled three-entry fixture
under `artifacts/playwright`. The scenario refuses paths outside that directory,
uses a unique absent collection file, and restores owned state after native exit.
This checkpoint does not complete the full plugin helper feature or migration.
