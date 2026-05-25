# 06 - Sync memory

Execute `update_memory.js` to fill the `<aidd_project_memory>` blocks in all context files with references to the generated memory files.

## Context

```markdown
@${CLAUDE_PLUGIN_ROOT}/skills/02-project-init/references/mapping-ai-context-file.md
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

1. Execute `${CLAUDE_PLUGIN_ROOT}/hooks/update_memory.js` to sync memory references in context files.
2. If the script exits with a non-zero code, print the error output and stop. Instruct the user to verify `aidd_docs/memory/` contains at least one `.md` file and that `node` is available.
3. Read the script output. Count the number of AI context files updated and the number of memory references injected into each block.
4. Print a summary line: `Updated <N> AI context files (<comma-separated paths>). Each <aidd_project_memory> block now references <M> memory files from aidd_docs/memory/.` Then, for each context file, list the injected references.

## Test

Check the root context file based on tools contains all memory references as expected. For example, if `aidd_docs/memory/` contains `architecture.md` and `project-brief.md`, the `<aidd_project_memory>` block in the root context file should contain references to both files. The printed summary names the actual context files updated (not a hardcoded count).
