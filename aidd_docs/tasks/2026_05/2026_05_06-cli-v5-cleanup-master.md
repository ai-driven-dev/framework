# Instruction: CLI v5 Final Cleanup (Master)

## Feature

- **Summary**: Strip residual legacy from CLI post marketplace-only refactor. Remove orphan commands (`cache`, `config`), kill memory-stub ownership (plugin owns), drop legacy install branch and `ResolveFrameworkUseCase`, rework manifest v5 in place (drop dead fields), restructure command surface to noun-first (`ai/ide/plugin install`), chain global ops, extend sync to plugins, rebuild `framework/scripts/build-dist.sh` for tarball generation, simplify test pyramid (unit-heavy, light integration, E2E only on main journeys).
- **Stack**: `Node.js >=24, TypeScript ESM, commander, @inquirer/prompts, tsup, vitest, biome, lefthook`
- **Parent branch**: `feat/plugin-architecture`
- **Branch name**: `feat/cli-v5-cleanup` (merged back to `feat/plugin-architecture`)
- **Parent Plan**: `2026_05_01-cli-marketplace-architecture-master.md` (residual cleanup)
- **Sequence**: `master`
- **Confidence**: 9.5/10 (Phase 0 inventory verified all blast radii — adopt/ now confirmed, only sync emitter symmetry remains untested)
- **Time to implement**: 5–7 days (13 phases, 1 commit per phase)

## Existing files (post Phase 0 inventory)

### CLI

- @src/application/commands/cache.ts — DELETE
- @src/application/commands/config.ts — DELETE
- @src/application/commands/install.ts — REWORK (remove `--path/--release` legacy flags + branch)
- @src/application/commands/uninstall.ts — REWORK (split AI/IDE)
- @src/application/commands/setup.ts — REWORK (drop `--from/--switch-mode/--mode/--path/--release` legacy flags)
- @src/application/commands/update.ts — REWORK (chain ai/ide/plugin)
- @src/application/commands/sync.ts — REWORK (extend with plugins)
- @src/application/commands/restore.ts — REWORK (drop pluginFetcher dep at lines 40-45)
- @src/application/commands/status.ts — REWORK (chain scopes)
- @src/application/commands/doctor.ts — REWORK (chain scopes)
- @src/application/commands/clean.ts — KEEP
- @src/application/commands/migrate.ts — REWORK (drop dead fields)
- @src/application/commands/menu.ts — REWORK (relabel + reorder)
- @src/application/commands/plugin.ts — EXTEND (status/sync/restore/doctor sub-cmds)
- @src/application/commands/marketplace.ts — EXTEND (cache sub-cmd)
- @src/application/commands/auth.ts — KEEP
- @src/application/commands/self-update.ts — KEEP
- @src/application/use-cases/install/install-use-case.ts — DELETE (legacy class)
- @src/application/use-cases/install/install-plugins-use-case.ts — DELETE
- @src/application/use-cases/install/install-runtime-config-use-case.ts — KEEP (rework signature)
- @src/application/use-cases/install/install-ide-config-use-case.ts — KEEP (rework signature)
- @src/application/use-cases/install/install-memory-stub-use-case.ts — **ALREADY DELETED** in commit `8a1e3fb` (master plan reference was stale)
- @src/application/use-cases/resolve-framework-use-case.ts — DELETE (only caller is `install.ts` lines 22, 168)
- @src/application/use-cases/setup-use-case.ts — REWRITE (orchestrator; drop adopt/mode/FrameworkResolver deps)
- @src/application/use-cases/migrate-use-case.ts — REWORK (drop dead fields after schema rewrite in Phase 7)
- @src/application/use-cases/shared/catalog-use-case.ts — **KEEP** (5 active callers including `post-install-pipeline-use-case.ts` — project pipeline rule mandates)
- @src/application/use-cases/install-framework-plugins-use-case.ts — DELETE
- @src/application/use-cases/sync/sync-use-case.ts — REWORK (plugin propagation)
- @src/application/use-cases/restore/restore-use-case.ts — REWORK (drop pluginFetcher)
- @src/application/use-cases/restore/restore-plugin-use-case.ts — REWORK (cache-first; drop non-optional `pluginFetcher`/`pluginDistributionReader` ctor params at lines 29-30)
- @src/application/use-cases/adopt/ — DELETE entire dir (blocked until Phase 3 rewrites SetupUseCase)
- @src/domain/models/manifest.ts — REWRITE v5 schema (Phase 7)
- @src/domain/models/plugin.ts — KEEP
- @src/infrastructure/cache/framework-cache.ts — DELETE (co-delete with FrameworkResolverAdapter in Phase 4)
- @src/infrastructure/adapters/framework-resolver-adapter.ts — DELETE (co-delete in Phase 4)
- @src/infrastructure/adapters/framework-loader-adapter.ts — DELETE (verify dead)
- @src/assets/memory-stubs/ — DELETE entire dir (zero refs — Phase 1 orphan delete)
- @src/cli.ts — REWORK (unregister deleted commands, drop `--repo` global flag)

