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
3. **Auto-detect project type.** Explore the codebase signal set:
   - **Programming-language markers**: `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, lockfiles, `src/`, `lib/`, `app/` directories.
   - **Doc-heavy signals**: 20+ `.md` files outside `node_modules/`, a `docs/` or `articles/` dir, mkdocs/sphinx/docusaurus config.
   - **Agent / config repos**: `*.agent.md`, `*.skill.md`, `*.prompt.md`, `*.instructions.md` files; `.copilot/`, `.claude/`, `.cursor/`, `.opencode/`, `.codex/` dirs.
   - **Mixed**: any combination of the above.
   Classify the project as `frontend`, `backend`, `all` (programming), `docs`, `agent-config`, or `mixed`. If signals are AMBIGUOUS or NONE detected, classify as `unknown` and fall back to the user-confirm step (step 4) with the full template list so the user picks the scope.
4. **Confirm with user**. Display the detected type plus the list of template files that would be generated. Ask the user to confirm or override (`frontend` / `backend` / `all` / `cancel`). **The action is blocking on this answer.** If no answer is received OR if detection returned `unknown` AND no user override is provided, FAIL with `status: blocked_awaiting_user_project_type` and stop. Do NOT write any memory file, do NOT invent stub content (e.g. a hand-rolled `project.md`). Templates are the ONLY allowed content source.
5. Filter templates using the `scope` frontmatter field against the confirmed type.
6. **Spawn parallel sub-agents, one per selected template.** Each sub-agent receives: the template file path, the project root path, and the detected project type. Each sub-agent MUST:
   a. READ the template structure (sections, placeholders).
   b. SCAN the project root for relevant source files: code files matching the template's domain (architecture.md -> src/, lib/; codebase-map.md -> tree walk; deployment.md -> Dockerfiles, CI configs; vcs.md -> .git/, CHANGELOG.md; testing.md -> tests/, *.test.*, *.spec.*; coding-assertions.md -> linter configs, formatters; project-brief.md -> README, ABOUT.md, package.json description, pyproject.toml description).
   c. EXTRACT project-specific facts from those files into the template's sections.
   d. Per the transversal rule "If not applicable / found, remove entire section": sections with no extractable content are REMOVED, not left with placeholder text.
   e. Templates copied verbatim is ONLY allowed when the entire scan returns nothing for that template (e.g., truly empty repo); flag this in the summary.
7. **Write generated files** to `aidd_docs/memory/<template-name>.md` (ROOT of the memory directory, not under `internal/`). The `internal/` subdir is reserved for AIDD workflow traces and MUST NOT contain template-generated memory files.
8. Wait for all sub-agents to complete. Print a summary table: `template | output file | written | scope`.

## Test

`find aidd_docs/memory -maxdepth 1 -name '*.md' | wc -l` returns a number greater than `0`.
