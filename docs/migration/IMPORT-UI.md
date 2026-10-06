# Desktop import entry flow

Updated: 2026-09-29. Desktop paste flow verified natively; OS file-picker acceptance remains pending.

## Problem and change

Native Import immediately opened the file picker. The paste/review UI was only reachable in browser preview, so desktop users could not paste cURL or collection text.

Import now opens the existing review dialog on both platforms. Users can paste text or explicitly choose a collection file. Desktop keeps the Tauri picker, including multiple legacy .db selection; preview keeps its file input. Parsing errors stay in the dialog, cancellation preserves pasted text, and import still requires the existing review/apply step before adding resources.

While a read/picker is pending, file/paste/review controls are disabled. Each modal lifetime has a revision; late file results and errors are discarded after close, reopen or switching dialogs. Review cannot mutate collections until Import is confirmed.

## Sources consulted before implementation

- [Tauri dialog](https://v2.tauri.app/plugin/dialog/) — installed plugin's file selection behavior. Reused existing pickImport; no generator/dependency install needed.
- [Svelte bindings](https://svelte.dev/docs/svelte/bind) — textarea/file bindings and events.
- Existing page modal lifecycle and import-export.js parsing/picker; prior native observation in NATIVE-RUNNER-ACCEPTANCE.md.

## Verification

- Actual source functions with the real parser and controlled picker/file promises passed 11 inline assertions: modal entry without picker, cancellation preserving text, parsed review, close cleanup, busy/duplicate prevention, stale reply after reopen, parse failure/recovery and late error after switching modal.
- These are lifecycle checks, not proof of OS picker interaction.
- Prettier, bun run check (0 errors/0 warnings) and bun run build passed.
- Native release probe build started with the documented isolated overlay, corrected MSVC child environment and null build hook. Observe artifacts/native-import-probe/build-state.json and build.log; do not restart a live build.
- No saved development test script or production installer created.

## Next native checks

Open Import in the rebuilt probe, verify paste is visible without a file dialog, reject invalid text, review a literal cURL command, cancel without mutation, apply additively and reload. Inspect screenshot and preserve preexisting probe collections. OS file-picker selection/cancellation and multi-file legacy import must still receive actual platform acceptance.

## Native desktop acceptance — 2026-09-29

Release probe build completed at 08:16:33 UTC with exit 0 (4m56s). Opened the rebuilt executable with the same isolated probe identifier and a separate WebView profile; native API confirmed the identity. Production configuration and BUILD.json were not changed.

Using actual mounted UI through the probe's loopback CDP endpoint:

- Import opened the paste dialog immediately, with the explicit Choose collection file button and disabled empty Review button. Captured and visually inspected import-entry.png.
- Invalid text displayed the concrete parser error (Flow map must end with a closing brace). A subsequent valid literal cURL input cleared it and displayed review.
- Cancel retained identical saved resources and HTTP history; reopening started with empty input.
- Apply added exactly two resources (collection and POST request). Verified URL, custom header and literal JSON body. Original resource IDs remained and HTTP history was unchanged.
- A fresh-document reload preserved the imported resources and selected request URL.
- No imported command was executed as a shell command and no request was sent to its URL.

Evidence: ignored artifacts/native-import-probe/{build-state.json,build.log,app-state.json,baseline.json,cancel-evidence.json,apply-evidence.json,reload-evidence.json,import-entry.png,import-applied.png}. The baseline belongs to the isolated probe, not production data. Probe cleanup used allowed destroy after idle persistence verification; confirm app-state.json for exit. No fixture server or development test file was needed.

Remaining acceptance: actual OS file-picker selection/cancellation, multiple legacy .db import, alternate formats and broader import/export recovery. The 11 prior inline lifecycle checks cover controlled picker promises, not OS UI. Full migration remains incomplete.