### Framework

- @../framework/scripts/build-dist.sh — RECREATE (deleted in `27bcee6`)
- @../framework/.github/workflows/ci.yml — UPDATE (consume rebuilt dist tarballs)

## New files to create

- src/application/commands/ai.ts (noun-first AI tool subcommands)
- src/application/commands/ide.ts (noun-first IDE tool subcommands)
- src/application/use-cases/setup/setup-marketplace-source-use-case.ts (sub-uc)
- src/application/use-cases/setup/setup-tools-use-case.ts (sub-uc)
- src/application/use-cases/setup/setup-plugins-prompt-use-case.ts (sub-uc)
- src/application/use-cases/sync/sync-plugins-use-case.ts (sub-uc)
- src/application/use-cases/global/update-all-use-case.ts (chain orchestrator)
- src/application/use-cases/global/status-all-use-case.ts (chain orchestrator)
- src/application/use-cases/global/sync-all-use-case.ts (chain orchestrator)
- src/application/use-cases/global/restore-all-use-case.ts (chain orchestrator)
- src/application/use-cases/global/doctor-all-use-case.ts (chain orchestrator)
- src/application/use-cases/marketplace/marketplace-cache-list-use-case.ts
- src/application/use-cases/marketplace/marketplace-cache-clear-use-case.ts
- src/application/use-cases/migrate/migrate-backup-use-case.ts (sub-uc)
- src/application/use-cases/migrate/migrate-strip-dead-files-use-case.ts (sub-uc)
- src/application/use-cases/migrate/migrate-rewire-plugins-use-case.ts (sub-uc)
- src/domain/models/manifest-v5.ts (new schema model)
- src/domain/models/marketplace-source-mode.ts (value object: `local | remote`)
- src/domain/models/setup-flow.ts (aggregate root for setup orchestration)
- src/domain/models/migration-plan.ts (value object, pure decision computation)
- src/domain/models/marketplace-cache-entry.ts (value object)
- src/domain/ports/marketplace-cache.ts (port interface)
- src/infrastructure/adapters/marketplace-cache-adapter.ts

## User Journey

