# CLI Coordination — Phase 0 Findings

## Framework Structure Assumptions in CLI Code

### 1. framework-loader-adapter.ts — Hard-coded framework paths

File: `src/infrastructure/adapters/framework-loader-adapter.ts`

Current hard-coded paths that map to the flat framework layout:

```
CONTENT_SECTIONS:
  agents/         → directory scan, no entry file
  commands/       → directory scan, no entry file
  rules/          → directory scan, no entry file
  skills/         → directory scan, entry file = SKILL.md

TEMPLATE_REFS:
  aidd_docs/templates/AGENTS.md

CONFIG_REFS:
  config/mcp.json           (line 30) ← CHANGES IN PLUGIN ERA
  config/vscode/extensions.json
  config/vscode/keybindings.json
  config/vscode/settings.json
  config/copilot/settings.json
  config/.opencode/opencode.json
  config/codex/hooks.json   (line 40) ← CHANGES IN PLUGIN ERA

SCRIPT_REFS:
  config/scripts/update_memory.js  (line 44) ← MOVES TO aidd-context PLUGIN
```

Impact assessment:
- `config/mcp.json` → will split to per-plugin `.mcp.json` files. CLI must merge multiple `.mcp.json` files at install time. The `FrameworkLoaderAdapter` currently reads ONE `mcp.json`; it will need to aggregate from all installed plugins OR the framework-level `config/mcp.json` stays as the aggregate and per-plugin `.mcp.json` files are handled at plugin install time (the latter is current behavior — plugin `.mcp.json` is merged at `plugin add` time, not framework install time). No change needed if the framework keeps its own `config/mcp.json`.
- `config/codex/hooks.json` → currently empty `{}`. If hooks move to `aidd-context` plugin, `FrameworkLoaderAdapter` would need to NOT read this path. But since the current value is empty, no behavioral change until the plugin is installed.
- `config/scripts/update_memory.js` → this is a SessionStart hook script installed into user projects. If it moves to `plugins/aidd-context/hooks/`, the CLI plugin installation pipeline would handle it instead of the framework loader. The `FrameworkLoaderAdapter` `SCRIPT_REFS` entry would be removed.

### 2. plugin-distribution-reader-adapter.ts — Component file filtering

`isComponentFile()` passes through files whose top-level segment is:
- `skills` ← bracket-named subdirs are transparent (confirmed)
- `commands`
- `agents`
- `rules`
- `hooks` (only `hooks/hooks.json`)
- `.mcp.json`

No changes needed for bracket-named skills. The plugin install pipeline is already bracket-safe.

### 3. PluginsCapability — Plugin output dir

`pluginOutputDir(pluginName)` returns `${pluginsDir}${pluginName}/`. For Claude: `.claude/plugins/aidd-vcs/`.

Skills installed from plugin go to the tool's flat skills directory (e.g. `{{TOOLS}}/skills/<skill-name>`) via `SkillsCapability.buildInstallPath()`.

The `buildInstallPath` for Claude skills returns the tool's skills directory joined with the stripped file name (suffix `.claude.md` removed).

This means a plugin skill file `skills/[3.1] commit/SKILL.md` would install to the tool's skills directory under `[3.1] commit/SKILL.md` — which preserves bracket names in the user's tool directory. This is safe per the bracket spike results, but worth verifying in the pilot.

### 4. build-dist.sh — Shell script risk

Current `build-dist.sh` does NOT iterate over skill directories directly — it calls `aidd install` CLI commands. No immediate shell glob risk. However, future build scripts that walk `plugins/*/skills/*/` must quote paths.

## Per-IDE Tool Analysis

### claude.ts (AiTool)
- Skills dir: `{{TOOLS}}/skills/`
- Commands dir: `{{TOOLS}}/commands/aidd/<phase>/`
- Rules dir: `{{TOOLS}}/rules/`
- MCP output: `.mcp.json` (merged from `config/mcp.json` + plugin `.mcp.json`)
- Plugins dir: `.claude/plugins/`
- Plugin manifest: `.claude-plugin/plugin.json`
- Hooks: accepted (`acceptsHooks: true`)

### cursor.ts (AiTool)
- Skills dir: the Cursor skills directory (`{{TOOLS}}/skills/`)
- Commands dir: the Cursor commands directory (`{{TOOLS}}/commands/aidd/<phase>/`)
- Rules dir: the Cursor rules directory (`.mdc` extension)
- MCP output: `.cursor/mcp.json`
- Plugins dir: `.cursor/plugins/`
- Plugin manifest: `.cursor-plugin/plugin.json`
- Hooks: accepted (`acceptsHooks: true`)

### MCP per-plugin merge
- `McpCapability` in claude.ts `consumes: [CONFIG_MCP]` — reads framework-level `config/mcp.json`
- Plugin `.mcp.json` is handled separately at `plugin add` time via `PluginsCapability`
- Per-plugin `.mcp.json` is MERGED (not replaced) into the user's `.mcp.json`
- No CLI changes needed for per-plugin MCP — this already works

## CLI Changes Required for Phase 1-12

### No-change items (current plugin pipeline already handles):
- Bracket-named skill directories
- Per-plugin `.mcp.json` files (merged at plugin add time)
- Per-plugin hooks (hooks/hooks.json read and installed)
- Plugin manifest format (`.claude-plugin/plugin.json`)

### Required CLI changes for full plugin restructure:
1. `framework-loader-adapter.ts` CONTENT_SECTIONS: when framework migrates to plugins-only layout, remove `agents/`, `commands/`, `rules/`, `skills/` sections (or make them optional). This is a Phase 12 concern.
2. `framework-loader-adapter.ts` SCRIPT_REFS: remove `config/scripts/update_memory.js` entry when it moves to aidd-context plugin.
3. Build script (`build-dist.sh`): the `aidd install` call pattern stays valid. Per-plugin distribution will require plugin installs, not framework-level installs.

## Build Script Sketch

See `aidd_docs/memory/build-sketch.md`.
