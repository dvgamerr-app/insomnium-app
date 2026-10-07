# Remote branch checkout

The existing Remote panel can fetch a complete selected remote branch, review its collection changes, create a new local branch and switch through the existing journaled checkout. This operates on an installed collection and managed repository. Staged Clone is still required separately, including empty/no/multiple/existing-workspace installation cases.

## Admission and persistence

Network Fetch happens before the request drain. The review pins the local branch/revision captured before Fetch, endpoint, immutable snapshot, selected remote branch and full target revision. Reading or cancelling the review creates no local branch and does not change workspace bytes, index or an active Send. Local reconciliation conflicts disable confirmation; private requests, foreign collections and connection metadata remain local.

Confirmation owns the existing workspace drain and persists a version1 `nativeRemoteCheckoutIntent` through prepared, submitted and created phases. The native command checks the exact saved binding/intent, current snapshot, complete selected history and valid source/target collection trees. It locks HEAD/source/target and creates only a new local ref. It never switches HEAD or writes workspace/index. Existing different tips and case aliases are refused. An existing equal tip is also refused unless its latest reflog proves this exact operation, zero-old creation, revision and author.

Continuation after a submitted/created intent is verify-only: an absent branch is never recreated. A completed native creation with a lost IPC reply retains the intent and original HEAD. After exact creation verification, schema1 checkout applies the full collection reconciliation with its existing journal/recovery. The final save records `nativeRemoteBranches` local/remote/endpoint/creation/snapshot identity and removes the intent. Forget removes only the saved intent; it never deletes or rewinds the created branch. Pending intents block public Fetch/settings and other frontend Git mutations.

## Saved native evidence — Windows, 2026-10-07

Fresh isolated build started1791378895562, finished1791379275819, result0, fixtureHash6820601272446002580; builder25591 terminal0. Native targeted Rust formatting, Cargo check/Clippy `-D warnings` and frontend check0 errors/0 warnings pass.

- `bun tests/ui/git-remote-checkout.js`: artifact `artifacts/playwright/git-remote-checkout-1791379481936`, seven groups. Real smart-HTTP full packs; read-only review/cancel; held native Send drained only on confirmation; real creation followed by controlled lost success reply; reload/verify-only resume without another download or ref rewrite; exact complete remote tree/executable mode/source ref/index/full private workspace and binding; fresh persisted200; stale snapshot/verify-only absent/existing equal-or-different tip refusal; normal explicit confirmation; explicit Forget retaining the created ref.
- `$env:INSOMNIUM_REMOTE_CHECKOUT_CONFLICT='1'; bun tests/ui/git-remote-checkout.js`: artifact `artifacts/playwright/git-remote-checkout-conflict-1791379512542`, local-and-remote edit blocks confirmation with exact full workspace/ref/index and active Send preserved. The same saved scenario and shared fixtures are reused.

Both runs record `renderingMode: native-hidden`, owned PID/window and visible:false. Browser-only fixtures use headless Chromium. Screenshots remain available for review.

Final display refinement uses request names and readable conflict explanations. Fresh builder53742 terminal0, build1791379696923/1791380065818/result0/hash9568362250211973830. Sequential final checkout1791380135083 passes7, conflict1791380171711 passes1; updated screenshot inspected. Accidental overlapping probe launch1791380095005/startup refusal and first run1791380072404/final-review timeout are excluded; both handles were terminal before the passing sequential replay. Previous same-workflow Source Control1791379531842 (13), Pull1791379565179 (8), divergent1791379633402 (5) regressions pass before this display-only refinement. All final handles terminal and owned servers released.

This evidence does not establish process interruption during ref creation, the ownership persistence gap, midwrite/powerloss/diskfull, provider credentials, external concurrent ref/snapshot mutation or other platforms. A superseded snapshot/source conservatively refuses continuation and retains the intent; explicit Forget does not undo a previously created branch. Clone, nonforce Push, broader fault/provider/platform/CI acceptance, all remaining PARITY and remaining shared-input/UX work remain required. POST-MIGRATION-UX.md records the later owner authorization to start Nocturne/shared UI during migration; that does not remove migration requirements.

## Documentation and commands

Consulted [Git switch](https://git-scm.com/docs/git-switch) and the installed git2 Repository/transaction source before implementation. The versioned docs.rs Repository page was unavailable during lookup. New command permission was generated through the project's existing Tauri `build.rs` command generator; generated permission content was not authored manually.

`bun tests/ui/build-recovery-copy-probe.js` builds the isolated native fixture. `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`, `bun run check` and `git diff --check` validate the changed production source. Use the current recovery-copy build state explicitly when running Source Control regressions, whose older default is a separate probe.
