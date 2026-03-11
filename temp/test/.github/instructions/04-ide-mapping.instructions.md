# GitHub Copilot — Syntax Reference

## File Locations

| Content          | Path                                     |
| ---------------- | ---------------------------------------- |
| **Agents**       | `.github/agents/*.agent.md`              |
| **Prompts**      | `.github/prompts/*.prompt.md`            |
| **Instructions** | `.github/instructions/*.instructions.md` |
| **Skills**       | `.github/skills/`                        |
| **Context**      | `.github/copilot-instructions.md`        |

## File Creation Conventions

When creating new files, follow these flat naming conventions (no subfolders):

- **Prompts** (commands): phase-prefixed, hyphenated — `prompts/04-implement.prompt.md`
- **Instructions** (rules): category-prefixed, hyphenated — `instructions/01-rule-writing.instructions.md`
- **Agents**: flat with `.agent.md` suffix — `agents/name.agent.md`
- **Skills**: subfolder per skill — `skills/skill-name/SKILL.md`

## Include Syntax

ALWAYS use relative markdown links to reference other files:

```text
[<display-text>](<relative-path-to-file>)
```

- Depth (`../`) depends on the file's location relative to the target.
- Example from `.github/prompts/`: `[rule](../../aidd_docs/templates/aidd/rule.md)`
- NEVER use `@` syntax, use relative markdown links instead.

## File Extensions

- Agents: `.agent.md`
- Prompts (commands): `.prompt.md`
- Instructions (rules): `.instructions.md`
- Skills: `SKILL.md`

## Frontmatter

### Agents

```yaml
---
name: "<agent-name>"
description: "<required description>"
---
```

### Prompts

```yaml
---
name: "<prompt-name>"
description: "<action-oriented summary>"
argument-hint: "<if applicable>"
---
```

### Instructions

```yaml
---
applyTo: "*.tsx,src/components/**"
---
```

- Use `**` to apply to all files

## MCP Configuration

File: `.vscode/mcp.json`. Servers declared under `servers` key.
