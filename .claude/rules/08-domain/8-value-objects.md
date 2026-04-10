---
paths:
  - "src/domain/models/**/*.ts"
  - "src/application/use-cases/**/*.ts"
---

# Domain Value Objects and Discriminant Types

## Discriminant types

- Every discriminant string union used in ≥2 use-cases → named type in `src/domain/models/`
- Never inline `type Foo = "a" | "b"` in use-case files

## Value objects

- All fields `readonly`
- No setters — return new instance for mutations
- Validate invariants in constructor, throw on invalid input
- Use params object when ≥3 constructor parameters
- Static factory only when multiple distinct creation paths exist
- Implement `.equals()` when used in comparisons or collections

## Constants

- Module-level `const` in `CONSTANT_CASE` above the class definition
- Named constant for any literal used more than once

## Import rules

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
| `MergeStrategy`    | `src/domain/models/merge-strategy.ts`  |
| `MergeFileEntry`   | `src/domain/models/merge-entry.ts`     |
