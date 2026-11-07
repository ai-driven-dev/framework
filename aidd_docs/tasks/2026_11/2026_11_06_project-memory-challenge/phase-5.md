---
status: done
---

# Instruction: The brief carries the functional macro; the load is measured

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── aidd_docs/tasks/2026_11/2026_11_06_project-memory-challenge/
│   └── phase-5.md ✏️
├── plugins/
│   └── aidd-context/
│       ├── hooks/
│       │   ├── lib/
│       │   │   └── memory-rules.cjs ✏️
│       │   └── memory.cjs ✏️
│       └── skills/
│           └── 02-project-memory/
│               ├── actions/
│               │   └── 01-scan.md ✏️
│               ├── assets/
│               │   └── templates/
│               │       └── memory/
│               │           └── core/
│               │               └── project-brief.md ✏️
│               └── references/
│                   └── memory-rules.md ✏️
└── scripts/
    └── __tests__/
        ├── fixtures/
        │   └── memory-question-bank.json ✏️
        ├── memory-check.test.js ✏️
        ├── memory-skill-files.test.js ✏️
        └── memory-templates.test.js ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | build a bank and the create repositories | fixtures are ready | system |
| Happy path | run `check` on a bank | it prints the loaded words as a warning and exits 0 | cli |
| Edge case: create | create the memory on each create repository (Haiku, three runs) | the brief stays under the 400-word warning | cli |
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

Dropped: measured with no effect, the rule skill was not reachable and rule restatements came anyway.

### `5.3)` Report the load

> Nothing measures the words every session loads.

1. `check` reports the words every session loads, as a warning.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 5.1 | `memory-templates.test.js`: the brief holds the three sections; fails on the parent commit |
| 5.3 | `memory-check.test.js`: `check` on a bank prints the loaded words and exits 0; fails on the parent commit |
| 5.2 | Dropped, see the task |
| 5.1 | Eval, Haiku, three runs per create repository: the brief stays under the 400-word warning. Measured, words per run: 66, 76, 84, 199, 138, 129 (ops 1-3, tooling 1-3), then 95, 31, 127, 99, 133, 107 after the scan fix |
| 5.2 | Dropped, see the task |

## Limits

- A functional section the repository cannot answer is sometimes dropped with neither an answer nor a `Q` line: 3 of 18 slots in the last eval. Nothing true is lost, so no code guards it.
- The load warning assumes a context file imports the bank, and fires on every whole-bank check.
