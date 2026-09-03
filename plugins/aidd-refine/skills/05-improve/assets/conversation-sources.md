# Conversation sources

Use this static routing map to load one complete conversation. Do not fill or copy it into the report.

| Host | Preferred complete source | Session path | Timing or usage source |
| --- | --- | --- | --- |
| Codex | host thread reader with the exact thread ID, then TUI `/export` Markdown | `CODEX_HOME/history.jsonl`, normally `~/.codex/history.jsonl` | TUI `/status` estimated thread credits or cost; tool elapsed records when exposed |
| Claude Code | `/export` text, or the documented script interface for an exact session ID | `~/.claude/projects/{project}/{session-id}.jsonl` | transcript timestamps and tool records when exposed |
| OpenCode | `opencode export {session-id} --sanitize` JSON | `~/.local/share/opencode/project/{project-slug}/storage/` | `opencode stats`; `~/.local/share/opencode/log/` |

## Rules

- Prefer the complete export or host reader over direct storage parsing.
- Use direct storage only after matching one exact session ID.
- Search shared history or logs only for the exact session ID and ignore unrelated records.
- Never enumerate unrelated sessions or inspect configuration or authentication files.
- Treat private reasoning duration as unavailable unless the host exposes it directly.
