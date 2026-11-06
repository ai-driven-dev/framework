---
status: pending
---

# Instruction: Rank the Todo issues

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | list items with Status Todo | the Todo set, none with a rank | cli |
| Happy path   | set the validated rank on each Todo item | every Todo item has a rank in `gh project item-list` | cli |
| Edge case    | an item in Ideation | it keeps no rank | cli |

## Tasks to do

### `1)` Propose the ranking

> A proposal the maintainer can accept or change in one pass.

1. Read each Todo issue with its title, body, type and the existing `Priority` value.
2. Propose Must, Should or Could for each, with one line of reason from team judgment and user feedback (reactions, counted votes).
3. Present the list and wait for corrections. Write nothing before approval.
4. Tell the maintainer these ranks are provisional: the value of each issue is reviewed again later.

### `2)` Write the ranks

> The approved ranking lives in the project.

1. For each Todo item, set the field with `gh project item-edit`.
2. Read back `gh project item-list 8 --owner ai-driven-dev --format json` and compare with the approved list.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | the maintainer approved a rank for every Todo issue |
| 2 | every Todo item shows its approved rank and no Ideation item shows one |
