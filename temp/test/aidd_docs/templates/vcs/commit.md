---
name: commit
description: VCS commit message template
argument-hint: N/A
---

# Commit Convention

## Format

```text
type(scope): description

[optional body]

[optional footer]
```

## Types

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

## Scope

Component/module affected (optional but recommended):

- `auth`, `api`, `ui`, `db`, `cli`

## Description

- Use imperative mood: "add" not "added"
- Lowercase, no period
- Max 72 chars
- Clear and concise

## Body (Optional)

- Explain **why**, not what
- Wrap at 72 chars
- Separate from description with blank line

## Footer (Optional)

```text
BREAKING CHANGE: describe breaking change
Fixes #123
Closes #456
```

## Examples

### Simple

```text
feat(auth): add OAuth2 login
```

### With Body

```text
fix(api): handle null user responses

API was returning 500 when user object was null.
Added null check and return 404 instead.
```

### Breaking Change

```text
feat(api): redesign authentication flow

BREAKING CHANGE: JWT tokens now expire after 1h instead of 24h.
Update client token refresh logic accordingly.
```

### Multi-Issue

```text
fix(db): resolve connection pool leak

Connection pool wasn't releasing connections properly
under high load conditions.

Fixes #123
Closes #456
```

## Tips

- **Atomic commits**: One logical change per commit
- **Test before commit**: Ensure code works
- **Meaningful messages**: Help future you understand why
- **Reference issues**: Link to tracking system

## Bad Examples ❌

```text
fix stuff
WIP
update
fixed bug
changes
```

## Good Examples ✅

```text
feat(search): add fuzzy matching
fix(cart): prevent duplicate items
docs(api): add rate limit examples
refactor(utils): extract validation logic
```
