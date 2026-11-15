# 04 - Write

Write the approved rule.

## Input

The approved input file, paths and conflicts.

## Process

1. Run the writer per [writer.md](../references/writer.md) with the options the plan ran.
   - Planned conflicts: add `--force`.
   - Non-zero exit: quote the writer's output, then stop.
2. Report each file written.

## Output

The files written.

## Rules

- Leave rule sources and copies to the writer, never edit one by hand.
