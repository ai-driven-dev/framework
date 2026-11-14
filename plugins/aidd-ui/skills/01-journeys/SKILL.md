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
  conclude -->|"journeys to agree"| user
  user -->|"a change"| write
  conclude --> done((done))
  prepare -->|"no engine or journeys refused"| stop((stop))
```

Each box is a file: read it, then do what it says.

## Transversal rules

- Speak only to ask or to give the final reply.
- Ask with a concrete proposal, unless nothing describes the product.
- Never offer an option that only says to type an answer.
- After asking, wait for the answer.
- Name a record by its title and a state by its label.
- Never show a file name, id, heading level or rule code.
- Otherwise call tools.
- Run the engine from the project root; never read its source.
- Write only under `aidd_docs/ui/journeys/` and `aidd_docs/ui/wireframes/`.
- After each write, fix what the hook or the validation reports.
- Never bypass a hook.
- Commit and push only when asked.
