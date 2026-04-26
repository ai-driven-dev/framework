---
paths:
  - "src/application/use-cases/**/*.ts"
---

# Discriminant Types — No Inline Definitions

## Banned inline types

- `FileDiffKind` → `import type { FileDiffKind } from "../../domain/models/file.js"`
- `FileDiff` → `import type { FileDiff } from "../../domain/models/file.js"`
- `ConflictDecision` → `import type { ConflictDecision } from "../../domain/models/merge.js"`
- `UpdateScope` → `import type { UpdateScope } from "../../domain/models/tool-scope.js"`
- `MergeStrategy` → `import type { MergeStrategy } from "../../domain/models/merge.js"`

## Banned inline constants

- `EXCLUDED_FILES` constant in sync use-case → use `SYNC_EXCLUDED_FILES` from `sync-policy.js`
- `isExcluded` function in sync use-case → use `isSyncExcluded` from `sync-policy.js`
