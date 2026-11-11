---
name: 05-review
description: Reviews work and says whether it is ready, naming each defect with its fix. Use when the user wants a change or diff reviewed. Not for fixing what the review finds, and not for auditing a whole codebase.
argument-hint: work | plan
---

# Review

## Actions

```mermaid
flowchart LR
  work([work]) --> prepare["actions/01-prepare.md"]
  plan([plan]) --> prepare
  prepare -->|"no work to review"| stop((stop))
  prepare -->|"functional named without a plan or criteria"| axes((user names a plan or criteria)) --> prepare
  prepare -->|"work and axes settled"| review["actions/02-review.md"]
  review --> conclude["actions/03-conclude.md"]
  conclude -->|"no task folder named or in the plan"| keep((user chooses to keep the report)) --> conclude
  conclude -->|"round misses a template field"| conclude
  conclude -->|"rubric: blocked"| blocked([blocked])
  conclude -->|"rubric: changes-requested"| changes([changes-requested])
  conclude -->|"rubric: approve"| approve([approve])
```

Each box is a file: read it, then do what it says.

## Transversal rules

- Speak only to ask or to give the final reply; otherwise call tools.
- Read only: leave the app and its checks unrun, and change nothing but the report.
- Judge this work alone, and no earlier round.
