---
id: 013
milestone: M1
title: "Implement tool-specific ToolSpec data (Claude, Cursor, Copilot)"
stories: []
points: 0
blockedBy: [012]
---

# 013: Implement tool-specific ToolSpec data (Claude, Cursor, Copilot)

## Context
Each supported AI tool has distinct conventions for directory layout, frontmatter format, include syntax, and flattening behavior. These are encoded as ToolSpec instances with tool-specific configuration and method overrides.

## Scope
Create the three ToolSpec implementations (Claude, Cursor, Copilot) with their specific conventions. Test each against the framework.json fixture.

## Acceptance Criteria
- [x] **Claude ToolSpec:**
  - directory: `.claude/`
  - Frontmatter scope: `paths:` list (unchanged, passed through)
  - Include syntax: `@.claude/path` format
  - Memory bank: `CLAUDE.md` (root) via `getMemoryBankOutputPath("agentsMd")`
  - MCP config output: `.mcp.json`
  - Commands land in `.claude/commands/aidd/{phase}/` (aidd brand prefix, phase number only)
  - `rewriteContent` rewrites `@{{TOOLS}}/commands/{phase_dir}/` → `@.claude/commands/aidd/{phase}/`
- [x] **Cursor ToolSpec:**
  - directory: `.cursor/`
  - Frontmatter scope: `globs:` list + `alwaysApply: false`
  - Include syntax: `@.cursor/path` format
  - Memory bank: `AGENTS.md` (root) via `getMemoryBankOutputPath("agentsMd")`
  - MCP config output: `.cursor/mcp.json`
  - Rules use `.mdc` extension (not `.md`)
- [x] **Copilot ToolSpec:**
  - directory: `.github/`
  - Frontmatter scope: `applyTo:` field (first entry of `paths:`, or `**` if absent/empty)
  - Include syntax: markdown link format `[filename](path)` (not `@`)
  - Memory bank: `.github/copilot-instructions.md` via `getMemoryBankOutputPath("agentsMd")`
  - agents → `.github/agents/*.agent.md`
  - commands → `.github/prompts/*.prompt.md` (flattened via `buildFilePath`)
  - rules → `.github/instructions/*.instructions.md` (flattened via `buildFilePath`)
  - skills → `.github/skills/*/SKILL.md` (not flattened)
  - Flattening auto-prefix: leading numeric prefix extracted (e.g., `04_code/implement.md` → `04-implement.prompt.md`)
- [x] `rewriteContent` produces correct output for each tool given the same input
- [x] `convertFrontmatter` produces correct output for each tool
- [x] `buildFilePath` produces correct paths for each tool and content section
- [x] Copilot `buildFilePath()` flattens commands and rules to single directory level
- [x] All three specs tested against the framework.json fixture content

## Technical Notes
- Claude: agents in `.claude/agents/`, commands in `.claude/commands/aidd/{phase}/`, rules in `.claude/rules/`, skills in `.claude/skills/`.
- Cursor: rules in `.cursor/rules/` with `.mdc` extension, other sections use `.cursor/<section>/` directory.
- Copilot: agents in `.github/agents/`, commands in `.github/prompts/`, rules in `.github/instructions/`, skills in `.github/skills/`; flattening applied to commands/rules.
- Copilot multi-paths: `convertFrontmatter` takes only `paths[0]` for `applyTo` — multiple paths are lossy by design (Copilot supports a single glob per file).
- Copilot collision detection (distinct subdirs producing same flattened name): NOT implemented here. Current `buildFilePath` always prefixes with leading numeric segment, preventing most collisions but not all (e.g., two files with same name in same phase). Full collision detection with warning is M5 scope (ticket 053).
- `getConfigOutputPath(configName: string)` takes a single parameter — `sourcePath` was removed as YAGNI (never used by any implementation).
- Reverse operations (`reverseRewriteContent`, `reverseConvertFrontmatter`) are NOT implemented for any tool — deferred to M7 (ticket 070).

## Files to Create/Modify
- `src/domain/tool-specs/claude.ts` -- Claude ToolSpec
- `src/domain/tool-specs/cursor.ts` -- Cursor ToolSpec
- `src/domain/tool-specs/copilot.ts` -- Copilot ToolSpec
- `tests/domain/tool-specs/claude.test.ts` -- Claude-specific tests
- `tests/domain/tool-specs/cursor.test.ts` -- Cursor-specific tests
- `tests/domain/tool-specs/copilot.test.ts` -- Copilot-specific tests (including flattening and reversal)

## Tests
- Claude rewriteContent replaces placeholders with `.claude/` and docs paths
- Claude rewriteContent rewrites @{{TOOLS}}/commands/ to @.claude/commands/aidd/{phase}/
- Cursor rewriteContent replaces placeholders with `.cursor/` and docs paths
- Copilot rewriteContent replaces @{{TOOLS}}/ and @{{DOCS}}/ with markdown links
- Claude frontmatter uses `paths:` list (passthrough)
- Cursor frontmatter uses `globs:` + `alwaysApply:`
- Copilot frontmatter uses `applyTo:`
- Copilot buildFilePath flattens commands and rules to single directory level
- getMemoryBankOutputPath returns correct path per tool for `agentsMd`

## Done When
- [x] All acceptance criteria checked
- [x] All tests pass (`pnpm test`)
- [x] Type check passes (`pnpm typecheck`)
- [x] Lint passes (`pnpm lint`)
