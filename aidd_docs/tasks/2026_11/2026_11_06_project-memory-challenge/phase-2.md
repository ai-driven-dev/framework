---
status: in-progress
---

# Instruction: Facts go through one sheet before any write

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── aidd_docs/tasks/2026_11/2026_11_06_project-memory-challenge/
│   └── phase-2.md ✏️
├── plugins/
│   └── aidd-context/
│       ├── hooks/
│       │   └── memory.cjs ✏️
│       └── skills/
│           └── 02-project-memory/
│               ├── SKILL.md ✏️
│               ├── actions/
│               │   ├── 01-scan.md ✏️
│               │   ├── 02-write.md ✏️
│               │   └── 03-check.md ✏️
│               └── assets/
│                   └── fact-sheet.md ✅
└── scripts/
    └── __tests__/
        ├── memory-check.test.js ✏️
        └── memory-skill-files.test.js ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | write a valid sheet, a sheet citing a missing source and a sheet with a malformed line | the three sheets are ready | system |
| Happy path | run `facts` on the valid sheet | exit 0 | cli |
| Edge case: missing source | run `facts` on the sheet citing a missing source | exit 1 naming the line | cli |
| Edge case: malformed line | run `facts` on the sheet with a malformed line | exit 1 naming the line | cli |
| Edge case: create | create run, Haiku, three runs per create repository | every sheet passes `facts`; every memory line traces to a sheet line; `Q` lines at most eight | cli |
| Edge case: declined removals | update case declining every removal, Haiku and Qwen, three runs | team lines dropped: 0 | cli |
| Teardown | remove the sheets and fixture repositories | baseline restored | system |

## Tasks to do

### `2.1)` Define the fact sheet

> The write fills templates from what the model remembers of the scan, so specifics get invented and nothing names its source. One sheet holds every fact with its source.

1. Create `assets/fact-sheet.md` with the header (scope, base).
2. Add the blocks Read `R`, Inferred `D`, Unknown `Q` (at most eight), To rule.
3. Fix one line grammar: `- <id> | <file> > <section> | <fact> | <source> | <answer>`.

### `2.2)` State the skill's reader once

> The skill says who reads the memory.

1. State once: the macro view an AI tool loads every session, read by a person too.

### `2.3)` Collect facts into the sheet

> Each slot of the selected templates is answered from the repository, not from memory of the scan.

1. Answer each slot of the selected templates from the repository into the sheet.
2. Write the sheet to the task folder.
3. Only what the code cannot say becomes a `Q` line.

### `2.4)` Show the sheet once

> Nothing is shown to the person before the bank changes today; the sheet is that one view.

1. Show the sheet once.
2. Take answers in chat by id.
3. Silence is consent, except a `D` line that removes or replaces a team's line, which needs an explicit yes.
4. An unanswered `Q` removes its slot.

### `2.5)` Check the sheet with the engine

> A sheet that cites nothing real must not reach the write.

1. Add `memory.cjs facts <sheet> [root]`.
2. Exit 1 naming each line whose source does not exist or whose shape breaks the grammar.

### `2.6)` Write from the sheet only

> `actions/03-check.md` may offer to remove a file whose capability the scan missed, and detection varies between runs.

1. The write takes its content from the sheet only.
2. The check action never offers to remove a file.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 2.5 | `memory-check.test.js`: `facts` on a sheet citing a missing source, and on a malformed line, exits 1 naming each; a valid sheet exits 0; fails on the parent commit |
| 2.6 | `memory-skill-files.test.js`: the write reads the sheet, and no action offers to remove a file; fails on the parent commit |
| 2.4 | `memory-skill-files.test.js`: the consent rule names the removal exception; fails on the parent commit |
| 2.3 | Eval, Haiku, three runs per create repository: every sheet passes `facts`; every memory line traces to a sheet line; `Q` lines at most eight |
| 2.4 | `memory-check.test.js`: no team line gone without a `D` line answered yes, listed by the read-only `vanished --sheet` with exit 1; the bank is byte-identical after `vanished` and `facts`. Eval, Haiku and Qwen: the update case lists the lines gone without such a `D` line |
