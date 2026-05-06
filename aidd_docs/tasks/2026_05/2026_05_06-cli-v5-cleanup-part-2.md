# Phase 2 — Vertical suppressions

> Mass removal of orphan / legacy code. Each suppression backed by Phase 0 inventory grep proof.

## Pre-requisites

- Phase 0 inventory complete
- Phase 1 manifest schema landed (callers of `manifest.docsDir/repo/mode` no longer compile — must be removed in Phase 2 to keep main green)

## Goal

Delete every code path made dead by the marketplace-only architecture and the v5 manifest rewrite. After Phase 2, the CLI surface still works (Phase 3 setup refactor depends on it) but has shrunk by thousands of lines.

## Architecture compliance

- Each deletion follows the layer dependency rule: domain first → application → infrastructure → command
- Tests for deleted code are deleted in same commit (no orphan tests)
- `deps.ts` updated atomically — no dangling factory wires
- Errors classes referenced only by deleted code paths are also deleted (`src/domain/errors.ts`, `src/application/errors.ts`)

## Suppressions checklist

### A. `aidd cache` command + FrameworkCache adapter

- [ ] Delete `src/infrastructure/cache/framework-cache.ts`
- [ ] Delete `src/application/commands/cache.ts`
- [ ] Remove `registerCacheCommand` import + call in `src/cli.ts`
- [ ] Remove `frameworkCache` (if any) from `deps.ts`
- [ ] Delete tests: `tests/infrastructure/cache/`, `tests/application/commands/cache*.test.ts`
- [ ] Verify zero remaining `FrameworkCache` references: `rg "FrameworkCache" src/ tests/` returns empty

### B. `aidd config` command

- [ ] Delete `src/application/commands/config.ts`
- [ ] Remove `registerConfigCommand` import + call in `src/cli.ts`
- [ ] Delete tests: `tests/application/commands/config*.test.ts`
- [ ] Verify menu node `config` removed (Phase 9 will sweep again)

### C. Memory stubs assets + use-case

- [ ] Delete entire dir `src/assets/memory-stubs/`
- [ ] Delete `src/application/use-cases/install/install-memory-stub-use-case.ts` (verify exists in Phase 0)
- [ ] Remove memory stub asset loader entry in `src/assets/index.ts` (if exists)
- [ ] Remove memory stub writes from `InstallRuntimeConfigUseCase` if present
- [ ] Delete tests: `tests/application/use-cases/install-memory-stub*.test.ts`
- [ ] Verify `rg "memory-stubs|InstallMemoryStub" src/ tests/` returns empty

### D. `CatalogUseCase` + `InstallPluginsUseCase` (legacy framework plugins)

- [ ] Delete `src/application/use-cases/shared/catalog-use-case.ts`
- [ ] Delete `src/application/use-cases/install/install-plugins-use-case.ts`
- [ ] Delete `src/application/use-cases/install-framework-plugins-use-case.ts`
- [ ] Remove deps wiring (`pluginCatalogRepository`, `installFrameworkPluginsUseCase` in `deps.ts`)
- [ ] Delete tests: corresponding `*.test.ts` files
- [ ] Update `SetupUseCase` callsites (Phase 3 will rewrite anyway — temporary stub OK)

### E. `InstallUseCase` (legacy) + legacy install branch

- [ ] Delete `src/application/use-cases/install/install-use-case.ts`
- [ ] In `src/application/commands/install.ts`: delete the `if (cmdOptions.path !== undefined || cmdOptions.release !== undefined)` legacy branch + `--path/--release` option declarations
- [ ] Delete `--mcp`, `--plugins`, `--all-plugins`, `--recommended-plugins`, `--no-plugins` options on `install` command (only relevant under legacy branch)
- [ ] Keep `installFromAssets()` path as the only branch
- [ ] Delete tests: `tests/application/use-cases/install-use-case*.test.ts`
- [ ] Verify `rg "InstallUseCase\b" src/ tests/` returns only references to `InstallRuntimeConfigUseCase` / `InstallIdeConfigUseCase`

### F. `ResolveFrameworkUseCase` + framework adapters

- [ ] Delete `src/application/use-cases/resolve-framework-use-case.ts`
- [ ] Delete `src/infrastructure/adapters/framework-resolver-adapter.ts`
- [ ] Delete `src/infrastructure/adapters/framework-loader-adapter.ts` (verify dead in Phase 0)
- [ ] Delete `src/domain/ports/framework-resolver.ts` and any `framework-loader` port
- [ ] Delete `src/domain/models/framework.ts` (if dead post Phase 0)
- [ ] Remove `resolver`, `frameworkLoader` deps wiring
- [ ] Delete tests: `tests/application/use-cases/resolve-framework-use-case*.test.ts`, adapter tests
- [ ] Update `install.ts` and `setup.ts` to not import `ResolveFrameworkUseCase`

### G. `adopt/` use-case dir

