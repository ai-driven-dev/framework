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
2. **Auto-detect project type**. Quickly explore the codebase (package.json, pyproject.toml, lockfiles, src layout, etc.) to classify as `frontend`, `backend`, or `all`.
3. **Confirm with user**. Display detected type plus the list of template files that would be generated. Ask the user to confirm or override (`frontend` / `backend` / `all` / `cancel`). Wait for explicit answer before continuing.
4. Filter templates using the `scope` frontmatter field against the confirmed type.
5. Spawn parallel sub-agents, one per selected template.
6. Write generated files to `aidd_docs/memory/`.
7. Wait for all sub-agents to complete. Print a summary table: `template | output file | written | scope`.

## Test

`find aidd_docs/memory -maxdepth 1 -name '*.md' | wc -l` returns a number greater than `0`.
