# CI migration

## Current Linux native compiler — 2026-10-19

Source ce07d3ff passes cargo check --manifest-path src-tauri/Cargo.toml --all-targets --release --locked --offline on the existing Debian12 Linux toolchain/cache, exit0/178714ms. This includes current native lifecycle, schema timeout, outlier and Git supervisor changes. All15changed Rust/Cargo inputs independently match committed blobs after the exact Git archive Windows LF→CRLF export transform. The source archive hash also matches its container copy. No source patch, package build or testcase execution was needed.

Windows Docker context pointed at a closed TCP proxy; the existing running dockerman-backend WSL Docker unix engine was used directly without changing context or restarting services. Initial check failed because the repository Windows libclang default overrode Linux discovery; the retained failure was corrected using the already installed /usr/lib/llvm-14/lib, matching the prior build environment. No dependency installed. Prior ca6a7fe5 build/binaries/notices were reused as compiler assets only; this is not current frontend/package/notices/linkage acceptance. Diagnostics retain existing vendor and Linux unused-field warnings.

Evidence artifacts/linux-native-current-ce07d3ff-verification.json plus source-bindings/preparation/check/log artifacts. Original compiler session80729 terminal1, corrected session1664/WSL131676 terminal0. Actual process inventory showed no compiler descendants before stopping owned cache container d2602e...; final Docker state exited143/runningfalse/PID0 (sleep-infinity host stopped normally). No host mounts, browser/native app/profile/installer/provider operation or saved testcase/scenario changes. Current Linux runtime/installer/full distribution, macOS/hosted CI/signing/legal and every retained PLAN/PARITY gate remain open.


## Current RPM/AppImage artifact inspection — 2026-10-19

Frozen sourceca6a7fe5 normal desktop:build rpm,appimage command produced current packages, but **clean producer success is unproven**: Windows wrapper disappeared (observer1), Docker exec returned126 while the original Bun/Cargo descendants continued through compilation/bundling. Original process chain was observed until all descendants exited; no duplicate producer launched. Retain incomplete logs and observer receipts, not an exit0 claim. The app was recompiled despite cache; standalone SHA2561e5ea9b97ee95a0f32ae19f8717ddcc89f9f6c34b9beac5653112f8b68264b98 is distinct from DEB producer ELF.

RPM54,634,537bytes SHA2569f5a8d2308560ddfada1964e3a675b70fca1c9c91b074bf88714be9575ad75f4: native header/payload digests0, rpm2cpio+CPIO extraction0, both archive-size tags124841992. All1,678 regular payload files match current inputs with exact unique UNK→RPM marker transform and generated desktop fields. Existing production normalization returns changed:false and the same package SHA, confirming correct idempotent metadata.

AppImage148,158,968bytes SHA25687be1b3dab556c5c1fa94822f5eefb61a449e4af40f418dbe4a5ca7926c313d7: runtime-only extraction0, all1,678 product files match current inputs. App/sidecar exact after the same linuxdeploy patchelf RPATH operation, app also unique UNK→APP marker; pinned tool SHA2562967f749b3c3e584cc413e6859c31a0c0a2e533db5dc1f8f32f94da3822e348a. Additional linuxdeploy dependencies/resources and full source/license/linkage remain unverified.

Evidence artifacts/linux-current-rpm-appimage-20261019/verification.json, per-format bindings/state/logs, Docker observation, retained artifacts and normalization receipt. BUILD.json appends artifact inspection without replacing verified DEB/older records. Owned no-host-mount build container stopped; no live descendants. No app/installer/profile/provider execution or testcase changes/runs. Producer exit/log closure, current install/runtime/version upgrade/signing/hosted CI/macOS and every retained PLAN/PARITY/legal gate remain. /compact unavailable; STATUS contains explicit handoff.

## Current Linux production DEB — 2026-10-19

