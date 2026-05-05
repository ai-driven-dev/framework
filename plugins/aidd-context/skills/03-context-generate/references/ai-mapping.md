# AI mapping

## Purpose

Map generated context artifacts to the correct AI-specific paths, syntax, file extensions, frontmatter shape, and MCP config.

## AI quick map

| AI             | Agents                      | Commands / Prompts                            | Rules                                    | Skills                                | Context file                      |
| -------------- | --------------------------- | --------------------------------------------- | ---------------------------------------- | ------------------------------------- | --------------------------------- |
| Claude Code    | `.claude/agents/`           | `.claude/commands/`                           | `.claude/rules/`                         | `.claude/skills/`                     | `CLAUDE.md`                       |
| Cursor         | `.cursor/agents/`           | `.cursor/commands/`                           | `.cursor/rules/`                         | `.cursor/skills/`                     | `AGENTS.md`                       |
| OpenCode       | `.opencode/agents/`         | `.opencode/commands/`                         | `.opencode/rules/`                       | `.opencode/skills/`                   | `AGENTS.md`                       |
| GitHub Copilot | `.github/agents/*.agent.md` | `.github/prompts/*.prompt.md`                 | `.github/instructions/*.instructions.md` | `.github/skills/`                     | `.github/copilot-instructions.md` |
| Codex CLI      | `.codex/agents/{name}.toml` | `.agents/skills/aidd-{phase}-{name}/SKILL.md` | Not supported (skip rules at install)    | `.agents/skills/aidd-{name}/SKILL.md` | `AGENTS.md`                       |

## Claude Code

### File creation conventions

- Commands: phase subfolders, underscore naming (`commands/04_code/implement.md`)
- Rules: category subfolders (`rules/01-standards/1-mermaid.md`)
- Agents: flat (`agents/name.md`)
- Skills: one subfolder per skill (`skills/skill-name/SKILL.md`)

### Include syntax

- Use `@path/to/file.md` (project-relative)

### File extensions

- `.md` for all files
- `SKILL.md` for skills

### Frontmatter

- Agents and commands:
  - `name`
  - `description`
  - `argument-hint` (if applicable)
- Rules:
  - `paths` (glob list)
  - If `paths` is omitted, rule is always loaded

### MCP config

- File: `.mcp.json` at project root
- Servers declared at root level

## Cursor

### File creation conventions

- Commands: phase subfolders, underscore naming (`commands/04_code/implement.md`)
- Rules: category subfolders, `.mdc` extension (`rules/01-standards/1-mermaid.mdc`)
- Agents: flat (`agents/name.md`)
- Skills: one subfolder per skill (`skills/skill-name/SKILL.md`)

### Include syntax

- Use `@path/to/file.md` (project-relative)

### File extensions

- Agents: `.md`
- Commands: `.md`
- Rules: `.mdc`
- Skills: `SKILL.md`

### Frontmatter

- Agents and commands:
  - `name`
  - `description`
  - `argument-hint` (if applicable)
- Rules:
  - `description`
  - `globs`
  - `alwaysApply`

### MCP config

- File: `.cursor/mcp.json`
- Servers declared under `mcpServers`

## OpenCode

### File creation conventions

- Commands: phase subfolders, underscore naming (`commands/04_code/implement.md`)
- Rules: category subfolders (`rules/01-standards/1-mermaid.md`)
- Agents: flat (`agents/name.md`)
- Skills: one subfolder per skill (`skills/skill-name/SKILL.md`)

### Include syntax

- Use `@path/to/file.md` (project-relative)

### File extensions

- `.md` for all files
- `SKILL.md` for skills

### Frontmatter

- Agents:
  - `description`
  - Optional: `mode`, `model`, `temperature`, `tools`, `permission`
  - Name is derived from filename
- Commands:
  - `description`
  - Name is derived from filename
  - Use `$ARGUMENTS` or `$1`, `$2` for argument injection
- Rules:
  - No frontmatter

### MCP config

- File: `opencode.json` at project root
- MCP servers declared under `mcp`

## GitHub Copilot

### File creation conventions

- Prompts (commands): flat, phase-prefixed, hyphenated (`prompts/04-implement.prompt.md`)
- Instructions (rules): flat, category-prefixed, hyphenated (`instructions/01-rule-writing.instructions.md`)
- Agents: flat, `.agent.md` suffix (`agents/name.agent.md`)
- Skills: one subfolder per skill (`skills/skill-name/SKILL.md`)

### Include syntax

- Use relative markdown links: `[label](relative/path.md)`
- Never use `@path` syntax

### File extensions

- Agents: `.agent.md`
- Prompts: `.prompt.md`
- Instructions: `.instructions.md`
- Skills: `SKILL.md`

### Frontmatter

- Agents:
  - `name`
  - `description`
- Prompts:
  - `name`
  - `description`
  - `argument-hint` (if applicable)
- Instructions:
  - `applyTo` (use `**` for all files)

### MCP config

- File: `.vscode/mcp.json`
- Servers declared under `servers`

## Codex CLI

### File creation conventions

- Commands are installed as phase-prefixed skills (`aidd-{phase}-{name}/SKILL.md`)
- Agents use TOML (`.codex/agents/{name}.toml`)
- Skills are flat under `.agents/skills/aidd-{name}/SKILL.md`
- Rules are not supported and should be skipped at install

### Include syntax

- Native `@path` resolution is not supported
- AIDD expands references at install time using marker blocks:
  - `<!-- aidd:expand:start @path/to/file.md -->`
  - `...expanded content...`
  - `<!-- aidd:expand:end -->`
- Use `reverseAtPaths` to strip markers and restore `@path` refs

### File extensions

- Skills and commands: `.md` (`SKILL.md`)
- Agents: `.toml`

### Frontmatter

- Skills and command-skills:
  - `name`
  - `description`
- `argument-hint`, `model`, `docs` are stripped at install
- Agent frontmatter fields become top-level TOML keys
- Agent body becomes `developer_instructions`

### MCP config

- File: `.codex/config.toml` with `[mcp_servers.*]`
- Hooks: `.codex/hooks.json` under `SessionStart`
