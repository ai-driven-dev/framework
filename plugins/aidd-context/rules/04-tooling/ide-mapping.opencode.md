---
description: OpenCode file locations, syntax, frontmatter, and configuration reference. Apply when creating or configuring OpenCode-specific files.
alwaysApply: false
---

# OpenCode — Syntax Reference

## File Locations

| Content      | Path                  |
| ------------ | --------------------- |
| **Agents**   | `.opencode/agents/`   |
| **Commands** | `.opencode/commands/` |
| **Rules**    | `.opencode/rules/`    |
| **Skills**   | `.opencode/skills/`   |
| **Context**  | `AGENTS.md`           |

## File Creation Conventions

When creating new files, follow these naming and structure conventions:

- **Commands**: phase subfolders with underscore naming — `commands/04_code/implement.md`
- **Rules**: category subfolders — `rules/01-standards/1-mermaid.md`
- **Agents**: flat — `agents/name.md`
- **Skills**: subfolder per skill — `skills/skill-name/SKILL.md`

## Include Syntax

```text
@path/to/file.md
```

Works with any project-relative path.

## File Extensions

All files use `.md` extension. Skills use `SKILL.md`.

## Frontmatter

### Agents

```yaml
---
description: <action-oriented summary>
---
```

- The agent name is derived from the filename, not the frontmatter
- Optional: `mode`, `model`, `temperature`, `tools`, `permission`

### Commands

```yaml
---
description: <action-oriented summary>
---
```

- The command name is derived from the filename
- Use `$ARGUMENTS` or `$1`, `$2`... for argument injection

### Rules

Rules have no frontmatter — they are always active when loaded via `opencode.json`.

## MCP Configuration

File: `opencode.json` at project root, under the `mcp` key.
