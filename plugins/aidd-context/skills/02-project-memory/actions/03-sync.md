# 03 - Sync

Wire the memory into every tool the user picked.

## Input

The tools confirmed in `01-scan`, and the memory bank from `02-generate`.

## Output

Each picked tool's context file, present and carrying the filled block.

## Process

1. **Resolve.** Take each picked tool's context file from `@../references/tools.md`.
2. **Upsert.** Put an empty `<aidd_project_memory>` block in it, per `@../references/memory-block.md`.
   - Missing file: create it from `@../assets/AGENTS.md`, titled for the tool.
   - Never touch a file whose tool was not picked.
3. **Fill.** Run the plugin's `hooks/update_memory.js` from the project root, naming the picked tools.
4. **Guard.** On a non-zero exit, print the error and stop.
   - Check `aidd_docs/memory/` holds a `.md` file, and that `node` runs.
5. **Verify.** Read each picked tool's block back. An empty one means the fill did not land.

## Test

- A picked tool with no context file ends up with one, block filled.
- A tool that was not picked keeps its file byte for byte.
- A non-zero exit stops the action, never a half-wired project.
