---
id: 072
milestone: M7
title: "Sync conflict detection and E2E tests"
stories: [US-024]
points: 3
blockedBy: [071]
---

# 072: Sync conflict detection and E2E tests

## Context
When syncing, the target tool may also have user modifications. If the source change would overwrite a target modification, that's a conflict. The CLI must detect these and report them for manual resolution (or force-apply with `--force`).

## Scope
Add conflict detection to SyncUseCase and write comprehensive E2E tests for the entire sync flow.

## Acceptance Criteria
- [ ] Conflict detected: target tool file has been modified (disk hash != manifest hash) AND source change would overwrite it
- [ ] Conflict reported: lists conflicting files for manual resolution
- [ ] Conflicting files are NOT overwritten (without `--force`)
- [ ] `--force` applies all changes including conflicts without prompting
- [ ] No conflicts: all changes propagate silently
- [ ] E2E: install claude + cursor -> modify claude file -> sync -> cursor file updated
- [ ] E2E: install claude + cursor -> modify same file in both -> sync -> conflict reported
- [ ] E2E: install claude + cursor + copilot -> sync --source claude --target cursor -> only cursor updated
- [ ] E2E: sync with --force overwrites conflicts
- [ ] E2E: sync with excluded files verifies they are not propagated

## Technical Notes
- **UX Copy source of truth**: ALL user-facing text MUST use exact copy from `aidd_docs/memory/internal/ux_copy.md`. Use keys: `prompt.sync.*` (conflict_detected, choice, option_source, option_target, option_skip, summary).
- Conflict detection: for each target file that would be overwritten, check if target disk hash != target manifest hash. If so, it's a conflict.
- ConflictSet from the domain can be reused here (same classification logic as update).
- Interactive prompting (via Prompter port) could be added here, but for v3.1 initial release, report-only + `--force` is simpler.

## Files to Create/Modify
- `src/application/use-cases/sync-use-case.ts` -- add conflict detection
- `tests/application/use-cases/sync-use-case.test.ts` -- conflict tests
- `tests/e2e/sync.e2e.test.ts` -- comprehensive E2E tests
- `tests/e2e/sync-conflict.e2e.test.ts` -- conflict-specific E2E tests

## Tests
- Conflict detected when target has modifications
- Conflict reported with file paths
- Conflicting files not overwritten
- Force sync overwrites conflicts
- No conflicts: clean propagation
- E2E: full sync flow with multiple tools
- E2E: sync with target filter
- E2E: excluded files not propagated
- E2E: force sync with conflicts

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
