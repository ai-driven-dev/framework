---
name: reproduce
description: Fix bugs with test-driven workflow from issue to PR
argument-hint: Bug description or issue number
---

# Bug Fix Workflow

## Goal

Fix bug systematically using test-driven approach, from issue creation to pull request.

## Rules

- One bug per branch
- Failing test before fix
- All tests pass before commit
- Keep changes minimal and focused
- Link issue in commit and PR

## Steps

1. Create GitHub issue with short descriptive title
2. Create fix branch
3. Reproduce issue and understand root cause
4. Write failing test demonstrating bug
5. Commit
6. Implement minimal fix
7. Verify test passes and run full suite
8. Commit
9. Review code changes for scope creep
10. Commit if needed
11. Push branch
12. Create PR linking issue with `"Fixes #<issue-number>"`
