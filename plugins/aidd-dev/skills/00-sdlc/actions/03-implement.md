# 03 - Implement

Build the plan's code by spawning the `executor` agent to run the `aidd-dev:02-implement` recipe, which loops the phases, drives status, and validates. Mandatory.

## Input

The plan path from `02` (required), and on an `iterate` loop-back the review findings to hand over as a fix list (optional).

## Output

The plan reaches `status: implemented`, every phase `done`, validation green. Or it stops at `status: blocked` when a human is needed.

## Process

1. **Implement.** Spawn the `executor` agent and brief it to run the `aidd-dev:02-implement` recipe on `plan_path`. The agent branches, codes every phase, commits the code and the status transitions, and validates.
2. **Iterate.** After an `iterate` verdict, spawn `executor` again with the findings as a fix list. It codes them against the current diff, then asserts and validates, gating like a phase: done only when it passes. Never edit the plan; the loop fixes the diff, not the plan.
3. **Resolve.** Read the plan's final `status`.
   - `implemented`: the step is done.
   - `blocked`: a human-only condition stopped the run. Do not continue. Escalate to a human.

## Test

- The plan `status` is `implemented`, or `blocked` when a human-only condition stopped it.
- Every phase reads `status: done`.
- The validation commands return exit code 0.
