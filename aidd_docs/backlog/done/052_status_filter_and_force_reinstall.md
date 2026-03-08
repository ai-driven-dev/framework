---
id: 052
milestone: M5
title: "Add status filtering by tool and force reinstall polish"
stories: [US-015, US-011]
points: 3
blockedBy: [051]
---

# 052: Add status filtering by tool and force reinstall polish

## Context
Status needs a `--tool` filter to focus on one tool's drift. Force reinstall (`--force`) needs full integration polish to handle edge cases like tool directory existing but not in manifest.

## Scope
Add `--tool` flag to status command. Polish `--force` behavior on install for all edge cases.

## Acceptance Criteria
- [ ] `aidd status --tool claude` shows only claude's drift (modified/deleted/added)
- [ ] `aidd status --tool claude` does not show cursor, copilot, or docs
- [ ] `--tool invalid` fails with error listing valid installed tools
- [ ] `--tool cursor` when cursor not installed: fails with "cursor is not installed"
- [ ] `aidd install claude --force` when already installed: regenerates all files, updates manifest
- [ ] `aidd install claude --force` when `.claude/` directory exists but not in manifest: overwrites with warning, records in manifest
- [ ] `aidd install claude` when already installed without `--force`: reports "claude is already installed. Use --force to reinstall."
- [ ] Force reinstall updates manifest hashes to new values

## Technical Notes
- **UX Copy source of truth**: ALL user-facing text MUST use exact copy from `aidd_docs/memory/internal/ux_copy.md`. Use keys: `error.status.*`, `error.install.already_installed`, `warn.install.dir_exists_not_in_manifest`, `help.opt.tool`, `help.opt.force.install`.
- StatusUseCase receives an optional `toolFilter` parameter. When set, computeStatus still runs on all tools but the presenter only shows the filtered tool.
- Force reinstall: InstallUseCase already handles the `force` flag from ticket 032. This ticket tests edge cases and polishes the messages.
- Tool directory exists without manifest entry: this can happen if user manually created files or if a previous clean was partial.

## Files to Create/Modify
- `src/presentation/commands/status.ts` -- add `--tool` option
- `src/application/use-cases/status-use-case.ts` -- add toolFilter parameter
- `src/application/use-cases/install-use-case.ts` -- polish force edge cases
- `tests/application/use-cases/status-use-case.test.ts` -- filter tests
- `tests/application/use-cases/install-use-case.test.ts` -- force edge case tests
- `tests/presentation/commands/status.test.ts` -- --tool flag tests

## Tests
- Status filtered by tool shows only that tool
- Status filter with invalid tool: error
- Status filter with non-installed tool: error
- Force reinstall overwrites existing installation
- Force install with orphaned directory
- No-force on existing tool: skip message

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
