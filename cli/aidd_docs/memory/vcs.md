# VCS

The repository's conventions are in the repo bank's `vcs.md`; this page holds only what differs here.

## Branches

- A `cli/` change follows the repository's branch prefixes and targets.

## Commits

- `cli` is this package's only scope in the root `commitlint.config.cjs`; any other scope warns.
- A `feat` or `fix` under `cli/` releases `@ai-driven-dev/cli` alone, under its own `cli-v<semver>` tag.
- The header limit is 100, from the root config that `lefthook.yml` and `ci.yml` read, not the 120 in `cli/commitlint.config.cjs`.

## Agent may

- AI should auto commit: never.
