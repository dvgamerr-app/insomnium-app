# Linux distribution acceptance

Updated2026-10-01. **Partial: full migration/platform/UI acceptance remains open.**

## Current state and ownership

Both owned containers are stopped; no app/build/installer is live. Do not touch unrelated containers.

| Container                          | Purpose/current state                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| insomnium-unix-acceptance-20261001 | Rust1.98.1/Bun1.4.2 Debian12 build environment; retained /workspace snapshot and /target cache |
| insomnium-deb-runtime-20261001     | Clean Debian12 runtime baseline; probe package now purged; generated profile retained          |

Docker entry point: `wsl -d dockerman-backend --exec docker`. Start the relevant existing container with `docker start NAME`; never recreate due to an observation timeout.

Build container: 2 CPUs/2GiB, host /work mount readonly. Writable source snapshot /workspace; refresh after source edits only when builds are terminal. Identity app.insomnium.probe.linux20261001/product Insomnium Linux Probe is isolated from host production identity.

Runtime container: --init,1CPU/1GiB, no host mounts or published ports. Image pinned to `debian@sha256:3783cc01769c7b2b1b83a5c5ad96c815348e28ed7da68e2e3687004faa906251`. ID54a7107eda7c587aff7cc62a0ec0970860de55cebf4e0f8078a811b8a1c415c8.

## Verified evidence

1. Full Linux locked Cargo check and debug executable linking passed.
2. Linux Bun frozen install (dependency lifecycle scripts ignored), explicit project prepare, Svelte check0 errors/0 warnings and Vite production build passed. No Node executable in ordinary PATH. The --bun CLI process displayed argv/comm node, but /proc/203/exe proved /root/.bun/bin/bun.
3. Original release profile (LTO/opt-level3/codegen-units1/strip) built successfully in15m24s:
   `CARGO_BUILD_JOBS=1 bun x --bun tauri build --bundles deb --ci -- --locked` in /workspace.
   Actual child exit0 is in artifacts/linux-deb-build/state.json; original supervisor6304/child20396 are terminal.
4. Inspected actual .deb metadata/files and extracted executable dependencies. Original default metadata omitted direct dependency constraints. Fixed host src-tauri/tauri.conf.json bundle.linux.deb.depends and copied only bundle configuration into probe config. Regenerated with documented `bun x --bun tauri bundle --bundles deb --ci`; no source/binary rebuild needed for dependency metadata.
5. Corrected .deb8.24MiB exported to `artifacts/linux-deb-build/insomnium-linux-probe_0.1.0_amd64.deb`.
   SHA-256 `264859c92d378a2edef574d53923f65e14c1316211ffbd5f3c5db0590b6bb8cc`.
   Installed executable SHA-256 `3ed3bf2cd9c805c6541dcee285282568ae1d28334c8343a0848ce2eae89a534f`.
6. In clean runtime, `apt-get update && apt-get install -y --no-install-recommends /tmp/insomnium-probe.deb` passed actual exit0 in41seconds. This occurred BEFORE display/test tooling was installed. dpkg status installed0.1.0 amd64, audit/verify empty, ldd no missing libraries. Evidence artifacts/linux-deb-install/{state,verification}.json.
7. Installed release nonroot startup: UID10001 insomnium-probe, dedicated XDG directories, Xvfb/dbus. App and both WebKit processes alive at6seconds; bounded20-second run ended with expected timeout124. AT-SPI bus/registry activated successfully, resolving prior missing-service warning. No sandbox-disabling flags. This proves process startup only, not rendered UI/IPC/workflows/graceful shutdown.
8. Same-version reinstall → remove → install-again → purge passed. All5 package files (binary/desktop/3icons) present or absent as expected, dpkg verify/audit clean. All5 app-created WebKit profile files retained identical SHA-256 at every phase. Final dpkg-query reports package absent (expected exit1); no remaining app/display/dbus processes.
   Evidence artifacts/linux-deb-install/{startup-smoke,lifecycle-baseline,lifecycle,lifecycle-final}.json.

No saved non-UI test scripts were added; orchestration was inline Bun plus OS package/process tools. No browser-use/WebDriver/Node/npm/yarn/Python was run.

## Dependency contract

