# Migration status

Updated 2026-10-14. Full migration is **incomplete**. Latest verified topic commit: b0b411d on feat/ui-design-system-settings-curl. Earlier agent branches are integrated; current proxy NTLM work is uncommitted in this shared repo. Retired directories and custom .git backups are absent. Legacy backup and node_modules are preserved.

## Current work

Proxy NTLMv2 Windows milestone is verified: current release82636 passes30 saved groups, with independent proxy/origin identities/proofs/certificate binding, HTTP/HTTPS CONNECT, exact replay/headers/Timeline, OAuth, SSE and text/binary WS history/disposal. All76 observed attempts and the complete fixture socket set retire before cleanup; host5300 exits0/native-hidden. HTTP2 metadata9 plus restart and cURL TLS7 regressions pass the same binary. Profile byte/layout restorations pass. Compiler57938 reports0 errors/0 warnings; clippy88538 exits0 with1 new per-session large-enum warning plus prior warnings. Bounds, remaining schemes/provider/platform gates and retained initial failures are recorded in [AUTHENTICATION.md](AUTHENTICATION.md). This is a bounded feature checkpoint, not full migration completion.

Documentation consolidation is complete (276→27 Markdown files; original requirements/evidence and559 record links verified). cURL --insecure mapping passes native HTTPS acceptance:7 groups /5 actual fixture requests, including option order/--next/secure curl default, on/off/global UI/reload, both global policies and actual curl control. Current mixed-body regression6 groups also passes; original TLS tab/label/control failures remain historical with full restoration. Remaining full migration gates remain open, including the namespace operator audit and broader legacy proxy/provider/platform compatibility.

## Verified evidence

| Topic | Verified scope | Evidence |
| --- | --- | --- |
| Proxy NTLMv2 |30 groups; current Windows release; independent role proofs/AV10, HTTP/CONNECT/OAuth/SSE/WS, original profile and socket retirement;native-hidden/exit0 | artifacts/playwright/proxy-ntlm-1791979742120; resource-manager-restoration-1791979742108 |
| cURL request TLS validation |7 groups; secure default/flag order/next isolation/UI/reload/global on+off/actual curl;native-hidden/exit0; full profile restored | artifacts/playwright/curl-import-tls-1791979849153 |
| Namespace | Original20 plus additive88 field cases;8 profiles;native-hidden/exit0; complete integration profile and layout restoration | artifacts/playwright/xml-response-filter-1791973441156 |
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

The complete requirements remain in [PARITY.md](PARITY.md). Namespace functional20+88 is verified on the integration identity; the stricter original operator source/package/kernel-process audit is still open. The saved scenario now selects the matching preservation profile, retains complete profile byte/layout checks and runs its additive native field helper from versioned tests rather than ignored artifacts. First additive replay1791973323389 failed because native object key order was mistaken for UI row order; it restored successfully. Corrected replay1791973441156 retains exact mapping/save/reload assertions and passes. CRUD and complete request workflows, auth/provider acceptance, foreign environment native acceptance, external legacy assets/import-export, complete GraphQL workflows/platform acceptance (historical Windows SDL chooser is already verified), stream compatibility, remaining gRPC/OpenAPI/runner/plugin compatibility, Git remote workflows, shared UI adoption/accessibility, desktop/platform/installer/CI acceptance and complete legal source/linkage coverage remain open. No scope is removed by this documentation cleanup. Deferred redesign follows POST-MIGRATION-UX.md after full migration.

## Handoff

Current source is ready for its proxy topic commit; preceding verified feature commit is b0b411d. Build82636, compiler57938, clippy88538 and all native scenarios are terminal. No live build/native/profile handles or claims remain. Current binary: artifacts/native-proxy-ntlm-probe, isolated integration identity; old integration binary remains untouched. Both restored workspace files retain SHA256 b06cdd2afff926e8a93ddfad2b7cb00b7f31bc8566c45e5a9beccb8407c1697c and the complete original file set. Logs/generated evidence remain ignored in artifacts; no custom .git files. Next: original namespace operator audit, then remaining PLAN/PARITY gates. This interface cannot invoke /compact; this is the explicit handoff. Historical STATUS/PLAN checkpoints remain in Git at2c8316e.
