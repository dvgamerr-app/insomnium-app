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
AGENT-RESOURCE-MANAGER.md. Integrate new CRUD paths once and replace the native
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
