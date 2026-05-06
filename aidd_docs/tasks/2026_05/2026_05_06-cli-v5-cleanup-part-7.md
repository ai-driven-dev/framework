# Phase 7 — Marketplace cache subcommand

> Expose marketplace cache management (`aidd marketplace cache list|clear`) so users can inspect and purge fetched marketplace content without nuking the manifest.

## Pre-requisites

- Phase 2 (suppressions) landed — old `aidd cache` + `FrameworkCache` removed

## Goal

Marketplace fetch persists data in `<projectRoot>/.aidd/marketplaces/<name>/` (catalog + plugin tarballs/clones). Today this dir grows silently; users have no way to inspect or purge it. Phase 7 adds `aidd marketplace cache` subcommands.

## Architecture compliance

- Domain entity `MarketplaceCacheEntry` (value object): `{ name, path, sizeBytes, lastFetchedAt }` — `readonly`, validated
- Port `MarketplaceCachePort` in `src/domain/ports/marketplace-cache.ts` — defines `list()`, `clear(name?)`
- Adapter `MarketplaceCacheAdapter` in `src/infrastructure/adapters/marketplace-cache-adapter.ts` — implements port using `node:fs/promises`
- Use cases:
  - `MarketplaceCacheListUseCase` — returns `MarketplaceCacheEntry[]`
  - `MarketplaceCacheClearUseCase` — input `{ name?: string; all?: boolean }` discriminator. Validates exactly one set unless interactive prompt resolves
- Command sub: `aidd marketplace cache list` and `aidd marketplace cache clear [name] [-a/--all]`

## Steps

- [ ] Create `src/domain/models/marketplace-cache-entry.ts` value object + unit tests
- [ ] Create `src/domain/ports/marketplace-cache.ts` port interface
- [ ] Create `src/infrastructure/adapters/marketplace-cache-adapter.ts`:
  - [ ] `list()` enumerates `<projectRoot>/.aidd/marketplaces/*` dirs, computes recursive size, reads `<dir>/.fetch-meta.json` if present for `lastFetchedAt`
  - [ ] `clear(name?)` removes single dir if `name` given, else removes all
- [ ] Create `src/application/use-cases/marketplace/marketplace-cache-list-use-case.ts`
- [ ] Create `src/application/use-cases/marketplace/marketplace-cache-clear-use-case.ts`
- [ ] Update `src/application/commands/marketplace.ts`:
  - [ ] Add `cache` parent subcommand: `marketplace cache list`, `marketplace cache clear [name] [--all]`
  - [ ] Interactive flow on `clear` (no name + no `--all`, TTY): list → checkbox select → confirm
  - [ ] Non-TTY rejection on ambiguous input
- [ ] Wire `marketplaceCacheListUseCase`, `marketplaceCacheClearUseCase`, `marketplaceCacheAdapter` in `deps.ts`

## Tests (unit-first)

### Unit tests

- [ ] `tests/domain/models/marketplace-cache-entry.unit.test.ts`
- [ ] `tests/application/use-cases/marketplace/marketplace-cache-list-use-case.unit.test.ts`
- [ ] `tests/application/use-cases/marketplace/marketplace-cache-clear-use-case.unit.test.ts` — single name, all, ambiguous-input rejection

### Integration tests

- [ ] `tests/infrastructure/adapters/marketplace-cache-adapter.integration.test.ts` — real FS in temp dir: stage marketplaces, list/clear

### E2E tests

- None for Phase 7 (covered by manual validation)

## Acceptance criteria

- [ ] `aidd marketplace cache list` lists registered marketplace caches with size + lastFetchedAt
- [ ] `aidd marketplace cache list` on empty: prints "No cached marketplaces."
- [ ] `aidd marketplace cache clear aidd-framework` removes single cache dir
- [ ] `aidd marketplace cache clear --all` purges all caches
- [ ] `aidd marketplace cache clear` (no args, TTY) prompts checkbox + confirm
- [ ] `aidd marketplace cache clear` non-TTY without args errors
- [ ] Manifest registration unchanged (cache clear does NOT remove marketplace from manifest)
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm biome check` clean

## Manual validation

```bash
cd /tmp/v5-globals    # from Phase 6 manual setup

# After setup, marketplace cache exists
ls .aidd/marketplaces/

# List
aidd marketplace cache list
# expect: aidd-framework  XX KB  <ISO date>

# Clear
aidd marketplace cache clear aidd-framework
# expect: success

ls .aidd/marketplaces/   # expect empty or absent

# Refresh re-creates cache
aidd marketplace refresh
ls .aidd/marketplaces/aidd-framework
```

## Risks / breaking changes

- Cache layout assumption (`<projectRoot>/.aidd/marketplaces/<name>/`) hardcoded — if marketplace adapter ever changes layout, both must move together
- `<dir>/.fetch-meta.json` is a new artifact written by `MarketplaceRefreshUseCase` — backfill: when not present (legacy refresh before Phase 7), `lastFetchedAt` returns `null`
- `aidd clean` already removes `.aidd/` whole — no overlap

## Commit

```
feat(marketplace): expose cache list/clear subcommands

Replace deleted aidd cache command (FrameworkCache orphan) with
marketplace-scoped cache management:

- aidd marketplace cache list   — list cached marketplaces with size + last fetch
- aidd marketplace cache clear [name] [--all]
                                — purge cache for one or all marketplaces

Add MarketplaceCacheEntry value object + MarketplaceCachePort + adapter.
Add MarketplaceCacheList/Clear use-cases.

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-7.md
```
