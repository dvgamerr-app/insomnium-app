# Closed Spectral universal target proposal

Source-only proposal in the isolated license worktree. The root workflow's `universal-apple-darwin` hook refusal is already reproduced; this topic supplies a reusable descriptor, a concrete two-slice command plan, independent byte validation and exact source-consumer inverses. It does **not** adopt a producer implementation, create a universal executable, run lipo, download/execute a compiler target, sign, change root/cache/profile or rerun accepted initializer evidence. Frontend notice collection remains a separate future feature.

## Primary route and source limits

Installed root Tauri CLI is 2.12.0. Its [pinned desktop implementation](https://raw.githubusercontent.com/tauri-apps/tauri/tauri-cli-v2.12.0/crates/tauri-cli/src/interface/rust/desktop.rs) builds arm64 and x64, then combines the application with lipo. This does not build its external sidecar. [Tauri's sidecar contract](https://v2.tauri.app/develop/sidecar/) requires the target-suffixed standalone sidecar before bundling. The root before-build hook receives the supplied universal target once before that application build loop.

[Apple's pinned FAT structures](https://raw.githubusercontent.com/apple-oss-distributions/cctools/cctools-1010.6/include/mach-o/fat.h) define big-endian architecture wrappers; its [pinned lipo implementation](https://raw.githubusercontent.com/apple-oss-distributions/cctools/cctools-1010.6/misc/lipo.c) writes each selected thin input's full size into the output slice. This supports the proposed exact-byte check. It does not prove the locally selected Xcode tool identity or runtime success. Actual tool selection/version/hash/argv/process must be recorded on the future Mac build host.

Bun's [documented standalone targets](https://bun.com/docs/bundler/executables) are separate Darwin arm64/x64. At actual pinned Bun source revision `744846f844374847c902b5e7fd59b4342a51ef99`, captured `macho.rs` writes an embedded `__BUN,__bun` section, and `StandaloneModuleGraph.rs` obtains loaded embedded data through a dedicated Mach-O FFI pointer. This makes preserving the full thin Mach-O, its load commands and embedded section a reasonable build strategy; it is **not** an observed universal loader test. The FFI implementation, actual architecture-specific downloaded base binaries, both-slice public version/revision and Spectral protocol behavior still require actual pinned Mac evidence. The optional read-ahead file offset calculation does not itself establish FAT-relative correctness. No Bun source was compiled, executed or patched.

Primary source URLs/bytes/hashes are frozen in `primary-references.json`: Tauri desktop, Apple lipo/FAT definitions and three pinned Bun files. A separately read pinned macho-postlink reference has no matching standalone-loader function and is retained without claiming it resolves the FFI gate. Apple Developer's universal documentation required JavaScript; no browser-use workaround or unsupported successful document read is claimed.

## Shared descriptor and bounded consumer snapshots

`spectral-targets.mjs` has five immutable thin descriptors with original Bun target/filename/modes, plus an explicit universal descriptor containing arm64 then x64 slices and `bunTarget:null`. It never pretends universal is a single Bun compile target. Unknown/missing/case-changed/traversing/prototype names refuse. Existing thin `spectralPaths` returns the same five property keys and values.

The source-only `after/scripts` probe snapshots change only two consumers: `spectral-artifact.mjs` delegates path admission to the descriptor and includes descriptor/Mach-O source freshness inputs; `tauri-spectral-hook.mjs` checks descriptor mode before existing service calls. Every other byte has a checked whole inverse in `source-inverses.json`. Five copied helper prerequisites are unchanged baseline inputs, not offered product changes. `build-spectral-linter.mjs` is also a captured unchanged prerequisite: the actual universal producer branch has **not** been installed.

Universal build/bundle can traverse the hook only under mocked services. The real artifact validation deliberately retains a clear universal producer/schema-not-installed refusal in this proposal. It cannot accidentally accept an editable `bunTarget:null` manifest through the old thin validator. These snapshots are review aids, not an adoption-ready full producer repair. Root must approve and implement the closed assembly/manifest contract before removing that refusal. A shared descriptor by itself does not close CI.

Universal dev is separately refused before services: pinned Tauri `run_dev` forwards a target directly to Cargo, unlike the universal build loop. The five thin dev paths remain unchanged. Use an explicit thin host Darwin target for dev; do not silently choose host architecture for a universal request.

## Concrete future build and publication sequence

`universalCommandPlan` returns data only, with no filesystem/process access. Future root-owned Mac preparation must first resolve the actual tool with documented `xcrun --find lipo`, verify the canonical ordinary executable and record its bytes/SHA/version. The following command shapes then run under frozen source/lock/compiler identity in an exclusively owned new stage, using actual paths:

```text
<pinned-bun> install --frozen-lockfile --ignore-scripts
<pinned-bun> run bundle
<pinned-bun> build <package>/dist/host.js --compile --target=bun-darwin-arm64 --external fsevents --no-compile-autoload-dotenv --no-compile-autoload-bunfig --compile-exec-argv=--no-install --outfile <stage>/spectral-linter-aarch64-apple-darwin
<pinned-bun> build <package>/dist/host.js --compile --target=bun-darwin-x64 --external fsevents --no-compile-autoload-dotenv --no-compile-autoload-bunfig --compile-exec-argv=--no-install --outfile <stage>/spectral-linter-x86_64-apple-darwin
<actual-lipo> -create <stage>/spectral-linter-aarch64-apple-darwin <stage>/spectral-linter-x86_64-apple-darwin -output <stage>/spectral-linter-universal-apple-darwin
<actual-lipo> <stage>/spectral-linter-universal-apple-darwin -verify_arch arm64 x86_64
```

Install/bundle happen once; all existing producer compile flags and tool package are preserved. A command exit and architecture listing are insufficient: independently re-read both actual thin files and the FAT output. `macho-slices.mjs` checks bounded regular Mach-O64 executable headers/closed CPU subtypes, load-command ranges and exactly one bounded nonempty `__BUN,__bun` section. It then checks FAT32/64 big-endian headers, exactly two nonoverlapping/aligned slices, matching CPU/subtype, full input lengths and byte equality, zero padding and no unexplained tail. Unsupported variants fail for review. The parser does not execute the embedded payload or prove executable semantics.

`universal-manifest-contract.json` is a closed review design with **null** actual authority values. Actual future manifest schema2 must record the compiler version/revision, lock/source identity, both thin targets/sizes/hashes/embedded-section identity and FAT output; an independently authenticated actual assembly receipt binds tool/argv/process/times/results and preserved inputs. Keep the old thin manifest fields unchanged. Editable manifest hashes are not independent authenticity: re-read immutable admitted thin inputs/build receipt and compare current producer source/lock/compiler before validation. Future coherent all-hash rewrites must refuse.

Publish only after every compile/lipo/read/check succeeds, manifest last, with explicit prior/new state and rollback behavior. A failure must not pair an old executable with a new manifest or vice versa; retain the previous valid public files or leave a clearly stale/refused stamp. Thin public outputs remain untouched when assembling staged slices. The eventual assembly implementation joins the existing producer freshness inputs alongside descriptor/parser. Bundle is validation-only: no install, compile, lipo or fetch. Preserve producer→Spectral notices→native notices→stamp/validation→frontend order; current Windows receipt/source authority is not reused as a Mac target generation.

Signing/notarization may change slice/code-signature bytes. Keep unsigned source/assembly receipt and actual signed/package identities distinct; do not require an unsigned hash to equal a changed signed binary or claim signed/installed acceptance from pre-sign byte equality. Native/Bun/full notice/legal/linkage/installer/upgrade/platform/signing/update gates remain open.

## Actual pure evidence and adoption conditions

Thirteen current root input paths are captured/rehashed in `current-input-pins.json`: seven script closure paths, workflow/config/package and the producer build/package/lock. Only source data is read. Prepare/check commands are:

```powershell
bun artifacts/spectral-universal-target-proposal/prepare.mjs
bun artifacts/spectral-universal-target-proposal/check.mjs
```

Both exit 0. Saved 31 checks include five original thin descriptors, unknown-target refusal, exact unchanged 15 thin mode service traces, the original three universal negatives, two candidate universal **mocked** build/bundle orders, explicit zero-service universal dev refusal, the six-step argv plan, synthetic FAT32/64 success and damaged/truncated/renamed-thin/duplicate/offset/subtype/section/padding/tail refusals. Twenty-one traces are recorded, real command count zero. Fixture headers and payloads are synthetic data, not compiled or runnable Bun outputs; their hashes cannot populate future manifest authority.

Root should review this contract before implementing the full producer/schema branch in an isolated source lane; extend the SAME existing Spectral packaging audit with actual dual-input/coherent-tamper/failure/publication controls. Only then review exact current product guards, deliberately adopt, and run actual Mac two-slice compile/lipo/public-identity/Spectral protocol/bundle checks with saved ownership. Do not treat the offered mocked hook admission or byte fixtures as actual universal closure, and do not replace universal with a renamed thin executable or remove the original platform requirement. Frontend283 source corpus collection and emitted linkage remain independent open work.

Own live handles: none. Previous 26/49 and all historical offers remain immutable. This topic is source-only committed in the isolated worktree; root is untouched. `/compact` is unavailable through this interface; STATUS, report and frozen manifest provide the explicit handoff.
