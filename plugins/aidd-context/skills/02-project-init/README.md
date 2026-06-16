← [aidd-framework](../../../../README.md) / [aidd-context](../../README.md)

# 02 - Project Init

Bootstraps the AIDD context layer for a project: AI context files with the
`<aidd_project_memory>` block, the `aidd_docs/` documentation structure,
and the memory bank files. Rule directories are not pre-scaffolded - they
are created lazily by `03-context-generate` when the first rule is written.

## When to use

- Running `aidd init` for the first time on a repo.
- Bootstrapping a new project that has no `aidd_docs/` yet.
- Re-running the init flow on an existing project to refresh missing
  memory files.

## When NOT to use

- To update individual memory files after they exist → use `10-learn`.
- To edit a single rule → edit the file directly.
- To generate a new skill, agent, or rule file → use `03-context-generate`.

## How to invoke

```
Use skill aidd-context:02-project-init
```

The skill walks 5 atomic actions in sequence:

1. `init-context-file` - ensure AI context files contain the
   `<aidd_project_memory>` block.
2. `scaffold-docs` - create the `aidd_docs/` structure with README and
   GUIDELINES.
3. `generate-memory` - detect project type and generate memory files in
   parallel.
4. `review-memory` - cross-file consistency review of all generated memory
   files.
5. `sync-memory` - execute `update_memory.js` to fill the
   `<aidd_project_memory>` blocks across installed AI context files.

## Outputs

- AI context files (e.g. `CLAUDE.md`, `AGENTS.md`) with the
  `<aidd_project_memory>` block injected.
- `aidd_docs/README.md` and `aidd_docs/GUIDELINES.md`.
- `aidd_docs/memory/` with templated memory files scoped to the detected
  project type (`all` | `frontend` | `backend`).

## Prerequisites

- A working directory with at least one supported AI context file (or
  willingness to create one).
- The plugin's `hooks/update_memory.js` available (shipped with the
  plugin).

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract, [`actions/`](actions/)
for each step, `references/mapping-ai-context-file.md` for the AI-tool ↔
context-file mapping, and `assets/templates/memory/` for the per-scope
memory file templates.
