---
id: 063
milestone: M6
title: "E2E tests for update and restore flow"
stories: [US-019, US-020, US-021]
points: 0
blockedBy: [062]
---

# 063: E2E tests for update and restore flow

## Context
End-to-end tests for the update and restore commands. These need two framework fixture versions to test version transitions.

## Scope
Create a second framework fixture version and write E2E tests for update and restore flows.

## Acceptance Criteria
- [ ] Two framework fixture versions exist: v1.0.0 (base) and v2.0.0 (with added/removed/changed files)
- [ ] E2E: init -> install at v1 -> update to v2 -> verify new files added, old files removed, changed files updated
- [ ] E2E: init -> install at v1 -> modify file -> update to v2 -> verify conflict detection
- [ ] E2E: init -> install at v1 -> update to v2 with --force -> all files overwritten
- [ ] E2E: init -> install -> "already up to date"
- [ ] E2E: init -> install -> modify file -> restore -> file matches original
- [ ] E2E: init -> install -> delete file -> restore -> file recreated
- [ ] E2E: init -> install -> restore with nothing to restore -> "Nothing to restore"
- [ ] All tests use local framework fixtures (no network)
- [ ] All tests use temp directories
- [ ] NFR1: Restore operations complete in < 5 seconds with local cached framework
- [ ] NFR2: Remote framework download completes in < 30 seconds (tested with mock HTTP server or timeout assertion)
- [ ] NFR9: Tests pass on macOS, Linux, and WSL

## Technical Notes
- Create `tests/fixtures/framework-v2/` with a second version of the framework that has:
  - One new file (added)
  - One removed file (deleted from v1)
  - One changed file (different content from v1)
  - Several unchanged files
- Framework fixture versions should have matching framework.json with different version fields.
- Tests can use SilentPrompterAdapter to simulate user choices in non-interactive mode.

## Files to Create/Modify
- `tests/fixtures/framework-v2/framework.json` -- second version fixture
- `tests/fixtures/framework-v2/content/` -- v2 content files
- `tests/e2e/update.e2e.test.ts` -- update E2E tests
- `tests/e2e/restore.e2e.test.ts` -- restore E2E tests

## Tests
- Full update flow: v1 -> v2 with file diff verification
- Update with user modifications and conflict
- Update with --force
- Already up to date
- Restore modified file
- Restore deleted file
- Nothing to restore

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
