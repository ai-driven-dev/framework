# 03 - Sync

Wire the memory into the tools the user picks.

## Input

The memory bank in `aidd_docs/memory/`.

## Output

Each picked tool's context file, present and carrying the filled block.

## Process

1. **Detect.** Find the AI tools present per `@../references/tools.md`.
2. **Pick.** Show every tool, the detected ones ticked. Let the user pick one or several. Wait for the pick.
3. **Upsert.** Put an empty `<aidd_project_memory>` block in each picked tool's context file, per `@../references/memory-block.md`.
   - Missing file: create it from `@../assets/AGENTS.md`, titled for the tool.
   - Never touch a file whose tool was not picked.
4. **Fill.** Run the plugin's `hooks/update_memory.js` from the project root, naming the picked tools.
5. **Guard.** On a non-zero exit, print the error and stop.
   - Check `aidd_docs/memory/` holds a `.md` file, and that `node` runs.
6. **Verify.** Read each picked tool's block back. An empty one means the fill did not land.

## Test

- The script exited `0`.
- Each picked tool's context file exists, and its block holds one line per memory file.
- `git diff` shows no change to an unpicked tool's file.
- `git status` shows the memory files unstaged: the skill reports, the user stages.
