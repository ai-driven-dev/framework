# Conversation sources

Where to load one complete conversation and find the sessions it spawned, per host. Repeat the child lookup for each child.

| Host | Preferred complete source | Transcript | Child sessions | Timing or usage source |
| --- | --- | --- | --- | --- |
| Codex | host thread reader with the exact thread ID, then TUI `/export` Markdown | `CODEX_HOME/sessions/YYYY/MM/DD/rollout-*-{thread-id}.jsonl`, normally under `~/.codex` | rollouts whose first line has `payload.source.subagent.thread_spawn.parent_thread_id` equal to the thread ID | TUI `/status` estimated thread credits or cost; tool elapsed records when exposed |
| Claude Code | `/export` text, or the documented script interface for an exact session ID | `~/.claude/projects/{project}/{session-id}.jsonl` | `~/.claude/projects/{project}/{session-id}/subagents/agent-*.jsonl`, each with its `.meta.json` | transcript timestamps and tool records when exposed |
| OpenCode | `opencode session export {session-id}` JSON, retained privately | resolve with `opencode debug paths db`; inspect the schema before querying | matching `parent_id` rows in `session_v2` (V2) or `session` (V1) | recorded session/event usage and `opencode stats`; resolve logs with `opencode debug paths log` |

## Redaction and completeness

- **Redaction:** a sanitized export may retain events while removing prompts, arguments or results needed to explain the run.
- **Local source:** use the complete authorized source for the selected sessions and retain it privately.
- **Shared copy:** sanitize separately when sharing requires it.
- **Report excerpts:** include necessary evidence without credentials or unrelated personal content.
