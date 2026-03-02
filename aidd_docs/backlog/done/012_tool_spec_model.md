---
id: 012
milestone: M1
title: "Implement ToolSpec domain model (rewrite, frontmatter, buildFilePath)"
stories: []
points: 0
blockedBy: [011]
---

# 012: Implement ToolSpec domain model (rewrite, frontmatter, buildFilePath)

## Context
ToolSpec is the richest value object in the domain. It owns all tool-specific transformations: content rewriting (placeholder replacement, include syntax conversion), frontmatter conversion, file path building, and flattening decisions. Each tool (Claude, Cursor, Copilot) has distinct conventions.

## Scope
Implement the ToolSpec base model with its core methods. This ticket defines the interface and common behavior -- the tool-specific data/overrides come in ticket 013.

## Acceptance Criteria
- [x] `ToolSpec` interface/class defines:
  - `toolId: ToolId` (enum: claude, cursor, copilot)
  - `directory: string` (e.g., `.claude/`, `.cursor/`, `.github/`)
  - `rewriteContent(content: string, docsDir: string): string`
  - `convertFrontmatter(frontmatter: Record<string, unknown>): Record<string, unknown>`
  - `buildFilePath(contentSection: ContentSection, fileName: string): string`
  - `getConfigOutputPath(configName: string, sourcePath: string): string | null`
  - `getMemoryBankOutputPath(templateName: string): string | null` (default returns null; overridden per tool)
- [x] `ToolId` enum defined with values: `Claude`, `Cursor`, `Copilot`
- [x] `rewriteContent` replaces `{{TOOLS}}/`, `{{DOCS}}/`, `@{{TOOLS}}/`, `@{{DOCS}}/` placeholders
- [x] `convertFrontmatter` converts scope fields between formats (paths, globs/alwaysApply, applyTo)
- [x] `buildFilePath` produces correct tool-relative paths
- [x] `buildFilePath` is the single authority for output path (including tool-specific structure like Copilot flattening)
- [x] Zero infrastructure imports

## Technical Notes
- Content rewriting placeholders: `{{TOOLS}}/` -> tool directory, `{{DOCS}}/` -> docs directory.
- Include syntax: Claude uses `@path`, Cursor uses `@path`, Copilot uses markdown links `[name](path)`.
- Frontmatter scope: Claude uses `paths:` list, Cursor uses `globs:` + `alwaysApply:`, Copilot uses `applyTo:`.
- `getMemoryBankOutputPath` maps a framework template name (e.g., `agentsMd`) to the tool-specific output path. Returns null if the tool does not handle that template.
- Reverse operations (`reverseRewriteContent`, `reverseConvertFrontmatter`) are NOT implemented — deferred to M7 (ticket 070).

## Files to Create/Modify
- `src/domain/models/tool-id.ts` -- ToolId enum (standalone)
- `src/domain/models/tool-spec.ts` -- ToolSpec abstract class
- `tests/domain/models/tool-spec.test.ts` -- core behavior tests

## Tests
- rewriteContent replaces all placeholder variants correctly
- convertFrontmatter is the direct abstract method (no indirection)
- buildFilePath produces correct tool-relative paths for flat and nested sections
- getMemoryBankOutputPath returns null for base class (unknown names)

## Done When
- [x] All acceptance criteria checked
- [x] All tests pass (`pnpm test`)
- [x] Type check passes (`pnpm typecheck`)
- [x] Lint passes (`pnpm lint`)
