# Phase 8 — Migrate command alignment

> Update `aidd migrate` to handle the new v5 clean schema. Detect legacy v3/v4 manifests, strip dead fields, rewire bundled plugins, preserve user files, transparent execution. Add `MigrationPlan` value object and sub-use-cases.

## Pre-requisites

- Phase 7 (manifest schema rewrite + docsDir hardcode) landed — schema reaches final v5 clean form

## Goal

`aidd migrate` is the safety net for users on prod v3 / beta v4 manifests. After Phase 7 reworked v5 in place, the migration chain `v3 → v4 → v5` operates on **schema** (`Manifest.deserialize`), but `MigrateUseCase` must additionally:

1. Backup `.aidd/manifest.backup.json` before mutation
2. Strip on-disk artifacts no longer tracked (legacy framework files)
3. Re-register the default marketplace if absent
4. Rewire bundled framework plugins as marketplace installations
5. Preserve user-edited memory files (`CLAUDE.md`, `AGENTS.md`, `copilot-instructions.md`)
6. Be transparent: no opt-in, silent no-op if no migration needed

## Architecture compliance

`MigrateUseCase` is the orchestrator with single `execute()`. Returns discriminated union. Sub-use-cases per phase:

```
MigrateUseCase (orchestrator, src/application/use-cases/migrate-use-case.ts)
├── MigrateBackupUseCase            (src/application/use-cases/migrate/)
├── MigrateStripDeadFilesUseCase    (src/application/use-cases/migrate/)
├── MigrateRewirePluginsUseCase     (src/application/use-cases/migrate/)
├── MarketplaceRegisterFrameworkUseCase (existing)
└── PluginInstallFromMarketplaceUseCase (existing)
```

`MigrationPlan` value object (pure decision computation, zero I/O) drives both `--dry-run` display AND apply step. All decisions on `MigrationPlan` are pure; apply step is the only adapter-touching part.

```ts
// src/domain/models/migration-plan.ts
export class MigrationPlan {
  readonly fromVersion: number;
  readonly toVersion: 5;
  readonly fieldsToStrip: readonly string[];
  readonly filesToDelete: readonly string[];
  readonly pluginsToRewire: readonly { name: string; marketplace: string }[];
  readonly defaultMarketplaceMissing: boolean;
  readonly userMemoryFiles: readonly string[];

  isNoOp(): boolean { /* derived */ }
  describe(): string { /* for --dry-run */ }
  equals(other: MigrationPlan): boolean { /* by value */ }
}
```

Methods ≤20 lines. Domain pure (no `node:fs`, no logging).

## Steps

### A. Create `MigrationPlan` value object

- [ ] Create `src/domain/models/migration-plan.ts`:
  - Readonly fields per signature above
  - Constructor validates: `fromVersion ∈ {3, 4, 5}`, `toVersion === 5`, file paths non-empty strings
  - `isNoOp()` returns `true` when fromVersion === 5 AND defaultMarketplaceMissing === false AND fieldsToStrip empty AND pluginsToRewire empty
  - `describe()` returns multi-line plan text for `--dry-run` display
- [ ] Unit tests in `tests/domain/models/migration-plan.unit.test.ts`

### B. Create migrate sub-use-cases

- [ ] `src/application/use-cases/migrate/migrate-backup-use-case.ts`:
  - Input: `{ projectRoot }`
  - Writes `.aidd/manifest.backup.json` (atomic via temp + rename)
  - Idempotent (overwrites prior backup)
  - Throws if `.aidd/manifest.json` missing
- [ ] `src/application/use-cases/migrate/migrate-strip-dead-files-use-case.ts`:
  - Input: `{ projectRoot, plan: MigrationPlan }`
  - Removes files listed in `plan.filesToDelete` (legacy `docs/`, `scripts/` tracked files from raw JSON pre-deserialize)
  - Does NOT touch user files (CLAUDE.md, AGENTS.md, copilot-instructions.md, `aidd_docs/`)
- [ ] `src/application/use-cases/migrate/migrate-rewire-plugins-use-case.ts`:
  - Input: `{ projectRoot, plan: MigrationPlan, defaultMarketplaceName }`
  - Detects bundled plugins in legacy top-level `manifest.plugins`
  - For each: calls `PluginInstallFromMarketplaceUseCase` to materialize via marketplace
  - Skips plugins not present in default marketplace catalog (logs warning)

### C. Rewrite `MigrateUseCase`

