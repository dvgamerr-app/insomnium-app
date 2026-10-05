# Desktop CI migration

## Current implementation

.github/workflows/desktop-build.yml is a build-only workflow for pull requests, main/master pushes and manual dispatch. It has Linux x64 (Ubuntu22.04), Windows x64 (Windows2022) and macOS universal (macOS15) jobs. Bun1.4.2 and Rust1.98.1 are pinned to the development baseline.

All steps use native shell commands or Bun/Cargo. No JavaScript actions are invoked: official setup-bun and checkout currently start Node24 internally. Bun is installed with the documented versioned installers; Git checkout fetches the exact event SHA. The checkout token is step-scoped and passed only to the fetch subprocess via Git environment configuration; it is not written to repository config or passed to build steps. No pull_request_target execution is configured.

Linux installs Tauri native prerequisites plus dpkg-dev, rpm and libgles2. macOS installs both Rust target architectures. Jobs run frozen Bun installation, Svelte check, and the primary desktop:build wrapper with --locked. Package SHA256/size inventory is written to the job summary and desktop-packages.json on the ephemeral runner.

## Verification and remaining gates

- YAML parses and both inline JavaScript programs parse under Bun.
- Native actionlint1.7.12 validates the final workflow with exit0. Its zip SHA256 was checked against upstream release checksums. Optional shellcheck/pyflakes integrations were disabled explicitly, so no Python was invoked.
- Initial actionlint rejection: runner.temp was used at job.env scope, where that context is unavailable. Moved it into installer step environments; rerun passed.
- NO GitHub run has been triggered; no commit/push was made. Runner bootstrap, private/fork checkout, Windows/macOS builds, and platform compatibility remain unverified.
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

Local validation evidence: artifacts/ci-inspection/.
