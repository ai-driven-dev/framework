---
name: 02-brand
description: Write a project's brand, from its code or from scratch. Use when the user wants to set or capture a project's identity, users, tone and references. Not for tokens, components, screens, or journeys.
argument-hint: request
---
# Brand

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
  prepare -->|"no engine, or a brand already written"| stop((stop))
```

Each box is a file: read it, then do what it says.

## Transversal rules

- Speak only to ask or to give the final reply.
- Otherwise call tools.
- Run every command from the project root, the working directory.
- Write only `aidd_docs/ui/brand.md`, never in the code.
- After each write, fix what the hook or `node <engine> validate` reports.
- Leave what [engine](references/engine.md) says a later step owes.
- Never bypass a hook.
- Commit and push only when asked.
