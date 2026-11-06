---
status: pending
---

# Instruction: Create the MoSCoW project field

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | list the project fields | no `MoSCoW` field yet | cli |
| Happy path   | create the field with three options | `gh project field-list` shows it with Must, Should, Could | cli |
| Edge case    | create it a second time | a duplicate is reported or visible: stop and do not recreate | cli |
| Edge case    | open the Kanban and Milestones views | `MoSCoW` is selectable as a column or grouping; if not, report it to the maintainer | browser |

## Tasks to do

### `1)` Create the field

> The project can hold a rank per item.

1. Run `gh project field-create 8 --owner ai-driven-dev --name MoSCoW --data-type SINGLE_SELECT --single-select-options "Must,Should,Could"`.
2. Read the field back with `gh project field-list 8 --owner ai-driven-dev --format json`.

### `2)` Rewrite the project README

> The board describes only fields that exist.

1. Replace the README's field list (Phase, Work Type, Area, Priority) with the real fields: Status, MoSCoW, Milestone, plus the type.
2. Apply it with `gh project edit 8 --owner ai-driven-dev --readme`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | the field exists exactly once with the options Must, Should, Could |
| 2 | the README lists no field absent from `gh project field-list` |
| 1 | `MoSCoW` appears in the Kanban and Milestones views |
