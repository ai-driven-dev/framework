# Phase 0 — Inventory + Verification Grep

> Pre-implementation audit. Zero code changes. Output = exhaustive list of files, symbols, callers, and dependents to ensure NO blind deletion in subsequent phases.

## Pre-requisites

- None. First phase.

## Goal

Produce a verified, grep-backed inventory for every deletion/rework planned in Phases 1–11. Each suppression listed in master plan must be backed by a concrete grep result documenting:

1. Where the symbol/file is defined
2. Every caller / importer
3. Whether it has tests
4. Whether removal breaks public exports
5. Whether removal breaks fixtures

## Deliverable

Single document: `aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-0-inventory.md` (separate from this plan file). Structured per target. Output format:

```
## <symbol or file>

- Definition: <file:line>
- Callers: <list of file:line>
- Tests: <list of *.test.ts files>
- Public export: <true/false>
- Fixtures referencing: <list>
- Safe to delete: <true/false>
- Notes: <breaking changes / migration notes>
```

## Steps

### A. CLI suppressions inventory

- [ ] **`FrameworkCache` adapter** — grep `FrameworkCache`, `framework-cache.ts`, `.aidd/cache`. Verify no caller outside `aidd cache` command and adopt/restore use-cases.
- [ ] **`aidd cache` command** — grep `registerCacheCommand`, `commands/cache.ts`. Verify zero menu refs post Phase 9.
- [ ] **`aidd config` command** — grep `registerConfigCommand`, `commands/config.ts`. List manifest field reads via `manifest.repo`, `manifest.docsDir`.
- [ ] **`manifest.repo` field** — grep `\.repo` on Manifest instances. Inventory every read site (must be replaced or removed).
- [ ] **`manifest.docsDir` field** — same. Hardcoded `aidd_docs` already (lock #10 in `2026_05_01`), confirm zero functional reads.
- [ ] **`manifest.mode` field** — grep `getMode\|setMode\|DistributionMode`. Verify limited to setup-use-case + adapt + manifest serialization.
- [ ] **`manifest.scripts` section** — grep `addScripts\|getScriptsFiles\|getScriptsVersion\|hasScripts\|clearScripts`. Identify last writers.
- [ ] **`manifest.plugins` top-level section** — grep `addPlugins\b\|getPluginsFiles\|getPluginsVersion\|hasPlugins\|clearPlugins`. Distinguish from per-tool `plugins[]` (different field).
- [ ] **`manifest.docs` section (already removed v5)** — grep for residual references, confirm dead.
- [ ] **`src/assets/memory-stubs/`** — grep `memory-stubs`, `installMemoryStub`, `MemoryStub`. Inventory adapter usage.
- [ ] **`InstallMemoryStubUseCase`** — find file, grep callers.
- [ ] **`InstallPluginsUseCase`** — find file, grep callers.
- [ ] **`InstallUseCase` (legacy)** — distinct from `InstallRuntimeConfigUseCase`. Grep callers, verify only `install.ts` legacy branch.
- [ ] **`ResolveFrameworkUseCase` + `framework-resolver-adapter.ts` + `framework-loader-adapter.ts`** — grep callers (master plan `2026_05_01` lists 8 dependents pre-cleanup; verify which still active post `2026_05_01` execution).
- [ ] **`CatalogUseCase`** — `src/application/use-cases/shared/catalog-use-case.ts`. Grep callers.
- [ ] **`adopt/` use-case dir** — grep `AdoptUseCase`, `AdoptToolsUseCase`. Verify zero callers in active commands. Master plan listed adopt as dependent of FrameworkResolver — recheck status.
- [ ] **`install --path` / `install --release` flags** — grep `cmdOptions.path`, `cmdOptions.release` in `commands/install.ts`. Document branch boundaries.
- [ ] **`setup --from` / `setup --switch-mode` / `setup --mode` flags** — grep in `commands/setup.ts`. Document branch boundaries.

### B. CLI rework targets inventory

- [ ] **`SetupUseCase`** (~18KB) — list every method, identify legacy branches (adopt, mode-switch, from-version) vs marketplace-only path.
- [ ] **`UninstallUseCase`** — separate AI uninstall vs IDE uninstall logic for noun-first split.
- [ ] **`SyncUseCase`** — identify plugin propagation gap. Master plan `2026_05_01` part-2 mentioned plugin sync as out-of-scope — confirm.
- [ ] **`RestoreUseCase`** + **`RestorePluginUseCase`** — inventory `pluginFetcher` + `pluginDistributionReader` deps. Confirm cache-first fallback feasible.
- [ ] **`MigrateUseCase`** — inventory current migration scope, identify additions for dropping `mode/scripts/plugins-top/repo/docsDir`.
- [ ] **`InstallRuntimeConfigUseCase`** + **`InstallIdeConfigUseCase`** — verify they don't write memory stubs (lock #3). If they do, list paths to remove.
- [ ] **Menu structure (`commands/menu.ts`)** — list every leaf node, mark for relabel/reorder/delete.

### C. Manifest schema inventory

- [ ] List every field currently serialized (`ManifestData` interface + `ToolEntryData`).
- [ ] For each field: keep / drop / rename in v5 final.
- [ ] Identify migration logic to add in `migrateV4toV5` (or rework v5 in place per lock #1).
- [ ] List every fixture file (`tests/fixtures/**/manifest.json`) and whether they need regeneration.

### D. Test inventory

- [ ] Count current tests by category: unit / integration / e2e.
- [ ] List E2E tests — identify which cover main journeys vs edge cases (E2E candidates for deletion).
- [ ] List integration tests that hit FS but could become unit tests with in-memory FS port.
- [ ] List unit tests on use-cases that currently spin up real adapters (anti-pattern — must use in-memory ports).
- [ ] Identify fixtures referencing dead manifest fields.

### E. Framework inventory

- [ ] Confirm `framework/scripts/build-dist.sh` deleted (`27bcee6`). Reference historical content from git.
- [ ] List `framework/.github/workflows/ci.yml` steps that depend on `dist/<tool>-{local,remote}/`.
- [ ] Verify framework still publishes per-tool tarballs in CI (currently broken if `build-dist.sh` missing).

### F. Cross-cutting inventory

- [ ] **Public API exports** — list `src/index.ts` (if exists) or all named exports from top-level files. Each deletion must verify no external consumer.
- [ ] **`deps.ts`** — list every dep wired. Suppressions must remove dep wiring.
- [ ] **`createDeps`** vs **`createMenuDeps`** — track which adapters become orphan post-cleanup.
- [ ] **`registerXxxCommand`** functions — list every register function called from `cli.ts`. Cross-check against suppressions.
- [ ] **Errors** — list custom error classes in `src/domain/errors.ts` and `src/application/errors.ts` referenced only by deleted code paths.

## Acceptance criteria

- [ ] Inventory document `2026_05_06-cli-v5-cleanup-part-0-inventory.md` exists and committed
- [ ] Every entry under sections A–F backed by `grep` or `rg` command output (commands documented inline for reproducibility)
- [ ] Every "safe to delete: true" claim cross-checked against tests
- [ ] Every "safe to delete: false" claim has concrete blocker listed
- [ ] No file path or symbol referenced in master plan deletion list is absent from inventory
- [ ] Framework side documented (`build-dist.sh` historical, ci.yml current state)

## Manual validation

```bash
# Run from repo root
cd /Users/baptistelafourcade/Projects/freelance/aidd/aidd/cli

# 1. Verify zero functional reads of dead fields
rg "manifest\.docsDir|manifest\.repo|manifest\._scripts|manifest\._plugins|manifest\._mode" src/

# 2. Verify FrameworkCache only consumed by cache command
rg "FrameworkCache" src/

# 3. Verify ResolveFrameworkUseCase callers
rg "ResolveFrameworkUseCase|resolveFrameworkUseCase" src/

# 4. Verify memory-stubs assets only consumed by InstallMemoryStubUseCase
rg "memory-stubs|InstallMemoryStubUseCase" src/

# 5. Count test files by category
fd -t f "\.unit\.test\.ts$" tests | wc -l
fd -t f "\.integration\.test\.ts$" tests | wc -l
fd -t f "\.e2e\.test\.ts$" tests | wc -l

# 6. List E2E test files (candidates for reduction in Phase 11)
fd -t f "\.e2e\.test\.ts$" tests
```

## Risks / breaking changes

- Phase 0 is read-only — zero code change. Zero risk.
- However, inventory blind spots lead to broken Phases 1–11. Mitigation: every grep result must be peer-reviewed before phase work starts.

## Commit

```
docs(plan): cli v5 cleanup phase 0 inventory

Audit of every file/symbol/test impacted by upcoming CLI v5 cleanup phases.
Backs every deletion in master plan with grep-verified caller inventory.
Identifies adopt/ blast radius and plugin re-translation gaps before code changes.

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-0.md
```
