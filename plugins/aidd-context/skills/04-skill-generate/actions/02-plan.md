# 02 - Plan

Break the skill into actions, one job each.

## Input

The request and its source: the confirmed frame, or the existing skill.

## Process

1. List each file to write, with the breaches of [skill-authoring.md](../references/skill-authoring.md) it fixes and the requested changes it makes.
   - Nothing to change: say so and stop.
2. List as content to keep each rule, step, branch, wait, loop and stop of the source, with its file.
   - Changed by the request: list it as a change instead.
3. List each fact of the source the rules leave no home, and each addition beyond the source and the request.
4. Merge two actions that share most logic, so few remain.
5. Number each action and fill its row: slug, input to output, rules, the cases that enter it, its next actions and outcomes with their condition, check step.
   - Other file: give its path, kind and change.
6. Ask the user for each target's extra frontmatter fields, per [tool-write.md](../references/tool-write.md).
7. Confirm the table with the user, then read [write](03-write.md).

## Output

A confirmed table, one row per file, with each target's frontmatter, the content to keep, the changes, and the facts dropped or added.
