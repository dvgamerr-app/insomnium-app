# Shared UI agent — GraphQL selected foreground ownership

2026-10-12. Worktree `E:\.dvgamerr-app\insomnium-agent-shared-ui`.
Root committed the previous rename feature as `af49d71`; this worktree still has
its older HEAD plus copied baseline and that frozen rename delta. Integrate only
the four paths below plus this report. Do not reinclude previous rename files or
any copied baseline. None of the existing three paths is listed in the copied
`artifacts/agent-baseline.json`; their HEAD-relative changes are this topic only.

## Change

GraphqlEditor's Query/Schema SegmentedControl uses the shared selected
presentation. `styles/variants.css` nevertheless overrode its selected foreground
with `--accent`, bypassing the shared `--accent-text` contract from
`styles/navigation.css`. Removed only that four-line rule. Layout, density,
interaction handlers and both selection surfaces are unchanged.

Saved actual-application regression fails before the fix at
`dark/1440/Query semantic selected foreground`: actual `rgb(10, 20, 30)` from
overridden accent versus expected `rgb(101, 132, 163)` from semantic foreground.
Original rule, helper/scenario, failed result and screenshot remain in
`artifacts/graphql-segmented-negative/`.

The reusable saved helper checks the actual GraphqlEditor Query/Schema choices
with Space/Enter activation, exactly one pressed button, real consuming view
change, retained focus-visible, independent local accent/selected/focus tokens,
hover while focused and selected background after focus leaves. Token values and
priorities, theme and viewport restore afterward; Query view restores before
the existing scenario continues. Existing actual-app headless theme and native
GraphQL scripts call the same helper; no new scenario entry point.

## Four changed paths / SHA256

| File | SHA256 |
| --- | --- |
| `src/lib/components/ui/styles/variants.css` | `8ee7386db19ade5fbcac95d4a118d2b1d7cd36e767461ccf7411bbf589b09bc7` |
| `tests/ui/helpers/graphql-segmented.js` (new) | `ad1e9353d06c15f8d18911b45482520c1eaf98b104c2352425e26b238f974284` |
| `tests/ui/nocturne-theme.js` | `b672b3316de1d6ff11c032209e94dd96c0cf735f070d95108c96f4a5c8276c3e` |
| `tests/ui/graphql-editor.js` | `c91ee1e650f0c087da5216f3c556ba1b5f72d2044527d0cc4547f6486cbe29bc` |

## Verification / handoff

- `bun run build`: 335c2b terminal 0, current production static app.
- `bun run check`: session 7147/e2a0e7 terminal 0, 0 errors / 0 warnings.
- `bun tests/ui/nocturne-theme.js`: final session 14495/5f5712 terminal 0,
  existing whole actual-application theme scenario passed. The new helper records
  16 raw rows (8 dark/light ×1440/760×Query/Schema profiles repeated in the two
  existing theme workflows) under
  `artifacts/playwright/nocturne-theme/graphql-segmented.json`; overall result
  under `result.json`. Initial post-fix c4796a/288244 also passed before the
  additional actual-view assertion was added.
- Additional-view assertion initially queried textbox instead of the operation
  name's actual datalist combobox semantics. 528189 failed that selector; corrected
  to its accessible label, without weakening the view-switch assertion. Exact
  helper/result/image preserved in
  `artifacts/graphql-segmented-view-selector-negative/`.
- `git diff --check` for existing paths: 70c9b7 terminal 0.

Product source remained frozen throughout build/compiler/live scenarios. All
agent task handles are terminal; saved fixture browser/server cleanup completed.
Ready for root integration checks/topic commit. Native GraphQL replay of this new
helper was not run; it requires a newly built current Tauri executable and remains
an explicit native gate. No full UI debt or migration acceptance is claimed.

No new subsystem or dependency was introduced; existing shared selected/focus
ownership is documented in the UI README and UI-DESIGN-SYSTEM-DEBT.md.

`/compact` cannot be invoked by this interface. This is the handoff, not compaction.
No following feature was started.
