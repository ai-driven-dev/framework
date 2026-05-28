---
name: aidd-dev:06:test
description: Write and iterate on tests until they pass, and validate user journeys end-to-end in the browser.
model: sonnet
---

# Skill: test

Identifies untested behaviors, iterates on test creation until quality criteria are met, and validates complete user journeys through browser automation.

## Available actions

| #   | Action         | When to use                                                            |
| --- | -------------- | ---------------------------------------------------------------------- |
| 01  | `test`         | Find untested behaviors and write/iterate tests until they pass        |
| 02  | `test-journey` | Validate a full user journey end-to-end in the browser                 |

## Routing (run first)

Pick the ONE action matching the user's intent; do NOT default to action 01.

- "write tests", "add test coverage", "what's untested", "iterate on tests" -> `01-test`
- "test the user journey", "end-to-end", "walk through the flow in the browser" -> `02-test-journey`

If the intent is ambiguous, ask one clarifying question before picking. Then read and follow only the matching action file.

## Actions

- `@actions/01-test.md`
- `@actions/02-test-journey.md`
