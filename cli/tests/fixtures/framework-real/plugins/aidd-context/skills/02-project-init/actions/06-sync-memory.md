# 06 - Sync memory

Execute `update_memory.js` to fill the `<aidd_project_memory>` blocks in all context files with references to the generated memory files.

## Context

```markdown
@../../references/mapping-ai-context-file.md
```

## Inputs

- context files with `<aidd_project_memory>` block
- `aidd_docs/memory/` populated with `.md` files

## Depends on

- `01-upsert-context-file`
- `04-review-memory`

## Outputs

```
The <aidd_project_memory> block contains all generated memory files as references.
```

## Process

1. Execute @../hooks/update_memory.js` to sync memory references in context files
2. If the script exits with a non-zero code, print the error output and stop. Instruct the user to verify `aidd_docs/memory/` contains at least one `.md` file and that `node` is available.
3. For each context file updated by the script, print the list of injected references.

## Test

Check the root context file based on tools contains all memory references as expected. For example, if `aidd_docs/memory/` contains `architecture.md` and `project-brief.md`, the `<aidd_project_memory>` block in the root context file should contain references to both files.
