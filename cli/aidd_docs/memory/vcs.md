# VCS

The repository's conventions are in the repo bank's `vcs.md`.

This page holds only what differs here.

## Branches

- A `cli/` change follows the repository's branch prefixes and targets.

## Commits

- `cli` is this package's scope in the root `commitlint.config.cjs`.
- An unlisted scope such as `domain`, `infra` or `install` warns.
- `release-please-config.json` declares `cli` as its own package: `@ai-driven-dev/cli`, tagged `cli-v<semver>`.
- The root package `.` is not the CLI: it bumps the `version` of `.claude-plugin/marketplace.json`.
- The header limit is 100, from the root config that `lefthook.yml` and `ci.yml` read.

## Agent may

- AI should auto commit: never.
