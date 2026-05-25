# NOTE: synced from skills/03-context-generate/references/ai-mapping.md. Keep in sync when the source changes.

# AI mapping

## Purpose

Where to look for each artifact type per AI tool, for discovery purposes.

## AI quick map - content artifacts

| AI             | Agents                      | Commands / Prompts                            | Rules                                    | Skills                                | Context file                      |
| -------------- | --------------------------- | --------------------------------------------- | ---------------------------------------- | ------------------------------------- | --------------------------------- |
| Claude Code    | `.claude/agents/`           | `.claude/commands/`                           | `.claude/rules/`                         | `.claude/skills/`                     | `CLAUDE.md`                       |
| Cursor         | `.cursor/agents/`           | `.cursor/commands/`                           | `.cursor/rules/`                         | `.cursor/skills/`                     | `AGENTS.md`                       |
| OpenCode       | `.opencode/agents/`         | `.opencode/commands/`                         | **Not supported** (fold into AGENTS.md)  | `.opencode/skills/`                   | `AGENTS.md`                       |
| GitHub Copilot | `.github/agents/*.agent.md` | `.github/prompts/*.prompt.md`                 | `.github/instructions/*.instructions.md` | `.github/skills/`                     | `.github/copilot-instructions.md` |
| Codex CLI      | `.codex/agents/{name}.toml` | **Not supported**                             | Not supported                            | `.agents/skills/aidd-{name}/SKILL.md` | `AGENTS.md`                       |

## AI quick map - hooks, plugins, marketplaces

| AI             | Hooks                                                                                          | Plugin manifest                  | Marketplace catalog                                                  |
| -------------- | ---------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| Claude Code    | `.claude/settings.json` `hooks` key OR `<plugin>/hooks/hooks.json` OR inline in skill/agent header | `.claude-plugin/plugin.json`     | `.claude-plugin/marketplace.json`                                    |
| Cursor         | `.cursor/hooks.json` (project), `~/.cursor/hooks.json` (user), `<plugin>/hooks.json` (plugin) | `.cursor-plugin/plugin.json`     | `.cursor-plugin/marketplace.json`                                    |
| OpenCode       | Plugin code only: JS/TS module under `.opencode/plugins/`                                     | Not supported                    | None                                                                 |
| GitHub Copilot | `<plugin>/hooks.json` OR `<plugin>/hooks/hooks.json` (plugin-bundled only)                    | `plugin.json` at plugin root     | Configured via `chat.plugins.marketplaces` setting; no per-repo file |
| Codex CLI      | `.codex/hooks.json` (project / user) OR `[hooks]` table in `.codex/config.toml`               | `.codex-plugin/plugin.json`      | `.agents/plugins/marketplace.json` (project, personal)               |

## Path layout per tool

Rules and commands follow a two-layout scheme. Subdir-tools organize files under named category or phase subdirectories; flat-tools (GitHub Copilot) write all files directly into the surface root with a category or phase index as a filename prefix.

| Layout          | Surface   | Tools                                    | Example                                                        |
| --------------- | --------- | ---------------------------------------- | -------------------------------------------------------------- |
| Subdir          | Rules     | Claude Code, Cursor                      | `<rules root>/02-programming-languages/2-typescript-naming.md` |
| Subdir          | Commands  | Claude Code, Cursor, OpenCode            | `<commands root>/10_maintenance/fix-issue.md`                  |
| Flat            | Both      | GitHub Copilot                           | `.github/instructions/02-typescript-naming.instructions.md`    |

## Plugin install locations per tool

Where to scan when enumerating installed plugins (not the plugin manifest path inside the plugin tree).

| Tool | Install location(s) |
| ---- | ------------------- |
| Claude Code    | `~/.claude/plugins/cache/` (marketplace-installed); project-local `.claude-plugin/` for plugins committed to the repo |
| Cursor         | `~/.cursor/plugins/local/<plugin>` (local symlink); marketplace install path (managed by Cursor) |
| OpenCode       | `~/.config/opencode/plugins/` (global JS/TS modules); `~/.cache/opencode/node_modules/` (npm-installed); project `.opencode/plugins/` |
| GitHub Copilot | macOS: `~/Library/Application Support/Code/agentPlugins/` ; Linux: `~/.config/Code/agentPlugins/` ; Windows: `%APPDATA%\Code\agentPlugins\` ; CLI-installed: `~/.copilot/installed-plugins/` |
| Codex CLI      | `~/.codex/plugins/cache/$MARKETPLACE/$PLUGIN/$VERSION/` |
