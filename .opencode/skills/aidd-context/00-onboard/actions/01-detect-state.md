# 01 - Detect state

Snapshot the project's aidd-context onboarding state from filesystem probes only. No questions, no writes. Matches one of 4 Stage 1 rows from the state matrix.

## Inputs

- `project_root` (required) - absolute path to project root (current working directory)

## Outputs

A state snapshot printed as a compact block the next action will consume.

```text
state:
  aidd_docs_present:     true|false
  memory_dir_present:    true|false
  memory_files_count:    <int>
  memory_files_filled:   true|false
  context_block_present: true|false
  install_md_present:    true|false
  repo_is_empty:         true|false
matched_row: 1|2|3|4
recommended_skill: aidd-context:01:bootstrap | aidd-context:02:project-init | ask
```

`ask` means Stage 1 did not match a setup gap. Action 02 handles it by rendering the Stage 2 intent menu.

## Process

1. **Read the matrix**. Load `@../assets/state-matrix.md` to confirm Stage 1 rows and the signal reference.
2. **Probe in parallel**. Run filesystem checks for each signal:
   - `test -d aidd_docs`
   - `test -d aidd_docs/memory && ls -1 aidd_docs/memory/*.md 2>/dev/null | wc -l`
   - `grep -l '<aidd_project_memory>' CLAUDE.md AGENTS.md .github/copilot-instructions.md 2>/dev/null`
   - `test -f aidd_docs/INSTALL.md`
   - count of files outside `aidd_docs/`, `.git/`, `node_modules/`, lockfiles, dotfiles -> if zero, `repo_is_empty=true`
3. **`memory_files_filled` heuristic**. For each memory file, compare against the corresponding template in `aidd-context:02:project-init` (`assets/templates/memory/<scope>/<name>.md`). If at least one file differs from its template by more than YAML frontmatter and a few placeholder lines, set `memory_files_filled=true`.
4. **Match Stage 1 top-down**. Apply the first matching row from `state-matrix.md` Stage 1. Record `matched_row` and `recommended_skill`.
5. **No intent guessing**. Never auto-match rows that depend on user intent. If Stage 1 does not match rows 1 to 3, the answer is always row 4 (`ask`). Action 02 will ask the user explicitly.
6. **Print the snapshot block**. Exact format shown in `## Outputs`. Nothing else.
7. **Hand off**. The next action (`02-recommend-next`) consumes this snapshot from conversation context.

## Test

The printed snapshot block contains all 7 signal keys with `true|false` or integer values, plus a `matched_row` integer between 1 and 4 and a `recommended_skill` value that is exactly one of `aidd-context:01:bootstrap`, `aidd-context:02:project-init`, or `ask`. No other skill identifier is ever returned by this action.
