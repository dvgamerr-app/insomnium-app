# IMPORT EXPORT migration

Updated 2026-10-15. Desktop paste/review/apply is implemented. Legacy HTTP response assets/history have bounded headless and final Windows native acceptance with current source closure verified. Current cURL mixed/file and GET/file receipts pass (CURL-IMPORT.md); broader import/export and external-asset gates remain open.

See [current status](STATUS.md), [execution plan](PLAN.md) and [complete parity requirements](PARITY.md). No original scope was removed by consolidation.

## Current legacy response assets and history work

Implemented at4bc799d with saved scenarios at4818d7a. The feature preserves legacy response resources/provenance while projecting supported ordinary HTTP responses into saved history. Review explicitly selects the original data folder for bounded read-only body/timeline access, reports asset diagnostics and projects request/environment quotas plus the global 40 MiB serialized-history budget before Apply. Existing history remains intact, excluded imported responses remain resources, and Apply rechecks reviewed state. Portable export records the current selected imported response, with exact binary base64 and decoded-byte SHA256 checks.

Compiler97149 passes0 errors/0 warnings; Cargo1469 exits0. Corrected headless portable round-trip23938 passes; the original `artifacts/playwright/legacy-response-import` failure exposed stale selection metadata and remains immutable. Final headless4025 passes at `artifacts/playwright/legacy-response-import-oversize-before-read-final`: a genuine 67,108,865-byte File causes zero File.text calls and retains exact original state. Earlier oversize replays corrected a text-oracle prefix and an incorrect initial Cancel action to the actual Close dialog control.

Final candidate2 normal-hook build59164 exits0 (Rust6m44; executable SHA db695201f40b02150a68947ee9b6d8b2e605189cd58bb241d9621d245b256eb1). Native/postclosure25563 passes at artifacts/playwright/legacy-response-import-native-1792019386980:12 candidates project to8 histories, covering raw and concatenated-gzip bytes, empty/error/binary bodies and invalid-timeline diagnostics with body retained. Refusals cover missing files, bad gzip, outside-root/traversal paths, a20 MiB+1-byte sparse file, a decoded gzip bomb and independent2×17 MiB aggregate input. Genuine database-file selection, folder cancellation/grant, review Cancel, Apply, collection registration after actual UI creation, reload with4 saved history selections and exported bytes pass. All12 original source files and original profile buffers remain exact. Host28804 exits0; restoration1792019386769 preserves f0/d8 hashes; independent audit finds no owned host, descendants or fixed-profile WebView. The main host is native-hidden; owned OS picker popups are visible. Export SHA8070c8d7fd64e3f3b772c02dd50f0431339e05902b4abe0bd32f9dd5d773a81d matches the actual file. Post-native source closure is terminal0 with all verifyNativeBuildClosure keys satisfied; universal OS/loader/linkage/legal acceptance is not established.

Historical candidatev1 build51883 (exit0/Rust7m59; executable SHA prefix b9f8cee) predates the browser oversize guard. Eight immutable replays1792017676248/1792017899136/1792018076206/1792018227452/1792018459557/1792018503934/1792018563777/1792018649338 record basename/WM_SETTEXT failures, exit29 and primary/cleanup separation, owned WM_CHAR refinement, main-owner rehide/readiness corrections and the confirmed folder Edit1152 mode. Functional41555 onv1 passed the same bounded cases; candidate2 supersedes that receipt for current code. Initial source closure82365 passed before helper changes; all original source/profile files were preserved.

Implementation references: `src/lib/legacy-response-history.js`, `src/lib/legacy-import.js`, `src/lib/import-export.js`, `src/routes/+page.svelte` and `src-tauri/src/legacy_response.rs`. Original contracts: `_backup/legacy-electron/packages/insomnia/src/models/response.ts` and `src/network/network.ts`. Official references: [Tauri dialog](https://v2.tauri.app/plugin/dialog/), [Tauri commands](https://v2.tauri.app/develop/calling-rust/), [FsExt](https://docs.rs/tauri-plugin-fs/latest/tauri_plugin_fs/trait.FsExt.html), [bounded reads](https://doc.rust-lang.org/std/io/trait.Read.html#method.take), [MultiGzDecoder](https://docs.rs/flate2/latest/flate2/read/struct.MultiGzDecoder.html), Microsoft [GetFinalPathNameByHandleW](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfinalpathnamebyhandlew), [EN_CHANGE](https://learn.microsoft.com/en-us/windows/win32/controls/en-change), [CBN_EDITCHANGE](https://learn.microsoft.com/en-us/windows/win32/controls/cbn-editchange) and [WM_CHAR](https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-char).

Remaining gates include missing compression and `__NEEDS_MIGRATION__` native cases (pure helper support is narrower evidence), multi-database selection, OS-close, native export/reimport and error/recovery workflows, all-platform acceptance, external request-body/multipart files, CA/client certificates/keys, referenced proto/import/include assets, WebSocket logs/stream adapters and alternate formats. All PARITY and retained topic requirements remain required; this functional pass does not complete migration.

## Topic records

<a id="record-import-ui"></a>

<details>
<summary>IMPORT-UI</summary>

# Desktop import entry flow

Updated: 2026-09-29. Desktop paste flow verified natively; OS file-picker acceptance remains pending.

## Problem and change

Native Import immediately opened the file picker. The paste/review UI was only reachable in browser preview, so desktop users could not paste cURL or collection text.

Import now opens the existing review dialog on both platforms. Users can paste text or explicitly choose a collection file. Desktop keeps the Tauri picker, including multiple legacy .db selection; preview keeps its file input. Parsing errors stay in the dialog, cancellation preserves pasted text, and import still requires the existing review/apply step before adding resources.

While a read/picker is pending, file/paste/review controls are disabled. Each modal lifetime has a revision; late file results and errors are discarded after close, reopen or switching dialogs. Review cannot mutate collections until Import is confirmed.

## Sources consulted before implementation

- [Tauri dialog](https://v2.tauri.app/plugin/dialog/) — installed plugin's file selection behavior. Reused existing pickImport; no generator/dependency install needed.
- [Svelte bindings](https://svelte.dev/docs/svelte/bind) — textarea/file bindings and events.
- Existing page modal lifecycle and import-export.js parsing/picker; prior native observation in RUNNER.md#record-native-runner-acceptance.

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


</details>
