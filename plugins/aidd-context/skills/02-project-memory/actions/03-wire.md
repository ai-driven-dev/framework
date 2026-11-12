# 03 - Wire

Wire the memory into the tools the person picks.

## Input

The bank in `aidd_docs/memory/`, and the picked tools.

## Process

1. Stop unless `aidd_docs/memory/` holds a `.md`.
2. From the project root, run the skill's `scripts/project-memory.cjs wire` with node, naming the picked [tools](../references/tools.md).
3. Reply in a few lines: the files written, the lines replaced or removed, the tools wired.

## Output

Each picked tool's context file, carrying the marker pair.

## Rules

- Write nothing between the markers.
