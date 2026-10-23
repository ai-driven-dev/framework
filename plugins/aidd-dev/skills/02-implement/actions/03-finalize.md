# 03 - Finalize

## Input

The coded plan.

## Output

The validated plan marked `implemented`.

## Process

1. **Verify.** Validate the source outcome and phase criteria together after integration, then run the plan's validation commands and tests.
   - Start the required runtime if needed.
   - Run any required end-to-end journey last, through `/aidd-dev:06-test`.
2. **Mark.** Set the plan `status: implemented`.
   - Commit according to the commit policy.

## Rules

- Gate `implemented` on every phase `done` and every Verify check passing.
- Repair failures first, then rerun what the repair affects and any final journey.
  - Follow Execute's validation, blocker and drift rules.
