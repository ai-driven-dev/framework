---
name: 01-system
description: Lay a project's design system, from nothing or from its code, or carry a token or component change to its new versions. Use when the user wants to set up, extract, or change a design system. Not for screens, journeys, or reviews.
argument-hint: request
---
# System

## Actions

```mermaid
flowchart LR
  prepare["prepare<br>actions/01-prepare.md"] --> write["write<br>actions/02-write.md"]
  write --> conclude["conclude<br>actions/03-conclude.md"]
  prepare -->|"a decision blocks"| user((user answers))
  write -->|"a decision blocks"| user
  user --> prepare
  user --> write
  conclude -->|"an error is left"| conclude
  conclude --> done((done))
  prepare -->|"no engine or impact refused"| stop((stop))
```

Each box is a file: read it, then do what it says.

## Transversal rules

- Speak only to ask or to give the final reply; otherwise call tools.
- Run every command from the project root, the working directory; every path written in a record starts there.
- Write only under `aidd_docs/ui/`, never in the code.
- After each write, fix what the hook or `node <engine> validate` reports, except what [engine](references/engine.md) says a later step owes; never bypass a hook.
- Commit and push only when asked.
