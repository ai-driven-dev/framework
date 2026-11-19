---
name: 06-test
description: Writes tests until they pass, or walks a user journey in the browser, while a feature is built; not for acceptance QA, test audits or debugging.
argument-hint: scope | journey
---

# Test
```mermaid
flowchart LR
  entry([scope or journey]) -->|"write tests, what's untested"| test["actions/01-test.md"]
  entry -->|"user journey, end-to-end"| journey["actions/02-test-journey.md"]
  entry <-->|"intent ambiguous: one question, never default to 01"| user((user answers))
  test <-->|"behaviors and scores to approve, missing seam to agree"| user
  test -->|"next behavior"| test
  test --> tested((tests pass or pending))
  journey -->|"next step"| journey
  journey --> report((journey report))
```
## Transversal rules
- One action per run: follow only the matching action file.
- Functional behavior only: never couple a test to implementation details.
- Never compromise quality for speed.
