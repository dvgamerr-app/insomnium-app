# Migration status

Updated 2026-10-15. Full migration is **incomplete**. Latest verified feature/source commit: 7a0e9e3 on feat/ui-design-system-settings-curl. Agent work for collection lifecycle, current CRUD, namespace and prior proxy milestones is committed in the shared repo. Retired directories and custom .git backups are absent. Legacy backup and node_modules are preserved.

## Current work

Manual HTTP/body/send/cancel/history is verified on Windows at 7a0e9e3. Compiler24524 passes0/0; controlled headless replay0002 retains original20/stream2 plus HTTP6 and42 retired workers. Normal-hook build91016/http-workflow-attempt-2 exits0 (Rust6m55); native67507/receipt1792004571680 passes seededhistory6, body36 and controls18, with54 sockets retired without force. CRUD regression91711/receipt1792004773396 also retains original6/field24/correction6/collection6. Hosts39808/43064 exit0/native-hidden; original workspace hashes and protected inventory restore exactly. Full post-native source closure91280 and post-regression72066 pass. Details, immutable failures and the limited18MiB proof are in [HTTP.md](HTTP.md#current-manual-http-workflow).

Prior verified milestones remain in [COLLECTIONS.md](COLLECTIONS.md#current-windows-acceptance), [RESPONSES.md](RESPONSES.md#namespace-implementation-and-original-acceptance), [AUTHENTICATION.md](AUTHENTICATION.md#current-implementation-and-remaining-source-gaps) and [CURL-IMPORT.md](CURL-IMPORT.md). Documentation consolidation preserved all requirements/evidence (276→27 files,559 record links). Full migration and deferred UX remain governed by PLAN/PARITY.

## Verified evidence

| Topic | Verified scope | Evidence |
| --- | --- | --- |
| Manual HTTP/history | Windows body36/controls18 +seededhistory6; durable failures/Cancel, environment quotas and persisted selection;54 sockets retired; native-hidden/exit0; exact profile restoration | artifacts/playwright/response-history-native-1792004571680; resource-manager-restoration-1792004571456; CRUD regression1792004773396 |
| Proxy NTLMv2 |30 groups; current Windows release; independent role proofs/AV10, HTTP/CONNECT/OAuth/SSE/WS, original profile and socket retirement;native-hidden/exit0 | artifacts/playwright/proxy-ntlm-1791979742120; resource-manager-restoration-1791979742108 |
| cURL request TLS validation |7 groups; secure default/flag order/next isolation/UI/reload/global on+off/actual curl;native-hidden/exit0; full profile restored | artifacts/playwright/curl-import-tls-1791979849153 |
| ResourceManager current native |6 original CRUD groups +24 field refusals/6 corrections +6 actual collection lifecycle groups;14 exclusions/15 references;1 Send/1 abort; exact original buffers/cookies/plugins restored;native-hidden/exit0 | artifacts/playwright/resource-manager-native-1791999735595; resource-manager-restoration-1791999735377 |
| Namespace original operator | Original20 + additive88/8 profiles; source/package/private-input closure; all20 history/5 layout keys/full protected +13783 Git files; host+6 retained children closed; separate release/native-hidden/exit0 | artifacts/native-namespace-audit-probe/attempt-6/operator-1791992078954; artifacts/playwright/xml-response-filter-1791992171965 |
| cURL mixed/file and GET/file |6 groups each; actual curl byte comparisons;native-hidden/exit0; full integration profile restored | artifacts/playwright/curl-import-mixed-body-1791973695180; curl-import-get-file-1791973709667 |
| Plugin ESM | Original26 headless cases;32 workers retired; primary interruption and cleanup errors retained | artifacts/playwright/plugin-module-readiness |
| Plugin native events |10 cases; native-hidden; profile restored | artifacts/playwright/plugin-dom-event-transport-1791954727727 |
| Plugin response metadata |9 cases including HTTP2 gzip, mounted Send, history and restart; profile restored | artifacts/playwright/plugin-response-metadata-native-1791979779259; plugin-response-metadata-restart-1791979786930 |
| Guarded native clipboard | Genuine guest read/write/clear; all3 mutations authenticated; complete original5-format643-byte restoration | artifacts/playwright/plugin-dom-event-clipboard-native-1791958115295 |
| Original XML |18 original saved cases and independent full restoration/release | RESPONSES.md#record-current-original-xml-native-acceptance |
| Original gRPC | Original saved Windows workflow, recorded process objects and full restoration/release | GRPC.md#record-current-original-grpc-native-acceptance |
| Proto fields |36 original cases across6 theme/width profiles and30 Rust replies | GRPC.md#record-current-proto36-native-acceptance |
| Native Open/TLS | Open4 and TLS59 Windows workflow with restoration/release | TLS.md#record-current-open-tls-native-acceptance |
| Notices | Authentic frontend283 inputs admitted; current packaging checks passed | LICENSES.md#record-current-frontend-acquisition; native/frontend notices topic reports |

These are bounded receipts, not universal platform or complete subsystem acceptance. Older failed receipts remain historical evidence; later passing receipts supersede their current-state claims only within the same verified scope.

## Remaining gates

The complete requirements remain in [PARITY.md](PARITY.md). Namespace original20+88 and the current Windows original operator source/package/kernel-process audit are verified; broader loader/linkage/all-birth/OS-close/physical-width/AT/platform gates remain open. The saved scenario now selects the matching preservation profile, retains complete profile byte/layout checks and runs its additive native field helper from versioned tests rather than ignored artifacts. First additive replay1791973323389 failed because native object key order was mistaken for UI row order; it restored successfully. Corrected replay1791973441156 retains exact mapping/save/reload assertions and passes. Broader collection UI/private-resource/ordering/keyboard variants and complete request workflows, auth/provider acceptance, foreign environment native acceptance, external legacy assets/import-export, complete GraphQL workflows/platform acceptance (historical Windows SDL chooser is already verified), stream compatibility, remaining gRPC/OpenAPI/runner/plugin compatibility, Git remote workflows, shared UI adoption/accessibility, desktop/platform/installer/CI acceptance and complete legal source/linkage coverage remain open. No scope is removed by this documentation cleanup. Deferred redesign follows POST-MIGRATION-UX.md after full migration.

## Handoff

Verified source commit:7a0e9e3. Build91016, compiler24524, native67507, CRUD91711 and closure91280/72066 are terminal; no live build/native/profile handles remain. Candidate:artifacts/native-resource-crud-audit-probe/http-workflow-attempt-2; actual executable SHA4e83e47347f716c8b8b2297e654e0ab90bd17c9ed2f844d034e7b8852b0c03bc. Fixed identity:app.insomnium.probe.resourcecrud20261012; ownership remains honestly reconstructed, never a fresh initial absence. Both original workspace hashes f0b51/d8b032 remain exact. Logs/receipts stay ignored in artifacts; no custom .git files or agent worktrees. Next: remaining model/environment/auth/provider/stream/Git/platform/legal gates in PARITY. This interface cannot invoke /compact; this is the explicit feature handoff before starting another feature.

Historical STATUS/PLAN checkpoints remain in Git at2c8316e; prior proxy source commit81a8755 and its evidence are retained in AUTHENTICATION.md.
