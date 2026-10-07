# Desktop CI migration

## Current implementation

.github/workflows/desktop-build.yml is a build-only workflow for main/master pushes and manual dispatch. It has Linux x64 (Ubuntu22.04), Windows x64 (Windows2022) and macOS universal (macOS15) jobs. Bun1.4.2 and Rust1.98.1 are pinned to the development baseline. Pull requests use pr-check.yml, which now runs a pinned-Bun frontend check/build job alongside Qlty on Ubuntu24.04. No pull_request_target event is used.

All steps use native shell commands or Bun/Cargo. No JavaScript actions are invoked: official setup-bun and checkout currently start Node24 internally. Bun is installed with the documented versioned installers; Git checkout fetches the exact event SHA. The checkout token is step-scoped and passed only to the fetch subprocess via Git environment configuration; it is not written to repository config or passed to build steps. No pull_request_target execution is configured.

Linux installs Tauri native prerequisites plus dpkg-dev, rpm and libgles2. macOS installs both Rust target architectures. Both frontend and desktop builds use bun install --frozen-lockfile --ignore-scripts, then explicit bun run prepare (OpenAPI validator generation and SvelteKit sync) before Svelte check/build. This keeps project preparation explicit and avoids install lifecycle commands launching another JavaScript runtime. The desktop wrapper retains --locked. Package SHA256/size inventory is written to the job summary and desktop-packages.json on the ephemeral runner. PR checkout tokens are step-scoped and fetch authentication uses Git environment configuration instead of command-line headers or persisted Git config.

2026-10-08 capabilityd1adba5: native actionlint1.7.12 accepts both workflows (shellcheck/pyflakes disabled). Parsed YAML inspected for read-only contents permission, no uses actions and no job-scoped checkout tokens. Command chain passes in the main Windows workspace and an isolated detached c64a585 worktree with fresh node_modules:243 packages installed, explicit prepare/check0 errors0 warnings/production frontend build terminal0. Global package cache may be reused; this is clean-install local evidence, not a GitHub/Linux runner bootstrap result. Exact sessions9682/7970 terminal0; result in artifacts/ci-inspection/frontend-pr-check-result.json. Temporary worktree was verified inside owned artifacts, not a reparse point, and removed after checking its tracked tree remained clean. No app/native production source changed or native rebuild needed.

## Verification and remaining gates

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
