# Conversation sources

Where to load one complete conversation and find the sessions it spawned, per host. Repeat the child lookup for each child.

| Host | Preferred complete source | Transcript | Child sessions | Timing or usage source |
| --- | --- | --- | --- | --- |
| Codex | host thread reader with the exact thread ID, then TUI `/export` Markdown | `CODEX_HOME/sessions/YYYY/MM/DD/rollout-*-{thread-id}.jsonl`, normally under `~/.codex` | rollouts whose first line has `payload.source.subagent.thread_spawn.parent_thread_id` equal to the thread ID | TUI `/status` estimated thread credits or cost; tool elapsed records when exposed |
| Claude Code | `/export` text, or the documented script interface for an exact session ID | `~/.claude/projects/{project}/{session-id}.jsonl` | `~/.claude/projects/{project}/{session-id}/subagents/agent-*.jsonl`, each with its `.meta.json` | transcript timestamps and tool records when exposed |
| OpenCode | `opencode session export {session-id} --sanitize` JSON | `~/.local/share/opencode/opencode.db` | `session` rows whose `parent_id` is the session ID | `cost` and `tokens_*` on the `session` row; `opencode stats`; `~/.local/share/opencode/log/` |
