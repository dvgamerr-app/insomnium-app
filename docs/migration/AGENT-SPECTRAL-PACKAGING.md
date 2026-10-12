# Spectral producer packaging — guarded handoff

2026-10-12. Isolated packaging implementation against root producer9326928. No root writes, native application/profile/browser/dev server launch, build.rs/Cargo/capability overlap or SDK/provider changes. Root owns integration/commit/STATUS. /compact unavailable; this document is the handoff. All own process handles terminal.

## Change and ownership

Nine code paths only: src-tauri/tauri.conf.json (build hooks and externalBin ONLY); new scripts/tauri-spectral-hook.mjs, spectral-artifact.mjs, linux-elf-inputs.mjs, linux-elf-closure.mjs; existing build-desktop.mjs and three generate-{deb,rpm,appimage}-config.mjs. This report is the tenth guarded path. Original UI/security/CSP/permissions and desktopwrapper CLI parsing/config merging remain unchanged.

Captured root/own-before bytes in artifacts/spectral-packaging-baseline/manifest.json. Root producer script and five tool package files are byte-identical read-only prerequisites, never integration deltas. Frozen-lockfile ignored-script installation uses independent own tools/spectral-linter/node_modules; no shared/root dependencies were modified. The unadopted stock-readiness source and prior immutable proofs remain separate and unchanged. Frontend compilation here does not adopt that unrelated worktree candidate or claim current-root native/UI acceptance.

## Build/dev/bundle behavior

Tauri externalBin points to the UNSUFFIXED logical binaries/spectral-linter; existing producer emits spectral-linter-<Rust-triple>[.exe]. The new Bun hook rejects absent/unknown TAURI_ENV_TARGET_TRIPLE, passes the exact supported triple as argv to the unchanged producer, and awaits successful producer completion before frontend build OR dev server startup. No shell interpolation or generic command permission. Child signal forwarding retains CLI shutdown behavior.

After successful production, a separate .packaging.json records current producer source identities and binary hash. Bundle-only hook launches NO producer/frontend command: it validates target/Bun target/version/size/binary SHA, lock SHA and six producer input hashes against the original producer manifest/stamp. Missing, changed-source, changed-binary, wrong target and stale artifacts fail before bundling. This covers standalone tauri bundle via beforeBundleCommand. It validates unsigned BUILD inputs; signed/installed binary integrity remains a separate policy/gate, not claimed by the producer hash.

Supported producer triples and existing Bun targets:

| Rust triple | Bun target |
| --- | --- |
| x86_64-pc-windows-msvc | bun-windows-x64 |
| x86_64-unknown-linux-gnu | bun-linux-x64-baseline |
| aarch64-unknown-linux-gnu | bun-linux-arm64 |
| x86_64-apple-darwin | bun-darwin-x64 |
| aarch64-apple-darwin | bun-darwin-arm64 |

Windows ARM64, musl and macOS universal remain explicit unsupported producer/platform gates; no host fallback manufactures them. Installed sidecar is spectral-linter.exe on Windows and spectral-linter on Unix. Native backend owner confirmed current_exe.parent()/spectral-linter.exe agrees; backend resource/name/protocol integration remains independently reviewed. No shell plugin was added.

## Linux dependency closure

Original build--no-bundle → exact reported app path → dependency overlays → bundle flow and custom config/dependency merging remain. Wrapper passes main ELF AND the validated sidecar to all three scanners. Default sidecar triple derives from the completed ELF ABI, not the build host; explicit --target/-t continues to take precedence. Wrong ABI/output collision refuses.

All three generators inspect the transitive DT_NEEDED closure with binutils readelf and ldconfig, matching every dependency's ELF class/endianness/machine and resolving RPATH/RUNPATH ORIGIN paths/cache. Missing dependencies refuse. Readelf inspects files without executing the candidate ELF. Each generator emits an adjacent .dependencies.json audit. DEB stages each ELF for combined dpkg-shlibdeps requirements; RPM passes all ELF inputs to rpmdeps. AppImage retains original architecture-matched dlopen GLES and notice handling. Tauri stages external binaries in AppDir before linuxdeploy's dependency pass; no bulk glibc copying or removed license checks. Actual Linux package installation/closure execution and oldest-supported-host ABI acceptance are NOT verified on this Windows machine.

