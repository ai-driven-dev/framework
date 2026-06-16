← [aidd-framework](../../../../README.md) / [aidd-context](../../README.md)

# 02 - Project Memory

Bootstraps the project's context layer: the AI context files with the `<aidd_project_memory>` block, the `aidd_docs/` structure, and the memory bank.

## When to use

- The first `aidd init` on a repo.
- A new project with no `aidd_docs/` yet.
- A re-run on an existing project to refresh missing memory files.

## When not to use

- Updating one memory file after it exists: use `aidd-context:10-learn`.
- Editing a single rule: edit the file directly.
- Generating a new artifact: use `aidd-context:03-context-generate`.

## Flow

Five actions, in order:

1. `init-context-file`: resolve the tools, then upsert the memory block.
2. `scaffold-docs`: create the `aidd_docs/` structure.
3. `generate-memory`: detect the project's capabilities and fill the memory templates.
4. `review-memory`: review the memory files for consistency.
5. `sync-memory`: fill each memory block with references to the generated files.

## Details

See [`SKILL.md`](SKILL.md), [`actions/`](actions/), `references/mapping-ai-context-file.md` for the per-tool context-file path, and `assets/templates/memory/` for the memory templates.
