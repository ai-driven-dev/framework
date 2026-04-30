# MCP Merge Behavior — Phase 0

## Current Framework State

`config/mcp.json` defines 3 MCP servers:
- `playwright` (npx @playwright/mcp@latest)
- `figma` (HTTP: https://mcp.figma.com/mcp)
- `mcp-atlassian` (uvx mcp-atlassian, with env vars)

## How CLI Currently Handles MCP

### Framework-level MCP (FrameworkLoaderAdapter)

`CONFIG_REFS` in `framework-loader-adapter.ts` loads `config/mcp.json` under the key `mcp`.

`McpCapability` in `claude.ts` consumes `[CONFIG_MCP]` and outputs to `.mcp.json` in the tool's directory.

At `aidd install ai claude`, the framework's `config/mcp.json` content is written to `~/.mcp.json` (or project-level `.mcp.json`).

### Plugin-level MCP (PluginDistributionReaderAdapter)

A plugin `.mcp.json` at the plugin root is detected by `isComponentFile()` and categorized as `mcp` in `PluginComponents`.

When `plugin add` runs:
- The plugin's `.mcp.json` is read
- Its `mcpServers` entries are merged into the existing `.mcp.json` using `mergeJsonFile()` with `"framework-prime"` or `"user-prime"` strategy (per `McpCapability.mcpRelativePath`)
- Merge is additive: existing servers are preserved, new servers are added

### Multiple plugin .mcp.json files

Each plugin install merges its `.mcp.json` into the same output `.mcp.json`. The merge is sequential and additive. No conflict detection exists if two plugins define the same MCP server name — the last-installed plugin's definition wins.

## Plugin-Era MCP Architecture

### Option A: Framework keeps config/mcp.json (recommended for Phase 0)

- `config/mcp.json` remains as the "baseline" MCP config for all tools
- Per-plugin `.mcp.json` files add plugin-specific MCP servers at install time
- Example: `aidd-context` plugin could ship its own `.mcp.json` with memory-related servers
- No CLI changes needed

### Option B: All MCP moves to per-plugin .mcp.json

- Framework `config/mcp.json` removed or emptied
- Each plugin declares its MCP dependencies
- `FrameworkLoaderAdapter` CONFIG_REFS entry for `mcp` removed
- Requires CLI change + ensures MCP servers are only present when the plugin is installed

## Recommendation

Proceed with Option A for Phase 0. The framework's `config/mcp.json` (playwright, figma, mcp-atlassian) contains project-level servers that apply regardless of which plugins are installed. Plugin-specific MCP servers (if any) can be added via per-plugin `.mcp.json`.

The current CLI pipeline already supports plugin `.mcp.json` merge — no CLI changes required for the plugin-era MCP architecture.

## CLI Files Involved

- `src/infrastructure/adapters/framework-loader-adapter.ts` — `CONFIG_REFS` line 30
- `src/domain/tools/ai/claude.ts` — `McpCapability` with `consumes: [CONFIG_MCP]`
- `src/infrastructure/adapters/plugin-distribution-reader-adapter.ts` — `isComponentFile()` `.mcp.json` check
- `src/domain/capabilities/plugins-capability.ts` — `mcpRelativePath` default `.mcp.json`
- `src/infrastructure/adapters/file-system-adapter.ts` — `mergeJsonFile()` implementation
