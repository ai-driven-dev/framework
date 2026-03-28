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

## Required fields

- `toolId` — one of `ToolId` (`"claude" | "cursor" | "copilot" | "opencode"`)
- `directory` — root output directory (e.g. `.claude/`)
- `toolSuffix` — memory bank file suffix
- `signalDir` — scanned for `name: aidd:` frontmatter signals

## Handlers

- Use shared helpers from `tool-config.ts`: `namedAgentsSectionHandler`, `buildStandardCommandsHandler`, `passthroughSkillsHandler`
- No tool-specific logic in use-cases — extend handler interfaces if runtime behavior is needed

## Content rewriting

- `rewriteContent` / `reverseRewriteContent` must be lossless round-trips
- Use `baseRewriteContent` / `baseReverseRewriteContent` as base, then apply tool-specific transforms
- Named handler constants reused inside `rewriteContent` — no path mapping duplication
