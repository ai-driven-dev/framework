---
name: 01-journeys
description: Write a persona's journeys and the wireframe of each screen they cross, from nothing or from an app's real screens. Use when the user wants to map a journey, a user flow, or wireframes. Not for styled screens, components, or reviews.
argument-hint: request
---
# Journeys

## Actions

```mermaid
flowchart LR
  prepare["prepare<br>actions/01-prepare.md"] --> write["write<br>actions/02-write.md"]
  write --> conclude["conclude<br>actions/03-conclude.md"]
  prepare -->|"a decision blocks"| user((user answers))
  user --> prepare
  conclude -->|"an error is left"| conclude
  conclude --> done((done))
  prepare -->|"no engine or journeys refused"| stop((stop))
```

Each box is a file: read it, then do what it says.

## Transversal rules

- Speak only to ask or to give the final reply.
- Otherwise call tools.
- Run every command from the project root, the working directory.
- Write only under `aidd_docs/ui/journeys/` and `aidd_docs/ui/wireframes/`.
- After each write, fix what the hook or the validation reports.
- Never bypass a hook.
- Commit and push only when asked.
