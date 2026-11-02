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
  conclude --> approve([approve])
  conclude --> changes([changes-requested])
  conclude --> blocked([blocked])
```

Each box is a file: read it, then do what it says.

## Transversal rules

- Speak only to ask or to give the final reply; otherwise call tools.
- Read only: never run the app or its checks.
- Change nothing but the report: no code, no test, no config.
- Judge this work alone, never an earlier round.
