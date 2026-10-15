# Claude development subagents

Claude owns the existing agent loop and native tools. CLAUDE.md routes scoped work to project subagents in .claude/agents/. The earlier scripts/ai-harness.mjs JSON CLI is removed. No concatenation service, provider adapter or second agent runtime is needed.

| Agent              | Responsibility                              | Tools                                              |
| ------------------ | ------------------------------------------- | -------------------------------------------------- |
| insomnium-scout    | Investigate code/evidence and propose scope | Read, Grep, Glob                                   |
| insomnium-builder  | Implement explicitly owned files            | Read/search/edit/write, Bash, documentation lookup |
| insomnium-verifier | Run existing checks and saved scenarios     | Read/search, Bash                                  |
| insomnium-reviewer | Review supplied diff and affected code      | Read, Grep, Glob                                   |

## Usage in Claude Code

Start Claude Code in this repository. Restart an existing session if the new agents directory is not discovered. Ask directly:

> ใช้ insomnium-scout ตรวจ gap ของ WebSocket history แล้วมอบไฟล์ที่ต้องแก้ให้ insomnium-builder จากนั้นใช้ insomnium-verifier ตรวจ และ insomnium-reviewer รีวิว diff ให้คุณรวมผลและ commit

For review only:

> ใช้ insomnium-reviewer รีวิว diff ปัจจุบัน โดยเตรียม diff ให้ agent อ่าน ไม่ต้องแก้ไฟล์

Claude dispatches objectives and relevant paths; workers read applicable instructions and code in their own contexts, returning concise results. The coordinator owns integration, approvals, STATUS and topic commits. Assign exclusive file ownership; serialize shared-file edits and native/profile-mutating checks. Independent investigations may run in parallel. Model selection and permissions inherit host configuration; these definitions do not change either.

## Six responsibilities

1. Agent loop: existing Claude session delegates, consumes results and decides next actions.
2. Tool calling: native Claude tools, restricted by agent frontmatter.
3. Context: separate worker contexts and targeted reads; no generated concatenated prompt.
4. Recovery: existing Claude session/resume facilities and STATUS handoffs. Definitions do not create transactional workflow checkpoints or replay unfinished calls.
5. Permissions: host permissions and per-agent tool access. Builder/verifier Bash remains powerful; prose restrictions are not an OS sandbox. No permission bypass is configured.
6. Guardrails: project rules, owned scopes, independent verification/review and existing host approvals. Review is an instructed workflow, not an enforced hook or guaranteed automatic gate.

## Validation and references

Official [Claude Code subagent documentation](https://code.claude.com/docs/en/sub-agents) describes Markdown/YAML definitions and project discovery. This uses that documented file format, without a new dependency or generator.

Frontmatter and file references are checked locally with Bun and the existing YAML dependency. Runtime invocation remains unverified until Claude Code loads and invokes the agents. No application source/UI or test scenario changes are needed. Historical ignored CLI verification artifacts remain local and are not consumed. See STATUS.md for handoff.
