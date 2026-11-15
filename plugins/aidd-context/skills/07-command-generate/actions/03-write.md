# 03 - Write

Write the approved command.

## Input

The approved command, input file and paths.

## Process

1. Plugin source: write the canonical command at its planned path.
2. Host tools: run the writer per [writer.md](../references/writer.md) on the same input file.
   - Planned `update`: add `--force`.
   - Non-zero exit: quote the writer's output, then stop.
3. Report each file written.

## Output

The files written.

## Rules

- Leave host files to the writer, never edit one by hand.
