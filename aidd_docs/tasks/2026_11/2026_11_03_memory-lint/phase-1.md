---
status: done
---

# Instruction: Plan validator follows the phases

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/aidd-dev/skills/01-plan/scripts/
│   └── validate-plan.cjs ✏️
└── scripts/__tests__/
    └── validate-plan.test.js ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | a temp plan of two phases | files on disk | system |
| Happy path   | phase 1 creates `src/new.js`, phase 2 modifies it | `VALID` | cli |
| Edge case    | phase 2 modifies a file no phase creates and the disk lacks | refused, as today | cli |
| Edge case    | phase 1 deletes `src/old.js`, phase 2 modifies it | refused: the file is gone by then | cli |
| Edge case    | phase 2 creates a file phase 1 modifies | refused: phase 1 runs first and finds nothing | cli |
| Teardown     | remove the temp plan | baseline restored | system |

## Tasks to do

### `1)` Phases in order

> A phase may modify or delete what an earlier phase creates, and nothing an earlier phase deletes.

1. Write the failing cases first in `validate-plan.test.js`, extending its `good()` helper, which builds a single phase today, to two.
2. In `validate-plan.cjs`, walk the phases in plan order, carrying the paths earlier phases create and delete: a modified or deleted path must exist on disk or be created earlier, and must not be deleted earlier.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | the four scenarios give their outcome, and every existing validator test still passes |
