# 04 - Sync

Wire the memory into the tools the user picks.

## Input

The memory bank in `aidd_docs/memory/`.

## Process

1. Stop unless `aidd_docs/memory/` holds a `.md`.
2. Take the picks and create each picked tool's absent context file, per [tools](../references/tools.md).
3. On a refresh, run [`sync`](../references/engine.md) with `--add` and each tool the answer adds, then with no tool name.
4. On a setup, run `sync` with `--add` and the picked tools.
5. Run [`report`](../references/engine.md) with the sheet and send its output.
6. After it, send only an offer to reconcile a picked tool's context file whose AIDD structure differs, if any, per [tools](../references/tools.md).

## Output

Each picked tool's context file, carrying the filled block.

## Rules

- Leave an unpicked tool's context file unchanged.
