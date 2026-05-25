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
3. **Auto-detect project type.** Analyze the project root: scan files and directories, infer the dominant domain (frontend, backend, full-stack, docs, agent config, library, mixed, etc.). Do not restrict to a predefined file-marker list - use any evidence the codebase provides. If the evidence is ambiguous or insufficient to classify, set the type to `unknown` and fall back to step 4 (user confirm).
4. **Confirm with user**. Display the detected type plus the list of template files that would be generated. Ask the user to confirm or override (`frontend` / `backend` / `all` / `cancel`). **The action is blocking on this answer.** If no answer is received OR if detection returned `unknown` AND no user override is provided, FAIL with `status: blocked_awaiting_user_project_type` and stop. Do NOT write any memory file, do NOT invent stub content (e.g. a hand-rolled `project.md`). Templates are the ONLY allowed content source.
5. Filter templates using the `scope` frontmatter field against the confirmed type.
6. **Spawn parallel sub-agents, one per selected template.** Each sub-agent receives the template file path, the project root path, and the detected project type. Each sub-agent MUST:
   a. READ the template structure (sections, placeholders).
   b. ANALYZE the project root for content relevant to the template's domain. EXCLUDE AIDD's own scaffold artifacts from the scan - these are framework metadata, NOT project content:
      - `aidd_docs/` (AIDD documentation tree this skill itself creates)
      - `AGENTS.md` (AIDD-managed context file at the workspace root)
      - `CLAUDE.md` (AIDD-managed context file at the workspace root)
      - `.github/copilot-instructions.md` (AIDD-managed context file)
      - `.aidd/` (AIDD-related tooling state, when present)
      The memory files describe the USER'S PROJECT, not AIDD. Mentioning the AIDD scaffold inside a memory file as if it were project architecture is a documentation defect.
      For ANY other directory or file that looks like tooling, IDE metadata, recording state, vendor cache, or any artifact that may or may not be project content, ASK the user before deciding. The "ASK on doubt" rule is bidirectional:
      - Before EXCLUDING (a dir/file might be project content the user wants documented - e.g. an agent bundle dir prefixed with a dot).
      - Before INCLUDING (a dir/file might be tooling/metadata that does not belong in memory templates - e.g. a recording or session-state dir).
      Do NOT enumerate specific tool names in the action; the goal is the principle, not a maintenance burden of every possible vendor folder.
   c. FILL the template's sections with the extracted facts.
   d. Per the transversal rule "If not applicable / found, remove entire section": sections with no extractable content are REMOVED, not left with placeholder text.
   e. Verbatim template copy is NOT a silent fallback. If content is insufficient or ambiguous, ASK the user how to proceed.
7. **Output contract (parametrized, do not invent).** Write outputs by deriving names and paths from the framework's `assets/templates/memory/` directory:
   - For EVERY `*.md` template in `assets/templates/memory/` whose `scope` frontmatter matches the confirmed project type, write EXACTLY ONE output file.
   - Output filename = the template's basename, verbatim. Example: `architecture.md` template -> output `aidd_docs/memory/architecture.md`.
   - Output path = `aidd_docs/memory/<basename>` at the ROOT of the memory directory. NOT under `internal/`. NOT consolidated with another template.
   - MUST NOT invent a filename (e.g. `PROJECT_MEMORY.md`, `INIT_AUDIT.md` are forbidden - they are not derived from any template basename).
   - MUST NOT consolidate (writing multiple templates into one file is forbidden).
   - Sub-directory templates (e.g. `assets/templates/memory/frontend/*.md`) follow the same rule: output filename = template's basename at `aidd_docs/memory/<basename>` root.
   - Skip writing only when scope filter excludes the template, NEVER for content-judgement reasons.
8. Wait for all sub-agents to complete. Print a summary table with one row per matching template: `template | output file | status`. Valid statuses: `written` or `scope-excluded`. Verbatim-copy and AI-invented filenames are NOT valid statuses.

## Test

`find aidd_docs/memory -maxdepth 1 -name '*.md' | wc -l` returns a number greater than `0`.
