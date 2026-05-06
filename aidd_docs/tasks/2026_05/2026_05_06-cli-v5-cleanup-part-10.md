# Phase 10 — Globals chained + marketplace cache + plugin sub-cmds

> Reframe global commands (`update`, `status`, `sync`, `restore`, `doctor`) as orchestrators that chain per-domain unitaries. Add `aidd marketplace cache list|clear`. Wire plugin status/sync/restore/doctor sub-cmds (sync uses stub; full implementation Phase 11).

## Pre-requisites

- Phase 9 (noun-first surface) landed — `aidd ai/ide/plugin <op>` exist

## Goal

Three combined deliverables in one phase:

1. **Globals chain unitaries** — `aidd update` → `ai update + ide update + plugin update + marketplace refresh`; same shape for `status`, `sync`, `restore`, `doctor`.
2. **Marketplace cache subcommand** — `aidd marketplace cache list|clear` exposes plugin/marketplace fetch cache (replaces deleted `aidd cache`).
3. **Plugin sub-cmd wiring stubs** — `plugin status/sync/restore/doctor` already added Phase 9 surface; here ensure deps wired.

## Architecture compliance

### Global orchestrators

Each global command calls ONE orchestrator use-case in `src/application/use-cases/global/`. Orchestrators compose per-domain use-cases (do not duplicate logic). They tolerate per-domain failures: error in `plugin update` doesn't abort `ai update` already done — collect errors, surface aggregate result at end.

```ts
// src/application/use-cases/global/update-all-use-case.ts
export interface UpdateAllResult {
  ai: ToolUpdateResult[];
  ide: ToolUpdateResult[];
  plugins: PluginUpdateResult[];
  marketplaceRefresh: MarketplaceRefreshResult;
  errors: GlobalExecutionError[];
}
```

### Marketplace cache

Domain entity `MarketplaceCacheEntry` (value object: `name, path, sizeBytes, lastFetchedAt` — readonly, validated).
Port `MarketplaceCachePort` in `src/domain/ports/marketplace-cache.ts` defines `list()`, `clear(name?)`.
Adapter `MarketplaceCacheAdapter` implements via `node:fs/promises`.

Use cases:
- `MarketplaceCacheListUseCase` — returns `MarketplaceCacheEntry[]`
- `MarketplaceCacheClearUseCase` — input discriminator `{ name?: string; all?: boolean }`

Methods ≤20 lines. Domain pure.

## Steps

### A. Create `src/application/use-cases/global/`

- [ ] `update-all-use-case.ts` — chains `UpdateAiUseCase`, `UpdateIdeUseCase`, `PluginUpdateUseCase`, `MarketplaceRefreshUseCase`. Returns aggregated result. Continues on per-step error.
- [ ] `status-all-use-case.ts` — chains `StatusUseCase` filter `"ai"` then `"ide"` plus plugin status. Aggregates `StatusReport`.
- [ ] `sync-all-use-case.ts` — interactive only (throw if non-TTY). Prompts source, then chains `SyncUseCase` (configs) + `SyncPluginsUseCase` (Phase 11 stub).
- [ ] `restore-all-use-case.ts` — chains `RestoreUseCase` (configs) + `RestorePluginsAllUseCase` (each tracked plugin). Interactive prompts to pick files.
- [ ] `doctor-all-use-case.ts` — chains `DoctorUseCase` for AI / IDE / plugins. Aggregates issues.

### B. Update global commands

- [ ] `commands/update.ts` — call `UpdateAllUseCase`, display aggregated `UpdateAllResult`
- [ ] `commands/status.ts` — call `StatusAllUseCase`, display report (sections per scope). Drop `[category]` argument
- [ ] `commands/sync.ts` — call `SyncAllUseCase` (interactive only), error in non-TTY without explicit `--source` (point user to `aidd ai sync --source`)
- [ ] `commands/restore.ts` — call `RestoreAllUseCase`, display aggregated result. Drop `--tool` flag
- [ ] `commands/doctor.ts` — call `DoctorAllUseCase`, exit non-zero if any error issue. Drop `[category]` argument

### C. Marketplace cache subcommand

- [ ] Create `src/domain/models/marketplace-cache-entry.ts` value object + unit tests
- [ ] Create `src/domain/ports/marketplace-cache.ts` port interface
- [ ] Create `src/infrastructure/adapters/marketplace-cache-adapter.ts`:
  - `list()` enumerates `<projectRoot>/.aidd/marketplaces/*` dirs, computes recursive size, reads `<dir>/.fetch-meta.json` for `lastFetchedAt`
  - `clear(name?)` removes single dir if `name` given, else removes all
- [ ] Create `src/application/use-cases/marketplace/marketplace-cache-list-use-case.ts`
- [ ] Create `src/application/use-cases/marketplace/marketplace-cache-clear-use-case.ts`
- [ ] Update `src/application/commands/marketplace.ts`:
  - [ ] Add `cache` parent subcommand: `marketplace cache list`, `marketplace cache clear [name] [--all]`
  - [ ] Interactive flow on `clear` (no name + no `--all`, TTY): list → checkbox → confirm
  - [ ] Non-TTY rejection on ambiguous input
- [ ] Wire `marketplaceCacheListUseCase`, `marketplaceCacheClearUseCase`, `marketplaceCacheAdapter` in `deps.ts`

