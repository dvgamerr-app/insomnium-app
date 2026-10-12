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
