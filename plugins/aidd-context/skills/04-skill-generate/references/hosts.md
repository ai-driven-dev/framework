# Hosts

Where each host AI tool keeps a project's skills, and how to tell it is installed.

| Host | Detected when | Skill folder | Source |
| --- | --- | --- | --- |
| Claude Code | `.claude/` or `CLAUDE.md` | `.claude/skills/<name>/` | [Skills](https://code.claude.com/docs/en/skills) |
| Cursor | `.cursor/` | `.cursor/skills/<name>/` | [Skills](https://cursor.com/docs/skills) |
| OpenCode | `.opencode/` | `.opencode/skills/<name>/` | [Skills](https://opencode.ai/docs/skills) |
| GitHub Copilot | `.github/copilot-instructions.md` | `.github/skills/<name>/` | [CLI](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#skill-frontmatter-fields), [VS Code](https://code.visualstudio.com/docs/agent-customization/agent-skills) |
| Codex CLI | `.codex/` | `.agents/skills/<name>/` | [Skills](https://learn.chatgpt.com/docs/build-skills) |
| Kilo Code | `.kilo/` | `.kilo/skills/<name>/` | [Skills](https://kilo.ai/docs/customize/skills) |
| Antigravity | `.agents/agents/`, `.agents/rules/` or `.agents/hooks.json` | `.agents/skills/<name>/` | [Skills](https://antigravity.google/docs/skills) |

Every host reads `AGENTS.md`, so it signals none. When no signal matches, confirm the host.

A plugin source is one skill folder where the target tool's plugin format puts skills, per that tool's plugin docs.

Emit `name` and `description`, the two fields of the [Agent Skills](https://agentskills.io/specification) standard every host reads. For any other field, read the host's source.
