---
name: 01-plan
description: Turn a request, ticket, or file into a phased implementation plan. Use to plan a feature before building, or to turn a ticket into phases. Do NOT use to write code or review a diff.
argument-hint: request | ticket | file
---

# Plan

```mermaid
flowchart TD
  Request([request, ticket, or file]) --> gather --> explore
  explore -- UI --> wireframe --> plan
  explore -- no UI --> plan
  plan -- challenge finds gaps --> plan
  plan --> Ready([plan ready])
```

## Actions

Read only the next numbered action file in `actions/`.

| Action | Does |
| --- | --- |
| gather | identify the source and constraints |
| explore | ground scope and feasibility in evidence |
| wireframe | sketch frontend screens |
| plan | write and challenge phases |

## Transversal rules

- **Read-only.** Never write application code.
