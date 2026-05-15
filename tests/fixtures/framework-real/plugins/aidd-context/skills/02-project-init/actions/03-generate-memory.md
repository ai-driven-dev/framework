# 03 - Generate memory

Detect the project type and spawn parallel sub-agents to generate memory bank files from templates.

## Context

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

## Inputs

- `aidd_docs/memory/` directory
- project root for codebase scanning

## Outputs

```
aidd_docs/
  memory/
    <file>.md   ← one per selected template (scope: all + detected type)
  internal/
    <file>.md   ← one per selected template (scope: all + detected type)
```

## Depends on

- `02-scaffold-docs`

## Process

1. Check if memory bank already exists in `aidd_docs/memory/` folder:
   - If exists, update with newer information
   - If not, create from scratch
2. **Auto-detect project type**: Quickly explore the codebase to determine if it's frontend or backend. Use the `scope` frontmatter field to select which templates to generate.
3. **Inform user of detection**: Display detected type and list files that will be generated
4. Spawn parallel task sub-agents for each template files
5. Write generated files to `aidd_docs/memory/`
6. Wait for all sub-agents to complete. Print a list of written files.

## Test

`find aidd_docs/memory -maxdepth 1 -name '*.md' | wc -l` returns a number greater than `0`.
