---
name: aidd-dev:07:refactor
description: Optimize code for performance and fix security vulnerabilities following OWASP guidelines.
---

# Skill: refactor

Improves code performance and hardens security through structured analysis and targeted fixes.

## Available actions

| #   | Action        | When to use                                                           |
| --- | ------------- | --------------------------------------------------------------------- |
| 01  | `performance` | Improve performance of a code region without changing its behavior    |
| 02  | `security`    | Identify and fix security vulnerabilities, then add coverage          |

## Routing (run first)

Pick the ONE action matching the user's intent; do NOT default to action 01.

- "make it faster", "optimize performance", "this is slow" -> `01-performance`
- "fix security", "vulnerabilities", "harden this", "OWASP" -> `02-security`

If the intent is ambiguous, ask one clarifying question before picking. Then read and follow only the matching action file.

## Actions

- `@actions/01-performance.md`
- `@actions/02-security.md`
