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
The sync command needs to reverse-rewrite tool-specific content back to canonical format before forward-rewriting it to another tool. These reverse operations are NOT yet implemented — deferred to this milestone (M7).

**To implement:**
- Base class `reverseRewriteContent()`: reverses `@.tool/path` → `@{{TOOLS}}/path` and `docsDir/` → `{{DOCS}}/`
- `CopilotToolSpec.reverseRewriteContent()`: reverses markdown links `[label](.github/path)` → `@{{TOOLS}}/path`
- `reverseConvertFrontmatter()` for all 3 tools: Claude (passthrough), Cursor (globs/alwaysApply → paths), Copilot (applyTo → paths)

**Known lossiness to address:**
- Claude commands reversal is lossy: `@.claude/commands/aidd/04/implement.md` cannot be reversed to `@{{TOOLS}}/commands/04_code/implement.md` because the subdirectory label (`04_code`) is discarded by the forward rewrite. Only the phase number is preserved.
- Copilot flattened path reversal is also lossy: `[file.md](.github/prompts/04-implement.prompt.md)` cannot be reversed to the original `@{{TOOLS}}/commands/04_code/implement.md`.

## Scope
Complete the remaining reverse operation work needed for sync: lossless round-trip validation, cross-tool propagation tests, and resolution of the known lossy cases (feasibility spike).

## Acceptance Criteria
- [ ] `reverseRewriteContent(content, docsDir)` implemented in base class for Claude/Cursor (@ include tools)
- [ ] `reverseRewriteContent` overridden in CopilotToolSpec for markdown link → @ conversion
- [ ] `reverseConvertFrontmatter` implemented for all 3 tools (Claude passthrough, Cursor globs→paths, Copilot applyTo→paths)
- [ ] Round-trip: `rewriteContent(reverseRewriteContent(content))` produces equivalent output for all fixture files — Claude (non-command content), Cursor, and Copilot
- [ ] Cross-tool: `forwardRewrite(reverseRewrite(content, sourceTool), targetTool)` produces correct target tool content
- [ ] Claude commands lossy reversal: explicit decision — either document as out-of-scope for sync, or implement a lossless path mapping registry
- [ ] Copilot flattened paths lossy reversal: same decision point
- [ ] Reverse rewrite is lossless for all non-lossy content types in the framework fixture
- [ ] If lossless is not achievable for some cases, they are explicitly documented and excluded from sync scope

## Technical Notes
- `reverseRewriteContent` and `reverseConvertFrontmatter` do NOT exist in the codebase — they were removed as YAGNI in M1 refactor pass 2. This ticket must CREATE them from scratch (not "complete" existing stubs).
- Start with `reverseRewriteContent` base class: reverse `@{directory}path` → `@{{TOOLS}}/path` and `{docsDir}/` → `{{DOCS}}/`.
- Copilot override: reverse `[label](.github/path)` → `@{{TOOLS}}/path` and `[label](docsDir/path)` → `@{{DOCS}}/path`.
- The lossy cases (Claude commands `04_code/` label, Copilot flattened paths) are the spike from milestones.md ("Reverse-rewrite feasibility, 2 days"). If lossless is not achievable, sync scope is limited to non-command, non-rule content (memory bank, agents only).
- Files to NOT sync (excluded regardless): memory bank, MCP config, VS Code files, docs.

## Files to Create/Modify
- `src/domain/models/tool-spec.ts` -- add `reverseRewriteContent`, `reverseConvertFrontmatter`, `reversePaths` abstract
- `src/domain/tool-specs/claude.ts` -- `reversePaths` (passthrough) + command path reversal (if feasible)
- `src/domain/tool-specs/cursor.ts` -- `reversePaths` (globs → paths)
- `src/domain/tool-specs/copilot.ts` -- `reversePaths` (applyTo → paths) + `reverseRewriteContent` override
- `tests/domain/tool-specs/reverse-roundtrip.test.ts` -- round-trip losslessness tests (new file)
- Update existing tool-spec tests as needed

## Tests
- Round-trip: forward → reverse → forward produces idempotent output (per tool)
- Cross-tool: Claude → canonical → Cursor produces correct Cursor content
- Claude agents round-trip lossless
- Cursor agents round-trip lossless
- Copilot agents round-trip lossless (non-flattened)
- Claude command reversal: explicit test for lossy case with documented behavior

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
