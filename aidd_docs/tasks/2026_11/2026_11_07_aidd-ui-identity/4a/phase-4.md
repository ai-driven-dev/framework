---
status: pending
---

# Instruction: docs, pilot rerun against the baseline, gates

## Architecture projection

```txt
.
├── docs/CATALOG.md ✏️
├── plugins/aidd-ui/README.md ✏️
└── aidd_docs/tasks/
    ├── 2026_10/2026_10_30_aidd-ui-rework/spec.md ✏️
    └── 2026_11/2026_11_07_aidd-ui-identity/run-4a.md
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | phases 1 to 3 merged on the branch | the wrapped suite passes | cli |
| Happy path | rerun the pilot on blank, Gouvernail, Kairos | each report line equals its baseline line | cli |
| Edge case | a line differs | its step outputs read, the cause fixed in the skill or written as a limit, the pilot rerun | cli |
| Edge case | `git grep -n -w composition` over the plugin, its tests and the global spec's records | nothing | cli |
| Teardown | remove the pilot copies and their outputs | gone; no session left for them | system |

## Tasks to do

### `1)` Docs

> Every page says four skills and `organism`.

1. Plugin README: start with `/aidd-ui:01-journeys`, then brand, foundations, components in order; the diagram's skill boxes become the four.
2. `docs/CATALOG.md` aidd-ui table: the four skills, their roles and actions.
3. Global spec lines 25, 47, 58, 68: `composition` becomes `organisme`.

### `2)` Pilot

> Same result as before the restructuration.

1. Run `node scripts/aidd-ui-pilot.cjs --gouvernail <checkout> --kairos <checkout>`.
2. Write its lines in `run-4a.md` under `## After`; equal to `## Baseline`, or each difference explained and settled.
3. Check no session is left for any copy; delete the copies.

### `3)` Gates

> Done means every gate green.

1. `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'`.
2. `pnpm exec lefthook run pre-commit`: regenerates the plugin `CATALOG.md` and README counts, checks links, local paths, skill front matter and argument hints, architecture rules.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | the README, the catalog and the spec's tree and records name the four skills and `organism`, never `01-system`, `02-journeys` or `composition` as a level; the spec's decision log keeps its history |
| 2 | `run-4a.md` After equals Baseline per pilot, or each gap is settled in writing |
| 3 | both commands exit 0 |
