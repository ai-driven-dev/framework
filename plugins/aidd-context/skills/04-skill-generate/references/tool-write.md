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

| Target | Input guidance | Official source, read 2026-11-03 |
| --- | --- | --- |
| Claude Code | Include `argument-hint` when the skill takes input; autocomplete hint | [Frontmatter](https://code.claude.com/docs/en/skills#frontmatter-reference) |
| GitHub Copilot CLI and VS Code | Include `argument-hint` when the skill takes input; invocation hint | [CLI fields](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#skill-frontmatter-fields), [VS Code header](https://code.visualstudio.com/docs/agent-customization/agent-skills#header-required) |
| Cursor | Omit `argument-hint`; no native skill equivalent verified | [Skill metadata](https://cursor.com/docs/skills#frontmatter-fields), [Command fields](https://cursor.com/docs/reference/plugins#command-frontmatter-fields) |
| Codex | Omit `argument-hint`; optional `agents/openai.yaml` → `interface.default_prompt` supplies a suggested invocation prompt, not an argument hint | [Optional metadata](https://learn.chatgpt.com/docs/build-skills#optional-metadata) |
| OpenCode 1 | Omit `argument-hint`; unknown fields are ignored, and no native skill equivalent is verified | [Skill frontmatter](https://opencode.ai/docs/skills#write-frontmatter) |
| OpenCode 2 | Omit `argument-hint`; support and a native skill equivalent remain unverified | [Skill frontmatter](https://dev.opencode.ai/v2/docs/skills/#frontmatter) |

Codex's optional prompt is a short example mentioning `$skill-name`; availability across every Codex interface is unverified. See the [field reference](https://github.com/openai/skills/blob/main/skills/.system/skill-creator/references/openai_yaml.md), read 2026-11-03.

OpenCode's command descriptions and `$ARGUMENTS` or positional substitution are separate features, not skill hints. Keep expected inputs in the skill's Input sections; do not generate a command wrapper solely to replace a hint. Sources read 2026-11-03: [v1 arguments](https://opencode.ai/docs/commands/#arguments), [v1 description](https://opencode.ai/docs/commands/#description), [v2 command fields](https://dev.opencode.ai/v2/docs/commands/#fields).

These are generation rules for native targets, not a description of what a separate distribution translator preserves.
