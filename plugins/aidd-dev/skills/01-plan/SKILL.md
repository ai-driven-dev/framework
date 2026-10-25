---
name: 01-plan
description: Turn a request, ticket, or file into a phased implementation plan. Use to plan a feature before building, or to turn a ticket into phases. Not for writing code or reviewing a diff.
argument-hint: request | ticket | file
---
# Plan

## Actions

```mermaid
flowchart LR
  capture --> explore
  explore -->|"the code opens a question"| explore
  explore -->|"a decision blocks"| user((user answers))
  user --> explore
  explore -->|"nothing blocks"| conclude
  conclude -->|"correct: revise, ask again"| conclude
  conclude -->|"explore more"| explore
  conclude -->|"approve"| done((done))
```

Read an action's file, then do what it says.

| Action | File |
| ------ | ---- |
| capture | [actions/01-capture.md](actions/01-capture.md) |
| explore | [actions/02-explore.md](actions/02-explore.md) |
| conclude | [actions/03-conclude.md](actions/03-conclude.md) |

## Transversal rules

- Speak only to ask or to give the final reply; otherwise call tools.
- Plan only: the plan files are the only files you write.
