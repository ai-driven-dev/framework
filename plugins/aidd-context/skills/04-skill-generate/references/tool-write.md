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
| Plugin source  | `plugins/<plugin>/skills/<name>/` |

## Frontmatter

Emit `name` and `description`. Plugin sources retain the input hint defined by `skill-authoring.md`; native targets follow the table below. Keep other metadata only when the target's current official documentation supports it.

| Target | `argument-hint` policy | Official source, read 2026-11-03 |
| --- | --- | --- |
| Claude Code | Include when the skill takes input; documented autocomplete hint | [Frontmatter](https://code.claude.com/docs/en/skills#frontmatter-reference) |
| GitHub Copilot CLI and VS Code | Include when the skill takes input; documented invocation hint | [CLI fields](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#skill-frontmatter-fields), [VS Code header](https://code.visualstudio.com/docs/agent-customization/agent-skills#header-required) |
| Cursor | Omit; support is undocumented and unverified | [Skill metadata](https://cursor.com/docs/skills#frontmatter-fields) |
| Codex | Omit; support in skills is undocumented and unverified | [Build skills](https://learn.chatgpt.com/docs/build-skills) |
| OpenCode 1 | Omit; unknown frontmatter fields are ignored | [Skill frontmatter](https://opencode.ai/docs/skills#write-frontmatter) |
| OpenCode 2 | Omit; support is undocumented and unverified | [Skill frontmatter](https://dev.opencode.ai/v2/docs/skills/#frontmatter) |

These are generation rules for native targets, not a description of what a separate distribution translator preserves.
