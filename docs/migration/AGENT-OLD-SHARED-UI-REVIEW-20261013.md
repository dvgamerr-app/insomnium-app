# Old shared-ui tracked-difference review — 2026-10-13

No unique useful unmerged product or scenario code was found in the requested18 differing tracked paths. They are superseded snapshots; broad adoption would remove current structural source navigation, event semantics, native linter lifecycle/packaging and shared validation coverage. This is a bounded source/Git review, not runtime acceptance or an audit of all old untracked files. Old worktree HEAD remains25fa97a; its modified files are copied/frozen handoff generations, not18 new commits ready to merge. Main reviewed at52ce8da with existing WIP untouched.

Input: Root `artifacts/legacy-agent-integration-audit-v2/tracked-worktree-comparison.json`; all18 peer+main RAW SHA rows rehashed exactly. None is whole-CRLF-normalized equivalent, so these are semantic/source differences rather than newline-only exemptions. Full `git diff --no-index --ignore-space-at-eol` outputs retained locally with input/comparison hashes. Root files remained read-only and their pins are rechecked at freeze.

| Exact path | Classification / current evidence |
| --- | --- |
| docs/migration/PARITY.md | Historical summary; retain as old evidence, never overwrite main current gates. |
| docs/migration/PLAN.md | Historical plan; active assignments/accepted milestones have advanced. |
| docs/migration/STATUS.md | Historical handoff/generation; not current profile/process authority. |
| src-tauri/build.rs | Superseded: main adds reserve/run/cancel Spectral generated command manifest. |
| src-tauri/capabilities/default.json | Superseded: main has matching three Spectral permissions; old snapshot omits them. |
| src-tauri/src/lib.rs | Superseded: main manages Spectral state/process modules, command registration, window cancellation and exit/restart drain. |
| src-tauri/tauri.conf.json | Superseded: main real linter dev/build/bundle hooks, externalBin and retained notice resources; old lacks packaging. No old identity/config overlay. |
| src/lib/components/ApiDesign.svelte | External join already retained; main adds structural source catalog fallback, combined structural+semantic annotations, exact source/range jump and unavailable-source disabled controls (135-148,520-538,903+). Old jump always targeted main source/point. |
| src/lib/openapi.js | External captured structural join already retained; main adds capturedApiSources, prepareApiOrigins, lexical full ranges and source catalog, source-aware parse diagnostics/unavailable identity and dereference origins. Old lacks these. |
| src/lib/openapi.worker.js | Superseded: main returns genuine failure.analysis (19) so structural failure can publish source diagnostics safely; old returns only String(error). |
| src/lib/plugin-dom-bridge.js | Superseded: main WheelEvent + synthetic Focus/Input constructors, typed malformed packet guards, real Wheel fields (168-171,225+). No old-only bridge feature. |
| src/lib/plugin-guest-dom.js | Superseded: main Wheel class/constants/conversions, typed dispatch/interface/subclass preservation (113,254+,542-544). Old lacks them. |
| src/lib/plugin-runtime.js | Superseded: one current addition installs owned WheelEvent at100. Old otherwise equivalent normalized content. |
| tests/ui/design-system.js | Main adds six-profile compact/default Field density and actual multipart ownership/composition assertions; old assertions remain and additions must not be dropped (16-39,1090+). |
| tests/ui/fixtures/design-system.svelte | Main adds actual compact/default controls and owned multipart read/callback/admission/disposal fixture; old fixture is predecessor. |
| tests/ui/fixtures/plugin-guest-dom.js | Main adds actual subclass/synthetic focus/input/wheel/window guard fixtures/typed guard entrypoints. Old-only fixture behavior not found. |
| tests/ui/helpers/component-fixture.js | Main additive optional Bun plugins passthrough, omitted-default body retained (51 and withComponentFixture options). Old would break accepted Cookie/importer-scoped verification paths. |
| vite.config.js | Main noDiscovery/predeclared lazy CodeMirror modes/addons/url and ignored artifacts (17,28+,97), accepted dev reload correction. Old lacks these, not a unique optimization. |

Git corroboration (main source history, no remote actions): `2849148 feat(spectral): generate requests from accepted external sources` integrated the old external join; `18cb285 fix(openapi): retain structural diagnostic source and full ranges` explains three OpenAPI/parent differences. `bf77519`, `517723e`, `abcf292` own Focus/Input/Wheel semantics; old bridge/runtime overwrite would regress these. `7fdcbc4` owns lint/dev optimizer correction; `e39385a` compact namespace/default guard, `be300eb` multipart association/focus, `4eadd0f` Cookie fields, and current helper pass-through explain harness evolution. Native registration/config provenance progressed through `1741cf8`, `2624334`, `e762057`, `b61425a`; old Rust/config is ineligible for wholesale merge.

No patch offered: current main contains the useful old code plus newer requirements. Do not cherry-pick the old dirty snapshot, old Rust/config or old migration prefixes. Untracked old docs/fixtures/new files are outside this18-row request and remain local/frozen; they need a separate explicit comparison if later claimed unique. This review does not reopen accepted old topics or assert current full migration/native/UI/AT completion.

CurlV2 six-profile SAME headless pass is parent-reported49716/46096, independent from this review; candidate151/proofs unchanged and Root adoption remains after namespace. Root current edbb/f66 source unchanged by this agent. No Root/browser/native/build/compiler/profile/cache/remotes actions, handles none/profile unclaimed. Topic + ownSTATUS handoff; `/compact` unavailable explicitly.
