# 03 - Write

Write the approved agent.

## Input

The approved draft, input file and paths.

## Process

1. Plugin source: write the canonical agent at its planned path.
2. Hosts: run the writer per [writer.md](../references/writer.md) with the plan's options, without `--plan`.
   - Planned `update`: add `--force`.
   - Non-zero exit: quote the writer's output, then stop.
3. Report only the paths written, one per line.

## Output

The files written.

## Rules

- Leave host files to the writer, never edit one by hand.
