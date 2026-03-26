---
paths:
  - "src/application/use-cases/**/*.ts"
---

# Discriminant Types — No Inline Definitions

The following types are banned as inline definitions inside use-case files.
Always import them from `src/domain/models/`.

## Banned inline types

- `type FileDiffKind = "added" | "removed" | "changed" | "unchanged"` — use `import type { FileDiffKind } from "../../domain/models/file-diff.js"`
- `interface FileDiff { ... }` — use `import type { FileDiff } from "../../domain/models/file-diff.js"`
- `type ConflictDecision = "overwrite" | "skip" | "backup"` — use `import type { ConflictDecision } from "../../domain/models/conflict-decision.js"`
- `type UpdateScope = ...` — use `import type { UpdateScope } from "../../domain/models/update-scope.js"`

## Banned inline constants

- `const EXCLUDED_FILES = new Set([...])` in sync-use-case — use `import { SYNC_EXCLUDED_FILES } from "../../domain/models/sync-exclusions.js"`
- `function isExcluded(...)` in sync-use-case — use `import { isSyncExcluded } from "../../domain/models/sync-exclusions.js"`

## Rationale

Discriminant types shared across use-cases belong in the domain layer. Inlining them:
- Creates type drift (same concept defined differently in two places)
- Prevents type-safe narrowing across use-case boundaries
- Violates the hexagonal architecture's domain ownership rule
