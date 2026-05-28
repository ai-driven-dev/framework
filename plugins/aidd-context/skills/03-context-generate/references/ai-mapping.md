# AI mapping

## Purpose

Map generated context artifacts to the correct AI-specific paths, syntax, file extensions, frontmatter shape, and MCP config.

## AI quick map - content artifacts

| AI             | Agents                      | Commands / Prompts                            | Rules                                    | Skills                                | Context file                      |
| -------------- | --------------------------- | --------------------------------------------- | ---------------------------------------- | ------------------------------------- | --------------------------------- |
| Claude Code    | `.claude/agents/`           | `.claude/commands/`                           | `.claude/rules/`                         | `.claude/skills/`                     | `CLAUDE.md`                       |
| Cursor         | `.cursor/agents/`           | `.cursor/commands/`                           | `.cursor/rules/`                         | `.cursor/skills/`                     | `AGENTS.md`                       |
| OpenCode       | `.opencode/agents/`         | `.opencode/commands/`                         | **Not supported** (fold into AGENTS.md)  | `.opencode/skills/`                   | `AGENTS.md`                       |
| GitHub Copilot | `.github/agents/*.agent.md` | `.github/prompts/*.prompt.md`                 | `.github/instructions/*.instructions.md` | `.github/skills/`                     | `.github/copilot-instructions.md` |
| Codex CLI      | `.codex/agents/{name}.toml` | **Not supported** (Codex CLI does not support custom slash commands; only built-ins) | Not supported (skip rules at install)    | `.agents/skills/aidd-{name}/SKILL.md` | `AGENTS.md`                       |

## Path layout per tool

Rules and commands follow a two-layout scheme. Subdir-tools organize files under named category or phase subdirectories; flat-tools (GitHub Copilot) write all files directly into the surface root with a category or phase index as a filename prefix. Note: OpenCode and Codex CLI do not support a rules surface, so the Subdir layout applies to rules only for Claude Code and Cursor.

| Layout          | Surface   | Tools                                    | Example                                                        |
| --------------- | --------- | ---------------------------------------- | -------------------------------------------------------------- |
| Subdir          | Rules     | Claude Code, Cursor                      | `<rules root>/02-programming-languages/2-typescript-naming.md` |
| Subdir          | Commands  | Claude Code, Cursor, OpenCode            | `<commands root>/10_maintenance/fix-issue.md`                  |
| Flat            | Both      | GitHub Copilot                           | `.github/instructions/02-typescript-naming.instructions.md`    |

For flat-tools, the descriptive slug is the canonical slug with its leading `<n>-` category-index prefix stripped, then prefixed with the full two-digit category or phase index (e.g. canonical slug `2-typescript-naming` in category `02-programming-languages` becomes `02-typescript-naming`).

## Per-surface frontmatter reconciliation

When a frontmatter field is recognized by some tools but not others, apply this rule per field:

