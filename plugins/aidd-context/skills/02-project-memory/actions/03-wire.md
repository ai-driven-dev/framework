# 03 - Wire

Wire the memory into the tools the person picks.

## Input

The bank in `aidd_docs/memory/`, and the picked tools.

## Process

1. Stop unless `aidd_docs/memory/` holds a `.md`.
2. Create each picked tool's absent context file, per [tools](../references/tools.md).
3. Make sure each picked tool's context file holds the marker pair once, as in [the AGENTS.md template](../assets/templates/AGENTS.md).
4. Reply in a few lines: the files written, the lines replaced or removed, the tools wired.

## Output

Each picked tool's context file, carrying the marker pair.

## Rules

- Write nothing between the markers: the turn-end hook fills them.
- Leave an unpicked tool's context file unchanged.
