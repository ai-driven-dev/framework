# VCS

The repository's conventions are in the repo bank's `vcs.md`.

This page holds only what differs here.

## Branches

- A `cli/` change follows the repository's branch prefixes and targets.

## Commits

- `cli` is this package's scope in the root `commitlint.config.cjs`.
- An unlisted scope such as `domain`, `infra` or `install` warns.
- `release-please-config.json` declares `cli` as its own package: `@ai-driven-dev/cli`, tagged `cli-v<semver>`.
- That config also declares the root package `.`, which excludes only `.release-please-manifest.json`.
- The header limit is 100, from the root config that `lefthook.yml` and `ci.yml` read.
- `cli/commitlint.config.cjs` sets 120 and neither reads it.

## Agent may

- AI should auto commit: never.
