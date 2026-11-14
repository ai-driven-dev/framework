# 04 - Write

Write the approved rule and check its publication.

## Input

The approved candidate, paths and overwrites.

## Process

1. Run the writer per [writer.md](../references/writer.md) with the approved request.
   - Approved overwrites: add `--force`.
2. Run the writer with `--check --publish`, and require no drift.
3. Report the written files.
   - Non-zero exit: quote the writer's output verbatim, then stop.

## Output

The written files, checked, or the quoted writer output.

## Rules

- Leave rule sources and copies to the writer.
