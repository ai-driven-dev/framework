# Hook scopes

Which file each scope writes, per tool. A `-` means the tool has no such scope.

| Scope | Claude Code | Codex CLI | Cursor | GitHub Copilot | Antigravity CLI |
| --- | --- | --- | --- | --- | --- |
| user or global | `~/.claude/settings.json` | `~/.codex/` (`hooks.json` or `config.toml`) | `~/.cursor/hooks.json` | `~/.copilot/hooks/` | - |
| project, shared | `.claude/settings.json` | `<repo>/.codex/` (trust-gated) | `.cursor/hooks.json` | `.github/hooks/*.json`, or a `hooks` block in `.github/copilot/settings.json` | `.agents/hooks.json`, cwd `<repo>/.agents` |
| project, local | `.claude/settings.local.json` | - | - | - | - |
| component or agent | skill or agent frontmatter | - | - | `.agent.md` frontmatter | - |
| plugin | `plugins/<plugin>/hooks/hooks.json` | plugin `hooks.json` | - | - | - |
| enterprise or team | managed policy settings | managed policy | team or enterprise path | `policy.d/` or registry | - |

| Scope | Caveat |
| --- | --- |
| component or agent | the hook runs only while that component is active, so a session-start or other always-on moment does not fire reliably; steer those to a project or user scope |

| Write mode | Scope |
| --- | --- |
| host project | asked, among the rows above except plugin |
| plugin source | the plugin row, with no scope question: the entry merges into that plugin's `hooks/hooks.json`; a tool with `-` there is skipped |
