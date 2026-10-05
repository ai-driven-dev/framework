# 03 - Finalize

## Input

A plan whose phases are all `done`.

## Output

The validated plan committed as `implemented`.

## Process

1. **Verify.** Run the plan's validation commands and tests, starting the required runtime if needed.
2. **Mark.** Set the plan `status: implemented` and commit it.

## Rules

- Success: `implemented` requires every phase `done` and all validation commands and tests passing.
- Failure: fix validation failures and rerun the affected workflow plus validation commands and tests before `implemented`; follow Execute's validation, blocker and drift rules.
