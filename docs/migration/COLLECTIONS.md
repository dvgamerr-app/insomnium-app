# COLLECTIONS migration

Updated 2026-10-15. CRUD, indexed ancestry, subtree duplication/move/delete and shared field/focus behavior are implemented. Remaining complete persisted workflow and private-resource/history/ordering/keyboard acceptance remain required.

See [current status](STATUS.md), [execution plan](PLAN.md) and [complete parity requirements](PARITY.md). No original scope was removed by consolidation.

## Remembered request selection — 2026-10-16

Request selection now updates `workspace_meta.activeRequestId` and collection switching restores that collection's remembered HTTP/WebSocket/gRPC request, including nested folders. Missing/foreign/non-request references fall back to a request in the destination collection; an explicit empty selection remains empty. Closing the active tab records the fallback selection, deletion clears removed selections, and loading restores a valid remembered request/tab. Existing import reference remapping makes imported metadata usable without retaining source IDs. No layout changes.

Inline Bun checks cover helpers, saved-data validation/reload, actual import ID remapping, empty selections and foreign/non-request refusal. Follow-up actual coordinator checks exposed an empty source selection leaking into an unvisited destination; resolve destination selection before changing the active collection. The original assertion fails before the fix and passes after it, together with remembered/explicit-blank destination, open-tab and invalid-target controls. Compiler and prior production bundling pass. Mounted/native collection switching, tab close/delete/reload and broader platform acceptance remain open. Legacy contract: `_backup/legacy-electron/packages/insomnia/src/models/workspace-meta.ts`.

## Per-collection sidebar filter — 2026-10-16

The sidebar reads `workspace_meta.sidebarFilter` for the active collection rather than a shared transient search string. Input uses the guarded workspace persistence path; imported/saved filters restore automatically when collection metadata changes. Empty/unchanged updates avoid creating metadata or another save. Existing metadata, including remembered request/environment and sidebar visibility, remains intact.

Actual setter checks pass independent collection values, Unicode text, saved-data validation/reload, clear, unchanged updates and admission refusal. Compiler and production bundling pass. The unchanged saved `workspace-shortcuts` scenario passed before this filter change (about 3 seconds); that receipt proves the previous shortcut baseline, not this feature's mounted/native switching acceptance. No test files were added or edited.

## Pinned requests — 2026-10-16

Imported `request_meta.pinned` (HTTP/WebSocket) and `grpc_request_meta.pinned` now populate the collection-scoped Pinned Requests list, including nested requests. Normal tree locations remain, with a pin indicator. Manage request and Ctrl/Cmd+Shift+P toggle pinning through guarded persistence, retaining unrelated metadata. Existing import ID remapping and duplication exclusion policies are unchanged.

Inline checks execute the actual pin action and verify HTTP/WS/gRPC metadata types, nested/foreign collection scope, preserved response-filter/custom fields, imported IDs and admission refusal. Compiler/build pass. Actual mounted/native pin/unpin/filter/keyboard/reload and visual/platform acceptance remain open. Legacy contracts: `models/request-meta.ts`, `models/grpc-request-meta.ts`, `ui/routes/debug.tsx` in the read-only archive. No new test files or native build.

## Current Windows acceptance

Collection lifecycle extension is verified on Windows at2870f40. Legacy models with explicit canDuplicate:false comprise git_repository, grpc_request_meta, oauth2_token, plugin_data, project, request_group_meta, request_meta, request_version, response, settings, stats, unit_test_result, websocket_response and workspace_meta. The legacy database skips those models before child recursion; the current fix follows that exclusion boundary. Unknown models under eligible owners remain preserved by the current application policy; this is explicitly broader than legacy's unknown-type exclusion, not a claim of strict legacy unknown parity. [Playwright actionability](https://playwright.dev/docs/actionability) was consulted again; successful clicks do not replace durable native-state checks.

Build52534/collection-lifecycle finishes0 after Rust6m42 and full input closure; post-native closure63770 passes. Native32795/receipt1791999735595 passes unchanged original6/field24/correction6 plus6 new actual UI groups: Create with persisted default request/environment, trimmed rename/switch, exact full-reference duplicate with14 exclusions/14 excluded descendants and fresh selection metadata, real root Move up/down, unchanged cancelled delete, confirmed source/copy deletion with original fallback/request/tabs/reload. All15 known top-level fields remap; foreign IDs/nested and literal payloads remain exact. Actual root reorder intentionally updates every sibling; only sort/time may differ and exact pre-reorder fields are restored before final original-resource equality. No extra Send/cookies: received1/aborted1. Host21324 exits0/native-hidden. Independent audit verifies original workspace hashes f0b51/d8b032, complete profile membership, empty cookies/plugin inventory,4 registered actual collection IDs/names and1 selective owned cookie cleanup. Compiler19399 passes0/0; direct model exclusions and source-only original-body/poisoned-delta guards pass. Actual exe SHA55e71027fba5ad6902d501cb62830b2a2672bb0c6a9247ad828783e80994d156; acceptance SHA51dfd8c4b3cdc17eddcbd83b57774ca2cd1f0553c09ca78d83eccc802e5031d9; restoration SHA30d510aa0fbd3f352bed161426380eaec2cb582d70f13163f8405dd7d7a6e322. No live feature handles. This closes named Windows lifecycle cases; complete other-model, deleted-owner cookie, callback-drain, AT/physical-width/platform acceptance remains required.

