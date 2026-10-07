# Git remote migration contract

2026-09-30 latest checkpoint: Fetch now uses shared native process supervisor (300s cap/305s watchdog; advertisement remains30s/35s), with staging ancestor symlink/reparse checks. Cargo checks and29 native assertions passed. Parent-owned allocation/cleanup, publication, IPC/UI and full parity remain pending. See GIT-FETCH-STAGING.md.

2026-09-30 latest checkpoint: Isolated fetch staging primitive/private worker dispatch implemented. Cargo checks passed; real-pack15 assertions and advertisement14 regression assertions passed. Supervisor/path ownership/publication/UI remain pending; multi-ref Transaction is not atomic. See [GIT-FETCH-STAGING.md](GIT-FETCH-STAGING.md). No native app rebuild; full migration incomplete.

2026-09-30 latest checkpoint: Remote settings build finished0; saved native Playwright passed8 checks (save/read/reload/auth error/Stop/endpoint edit/dialog close/data preservation). Evidence git-remote-settings-1790770895847. Next scoped fetch, advance-ref journal/pull/merge and remaining remote/parity workflows; actual providers remain unverified.

2026-09-30 latest checkpoint: Remote settings/read/Stop UI implemented in existing Git dialog.15 model/export assertions and frontend checks/build passed. Saved Playwright settings scenario awaits native build PID30728 at artifacts/native-remote-settings-ui-probe/build-state.json. No mounted UI acceptance yet. Poll same build; next run test:ui:git-remote-settings.

2026-09-30 latest checkpoint: Remote client and tracked workspace advertisement wrapper implemented; 10 client + 6 wrapper assertions and frontend checks/build passed. Settings/connection/Stop controls and mounted UI verification remain next. Evidence: artifacts/git-remote-client-check; details in STATUS.md.

2026-09-30 latest checkpoint: Isolated remote build finished0; saved Playwright native lifecycle passed7 named checks, including actual 30021ms timeout and existing Git UI responsiveness. Evidence git-remote-lifecycle-1790769998943. Settings/remote Stop UI/providers and remaining workflows are pending; next client/workspace admission integration.

2026-09-30 latest checkpoint: Advertisement now uses a cancellable native worker process with bounded lifecycle/registry. Cargo checks and 14 actual-source assertions passed. See [GIT-REMOTE-LIFECYCLE.md](GIT-REMOTE-LIFECYCLE.md); isolated app/IPC/settings/UI acceptance remains pending.

Updated: 2026-09-30. **Native advertisement primitive implemented and standalone checked; lifecycle/settings/UI and remaining remote workflows are incomplete.** This extends GIT-INVENTORY.md and CHECKOUT-TRANSACTION.md. Local create/switch/delete acceptance does not satisfy this contract.

## Native remote advertisement primitive — 2026-09-30

