---
id: 054
milestone: M5
title: "Implement automatic manifest format migration"
stories: []
points: 2
blockedBy: [025]
---

# 054: Implement automatic manifest format migration

## Context
Constitution Decision Rule #6: "When a CLI update changes the manifest format or framework descriptor schema, the CLI must migrate existing installations automatically — users must never be required to re-init or re-install." DoD criterion #13 confirms this. The manifest format may evolve between CLI versions, and old installations must be migrated transparently.

## Scope
Implement a manifest version field and automatic migration logic in the ManifestRepositoryAdapter. When loading a manifest, detect its version and apply migrations to bring it to the current format before returning it to the application layer.

## Acceptance Criteria
- [ ] Manifest has a `manifestVersion` field (integer, starting at 1)
- [ ] ManifestRepositoryAdapter.load() detects manifest version and applies sequential migrations
- [ ] Migration from v0 (no version field) to v1: adds `manifestVersion: 1` and preserves all existing data
- [ ] If the manifest is at the current version, no migration is applied
- [ ] If a migration is applied, the manifest is saved back to disk with the new version
- [ ] Migration failures produce a clear error: "Manifest migration failed from version X to Y. Run `aidd doctor` to diagnose."
- [ ] Future migrations can be added by appending to a migrations array (extensible pattern)
- [ ] Verbose mode logs migration details: "[verbose] Migrating manifest from v0 to v1"

## Technical Notes
- **UX Copy source of truth**: ALL user-facing text MUST use exact copy from `aidd_docs/memory/internal/ux_copy.md` where applicable.
- The migration logic lives in infrastructure (ManifestRepositoryAdapter), not domain. The domain Manifest model receives already-migrated data.
- Pattern: migrations array `[{ from: 0, to: 1, migrate: (data) => data }]`. Apply sequentially until current version reached.
- This is defensive infrastructure — it may not be needed in v3.0 but must be in place before v3.1+ changes the format.
- No migrations exist yet beyond v0->v1 (adding the version field). The value is the pattern, not the first migration.

## Files to Create/Modify
- `src/infrastructure/adapters/manifest-repository-adapter.ts` -- add migration logic to load()
- `src/infrastructure/migrations/manifest-migrations.ts` -- migration registry
- `tests/infrastructure/migrations/manifest-migrations.test.ts` -- migration tests
- `tests/infrastructure/adapters/manifest-repository-adapter.test.ts` -- migration integration tests

## Tests
- Load manifest without version field: migrates to v1
- Load manifest at current version: no migration
- Migration saves updated manifest to disk
- Migration failure: clear error message
- Multiple sequential migrations (v0 -> v1 -> v2 scenario)
- Verbose mode logs migration

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
