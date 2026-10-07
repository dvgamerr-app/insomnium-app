# Desktop CI migration

## Current implementation

.github/workflows/desktop-build.yml is a build-only workflow for main/master pushes and manual dispatch. It has Linux x64 (Ubuntu22.04), Windows x64 (Windows2022) and macOS universal (macOS15) jobs. Bun1.4.2 and Rust1.98.1 are pinned to the development baseline. Pull requests use pr-check.yml, which now runs a pinned-Bun frontend check/build job alongside Qlty on Ubuntu24.04. No pull_request_target event is used.

All steps use native shell commands or Bun/Cargo. No JavaScript actions are invoked: official setup-bun and checkout currently start Node24 internally. Bun is installed with the documented versioned installers; Git checkout fetches the exact event SHA. The checkout token is step-scoped and passed only to the fetch subprocess via Git environment configuration; it is not written to repository config or passed to build steps. No pull_request_target execution is configured.

Linux installs Tauri native prerequisites plus dpkg-dev, rpm and libgles2. macOS installs both Rust target architectures. Both frontend and desktop builds use bun install --frozen-lockfile --ignore-scripts, then explicit bun run prepare (OpenAPI validator generation and SvelteKit sync) before Svelte check/build. This keeps project preparation explicit and avoids install lifecycle commands launching another JavaScript runtime. The desktop wrapper retains --locked. Package SHA256/size inventory is written to the job summary and desktop-packages.json on the ephemeral runner. PR checkout tokens are step-scoped and fetch authentication uses Git environment configuration instead of command-line headers or persisted Git config.

2026-10-08 capabilityd1adba5: native actionlint1.7.12 accepts both workflows (shellcheck/pyflakes disabled). Parsed YAML inspected for read-only contents permission, no uses actions and no job-scoped checkout tokens. Command chain passes in the main Windows workspace and an isolated detached c64a585 worktree with fresh node_modules:243 packages installed, explicit prepare/check0 errors0 warnings/production frontend build terminal0. Global package cache may be reused; this is clean-install local evidence, not a GitHub/Linux runner bootstrap result. Exact sessions9682/7970 terminal0; result in artifacts/ci-inspection/frontend-pr-check-result.json. Temporary worktree was verified inside owned artifacts, not a reparse point, and removed after checking its tracked tree remained clean. No app/native production source changed or native rebuild needed.

## Verification and remaining gates

- YAML parses and both inline JavaScript programs parse under Bun.
- Native actionlint1.7.12 validates the final workflow with exit0. Its zip SHA256 was checked against upstream release checksums. Optional shellcheck/pyflakes integrations were disabled explicitly, so no Python was invoked.
- Initial actionlint rejection: runner.temp was used at job.env scope, where that context is unavailable. Moved it into installer step environments; rerun passed.
- No GitHub run or push has been triggered. Workflow changes are committed locally. Runner bootstrap, private/fork checkout, Qlty plugin runtime, Windows/macOS matrix builds, and platform compatibility remain unverified.
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
