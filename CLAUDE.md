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

The coordinator resolves findings, rechecks after material changes, and commits only verified topic work. Preserve unrelated edits. Use existing Claude resume/compaction and repository handoffs; these prompts are not a new runtime, durable checkpoint engine or OS sandbox. If /compact is unavailable, say so and provide the handoff.

## Owner rule: finish a topic before documenting it

- Focus on completing the agreed plan. Do not create redundant test cases, duplicate scenarios or repeatedly rerun passing checks without a relevant change, failure or unresolved concern. Reuse the existing scenario for the same behavior and run only verification needed for the topic.
- Complete implementation and relevant verification for one coherent topic, then update its documentation once with a concise summary: final behavior, evidence, remaining gates and any live handles.
- Never turn STATUS, PLAN or topic documents into a running diary of thoughts, commands, intermediate fixes or repeated “Current”/“follow-up” checkpoints. Replace superseded summaries instead of appending another version; keep detailed execution logs in artifacts.
- Commit verified work by topic. Do not create a separate documentation/handoff commit after every small code change. Consolidate related code and its final summary before starting the next topic.
- If interrupted, leave only the minimal accurate resume state. Do not duplicate history or claim unfinished work passed.
