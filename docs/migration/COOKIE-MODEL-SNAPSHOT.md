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

`PersistentJar::save` also serializes `iter_any`, retaining session and expired
entries through subsequent writes. This follows legacy `common/cookies.ts` and
`network/set-cookie-util.ts`, which serialize `store.getAllCookies` after adding
response cookies. The request snapshot and provider continue filtering expired
cookies independently. Broader cookie editing and actual request-header/provider
parity remain required migration gates.

## Subsequent-write persistence acceptance

The saved restart scenario supports `INSOMNIUM_COOKIE_RESTART_WRITE=1`: load the
controlled three-entry file, add an unrelated cookie through native `change_cookie`,
inspect the resulting file and model, then launch a second fresh native process.

- Prior production `4d956946` fails at the disk assertion: live model four,
  request snapshot three, persisted file three. Native `1791678025285`, restoration
  `1791678025154`, and `artifacts/plugin-cookie-write-negative-1791678025285`
  preserve the negative control and exact 54-source/harness snapshots.
- New production `05b8f4ad4821ad5f201b4772766dc5a5c190b403ad26c86c124e54d55d4d3dfd`
  passes native `1791678453748`, subsequent restart `1791678454838`, restoration
  `1791678453617`: persisted/model four, request three, original expired timestamp
  unchanged through the unrelated write and fresh process.
- Independent audit verifies the initial backup bytes, written file, both native
  results and hidden hosts, current/exact 54-source snapshots, original plugin
  store and both workspace files, plus all 653 original cookie files. It removes
  only the two absent-before, scenario-owned cookie files after owned native exit.
- Compiler passes with zero errors/warnings; Windows release build exits zero.
  Linux locked Cargo check passes in 18.27s with 275 actual source files matching
  the host, excluding four generated schemas explicitly. Evidence lives under
  `artifacts/native-plugin-cookie-persistence-probe` and
  `artifacts/linux-cookie-model-persistence-*`.
- Genuine guest helper rerun `1791678473871` / restoration `1791678473356`
  passes 13 checks, nine terminated workers and nine native requests, with
  populated cookie attributes, live expiry and exact owned-state restoration.
- Retained H2/metadata/history/restart `1791678513193` / `1791678521334` /
  restoration `1791678513011` passes nine cases, 27 workers and 30 native requests.
  Both suites have independent current/exact 54-source audits.
- Isolated staged-topic Linux locked check passes in 18.76s with 272 source files
  bound to the checkout before Cargo generates platform schemas. The pre-check
  manifest contains no generated schema files. The
  isolated Windows check was not rerun after the preceding topic's libclang
  discovery failure; full candidate Windows release/runtime evidence is separate.

The library documents `iter_any` for all retained entries and `matches` for
unexpired request-compatible entries:
<https://docs.rs/cookie_store/0.22.1/cookie_store/struct.CookieStore.html>.
The legacy model read matches the store's all-cookie operation:
<https://github.com/salesforce/tough-cookie/blob/master/api/docs/tough-cookie.store.getallcookies.md>.
The next section records separate acceptance for clear/delete/replacement,
response-driven writes and actual provider headers. Broader platform/migration/helper
parity remains required.

## Native provider acceptance

`INSOMNIUM_COOKIE_RESTART_PROVIDER=1` runs the existing saved restart scenario
with reusable `tests/ui/helpers/cookie-provider-cases.js`. Run it separately from
the write mode. It uses an owned loopback Bun HTTP fixture and the same unique
collection/main/previous files already protected by the restoration wrapper.

Production `05b8f4ad` passes 11 groups and 12 real native HTTP requests:

- Expiry, foreign-host and exact path-boundary filtering; expired entries remain
  visible to the model but absent from native Cookie headers, including when an
  explicitly supplied model snapshot contains them.
- Send off/store on, store off, cookies entirely disabled, actual response cookie
  persistence with HttpOnly, redirect-local cookies without model persistence,
  and explicit Cookie header precedence.
- Replace an existing cookie, refuse a stale snapshot generation before any wire
  request, delete an expired model entry, and clear the model/file/header. A
  second fresh native process confirms clear remains empty on disk.

Evidence: native `1791678832786`, fresh restart `1791678834794`, restoration
`1791678832680`. Independent audit checks all wire header pairs, snapshots,
persisted bytes, stale native error, original backup, both hidden/exit-zero
processes, both workspace files, plugin store and all 653 original cookie files.
The 55-source snapshot explicitly binds the two changed harness files to the
unchanged production source/binary. Compiler reports zero errors/warnings.
Retained write/restart regression `1791678872082` / `1791678872964` / restoration
`1791678871974` also passes with an independent 55-source audit.

Initial scenario `1791678749004` incorrectly expected Secure exclusion on
loopback HTTP. Pinned cookie_store `utils::is_secure` explicitly treats localhost
and loopback IPs as secure, so the corrected fixture expects Secure transmission
there. Subsequent `1791678796739` reached stale-generation rejection but failed
because Playwright flattened the native structured rejection to `evaluate: Object`;
the saved fixture now captures that native error inside the page and asserts its
actual message plus absence of a wire request. Both failures preserve owned-state
restoration and their source snapshots; neither is claimed as a product fix.

These gates are accepted for the controlled Windows loopback fixture only.
Non-loopback insecure exclusion, HTTPS transmission, actual domain suffix
matching across subdomains, equal-path ordering, concurrent/provider/proxy/platform
cases, import/edit UI and full helper/migration parity remain required.

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
