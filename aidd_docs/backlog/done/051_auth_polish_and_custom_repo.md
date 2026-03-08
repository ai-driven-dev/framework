---
id: 051
milestone: M5
title: "Polish auth token handling and custom repository support"
stories: [US-005, US-026]
points: 4
blockedBy: [050]
---

# 051: Polish auth token handling and custom repository support

## Context
Auth token resolution edge cases need polish (timeout handling, priority order verification, graceful no-token behavior). Custom repository support (`--repo` flag, `AIDD_REPO` env var, settings file) must be fully integrated.

## Scope
Harden token resolution, add `--repo` support across all commands that resolve frameworks, and validate repository format.

## Acceptance Criteria
- [ ] Token priority verified end-to-end: `--token` flag > `AIDD_TOKEN` env > `gh auth token` > none
- [ ] `gh auth token` timeout (3s) handled gracefully -- proceed with no token
- [ ] `gh auth token` not installed: proceed with no token
- [ ] Verbose mode logs which auth method was used
- [ ] `--repo my-org/my-framework` downloads from custom repository
- [ ] `AIDD_REPO=my-org/my-framework` as env var override
- [ ] `.aidd/settings.json` with `"repo": "my-org/my-framework"` as project default
- [ ] Repository resolution priority: `--repo` flag > `AIDD_REPO` env > settings file > default (`ai-driven-dev/aidd-framework`)
- [ ] Invalid repo format (not `owner/repo`): fails with "Invalid repository format. Expected: owner/repo"
- [ ] Custom repo works for: init, install, status version check

## Technical Notes
- **UX Copy source of truth**: ALL user-facing text MUST use exact copy from `aidd_docs/memory/internal/ux_copy.md`. Use keys: `error.auth.failed`, `error.repo.invalid_format`, `help.opt.repo`, `help.opt.token`.
- Token is already implemented in 022. This ticket is about edge case hardening and integration testing.
- Repo validation: simple regex `^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$`.
- The `--repo` flag is global (applies to all commands that resolve frameworks).
- Status version check uses getLatestVersion() which also needs the repo setting.

## Files to Create/Modify
- `src/infrastructure/auth/token-resolver.ts` -- edge case hardening
- `src/cli.ts` -- add `--repo` as global option
- `src/presentation/commands/init.ts` -- pass repo option
- `src/presentation/commands/install.ts` -- pass repo option
- `src/presentation/commands/status.ts` -- pass repo for version check
- `tests/integration/auth-flow.test.ts` -- end-to-end auth tests
- `tests/integration/custom-repo.test.ts` -- custom repo tests

## Tests
- Token priority: flag > env > gh > none
- gh auth token timeout: graceful fallback
- gh auth token not found: graceful fallback
- Custom repo via flag
- Custom repo via env var
- Custom repo via settings file
- Invalid repo format rejected
- Repo priority: flag > env > settings > default

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
