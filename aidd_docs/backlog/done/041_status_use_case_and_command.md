---
id: 041
milestone: M4
title: "Implement StatusUseCase and status command"
stories: [US-014]
points: 5
blockedBy: [040]
---

# 041: Implement StatusUseCase and status command

## Context
The status command shows file drift from the installed framework version. It reads disk hashes, compares with manifest hashes via `Manifest.computeStatus()`, and optionally checks for available framework updates.

## Scope
Implement StatusUseCase and the status command with drift detection and version check.

## Acceptance Criteria
- [ ] `aidd status` shows file drift per tool and docs: modified, deleted, and added files
- [ ] All files in sync: reports "All files are in sync" with installed versions
- [ ] Modified file: hash mismatch between manifest and disk -> appears in modified list
- [ ] Deleted file: in manifest but not on disk -> appears in deleted list
- [ ] Added file: on disk in tool directory but not in manifest -> appears in added list
- [ ] Docs drift: modified docs files shown in a separate "docs" group
- [ ] No manifest exists: fails with "No AIDD installation found. Run aidd init first."
- [ ] Manifest exists but no tools installed: reports "No tools installed. Run `aidd install <tool>` to get started." (empty.status.no_tools from ux_copy.md)
- [ ] Version check: displays "Update available: v3.0.0 -> v3.1.0" when newer version exists
- [ ] Version check with network failure: silent fallback (no version info shown)
- [ ] Output format: clear table or list grouping changes by tool

## Technical Notes
- **UX Copy source of truth**: ALL user-facing text MUST use exact copy from `aidd_docs/memory/internal/ux_copy.md`. Use keys: `error.status.*`, `success.status.in_sync`, `status.header.*`, `status.category.*`, `status.summary`, `status.update_available`, `empty.status.no_tools`, `help.status.description`, `help.opt.tool`.
- **User flows reference**: Consult `aidd_docs/memory/internal/user_flows.md` section 2.5 for status flow state table and recovery paths.
- StatusUseCase: load manifest -> readFileHash for all tracked files via FileSystem -> Manifest.computeStatus(diskHashes) -> optionally call FrameworkResolver.getLatestVersion() -> return StatusReport + version info.
- Version check is optional and uses silent fallback on network failure.
- The StatusReport value object from the domain is used directly.
- Untracked files: detect by scanning tool directories and comparing with manifest entries.

## Files to Create/Modify
- `src/application/use-cases/status-use-case.ts` -- StatusUseCase
- `src/presentation/commands/status.ts` -- commander registration
- `tests/application/use-cases/status-use-case.test.ts` -- unit tests
- `tests/presentation/commands/status.test.ts` -- command tests

## Tests
- All in sync: reports clean state
- Modified file detected
- Deleted file detected
- Added (untracked) file detected
- Mixed scenario: modified + deleted + added
- Docs drift shown separately
- No manifest: error
- No tools installed (empty manifest): empty state message
- Version check shows update available
- Version check silent on network failure

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
