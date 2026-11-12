---
name: 05-review
description: Reviews work and says whether it is ready, naming each defect with its fix, when the user wants a change or diff reviewed.
argument-hint: work | plan
---

# Review

```mermaid
flowchart LR
  entry([work or plan]) --> prepare["actions/01-prepare.md"]
  prepare -->|"no work to review"| stop((stop))
  prepare <-->|"functional named without plan or criteria"| user((user answers))
  prepare --> review["actions/02-review.md"]
  review --> conclude["actions/03-conclude.md"]
  conclude <-->|"no task folder or plan to hold the report"| user
  conclude -->|"round misses the template"| conclude
  conclude -->|"approve"| approve([approve])
  conclude -->|"changes-requested"| changes([changes-requested])
  conclude -->|"blocked"| blocked([blocked])
```

## Transversal rules

- Speak only to ask or to give the final reply; otherwise call tools.
- Read only: never run the app or its checks.
- Change nothing but the report: no code, no test, no config.
- Judge this work alone, never an earlier round.
