# AI mapping (explore scan paths)

Scan only.

## Presence signal

- Prefer declared tools or the AIDD manifest to scan hints.
- Shared `AGENTS.md` and `.agents/` do not identify a host; report ambiguous ownership.

## AI quick map - content artifacts

| AI             | Agents                      | Commands / Prompts                            | Rules                                    | Skills                                | Context file                      |
| -------------- | --------------------------- | --------------------------------------------- | ---------------------------------------- | ------------------------------------- | --------------------------------- |
| Claude Code    | `.claude/agents/`           | `.claude/commands/`                           | `.claude/rules/`                         | `.claude/skills/`                     | `CLAUDE.md`                       |
| Cursor         | `.cursor/agents/`           | `.cursor/commands/`                           | `.cursor/rules/`                         | `.cursor/skills/`                     | `AGENTS.md`                       |
| OpenCode       | `.opencode/agents/`         | `.opencode/commands/`                         | `aidd_docs/rules/` (canonical sources); shared `aidd_rules` contribution in root `AGENTS.md`  | `.opencode/skills/`                   | `AGENTS.md`                       |
| GitHub Copilot | `.github/agents/*.agent.md` | `.github/prompts/*.prompt.md`                 | `.github/instructions/*.instructions.md` | `.github/skills/`                     | `.github/copilot-instructions.md` |
| Codex CLI      | `.codex/agents/{name}.toml` | **Not supported**                             | `aidd_docs/rules/` (canonical sources); shared `aidd_rules` contribution in root `AGENTS.md`, not execution policies | `.agents/skills/aidd-{name}/SKILL.md` | `AGENTS.md`                       |
| Antigravity CLI | `.agents/agents/{name}/agent.md` | Not mapped                          | `.agents/rules/<slug>.md`, flat         | `.agents/skills/aidd-{name}/SKILL.md` | `AGENTS.md`                       |

## AI quick map - hooks, plugins

| AI             | Hooks                                                                                          | Plugin manifest              |
| -------------- | ---------------------------------------------------------------------------------------------- | ---------------------------- |
| Claude Code    | `.claude/settings.json` `hooks` key OR `<plugin>/hooks/hooks.json` OR inline in skill/agent header | `.claude-plugin/plugin.json` |
| Cursor         | `.cursor/hooks.json` (project), `~/.cursor/hooks.json` (user), `<plugin>/hooks/hooks.json` (plugin) | `.cursor-plugin/plugin.json` |
| OpenCode       | JS/TS module under `.opencode/plugins/` (parse as JS, not JSON)                                | Not supported                |
| GitHub Copilot | `.github/hooks/*.json` (workspace), `~/.copilot/hooks` (user), `<plugin>/hooks.json` or `<plugin>/hooks/hooks.json` (plugin) | `plugin.json` at plugin root |
| Codex CLI      | `.codex/hooks.json` (project / user) OR `[hooks]` table in `.codex/config.toml`               | `.codex-plugin/plugin.json`  |
| Antigravity CLI | `.agents/hooks.json` (project), keyed by hook name                                            | Not mapped |

## MCP config per tool

| Tool           | MCP config file                                  | Servers key   |
| -------------- | ------------------------------------------------ | ------------- |
| Claude Code    | `.mcp.json` (project root)                       | `mcpServers`  |
| Cursor         | `.cursor/mcp.json`                               | `mcpServers`  |
| OpenCode       | `opencode.json` or `opencode.jsonc`                                  | `mcp`         |
| GitHub Copilot | `.vscode/mcp.json` (VS Code); `~/.copilot/mcp-config.json` (CLI) | `servers` (VS Code); `mcpServers` (CLI) |
| Codex CLI      | `.codex/config.toml`                             | `[mcp_servers.*]` |

## Path layout per tool

| Layout          | Surface   | Tools                                    | Example                                                        |
| --------------- | --------- | ---------------------------------------- | -------------------------------------------------------------- |
| Subdir          | Rules     | Claude Code, Cursor; canonical Codex/OpenCode sources                      | `<rules root>/02-programming-languages/2-typescript-naming.md` |
| Subdir          | Commands  | Claude Code, Cursor, OpenCode            | `<commands root>/10_maintenance/fix-issue.md`                  |
| Flat            | Both      | GitHub Copilot                           | `.github/instructions/02-typescript-naming.instructions.md`    |

## Plugin install locations per tool

| Tool | Install location(s) |
| ---- | ------------------- |
| Claude Code    | `~/.claude/plugins/cache/` (marketplace-installed); project-local `.claude-plugin/` for plugins committed to the repo |
| Cursor         | `~/.cursor/plugins/local/<plugin>` (local symlink); marketplace install path (managed by Cursor) |
| OpenCode       | `~/.config/opencode/plugins/` (global JS/TS modules); `~/.cache/opencode/node_modules/` (npm-installed); project `.opencode/plugins/` |
| GitHub Copilot | macOS: `~/Library/Application Support/Code/agentPlugins/` ; Linux: `~/.config/Code/agentPlugins/` ; Windows: `%APPDATA%\Code\agentPlugins\` ; CLI-installed: `~/.copilot/installed-plugins/` |
| Codex CLI      | `~/.codex/plugins/cache/$MARKETPLACE/$PLUGIN/$VERSION/` |
