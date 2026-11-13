# Write targets

Where a skill tree is written, per tool.

## Targets

| Tool | Root | Official source |
| --- | --- | --- |
| Claude Code | `.claude/skills/<name>/` | [Skills](https://code.claude.com/docs/en/skills) |
| Cursor | `.cursor/skills/<name>/` | [Skills](https://cursor.com/docs/skills) |
| OpenCode | `.opencode/skills/<name>/` | [Skills](https://opencode.ai/docs/skills) |
| GitHub Copilot | `.github/skills/<name>/` | [CLI](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#skill-frontmatter-fields), [VS Code](https://code.visualstudio.com/docs/agent-customization/agent-skills) |
| Codex | `.agents/skills/<name>/` | [Skills](https://learn.chatgpt.com/docs/build-skills) |
| Kilo Code, native | `.kilo/skills/<name>/` | [Skills](https://kilo.ai/docs/customize/skills) |
| Kilo Code, portable by explicit choice | `.agents/skills/<name>/` | [Skills](https://kilo.ai/docs/customize/skills) |
| Antigravity | `.agents/skills/<name>/` | [Skills](https://antigravity.google/docs/skills) |
| Plugin source | where the target tool's plugin format puts skills | the target tool's plugin docs |

## Frontmatter

Emit `name` and `description`, the two fields of the [Agent Skills](https://agentskills.io/specification) standard every tool reads. For any other field, read the target's source above.

For Kilo, the skill name must match its parent directory, use lowercase letters, digits and single hyphens, and contain at most 64 characters. Kilo allows descriptions up to 1,024 characters, while the shared AIDD generator validator limits them to 150; generated skills must satisfy the stricter AIDD limit. Kilo also accepts optional `license`, `compatibility` and `metadata` fields. Ask for explicit user agreement before using the portable `.agents/skills/` target, and never write the same skill to both locations.
