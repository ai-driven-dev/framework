---
id: 025
milestone: M2
title: "Implement ManifestRepositoryAdapter, SettingsRepositoryAdapter, and LoggerAdapter"
stories: [US-027]
points: 2
blockedBy: [024]
---

# 025: Implement ManifestRepositoryAdapter, SettingsRepositoryAdapter, and LoggerAdapter

## Context
The remaining infrastructure adapters handle manifest persistence, settings loading, and verbose logging. These complete the infrastructure layer and unblock all use case work in M3.

## Scope
Implement ManifestRepositoryAdapter (JSON read/write for `.aidd/config.json`), SettingsRepositoryAdapter (JSON read for `.aidd/settings.json` with defaults), LoggerAdapter (stderr verbose output), and SilentPrompterAdapter (auto-accept for CI/tests/--force).

## Acceptance Criteria
- [ ] **ManifestRepositoryAdapter** implements ManifestRepository:
  - `load()` reads `.aidd/config.json`, parses JSON, constructs Manifest; returns null if file missing
  - `save(manifest)` serializes Manifest to JSON, writes `.aidd/config.json` (creates `.aidd/` if needed)
  - `delete()` removes `.aidd/config.json` and `.aidd/` directory if empty
- [ ] **SettingsRepositoryAdapter** implements SettingsRepository:
  - `load()` reads `.aidd/settings.json`, merges with defaults, returns Settings
  - Missing file: returns Settings with all defaults (no error)
  - Invalid JSON: throws descriptive error
  - Ignores any `token` key in the settings file (security constraint)
- [ ] **LoggerAdapter** implements Logger:
  - `debug(message)` writes to `process.stderr` only when verbose mode is enabled
  - `info(message)` always writes to `process.stderr`
  - `warn(message)` always writes to `process.stderr` with warning prefix
  - Verbose mode is controlled by a constructor flag
- [ ] **SilentPrompterAdapter** implements Prompter:
  - `confirm()` returns true (auto-accept)
  - `select()` returns the first choice
  - `checkbox()` returns all choices
  - Used in CI, tests, and when `--force` is set

## Technical Notes
- ADR-007: Manifest at `.aidd/config.json`. Single JSON file for atomic read/write.
- ADR-008: Settings at `.aidd/settings.json`. Token key is explicitly ignored.
- LoggerAdapter: stderr avoids polluting stdout (which is for command output).
- SilentPrompterAdapter is the v3.0 default. PrompterAdapter with @inquirer/prompts comes in M6.

## Files to Create/Modify
- `src/infrastructure/adapters/manifest-repository-adapter.ts`
- `src/infrastructure/adapters/settings-repository-adapter.ts`
- `src/infrastructure/adapters/logger-adapter.ts`
- `src/infrastructure/adapters/silent-prompter-adapter.ts`
- `tests/infrastructure/adapters/manifest-repository-adapter.test.ts`
- `tests/infrastructure/adapters/settings-repository-adapter.test.ts`
- `tests/infrastructure/adapters/logger-adapter.test.ts`
- `tests/infrastructure/adapters/silent-prompter-adapter.test.ts`

## Tests
- ManifestRepositoryAdapter save + load roundtrip
- ManifestRepositoryAdapter load on missing file returns null
- ManifestRepositoryAdapter delete removes files
- SettingsRepositoryAdapter returns defaults when no file exists
- SettingsRepositoryAdapter merges file values with defaults
- SettingsRepositoryAdapter ignores token key
- SettingsRepositoryAdapter throws on invalid JSON
- LoggerAdapter debug only outputs in verbose mode
- LoggerAdapter info/warn always output
- SilentPrompterAdapter auto-accepts all prompts

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
