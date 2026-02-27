---
id: 053
milestone: M5
title: "Copilot flattening, VS Code merge, and npm packaging"
stories: [US-012]
points: 3
blockedBy: [052]
---

# 053: Copilot flattening, VS Code merge, and npm packaging

## Context
Copilot has specific requirements: commands and rules must be flattened to a single directory level with auto-prefix on name collisions. VS Code `settings.json` must be deep-merged to preserve user content. The CLI also needs proper npm packaging for distribution.

## Scope
Polish Copilot-specific handling (flattening, VS Code merge) and prepare npm packaging (bin entry, README, publish config).

## Acceptance Criteria
- [ ] Copilot commands flattened: files from different phase subdirectories -> single directory level
- [ ] Copilot rules flattened: files from different category subdirectories -> single directory level
- [ ] Name collision auto-prefix: when two files have the same name, prefix with phase/category (e.g., `04-implement.prompt.md`)
- [ ] Collision warning emitted in output
- [ ] VS Code `settings.json` deep merge: existing `.vscode/settings.json` user keys preserved
- [ ] VS Code merge: AIDD-specific keys added/updated
- [ ] VS Code merge: conflicting keys emit a warning
- [ ] `npx aidd --help` shows all commands with descriptions
- [ ] `npx aidd --version` shows the CLI version from package.json
- [ ] package.json has correct `bin`, `files`, `main`, `types` fields for npm publishing
- [ ] MVP feature-complete: all 19 Must/Should stories verified across tickets 001-053

## Technical Notes
- **UX Copy source of truth**: ALL user-facing text MUST use exact copy from `aidd_docs/memory/internal/ux_copy.md`. Use keys: `warn.copilot.name_collision`, `warn.vscode.merge_conflict`, `help.program.description`.
- Copilot flattening is handled by ToolSpec.shouldFlatten() and ToolSpec.buildFilePath() from ticket 013.
- This ticket verifies the integration end-to-end, not just unit level.
- VS Code merge uses FileSystemAdapter.mergeJsonFile() from ticket 024.
- Collision detection: collect all output file names, detect duplicates, apply prefix.
- npm packaging: `"bin": {"aidd": "dist/cli.js"}`, `"files": ["dist"]`.

## Files to Create/Modify
- `src/domain/tool-specs/copilot.ts` -- verify/fix flattening integration
- `src/infrastructure/adapters/file-system-adapter.ts` -- verify/fix mergeJsonFile for VS Code
- `package.json` -- npm publish config (bin, files, main, types, repository)
- `tests/integration/copilot-flattening.test.ts` -- end-to-end flattening tests
- `tests/integration/vscode-merge.test.ts` -- VS Code merge tests
- `tests/e2e/mvp-verification.e2e.test.ts` -- MVP completeness verification

## Tests
- Copilot flattening produces flat directory structure
- Name collision detected and auto-prefixed
- Collision warning in output
- VS Code merge preserves user keys
- VS Code merge adds AIDD keys
- Conflicting key warning
- npx aidd --help shows all commands
- npx aidd --version shows version
- MVP verification: all 19 Must/Should story scenarios pass

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
