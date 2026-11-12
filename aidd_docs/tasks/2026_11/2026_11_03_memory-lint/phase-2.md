---
status: done
---

# Instruction: Process fixes found while running phase 1

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── aidd_docs/memory/coding-assertions.md ✏️
├── plugins/aidd-dev/skills/
│   ├── 01-plan/scripts/validate-plan.cjs ✏️
│   └── 03-assert/SKILL.md ✏️
└── scripts/__tests__/
    └── validate-plan.test.js ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | a temp plan of three phases | files on disk | system |
| Happy path   | phase 1 deletes `src/x.js`, phase 2 creates it again, phase 3 modifies it | `VALID` | cli |
| Edge case    | phase 1 deletes `src/x.js`, phase 2 modifies it | refused, as phase 1 left it | cli |
| Edge case    | assert on a project whose pre-commit regenerates files | the pre-commit runs, its own rewrites are kept, nothing else changes | system |
| Teardown     | remove the temp plan | baseline restored | system |

## Tasks to do

### `1)` A recreated file exists again

> A later creation undoes an earlier deletion.

1. Write the failing case first in `validate-plan.test.js`.
2. In `validate-plan.cjs`, drop a path from the deleted set when a later phase creates it.

### `2)` Assert runs the checks as the project defines them

> A check that rewrites generated files is still run; its rewrites are the check's, not the assert's.

1. In `03-assert/SKILL.md`, the rule becomes: change nothing but the report and what a check rewrites itself: no code, no test, no config.
2. In `aidd_docs/memory/coding-assertions.md`, the pre-commit runs with `--all-files`: run by hand on uncommitted work, lefthook checks only staged files and skipped the scripts suite and the architecture rules.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | the delete-then-create case is `VALID`, the delete-then-modify case stays refused, every validator test passes |
| 2 | an assert run on this repository runs `pnpm exec lefthook run pre-commit` and reports its exit code |
