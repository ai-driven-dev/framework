---
id: 070
milestone: M7
title: "Complete ToolSpec reverse operations for sync"
stories: []
points: 0
blockedBy: [063]
---

# 070: Complete ToolSpec reverse operations for sync

## Context
The sync command needs to reverse-rewrite tool-specific content back to canonical format before forward-rewriting it to another tool. The `reverseRewriteContent` and `reverseConvertFrontmatter` methods were stubbed in ticket 012. This ticket provides the full implementation.

## Scope
Implement full reverse operations for all three ToolSpecs (Claude, Cursor, Copilot). This is the spike identified in milestones.md ("Reverse-rewrite feasibility", 2 days).

## Acceptance Criteria
- [ ] `reverseRewriteContent(content, docsDir)` for Claude: converts `@.claude/path` back to `@{{TOOLS}}/path`, `.claude/` back to `{{TOOLS}}/`
- [ ] `reverseRewriteContent(content, docsDir)` for Cursor: converts `@.cursor/path` back to `@{{TOOLS}}/path`, `.cursor/` back to `{{TOOLS}}/`
- [ ] `reverseRewriteContent(content, docsDir)` for Copilot: converts markdown links back to `@{{TOOLS}}/path`, `.github/` back to `{{TOOLS}}/`
- [ ] `reverseConvertFrontmatter()` for Claude: converts `paths:` back to canonical scope
- [ ] `reverseConvertFrontmatter()` for Cursor: converts `globs:`+`alwaysApply:` back to canonical
- [ ] `reverseConvertFrontmatter()` for Copilot: converts `applyTo:` back to canonical
- [ ] Round-trip: `rewrite(reverse(content))` produces equivalent output (within the tool)
- [ ] Cross-tool: `forward(reverse(content))` from Claude to Cursor produces correct Cursor content
- [ ] Reverse rewrite is lossless for all content types in the framework fixture

## Technical Notes
- The reverse of `rewriteContent` must handle user-added content that uses tool-specific paths.
- Copilot reverse from markdown links is the trickiest case -- `[name](path)` back to `@path`.
- Losslessness test: `reverseRewrite(rewriteContent(canonical))` should equal `canonical` for all fixture files.
- If lossless reverse is not achievable for some content, document the limitation clearly.

## Files to Create/Modify
- `src/domain/models/tool-spec.ts` -- replace reverseRewriteContent/reverseConvertFrontmatter stubs
- `src/domain/tool-specs/claude.ts` -- Claude reverse implementation
- `src/domain/tool-specs/cursor.ts` -- Cursor reverse implementation
- `src/domain/tool-specs/copilot.ts` -- Copilot reverse implementation
- `tests/domain/models/tool-spec.test.ts` -- reverse operation tests
- `tests/domain/tool-specs/reverse-roundtrip.test.ts` -- round-trip losslessness tests

## Tests
- Claude reverse rewrite: tool paths -> canonical
- Cursor reverse rewrite: tool paths -> canonical
- Copilot reverse rewrite: markdown links -> canonical
- Claude reverse frontmatter: paths -> canonical
- Cursor reverse frontmatter: globs/alwaysApply -> canonical
- Copilot reverse frontmatter: applyTo -> canonical
- Round-trip losslessness for all fixture content files
- Cross-tool: Claude -> canonical -> Cursor produces correct output

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
