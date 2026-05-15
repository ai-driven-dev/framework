# 03 - Sync

Refresh the `<aidd_project_memory>` block in all installed AI context files so the new or updated memory files are referenced.

## Inputs

- Summary table from action 02 (used to confirm at least one memory file changed).

## Outputs

```
The <aidd_project_memory> block in every installed context file now references the current contents of aidd_docs/memory/.
```

## Process

1. Execute `${CLAUDE_PLUGIN_ROOT}/hooks/update_memory.js` to sync memory references in context files.
2. If the script exits with a non-zero code, print the error output and stop. Instruct the user to verify `aidd_docs/memory/` contains at least one `.md` file and that `node` is available.
3. Read the script output. Count the number of AI context files updated and the number of memory references injected into each block.
4. Print a summary line: `Updated <N> AI context files (<comma-separated paths>). Each <aidd_project_memory> block now references <M> memory files from aidd_docs/memory/.`

## Test

For every installed AI context file, the `<aidd_project_memory>` block contains a reference line per `.md` file currently in `aidd_docs/memory/`; the summary line names the actual files updated (not a hardcoded count).
