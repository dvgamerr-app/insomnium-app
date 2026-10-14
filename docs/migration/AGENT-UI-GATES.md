# Remaining shared UI gates

These requirements remain open after agent branch integration; source implementation and bounded passing scenarios do not prove the complete workflows. Preserve the current Insomnium layout until migration is complete, then follow POST-MIGRATION-UX.md.

- Collection/folder/request CRUD: persisted subtree duplication with ID remapping and excluded private state; cross-collection movement and cycle refusal; children/history deletion and last-collection guard; ordering/search/switch/reload; owned native-state preservation.
- Request rename and GraphQL: fresh native focus/keyboard/save-count/persistence cases, native SDL chooser/export with exact bytes and cancellation, and complete query/variables/operation/introspection/schema/error workflows.
- Shared inputs: finish UI-DESIGN-SYSTEM-DEBT.md inventory/contracts, exception and obsolete-alias cleanup, validation/focus/keyboard behavior and full workflow adoption.
- Accessibility and platform: complete visual/responsive/accessibility and native platform coverage; bounded Windows/headless checks remain separately scoped.

PLAN.md, PARITY.md and STATUS.md retain the full migration, distribution/legal and deferred UX requirements. No requirement is removed by this integration.
