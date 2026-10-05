# 02 - Execute

## Input

The prepared plan.

## Output

Committed phases marked `done`, or a `blocked` / `replan needed` report.

## Process

1. **Open.** Walk phases in order, setting each `status: in-progress` (`phase-<n>.md` beside `plan.md` in a feature folder).
2. **Code.** Build the phase scope against its acceptance criteria.
3. **Assert.** Apply the validation rules below.
4. **Complete.** Set the phase `status: done` and commit it.

## Rules

- Workflow: validate every acceptance criterion through the real affected workflow using the appropriate interface (browser, CLI, API…). Check actual against expected behavior at every step; fix mismatches, then restart from the beginning.
- Success: `done` requires a full successful run with observable evidence for every step. Report blocked validation; never count it as success.
- Blocked: follow [blocked.md](../references/blocked.md) and commit the blocked plan.
- Drift: if satisfying the acceptance criteria requires changing scope or requirements, stop with `replan needed: <reason>`. Never rewrite the plan.
