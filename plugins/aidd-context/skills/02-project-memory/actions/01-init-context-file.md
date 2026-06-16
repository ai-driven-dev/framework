# 01 - Init context file

Resolve the target tools, then ensure each tool's AI context file carries the project memory block.

## Input

The project root.

## Output

One context file per confirmed tool, each carrying an empty `<aidd_project_memory>` block.

## Process

1. **Gate.** Read `@../assets/AGENTS.md`. If it cannot be read, stop: the plugin assets are not reachable in this host.
2. **Detect.** Find the context files already present, using the per-tool paths in `@../references/mapping-ai-context-file.md`. Only those paths qualify. Any other file is user content, off-limits.
3. **Resolve tools.**
   - Re-run: every detected context file already carries the block. The confirmed set is the tools present. Skip the prompt.
   - New: propose the detected tools plus the full list (`@../references/mapping-ai-context-file.md`) and ask which the user uses. Wait for an explicit pick. Never default to all, never infer from filenames.
4. **Upsert.** For each confirmed tool, resolve its context-file path (`@../references/mapping-ai-context-file.md`) and apply the first matching case:
   - Absent: copy `@../assets/AGENTS.md`, set the title for that tool.
   - Present, no `## Memory Management`: append that section from the template.
   - Present, section but no block: insert an empty `<aidd_project_memory>` block after the `### Project memory` heading.
   - Block present: leave it, report "already ok".
5. **Report.** Print a table: tool, file, action taken.

## Test

- Every confirmed tool's context file exists and contains a `<aidd_project_memory>` block.
