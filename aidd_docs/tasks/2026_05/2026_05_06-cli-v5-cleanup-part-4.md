# Phase 4 — Cache + adopt + framework-cache co-delete

> Atomically delete: `aidd cache` command, `FrameworkCache` adapter, `FrameworkResolverAdapter`, `FrameworkResolver` port, `adopt/` use-case directory, `DistributionMode` type, `framework.ts` domain model, and `manifest.mode` field. All must land in a single commit — they form a dependency cluster that cannot be partially deleted.

## Pre-requisites

- Phase 3 (setup orchestrator rewrite) landed — `SetupUseCase` no longer imports `AdoptUseCase` (line 23 cleared) and no longer uses `FrameworkResolver` port (lines 7, 76 cleared)
- Phase 2 (install legacy purge) landed — `ResolveFrameworkUseCase` deleted; `install.ts` legacy branch removed; `setup.ts` legacy flags stripped

## Goal

Phase 0 inventory identified blocker B4: `FrameworkCache` cannot be deleted without `FrameworkResolverAdapter` (which imports it at lines 17, 59), and the `cache.ts` command also instantiates it directly (lines 27, 57). Similarly, `adopt/` directory cannot be deleted until `SetupUseCase` stops importing `AdoptUseCase` (done in Phase 3). This phase executes the co-deletion in a single atomic commit.

The invariant this phase enforces: after this commit, the entire "framework distribution as zip/git-clone" concept is gone from the codebase. Only marketplace-native flow remains.

## Architecture compliance

Domain pure rule is the key constraint: after deletion, no remaining code in `src/domain/` should reference `DistributionMode`, `FrameworkResolver`, or `manifest.mode`. The co-deletion must be complete — no partial stubs left. A partial deletion that leaves `FrameworkResolver` port defined but unused is equally unacceptable.

`FrameworkCache` was instantiated directly in `cache.ts` bypassing `createDeps` — this was already an architecture violation (anti-pattern per deps-wiring rules). The deletion corrects it.

## Steps

### A. Delete `aidd cache` command

- [ ] Delete `src/application/commands/cache.ts` (definition `registerCacheCommand` at line 108; direct `FrameworkCache` instantiation at lines 27, 57 — anti-pattern confirmed)
- [ ] Remove `registerCacheCommand` import from `src/cli.ts` (line 4)
- [ ] Remove `registerCacheCommand` call from `src/cli.ts` (line 41)
- [ ] Delete tests: `src/application/commands/__tests__/cache.test.ts`

### B. Delete `FrameworkCache` adapter

- [ ] Delete `src/infrastructure/cache/framework-cache.ts` (class definition at line 10)
- [ ] Callers already handled: `cache.ts` (deleted step A), `framework-resolver-adapter.ts` (deleted step C), `deps.ts` lines 64, 147 (updated step E)
- [ ] Delete tests in `tests/infrastructure/cache/` (if present)

### C. Delete `FrameworkResolverAdapter` + `FrameworkResolver` port

- [ ] Delete `src/infrastructure/adapters/framework-resolver-adapter.ts` (class at line 49; imports `FrameworkCache` at lines 17, 59; passes `options.repo` at lines 89, 120, 131)
- [ ] Delete `src/domain/ports/framework-resolver.ts`
- [ ] Delete `src/infrastructure/adapters/framework-loader-adapter.ts` (verify dead in Phase 0 — if any callers remain, document before deleting)
- [ ] Delete any `framework-loader` port (`src/domain/ports/framework-loader.ts`) if exists
- [ ] Delete tests: `tests/infrastructure/adapters/framework-resolver*.test.ts`, `tests/infrastructure/adapters/framework-loader*.test.ts`

### D. Delete `adopt/` use-case directory

- [ ] Confirm Phase 3 cleared `setup-use-case.ts` line 23 (import) and line 414 (call) — verify with `rg "AdoptUseCase" src/`
- [ ] Delete entire `src/application/use-cases/adopt/` directory including:
  - `adopt-use-case.ts` (class at line 26; calls `CatalogUseCase` at line 67 — `CatalogUseCase` is KEPT per blocker B1)
  - All other files in the directory
- [ ] Delete tests: `src/application/use-cases/adopt/__tests__/adopt-use-case.test.ts` and any other test files in the adopt test directory
- [ ] Verify: `rg "AdoptUseCase" src/ tests/` returns empty
- [ ] Note: `CatalogUseCase` is NOT deleted (has 5 active callers including `post-install-pipeline-use-case.ts` — blocker B1)

### E. Drop `manifest.mode` / `DistributionMode`

- [ ] In `src/domain/models/manifest.ts`, remove:
  - `mode?: DistributionMode` field (line 73)
  - `getMode()` method (line 252)
  - `setMode()` method (line 254)
  - Private `_mode` field
