# Contributing to AIDD CLI

> **Mission:** Make AI-Driven Development accessible with a complete, consistent package for developers.

Code contributions are open to certified **Obsidian+** members using the AIDD development flow.

---

- [Who can contribute](#who-can-contribute)
- [Useful links](#useful-links)
- [Types of contributions](#types-of-contributions)
  - [Reporting issues](#reporting-issues)
  - [Improving documentation](#improving-documentation)
  - [Developing features](#developing-features)
- [Development setup](#development-setup)
  - [Prerequisites](#prerequisites)
  - [Clone the repository](#clone-the-repository)
  - [Install and build](#install-and-build)
- [Development workflow](#development-workflow)
  - [1. Find a task](#1-find-a-task)
  - [2. Create a branch](#2-create-a-branch)
  - [3. Develop](#3-develop)
  - [4. Run the full test suite](#4-run-the-full-test-suite)
  - [5. Test the CLI locally _(optional)_](#5-test-the-cli-locally-optional)
  - [6. Open a Pull Request](#6-open-a-pull-request)
- [Standards](#standards)
  - [Commit message format](#commit-message-format)
  - [Code quality](#code-quality)
  - [CI checks](#ci-checks)
- [Pull Request process](#pull-request-process)
- [Publishing](#publishing)

---

## Who can contribute

| Action               | Who                        |
| -------------------- | -------------------------- |
| Report issues        | Any AIDD member            |
| Improve docs         | Any AIDD member            |
| Develop features     | Certified Obsidian+ members |
| Review PRs           | Coaches                    |
| Merge PRs to `main`  | Baptiste only              |

---

## Useful links

- [Roadmap](https://github.com/orgs/ai-driven-dev/projects/5)
- [Issues](https://github.com/ai-driven-dev/aidd-cli/issues)
- [Releases](https://github.com/ai-driven-dev/aidd-cli/releases)
- [Roles & permissions](https://github.com/ai-driven-dev/aidd-cli/blob/main/CONTRIBUTING.md#rôles)

---

## Types of contributions

### Reporting issues

**[Create an issue](https://github.com/ai-driven-dev/aidd-cli/issues/new/choose)** using the available templates:

- 🐛 **Bug Report** — unexpected behavior
- ✨ **Feature Request** — new feature proposal

**Labels to set:**

| Category       | Value         | Description                                     |
| -------------- | ------------- | ----------------------------------------------- |
| **Type**       | `bug`         | Bug report                                      |
|                | `feature`     | Feature request                                 |
|                | `task`        | Task, question or documentation                 |
| **Labels**     | `blocked`     | Needs approval or clarification                 |
|                | `ready`       | Ready for development                           |
| **Status**     | `Todo`        | At issue creation                               |
|                | `In progress` | While developing                                |
|                | `Done`        | Merged into `main`                              |
| **Complexity** | `XS`          | Documentation only                              |
|                | `S`           | Small fix or improvement                        |
|                | `M`           | Simple feature                                  |
|                | `L`           | Requires design thinking                        |
|                | `XL`          | Complex — discuss with coaches first            |
| **Priority**   | `urgent`      | Fix now or tomorrow                             |
|                | `must-have`   | Painful without it                              |
|                | `should-have` | Nice to have                                    |

### Improving documentation

- **Typos / formatting:** direct PR, no issue needed
- **Major additions or restructuring:** open an issue first

### Developing features

> Use the AIDD development flow at every step — this project is built with AIDD.

---

## Development setup

### Prerequisites

- **Node.js** >= 24.0.0
- **pnpm** >= 9.0.0
- **Git** — latest version

No private registry token is needed — all dependencies are on the public npm registry.

### Clone the repository

The CLI lives as a submodule inside the main `aidd` monorepo. Always clone with `--recurse-submodules`:

```bash
git clone git@github.com:ai-driven-dev/aidd-cli.git
cd aidd-cli
```

### Install and build

```bash
pnpm install     # install dependencies + set up git hooks (lefthook)
pnpm build       # compile to dist/cli.js
```

> `pnpm install` automatically installs [Lefthook](https://github.com/evilmartians/lefthook) git hooks via the `prepare` script. Hooks delegate to the parent monorepo and run commitlint on commit.

---

## Development workflow

### 1. Find a task

**[Open the project board](https://github.com/orgs/ai-driven-dev/projects/5)**

1. Look for issues in the **Ready** column.
2. Assign yourself and move it to `In Progress`.

### 2. Create a branch

```bash
git checkout -b feat/your-feature-name   # feature
git checkout -b fix/bug-description      # bug fix
```

### 3. Develop

Use the AIDD flow throughout development — this project is built with its own tooling.

```bash
pnpm test:watch          # run tests in watch mode while developing (no build step)
pnpm typecheck           # TypeScript check
pnpm lint                # lint + format check (biome)
pnpm knip:production     # detect unused exports and dependencies
pnpm jscpd               # detect code duplication in src/
```

### 4. Run the full test suite

```bash
pnpm test                    # build + full test suite (unit + e2e)
pnpm test -- --coverage      # same + coverage report with thresholds
```

All contributions must include tests. Never mock functional behavior in tests.

Coverage is measured on the business logic layer (use-cases, domain models, tools, infrastructure adapters). Files tested exclusively via E2E (commands, ports, entrypoint) are excluded from the thresholds.

### 5. Test the CLI locally _(optional)_

If you want to test the compiled CLI manually before opening a PR:

```bash
pnpm run install:local      # build + install globally

# Then test in a scratch directory
mkdir /tmp/aidd-test && cd /tmp/aidd-test
aidd init
aidd install claude
```

### 6. Open a Pull Request

Push your branch and open a PR to `main`. The `.github/pull_request_template.md` template is applied automatically. Assign **Baptiste** as reviewer.

---

## Standards

### Commit message format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat: add restore --docs flag
feat(install): support --skip-framework option
fix: resolve symlink creation on Windows
fix(status): correct hash comparison for merged files
docs: update adopt command examples
refactor: simplify manifest migration logic
test: add e2e tests for sync command
chore: update dependencies
```

### Code quality

- No silent errors — throw early
- No duplication
- Small, single-responsibility functions
- No comments on obvious code — make the code self-explanatory
- Only comment genuinely tricky logic

### CI checks

Every PR triggers the following jobs automatically:

| Job | Command | Blocking |
| --- | ------- | -------- |
| Typecheck | `pnpm typecheck` | yes |
| Lint | `pnpm lint` | yes |
| Test & Coverage | `pnpm test -- --coverage` | yes |
| Dead code (knip) | `pnpm knip:production` | no — warning only |
| Duplication (jscpd) | `pnpm jscpd` | no — warning only |

All blocking jobs must pass before a PR can be merged.

---

## Pull Request process

1. Open a PR to `main` with the filled template.
2. Assign **Baptiste** as reviewer (add **Alex** if needed).
3. Address review comments.
4. Baptiste merges when approved.

---

## Publishing

Publishing is **fully automated**. There is no manual release step.

When a PR is merged into `main`, [Release Please](https://github.com/googleapis/release-please) opens or updates a release PR that bumps the version and updates the changelog based on conventional commits. Merging that release PR triggers the publish workflow automatically.

> Never manually edit `package.json` version fields.

---

← [Back to CLI](./README.md)
