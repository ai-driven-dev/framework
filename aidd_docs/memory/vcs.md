# Versioning Control System (VCS) Guidelines

- Production branch: `main`
- Integration branch: `next` (default target for day-to-day work)
- Platform: `github`
- CLI: `gh`
- Ticketing Tool: GitHub Issues

## Branch Naming Convention

### Format

```text
type/ticket-short-description
```

### Types

| Prefix | Usage | Branch from | PR target |
| --- | --- | --- | --- |
| `feat/` | New feature | `next` | `next` |
| `fix/` | Bug fix | `next` | `next` |
| `docs/` | Documentation only | `next` | `next` |
| `refactor/` | Code change (no feat/fix) | `next` | `next` |
| `chore/` | Build, config, deps | `next` | `next` |
| `test/` | Add/update tests | `next` | `next` |
| `hotfix/` | Urgent production fix | `main` | `main` |

### Examples

```text
feat/plugin-architecture
fix/orchestrator-sdlc-push
docs/update-api-examples
chore/release-please-config
```

`next` is the day-to-day branch: branch from it, target it. `main` is production and only takes promotions from `next` plus `hotfix/*`. The release flow is in [`RELEASE.md`](../../RELEASE.md).

## Commit Convention

### Source of truth

The repo's `commitlint.config.cjs` enforces the format and lists the encouraged scopes (read it before composing a commit message). The summary below mirrors that file; if the two disagree, the config wins.

### Format

```text
type(scope): description

[optional body]

[optional footer]
```

### Types

| Type | Usage |
| --- | --- |
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change (no feat/fix) |
| `perf` | Performance improvement |
| `test` | Add/update tests |
| `chore` | Build, config, deps |
| `style` | Formatting (no logic change) |
| `ci` | CI/CD configuration |
| `revert` | Revert previous commit |
| `build` | Build system or external deps |

### Scopes

Scope is optional. When provided, it MUST be kebab-case (enforced by `scope-case`). A whitelist of encouraged scopes lives in `commitlint.config.cjs` (`scope-enum`) at the `warning` level: an unknown scope produces a warning but does NOT block the commit. Use a known scope whenever it fits; introduce a new one only when no existing scope describes the change.

Encouraged scopes (kept in sync with `commitlint.config.cjs`):

- **Plugin (long form)**: `aidd-context`, `aidd-dev`, `aidd-vcs`, `aidd-pm`, `aidd-refine`, `aidd-orchestrator`
- **Plugin (short form)**: `context`, `dev`, `vcs`, `pm`, `refine`, `orchestrator`
- **Root**: `framework`, `marketplace` (these bump `marketplace.json` via release-please)
- **Tooling**: `release-please`, `ci`, `deps`, `lefthook`, `commitlint`, `contributing`, `docs`, `security`, `test`

### Description rules

- Imperative mood: "add" not "added"
- Lowercase, no period
- Max 72 chars

### Examples

```text
feat(orchestrator): per-developer Anthropic account routing
fix(orchestrator): SDLC owns push + PR
refactor(aidd-pm): restructure spec into build and refine actions
chore(release-please): register orchestrator and refine packages
ci(framework): drop version.txt from tarball step
```

### Breaking Change

```text
feat(api): redesign plugin manifest format

BREAKING CHANGE: plugin.json now requires a `strict` field.
```

## Release Management

The release flow (main/next model, weekly cadence, hotfix) lives in [`RELEASE.md`](../../RELEASE.md). This section is the tooling only.

- Automated via `release-please`, in `.github/workflows/ci.yml` on push to `main`.
- The Release PR is auto-merged in that workflow (AIDD bot App token, a bypass actor on `main`).
- Back-merge `main` -> `next` is automated in `.github/workflows/back-merge.yml`.
- Config: `release-please-config.json`, manifest: `.release-please-manifest.json`.
- Per-plugin versioning with `include-component-in-tag: true`.
- Tags format: `<plugin>-v<semver>` (e.g. `aidd-dev-v1.2.0`).
