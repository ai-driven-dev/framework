# 08 - Find memory

Enumerate the project memory files under `aidd_docs/memory/`, recommend the best match for the user's stated intent. Tool-independent: this action skips the SKILL.md tool-detection gate.

## Inputs

- Free-form user intent.
- `aidd_docs/memory/` directory (root files + `external/` + `internal/` subdirs).

## Outputs

A markdown table of memory files + a recommendation block.

```text
| Scope    | File                              | Purpose                                       |
| -------- | --------------------------------- | --------------------------------------------- |
| project  | aidd_docs/memory/architecture.md  | High-level system architecture                |
| project  | aidd_docs/memory/codebase-map.md  | Module map and entry points                   |
| external | aidd_docs/memory/external/...     | Third-party references loaded on demand       |
| internal | aidd_docs/memory/internal/...     | Internal notes loaded only when relevant      |
| ...      | ...                               | ...                                           |

Recommendation: <best-match memory file>
Why: <one sentence>
Source: <relative path>
```

## Process

1. **Enumerate memory.** List `aidd_docs/memory/*.md` plus the contents of `aidd_docs/memory/external/` and `aidd_docs/memory/internal/` when those subdirectories exist.
2. **Classify scope.** Root files = `project`; nested files inherit their subdirectory name (`external`, `internal`).
3. **Extract purpose.** Read the first heading or first non-empty line of each file as the one-line purpose; trim to ~80 characters.
4. **Render the table.** Columns: `Scope | File | Purpose`. Sort by scope then path.
5. **Ask the user for intent.** `What context do you need to load?` Wait for an explicit reply.
6. **Match.** Score each file against the stated intent. Pick the single best match.
7. **Print the recommendation block.** File path, one-sentence rationale, source path.
8. **Stop.** Do not load or edit the memory file.

## Test

The output contains a non-empty memory table whose rows match the files actually present under `aidd_docs/memory/` (including `external/` and `internal/` when they exist), followed by a recommendation block that names one file present in the table, a one-line rationale, and its source path.
