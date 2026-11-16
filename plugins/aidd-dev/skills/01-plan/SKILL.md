---
name: 01-plan
description: Turn a request, ticket, or file into a phased implementation plan. Use to plan a feature before building, or to turn a ticket into phases. Not for writing code or reviewing a diff.
argument-hint: request | ticket | file
---
# Plan

## Actions

```mermaid
flowchart LR
  capture["capture<br>actions/01-capture.md"] --> explore["explore<br>actions/02-explore.md"]
  explore -->|"the code opens a question"| explore
  explore -->|"a decision blocks"| user((user answers))
  user --> explore
  explore -->|"nothing blocks"| conclude["conclude<br>actions/03-conclude.md<br>script: scripts/validate-plan.cjs"]
  conclude -->|"correct: revise, ask again"| conclude
  conclude -->|"explore more"| explore
  conclude -->|"approve"| done((done))
```

Each box is a file: read it, then do what it says.

## Transversal rules

- Speak only to ask or to give the final reply; otherwise call tools.
- Plan only: the plan files are the only files you write.