- [ ] Delete or update the `DistributionMode` type definition (wherever it lives: `manifest.ts` or dedicated file)
- [ ] Note: `setup-use-case.ts` calls to `getMode/setMode` were removed in Phase 3; `marketplace-register-framework-use-case.ts` lines 47–48 reads `manifest.mode` — remove those reads now
- [ ] Update `marketplace-register-framework-use-case.ts` lines 47–48: remove `manifest.mode` read; marketplace source type replaces it
- [ ] Update tests referencing `manifest.mode`: `__tests__/setup-use-case.test.ts`, `__tests__/marketplace-register-framework-use-case.test.ts`

### F. Delete `domain/models/framework.ts` (if dead)

- [ ] Verify `src/domain/models/framework.ts` has no remaining callers after steps A–E: `rg "from.*framework.ts|domain/models/framework" src/`
- [ ] If zero callers → delete it
- [ ] If callers remain → document in commit body which file still uses it and why

### G. Update `deps.ts`

- [ ] Remove `frameworkCache` instantiation (lines 64, 147)
- [ ] Remove `frameworkResolverAdapter` instantiation (lines 32, 48, 78, 154)
- [ ] Remove any `FrameworkResolver` port injection into use-cases
- [ ] Verify `deps.ts` compiles after removals

### H. Update `cli.ts`

- [ ] Remove any remaining `--repo` global option that `framework-resolver-adapter.ts` used to consume (lines 62, global-options.ts:18 are handled in Phase 6 for the manifest.repo callers; `cli.ts` cache/framework-resolver-related wiring only here)

## Tests

### Unit tests added

None — this phase is destructive.

### Tests deleted

- `tests/application/commands/__tests__/cache.test.ts`
- `tests/infrastructure/cache/` (if present)
- `tests/infrastructure/adapters/framework-resolver*.test.ts`
- `tests/infrastructure/adapters/framework-loader*.test.ts`
- `tests/application/use-cases/adopt/adopt-use-case.test.ts`
- Any test referencing `DistributionMode`, `getMode()`, `setMode()`

### Remaining tests reviewed

- [ ] `rg "FrameworkCache|FrameworkResolverAdapter|FrameworkResolver|AdoptUseCase|DistributionMode|getMode|setMode" src/ tests/` returns empty

## Acceptance criteria

- [ ] `rg "FrameworkCache|FrameworkResolverAdapter|FrameworkResolver\b|AdoptUseCase|DistributionMode" src/ tests/` returns empty
- [ ] `aidd cache` exits with "unknown command"
- [ ] `pnpm test` green
- [ ] `pnpm typecheck` clean
- [ ] `pnpm biome check` clean
- [ ] `pnpm build` passes
- [ ] Bundle size measurably smaller (record in commit body)

## Manual validation

```bash
# Cache command gone
aidd cache list 2>&1 | grep "unknown" && echo "OK" || echo "FAIL"

# Zero refs
rg "FrameworkCache|FrameworkResolverAdapter|AdoptUseCase" src/ && echo "FAIL" || echo "OK"

# Typecheck clean
pnpm typecheck
```

## Risks / breaking changes

- **`CatalogUseCase` is NOT deleted** even though it lives in `src/application/use-cases/shared/` — it has 5 active callers including `post-install-pipeline-use-case.ts` (pipeline rule). Confirm before deletion with `rg "CatalogUseCase" src/`.
- Deleting `DistributionMode` breaks `marketplace-register-framework-use-case.ts` lines 47–48 if not cleaned in step E — must be done atomically.
- `adopt-use-case.ts` calls `CatalogUseCase` at line 67 — CatalogUseCase must already have other callers so its deletion does not cascade.

## Commit

```
refactor(cli): co-delete FrameworkCache + FrameworkResolverAdapter + adopt/ + DistributionMode

Atomic cluster deletion — all items reference each other and must be
removed in a single commit to avoid broken intermediary state:

- Delete src/application/commands/cache.ts (FrameworkCache direct instantiation anti-pattern)
- Delete src/infrastructure/cache/framework-cache.ts
- Delete src/infrastructure/adapters/framework-resolver-adapter.ts (FrameworkCache at :17,:59)
- Delete src/domain/ports/framework-resolver.ts
- Delete src/infrastructure/adapters/framework-loader-adapter.ts (verify dead)
- Delete src/application/use-cases/adopt/ (SetupUseCase no longer imports AdoptUseCase post Phase 3)
- Drop manifest.mode / DistributionMode / getMode / setMode (manifest.ts:73,252,254)
- Update marketplace-register-framework-use-case.ts:47-48 (remove manifest.mode read)
- Update deps.ts: remove frameworkCache and frameworkResolverAdapter wiring
- Update cli.ts: unregister cache command

CatalogUseCase kept — has 5 active callers including post-install-pipeline-use-case.ts.

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-4.md
```
