---
paths:
  - "src/domain/tools/**/*.ts"
  - "src/domain/capabilities/**/*.ts"
  - "src/domain/formats/**/*.ts"
---

# ToolConfig

## Layers

- `formats/` — pure string transforms, no I/O (`markdown.ts`, `toml.ts`, `json.ts`, `placeholders.ts`, `command.ts`)
- `capabilities/` — capability classes (`agents-capability.ts`, `commands-capability.ts`, `hooks-capability.ts`, `mcp-capability.ts`, `plugins-capability.ts`, `rules-capability.ts`, `settings-capability.ts`, `skills-capability.ts`)
- `tools/contracts.ts` — `AiTool<C>` interface, all `Has*` interfaces, `IdeToolConfig`, `UserFileSectionKey`, `UserFileSection`
- `tools/registry.ts` — `ToolConfig` union, `isAiTool`, `registerTool`, `getToolConfig`
- `tools/ai/` — one file per AI tool, composes capabilities

## AiTool<C> — the base type

- `kind: "ai"`, `toolId: AiToolId`, `directory`, `signalDir`, `capabilities: C`
- `C` is an intersection of `Has*` interfaces (e.g. `HasAgents & HasSkills & HasMcp`)
- Capability presence guard: `"agents" in tool.capabilities`

## Two config variants

- `AiTool<unknown>` — AI assistants (claude, cursor, copilot, opencode, codex); `kind: "ai"`
- `IdeToolConfig` — IDE integrations (vscode); `kind: "ide"`; no capability fields
- `ToolConfig = AiTool<unknown> | IdeToolConfig` — union used everywhere
- `isAiTool(config: ToolConfig): config is AiTool<unknown>` — discriminates on `kind`

## Required fields

- `toolId` — `AiToolId` or `IdeToolId`
- `directory` — root output directory
- `signalDir` — scanned for `name: aidd:` signals (`null` for IDE tools)

## Content rewriting

- `rewriteContent` / `reverseRewriteContent` must be lossless round-trips
- Use `baseRewriteContent` / `baseReverseRewriteContent` as base, then apply tool-specific transforms

## Adding a new tool

- 1 file in `tools/ai/`, compose from existing capability classes

## Adding a new capability

- 1 `Has*` interface in `tools/contracts.ts`
- 1 capability class in `capabilities/`
