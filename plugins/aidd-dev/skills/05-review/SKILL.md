---
name: 05-review
description: Read-only review of a diff (a PR or working changes) along three axes - code quality (clean-code), feature behavior (the plan's acceptance criteria), and relevancy (does the change belong: fit to the need, conformance to declared rules, no duplication or over-engineering). Surfaces findings with a verdict; never patches. Use to review changes in progress. Do NOT use for a whole-codebase health check (use 04-audit), fixing the findings (hand off to 07-refactor / 02-implement / 08-debug), or validating a feature runs (use 03-assert).
argument-hint: review-code | review-functional | review-relevancy
model: opus
---

# Skill: review

Read-only review of a diff (a PR or working changes) along three axes: code quality, feature behavior against the plan's acceptance criteria, and relevancy. It surfaces findings and a verdict; it never edits code. The fix hands off to the act-skills (`07-refactor` for code, `02-implement` / `08-debug` for behavior gaps). Diff-scoped - for a whole-codebase read-only diagnosis use `aidd-dev:04-audit` instead.

This is a recipe: it runs in the context of whoever invokes it and never spawns an agent. The SDLC isolates it by spawning a `checker` to run it; a direct caller runs it inline.

## Available actions

| #   | Action              | When to use                                                              |
| --- | ------------------- | ------------------------------------------------------------------------ |
| 01  | `review-code`       | Quality review of a diff against clean-code principles                   |
| 02  | `review-functional` | Verify the diff matches the plan's acceptance criteria, flows, edge cases |
| 03  | `review-relevancy`  | Judge whether the change belongs: fit to the need, declared-rule conformance, no rot |

## Routing (run first)

Pick the ONE action matching the user's intent; do NOT default to action 01.

- "review the code", "check code quality", "clean code review" -> `01-review-code`
- "does it match the plan", "functional review", "behavior vs acceptance criteria" -> `02-review-functional`
- "does this belong", "is it relevant", "rules compliance", "over-engineering", "duplication", "coherence with the need" -> `03-review-relevancy`

If the intent is ambiguous, ask one clarifying question before picking. Then read and follow only the matching action file.

## Actions

- `@actions/01-review-code.md`
- `@actions/02-review-functional.md`
- `@actions/03-review-relevancy.md`