## Actual evidence

- Two real Windows build-hook executions pass0; final producer93486080bytes SHA95d012bc074cb956d76d79799e601afb59f457182a8814b83588b99e97185789, Bun1.4.2, unchanged lock2b647d41. Worktree-path-specific artifact is distinct from root6231e95d; no byte-identity claim. Final log records producer-ready at line8, frontend command line9, completed frontend line108. No executable/native app was run.
- Final compiler24869 exit0:0 errors/0 warnings. Final hook48605 exit0; earlier42612/72217 terminal. Source frozen during own checks/builds. Standalone hook validation exit0/no child; actual unsupported universal CLI exit1 preserved. Actual desktopwrapper --help delegates to Tauri without native app launch.
- Six saved artifact audit groups pass: build/dev/bundle order; producer failure prevents dev; missing/stale/binary checks; original CLI/Cargo/merge controls; real header ABI/output collision; mocked readelf/cache main+sidecar+shared transitive closure and missing library. These mocks are not actual Linux package evidence. A repeated audit initially saw a previous fixture stamp; each run now uses a fresh owned directory, preserving that tooling negative and all assertions.
- Root prerequisite hashes rechecked; config comparison permits only the four build/externalBin field changes. No broad permissions/CSP or protected runtime deltas. Proof manifest records exact before/current hashes, commands/results/generated artifact and remaining gates.

Commands (Bun only): set TAURI_ENV_TARGET_TRIPLE=x86_64-pc-windows-msvc for `bun scripts/tauri-spectral-hook.mjs build`; `bun scripts/tauri-spectral-hook.mjs bundle`; `bun scripts/build-desktop.mjs --help`; `bun run check`; `bun artifacts/spectral-packaging-baseline/audit.mjs`. No Node/npm/Python launch. Linux production scanners require binutils, ldconfig and the applicable dpkg-dev/rpm tools.

## Official references and remaining gates

[Tauri sidecar naming](https://v2.tauri.app/develop/sidecar/) and [target-aware build hooks](https://v2.tauri.app/reference/config/#beforebuildcommand); [standalone bundle hook implementation](https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-cli/src/bundle.rs); [Bun executable cross targets](https://bun.sh/docs/bundler/executables); [binutils readelf](https://sourceware.org/binutils/docs/binutils/readelf.html); [Tauri AppImage staging](https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-bundler/src/bundle/linux/appimage/linuxdeploy.rs) and [linuxdeploy existing-AppDir dependencies](https://docs.appimage.org/packaging-guide/from-source/linuxdeploy-user-guide.html).

Root must guard/review/integrate before native source capture. Actual current backend/client/Spectral process behavior, target-specific installed sidecar launch, Linux DEB/RPM/AppImage, macOS signed/notarized bundles, Windows installer/signing, final signed provenance, notices/licenses, updater/distribution/full-platform/fullmigration acceptance remain OPEN. No native/Spectral/fullmigration completion claim.

## Root current packaging checkpoint

Root independently rehashes82frozen files/prerequisites and guards10deltas/config-only fourallowedfields. SAME sixgroup artifact audit passes after importpaths are rebound from savedbody location to root eval cwd; assertions unchanged. Actual root targethook16806 exit0: producer before frontend, source unchanged and standalone targetartifact validation pass; compiler18732 exit0errors/0warnings. Generated root93486080byte executable remains EXACT6231e95d exercised17producer cases (own95d artifact not substituted). Root primary CLI Rust env/dev/build/bundle sources additionally confirm targetenvironment forwarding and beforeBundleCommand invocation. Proof artifacts/spectral-packaging-root-proof/root-audit.json. No native app/profile/bundle/install/sign/update/actual Linux proof. Notices inventory is separate: lock186keys/185identities, Windows184pinned identities, fseventsabsent, unpinnedtypeextrasexcluded;4licensefile gaps and completeBunruntime notices remain OPEN. Root handles terminal; UI/receipt agents continue. /compact unavailable; explicit handoff.