```mermaid
---
title: CLI v5 Cleanup — Greenfield + Brownfield Flow
---
flowchart TD
  Start["User runs aidd"]
  ChoiceContext{"Existing manifest"}
  GreenSetup["aidd setup"]
  GreenSource["Choose marketplace source local or remote"]
  GreenManifest["Create manifest v5 minimal"]
  GreenMarket["Register default marketplace plus refresh"]
  GreenAi["Multi select AI tools"]
  GreenIde["Multi select IDE tools"]
  GreenInstall["Install runtime config per tool no memory stub"]
  GreenPluginsAsk{"Install framework plugins"}
  GreenPluginPick["aidd plugin pick"]
  GreenManual["Memory stub manual via aidd context skill"]
  GreenDone["Project ready v5"]
  BrownDetect["Detect manifest v3 or v4"]
  BrownMigrate["aidd migrate"]
  BrownBackup["Backup manifest backup json"]
  BrownStrip["Strip dead fields docs scripts repo docsDir mode"]
  BrownRewire["Re register default marketplace if missing"]
  BrownPlugins["Rewire bundled plugins via marketplace"]
  BrownPreserve["Preserve user edited memory files"]
  BrownDone["Project on v5 schema"]

  Start --> ChoiceContext
  ChoiceContext -- "No manifest" --> GreenSetup
  ChoiceContext -- "v3 or v4 manifest" --> BrownDetect
  GreenSetup --> GreenSource
  GreenSource --> GreenManifest
  GreenManifest --> GreenMarket
  GreenMarket --> GreenAi
  GreenAi --> GreenIde
  GreenIde --> GreenInstall
  GreenInstall --> GreenPluginsAsk
  GreenPluginsAsk -- "Yes" --> GreenPluginPick
  GreenPluginsAsk -- "No" --> GreenManual
  GreenPluginPick --> GreenManual
  GreenManual --> GreenDone
  BrownDetect --> BrownMigrate
  BrownMigrate --> BrownBackup
  BrownBackup --> BrownStrip
  BrownStrip --> BrownRewire
  BrownRewire --> BrownPlugins
  BrownPlugins --> BrownPreserve
  BrownPreserve --> BrownDone
```

## Implementation phases

Each phase = 1 commit on `feat/cli-v5-cleanup`. Phases ordered by deletion-order constraints from Phase 0 inventory. Each phase has its own `part-N.md` with checklists.

| # | Phase | Blocks | File |
|---|---|---|---|
| 0 | Inventory + verification grep ✅ | — | `2026_05_06-cli-v5-cleanup-part-0-inventory.md` |
| 1 | Memory-stubs orphan delete | 0 | `2026_05_06-cli-v5-cleanup-part-1.md` |
| 2 | Install legacy purge (`--path/--release` + `InstallUseCase` + `ResolveFrameworkUseCase`) | 0 | `2026_05_06-cli-v5-cleanup-part-2.md` |
| 3 | Setup orchestrator rewrite (drop `mode/adopt/from/switch-mode`, FrameworkResolver port, `manifest.mode` reads) | 2 | `2026_05_06-cli-v5-cleanup-part-3.md` |
| 4 | Cache + adopt + framework-cache co-delete (`FrameworkCache` + `FrameworkResolverAdapter` + `cache` cmd + `adopt/` + `DistributionMode` + `framework.ts` model + `manifest.mode`) | 3 | `2026_05_06-cli-v5-cleanup-part-4.md` |
| 5 | Framework plugins legacy purge (`InstallFrameworkPluginsUseCase` + `manifest.scripts` / `manifest.plugins` write paths; MigrateUseCase read shim kept) | 0 | `2026_05_06-cli-v5-cleanup-part-5.md` |
| 6 | Manifest repo + config purge (8 callers across 6 files cleared atomically; `aidd config` deleted; `repo` field dropped; `--repo` global flag dropped) | 2, 3 | `2026_05_06-cli-v5-cleanup-part-6.md` |
| 7 | Manifest schema rewrite + docsDir hardcode (13 docsDir sites; final v5 schema; `migrateV4toV5` rewrite; `MarketplaceEntry` VO) | 4, 5, 6 | `2026_05_06-cli-v5-cleanup-part-7.md` |
| 8 | Migrate alignment (after schema rewrite; `MigrationPlan` VO; `MigrateBackup/StripDeadFiles/RewirePlugins` sub-uc; transparent) | 7 | `2026_05_06-cli-v5-cleanup-part-8.md` |
| 9 | Noun-first surface (`aidd ai/ide install/uninstall/list/status/update/sync/restore/doctor`; `aidd plugin status/sync/restore/doctor`; delete `commands/install.ts` + `commands/uninstall.ts`) | 2 | `2026_05_06-cli-v5-cleanup-part-9.md` |
| 10 | Globals chained + marketplace cache + plugin sub-cmds + RestorePluginUseCase cache-first rework | 9 | `2026_05_06-cli-v5-cleanup-part-10.md` |
| 11 | Sync plugins inter-tool + menu refresh (`SyncPluginsUseCase`; `aidd ai sync --no-plugins`; menu tree rewrite) | 9, 10 | `2026_05_06-cli-v5-cleanup-part-11.md` |
| 12 | Framework build-dist + tests + docs (reconstruct `build-dist.sh`; invert test pyramid; update README + ARCHITECTURE + CHANGELOG) | 1–11 | `2026_05_06-cli-v5-cleanup-part-12.md` |