- Previous goal turn made progress by recording the owner's deferred shared-input/UX phase. Current migration scope remains unchanged.
- Added src-tauri/src/git_remote.rs and git_remote_advertise handler/build-manifest/capability. It uses a detached git2 remote, so no local repository, HEAD, workspace or refs are opened/modified. Network work runs outside GitState/StorageState.
- Input currently requires normalized HTTP(S) URL and explicit anonymous/basic/github/gitlab credentials. URL embedded credentials/fragments/control characters rejected; credentials bounded, basic username colon rejected. GitHub token/x-oauth-basic and GitLab oauth2/token mirror legacy callback mapping. No credential persistence/provider refresh yet.
- Credential callback checks requested origin and bounds callback attempts. Default certificate verification remains enabled. Errors return libgit2 class/code rather than server messages that may echo secrets. This is not evidence of all redirect credential behavior; cross-host redirect, TLS/proxy and actual providers still need acceptance.
- Output distinguishes zero advertised refs from zero branches, includes server HEAD symref/default branch and head OID, sorted full branch refs/OIDs, and rejects oversized/invalid/duplicate branches or incompatible OID width. Does not infer the default branch from alphabetical ordering.
- Cargo fmt/check/clippy -D warnings passed. Initial compile exposed callback lifetime declaration order; corrected and retained initial-failure.json. Generated permission file produced through existing AppManifest build.
- Actual-source Rust stdin probe compiled and ran against a temporary Bun loopback smart-HTTP advertisement fixture: 14 assertions passed for anonymous, basic/provider credential mapping, wrong credentials, empty advertisement, sorted branches/default HEAD, invalid URL and basic username. Synthetic advertised OIDs do not represent downloadable objects; this is not fetch/clone evidence. No saved new test script or browser-use. Fixture stopped and native process exited 0.
- Evidence: artifacts/git-remote-advertise-check/state.json, probe-state.json, probe-build.log, probe-runtime.log. No new native app release/probe build, no mounted UI/Tauri IPC acceptance yet.
- Next add bounded network lifecycle/cancel and settings/client admission before exposing this in UI, preserve URL input normalization compatibility, then saved Playwright remote scenarios. Provider token storage/refresh, fetch, advance-ref journal, pull/merge, clone and push remain pending. Full migration is incomplete.
- Docs used: https://docs.rs/git2/latest/git2/struct.Remote.html ; https://docs.rs/git2/latest/git2/struct.RemoteConnection.html ; https://docs.rs/git2/latest/git2/struct.RemoteHead.html ; https://docs.rs/git2/0.21.0/git2/struct.RemoteCallbacks.html . Installed git2 0.21.0 source also checked; no dependency install/init required.

## Evidence and compatibility

Legacy paths below are relative to _backup/legacy-electron/packages/insomnia/src/. Inspected source, not production credentials.

| Source                                            | Observed behavior                                                                                                                                                       | Migration requirement                                                                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| models/git-repository.ts                          | Local-only repository model: uri, credentials, author, needsFullClone, uriNeedsMigration; cannot sync/duplicate                                                         | Keep connection/auth metadata out of resource trees and portable exports; import legacy connection settings deliberately                  |
| ui/routes/git-actions.tsx:328                     | Hosted URL conversion followed by scp-like git@host:path and ssh:// fallback to HTTPS                                                                                   | Preserve supported input forms with a visible normalized endpoint; distinguish input compatibility from actual SSH transport              |
| sync/git/utils.ts                                 | Basic username/password; GitHub token as username + x-oauth-basic; GitLab oauth2 + token; provider token lookup and GitLab refresh                                      | Implement explicit anonymous/basic/GitHub/GitLab modes and provider token lifecycle, not only a generic password field                    |
| git-actions.tsx:540                               | Update URI, author and credentials; new bindings require full clone                                                                                                     | Save settings atomically, invalidate stale sessions when changed, expose connection errors without losing entered values                  |
| sync/git/shallow-clone.ts and git-actions.tsx:349 | Single-branch depth-1 preview; require one Workspace when present; no workspace creates design workspace; existing ID navigates to existing workspace; later full clone | Stage clone separately, validate resources/topology before workspace installation, handle no/multiple/existing workspace cases explicitly |
| sync/git/git-vcs.ts:239,279                       | Remote branch advertisement; origin configuration                                                                                                                       | Read advertised branches separately from local branches; show network failure rather than silently treating it as empty                   |
| sync/git/git-vcs.ts:407                           | Fetch supports single/all branches, depth/relative, prune and pruneTags                                                                                                 | Track fetched refs independently of local branch/resource application; preserve depth/prune behavior in the compatibility backlog         |
| git-actions.tsx:921                               | Push current branch; equality check gives Nothing to push; action reads force but does not pass it to push                                                              | Normal push and explicit rejection reporting required. Do not infer that legacy UI actually force-pushed from the unused form value       |
| git-actions.tsx:998                               | Fetch depth 1 then pull; Git writes flow through database-backed filesystem                                                                                             | Pull must update native refs and workspace as one recoverable transition, including local edits                                           |
| sync/git/git-vcs.ts:398                           | Merge current branch with chosen branch                                                                                                                                 | Support fast-forward, up-to-date, divergent merge and conflict workflow; fast-forward-only is an intermediate milestone                   |
| sync/git/http-client.ts                           | Electron HTTP transport, redirects and binary body                                                                                                                      | Replace with native transport; verify proxy/TLS/redirect/provider compatibility independently                                             |

