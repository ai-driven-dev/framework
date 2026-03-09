---
id: 023
milestone: M2
title: "Implement FrameworkResolverAdapter (compose HTTP + tar + cache + token)"
stories: [US-001, US-002, US-004]
points: 5
blockedBy: [021, 022]
---

# 023: Implement FrameworkResolverAdapter (compose HTTP + tar + cache + token)

## Context
The FrameworkResolverAdapter is the main infrastructure component that composes HttpClient, TarExtractor, FrameworkCache, and TokenResolver to resolve a framework from any source (remote GitHub release, local tarball, local directory) to a local directory path. It implements the FrameworkResolver domain port.

## Scope
Implement the full resolve() and getLatestVersion() methods with all source types and offline fallback.

## Acceptance Criteria
- [ ] `resolve()` with no `--framework` flag: downloads from GitHub Releases API, extracts, caches, returns local dir
- [ ] `resolve()` with `--framework` pointing to a directory: loads directly, no download
- [ ] `resolve()` with `--framework` pointing to a `.tar.gz` file: extracts to temp dir, detects framework root
- [ ] Remote download: calls GitHub Releases API for latest release, downloads tarball asset
- [ ] Cache hit: skips download when cache is valid for the requested version
- [ ] Offline fallback: network failure + existing cache -> use latest cached version with warning
- [ ] Offline failure: network failure + no cache -> throw clear error
- [ ] Invalid tarball: throw "Downloaded file is not a valid tarball"
- [ ] Missing framework.json in extracted content: throw descriptive error
- [ ] Local directory without framework.json: throw "No framework descriptor found in the specified directory"
- [ ] `getLatestVersion()` calls GitHub Releases API and returns the tag_name, or null on network failure

## Technical Notes
- Composes: HttpClient (020), TarExtractor (020), FrameworkCache (021), TokenResolver (022).
- GitHub API: `GET /repos/{owner}/{repo}/releases/latest` returns `{tag_name, assets[{name, url}]}`.
- Asset naming convention: `aidd-framework-{version}.tar.gz`.
- Single-directory nesting: GitHub tarballs contain `org-repo-sha/` wrapper dir.
- The resolver does NOT parse framework.json -- that's FrameworkLoaderAdapter's job (024).

## Files to Create/Modify
- `src/infrastructure/adapters/framework-resolver-adapter.ts` -- implements FrameworkResolver port
- `tests/infrastructure/adapters/framework-resolver-adapter.test.ts` -- integration tests

## Tests
- Remote resolve: download + extract + cache + return path
- Local directory resolve: return path directly
- Local tarball resolve: extract + return path
- Cache hit: skip download
- Cache miss: trigger download
- Offline with cache: fallback to cached version
- Offline without cache: throw error
- Invalid tarball: throw error
- Missing framework.json: throw error
- getLatestVersion: returns version string
- getLatestVersion: returns null on network failure

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
