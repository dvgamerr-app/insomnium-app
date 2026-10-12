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