### D. Plugin sub-cmd deps wiring

- [ ] Verify `aidd plugin status` calls `StatusUseCase` with `pluginName` filter
- [ ] Verify `aidd plugin sync --source <tool>` wired to `SyncPluginsUseCase` (Phase 11 implements; stub returns "not yet implemented" warning if invoked pre-Phase 11)
- [ ] Verify `aidd plugin restore --plugin <name>` wired to `RestorePluginUseCase`
- [ ] Verify `aidd plugin doctor [--plugin <name>]` wired to `DoctorUseCase` with `pluginName`

## Tests (unit-first)

### Unit tests

- [ ] `tests/application/use-cases/global/update-all-use-case.unit.test.ts` — happy path, partial failure (continues), all-fail aggregate result
- [ ] `tests/application/use-cases/global/status-all-use-case.unit.test.ts` — combined report shape
- [ ] `tests/application/use-cases/global/sync-all-use-case.unit.test.ts` — non-TTY rejection, interactive flow
- [ ] `tests/application/use-cases/global/restore-all-use-case.unit.test.ts` — interactive flow with mocked prompter
- [ ] `tests/application/use-cases/global/doctor-all-use-case.unit.test.ts` — exit code derivation
- [ ] `tests/domain/models/marketplace-cache-entry.unit.test.ts`
- [ ] `tests/application/use-cases/marketplace/marketplace-cache-list-use-case.unit.test.ts`
- [ ] `tests/application/use-cases/marketplace/marketplace-cache-clear-use-case.unit.test.ts` — single, all, ambiguous rejection

### Integration tests

- [ ] One integration test per orchestrator using in-memory FS port + real (or stubbed) sub-use-cases
- [ ] `tests/infrastructure/adapters/marketplace-cache-adapter.integration.test.ts` — real FS in temp dir

### E2E tests

- One E2E covering `aidd update` global chain in Phase 12

## Acceptance criteria

- [ ] `aidd update` chains AI + IDE + plugin update + marketplace refresh
- [ ] `aidd update` surfaces partial failures cleanly
- [ ] `aidd status` reports across all 3 scopes
- [ ] `aidd doctor` exits 0 if all healthy, 1 if any error
- [ ] `aidd sync` non-TTY: errors with helpful redirect to `aidd ai sync --source <tool>`
- [ ] `aidd restore` interactive: prompts, applies selection
- [ ] `aidd marketplace cache list` lists registered marketplace caches with size + lastFetchedAt
- [ ] `aidd marketplace cache list` empty: prints "No cached marketplaces."
- [ ] `aidd marketplace cache clear <name>` removes single dir
- [ ] `aidd marketplace cache clear --all` purges all
- [ ] `aidd marketplace cache clear` (TTY no-args) prompts checkbox + confirm
- [ ] `aidd marketplace cache clear` non-TTY no-args errors
- [ ] Manifest registration unchanged (cache clear does NOT touch manifest)
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm biome check` clean

## Manual validation

```bash
cd /tmp && rm -rf v5-globals && mkdir v5-globals && cd v5-globals
aidd setup --source remote --all --no-plugins --yes

# Update global
aidd update                       # AI + IDE + plugin update + marketplace refresh

# Status global
aidd status                       # sections "AI tools:", "IDE tools:", "Plugins:"

# Doctor
aidd doctor && echo "OK"

# Sync TTY
aidd sync                         # prompts source

# Sync non-TTY rejected
echo | aidd sync 2>&1 | grep -i "use aidd ai sync"

# Marketplace cache
ls .aidd/marketplaces/
aidd marketplace cache list
aidd marketplace cache clear aidd-framework
ls .aidd/marketplaces/             # empty or absent
aidd marketplace refresh
ls .aidd/marketplaces/aidd-framework
```

## Risks / breaking changes

- `aidd status [category]` and `aidd doctor [category]` arg form gone — use `aidd ai status` etc.
- `aidd sync --source <tool>` flag relocated to `aidd ai sync --source <tool>` and `aidd plugin sync --source <tool>`.
- `aidd restore --tool <tool>` flag relocated.
- `<dir>/.fetch-meta.json` is a new artifact written by `MarketplaceRefreshUseCase` — backfill: when not present, `lastFetchedAt` returns `null`.
- `aidd clean` already removes `.aidd/` whole — no overlap.

## Commit

```
feat(cli): chain globals + marketplace cache + plugin sub-cmds

Globals now orchestrate per-domain operations:
- aidd update => ai update + ide update + plugin update + marketplace refresh
- aidd status => ai status + ide status + plugin status
- aidd sync   => prompts source then ai sync + plugin sync
- aidd restore=> ai restore + plugin restore
- aidd doctor => ai doctor + ide doctor + plugin doctor

Drop [category] arg and tool/source flags from globals — use noun-first
unitaries for scope filtering instead.

Add marketplace cache subcommand:
- aidd marketplace cache list   — list cached marketplaces with size + last fetch
- aidd marketplace cache clear [name] [--all] — purge cache for one or all

Add MarketplaceCacheEntry value object + MarketplaceCachePort + adapter.
Add UpdateAll/StatusAll/SyncAll/RestoreAll/DoctorAll orchestrator use-cases.
Each tolerates per-step failures and aggregates results.

Wire plugin status/sync/restore/doctor sub-cmds (sync stub until Phase 11).

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-10.md
```
