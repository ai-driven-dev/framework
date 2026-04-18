# Decision: AI/IDE tool type separation

| Field   | Value                       |
| ------- | --------------------------- |
| ID      | DEC-024                     |
| Date    | 2026-04-16                  |
| Feature | VSCode standalone tool      |
| Status  | Accepted                    |

## Context

VSCode is an IDE integration, not an AI coding assistant. It has no `agents`, no `prompts`, no AI-specific directories. Lumping it under a single `ToolId` type made interactive prompts show all tools in one flat list, and prevented type-safe branching on AI-only vs IDE-only behavior.

## Decision

Split `ToolId` into `AiToolId` and `IdeToolId` discriminant union types. Rename `AnyToolConfig` to `ToolConfig` (the union). Add `isAiToolConfig(config: ToolConfig): config is AiToolConfig` type guard keyed on `"agents" in config`. Move tool files to `domain/tools/ai/` and `domain/tools/ide/` subfolders. Interactive prompts present two sequential checkboxes: AI tools first, IDE integrations second.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| --- | --- | --- | --- |
| Runtime `category` field on ToolConfig | Explicit | Requires discipline to keep in sync | Type guard on structural field is zero-cost and self-enforcing |
| Single checkbox with grouping headers | Less steps | Inquirer has no group headers without a library | Would blur the conceptual distinction |

## Consequences

- `isAiToolConfig()` enables exhaustive branching without casts
- Install and setup use-cases present two separate prompts — users clearly see the distinction
- `VALID_TOOL_IDS` is derived as `[...AI_TOOL_IDS, ...IDE_TOOL_IDS]` — no duplication
- `domain/tools/ai/` and `domain/tools/ide/` folders mirror the type hierarchy
