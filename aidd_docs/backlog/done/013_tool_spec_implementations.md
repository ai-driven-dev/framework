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
- [ ] **Claude ToolSpec:**
  - directory: `.claude/`
  - Frontmatter scope: `paths:` list
  - Include syntax: `@.claude/path` format
  - Memory bank: `CLAUDE.md`
  - MCP config: `.mcp.json`
  - shouldFlatten: false for all sections
- [ ] **Cursor ToolSpec:**
  - directory: `.cursor/`
  - Frontmatter scope: `globs:` list + `alwaysApply:` boolean
  - Include syntax: `@.cursor/path` format
  - Memory bank: `AGENTS.md` (root)
  - MCP config: `.cursor/mcp.json`
  - Rules use `.mdc` extension (not `.md`)
  - shouldFlatten: false for all sections
- [ ] **Copilot ToolSpec:**
  - directory: `.github/`
  - Frontmatter scope: `applyTo:` field
  - Include syntax: markdown link format `[name](path)`
  - agents → `.github/agents/*.agent.md`
  - commands → `.github/prompts/*.prompt.md`
  - rules → `.github/instructions/*.instructions.md`
  - skills → `.github/skills/*/SKILL.md`
  - shouldFlatten: true for commands and rules
  - Collision auto-prefix logic works (e.g., `04-implement.prompt.md`)
- [ ] `rewriteContent` produces correct output for each tool given the same input
- [ ] `convertFrontmatter` produces correct output for each tool
- [ ] `buildFilePath` produces correct paths for each tool and content section
- [ ] Copilot `shouldFlatten()` returns true for commands and rules, false for others
- [ ] All three specs tested against the framework.json fixture content

## Technical Notes
- Claude: agents in `.claude/agents/`, commands in `.claude/commands/`, rules in `.claude/rules/`, skills in `.claude/skills/`.
- Cursor: rules in `.cursor/rules/` with `.mdc` extension, other sections use `.cursor/<section>/` directory.
- Copilot: agents in `.github/agents/`, commands in `.github/prompts/`, rules in `.github/instructions/`, skills in `.github/skills/`; file flattening applied to commands/rules.
- Copilot collision auto-prefix: when two files have the same name after flattening, prefix with phase number or category.

## Files to Create/Modify
- `src/domain/tool-specs/claude.ts` -- Claude ToolSpec factory/data
- `src/domain/tool-specs/cursor.ts` -- Cursor ToolSpec factory/data
- `src/domain/tool-specs/copilot.ts` -- Copilot ToolSpec factory/data
- `tests/domain/tool-specs/claude.test.ts` -- Claude-specific tests
- `tests/domain/tool-specs/cursor.test.ts` -- Cursor-specific tests
- `tests/domain/tool-specs/copilot.test.ts` -- Copilot-specific tests (including flattening)

## Tests
- Claude rewriteContent replaces placeholders with `.claude/` and docs paths
- Cursor rewriteContent replaces placeholders with `.cursor/` and docs paths
- Copilot rewriteContent replaces placeholders with `.github/` and markdown links
- Claude frontmatter uses `paths:` list
- Cursor frontmatter uses `globs:` + `alwaysApply:`
- Copilot frontmatter uses `applyTo:`
- Copilot shouldFlatten returns true for commands, true for rules
- Copilot collision auto-prefix when two files share the same name

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
