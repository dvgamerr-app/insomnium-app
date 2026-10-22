# Migration execution plan

Migration is incomplete. [PARITY.md](PARITY.md) remains the full acceptance checklist; this summary waives none of its requirements. [STATUS.md](STATUS.md) records the latest finished topic and pending work.

## Work sequence

1. **gRPC.** Complete JSON/object/map/Any, editor/template and streaming compatibility and native acceptance. Retain DNS/resolver, service-config/cache, weighted/outlier/ORCA, calendar, retry/hedging and wire/platform requirements. See [GRPC.md](GRPC.md) and [GRPC-SERVICE-CONFIG.md](GRPC-SERVICE-CONFIG.md). The response reader and representative Windows native integration are verified; remaining acceptance requirements stay open.
2. **Streaming.** Complete WebSocket control/fragmentation/close/history and SSE UTF8/CRLF/compression/boundaries, ACK/drain, large Copy/Save and lifecycle/provider/platform acceptance. Existing receipts cover only their named cases; see [HTTP.md](HTTP.md).
3. **Models and durable data.** Complete resource ownership, callback drains, persistence/recovery/OS-close, environment/imported-model variants, legacy assets and import/export round trips. See [COLLECTIONS.md](COLLECTIONS.md) and [IMPORT-EXPORT.md](IMPORT-EXPORT.md).
4. **API tooling.** Complete retained GraphQL navigation/completion, OpenAPI, cURL/body/code-generation, runner, plugin and template contracts. Inspect current code before treating an old pending note as missing implementation. Use the corresponding topic documents.
5. **Networking/authentication.** Complete cookies, proxy, redirects, OAuth/provider flows, TLS identities and platform acceptance. Cookie publication/recovery barriers are implemented; failed-save/crash/held-provider/same-ID acceptance and retired-file policy remain open. See [AUTHENTICATION.md](AUTHENTICATION.md) and [TLS.md](TLS.md).
6. **Git.** Complete retained Pull/network/process/I/O/recovery/provider/platform requirements in [GIT.md](GIT.md). Clone, remote checkout and non-force Push already have implementations; do not recreate them from old notes.
7. **Desktop/release.** Complete menus/shortcuts/dialogs/clipboard/window lifecycle, accessibility/keyboard/resize/theme, native/legal/linkage, installers, CI and platform checks.
8. **Final audit, then UX.** Verify every PARITY requirement with matching evidence or explicit owner removal before declaring migration complete. Only then proceed with [POST-MIGRATION-UX.md](POST-MIGRATION-UX.md).

## Execution rules

- Preserve the existing Insomnium UI during migration; keep the legacy backup and reference repository read-only.
- Use Bun for JavaScript tooling and Cargo for Rust. Follow applicable AGENTS/CLAUDE instructions and consult official subsystem documentation before implementation.
- Finish work by topic. Reuse relevant tests/scenarios; do not add duplicate cases or repeatedly replay green matrices. Saved browser scenarios use the shared headless helper; native scenarios hide their owned host before CDP attachment.
- Commit verified code by topic, then update STATUS once with outcome, evidence, remaining work and live handles. Do not put execution transcripts or repeated checkpoints in the documents.
- Compiler checks and representative scenarios do not prove complete runtime/platform acceptance. Preserve failed receipts and report their actual scope.
- This interface cannot invoke `/compact`; provide a concise handoff without claiming compaction.
