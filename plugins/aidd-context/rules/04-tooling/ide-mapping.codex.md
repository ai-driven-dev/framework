---
description: Codex CLI file locations, path mapping, and AIDD install-time @path expansion. Apply when creating or configuring Codex-specific files.
alwaysApply: false
---

# Codex CLI — Syntax Reference

## File Locations

| Content      | Path                                          |
| ------------ | --------------------------------------------- |
| **Agents**   | `.codex/agents/{name}.toml`                   |
| **Commands** | `.agents/skills/aidd-{phase}-{name}/SKILL.md` |
| **Rules**    | (not supported — skipped at install)          |
| **Skills**   | `.agents/skills/aidd-{name}/SKILL.md`         |
| **Context**  | `AGENTS.md`                                   |

## File Creation Conventions

- **Commands**: installed as phase-prefixed skills — `aidd-{phase}-{name}/SKILL.md`
- **Agents**: TOML format — frontmatter fields become top-level TOML keys; body becomes `developer_instructions`
- **Skills**: flat under `.agents/skills/aidd-{name}/SKILL.md`

## Include Syntax

Codex does not resolve `@path` refs natively. AIDD expands them at install time using marker blocks:

```text
<!-- aidd:expand:start @path/to/file.md -->
<expanded content>
<!-- aidd:expand:end -->
```

To sync back: run `reverseAtPaths` to strip markers and restore `@path` refs.

## File Extensions

- Skills and commands: `.md` extension, `SKILL.md` filename
- Agents: `.toml` extension

## Frontmatter

### Skills

```yaml
---
name: <slug>
description: <action-oriented summary>
---
```

- `argument-hint`, `model`, `docs` are stripped at install time

### Commands (installed as skills)

```yaml
---
name: <slug>
description: <action-oriented summary>
---
```

- No `argument-hint` field

## MCP Configuration

File: `.codex/config.toml` under `[mcp_servers.*]` tables.
Hooks registered in `.codex/hooks.json` under `SessionStart`.
