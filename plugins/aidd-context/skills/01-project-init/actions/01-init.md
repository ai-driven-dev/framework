---
name: init
description: Create or update the memory bank files to reflect the current state of the codebase
model: opus
---

# Init

Create or update the documentation files that make up the memory bank of the project.

Only change existing files if there are REAL CHANGES in the codebase, do not change files just to reformat or reword things.

## Resources

Every file has its own template to follow.

### Hard copy into memory bank (always generated)

```text
@../assets/templates/memory
```

### Memory templates

Each has a `scope` front-matter field:

| Scope      | Condition                    |
| ---------- | ---------------------------- |
| `all`      | Always generated             |
| `frontend` | If frontend project detected |
| `backend`  | If backend project detected  |

#### Global templates

All templates are in:

```text
@../assets/templates/memory
```

#### Internal templates (frontend / backend)

```text
@../assets/templates/memory/frontend
@../assets/templates/memory/backend
```

## Rules

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

## Steps

1. Check if memory bank already exists in `aidd_docs/memory/` folder:
   - If exists, update with newer information
   - If not, create from scratch
2. **Auto-detect project type**: Quickly explore the codebase to determine if it's frontend or backend. Use the `scope` frontmatter field to select which templates to generate.
3. **Inform user of detection**: Display detected type and list files that will be generated
4. Spawn parallel task sub-agents for each template files
5. Write generated files to `aidd_docs/memory/`
6. Launch an agent to review all files for consistency and accuracy
7. Execute `.aidd/scripts/update_memory.js` to sync memory references in context files
