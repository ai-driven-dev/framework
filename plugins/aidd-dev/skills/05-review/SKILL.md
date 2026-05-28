---
name: aidd-dev:05:review
description: Review code quality against project rules and validate feature behavior against plan specifications.
model: opus
context: fork
agent: reviewer
---

# Skill: review

Performs code quality reviews against project rules and functional reviews against plan acceptance criteria.

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
