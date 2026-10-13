# Old event-api worktree: finite integration classification

The42 modified tracked paths in Root's comparison remain exact:25 already equal main,15 superseded snapshots and two uniquely unmerged but explicitly unadopted readiness files. There is no merge-ready API/Rust/plugin delta in this set. No Root or old-worktree file was modified, and no application, test scenario, build, native process, network or SDK/provider investigation ran.

Evidence is `artifacts/legacy-event-api-review/classification.json`: original Root comparison SHA, current peer/main raw SHA/size per42 rows, all14 complete nondoc diffs, three documentation numstats and the two readiness source pairs. Every peer/main hash matches the original comparison; nondoc sources and all peer files were rehashed after capture. Applicable old AGENTS was read; no Claude instruction files were found in roots/parent or relevant source/docs/test scopes. Root current STATUS/PLAN/PARITY were read separately.

| Differing tracked path | Classification and exact source evidence |
|---|---|
| `.gitignore` | Superseded. Main adds `/src-tauri/notices/native/`; peer omits it. |
| `docs/migration/STATUS.md` | Historical records, not an integration delta. Main is the current Root acceptance/handle authority. |
| `docs/migration/PLAN.md` | Historical migration plan. Preserve current Root scope and latest assignments; never replace wholesale. |
| `docs/migration/PARITY.md` | Historical parity record. No code change follows from restoring the old document. |
| `src-tauri/build.rs` | Superseded. Main lines4–6 register three Spectral commands missing in peer. |
| `src-tauri/capabilities/default.json` | Superseded. Main lines7–9 contain the same three bounded permissions missing in peer. |
| `src-tauri/src/lib.rs` | Superseded. Main adds Spectral modules/state/commands, cancellation on window destruction and exit/restart drain. Old `.run(...).expect(...)` would revert main's lifecycle at lines166–185. No peer-only native API remains in the complete diff. |
| `src-tauri/tauri.conf.json` | Superseded. Main line35 adds native notices resource mapping missing in peer. |
| `src/lib/plugin-runtime.js` | Unique, useful intent but **not adoptable**. Peer lines133–164 retain the module evaluation handle, inspect Promise readiness, run charged jobs one-at-a-time within the original deadline and dispose handles. Main lines133–137 immediately disposes evaluation. Existing readiness/cleanup proof is RED; see below. |
| `src/lib/styles/features/collections.css` | Superseded. Main line23 narrows hover rule to `.ui-button.tree-request:hover:not(:disabled):not(:focus-visible)`; peer retains older broad overrides. |
| `tests/ui/design-system.js` | Superseded. Main adds density and multipart ownership/composition assertions; old assertions remain. |
| `tests/ui/fixtures/design-system.svelte` | Superseded. Main adds the matching density/multipart controlled fixture. |
| `tests/ui/fixtures/plugin-session.js` | Unique companion to blocked readiness. Peer inspector instrumentation at lines13–24 and abort/source-replacement controls at lines51–52 are absent in main; they belong to the same unadopted feature, not a independently accepted replacement fixture. |
| `tests/ui/helpers/component-fixture.js` | Superseded. Main lines39/51/61 support explicit fixture plugins/options, preserving old default behavior. |
| `tests/ui/helpers/split-pane.js` | Superseded. Main adds API/Test content and GraphQL responsive/capture assertions ahead of the old helper body; no unique old-only helper is lost. |
| `tests/ui/nocturne-theme.js` | Superseded. Main adds lint diagnostics/ownership, stable tooltip selection, token readiness and isolated lint fixture; old token checks survive. |
| `tests/ui/nocturne-workspace.js` | Superseded. Main adds content/runner/GraphQL responsive helpers and cases to old flow. |

The25 byte-equal rows include Event bridge/guest DOM, worker/session/sync/leases, API/synthetic fixtures and packaging helpers. Their equality establishes that those old tracked bytes already exist in main; it is not full Event/native/Window parity acceptance.

## The remaining real gap and why its code is excluded

Main's immediate evaluation disposal still lacks the proposed ESM readiness drain in this path. Historical `AGENT-EVENT-MODULE-READINESS-REVIEW.md` describes finite TLA metadata readiness failure and the original bounded requirement. `AGENT-PLUGIN-ESM-READINESS.md` explicitly says NOT integration-ready: finite proof manifest `8ac4b2780e47788c9c94d917ce75cbdfba398b4b5d9b378e7deb15861f4b97b9`,26 rows/24 accepted/two original infinite Promise-chain interruption assertions RED, all32 workers terminated. This is historical evidence, not a new current runtime replay. Its report line21 prohibits integration while cleanup/interrupt remains red. Later automatic review stopped the upstream SDK investigation; that old report's suggested next investigation is superseded and is not resumed here.

Minimal useful handoff is to retain the two source snapshots, associated saved readiness scenario and immutable negative proofs as deferred evidence, keep current main runtime unchanged, and keep ESM readiness plus clean original interruption/disposal as required open scope. No new fix, SDK patch, extra budget, postdeadline job drain, engine adoption or provider/protocol permission change is proposed or authorized by this audit. Do not import the entire peer test fixture to reactivate an unapproved runtime feature.

## Old worktree disposition

No source path from these17 is recommended for copying into main now. Preserve peer source/proof bytes and this finite classification before Root decides any worktree archival/removal. This audit does not inventory all ignored artifacts and cannot authorize deleting the old workspace; its important immutable runtime/negative proofs remain there. Root owns any later archival/cleanup decision. Current source freeze, all original migration/linkage/distribution/native/UI/UX requirements and the stopped SDK/provider boundary remain unchanged. Handles: none. `/compact` unavailable; report/topic/frozen evidence is the handoff.
