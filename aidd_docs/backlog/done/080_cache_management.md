---
id: 080
milestone: M8
title: "Implement aidd cache command (list and clear)"
stories: []
points: 2
blockedBy: []
---

# 080: Implement aidd cache command (list and clear)

## Context

The framework cache lives in `os.tmpdir()/.aidd-cache/` with no CLI interface. When a download is corrupted or a user needs to force a fresh fetch, they must locate and delete the temp directory manually — a poor troubleshooting experience.

This ticket adds an `aidd cache` command with two modes: listing cached versions and clearing them.

## Scope

Add `aidd cache` top-level command with `--list` (default) and `--clear` flags. Optionally scope `--clear` to a specific version with `--version`.

## Acceptance Criteria

- [ ] `aidd cache` (no flags) lists all cached framework versions with their size
- [ ] `aidd cache --list` same as above
- [ ] `aidd cache --clear` removes all cached versions with confirmation of count
- [ ] `aidd cache --clear --version v3.1.0` removes only that version's cache entry
- [ ] `aidd cache --clear --version v9.9.9` fails gracefully: `Version v9.9.9 is not cached`
- [ ] Empty cache: `aidd cache` outputs "No cached framework versions found."
- [ ] Cache path is consistent with what `FrameworkCache` uses (no hardcoded paths in the command)

## Technical Notes

- **UX Copy source of truth**: use keys `cache.*` (section to be added to `ux_copy.md`).
- `FrameworkCache` already knows the cache directory. Expose `listVersions(): Promise<{version: string, sizeBytes: number}[]>` and `clearVersion(version: string): Promise<void>` and `clearAll(): Promise<number>` (returns count) on the cache class, or add a new `CacheRepository` port.
- Size display: use human-readable format (KB / MB). A simple `formatBytes(n)` helper in `output.ts` is sufficient — no external library.
- The command does not require a manifest to exist (no `ensureInitialized()` guard).
- `--version` flag: normalized same as ticket 055 (strip `v` prefix for cache key comparison, re-add for display).

## Files to Create/Modify

- `src/infrastructure/cache/framework-cache.ts` — add `listVersions()`, `clearVersion()`, `clearAll()` methods
- `src/application/commands/cache.ts` — new command registration
- `src/cli.ts` — register cache command
- `tests/infrastructure/cache/framework-cache.test.ts` — add list/clear tests
- `tests/e2e/cache.e2e.test.ts` — new E2E test

## Tests

- List: returns correct versions from cache directory
- List: empty cache returns empty array
- Clear all: all versions removed, returns correct count
- Clear version: removes only the specified version's directory
- Clear version not found: throws with version name
- E2E: install (populates cache) -> cache list -> cache clear -> cache list (empty)

## Done When

- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