Official Tauri CLI2.12.0 defaults add GTK/WebKit/tray dependencies; its Debian bundler does not derive every application ELF requirement. dpkg-shlibdeps on debug AND extracted release binary returned the same12 constraints, now configured:

```
libc6 (>= 2.34)
libcairo2 (>= 1.10.0)
libdbus-1-3 (>= 1.9.14)
libgcc-s1 (>= 4.2)
libgdk-pixbuf-2.0-0 (>= 2.36.9)
libglib2.0-0 (>= 2.65.1)
libgtk-3-0 (>= 3.21.5)
libjavascriptcoregtk-4.1-0
libsoup-3.0-0 (>= 3.0.3)
libssl3 (>= 3.0.0)
libwebkit2gtk-4.1-0 (>= 2.41.90)
zlib1g (>= 1:1.1.4)
```

The diagnostic temporary control directory was /tmp/insomnium-package-inspect; dpkg-shlibdeps warned about binary staging location. Actual corrected metadata was subsequently verified and installed in a clean runtime. Tauri appends additional unversioned GTK/WebKit entries; the explicit minimum constraints remain in Depends.

Recalculate when changing Rust/native dependencies or supported build baseline/architecture. Do not assume installed library versions equal required symbol minima.

## Repeat installed-process smoke

Runtime container currently has no installed probe package after purge. Start it and reinstall /tmp/insomnium-probe.deb before another run. Display tools xvfb/xauth/dbus/at-spi2-core/procps and UID10001 already exist.

Inside runtime container as UID10001, set:

- XDG_RUNTIME_DIR=/tmp/insomnium-probe-runtime
- XDG_DATA_HOME=/home/insomnium-probe/.local/share
- XDG_CONFIG_HOME=/home/insomnium-probe/.config
- XDG_CACHE_HOME=/home/insomnium-probe/.cache

Run `timeout --signal=TERM --kill-after=5s 20s dbus-run-session -- xvfb-run -a /usr/bin/insomnium`. Observe processes during execution and verify cleanup afterward. Timeout124 alone is not success or UI acceptance.

## Remaining ordered work

1. Inspect/build remaining configured Linux formats (RPM/AppImage) using official Tauri commands; verify direct dependencies and clean runtime acceptance, including bundled-library behavior.
2. Actual version-to-version upgrade and collection/workspace/schema retention. Same-version reinstall and unchanged WebKit profile files above do **not** cover this gate. Do not fake application upgrade acceptance by changing only package metadata.
3. Linux native UI/IPC/protocol/workflow/visual/accessibility/graceful-close acceptance. User requires saved Playwright JavaScript scenarios with Bun; no browser-use or ad-hoc browser automation. Startup liveness is not a substitute.
4. Production identity/package acceptance, Windows installer lifecycle, macOS, supported distro/architecture matrix and Bun-only CI.
5. All remaining original PARITY requirements; shared input components/UX redesign stay deferred until migration completes.

## References

