---
name: aidd-dev:03:assert
description: Assert features work as intended - general assertions, architecture conformance, and frontend UI validation.
model: sonnet
---

# Skill: assert

Validates correctness of implementations through iterative assertion loops, architecture checks, and browser-based frontend verification.

## Available actions

| #   | Action                | When to use                                                                  |
| --- | --------------------- | ---------------------------------------------------------------------------- |
| 01  | `assert`              | Iterate until a feature works by running the project's coding assertions     |
| 02  | `assert-architecture` | Verify the codebase conforms to documented architecture (C4, ADRs, tree)     |
| 03  | `assert-frontend`     | Iterate until a frontend feature works by inspecting the running UI          |

## Routing (run first)

Assert comprehensively: these actions are complementary facets, not mutually exclusive choices. Select every action applicable to the target; do NOT stop at action 01. Do not ask the user to pick - decide from what the feature needs.

- `01-assert` - ALWAYS run for a feature assertion (the project's coding assertions are the baseline).
- `03-assert-frontend` - ALSO run when the feature has a UI and a running frontend URL is available.
- `02-assert-architecture` - run when the request is about architecture conformance (C4 / ADRs / tree), either standalone or added to a feature assertion when conformance is in scope.

Run the applicable actions in order (01, then 03 if UI, then 02 if conformance). Read and follow each selected action file.

## Actions

- `@actions/01-assert.md`
- `@actions/02-assert-architecture.md`
- `@actions/03-assert-frontend.md`
