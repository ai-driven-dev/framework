# 02 - Plan

Draft each host's handler, plan the writes and get them approved.

## Input

The frame, or the trial failure verify sends back.

## Process

1. Add or update: draft each host's handler per [hook-authoring.md](../references/hook-authoring.md), from that host's description.
   - Trial failure: fix the handler for what the host did.
2. Add or update: write the input file per [writer.md](../references/writer.md), including only requested native options supported by the host.
3. Run the writer with `--plan` per [writer.md](../references/writer.md).
   - Non-zero exit: quote the writer's output, then read [frame](01-frame.md).
4. Present the plan.
   - Each handler in full.
   - Each path with its operation.
   - Each native option and its host.
   - Per host: where it falls short, what a teammate grants before it runs, another host's hook it also runs, and whether it blocks this session's own tool, with the remove command.
5. End the turn and wait for the user's answer.
   - Revision: read [frame](01-frame.md).
   - Cancel: stop, cancelled.
6. Read [write](03-write.md) once approved.

## Output

The approved input file and paths, or the cancellation.

## Rules

- Write nothing in the project.
- Count only an answer given after this plan as its approval.
