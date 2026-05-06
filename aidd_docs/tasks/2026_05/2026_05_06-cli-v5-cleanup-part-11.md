# Phase 11 — Sync plugins inter-tool + menu refresh

> Implement `SyncPluginsUseCase` for cross-tool plugin propagation (re-translate via target emitter, cache-first marketplace fetch). Refresh interactive menu (relabel + reorder + drop dead entries to match noun-first surface).

## Pre-requisites

- Phase 9 (noun-first) landed — `aidd ai sync` and `aidd plugin sync` commands exist
- Phase 10 (globals + mp cache + plugin sub-cmds) landed — sub-cmd wiring in place; orchestrators ready
- Phase 1 (manifest v5 schema) landed — `tools[*].plugins[]` is the source of truth for installed plugins per tool

## Goal

Two deliverables combined:

1. **Sync plugins inter-tool**: `aidd ai sync --source claude --target cursor` propagates configs **and** installed plugins. Source tool's installed plugins are re-translated by target tool's emitter and installed on target.
2. **Menu refresh**: relabel entries, reorder branches by user intent, drop entries for deleted commands (cache, config), add new entries (marketplace cache, AI/IDE/plugin per-domain operations).

## Architecture compliance

### Sync plugins

New use case `SyncPluginsUseCase` lives in `src/application/use-cases/sync/sync-plugins-use-case.ts`. Reuses `PluginInstallFromMarketplaceUseCase` for plugin materialization on target. `SyncUseCase` (existing) optionally chains `SyncPluginsUseCase` based on `includePlugins: boolean` flag (default `true`).

Domain logic stays per-tool emitter — tool registry already carries `domain/tools/ai/<tool>.ts` with capability-aware emitters. `Plugin` value object enriched with `marketplace: string | null` (Phase 7) — required to re-fetch from same source on target.

Plugin re-translation guarantees per-tool capability table — capabilities not re-translatable produce a warning on sync (skipped, not error).

### Menu

Menu structure stays a pure data tree in `commands/menu.ts`. `InteractiveMenuUseCase` exists — keep, only the data tree changes. Branch entries reference only existing commands.

## Steps

### A. Implement `SyncPluginsUseCase`

