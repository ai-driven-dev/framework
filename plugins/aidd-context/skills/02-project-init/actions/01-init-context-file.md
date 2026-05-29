# 01 - Upsert context file

Ensure every installed tool's AI context file contains the `<aidd_project_memory>` block required by `update_memory.js`.

## Context

```markdown
@../references/mapping-ai-context-file.md
```

## Inputs

- `project_root` (required) - absolute path to project root (current working directory)
- `confirmed_tools` (required) - the tool set confirmed by the SKILL.md **Tool detection** gate (run before this action). This action consumes that set; it does not detect or prompt for tools itself.

## Outputs

```
One or more context files exist and each contains the mandatory block :
  <aidd_project_memory>
  </aidd_project_memory>
```

## Process

1. **Verify asset access.** Read `@../assets/AGENTS.md`. If the read fails or returns empty content, FAIL with `status: blocked_assets_unreachable: cannot read assets/AGENTS.md from the aidd-context plugin. The plugin assets are not accessible in this AI host's runtime. Ensure the plugin is installed in a location your host can read via @-path resolution.` Do NOT proceed, do NOT invent template content.
2. **Take `confirmed_tools` from the gate.** Use the tool set the SKILL.md **Tool detection** gate already resolved (detection, modify-mode shortcut, blocking prompt, and the no-default-all / no-filename-inference guards all live there). Do NOT re-detect or re-prompt here. If `confirmed_tools` is empty or absent, the gate did not run - FAIL with `status: blocked_awaiting_user_tool_selection` rather than guessing.
3. **Resolve target paths**. From `confirmed_tools`, map each to its context file per `@../references/mapping-ai-context-file.md`. Deduplicate (multiple tools may share a path). Only the paths in that mapping are valid targets; any other file (`*.agent.md`, `<vendor>-*.md`, lookalikes) is user content and MUST NOT be touched.
4. **Filename and location pattern guard (apply before the per-target loop).** Filename and location are determined ONLY by `@../references/mapping-ai-context-file.md`. The context file lives at `<project_root>/<filename>` from that mapping. The file MUST NOT be placed inside `aidd_docs/` or any subdirectory. Never invent a filename not present in the mapping reference.

   **Single-file-per-confirmed-tool invariant (enforced before the loop runs).** Create exactly one context file per tool in `confirmed_tools`. Any tool absent from that set is skipped entirely (not created, not modified). Multi-tool only when the user explicitly picked multiple tools.

   For each target file, apply the first matching case:
   - **File absent** -> copy `@../assets/AGENTS.md`; replace the main title with the tool-appropriate heading.
   - **File present, `## Memory Management` section missing** -> append the full `## Memory Management` block extracted from `assets/AGENTS.md` (from `## Memory Management` to end of file).
   - **File present, section exists, `<aidd_project_memory>` tag missing** -> inject `<aidd_project_memory>\n</aidd_project_memory>` immediately after the `### Project memory` heading (create the heading if absent).
   - **`<aidd_project_memory>` tag already present** -> skip; print `already ok`.
5. Print a summary table: `tool | file | action taken`.

## Test

`grep -rl '<aidd_project_memory>' CLAUDE.md AGENTS.md .github/copilot-instructions.md 2>/dev/null | wc -l` returns a number greater than `0`.
