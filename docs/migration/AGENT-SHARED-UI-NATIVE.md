# Native UI gates — saved scenario preparation

2026-10-12. Root has committed rename focus `af49d71` and GraphQL selected
foreground `38a98fb`. Worktree `E:\.dvgamerr-app\insomnium-agent-shared-ui`
has both prior frozen deltas, not the root's newer branch HEAD. The next delta
contains only the three script paths below and this report; do not reinclude any
previous feature file.

## Prepared checks

- Existing `editName` helper now checks completion leaves no input open and
  preserves the expected focus destination: blur target for blur; rename trigger
  for Enter/Escape. This applies to original 18 component and 60 native rename
  cases, including actual changed/blank/cancelled drafts.
- Existing component keyboard contract is refactored into
  `assertRenameKeyboard(page, leave)` in the same helper. It tests 8 dark/light,
  1440/760, Enter/Escape profiles with focus-visible/no immediate reopen, Enter
  reopening, Tab to the supplied actual next control, pointer reopen/dismissal,
  measured shared focus token, and theme/viewport restoration.
- Existing native rename script calls the same contract in HTTP, GraphQL, SSE
  and WebSocket workflows, expecting exactly 32 rows. Its actual next control is
  "Move or manage request". Each workflow's keyboard profiles must perform zero
  save_workspace calls and leave the entire workspace exactly unchanged. Existing
  60 rename persistence/reload/Git/no-network assertions remain intact.
- Existing native `graphql-editor.js` already calls shared
  `assertGraphqlSegmented`, added in the prior committed topic. No duplicate native
  scenario/build was created.

## Current script SHA256

| Script | SHA256 |
| --- | --- |
| `tests/ui/helpers/editable-name-cases.js` | `2763ee84699b39e6835ba14932267fe28ff43a2dcc46943932acdd55f83a0b28` |
| `tests/ui/editable-name.js` | `4a8ce077c90582ff8cb09d4a5a12935d6b1ec08eada4dd9054a4086691b1b552` |
| `tests/ui/editable-name-native.js` | `e49063f67a4b620e7c54a962128beed08ec71fb8e5efb0a2675de446685654fd` |

Only editable-name.js overlaps a prior topic: take its current complete script
as the delta against root's already-integrated af49d71 version. Existing full
contract block was moved without dropping assertions; native uses the same code.

## Evidence / pending authorization

`bun tests/ui/editable-name.js` 66b74f then b82001 terminal 0, preserving all
18 original cases +8 keyboard profiles. Second replay includes the new original
case focus assertions. Current `git diff --check` c897ee terminal 0. No production
source or dependency change; all task handles terminal.

Native provider agent confirmed its currently frozen 730-source candidate predates
both UI topics. It must not be used to claim new UI acceptance. Root requested
one later latest-source native overlay/build; neither native UI scenario has been
launched yet. Await root authorization of an artifact proven to include the latest
UI assets, then run these existing scenarios serially through withNativeApp
(native-hidden before CDP, probe identity/data, owned cleanup), inspect exact
acceptance/source/build hashes and report every remaining native gate accurately.

`/compact` is unavailable. This is the prepared handoff, not compaction or native
acceptance. Both native gates remain open until actual current-candidate results.
