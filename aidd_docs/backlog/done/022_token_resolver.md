---
id: 022
milestone: M2
title: "Implement TokenResolver (flag > env > gh auth token)"
stories: [US-005]
points: 2
blockedBy: [020]
---

# 022: Implement TokenResolver (flag > env > gh auth token)

## Context
Authentication is needed for private GitHub repositories. The token resolution follows a priority chain: CLI flag > environment variable > `gh auth token` output. The `gh` CLI fallback has a 3-second timeout to avoid hanging.

## Scope
Implement TokenResolver with the three-level resolution chain and timeout handling.

## Acceptance Criteria
- [ ] Resolution priority: `--token` flag > `AIDD_TOKEN` env var > `gh auth token` output > no token
- [ ] When `--token` is provided, use it directly (no subprocess call)
- [ ] When `AIDD_TOKEN` env var is set, use it (no subprocess call)
- [ ] When neither flag nor env var: call `gh auth token` via child_process
- [ ] `gh auth token` has a 3-second timeout; if it hangs, proceed with no token
- [ ] `gh auth token` failure (not installed, not logged in) is handled gracefully -- proceed with no token
- [ ] Token is never logged, cached to disk, or displayed in output
- [ ] Token is never written to settings file (ADR-008 security constraint)
- [ ] Verbose mode logs which resolution method was used (without revealing the token value)

## Technical Notes
- ADR-008: Token is excluded from `.aidd/settings.json`. Security constraint.
- `gh auth token` timeout: use `child_process.execSync` with `timeout: 3000`.
- The token is passed to HttpClient as an auth header. The resolver just determines the value.
- Verbose log examples: "Token resolved from --token flag", "Token resolved from AIDD_TOKEN env", "Token resolved from gh auth token", "No token available".

## Files to Create/Modify
- `src/infrastructure/auth/token-resolver.ts` -- token resolution chain
- `tests/infrastructure/auth/token-resolver.test.ts` -- tests for each resolution path

## Tests
- Resolves from flag when provided
- Resolves from env var when no flag
- Resolves from gh auth token when no flag and no env var
- gh auth token timeout returns null
- gh auth token failure returns null
- Flag takes priority over env var
- Env var takes priority over gh auth token
- Returns null when no source available

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
