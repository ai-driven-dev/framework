---
id: 064
milestone: M6
title: "Add --dry-run flag to aidd update"
stories: [US-019]
points: 2
blockedBy: [060]
---

# 064: Add --dry-run flag to aidd update

## Context

`aidd clean` defaults to dry-run (requires `--force` to execute). `aidd update` (ticket 060) defaults to executing immediately. This inconsistency violates the CLI's own safety convention: destructive operations that write/delete files should be previewable before execution.

This ticket adds `--dry-run` to `aidd update` so users can see exactly what would be added, changed, and removed per tool before committing to the changes.

## Scope

Add `--dry-run` flag to `UpdateUseCase` and the update command. In dry-run mode: compute the full diff, print the preview, exit 0 without writing or deleting any files.

## Acceptance Criteria

- [ ] `aidd update --dry-run` computes the full diff per installed tool and prints a preview
- [ ] Preview shows: added files, changed files, removed files grouped by tool
- [ ] Preview ends with a summary line: total counts across all tools
- [ ] No files are written or deleted in dry-run mode
- [ ] Manifest is NOT updated in dry-run mode
- [ ] `--dry-run` combined with `--force` is rejected: `--dry-run and --force are mutually exclusive`
- [ ] "Already up to date" path: dry-run exits early with up-to-date message (no diff to show)
- [ ] Conflict detection still runs in dry-run: user-modified files are flagged in the preview

## Technical Notes

- **UX Copy source of truth**: use keys `update.preview.*` (section to be added to `ux_copy.md`).
- `UpdateUseCase.execute()` receives `dryRun: boolean`. When true: skip all `fs.writeFile` and `fs.deleteFile` calls. Return the diff result for the command to format.
- Preview format mirrors `aidd clean` dry-run pattern (section header + per-file lines + summary).
- Conflict detection in dry-run: mark user-modified files as `[conflict]` in the preview. No prompting occurs in dry-run mode — conflicts are informational only.
- `--dry-run` is incompatible with `--force`: both flags set simultaneously should throw early in the command before calling the use case.

## Files to Create/Modify

- `src/application/use-cases/update-use-case.ts` — add `dryRun: boolean` to options, gate all writes/deletes behind it
- `src/application/commands/update.ts` — add `--dry-run` flag, mutual-exclusion check with `--force`, pass to use case
- `tests/application/use-cases/update-use-case.test.ts` — add dry-run scenarios
- `tests/e2e/update.e2e.test.ts` — add dry-run E2E scenario

## Tests

- Dry-run: prints preview with correct added/changed/removed counts per tool
- Dry-run: no files written after execution (verify disk state unchanged)
- Dry-run: manifest unchanged after execution
- Dry-run with user-modified files: conflicts flagged in preview, no prompt
- Dry-run + force: error `--dry-run and --force are mutually exclusive`
- Dry-run with up-to-date version: up-to-date message, no diff output

## Done When

- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
