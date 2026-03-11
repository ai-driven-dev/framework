---
name: branch
description: VCS branch naming convention template
argument-hint: N/A
---

# Branch Naming Convention

## Format

```text
type/ticket-short-description
```

## Types

| Prefix       | Usage                     |
| ------------ | ------------------------- |
| `feat/`      | New feature               |
| `fix/`       | Bug fix                   |
| `aidd_docs/` | Documentation only        |
| `refactor/`  | Code change (no feat/fix) |
| `chore/`     | Build, config, deps       |
| `test/`      | Add/update tests          |
| `hotfix/`    | Urgent production fix     |

## Ticket Reference

Include ticket ID when available:

- `feat/JIRA-123-add-login`
- `fix/GH-456-null-pointer`

## Description

- Use kebab-case: `add-user-auth`
- Keep it short but descriptive (3-5 words max)
- Use action verbs: add, fix, update, remove

## Examples

### Good Examples ✅

```text
feat/JIRA-123-add-oauth-login
fix/GH-456-handle-null-user
docs/update-api-examples
refactor/extract-validation
chore/update-dependencies
```

### Bad Examples ❌

```text
my-branch
fix
john/working-on-it
feature-123
new-stuff
```
