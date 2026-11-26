# 03 - Write

Write the approved hook to each host.

## Input

The approved input file and paths.

## Process

1. Run the writer per [writer.md](../references/writer.md) with the plan's options, without `--plan`, and delete the input file with its folder in the same command.
   - Approved `update`: add `--force`.
   - Non-zero exit: quote the writer's output, then stop.
2. Report each path written with its operation, one per line.
3. Read [verify](04-verify.md), except on remove.

## Output

The paths written.

## Rules

- Leave every config, plugin and handler file to the writer, never edit one by hand.