| Field                      | Claude | Cursor | OpenCode | Copilot | Codex | Reconciliation when unsupported                              |
| -------------------------- | ------ | ------ | -------- | ------- | ----- | ------------------------------------------------------------ |
| `name`                     | yes    | yes    | derived  | yes     | yes   | OpenCode derives from filename; emit nothing.                |
| `description`              | yes    | yes    | yes      | yes     | yes   | Always emit.                                                 |
| `argument-hint`            | yes    | yes    | n/a      | yes     | stripped | Drop for OpenCode/Codex.                                  |
| `model`                    | yes    | yes    | yes      | yes (agents/prompts) | stripped | Codex strips. Copilot supports it on agents and prompts (not instructions). |
| `effort`                   | yes    | n/a    | n/a      | n/a     | n/a   | Drop for all except Claude.                                  |
| `allowed-tools`            | yes    | yes    | `permission` | `tools` (agents/prompts) | n/a   | OpenCode uses `permission:` (`tools` deprecated legacy). Copilot agents/prompts use `tools`. Drop for Codex. |
| `disable-model-invocation` | yes    | yes    | n/a      | n/a     | n/a   | Preserve intent in the description ("manual-only ..."). Drop the field. |
| `user-invocable`           | yes    | n/a    | n/a      | n/a     | n/a   | Drop. Document intent in description.                        |
| `context: fork`            | yes    | n/a    | n/a      | n/a     | n/a   | Drop. Equivalent OpenCode/Cursor behavior is the subagent model. |
| `agent`                    | yes    | n/a    | n/a      | n/a     | n/a   | Drop.                                                        |
| `hooks`                    | yes    | n/a    | n/a      | n/a     | n/a   | Drop (component-scoped hooks are a Claude-only feature).     |
| `paths`                    | yes (array) | `globs` (comma-separated string) | n/a | `applyTo` (string) | n/a | Rename per target. Cursor `globs` and Copilot `applyTo` are both single glob STRINGs (not arrays): if the canonical artifact has multiple globs in `paths`, join with comma or pick the most-encompassing one. Drop where unsupported. |
| `shell`                    | yes    | n/a    | n/a      | n/a     | n/a   | Drop.                                                        |
| `color`                    | yes    | n/a    | n/a      | n/a     | n/a   | Drop for all except Claude.                                  |

General rule: **drop unsupported fields; never invent a substitute key**. When an intent (e.g. manual-only) is otherwise expressible in the body or description, preserve it there.

## AI quick map - hooks, plugins, marketplaces

| AI             | Hooks                                                                                          | Plugin manifest                  | Marketplace catalog                                                  |
| -------------- | ---------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| Claude Code    | `.claude/settings.json` `hooks` key OR `<plugin>/hooks/hooks.json` OR skill/agent frontmatter | `.claude-plugin/plugin.json`     | `.claude-plugin/marketplace.json`                                    |
| Cursor         | `.cursor/hooks.json` (project), `~/.cursor/hooks.json` (user), `<plugin>/hooks.json` (plugin) | `.cursor-plugin/plugin.json`     | `.cursor-plugin/marketplace.json`                                    |
| OpenCode       | Plugin code only: JS/TS module under `.opencode/plugins/` exports a hooks object              | **Not supported** (see O1 rationale in the OpenCode section below) | None - ecosystem page only                                          |
| GitHub Copilot | Standalone: `.github/hooks/*.json` (workspace), `~/.copilot/hooks` (user), `.claude/settings.json`, agent frontmatter `hooks:`; AND plugin-bundled: `<plugin>/hooks.json` or `<plugin>/hooks/hooks.json`; customize via `chat.hookFilesLocations`. Events PascalCase. | `plugin.json` at plugin root     | `.github/plugin/marketplace.json` (alt `.claude-plugin/marketplace.json`); registered additionally via `chat.plugins.marketplaces` / `extraKnownMarketplaces` (VS Code) or `copilot plugin marketplace add` (CLI) |
| Codex CLI      | `.codex/hooks.json` (project / user) OR `[hooks]` table in `.codex/config.toml`               | `.codex-plugin/plugin.json`      | `.agents/plugins/marketplace.json` (project, personal)               |

### Hook event casing per tool

The same canonical event renders in each tool's required casing. Validate a generated event name against this row.

| Tool           | Casing                                          | Example               |
| -------------- | ----------------------------------------------- | --------------------- |
| Claude Code    | PascalCase                                       | `PreToolUse`          |
| Codex CLI      | PascalCase                                        | `PreToolUse`          |
| Cursor         | camelCase                                         | `preToolUse`          |
| OpenCode       | dotted-lowercase                                 | `tool.execute.before` |
| GitHub Copilot | PascalCase (plugin-bundled, Claude-compatible)   | `PreToolUse`          |

### Plugin and marketplace validator commands

Used by the plugin and marketplace validate actions. When a tool has no validator, fall back to a JSON parse plus the required-key check from that tool's Plugins section below.

