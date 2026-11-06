---
status: pending
---

# Instruction: The brief carries the functional macro; rules keep the coding detail; the load is measured

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── aidd_docs/tasks/2026_11/2026_11_06_project-memory-challenge/
│   └── phase-5.md ✏️
├── plugins/
│   └── aidd-context/
│       ├── hooks/
│       │   └── memory.cjs ✏️
│       └── skills/
│           └── 02-project-memory/
│               ├── actions/
│               │   └── 02-write.md ✏️
│               ├── assets/
│               │   └── templates/
│               │       └── memory/
│               │           └── core/
│               │               └── project-brief.md ✏️
│               └── references/
│                   └── memory-rules.md ✏️
└── scripts/
    └── __tests__/
        ├── memory-check.test.js ✏️
        ├── memory-skill-files.test.js ✏️
        └── memory-templates.test.js ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | build a bank and the create repositories | fixtures are ready | system |
| Happy path | run `check` on a bank | it prints the loaded words as a warning and exits 0 | cli |
| Edge case: create | create the memory on each create repository (Haiku, three runs) | the brief stays under the 400-word warning; no memory line restates an existing rule | cli |
| Teardown | remove the fixtures | baseline restored | system |

## Tasks to do

### `5.1)` Give the brief its functional sections

> The functional view is one table of features: the reader knows how the project is built, not who uses it or what it does day to day.

1. Add to `project-brief.md` `Users` (the roles, one line each), `Main journey` (three to six steps) and `Business rules` (the rules that never bend).
2. Create asks for them, an update never forces them, an audit proposes them.

### `5.2)` Send detailed conventions to rules

> A detailed coding convention found by the scan has no home but memory, where it duplicates a rule.

1. Before writing a convention line, look for a rule that covers it in the places the rule skill's discovery reference lists.
2. Covered: write nothing.
3. Detailed and uncovered: put it in the sheet's To rule block.

### `5.3)` Report the load

> Nothing measures the words every session loads.

1. `check` reports the words every session loads, as a warning.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 5.1 | `memory-templates.test.js`: the brief holds the three sections; fails on the parent commit |
| 5.3 | `memory-check.test.js`: `check` on a bank prints the loaded words and exits 0; fails on the parent commit |
| 5.2 | `memory-skill-files.test.js`: the rule lookup points to the rule skill's discovery reference and keeps no list of its own; fails on the parent commit |
| 5.1 | Eval, Haiku, three runs per create repository: the brief stays under the 400-word warning |
| 5.2 | Eval, Haiku, three runs per create repository: no memory line restates an existing rule |
