# Insomnium development workflow

Read and follow `AGENTS.md` and all applicable ancestor/nested `CLAUDE.md` and `CLAUDE.*.md` files before work. Before migration work, read `docs/migration/STATUS.md`, `PLAN.md` and `PARITY.md`. These remain the source of truth; do not concatenate them into generated prompts or add a second agent runtime.

Claude coordinates the existing agent loop, user communication, approvals, integration, final verification and topic commits. Delegate scoped tasks to `.claude/agents/` when useful:

1. `insomnium-scout`: investigate relevant code and evidence; propose a bounded plan.
2. `insomnium-builder`: implement an explicitly assigned scope with exclusive file ownership.
3. `insomnium-verifier`: run appropriate existing Bun/Cargo checks and saved UI scenarios.
4. `insomnium-reviewer`: independently review the supplied diff and affected code.

Use only agents needed; keep small tasks in the main conversation. Parallelize independent investigations/reviews; serialize shared-file edits and all native/profile-mutating scenarios. Never assign overlapping files to concurrent builders. Dispatches include objective, exact owned paths, acceptance criteria, evidence paths, known dirty files and resource ownership. Workers read applicable files themselves and return concise results, not whole file contents.

Preserve pre-existing changes. Workers do not stage, commit, revert, clean, publish or expand scope. The coordinator resolves findings, updates STATUS with evidence/remaining gates/live handles and commits verified topic work. Use existing Claude session/resume facilities and STATUS handoffs; agent definitions do not implement durable workflow checkpoints or an OS sandbox. Never claim compaction or verification that did not occur.

All workers follow project constraints: Bun only for JavaScript tooling; Cargo for Rust; Svelte/plain JavaScript; preserve current UI and legacy backup; no browser-use or ad-hoc browser automation. Saved Playwright browser scenarios use launchUiBrowser with headless:true; native hosts hide before attachment and report native-hidden. New non-UI test scripts require explicit authorization. Consult official docs before implementing subsystems. No external messages, production actions, permission bypasses or secrets in reports.
