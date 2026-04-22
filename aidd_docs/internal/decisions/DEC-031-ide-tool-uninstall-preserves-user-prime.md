# Decision: IDE tool uninstall preserves user-prime files

| Field   | Value                              |
| ------- | ---------------------------------- |
| ID      | DEC-031                            |
| Date    | 2026-04-20                         |
| Feature | IDE context patch on install       |
| Status  | Accepted                           |

## Context

IDE tools (vscode) own user-prime merge files (`.vscode/settings.json`). These files hold user customizations that the framework never overwrites. Uninstalling vscode must not delete them — even if vscode is the sole owner — because they carry user data, not framework data.

## Decision

In `UninstallUseCase.removeNullSectionMergeFile`, guard the delete path with `isAiToolConfig(getToolConfig(toolId))`. If the tool being uninstalled is an IDE tool, skip deletion entirely and only remove the manifest entry. Only AI tool files are eligible for deletion when no other owners remain.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| --- | --- | --- | --- |
| Check `mergeStrategy === "user-prime"` | Explicit | Stores merge strategy in manifest | DEC-016: mergeStrategy not in manifest; use discriminant instead |
| Always delete, add opt-out flag | Flexible | Requires user awareness | Uninstall should be safe by default |

## Consequences

- User customizations in `.vscode/settings.json` survive `aidd uninstall vscode`
- Guard uses existing `isAiToolConfig` discriminant — no new type or field needed
- Manifest entry is still removed on uninstall so future IDE install starts clean
- AI tool null-section files (e.g. `.mcp.json` section) still follow DEC-028 delete-when-no-owners logic
