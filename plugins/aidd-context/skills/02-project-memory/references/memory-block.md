# Memory block

The `<aidd_project_memory>` block is where a tool's AI context file points to the generated memory files. It sits under `## Memory Management` → `### Project memory` (full template: `@../assets/AGENTS.md`).

## Upsert

Apply the first case that matches a tool's context file:

- **Absent:** copy `@../assets/AGENTS.md`, set the tool's title.
- **No `## Memory Management`:** append that section from the template.
- **Section but no block:** insert an empty `<aidd_project_memory>` block after `### Project memory`.
- **Block present:** leave it, report "already ok".
