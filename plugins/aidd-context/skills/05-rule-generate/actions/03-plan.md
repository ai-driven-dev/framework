# 03 - Plan

Plan the writes and get them approved.

## Input

The candidate and its findings, or the source to remove or publish.

## Process

1. Add or update: write the candidate's fields to the input file per [writer.md](../references/writer.md).
   - Native option requested: verify its field and value against the selected host's official rule format before adding it to `nativeOptions`.
2. Run the writer with `--plan` per [writer.md](../references/writer.md).
   - Several Kilo or OpenCode configs: ask which listed file to update, then rerun the plan with that host's config selection.
   - Non-zero exit: quote the writer's output.
   - Non-zero exit on add or update: read [draft](02-draft.md) to revise the candidate.
   - Non-zero exit on remove or publish: stop.
3. Present the plan.
   - The candidate in full (body, description, scope, hosts), or the sources removed or published.
   - The requested native options for each host.
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
