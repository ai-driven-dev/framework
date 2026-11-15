# 03 - Write

Write the approved hook to each host.

## Input

The approved input file and paths, or the findings verify sent back.

## Process

1. Fix the script in the input file for each finding verify sent back.
2. Run the writer per [writer.md](../references/writer.md) with the options the plan ran.
   - Approved overwrite: add `--force`.
   - Non-zero exit: quote the writer's output, then stop.
3. Report each path written with its operation.
4. Read [verify](04-verify.md) with the input file still in place, except on remove.

## Output

The paths written.

## Rules

- Leave configs, gateways and script copies to the writer, never edit one by hand.
