# 03 - Finalize

Validate the whole plan and mark it implemented.

## Input

The plan with every phase `done`, implemented here or integrated by the caller.

## Process

1. Start the runtime the checks need.
2. Validate the source outcome and the phase criteria together, then run the plan's validation commands and tests.
   - On a failure, repair it, then rerun what the repair affects.
3. Set the plan `status: implemented`, and commit it.

## Output

The plan marked `implemented`.

## Rules

- Mark `implemented` only when every phase is `done` and every check passes.
