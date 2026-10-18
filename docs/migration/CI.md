# CI migration

Updated 2026-10-18. Optional manual draft-release package retention is implemented with Bun/native gh; default builds remain read-only. Hosted execution/upload/download, platform CI/installer/signing/distribution and complete release/legal acceptance remain open.

See [current status](STATUS.md), [execution plan](PLAN.md) and [complete parity requirements](PARITY.md). No original scope was removed by consolidation.

## Manual package retention without a JavaScript action — 2026-10-18

Source parentfaaef5d7. Desktop build now delegates its unchanged three-platform matrix, pinned toolchains, native Git checkout, frozen install and build/hash steps to desktop-build-core.yml. The entry workflow keeps push and default manual runs read-only/build-only. Explicit workflow_dispatch with retain_packages=true selects a separate contents:write caller; the callee inherits that permission rather than attempting elevation. The upload token exists only in the retention step environment (checkout retains its separate process-local fetch credential). No Node-based setup/checkout/upload action, SDK runtime-token workaround, dependency or app runtime change.

Operator flow: open Actions → Desktop build (Bun and Cargo) → Run workflow, select the reviewed ref and enable retain_packages. Each successful platform job creates an unpublished prerelease draft tagged ci-RUN_ID-ATTEMPT-TARGET-SHORT_SHA and uploads that target's packages plus desktop-packages.json. Repository policy must permit the manual caller's GITHUB_TOKEN contents:write. Draft assets are available through the repository Releases page to authorized collaborators; these are release assets, not expiring Actions artifacts. The script does not publish, overwrite, delete or schedule cleanup. Failed/partial drafts remain for inspection; reruns use a new run-attempt tag. Signing/installer/runtime approval is separate.

scripts/retain-desktop-packages.mjs validates GitHub.com/manual coordinates, the bounded ordinary-file manifest, bundle confinement, unique stable asset names, regular local package files, size and streaming SHA256. It uploads through native gh, verifies draft/source identity before every asset and checks returned uploaded state/size/SHA256 digests and the final draft identity. The release body/job summary preserve source/run/target/hash provenance; desktop-retention.json records remote asset IDs/digests. --plan validates local bytes and prints the plan without a token or network. No live release/upload was attempted here.

Verification: native actionlint1.7.12 accepts entry/core/PR workflows with shellcheck/pyflakes disabled. Parsed YAML proves default read-only/manual-only write, unchanged platform strategy and exact equality of every original build/checkout step to HEAD's prior workflow; no step uses a JavaScript action and GH_TOKEN appears only on retention. Actual production --plan executes under Bun against owned synthetic bytes, returns a draft/two-asset plan without a token/network, and refuses content changed after manifest generation. Evidence: artifacts/ci-retention-20261018/verification.json. Prettier/diffcheck pass. No testcase/script/scenario was added for verification; the new script is the production retention implementation.

Primary contracts: https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows ; https://docs.github.com/en/rest/releases/releases ; https://docs.github.com/en/rest/releases/assets ; https://cli.github.com/manual/gh_release_upload . Runner images document native gh availability at https://github.com/actions/runner-images/tree/main/images . Remaining: actual GitHub permission/draft/upload/digest/download/rerun/cancellation behavior, full hosted Linux/Windows/macOS builds and every packaging/legal/platform/PLAN/PARITY gate. No push/workflow dispatch/release creation/publication, profile change or owned live process. /compact unavailable; explicit handoff.

## Topic records

<a id="record-ci"></a>

<details>
<summary>CI</summary>

# Desktop CI migration

## Current implementation

.github/workflows/desktop-build.yml defaults to build-only for main/master pushes and manual dispatch, with optional explicit manual draft retention described above. The actual matrix build now lives in desktop-build-core.yml. It has Linux x64 (Ubuntu22.04), Windows x64 (Windows2022) and macOS universal (macOS15) jobs. Bun1.4.2 and Rust1.98.1 are pinned to the development baseline. Pull requests use pr-check.yml, which now runs a pinned-Bun frontend check/build job alongside Qlty on Ubuntu24.04. No pull_request_target event is used.

