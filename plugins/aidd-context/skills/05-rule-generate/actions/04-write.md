# 04 - Write

Write the approved rule and check its publication.

## Input

The approved candidate, paths and overwrites.

## Process

1. Run the writer per [writer.md](../references/writer.md) with the approved request.
   - Approved overwrites: add `--force`.
   - Approved OpenCode entry: add it to `instructions` in `opencode.json`, leaving the rest byte-identical.
2. Run the writer with `--check --publish`, and require no drift.
3. Report the written files.
   - Refusal or drift: quote it verbatim and stop.
   - Blocked or failed file operation: name each blocked, failed and already written path from the writer's output, then stop.

## Output

The written files, checked, or the quoted refusal or blocked paths.

## Rules

- Leave rule sources and copies to the writer.
