# 04 - Sync

Wire the memory into the tools the user picks.

## Input

The memory bank in `aidd_docs/memory/`.

## Output

Each picked tool's context file, carrying the filled block.

## Process

1. **Require.** Stop unless `aidd_docs/memory/` holds a `.md`.
2. **Detect.** Find the AI tools present per [tools.md](../references/tools.md).
3. **Pick.** Show every tool, the detected ones ticked, and wait for one or several.
   - From refresh: the tools whose context file already carries the block, the old `<aidd_project_memory>` tag included, nothing asked.
4. **Upsert.** Ensure each picked tool's context file carries the block, per tools.md.
   - Absent file: create it from [AGENTS.md](../assets/templates/AGENTS.md).
   - Its AIDD structure differs: offer to reconcile it, applying only what the user approves.
5. **Fill.** Run the engine, naming the picked tools, and stop on a non-zero exit.

## Test

| Case | Pass |
| --- | --- |
| Empty bank | no file created, the run stops |
| Picked tool | its block is the bank's list, as the engine writes it |
| Unpicked tool | its context file is unchanged |
