# 02 - Execute

## Input

The prepared plan.

## Output

Validated phases marked `done`.

Or a `blocked` / `replan needed` report.

## Process

1. **Open.** Walk phases in order.
   - Set the current phase `status: in-progress`.
   - In a feature folder, read `phase-<n>.md` beside `plan.md`.
2. **Code.** Build the next task or inseparable group against its acceptance criteria.
   - Follow the plan's task order.
3. **Assert.** Apply the validation rules below to every acceptance criterion of the selected task or group.
   - After the last task:
     - Validate the full phase workflow.
     - Set the phase `status: done` on success.
4. **Complete.** Commit according to the commit policy.
   - Repeat steps 2–4 for the remaining tasks.

## Rules

- Validate every acceptance criterion through the real affected workflow.
  - Use the appropriate interface (browser, CLI, API…).
  - Check actual against expected behavior at every step.
  - Fix any mismatch.
  - Restart from the beginning after a repair.
- Gate task commits and `done` on successful validation.
  - Require a full successful run.
  - Require observable evidence for every step.
  - Report blocked validation.
  - Never count blocked validation as success.
- Follow [blocked.md](../references/blocked.md) when implementation is blocked.
  - Record the blocked plan according to the commit policy.
  - Leave unfinished code uncommitted.
- Stop if satisfying the acceptance criteria requires changing scope or requirements.
  - Report `replan needed: <reason>`.
  - Never rewrite the plan.
