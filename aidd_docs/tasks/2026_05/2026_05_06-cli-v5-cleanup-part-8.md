# Phase 8 — Sync plugins inter-tool propagation

> Extend sync semantics so `aidd ai sync --source claude --target cursor` propagates installed plugins (re-translated by target tool's emitter), not only runtime config files.

## Pre-requisites

- Phase 5 (noun-first) landed — `aidd ai sync` and `aidd plugin sync` commands exist
- Phase 1 (manifest v5) landed — `tools[*].plugins[]` is the source of truth for installed plugins per tool

## Goal

Today `SyncUseCase` propagates files tracked under `tools[source].files[]`. Plugins emitted under each tool live in `tools[*].plugins[*].files[]`. Phase 8 makes sync include plugin files: when source tool has plugin X installed and target tool does not, fetch plugin X from its marketplace cache, re-translate via target tool's emitter, install on target.

## Architecture compliance

- New use case `SyncPluginsUseCase` lives in `src/application/use-cases/sync/sync-plugins-use-case.ts`
- Reuses `PluginInstallFromMarketplaceUseCase` for plugin materialization on target
- `SyncUseCase` (existing) now optionally chains `SyncPluginsUseCase` based on `includePlugins: boolean` flag (default true)
- Domain logic stays per-tool emitter — tool registry already carries `domain/tools/ai/<tool>.ts` with capability-aware emitters
- `Plugin` value object enriched with `marketplace: string | null` (Phase 1) — required to re-fetch from same source on target

## Plugin re-translation guarantees

For sync plugins to be safe symmetrically, every tool emitter must support every plugin capability the source tool exposed:

| Capability | Source: Claude | Target: Cursor | Target: Codex | Target: Copilot | Target: OpenCode |
|---|---|---|---|---|---|
| commands | yes | yes | yes | yes | yes (flat) |
| rules | yes | yes | yes | yes | yes |
| skills | yes | partial | partial | partial | yes |
| agents | yes | yes (subagents) | partial | partial | yes |
| hooks | yes | partial | partial | partial | partial |
| mcp | yes (.mcp.json) | yes (.cursor/mcp.json) | yes (.codex/config.toml) | yes (.vscode/mcp.json) | yes (opencode.json mcp key) |

Phase 0 inventory verifies symmetry coverage. Capabilities not re-translatable produce a warning on sync (skipped, not error).

## Steps

- [ ] In Phase 0 inventory, list every tool emitter's capability coverage (above table populated with verified results)
- [ ] Create `src/application/use-cases/sync/sync-plugins-use-case.ts`:
  - [ ] Input: `{ projectRoot, sourceToolId, targetToolIds, force, interactive }`
  - [ ] Load manifest, enumerate plugins on source tool not present (or out of date) on each target
  - [ ] For each plugin: fetch from marketplace cache (cache-first per locked decision), re-translate via target emitter, install (skip MCP credentials per locked decision #8)
  - [ ] Aggregate result `SyncPluginsResult` per target tool
  - [ ] Surface skipped capabilities as warnings (do not fail sync)
- [ ] Update `src/application/use-cases/sync/sync-use-case.ts`:
  - [ ] Accept `includePlugins?: boolean` (default true)
  - [ ] After config sync, optionally invoke `SyncPluginsUseCase`
- [ ] Update `aidd ai sync` command (Phase 5 wired) to pass `includePlugins: true` by default; add `--no-plugins` flag to disable
- [ ] Wire `aidd plugin sync` command — same use case but bypasses config sync (`includePlugins: true` only)
- [ ] Update `deps.ts` — wire `syncPluginsUseCase`

## Tests (unit-first)

### Unit tests

- [ ] `tests/application/use-cases/sync/sync-plugins-use-case.unit.test.ts`:
  - [ ] Source has 2 plugins, target has 0 → both installed
  - [ ] Source has 1 plugin, target already has it (same version) → skip
  - [ ] Source has plugin v2, target has v1 → reinstall v2
  - [ ] Plugin from marketplace not in cache → fetches from source URL
  - [ ] Plugin marketplace removed → warning, skip
  - [ ] Capability not supported by target emitter → warning, skip that capability
- [ ] `tests/application/use-cases/sync/sync-use-case.unit.test.ts` (existing) — extend with `includePlugins: true/false` paths

### Integration tests

- [ ] One integration test on real FS: source = claude with `aidd-context` installed, target = cursor — verify cursor receives translated rules + skills + commands

### E2E tests

- One E2E in Phase 11 covering `aidd ai sync --source claude --target cursor` with plugin propagation

## Acceptance criteria

- [ ] `aidd ai sync --source claude --target cursor` propagates configs AND plugins
- [ ] `aidd ai sync --source claude --target cursor --no-plugins` propagates configs only
- [ ] `aidd plugin sync --source claude --target cursor` propagates plugins only
- [ ] Plugin re-translation skips unsupported capabilities (warning, not error)
- [ ] Plugin already at correct version on target: skipped
- [ ] Plugin marketplace cache miss: fetches from origin
- [ ] MCP credentials not auto-propagated (per locked decision #8) — warning printed
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm biome check` clean

## Manual validation

```bash
cd /tmp && rm -rf sync-plugins && mkdir sync-plugins && cd sync-plugins
aidd setup --source remote --ai claude --ide vscode --recommended-plugins --yes
ls .claude/         # claude plugin files present
ls .cursor/         # cursor not installed yet

# Install cursor (no plugins yet)
aidd ai install cursor --yes
ls .cursor/         # cursor config only, no plugins

# Sync plugins from claude to cursor
aidd ai sync --source claude --target cursor

ls .cursor/         # plugin files now present
aidd plugin list --tool cursor   # plugins listed for cursor
```

## Risks / breaking changes

- Some plugin capabilities may not survive translation cleanly (e.g. claude-specific `agents` to codex). Sync degrades gracefully (warnings). Document expected gaps.
- Marketplace cache miss + no network: sync errors with explicit "fetch failed" message — user can retry.
- Plugin version drift between tools: sync overwrites target version with source version. Document as semantic.
- MCP credentials NOT propagated — user must re-add credentials manually on target after sync.

## Commit

```
feat(sync): propagate installed plugins inter-tool

Extend ai sync to re-translate and install source tool plugins on targets:
- aidd ai sync --source <s> --target <t>     => configs + plugins (default)
- aidd ai sync --source <s> --target <t> --no-plugins  => configs only
- aidd plugin sync --source <s> --target <t> => plugins only

Add SyncPluginsUseCase orchestrating per-plugin fetch (cache-first) +
target-emitter re-translation. Skips unsupported capabilities with warnings.
Skips MCP credential propagation (user manually re-adds on target).

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-8.md
```
