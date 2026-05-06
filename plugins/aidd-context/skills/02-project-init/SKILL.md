---
name: aidd-context:02:project-init
description: Initialize or refresh the project memory bank, scaffold the rules directory, and ensure AI context files contain the project memory block. Use when running `aidd init` for the first time, bootstrapping a new project, or re-running the init flow on an existing project. Do NOT use for updating individual memory files after they exist — use `aidd-context:07:learn` instead; do NOT use for editing a single rule — edit the file directly.
model: opus
---

# Project Init

Bootstraps the full AIDD context layer for a project: AI context files with memory block, `aidd_docs/` documentation structure, memory bank files, and rules directory skeleton.

## Available actions

| #   | Action                | Role                                                              | Input                       |
| --- | --------------------- | ----------------------------------------------------------------- | --------------------------- |
| 01  | `init-context-file`   | Ensure AI context files contain the `<aidd_project_memory>` block | project root                |
| 02  | `scaffold-docs`       | Create `aidd_docs/` structure with README and GUIDELINES          | project root                |
| 03  | `generate-memory`     | Detect project type and generate memory files in parallel         | `aidd_docs/memory/` from 02 |
| 04  | `review-memory`       | Cross-file consistency review of all generated memory files       | `aidd_docs/memory/` from 03 |
| 05  | `init-rules-skeleton` | Create `rules/` skeleton with 10 numbered phase directories       | project root                |
| 06  | `sync-memory`         | Execute `update_memory.js` to fill `<aidd_project_memory>` blocks | context files from 01       |

## Default flow

`01 → 02 → 03 → 04 → 05 → 06`. Run each action's `## Test` before moving to the next.

## Transversal rules

- Do not display content, just write the files
- IMPORTANT : **If not applicable / found, remove entire section**
- "?" means optional, do not add section if not applicable
- Templates give optional sections, feel free to add or remove as needed
- ZERO DUPLICATION: Focus only on template sections to avoid duplication
- SUPER SHORT explicit and concise bullet points
- Mention code using backticks
- Internal doc: must be located in `aidd_docs/memory/internal/`
- Do not anticipate needs or future changes, focus on current state only
- No version in tech names, just the name (e.g., React, not React 19)

### Schema rules to apply to generated Mermaid diagrams

```md
@../../06-mermaid/references/mermaid-conventions.md
```

## Assets (templates to copy or data to inject)

- `assets/AGENTS.md` — canonical AI context file template
- `assets/README.md` — `aidd_docs/README.md` template
- `assets/GUIDELINES.md` — `aidd_docs/GUIDELINES.md` template
- `assets/templates/memory/` — memory file templates (scope: `all` | `frontend` | `backend`)

## References

- `references/mapping-ai-context-file.md` — mapping of AI context files across tools

## External data

- `../hooks/update_memory.js` — syncs `<aidd_project_memory>` block content across all context files
