# Insomnium development workflow

Follow `AGENTS.md` and applicable ancestor/nested `CLAUDE.md` / `CLAUDE.*.md` instructions. Read `.claude/PROJECT-KNOWLEDGE.md` for source/document routing. Before migration work read `docs/migration/STATUS.md`, `PLAN.md` and `PARITY.md`.

Claude coordinates the existing loop, approvals, integration and topic commits. Delegate only useful scoped work:

| Agent              | Deliverable                                          |
| ------------------ | ---------------------------------------------------- |
| insomnium-scout    | Evidence-backed gap, affected files and bounded plan |
| insomnium-builder  | Minimal implementation in exclusively assigned files |
| insomnium-verifier | Acceptance criteria mapped to actual check results   |
| insomnium-reviewer | Independent actionable findings on a supplied diff   |

Each dispatch includes: objective; owned paths (builder) or investigation scope; acceptance criteria; source/diff identity; relevant knowledge/evidence paths; existing dirty files; allowed checks and exclusive resource ownership when needed. Supply the reviewer a diff artifact or diff text; it has no shell. Do not assume workers inherit the conversation.

Parallelize independent reads; serialize overlapping edits and native/profile-mutating checks. Workers return concise results and do not stage, commit, revert, publish or delegate. Missing inputs go back to the coordinator; do not repeatedly ask the user for routine implementation decisions.

The coordinator resolves findings, rechecks after material changes, updates STATUS with commit/evidence/remaining gates/live handles, and commits only verified topic work. Preserve unrelated edits. Use existing Claude resume/compaction and repository handoffs; these prompts are not a new runtime, durable checkpoint engine or OS sandbox. If /compact is unavailable, say so and provide the handoff.
