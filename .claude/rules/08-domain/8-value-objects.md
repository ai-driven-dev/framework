---
paths:
  - "src/domain/models/**/*.ts"
  - "src/application/use-cases/**/*.ts"
---

# Domain Value Objects and Discriminant Types

## Rule: Named types for discriminant strings

Every discriminant string union used in 2 or more use-cases must be a named type in `src/domain/models/`.

- Do not inline `type Foo = "a" | "b"` inside use-case files.
- Import the type from its domain model file.

## Rule: Value objects are immutable

- All fields `readonly`
- No setters — return new instance for mutations
- Constructed via factory functions when validation is required

## Rule: Domain files have no upward imports

- Files in `src/domain/models/` must not import from `src/application/` or `src/infrastructure/`
- Cross-domain imports within `src/domain/models/` are allowed

## Canonical locations

| Type               | File                                  |
| ------------------ | ------------------------------------- |
| `FileDiffKind`     | `src/domain/models/file-diff.ts`      |
| `FileDiff`         | `src/domain/models/file-diff.ts`      |
| `ConflictDecision` | `src/domain/models/conflict-decision.ts` |
| `UpdateScope`      | `src/domain/models/update-scope.ts`   |
| `SYNC_EXCLUDED_FILES` | `src/domain/models/sync-exclusions.ts` |
| `isSyncExcluded`   | `src/domain/models/sync-exclusions.ts` |
