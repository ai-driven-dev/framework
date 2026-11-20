# 04 - Write

Write the approved rule.

## Input

The approved input file, paths and conflicts.

## Process

1. Run the writer per [writer.md](../references/writer.md) with the plan's options, without `--plan`.
   - Planned conflicts: add `--force`.
   - Non-zero exit: quote the writer's output, then stop.
2. Validate each `aidd_docs/rules/` source written, per [writer.md](../references/writer.md).
   - Finding: quote it, fix the input file, rerun the writer with `--force`, then validate again until clean.
3. Report only the paths written, one per line.
4. Remove of a rename or host drop: read [draft](02-draft.md) to add the rule from the removed source.

## Output

The files written.

## Rules

- Leave rule sources and copies to the writer, never edit one by hand.
