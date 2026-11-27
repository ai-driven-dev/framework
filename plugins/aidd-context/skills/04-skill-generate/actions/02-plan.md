# 02 - Plan

Break the skill into actions, one job each.

## Input

The request and its source: the confirmed frame, or the existing skill.

## Process

1. List each file to write with its changes: the requested ones and the [skill-authoring.md](../references/skill-authoring.md) breaches it fixes.
   - Nothing to change: say so and stop.
2. List as content to keep each rule, step, branch, wait, loop and stop of the existing skill, with its file.
   - Changed by the request: list it as a change instead.
3. List each fact of the source the rules leave no home.
4. List each addition beyond the source and the request.
5. Merge two actions that share most logic.
6. Fill one row per action in `| # | Slug | Title | Input -> output | Rules | Cases in | Next, on condition | Check step |`.
   - Single action: list its fields and its file path instead.
   - Other file: give its path, kind and change.
7. Plan the target writes per [tool-write.md](../references/tool-write.md).
8. Present the plan, then end the turn and wait for the user's own answer.
9. Read [write](03-write.md).

## Output

The approved plan with its targets and writes.
