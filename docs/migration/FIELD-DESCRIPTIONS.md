# Shared Field descriptions

Status: verified shared-control fix; topic commit/checkpoint recorded in STATUS.md.

Explicit aria-describedby previously replaced Field description/error IDs.
fieldDescriptions now combines caller IDs first, then reactive Field feedback,
splits HTML ASCII whitespace and deduplicates while retaining order. Empty
caller help retains Field feedback. Input, Textarea, Select, Checkbox and
FilePicker use this one helper. No CSS/layout changes.

Official reference consulted before implementation:
https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA1

Verified evidence:

- Baseline saved design-system.js failed on mounted Input: duplicate caller IDs
  and missing merged-input-error. Observed terminal assertion/failure PNG copied
  to artifacts/playwright/field-description-baseline. Original constant
  result.json was later overwritten; observed-failure.json is the observation
  record. PNG inspected; DOM assertion proves the association defect, while
  screenshot shows earlier fixture context.
- Saved headless87664 terminal0/passed130: five actual components/four reactive
  description-error states/dark+light/1440+900+760 gives120; caller help removal
  and replacement adds10. Retained whole design-system scenario passes.
  Evidence: artifacts/playwright/design-system/field-description-acceptance.json
  and result.json. Earlier corrected63261 passed120.
- field-description-final-audit.json independently verifies120 raw rows, their
  unique profile/state/control identities, ordered references, resolved text and
  current invalid attributes. Additional10 are proven by passing saved assertions;
  their evidence entries record expected refs after assertions, not raw DOM.
- Compiler zero errors/warnings; selected source/scenario/new-doc Prettier and
  diff checks pass. Six shared source SHA256s match field-description-source-freeze.json.
- Fresh native build1791556752062 finished1791557135005/result0, production
  release profile with isolated probe identity, hash16674050803735312688.
  It includes these six files and separately committed body/Git fix a752707.
- Native2580/artifact1791557144758 terminal0/passed14:45:45.162Z–14:49:39.844Z:
  12 workflows/10 dialogs,6 Field feedback/12 form profiles,6 button/6 Select
  profiles and18 focus surfaces. Git HEAD unchanged. Independent seven-source
  acceptance audit passes. Actual dark/light Git900 and cookie images inspected.
  Native61208 exit0/native-hidden/visiblefalse; Bun42584/native gone and scoped
  WebView0. No live feature handles. Passing runs were not restarted.

Retained native failures on superseded release1791555520862:

- Native31170/artifact1791555945042 failed at workspace selection wait15s;
  fixture condition remains exact with60s bound. Native83611/artifact1791556077899
  failed at HTTP Request click15s after initial measurements; image shows new
  request already created/selected. Scenario action/navigation limits are now60s,
  with original assertions and single actions retained.
- Native16599/artifact1791556213497 failed at Source Control wait60s. Actual
  image exposes non-JSON body properties in memory after Body type change.
  RequestEditor now deletes undefined patch keys, with mounted regression6 and
  strict Git guard retained. See REQUEST-BODY-GIT.md.
- Failed artifacts retained; each native exit0/native-hidden/visiblefalse, owned
  processes/profile released and failure PNG inspected. Superseded successful
  build42205 did not produce passing complete native acceptance.

Saved Bun commands:

```powershell
bun tests/ui/design-system.js
bun run check
bun tests/ui/build-recovery-copy-probe.js
bun tests/ui/nocturne-theme.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/nocturne-native-theme.js
```

Frontend theme27253 passes19 surfaces/persistence/six profiles on the unchanged
Field sources before the body fix; native regression uses the corrected fresh
release. Browser fixtures use launchUiBrowser/headless:true; native scenarios
hide owned host windows before CDP and report native-hidden.

This proves DOM description composition, not screen-reader speech or OS file
dialogs. Production Field callers currently do not supply separate help IDs;
that combination is exercised by the actual component fixture. Native testing
is retained application workflow/theme regression. Broader UI adoption, CSS
ownership/validation/keyboard/platform and all original migration/UX/CSS gates
remain required. Full migration goal is active.
