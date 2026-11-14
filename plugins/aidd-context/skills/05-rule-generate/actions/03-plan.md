# 03 - Plan

Plan the writes and get the candidate approved.

## Input

The candidate and its findings, or the source to remove or publish.

## Process

1. Resolve the writer per [writer.md](../references/writer.md), then run it with `--plan`.
   - Refusal of a request field: read [draft](02-draft.md) and revise the candidate.
   - Other refusal: quote it, then stop.
2. Present the candidate in full (body, description, scope, hosts), each planned path with its operation, and every finding.
   - Conflict: show each conflicting copy, then ask to overwrite them all or cancel.
3. End the turn and wait for the user's own answer.
   - Revision: read [draft](02-draft.md).
   - Cancel: stop, cancelled.
4. Read [write](04-write.md) once approved.

## Output

The approved candidate, paths and overwrites, or the cancellation.
