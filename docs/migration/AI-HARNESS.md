# Development AI Harness

Claude owns the existing agent loop. This repository's Bun CLI is a supporting harness, not another agent or autonomous loop. It does not add AI features, providers, API keys, network calls or UI to Insomnium. Claude exports context, decides, submits JSON and consumes results through its existing tools. No dependency or generator is needed for this standalone JavaScript utility.

## Six components

| Component                  | Implementation                                                                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent loop                 | Reuse Claude's existing loop; CLI calls `init → context → step → context` provide state and tool boundaries, stopping at review, human help, completion or the 200-event budget         |
| Tool calling               | Validated `read_file` and `write_file` requests; unknown tools refused; no shell execution                                                                                              |
| Context management         | Fresh ancestor/project instructions and migration documents pinned; explicit agent summary plus up to 32 KiB recent events; omission count; scoped instructions included in tool events |
| Checkpointing              | Local JSON checkpoint replaced by rename under exclusive lock; revision prevents stale decisions; approval intent saved before a write                                                  |
| Permissions and sandboxing | Repository-relative paths, canonical path checks, protected data/build directories and key files excluded; each write requires human approval                                           |
| Guardrails                 | Bounded input/file sizes, schema checks, revision checks, before-content conflict checks and final-output approval                                                                      |

## Usage

Run from the repository root using Bun:

```sh
bun scripts/ai-harness.mjs init "Implement the reviewed migration task"
bun scripts/ai-harness.mjs context
bun scripts/ai-harness.mjs step artifacts/decision.json
bun scripts/ai-harness.mjs status
```

The external agent reads the context and writes a decision JSON file. Use the current `revision` shown by `context` or `status`:

```json
{
  "revision": 1,
  "type": "tool",
  "tool": "read_file",
  "args": { "path": "src/lib/transport.js" }
}
```

Files above 32 KiB are refused. Use the host agent's existing narrow-reading tools for large files. For edits submit `write_file` with `args.path` and the complete `args.content` (at most 32 KiB). Parent directories must already exist. Review `status` for the original and proposed content. A human runs `approve <revision>` or `reject <revision>`; the model adapter must never invoke these review commands. After approval, consume the next `context`. A changed target refuses the write; reject and submit a fresh decision.

Other decisions:

```json
{
  "revision": 2,
  "type": "summary",
  "content": "Evidence, decisions, remaining gates, current commit and live handles"
}
```

`help` with `content` pauses for human assistance; approval resumes. `finish` with `content` proposes the final response and requires approval before completion. Completion approval records review, not proof that checks passed. The caller must run repository-required Bun/Cargo checks, update STATUS, and commit verified work by topic using its authorized host tools.

## Recovery and boundary

Checkpoint and lock live in ignored `artifacts/ai-harness/`. Resume with `status` and `context`; `init` refuses to overwrite a run. After a crash, verify no harness process remains before manually removing the lock. Interrupted approved writes require human reconciliation: inspect the target and pending proposal, then reject/replan if needed. Never automatically replay a write. Archive a completed checkpoint before starting another task. Local checkpoint/event content may contain source or sensitive information; do not upload it blindly.

This is an application permission boundary, **not an OS sandbox**. The agent and human share the host account; anyone with filesystem access can alter checkpoints or invoke approval. Canonical checks do not eliminate filesystem races caused by another local process. For untrusted agents, enforce approval separation and OS/container isolation externally. No arbitrary execution tool is exposed. Nested instructions must be followed by the caller; scoped instruction events aid review but do not semantically enforce their prose. Summary compression is explicit and character budgets are not token counts; pinned rules are never silently truncated.

Official references consulted before implementation: [Bun file I/O](https://bun.sh/docs/runtime/file-io) and [Bun subprocess documentation](https://bun.sh/docs/runtime/child-process). This harness deliberately exposes no subprocess tool.

## Verification

See the development harness handoff in STATUS.md for actual checks. No new automated test file or UI scenario is added; the application UI and migration acceptance scope remain unchanged.
