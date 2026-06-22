# 03 - Implement

Build the plan's code by delegating to the `implement` skill, which loops the phases, drives status, and validates. Mandatory.

## Inputs

- `plan_path` from `02` (required).
- On an `iterate` loop-back, the review findings to fold in (optional).

## Output

The plan reaches `status: implemented`, every phase `done`, validation green. Or it stops at `status: blocked` when a human is needed.

## Process

1. **Implement.** Run the `implement` skill on `plan_path`. It branches, codes every phase through the `implementer`, commits the code and the status transitions, and validates. This action writes no status itself.
2. **Iterate.** When the step runs after an `iterate` verdict, first fold the findings into the plan: reopen the affected phases or add a fix phase. Then run the `implement` skill again.
3. **Resolve.** Read the plan's final `status`.
   - `implemented`: the step is done.
   - `blocked`: a human-only condition stopped the run. Do not continue. Escalate to a human.

## Test

- The plan `status` is `implemented`, or `blocked` when a human-only condition stopped it.
- Every phase reads `status: done`.
- The validation commands return exit code 0.
