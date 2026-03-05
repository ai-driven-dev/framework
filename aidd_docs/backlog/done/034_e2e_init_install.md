---
id: 034
milestone: M3
title: "E2E tests for init and install flow"
stories: [US-006, US-007, US-008, US-010]
points: 0
blockedBy: [033]
---

# 034: E2E tests for init and install flow

## Context
End-to-end tests verify the complete flow from CLI invocation through to filesystem state. These tests use a real framework fixture and verify actual file content, not just mock interactions.

## Scope
Write E2E tests that exercise: init -> install -> verify file content -> verify manifest state. Use a local framework fixture to avoid network dependency.

## Acceptance Criteria
- [ ] E2E test: `aidd init` creates docs directory and manifest from fixture framework
- [ ] E2E test: `aidd init --docs-dir custom` uses custom name
- [ ] E2E test: `aidd init` on existing docs dir fails
- [ ] E2E test: `aidd install claude --framework <fixture>` generates Claude files with correct content
- [ ] E2E test: `aidd install cursor --framework <fixture>` generates Cursor files
- [ ] E2E test: `aidd install copilot --framework <fixture>` generates Copilot files with flattening
- [ ] E2E test: `aidd install claude cursor copilot --framework <fixture>` generates all three
- [ ] E2E test: auto-init triggers when running install without prior init
- [ ] E2E test: install already-installed tool without --force reports message
- [ ] All E2E tests use temp directories and clean up after themselves
- [ ] E2E tests verify: file content (placeholders replaced), frontmatter format, manifest entries and hashes
- [ ] NFR1: `aidd init` and `aidd install` complete in < 5 seconds with local framework fixture (~100 files)
- [ ] NFR6: No network requests made when using `--framework` local source (verify no HTTP calls)
- [ ] NFR9: Tests pass on macOS, Linux, and WSL (no platform-specific path assumptions, use `path.join` not string concatenation)

## Technical Notes
- Use the framework.json fixture from `tests/fixtures/`.
- E2E tests should invoke the CLI entry point programmatically or via child_process.
- Use `os.tmpdir()` for isolated test directories.
- Each test creates a fresh temp directory, runs the CLI, and verifies filesystem state.
- Hash verification: compute MD5 of generated file content and compare with manifest entry.

## Files to Create/Modify
- `tests/e2e/init.e2e.test.ts` -- init E2E tests
- `tests/e2e/install.e2e.test.ts` -- install E2E tests
- `tests/e2e/init-install-flow.e2e.test.ts` -- combined flow test

## Tests
- Complete init -> install -> verify flow
- Init with default and custom docs dir
- Install single tool, multiple tools
- Auto-init on install
- File content verification (placeholder replacement)
- Frontmatter verification per tool
- Manifest state verification

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
