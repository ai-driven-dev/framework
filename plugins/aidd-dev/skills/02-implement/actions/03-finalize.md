# 03 - Finalize

## Input

The coded plan.

## Output

The validated plan marked `implemented`.

## Process

1. **Verify.** Run the plan's validation commands and tests.
   - Start the required runtime if needed.
2. **Mark.** Set the plan `status: implemented`.
   - Commit according to the commit policy.

## Rules

- Gate `implemented` on successful validation.
  - Require every phase `done`.
  - Require all validation commands and tests to pass.
- Repair validation failures before `implemented`.
  - Rerun the affected workflow after a repair.
  - Rerun the validation commands and tests.
  - Follow Execute's validation, blocker and drift rules.
