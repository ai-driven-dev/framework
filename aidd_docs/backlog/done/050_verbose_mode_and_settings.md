---
id: 050
milestone: M5
title: "Implement verbose mode and settings file integration"
stories: [US-018, US-027]
points: 4
blockedBy: [044]
---

# 050: Implement verbose mode and settings file integration

## Context
Verbose mode (`--verbose`) enables diagnostic output on any command. The settings file (`.aidd/settings.json`) provides project-level defaults. These are cross-cutting concerns that affect all commands.

## Scope
Wire verbose mode across all commands via LoggerAdapter. Wire settings file loading and resolution priority chain across the presentation layer.

## Acceptance Criteria
- [ ] `--verbose` on any command outputs diagnostic details to stderr
- [ ] Verbose output includes: framework resolution details (source type, URL, cache status), auth method used (without token value), files written/deleted with paths
- [ ] Without `--verbose`: no diagnostic output to stderr
- [ ] Normal command output goes to stdout (not mixed with verbose)
- [ ] `.aidd/settings.json` loaded at startup, merged with defaults
- [ ] Resolution priority: CLI flag > env var (`AIDD_REPO`, `AIDD_VERBOSE`, `AIDD_TOKEN`) > settings file > defaults
- [ ] Token key in settings file is ignored (security constraint from ADR-008)
- [ ] Missing settings file: defaults used without error
- [ ] Invalid settings JSON: throws descriptive error
- [ ] `AIDD_VERBOSE=true` enables verbose without `--verbose` flag

## Technical Notes
- **UX Copy source of truth**: ALL user-facing text MUST use exact copy from `aidd_docs/memory/internal/ux_copy.md`. Verbose prefix: `[verbose]` (section 11). Use keys: `help.opt.verbose`.
- **User flows reference**: Consult `aidd_docs/memory/internal/user_flows.md` section 4 (Verbose Mode) for the full verbose output specification per step category, and section 5 (Settings Resolution) for the resolution priority chain.
- LoggerAdapter verbose flag set from resolved settings at presentation layer startup.
- Every use case and adapter that performs I/O should call Logger.debug() for verbose output.
- Settings resolution happens once in the presentation layer, then resolved values are passed to use cases.
- This ticket modifies all existing command files to ensure they pass resolved settings.

## Files to Create/Modify
- `src/presentation/commands/init.ts` -- wire verbose + settings
- `src/presentation/commands/install.ts` -- wire verbose + settings
- `src/presentation/commands/uninstall.ts` -- wire verbose + settings
- `src/presentation/commands/status.ts` -- wire verbose + settings
- `src/presentation/commands/clean.ts` -- wire verbose + settings
- `src/presentation/commands/doctor.ts` -- wire verbose + settings
- `src/cli.ts` -- settings resolution at startup
- `tests/presentation/verbose.test.ts` -- verbose mode tests
- `tests/presentation/settings-resolution.test.ts` -- settings priority tests

## Tests
- Verbose mode outputs to stderr during install
- Verbose mode outputs HTTP request details
- Verbose mode logs auth method without revealing token
- Without verbose: no stderr output
- Settings priority: flag > env > file > default
- Token in settings file ignored
- Missing settings file: no error
- Invalid settings JSON: error

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
