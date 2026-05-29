---
name: framework-build-copilot-flat
status: frozen
date: 2026-05-25
target: copilot
scope: MVP1-flat
extends: framework-build-copilot (v4.4.0, Mode A marketplace)
---

# Spec — `aidd framework build --target copilot --flat`

## Objective

Add a `--flat` flag to the existing `aidd framework build --target copilot` command that materializes plugin content **directly into a project's workspace `.github/` and `.vscode/` directories**, bypassing the marketplace registration path entirely.

Output is consumed by VS Code Copilot Chat natively (no marketplace, no plugin manifest, no trust prompt) the moment the project is opened.

## Why

Mode A (current v4.4.0) ships a self-contained marketplace dist that requires `aidd marketplace add` + `aidd plugin install` + a VS Code trust click. Useful for distribution. Friction for single-project bootstrap / CI / demos.

Mode B flat materializes the same content directly at canonical VS Code Copilot workspace paths. Zero registration, zero trust click — files just exist and Copilot Chat reads them on next reload.

## Out of scope

- Targets other than `copilot` (`--flat` for codex/cursor/opencode reserved for follow-up SDLCs)
- Mutating any file the framework doesn't own (writes are limited to its own canonical paths; collisions halt unless `--force`)
- `.aidd/manifest.json` tracking (flat mode is fire-and-forget; tracking is the marketplace path's job)
- Auto-update flow — flat mode user re-runs the build to refresh

## Command

```bash
aidd framework build \
  --source <framework-path> \
  --target copilot \
  --flat \
  --out <project-root>
```

### Flags

- `--source <path>` — required — same as Mode A.
- `--target copilot` — required — `--flat` only supported for `copilot` in this SDLC.
- `--flat` — required for flat mode — opt-in flag.
- `--out <dir>` — required — **project root** (not a dedicated dist tree). Existing project files outside the touched canonical paths are never modified.
- `--force` — optional — when set, overwrites existing files at canonical paths. Without it, any collision halts the build.

## Per-plugin pipeline (flat target paths)

For each `<source>/plugins/<plugin>/`:

1. Read `.claude-plugin/plugin.json`. Validate against the bundled Claude plugin manifest schema (ajv). Halt with `JsonSchemaValidationError` on invalid.
2. Materialize content under `<out>` at canonical VS Code Copilot workspace paths (same as install-time `copilot.ts` capability adapters produce):
   - **Agents** — `<src>/agents/<name>.md` → `<out>/.github/agents/<plugin>/<name>.agent.md`. Suffix `.agent.md` is the workspace canonical (no plugin.json declaration in flat mode). Frontmatter stripped to the Copilot allowlist (`name, description, model, tools, agents, argument-hint`).
   - **Skills** — `<src>/skills/<name>/` tree → `<out>/.github/skills/<plugin>/<name>/` byte-for-byte (preserving `SKILL.md` and every supporting file).
   - **Hooks** — `<src>/hooks/hooks.json` → `<out>/.github/hooks/<plugin>.hooks.json` (per-plugin filename to avoid collisions). Path values `${CLAUDE_PLUGIN_ROOT}/<rel>` rewritten to `./<rel>` relative to plugin root (which becomes `.github/skills/<plugin>/` and friends — see "Path resolution" below).
   - **MCP** — `<src>/.mcp.json` `mcpServers.*` entries merged into `<out>/.vscode/mcp.json` under top-level `servers` key (workspace convention). Server keys prefixed with `<plugin>-` to avoid collisions. `${CLAUDE_PLUGIN_ROOT}/<rel>` rewritten to absolute path under `<out>/.github/skills/<plugin>/<rel>`.
3. Rewrite `.md` content under skills and agents:
   - `@./X` → `[X](./X)`
   - `@../X` → `[X](../X)`
   - `@${CLAUDE_PLUGIN_ROOT}/<rel>` → markdown link with **path relative to the current file's flat-output location**.
   - `@{{TOOLS}}/X` → halt error.

### Path resolution for `${CLAUDE_PLUGIN_ROOT}`

In Mode A marketplace, `${CLAUDE_PLUGIN_ROOT}` was Claude-format-detected by Copilot and expanded at runtime to the plugin's absolute path. **In flat mode there is no plugin manifest** — Copilot will not expand the variable. The build must resolve every occurrence to a concrete relative or absolute path at build time:

- Inside `.md` (skills, agents) — rewrite to a relative markdown link computed from the current file's flat-output location to the target's flat-output location.
- Inside `hooks.json` — rewrite to a path relative to the workspace root (`./` prefix is fine because VS Code runs hook commands with `cwd = workspaceFolder`).
- Inside `.mcp.json` (now merged into `.vscode/mcp.json`) — rewrite to **absolute** path under `<out>/.github/skills/<plugin>/...` because workspace MCP servers don't have an implicit `cwd` anchor.

## Marketplace output

**None.** Flat mode does not produce a `marketplace.json`. No `.github/plugin/` directory.

## Behavior

- **No auto-wipe** on `<out>` — flat mode writes into a live project. Unrelated files are never touched.
- **Collision policy** — when a canonical target path already exists, halt with `FlatTargetExistsError` unless `--force` is set.
- **Halt-at-first-failure** for any plugin-level error.
- **Stdout** on success: `Flat-installed N plugins, M files written under <out>` (stats only).

## Safety guard

Halt before any write if:

- `<out>` does not exist or is not a directory.
- `<source>` is inside `<out>` (would lose source on re-build).
- `<out>` is inside `<source>` (would corrupt source on re-build).

Reuse `InvalidBuildPathsError` from Mode A.

## Acceptance criteria

1. `aidd framework build --source <fw> --target copilot --flat --out <proj>` materializes plugin content under `<proj>/.github/agents/<plugin>/`, `<proj>/.github/skills/<plugin>/`, `<proj>/.github/hooks/`, and merges into `<proj>/.vscode/mcp.json`.
2. Re-running with `--force` produces byte-identical output for the same input (idempotent for the files the build owns; user-added files outside its canonical paths preserved).
3. End-to-end: a fresh git-init project receives a flat build, then `code <proj>` shows the framework's slash commands and agents under Copilot Chat without any marketplace registration or trust click. (Smoke-tested manually; automated test asserts file tree shape.)
4. Every `@./X`, `@../X`, and `@${CLAUDE_PLUGIN_ROOT}/X` reference inside skills/agents `.md` files is rewritten to a markdown link with a correct relative path **as computed from the file's flat-output location** (not the source location).
5. Agent files use the `.agent.md` suffix in flat mode and frontmatter restricted to the Copilot allowlist.
6. `${CLAUDE_PLUGIN_ROOT}` occurrences inside flat-output `hooks/<plugin>.hooks.json` and `.vscode/mcp.json` are rewritten to concrete paths (relative for hooks, absolute for MCP). No literal survives.
7. MCP servers from `.mcp.json` are merged into `.vscode/mcp.json` under `servers` key with per-plugin key prefix; existing `servers` entries are preserved.
8. Hooks files are split per-plugin (`<plugin>.hooks.json`) to avoid cross-plugin collisions in a shared `.github/hooks/` directory.
9. Collision detection — running flat build on a project that already has `.github/agents/<plugin>/<name>.agent.md` halts with `FlatTargetExistsError` unless `--force` is set.
10. Invalid source `plugin.json` halts with `JsonSchemaValidationError`. Safety guard violations halt with `InvalidBuildPathsError`.
11. Unit tests cover every flat-only pipeline step (path resolution, MCP merge, hooks split, collision detection). Integration test drives the full flat build against the in-repo framework fixture.

## Reuse contract

Plan must prove reuse of:

- `domain/formats/relative-link-rewrite.ts` (`@./`, `@../`, `@${CLAUDE_PLUGIN_ROOT}/<rel>` rewriter) — only the **base path computation** changes; the rewrite logic is identical.
- `domain/formats/agent-frontmatter-strip.ts` — identical.
- `domain/formats/claude-root-path-rewrite.ts` — identical for JSON files; flat mode adds the per-context destination resolver in the use-case layer, not in the helper.
- `application/use-cases/framework/framework-build-use-case.ts` — Mode A entry point. Flat mode should reuse the orchestration scaffold (read manifest, iterate plugins, halt-at-first-failure, safety guard) and inject a different output layout strategy.
- `domain/tools/ai/copilot.ts` capability handlers (`agentsHandler.buildFilePath`, `commandsHandler.buildFilePath`, `rulesHandler.buildFilePath`, `transformMcpToOpencode` analog) — **inspect for direct reuse** of the canonical-path computation. If reusable, wire them in; if not, extract pure helpers to `domain/formats/`.

Net new code should be limited to the flat-mode output strategy and the per-plugin path computations. No duplication of regex rewriters or frontmatter handlers.

## Default vs opt-in

- Default behavior of `aidd framework build --target copilot` (no `--flat`) is unchanged — Mode A marketplace dist (current v4.4.0).
- `--flat` is opt-in. Mutually exclusive with marketplace-tree output.

## Docs sources

- VS Code Copilot agent file location & suffix: https://code.visualstudio.com/docs/copilot/customization/custom-chat-modes
- VS Code Copilot agent plugins (Mode A reference): https://code.visualstudio.com/docs/copilot/customization/agent-plugins
- VS Code Copilot hooks (workspace location `.github/hooks/`): https://code.visualstudio.com/docs/copilot/customization/hooks
- VS Code MCP workspace config (`.vscode/mcp.json`, `servers` key): https://code.visualstudio.com/docs/copilot/customization/mcp-servers
- Existing install-time copilot capabilities: `src/domain/tools/ai/copilot.ts`
