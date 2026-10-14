# Finalize

## Input

A plan with all phases done and integrated.

## Output

Plan `status: implemented`, with integrated acceptance and validation evidence.

## Process

1. **Verify.** Check every plan-level acceptance criterion and required validation on the integrated candidate; return failures to execution and revalidate repairs.
2. **Mark.** Set the plan `status: implemented` only when all required checks pass.

## Rules

- **Evidence.** Reuse passing results only for the same candidate and required scope; phase checks alone do not establish integrated acceptance.
- **Validation scope.** Never format code or run dev mode during finalization.
