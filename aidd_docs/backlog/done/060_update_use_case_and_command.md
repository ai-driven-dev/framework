---
id: 060
milestone: M6
title: "Implement UpdateUseCase and update command"
stories: [US-019]
points: 5
blockedBy: [053]
---

# 060: Implement UpdateUseCase and update command

## Context
The update command downloads the latest framework version and applies diffs to all installed tools. It computes added, removed, changed, and unchanged files, then writes new/changed files and deletes removed files. This ticket handles the case without user-modified files (conflict handling is ticket 061).

## Scope
Implement UpdateUseCase with basic update logic (no conflict prompting -- that's 061). Implement the update command.

## Acceptance Criteria
- [ ] `aidd update` downloads latest framework and generates new distributions for all installed tools
- [ ] Computes diff per tool: added files (in new, not in manifest), removed files (in manifest, not in new), changed files (hash differs), unchanged files (hash matches)
- [ ] Writes added and changed files
- [ ] Deletes removed files
- [ ] Updates manifest with new hashes and version
- [ ] "Already up to date (v3.1.0)" when current version matches latest
- [ ] No manifest exists: fails with "No AIDD installation found. Run aidd init first."
- [ ] Docs are NOT updated by the update command (only tool distributions)
- [ ] Success output: summary of added/removed/changed/unchanged counts per tool

## Technical Notes
- **UX Copy source of truth**: ALL user-facing text MUST use exact copy from `aidd_docs/memory/internal/ux_copy.md`. Use keys: `error.update.*`, `success.update`, `success.update.up_to_date`, `progress.update.*`, `warn.update.version_mismatch`, `help.update.description`, `help.opt.force.update`.
- **User flows reference**: Consult `aidd_docs/memory/internal/user_flows.md` section 2.8 for update flow state table and recovery paths.
- UpdateUseCase: load manifest -> resolve latest framework -> load descriptor -> for each installed tool: generate new distribution -> diff against manifest -> write/delete -> update manifest.
- The diff logic compares manifest file hashes against newly generated file hashes.
- This ticket does NOT handle user-modified files (disk hash != manifest hash). That's ticket 061.
- For now, if a user has modified a file and the framework also changed it, the framework version wins (no prompting).

## Files to Create/Modify
- `src/application/use-cases/update-use-case.ts` -- UpdateUseCase
- `src/presentation/commands/update.ts` -- commander registration with `--force` flag
- `tests/application/use-cases/update-use-case.test.ts` -- unit tests
- `tests/presentation/commands/update.test.ts` -- command tests

## Tests
- Update with new version: files added/removed/changed correctly
- Already up to date: skip message
- No manifest: error
- Manifest updated with new version and hashes
- Diff computation correct for all file categories

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
