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
- `type MergeStrategy = ...` — use `import type { MergeStrategy } from "../../domain/models/merge-strategy.js"`

## Banned inline constants

- `const EXCLUDED_FILES = new Set([...])` in sync-use-case — use `import { SYNC_EXCLUDED_FILES } from "../../domain/models/sync-exclusions.js"`
- `function isExcluded(...)` in sync-use-case — use `import { isSyncExcluded } from "../../domain/models/sync-exclusions.js"`

## Rationale

- Inline definitions cause type drift across use-case boundaries
- Prevents type-safe narrowing when the same concept is redefined
- Domain layer owns shared types — hexagonal architecture rule
