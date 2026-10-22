# Conversation sources

Where to load one complete conversation and the sessions it spawned, per host.

| Host | Preferred complete source | Session path | Timing or usage source |
| --- | --- | --- | --- |
| Codex | host thread reader with the exact thread ID, then TUI `/export` Markdown | `CODEX_HOME/history.jsonl`, normally `~/.codex/history.jsonl` | TUI `/status` estimated thread credits or cost; tool elapsed records when exposed |
| Claude Code | `/export` text, or the documented script interface for an exact session ID | `~/.claude/projects/{project}/{session-id}.jsonl` | transcript timestamps and tool records when exposed |
| OpenCode | `opencode export {session-id} --sanitize` JSON | `~/.local/share/opencode/project/{project-slug}/storage/` | `opencode stats`; `~/.local/share/opencode/log/` |