## Validation flow

End-of-cleanup acceptance — execute in order against a clean checkout:

1. **Greenfield interactive** : in empty dir, `aidd setup` → prompts source/AI/IDE/plugins → manifest v5 written, default marketplace registered, runtime configs installed, NO memory stub on disk.
2. **Greenfield scriptable** : `aidd setup --source remote --all --no-plugins --yes` → completes without prompts, exit 0.
3. **Brownfield migrate** : v3 manifest fixture → `aidd migrate` → manifest v5 (no `docs/scripts/repo/docsDir/mode/topPlugins`), backup file present, user-edited memory files untouched.
4. **Noun-first surface** : `aidd ai install claude` works, `aidd plugin install <name>` works, `aidd install <category> <tool>` no longer exists.
5. **Globaux chainés** : `aidd update` chains AI + IDE + plugin update + marketplace refresh in one invocation.
6. **Sync plugins** : `aidd ai sync --source claude --target cursor` propagates configs AND installed plugins, re-translated for cursor.
7. **Marketplace cache** : `aidd marketplace cache list` shows fetched marketplaces; `clear` purges.
8. **Build-dist** : `bash framework/scripts/build-dist.sh` produces `framework/dist/<tool>-{local,remote}/` ready-to-tar.
9. **CI tarball pipeline** : `framework/.github/workflows/ci.yml` consumes `dist/<tool>-<mode>/` and attaches per-tool tarballs to release.
10. **Test pyramid** : `pnpm test` runs in <60s, unit:integration:e2e ratio ≥10:3:1, E2E covers only main journeys (greenfield setup, brownfield migrate, plugin install, sync, update, clean).

## Architecture rules (enforced per phase)

These rules apply to every line of code written. Violations fail review.

### Domain richness (non-anemic)

- `src/domain/models/` entities own behavior, not just data
- Value objects: `readonly` fields, no setters, `.equals()`, validate in constructor
- Aggregate roots: enforce invariants across child entities (e.g. `Manifest` is aggregate root for tool entries + plugins)
- Data classes (DTOs) live in adapter layer or `*Data` interfaces inside model files (deserialization)
- Domain pure: zero `import` from `application/` or `infrastructure/`, zero `node:fs`, no `process.env`, no logging

### Use case discipline

- One public `execute()` method per use-case class
- Methods ≤20 lines (extract private named helpers)
- Sub-use-cases live in `src/application/use-cases/<scope>/` and are called by orchestrator use-cases only (never by commands)
- Commands are thin wrappers: parse flags → create deps → call ONE use-case → display
- Global commands (`aidd update`, `aidd status`, `aidd sync`, `aidd restore`, `aidd doctor`) call ONE orchestrator use-case which chains sub-use-cases

### Test pyramid (inverted)

