---
status: done
---

# Instruction: Engine copied into each skill

## Architecture projection

```txt
.
├── lefthook.yml ✏️
├── plugins/
│   └── aidd-ui/
│       └── skills/
│           └── 03-foundations/
│               └── scripts/
│                   └── aidd-ui/ ✅
└── scripts/
    ├── __tests__/
    │   ├── check/
    │   │   └── generator-aidd-ui-engine.test.js ✅
    │   └── lefthook-stages-only-generated.test.js ✏️
    └── check/
        └── generators/
            ├── aidd-ui-engine.cjs ✅
            └── index.cjs ✏️
```

## Test Scope

| Scenario   | Action                                         | Observable outcome                              | Actor  |
| ---------- | ---------------------------------------------- | ----------------------------------------------- | ------ |
| Setup      | a scratch tree with the engine and two skills  | no copy exists                                  | system |
| Happy path | run the generator with write                   | each skill holds a byte-identical copy, then the generator finds nothing stale | system |
| Edge case  | edit a copy by hand, or add a file with no source | the generator names that file; write restores or deletes it | system |
| Edge case  | commit a change to the engine source           | the pre-commit stages the changed, new and deleted copies | system |

## Tasks to do

### `1)` Generator

> Keep one engine copy per skill, identical to the hook's.

1. Copy `hooks/aidd-ui.cjs` and `hooks/lib/**`, without `hooks/lib/contracts/`, into `skills/*/scripts/aidd-ui/`.
2. Name each missing, stale or orphan copy; with write, fix it.

### `2)` Pre-commit

> A regenerated copy follows its source into the commit.

1. Stage the copies `run.cjs --fix` changed, created or deleted.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | `node scripts/check/run.cjs` exits 0 on the tree, and names a copy edited by hand |
| 2    | a commit of an engine change carries every copy it changed |
