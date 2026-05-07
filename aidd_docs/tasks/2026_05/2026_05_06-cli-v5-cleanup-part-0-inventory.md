# CLI v5 Cleanup — Phase 0 Inventory

Grep-backed audit for every file/symbol/test impacted by the upcoming
cleanup phases. All claims backed by `grep` runs on commit `feat/plugin-architecture`.

---

## Blockers (plan-vs-reality conflicts)

| # | Item | Master plan says | Reality |
|---|------|-----------------|---------|
| B1 | `CatalogUseCase` | DELETE (`shared/catalog-use-case.ts`) | 5 active callers including `post-install-pipeline-use-case.ts` — pipeline rule mandates it |
| B2 | `manifest.repo` | DELETE (config command only) | Active in `deps.ts:143`, `setup-use-case.ts:345`, `marketplace-register-framework-use-case.ts:50`, `init-use-case.ts:123-136`, `resolve-framework-use-case.ts:47` |
| B3 | `adopt/` directory | DELETE in Phase 1 | `setup-use-case.ts` imports `AdoptUseCase` at line 23, calls at line 414 — blocked until Phase 3 rewrites `SetupUseCase` |
| B4 | `FrameworkCache` | DELETE | Also referenced by `framework-resolver-adapter.ts:17,59` — adapter must be removed in same commit |
| B5 | `pluginFetcher`/`pluginDistributionReader` in `RestorePluginUseCase` | DELETE (cache-first) | Both non-optional constructor params (lines 29–30) — restore command calls them at `commands/restore.ts:40-45` |

---

## Section A — Commands to delete

### A1. `cache` command

| Field | Value |
|-------|-------|
| Definition | `src/application/commands/cache.ts` — `registerCacheCommand` at line 108 |
| Registered | `src/cli.ts` lines 4, 41 |
| Direct `FrameworkCache` instantiation | Lines 27, 57 — bypasses `createDeps`, anti-pattern |
| Tests | `src/application/commands/__tests__/cache.test.ts` (to delete) |
| Safe to delete | Yes — but `FrameworkCache` class and `FrameworkResolverAdapter` must be co-deleted (blocker B4) |

### A2. `config` command

| Field | Value |
|-------|-------|
| Definition | `src/application/commands/config.ts` — `registerConfigCommand` at line 14 |
| Registered | `src/cli.ts` lines 6, 42 |
| Reads | `manifest.repo` (lines 28, 63, 105, 127), `manifest.docsDir` (line 27, 62) |
| Tests | `src/application/commands/__tests__/config.test.ts` (to delete) |
| Note | `manifest.repo` read here is legitimate (blocked by B2 — must clear all callers first) |
| Safe to delete | Blocked by B2 — must drop all `manifest.repo` callers atomically |

---

## Section B — Manifest fields to delete

### B1. `manifest.mode` / `DistributionMode`

| Field | Value |
|-------|-------|
| Definition | `src/domain/models/manifest.ts` lines 252–256 (`getMode`, `setMode`) |
| Type | `src/domain/models/manifest.ts` line 73 (`mode?: DistributionMode`) |
| Active callers | `setup-use-case.ts` lines 185, 187, 282–295; `marketplace-register-framework-use-case.ts` lines 47–48; `commands/setup.ts` lines 92–95, 125 |
| Tests referencing | `__tests__/setup-use-case.test.ts`, `__tests__/marketplace-register-framework-use-case.test.ts` |
| Safe to delete | Blocked — `setup-use-case.ts` must be rewritten in Phase 3 first |

### B2. `manifest.repo`

| Field | Value |
|-------|-------|
| Definition | `src/domain/models/manifest.ts` lines 180, 425, 477, 563 |
| Active callers (src) | `deps.ts:143`, `setup-use-case.ts:345`, `marketplace-register-framework-use-case.ts:50`, `init-use-case.ts:123,134,136`, `resolve-framework-use-case.ts:47`, `config.ts:28,63,105,127` |
| Also | `framework-resolver-adapter.ts:89,120,131` passes `options.repo`; `cli.ts:62` and `global-options.ts:18` pass `opts.repo` flag |
| Safe to delete | Blocked by B2 (8 callers across 6 files) |

### B3. `manifest.scripts` (obsolete)

| Field | Value |
|-------|-------|
| Definition | `src/domain/models/manifest.ts` lines 212–228 (`addScripts`, `getScriptsFiles`, `getScriptsVersion`, `hasScripts`, `clearScripts`) |
| Active callers | `migrate-use-case.ts` lines 41, 44, 90; `marketplace-register-framework-use-case.ts:52` |
| Note | `migrate-use-case.ts` is a migration path — reads legacy `scripts` section to clear it; this is expected |
| Safe to delete | No — `migrate-use-case.ts` still calls `hasScripts()`, `getScriptsFiles()`, `clearScripts()` for backward-compat migration |

### B4. `manifest.plugins` (obsolete top-level section)

| Field | Value |
|-------|-------|
| Definition | `src/domain/models/manifest.ts` lines 232–248 (`addPlugins`, `clearPlugins`, `getPluginsVersion`, `hasPlugins`, `getPluginsFiles`) |
| Active callers | `install-framework-plugins-use-case.ts` lines 55, 127; `migrate-use-case.ts` lines 42, 91 |
| Note | `install-framework-plugins-use-case.ts` still actively writes `manifest.plugins` — not just migration |
| Safe to delete | No — `InstallFrameworkPluginsUseCase` is active (wired in `deps.ts:173`, consumed by `setup-use-case.ts:72`) |

### B5. `manifest.docsDir` (hardcoded to `"aidd_docs"`, not user-configurable)

