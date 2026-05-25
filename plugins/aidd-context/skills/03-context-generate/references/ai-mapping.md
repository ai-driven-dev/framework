# AI mapping

## Purpose

Map generated context artifacts to the correct AI-specific paths, syntax, file extensions, frontmatter shape, and MCP config.

## AI quick map - content artifacts

| AI             | Agents                      | Commands / Prompts                            | Rules                                    | Skills                                | Context file                      |
| -------------- | --------------------------- | --------------------------------------------- | ---------------------------------------- | ------------------------------------- | --------------------------------- |
| Claude Code    | `.claude/agents/`           | `.claude/commands/`                           | `.claude/rules/`                         | `.claude/skills/`                     | `CLAUDE.md`                       |
| Cursor         | `.cursor/agents/`           | `.cursor/commands/`                           | `.cursor/rules/`                         | `.cursor/skills/`                     | `AGENTS.md`                       |
| OpenCode       | `.opencode/agents/`         | `.opencode/commands/`                         | `.opencode/rules/`                       | `.opencode/skills/`                   | `AGENTS.md`                       |
| GitHub Copilot | `.github/agents/*.agent.md` | `.github/prompts/*.prompt.md`                 | `.github/instructions/*.instructions.md` | `.github/skills/`                     | `.github/copilot-instructions.md` |
| Codex CLI      | `.codex/agents/{name}.toml` | `.agents/skills/aidd-{phase}-{name}/SKILL.md` (fallback: `.agents/skills/aidd-{name}/SKILL.md` when the command has no SDLC phase) | Not supported (skip rules at install)    | `.agents/skills/aidd-{name}/SKILL.md` | `AGENTS.md`                       |

## Path layout per tool

Rules and commands follow a two-layout scheme. Subdir-tools (Claude Code, Cursor, OpenCode, Codex CLI) organize files under named category or phase subdirectories; flat-tools (GitHub Copilot) write all files directly into the surface root with a category or phase index as a filename prefix.

| Layout     | Tools                                        | Rules example                                                  | Commands example                                        |
| ---------- | -------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| Subdir     | Claude Code, Cursor, OpenCode, Codex CLI     | `<rules root>/02-programming-languages/2-typescript-naming.md` | `<commands root>/10_maintenance/fix-issue.md`           |
| Flat       | GitHub Copilot                               | `.github/instructions/02-typescript-naming.instructions.md`    | `.github/prompts/10-fix-issue.prompt.md`                |

For flat-tools, the descriptive slug is the canonical slug with its leading `<n>-` category-index prefix stripped, then prefixed with the full two-digit category or phase index (e.g. canonical slug `2-typescript-naming` in category `02-programming-languages` becomes `02-typescript-naming`).

## Per-surface frontmatter reconciliation

When a frontmatter field is recognized by some tools but not others, apply this rule per field:

| Field                      | Claude | Cursor | OpenCode | Copilot | Codex | Reconciliation when unsupported                              |
| -------------------------- | ------ | ------ | -------- | ------- | ----- | ------------------------------------------------------------ |
| `name`                     | yes    | yes    | derived  | yes     | yes   | OpenCode derives from filename; emit nothing.                |
| `description`              | yes    | yes    | yes      | yes     | yes   | Always emit.                                                 |
| `argument-hint`            | yes    | yes    | n/a      | yes     | stripped | Drop for OpenCode/Codex.                                  |
| `model`                    | yes    | yes    | yes      | n/a     | stripped | Drop for Copilot/Codex.                                   |
| `effort`                   | yes    | n/a    | n/a      | n/a     | n/a   | Drop for all except Claude.                                  |
| `allowed-tools`            | yes    | yes    | `tools`  | n/a     | n/a   | OpenCode uses `tools:` list; drop for Copilot/Codex.        |
| `disable-model-invocation` | yes    | yes    | n/a      | n/a     | n/a   | Preserve intent in the description ("manual-only ..."). Drop the field. |
| `user-invocable`           | yes    | n/a    | n/a      | n/a     | n/a   | Drop. Document intent in description.                        |
| `context: fork`            | yes    | n/a    | n/a      | n/a     | n/a   | Drop. Equivalent OpenCode/Cursor behavior is the subagent model. |
| `agent`                    | yes    | n/a    | n/a      | n/a     | n/a   | Drop.                                                        |
| `hooks`                    | yes    | n/a    | n/a      | n/a     | n/a   | Drop (component-scoped hooks are a Claude-only feature).     |
| `paths`                    | yes    | `globs` | n/a     | `applyTo` | n/a | Rename per target; drop where unsupported.                  |
| `shell`                    | yes    | n/a    | n/a      | n/a     | n/a   | Drop.                                                        |