- [Tauri Debian distribution](https://v2.tauri.app/distribute/debian/)
- [Tauri CLI](https://v2.tauri.app/reference/cli/), installed2.12.0 build/bundle --help captured in artifacts
- [Tauri Linux fake-display CI guidance](https://v2.tauri.app/develop/tests/webdriver/ci/)
- [Debian apt-get installation/reinstall/remove/purge](https://manpages.debian.org/bookworm/apt/apt-get.8.en.html)
- [Bun installation/version pinning](https://bun.com/docs/installation)
- [Tauri CLI dependency injection](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.0/crates/tauri-cli/src/interface/rust.rs)
- [Tauri Debian control generation](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.0/crates/tauri-bundler/src/bundle/linux/debian.rs)

## RPM checkpoint (2026-10-01)

Initial bare Tauri RPM had only GTK/WebKit runtime capabilities and empty license. bundle.license now MIT. New scripts/generate-rpm-config.mjs derives requirements from actual ELF via rpmdeps, with no fixed host architecture. Invoke after native build, then pass output to the documented Tauri bundle command:

```sh
bun scripts/generate-rpm-config.mjs /target/release/insomnium /workspace/artifacts/rpm-dependencies.json
bun x --bun tauri bundle --bundles rpm --config /workspace/artifacts/rpm-dependencies.json --ci
```

Run second command only if generation succeeds; supplied ELF must be the executable Tauri will package. These are actual probe-container paths; use the actual Cargo output path for other environments. Requires rpmdeps (Debian rpm package). Docs consulted: https://v2.tauri.app/distribute/rpm/ and https://bun.com/docs/runtime/child-process. An RPM manpage web fetch failed; used installed rpmdeps successful command and Tauri documented queries.

Corrected artifact artifacts/linux-rpm-build/insomnium-linux-probe-0.1.0-1.x86_64.rpm8.25MiB, SHA-25614ca1c35378fa9346ead84835e44ca9f80375def058fe1800bcdf05010f40db4. All46 rpmdeps capabilities appear in rpm -qpR and License MIT. Non-ELF refusal leaves no generated config. Inspection/export artifacts are in the same directory. Build container stopped; Debian runtime remains stopped/purged.

**Outstanding:** primary desktop:build/CI must integrate fresh generation; bare Tauri still misses requirements. Bind generated metadata to the binary actually bundled; account for targets/profiles and custom configuration. Actual RPM-native clean install/ABI/start/lifecycle remains unverified. Do not present metadata verification as runtime acceptance.

Legacy distribution inventory also includes tar.gz/snap, Windows portable and insomnia URI registration (_backup/legacy-electron/packages/insomnia/electron-builder.config.js). Ensure PARITY/distribution inventory includes these; Tauri targets=all is not evidence of legacy-format completeness.

## Primary packaging integration (2026-10-01)

package.json desktop:build now runs scripts/build-desktop.mjs. Earlier notes saying primary integration is absent are superseded. On Linux with RPM selected, it runs Tauri build --no-bundle, reads Tauri's reported executable path, generates ELF requirements in a unique temporary directory, merges configured extra RPM dependencies and calls documented Tauri bundle with matching options. Temporary directory is removed after success/failure. Windows/macOS and --no-bundle delegate directly. Non-RPM Linux builds use direct Tauri build.

Validated actual primary debug RPM build: artifacts/linux-rpm-primary/state.json child exit0, final verification49 requirements/MIT/no remaining temp directory. An early pre-completion inspection failed; retained separately as premature-verification.json, final check passed after original bundler terminal. No process restarted. Release generator previously proved46 requirements, primary debug path proves newly built49-capability binary selected. Windows help passthrough and11 inline parser/JSON-merge assertions pass. Builder stopped; no live task.

Prerequisite rpmdeps must be installed for RPM packaging. Supported Linux wrapper arguments: debug/target/features/bundles, repeated JSON file or inline JSON configs, runner (build only), verbosity/CI/signing options, Cargo --locked/--offline/--frozen. Explicit --no-bundle passes raw arguments through. Custom Cargo profiles/output paths and JSON5/TOML configs are rejected in packaging wrapper; raw bun run tauri remains available for manually coordinated flows. Other architectures, release/all-target primary run, clean RPM runtime installation and CI still need acceptance. The beforeBundleCommand hook cannot reload already-parsed Tauri config; inspected https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.0/crates/tauri-cli/src/bundle.rs before implementing.

## Fedora44 runtime acceptance (2026-10-01)

Owned container insomnium-rpm-runtime-20261001 (ID9e8eb55bc05118003476f8e5ece6c2d25518ed373c23e8f293bd286e8d5e3520), --init/1CPU/1GiB/no host mounts/ports. Image fedora@sha256:43b29f65a41eb9c35e1cd5323e3bdf3b655c2357a9f4f1ff2f9c2798e5045d80. **Currently stopped; probe RPM removed; /tmp/insomnium-probe.rpm and generated profile retained.** All3 task-owned containers are stopped.

Native ELF DNF5 5.4.3.0 was used. Clean dnf5 install -y --setopt=install_weak_deps=False /tmp/insomnium-probe.rpm finished actual0 in72seconds; mirror404 recovered automatically. Probe package is unsigned. rpm query/verify, dnf5 check and ldd passed BEFORE display tooling installation. Installed executable hash b3e2847da0001464b482bbd07ac86ba0db2b17fe0e08c3ae7cb15ec418d3c17b. Evidence artifacts/linux-rpm-install/verification.json.

Then added xorg-x11-server-Xvfb, xorg-x11-xauth, dbus-daemon, procps-ng and shadow-utils. Nonroot UID10001 isolated XDG startup uses same20-second smoke command as Debian. Actual application/WebKit processes observed, AT-SPI activates; Mesa reports DRI3 acceleration unavailable under Xvfb. This is process/ABI startup evidence, not GPU/rendering/UI/IPC/workflow acceptance. Post-timeout children gone.

DNF5 local-file same-version reinstall and default remove pass;5 package files transition correctly, RPM/DNF checks clean,5 WebKit profile files remain byte-identical. Actual collection/schema retention and version upgrades remain unverified. Evidence startup-smoke.json, lifecycle-baseline.json, lifecycle.json and final-state.json in artifacts/linux-rpm-install.

References: https://hub.docker.com/_/fedora ; https://dnf5.readthedocs.io/en/latest/commands/install.8.html ; https://dnf5.readthedocs.io/en/latest/commands/reinstall.8.html ; https://dnf5.readthedocs.io/en/latest/commands/remove.8.html . Fedora quick-docs page access denied, upstream DNF5 docs used.

## AppImage build and conditional runtime smoke — 2026-10-01

- Official references consulted: https://v2.tauri.app/distribute/appimage/ and https://docs.appimage.org/user-guide/troubleshooting/fuse.html . Docker uses extraction rather than adding FUSE privileges.
- Retained optimized binary bundled with bun x --bun tauri bundle --bundles appimage --ci; actual exit0 (~54s). Export artifacts/linux-appimage-build/insomnium-linux-probe_0.1.0_amd64.AppImage,101.24MiB, SHA256 df3986dd9476152dcaf2f905b8daf262044ce67391fa2a52cf56ecc438f314b4. Probe identity only; host identity unchanged.
- New owned runtime insomnium-appimage-runtime-20261001 (ID ed449b4f05826905d3f2ecb26c3cd12565df3e52c894da1fe473b7755c34ceea), pinned Debian12 image as Debian runtime, --init/1CPU/1GiB/no mounts/ports. Desktop baseline installation recorded in desktop-baseline.json. Initial14 missing libraries match current upstream pkg2appimage excludelist; that list is not proof of exact linuxdeploy embedded policy.
- GTK/WebKit system packages absent; ldd resolves GTK/WebKit/JavaScriptCore from bundle, no missing linked libraries after baseline. runtime-dependencies.json records evidence.
- First extracted AppRun attempt failed126 because root extraction directory mode700; no product permission change. Used documented /tmp/insomnium.AppImage --appimage-extract-and-run as UID10001 instead.
- Actual startup then failed127: dynamically loaded libGLESv2.so.2 absent, despite clean ldd. Installed libgles2 only in runtime and reran. libGLESv2 was NOT found in inspected upstream excludelist; packaging handling/desktop requirement remains unresolved. Do not claim self-contained or clean minimal-runtime acceptance.
- With libgles2, nonroot isolated XDG/Xvfb20-second smoke reached expected timeout124; app, WebKitNetwork and WebKitWeb alive at6sec. AT-SPI activates; log also says Failed to launch bus: Bus exited with code0 (timing/cause not established). No UI/rendering/workflow/graceful-close claim. Evidence extract-and-run-smoke.json and extract-and-run-gles-smoke.json.
- Post-run ps contains no app/display/dbus children. All FOUR owned containers stopped/exited; snapshots retained. final-state.json. No product or saved test edits this milestone.
- NEXT resolve AppImage dynamic GLES dependency and bus warning through upstream docs/source, repeat clean acceptance, then primary release/all-format build and Bun-only CI. FUSE desktop launch, real upgrade/data/UI/macOS/Windows/legacy formats and original full PARITY remain open.
- Owner follow-up remains recorded in AGENTS.md and POST-MIGRATION-UX.md: reusable components/ui inputs and redesigned UX after FULL migration. Browser-use prohibited; saved Playwright JS scenarios via Bun for UI verification.

## AppImage GLES fix implemented; primary release build live — 2026-10-01

- Previous turn progressed through AppImage build/runtime diagnostics. Revalidated current STATUS/PLAN/PARITY and host configuration.
- Official AppImage custom-files docs: https://v2.tauri.app/distribute/appimage/#custom-files . Exact CLI source https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.0/crates/tauri-bundler/src/bundle/linux/appimage/linuxdeploy.rs confirms files copied before linuxdeploy. Initial source URL without appimage subdirectory returned404; corrected path read successfully.
- Experimental documented files overlay added libGLESv2.so.2. Rebundle actual0 in49.6sec; artifacts/linux-appimage-gles-build/probe.AppImage. Removed system libgles2 from runtime before smoke. Nonroot extract-and-run reaches expected20s timeout124 with app+both WebKit children; no missing GLES and no bus warning this run. Existing desktop platform baseline remains. Process smoke only, no rendered UI/full-runtime claim.
- Added scripts/generate-appimage-config.mjs: discovers GLES via ldconfig -p, matches ELF class/endian/machine to actual built executable, bundles GLES and package copyright notice. Rejects missing library/notice and invalid ELF. Debian/Fedora notice paths plus INSOMNIUM_GLES_LICENSE override. Native cross-architecture acceptance not proven.
- Updated scripts/build-desktop.mjs: two-stage packaging for AppImage as well as RPM; merges generated files with custom config, rejects reserved dependency destination overrides, retains other appimage flags/custom files. Owned temp dirs now insomnium-packaging-*. README updated.4 inline ABI/non-ELF/config/routing checks pass; no new saved test.
- Primary RELEASE AppImage build running in retained builder: bun run desktop:build --bundles appimage --ci -- --locked, CARGO_BUILD_JOBS=1. Supervisor35360/WSL child24236, artifacts/linux-appimage-primary/{state.json,build.log,stderr.log}. Frontend build passed; native optimized executable compiling. Poll SAME process; do not restart on timeout. Actual final result, bundled notice/library, runtime and cleanup pending.
- Earlier short-lived Bun launcher produced no state/process evidence; persistent supervisor started once confirmed no state. Probe bundler20916/3872 already terminal0.
- Owned builder and AppImage runtime running; Debian/Fedora package runtimes stopped. Do not stop builder while primary build live. Continue primary verification; then all-format/CI/original full parity. UX/components deferred until full migration; browser-use prohibited.

## CI runtime constraint investigation — 2026-10-01

No .github directory exists in the active worktree at this checkpoint. Official Bun CI and Tauri pipeline examples were consulted: https://bun.sh/guides/runtime/cicd and https://v2.tauri.app/distribute/pipelines/github/ . Their example actions cannot be adopted unchanged under the owner's strict no-Node rule: https://raw.githubusercontent.com/oven-sh/setup-bun/main/action.yml and https://raw.githubusercontent.com/actions/checkout/main/action.yml both declare runs.using=node24. No workflow was executed or added. CI implementation must use shell/native checkout and versioned Bun installation plus direct Bun/Cargo commands (or audited non-Node actions). Check artifact upload/cache actions too; using Bun for project scripts alone does not prove a Node-free job. Platform matrix and remote execution remain pending.

## Primary AppImage release and bundled GLES accepted — 2026-10-01

- Previous goal turn made progress through GLES implementation/probe. This turn revalidated current docs, polled SAME supervisor35360/child24236 and confirmed actual cargo/rustc then linuxdeploy processes; no timeout restart.
- Primary bun run desktop:build --bundles appimage --ci -- --locked finished actual0, overall285seconds, optimized native compile3m48s. Original release profile unchanged. artifacts/linux-appimage-primary/state.json/logs.
- Exported artifacts/linux-appimage-primary/insomnium.AppImage,101.25MiB, SHA256 cd3821319e09e4c58670029cd40e221d284572b6910edeafb3d2e0729854c72a. Probe identity only.
- Extracted actual output as UID10001. GLES library and copyright present; copyright SHA matches builder package exactly (cf246da9d8979f9be80e5b9c3ce0010c09786f11a55637ff3d09f1a36d269b25). GLES ldd resolves through normal host graphics dispatch; no missing dependencies. Primary wrapper leaves no insomnium-packaging-* tempdirs. verification.json and final-state.json.
- Runtime confirms no installed libgles2, libgtk-3-0 or libwebkit2gtk-4.1-0. Documented extract-and-run smoke reaches20-second timeout124 with app/WebKitNetwork/WebKitWeb alive at6seconds; AT-SPI works, no missing-library/bus warning in this run. Existing desktop baseline graphics/fonts/audio remains required.
- This proves packaging/process startup on this Debian12 Xvfb environment, NOT rendered UI/workflows/GPU/Wayland/FUSE launch/graceful close/other distro or architecture acceptance. Previous transient bus warning did not recur, cause remains undetermined.
- No remaining app/display/dbus children after probe; all FOUR owned containers stopped/exited, state/cache retained. No live builder or installer.
- CI investigation: active .github directory absent. Official setup-bun and checkout actions currently use node24 internally; cannot adopt those examples under strict no-Node rule. References and decision recorded in LINUX-DISTRIBUTION.md. No workflow/action executed.
- NEXT primary release all-format integration (RPM+AppImage generators together), Bun-only CI with audited shell/native bootstrap/checkout/artifact handling, then original full parity. Legacy Linux tar.gz/snap, Windows/macOS release/upgrade/data/UI and outstanding Git/plugins/auth/runner/etc remain open. UX/shared components deferred until full goal complete.

## Combined Linux release packaging and Bun-only CI workflow — 2026-10-01

- Previous turn progressed by accepting primary AppImage. Revalidated STATUS/PLAN/PARITY/current wrapper and official https://v2.tauri.app/reference/cli/#build before starting default targets=all.
- Primary bun run desktop:build --ci -- --locked, CARGO_BUILD_JOBS=1, completed actual0 in286seconds. Native optimized compile3m43s. SAME supervisor22712/child36964 observed throughout; no restart. artifacts/linux-all-formats-primary/state.json/logs.
- Built Debian8.24MiB, RPM8.25MiB and AppImage101.25MiB in one invocation. RPM generator emitted46 requirements; actual package includes every requirement and MIT. Debian metadata retains12 explicit ELF-derived constraints plus Tauri defaults. AppImage staging contains GLES and notice; owned packaging tempdirs absent. verification.json. Full extracted AppImage/runtime acceptance was previous milestone; these newly exported bytes were not separately installed/launched.
- Exported all3 probe artifacts and SHA256 in artifacts/linux-all-formats-primary/manifest.json. .deb3e52c9f4ad043956787e8124ad3504b424b7a9213b3d962178f7d06ea769fb2c; .rpm1b6520babf664db7c816df845943635afda756b2f4e88fa43a4bbf5375fc3a23; .AppImage67444b2a2dfcdd77d6f5ed3bf4c0656be4155e977fabbd507c9dfbcd602b1192. Host identity unchanged.
- Added .github/workflows/desktop-build.yml with3 jobs: Ubuntu22.04 x64, Windows2022 x64, macOS15 universal. All run steps, no Node-based actions. Documented pinned Bun installer/native Git exact-event checkout, scoped transient fetch auth, Rust1.98.1, native prerequisites, frozen install/Svelte check/primary release build, SHA256 job summary. No commit/push/remote run/release created.
- YAML and2 inline JS programs parse. Native actionlint1.7.12 downloaded from upstream and checksum verified; optional shellcheck/pyflakes disabled. Initial job.env runner.temp scope failed, moved to installer step env; final actionlint0. Evidence artifacts/ci-inspection. Docs and limitations in CI.md.
- CI still PARTIAL: actual runner execution/checkout/platform packages unverified; downloadable artifact retention, signing/notarization, Linux ARM64 and legacy formats pending. Summary hashes alone are NOT downloadable packages. Debian metadata derived on Debian12 requires fresh actual-ELF verification on Ubuntu runner. CI does not reduce original scope.
- Builder stopped after exports; other3 owned runtime containers already stopped. No live compiler/bundler/app process.
- NEXT CI runtime/bootstrap/artifact retention and platform acceptance, then outstanding original feature parity. Full goal remains incomplete; no redesign/shared components before migration completion.

## Automatic Debian dependency metadata implemented; integration running — 2026-10-01

- Previous goal turn progressed with combined formats/CI. Revalidated current files and official https://manpages.debian.org/bookworm/dpkg-dev/dpkg-shlibdeps.1.en.html .
- Ran documented dpkg-shlibdeps -O -e<release-executable> first in isolated control directory; returned12 groups, matching old static list. No ignore-missing-info option. Tool emits a package-directory warning, but returns0 and requirements; preserved evidence artifacts/linux-deb-generator/documented-command.json.
- Added scripts/generate-deb-config.mjs (Bun build utility): validates ELF, isolated temporary Debian metadata and executable copy, dpkg-shlibdeps from installed symbols/shlibs, parses one nonempty Depends line preserving alternatives, fails on tool/missing requirements, cleans own tempdir in finally. Actual helper returns12 groups; invalid ELF refuses without output. Relative staged path still gives harmless package-directory warning; no suppression or claim of resolved cause.
- Updated primary wrapper to generate Debian metadata for deb/all, retain user extra constraints, merge RPM overlay without discarding Debian and include AppImage overlay. Removed ONLY the exact known12 generated constraints from root config after equality guard. Raw Tauri bundle needs the generated overlay; use primary desktop:build for complete package metadata.
- Added explicit dpkg-dev CI prerequisite; README/CI docs updated. Cross-distro/cross-arch acceptance remains pending.
- All-format primary integration LIVE: supervisor28308/WSL child31516, artifacts/linux-deb-dynamic-primary/{state.json,build.log,stderr.log}; same retained container and optimized profile, command bun run desktop:build --ci -- --locked, CARGO_BUILD_JOBS=1. Do not restart on observation timeout. Poll actual process; final metadata/build acceptance pending.
- Original full parity and CI remote/artifact/runtime acceptance remain incomplete; no redesigned UX/shared input implementation yet.

## Dynamic Debian metadata verified in combined release build — 2026-10-01

- Continued SAME supervisor28308/child31516 to terminal actual0; optimized native compile3m39s, overall284seconds. Default primary command produced Debian/RPM/AppImage. artifacts/linux-deb-dynamic-primary/state.json/logs. No restart on waits.
- Actual Debian Depends contains all12 groups independently regenerated from final ELF; no missing entries. RPM requirements also retained, proving merging Debian metadata did not discard RPM metadata. Both insomnium-shlibdeps-* and insomnium-packaging-* tempdirs absent. verification.json.
- Fixed staging warning after inspecting installed /usr/share/perl5/Dpkg/Path.pm: get_pkg_root_dir requires a DEBIAN directory. Added marker directory to helper. Running build snapshot intentionally unchanged until terminal; final helper tested separately and after copying into snapshot returned IDENTICAL12 groups with no warning. artifacts/linux-deb-generator/final-staging-verification.json and final verification record exact scope.
- Exported newest .deb artifacts/linux-deb-dynamic-primary/insomnium.deb,8644384bytes,SHA25658e196d470d3567390dfa3dfb1679258432079a629d0966527993695ffb7ed2c. Latest RPM/AppImage retained in builder /target/release/bundle; not additionally exported/installed this milestone. Build metadata acceptance does not replace previous runtime gates or establish new platform acceptance.
- scripts/generate-deb-config.mjs now computes real package minimums; primary wrapper handles Debian-only and combined formats; root config no longer embeds the previous12 build-host constraints. Explicit user-added Debian dependencies are unioned with computed groups. Raw Tauri bundle users must pass a fresh generated config.
- CI explicitly installs dpkg-dev; README/CI.md updated. Native actionlint and targeted git diff --check pass. No new saved tests, Node/Python/browser-use or remote changes.
- Builder stopped; runtime containers remain stopped. Full migration still incomplete. NEXT CI bootstrap/remote validation/artifact retention, Ubuntu actual-ELF/native-platform acceptance, original feature parity. Shared input components/UX stays deferred.

Manual Debian metadata flow (after native build):

```sh
bun scripts/generate-deb-config.mjs /path/to/built/insomnium /tmp/insomnium-deb.json
bun x --bun tauri bundle --bundles deb --config /tmp/insomnium-deb.json --ci
```

Match target/debug/config to the executable used to generate metadata. The primary desktop:build wrapper binds the reported executable and removes its owned temporary files automatically. Run Debian packaging on a Debian/Ubuntu build environment with dpkg-dev and symbols/shlibs metadata for all linked libraries; absence fails instead of silently dropping requirements.