All steps use native shell commands or Bun/Cargo. No JavaScript actions are invoked: official setup-bun and checkout currently start Node24 internally. Bun is installed with the documented versioned installers; Git checkout fetches the exact event SHA. The checkout token is step-scoped and passed only to the fetch subprocess via Git environment configuration; it is not written to repository config or passed to build steps. No pull_request_target execution is configured.

Linux installs Tauri native prerequisites plus dpkg-dev, rpm and libgles2. macOS installs both Rust target architectures. Both frontend and desktop builds use bun install --frozen-lockfile --ignore-scripts, then explicit bun run prepare (OpenAPI validator generation and SvelteKit sync) before Svelte check/build. This keeps project preparation explicit and avoids install lifecycle commands launching another JavaScript runtime. The desktop wrapper retains --locked. Package SHA256/size inventory is written to the job summary and desktop-packages.json on the ephemeral runner. PR checkout tokens are step-scoped and fetch authentication uses Git environment configuration instead of command-line headers or persisted Git config.

2026-10-08 capabilityd1adba5: native actionlint1.7.12 accepts both workflows (shellcheck/pyflakes disabled). Parsed YAML inspected for read-only contents permission, no uses actions and no job-scoped checkout tokens. Command chain passes in the main Windows workspace and an isolated detached c64a585 worktree with fresh node_modules:243 packages installed, explicit prepare/check0 errors0 warnings/production frontend build terminal0. Global package cache may be reused; this is clean-install local evidence, not a GitHub/Linux runner bootstrap result. Exact sessions9682/7970 terminal0; result in artifacts/ci-inspection/frontend-pr-check-result.json. Temporary worktree was verified inside owned artifacts, not a reparse point, and removed after checking its tracked tree remained clean. No app/native production source changed or native rebuild needed.

## Verification and remaining gates

