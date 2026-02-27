---
name: 'aidd:08:commit'
description: 'Create git commit with proper message format'
argument-hint: 'auto'
---

# Commit Prompt

## Goal

Generate git commit with standardized message following project conventions.

## Rules

- **If `auto` mode is enabled, do not ask for user confirmation**.
- Respect already defined commit rules
- Keep commits atomic and focused
- Clear and concise change description
- Follow previous commit message format
- Include change type prefix
- Reference issues if applicable
- Imperative mood ("Add feature" not "Added feature")
- Explain "why", not "what"
- Never `--force` push

## Context

### Commit rules

Follow the commit conventions defined here:

```markdown
@aidd_docs/templates/vcs/commit.md
@aidd_docs/templates/aidd/memory/vcs.md
```

### Previous commits

```text
! git log -5 --pretty=%B
```

## Process steps

1. If branch does not exist, propose a name based on changes + **WAIT FOR USER APPROVAL**
2. Check staged changes
3. Determine change type (feat, fix, docs, etc)
4. Suggests splitting commits for different concerns:
   1. Make a list of functional changes with clear commit messages
   2. **WAIT FOR USER APPROVAL** before committing
5. Execute git add patch for dedicated part of the feature
6. Run git commit with generated messages
7. If pre-commit errors, fix and retry to commit:
8. loop here until you can commit
9. Verify commits success
10. List them to user
11. If `auto` mode: push (with lease) the branch to remote
12. Notify user of completion