General rule: **drop unsupported fields; never invent a substitute key**. When an intent (e.g. manual-only) is otherwise expressible in the body or description, preserve it there.

## AI quick map - hooks, plugins, marketplaces

| AI             | Hooks                                                                                          | Plugin manifest                  | Marketplace catalog                                                  |
| -------------- | ---------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| Claude Code    | `.claude/settings.json` `hooks` key OR `<plugin>/hooks/hooks.json` OR skill/agent frontmatter | `.claude-plugin/plugin.json`     | `.claude-plugin/marketplace.json`                                    |
| Cursor         | `.cursor/hooks.json` (project), `~/.cursor/hooks.json` (user), `<plugin>/hooks.json` (plugin) | `.cursor-plugin/plugin.json`     | `.cursor-plugin/marketplace.json`                                    |
| OpenCode       | Plugin code only: JS/TS module under `.opencode/plugins/` exports a hooks object              | **Not supported** (see O1 rationale in the OpenCode section below) | None - ecosystem page only                                          |
| GitHub Copilot | `<plugin>/hooks.json` OR `<plugin>/hooks/hooks.json` (plugin-bundled only)                    | `plugin.json` at plugin root     | Configured via `chat.plugins.marketplaces` setting; no per-repo file |
| Codex CLI      | `.codex/hooks.json` (project / user) OR `[hooks]` table in `.codex/config.toml`               | `.codex-plugin/plugin.json`      | `.agents/plugins/marketplace.json` (project, personal)               |

## Claude Code

### File creation conventions

- Commands: phase subfolders, underscore naming (`plugins/aidd-dev/skills/02-implement/SKILL.md`)
- Rules: category subfolders (`plugins/aidd-context/skills/04-mermaid/references/mermaid-conventions.md`)
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

### Hooks

- Project: `.claude/settings.json` under top-level `hooks` key
- User: `~/.claude/settings.json` (same shape)
- Plugin-bundled: `<plugin>/hooks/hooks.json` (file IS the hooks object)
- Component-scoped: `hooks:` block in a skill or agent frontmatter
- Path env vars: `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`

### Plugins

- Manifest: `.claude-plugin/plugin.json` (required field: `name`)
- Install cache: `~/.claude/plugins/cache/`
- Component slots resolved automatically from default dirs (`skills/`, `agents/`, `commands/`, `hooks/`)

### Marketplaces

- File: `.claude-plugin/marketplace.json` at repo root
- Required: `name`, `owner.name`, `plugins[]`
- Source types: relative path, `github`, `url`, `git-subdir`, `npm`

## Cursor

### File creation conventions

- Commands: phase subfolders, underscore naming (`plugins/aidd-dev/skills/02-implement/SKILL.md`)
- Rules: category subfolders, `.mdc` extension (`plugins/aidd-context/skills/04-mermaid/references/mermaid-conventions.mdc`)
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

### Hooks

- Project: `.cursor/hooks.json` (top-level `{ "version": 1, "hooks": {...} }`)
- User: `~/.cursor/hooks.json`
- Plugin-bundled: `<plugin>/hooks.json` (or `<plugin>/hooks/hooks.json`)
- Event names diverge slightly from Claude (camelCase, e.g. `preToolUse`, `postToolUse`, `sessionStart`, `beforeShellExecution`, `afterFileEdit`)
- Handlers: spawned processes communicating over stdio with JSON in both directions; exit code 2 = block, 0 = success

### Plugins

- Manifest: `.cursor-plugin/plugin.json` (required field: `name`)
- Auto-discovery from default dirs (`rules/`, `skills/`, `agents/`, `commands/`, `hooks/`); manifest can override per-component paths

### Marketplaces

- Single-repo file: `.cursor-plugin/marketplace.json` (lists multiple plugins, each with its own `.cursor-plugin/plugin.json`)
- Submission: `cursor.com/marketplace/publish` after hosting in a public Git repo

## OpenCode

### File creation conventions

- Commands: phase subfolders, underscore naming (`plugins/aidd-dev/skills/02-implement/SKILL.md`)
- Rules: category subfolders (`plugins/aidd-context/skills/04-mermaid/references/mermaid-conventions.md`)
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

### Hooks

