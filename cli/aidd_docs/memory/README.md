# memory/ - Project Memory

The `cli/` bank. What a memory bank is: [`aidd_docs/memory/README.md`](../../../aidd_docs/memory/README.md).

## Loading

| Location | Loads |
| --- | --- |
| root of `memory/` | every session, through the block in the AI context file |
| `internal/` | on demand, when the task needs it |
| `external/` | on demand, when asked |

## Maintaining

- One file per concern; point to the code instead of copying it.
- Describe the current state only, with no plan and no personal note.
- Change a file in the same pull request as the code it describes.
