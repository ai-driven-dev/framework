---
paths:
  - "src/domain/tools/**/*.ts"
  - "src/domain/models/tool-config.ts"
---

# ToolConfig

## Structure

- Plain object const (not a class), one per tool file
- Exported as `*ToolConfig` (e.g. `claudeToolConfig`)
- Implements `ToolConfig` interface from `domain/models/tool-config.ts`

## Two config variants

- `AiToolConfig` — AI coding assistants (claude, cursor, copilot, opencode); `toolId: AiToolId`
- `IdeToolConfig` — IDE integrations (vscode); `toolId: IdeToolId`; no agents/commands/rules/skills handlers
- `ToolConfig = AiToolConfig | IdeToolConfig` — the union used everywhere
- `isAiToolConfig(config: ToolConfig): config is AiToolConfig` — discriminates on `"agents" in config`

## Required fields (both variants)

- `toolId` — `AiToolId` (`"claude" | "cursor" | "copilot" | "opencode"`) or `IdeToolId` (`"vscode"`)
- `directory` — root output directory (e.g. `.claude/`, `.vscode/`)
- `signalDir` — scanned for `name: aidd:` frontmatter signals (AI tools only; `null` for IDE tools)

## Handlers (AiToolConfig only)

- Use shared helpers from `tool-config.ts`: `namedAgentsSectionHandler`, `buildStandardCommandsHandler`, `passthroughSkillsHandler`
- No tool-specific logic in use-cases — extend handler interfaces if runtime behavior is needed

## Content rewriting

- `rewriteContent` / `reverseRewriteContent` must be lossless round-trips
- Use `baseRewriteContent` / `baseReverseRewriteContent` as base, then apply tool-specific transforms
- Named handler constants reused inside `rewriteContent` — no path mapping duplication