- [ ] Confirm Phase 0 inventory shows zero callers (must be true after master plan `2026_05_01` execution)
- [ ] Delete entire dir `src/application/use-cases/adopt/`
- [ ] Delete tests: `tests/application/use-cases/adopt*.test.ts` and `tests/application/use-cases/adopt/`
- [ ] Remove `adopted` result kind handling in `setup.ts` (Phase 3 cleanup)

### H. Setup legacy flags

- [ ] In `src/application/commands/setup.ts`, remove options: `--from`, `--switch-mode`, `--mode <local|remote>`, `--path`, `--release`
- [ ] Drop `mode` and `switchMode` and `from` and `path` and `release` from action handler
- [ ] Phase 3 will re-introduce `--source remote|local` and `--path` cleanly with new semantics

### I. Plugin distribution legacy adapters

- [ ] Inventory check: `src/infrastructure/adapters/plugin-distribution-reader-adapter.ts` — keep or delete?
- [ ] If only used by deleted `RestorePluginUseCase` legacy branch — delete. Phase 4 reworks restore plugin to cache-first.
- [ ] If still consumed by marketplace flow — keep.
- [ ] Verify and delete or keep accordingly. Document decision in commit body.

### J. Auth helper / errors cleanup

- [ ] List error classes in `src/domain/errors.ts` referenced only by deleted code paths
- [ ] Delete: `InvalidRepoFormatError` (no more `repo` field), any docs-related errors, framework-resolution errors
- [ ] Verify `rg "<ErrorClassName>" src/ tests/` empty before deletion

### K. `cli.ts` cleanup

- [ ] Remove imports + calls for: `registerCacheCommand`, `registerConfigCommand`
- [ ] Remove `--repo` global option (no longer used)
- [ ] Verify `program.opts<{ verbose?: boolean; repo?: string }>()` reduced to `{ verbose?: boolean }`

## Tests

### Unit tests added

- None — Phase 2 is destructive.

### Tests deleted (alongside code)

- All tests covering deleted classes / commands / use-cases
- Adapt fixture references in remaining tests if they still cite dead schema fields

### Integration tests reviewed

- [ ] Confirm no remaining integration test instantiates `FrameworkCache`, `ResolveFrameworkUseCase`, `CatalogUseCase`, `InstallUseCase`, `InstallPluginsUseCase`, adopt classes
- [ ] Update fixtures: any `.aidd/manifest.json` fixture mentioning `repo`/`docsDir`/`mode`/`scripts`/top-level `plugins` regenerated or moved to `legacy-vN/` for migration tests only

## Acceptance criteria

- [ ] `pnpm test` green (post-deletion test suite)
- [ ] `pnpm typecheck` clean
- [ ] `pnpm biome check` clean
- [ ] `rg "FrameworkCache|ResolveFrameworkUseCase|CatalogUseCase|InstallPluginsUseCase|InstallMemoryStub|memory-stubs|adopt" src/` returns empty
- [ ] `cli.ts` does not register `cache` or `config` commands
- [ ] `aidd setup --help` does not list `--from / --switch-mode / --mode / --path / --release`
- [ ] `aidd install --help` does not list `--path / --release / --mcp / --plugins / --all-plugins / --recommended-plugins / --no-plugins`
- [ ] Build passes: `pnpm build`
- [ ] Bundle size shrinks (record before/after in commit body)

## Manual validation

```bash
cd /tmp && rm -rf cli-v5-test && mkdir cli-v5-test && cd cli-v5-test

# 1. Cache command gone
aidd cache list && echo "FAIL: cache should be unknown" || echo "OK"

# 2. Config command gone
aidd config list && echo "FAIL" || echo "OK"

# 3. Setup help no legacy flags
aidd setup --help | grep -E "from|switch-mode|mode" && echo "FAIL" || echo "OK"

# 4. Install help no legacy flags
aidd install --help | grep -E "path|release|plugins|mcp" && echo "FAIL" || echo "OK"
```

## Risks / breaking changes

- **Major breaking change** for users still relying on `--path`/`--release` install flags. Acceptable: marketplace-only flow is the official path post `2026_05_01`. Document in CHANGELOG.
- Deletion of `adopt/` dir blocks any future "adopt existing project" feature — re-introduce with marketplace semantics if needed (out of scope here).
- Bundle size drop expected ≥30% (record actual measurement in commit).

## Commit

```
refactor(cli): drop dead code from marketplace-only architecture

Vertical suppressions of legacy paths:
- aidd cache command + FrameworkCache adapter (orphan post marketplace)
- aidd config command (no remaining writable manifest field)
- src/assets/memory-stubs/ + InstallMemoryStubUseCase (plugin owns memory)
- CatalogUseCase + InstallPluginsUseCase + InstallUseCase (legacy framework fetch)
- ResolveFrameworkUseCase + framework-resolver/loader adapters
- adopt/ use-case dir (no callers post 2026_05_01)
- setup --from / --switch-mode / --mode / --path / --release flags
- install --path / --release / --plugins / --mcp / --all-plugins / --recommended-plugins / --no-plugins flags
- cli.ts --repo global option

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-2.md
```
