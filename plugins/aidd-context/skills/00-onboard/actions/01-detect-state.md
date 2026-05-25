# 01 - Detect state

Probe the project state **silently**. No questions, no writes, no visible output. The detected signals are internal working state the next action consumes - the user sees nothing from this action.

## Inputs

- `project_root` (required) - absolute path to project root (current working directory)

## Outputs

Internal working state only - **never printed to the user**. Onboard must not dump a `state:` block, a signal list, or any raw snapshot into the conversation. The first thing the user sees is the briefing header rendered by `02-recommend-next`.

The internal state covers three signal groups plus three derived values:

- Group A - AIDD setup: `aidd_docs_present`, `memory_dir_present`, `memory_files_filled`, `context_block_present`, `install_md_present`, `repo_is_empty`
- Group B - project context: `has_source_code`, `detected_stack`, `specs_present`, `plan_present`, `open_pr`
- Group C - installed AIDD surface: `installed_aidd_plugins`, `installed_aidd_skills`, `only_aidd_context`
- Derived: `memory_state`, `sdlc_phase`, `suggested_hub_option`

## Process

1. **Read the matrix**. Load `@${CLAUDE_PLUGIN_ROOT}/skills/00-onboard/assets/state-matrix.md` to confirm the signals, the `memory_state` and `sdlc_phase` derivations, and the suggested-option table.
2. **Probe Group A in parallel**. Filesystem checks for each AIDD setup signal:
   - `test -d aidd_docs`
   - `test -d aidd_docs/memory && ls -1 aidd_docs/memory/*.md 2>/dev/null`
   - `grep -l '<aidd_project_memory>' CLAUDE.md AGENTS.md .github/copilot-instructions.md 2>/dev/null`
   - `test -f aidd_docs/INSTALL.md`
   - count of files outside `aidd_docs/`, `.git/`, `node_modules/`, lockfiles, dotfiles -> if zero, `repo_is_empty=true`

   The context-block check covers the supported AI-context files (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`); a tool that uses a different context filename is not detected.
3. **`memory_files_filled` heuristic**. For each memory file, compare against the corresponding template under `aidd-context:02:project-init`'s `assets/templates/memory/` directory (templates are mostly flat - `<name>.md` - with a few under a `backend/` or `frontend/` subfolder). If at least one file differs from its template by more than YAML frontmatter and a few placeholder lines, set `memory_files_filled=true`. Derive `memory_state` (`absent` / `placeholder` / `filled`) per the matrix.
4. **Probe Group B - project context**.
   - `has_source_code`: any source file outside `aidd_docs/`.
   - `detected_stack`: first stack manifest found (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`); else `none`.
   - `specs_present`: requirement docs in `aidd_docs/` (user stories, PRD, or spec).
   - `plan_present`: a technical plan doc in `aidd_docs/`.
   - `open_pr`: the current branch has an open pull or merge request.
   - `sdlc_phase`: derive per the matrix rules. Conflicting or absent signals -> `unknown`. Never guess.
5. **Probe Group C - installed AIDD surface**. Use the AI tool's native plugin and skill discovery to list every enabled AIDD plugin and the skills it exposes, with each skill's `description`. Set `only_aidd_context=true` when `aidd-context` is the sole AIDD plugin installed.
6. **Derive `suggested_hub_option`** from the matrix suggested-option table.
7. **Hold, do not print.** Keep all of this as internal working state. Print nothing. Hand directly to `02-recommend-next`.

## Test

- This action produces zero user-visible output. No `state:` block, no signal list, no `Analysis:` line appears in the conversation.
- All three signal groups plus `memory_state`, `sdlc_phase`, and `suggested_hub_option` are determined and available to action 02.
- `sdlc_phase` is one of the six allowed values; `memory_state` is one of `absent`, `placeholder`, `filled`.
- No skill id from any plugin is emitted by this action.
