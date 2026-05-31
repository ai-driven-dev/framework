---
name: aidd-dev:05:review
description: Read-only review of a diff (a PR or working changes) - code quality against project rules, and feature behavior against the plan's acceptance criteria. Surfaces findings with a verdict; never patches. Use to review changes in progress. Do NOT use for a whole-codebase health check (use 04-audit), fixing the findings (hand off to 07-refactor / 02-implement / 08-debug), or validating a feature runs (use 03-assert).
model: opus
context: fork
agent: reviewer
---

# Skill: review

Read-only review of a diff (a PR or working changes): code quality against project rules, and feature behavior against the plan's acceptance criteria. It surfaces findings and a verdict; it never edits code. The fix hands off to the act-skills (`07-refactor` for code, `02-implement` / `08-debug` for behavior gaps). Diff-scoped - for a whole-codebase read-only diagnosis use `aidd-dev:04:audit` instead.

## Agent delegation

Spawn the `reviewer` agent to execute this skill. For tools that do not support `context: fork` frontmatter: invoke the `reviewer` agent explicitly with this skill's content as the prompt.

## Available actions

| #   | Action              | When to use                                                              |
| --- | ------------------- | ------------------------------------------------------------------------ |
| 01  | `review-code`       | Quality review of a diff against project rules and clean-code principles |
| 02  | `review-functional` | Verify the diff matches the plan's acceptance criteria, flows, edge cases |

## Routing (run first)

Pick the ONE action matching the user's intent; do NOT default to action 01.

- "review the code", "check code quality", "rules compliance", "clean code review" -> `01-review-code`
- "does it match the plan", "functional review", "behavior vs acceptance criteria" -> `02-review-functional`

If the intent is ambiguous, ask one clarifying question before picking. Then read and follow only the matching action file.

## Actions

- `@actions/01-review-code.md`
- `@actions/02-review-functional.md`
