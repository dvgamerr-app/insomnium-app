# Remaining source, notice and distribution gates

Read-only audit of root `fe1ea212342f58eafdc05571248782e2270dd8a6` after accepted bounded initializer provenance. No initializer replay, root edits, current notice generation, cache change, compiler/build, application/profile launch or rejected SDK/provider investigation. Source-only/pure inspection writes only the isolated new `artifacts/notice-distribution-next-audit` offer. Root PLAN/PARITY requirements remain unchanged.

## Current evidence versus remaining implementation

| Requirement | Actual current evidence | Remaining gate |
| --- | --- | --- |
| Authentic native source notice candidates | Current f72 policy5/receipt3: 770 locked identities, 424 whole blobs/1,343 whole origins, 24 partial-header origins/4 blobs, 5 repository origins/3 blobs | 41 registry +2 local filename/discovery gaps remain. Header references/SPDX are not full grants; repository supplements do not change availability. Nested/per-file/full source obligations are not exhausted. |
| Selected compiled initializer | Root independently accepted matching edbb/PDB, selected Cargo/header/template and original linker evidence | Bounded initializer acceptance does not establish every retained member/function/source checksum, all native components or legal coverage. No repeated initializer proof here. |
| Native target linkage | Native inventory explicitly records `targetLinkage: unproven`, unknown feature/profile build recipe | A separate actual build-selected component/object evidence table must distinguish target/feature/profile selection, stripped/folded/unknown and external libraries. Do not silently label all 770 Windows-linked. |
| Spectral package notices | Actual 185 pinned identities/184 installed, recovered runtime origin and Bun source-text candidates, incomplete coverage | Three MIT text gaps and absent optional package remain explicit. Bun source candidates/old public runtime identity do not prove current embedded linked-component completeness or variant/archive/link map. |
| Frontend package notices | Root Bun.lock parses to 283 distinct identities; root source imports actual package code | There is no separate root-lock frontend package/source notice inventory in current resource map/collectors. Dev/build-only packages and actual emitted module selection require separate classification. |
| Installed distribution | Current edbb source/assets/sidecar/notice copy closure accepted; historical Linux packaging/process evidence retained | Installer/upgrade/data retention, signing/notarization/updater, artifacts retained from actual CI, supported architecture/distro, macOS and legacy formats remain open. Closure/source acceptance is not installation or legal acceptance. |

Counts above are measured from current saved inventory/source files, not extrapolated from historical generations. `coverage-and-targets.json` records all 43 gap rows. An initial query used the wrong availability spelling and returned zero; inspection corrected it to the actual closed `no-candidate-discovered` enum. The negative is retained; no zero-gap claim or collector change resulted.

## Concrete target defect: universal CI cannot enter the packaging hook

Current `.github/workflows/desktop-build.yml:26` declares macOS `universal-apple-darwin` and the build step forwards its matrix target. `scripts/tauri-spectral-hook.mjs:9` calls `spectralPaths(target)` before any child/service. Both existing producer target tables (`scripts/spectral-artifact.mjs:5` and `scripts/build-spectral-linter.mjs:8`) contain five individual architectures and no universal target.

The SAME root hook was invoked with mocked services for build/dev/bundle and explicit `universal-apple-darwin`. All three refuse `Unsupported or missing TAURI_ENV_TARGET_TRIPLE for Spectral packaging` with **zero service calls and zero real children**. The five admitted individual target paths remain valid. This is a reproduced compatibility defect, not a failed Mac build or CI runtime observation.