Artifact retention investigation (2026-10-08): the official @actions/artifact SDK
requires ACTIONS_RUNTIME_TOKEN and ACTIONS_RESULTS_URL. The runner's
[NodeScriptActionHandler](https://github.com/actions/runner/blob/main/src/Runner.Worker/Handlers/NodeScriptActionHandler.cs)
injects these, while
[ScriptHandler](https://github.com/actions/runner/blob/main/src/Runner.Worker/Handlers/ScriptHandler.cs)
does not inject them into ordinary shell steps. Running the SDK through Bun in a
plain run step therefore cannot by itself provide artifact upload. No credential
workaround, broken upload step or external publication was added. The experimental
SDK dependency/lock changes were restored. Downloadable artifacts remain required;
choose a runner-supported Bun/native transport before implementing retention.

### Bun-only Qlty runtime boundary — 2026-10-08

Capability5e0f11f replaces enabled default Prettier/Node and zizmor/Python package
plugins with prettier-bun and zizmor-native. Formatter file types, config discovery,
config batching, staged rewrite output and native security SARIF behavior are retained.
The formatter uses the frozen project dependency (Prettier3.9.9), including its Svelte
plugin, through Bun. Its helper resolves staged targets before running the CLI from
the project root; Qlty still owns the temporary copies and reports their changes.
Wrapper changes and bun.lock invalidate formatter caches. zizmor1.16.3 uses official
native downloads for Linux/macOS x64/ARM64 and Windows x64. actionlint disables its
optional Python pyflakes hook; native shellcheck discovery remains enabled.

Run `bun run quality check --upstream <base> --no-upgrade-check` and
`bun run quality smells --upstream <base> --no-snippets --no-upgrade-check` locally.
The Bun wrapper supplies explicit executable/helper paths because Qlty sanitizes
plugin PATH and uses a temporary formatter tree. Plain `qlty check` cannot supply
those required paths. The PR Qlty job now installs pinned Bun and frozen dependencies
with --ignore-scripts, then uses this wrapper. It needs no application prepare step.
No enabled plugin definition requires a Node/Python runtime; the default source still
contains unused definitions for other tools. Existing OSV Cargo.lock exclusion remains.

Local Windows evidence: artifacts/ci-inspection/qlty-runtime-result.json and merged
configuration qlty-merged-after.yml. Native Qlty0.642.0 config validation, actual
formatter/native zizmor/actionlint and full targeted Qlty checks pass; changed-file
smells, frozen installation and Svelte check0 errors0 warnings pass. Download receipt
records toolType Download and successful official Windows zizmor ZIP extraction,
independent of the historical Python installation. Controlled temporary malformed
package formatting and workflow write-all permission each fail with the expected
SARIF issue; --no-fix leaves those bytes unchanged and originals are restored in finally.
Evidence: qlty-runtime-negative-result.json and the two negative SARIF records.
Initial --all+paths rejection and staging PATH failure were corrected before acceptance.
This verifies local plugin execution, not actual GitHub runner/bootstrap or all files.

- YAML parses and both inline JavaScript programs parse under Bun.
- Native actionlint1.7.12 validates the final workflow with exit0. Its zip SHA256 was checked against upstream release checksums. Optional shellcheck/pyflakes integrations were disabled explicitly, so no Python was invoked.
- Initial actionlint rejection: runner.temp was used at job.env scope, where that context is unavailable. Moved it into installer step environments; rerun passed.
- No GitHub run or push has been triggered. Workflow changes are committed locally. Runner bootstrap, private/fork checkout, Qlty plugin execution on Linux runners, Windows/macOS matrix builds, and platform compatibility remain unverified.
- This is build validation only. Downloadable artifacts, signing/notarization, updater/release publication, Linux ARM64 and runtime/install/upgrade acceptance remain pending. Package files currently disappear with the runner; only summary/log hashes persist. Do not call full CI/distribution complete.
- Default Tauri bundle formats do not include every legacy distribution (Linux tar.gz/snap, macOS zip, Windows portable/Squirrel); retain those in PARITY until implemented or explicitly removed.
- Linux package dependencies must be checked against each runner's actual ELF. The primary wrapper now computes Debian requirements with dpkg-shlibdeps from the built ELF instead of reusing Debian12 minimums. Ubuntu22.04 CI installation/runtime acceptance still requires an actual run.

## Sources consulted before implementation

- https://bun.sh/docs/installation — versioned shell/PowerShell installers.
- https://bun.sh/docs/pm/cli/install — frozen lockfile installation.
- https://v2.tauri.app/distribute/pipelines/github/ — platform build workflow.
- https://v2.tauri.app/start/prerequisites/ — native dependencies.
- https://docs.github.com/en/actions/reference/runners/github-hosted-runners — explicit runner labels.
- https://git-scm.com/docs/git-config — process-scoped GIT_CONFIG_COUNT/KEY/VALUE settings.
- https://rust-lang.github.io/rustup/concepts/toolchains.html — pinned toolchain selection.
- https://raw.githubusercontent.com/oven-sh/setup-bun/main/action.yml and https://raw.githubusercontent.com/actions/checkout/main/action.yml — Node runtime evidence.
- https://github.com/rhysd/actionlint/blob/main/docs/install.md — native release binary installation.
- https://github.com/qltysh/qlty/blob/main/qlty-plugins/plugins/plugin_guide.md — custom plugin definitions, staged formatter drivers and platform downloads.
- https://github.com/qltysh/qlty/blob/main/qlty-check/src/tool/tool_builder.rs and https://github.com/qltysh/qlty/blob/main/qlty-check/src/tool/null_tool.rs — runtime-free tool selection validated against the installed CLI.
- https://github.com/qltysh/qlty/blob/main/qlty-check/src/executor/invocation_script.rs — staged target/config interpolation.
- https://docs.zizmor.sh/installation/ and https://github.com/zizmorcore/zizmor/releases/tag/v1.16.3 — native release assets.
- https://bun.sh/docs/runtime/child-process — explicit array commands, cwd/env, inherited streams and exit propagation.

Local validation evidence: artifacts/ci-inspection/.


</details>

<a id="record-linux-distribution"></a>

<details>
<summary>LINUX-DISTRIBUTION</summary>

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
- CI investigation: active .github directory absent. Official setup-bun and checkout actions currently use node24 internally; cannot adopt those examples under strict no-Node rule. References and decision recorded in CI.md#record-linux-distribution. No workflow/action executed.
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


</details>

## Local current Windows NSIS checkpoint — 2026-10-19

Source d67fe4fc: normal production bun run desktop:build --bundles nsis -- --locked passes with app.insomnium.desktop and default build/bundle hooks. BUILD.json records current executable and43004399byte NSIS package, source fingerprint and SHA256; artifacts/windows-production-d67fe4fc-20261019 holds receipts and retained files. Both files are unsigned; no installer/app launch or hosted workflow occurred. This advances local packaging only; MSI, signing, installation/runtime, hosted three-platform/retention/download/distribution and all original PLAN/PARITY/legal gates remain open. See STATUS.md for exact scope and handoff.

### 2026-10-19 — Current-source Windows MSI checkpoint

- Source 46d77019ac5d6c69704058fd535d9a6180e6b949; normal production command: bun run desktop:build --bundles msi -- --locked. Terminal exit 0 (9m33; Rust release 7m45), production identity app.insomnium.desktop. No app or installer execution; no new or repeated UI scenarios.
- MSI 57,023,519 bytes, SHA-256 87a74ff5d3b976da9b08d86bbc1b5e7f84069d208d2af6ac6dffb9f5c870fa19. Both MSI and standalone executable are unsigned. 870 selected tracked source hashes unchanged; this is a partial witness, not universal source/license/linkage closure.
- WiX 3.14.1 dark extraction: all 2,170 payload files verified against build inputs. 2,169 are byte-exact; the app is byte-exact after the unique documented Tauri UNK-to-MSI marker substitution (3 bytes). Initial exact-hash failure retained, not suppressed. Official pinned source: https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.0/crates/tauri-bundler/src/bundle.rs . DARK1059 UI decompilation warnings retained; installer UI not validated.
- Evidence: artifacts/windows-production-msi-46d77019-20261019-attempt2/verification.json, payload-bindings.json, build/error/dark logs, original/decompiled WXS, pinned upstream source and prior BUILD record. Preparation failure before build retained in sibling attempt directory. BUILD.json now describes this MSI; older NSIS remains historical, not rebuilt for this source. Official build guidance: https://v2.tauri.app/distribute/windows-installer/ .
- Remaining gates: install/upgrade/uninstall and installed runtime, signing/SmartScreen, hosted CI, other platforms, complete legal/source/linkage coverage, all unresolved PLAN/PARITY acceptance. Full migration remains incomplete. Owned build/extraction handles terminal; pre-existing dev Cargo PIDs 97076/110976 untouched.
- Topic commit recorded in following handoff. /compact is unavailable in this interface; no compaction claimed.

## Portable frontend notice project binding — 2026-10-19

Source parent 0fff88a1. Actual Linux production DEB build exposed a hard-coded E:/.dvgamerr-app/insomnium-app requirement in scripts/frontend-notice-fs.mjs. The helper now derives its project root from its own module file, then requires the caller root to match that project. Main helper ownership, absolute paths, every ancestor ordinary-directory/realpath checks, symlink refusal, confined leaves, immutable private admission, source snapshots and transactional publication/rollback remain. This permits ordinary Linux/macOS/CI/alternate checkout roots without accepting another project's root. No bypass flag or relaxed canonical check.

Reused stopped insomnium-unix-acceptance-20261001 after discovering its read-only /work mount referenced missing /mnt/e/insomnium. Created E:/insomnium junction to the verified current workspace solely to restore that existing read-only mount; container command is sleep infinity. Unrelated containers untouched. Exact HEAD archive extracted into new /workspace-current-0fff88a1; old /workspace retained. Bun1.4.2 frozen ignore-scripts install and explicit prepare passed. Initial production build failure is retained. Copied only the fixed helper into the frozen checkout; host/container SHA256 both c13ac994773ef8035e811f5e2b060c67e42522176664c020c34aff240b4d1118. Same normal production hook now generates and validates frontend notices and Vite build passes on Linux. /proc/218/exe proves the CLI whose argv says node is actually /root/.bun/bin/bun. No Node/npm/Python/test scripts or app/profile/installer execution.

Evidence artifacts/linux-production-0fff88a1-20261019: source.tar, install/prepare states/logs, original failed build state/logs, frontend-preparation.json, portable-root-verification.json and build-attempt2-state.json/logs. Normal command bun run desktop:build --bundles deb --ci -- --locked uses existing single-job /target cache and default production identity/profile/hooks, not old probe identity. The wrapper's documented build-no-bundle then bundle path remains. **Release build is still running, not passed**: outer session5397/Windows PID105972, container Cargo318 and current rustc observed live; never restart solely due observation timeout. Existing dev Cargo handles untouched.

Remaining: terminal Linux build/package/payload and installed runtime, macOS runtime/check, hosted CI/signing/universal legal/source/linkage and all retained PLAN/PARITY acceptance. No full migration completion. No new/modified/rerun tests. Root portability fix has real normal-hook/frontend acceptance; full package claim awaits terminal result. /compact unavailable; explicit live-process handoff follows.

## Linux libclang prerequisite and binding — 2026-10-19

Actual normal DEB build attempt2 ended1 at libuv-sys2/bindgen: no valid libclang. Inspection confirms libclang-dev14 already installed in the retained Debian12 container; .cargo/config.toml's Windows extracted LLVM fallback was the incompatible path. No package installation or host/toolchain mutation was needed locally. Attempt3 explicitly supplies verified LIBCLANG_PATH=/usr/lib/llvm-14/lib, preserving the documented environment-over-config precedence and normal production hooks/profile/identity. It passes libuv-sys2 and is compiling the app/remaining dependencies.

.github/workflows/desktop-build-core.yml now installs documented libclang-dev in the Linux prerequisite step, discovers /usr/lib/**/libclang.so and exports its containing directory through GITHUB_ENV. Empty discovery fails before build. No LLVM version is assumed. Windows/macOS/matrix/permissions/retention steps remain unchanged. Existing YAML parser passes and matrix remains3platforms; scoped diff check passes. Official prerequisite contract read: https://rust-lang.github.io/rust-bindgen/requirements.html . No new/modified/rerun tests, hosted workflow, app/installer/profile/provider operations.

Evidence artifacts/linux-production-0fff88a1-20261019/libclang-followup.json and immutable attempt2 failure/attempt3 logs/states. Session5397/Windows PID105972/container Cargo318 are terminal1. **Attempt3 is live, not passed**: outer session88950/Windows PID113820/container Cargo2381; observe this exact handle, never restart due observation timeout. Normal frontend/notices hooks passed again. Full DEB/payload/install/runtime, other platforms/hosted CI and every retained PLAN/PARITY/legal/release gate remain open. /compact unavailable; explicit live-process handoff follows.

## Current production Linux DEB checkpoint — 2026-10-19

Normal release attempt3 exits0 at2026-10-18T20:48:53.947Z (7m52 overall; Rust release7m26), using frozen0fff88a1 archive plus the sole portable frontend-notice helper delta (product equivalent59a4d83e). Default app.insomnium.desktop identity/profile/hooks preserved; single-job /target cache and Linux LIBCLANG_PATH=/usr/lib/llvm-14/lib. Both normal notices/build and beforeBundle validation pass. Existing eventsource-stream5/application1warnings retained. Earlier hard-coded-root and libclang failures remain immutable.

DEB Insomnium_0.1.0_amd64.deb:54,193,790bytes; SHA2565fea08c9560efca9e966a2c58a700e3d3310c563c1490a43670f1a07217fc914. Standalone ELF25,966,656bytes; SHA2565e8276c52edd593d96d9ee7524cb979647fab696a9cb7fa74be80f6aedaccc0d. dpkg metadata confirms insomnium0.1.0/amd64 and generated native dependency constraints; readelf confirms ELF64 little-endian x86-64. Used dpkg-deb --extract only; no app/installer execution.

All1,677 extracted regular files accounted for:1,675 byte-exact source files (notices1,671/sidecar1/icons3), executable exact after the unique documented Tauri UNK-to-DEB3byte marker replacement, and generated desktop entry checked for Name/Exec/Icon/Type. Initial verifier icon-path indexing error retained and corrected in inline verification only; package unchanged. This is payload/build evidence, not universal legal/source/target-linkage closure. No new/modified/rerun tests or scenarios. References read: https://v2.tauri.app/distribute/debian/ and https://manpages.debian.org/bookworm/dpkg/dpkg-deb.1.en.html .

Evidence artifacts/linux-production-0fff88a1-20261019/{verification.json,payload-bindings.json,deb-control.txt,build-attempt3-state.json,build-attempt3.log,build-attempt3-error.log}; earlier states/logs, source archive/helper hashes, prep receipts and memory adjustment retained. BUILD.json retains its Windows MSI checkpoint and adds this Linux platform record.

Cleanup: release session88950/Windows PID113820/container Cargo2381 terminal0; container stopped and memory restored2GiB/swap-1. Existing unrelated dev processes untouched. Temporary E:/insomnium junction still points to current workspace: automatic approval review rejected its verified Remove-Item cleanup as blocked by policy; no workaround attempted. Container retains its original read-only mount and frozen build directory/cache. No owned live handles or profile changes.

Remaining: actual install/upgrade/uninstall/current Linux runtime, signing/hosted CI/other platforms, all retained legal/source/linkage and PLAN/PARITY acceptance. Full migration remains incomplete. /compact unavailable; topic commit handoff follows.

## Current Linux RPM/AppImage and RPM metadata failure — 2026-10-19

Reused the completed production ELF/frozen checkout from the DEB checkpoint (product equivalent59a4d83e) without recompiling frontend/native source. Existing production generate-rpm-config.mjs emits57 ELF requirements for app+sidecar; generate-appimage-config.mjs supplies same-ABI GLES library/notice. Merged only RPM/AppImage overlays with the wrapper's existing extra-requirement/reserved-destination rules; normal beforeBundle validation passes. bun x --bun tauri bundle --bundles rpm,appimage --ci --config artifacts/production-formats-20261019/overlay.json terminal0; container CLI /proc/410/exe verified /root/.bun/bin/bun despite node argv.

AppImage147,819,000bytes SHA256cb966a3a651ae4badd8bdc6c0e07e4c9c3854103b5b158935aae4d4d69d04fb0. Official --appimage-extract runtime mode unpacks only (no product launch). All1,677 product files compare to source/reconstructed originals. Complete app and Bun sidecar bytes match after the exact same linuxdeploy patchelf --set-rpath $ORIGIN/../lib operation, with unique UNK-to-APP marker on the app. GLES bytes match exact same tool --set-rpath $ORIGIN; notice remains byte-exact. Tool SHA2562967f749b3c3e584cc413e6859c31a0c0a2e533db5dc1f8f32f94da3822e348a retained. Initial direct GLES mismatch retained; no ignored byte ranges or tolerance. Full linuxdeploy-added dependency/source/license/linkage closure remains unproven.

RPM54,261,810bytes SHA2569f127fb4182fd343531566e8c9ef1112337a485b203be1b28db0165e03510eb8. Name insomnium/version0.1.0/x86_64/MIT and all57 generated requirements confirmed; rpm -Kv header/payload SHA256 checks0. All1,677 regular payload files verify (app after unique UNK-to-RPM marker; other source files exact; desktop fields checked). **RPM compatibility FAILED, not accepted**: RPM4.18 rpm2cpio returns1 after emitting124,051,636bytes; LONGARCHIVESIZE and ARCHIVESIZE queries both report none. Pinned rpm4.18 rpm2cpio.c compares ufdCopy byte count against headerGetNumber(LONGARCHIVESIZE), explaining this failure. GNU cpio listing/extraction separately return0; that does not waive rpm2cpio failure. Need correct RPM archive-size metadata at packaging boundary before claiming current RPM ready. Retain original package/failure.

Evidence artifacts/linux-production-formats-20261019/verification.json, bundle state/logs, overlay.json, rpm-payload-bindings.json, payload-verification.json, appimage-elf-transform.json, appimage-gles-transform.json and initial refusal. cpio was initially missing; installed only cpio2.13+dfsg-7.1 in owned build container, then CPIO read/extract0. Source https://github.com/rpm-software-management/rpm/blob/rpm-4.18.0-release/rpm2cpio.c archived locally; official extraction/packaging refs https://docs.appimage.org/user-guide/run-appimages.html and https://v2.tauri.app/distribute/rpm/ . No new/modified/rerun tests, product app/installer/profile/provider operation or signing.

Owned bundle session53750/Windows PID115372 terminal0; extraction/installer-tool handles terminal; container exited/memory2GiB unchanged. Existing junction retained as previously documented; no new removal attempt. BUILD.json adds these bounded platform records without replacing Windows/DEB evidence. Remaining RPM metadata fix, current install/runtime, signing/hosted/other platforms and every retained PLAN/PARITY/legal gate remain open; full migration incomplete. /compact unavailable; topic handoff follows.
