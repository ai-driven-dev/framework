# 03 - Plan

Plan the writes and get the candidate approved.

## Input

The candidate and its findings, or the source to remove or publish.

## Process

1. Resolve the writer per [writer.md](../references/writer.md), then run it with `--plan`.
   - Refusal: read [draft](02-draft.md) and revise the candidate.
2. Present the candidate in full (body, description, scope, hosts), the planned paths and every finding.
   - Remove or publish: present the paths written and deleted.
   - Conflict: show the copy's diff, then ask to overwrite or keep it.
   - Legacy: name each file the writer converts.
3. End the turn and wait for the answer.
   - Revision: read [draft](02-draft.md).
   - Keep or cancel: stop, cancelled.
4. Read [write](04-write.md) once approved.

## Output

The approved candidate, paths and overwrites, or the cancellation.

## Rules

- A choice, merge, edit, rename or assumed answer is not an approval: show the revision and wait.
