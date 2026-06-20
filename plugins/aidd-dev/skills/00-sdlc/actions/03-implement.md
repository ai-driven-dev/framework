# 03 - Implement

Build the plan's code by delegating to the `implement` skill, which loops the phases, drives status, and validates. Mandatory.

## Inputs

- `plan_path` (from 02) - required
- On an `04 = iterate` loop-back, the review findings as a fix list - optional

## Outputs

The plan reaches frontmatter `status: implemented` (or `status: blocked`), every phase `done`, validation green.

## Process

1. **Delegate.** Invoke the `implement` skill with `plan_path`. It branches, loops each phase through the `implementer`, commits the code and the status transitions, and runs the plan's validation. The orchestrator writes no status itself.
2. **Iterate.** On a loop-back from `04 = iterate`, fold the findings into the plan (set the affected phases back to `pending` or add a fix phase), then delegate again.
3. **Blocked.** The skill stops at `status: blocked` when the implementer hits a human-only condition. Do NOT proceed to `04`; escalate to a human.
4. **Surface.** Report the skill's outcome to the orchestrator so it can move to `04`.

## Test

The plan frontmatter `status` is `implemented` (or `blocked`, stopping before `04`); every phase reads `status: done`; the validation commands return exit code 0.
