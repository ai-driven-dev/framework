# 03 - Write

Write the approved hook to each host.

## Input

The approved input file and paths.

## Process

1. Run the writer per [writer.md](../references/writer.md) with the plan's options, without `--plan`, then delete the input file with its folder in the same command.
   - Approved `update`: add `--force`.
   - Non-zero exit: quote the writer's output, then stop.
2. Report only the paths written with their operations, one per line.
3. Read [verify](04-verify.md), except on remove.

## Output

The paths written.

## Rules

- Leave configs, gateways and script copies to the writer, never edit one by hand.
