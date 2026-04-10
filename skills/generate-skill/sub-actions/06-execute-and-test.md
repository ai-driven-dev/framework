# SA-06: Execute & test

Run the skill end-to-end and verify each sub-action's test policy passes.

## Instructions

1. Run the generated skill by executing each sub-action in order.
2. For each sub-action, verify its test policy:
   - Does the exit condition pass?
   - Does the output match what was expected?
3. If a test fails, diagnose the issue:
   - Is the sub-action's instructions unclear or wrong?
   - Is a precondition not met?
   - Is the test policy itself unrealistic?
4. Fix the sub-action file and re-run it.
5. Do not skip failing tests.
6. Update the validation table from step 04, filling the Status column with the actual outcome.

## Input / Output

- **Input**: All skill files written from step 05.
- **Output**: Updated validation table with actual pass/fail results for each sub-action.

## References

- No specific reference needed for this step.

## Test policy

- **Assertion**: Every sub-action's exit condition passes.
- **Exit condition**: All rows in the validation table show ✅ with actual test results.
- **Expected result**: Fully tested skill with all policies passing.
- **Retry loop**: If a test fails, fix the sub-action and re-run. Loop until it passes. Hard stop after 3 failures on the same sub-action: report the issue to the user and ask for guidance.
- **On failure**: Report which sub-actions fail, what the expected vs actual result was, and ask the user how to proceed.
