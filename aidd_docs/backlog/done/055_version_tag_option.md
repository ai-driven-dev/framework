---
id: 055
milestone: M5
title: "Add --release global option to pin framework version"
stories: []
points: 2
blockedBy: []
---

# 055: Add --release global option to pin framework release

## Context

Currently `aidd install` and `aidd init` always resolve the **latest** GitHub release.
There is no way to pin a specific version (e.g., for reproducible installs or rollback).
This ticket adds a `--release <tag>` global option that fetches a specific release by tag
using the GitHub Releases API `/releases/tags/{tag}` endpoint.
The cache layer already supports version-keyed lookups — only the resolution path needs wiring.

## Scope

Add `--release <tag>` as a global CLI option. Applies to remote resolution only.
Ignored (with no side effect) when `--framework <path>` is also set (local path takes precedence).
Does NOT affect `--framework` local/tarball paths, nor any other command.

## Acceptance Criteria

- [ ] `aidd install claude --release v3.2.0` downloads and installs framework v3.2.0
- [ ] `aidd init --release v3.2.0` initialises using framework v3.2.0
- [ ] Cache is hit on second call with same version tag (no re-download)
- [ ] `--release` combined with `--framework <path>` is silently ignored (local wins)
- [ ] Non-existent tag throws: `Framework release not found: <tag>`
- [ ] `v`-prefix is normalized for cache key (e.g., `v3.2.0` → cache key `3.2.0`)

## Technical Notes

### New GitHub API endpoint

```
GET /repos/{owner}/{repo}/releases/tags/{tag}
Authorization: Bearer <token>
```

Returns same shape as `/releases/latest` (`tag_name`, `assets[]`).
Returns 404 when tag does not exist → throw `Framework release not found: <tag>`.

### Flag name

`--release <tag>` → commander opts key: `release`. Short and consistent with GitHub's release terminology.

### Known bug to fix in same PR

`downloadAndCache()` at line 138 of `framework-resolver-adapter.ts` uses `this.defaultRepo`
instead of the local `repo` variable. Fix it in the same method edit — it silently breaks
`--repo` + version-specific downloads.

## Files to Modify (6)

### 1. `src/cli.ts`

Add one line after the existing `--framework` option:

```ts
.option("--release <tag>", "Specific framework release tag to install (e.g., v3.2.0)")
```

### 2. `src/domain/ports/framework-resolver.ts`

Add `version?: string` to `FrameworkResolverOptions`:

```ts
export interface FrameworkResolverOptions {
  localPath?: string;
  tarballPath?: string;
  repo?: string;
  token?: string;
  version?: string;   // <-- add
}
```

### 3. `src/infrastructure/adapters/framework-resolver-adapter.ts`

Add `fetchReleaseByTag()` private method:

```ts
private async fetchReleaseByTag(repo: string, tag: string, token?: string): Promise<GithubRelease> {
  const url = `${this.githubApiBase}/repos/${repo}/releases/tags/${tag}`;
  const response = await this.http.get(url, { token });
  return response.body as GithubRelease;
}
```

In `resolveRemote()`, branch on `options.version` before `fetchLatestRelease`:

```ts
const normalizedTag = options.version?.startsWith("v") ? options.version : options.version ? `v${options.version}` : undefined;

try {
  release = normalizedTag
    ? await this.fetchReleaseByTag(repo, normalizedTag, token)
    : await this.fetchLatestRelease(repo, token);
} catch (error) {
  // if version was specified and fetch failed, surface a clear error
  if (normalizedTag) throw new Error(`Framework release not found: ${normalizedTag}`);
  networkError = error instanceof Error ? error : new Error(String(error));
}
```

Fix `downloadAndCache()` bug: replace `this.defaultRepo` with `repo` parameter.
Add `repo: string` as first parameter to `downloadAndCache()` and update its call site.

### 4. `src/application/use-cases/resolve-framework-use-case.ts`

Add `release?: string` to `ResolveOptions`. Pass it to `resolver.resolve()` for remote path:

```ts
interface ResolveOptions {
  framework?: string;
  release?: string;   // <-- add
}
```

In remote branch (`else` path): `resolver.resolve({ version: options.release })`

### 5. `src/application/commands/init.ts`

Add `release?: string` to the global opts type and pass it to `resolveFramework()`:

```ts
const globalOptions = program.opts<{
  verbose: boolean;
  repo?: string;
  token?: string;
  framework?: string;
  release?: string;   // <-- add
}>();
```

```ts
await resolveFramework(deps.resolver, deps.logger, {
  framework: globalOptions.framework,
  release: globalOptions.release,   // <-- add
});
```

### 6. `src/application/commands/install.ts`

Same as `init.ts` — add `release` to opts type and pass to `resolveFramework()`.

## Tests to Add/Modify (2 files)

### `tests/infrastructure/adapters/framework-resolver-adapter.test.ts`

New `describe("remote resolution with --release")` block — 3 cases:

1. **tag cached** — mock server returns release for `/releases/tags/v3.1.0`, cache already has `3.1.0`
   → assert no tarball download, `result.version === "3.1.0"`, `result.source === "cache"`

2. **tag not cached** — mock server returns valid release for `/releases/tags/v3.1.0` with tarball
   → assert `result.version === "3.1.0"`, cache populated

3. **tag not found** — mock server returns 404 for `/releases/tags/v9.9.9`
   → assert throws `Framework release not found: v9.9.9`

### `tests/application/use-cases/resolve-framework-use-case.test.ts`

In existing `describe("without --framework (remote resolution)")` block — 2 new cases:

1. **passes version to resolver** — call with `{ release: "v3.1.0" }`, spy on `resolve()` opts
   → assert `receivedOptions.version === "v3.1.0"`

2. **version ignored when --framework set** — call with `{ framework: "/some/path", release: "v3.1.0" }`
   → assert `receivedOptions.localPath` is set, `receivedOptions.version` is undefined

## Documentation to Update (2 files)

### `README.md`

In "Options globales" code block, add:
```bash
aidd install claude --release v3.2.0  # version spécifique du framework
```

In global options list (`--verbose`, `--token`, `--repo`, `--framework`), add `--release`.

### `aidd_docs/memory/architecture.md`

In "External Services > GitHub Releases API" section, add the tag endpoint:
```
- Tag endpoint: /repos/<owner>/<repo>/releases/tags/<tag>  (used by --release)
```

## Done When

- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Martin validates: conventions, no over-engineering, no silent errors
