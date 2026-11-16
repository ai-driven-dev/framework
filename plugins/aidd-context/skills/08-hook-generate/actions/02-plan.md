# 02 - Plan

Draft the script, plan the writes and get them approved.

## Input

The confirmed frame, or the findings verify sent back.

## Process

1. Draft the script per [hook-authoring.md](../references/hook-authoring.md), skipped on remove.
   - Findings from verify: fix the script for each finding.
2. Write the input file per [writer.md](../references/writer.md), skipped on remove.
3. Run the writer with `--plan` per [writer.md](../references/writer.md).
   - Non-zero exit: quote the writer's output, then read [frame](01-frame.md) to revise.
4. Present the plan.
   - What the intent does on each host per [hosts.md](../references/hosts.md), and where it falls short.
   - The script in full.
   - Each path with its operation, saying an `update` is written only with `--force`.
   - What the committed config asks of teammates per [hosts.md](../references/hosts.md).
5. End the turn and wait for the user's own answer.
   - Revision: read [frame](01-frame.md).
   - Cancel: stop, cancelled.
6. Read [write](03-write.md) once approved.

## Output

The approved input file and paths, or the cancellation.

## Rules

- Write nothing in the project.