- [ ] Create `src/application/use-cases/sync/sync-plugins-use-case.ts`:
  - Input: `{ projectRoot, sourceToolId, targetToolIds, force, interactive }`
  - Load manifest, enumerate plugins on source tool not present (or out of date) on each target
  - For each plugin: fetch from marketplace cache (cache-first), re-translate via target emitter, install (skip MCP credentials per locked decision #8)
  - Aggregate result `SyncPluginsResult` per target tool
  - Surface skipped capabilities as warnings (do not fail sync)
- [ ] Update `src/application/use-cases/sync/sync-use-case.ts`:
  - Accept `includePlugins?: boolean` (default `true`)
  - After config sync, invoke `SyncPluginsUseCase` if `includePlugins`
- [ ] Update `aidd ai sync` command (Phase 9 wired) to default `includePlugins: true`; add `--no-plugins` flag to disable
- [ ] Update `aidd plugin sync` command — same use case but bypasses config sync (`includePlugins: true` only)
- [ ] Update `deps.ts` to wire `syncPluginsUseCase`

### B. Plugin re-translation symmetry verification (carry-over from Phase 0)

- [ ] For each target emitter (claude, cursor, copilot, codex), verify capability coverage table from Phase 0 inventory:

| Capability | Claude→Cursor | Claude→Codex | Claude→Copilot |
|---|---|---|---|
| commands | OK | OK | OK |
| rules | OK | OK | OK |
| skills | partial | partial | partial |
| agents | OK (subagents) | partial | partial |
| hooks | partial | partial | partial |
| mcp | OK | OK | OK |

- [ ] Document partial-coverage cases in `SyncPluginsUseCase` warnings
- [ ] OpenCode deferred (next-version scope)

### C. Refresh interactive menu

Target menu tree:

```
Fresh project (no manifest):
  1. Install AIDD in this project       → aidd setup

Installed project:
  1. Inspect
     ├── Status                         → aidd status
     ├── Doctor                         → aidd doctor
     └── List installed
         ├── AI tools                   → aidd ai list
         ├── IDE tools                  → aidd ide list
         └── Plugins                    → aidd plugin list

  2. Manage AI tools
     ├── Install                        → aidd ai install <prompt tool>
     ├── Uninstall                      → aidd ai uninstall <prompt tool>
     ├── Update                         → aidd ai update
     ├── Sync                           → aidd ai sync (interactive)
     ├── Restore                        → aidd ai restore
     └── Doctor                         → aidd ai doctor

  3. Manage IDE tools
     ├── Install                        → aidd ide install <prompt tool>
     ├── Uninstall                      → aidd ide uninstall <prompt tool>
     ├── Update                         → aidd ide update
     └── Doctor                         → aidd ide doctor

  4. Manage plugins
     ├── Install from marketplace       → aidd plugin install <prompt name>
     ├── Add local plugin               → aidd plugin add <prompt path>
     ├── Pick (interactive marketplace) → aidd plugin pick
     ├── Search                         → aidd plugin search <prompt query>
     ├── Update                         → aidd plugin update
     ├── Remove                         → aidd plugin remove <prompt name>
     ├── List                           → aidd plugin list
     ├── Sync                           → aidd plugin sync
     ├── Restore                        → aidd plugin restore
     └── Doctor                         → aidd plugin doctor

  5. Marketplaces
     ├── List                           → aidd marketplace list
     ├── Add                            → aidd marketplace add
     ├── Browse                         → aidd marketplace browse <prompt name>
     ├── Refresh                        → aidd marketplace refresh
     ├── Remove                         → aidd marketplace remove <prompt name>
     ├── Check freshness                → aidd marketplace check
     └── Cache
         ├── List                       → aidd marketplace cache list
         └── Clear                      → aidd marketplace cache clear

  6. Maintain & repair
     ├── Update everything              → aidd update
     ├── Sync everything                → aidd sync
     ├── Restore everything             → aidd restore
     └── Clean (nuke .aidd)             → aidd clean

  7. Migrate from older version         → aidd migrate

  8. System
     ├── Self-update CLI                → aidd self-update
     └── Authentication
         ├── Status                     → aidd auth status
         ├── Login                      → aidd auth login
         └── Logout                     → aidd auth logout
```

- [ ] Rewrite `INSTALLED_NODES` constant in `commands/menu.ts` to the tree above
- [ ] Drop legacy entries: `Cache (system)`, `Config (system)` (commands deleted Phase 4 + 6)
- [ ] Update labels — drop "Pull the latest framework version" → use "Update everything" (no framework concept post-marketplace)
- [ ] Verify each leaf's `command: string[]` references a command that exists post Phases 2–10
- [ ] Update fresh project tree (`FRESH_NODES`) — only `setup` entry

## Tests (unit-first)

### Unit tests

- [ ] `tests/application/use-cases/sync/sync-plugins-use-case.unit.test.ts`:
  - [ ] Source has 2 plugins, target has 0 → both installed
  - [ ] Source has 1 plugin, target already has same version → skip
  - [ ] Source has plugin v2, target has v1 → reinstall v2
  - [ ] Plugin from marketplace not in cache → fetches from source URL
  - [ ] Plugin marketplace removed → warning, skip
  - [ ] Capability not supported by target emitter → warning, skip that capability
- [ ] `tests/application/use-cases/sync/sync-use-case.unit.test.ts` (existing) — extend with `includePlugins: true/false` paths
- [ ] `tests/application/commands/menu.unit.test.ts`:
  - [ ] `InteractiveMenuUseCase.execute()` with no manifest → returns `setup` command
  - [ ] With manifest → returns selected command (mock `Prompter`)
  - [ ] Navigation back/exit handled
- [ ] Snapshot test of `INSTALLED_NODES` tree shape (order + labels) to catch unintentional drift

### Integration tests

- [ ] Sync plugins integration test: source = claude with `aidd-context` installed, target = cursor — verify cursor receives translated rules + skills + commands

### E2E tests

- One E2E in Phase 12 covering `aidd ai sync --source claude --target cursor` with plugin propagation

## Acceptance criteria

- [ ] `aidd ai sync --source claude --target cursor` propagates configs AND plugins
- [ ] `aidd ai sync --source claude --target cursor --no-plugins` propagates configs only
- [ ] `aidd plugin sync --source claude --target cursor` propagates plugins only
- [ ] Plugin re-translation skips unsupported capabilities (warning)
- [ ] Plugin already at correct version on target: skipped
- [ ] Plugin marketplace cache miss: fetches from origin
- [ ] MCP credentials NOT auto-propagated — warning printed
- [ ] `aidd` (TTY, no manifest): menu shows only "Install AIDD in this project"
- [ ] `aidd` (TTY, with manifest): menu shows 8 top-level branches per tree above
- [ ] Every menu leaf invokes a real command (no "unknown command" errors)
- [ ] Snapshot test of menu tree stable
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm biome check` clean

## Manual validation

```bash
cd /tmp && rm -rf sync-plugins && mkdir sync-plugins && cd sync-plugins
aidd setup --source remote --ai claude --ide vscode --recommended-plugins --yes
ls .claude/         # claude plugin files present
ls .cursor/         # absent (cursor not installed yet)

# Install cursor (no plugins yet)
aidd ai install cursor --yes
ls .cursor/         # cursor config only

# Sync plugins
aidd ai sync --source claude --target cursor

ls .cursor/                           # plugin files now present
aidd plugin list --tool cursor        # plugins listed for cursor

# Menu fresh
cd /tmp && rm -rf menu-fresh && mkdir menu-fresh && cd menu-fresh
aidd                                  # single option

# Menu installed
cd /tmp/sync-plugins && aidd          # 8 branches
```

## Risks / breaking changes

- Some plugin capabilities may not survive translation cleanly. Sync degrades gracefully (warnings).
- Marketplace cache miss + no network: errors with explicit "fetch failed" — user retries.
- Plugin version drift between tools: sync overwrites target version with source version.
- MCP credentials NOT propagated — user manually re-adds.
- Menu UX is breaking for users who memorized prior structure. CHANGELOG must note.
- Snapshot test requires update on legitimate menu changes — accepted maintenance cost.

## Commit

```
feat(sync,menu): plugin propagation inter-tool + interactive menu refresh

Extend ai sync to re-translate and install source tool plugins on targets:
- aidd ai sync --source <s> --target <t>     => configs + plugins (default)
- aidd ai sync --source <s> --target <t> --no-plugins  => configs only
- aidd plugin sync --source <s> --target <t> => plugins only

Add SyncPluginsUseCase orchestrating per-plugin fetch (cache-first) +
target-emitter re-translation. Skips unsupported capabilities with warnings.
Skips MCP credential propagation (user manually re-adds on target).

Rewrite INSTALLED_NODES menu tree post-cleanup:
- Drop Cache + Config entries (commands deleted)
- Restructure under noun-first groups: Manage AI tools / IDE tools / plugins
- Add Inspect (status/doctor/list)
- Add Maintain & repair (chained globals)
- Move marketplace cache under Marketplaces
- Move auth under System

Snapshot test added on INSTALLED_NODES tree.

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-11.md
```
