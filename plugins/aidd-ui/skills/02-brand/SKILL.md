---
name: 02-brand
description: Write a project's brand, from its code or from scratch, or evolve it, by comparing directions. Use when the user wants to set or capture a project's identity, users, tone and references. Not for tokens, components, screens, or journeys.
argument-hint: request
---
# Brand

## Actions

```mermaid
flowchart LR
  prepare["prepare<br>actions/01-prepare.md"] --> propose["propose<br>actions/02-propose.md"]
  propose --> choose["choose<br>actions/03-choose.md"]
  choose --> conclude["conclude<br>actions/04-conclude.md"]
  prepare -->|"a decision blocks"| user((user answers))
  propose -->|"a decision blocks"| user
  choose -->|"no direction stands out"| propose
  choose -->|"give the page, wait"| user
  user --> prepare
  user --> propose
  user --> choose
  conclude -->|"an error is left"| conclude
  conclude --> done((done))
  prepare -->|"no engine"| stop((stop))
```

Each box is a file: read it, then do what it says.

## Transversal rules

- Speak only to ask or to give the final reply.
- After asking, wait for the answer.
- Otherwise call tools.
- Run the engine from the project root; never read its source.
- Write only `aidd_docs/ui/brand.md` and `aidd_docs/ui/drafts/brand/`.
- After each write, fix what the hook or the validation reports.
- Never bypass a hook.
- Commit and push only when asked.
