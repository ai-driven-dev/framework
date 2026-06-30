# 05 - Sync memory

Fill the `<aidd_project_memory>` block in every context file with references to the generated memory files.

## Input

The context files with the block, and the populated `aidd_docs/memory/`.

## Output

Each `<aidd_project_memory>` block lists the generated memory files as references.

## Process

1. **Run.** Execute the memory-sync script (`update_memory.js` in the plugin's `hooks/`) to fill each block (the block: `@../references/memory-block.md`).
2. **Guard.** On a non-zero exit, print the error and stop; tell the user to check that `aidd_docs/memory/` holds a `.md` file and that `node` is available.

## Test

- Each context file's `<aidd_project_memory>` block references every file in `aidd_docs/memory/`.
