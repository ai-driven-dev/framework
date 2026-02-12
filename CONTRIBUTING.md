# Contribution Guide - AIDD Framework

This guide explains how to contribute to the AIDD framework — the source of truth for agents, commands, rules, skills, and templates.

> **Roles and repository access**: see the [main CONTRIBUTING](https://github.com/ai-driven-dev/aidd/blob/main/CONTRIBUTING.md).

---

- [Commit conventions](#commit-conventions)
- [Contribution process](#contribution-process)
- [Existing templates](#existing-templates)
- [Syntax and conventions](#syntax-and-conventions)
  - [Placeholders](#placeholders)
  - [Frontmatter and metadata](#frontmatter-and-metadata)
- [IDE-specific rules](#ide-specific-rules)
- [CLI and installation](#cli-and-installation)

---

## Commit conventions

This repository uses [Conventional Commits](https://www.conventionalcommits.org/) to automate versioning and changelog generation via [Release Please](https://github.com/googleapis/release-please).

**Every commit message must follow this format:**

```
<type>: <description>
```

| Type | Purpose | Version bump |
| --- | --- | --- |
| `feat` | New feature (agent, command, rule, skill, template) | Minor |
| `fix` | Bug fix or correction | Patch |
| `docs` | Documentation only | None |
| `refactor` | Code restructuring without behavior change | None |
| `chore` | Maintenance, CI, tooling | None |
| `feat!` | Breaking change (renamed files, removed content) | **Major** |

**Examples:**

```bash
git commit -m "feat: add new debug command"
git commit -m "fix: correct placeholder syntax in plan command"
git commit -m "docs: update contribution guide"
git commit -m "feat!: rename agents/ structure"
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

### Placeholders

| Placeholder  | Role                                                 | Resolution                         |
| ------------ | ---------------------------------------------------- | ---------------------------------- |
| `{{TOOLS}}/` | Tool-specific content (commands, agents, rules, etc) | `.claude/`, `.cursor/`, `.github/` |
| `{{DOCS}}/`  | Documentation (templates, memory, tasks, etc)        | `aidd_docs/`                       |
| `$ARGUMENTS` | User input in commands                               | Value provided at runtime          |

For file inclusions, use `@{{TOOLS}}/path` or `@{{DOCS}}/path`: the CLI rewrites these paths based on the target tool.

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

> Properties marked **no** can be added but will not be interpreted by all target tools. See the `rules/04-tooling/ide-mapping.*.md` files for detailed per-tool support.

---

## IDE-specific rules

Syntax reference files per tool live in `rules/04-tooling/`:

- `ide-mapping.claude.md` — Paths, syntax, and frontmatter for Claude Code
- `ide-mapping.cursor.md` — Paths, syntax, and frontmatter for Cursor
- `ide-mapping.copilot.md` — Paths, syntax, and frontmatter for GitHub Copilot

---

## CLI and installation

The CLI manages the full installation lifecycle: tool selection, generation of adapted copies, file integrity tracking via hashes in `.aidd/config.yml`, and update management.

When you contribute new content to the framework, the CLI will automatically detect it and generate the appropriate copies for each installed tool on the next update.

---

← [Back to framework](./README.md)
