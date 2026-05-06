# Phase 5 — Framework plugins legacy purge

> Delete `InstallFrameworkPluginsUseCase` + `install-plugins-use-case.ts`. Drop `manifest.scripts` and top-level `manifest.plugins` write paths. `MigrateUseCase` keeps READ access for backward-compat migration.

## Pre-requisites

- Phase 3 (setup orchestrator rewrite) landed — `setup-use-case.ts:72` no longer calls `InstallFrameworkPluginsUseCase`
- Phase 4 (cache + adopt + framework-cache co-delete) landed — `adopt/` deleted, `manifest.mode` removed

## Goal

Phase 0 inventory blocker B4 noted that `manifest.plugins` (top-level) and `manifest.scripts` are still actively WRITTEN, not just read for migration:

- `install-framework-plugins-use-case.ts:55,127` — actively writes `manifest.plugins`
- `migrate-use-case.ts:42,91` — reads legacy `plugins` to migrate
- `marketplace-register-framework-use-case.ts:52` — reads `scripts` for marketplace inference

Phase 5 deletes the active-write code paths and shrinks the manifest fields to read-only stubs that `MigrateUseCase` (Phase 8) consumes for legacy migration. After this phase, no NEW manifest will contain `scripts` or top-level `plugins`.

## Architecture compliance

`Manifest` aggregate currently owns `addScripts`, `getScriptsFiles`, `clearScripts`, `addPlugins`, `clearPlugins` mutators. Phase 5 removes the mutators (no new writes) but keeps READ accessors (`getScriptsFiles`, `getPluginsFiles`, `hasScripts`, `hasPlugins`) — `MigrateUseCase` needs them to detect legacy data. The full READ accessor removal happens in Phase 7 schema rewrite, by which point migration logic has already consumed the data.

Domain pure rule: `Manifest` aggregate stays free of I/O and infrastructure imports. Mutator removal is internal cleanup.

## Steps

### A. Delete `InstallFrameworkPluginsUseCase`

- [ ] Delete `src/application/use-cases/install-framework-plugins-use-case.ts`
  - Definition at line 8; calls `manifest.addPlugins` at lines 55, 127; persistPlugins helper at line 123
- [ ] Delete tests: `tests/application/use-cases/install-framework-plugins-use-case*.test.ts`
- [ ] Verify `setup-use-case.ts` (post Phase 3) does not import this — `rg "InstallFrameworkPluginsUseCase" src/`
- [ ] Verify `deps.ts` does not wire it — `rg "installFrameworkPluginsUseCase" src/infrastructure/deps.ts`

### B. Delete `InstallPluginsUseCase` (already removed Phase 2)

- [ ] Sanity check from Phase 2: `rg "InstallPluginsUseCase\b" src/ tests/` returns empty
- [ ] If any residue, remove now

### C. Remove `manifest.scripts` write paths

- [ ] In `src/domain/models/manifest.ts`:
  - [ ] Delete `addScripts(version, files)` method (line 212)
  - [ ] Delete `clearScripts()` method (line 228)
  - [ ] **Keep**: `getScriptsFiles()`, `getScriptsVersion()`, `hasScripts()` (read-only accessors used by Phase 8 migrate)
- [ ] In `marketplace-register-framework-use-case.ts:52`: remove `manifest.scripts` read (no longer relevant — marketplace registration uses source type, not scripts inference)

### D. Remove top-level `manifest.plugins` write paths

- [ ] In `src/domain/models/manifest.ts`:
  - [ ] Delete `addPlugins(version, files)` method (line 232)
  - [ ] Delete `clearPlugins()` method (line 236)
  - [ ] **Keep**: `getPluginsFiles()`, `getPluginsVersion()`, `hasPlugins()` (read-only accessors used by Phase 8 migrate)
- [ ] Search for any remaining caller: `rg "addPlugins\b|clearPlugins\b" src/`

### E. Update `deps.ts`

- [ ] Remove `installFrameworkPluginsUseCase` wiring
- [ ] Verify `pluginCatalogRepository` still wired (used by `CatalogUseCase` which is KEPT per blocker B1)

### F. Update remaining callers

- [ ] If any test fixture writes `manifest.plugins` (top-level) or `manifest.scripts` directly, update to use the new `tools[*].plugins[*]` nested form
- [ ] Migration tests that read legacy fixtures unchanged (Phase 8 migrate handles them)

## Tests

### Unit tests

- [ ] `tests/domain/models/manifest.unit.test.ts` — verify `addScripts`/`addPlugins`/`clearScripts`/`clearPlugins` no longer exist on the API
- [ ] Verify `getScriptsFiles()`/`getPluginsFiles()` still return data when deserialized from legacy v3/v4 fixtures (READ accessors preserved)

### Integration tests

- [ ] `tests/application/use-cases/migrate-use-case.integration.test.ts` (existing) — verify legacy plugins/scripts read paths still work for migration

### Tests deleted

- `tests/application/use-cases/install-framework-plugins-use-case*.test.ts`

## Acceptance criteria

- [ ] `pnpm test` green
- [ ] `pnpm typecheck` clean
- [ ] `pnpm biome check` clean
- [ ] `rg "InstallFrameworkPluginsUseCase|installFrameworkPluginsUseCase" src/ tests/` returns empty
- [ ] `rg "addScripts\b|addPlugins\b|clearScripts\b|clearPlugins\b" src/` returns empty (mutators gone)
- [ ] `rg "getScriptsFiles|getPluginsFiles|hasScripts|hasPlugins" src/domain/models/manifest.ts` returns hits (read accessors preserved)
- [ ] `pnpm build` passes
- [ ] No new manifest written by setup/install/update flows contains `scripts` or top-level `plugins` keys (verify via integration test)

## Manual validation

```bash
cd /tmp && rm -rf phase5-test && mkdir phase5-test && cd phase5-test
aidd setup --source remote --ai claude --no-plugins --yes

cat .aidd/manifest.json | jq 'has("scripts"), has("plugins")'
# expect: false, false (no top-level scripts/plugins)

cat .aidd/manifest.json | jq '.tools.claude.plugins'
# expect: [] (empty array, nested per-tool location stays)
```

## Risks / breaking changes

- Any external tooling parsing `manifest.scripts` or top-level `manifest.plugins` arrays for new manifests will break. Document in CHANGELOG.
- Tests that mocked `addPlugins` directly need rewriting to use `addTool(...).plugins`.
- Read accessors stay until Phase 7 schema rewrite — DO NOT delete them in this phase.

## Commit

```
refactor(manifest): remove framework plugins legacy write paths

Delete InstallFrameworkPluginsUseCase + install-plugins-use-case.ts.
Remove manifest.addScripts/addPlugins/clearScripts/clearPlugins mutators.
Keep getScriptsFiles/getPluginsFiles/hasScripts/hasPlugins read accessors
for Phase 8 migrate backward-compat (legacy v3/v4 manifest support).

After this phase, no new manifest contains top-level scripts or plugins.
Plugin tracking moved fully to per-tool nested location: tools[id].plugins[].

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-5.md
```
