---
description: 'Claude Code file locations, syntax, frontmatter, and include patterns reference. Apply when creating or configuring Claude-specific files.'
---

# Claude Code — Syntax Reference

## File Locations

| Content      | Path                |
| ------------ | ------------------- |
| **Agents**   | `.claude/agents/`   |
| **Commands** | `.claude/commands/` |
| **Rules**    | `.claude/rules/`    |
| **Skills**   | `.claude/skills/`   |
| **Context**  | `CLAUDE.md`         |

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
paths:
  - "src/api/**/*.ts"
  - "src/components/**/*.tsx"
---
```

- `paths` scopes the rule to matching files (glob patterns supported)
- Rules without `paths` are always loaded (apply to all files)

## MCP Configuration

File: `.mcp.json` at project root. Servers declared at root level (no wrapper key).
