# 02 - Plan

Draft each host's handler, plan the writes and get them approved.

## Input

The frame, or the trial failure verify sends back.

## Process

1. Draft each host's handler per [hook-authoring.md](../references/hook-authoring.md), from that host's description, skipped on remove.
   - Trial failure: fix the handler for what the host did.
2. Write the input file per [writer.md](../references/writer.md), skipped on remove.
3. Run the writer's plan mode per [writer.md](../references/writer.md).
   - Non-zero exit: quote the writer's output, then read [frame](01-frame.md).
4. Present the plan.
   - What the hook does on each host, and where it falls short.
   - Each handler in full.
   - Each path with its operation, an `update` written only with `--force`.
   - What each host asks of a teammate, from its description.
   - A hook that blocks this session's own tool: say it blocks this session once written, and give the remove command.
5. End the turn and wait for the user's own answer.
   - Revision: read [frame](01-frame.md).
   - Cancel: stop, cancelled.
6. Read [write](03-write.md) once approved.

## Output

The approved input file and paths, or the cancellation.

## Rules

- Write nothing in the project.
