---
name: 05-review
description: Reviews work and says whether it is ready, naming each defect with its fix. Use when the user wants a change or diff reviewed. Not for fixing what the review finds, and not for auditing a whole codebase.
argument-hint: work | plan
---

# Review

## Actions

```mermaid
flowchart LR
  prepare["prepare<br>actions/01-prepare.md"] --> review["review<br>actions/02-review.md"]
  review --> conclude["conclude<br>actions/03-conclude.md"]
  prepare -->|"empty diff"| stop((stop))
  prepare -->|"axes named without a plan"| axes((user names a plan)) --> prepare
  prepare -->|"work and axes settled"| review["actions/02-review.md"]
  review --> conclude["actions/03-conclude.md"]
  conclude -->|"no task folder"| keep((user chooses to keep the report)) --> conclude
  conclude -->|"rubric: blocked"| blocked([blocked])
  conclude -->|"rubric: changes-requested"| changes([changes-requested])
  conclude -->|"rubric: approve"| approve([approve])
```

Each box is a file: read it, then do what it says.

## Transversal rules

- Speak only to ask or to give the final reply; otherwise call tools.
- Read only: leave the app and its checks unrun, and change nothing but the report.
- Judge this work alone, and no earlier round.
