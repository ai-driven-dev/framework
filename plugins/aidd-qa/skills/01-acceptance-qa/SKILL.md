---
name: 01-acceptance-qa
description: Validate a reviewed candidate's observable behavior against its acceptance criteria and record short named videos as reviewer evidence. Use when acceptance criteria exist and a browser-observable journey needs proof it holds. Do NOT use for diff review, unit or integration tests, or application fixes.
argument-hint: acceptance criteria | reviewed candidate
---

# Acceptance QA

```mermaid
flowchart LR
  scope["load-scope"] --> prerequisites["prerequisites"] --> prepare["prepare-run"] --> run["run-scenarios"] --> report["qa.md"]
  scope -- skipped --> report
```

## Actions

Read only the next action's file before running it.

| #   | Action          | Does                                                       |
| --- | --------------- | ---------------------------------------------------------- |
| 01  | `load-scope`    | Lock at most one happy path and a bounded set of sourced edge cases, each traced to an acceptance criterion |
| 02  | `prerequisites` | Verify the browser runner and media dependencies            |
| 03  | `prepare-run`   | Resolve the shortest deterministic path to executable runs |
| 04  | `run-scenarios` | Record, normalize, verify, reset, and report every scenario |

## Transversal rules

- Run against a reviewed change and never patch the application.
- Never delete data not proven test-only.
- Never derive a scenario from the diff or the source code; every scenario traces to an acceptance criterion.
- Never spawn agents. Batch independent reads and tool checks, but keep state-changing browser work sequential.
- Do not narrate action transitions, searches, fixtures, selectors, or successful checks. Report only a blocker, a required decision, or the final verdict and paths.
