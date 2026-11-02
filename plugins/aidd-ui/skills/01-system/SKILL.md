---
name: 01-system
description: Lay a web project's design system, from nothing or from its code, or carry a token or component change to its new versions. Use when the user wants to set up, extract, or change a design system. Not for screens, journeys, or reviews.
argument-hint: request | change
---
# System

## Actions

```mermaid
flowchart LR
  prepare["prepare<br>actions/01-prepare.md<br>script: impact"] --> write["write<br>actions/02-write.md<br>script: tokens"]
  write --> conclude["conclude<br>actions/03-conclude.md<br>script: validate"]
  conclude --> done((done))
  prepare -->|"no engine, no web UI, or impact refused"| stop((stop))
```

Each box is a file: read it, then do what it says.

## Transversal rules

- Speak only to ask or to give the final reply; otherwise call tools.
- Write only under `aidd_docs/ui/`: never the code, never `tokens.css` by hand.
- A record written or changed is `proposed`; only a person validates it.
- Commit and push only when asked; `tokens.css` stays tracked.