Lifecycle follow-up: retained sourceca6a7fe5 package installed, same-version reinstalled and removed through ordinary apt-get in the maintained isolated Debian12 runtime, all exit0. All1,678 regular payload files match package hashes after install/reinstall and are absent after remove; dpkg reports package absent1, audit/verify and apt-get check0. App/sidecar ldd show no missing libraries. All77 existing /home regular files retain exact SHA256 at each phase. No app/native UI execution, host mounts or testcase changes/runs. Container insomnium-deb-runtime-20261001 is stopped; no owned live handles. This is not a pristine dependency baseline, version-upgrade test or real collection/schema-retention proof. Evidence artifacts/linux-deb-current-lifecycle-20261019/verification.json plus phase states/logs and hashes; BUILD.json attaches bounded lifecycle evidence. Official [apt-get install/reinstall/remove contract](https://manpages.debian.org/bookworm/apt/apt-get.8.en.html) consulted before operations. All broader runtime/platform/signing/legal/PARITY gates remain.

Source ca6a7fe5 built with normal `bun run desktop:build --bundles deb --ci -- --locked`, default app.insomnium.desktop identity and all production hooks. Frozen ignore-scripts install and explicit prepare passed. Producer exit0 in468459ms; Rust release6m29s. DEB54,571,552bytes SHA2562ba88054aef2a4515e0eb74ab97ffef0e5426af75362fffb87be736e28cdb85b. Executable26,753,728bytes SHA25630464151dc4ca43075079ecab98c6f64f00bfe39ae1940c36525738f827cc1b8.

Every1,678 extracted regular payload file verified:1,676 exact source bindings, main exact after unique3byte UNK→DEB marker at6348394, one exact generated desktop entry. Metadata insomnium0.1.0/amd64/dependencies retained. Archive comparison after prepare0; after build1 retained and all70 changed autogenerated permission TOMLs verified CRLF-to-LF-only against Git blobs. No arbitrary masking or universal generated/toolchain/legal/linkage claim.

Old container start failed because obsolete /mnt/e/insomnium bind source was missing. No mount/junction repair. Following [Docker commit documentation](https://docs.docker.com/reference/cli/docker/container/commit/), a local snapshot53a3229d... preserved the stopped container toolchain/cache. New owned insomnium-current-build-ca6a7fe5 used no host mounts,2CPU/4GiB and is now stopped. Old/unrelated containers untouched. CLI argv node resolved /root/.bun/bin/bun. No installer/app/profile operations or testcase additions/changes/runs.

Evidence artifacts/linux-production-current-ca6a7fe5-20261019/verification.json, payload-bindings.json, deb-control.txt, source comparisons, generated-permission-line-endings.json, preparation/step states/logs, cleanup.json and retained archive/packages. BUILD.json appends this record and latestLinuxProductionBuild while preserving prior records. Producer86645/wrapper133204/build133176 and verification27779 terminal0; no owned live handles. Install/upgrade/uninstall/model retention/current native runtime, RPM/AppImage/macOS/hosted CI/signing and all PLAN/PARITY/legal/source/loader/linkage gates remain open. Migration incomplete; /compact unavailable, STATUS records handoff.

Updated 2026-10-18. Optional manual draft-release package retention is implemented with Bun/native gh; default builds remain read-only. Hosted execution/upload/download, platform CI/installer/signing/distribution and complete release/legal acceptance remain open.

## Current normal Windows MSI/NSIS production checkpoint — 2026-10-19

Source2a512fd917cedba97e653504b1d43dcdea769158 built with normal bun run desktop:build --bundles msi,nsis -- --locked, app.insomnium.desktop and default build/bundle hooks. Terminal0 after11m45s overall/Rust release9m11s; no probe identity or hook bypass. All1,632 tracked inputs retain exact before/after hashes, including the original dirty documents/test helpers. This is a tracked-input witness, not universal generated/untracked/toolchain/legal closure.

Retained executable23,986,176bytes SHA256a93b96a77ae1664fcbd28bba690e240e4011a1bb4306b41036eedb3ccf32f23a; MSI57,347,103bytes SHA25646a7dc16eb0d4e77967240633b012f560826711def2a15fb867a984912fcc7f5; NSIS43,270,335bytes SHA256c3b3b10a078f8670b70335c52687628bf94f025d4c2584bcfad6100c2b6b0778. All3AuthentiCode statuses NotSigned. WiX dark3.14 read-only extraction exits0: original/decompiled File tables each2,170 entries,2,169 byte-exact source/payload matches and main executable exact after unique documented Tauri2.12.0 UNK→MSI3byte bundle marker patch. Seven DARK1059 installer-UI foreign-row warnings retained; no installer-UI pass claimed. NSIS payload extraction remains unverified.

Evidence artifacts/windows-production-current-1792395964954/{verification.json,packages.json,tracked-inputs-before.json,tracked-inputs-after.json,payload-bindings.json,msi-metadata.json,signatures.json,build-state.json,build.log,build-error.log,dark-state.json,dark.log,original-main.wxs,decompiled.wxs} and retained packages. BUILD.json appends this checkpoint and updates latestWindowsProductionBuild while preserving prior Windows/Linux/RPM/AppImage metadata. No installer/app/profile/clipboard operations, new or repeated saved tests/scenarios or owned live handles. Signing/install/upgrade/uninstall/current runtime/hosted CI/other platforms/legal/source/linkage and every retained PLAN/PARITY gate remain open. Migration incomplete; /compact unavailable; STATUS records handoff.

## Current workflow inspection — 2026-10-19

Reviewed sourcec1bfdbe90801743d15d87af4963fbef0b90d7a37 entry/core/PR workflows; native actionlint1.7.12 accepts all3 with optional shellcheck/pyflakes disabled. GitHub read-only inspection found latest Desktop build run37559277828, dated2026-10-07, at source7f467869bebd1e60912f00151695e53a429df913: all3platform jobs failed at Build desktop packages. Their annotations report generic Tauri command failure; log download timed out at GitHub's results receiver. No current-source failure cause or hosted pass can be inferred. Evidence artifacts/ci-current-inspection-20261019/{historical-desktop-run,verification}.json; run https://github.com/dvgamerr-app/insomnium-app/actions/runs/37559277828 .

An asynchronous approval question proposes pushing the exact reviewed commit to a new migration/ci-verify-c1bfdbe9 branch and dispatching the existing Desktop build with retain_packages=false. Approval is pending: no push/dispatch/release/upload was executed. This concrete remote-ref step is needed for hosted Linux/Windows/macOS execution; local Windows syntax/build evidence cannot close that gate. No testcase files changed/new cases or owned live handles. This is not full migration/release acceptance.

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

## Production RPM archive-size correction — 2026-10-19

Added production scripts/normalize-rpm-archive-size.mjs and integrated it after Tauri bundle in build-desktop.mjs. The wrapper captures only actual RPM output paths reported by this successful invocation, requires the expected completed executable's bundle/rpm directory and refuses absent/stale output discovery. The helper validates bounded RPMv4 signature-header structure/immutable region, counts and hashes native rpm2cpio output, adds missing64bit LONGARCHIVESIZE271 and compatible32bit PAYLOADSIZE1007 with correct alignment/index/data order, and preserves every existing signature value plus the entire main header/compressed payload byte-for-byte. Existing sizes must be valid; a second invocation verifies and returns changed:false. Native digest and complete rpm2cpio0/hash equality are required on a same-directory temporary candidate before atomic replacement. Original is retained in a content-addressed .before-archive-size backup; conflicts/changed input refuse, old backups never overwrite. No signing bytes are stripped; native digest checks use --nosignature to avoid requiring signing keys, so this is not new authenticity acceptance. Raw tauri bundle callers must explicitly invoke this helper; the primary desktop:build flow does it automatically.

Official format/reader source consulted before implementation: https://rpm.org/docs/6.0.x/manual/format_v4.html and pinned RPM4.18 lib/package.c/rpm2cpio.c (the preceding artifacts retain both source files). First temporary candidate failed native RPM because data offsets did not follow tag order; original remained untouched and temporary was removed. Serialization corrected before success, failure source hash retained in artifacts/rpm-size-normalization-initial-failure.json. Direct correction of original9f127fb4 RPM passes RPM digests0/rpm2cpio0, both sizes124051636, same CPIO SHA5841bb83d3b83ac3f0775826775713b7c132a5e2ca1549b39b71adb471244767; repeat call changed:false.

Full primary command bun run desktop:build --bundles rpm --ci -- --locked passes terminal0 (8m10overall; Rust release4m59) through normal frontend/notices/hooks/native compile/RPM generation and automatic normalization. New primary RPM has size tags124051636; native rpm -Kv/rpm2cpio/CPIO extraction all0. All1,677 regular payload files verify against this build's inputs (main app after the documented Tauri UNK-to-RPM marker; desktop fields checked). Normalization leaves entire new main header/compressed payload identical; CPIO SHA2dccff776716191a2062bed568a15999bf7307f740b937f12bb16f6652591d99. Corrected primary SHA256d7fc12d6e7261c6721e60a3f759fd21b2c50b2765e34c63208c18df70429bb6a. Original unnormalized primary ad5322809c5041601cf6ad53772741c76fcc88c077336becff5e5c23d9bda9df retained. No new/modified/rerun tests or app/installer/profile/provider operations. Prettier helper/scoped diff check pass. Existing vendor/application warnings retained.

Evidence artifacts/rpm-archive-size-20261019/primary/{verification.json,normalization.json,payload-bindings.json,Insomnium-0.1.0-1.x86_64.rpm,original-before-size.rpm}, parent primary-build-state/logs and initial direct-correction/native-check receipts. BUILD.json appends the corrected checkpoint while retaining prior failures. Root snapshot remains0fff88a1 plus portable-root helper and the2packaging scripts recorded by SHA; no claim of universal source/linkage closure. Container used temporary4GiB to complete normal optimization, restored2GiB and stopped; all owned handles terminal (session48425/Windows PID115040 and cleanup85295). Existing junction retained as already documented, no new removal attempt.

This closes the missing RPM archive-size metadata/production-wrapper compatibility defect, not full release acceptance. Actual signed RPM/authenticity, install/upgrade/uninstall/current runtime, other platforms/hosted CI and every retained PLAN/PARITY/legal/source/linkage gate remain open. /compact unavailable; topic commit handoff follows.

## Production RPM Fedora install/startup/remove — 2026-10-19

Used existing isolated insomnium-rpm-runtime-20261001 (pinned Fedora image43b29f65..., actual Fedora44), initially exited/no Insomnium package/no host mounts/no foreign app processes. Current corrected production RPM SHA d7fc12d6e7261c6721e60a3f759fd21b2c50b2765e34c63208c18df70429bb6a copied and rehashed. Normal dnf install -y /tmp/Insomnium-current-20261019.rpm passes0:206installed/4upgraded/4replaced; default local-package policy reports skipped OpenPGP for @commandline, so no signing/authenticity acceptance. This maintained runtime is not a pristine dependency baseline and package DB/library updates are not claimed reverted to image state.

Actual installed rpm -V0, main/sidecar ldd0 without missing libraries and independent sha256sum --check of all1,677 installed files0. UID10001 startup uses a new isolated /tmp/insomnium-production-20261019 XDG tree and documented20second timeout/dbus/Xvfb command, without sandbox-disabling flags. Actual app237 and WebKitNetwork317/WebKitWeb357 observed alive under UID10001; timeout124 followed by no app/display/dbus/portal children. Portal GTK display activation warnings retained. This proves process/ABI startup only, not rendered UI/chooser/GPU/IPC/workflow/graceful-close acceptance.

Installed /usr/bin/spectral-linter also executes once as UID10001 against an in-memory no-ref OpenAPI document, no repository/custom rules/provider settings. Native exit0/empty stderr/job-correlated frame returns default ruleset/fallback:false/3expected lint diagnostics. Initial inline inspection wrongly expected selectedRuleset=oas; source contract says default, so corrected interpretation reuses the exact original raw reply without another dispatch. Both raw reply and inspection correction are retained. No new, modified or rerun saved test/scenario.

Default dnf remove -y insomnium passes0, rpm -q reports absent1, all1,677 package files absent, dnf check0. Existing home profile74files and newly generated opaque WebKit/cache profile65files retain exact SHA256 before/after (no real workspace/collection/schema or version-upgrade data claim). Root inspection after timeout/removal sees only original init/sleep and inspection. Runtime container stopped, no owned live handles; no host profiles touched. New runtime data retained for evidence.

Evidence artifacts/rpm-production-lifecycle-20261019/verification.json and raw install/remove/startup/native-check logs/states, installed manifest, old/new profile hash lists and Spectral reply. BUILD.json attaches this bounded runtime evidence to corrected RPM; prior limitations/failures retained. Official DNF install/remove documentation read before invocation: https://dnf5.readthedocs.io/en/latest/commands/install.8.html and https://dnf5.readthedocs.io/en/latest/commands/remove.8.html .

Remaining: real signed packages, version-to-version upgrades and collection/schema retention, native UI/protocol/chooser/graceful-close, other distros/architectures/platforms/hosted CI plus every retained PLAN/PARITY/legal/source/linkage gate. Full migration incomplete. /compact unavailable; topic handoff follows.

## Hosted Windows/macOS libclang selection — 2026-10-19

Clean hosted checkouts cannot rely on ignored artifacts/tools/llvm-20.1.8/bin from Cargo config. Desktop workflow now explicitly selects Windows runner LLVM/bin under ProgramFiles, requires libclang.dll, and exports LIBCLANG_PATH through GITHUB_ENV. macOS resolves active clang with xcrun, requires its toolchain lib/libclang.dylib and exports the same override. Existing Linux prerequisite/selection and local Cargo fallback remain. Missing hosted libraries fail early with no download or machine mutation.

Bun YAML parse retains all3 matrix targets; native PowerShell Parser and Git Bash -n both exit0; git diff --check passes. Evidence artifacts/ci-libclang-platforms-20261019/verification.json. Initial inline edit quoting failed before writes, then apply_patch succeeded. No saved tests/scenarios added/modified/rerun, no hosted workflow dispatched or native build claimed. Official references: https://github.com/actions/runner-images/blob/main/images/windows/Windows2022-Readme.md , https://github.com/KyleMayes/clang-sys , https://rust-lang.github.io/rust-bindgen/requirements.html .

Hosted libclang availability/loading, full platform builds/runtime/signing and every retained PLAN/PARITY/legal gate remain unverified; migration incomplete. No owned live processes. /compact unavailable; explicit topic commit handoff follows.

## Current Windows production MSI checkpoint — 2026-10-19

Built source e8201c2290e2b7174101852bd9229d266f8a8e9c with normal bun run desktop:build --bundles msi -- --locked, production app.insomnium.desktop identity and all normal frontend/Spectral/notice/native/bundle hooks. No probe identifier, bypass or app launch. Terminal0 after8m42s, observed build processes absent. All897 selected tracked product/tool inputs retain exact before/after hashes; partial source witness only, not universal loader/source/linkage closure. Pre-existing dev Cargo97076/110976 untouched and unrelated six dirty baseline paths preserved.

Current standalone executable23,298,560bytes SHA256 a107e50c3e5d0966efd23d2793ab9a8992048960c2b6fc2029d65031a6f25885; MSI57,039,903bytes SHA256 3abf9f43fd37770b3739364a1ab1f5ef2d1fb6d74befa835812aa9abaae3d0e1. WiX dark3.14 extraction0 without installation; original/decompiled File tables each2,170files, all2,170 payloads bound to actual sources.2,169 exact byte/hash matches, main executable exact after the unique documented __TAURI_BUNDLE_TYPE_VAR_UNK→MSI3byte patch (marker offset21679063). No arbitrary byte masking. Sidecar temp-source binding uses the preserved canonical built sidecar; remaining sources match original generated WiX File entries.

Both Authenticode statuses NotSigned. Seven DARK1059 decompiler UI foreign-row warnings retained, so no complete installer-UI validation claim. Existing5eventsource vendor and1application frontend build warnings remain in full logs. No saved test/scenario added/modified/rerun; no host installation/app/profile/browser/provider operation. Official build reference read before running: https://v2.tauri.app/distribute/windows-installer/ ; bundle transform pinned https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.0/crates/tauri-bundler/src/bundle.rs .

Evidence artifacts/windows-production-msi-e8201c22-20261019/{verification.json,build-state.json,tracked-inputs-before.json,payload-bindings.json,msi-metadata.json,dark-state.json,original-main.wxs,decompiled.wxs,build.log,build-error.log,dark.log} and preserved MSI/executable. BUILD.json appends current Windows checkpoint and latestWindowsProductionBuild pointer, preserving old Windows/Linux/RPM checkpoints and every prior limit. Signing/install/upgrade/uninstall/model retention/current runtime/hosted CI/other platforms/full legal/source/linkage and all retained PLAN/PARITY gates remain open; full migration incomplete. All owned handles terminal (build session69250/112272; extraction terminal), no owned live processes. /compact unavailable; explicit topic handoff follows.

## Current NSIS payload inspection — 2026-10-19

Retained normal Windows production source 2a512fd917cedba97e653504b1d43dcdea769158 NSIS c3b3b10a078f8670b70335c52687628bf94f025d4c2584bcfad6100c2b6b0778 extracted with installed C:/Program Files/7-Zip/7z.exe, exit0. All2,170 product files verified against the same generated MSI source bindings:2,169 byte-exact and main executable exact after unique3byte UNK→NSS marker replacement at22352079. Pinned official bundler source confirms NSS: https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.0/crates/tauri-bundler/src/bundle.rs . Initial manual assumption of4byte NSIS was rejected by byte comparison; corrected only after observing exactly3 differences and checking official source. No arbitrary masking.

Seven additional installer support/plugin/uninstaller files inventoried only, not source-verified. Evidence artifacts/windows-production-current-1792395964954/{nsis-verification.json,nsis-payload-bindings.json,nsis-payload/}; BUILD.json updates existing current record without changing producer source or prior evidence. No installer/app/profile/browser operations, no testcase additions/changes/runs. Extraction/verification terminal0, no owned live handles. Signing, installation/upgrade/uninstall/profile retention, current runtime, hosted CI/other platforms, support-file source bindings and retained PLAN/PARITY/legal/linkage gates remain open. Full migration incomplete.

NSIS support binding follow-up (2026-10-19): six additional support payloads match installed build-tool inputs byte-for-byte: nsDialogs/NSISdl/nsis_tauri_utils/StartMenu/System DLLs and renamed modern-wizard.bmp matching Contrib/Graphics/Wizard/win.bmp. Exact source paths/hashes retained in nsis-verification.json; generated installer.nsi preserved as original-installer.nsi and its WriteUninstaller instruction accounts for generated uninstall.exe, without claiming a byte/source closure for that generated executable. This narrows prior seven inventoried-only files to one generated uninstaller. No installer/app/profile operations, testcase changes or runs. BUILD.json and current verification receipt updated in place. All installer lifecycle/runtime/signing/CI/platform/legal/full parity gates remain. No owned live handles; migration incomplete.

## Current Linux native compiler — 2026-10-19, source7f4dd980

Current committed source (including cookie/netrc drains, normal exit coordination and latest native menus) passed cargo check --manifest-path src-tauri/Cargo.toml --all-targets --release --locked --offline: exit0, Cargo40.10s/producer40620ms. Existing WSL dockerman-backend unix Docker engine and owned stopped no-mount cache container insomnium-current-build-ca6a7fe5 were reused, with LLVM14 LIBCLANG_PATH and CARGO_BUILD_JOBS1; no context/daemon/package changes. Source archive SHA256ab2c44b77d210a14984b6659abb2e83894274b674559be8776a4aadaabb2f1a3 matches container copy, extracted into new /workspace-current-7f4dd980.13changed native/Cargo/build inputs were independently bound to Git blob bytes with the exact Git archive Windows LF→CRLF export.

artifacts/linux-native-current-7f4dd980-verification.json links preparation/source bindings/check/logs. Existing eventsource and LinuxProbe unused-field warnings retained. Compiler process inventory was empty before owned container stop; final authoritative state exited143/runningfalse/PID0. No owned live handles. Prior build/binaries/notices were compiler assets only; this is not current frontend/package/UI/legal/linkage/macOS or runtime acceptance. No testcase/scenario additions/modifications/runs. Full PLAN/PARITY/platform/distribution gates remain open.

## Current Linux native compiler after download/handshake work — 2026-10-19

Committed source b85f9fbacd0f4a3fdb38888487915596312c8dab passes existing Linux native all-targets release compiler gate in the reused owned cache container. Command: wsl -d dockerman-backend -- docker exec --env LIBCLANG_PATH=/usr/lib/llvm-14/lib --env CARGO_BUILD_JOBS=1 --workdir /workspace-current-b85f9fba insomnium-current-build-ca6a7fe5 cargo check --manifest-path src-tauri/Cargo.toml --all-targets --release --locked --offline . Exit0/Cargo41.80s; existing five eventsource warnings and Linux Probe unused fields remain (repeated across targets). No tests/scenarios/dependency installs or host Docker context/daemon changes.

Git archive artifacts/linux-native-current-b85f9fba.tar SHA256e97a2aaffe770a70d5c6c858b2376e3b238709aac44079c7d216d02e3240ff2b transferred into a new container directory. Twenty-three changed native/permission/vendor inputs since prior7f4dd980 compiler receipt independently match exact Git blobs or documented Windows CRLF export bytes. Current native modules include response download commands/grants/storage coordination and the vendored WebSocket handshake patch. Cached older frontend/binaries/notices from the established build workspace were copied only to satisfy compiler inputs; no current frontend/package/legal/linkage claim follows.

Evidence: artifacts/linux-native-current-b85f9fba-{preparation,source-bindings,verification}.json. Session30257 terminal0. Owned container d2602e600cb9678008b25e41d1f19fb6bb733bdf5bcf41cbe2dc034c6499f3a0 has no host mounts; before stopping, docker top showed only docker-init/sleep, no compiler. Stopped normally and verified exited/runningfalse/PID0; no owned live handles. No native user profile/provider/filesystem chooser operations. Linux GUI/chooser/download/cancellation/OS-close/runtime, macOS compilation/runtime, current Linux packages/notices and every retained PLAN/PARITY acceptance remain open.

## Linux compiler for JavaScript service-config representation — 2026-10-19

Source f6421f38 passes Linux native cargo check --manifest-path src-tauri/Cargo.toml --all-targets --release --locked --offline, exit0/40.30s (session46767), including the changed policy consumers and compile of the focused unit regression. No tests executed or added in this compiler follow-up. Existing eventsource5/Linux Probe unused-field warnings remain. Inspected retry throttler/weighted Sink arithmetic also matches the pinned source in the reviewed operations; no extra implementation change or full nonfinite-policy equivalence claim was inferred.

Git archive artifacts/linux-grpc-json-f6421f38.tar SHA256923ea7e6dec95c5694d25928a3a76fb7e28677793f49ae784e68fb534c25ee7f is extracted into new /workspace-grpc-json-f6421f38. Nine native inputs changed since the prior complete b85f9fba source receipt independently match Git blobs/Windows CRLF export. Existing cached frontend/binaries/notices are compiler-only inputs. Evidence artifacts/linux-grpc-json-f6421f38-{preparation,bindings,verification}.json. Owned no-mount container d2602e600cb9678008b25e41d1f19fb6bb733bdf5bcf41cbe2dc034c6499f3a0 showed only init/sleep after Cargo and was stopped normally; verified exited/runningfalse/PID0. No live owned handles, user profile/provider operations, dependency installs or new test/scenario/matrix. This is Linux compilation, not DNS/transport/race/native UI/runtime, current package/legal/linkage or macOS proof; every retained migration gate remains required.

Linux DNS cleanup compiler (2026-10-19, source907f1962): complete committed archive SHA1399b0a3b697148bd4aea7c185439e8a9ed5c26d133d26fb31a4fafb676042b5 extracted to new /workspace-grpc-dns-907f1962 in existing no-host-mount owned cache container. Five changed DNS/command/config/proxy/transport sources independently matched exact Git blob identities after CRLF line-ending normalization. Cached older build/binaries/notices copied only as compiler inputs, not current package/legal evidence. Cargo all-targets/release/locked/offline passed40.55s/session42075 terminal0; existing eventsource and Linux Probe unused warnings. artifacts/linux-grpc-dns-907f1962-{bindings,verification}.json and check.log. No testcase/scenario additions/changes/runs or dependency install/profile/provider mutation. After compiler exit, docker top showed only init/sleep; normal stop confirmed exited/runningfalse/PID0. No live owned handles. Actual held OS/TXT/proxy lookup cancellation/exit, config/wire/reconnect/runtime/Linux/macOS/platform and full migration gates remain open. /compact unavailable; explicit handoff before next topic.

Linux retained-config normalization compiler (2026-10-19, source96e28b03): complete committed archive SHA4984f8abf73217cd7953a5b9be8317d49be99a1156ec5cbbc9359480803d0010/new /workspace-grpc-normalize-96e28b03; five changed native sources independently matched Git blob IDs after CRLF line-ending normalization. Existing no-mount owned cache container, older cached frontend/binaries/notices compiler inputs only. Cargo all-targets/release/locked/offline passed40.87s/session43900 terminal0, existing eventsource/Linux Probe warnings. artifacts/linux-grpc-normalize-96e28b03-{bindings,verification}.json and check.log. No testcase/scenario additions/changes/runs or dependency/profile/provider mutation. docker top showed only init/sleep before normal stop; final exited/runningfalse/PID0, no owned live handles. Bounded source reconciliation also found existing retry pushback parseInt/NaN timers, hedging timer admission and legacy SSE explicit raw producer behavior aligned with pinned sources; historical unsupported-format diagnostics alone are not missing producer support. Do not rewrite those paths or create duplicate matrices from those strings. Runtime normalization/calendar/nonfinite/TXT/DNS/config/transport races, macOS compilation and all retained native/platform/package/legal/fullmigration gates remain open. /compact unavailable; explicit handoff before next topic.

Linux WebSocket deflate/frame/error-close compiler (2026-10-19, sourced45ff478): complete committed archive SHA704d89a2bbaca3f8afd2be00633318a36b0471c7b8652807075664b6ac8f8515/new /workspace-websocket-deflate-d45ff478 in existing no-host-mount cache container. All29native changes since96e28b03 independently match Git blob IDs after CRLF normalization, including Cargo lock/manifests and vendored yawc/SDK sources. Cached older frontend/binaries/notices copied only as compiler inputs; no current packaging/legal claim.

Initial offline check101 because futures0.3.34 was absent, retained in artifacts/linux-websocket-deflate-d45ff478-initial-cache-miss.log. One fetch command omitted manifest-path and failed before network; corrected cargo fetch --manifest-path src-tauri/Cargo.toml --locked --target x86_64-unknown-linux-gnu passed, downloaded only locked futures0.3.34, no version/lock changes. Final all-targets/release/locked/offline check passed2m16s/session52604terminal0; existing eventsource/Linux Probe warnings only. Bind session51735terminal0. artifacts/linux-websocket-deflate-d45ff478-{bindings,verification}.json plus check/fetch logs.

No testcase/scenario additions/changes/runs, application profile/provider operations or dependency version changes. docker top showed only init/sleep after compiler exit; normal stop confirmed exited/runningfalse/PID0, no live owned handles. This closes only current Linux native compilation for this source, not compressed wire/window/takeover/fragment/control/corruption/limit/blocked-close/cancel/OS-close/runtime/macOS/package/legal/fullmigration gates. Baseline six dirty paths preserved. /compact unavailable; explicit handoff before next feature.

Linux WebSocket option/negotiation compiler (2026-10-19, source5ecb8442): complete committed archive SHAdf8fabaaad96bab3f01cd6add12e382875daf32e37e7a010ef2010167c105915 extracted to new /workspace-websocket-options-5ecb8442 in existing no-host-mount owned cache container. All8native changes since d45ff478 independently matched exact Git blobs after CRLF normalization, including sequencing/explicit flush/window token/list/no-context threshold. Cached older frontend/binaries/notices copied only as compiler inputs, not current packaging/legal evidence.

Cargo all-targets/release/locked/offline passed41.46s/session95042terminal0 with existing eventsource/Linux Probe warnings, no new download/version/lock change or testcase/scenario addition/change/run. artifacts/linux-websocket-options-5ecb8442-{bindings,verification}.json and check.log. docker top showed only init/sleep before normal stop; final exited/runningfalse/PID0, no owned live handles/profile/provider changes. This proves Linux compilation for current code only; header/token/list/outgoing threshold/window/takeover/native/Linux/macOS runtime/macOS compile/fullmigration/package/legal gates remain open. Baseline six dirty paths preserved. /compact unavailable; explicit handoff before next feature.

## Current Linux topology/hedging compiler — 2026-10-20

Source a39ffae451f2d84ce79496722799e0ee3646ec60 complete Git archive extracted into new /workspace-native-a39ffae4 in the existing owned no-host-mount cache container. Archive SHA256ee727376da7972a93c4a53d6c04ede017b6e57391bfd5a62af19e6797e2d73c3 matches container copy. All3native changes since5ecb8442 (grpc_hedging.rs,grpc_retry.rs,resource_topology.rs) independently match committed Git blobs after CRLF normalization. Six baseline dirty files are not compiler inputs.

Command through wsl -d dockerman-backend -- docker exec --env LIBCLANG_PATH=/usr/lib/llvm-14/lib --env CARGO_BUILD_JOBS=1 --workdir /workspace-native-a39ffae4 insomnium-current-build-ca6a7fe5 cargo check --manifest-path src-tauri/Cargo.toml --all-targets --release --locked --offline passed38.92s/session96577terminal0. Existing eventsource5/Linux clipboard Probe warnings only. No downloads/dependency/lock change or testcase/scenario addition/change/run. Cached older build/binaries/notices are compiler inputs only, not current frontend/package/legal evidence. Artifacts linux-native-a39ffae4-{bindings,verification}.json and -check.log retain source bindings/scope.

After check docker top showed only docker-init/sleep; normal stop completed, final exited/runningfalse/PID0. No owned live handles/profile/provider mutation. This closes current Linux native compilation for the recorded source only; Linux/macOS runtime, macOS compilation, hedging error/cleanup, native UI/OS-close, packages/installers/legal/CI and full PLAN/PARITY acceptance remain open. /compact unavailable; explicit handoff recorded.
