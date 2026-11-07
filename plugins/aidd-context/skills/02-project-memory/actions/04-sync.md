# 04 - Sync

Wire the memory into the tools the user picks.

## Input

The memory bank in `aidd_docs/memory/`.

## Process

1. **Require.** Stop unless `aidd_docs/memory/` holds a `.md`.
2. **Detect.** Find the AI tools present per [tools.md](../references/tools.md).
3. **Pick.** Show every tool, the detected ones ticked, and wait for the picks.
   - From refresh: the tools whose context file already carries the block, the old `<aidd_project_memory>` tag included, nothing asked.
4. **Upsert.** Ensure each picked tool's context file carries the block, per tools.md.
   - Absent file: create it from [AGENTS.md](../assets/templates/AGENTS.md).
   - Its AIDD structure differs: offer to reconcile it, applying only what the user approves.
5. **Fill.** Run the engine, `node memory.cjs sync <tool>...` (found per [engine](../references/engine.md)) naming the picked tools; it fills each tool's block. Stop on a non-zero exit.

## Output

Each picked tool's context file, carrying the filled block.

## Rules

- Leave an unpicked tool's context file unchanged.
