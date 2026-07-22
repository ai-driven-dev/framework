# 04 - Gate Golden and Tests

Verify that the baseline captured in action 01 is still fully satisfied: all tests pass, the
build succeeds, and typecheck exits 0. This is the mandatory quality gate before committing.

## Inputs

- `baseline` (required) - the recorded state from action 01 (test count, build status)

## Outputs

- PASS: all gate conditions met — proceed to action 05 (commit)
- FAIL: at least one condition not met — proceed to action 05 (rollback)

## Process

1. Run `pnpm typecheck`. Confirm exit 0. If not, record FAIL.
2. Run `pnpm test`. Confirm:
   - Exit code 0
   - Test file count equals or exceeds the baseline count
   - No previously passing test is now failing
   If any condition fails, record FAIL with the exact error output.
3. Run `pnpm build`. Confirm exit 0. If not, record FAIL.
4. Confirm that all changes in the target layer are traceable to a violation fix logged in
   action 03. No "bonus" edits, no accidental formatting-only changes that might diverge
   behavior or snapshot output.
5. Record the gate result: PASS or FAIL with details.

## Gate conditions (all must be true for PASS)

- `pnpm typecheck` exits 0
- `pnpm test` exits 0 and count >= baseline
- `pnpm build` exits 0
- Every changed file has a corresponding violation-fix entry in the action 03 log

## Test

The gate is self-verifying: its output is the evidence. Record the exact exit codes and test
counts in the task tracking log.
