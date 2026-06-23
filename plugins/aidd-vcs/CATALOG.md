# aidd-vcs catalog

Auto-generated index of skills, agents, references and assets shipped by the `aidd-vcs` plugin.

> This file is automatically updated by the `scripts/summarize-markdown.js` script.

## Table of Contents

- [`.claude-plugin`](#claude-plugin)
- [`skills`](#skills)
  - [`skills/00-repo-init`](#skills00-repo-init)
  - [`skills/01-commit`](#skills01-commit)
  - [`skills/02-pull-request`](#skills02-pull-request)
  - [`skills/03-release-tag`](#skills03-release-tag)
  - [`skills/04-issue-create`](#skills04-issue-create)

---

### `.claude-plugin`

| File |
|------|
| [plugin.json](.claude-plugin/plugin.json) |

### `skills`

#### `skills/00-repo-init`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-init.md](skills/00-repo-init/actions/01-init.md) | - |
| `actions` | [02-publish.md](skills/00-repo-init/actions/02-publish.md) | - |
| `assets` | [CONTRIBUTING.md](skills/00-repo-init/assets/CONTRIBUTING.md) | - |
| `-` | [README.md](skills/00-repo-init/README.md) | - |
| `-` | [SKILL.md](skills/00-repo-init/SKILL.md) | `Initialize a project's repository - resolve the default branch and VCS provider, run git init with a bootstrap commit, write CONTRIBUTING.md, and on request create the remote repository and push. Use when the user says "init a repo", "git init", "initialize version control", "set up a new repo", "start a project", "create the remote and push", or "publish this repo". Do NOT use for committing changes (use 01-commit), opening pull requests (use 02-pull-request), tagging releases (use 03-release-tag), or cloning an existing remote.` |

#### `skills/01-commit`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-commit.md](skills/01-commit/actions/01-commit.md) | - |
| `assets` | [commit-template.md](skills/01-commit/assets/commit-template.md) | `VCS commit message template` |
| `-` | [README.md](skills/01-commit/README.md) | - |
| `-` | [SKILL.md](skills/01-commit/SKILL.md) | `Create an atomic git commit with conventional message format. Use when the user says "commit", "git commit", "create a commit", "commit my changes", "commit and push", or invokes `/commit`. Do NOT use for amending existing commits, force-pushing, rebasing, opening pull requests, or release tagging.` |

#### `skills/02-pull-request`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-pull-request.md](skills/02-pull-request/actions/01-pull-request.md) | - |
| `assets` | [branch.md](skills/02-pull-request/assets/branch.md) | `VCS branch naming convention template` |
| `assets` | [CONTRIBUTING.md](skills/02-pull-request/assets/CONTRIBUTING.md) | `Project contribution guidelines template` |
| `assets` | [pull_request.md](skills/02-pull-request/assets/pull_request.md) | `VCS pull/merge request template` |
| `assets` | [README.md](skills/02-pull-request/assets/README.md) | `Project README template` |
| `-` | [README.md](skills/02-pull-request/README.md) | - |
| `-` | [SKILL.md](skills/02-pull-request/SKILL.md) | `Create a draft pull or merge request from the current branch. Use when the user ask to create a PR or invokes `/pull-request`.` |

#### `skills/03-release-tag`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-release-tag.md](skills/03-release-tag/actions/01-release-tag.md) | - |
| `assets` | [release-template.md](skills/03-release-tag/assets/release-template.md) | `VCS release notes template` |
| `-` | [README.md](skills/03-release-tag/README.md) | - |
| `-` | [SKILL.md](skills/03-release-tag/SKILL.md) | `Cut a semver release with annotated tag and release notes. Use when the user says "release", "tag", "tag this release", "bump version", "release v1.2.0", "cut a release", or invokes `/release-tag`. Do NOT use for plain commits without a tag, opening pull requests, pushing a branch only, or amending existing tags.` |

#### `skills/04-issue-create`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-issue-create.md](skills/04-issue-create/actions/01-issue-create.md) | - |
| `assets` | [CONTRIBUTING.md](skills/04-issue-create/assets/CONTRIBUTING.md) | `Project contribution guidelines template` |
| `assets` | [issue-template.md](skills/04-issue-create/assets/issue-template.md) | `VCS issue/ticket template` |
| `-` | [README.md](skills/04-issue-create/README.md) | - |
| `-` | [SKILL.md](skills/04-issue-create/SKILL.md) | `Create an issue in the configured ticketing tool. Use when the user says "new issue", "create an issue", "file a bug", "file an issue", "report bug", "open an issue", or invokes `/issue-create`. Do NOT use for committing changes, opening pull requests, tagging releases, or commenting on existing issues.` |

