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
{{DOCS}}/templates/aidd/agents_coordination.md
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
@{{DOCS}}/templates/aidd/memory/
```

#### Internal templates

```text
@{{DOCS}}/templates/aidd/memory/internal/
```

## Rules

- Do not display content, just write the files
- IMPORTANT : **If not applicable / found, remove entire section**
- "?" means optional, do not add section if not applicable
- Templates give optional sections, feel free to add or remove as needed
- ZERO DUPLICATION: Focus only on template sections to avoid duplication
- SUPER SHORT explicit and concise bullet points
- Mention code using backticks
- Internal doc: must be located in `{{DOCS}}/memory/internal/`
- Do not anticipate needs or future changes, focus on current state only
- No version in tech names, just the name (e.g., React, not React 19)

### Schema rules to apply to generated Mermaid diagrams

```md
@{{TOOLS}}/rules/01-standards/1-mermaid.md
```

### IDE syntax reference

```md
@{{TOOLS}}/rules/04-tooling/ide-mapping.md
```

## Steps

1. Check if memory bank already exists in `{{DOCS}}/memory/` folder:
   - If exists, update with newer information
   - If not, create from scratch
2. **Auto-detect project type**: Quickly explore the codebase to determine if it's frontend or backend. Use the `scope` frontmatter field to select which templates to generate.
3. **Inform user of detection**: Display detected type and list files that will be generated
4. Spawn parallel task sub-agents for each template files
5. Write generated files to `{{DOCS}}/memory/`
6. Launch an agent to review all files for consistency and accuracy
7. Execute `.aidd/scripts/update_memory.mjs` to sync memory references in context files
