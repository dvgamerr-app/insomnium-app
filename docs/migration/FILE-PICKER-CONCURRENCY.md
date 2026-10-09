# FilePicker async reset ownership

2026-10-09. Base `9e09a9f`. Native regression and final audit pass; exact commit checkpoint is in STATUS.

When first.txt is selected and its callback is still processing, selecting
second.txt starts another callback. Previously, finishing the first callback
unconditionally cleared the native input, erasing second.txt while its callback
was still pending. The saved old-source baseline reproduces this with manually
released promises, rather than timing assumptions.

The shared FilePicker now numbers each change per component instance. Its
finally block resets only when that change is still the latest and
`resetAfterChange` is enabled. The latest callback retains normal cleanup; the
explicit opt-out retains the selected file. Consumers still own upload/data
freshness, validation and error presentation; this change does not order their
domain results or cancel their processing.

Native file input semantics were checked against the
[WHATWG File Upload state](<https://html.spec.whatwg.org/multipage/input.html#file-upload-state-(type=file)>).
The callback receives the native event; consumers needing the input or files
after an await must capture them while the callback starts. The component
captures its own input before awaiting. No CSS/layout change is included.

## Verification

```powershell
bun run check
bun tests/ui/design-system.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/upload-size.js
bun scripts/ui-inventory.js
```

- Baseline: terminal exit 1, older completion leaves no file instead of second.txt.
  Original result/progress/PNG preserved in
  `artifacts/playwright/file-picker-concurrency-baseline`; image inspected.
- Corrected saved headless design-system39854: terminal exit 0, complete scenario
  passes. Twelve groups cover dark/light, 1440/900/760 and enabled/disabled reset.
  Each verifies older completion preserves second.txt and latest completion
  follows reset policy. Existing completed-callback same-file reselection,
  required-file/form contracts and other shared control regressions remain.
- Independent raw-row audit validates all twelve distinct combinations:
  `file-picker-concurrency-headless-audit.json`.
- Compiler initially found missing input type annotations, then cast precedence
  errors in the saved scenario; corrected before acceptance. Final compiler is
  terminal exit 0, zero errors/warnings.
- App source freeze: `file-picker-concurrency-source-freeze.json`. Fresh native
  build72338 started1791560250408, fixture hash3094143901124634421. Do not change
  source while native build or acceptance is active.

Saved native upload3997/artifact upload-size-1791560755861 passes with terminal
exit0 on release1791560250408/finished1791560630293. It accepts exact16MiB and
20MiB persisted/reloaded/wire payloads, then clears its owned binary payload.
Native52104 exit0/native-hidden/visiblefalse, owned Bun58996/native gone, scoped
WebView0 and local fixture60538 listeners0. Final independent audit recomputes
the two expected SHA256 values and verifies headless12/source freeze/release
identity/native terminal visibility: file-picker-concurrency-final-audit.json.

The first native attempt6152/artifact upload-size-1791560639751 failed at15s
Import click acknowledgement, while its failure body snapshot already showed the
imported Binary File request. No PNG was available. It ended terminal1 with
native exit0/hidden cleanup and no owned processes. The saved upload scenario
now uses60s action/navigation waits, matching native-theme; assertions and single
actions are unchanged. Compiler after this edit passes0errors0warnings.

All browser scenarios use fixed headless launch; native regression must hide its
owned host before CDP and report native-hidden. Saved native upload-size exercises
actual file selection/persistence/reload/16MiB and20MiB wire bytes. It does not
reproduce the controlled overlapping-callback order; that is covered by the
mounted headless real-component fixture. Native OS chooser interaction,
directory/multiple selection, callback rejection and other platforms are not
proved by this scoped scenario.

No full migration/UI debt completion is claimed. All remaining original
PLAN/PARITY and UI adoption/ownership/workflow/platform requirements stay open.
Record terminal native evidence, owned cleanup and commit in STATUS before the
next feature. This interface cannot invoke /compact; provide the recorded handoff
without claiming compaction.
