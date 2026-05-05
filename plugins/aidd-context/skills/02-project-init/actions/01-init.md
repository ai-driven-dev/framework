---
name: init
description: Create or update the memory bank files to reflect the current state of the codebase
model: opus
---

# Init

Create or update the documentation files that make up the memory bank of the project.

Only change existing files if there are REAL CHANGES in the codebase, do not change files just to reformat or reword things.

## Tree structure

```
aidd_docs/
  memory/
   internal/
   external/
  README.md
  GUIDELINES.md
```

## Resources

Every file has its own template to follow.

### Root documentation files

```text
@../assets/README.md
@../assets/GUIDELINES.md
```

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

1. Verify if project documentation exists based on tree structure :
   - If exists, update root documentation with newer information
   - If not, create structure from scratch with root documentation
2. Check if memory bank already exists in `aidd_docs/memory/` folder:
   - If exists, update with newer information
   - If not, create from scratch
3. **Auto-detect project type**: Quickly explore the codebase to determine if it's frontend or backend. Use the `scope` frontmatter field to select which templates to generate.
4. **Inform user of detection**: Display detected type and list files that will be generated
5. Spawn parallel task sub-agents for each template files
6. Write generated files to `aidd_docs/memory/`
7. Launch an agent to review all files for consistency and accuracy
8. Execute @../hooks/update_memory.js` to sync memory references in context files
