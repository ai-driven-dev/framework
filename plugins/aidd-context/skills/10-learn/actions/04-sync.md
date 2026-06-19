# 04 - Sync

Refresh the project memory block in every context file so the new and updated memory files are referenced.

## Input

The summary table from action 03, confirming at least one memory file changed.

## Output

Each memory block lists the current memory files, and the memory index is refreshed.

## Process

1. **Run.** Execute the memory-sync script (`update_memory.js` in the plugin's `hooks/`) to inject the references and refresh the memory index.
2. **Guard.** On a non-zero exit, print the error and stop. Tell the user to confirm the memory bank holds a file and that `node` is available.
3. **Report.** Print how many context files were updated and how many references went into each block.

## Test

- Each context file's memory block references every file in the memory bank, and the report names the files updated rather than a fixed count.
