---
id: 081
milestone: M8
title: "Implement aidd config command (get, set, list)"
stories: []
points: 3
blockedBy: []
---

# 081: Implement aidd config command (get, set, list)

## Context

`.aidd/settings.json` is not mentioned in the README and can only be managed by manually editing JSON. Users who use a custom framework fork must find and edit this file every time. A `aidd config` command provides an ergonomic interface to project-level settings.

## Scope

Add `aidd config` top-level command with `list`, `get <key>`, and `set <key> <value>` subcommands. Operates on `.aidd/settings.json`.

## Acceptance Criteria

- [ ] `aidd config list` shows all settings with their current value and source (flag / env / settings file / default)
- [ ] `aidd config get repo` prints the current `repo` value
- [ ] `aidd config get verbose` prints `true` or `false`
- [ ] `aidd config set repo my-org/my-fork` writes the value to `.aidd/settings.json`
- [ ] `aidd config set verbose true` writes the value to `.aidd/settings.json`
- [ ] `aidd config set token <value>` is rejected: `token cannot be stored in settings for security reasons. Use --token or AIDD_TOKEN instead.`
- [ ] `aidd config get <unknown-key>` fails: `Unknown setting: {key}. Valid keys: repo, verbose, docsDir`
- [ ] `aidd config set <unknown-key> <value>` fails with the same message
- [ ] `aidd config set docsDir my_custom_docs` fails: `docsDir cannot be changed after init. Run aidd clean --force and aidd init --docs-dir {value} to reset.`
- [ ] No manifest required to run `aidd config list` or `aidd config get`
- [ ] `aidd config set` requires `.aidd/` directory to exist (manifest must be initialized)

## Technical Notes

- **UX Copy source of truth**: use keys `config.*` (section to be added to `ux_copy.md`).
- Valid writable keys: `repo` (string matching `owner/repo`), `verbose` (boolean). `docsDir` is read-only after init.
- `SettingsRepository` already has a `load()` method. Add `save(partial: Partial<Settings>): Promise<void>` that merges into the existing file.
- Source display in `config list`: resolution order check — if a CLI global flag is set, source is "flag"; if env var is set, source is "env"; if the settings file has the key, source is "file"; otherwise "default".
- `docsDir` rejection: it IS stored in the manifest (not settings.json). Changing it after init would orphan all tracked paths. Detect this and fail with guidance.
- Token rejection: matches the existing security constraint in `settings.ts` that strips `token` on load.
- Commander subcommand pattern: `aidd config list`, `aidd config get <key>`, `aidd config set <key> <value>` — use `.command()` nesting.

## Files to Create/Modify

- `src/infrastructure/adapters/settings-repository-adapter.ts` — add `save()` method
- `src/application/commands/config.ts` — new command with `list`, `get`, `set` subcommands
- `src/cli.ts` — register config command
- `tests/infrastructure/adapters/settings-repository-adapter.test.ts` — add save tests
- `tests/e2e/config.e2e.test.ts` — new E2E test

## Tests

- `config list`: shows all keys with values and source labels
- `config get repo`: returns correct value
- `config set repo my-org/fork`: value persisted to settings.json
- `config set token ...`: rejected with security message
- `config set docsDir ...`: rejected with guidance message
- `config get unknown-key`: error with valid keys list
- `config set unknown-key value`: error with valid keys list
- `save()`: merges partial settings without losing existing keys
- E2E: config set repo -> config get repo -> verify file content

## Done When

- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
