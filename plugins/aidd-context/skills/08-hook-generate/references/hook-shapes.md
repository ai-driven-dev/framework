# Hook shapes

The shape of a hook entry, per tool. The file each scope writes is in `hook-scopes`.

| Tool | Entry shape | Note |
| --- | --- | --- |
| Claude Code | `{ "hooks": { "<Event>": [ { "matcher": "...", "hooks": [ { "type": "command", "command": "..." } ] } ] } }` | `settings.json` and a plugin `hooks/hooks.json` both wrap the event map under a top-level `hooks` key; a bare event map is wrong |
| Codex CLI | same as Claude Code | `config.toml` uses a `[hooks]` table instead of the key |
| Cursor | `{ "version": 1, "hooks": { "<event>": [ { "command": "..." } ] } }` | - |
| GitHub Copilot | `{ "version": 1, "hooks": { "<Event>": [ { "type": "command", "command": "..." } ] } }` | - |
| Antigravity CLI | `{ "<hook-name>": { "<Event>": [ { "command": "..." } ] } }` | `PreToolUse` and `PostToolUse` entries are `{ "matcher": "<regex>", "hooks": [ { "command": "..." } ] }`, matching native tool names |
