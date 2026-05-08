# 01 - Release Tag

Compute the next semver version from recent commits, draft release notes from the template, validate with the user, create a bump commit, then tag and push.

## Inputs

```yaml
version: <semver>              # optional; auto-computed from commits since last tag when omitted
notes_overrides:               # optional; impose specific notes content
  title: <imposed title>
  body: <imposed body>
```

## Outputs

```yaml
tag: v<semver>
commit_sha: <bump commit sha>
pushed: true
release_url: <url>
```

## Process

1. **Read current version**. Pick first match:
   - version manager file present (`package.json`, `pyproject.toml`, `Cargo.toml`, etc.) -> read its version field
   - default -> `1.0.0`
2. **Read latest tag**. Pick first match:
   - `git tag --sort=-version:refname | head -1` non-empty -> use it
   - default -> treat as `v1.0.0`
3. **Collect commits**. Run `git log --oneline "<latest>..HEAD"`.
4. **Compute next version**. Pick first match:
   - `version` input provided -> use it
   - any commit body contains `BREAKING CHANGE` -> bump major
   - any commit type is `feat` -> bump minor
   - default -> bump patch
5. **Draft release notes**. Fill `assets/release-template.md` with the change list from step 3. Apply `notes_overrides` when provided.
6. **Validate**. Show full notes, computed version, and version-manager files about to change. Wait for explicit user approval.
7. **Bump commit**. Stage only version-manager files. Create a `chore: bump version to v<semver>` commit via heredoc.
8. **Create tag**. Run `git tag -a v<semver> -m <notes title>`.
9. **Push commit**. Run `git push`.
10. **Push tag**. Run `git push origin v<semver>`.
11. **Resolve release URL**. Pick first match:
    - configured VCS tool exposes a release-view command -> capture the returned URL
    - default -> compose URL from `git remote get-url origin` and the tag name

## Test

- **Local tag**: `git tag -l v<semver>` returns the new tag exactly once.
- **Semver shape**: the tag matches `^v[0-9]+\.[0-9]+\.[0-9]+$`.
- **Remote tag**: `git ls-remote --tags origin "refs/tags/v<semver>"` returns one row, confirming the tag is on the remote.
- **Commit link**: `git rev-parse "v<semver>^{commit}"` resolves to the bump commit sha returned in Outputs.