- **Unit tests** (`*.unit.test.ts`): every domain model, every value object, every pure function. Goal: maximum coverage, runs in milliseconds. Use cases tested via direct construction with in-memory ports.
- **Integration tests** (`*.integration.test.ts`): adapter ↔ I/O boundary (FS, HTTP, git). Minimal, only when adapter has translation logic.
- **E2E tests** (`*.e2e.test.ts`): main user journeys only. Maximum 6 E2E tests covering: greenfield setup, brownfield migrate, plugin install from marketplace, ai sync inter-tool, aidd update global, aidd clean.

## Confidence assessment

✅ **High confidence (9.5/10)**:
- Architecture rules already enforced via `.claude/rules/` (hexagonal, manifest, layer responsibilities, value objects)
- Phasing verified against Phase 0 inventory with all 5 blockers resolved into explicit sequencing
- All locked decisions resolved in brainstorm
- Manifest migration chain v1→v5 already operational
- Per-tool emitter pattern (`domain/tools/ai/`) already supports plugin re-translation for sync
- `build-dist.sh` historical content recovered from git (`27bcee6`)
- `adopt/` blast radius now verified (single caller in `setup-use-case.ts:23,414`)
- `InstallMemoryStubUseCase` confirmed deleted in `8a1e3fb`

❌ **Residual risk (0.5pt deducted)**:
- Sync plugins inter-tool requires verifying that all per-tool emitters can re-emit a `NormalizedPlugin` symmetrically — not all paths exercised today (Phase 11 verifies)

## Locked decisions

| # | Topic | Lock |
|---|---|---|
| 1 | Manifest version | **v5 reworked in place**. Prod=v3, betas=v4/v5. v5 not yet stable → drop dead fields without bumping to v6. Migration chain v3→v4→v5 retained. |
| 2 | `mode` field | **DROP**. Marketplace `source.type` (git/local/url/npm) covers distribution mode. |
| 3 | Memory stub ownership | **Plugin only**. CLI never writes `CLAUDE.md` / `AGENTS.md` / `copilot-instructions.md`. User runs `aidd-context.project-init` skill manually post-setup. |
| 4 | Cache surface | **Marketplace cache** exposed via `aidd marketplace cache list\|clear`. Old `FrameworkCache` (`.aidd/cache/`) deleted entirely. |
| 5 | Config command | **DELETE**. Manifest fields `repo` and `docsDir` removed. |
| 6 | Setup non-interactive minimum | **No abort**. `aidd setup --source remote --yes` (no tools) creates minimal manifest + registers default marketplace. Required by `build-dist.sh` reconstruction. |
| 7 | Surface convention | **Noun-first** for domain commands (`ai install`, `ide install`, `plugin install`). Globals stay flat (`status`, `doctor`, `sync`, `update`, `restore`, `clean`). No `--scope` flag — global commands chain all unitaries. |
| 8 | `ai sync` semantic | **Configs + plugins**. Source tool's runtime config AND installed plugins propagate, plugins re-translated by target tool's emitter. |
| 9 | Migrate command | **Keep indefinitely**. Transparent (no opt-in/no warning). Backup `.aidd/manifest.backup.json` before mutation. |
| 10 | Branching | **Single branch `feat/cli-v5-cleanup`** based on `feat/plugin-architecture`, merged back at end. One commit per phase. No intermediate PRs. |
| 11 | Test pyramid | **Inverted (unit-heavy)**. Goal: <60s full test run. Max 6 E2E tests on main journeys. Integration only at adapter boundaries. |
| 12 | Format adapters | **Deferred**. Copilot VSCode / Cursor / Codex / OpenCode native marketplace ingestion = next master plan post-cleanup ship. |
| 13 | Phase 0 inventory blockers | **Integrated into sequencing**. All 5 blockers (B1–B5) from `2026_05_06-cli-v5-cleanup-part-0-inventory.md` reflected as explicit ordering constraints in the phase table. `CatalogUseCase` retained. `FrameworkCache` co-deleted with `FrameworkResolverAdapter` in Phase 4. `adopt/` unblocked by Phase 3 SetupUseCase rewrite. `manifest.repo` cleared atomically across all 8 callers in Phase 6. `RestorePluginUseCase` cache-first rework in Phase 10. |

