---
name: 05-review
description: Reviews a diff read-only into one verdict naming each defect and its fix, when the user wants a change checked before shipping.
argument-hint: work | plan
---

# Review

```mermaid
flowchart LR
  work([work]) --> prepare["actions/01-prepare.md"]
  plan([plan]) --> prepare
  prepare -->|"empty diff"| stop((stop))
  prepare -->|"axes named without a plan"| axes((user names a plan)) --> prepare
  prepare -->|"work and axes settled"| review["actions/02-review.md"]
  review --> conclude["actions/03-conclude.md"]
  conclude -->|"no task folder"| keep((user chooses to keep the report)) --> conclude
  conclude -->|"rubric: blocked"| blocked([blocked])
  conclude -->|"rubric: changes-requested"| changes([changes-requested])
  conclude -->|"rubric: approve"| approve([approve])
```

## Transversal rules

- Speak only to ask or to give the final reply; otherwise call tools.
- Read only: leave the app and its checks unrun, and change nothing but the report.
- Judge this work alone, and no earlier round.