- No standalone `hooks.json`. Hooks are exported from inside a plugin JS/TS module
- Plugin layout: project `.opencode/plugins/` or global `~/.config/opencode/plugins/`
- The plugin function returns a hooks object keyed by event name (e.g. `tool.execute.before`, `session.created`, `permission.asked`, `file.edited`)
- Generator must produce a JS/TS file, not a JSON descriptor

### Plugins

**Not supported (O1 block).** OpenCode has no plugin manifest format and no slot tree. A plugin is a single JS/TS module, not a collection of declarative files. This skill scaffolds declarative file sets, which have no direct equivalent here.

Block message: "Plugin scaffold for OpenCode is not supported: OpenCode has no plugin manifest and no slot tree. A plugin is a single JS/TS module. Place skills or agents directly under `.opencode/`, or publish an npm package."

- Registration for JS/TS plugins: drop a file under `.opencode/plugins/` (project) or `~/.config/opencode/plugins/` (global), or list an npm package under `plugin: ["pkg-name"]` in `opencode.json`.
- Cache for npm-installed plugins: `~/.cache/opencode/node_modules/`

### Marketplaces

- No marketplace file format. Discovery via the OpenCode ecosystem page only

## GitHub Copilot

### File creation conventions

- Prompts (commands): flat, phase-prefixed, hyphenated (`prompts/04-implement.prompt.md`)
- Instructions (rules): flat, category-prefixed, hyphenated (`instructions/01-rule-writing.instructions.md`)
- Agents: flat, `.agent.md` suffix (`agents/name.agent.md`)
- Skills: one subfolder per skill (`skills/skill-name/SKILL.md`)

### Include syntax

- Use relative markdown links - for example `[label]` then `(relative/path.md)`
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

### Hooks

- Plugin-bundled only: `<plugin>/hooks.json` at plugin root OR `<plugin>/hooks/hooks.json`
- No standalone user / project / workspace scope - hooks must ship inside a plugin
- Path resolution at runtime checks (in order): `.plugin/plugin.json`, `plugin.json`, `.github/plugin/plugin.json`, `.claude-plugin/plugin.json`

### Plugins

- Manifest: `plugin.json` at plugin root (required field: `name`, kebab-case, max 64 chars)
- VS Code install path: `~/Library/Application Support/Code/agentPlugins/github.com/{org}/{repo}` (macOS), `~/.config/Code/agentPlugins/...` (Linux), `%APPDATA%\Code\agentPlugins\...` (Windows)
- Local plugin registration: `chat.pluginLocations` setting maps directory -> boolean (enabled/disabled)
- Cross-format compatibility: the same plugin layout works across VS Code, Copilot CLI, and Claude Code

### Marketplaces

- No per-repo `marketplace.json`. Marketplaces are Git repos referenced from settings
- Setting: `chat.plugins.marketplaces` accepts shorthand (`owner/repo`), HTTPS, SSH, or `file://` paths
- Defaults: `copilot-plugins` and `awesome-copilot` (GitHub)

## Codex CLI

### File creation conventions

- Commands are installed as phase-prefixed skills (`aidd-{phase}-{name}/SKILL.md`). When the command has no SDLC phase, drop the phase segment and use `aidd-{name}/SKILL.md` (same shape as plain skills).
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

### Hooks

- Two equivalent surfaces, merged across layers:
  - JSON: `.codex/hooks.json` (project) and `~/.codex/hooks.json` (user)
  - TOML: inline `[hooks]` table inside `.codex/config.toml`
- Plugin-bundled: `<plugin>/hooks/hooks.json` referenced from the plugin manifest
- Supported handler types: `command` (only one fully implemented today; `prompt` and `agent` parse but no-op)
- Turn-scoped events include a `turn_id` field in the stdin payload (Codex-specific extension)

### Plugins

- Manifest: `.codex-plugin/plugin.json` at plugin root
- Required keys: `name`, `version`, `description`
- Component slot keys: `skills`, `mcpServers`, `apps`, `hooks` - each a relative path starting with `./`
- Install cache: `~/.codex/plugins/cache/$MARKETPLACE/$PLUGIN/$VERSION/`
- All manifest paths MUST be relative to the plugin root and start with `./`

### Marketplaces

- Project file: `$REPO_ROOT/.agents/plugins/marketplace.json`
- Personal file: `~/.agents/plugins/marketplace.json`
- Legacy fallback: `.claude-plugin/marketplace.json` (still recognized)
- Schema differs from Claude/Cursor: `{ name, interface: { displayName }, plugins: [ { name, source: { source: "local" | ..., path }, policy: { installation, authentication }, category } ] }`
