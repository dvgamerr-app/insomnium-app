# Migration status

Updated 2026-10-14. Full migration is **incomplete**. Baseline commit: 414d712 on feat/ui-design-system-settings-curl. All agent work is integrated; retired directories and custom .git backups are absent. Legacy backup and node_modules are preserved.

## Current work

STATUS and PLAN consolidation completed: removed repeated execution checkpoints; all PARITY table cell contents independently compared unchanged. Historical records remain in Git at2c8316e. Namespace topic consolidated from five documents into XPATH-NAMESPACES.md with all substantive lines preserved and incoming links updated. Fresh saved headless component scenario91439 exited0; receipt confirms88 checks across8 profiles and zero failures (artifacts/playwright/xml-response-namespaces). Other topic consolidation remains open. Next finish the current namespace original20 + additive88 native gate. Keep every original requirement in PARITY.md. Replace current entries in this file after each milestone; do not append duplicate handoff logs.

## Verified evidence

| Topic | Verified scope | Evidence |
| --- | --- | --- |
| Plugin ESM | Original26 headless cases;32 workers retired; primary interruption and cleanup errors retained | artifacts/playwright/plugin-module-readiness |
| Plugin native events |10 cases; native-hidden; profile restored | artifacts/playwright/plugin-dom-event-transport-1791954727727 |
| Plugin response metadata |9 cases including HTTP2 gzip, mounted Send, history and restart; profile restored | artifacts/playwright/plugin-response-metadata-native-1791954738326; plugin-response-metadata-restart-1791954744143 |
| Guarded native clipboard | Genuine guest read/write/clear; all3 mutations authenticated; complete original5-format643-byte restoration | artifacts/playwright/plugin-dom-event-clipboard-native-1791958115295 |
| Original XML |18 original saved cases and independent full restoration/release | CURRENT-ORIGINAL-XML-NATIVE-ACCEPTANCE.md |
| Original gRPC | Original saved Windows workflow, recorded process objects and full restoration/release | CURRENT-ORIGINAL-GRPC-NATIVE-ACCEPTANCE.md |
| Proto fields |36 original cases across6 theme/width profiles and30 Rust replies | CURRENT-PROTO36-NATIVE-ACCEPTANCE.md |
| Native Open/TLS | Open4 and TLS59 Windows workflow with restoration/release | CURRENT-OPEN-TLS-NATIVE-ACCEPTANCE.md |
| Notices | Authentic frontend283 inputs admitted; current packaging checks passed | CURRENT-FRONTEND-ACQUISITION.md; native/frontend notices topic reports |

These are bounded receipts, not universal platform or complete subsystem acceptance. Older failed receipts remain historical evidence; later passing receipts supersede their current-state claims only within the same verified scope.

## Remaining gates

The complete requirements remain in [PARITY.md](PARITY.md). Namespace20+88 is still failed/open and needs current source/native verification. CRUD and complete request workflows, auth/provider acceptance, foreign environment routing, external legacy assets/import-export, GraphQL SDL/native chooser, stream compatibility, remaining gRPC/OpenAPI/runner/plugin compatibility, Git remote workflows, shared UI adoption/accessibility, desktop/platform/installer/CI acceptance and complete legal source/linkage coverage remain open. No scope is removed by this documentation cleanup. Deferred redesign follows POST-MIGRATION-UX.md after full migration.

## Handoff

No live process handles or native/profile/clipboard claims. Last complete source integration and cleanup checkpoint:2c8316e; documentation baseline414d712. Logs and generated evidence remain ignored in artifacts; no custom .git files. This interface cannot invoke /compact. Historical STATUS/PLAN checkpoints can be read with git show 2c8316e:docs/migration/STATUS.md and git show 2c8316e:docs/migration/PLAN.md.
