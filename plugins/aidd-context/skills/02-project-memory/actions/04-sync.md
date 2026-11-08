# 04 - Sync

Wire the memory into the tools the user picks.

## Input

The memory bank in `aidd_docs/memory/`.

## Output

Each picked tool's context file, carrying the filled block.

## Process

1. **Require.** Stop unless `aidd_docs/memory/` holds a `.md`, sending the user to write the memory first.
2. **Detect.** Find the AI tools present per [tools.md](../references/tools.md).
3. **Pick.** Use tools already specified by the user, even if not detected. Otherwise, reuse tools already wired; if none, use detected tools that share one context file. Ask only if the choice remains unclear.
4. **Upsert.** Ensure each picked tool's context file carries the block, per [tools.md](../references/tools.md).
   - Absent file: create it from [AGENTS.md](../assets/templates/AGENTS.md).
   - Its AIDD structure differs: reconcile only within the authorized scope; ask if the required changes exceed it.
5. **Fill.** Find the installed `update_memory.js` hook and run it from the project root, naming the picked tools. Stop on a non-zero exit.
   - No hook, the skill shipped alone: write each block from the bank.
6. **Verify.** Read each picked tool's block back and compare it to the bank.
   - A file in one and not the other: the fill did not land, report it and stop.

## Test

| Case | Pass |
| --- | --- |
| Empty bank | no context file created, the run stops |
| Script | it exits `0` |
| Picked tool | its block lists every root `.md` except `README.md`, nothing else |
| Bank grew | the block gains that file and keeps the rest |
| Unpicked tool | its context file is unchanged |
| Tool already specified | it is wired without asking again |
| No choice or prior wiring, multiple context files | the user chooses before wiring |