| Tool           | Validator command               | Fallback when no validator                                                                 |
| -------------- | ------------------------------- | ------------------------------------------------------------------------------------------ |
| Claude Code    | `claude plugin validate <dir>`  | n/a (validator available)                                                                  |
| Cursor         | none                            | JSON-parse manifest/catalog + required-key check (`name`)                                   |
| Codex CLI      | none                            | JSON-parse + required-key check (`name`, `version`, `description`)                          |
| GitHub Copilot | none                            | JSON-parse `.github/plugin/marketplace.json` + required-key check (`name`, `owner`, `plugins[]`); plugin manifest JSON-parse + `name` (kebab-case, max 64) |
| OpenCode       | D2-blocked                      | n/a (no plugin manifest, no marketplace file)                                               |

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

- Agents:
  - `name`
  - `description`
- Commands:
  - `name`
  - `description`
  - `argument-hint` (if applicable)
- Rules:
  - `paths` (glob list)
  - If `paths` is omitted, rule is always loaded

### MCP config

- File: `.mcp.json` at project root
- Servers declared under a top-level `mcpServers` object key (shape: `{ "mcpServers": { "<name>": {...} } }`)

### Hooks

- Project: `.claude/settings.json` under top-level `hooks` key
- User: `~/.claude/settings.json` (same shape)
- Plugin-bundled: `<plugin>/hooks/hooks.json` (file IS the hooks object)
- Component-scoped: `hooks:` block in a skill or agent frontmatter
- Path env vars available in hook command strings (wrapped as `${VAR}` where the runtime substitutes them): project root, plugin install directory, plugin persistent data directory. See `@hook.md` "Path placeholders in handlers" for the exact variable names and their descriptions.

### Plugins

- Manifest: `.claude-plugin/plugin.json` (OPTIONAL; auto-discovery + name-from-directory; `name` is the only required field when manifest is present)
- Install cache: `~/.claude/plugins/cache/`
- Component slots resolved automatically from default dirs (`skills/`, `agents/`, `commands/`, `hooks/`)

### Marketplaces

- File: `.claude-plugin/marketplace.json` at repo root
- Required: `name`, `owner.name`, `plugins[]`
- Source types: relative path, `github`, `url`, `git-subdir`, `npm`

## Cursor

### File creation conventions

- Commands: phase subfolders, underscore naming (`plugins/aidd-dev/skills/02-implement/SKILL.md`)
- Rules: category subfolders, `.mdc` extension (default; `.md` also valid) (`plugins/aidd-context/skills/04-mermaid/references/mermaid-conventions.mdc`)
- Agents: flat (`agents/name.md`)
- Skills: one subfolder per skill (`skills/skill-name/SKILL.md`)

### Include syntax

- Use `@path/to/file.md` (project-relative)

### File extensions

- Agents: `.md`
- Commands: `.md` (plain Markdown, no frontmatter; name from filename; args via `$ARGUMENTS`)
- Rules: `.mdc` (default; `.md` also valid)
- Skills: `SKILL.md`

### Frontmatter

- Agents:
  - `name` (optional; derived from filename)
  - `description`
  - `model`
  - `readonly`
  - `is_background`
- Commands: plain Markdown, no frontmatter; name from filename; args via `$ARGUMENTS`
- Rules:
  - `description`
  - `globs` (comma-separated string, not an array; join multiple globs with comma)
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
  - Optional: `mode`, `model`, `temperature`, `permission` (`tools` is deprecated; use `permission`)
  - Name is derived from filename
- Commands:
  - `description`
  - Name is derived from filename
  - Use `$ARGUMENTS` or `$1`, `$2` for argument injection

### Rules - Not supported

OpenCode has no per-file rules/ directory. Project conventions belong in `AGENTS.md` (the context file) or the `instructions:` array in `opencode.json` (accepts local paths, globs, and remote URLs). Generators must D2-block on rule x OpenCode with a message: "OpenCode has no rules surface. Add project conventions directly to AGENTS.md or list instruction paths under the `instructions:` array in opencode.json instead."

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
  - `applyTo` (single glob STRING, NOT an array; use `**` for all files; combine multiple globs with commas if needed)

