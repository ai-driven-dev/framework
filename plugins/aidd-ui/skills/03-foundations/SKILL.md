---
name: 03-foundations
description: Lay a project's design foundations, its system and tokens, from nothing or from its code, or carry a token change to its new versions. Use when the user wants to set up, extract, or change the design system or its tokens. Not for the brand, components, screens, or journeys.
argument-hint: request
---
# Foundations

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
  prepare -->|"no engine, no brand, or impact refused"| stop((stop))
```

Each box is a file: read it, then do what it says.

## Transversal rules

- Speak only to ask or to give the final reply.
- Otherwise call tools.
- Run every command from the project root, the working directory.
- Every path written in a record starts there.
- Write only `system.md`, `tokens.json` and its context files under `aidd_docs/ui/`.
- Never write in the code, nor by hand what the engine writes.
- The engine writes `history.md`, `code-debt.json`, `tokens.css` and `tokens.resolver.json`.
- After each write, fix what the hook or `node <engine> validate` reports.
- Leave what [engine](references/engine.md) says a later step owes.
- Never bypass a hook.
- Commit and push only when asked.
