# 04 - Write

Write the approved rule.

## Input

The approved input file, paths and conflicts.

## Process

1. Run the writer per [writer.md](../references/writer.md) with the plan's options, without `--plan`.
   - Planned conflicts: add `--force`.
   - Non-zero exit: quote the writer's output, then stop.
2. Run `$validator` per [writer.md](../references/writer.md) on each `aidd_docs/rules/` source written, fix each finding and validate again, and after 3 passes stop and show what is left.
   - Exit 2: quote the output, then stop.
   - Fix the input file, never a source or copy by hand, and rerun the writer with `--force`.
   - Fix that changes approved content: show the diff to the user before rerunning the writer.
   - Writer refusal on the rerun: quote it, then stop.
3. Report only the paths written, one per line.
4. Remove of a rename or host drop: read [draft](02-draft.md) to add the rule from the removed source.

## Output

The files written.

## Rules

- Leave rule sources and copies to the writer, never edit one by hand.
