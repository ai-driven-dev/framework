# Contribution Guide - AIDD Framework

This guide explains how to contribute to the AIDD framework — the source of truth for agents, commands, rules, skills, and templates.

> **Roles and repository access**: see the [main CONTRIBUTING](https://github.com/ai-driven-dev/aidd/blob/main/CONTRIBUTING.md).

---

- [Releases](#releases)
- [Commit scope discipline](#commit-scope-discipline)
- [Commit conventions](#commit-conventions)
- [Contribution process](#contribution-process)
- [Existing templates](#existing-templates)
- [Syntax and conventions](#syntax-and-conventions)
  - [Frontmatter and metadata](#frontmatter-and-metadata)
- [CLI and installation](#cli-and-installation)
- [Reporting issues](#reporting-issues)

---

---

## Releases

This repository follows [Semantic Versioning](https://semver.org/) with automated releases via [Release Please](https://github.com/googleapis/release-please).

| Commit type                   | Version bump | Example       |
| ----------------------------- | ------------ | ------------- |
| `fix:`                        | Patch        | 3.0.0 → 3.0.1 |
| `feat:`                       | Minor        | 3.0.0 → 3.1.0 |
| `feat!:` / `BREAKING CHANGE:` | Major        | 3.0.0 → 4.0.0 |

**How it works:**

1. Every push to `main` with conventional commits triggers a **Release PR** (changelog + version bump)
2. When the Release PR is merged → GitHub Release + tag + downloadable tarball

The tarball contains the framework content: `plugins/`, `.claude-plugin/`, `aidd_docs/`.

## Commit scope discipline

Every commit must use one of the eight allowed scopes:

| Scope              | Use for                                                           |
| ------------------ | ----------------------------------------------------------------- |
| `aidd-context`     | Changes inside `plugins/aidd-context/`                            |
| `aidd-dev`         | Changes inside `plugins/aidd-dev/`                                |
| `aidd-vcs`         | Changes inside `plugins/aidd-vcs/`                                |
| `aidd-pm`          | Changes inside `plugins/aidd-pm/`                                 |
| `aidd-orchestrator`| Changes inside `plugins/aidd-orchestrator/`                       |
| `aidd-refine`      | Changes inside `plugins/aidd-refine/`                             |
| `framework`        | Root-level changes: build scripts, CI, config, docs, `aidd_docs/` |
| `marketplace`      | Changes that affect the framework catalog (`marketplace.json`)     |

### Which scope bumps what

| Scope            | File bumped                                       | Tag created                  |
| ---------------- | ------------------------------------------------- | ---------------------------- |
| `aidd-<plugin>`  | `plugins/<plugin>/.claude-plugin/plugin.json`     | `aidd-<plugin>-v<X.Y.Z>`    |
| `framework`      | `.claude-plugin/marketplace.json`                 | `v<X.Y.Z>`                  |
| `marketplace`    | `.claude-plugin/marketplace.json`                 | `v<X.Y.Z>`                  |

Examples:

```bash
git commit -m "feat(aidd-dev): add for-sure skill"
git commit -m "fix(aidd-vcs): correct commit template"
git commit -m "docs(framework): update README for plugin model"
git commit -m "build(framework): regenerate catalogs"
git commit -m "chore(marketplace): update catalog description"
git commit -m "feat(aidd-orchestrator): add async dev skill"
git commit -m "fix(aidd-refine): correct brainstorm prompt"
```

Cross-plugin changes must be split into separate commits, one per scope.

---

## Commit conventions

This repository uses [Conventional Commits](https://www.conventionalcommits.org/) to automate versioning and changelog generation via [Release Please](https://github.com/googleapis/release-please).

**Every commit message must follow this format:**

```text
<type>(<scope>): <description>
```

| Type       | Purpose                                             | Version bump | Changelog |
| ---------- | --------------------------------------------------- | ------------ | --------- |
| `feat`     | New feature (agent, command, rule, skill, template) | Minor        | ✅        |
| `fix`      | Bug fix or correction                               | Patch        | ✅        |
| `perf`     | Performance improvement                             | Patch        | ✅        |
| `revert`   | Revert a previous commit                            | Patch        | ✅        |
| `docs`     | Documentation, templates                            | None         | ✅        |
| `refactor` | Restructuring without behavior change               | None         | ✅        |
| `style`    | Formatting, whitespace                              | None         | —         |
| `test`     | Adding or updating tests                            | None         | —         |
| `build`    | Build system or external dependencies               | None         | —         |
| `ci`       | CI/CD configuration                                 | None         | —         |
| `chore`    | Maintenance, tooling                                | None         | —         |

**Breaking changes:** add `!` after any type to trigger a **major** version bump (e.g., `feat!:`, `fix!:`, `refactor!:`). Use this when renaming files, removing content, or changing structure in a way that breaks existing setups.

**Examples:**

```bash
git commit -m "feat: add new debug command"
git commit -m "fix: correct placeholder syntax in plan command"
git commit -m "docs: update contribution guide"
git commit -m "refactor!: rename agents/ directory structure"
```

> PR titles are also validated against this convention. A PR with an invalid title will fail the `lint-pr` check.

---

## Contribution process

Every change requires a **Pull Request** with a conventional commit title (see above). PRs are squash-merged using the PR title as the commit message.

Changes impact all teams using the framework and must be reviewed before merge.

---

## Existing templates

When adding or modifying content, always follow the existing templates:

| Content | Template                              | Examples    |
| ------- | ------------------------------------- | ----------- |
| Agent   | `aidd_docs/templates/aidd/agent.md`   | `agents/`   |
| Command | `aidd_docs/templates/aidd/command.md` | `commands/` |
| Skill   | `aidd_docs/templates/aidd/skill.md`   | `skills/`   |
| Rule    | `aidd_docs/templates/aidd/rule.md`    | `rules/`    |

---

## Syntax and conventions

The framework must remain **tool-agnostic** — the CLI handles all syntactic adaptation at install time.

> **IMPORTANT**: Source files use **Claude Code** syntax by default (`/command`, `@path`).

### Frontmatter and metadata

All framework elements use YAML frontmatter. Some properties are universal, others are specific to certain tools.

| Property        | Used by                 | Supported everywhere |
| --------------- | ----------------------- | -------------------- |
| `name`          | agents, commands        | yes                  |
| `description`   | agents, commands, rules | yes                  |
| `argument-hint` | commands                | yes                  |
| `model`         | agents, commands        | no                   |
| `color`         | agents                  | no                   |
| `docs`          | agents                  | no                   |
| `globs`         | rules                   | no                   |
| `alwaysApply`   | rules                   | no                   |
| `paths`         | rules                   | no                   |

> Properties marked **no** can be added but will not be interpreted by all target tools. See documentation for each tool for details.

---

## CLI and installation

The CLI manages the full installation lifecycle: tool selection, generation of adapted copies, file integrity tracking via hashes in `.aidd/config.yml`, and update management.

When you contribute new content to the framework, the CLI will automatically detect it and generate the appropriate copies for each installed tool on the next update.

---

## Reporting issues

**[Create an issue](https://github.com/ai-driven-dev/aidd-framework/issues/new/choose)** using the templates:

- 🐛 **Bug Report** — incorrect content, broken syntax, missing field
- ✨ **Feature Request** — new rule, skill, command, agent, or IDE mapping

Issues are automatically added to the [AIDD — Produit](https://github.com/orgs/ai-driven-dev/projects/7) project board.

---

■ [Back to framework](./README.md)
