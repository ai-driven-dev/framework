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
- [ ] `ToolSpec` interface/class defines:
  - `toolId: ToolId` (enum: claude, cursor, copilot)
  - `directory: string` (e.g., `.claude/`, `.cursor/`, `.github/`)
  - `rewriteContent(content: string, docsDir: string): string`
  - `convertFrontmatter(frontmatter: Record<string, unknown>): Record<string, unknown>`
  - `buildFilePath(contentSection: ContentSection, fileName: string): string`
  - `shouldFlatten(contentSection: ContentSection): boolean`
  - `reverseRewriteContent(content: string, docsDir: string): string` (stub, throws or returns as-is)
  - `reverseConvertFrontmatter(frontmatter: Record<string, unknown>): Record<string, unknown>` (stub)
- [ ] `ToolId` enum defined with values: `Claude`, `Cursor`, `Copilot`
- [ ] `rewriteContent` replaces `{{TOOLS}}/`, `{{DOCS}}/`, `@{{TOOLS}}/`, `@{{DOCS}}/` placeholders
- [ ] `convertFrontmatter` converts scope fields between formats (paths, globs/alwaysApply, applyTo)
- [ ] `buildFilePath` produces correct tool-relative paths
- [ ] `shouldFlatten` returns false by default (Copilot overrides in 013)
- [ ] Reverse methods are stubbed with test coverage for the stub behavior
- [ ] Zero infrastructure imports

## Technical Notes
- Content rewriting placeholders: `{{TOOLS}}/` -> tool directory, `{{DOCS}}/` -> docs directory.
- Include syntax: Claude uses `@path`, Cursor uses `@path`, Copilot uses markdown links `[name](path)`.
- Frontmatter scope: Claude uses `paths:` list, Cursor uses `globs:` + `alwaysApply:`, Copilot uses `applyTo:`.
- The reverse methods are v3.1+ seams (M7 sync). Stubs now, full implementation in ticket 070.

## Files to Create/Modify
- `src/domain/models/tool-spec.ts` -- ToolSpec model, ToolId enum
- `tests/domain/models/tool-spec.test.ts` -- core behavior tests

## Tests
- rewriteContent replaces all placeholder variants correctly
- convertFrontmatter converts between scope formats
- buildFilePath produces correct paths per tool
- shouldFlatten returns false by default
- reverseRewriteContent stub behavior (returns canonical or throws)
- reverseConvertFrontmatter stub behavior

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