The same resource-manager-native.js six-group saved matrix is extended with24 field refusals/6 corrected native save-and-reload checks across6 CSS viewport/theme profiles. Exact ARIA/error IDs/descriptions, stable label names, label click/Enter/focus, unchanged refused resources/history and corrected unknown-field preservation remain required. Original cold one-collection, copy/remap/private exclusion/order/search/held Send/Cancel/move/delete/reload gates stay intact. Compiler77300 passes0 errors/0 warnings; corrected saved component passes6 profiles/24 refusals. Build guards13, original cold guards23 and reconstruction guards17 pass; the read-only proof CLI verifies all10 actual retained raw files. Prior runtime acceptance is verified at301c173; broader collection/private/history/ordering/keyboard/platform requirements remain required.

Fixed CRUD identity remains app.insomnium.probe.resourcecrud20261012. Existing profile workspaces match the historical Root-proof hashes; no reset/deletion or arbitrary new identity is permitted. Since the retired raw marker is unavailable, a new record must explicitly identify reconstructed ownership from pinned retained Root/native/restoration receipts and current baseline. It must not fabricate old launches or claim a fresh absent profile. A fresh normal-hook release and full source/package/private-input checks precede launch. [Tauri build configuration](https://v2.tauri.app/reference/config/#buildconfig) and [Playwright actionability](https://playwright.dev/docs/actionability) consulted; durable native state, not actionability alone, proves save completion.

Maintained sequence: bun tests/ui/build-resource-crud-probe.js <new-output-under-artifacts/native-resource-crud-audit-probe>; after a finished0/full-closure-verified build, bun tests/ui/helpers/native-profile-ownership.js --reconstruct <new-marker.json> <finished-build-state.json>; set INSOMNIUM_UI_BUILD_STATE and INSOMNIUM_UI_PROFILE_OWNERSHIP to those exact files, then bun tests/ui/resource-manager-native.js. The accepted run uses attempt-2; do not overwrite a finished candidate or existing marker. Freeze source from pre-Cargo capture through actual acceptance/restoration. Reconstruction checks no hosts before profile reads, pinned retained evidence and current protected baseline; window state remains separately host-mutable. Original initially-absent ownership behavior stays unchanged.

First build75816/current finishes0 after Rust9m28/full source closure verification. Reconstruction correctly reports initialAbsenceClaim:false/profileMutated:false. Native receipt1791995709979 fails at computed border rgb(238,111,134) versus exact danger rgb(251,113,133); controls.css has120ms border transition. [CSS transitions computed values](https://www.w3.org/TR/css-transitions-1/#application) explain intermediate measurements. The same native/component assertions now wait within1500ms for exact color and no pending/running border transition, retaining focus/outline/shadow assertions and unchanged styles.

The failed warm run also exposed cold Save before capture: only original My Collection modified changed1791785213891→1791995711773, with previous buffer becoming the prior current buffer. Ordinary restoration1791995709626 passed its captured bytes; it did not by itself prove the earlier Root baseline restored. The explicitly pinned --restore-cold-baseline helper checks failed host43316/exit0/native-hidden, raw incident receipts, current byte hashes, timestamp-only semantic delta and no hosts, then restores only the two original workspace buffers. Actual recovery passes with profileReset:false/failedEvidenceUnchanged:true/markerUnchanged:true; receipt current/cold-baseline-recovery.json. Warm capture now occurs before any cold UI write, with exact bound PID; genuine first-absence behavior stays unchanged. Negative receipts remain failed. Accepted attempt-2 proves the named native6+24+6 and original protection as recorded below.

Prior acceptance301c173: build98752/attempt-2 finishes0 after Rust7m22/full closure checks, with actual exe SHAc7ab426110847bee90fb7fcd2d3caa607a5088f600dc0bd3115388bea805f3df. Saved native83089/artifact1791997353039 passes original6 groups plus24 exact field refusals/6 corrections across6 CSS profiles; actual1 Send/1 abort, host11556exit0/native-hidden. Independent audit verifies source case coverage, exact final danger colors, labels/descriptions/focus, native durable corrections, unknown fields/history preservation, exact original buffers f0b51/d8b032, empty original cookie/plugin inventory and one registered owned fixture-cookie cleanup. Restoration1791997352809 passes original pre-cold-Save hashes; post-native complete source recheck83690 passes. Native marker records actual path/PID/observedexit0/owned-exited with reconstructed provenance and no initial-absence claim. No owned native/WebView or live feature processes remain.

This is fixture-based folder/request/subtree/move/order/search/Cancel/delete and field acceptance on current Windows source, not every collection UI lifecycle or every legacy resource model. Actual collection UI create/duplicate/delete, remaining manual bodies/history/send boundaries, callback-drain refusal, other platforms, AT, physical-width/OS-close and complete migration remain required.

## Topic records

<a id="record-agent-resource-field-validation-20261013"></a>

<details>
<summary>AGENT-RESOURCE-FIELD-VALIDATION-20261013</summary>

# ResourceManager validation association

Isolated feature from b95c089 / preceding inventory commit257b9d1. Local blank-name and malformed/non-object folder JSON failures now use existing Field.error. Corrected valid input clears its local error; synchronous topology/callback failures remain the form-level alert. Successful retry clears that alert. No CRUD callback/data policy, CSS, global Field, editor, dependencies or native code changed.

Root reviewed an actual invalid-name regression before authorizing LOCAL explicit Field.label for Name and Folder variables. Error text in the former implicit label changed its accessible name. The two explicit labels now keep exact names in valid/invalid states while error text is a description through the exact Field error ID. Other valid implicit labels remain untouched. Native label clicks still focus their controls.

## Evidence and limits

- Original source1a4eb656: saved24 missing-association failures (blank/malformed/array/null ×dark/light1440/900/760×600), with no callback/data change; `artifacts/resource-field-proof/negative`.
- Initial implicit-error version: exact Name locator fails when error enters the label; `negative-implicit-error-name`. That assertion was not discarded: final scenario explicitly asserts both exact names before/after each error and correction.
- Original source replay also preserves stale form alert after successful callback retry: `negative-stale-callback-retry`. Clearing form error at the next Save fixes this existing refusal/retry behavior.
- Final SAME saved resource-manager scenario `2e8df7` exit0: all original six last-collection/disabled-keyboard/confirmation/back assertions retained;24 local refusals, exact IDs/aria-invalid/aria-describedby, one local alert/no duplicate form alert, correction/trimmed exact patch/unchanged unknown fields, callback failure/retry, real label click, Enter submit, focus preservation, hover+focus danger priority/no outline/shadow, Escape modal dismissal and trigger restoration. These are component fixtures, not real/native CRUD acceptance.
- Six baseline/final profiles and12 controls have EXACT x/y/width/height/color/background/font equality. Captions use500 rather than400, the existing explicit Field.label public default approved by root; no CSS override was introduced. `baseline-geometry.json` and `geometry-audit.json` retain this distinction.
- Compiler44662 exit0/0errors/0warnings uses an explicitly verification-only preview helper supplement for four PREEXISTING fetch-option errors in plugin scenarios. The normal unsupplemented compiler4252 remains red4/0, unrelated to these three changed files. Root exact helper bytes and original bytes/SHA are archived in `verification/manifest.json`; the tracked helper was restored before commit and is NOT offered.
- Locked `bun install --frozen-lockfile --ignore-scripts` installed only own dependencies. Existing generate:openapi/plugin-buffer commands write ignored src/lib/generated outputs. Frontend build85516 exit0; full saved design-system55204 exit0. All own handles terminal; no browser/native/profile claim remains.

## Frozen handoff

Audit `artifacts/resource-field-proof/final/audit.json` SHA256 `eb755a429e4fdeee0ab2dfe57ef0e2baad1c4c8f5943a52b9f7a2e394fc0ffc0` binds775 snapshot/output files. `verification-source/<original path>` maps actual consumed source/harness (including the explicitly temporary preview supplement and generated files); `frontend` maps emitted build; `scenarios/resource-manager` and `scenarios/design-system` map output/bundle evidence. Original source bytes are in `artifacts/resource-field-proof/baseline/<path>`.

| Offered path | Original → new SHA256 |
| --- | --- |
| src/lib/components/ResourceManager.svelte | 1a4eb6565c48631721577aa470ff98dc83c13e0758f140d436ab2dee29c94912 → 5cd5571ac455460bcdfd1e75b034e6a548ae7b1675b50144706dee78cb142d57 |
| tests/ui/resource-manager.js | 20c64c6edc31e3f8eb833330e39a4df29d6630584da7202f70ae9a23263bc221 → c9f560dd253f1054d9158d2ed492266f608ba4295efd3863b051137d808dd1f9 |
| tests/ui/fixtures/resource-manager.svelte | b285d6ce004fe2541238becc8890f194e53134c8cbc776e461dd3bd49d448829 → 25cd0486e563b7ca1fb66ff4a98d3f24591b2387c7eadf081eced68b8bbef227 |

This report and own STATUS checkpoint accompany those three intended files. Do not integrate preview-app, generated files, dependency/build outputs or overlay own STATUS onto root. Root independently integrates/replays against its newer current source. Actual ResourceManager/native CRUD, real workspace persistence, assistive technology, other-platform and complete UI/migration gates remain open; no old native executable embeds this fix. Prior inventory/external proofs remain immutable.

Primary references read before implementation: [Svelte derived state](https://svelte.dev/docs/svelte/$derived), [Svelte effect dependencies](https://svelte.dev/docs/svelte/$effect), [WAI ARIA21 field error association](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA21.html). Existing Field/Input/Textarea public implementations supply the reactive association and existing theme styles; no new form subsystem was added.

Topic commit is reported in the final handoff; root owns integration/STATUS for its tree. `/compact` cannot be invoked in this interface, so this frozen handoff is provided instead. No live handles.


</details>

<a id="record-agent-resource-manager-current-native"></a>

<details>
<summary>AGENT-RESOURCE-MANAGER-CURRENT-NATIVE</summary>

# Actual isolated ResourceManager matrix — 2026-10-12

Current root product generation5c884ed; frontend/worker889 unchanged. Saved native matrix now passes on fixed test identity `app.insomnium.probe.resourcecrud20261012`. No product changes. Root owns topic commit and STATUS.

## Exact source delta

Only `tests/ui/resource-manager-native.js` is this lane's new guarded source delta: before `df115b984a3689620833cd535a2136e083bc319f773c55750c3683184d028b52`, after `eb4802dff48c92bd78fd1bc8590b2b0a848af3a51a07c99d8c618e1905bf25f3`. Original script retained in recovery artifact `resource-manager-native-before-diagnostics.js`; intermediate diagnostic/wait scripts also preserved. The corrected locator checks one select and label's direct text exactly `Location`, then keeps exact DOM/logical option IDs, self/child exclusions, selected destination inputValue and persisted destination parent assertions. It also saves explicit last-collection evidence before fixture insertion.

Native profile helper5a2f3739, identity guardsfb459e8f and cold guards7ebc843c belong to provider's separately reviewed root integration. Do not copy unrelated baseline/runtime changes. Root reviewed administrative recovery script86588179; old153 helper, first negative, original reserved marker and original212byte window-state remain preserved. No reset/deletion of old marker/profile. Only a new recovery record created.

## Evidence and gates

- Exact cold executable SHA `99f88b1c1af5175f9506ceca3fc6805038d945576aaa31906aea1ac85ca27307`,752 source archive files,51 current frontend assets, current worker889. New consumed9-file closure plus3 explicit supplements frozen under `artifacts/native-crud-recovery-directory-20261012`. Preflight1b14e5; readonly recoveryf97e12 and reviewed create179682. Old inferred native path is explicitly labelled inferred; subsequent actual native path/PID recorded before callbacks.
- Original foreign-select assertion365b69 and diagnostic80db56 fail intact; location diagnostic options were empty because exact `getByLabel` compares the wrapped label's complete text, including nested option labels. Strict readiness-only attempt40185/5aac10 times out. Accepted actual saved DOM proves `LocationMy Collection...source...destination`; every option DOM value equals compiled logical `__value` and exact persisted resource ID. No product assertion trimmed or removed.
- Final saved scenario `bun tests/ui/resource-manager-native.js`, explicit build-state and NEW recovered ownership proof: session14938/c0aa80 ->335b92 terminal0. Output `artifacts/playwright/resource-manager-native-1791785212627`, host47904 exits0/native-hidden; owned window visibility false. No default native host launched.
- Six actual native matrix rows pass: before-fixture one-collection Delete disabled/title/Tab skip; nested folder/request create/rename; duplicate subtree fresh IDs/parents/reference remapping/literal payload preservation/private exclusions/no response-history copy/reload; sibling reorder/bounds/search/reset/reload; running foreign move refusal, real native Cancel, valid foreign move/switch/reload; cancelled delete then subtree/private/history/tab removal with copy preserved/reload. Exactly1 network request and1 abort before fixture release. Original owned initial resources preserved.
- Restoration `resource-manager-restoration-1791785212389` passes: both captured workspace buffers SHA exact, immutable store/cookie inventory empty, one new fixture cookie removed only with absent-before, registered actual workspace ID/name, changed-workspace binding and exact path/hash. Originally absent files handled explicitly in earlier cold run. No original default profile resources touched.
- Independent post-audit8b43b0: `artifacts/native-crud-recovery-directory-20261012/audit.json` verifies revised consumed bytes, same executable,6 groups, actual last-collection record, exact restored buffer bytes, empty cookie file-set, registered selective cleanup, actual native path/PID47904/observedexit0, unchanged original reserved marker and no owned live processes. Isolated namespace released after this audit. Final compiler23695/1b8ad7 terminal0errors/0warnings; saved script Bun compile324bad passes8modules. No product build required because product/embedded frontend unchanged.

Historical default unbound empty cookie remains untouched and its cleanup gate remains OPEN. Native SDL export, OS-close lifecycle, Event held-sync/FIFO/full-platform and remaining migration/UX requirements are not covered by this matrix. No full migration completion claim.

All own handles terminal; no owned native host. `/compact` unavailable in this interface; explicit handoff provided for root's topic commit/STATUS update.


</details>

<a id="record-agent-resource-manager"></a>

<details>
<summary>AGENT-RESOURCE-MANAGER</summary>

# ResourceManager saved gate preparation

2026-10-12. Test-only isolated worktree preparation. No product edits or native
launch. New files only; previous UI topics/native preparation are excluded.

## Prepared native matrix

`tests/ui/resource-manager-native.js` uses existing withNativeApp/poll and shared
rename actions, with an explicit current build-record requirement. Fixture-only
collections are added while original probe resources remain present. Actual UI
steps create nested folders/request, rename, validate folder-variable refusal,
verify self/descendant destination exclusion, duplicate the subtree, reorder,
search/reset, refuse moving a running subtree across collections, Cancel the one
controlled native Send before fixture release, move/switch/reload, cancel a delete
confirmation, then delete original children/private/history/tabs and retain copy.

Copy assertions require unique fresh IDs, preserved complete payload, owned
parent/requestId/activePayloadId reference remapping, foreign sourceSpecId retained,
literal IDs inside body/header/payload retained, fresh timestamps, no OAuth token,
run-result or local workspace metadata copied, no history duplicated and original
subtree unchanged. Full original probe resources must remain identical. Save and
reload boundaries are explicit; controlled server permits only the one owned Send.

`helpers/resource-manager-cases.js` reuses the established native restoration
pattern: validates exact non-symlink probe profile/files, records workspace current
and previous bytes, always restores them after owned native host exits, and checks
the entire cookies file-set/content hashes and both plugin-store files unchanged.
No plugin/cookie mutation commands are issued. Restoration failure throws and writes
an explicit result; no success claim after changed immutable files.

Current native scenario has **not run**. Its assertions are intended acceptance
requirements, not verified native behavior. Native last-collection remains OPEN:
existing probe collections cannot be removed to manufacture that state.

## Actual component guard

`resource-manager.js` and isolated `fixtures/resource-manager.{svelte,js}` mount
the actual ResourceManager with only owned data. Six dark/light ×1440/900/760
profiles verify disabled Delete/title for one collection, keyboard skips it,
second collection enables confirmation, Back performs no mutation and removing
the second restores the guard. 0783ec terminal0; evidence
`artifacts/playwright/resource-manager/{acceptance,result}.json`.
This is component evidence only; it does not replace the native last-collection gate.

## Compile / exact new files

- `bun run check`: first62911/d4a50c failed25 scenario typing errors; fixed with
  typed workspace returns/resource assertions/native locators/options and async
  poll callbacks, no suppression/exclusion/assertion removal. Final15028/94d564
  terminal0, 0 errors/0 warnings. No app build was needed/started.
- `bun build tests/ui/resource-manager-native.js --target bun --packages external
  --outfile artifacts/resource-manager-native-compiled.js`: a06f40 terminal0,
  seven local modules compiled. Initial full dependency bundle1c3c23 could not
  resolve Playwright's optional chromium-bidi modules; packages external keeps the
  existing locked runtime dependencies, without installing/altering any package.

| New file | SHA256 |
| --- | --- |
| `tests/ui/helpers/resource-manager-cases.js` | `45c74016f1cb740d40716dd9c352fb478ce5ab986af9eb8927afed6ca8d7b438` |
| `tests/ui/resource-manager-native.js` | `3cfc1452b30643086c413c2518110d26eb5e88a1508ab793a311c264cfb7d92d` |
| `tests/ui/resource-manager.js` | `63950561a986a40547e8e86a157ce854e18f44ebb5d64feaf0d9ee318653ae33` |
| `tests/ui/fixtures/resource-manager.svelte` | `a5c896eddaa6aff37c0a65080c7e95cc2d5b0b2a4c8b1a045517242afe0b8cbe` |
| `tests/ui/fixtures/resource-manager.js` | `4a05fb49f582f31a198197c67387b8152ea109f9129e2f67177861dee5b4fed7` |

This document is the sixth integration file. Sources frozen; all own checks are
terminal. Do not integrate into root while its native source freeze is live.

## Legacy and future native isolation

Read-only reference: `_backup/legacy-electron/packages/insomnia/src/common/database.ts:127-165`
generates fresh IDs/timestamps, recurses through copied parent IDs and skips models
whose canDuplicate is false. `models/response.ts:17`, `workspace-meta.ts:12` and
`unit-test-result.ts:10` explicitly disallow duplication. Current response history
lives separately from resources, so test does not invent legacy response records
in the current model or dispatch network requests merely to create copy history.

Root requested minimal proposal only, not helper/identity/build changes:
future separate overlay identifier `app.insomnium.probe.resourcecrud20261012` uses
Tauri's fresh OS app_data_dir. withNativeApp would need one explicit fixed
test-identity allowlist option, retaining exact record.identifier, embedded binary
identity, artifacts boundary, hidden owned window and cleanup checks; preservation
helper must select the same allowed identity. A first start of that new probe has
one default collection, enabling actual native last-collection checks before
owned fixtures are added, without deleting any original profile data. APPDATA env
is not an isolation substitute. Production identity never permitted. No such
changes/build started; latest-root existing-identity candidate first closes
rename/GraphQL/API gates.

Native rename+GraphQL remain ready and pending audited latest candidate/serialized
profile access. No full CRUD/UI/migration acceptance or requirement removal.
`/compact` unavailable; this is the handoff, not compaction.


</details>

<a id="record-agent-resource-preservation-v2"></a>

<details>
<summary>AGENT-RESOURCE-PRESERVATION-V2</summary>

# Default UI and isolated CRUD native harness — frozen v2

2026-10-12. No new native launch in this preparation. Product Button correction
and exact GraphQL transition wait are separate root topics `1986356`/`5c884ed`.
Old1084 UI results and the unbound empty cookie are preserved; no retroactive
cleanup/acceptance or deletion of that file.

## Default entrypoints / ownership registration

Both standard `bun tests/ui/graphql-editor.js` and
`bun tests/ui/editable-name-native.js` now wrap their existing actual native
scenario in `withResourceProbePreserved` themselves. Call them directly/serially;
do **not** nest the old artifact runner's preservation context. The standard
GraphQL script captures and registers its actual persisted imported collection
ID/name, writes `owned-collection.json`, then performs Fetch/remaining checks.

Reusable `registerResourceProbeCollection(id, name)` is exported for the root SDL
scenario to call immediately after actual saved import and before Fetch. It does
not authorize deletion of any old ID: the active preservation wrapper rejects
IDs present in the captured original workspace. Calling registration outside an
active wrapper throws explicitly; standard entrypoints here are self-contained.

## Preservation behavior

Default profile derives from provider's Windows KnownFolder helper plus the exact
existing probe identity; both existing workspace buffers are required. Full cookie
file-set/content hashes and plugin store/current+previous presence are captured.
Changed current/previous workspace bytes are saved **before** either is restored.
New cookie cleanup requires: absent original inventory; registered new ID/name;
actual final changed workspace resource with matching ID/type/name; exact fixed
profile/path; regular non-symlink file; unchanged captured SHA. Its bytes and
collection binding are frozen before deleting only that owned new file. Unknown
new files remain and fail the concise restoration audit. All originals must have
the exact final file-set/hashes; workspace buffers restore their exact bytes.

This does not adopt the prior unbound `wrk_0932ea...json`; it is an original file
in later inventories, remains untouched, and its old cleanup gate remains open.

## Cold isolated native CRUD

Native script now requires `INSOMNIUM_UI_BUILD_STATE` AND
`INSOMNIUM_UI_PROFILE_OWNERSHIP`, passes the fixed test-only
`resourceCrudProbeIdentifier` through provider's closed allowlist helper, and
uses only its validated Windows KnownFolder app_data_dir. No APPDATA override,
production identity or arbitrary identifier/prefix is accepted.

`withResourceProbePreserved(..., {expectedIdentifier, profileOwnershipPath,
lazyCapture:true})` is permitted only for that fixed CRUD identity. The native
helper verifies actual native app_data_dir/owned marker before the scenario runs.
Before inserting fixtures, actual native UI must show exactly one collection,
disabled Delete/title and keyboard skipping the last-collection action. The
scenario saves the initial owned UI model, then captures the lazily initialized
buffers before any fixture writes. Initially absent previous buffer/store/cookie
files are handled explicitly; originally absent previous buffer created by fixture
writes is removed only from this fixed owned isolated profile after host exits.

Both source/destination fixture IDs are registered from actual saved native data.
Remaining create/copy/remap/literal/private/history/order/search/reload/running
move refusal/Cancel/foreign move/delete confirmation/deletion gates remain intact.
Neither isolated CRUD nor freshly corrected native rename/GraphQL has run yet;
await current-generation source/assets/exe/identity/prelaunch audit and lane handoff.

## Frozen files / verification

| Path | SHA256 |
| --- | --- |
| `tests/ui/helpers/resource-manager-cases.js` | `dd67cbf8f06dcc7c9cc8160d5b1dedf86edd4ae1d674fc07f009c08e8b3c918b` |
| `tests/ui/resource-manager-native.js` | `df115b984a3689620833cd535a2136e083bc319f773c55750c3683184d028b52` |
| `tests/ui/graphql-editor.js` | `f0e296205d253e11878a3415b26adebeebb4e0ac71a5d596aad47a2728d93d21` |
| `tests/ui/editable-name-native.js` | `75b6f54b82f8ea7fb5f21332e104f8bbbdf2ab6b71c478a3eb9f7bdb8bbc3f6e` |
| provider-owned `tests/ui/helpers/native-app.js` | `b5a7d840221db88d8ef8347e3e9a506d6950678b2d60e4e0785a8dbece35e5ed` |
| provider-owned `tests/ui/helpers/native-profile-ownership.js` | `15312e1964f8bbdbf6c989471c6f47d3c064bdf6a08f38d2a1a13bd430000ecc` |

Provider helper files were copied byte-identically, not modified by this agent;
root should integrate their independently reviewed provider delta once only.
Previous three new component fixture/script paths remain unchanged, with SHA in
COLLECTIONS.md#record-agent-resource-manager. Integrate new CRUD paths once and replace the native
UI entrypoints against already integrated prior versions; no baseline runtime
or CRLF alignment imports belong to this delta.

Final active-wrapper registration assertion check18144/1d5fee terminal0/0errors/
0warnings; prior self-contained entrypoint check25767/8536e4 also0/0.
`bun build` three saved native entrypoints with `--target bun --packages external`
a31222 terminal0 (16 local modules). Component last-collection rerun46709c
terminal0/6profiles. Prior intermediate check21050/082062 also0/0.
No product rebuild/native launch or owned live processes during this preparation.

All own handles terminal; source/harness frozen for root/provider capture. Full
CRUD/UI/GraphQL/platform/provider/migration gates remain. `/compact` cannot be
invoked here; this is the handoff, not compaction.


</details>

<a id="record-agent-shared-ui"></a>

<details>
<summary>AGENT-SHARED-UI</summary>

# Shared UI agent — request rename keyboard focus

2026-10-12. Isolated worktree: `E:\.dvgamerr-app\insomnium-agent-shared-ui`.
Baseline HEAD: `25fa97a62e55fae680ff01809fc30119396703b8` plus root's copied WIP.
Only the four paths below changed; none occurs in `artifacts/agent-baseline.json`,
so their HEAD-relative diff is the exact agent delta. No copied baseline was staged
or committed. Root owns integration and the verified topic commit.

## Behavior

Enter/ Escape formerly removed the focused rename input and stranded keyboard
focus on the document. The saved regression fails before the fix at
`dark/1440/Enter restores focus` (false instead of true). Original source, saved
scenario, failed result and screenshot remain in
`artifacts/editable-name-focus-negative/`.

EditableName now restores focus to its display trigger after Enter saves or
Escape cancels, after Svelte updates the DOM. A synchronous restoration guard
prevents its focus-to-edit handler from immediately reopening. Subsequent Enter,
pointer activation and ordinary focus still reopen. Blur/Tab keep their selected
destination. Existing trimming, unchanged value, Unicode, parent-update and
callback-count behavior remains covered.

The display uses the shared plain Button. Button adds optional bindable native
`element` for focus management, retaining its existing type/disabled/busy/native
attributes and styles. EditableName retains its existing layout declarations;
focus presentation comes from the shared focus stylesheet and theme token.

## Exact changed files / SHA256

| File | SHA256 |
| --- | --- |
| `src/lib/components/ui/Button.svelte` | `67d0a150ba0cb6db143bd764665334fc44bd67d2d5827fc65a7cb0be9ee6e169` |
| `src/lib/components/ui/EditableName.svelte` | `ef4ba8515e046bd4cce615537c9bb596f96444114a6251d170a69e2ef42fb5f6` |
| `src/lib/components/ui/README.md` | `bbf0e65a2777921d33164dd07cfb1894a4497c93f07ddd5621c192f5f4dc6348` |
| `tests/ui/editable-name.js` | `97bd95d610dcf274b2286151ad03cf44194d7abca7b01aecfad8b688039009f0` |

This handoff document is the fifth integration file. Do not copy build/generated
outputs or the dependency junction into production source.

## Validation

- `bun tests/ui/editable-name.js`: terminal 0 (015cd7). Original 18 rename cases
  plus 8 dark/light, 1440/760 width, Enter/Escape profiles; restored focus,
  focus-visible, no immediate reopen, explicit Enter reopen, Tab destination,
  pointer reopen and measured `--focus-surface` override/restoration. Evidence:
  `artifacts/playwright/editable-name/{result,acceptance}.json`.
- `bun tests/ui/design-system.js`: session 11179 terminal 0 (3d8dcf), saved
  result status passed. Existing shared controls/field/dialog/tab/token contracts.
- `bun run check`: session 57468 terminal 0 (1d498d), 0 errors / 0 warnings.
  Initial isolated check had five missing ignored generated-module errors; resolved
  with the documented existing `bun run prepare` generators, not source edits.
- `bun run build`: session 16982 terminal 0 (8d1cf2); production static build.
  Initial shared dependency junction made Vite's internal config loading fail at
  the root's `.vite-temp` path, also with `--configLoader runner`. Moved only this
  worktree's junction to `node_modules-shared`, then
  `bun install --frozen-lockfile --ignore-scripts` (31063 terminal 0), using own
  locked dependencies. Root dependency target was not changed.
- `git diff --check` on four changed paths: terminal 0.

All task handles are terminal, fixture browsers/servers closed by their saved
helpers. All browser scenarios use shared `launchUiBrowser` headless. Production
source is frozen for root integration.

Native keyboard behavior has not been verified on a newly built Tauri executable.
Root must run its integration checks and decide the required native gate before
the topic commit. No full UI debt or migration completion is claimed.

References consulted: [Svelte bind:this](https://svelte.dev/docs/svelte/bind#bind:this)
and [Vite config loading](https://vite.dev/config/). Existing Svelte `tick` is used
to wait for the conditional DOM update; no new subsystem/dependency introduced.

`/compact` is unavailable in this agent interface. This document is the handoff,
not a claim that compaction occurred. No next feature has been started.


</details>

<a id="record-collection-actions-hover"></a>

<details>
<summary>COLLECTION-ACTIONS-HOVER</summary>

# Collection row hover and actions — 2026-10-12

The entire request/folder row owns its hover surface. Management actions appear on row hover or keyboard focus; selected requests retain the selected token. Existing uncommitted row/action styling is now verified and committed with the correction below. Layout, tokens and shared Button behavior are preserved.

The old collection override lost to the shared plain-button hover rule because the latter includes additional class and eligibility selectors. Actual saved `collection-actions.js` reproduced a second translucent hover fill on the nested button. The collection selector now targets its actual shared button and the same enabled/non-focus eligibility with sufficient specificity. No global primitive rule or !important changed. Consulted [MDN CSS specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascade/Specificity) before the correction.

Saved Bun command: `bun tests/ui/collection-actions.js`. It seeds only private browser storage, checks selected request/idle request/folder at dark/light ×1440/900/760, points at padding outside both buttons, checks exact row token and transparent hovered nested button, reaches the exact management action with Tab, activates with Enter and dismisses with Escape. All18 rows pass; resources/history remain unchanged by actions. Existing full `bun tests/ui/nocturne-theme.js` passes (session75680). Build53579 and compiler69243 exit0,0errors/0warnings. Full source/build/fixtures/results are frozen in artifacts/collection-actions-root-proof/audit.json.

Exact failing scenario/source/PNG/result frozen in artifacts/collection-actions-hover-negative. Initial test incorrectly expected an unhovered selected button to be transparent; that separate probe error is retained in collection-actions-wrong-hover-negative and is not product evidence. Subsequent JSDoc tuple/nullability errors corrected before finalcompiler. Tests use saved headless launch; no native/OS/network scenario. Native current-generation hover acceptance and full UI/accessibility/migration remain required. `/compact` unavailable; explicit handoff.


</details>

<a id="record-collection-index"></a>

<details>
<summary>COLLECTION-INDEX</summary>

# Collection ancestry indexing and responsiveness

The XML mounted acceptance exposed a34970.5ms collection-switch cancellation delay. Saved workspace-only profiling reuses `tests/ui/xml-request-format.js` with `INSOMNIUM_XML_CASE_SET=workspace` and `INSOMNIUM_XML_PROFILE=1`. Shared native helper hides its owned Tauri host before CDP attachment; no browser-use or ad-hoc automation. The reusable CPU helper uses documented [Playwright CDPSession](https://playwright.dev/docs/api/class-cdpsession) and [CDP Profiler](https://chromedevtools.github.io/devtools-protocol/tot/Profiler/). No generator or dependency installation was needed.

Baseline native95987 actualterminal0/artifact1791595222171/native10608/exit0/native-hidden/visible:false retains causal timer/body/destination guards. Aggregate initial data:8308resources,20history entries,9207611JSON bytes. Profile38.096s, cancellation37.831s. Raw samples, compiled script sources and frame locations identify `workspaceFor` in selection and page-derived requests:36.308s inclusive,95.305% of sampled duration. `collection-switch-baseline-audit.json` records calculation. Snapshot/serialization is not the dominant captured CPU cost. Profiling overhead exists; the independent unprofiled prior34.971s observation supports the same symptom. Owned baseline Bun10268/native10608 and exact profile absent after terminal.

`indexWorkspaces` builds an explicit topology index with memoized iterative ancestry paths. It eagerly reads ID/type/parent fields so Svelte derived consumers invalidate on in-place reparenting, type/ID changes, array edits and state replacement. It retains empty results for missing parents/cycles and first-resource semantics for duplicate IDs; collection roots stop ancestry even if their parent is malformed. No global mutable-array cache, persistence queue or save semantics changed. Application selection uses one index per operation; page request/environment and Runner request filters use a derived index. UI markup/CSS is preserved. Official [Svelte derived dependencies](https://svelte.dev/docs/svelte/$derived#Understanding-dependencies), [state snapshots](https://svelte.dev/docs/svelte/$state#state.snapshot) and [JavaScript Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) consulted before implementation.

Saved `bun tests/ui/collection-index.js` passes316model rows and10reactive controls:15literal topology policies,300deterministic graph comparisons against the unchanged legacy lookup,20000-node reverse chain with80000topology reads/16ms, plus reactive folder/environment moves, type restoration, ID change, add/remove/replace and body-edit stability. These fixtures prove topology/derived behavior, not production/native responsiveness. Compiler0errors0warnings. Initial profiler optional-sample diagnostics corrected. An initial formatter pass touched unrelated page layout formatting; reduced page change to only import/index/two lookup expressions before freeze/build. No behavioral UI/CSS change.

Fresh production saved build6610 actualterminal0 started1791595596808/finished1791595980383/launcher41096, executable SHA256 `89bbb5113131162b58a4d16b11586a90cc5efadb2c3839ec834939181f14cd18`. Source freeze collection-index-source-freeze.json retains465app/223scenario688 hashes, exactly four app changes. Retained old executable/build/hash in artifacts/native-collection-index-baseline before overwrite. Current production headless `bun tests/ui/nocturne-workspace.js` terminal0 accepts11workflow/layout checks, including Tests/API/GraphQL, dropdown, split and1440/900/760 widths. No CSS or markup change.

Native command sets `INSOMNIUM_XML_CASE_SET=all` and `INSOMNIUM_XML_WORKSPACE_BUDGET_MS=3000`, then runs `bun tests/ui/xml-request-format.js`. First43255/artifact1791595996314 was interrupted: missing unified handle, owned Bun57684/native58844 absent, no result, one recorded real workflow only. PID58844 was later reused by conhost; no stale-PID termination. It is retained as inconclusive. Rerun83428 actualterminal0/artifact1791596301797/native49908/exit0/native-hidden/visible:false accepts all18current-source groups and6actual XML workers, with three literal/full-field Git/Undo/Redo/save/reload workflows, six timer-causal cancellation boundaries, six controlled faults (including observed timeout callback) and three real refusals. Initial8316resources/20history/9209710bytes is larger than baseline. Workspace cancellation1357.2ms meets3000ms budget, versus34970.5ms unprofiled baseline (25.77× improvement); timer is cleared before callback and destination editor/complete secondary request retained. This measures cancellation during collection navigation, not arbitrary first-paint or general workspace performance.

Existing Runner scenario now checks exact blank/owned request options, correct available `GET · Preserved local request` label and selected ID. Initial27575/artifact1791596848350 actualterminal1/native64064/exit0 failed a new regex which omitted the existing middle-dot separator; UI was correct. Corrected only expected label, preserving failure and adding choice diagnostics. No app/build change. Corrected `INSOMNIUM_UI_BUILD_STATE=artifacts/native-recovery-copy-probe/build-state.json bun tests/ui/runner-lifecycle.js`30305 actualterminal0/artifact1791597154206/native62912/exit0/native-hidden/visible:false accepts two exact choices, eight lifecycle/layout states, four native HTTP Sends, one cancelled held call, persisted result/history, fresh run after Stop and dark/light1440/900/760. Final compiler0errors0warnings. Acceptance freeze records only one external Runner scenario change against original688; application/XML hashes remain identical.

Artifact hash tooling crashed Bun1.4.2 at0x48. The initial shell mistakenly proceeded to Runner after failed freeze, so no prelaunch freeze is claimed for failed27575. Explicit text parsing alone and split Bun.CryptoHasher allocation did not resolve the complete hash script; no JSON-parser root cause is established. Saved artifact audit now uses node:fs/node:crypto modules inside Bun, succeeding on identical bytes without launching Node or changing runtime/dependencies. Corrected Runner launched only after verified new freeze. Tool failures did not change product source.

`bun artifacts/playwright/collection-index-audit.mjs artifacts/playwright/xml-request-format-1791596301797 artifacts/playwright/runner-lifecycle-1791597154206` passes, producing collection-index-independent-audit.json. It independently compares literal XML/complete YAML Git fields, all timer/destination records, topology/reactive rows, Runner choices/states, both current native results, larger dataset, current688hashes, four exact app edits, preserved baseline executable and actual fresh build/executable bytes. Source/commands/failures/evidence are preserved. Cleanup collection-index-cleanup.json verifies no owned baseline/interrupted/failed/accepted probe/Bun/exact WebView profiles, Runner listener or live feature handles; reused conhost PID is explicitly ignored. Dark760Runner and light760XML refusal screenshots inspected, retaining layout and original-content refusal feedback.

Full migration/UX/CSS remains active. This selected correction closes the captured ancestry lookup stall in the local Windows probe, while arbitrary workspace-size/platform/renderer/overall persistence performance and all remaining migration/shared UI gates stay required. Record actual topic SHA/evidence/remaining gates/no live handles in STATUS before handoff; this interface cannot invoke `/compact` and no compaction is claimed.


</details>
