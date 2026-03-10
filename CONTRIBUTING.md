# Contribution guide - AIDD CLI

Welcome to the AIDD CLI contribution guide!

> **Our mission**: Make AI-Driven Development accessible with a complete package for developers.

> **Roles and permissions**: See the [main CONTRIBUTING](https://github.com/ai-driven-dev/aidd/blob/main/CONTRIBUTING.md#rôles)

---

- [Useful links](#useful-links)
- [How to contribute](#how-to-contribute)
  - [1. Reporting issues](#1-reporting-issues)
    - [Create an issue](#create-an-issue)
    - [Project (choose CLI)](#project-choose-cli)
  - [2. Improving documentation](#2-improving-documentation)
  - [3. Developing features](#3-developing-features)
  - [4. Reviewing Pull Requests](#4-reviewing-pull-requests)
  - [5. Merging Pull Requests](#5-merging-pull-requests)
- [Development setup](#development-setup)
  - [Prerequisites](#prerequisites)
  - [GitHub Packages authentication](#github-packages-authentication)
  - [Clone the repository](#clone-the-repository)
  - [Install dependencies](#install-dependencies)
- [Development workflow](#development-workflow)
  - [1. Find a feature](#1-find-a-feature)
  - [2. Create a branch](#2-create-a-branch)
  - [Commit message format](#commit-message-format)
  - [3. Develop the feature](#3-develop-the-feature)
  - [4. Test locally](#4-test-locally)
  - [5. Write tests](#5-write-tests)
  - [6. Pull Request process](#6-pull-request-process)
- [Publishing](#publishing)
  - [Publishing prerequisites](#publishing-prerequisites)
  - [Publishing process](#publishing-process)

---

## Useful links

- [Roadmap](https://github.com/orgs/ai-driven-dev/projects/5)
- [Releases](https://github.com/ai-driven-dev/aidd/releases)
- [Reported issues](https://github.com/ai-driven-dev/aidd/issues)

---

## How to contribute

### 1. Reporting issues

**[Create an issue](https://github.com/ai-driven-dev/aidd/issues/new/choose)**

Use the available templates:

- 🐛 **Bug Report**: Report a bug or unexpected behavior
- ✨ **Feature Request**: Propose a new feature

#### Create an issue

| **Category** | **Item**  | **Description**                         |
| ------------ | --------- | --------------------------------------- |
| **Labels**   | `blocked` | Approval or clarifications needed       |
|              | `ready`   | 100% ready for development              |
| **Type**     | `bug`     | Bug report                              |
|              | `feature` | Feature request                         |
|              | `task`    | Task, question or documentation         |

#### Project (choose CLI)

You must always specify the project and relevant metadata:

| **Category**   | **Item**      | **Description**                                 |
| -------------- | ------------- | ----------------------------------------------- |
| **Status**     | `Todo`        | At issue creation                               |
|                | `In progress` | Please respect this 🙏                          |
|                | `Done`        | Merged into `main`                              |
| **Complexity** | `XS`          | Documentation                                   |
|                | `S`           | Small fix or improvement                        |
|                | `M`           | Simple feature                                  |
|                | `L`           | Requires thinking about implementation          |
|                | `XL`          | Complex topic to discuss with coaches           |
| **Priority**   | `urgent`      | To fix NOW or tomorrow                          |
|                | `must-have`   | Without this, it's painful                      |
|                | `should-have` | Not strictly required but would be nice to have |

### 2. Improving documentation

Documentation improvements are always welcome! Typos, clarifications, missing examples...

- **Small corrections** (typos, formatting): direct PR without an issue
- **Major additions**: Create an issue first to discuss it

### 3. Developing features

> Code contributions are open to certified Obsidian+ members using the AIDD flow.

### 4. Reviewing Pull Requests

> Code reviews are performed by Coaches to ensure quality and consistency.

1. Use GitHub's review tools to leave comments and suggestions.
2. Send the PR back to the author for changes if necessary.
3. Approve the PR when you are satisfied.

### 5. Merging Pull Requests

> Only Baptiste and Alex can merge PRs into `main`.

---

## Development setup

### Prerequisites

- **Node.js**: >= 24.0.0
- **pnpm**: >= 9.0.0
- **Git**: Latest version
- **GitHub access**: Personal Access Token with the `read:packages` scope

### GitHub Packages authentication

The `@ai-driven-dev/aidd` package is private and hosted on GitHub Packages.

**1. Create a Personal Access Token:**

1. Go to [GitHub Settings > Tokens (classic)](https://github.com/settings/tokens)
2. Click on **"Generate new token (classic)"**
3. Configure:
   - **Note**: `AIDD CLI - Read`
   - **Scopes**: ✅ `read:packages`
4. Copy the token immediately

**2. Configure npm:**

```bash
# Edit ~/.npmrc
vim ~/.npmrc

# Add these lines:
@ai-driven-dev:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=ghp_your_actual_token_here
```

### Clone the repository

AIDD can be used as a Git submodule. Always clone with `--recurse-submodules`:

```bash
git clone --recurse-submodules git@github.com:ai-driven-dev/aidd.git
cd aidd/cli

# If already cloned without submodules
git submodule update --init --recursive
```

### Install dependencies

```bash
pnpm install
```

---

## Development workflow

### 1. Find a feature

**📌 [Check the Project Board](https://github.com/orgs/ai-driven-dev/projects/5)**

1. Open the current release.
2. Look for issues in the **Ready** column.
3. Assign yourself to an issue.
4. Move it to `In Progress`.
5. Create a branch from `main`.
6. Use the CLI.
7. Write tests.
8. Test locally.
9. Open a PR.
10. Assign reviewers: `Baptiste`.

### 2. Create a branch

```bash
# Feature branch
git checkout -b feat/your-feature-name

# Fix branch
git checkout -b fix/bug-description
```

### Commit message format

Follow conventional commits:

```bash
# Features
feat: add worktree command with auto-cleanup
feat(install): add --skip-framework option

# Fixes
fix: resolve symlink creation on Windows
fix(prompts): correct template path resolution

# Documentation
docs: update installation guide
docs(contributing): clarify testing process

# Refactoring
refactor: simplify policy registry logic

# Tests
test: add e2e tests for worktree command

# Maintenance
chore: update dependencies
chore(ci): optimize test workflow
```

### 3. Develop the feature

Use AIDD CLI to build AIDD CLI 😈

**Use AIDD commands:**

```bash
/implement "<technical plan>"
/test
/review_code
```

### 4. Test locally

This will install your local version of the CLI globally for testing:

```bash
# Test the CLI locally
pnpm run install:local

# Create a test folder
cd ../output-tests
mkdir test-directory
cd test-directory

# Test your local version of the CLI
aidd install
```

### 5. Write tests

We aim for a professional-quality test suite; all contributions must include tests.

| **Command**       | **Purpose**                   | **When to use**     |
| ----------------- | ----------------------------- | ------------------- |
| `pnpm test`       | Build + all tests (E2E)       | Before push, CI     |
| `pnpm test:watch` | Watch mode (tests without build) | Active development |
| `pnpm typecheck`  | TypeScript check              | Before commit       |
| `pnpm lint`       | Lint + format (biome)         | Before commit       |

### 6. Pull Request process

1. Push your branch and open a PR to `main` — the `.github/pull_request_template.md` template will be applied automatically.
2. Assign reviewers (`Baptiste`, then `Alex` if necessary).

---

## Publishing

> This section is reserved for maintainers with publishing rights (Alex only).
>
> As the CLI is closely tied to AIDD training courses, Alex must always be informed of changes before publishing.

### Publishing prerequisites

- **GitHub CLI**: Authenticated with `gh`
- **Repository permissions**: Create releases
- **NPM authentication**: Configured for GitHub Packages

### Publishing process

Use the release flow:

```bash
/flows:release
```

**Important**: This command updates all version numbers. Never manually edit `package.json`.

---

← [Back to CLI](./README.md)
