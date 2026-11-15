# 02 - Plan

Break the skill into actions, one job each.

## Input

The request and its source: the confirmed frame, or the existing skill.

## Process

1. Existing skill: take its folder as a target, and detect the other installed hosts per [hosts.md](../references/hosts.md).
2. List each file to write, with the breaches of [skill-authoring.md](../references/skill-authoring.md) it fixes and the requested changes it makes.
   - Nothing to change: say so and stop.
3. List as content to keep each rule, step, branch, wait, loop and stop of the source, with its file.
   - Changed by the request: list it as a change instead.
4. List each fact of the source the rules leave no home, and each addition beyond the source and the request.
5. Merge two actions that share most logic, so few remain.
6. Number each action and fill its row of [plan-table.md](../assets/plan-table.md), and give each other file its row.
7. Present the table, and ask for each target's extra frontmatter fields per [hosts.md](../references/hosts.md).
8. End the turn and wait for the user's own answer.
   - Revision: apply it, then repeat from step 2.
   - Cancel: stop, cancelled.
9. Read [write](03-write.md) once confirmed.

## Output

A confirmed table, one row per file, with each target's frontmatter, the content to keep, the changes, and the facts dropped or added.
