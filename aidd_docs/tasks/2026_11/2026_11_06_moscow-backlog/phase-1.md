---
status: pending
---

# Instruction: Write the method into memory and docs

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── GOVERNANCE.md ✏️
├── .github/
│   └── labels.yml ✏️
├── aidd_docs/
│   └── memory/
│       └── backlog.md ✏️
└── docs/
    └── MAINTAINERS.md ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | stage the four edited files | files staged | cli |
| Happy path   | run `pnpm exec lefthook run pre-commit` | exit 0, no duplication or link failure | cli |
| Edge case    | search the four files for `never both` and `Urgent` | no match left | cli |

## Tasks to do

### `1)` Define the method in memory

> One place states the method; the other documents point to it.

1. In `aidd_docs/memory/backlog.md`, add the `MoSCoW` project field to Representation with its three values Must, Should, Could, and the rule that it is independent of the milestone.
2. State the milestone principle: one per week, a theme, filled with one or two Must items first; about three weeks ahead is a goal, not a rule.
3. State how Must items are chosen: team judgment and user feedback.
4. Replace the Priority bullet in Planning accordingly, keeping the counted-vote sentence.
5. Record that sub-issues build hierarchy.

### `2)` Fix the maintainer guide

> The field table tells the truth.

1. In `docs/MAINTAINERS.md`, replace the `Priority` row with `MoSCoW`, `Project`, values Must, Should, Could.
2. Delete "A milestone or a priority, never both."
3. Rewrite the Triage row to rank the issue and, when it is picked, give it a milestone.

### `3)` Fix governance and label comment

> No sentence refers to a field that does not exist.

1. In `GOVERNANCE.md`, change "ordered by priority" to "ranked by MoSCoW".
2. In `.github/labels.yml`, replace the comment's `org issue fields (Priority, Effort)` with the project fields.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `backlog.md` names the field, its values, the weekly milestone principle, the Must selection basis, and sub-issues for hierarchy |
| 2 | `docs/MAINTAINERS.md` has a `MoSCoW` row and no "never both" line |
| 3 | neither file mentions `Priority` or `Effort` as a field |
