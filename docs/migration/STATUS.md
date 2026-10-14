# Migration status

Updated 2026-10-14. Full migration is **incomplete**. Baseline commit: 5da7443 on feat/ui-design-system-settings-curl. All agent work is integrated; retired directories and custom .git backups are absent. Legacy backup and node_modules are preserved.

## Current work

Migration documentation consolidated from276 Markdown files to27 files:18 topic documents plus current status/plan/parity, acceptance, commands, architecture, CI, cURL and deferred UX. README.md indexes topics.265 individual checkpoint documents retired; all substantive original lines retained and29 exact duplicate prose paragraphs removed.559 rewritten record links/anchors verified; independent Git comparison confirms10313 original nonblank record lines and unchanged acceptance table cells. PARITY now presents the required matrix directly; all original extra gates/checkpoints remain in MIGRATION-REVIEW.md. Current native namespace and cURL results remain verified below. Next finish the stricter namespace operator audit and remaining product/provider/platform gates; no migration scope removed.

## Verified evidence

| Topic | Verified scope | Evidence |
| --- | --- | --- |
| Namespace | Original20 plus additive88 field cases;8 profiles;native-hidden/exit0; complete integration profile and layout restoration | artifacts/playwright/xml-response-filter-1791973441156 |
| cURL mixed/file and GET/file |6 groups each; actual curl byte comparisons;native-hidden/exit0; full integration profile restored | artifacts/playwright/curl-import-mixed-body-1791973695180; curl-import-get-file-1791973709667 |
| Plugin ESM | Original26 headless cases;32 workers retired; primary interruption and cleanup errors retained | artifacts/playwright/plugin-module-readiness |
| Plugin native events |10 cases; native-hidden; profile restored | artifacts/playwright/plugin-dom-event-transport-1791954727727 |
| Plugin response metadata |9 cases including HTTP2 gzip, mounted Send, history and restart; profile restored | artifacts/playwright/plugin-response-metadata-native-1791954738326; plugin-response-metadata-restart-1791954744143 |
| Guarded native clipboard | Genuine guest read/write/clear; all3 mutations authenticated; complete original5-format643-byte restoration | artifacts/playwright/plugin-dom-event-clipboard-native-1791958115295 |
| Original XML |18 original saved cases and independent full restoration/release | RESPONSES.md#record-current-original-xml-native-acceptance |
| Original gRPC | Original saved Windows workflow, recorded process objects and full restoration/release | GRPC.md#record-current-original-grpc-native-acceptance |
| Proto fields |36 original cases across6 theme/width profiles and30 Rust replies | GRPC.md#record-current-proto36-native-acceptance |
| Native Open/TLS | Open4 and TLS59 Windows workflow with restoration/release | TLS.md#record-current-open-tls-native-acceptance |
| Notices | Authentic frontend283 inputs admitted; current packaging checks passed | LICENSES.md#record-current-frontend-acquisition; native/frontend notices topic reports |

These are bounded receipts, not universal platform or complete subsystem acceptance. Older failed receipts remain historical evidence; later passing receipts supersede their current-state claims only within the same verified scope.

## Remaining gates

The complete requirements remain in [PARITY.md](PARITY.md). Namespace functional20+88 is verified on the integration identity; the stricter original operator source/package/kernel-process audit is still open. The saved scenario now selects the matching preservation profile, retains complete profile byte/layout checks and runs its additive native field helper from versioned tests rather than ignored artifacts. First additive replay1791973323389 failed because native object key order was mistaken for UI row order; it restored successfully. Corrected replay1791973441156 retains exact mapping/save/reload assertions and passes. CRUD and complete request workflows, auth/provider acceptance, foreign environment native acceptance, external legacy assets/import-export, complete GraphQL workflows/platform acceptance (historical Windows SDL chooser is already verified), stream compatibility, remaining gRPC/OpenAPI/runner/plugin compatibility, Git remote workflows, shared UI adoption/accessibility, desktop/platform/installer/CI acceptance and complete legal source/linkage coverage remain open. No scope is removed by this documentation cleanup. Deferred redesign follows POST-MIGRATION-UX.md after full migration.

## Handoff

No live process handles or native/profile/clipboard claims. Last complete source integration and cleanup checkpoint:2c8316e; last namespace feature6245b4d and cURL feature5da7443. Logs and generated evidence remain ignored in artifacts; no custom .git files. This interface cannot invoke /compact. Historical STATUS/PLAN checkpoints can be read with git show 2c8316e:docs/migration/STATUS.md and git show 2c8316e:docs/migration/PLAN.md.
