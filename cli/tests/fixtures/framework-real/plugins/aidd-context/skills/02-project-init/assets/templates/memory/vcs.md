---
name: branch
description: VCS branch naming convention template
argument-hint: N/A
scope: all
---

# Versioning Control System (VCS) Guidelines

- Main Branch: `<main, master, trunk>`
- Platform: `<gitlab, github, bitbucket>`
- CLI: `<gh, glab, bb-cli...>`
- MCP: `<mcp-server-name>`
- Ticketing Tool: `<linear, confluence, jira>`

## Branch Naming Convention

### Format

```text
type/ticket-short-description
```

### Types

| Prefix       | Usage                     |
| ------------ | ------------------------- |
| `feat/`      | New feature               |
| `fix/`       | Bug fix                   |
| `aidd_docs/` | Documentation only        |
| `refactor/`  | Code change (no feat/fix) |
| `chore/`     | Build, config, deps       |
| `test/`      | Add/update tests          |
| `hotfix/`    | Urgent production fix     |

### Examples

```text
feat/JIRA-123-add-oauth-login
fix/GH-456-handle-null-user
docs/update-api-examples
refactor/extract-validation
chore/update-dependencies
```

## Commit Convention

### Format

```text
type(scope): description

[optional body]

[optional footer]
```

### Types

| Type       | Usage                        |
| ---------- | ---------------------------- |
| `feat`     | New feature                  |
| `fix`      | Bug fix                      |
| `docs`     | Documentation only           |
| `refactor` | Code change (no feat/fix)    |
| `perf`     | Performance improvement      |
| `test`     | Add/update tests             |
| `chore`    | Build, config, deps          |
| `style`    | Formatting (no logic change) |
| `ci`       | CI/CD configuration          |
| `revert`   | Revert previous commit       |

### Description rules

- Imperative mood: "add" not "added"
- Lowercase, no period
- Max 72 chars

### Examples

```text
feat(auth): add OAuth2 login
fix(api): handle null user responses
docs(api): add rate limit examples
```

### Breaking Change

```text
feat(api): redesign authentication flow

BREAKING CHANGE: JWT tokens now expire after 1h instead of 24h.
```