- [ ] Constructor injects: `fs, manifestRepo, logger, prompter, marketplaceRegisterFramework, pluginInstallFromMarketplace, migrateBackup, migrateStripDeadFiles, migrateRewirePlugins`
- [ ] `execute({ projectRoot, dryRun, interactive }) → Promise<MigrateResult>`:
  1. Load raw legacy JSON (bypass deserialize to inspect old fields)
  2. Compute `MigrationPlan`
  3. If `plan.isNoOp()` → return `{ kind: "no-op" }`
  4. If `dryRun` → return `{ kind: "dry-run", plan }`
  5. If `interactive` → confirm via prompter (skip if `--non-interactive`)
  6. Pipeline: backup → strip dead files → register default marketplace if missing → rewire plugins → save migrated manifest (deserialize+serialize round-trip strips dead fields automatically)
  7. Return `{ kind: "migrated", plan }`
- [ ] Each pipeline step extracted to private method ≤20 lines

### D. Update command

- [ ] `src/application/commands/migrate.ts`: keep flags `--dry-run` and `--non-interactive`; on dry-run print `plan.describe()`

### E. Wire deps

- [ ] Update `deps.ts` to wire `migrateBackup`, `migrateStripDeadFiles`, `migrateRewirePlugins` sub-use-cases
- [ ] Reuse existing `marketplaceRegisterFrameworkUseCase` and `pluginInstallFromMarketplaceUseCase`

## Tests (unit-first)

### Unit tests

- [ ] `tests/domain/models/migration-plan.unit.test.ts` — every plan computation case (v3, v4, v5, mixed)
- [ ] `tests/application/use-cases/migrate/migrate-backup-use-case.unit.test.ts`
- [ ] `tests/application/use-cases/migrate/migrate-strip-dead-files-use-case.unit.test.ts`
- [ ] `tests/application/use-cases/migrate/migrate-rewire-plugins-use-case.unit.test.ts`
- [ ] `tests/application/use-cases/migrate-use-case.unit.test.ts` — orchestration: no-op, dry-run, full migration, interactive abort, error mid-pipeline (verify backup intact)

### Integration tests

- [ ] `tests/application/use-cases/migrate-use-case.integration.test.ts` — fixture with legacy v3 manifest + bundled plugins + framework files on disk → migrate → verify v5 manifest + dead files removed + backup present + user files untouched

### E2E tests

- One brownfield migrate E2E test in Phase 12

## Acceptance criteria

- [ ] `aidd migrate` on v5 manifest: silent no-op
- [ ] `aidd migrate` on v3 manifest: backup written + manifest upgraded + dead files removed + plugins rewired
- [ ] `aidd migrate --dry-run` on v3: prints plan, no mutation
- [ ] User-edited memory files preserved byte-identical
- [ ] Failure mid-pipeline: backup file intact, manifest left in last-saved state
- [ ] All unit tests green
- [ ] Integration test green
- [ ] `pnpm typecheck` + `pnpm biome check` clean

## Manual validation

```bash
cd /tmp && rm -rf brownfield && mkdir brownfield && cd brownfield

# Stage legacy v3 manifest fixture
mkdir -p .aidd
cp /path/to/repo/tests/fixtures/manifests/legacy-v3/manifest.json .aidd/

# Stage user-edited memory files
echo "user memory" > CLAUDE.md
echo "user memory" > AGENTS.md
echo "user memory" > copilot-instructions.md

# Dry run
aidd migrate --dry-run
# expect: prints plan with field strips + plugins to rewire

# Apply
aidd migrate

# Verify
cat .aidd/manifest.json | jq .version              # expect: 5
cat .aidd/manifest.json | jq 'has("docs"), has("scripts"), has("docsDir"), has("repo"), has("mode")'
# expect: false × 5
cat CLAUDE.md                                       # expect: "user memory"
ls .aidd/manifest.backup.json                       # expect: present

# Idempotent
aidd migrate                                        # expect: silent no-op
```

## Risks / breaking changes

- Custom modifications to tracked framework files: strip step removes them. CHANGELOG: "before `aidd migrate`, run `aidd status` to inspect drift; modified tracked files are removed."
- Plugins missing in default marketplace: warning logged, user manually re-installs.
- `MigrateUseCase.execute()` risks growing >20 lines — extract per-step private helpers.

## Commit

```
refactor(migrate): align with v5 clean schema — backup + strip + rewire

Migrate command now handles full v3/v4 → v5 cleanup:
- Backup .aidd/manifest.backup.json (atomic) before mutation
- Strip on-disk files tracked under legacy docs/scripts sections
- Re-register default marketplace if absent
- Rewire bundled plugins as marketplace installations
- Preserve user-edited memory files (CLAUDE.md / AGENTS.md / copilot-instructions.md)

Add MigrationPlan value object (pure decision computation, no I/O).
Add MigrateBackup / MigrateStripDeadFiles / MigrateRewirePlugins sub-use-cases.
Each pipeline step ≤20 lines (private methods).

Transparent semantics: silent no-op when no migration needed.

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-8.md
```