Legacy clone also preserves files outside .insomnium through its routed filesystem. Native merge/push must preserve the complete Git tree; the resource codec only owns .insomnium. Do not reconstruct a remote repository solely from application resources.

## Confirmed journal gap

2026-10-07 implementation in progress: src-tauri/src/git_journal.rs now reads schema1 checkout and schema2 same-branch advancement recovery records. Version1 lock_refs still rejects equal source/target branches and requires both tips to remain at their recorded OIDs; its recovery distinguishes before/after by symbolic HEAD branch identity. The checkout command explicitly rejects schema2. Schema2 reader validates exact old/new OIDs, pinned graph inputs and collection trees, then classifies recovery by branch tip plus whole workspace. Saved native git-advance-recovery1791359060983 passes20 synthetic-state/refusal/actual Windows write-failure checks and schema1 compatibility; no advancement writer/public pull/merge command is implemented yet.

Version1 **cannot** represent pull/merge advancing the current branch: symbolic HEAD stays on the same branch while its OID changes. Removing its equal-branch guard would make recovery ambiguous. Finish the versioned advance-ref writer and verify explicit OID-based recovery before wiring pull/merge to workspace writes. Preserve support for recovering existing version-1 checkout journals.

Proposed advance-ref record: operation/repository/workspace IDs, exact branch reference, old/new OIDs, before/after workspace, and pinned merge inputs. Native validates candidate resources and complete commit tree. Under GitState then StorageState, lock HEAD and the branch, require symbolic HEAD/name and old OID, persist journal, then compare-and-update ref. Recovery uses:

| Branch tip | Workspace                                                        | Result                                                       |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| old        | before                                                           | Nothing applied; retain before and finish aborted transition |
| new        | before                                                           | Complete recorded after workspace                            |
| new        | after                                                            | Verify and finish cleanup                                    |
| old        | after, unrelated tip, detached/changed HEAD, unrelated workspace | Refuse overwrite; retain journal for recovery                |

These rules are implemented and accepted for synthetic states in the schema2 reader, but the journal-producing writer and its actual interruption/outcome acceptance are still pending. Schema2 retains the existing envelope fields with equal sourceBranch/targetBranch and distinct sourceOid/targetOid; its required advance field contains kind (fastForward or merge), incomingOid and mergeBaseOid. Fast-forward pins incoming=new/base=old and proves ancestry; merge pins exact ordered old/incoming parents and their base, requiring divergent inputs. No shape allows schema1 to be reinterpreted as advancement. Lost replies must re-enter recovery and inspect recorded state; they must not trigger an automatic second pull, merge commit or push.

## Implementation sequence and exit evidence

