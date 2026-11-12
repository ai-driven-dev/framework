# 02 - Plan

Break the skill into actions, one job each.

## Input

The source: the confirmed frame, or the existing skill.

## Process

1. List each file to write, with each breach of [skill-authoring.md](../references/skill-authoring.md) it fixes.
   - Nothing to change: say so and stop.
2. List as content to keep each rule, step, branch, wait, loop and stop the source holds, with its file.
3. List each fact of the source the rules leave no home, and each addition beyond the source and the request.
4. Keep few actions; merge two that share most logic.
5. Number each action and fill its row: slug, input to output, rules, the cases that enter it, its next actions and outcomes with their condition, check step; give every other file its path, kind and change.
6. For each confirmed target, read its source in [tool-write.md](../references/tool-write.md) and ask the user one question per frontmatter field it lists beyond `name` and `description`.
7. Confirm the table with the user, then read [write](03-write.md).

## Output

A confirmed table, one row per file, with each target's frontmatter, the content to keep, and the facts dropped or added.
