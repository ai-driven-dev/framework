---
name: 08-debug
description: Reproduce and fix a known bug end to end, or find an unknown root cause through hypothesis validation. Use when the user wants to fix a bug, find why something breaks, or reopen a stuck investigation. Not for building a feature, refactoring working code, or reviewing a diff.
argument-hint: reproduce | debug | reflect-issue
model: opus
---

# Skill: debug

Diagnose and fix issues through structured hypothesis validation, root-cause analysis, and a test-driven fix.

## Actions

| #   | Action          | When to use                                                                   |
| --- | --------------- | ----------------------------------------------------------------------------- |
| 01  | `reproduce`     | A known bug must be fixed end to end: reproduce, test-driven fix, branch, PR   |
| 02  | `debug`         | Root cause unknown: enumerate hypotheses, validate each, confirm the cause     |
| 03  | `reflect-issue` | Stuck or prior fixes failed: reopen the search space, instrument logs first    |

Pick the one action matching the intent; never default to `01`. Triggers like "reproduce and fix" route to `01`, "why does this happen" to `02`, "I'm stuck" or "previous fixes didn't work" to `03`. Ask one question when the intent is ambiguous.

## Transversal rules

- One action per run: follow only the matching action file.
- Scope each fix to its bug: never bundle drive-by refactors.
- Confirm the root cause before fixing; the diagnostic actions stop at a confirmed cause.

## Assets

- `assets/task-template.md`: the per-hypothesis tracking file the debug action fills.

## References

- `references/mermaid-conventions.md`: the project's Mermaid conventions for the action-path flowchart.
