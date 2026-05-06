# Phase 4 — Migrate command alignment

> Update `aidd migrate` to handle the new dead-field set (`mode`, `scripts`, `repo`, `docsDir`, top-level `plugins`). Transparent execution. Backup before mutation.

## Pre-requisites

- Phase 1 (manifest v5 schema) landed
- Phase 2 (suppressions) landed

## Goal

`aidd migrate` is the safety net for users on prod v3 / beta v4 manifests. After Phase 1 reworked v5 in place, the migration chain `v3 → v4 → v5` operates on **schema** (`Manifest.deserialize`), but `MigrateUseCase` must additionally:

1. Strip on-disk artifacts no longer tracked (legacy framework files)
2. Re-register the default marketplace if absent
3. Rewire bundled framework plugins as marketplace installations
4. Preserve user-edited memory files (CLAUDE.md, AGENTS.md, copilot-instructions.md)
5. Backup `.aidd/manifest.backup.json` before mutation
6. Be transparent: no opt-in, no warning if no migration needed (silent no-op)

## Architecture compliance

- `MigrateUseCase` orchestrator, single `execute()`, returns discriminated union
- Sub-use-cases for each phase: `MigrateBackupUseCase`, `MigrateStripDeadFilesUseCase`, `MigrateRewirePluginsUseCase`
- Domain entity `MigrationPlan` (value object) computed before mutation — drives both `--dry-run` display AND apply step
- All decisions on `MigrationPlan` are pure (no I/O); apply step is the only adapter-touching part

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
  describe(): string { /* for --dry-run output */ }
}
```

## Steps

- [ ] Create `src/domain/models/migration-plan.ts` value object + unit tests
- [ ] Create `src/application/use-cases/migrate/migrate-backup-use-case.ts`:
  - [ ] Writes `.aidd/manifest.backup.json` (atomic via temp + rename)
  - [ ] Idempotent: overwrites existing backup with current manifest content
- [ ] Create `src/application/use-cases/migrate/migrate-strip-dead-files-use-case.ts`:
  - [ ] Removes files from disk that were tracked in legacy `manifest.docs` or `manifest.scripts` sections (read from raw legacy JSON before deserialize)
  - [ ] Does NOT touch user files (CLAUDE.md / AGENTS.md / copilot-instructions.md / `aidd_docs/`)
- [ ] Create `src/application/use-cases/migrate/migrate-rewire-plugins-use-case.ts`:
  - [ ] Detects bundled plugins in legacy manifest top-level `plugins` section
  - [ ] Maps each to marketplace plugin install (calls `PluginInstallFromMarketplaceUseCase`)
  - [ ] Skips plugins not present in default marketplace catalog (logs warning)
- [ ] Rewrite `src/application/use-cases/migrate-use-case.ts`:
  - [ ] Constructor injects: `fs, manifestRepo, logger, prompter, marketplaceRegisterFramework, pluginInstallFromMarketplace, migrateBackup, migrateStripDeadFiles, migrateRewirePlugins`
  - [ ] `execute({ projectRoot, dryRun, interactive })`:
    1. Load raw legacy JSON (bypass deserialize to inspect old fields)
    2. Compute `MigrationPlan`
    3. If `plan.isNoOp()` → return `{ kind: "no-op" }`
    4. If `dryRun` → return `{ kind: "dry-run", plan }`
    5. If `interactive` → confirm via prompter (skip if confirmation already disabled)
    6. Backup → strip dead files → register default marketplace if missing → rewire plugins → save migrated manifest (deserialize+serialize round-trip strips dead fields automatically)
    7. Return `{ kind: "migrated", plan }`
- [ ] Update `src/application/commands/migrate.ts`:
  - [ ] No new flags (existing `--dry-run` and `--non-interactive` retained)
  - [ ] Display `MigrationPlan.describe()` on dry-run

## Tests (unit-first)

### Unit tests

- [ ] `tests/domain/models/migration-plan.unit.test.ts` — every plan computation case (v3, v4, v5, mixed)
- [ ] `tests/application/use-cases/migrate/migrate-backup-use-case.unit.test.ts`
- [ ] `tests/application/use-cases/migrate/migrate-strip-dead-files-use-case.unit.test.ts`
- [ ] `tests/application/use-cases/migrate/migrate-rewire-plugins-use-case.unit.test.ts`
- [ ] `tests/application/use-cases/migrate-use-case.unit.test.ts` — orchestration: no-op, dry-run, full migration, interactive abort, error in middle of pipeline (verify backup intact)

### Integration tests

- [ ] `tests/application/use-cases/migrate-use-case.integration.test.ts` — fixture with legacy v3 manifest + bundled plugins + framework files on disk → migrate → verify v5 manifest + dead files removed + backup present + user files untouched

### E2E tests

- One brownfield migrate E2E test in Phase 11

## Acceptance criteria

- [ ] `aidd migrate` on v5 manifest: no-op (silent, no warning)
- [ ] `aidd migrate` on v3 manifest: backup written + manifest upgraded + dead files removed + plugins rewired
- [ ] `aidd migrate --dry-run` on v3: prints plan, no mutation
- [ ] User-edited memory files (CLAUDE.md / AGENTS.md / copilot-instructions.md) preserved byte-identical post migration
- [ ] Failure mid-pipeline: backup file `.aidd/manifest.backup.json` intact, manifest left in last-saved state, error surfaces to user
- [ ] All unit tests green
- [ ] Integration test green
- [ ] `pnpm typecheck` + `pnpm biome check` clean

## Manual validation

```bash
cd /tmp && rm -rf brownfield && mkdir brownfield && cd brownfield

# Stage a legacy v3 manifest
mkdir -p .aidd
cp /path/to/repo/tests/fixtures/manifests/legacy-v3/manifest.json .aidd/

# Stage some user-edited memory files
echo "user memory" > CLAUDE.md
echo "user memory" > AGENTS.md
echo "user memory" > copilot-instructions.md

# Dry run
aidd migrate --dry-run
# expect: prints plan with field strips + plugins to rewire

# Apply
aidd migrate

# Verify
cat .aidd/manifest.json | jq .version
# expect: 5

cat .aidd/manifest.json | jq 'has("docs"), has("scripts"), has("docsDir"), has("repo"), has("mode")'
# expect: false × 5

cat CLAUDE.md
# expect: "user memory" — untouched

ls .aidd/manifest.backup.json
# expect: file present

# Idempotent
aidd migrate
# expect: no-op
```

## Risks / breaking changes

- If user has CUSTOM modifications to tracked files (not user memory but framework files), strip step removes them. Mitigation: backup includes manifest only, not files. Document in CHANGELOG: "before `aidd migrate`, run `aidd status` to inspect drift; modified tracked files are removed."
- Plugins missing in default marketplace catalog get logged warnings — user must re-install manually.
- `MigrateUseCase` execute method risks growing over 20 lines — extract private helpers per pipeline step.

## Commit

```
refactor(migrate): align with v5 schema dead-field strip

Migrate command now handles full v3/v4 → v5 cleanup:
- Backup .aidd/manifest.backup.json (atomic) before mutation
- Strip on-disk files tracked under legacy docs/scripts sections
- Re-register default marketplace if absent
- Rewire bundled plugins as marketplace installations
- Preserve user-edited memory files (CLAUDE.md / AGENTS.md / copilot-instructions.md)

Add MigrationPlan value object (pure decision computation).
Add MigrateBackup / MigrateStripDeadFiles / MigrateRewirePlugins sub-use-cases.

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-4.md
```
