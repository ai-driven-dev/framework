# Finalize

## Input

A plan with all phases done and integrated.

## Output

Plan `status: implemented`, with integrated acceptance and validation evidence.

## Process

1. **Verify.** Check the source outcome, phase criteria, and all required validation commands/tests together on the integrated candidate; start the required runtime if needed.
2. **Repair.** Return failures to execution, rerun the affected workflow and validation commands/tests under Execute's validation, blocker, and drift rules.
3. **Mark.** Set the plan `status: implemented` only when all required checks pass; commit according to commit policy.

## Rules

- **Evidence.** Reuse passing results only for the same candidate and required scope; phase checks alone do not establish integrated acceptance.
