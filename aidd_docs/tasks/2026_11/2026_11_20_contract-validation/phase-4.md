---
status: pending
---

# Instruction: Plan and run contracts

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/
│   └── aidd-dev/
│       ├── CATALOG.md ✏️
│       └── skills/
│           ├── 01-plan/
│           │   ├── SKILL.md ✏️
│           │   ├── actions/
│           │   │   └── 03-conclude.md ✏️
│           │   └── scripts/
│           │       ├── contract.json ✅
│           │       ├── validate-plan.cjs ✏️
│           │       ├── checks/ ✅
│           │       └── lib/ ✅
│           └── 02-implement/
│               ├── SKILL.md ✏️
│               ├── actions/
│               │   ├── 01-prepare.md ✏️
│               │   ├── 02-execute.md ✏️
│               │   └── 03-finalize.md ✏️
│               └── scripts/
│                   ├── contract.json ✅
│                   ├── validate-implement.cjs ✏️
│                   ├── checks/ ✅
│                   └── lib/ ✅
└── scripts/
    └── __tests__/
        ├── validate-plan.test.js ✏️
        └── validate-implement.test.js ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | archive of plans under `aidd_docs/tasks/` | 88 folders | system |
| Happy path   | old and new validator on each archived plan | same verdict, except plans the new one checks more strictly | cli |
| Happy path   | the 39 plan tests | pass, minus the outside-the-skill case | cli |
| Edge case    | plan status not in the lifecycle | status finding | cli |
| Edge case    | `run.md` with `Head` not a commit | run finding | cli |
| Edge case    | implement started on a tree modified outside the feature folder | `01-prepare` stops and asks | cli |
| Teardown     | none | none | system |

## Tasks to do

### `1)` Plan contract

> `validate-plan.cjs` becomes the wrapper over the plan contract.

1. Port the prototype plan contract and `checks/`, without the outside-the-skill check.
2. Adapt `validate-plan.test.js` to the engine output and drop its outside-the-skill case.
3. Update `03-conclude.md` and the `SKILL.md` label to the engine's clean exit.

### `2)` Run contract and split

> Statuses and the run form leave `validate-implement.cjs`.

1. Move status and `run.md` form checks, `Head` included, into the implement contract.
2. Keep the `NEXT:` line as navigation; remove `--baseline`, the baseline file and the uncommitted NOTE.
3. Make `01-prepare` stop and ask when the tree is modified outside the feature folder.
4. Add a `git status` step to `03-finalize` that lists the uncommitted files.
5. Update `02-execute.md`, the `SKILL.md` labels and `validate-implement.test.js`.
6. Regenerate `plugins/aidd-dev/CATALOG.md`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | 38 plan tests pass; archive parity holds |
| 2 | `NEXT:` tests pass unchanged; no `--baseline` left in skill or tests |
