---
name: 11-qa
description: Run post-review browser QA and produce short named videos for a locked happy path and sourced edge cases. Use when the user wants concise reviewer evidence for a UI feature. Not for writing automated tests, reviewing a diff, or fixing the application.
argument-hint: load-scope | prepare-run | run-scenarios
---

# QA

```mermaid
flowchart LR
  scope["load-scope"] --> prepare["prepare-run"] --> run["run-scenarios"]
```

## Actions

Read only the next action's file before running it.

| #   | Action          | Does                                                       |
| --- | --------------- | ---------------------------------------------------------- |
| 01  | `load-scope`    | Lock one happy path and a bounded set of sourced edge cases |
| 02  | `prepare-run`   | Resolve the shortest deterministic path to executable runs |
| 03  | `run-scenarios` | Record, normalize, verify, reset, and report every scenario |

## Transversal rules

- Run against a reviewed change and never patch the application.
- Never spawn agents. Batch independent reads and tool checks, but keep state-changing browser work sequential.
- Do not narrate action transitions, searches, fixtures, selectors, or successful checks. Report only a blocker, a required decision, or the final verdict and paths.
