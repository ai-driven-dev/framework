---
name: 03-assert
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

These actions are complementary facets, not mutually exclusive. This skill is run-one-OR-run-all:

- The user named a facet ("assert the frontend", "check architecture conformance") -> run that ONE action.
- The user asked for an unscoped assertion ("assert this works", "make the feature pass") -> ask ONE question: "Assert everything applicable, or a specific facet (coding / architecture / frontend)?" Then run all applicable, or the chosen one.
- Never silently default to action 01. Never run a blind all without offering the choice first.

When running all applicable: `01-assert` is the baseline (project coding assertions); add `03-assert-frontend` when the feature has a UI and a running frontend URL; add `02-assert-architecture` when architecture conformance is in scope. A facet whose precondition is absent (e.g. no running URL) is skipped with a noted reason, never forced. Run the selected actions in order (01, then 03, then 02). Read and follow each selected action file.

## Actions

- `@actions/01-assert.md`
- `@actions/02-assert-architecture.md`
- `@actions/03-assert-frontend.md`
