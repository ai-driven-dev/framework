# 03 - Finalize

Run the validation and mark the plan implemented once every phase is done.

## Input

A plan whose phases are all `status: done`, from `02-execute`.

## Output

The feature validated green with the plan frontmatter `status: implemented`.

## Process

1. **Verify.** Verify every plan-level acceptance criterion and required validation against the integrated candidate.
   - Phase checks alone do not establish that the combined workflow works.
   - Reuse a passing result only when it covers the same candidate and required scope; rerun checks invalidated by later changes or integration. Never format code or run dev mode.
   - On failure, return the affected scope to execution and verify the repaired candidate before marking completion.
2. **Mark.** Set the plan `status: implemented` only when every phase is done and integrated validation is green, then deliver under the caller's commit policy.

## Test

| Case | Pass |
| --- | --- |
| Finalization succeeds | Every phase is done and the required validation covers the integrated candidate with passing results. |
| A previous result is reused | Its candidate and required scope match; changed candidates invalidate affected checks. |
| Validation fails | The plan is not marked implemented; affected work returns for repair. |
| The plan reaches implemented | Its status is delivered under the caller's commit policy. |
