---
id: 062
milestone: M6
title: "Implement RestoreUseCase and restore command"
stories: [US-021]
points: 5
blockedBy: [061]
---

# 062: Implement RestoreUseCase and restore command

## Context
The restore command regenerates files from the pinned framework version (the version at install time, not the latest). It allows undoing accidental changes to specific files or all modified files.

## Scope
Implement RestoreUseCase and the restore command with file pattern support.

## Acceptance Criteria
- [ ] `aidd restore <tool>` restores deleted files for the tool from the pinned framework version. User-modified files are SKIPPED without `--force` (with warning: "N files are user-modified, skipping. Use --force to overwrite.")
- [ ] `aidd restore <tool> --files <pattern>` restores only files matching the pattern
- [ ] Restores from the pinned version (version in manifest), NOT the latest version
- [ ] Restoring a deleted file recreates it
- [ ] `aidd restore <tool> --force` restores ALL modified AND deleted files without prompting
- [ ] `aidd restore <tool>` when all restorable files are user-modified: reports "All restorable files are user-modified. Use --force to overwrite."
- [ ] "All files are in sync. Nothing to restore." when no drift exists
- [ ] Pinned version unavailable remotely: falls back to latest with warning "Version 3.0.0 is no longer available. Restoring from latest (3.1.0)."
- [ ] Manifest updated with new hashes after restore
- [ ] No manifest: error with guidance

## Technical Notes
- **UX Copy source of truth**: ALL user-facing text MUST use exact copy from `aidd_docs/memory/internal/ux_copy.md`. Use keys: `error.restore.*`, `success.restore`, `success.restore.in_sync`, `progress.restore.regenerating`, `warn.restore.version_unavailable`, `help.restore.description`, `help.opt.force.restore`, `help.arg.files`.
- **User flows reference**: Consult `aidd_docs/memory/internal/user_flows.md` section 2.9 for restore flow. CRITICAL behavioral detail: restore WITHOUT `--force` SKIPS user-modified files (does not prompt — prompting is only for update). Only deleted files are restored without --force. User-modified files require explicit `--force` to overwrite.
- RestoreUseCase: load manifest -> get pinned version per tool -> resolve that specific version -> regenerate distribution -> diff against disk -> overwrite modified/deleted -> update manifest.
- File pattern: glob-style matching against relative file paths.
- The pinned version comes from `ToolEntry.version` in the manifest.
- If the pinned version can't be resolved, fallback to latest (cache or remote).

## Files to Create/Modify
- `src/application/use-cases/restore-use-case.ts` -- RestoreUseCase
- `src/presentation/commands/restore.ts` -- commander registration
- `tests/application/use-cases/restore-use-case.test.ts` -- unit tests
- `tests/presentation/commands/restore.test.ts` -- command tests

## Tests
- Restore modified file from pinned version
- Restore deleted file (recreated)
- Restore with file pattern
- Nothing to restore when in sync
- Pinned version unavailable: fallback with warning
- Manifest updated after restore
- Restore without force: skips user-modified files, restores only deleted
- Restore without force when all files are user-modified: skip message
- Force restore all files (modified + deleted)
- No manifest: error

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
