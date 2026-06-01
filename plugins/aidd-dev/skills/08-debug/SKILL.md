---
name: 08-debug
description: Reproduce and fix bugs systematically using test-driven workflow, root cause analysis, and hypothesis validation.
model: opus
---

# Skill: debug

Diagnoses issues through structured hypothesis validation, root cause analysis, and test-driven bug fixing from issue creation to PR.

## Available actions

| #   | Action          | When to use                                                                   |
| --- | --------------- | ----------------------------------------------------------------------------- |
| 01  | `reproduce`     | A known bug must be fixed end to end: reproduce, test-driven fix, branch, PR   |
| 02  | `debug`         | Root cause unknown: enumerate hypotheses, validate each, confirm the cause     |
| 03  | `reflect-issue` | Stuck or prior fixes failed: re-open the search space, instrument logs first   |

## Routing (run first)

This skill offers three distinct actions. Pick the ONE matching the user's intent; do NOT default to action 01.

- "fix this bug", "reproduce and fix", "from issue to PR" -> `01-reproduce`
- "why does this happen", "find the root cause", "debug this", "what's causing X" -> `02-debug`
- "I'm stuck", "previous fixes didn't work", "rethink the causes", "add logs to narrow it down" -> `03-reflect-issue`

If the intent is ambiguous, ask one clarifying question before picking. Then read and follow only the matching action file.

## Actions

- `@actions/01-reproduce.md`
- `@actions/02-debug.md`
- `@actions/03-reflect-issue.md`
