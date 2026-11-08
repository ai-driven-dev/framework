# 04 - Sync

Wire the memory into the tools the user picks.

## Input

The memory bank in `aidd_docs/memory/`.

## Process

1. Stop unless `aidd_docs/memory/` holds a `.md`.
2. Take the picks per [tools](../references/tools.md).
3. Ensure each picked tool's context file carries the block, per [tools](../references/tools.md).
4. Run [`sync`](../references/engine.md) for the picked tools.

## Output

Each picked tool's context file, carrying the filled block.

## Rules

- Leave an unpicked tool's context file unchanged.
