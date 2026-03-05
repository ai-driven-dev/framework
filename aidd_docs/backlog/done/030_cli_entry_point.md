---
id: 030
milestone: M3
title: "Setup CLI entry point with commander and global options"
stories: []
points: 0
blockedBy: [025]
---

# 030: Setup CLI entry point with commander and global options

## Context
The CLI needs a proper entry point using commander with global options (`--verbose`, `--repo`, `--token`), version display, and help generation. This is the presentation layer skeleton that all commands will register on.

## Scope
Expand `src/cli.ts` into a full commander program with global options, settings resolution, and the dependency wiring pattern.

## Acceptance Criteria
- [ ] `src/cli.ts` creates a commander program with name "aidd", description, and version from package.json
- [ ] Global options registered: `--verbose`, `--repo <owner/repo>`, `--token <token>`
- [ ] `--verbose` enables LoggerAdapter verbose mode
- [ ] `aidd --help` shows program description and lists all registered commands
- [ ] `aidd --version` shows version in exact format from ux_copy.md section 7: `aidd/{version} node/{nodeVersion} {platform}` (e.g., `aidd/3.0.0 node/20.11.0 darwin-arm64`)
- [ ] Settings resolution at the presentation layer: CLI flags > env vars > `.aidd/settings.json` > defaults (ADR-008)
- [ ] `src/presentation/presenter.ts` implements output formatting conventions from ux_copy.md section 11:
  - Status indicators: `+` (added), `~` (modified), `-` (deleted), unmodified files not shown
  - Prefixes: `Error:` for errors, `Warning:` for warnings, `[verbose]` for verbose output
  - Indentation: 2 spaces for file lists under section headers
  - No emoji in output — text-only status indicators
  - Errors to stderr, normal output to stdout
  - Help descriptions use exact text from ux_copy.md section 7 (`help.*` keys)
- [ ] Dependency wiring pattern established: each command handler creates adapters and injects into use cases (no DI container)
- [ ] Error handling: catches domain/application errors, formats as user-friendly messages with guidance

## Technical Notes
- **UX Copy source of truth**: ALL user-facing text (error messages, success messages, help descriptions, warnings, progress) MUST use exact copy from `aidd_docs/memory/internal/ux_copy.md`. No other deliverable should contain exact user-facing text.
- **User flows reference**: Consult `aidd_docs/memory/internal/user_flows.md` for state tables, recovery paths, and cross-flow transitions.
- commander ^12 API: `program.option()` for global options, `program.command()` for subcommands.
- Settings resolution: load SettingsRepositoryAdapter, merge with CLI flags and env vars.
- When `--force` is set, use SilentPrompterAdapter instead of PrompterAdapter.
- Error messages should be actionable: "Run `aidd init` first", "Use `--force` to overwrite".

## Files to Create/Modify
- `src/cli.ts` -- expand commander setup with global options
- `src/presentation/presenter.ts` -- output formatting utilities
- `tests/presentation/cli.test.ts` -- CLI entry point tests

## Tests
- `aidd --version` outputs version
- `aidd --help` shows help text
- Unknown command shows error with guidance
- Settings resolution priority chain works correctly

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