Pinned installed Tauri CLI is 2.12.0. Its [exact build source](https://raw.githubusercontent.com/tauri-apps/tauri/tauri-cli-v2.12.0/crates/tauri-cli/src/build.rs) accepts universal, passes the supplied target to the application interface and runs the configured before-build hook. Its [exact Rust interface](https://raw.githubusercontent.com/tauri-apps/tauri/tauri-cli-v2.12.0/crates/tauri-cli/src/interface/rust.rs) retains supplied target and exports it as `TAURI_ENV_TARGET_TRIPLE`. Captured raw sources/hashes are in `primary-references.json`. [Tauri sidecar documentation](https://v2.tauri.app/develop/sidecar/) requires matching target-suffixed external binaries. [Bun's target documentation](https://bun.com/docs/bundler/executables) documents separate Darwin x64/arm64 targets; this live documentation is not a pinned Bun1.4.2 universal-binary guarantee.

Proposed bounded repair, not implemented:

1. Introduce one closed producer/packaging target-descriptor module and reuse it in both existing tables; preserve all five target mappings, filenames, refusal behavior and freshness inputs. Extend the SAME saved packaging audit with declared workflow target coverage, so a CI matrix cannot silently drift from sidecar support.
2. Add a distinct universal descriptor only after an authentic two-slice producer contract is reviewed. It must bind both actual architecture-specific Bun outputs, source/lock/compiler identity, the assembled target-suffixed binary, exact architecture/slice inspection and tamper/freshness checks. Do not map universal to one architecture, rename a thin binary or assume arbitrary `lipo` preserves standalone Bun embedded data. No build or lipo was executed here.
3. If root elects immediate individual-architecture CI jobs, declare Darwin x64 and arm64 explicitly and retain universal packaging as a separately required future gate. Two individual bundles do not fulfill the existing universal requirement. Preserve Bun-only CI and every installer/signing/runtime gate. This option is a review decision, not an unapproved scope removal.

Candidate files: new `scripts/spectral-targets.mjs`, the two target consumers, SAME existing `tests/packaging/spectral-notices.mjs`, and workflow/docs only after the selected architecture policy is explicit. Unknown targets continue to fail before producer/frontend; bundle remains validation-only. Producer/helper pins and current packaged authority intentionally become stale after source adoption and require deliberate new target preparation. No permissions/CSP/provider/backend change is needed.

## Concrete missing notice scope: frontend source corpus

`src/lib/editor-engine.js:1` imports CodeMirror and subsequent lines import modes/addons/CSS. Root package and lock pin `codemirror@5.65.21`; installed package metadata agrees. Its actual full LICENSE is 1,113 bytes, SHA `168a4becc968f5001e2ee2e0291b6e4daabafc1894a11ade1e11d56e96096e07`; manifest SHA `95a808668722f226219643949ae753d88d730b370c8b3b6f5decdc802fb056c0`. Exact lock integrity and raw files are captured. The current Spectral185 inventory has no such package origin. Tauri resource mapping contains `notices/spectral` and `notices/native` only, and current generators read tools/Spectral lock and Cargo corpus respectively.

This establishes absent explicit frontend inventory/collection, not that license bytes can never occur inside emitted JavaScript, nor exact npm tarball authentication, retained object/module membership or legal insufficiency of a particular binary. Raw installed source is a candidate; exact registry archive provenance and actual emitted-module classification remain separate.

Proposed next notice implementation lane: a deterministic **frontend-source-corpus candidate** collector using the existing pinned JSONC lock parser, actual root lock identities/integrities and authentic LICENSE/NOTICE/COPYING bytes. Keep source identity/version, all origins/raw hashes, available/missing/no-candidate state and unknown target linkage; distinguish dev/build-only or unknown, do not equate 283 lock identities to shipped packages. Prefer immutable exact published archives/source admission independently verified against lock integrity; ambient installed files alone must not become a coherent-tamper authority. Share reusable data parsing/byte preservation, while leaving historical Spectral/native schema and original assertions unchanged. Hook/resource adoption is a separate reviewed feature; no completeness blocker, canonical substitution or automatic current generation promotion.

Meaningful acceptance: deterministic/raw-byte/dedup controls, missing source nonblocking, version/integrity/source authority refusal, coherent blob+receipt rewrite refusal, traversal/symlink/duplicate provenance guards, explicit old fixture preservation and fresh-process validation. Actual emitted frontend module/asset attribution can augment a separate receipt later; no blanket `all root lock packages linked` claim. A first closed CodeMirror candidate is possible, but it should sit within this reusable source-corpus boundary rather than imply whole frontend coverage.

## Exact inputs, checks and next authority boundary

`current-input-pins.json` records 23 actual root paths with raw sizes/SHA and an after-read rehash: workflow, target consumers/hook, collectors/validator, Tauri config, policy5, package/root lock, actual editor source, CodeMirror raw package/license, pinned CLI metadata, both actual inventories and PLAN/PARITY/STATUS/CI/Linux records. Relevant source bytes are copied only into this owned offer. Product guards must match before future implementation; operational docs are historical context, not forever-frozen executable inputs.

Actual command, terminal 0:

```powershell
bun artifacts/notice-distribution-next-audit/inspect.mjs
```

The script imports existing definitions and calls only pure path/lock functions and the mocked early-refusing hook. It never invokes producer/collection/validation services, children, Cargo or target applications. Output records three universal refusals, five supported paths, root283 identities, current native/Spectral counts and the missing explicit CodeMirror origin. Do not run it in the frozen proof directory; independent reproduction uses a new owned copy. No accepted scenario reruns or large old proof copies occurred. Previous 49-file initializer proof and prior evidence remain untouched.

Root decides the next repair lane and reviews exact current source guards before any source adoption, hook generation, CI/native build or profile use. The universal blocker is the smallest reproduced code defect; frontend inventory is the larger concrete missing implementation for the original full-notice goal. Whole native/Bun/source/legal/target/distribution/platform/signing/update coverage remains explicitly open. Own handles: none. `/compact` is unavailable in this interface; topic commit, STATUS and frozen minimal evidence provide the handoff.
