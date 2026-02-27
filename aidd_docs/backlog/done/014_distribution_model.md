---
id: 014
milestone: M1
title: "Implement Distribution domain aggregate"
stories: []
points: 0
blockedBy: [013]
---

# 014: Implement Distribution domain aggregate

## Context
The Distribution aggregate is the core business logic that generates tool-specific file sets from framework content. It takes a FrameworkDescriptor, a ToolSpec, and a docs directory, then produces an array of GeneratedFile objects with rewritten content and computed hashes.

## Scope
Implement `Distribution.generate()` with full logic for iterating framework content sections, delegating rewriting to ToolSpec, and producing GeneratedFile arrays.

## Acceptance Criteria
- [ ] `Distribution.generate(framework: FrameworkDescriptor, toolSpec: ToolSpec, docsDir: string): GeneratedFile[]`
- [ ] Iterates all content sections from the framework descriptor
- [ ] For each content file: calls `toolSpec.rewriteContent()` on the content body
- [ ] For each content file with frontmatter: calls `toolSpec.convertFrontmatter()` on the frontmatter
- [ ] For each content file: calls `toolSpec.buildFilePath()` to determine output path
- [ ] For flattened sections (Copilot): handles directory flattening via `toolSpec.shouldFlatten()`
- [ ] Each GeneratedFile has relativePath, rewritten content, and pre-computed FileHash
- [ ] Produces correct file sets for Claude, Cursor, and Copilot given the test fixture
- [ ] Handles memory bank files, MCP config, and VS Code config references from the framework descriptor
- [ ] Zero infrastructure imports (uses Hasher port for hashing)

## Technical Notes
- The Distribution does NOT write files. It produces GeneratedFile[] for the use case to write.
- Hashing: Distribution needs a Hasher (port) to compute FileHash for each generated file.
- Template files (memory bank, docs readme) are raw copies, not content-rewritten.
- Config files (MCP config, VS Code dir) may need special handling per tool.

## Files to Create/Modify
- `src/domain/models/distribution.ts` -- Distribution aggregate with generate()
- `tests/domain/models/distribution.test.ts` -- tests using framework fixture + all 3 ToolSpecs

## Tests
- generate() with Claude ToolSpec produces correct file count and paths
- generate() with Cursor ToolSpec produces correct file count and paths
- generate() with Copilot ToolSpec produces correct file count with flattened paths
- Generated content has placeholders replaced correctly
- Generated frontmatter is converted per tool
- FileHash is computed for each generated file

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
