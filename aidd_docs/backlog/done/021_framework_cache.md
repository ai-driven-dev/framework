---
id: 021
milestone: M2
title: "Implement FrameworkCache with per-version storage and markers"
stories: [US-001, US-003]
points: 3
blockedBy: [020]
---

# 021: Implement FrameworkCache with per-version storage and markers

## Context
Downloaded frameworks must be cached locally to avoid redundant downloads. The cache uses per-version directories with a `.aidd-extracted` marker file to detect completeness. Cache validation checks both the marker and `framework.json` presence.

## Scope
Implement FrameworkCache using `os.tmpdir()` for per-version caching with marker-based validation.

## Acceptance Criteria
- [ ] Cache directory: `{os.tmpdir()}/aidd-cache/{version}/`
- [ ] After successful extraction: `.aidd-extracted` marker file is written
- [ ] `has(version)` returns true only if both marker and `framework.json` exist
- [ ] `get(version)` returns the cache directory path if valid
- [ ] `put(version, extractedDir)` stores the extracted framework in the cache
- [ ] `getLatestCached()` returns the most recent cached version (for offline fallback)
- [ ] Cache miss (marker missing) triggers re-download
- [ ] Cache corruption (framework.json missing) triggers re-download
- [ ] Integration tests with actual filesystem (temp directories)

## Technical Notes
- Cache location: `os.tmpdir()` ensures cleanup by OS. Platform-specific paths.
- Marker file: simple touch file. Its presence means extraction completed successfully.
- Version ordering: compare by semver for `getLatestCached()`.
- Cache is NOT cleared by `aidd clean` -- it's in temp, not in the project.

## Files to Create/Modify
- `src/infrastructure/cache/framework-cache.ts` -- per-version cache implementation
- `tests/infrastructure/cache/framework-cache.test.ts` -- integration tests

## Tests
- put() creates cache directory with marker
- has() returns true when marker + framework.json present
- has() returns false when marker missing
- has() returns false when framework.json missing
- get() returns correct path for cached version
- getLatestCached() returns latest version by semver
- getLatestCached() returns null when no cache exists

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
