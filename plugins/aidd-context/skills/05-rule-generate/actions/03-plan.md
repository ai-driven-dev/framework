# 03 - Plan

Plan the writes and get them approved.

## Input

The candidate and its findings, or the source to remove or publish.

## Process

1. Add or update: write the candidate's fields to the input file per [writer.md](../references/writer.md).
2. Run the writer with `--plan` per [writer.md](../references/writer.md).
   - Non-zero exit: quote the writer's output.
   - Non-zero exit on add or update: read [draft](02-draft.md) to revise the candidate.
   - Non-zero exit on remove or publish: stop.
3. Present the plan.
   - The candidate in full (body, description, scope, hosts), or the sources removed or published.
   - Each planned path with its operation.
   - Each finding.
   - Each conflict.
4. Conflict on add or update: offer to keep the copy's hand-written lines by adding them to the candidate, or to overwrite them.
5. End the turn and wait for the user's own answer.
   - Revision: read [draft](02-draft.md).
   - Cancel: stop, cancelled.
6. Read [write](04-write.md) once approved.

## Output

The approved input file, paths and conflicts, or the cancellation.

## Rules

- Write nothing in the project.
