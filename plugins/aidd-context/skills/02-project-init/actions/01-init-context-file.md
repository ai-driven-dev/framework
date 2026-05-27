# 01 - Upsert context file

Ensure every installed tool's AI context file contains the `<aidd_project_memory>` block required by `update_memory.js`.

## Context

```markdown
@../references/mapping-ai-context-file.md
```

## Inputs

- `project_root` (required) - absolute path to project root (current working directory)

## Outputs

```
One or more context files exist and each contains the mandatory block :
  <aidd_project_memory>
  </aidd_project_memory>
```

## Process

1. **Verify asset access.** Read `@../assets/AGENTS.md`. If the read fails or returns empty content, FAIL with `status: blocked_assets_unreachable: cannot read assets/AGENTS.md from the aidd-context plugin. The plugin assets are not accessible in this AI host's runtime. Ensure the plugin is installed in a location your host can read via @-path resolution.` Do NOT proceed, do NOT invent template content.
2. **Detect installed context files (white-list only).** Check ONLY these THREE canonical paths at the workspace root:
   - `<project_root>/CLAUDE.md`
   - `<project_root>/AGENTS.md`
   - `<project_root>/.github/copilot-instructions.md`
   No other file is a valid AI context file for this skill. Files matching `*.agent.md`, `*.skill.md`, `*-agent.md`, `<vendor>-*.md`, or any pattern outside this exact white-list are USER PROJECT FILES and MUST NOT be modified, even if their name contains the word "agent", "skill", or "instructions". Note which of the three canonical paths are already present.
2.5. **Detect modify mode.** If ALL detected context files (from step 2) already contain the `<aidd_project_memory>` block, this is a re-run on an already-initialized project (modify mode). Skip step 3 (do not re-prompt for tool selection); jump directly to step 5 with the existing tools as the confirmed set. Print "modify mode - all context files already initialized; skipping tool prompt."
3. **Ask the user**. Display the detected files and the full tool list (`claude`, `cursor`, `codex`, `copilot`, `opencode`). Ask which tools the user actively uses. Default proposal: tools whose context file is already present, else `claude` alone. **The action is blocking on this answer.** If no explicit tool list is received, FAIL with `status: blocked_awaiting_user_tool_selection`. Block on the user's explicit pick; no inference; no auto-creation of unsolicited files.
4. **Resolve target paths**. From the confirmed tool list, map each to its context file per the mapping reference. Deduplicate (multiple tools may share `AGENTS.md`).
5. **Filename and location pattern guard (apply before the per-target loop).** Filename and location are determined ONLY by the mapping at `references/mapping-ai-context-file.md`. The context file lives at `<project_root>/<filename>` (e.g. `<project_root>/CLAUDE.md` for Claude Code, `<project_root>/AGENTS.md` for Cursor/OpenCode/Codex, `<project_root>/.github/copilot-instructions.md` for Copilot). The file MUST NOT be placed inside `aidd_docs/` or any subdirectory. Never invent a filename not present in the mapping reference.

   **Single-file-per-confirmed-tool invariant (enforced before the loop runs).** Create exactly one context file per tool the user confirmed in step 3. Any tool absent from the confirmed list is skipped entirely (not created, not modified). Multi-tool only when the user explicitly picked multiple tools.

   For each target file, apply the first matching case:
   - **File absent** -> copy `@../assets/AGENTS.md`; replace the main title with the tool-appropriate heading.
   - **File present, `## Memory Management` section missing** -> append the full `## Memory Management` block extracted from `assets/AGENTS.md` (from `## Memory Management` to end of file).
   - **File present, section exists, `<aidd_project_memory>` tag missing** -> inject `<aidd_project_memory>\n</aidd_project_memory>` immediately after the `### Project memory` heading (create the heading if absent).
   - **`<aidd_project_memory>` tag already present** -> skip; print `already ok`.
6. Print a summary table: `tool | file | action taken`.

## Test

`grep -rl '<aidd_project_memory>' CLAUDE.md AGENTS.md .github/copilot-instructions.md 2>/dev/null | wc -l` returns a number greater than `0`.
