# 03 - Write

Write or remove the approved hook on each host.

## Input

The approved input file and paths.

## Process

1. Run the writer per [writer.md](../references/writer.md), without `--plan`.
   - Planned `update`: add `--force`.
   - Non-zero exit: quote the writer's output, then stop.
2. Report each path written with its operation, one per line.
3. Add or update: read [verify](04-verify.md).

## Output

The paths written.

## Rules

- Leave every config, plugin and handler file to the writer, never edit one by hand.
