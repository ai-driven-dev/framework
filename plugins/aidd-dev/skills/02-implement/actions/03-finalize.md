# 03 - Finalize

## Input

The coded plan.

## Output

The validated plan marked `implemented`.

## Process

1. **Verify.** Validate the source outcome and phase criteria together after integration, then run the plan's validation commands and tests.
   - Start the required runtime if needed.
   - Run any required end-to-end journey last, before marking the plan implemented.
2. **Mark.** Set the plan `status: implemented`.
   - Commit according to the commit policy.

## Rules

- Gate `implemented` on successful validation.
  - Require every phase `done`.
  - Require all validation commands and tests to pass.
  - Require any final journey to pass on the verified implementation.
- Repair validation failures before `implemented`.
  - Rerun affected workflows, validation commands and tests, then any required final journey.
  - Follow Execute's validation, blocker and drift rules.
