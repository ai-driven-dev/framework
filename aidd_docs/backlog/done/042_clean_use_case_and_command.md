---
id: 042
milestone: M4
title: "Implement CleanUseCase and clean command"
stories: [US-016]
points: 3
blockedBy: [041]
---

# 042: Implement CleanUseCase and clean command

## Context
The clean command removes all AIDD traces from a project -- tool files, docs, and the manifest. It supports a dry-run mode (default) and a `--force` flag for actual deletion.

## Scope
Implement CleanUseCase and the clean command with dry-run and force modes.

## Acceptance Criteria
- [ ] `aidd clean` without `--force`: displays summary of what would be removed, then exits with "Use --force to confirm removal"
- [ ] `aidd clean --force`: deletes all manifest-tracked files, docs, and `.aidd/` directory
- [ ] Only manifest-tracked files are deleted -- untracked user files in tool directories are preserved
- [ ] Empty directories are cleaned up after file deletion
- [ ] No manifest exists: reports "Nothing to clean. No AIDD installation found."
- [ ] Success output: lists all removed files and directories with summary

## Technical Notes
- **UX Copy source of truth**: ALL user-facing text MUST use exact copy from `aidd_docs/memory/internal/ux_copy.md`. Use keys: `error.clean.*`, `success.clean`, `empty.clean.nothing`, `progress.clean.removing`, `clean.preview.*` (header, tool_line, docs_line, manifest_line, total, summary), `help.clean.description`, `help.opt.force.clean`.
- **User flows reference**: Consult `aidd_docs/memory/internal/user_flows.md` section 2.6 for clean flow state table and recovery paths.
- CleanUseCase: load manifest -> if no force, return dry-run summary -> for each tool: delete tracked files -> delete docs tracked files -> delete manifest directory.
- Unlike uninstall (which preserves the manifest), clean removes everything including `.aidd/`.
- Untracked user files: scan tool directories, compare with manifest, skip untracked.
- The dry-run should show exact same file list as the force would delete.

## Files to Create/Modify
- `src/application/use-cases/clean-use-case.ts` -- CleanUseCase
- `src/presentation/commands/clean.ts` -- commander registration with `--force` flag
- `tests/application/use-cases/clean-use-case.test.ts` -- unit tests
- `tests/presentation/commands/clean.test.ts` -- command tests

## Tests
- Clean without force: dry-run output matches expected deletions
- Clean with force: all tracked files and manifest deleted
- Untracked user files preserved
- Empty directories cleaned
- No manifest: reports nothing to clean
- Clean after uninstall (docs + manifest remain): cleans everything

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
