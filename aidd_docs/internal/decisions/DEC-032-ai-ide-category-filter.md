# DEC-032 — AI/IDE category filter as positional arg on install/uninstall/status/doctor

## Date

2026-04-21

## Status

Accepted

## Context

With the introduction of VS Code as an IDE tool (DEC-024), users need a way to scope operations to either AI tools or IDE integrations without typing individual tool IDs. There was no distinction at the command level — all tools were treated identically by `install`, `uninstall`, `status`, and `doctor`.

## Decision

Add an optional positional `[category]` argument (`"ai"` or `"ide"`) to four commands:

- `aidd install [ai|ide] <tools...>`
- `aidd uninstall [ai|ide] <tools...>`
- `aidd status [ai|ide]`
- `aidd doctor [ai|ide]`

Parsing: the first positional argument is consumed as a category only if it equals `"ai"` or `"ide"`; all other values are treated as tool IDs (backward-compatible).

Cross-category validation: if a category is given alongside explicit tool IDs, `assertToolIdsMatchCategory()` throws when a tool doesn't belong to the category (e.g. `aidd install ai vscode` → error).

Interactive mode (install/uninstall): the checkbox is filtered to only show tools of the requested category. When no selectable choices remain (all already installed), the checkbox is skipped gracefully — 0 selection exits cleanly instead of throwing.

`status` and `doctor` with a category suppress docs output, since docs are category-agnostic.

## New domain helpers (tool-config.ts)

- `ToolCategory = "ai" | "ide"` — named type, no inline redefinition in use-cases
- `toolIdsForCategory(category)` — returns `AI_TOOL_IDS` or `IDE_TOOL_IDS`
- `assertToolIdsMatchCategory(toolIds, category)` — throws `ToolValidationError` on mismatch

## Consequences

- Fully backward-compatible: `aidd install claude` continues to work unchanged.
- Users can install/remove/check an entire category in one command.
- Interactive flow automatically adapts to the requested category.
- Cross-category mistakes produce a clear, actionable error message.
