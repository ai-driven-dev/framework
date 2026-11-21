# 03 - Write

Write the approved command.

## Input

The approved draft, input file and paths.

## Process

1. Plugin source: write the canonical command at its planned path.
2. Hosts: run the writer per [writer.md](../references/writer.md) with the plan's options, without `--plan`.
   - Planned `update`: add `--force`.
   - Non-zero exit: quote the writer's output, then stop.
3. Validate the plugin source, else `.claude/commands/<name>.md` when Claude Code is a confirmed host, per [writer.md](../references/writer.md).
   - Neither file exists: skip this step.
   - Exit 2: quote the output, then stop.
   - Finding: quote it, fix the input or the plugin source, never a host file by hand, rewrite with `--force`, then validate again.
   - Fix that changes approved content: show the diff to the user before rewriting.
   - Writer refusal on the rewrite: quote it, then stop.
   - Findings left after 3 passes: stop and show them.
4. Report only the paths written, one per line.

## Output

The files written.

## Rules

- Leave host files to the writer, never edit one by hand.
