---
id: 044
milestone: M4
title: "E2E tests for lifecycle commands"
stories: [US-013, US-014, US-016, US-017]
points: 0
blockedBy: [043]
---

# 044: E2E tests for lifecycle commands

## Context
End-to-end tests for the complete lifecycle: init -> install -> modify files -> status -> uninstall -> clean -> doctor. These verify real filesystem behavior across all lifecycle commands.

## Scope
Write E2E tests covering the full lifecycle flow and edge cases for each lifecycle command.

## Acceptance Criteria
- [ ] E2E: init -> install -> status shows "All in sync"
- [ ] E2E: init -> install -> modify file -> status shows drift
- [ ] E2E: init -> install claude cursor -> uninstall claude -> verify cursor untouched
- [ ] E2E: init -> install -> uninstall all -> clean -> verify project clean
- [ ] E2E: init -> install -> doctor shows healthy
- [ ] E2E: init -> install -> corrupt file -> doctor detects issue
- [ ] E2E: full lifecycle: init -> install -> modify -> status -> uninstall -> clean
- [ ] All tests use temp directories and local framework fixture
- [ ] All tests clean up after themselves
- [ ] NFR1: All lifecycle commands (status, uninstall, clean, doctor) complete in < 5 seconds with ~100 files
- [ ] NFR6: No network requests made during lifecycle commands (all are local-only operations)
- [ ] NFR9: Tests pass on macOS, Linux, and WSL (no platform-specific assumptions)

## Technical Notes
- Use the same framework fixture as M3 E2E tests.
- File modification: read file, append content, write back (simulates user edit).
- File deletion: delete a tracked file to test deleted file detection.
- Corrupt manifest: write invalid JSON to `.aidd/config.json` to test doctor.

## Files to Create/Modify
- `tests/e2e/lifecycle.e2e.test.ts` -- full lifecycle E2E tests
- `tests/e2e/uninstall.e2e.test.ts` -- uninstall-specific E2E tests
- `tests/e2e/status.e2e.test.ts` -- status-specific E2E tests
- `tests/e2e/clean.e2e.test.ts` -- clean-specific E2E tests
- `tests/e2e/doctor.e2e.test.ts` -- doctor-specific E2E tests

## Tests
- Full lifecycle flow with all commands
- Status with various drift scenarios
- Uninstall preserves other tools
- Clean dry-run vs force
- Doctor with various issue types

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
