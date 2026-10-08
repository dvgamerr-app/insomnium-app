# Compact feedback and Field message ownership

## Problem and resulting behavior

Compact KeyValueEditor hints inherited paragraph margins of12px above and
below each message in addition to feature-owned padding/gap. The saved
design-system baseline reproduces the top-margin failure in
artifacts/playwright/compact-feedback-baseline-failure.json.

Feedback compact density now owns zero margins and line-height1.5. Its selector
uses :where() for density eligibility so feature classes can still own message
placement. Normal Feedback keeps its paragraph margins/line-height. Preformatted
and list-item presentations keep their semantic tags and error line breaks.

Field descriptions/errors now use shared Feedback with compact density and
as="small". Existing IDs, SMALL tags, hint/error classes, alert roles, context
attributes and reactive message lifecycle remain. The redundant Field small
line-height rule is removed. No backend/dependency/subsystem change.

## References and saved verification

- [MDN :where() specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:where)
- [MDN SMALL semantics](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/small)

```powershell
bun run check
bun tests/ui/design-system.js
bun scripts/ui-inventory.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/openapi-query-serialization.js
bun tests/ui/nocturne-native-theme.js
```

Existing headless scenario checks10 compact tag/tone cases for each of6
dark/light1440/900/760 profiles (60), normal paragraphs and consumer placement
overrides, reactive Field linked messages/error clearing, and30 actual
KeyValueEditor rows with exact feature padding/gap/bottom geometry. Existing
keyboard/required/invalid-hover/form/file/dialog/tab contracts also run.

Shared key-value helper is reused by actual native query editor verification.
Shared Field-message helper is reused by native Preferences autocomplete help
at6 theme/width profiles, alongside existing author validation/workflows and
workspace preservation. Final production release1791476676475/finished1791477053177/
result0/hash11533498037045558973 accepts native query1791477080785 (44 groups,
3.0.3) and native theme1791477509944 (6 Field message profiles,12 captures,
12 form/18 focus/10 dialog cases, unchanged Git HEAD). Both terminal results
passed/native-hidden/visiblefalse/exit0; sequence55457 terminal0. Final headless
93106 passed60 compact cases/6 Field profiles/30 help rows/12 multipart pairs;
compiler29285 terminal0/0errors0warnings and formatting/diff checks pass.
Actual final reserved-array760 screenshot inspected and corrected separator
confirmed. Authoritative process scan found no owned handles. Browser scenarios are headless; native
hosts hide before CDP attachment and report native-hidden.

The source inventory reports662 external shared markup sites/118 tokens/1719
CSS declarations; internal Field reuse does not add external consumer sites.
Final source hasha5dfa28c0bcfad8067157dd458a3c87cd0518641ee3e2daa3f774edaf0fa56e3.

Native760px screenshot inspection also exposed adjacent compound instructions
(Use JSON values.Reserved characters). KeyValueEditor now emits an explicit
separator in the conditional string; shared saved helper asserts the actual
readable text and the fixture exercises array guidance. Prior accepted release
1791475749233/1791476237736 had narrower geometry/Field evidence and is
superseded for final source acceptance.

## Remaining gates

This closes the demonstrated compact spacing/Field message ownership and
sentence separator gaps. Feature-specific margins, ordinary feedback presentation,
domain validation/adoption, OS dialogs, platform/workflow coverage and full
UI debt remain separate required work. Every remaining owner-approved PLAN/PARITY
OpenAPI/TLS/Git/storage/CI/release/desktop/migration/UX gate is unchanged.