| Field | Value |
|-------|-------|
| Definition | `src/domain/models/manifest.ts` — `DEFAULT_DOCS_DIR = "aidd_docs"` |
| Active callers (direct `manifest.docsDir` reads) | 13 call sites across 9 files (see table below) |
| Approach | Hardcode `"aidd_docs"` as constant at call sites — do not read from manifest |

**Direct `manifest.docsDir` reads:**

| File | Line(s) |
|------|---------|
| `clean-use-case.ts` | 84, 86 |
| `install/install-use-case.ts` | 136 |
| `install/install-ide-config-use-case.ts` | 50 |
| `install/install-runtime-config-use-case.ts` | 49 |
| `uninstall-use-case.ts` | 66 |
| `uninstall-ide-use-case.ts` | 34 |
| `plugin/plugin-add-use-case.ts` | 45 |
| `plugin/plugin-update-use-case.ts` | 37 |
| `doctor-use-case.ts` | 132 |
| `sync/sync-use-case.ts` | 183 |
| `restore/restore-plugin-use-case.ts` | 39 |
| `commands/restore.ts` | 123 |
| `commands/config.ts` | 27, 62 |

---

## Section C — FrameworkCache / FrameworkResolver blast radius

### C1. `FrameworkCache`

| Field | Value |
|-------|-------|
| Definition | `src/infrastructure/cache/framework-cache.ts` line 10 |
| Callers | `cache.ts` lines 27, 57 (to delete); `framework-resolver-adapter.ts` lines 17, 59; `deps.ts` lines 64, 147 |
| Blocker | B4 — cannot delete `FrameworkCache` without deleting `FrameworkResolverAdapter` and `cache.ts` command in same commit |

### C2. `FrameworkResolverAdapter` / `FrameworkResolver` port

| Field | Value |
|-------|-------|
| Definition | `src/infrastructure/adapters/framework-resolver-adapter.ts` line 49 |
| Port | `src/domain/ports/framework-resolver.ts` |
| Callers | `deps.ts` lines 32, 48, 78, 154; `setup-use-case.ts:7,76` (optional dep); `resolve-framework-use-case.ts:4,20` |
| Only command caller | `install.ts` lines 164–172 via `ResolveFrameworkUseCase` |

### C3. `ResolveFrameworkUseCase`

| Field | Value |
|-------|-------|
| Definition | `src/application/use-cases/resolve-framework-use-case.ts` line 18 |
| Only caller | `src/application/commands/install.ts` lines 22, 168 |
| Condition | Only invoked when `--path` or `--release` flags are passed (legacy install path) |
| Safe to delete | After Phase 2 removes `--path`/`--release` from `install` command |

---

## Section D — `adopt/` directory

### D1. `AdoptUseCase`

| Field | Value |
|-------|-------|
| Definition | `src/application/use-cases/adopt/adopt-use-case.ts` line 26 |
| Only caller | `setup-use-case.ts` lines 23 (import), 414 (call) |
| AdoptRequiresVersionError throws | `setup-use-case.ts` lines 438, 471, 478 |
| Also calls | `CatalogUseCase` at `adopt-use-case.ts:67` |
| Tests | `src/application/use-cases/adopt/__tests__/adopt-use-case.test.ts` |
| Safe to delete | Blocked by B3 — `setup-use-case.ts` must be rewritten first |

---

## Section E — `memory-stubs` assets

| Field | Value |
|-------|-------|
| Location | `src/assets/memory-stubs/` — 3 files: `AGENTS.md`, `CLAUDE.md`, `copilot-instructions.md` |
| References in `src/` | **Zero** — `InstallMemoryStubUseCase` deleted in commit `8a1e3fb` |
| Safe to delete | Yes — orphaned assets, no code references |
| Note | Master plan reference to `InstallMemoryStubUseCase` is stale; already removed |

---

## Section F — Framework CI / `build-dist.sh`

### F1. `build-dist.sh` deletion

| Field | Value |
|-------|-------|
| Status | **Deleted** in framework commit `27bcee6` |
| Broken CI | `framework/.github/workflows/ci.yml` line 78: `run: bash scripts/build-dist.sh` — job `build-and-attach` fails |
| Old script used | `aidd setup --path`, `aidd install ai <tool> --path --mcp`, `aidd install ide vscode --path` — all legacy `--path` flags |
| Phase dependency | Script must be rewritten in Phase 10 using marketplace-native flow (no `--path` flags) |
| Immediate action | Phase 10 task already documented; CI is broken until then |

### F2. Legacy `--path` / `--mode` / `--switch-mode` flags in commands

| Command | Flags | File |
|---------|-------|------|
| `install` | `--path`, `--release` | `src/application/commands/install.ts` lines 164–172 |
| `setup` | `--path`, `--mode`, `--switch-mode` | `src/application/commands/setup.ts` lines 62, 71, 72, 92–95, 125–126 |

---

## Deletion order constraints

```
Phase 1:  memory-stubs/ (no blockers)
Phase 2:  --path/--release flags + ResolveFrameworkUseCase
           → unlocks: FrameworkResolverAdapter partial cleanup
Phase 3:  SetupUseCase rewrite (drop mode/adopt deps)
           → unlocks: adopt/ deletion, DistributionMode, manifest.mode
Phase 4:  cache command + FrameworkCache + FrameworkResolverAdapter (co-delete)
Phase 5+: manifest.scripts / manifest.plugins (after MigrateUseCase rework)
Phase N:  manifest.repo (after all 8 callers cleared)
Phase 10: Rewrite build-dist.sh → marketplace-native CI flow
```
