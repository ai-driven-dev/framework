# 02 - Plan

Draft the script, plan the writes and get them approved.

## Input

The confirmed frame.

## Process

1. Draft the script per [hook-authoring.md](../references/hook-authoring.md), one branch per host, in the runtime the user picks, skipped on remove.
2. Write the input file per [writer.md](../references/writer.md), skipped on remove.
3. Run the writer with `--plan` per [writer.md](../references/writer.md).
   - Non-zero exit: quote the writer's output, then read [frame](01-frame.md) to revise.
4. Present what the intent does on each host per [hosts.md](../references/hosts.md), where it falls short, the script in full, each path and operation the `--plan` output lists, and what the committed config asks of teammates.
   - Update on a path the writer did not produce: say it is overwritten only with `--force`.
5. End the turn and wait for the user's own answer.
   - Revision: read [frame](01-frame.md).
   - Cancel: stop, cancelled.
6. Read [write](03-write.md) once approved.

## Output

The approved input file and paths, or the cancellation.

## Rules

- Write nothing in the project.
