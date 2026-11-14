# 03 - Validate

Check each written agent file and report.

## Input

The files written.

## Process

1. Check each file against its tool's path, frontmatter and format in [tool-paths.md](../references/tool-paths.md), and list its breaches, even none.
2. Check each file against [agent-authoring.md](../references/agent-authoring.md), and list its breaches, even none.
3. Fix each breach and repeat from step 1 until every list is empty.
   - Fix declined or impossible: report the blocker and stop.
4. Report each file as passed, or with its breaches.

## Output

One pass or fail line per agent file.

## Rules

- Name each breach's rule by its id, with a `file:line`.
