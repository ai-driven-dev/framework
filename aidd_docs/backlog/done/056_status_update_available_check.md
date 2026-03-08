---
id: 056
milestone: M5
title: "Add update-available check to aidd status"
stories: [US-014]
points: 2
blockedBy: [054]
---

# 056: Add update-available check to aidd status

## Context

The UX copy (`status.update_available`) and the M4 acceptance criteria both specify that `aidd status` should display "Update available: v{current} -> v{latest}" when a newer framework version exists. The current `StatusUseCase` and `status.ts` command have zero version-check logic — this is a spec/implementation gap shipped in v3.0.

The check must be silent on network failure (no error, no warning) so as not to disrupt the primary drift report.

## Scope

Add a best-effort latest-version check to `StatusUseCase`. If a newer version is available, display one line per installed tool that is behind. Network failure is swallowed silently.

## Acceptance Criteria

- [ ] `aidd status` fetches the latest framework version from GitHub Releases (best-effort, non-blocking)
- [ ] If latest version > installed tool version: prints `Update available: v{current} -> v{latest}` per affected tool
- [ ] If all tools are up to date: no extra output (silent)
- [ ] Network failure, auth failure, or timeout: check is skipped silently (no error to user)
- [ ] `--tool claude` filter: version check applies only to the filtered tool
- [ ] Check uses the same `repo` resolution chain as install (flag > env > settings > default)
- [ ] Version comparison uses semver ordering (not string comparison)

## Technical Notes

- **UX Copy source of truth**: use key `status.update_available` — `"Update available: v{current} -> v{latest}"`.
- `StatusUseCase.execute()` receives the `FrameworkResolver` port. Add an optional `resolver?: FrameworkResolver` parameter to the use-case options, or inject it as a constructor dependency with a `null`-safe path.
- Pattern: `try { const latest = await resolver.getLatestVersion(repo); ... } catch { /* silent */ }`. Wrap in a helper so the drift report is never blocked.
- `FrameworkResolver` port needs a lightweight method `getLatestVersion(repo, token?): Promise<string>` that fetches only the tag name from `/releases/latest` without downloading the tarball. Alternatively, reuse the existing `resolve()` result's `version` field — but that triggers a full download. Prefer a new `fetchLatestVersion()` method on the adapter.
- Version comparison: use `node:semver` is banned (no deps). Implement a minimal `compareSemver(a, b): -1|0|1` using integer comparison of major.minor.patch splits. 3-part version strings only.
- Display position: after the per-tool drift block, before the legend line.

## Files to Create/Modify

- `src/domain/ports/framework-resolver.ts` — add `fetchLatestVersion(repo: string, token?: string): Promise<string>` to port interface
- `src/infrastructure/adapters/framework-resolver-adapter.ts` — implement `fetchLatestVersion()` (reuse `fetchLatestRelease()`, return `tag_name`)
- `src/application/use-cases/status-use-case.ts` — inject `FrameworkResolver`, add version check logic
- `src/application/commands/status.ts` — pass `deps.resolver` and token/repo to use case
- `tests/application/use-cases/status-use-case.test.ts` — add version check scenarios
- `tests/infrastructure/adapters/framework-resolver-adapter.test.ts` — add `fetchLatestVersion` tests

## Tests

- Status with newer version available: `Update available` line printed per outdated tool
- Status with all tools up to date: no update line printed
- Status with network failure: drift report shown normally, no error
- Status with `--tool claude` filter: check runs only for claude
- `fetchLatestVersion()`: returns tag version string
- `fetchLatestVersion()`: network error propagates (caught by status use case)
- `compareSemver()`: 1.0.0 < 2.0.0, 3.1.0 < 3.2.0, 3.1.1 > 3.1.0, equal returns 0

## Done When

- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
