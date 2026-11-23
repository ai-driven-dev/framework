# 03 - Write

Write the approved agent.

## Input

The approved draft, input file and paths.

## Process

1. Plugin source: write the canonical agent at its planned path.
2. Hosts: run the writer per [writer.md](../references/writer.md) with the plan's options, without `--plan`.
   - Planned `update`: add `--force`.
   - Non-zero exit: quote the writer's output, then stop.
3. Run `$validator` per [writer.md](../references/writer.md) on the plugin source, else `.claude/agents/<name>.md` when Claude Code is a confirmed host, fix each finding and validate again, and after 3 passes stop and show what is left.
   - Neither file exists: skip this step.
   - Exit 2: quote the output, then stop.
   - Fix the input or the plugin source, never a host file by hand, and rewrite with `--force`.
   - Fix that changes approved content: show the diff to the user before rewriting.
   - Writer refusal on the rewrite: quote it, then stop.
4. Report only the paths written, one per line.

## Output

The files written.

## Rules

- Leave host files to the writer, never edit one by hand.