1. **Connection settings and authentication.** Add typed Rust request shapes and plain-JavaScript UI model for URI/provider/author and credential handling. Reuse local binding/persistence admission. Keep secrets out of logs, ref names, Git trees and portable exports. Inspect existing provider token storage/refresh code before migrating it. Verify legacy URL forms and self-hosted endpoints. Do not blindly forward credentials to another host after redirects.
2. **Read-only remote advertisement.** Start from git2 Remote::connect_auth/list/default_branch with explicit callbacks. Return advertised full refs and OIDs, default branch, and empty-repository state; validate supported object format against current 40-hex OID model. Disconnection, authentication failure, cancellation and timeout are distinct from an empty branch list. No workspace/ref changes.
3. **Fetch.** Use explicit remote branch refspecs and scoped tracking namespace. Fetch/download must never target refs/heads or alter HEAD/workspace. A settings change must not silently reinterpret old tracking refs as belonging to the new URL. Return captured endpoint/revision and refs actually read; revalidate before using them in later operations. Handle partial network failure and pruning without claiming workspace synchronization.
4. **Versioned advance-ref journal.** Implement and verify the above recovery table, backward compatibility and uncertainty handling. Reuse quiescence, candidate validation, retained edits and startup recovery. Do not keep StorageState locked during network I/O; revalidate baseline after network completion before journaled application.
5. **Pull and merge.** Classify graph relation; up-to-date does nothing; fast-forward advances with journal; divergent merge builds a candidate complete tree with pinned parents and handles conflicts before applying. Then reconcile working resource edits against old/new committed snapshots. Keep non-resource files and private/foreign/local-only data. Conflict resolution/cancel must leave an inspectable recoverable state.
6. **Clone and remote branch checkout.** Stage owned repository path, fetch complete required history, validate collection, apply additive import/binding only after validation, retain resumable state after uncertain failure. Handle empty/no-Workspace/multiple-Workspace/existing-ID repositories. Checkout remote branch needs a local ref and recorded binding without overwriting an existing different tip.
7. **Push.** Pin local branch/OID and explicit destination; use normal non-force update. Inspect push_update_reference callback status even when the transport call succeeds. Preserve local state on server rejection. If transport outcome is unknown, re-advertise and report observed remote state; do not blindly resend. No push to the owner's real remote during development without authorization.
8. **Provider/UI acceptance and release.** Wire controls into Insomnium Git layout; provider login/refresh, progress/Stop/retry, settings reload, branch list, fetch/pull/push/merge/clone all need saved Playwright scenarios and native evidence. Rebuild production only after remaining full PARITY items are addressed.

Read-only advertisement can be implemented before the advance-ref journal. Fetch can land next, but it is not pull. Keep later steps in scope.

## Saved Playwright acceptance backlog

Create reusable files in tests/ui with shared fixture helpers; use Bun and the verified isolated app identity. No browser-use or inline ad-hoc UI automation. Use a disposable loopback Git endpoint for deterministic transport and authentication fixtures; do not use real account secrets.

- Settings save/reload, invalid URI/provider, cancellation and changed binding/session.
- Advertisement: public/basic/provider mapping, wrong credential, empty repo, unavailable endpoint, redirect host change, cancellation; local HEAD/resources remain exact.
- Fetch: branch add/update/delete, requested depth/pruning, interrupted transfer, stale endpoint, unchanged local HEAD/resources.
- Pull: up-to-date, fast-forward, divergent merge, conflicts/cancel, preserved local/private/foreign/history, post-ref workspace-write failure, restart/lost reply.
- Push: new branch, equality, normal advance, server rejection, remote race, unknown response; server's final refs asserted separately.
- Clone: no workspace, one workspace, multiple workspaces, existing IDs, interrupted/resumed install, external tree content preserved.
- GitHub/GitLab actual provider login/refresh and proxy/TLS remain separate acceptance from synthetic loopback fixtures.
- OS-close during network work and retained-copy OS dialog need explicit lifecycle acceptance; explicit test window destruction is insufficient.

## Official documentation consulted

- [git2 Remote](https://docs.rs/git2/latest/git2/struct.Remote.html): connect_auth/list and fetch/download/update_tips distinction; push callback requirement.
- [git2 RemoteCallbacks](https://docs.rs/git2/0.21.0/git2/struct.RemoteCallbacks.html): allowed credential types, progress, push negotiation and per-ref rejection.
- [git2 FetchOptions](https://docs.rs/git2/0.21.0/git2/struct.FetchOptions.html).
- [git2 Repository](https://docs.rs/git2/latest/git2/struct.Repository.html#method.merge_trees): native tree/merge APIs to inspect before implementation.
- [Git fetch](https://git-scm.com/docs/git-fetch) and [Git push](https://git-scm.com/docs/git-push).

Existing git2 0.21.0 already enables https/ssh in Cargo.toml. No package install, initialization, new tests or remote network operation performed for this design checkpoint. Implementation must use documented APIs; no new subsystem generator is needed for the existing Rust module. Build/check commands remain direct Cargo and Bun x --bun, with shell:false/windowsHide:true launch on Windows.
