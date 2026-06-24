---
name: 03-assert
description: Assert a feature works as intended by iterating the project's coding assertions until they pass, with optional architecture-conformance and running-frontend facets. Use to validate that an implementation behaves correctly. Do NOT use to review code quality or to write new tests.
argument-hint: assert | assert-architecture | assert-frontend
model: sonnet
---

# Skill: assert

Validate that a feature works: run the project's assertions, iterating and fixing until they pass.

## Actions

| #   | Action                | Facet                                                       |
| --- | --------------------- | ----------------------------------------------------------- |
| 01  | `assert`              | Run the project's coding assertions, fixing until they pass |
| 02  | `assert-architecture` | Report where the code breaks the documented architecture    |
| 03  | `assert-frontend`     | Inspect the running UI, fixing until the behavior is right   |

Run every applicable facet by default, or one when named. Coding (`01`) always applies; add `03` when the feature has a UI and a running URL; run `02` only when architecture conformance is asked for. Skip a facet whose precondition is absent, with a noted reason. Ask only when the intent is genuinely ambiguous.

## Transversal rules

- Gate: it returns a pass or fail verdict on the feature.
- Fix loop: the coding and frontend facets fix and re-run until they pass. The architecture facet only reports, never fixes.
- Stop only when every selected assertion passes a final clean sweep.

## Assets

- `assets/task-template.md`: the tracking file the frontend facet fills across its fix loop.
