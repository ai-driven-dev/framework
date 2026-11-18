---
status: done
---

# Instruction: An update starts from what changed

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── aidd_docs/tasks/2026_11/2026_11_06_project-memory-challenge/
│   └── phase-4.md ✏️
├── cli/tests/fixtures/hooks-routes/ ✏️
├── plugins/
│   └── aidd-context/
│       ├── hooks/
│       │   ├── memory.cjs ✏️
│       │   └── lib/
│       │       ├── bank-guard.cjs ✏️
│       │       └── changes.cjs ✅
│       └── skills/
│           └── 02-project-memory/
│               ├── SKILL.md ✏️
│               ├── actions/
│               │   ├── 01-scan.md ✏️
│               │   └── 03-check.md ✏️
│               ├── assets/
│               │   └── fact-sheet.md ✏️
│               └── references/
│                   └── review-protocol.md ✏️
└── scripts/
    └── __tests__/
        ├── memory-check.test.js ✏️
        └── memory-skill-files.test.js ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | build a repository with a bank commit then a code commit | the fixture is ready | system |
| Happy path | run `changes` on it | it names the base, the changed file and the memory line that cites it | cli |
| Edge case: no repository | run `changes` outside a repository | the scope is audit, with its reason | cli |
| Edge case: bank never committed | run `changes` on a repository whose bank was never committed | the scope is audit, with its reason | cli |
| Edge case: old against new | refresh the update repository with the old and the new skill the same day (Haiku, three runs) | drifts caught out of twelve above the old skill's same-day score; team lines dropped: 0 | cli |
| Teardown | remove the fixture repositories | baseline restored | system |

## Tasks to do

### `4.1)` Print what changed

> A refresh reviews the whole bank in one sweep, and catches about one injected drift in three. A person would start from what changed since the memory was last written.

1. Add `memory.cjs changes [root] [--since <ref>]`.
2. Print the base and why it was chosen.
3. Print the changed files, including uncommitted ones.
4. Print the memory lines citing a changed path.
5. Print the files whose capability a changed defining file belongs to.

### `4.2)` Choose the base

> The base is the last commit that touched `aidd_docs/memory/`.

1. No repository, a bank never committed, or a base missing from a partial history makes the scope an audit, and says why.
2. `--since` overrides the base.

### `4.3)` Record the base in the sheet

> The base travels with the sheet.

1. The update writes the base and its commit message in the sheet's header.
2. The person may name an older reference.

### `4.4)` Review the named lines first

> The model reviews by change, without improvising version control.

1. Review the lines `changes` names first, then the rest only mechanically.
2. The model runs no version-control command of its own.

### `4.5)` Give the harness a drift commit

> The measurement needs drifts that postdate the bank.

1. The measurement harness, kept outside this repository, gives its update repository a second commit holding the drifts, after the commit that holds the bank.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 4.1 | `memory-check.test.js`: `changes` on a repository with a bank commit then a code commit names the base, the changed file and the memory line that cites it; fails on the parent commit |
| 4.2 | `memory-check.test.js`: with no repository, and with a bank never committed, the scope is audit, with its reason |
| 4.4 | Eval, Haiku, three runs, old against new the same day: drifts caught out of twelve above the old skill's same-day score; team lines dropped: 0 |
| 4.5 | The update repository holds the bank commit then the drift commit, in that order |
| 4.3 | The sheet header of an update carries the base and its commit message |
