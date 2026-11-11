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
| Kilo native    | `.kilo/skills/<name>/`           |
| Kilo portable  | `.agents/skills/<name>/`         |
| Plugin source  | `plugins/<plugin>/skills/<name>/` |

## Frontmatter

Emit `description` always, `name` only where listed, drop the rest.

| Tool                   | Fields                                                                 |
| ---------------------- | --------------------------------------------------------------------- |
| Claude Code            | `name`, `description`, opt `allowed-tools`, `disable-model-invocation` |
| Cursor, GitHub Copilot | `name`, `description`, opt `allowed-tools`                             |
| OpenCode               | `description`, opt `permission` map                                   |
| Codex CLI              | `name`, `description` (strips the rest)                                |
| Antigravity CLI        | `name`, `description`                                                  |
| Kilo                  | `name`, `description`, optional `license`, `compatibility`, `metadata` |

For Kilo, the skill name must match its parent directory, use lowercase letters, digits and single hyphens, and contain at most 64 characters. The description must be nonempty and at most 1024 characters. Omit `argument-hint` and Claude-only fields. Native and portable paths are both loader-compatible; compatibility does not authorize copying. Require explicit user agreement before choosing `.agents/skills/`, and never write the same skill to both locations.

Kilo source: [Skills](https://kilo.ai/docs/customize/skills), verified 2026-09-25.
