# Hook support

Which tools support hooks, and where each one's hook documentation lives.

| Tool | Hooks | Note | Docs |
| --- | --- | --- | --- |
| Claude Code | yes | JSON config and a script, the richest event set | https://code.claude.com/docs/en/hooks |
| Codex CLI | yes | JSON or TOML config and a script, stable and on by default | https://developers.openai.com/codex/hooks |
| Cursor | yes | JSON config and a script | https://cursor.com/docs/hooks |
| Antigravity CLI | yes | JSON config and a script | https://antigravity.google/docs/hooks |
| GitHub Copilot | yes | JSON config and a script, also reads Claude's `.claude/` config | https://docs.github.com/en/copilot/reference/hooks-configuration |
| OpenCode | no | hooks are code, not a config entry plus a script | https://opencode.ai/docs/plugins |

| Skipped tool | What to tell the user |
| --- | --- |
| OpenCode | write a plugin under `.opencode/plugins/` (project) or `~/.config/opencode/plugins/` (user); this skill does not generate it |