### MCP config

- File: `.vscode/mcp.json`
- Servers declared under `servers`

### Hooks

- Standalone workspace: `.github/hooks/*.json`
- Standalone user: `~/.copilot/hooks`
- Claude-format: `.claude/settings.json`
- Agent frontmatter: `hooks:` field
- Plugin-bundled: `<plugin>/hooks.json` or `<plugin>/hooks/hooks.json`
- Customize locations via `chat.hookFilesLocations`
- Event names are PascalCase

### Plugins

- Manifest: `plugin.json` at plugin root (required field: `name`, kebab-case, max 64 chars)
- Plugin manifest detection order: `.plugin/plugin.json`, `plugin.json`, `.github/plugin/plugin.json`, `.claude-plugin/plugin.json`
- VS Code install path: `~/Library/Application Support/Code/agentPlugins/` (macOS), `~/.config/Code/agentPlugins/` (Linux), `%APPDATA%\Code\agentPlugins\` (Windows)
- CLI install path: `~/.copilot/installed-plugins/` (Copilot CLI-installed plugins)
- Local plugin registration: `chat.pluginLocations` setting maps directory -> boolean (enabled/disabled)
- Cross-format compatibility: the same plugin layout works across VS Code, Copilot CLI, and Claude Code

### Marketplaces

- Catalog file: `.github/plugin/marketplace.json` (also recognized at `.claude-plugin/marketplace.json`). "The only required component of a marketplace."
- Schema: `{ name, owner: { name, email? }, metadata: { description?, version? }, plugins: [ { name, description?, version?, source } ] }` where `source` is a relative path to the plugin dir within the repo.
- Registration (additional, not the only mechanism): settings `chat.plugins.marketplaces` / `extraKnownMarketplaces`, or CLI `copilot plugin marketplace add owner/repo`. Defaults: `github/copilot-plugins`, `github/awesome-copilot`.

## Codex CLI

### File creation conventions

- Agents use TOML (`.codex/agents/{name}.toml`)
- Skills are flat under `.agents/skills/aidd-{name}/SKILL.md`
- Rules are not supported and should be skipped at install

### Commands - Not supported

Codex CLI plugins do not bundle custom slash commands per https://developers.openai.com/codex/plugins/build - only built-in commands exist. Generators must D2-block on command x Codex CLI with a message stating "Codex CLI does not support custom slash commands; use a skill instead if a reusable workflow is needed."

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
- Required keys: `name`, `version`, `description`; optional: `keywords`
- Component slot keys: `skills`, `mcpServers`, `apps`, `hooks` - each a relative path starting with `./`
- Note: manifest uses camelCase `mcpServers` (vs config.toml `[mcp_servers.*]` snake_case)
- Install cache: `~/.codex/plugins/cache/$MARKETPLACE/$PLUGIN/$VERSION/`
- All manifest paths MUST be relative to the plugin root and start with `./`

### Marketplaces

- Project file: `$REPO_ROOT/.agents/plugins/marketplace.json`
- Personal file: `~/.agents/plugins/marketplace.json`
- Legacy fallback: `.claude-plugin/marketplace.json` (still recognized)
- Top-level schema: `{ name (required), interface: { displayName? }, plugins: [...] (required) }`.
- Plugin entry: `{ name (required), source (required), policy?, category? }`.
- `source` accepts: a bare string `"./plugins/x"` (= local), OR `{ source: "local", path: "./..." }`, OR `{ source: "url", url, path?, ref?, sha? }`, OR `{ source: "git-subdir", url, path, ref?, sha? }`.
- `policy`: `{ installation?: NOT_AVAILABLE | AVAILABLE | INSTALLED_BY_DEFAULT (default AVAILABLE), authentication?: ON_INSTALL | ON_USE (default ON_INSTALL) }`. CRITICAL: authentication enum is `ON_INSTALL | ON_USE` (source-verified; the incorrect third variant sometimes cited in unofficial docs does not exist in the authoritative source).
