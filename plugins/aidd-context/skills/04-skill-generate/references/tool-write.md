# Write targets

Where a skill tree is written, per tool.

## Root

| Tool           | Root                             |
| -------------- | -------------------------------- |
| Claude Code    | `.claude/skills/<name>/`         |
| Cursor         | `.cursor/skills/<name>/`         |
| OpenCode       | `.opencode/skills/<name>/`       |
| GitHub Copilot | `.github/skills/<name>/`         |
| Codex CLI      | `.agents/skills/<name>/`         |
| Antigravity CLI | `.agents/skills/<name>/`        |
| Plugin source  | `plugins/<plugin>/skills/<name>/` |

## Frontmatter

Emit `name` and `description`. Plugin sources retain the input hint defined by `skill-authoring.md`; native targets follow the table below. Keep other metadata only when the target's current official documentation supports it.

| Target | Input guidance | Official source |
| --- | --- | --- |
| Claude Code | Include `argument-hint` when the skill takes input; autocomplete hint | [Frontmatter](https://code.claude.com/docs/en/skills#frontmatter-reference) |
| GitHub Copilot CLI and VS Code | Include `argument-hint` when the skill takes input; invocation hint | [CLI fields](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#skill-frontmatter-fields), [VS Code header](https://code.visualstudio.com/docs/agent-customization/agent-skills#header-required) |
| Cursor | Omit `argument-hint`; no native skill equivalent verified | [Skill metadata](https://cursor.com/docs/skills#frontmatter-fields), [Command fields](https://cursor.com/docs/reference/plugins#command-frontmatter-fields) |
| Codex | Omit `argument-hint` | [Optional metadata](https://learn.chatgpt.com/docs/build-skills#optional-metadata) |
| OpenCode | Omit `argument-hint`; no native skill equivalent verified | [Skill frontmatter](https://opencode.ai/docs/skills#write-frontmatter) |
| Antigravity CLI | Emit only `name` and `description` | - |

Generate no command wrapper only to replace a hint.
