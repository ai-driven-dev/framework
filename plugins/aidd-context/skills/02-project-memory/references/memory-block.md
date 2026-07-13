# Memory block

The `<aidd_project_memory>` block is where a tool's context file points at the memory files. It sits under `## Memory Management` → `### Project memory` (full template: `@../assets/AGENTS.md`).

## Upsert

Apply the first case that matches a picked tool's context file.

| The file                      | Do                                                |
| ----------------------------- | ------------------------------------------------- |
| does not exist                | copy `@../assets/AGENTS.md`, set the tool's title |
| has no `## Memory Management` | append that section from the template             |
| has the section, no block     | insert an empty block after `### Project memory`  |
| has the block                 | leave it, the fill script owns its contents       |

## Boundaries

- Only a picked tool's file is touched. A tool the user did not pick keeps its file untouched, block or not.
- The fill script fills an existing block. It creates neither the file nor the block, so the upsert runs first.
- A hand-written context file with no block gets one only when its tool is picked. The auto hook never inserts one.
