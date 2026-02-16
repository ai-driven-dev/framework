---
description: Cursor file locations, syntax and frontmatter reference
globs: ["**/*.md", "**/*.mdc"]
---

# Cursor — Syntax Reference

## File Locations

| Content      | Path                |
| ------------ | ------------------- |
| **Agents**   | `.cursor/agents/`   |
| **Commands** | `.cursor/commands/` |
| **Rules**    | `.cursor/rules/`    |
| **Skills**   | `.cursor/skills/`   |
| **Context**  | `AGENTS.md`         |

## File Creation Conventions

When creating new files, follow these naming and structure conventions:

- **Commands**: phase subfolders with underscore naming — `commands/04_code/implement.md`
- **Rules**: category subfolders, `.mdc` extension — `rules/01-standards/1-mermaid.mdc`
- **Agents**: flat — `agents/name.md`
- **Skills**: subfolder per skill — `skills/skill-name/SKILL.md`

## Include Syntax

```text
@path/to/file.md
```

Works with any project-relative path.

## File Extensions

- Agents: `.md`
- Commands: `.md`
- Rules: `.mdc`
- Skills: `SKILL.md`

## Frontmatter

### Agents and Commands

```yaml
---
name: <slug>
description: <action-oriented summary>
argument-hint: <if applicable>
---
```

### Rules

```yaml
---
description: <when this rule applies>
globs: ["*.tsx", "src/components/**"]
alwaysApply: false
---
```

- `description` is displayed in Cursor's rule list
- `globs` activates the rule only for matching files
- `alwaysApply: true` makes the rule active for all files

## MCP Configuration

File: `.cursor/mcp.json`. Servers declared under `mcpServers` key.
