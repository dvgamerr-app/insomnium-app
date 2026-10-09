# Unused internal UI tokens

2026-10-09, base `0ab97fe`. Removed `--code` from both themes and
`--font-size-14` / `--space-30` from foundation. AST inventory and source/tool/
scenario search found declarations only; the dynamic method-color family is
unchanged. Syntax colors retain their existing `--syntax-*` tokens.

The final source diff removes four declarations. An initial line-ending change
was corrected before saved acceptance. No replacement aliases or unused scale
entries were introduced. These removals cover internal application consumers;
they do not certify unknown external CSS consumers.

Validation: `bun run check` terminal exit 0, zero errors/warnings;
`bun run build` terminal exit 0; saved `bun tests/ui/design-system.js` handle71649
terminal exit 0, result passed, including six theme/width foreground profiles
(66 rows) and retained Field/form/keyboard/control contracts.

`bun scripts/ui-inventory.js` now reports 117 tokens and 1718 declarations,
with no unused-var candidates. Independent before/after audit verifies only
three token names/four declarations disappeared; Svelte/shared adoption/raw
control exceptions/feature scoped ownership/import graph/dynamic method sources
and optional fallback references are unchanged. Source SHA256:
`e15f0182538b7592d0946bfe335976989466235bee72a25479379dc7ab63d6ce`.

Artifacts: `artifacts/playwright/unused-token-baseline-inventory.json`,
`unused-token-final-audit.json`, current `artifacts/ui-inventory/report.json`
and saved design-system outputs. Native scenarios were not rerun for these
unused declarations; no fresh native or cross-platform acceptance is claimed.
The preceding native filled-foreground acceptance remains historical evidence
for its own frozen source, not acceptance of this source hash.

This closes the three unused-token candidates from the previous inventory.
Property-level duplicates/literals, compatibility aliases, shared compositions,
full workflow/platform checks and every remaining PLAN/PARITY requirement stay
required. It does not close the complete UI debt checklist or migration goal.
