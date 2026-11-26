# Write targets

Where a skill tree is written, per host.

## Targets

| Host | Root | Official source |
| --- | --- | --- |
| Claude Code | `.claude/skills/<name>/` | [Skills](https://code.claude.com/docs/en/skills) |
| Cursor | `.cursor/skills/<name>/` | [Skills](https://cursor.com/docs/skills) |
| OpenCode | `.opencode/skills/<name>/` | [Skills](https://opencode.ai/docs/skills) |
| GitHub Copilot | `.github/skills/<name>/` | [CLI](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#skill-frontmatter-fields), [VS Code](https://code.visualstudio.com/docs/agent-customization/agent-skills) |
| Codex | `.agents/skills/<name>/` | [Skills](https://learn.chatgpt.com/docs/build-skills) |
| Kilo Code | `.kilo/skills/<name>/` | [Skills](https://kilo.ai/docs/customize/skills) |
| Antigravity | `.agents/skills/<name>/` | [Skills](https://antigravity.google/docs/skills) |
| Kiro | `.kiro/skills/<name>/` | [Skills](https://kiro.dev/docs/skills/) |
| Kimi Code CLI | `.agents/skills/<name>/` | [Skills](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/skills.html) |
| Plugin source | where the target host's plugin format puts skills | the target host's plugin docs |

## Frontmatter

Emit `name` and `description`, the two fields of the [Agent Skills](https://agentskills.io/specification) standard every host reads.
