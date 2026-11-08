# 04 - Sync

Wire the memory into the tools the user picks.

## Input

The memory bank in `aidd_docs/memory/`.

## Process

1. Stop unless `aidd_docs/memory/` holds a `.md`.
2. Find the AI tools present as [tools](../references/tools.md) says.
3. Show every tool, the detected ones ticked, and wait for the picks, or take them as [tools](../references/tools.md) says on a refresh.
4. Ensure each picked tool's context file carries the block, as tools says.
5. Run `sync` for the picked tools as [engine](../references/engine.md) says.

## Output

Each picked tool's context file, carrying the filled block.

## Rules

- Leave an unpicked tool's context file unchanged.
