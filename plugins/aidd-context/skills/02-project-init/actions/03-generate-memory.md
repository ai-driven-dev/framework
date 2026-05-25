# 03 - Generate memory

Detect the project type and spawn parallel sub-agents to generate memory bank files from templates.

## Context

Every file has its own template to follow.

### Hard copy into memory bank (always generated)

```text
@${CLAUDE_PLUGIN_ROOT}/skills/02-project-init/assets/templates/memory
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
@${CLAUDE_PLUGIN_ROOT}/skills/02-project-init/assets/templates/memory
```

#### Internal templates (frontend / backend)

```text
@${CLAUDE_PLUGIN_ROOT}/skills/02-project-init/assets/templates/memory/frontend
@${CLAUDE_PLUGIN_ROOT}/skills/02-project-init/assets/templates/memory/backend
```

## Inputs

- `aidd_docs/memory/` directory
- project root for codebase scanning

## Outputs

```
aidd_docs/
  memory/
    <file>.md   ← one per selected template (scope: all + detected type)
```

## Depends on

- `02-scaffold-docs`

## Process

1. **Verify asset access.** Read at least one canonical template (e.g. `@${CLAUDE_PLUGIN_ROOT}/skills/02-project-init/assets/templates/memory/architecture.md`). If the read fails or returns empty content, FAIL with `status: blocked_assets_unreachable: cannot read @${CLAUDE_PLUGIN_ROOT}/skills/02-project-init/assets/templates/memory/. Templates are required and this action does not invent content. Ensure the aidd-context plugin assets are accessible to this AI host.` Do NOT proceed, do NOT write any memory file.
2. Check if memory bank already exists in `aidd_docs/memory/` folder:
   - If exists, update with newer information
   - If not, create from scratch
3. **Auto-detect project type**. Quickly explore the codebase (package.json, pyproject.toml, lockfiles, src layout, etc.) to classify as `frontend`, `backend`, or `all`.
4. **Confirm with user**. Display the detected type plus the list of template files that would be generated. Ask the user to confirm or override (`frontend` / `backend` / `all` / `cancel`). **The action is blocking on this answer.** If no answer is received OR if detection returned `unknown` AND no user override is provided, FAIL with `status: blocked_awaiting_user_project_type` and stop. Do NOT write any memory file, do NOT invent stub content (e.g. a hand-rolled `project.md`). Templates are the ONLY allowed content source.
5. Filter templates using the `scope` frontmatter field against the confirmed type.
6. Spawn parallel sub-agents, one per selected template.
7. Write generated files to `aidd_docs/memory/<template-name>.md` (ROOT of the memory directory, not under `internal/`). The `internal/` subdir is reserved for AIDD workflow traces and MUST NOT contain template-generated memory files.
8. Wait for all sub-agents to complete. Print a summary table: `template | output file | written | scope`.

## Test

`find aidd_docs/memory -maxdepth 1 -name '*.md' | wc -l` returns a number greater than `0`.
