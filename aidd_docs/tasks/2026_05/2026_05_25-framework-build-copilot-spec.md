---
name: framework-build-copilot
status: frozen-v2
date: 2026-05-25
target: copilot
scope: MVP1
supersedes: spec-v1 (Claude-via-Copilot lookup #4 layout)
---

# Spec v2 — `aidd framework build --target copilot`

## What changed vs v1

Spec v1 produced Claude-format plugins relying on Copilot's lookup chain compatibility (path #4 = `.claude-plugin/plugin.json`). Empirical inspection of the official reference repo `github/awesome-copilot` showed that real Copilot plugins use a **fully native layout**:

- Plugin manifest at `.github/plugin/plugin.json` (lookup path #3, the canonical Copilot location).
- Agent files plain `.md` (no `.agent.md` suffix) when declared via plugin.json `agents` field.
- Marketplace catalog at `.github/plugin/marketplace.json` with the Copilot-native schema (top-level `metadata.pluginRoot`, plugins entries with simple-string `source` for local subdirectories).
- No `${CLAUDE_PLUGIN_ROOT}` anywhere — relative paths only (the variable is only expanded when the plugin is detected as Claude format).

v2 ships Copilot-native everywhere: same output, more native, future-proof if Copilot drops Claude-compat lookups.

## Objective

Add a framework-author CLI command that produces a Copilot-native plugin marketplace tree from a Claude-format framework source. The output is self-contained, registers as a `directory` source via `aidd marketplace add`, and individual plugins install cleanly via `aidd plugin install <plugin> --tool copilot`.

The key build-time job is translating Claude conventions (`@./X` refs, `${CLAUDE_PLUGIN_ROOT}/X` env-var paths, `.claude-plugin/` manifest paths) into Copilot-native equivalents (markdown links, relative paths, `.github/plugin/` manifest paths).

## Out of scope (MVP1)

- Targets other than `copilot` (codex, cursor, opencode reserved for follow-up SDLCs)
- Bundled plugin `commands/` or `rules/` directories (framework currently ships none; log a warn if present)
- GitHub Action workflow that wraps the CLI (separate MVP2)
- User-side tarball-as-marketplace-source support (separate MVP3)

## Command

```bash
aidd framework build \
  --source <framework-path> \
  --target copilot \
  --out <dist-path>
```

### Flags

- `--source <path>` — required — path to a framework root containing `plugins/<name>/.claude-plugin/plugin.json` entries and `.claude-plugin/marketplace.json`.
- `--target copilot` — required for MVP1 — single accepted value.
- `--out <dir>` — required — output directory; auto-wiped and recreated when present.

## Marketplace output (`<out>/.github/plugin/marketplace.json`)

Schema mirrors `github/awesome-copilot/.github/plugin/marketplace.json`:

```json
{
  "name": "<source-marketplace-name>",
  "metadata": {
    "description": "<source-marketplace-description>",
    "version": "<source-marketplace-version>",
    "pluginRoot": "./plugins"
  },
  "owner": { "name": "<source-owner-name>" },
  "plugins": [
    {
      "name": "<plugin-name>",
      "source": "<plugin-name>",
      "description": "<plugin-description>",
      "version": "<plugin-version>"
    }
  ]
}
```

- `source` is the **simple-string** form (subdirectory name, resolved against `metadata.pluginRoot`). No object form for local plugins.
- `version` and `description` are sourced from the source marketplace entry first, falling back to the plugin's own `.claude-plugin/plugin.json`. If neither has a value, halt with `InvalidSourceMarketplaceError`.

## Per-plugin output (`<out>/plugins/<plugin>/`)

### Plugin manifest — `.github/plugin/plugin.json` (NEW path)

Synthesized from the source `<plugin>/.claude-plugin/plugin.json`:

```json
{
  "name": "<from source>",
  "description": "<from source>",
  "version": "<from source>",
  "author": "<from source>",
  "homepage": "<from source, if present>",
  "repository": "<from source, if present>",
  "license": "<from source, if present>",
  "keywords": "<from source, if present>",
  "agents": ["./agents"],
  "skills": ["./skills/<name1>", "./skills/<name2>"],
  "hooks": "./hooks/hooks.json",
  "mcpServers": "./.mcp.json"
}
```

Field synthesis rules:

- `agents` field is emitted as `["./agents"]` (array form, matching awesome-copilot empirical canonical) only when the source plugin has an `agents/` directory with at least one `.md` file. Omit otherwise.
- `skills` field is emitted as an array listing every `./skills/<name>/` directory that contains a `SKILL.md`. Omit when no skills are present.
- `hooks` field is emitted as `"./hooks/hooks.json"` only when the source plugin has `hooks/hooks.json`. Omit otherwise.
- `mcpServers` field is emitted as `"./.mcp.json"` only when the source plugin has `.mcp.json`. Omit otherwise.
- Claude-specific fields (`strict`, `$schema`) are dropped.

The Claude-format `.claude-plugin/plugin.json` is **not** copied to the output. The new `.github/plugin/plugin.json` is the only manifest.

### Agents — `agents/<name>.md` (no rename)

Plain `.md` files. Frontmatter restricted to the Copilot-supported set: `name, description, model, tools, agents, argument-hint`. All other fields dropped.

### Skills — `skills/<name>/...` (tree copy + content rewrite)

Recursively copy every file under `skills/<name>/`. For each `.md` file, apply the content rewrite step (see below).

### Hooks — `hooks/hooks.json` (Claude format with rewritten paths)

Copy the hooks tree byte-for-byte except for path translation:

- `${CLAUDE_PLUGIN_ROOT}/<rel>` → `./<rel>` (relative to plugin root)
- Applies to every string value in `command`, `args` array entries, and `env` value entries.
- Event names stay PascalCase (Claude convention, accepted by Copilot per docs).

Side files under `hooks/` (e.g. shell scripts) copy byte-for-byte; `${CLAUDE_PLUGIN_ROOT}` rewrites apply only inside `.json`.

### MCP — `.mcp.json` (Claude `mcpServers` shape with rewritten paths)

Same path rewrite as hooks (`${CLAUDE_PLUGIN_ROOT}/<rel>` → `./<rel>`) applied to every string value under `mcpServers.<server>.command`, `mcpServers.<server>.args[]`, `mcpServers.<server>.env.*`. URL-based servers (no `command`) pass through.

## Content rewrite (every `.md` under the plugin)

Applied to every `.md` file in skills, agents, and supporting files:

1. `@./X` → `[X](./X)` (sibling reference)
2. `@../X` → `[X](../X)` (parent reference)
3. `@${CLAUDE_PLUGIN_ROOT}/<rel>` → markdown link with **relative path computed from the current file's plugin-relative location**. Example: a file at `skills/09-for-sure/actions/01-init.md` referencing `@${CLAUDE_PLUGIN_ROOT}/skills/09-for-sure/assets/plan-template.md` produces `[plan-template.md](../assets/plan-template.md)`.
4. `@{{TOOLS}}/X` → halt error: framework placeholders are not allowed inside plugin scope.

`${CLAUDE_PLUGIN_ROOT}` without a leading `@` is left untouched inside `.md` content (it has no semantic meaning there in either Claude or Copilot context; framework authors should migrate to `@${CLAUDE_PLUGIN_ROOT}/...` form for build-time rewriting).

## Behavior

- **Auto-overwrite**: `<out>` is wiped and recreated. No confirmation prompt, no `--force`.
- **Halt-at-first-failure**: any plugin-level error stops the build immediately; partial output stays on disk for inspection.
- **Stdout** on success: `Built <N> plugins, <M> files written to <out>` (stats only).

## Safety guard

Halt before wiping `<out>` if any of:

- `<out>` resolves to the same path as `<source>`.
- `<out>` is inside `<source>` (would corrupt source on wipe).
- `<source>` is inside `<out>` (would lose source on wipe).

Use `InvalidBuildPathsError` with a clear message.

## Acceptance criteria

1. `aidd framework build --source <framework> --target copilot --out /tmp/dist` produces a directory tree readable by Copilot that follows the layout in this spec (`.github/plugin/marketplace.json` + `plugins/<name>/.github/plugin/plugin.json` + plain `.md` agents).
2. Re-running with identical inputs produces byte-identical output (idempotent; deterministic JSON key order, no timestamps).
3. The produced `marketplace.json` and every `plugin.json` validate against a bundled Copilot plugin / marketplace JSON schema (ajv). If no published schema exists, ship a hand-crafted minimal schema based on awesome-copilot empirical examples and document the source.
4. End-to-end: `aidd marketplace add aidd-test /tmp/dist && aidd plugin install aidd-dev --tool copilot` runs without error against a clean tmp project.
5. Every `@./X`, `@../X`, and `@${CLAUDE_PLUGIN_ROOT}/X` reference inside skills/agents/supporting `.md` files is rewritten to a markdown link with a correct relative path.
6. Agent files keep their original `.md` extension (no `.agent.md` rename) and their frontmatter is restricted to the Copilot allowlist.
7. `${CLAUDE_PLUGIN_ROOT}` occurrences inside `hooks/hooks.json` and `.mcp.json` string values are rewritten to relative `./` paths. No verbatim `${CLAUDE_PLUGIN_ROOT}` survives in the output.
8. The synthesized `<plugin>/.github/plugin/plugin.json` declares `agents`, `skills`, `hooks`, and `mcpServers` fields **only** when the corresponding source directory/file exists. Fields are omitted otherwise.
9. The synthesized `<out>/.github/plugin/marketplace.json` uses the Copilot-native schema (`metadata.pluginRoot`, simple-string `source` for local plugins) — not the Claude marketplace schema.
10. Invalid source `plugin.json` (fails Claude manifest schema validation) halts the build immediately with `JsonSchemaValidationError`. Safety guard violations halt with `InvalidBuildPathsError`.
11. Unit tests cover each pipeline step (manifest synthesis, agent FM strip, skill tree copy, hooks path rewrite, mcp path rewrite, content rewrite for all four `@` forms, marketplace emission). Integration test drives the full build against the in-repo framework fixture and asserts tree shape plus the e2e install flow.

## Docs sources

- VSCode Copilot plugin schema: https://code.visualstudio.com/docs/copilot/customization/agent-plugins
- Plugin manifest lookup chain (path #3 is `.github/plugin/plugin.json`): same page, section "Plugin format detection".
- MCP plugin schema (top-level `mcpServers`): https://code.visualstudio.com/docs/copilot/customization/agent-plugins#_mcp-configuration-format
- Plugin environment variables (`${CLAUDE_PLUGIN_ROOT}` only when Claude format; **dropped in Copilot-native**): https://code.visualstudio.com/docs/copilot/customization/agent-plugins#_plugin-environment-variables
- Hooks event names + schema: https://code.visualstudio.com/docs/copilot/customization/hooks
- Reference repo `github/awesome-copilot`: 30+ plugins all using `.github/plugin/plugin.json`, plain `.md` agents, `.github/plugin/marketplace.json` with `metadata.pluginRoot`. Empirical canonical.

## Empirical confirmations

- `github/awesome-copilot/plugins/ai-team-orchestration/.github/plugin/plugin.json`: confirms `.github/plugin/` path, `agents: ["./agents"]`, `skills: ["./skills/<name>"]`, plain `.md` agent files.
- `github/awesome-copilot/.github/plugin/marketplace.json`: confirms `metadata.pluginRoot`, simple-string `source` for local plugins.
- `github/awesome-copilot/plugins/context-matic/.mcp.json`: confirms `mcpServers` top-level key inside plugin (Claude-compatible shape).
- Zero `CLAUDE_PLUGIN_ROOT` references across the entire awesome-copilot repo (verified via `gh api search/code`).
- Zero `.agent.md` suffix usage in awesome-copilot agent files (verified via `gh api contents`).