## Sequencing

```text
Phase 0 (inventory ✅)
    │
    ├──► Phase 1 (memory-stubs orphan delete — zero blockers)
    │
    ├──► Phase 2 (install legacy purge)
    │        │
    │        ├──► Phase 3 (setup orchestrator rewrite)
    │        │        │
    │        │        └──► Phase 4 (cache + adopt + framework-cache co-delete)
    │        │                  │
    │        │                  └──► Phase 5 (framework plugins legacy purge)
    │        │                            │
    │        │                            └──► Phase 6 (manifest.repo + config purge)
    │        │                                      │
    │        │                                      └──► Phase 7 (manifest schema rewrite + docsDir)
    │        │                                                │
    │        │                                                └──► Phase 8 (migrate alignment)
    │        │
    │        └──► Phase 9 (noun-first surface)
    │                  │
    │                  └──► Phase 10 (globals chained + mp cache + plugin sub-cmds)
    │                             │
    │                             └──► Phase 11 (sync plugins + menu refresh)

Phase 12 (build-dist + tests + docs) gates merge — depends on 1–11
```

Each phase produces a single commit with conventional commit format:

```
<type>(<scope>): <subject>

<body explaining intent + rationale>

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-N.md
```

Final merge: `git checkout feat/plugin-architecture && git merge --no-ff feat/cli-v5-cleanup`.

## Verified facts

| Claim | Truth | Source |
|---|---|---|
| `framework/scripts/build-dist.sh` exists | FALSE | Deleted commit `27bcee6` |
| `MANIFEST_VERSION` constant value | `5` | `src/domain/models/manifest.ts:16` |
| Prod npm latest stable | `4.0.0` | `npm view @ai-driven-dev/cli version` |
| Manifest v5 ever published stable | FALSE | All v5 schema versions in beta only |
| `FrameworkCache` adapter usage | `cache.ts` + `framework-resolver-adapter.ts` | Phase 0 inventory section C1 |
| Memory stub assets present | TRUE (orphan) | `src/assets/memory-stubs/{AGENTS,CLAUDE,copilot-instructions}.md` |
| `InstallMemoryStubUseCase` status | ALREADY DELETED in commit `8a1e3fb` | Phase 0 inventory section E |
| Noun-first commands today | `plugin`, `marketplace`, `auth`, `config` | Phase 0 inventory |
| Verb-first commands today | `install`, `uninstall`, `update`, `restore`, `sync`, `status`, `doctor`, `clean`, `setup`, `migrate`, `self-update` | Phase 0 inventory |
| `ResolveFrameworkUseCase` callers | `install.ts` lines 22, 168 only | Phase 0 inventory section C3 |
| `adopt/` directory dependents | `setup-use-case.ts` lines 23 (import), 414 (call) only | Phase 0 inventory section D1 |
| `manifest.repo` active callers | 8 callers across 6 files (deps.ts:143, setup-use-case.ts:345, marketplace-register-framework-use-case.ts:50, init-use-case.ts:123-136, resolve-framework-use-case.ts:47, cli.ts:62, global-options.ts:18, config.ts:28,63,105,127) | Phase 0 inventory section B2 |
| `manifest.docsDir` active callers | 13 sites across 9 files | Phase 0 inventory section B5 |
| `CatalogUseCase` is mandated retained by project pipeline rule | TRUE | Phase 0 inventory blocker B1 — 5 active callers including `post-install-pipeline-use-case.ts` |
| `RestorePluginUseCase` deps non-optional | TRUE — `pluginFetcher`/`pluginDistributionReader` non-optional ctor params at lines 29-30 | Phase 0 inventory blocker B5 |
| Plugin re-translation symmetric | Untested across all tool emitters | Phase 11 must verify |
