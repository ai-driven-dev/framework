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
Implement `generateDistribution()` with full logic for iterating framework content sections, template refs (memory bank), and config refs (MCP), delegating rewriting to ToolSpec, and producing GeneratedFile arrays.

## Acceptance Criteria
- [x] `generateDistribution(framework, toolSpec, docsDir, contentFiles, hasher): GeneratedFile[]` (standalone function, not class method)
- [x] Iterates all content sections from the framework descriptor
- [x] For each content file: calls `toolSpec.rewriteContent()` on the content body
- [x] For each content file with frontmatter: calls `toolSpec.convertFrontmatter()` on the frontmatter
- [x] For each content file: calls `toolSpec.buildFilePath()` to determine output path
- [x] For flattened sections (Copilot): directory flattening is handled entirely within `toolSpec.buildFilePath()`
- [x] Iterates `framework.templateRefs` and calls `toolSpec.getMemoryBankOutputPath()` per template — raw copy, no content rewriting
- [x] Iterates `framework.configRefs` and calls `toolSpec.getConfigOutputPath()` per config — raw copy
- [x] Each GeneratedFile has relativePath, rewritten content, and pre-computed FileHash
- [x] Produces correct file sets for Claude, Cursor, and Copilot given the test fixture
- [x] Zero infrastructure imports (uses Hasher port for hashing)

## Technical Notes
- The function is `generateDistribution()` — a pure function, no class wrapper needed.
- Signature extended vs original spec: `contentFiles: Map<string, string>` and `hasher: Hasher` are explicit parameters (both provided by the use case from infrastructure ports).
- Template files (memory bank): iterated via `framework.templateRefs`; output path determined by `toolSpec.getMemoryBankOutputPath(templateRef.name)`; content is raw copy (not content-rewritten).
- Config files (MCP): iterated via `framework.configRefs`; output path determined by `toolSpec.getConfigOutputPath(configRef.name, configRef.path)`; content is raw copy.
- VS Code config (`vscodeDir`): present in `framework.configRefs` loop but all ToolSpecs return null for `vscodeDir` — silent skip by design. VS Code deep merge is M5 scope (ticket 053), where `FileSystemAdapter.mergeJsonFile()` will be used directly by the use case, not by distribution.

## Files to Create/Modify
- `src/domain/models/distribution.ts` -- generateDistribution() function
- `tests/domain/models/distribution.test.ts` -- tests using framework fixture + all 3 ToolSpecs

## Tests
- generateDistribution() with Claude ToolSpec produces files in .claude/
- generateDistribution() with Cursor ToolSpec produces files in .cursor/
- generateDistribution() with Copilot ToolSpec produces files in .github/ with flattened paths
- Generated content has placeholders replaced correctly
- Generated frontmatter is converted per tool
- FileHash is computed for each generated file
- Skills section filters to entryFile only (SKILL.md)
- MCP config output path is correct per tool (Claude: .mcp.json, Cursor: .cursor/mcp.json, Copilot: excluded)
- Memory bank output path is correct per tool (Claude: CLAUDE.md, Cursor: AGENTS.md, Copilot: .github/copilot-instructions.md)
- Claude commands land in .claude/commands/aidd/{phase}/

## Done When
- [x] All acceptance criteria checked
- [x] All tests pass (`pnpm test`)
- [x] Type check passes (`pnpm typecheck`)
- [x] Lint passes (`pnpm lint`)
