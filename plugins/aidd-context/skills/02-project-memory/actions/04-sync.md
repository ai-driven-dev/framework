# 04 - Sync

Wire the memory into the tools the user picks.

## Input

The memory bank in `aidd_docs/memory/`.

## Process

1. Stop unless `aidd_docs/memory/` holds a `.md`.
2. Take the picks per [tools](../references/tools.md).
3. Create each picked tool's absent context file, per [tools](../references/tools.md).
4. On a refresh, run [`sync`](../references/engine.md) with `--add` and each tool the answer adds, then always with no tool name; on a setup, run it with `--add` and the picked tools, per [tools](../references/tools.md).
5. Run [`report`](../references/engine.md) with the sheet and send its output as it is, in plain chat text, nothing before it; after it, only an offer to reconcile a picked tool's context file whose AIDD structure differs, per [tools](../references/tools.md), if any.

## Output

Each picked tool's context file, carrying the filled block.

## Rules

- Leave an unpicked tool's context file unchanged.
