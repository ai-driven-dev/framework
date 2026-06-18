# Versioning Control System (VCS) Guidelines

- Main Branch: `main`
- Platform: `github`
- CLI or MCP: `gh`

## Branch Naming Convention

Format: `type/ticket-short-description` (kebab-case)

Types: `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`, `test/`, `hotfix/`

Example: `feat/001-init-project`

## Commit Convention

Format: `type(scope): description` (Conventional Commits)

- Types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `style`, `ci`, `revert`
- Scope: optional — `cli`, `domain`, `infra`, `install`
- Imperative mood, lowercase, max 72 chars

Example: `feat(install): add plugin registry support`

## Releases

- Driven by **release-please** (Conventional Commits → semver). A `!` or `BREAKING CHANGE` footer forces a major bump.
- The bot keeps one open release PR off `main`; merging it tags `vX.Y.Z` and triggers publish (see `deployment.md`). Never bump the version or tag by hand.
