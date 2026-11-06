---
status: pending
---

# Instruction: Build the weekly milestones and retire the old Priority field

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | list the Must items | candidates for themes | cli |
| Happy path   | create three themed milestones due on consecutive Fridays and attach issues | each milestone holds one or two Must items | cli |
| Edge case    | delete the `Priority` issue field before approval | forbidden: the step waits for an explicit go | cli |

## Tasks to do

### `1)` Propose three themes

> The maintainer picks the next three weeks.

1. From the Must items, propose three themes with the Must items that carry each, using team judgment and user feedback.
2. Wait for approval of the themes and the Fridays.

### `2)` Create and fill the milestones

> Each milestone is a themed week.

1. Create each with `gh api repos/ai-driven-dev/framework/milestones -f title=<theme> -f due_on=<Friday>`.
2. Attach the Must items, then the approved Should and Could items, with `gh issue edit <number> --milestone <title>`.

### `3)` Retire the old Priority field

> One axis remains.

1. Ask for an explicit go; the deletion is irreversible.
2. Delete the organization issue field `Priority` through the organization issue-fields API. If the call is not supported, stop and report.
3. Confirm with `gh api orgs/ai-driven-dev/issue-fields` that it is gone.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | the maintainer approved the three themes and dates |
| 2 | each milestone lists its issues and at least one is Must |
| 3 | the issue-fields list no longer contains `Priority` |
