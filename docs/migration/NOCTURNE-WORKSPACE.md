# Nocturne workspace UI

Owner request (2026-10-05): Git in the left rail with a familiar source-control workflow, original visual styling, reusable controls, and resizable panels. This explicitly starts the previously deferred component/workflow scope. Migration parity remains separate.

## Shared components

`src/lib/components/ui` contains Svelte JavaScript primitives. Native attributes/events pass through controls; `value` is bindable for Input, Select and Textarea. Button defaults to `type="button"`; variants are primary, secondary, danger and ghost, with disabled/busy handling. Field associates an id with its label and renders description/error; callers connect `aria-describedby` to the rendered `<id>-description`/`<id>-error` when present. Native checkbox/file inputs keep their specialized behavior.

Modal owns native dialog open/cancel/close, heading association and focus restoration. Callers own state and submit behavior. Main application dialogs and Git branch/author/remote dialogs use it. Shared controls are also used by key/value editors across HTTP and gRPC.

SplitPane accepts `first`/`second` snippets, `storageKey`, accessible `label`, `axis`, initial percentage, pixel minima, optional stacking breakpoint and collapsed state. Drag the divider or focus it and use arrows (2%), Shift+arrows (10%), Home/End (bounds), Enter/double-click (reset). Only size preferences go into localStorage. Each content pane owns its scrolling. Applied to collection sidebar, request/response, gRPC, stream events/detail, GraphQL query/variables and schema explorer, API source/preview, test editor/results and Git changes/history/diff.

## Git behavior

- Ctrl+Shift+G opens Source Control; it is a workspace view, not a modal. Browser preview explains that repositories need the desktop app.
- Stage/unstage selects collection resources for the existing safe commit engine. Required collection metadata cannot be unstaged. Commit and Ctrl+Enter require author, message, branch and selected resources. No implicit commit-all.
- Draft message and staged selections survive tab navigation within the app session. Restoration compares repository, HEAD, and exact before/after content; changed resources require staging again. Draft resource contents are held in memory, never localStorage. These are collection-resource selections, not a general filesystem Git index or hunk staging system.
- History lanes derive from actual parent OIDs; details expose author, hash, parents and message. Pagination retains existing history limits. Branch creation/switch/delete and remote fetch reuse existing native coordinators. This change does not add push/pull/merge parity.

## References and checks

- [Svelte props](https://svelte.dev/docs/svelte/$props), [bindable](https://svelte.dev/docs/svelte/$bindable), [snippets](https://svelte.dev/docs/svelte/snippet).
- [WAI window splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) for focusable separator keyboard semantics; explicit compiler suppression documents this APG pattern.
- [VS Code staging workflow](https://code.visualstudio.com/docs/sourcecontrol/staging-commits), [history](https://code.visualstudio.com/docs/sourcecontrol/history): behavior reference only.
- `bun run check`, `bun run build`, `bun run test:ui:theme`, `bun tests/ui/nocturne-workspace.js`, `bun tests/ui/git-source-control.js`.
- Native scenario requires the isolated build record at `artifacts/native-nocturne-workspace-final/build-state.json`. See STATUS for actual execution results; a production installation is never used as a test fixture.

## Verified result

Final check reports0 errors/0 warnings; production frontend and isolated native build pass. Saved preview theme/workspace scenarios pass, including modal focus, responsive layout and splitter persistence. Final native source-control evidence: `artifacts/playwright/git-source-control-1791187244103/acceptance.json` (both modes,1440/900/760). Branch create/resume/forget/delete/stale protection, remote cancellation, checkout recovery, gRPC, WS/SSE and GraphQL schema splitter scenarios also passed; timestamps/build distinctions are recorded in STATUS.
