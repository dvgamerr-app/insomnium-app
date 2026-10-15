# Shared project knowledge

Read this once per worker invocation. This is a navigation guide; source and current topic contracts establish behavior. Do not load every linked document or copy whole files into reports.

## Required context and constraints

- Read root `CLAUDE.md`, `AGENTS.md`, and applicable ancestor/nested `CLAUDE.md` / `CLAUDE.*.md` before scoped inspection or edits. For migration read `docs/migration/STATUS.md`, `PLAN.md`, `PARITY.md`; derive the next gap from them, not this guide.
- Tauri 2 + Rust backend; Svelte 5/plain JavaScript frontend. Bun only for JS tooling, including `bun x --bun`; no Node/npm/npx/pnpm/yarn/Python/pip. Cargo is allowed.
- Preserve current Insomnium UI. Redesign/input-component rollout is deferred until migration completion; see `docs/migration/POST-MIGRATION-UX.md`.
- Preserve unrelated dirty files. Legacy `_backup/legacy-electron/` and reference `E:/.dvgamerr-app/jirasync-hub-app` are read-only; do not copy identity, credentials or updater endpoints. No `git clean -dfX`.
- New functionality does not authorize non-UI test scripts; bug fixes may include necessary tests. Saved reusable Playwright scenarios are explicitly authorized. No browser-use or ad-hoc browser automation.
- Project is local-first. Do not introduce login, telemetry, remote sync or automatic sample-API calls. Do not expose credentials/source payloads in reports or make production requests.
- Workers do not stage/commit/revert/clean/publish, expand assigned ownership or delegate. Only the coordinator owns shared STATUS updates unless explicitly assigned.

## Code and contract map

Paths below are entry points, not a complete dependency inventory. Trace callers and native command registration before changing a boundary. Topic names are relative to `docs/migration/`.

| Work                              | Source entry points                                                                                                                                              | Read relevant contract                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Shell, UI, collection state       | `src/routes/+page.svelte`, `src/lib/components/`, `src/lib/workspace.svelte.js`, `src/lib/resources.js`                                                          | DESIGN.md, COLLECTIONS.md                                                |
| Models, durable state, imports    | `src/lib/model.js`, `src/lib/persistence.js`, `src/lib/persistence-queue.js`, `src/lib/import-export.js`, `src/lib/legacy-import.js`, `src-tauri/src/storage.rs` | IMPORT-EXPORT.md                                                         |
| HTTP, body/auth, response/history | `src/lib/transport.js`, `src/lib/request-render.js`, `src-tauri/src/http.rs`                                                                                     | HTTP.md, RESPONSES.md, AUTHENTICATION.md                                 |
| TLS/proxy/cookies                 | `src-tauri/src/client_certificates.rs`, `src-tauri/src/proxy_auth.rs`, `src-tauri/src/cookies.rs`                                                                | TLS.md, AUTHENTICATION.md                                                |
| SSE/WebSocket                     | `src/lib/streaming.js`, `src-tauri/src/streaming.rs`                                                                                                             | HTTP.md, IMPORT-EXPORT.md; locate current stream acceptance in PARITY.md |
| gRPC/proto                        | `src/lib/proto-management.js`, `src-tauri/src/grpc.rs`, `src-tauri/src/grpc_transport.rs`                                                                        | GRPC.md                                                                  |
| GraphQL/OpenAPI                   | `src/lib/graphql.js`, `src/lib/openapi.js`, `src/lib/openapi.worker.js`                                                                                          | GRAPHQL.md, API-DESIGN.md                                                |
| Templates/plugins/runner          | `src/lib/template-runtime.js`, `src/lib/plugin-runtime.js`, `src/lib/runner-runtime.js`                                                                          | TEMPLATING.md, PLUGINS.md, RUNNER.md                                     |
| Git/native commands               | `src-tauri/src/git.rs`, `src-tauri/src/git_remote.rs`, `src-tauri/src/lib.rs`                                                                                    | GIT.md; follow its current remote-workflow links                         |
| Packaging/legal                   | `scripts/build-desktop.mjs`, `src-tauri/Cargo.toml`, `tools/native-notices/`                                                                                     | CI.md, LICENSES.md                                                       |

Architecture to preserve: Svelte UI → workspace state → model/transport/persistence → Tauri invocation → Rust. Desktop state is separate from browser-preview storage. Preserve serialized saves, cancellation/drain ownership and additive imports; trace their current implementations instead of inventing replacements. Imported scripts must not be executed merely by importing data. Historical sections may describe old limits; prefer current source and matching bounded receipts, and report conflicts.

## Verification and evidence

Read `package.json` for current commands. Typical gates: `bun run check` for frontend diagnostics, `bun run build` for bundling, `bun run native:check` for Rust. Run gates appropriate to changed behavior; a build is not UI/native/protocol acceptance.

For UI/native work read `docs/migration/UI-TESTING.md`, then the existing scenario and its helpers before running. Browser helper: `tests/ui/helpers/preview-app.js` exports `launchUiBrowser` with headless:true and no override. Native helper: `tests/ui/helpers/native-app.js`; hide owned hosts before CDP and report native-hidden. Obtain exclusive profile/port/process ownership; preserve/restore required state and await owned process exit. Never terminate a process solely because its name matches.

Record command, exit code, source/build identity, evidence path, exact tested scope/platform, restoration result and live handles. Preserve failed receipts; missing evidence is unverified, not a pass. Full migration remains incomplete until every PARITY gate is verified or explicitly removed by the owner. Read topic summaries first, then only relevant evidence sections. Consult official subsystem docs before implementation; record references/commands in the assigned topic handoff.
