---
name: 06-review
description: Review a project's wireframes, screens, and components in the showcase, then publish the ones every state of which is OK. Use when the user wants to review, approve, or publish them. Not for writing or changing them.
argument-hint: request
---
# Review

## Actions

```mermaid
flowchart LR
  prepare["prepare<br>actions/01-prepare.md"] --> propose["propose<br>actions/02-propose.md"]
  propose --> choose["choose<br>actions/03-choose.md"]
  choose --> write["write<br>actions/04-write.md"]
  write --> conclude["conclude<br>actions/05-conclude.md"]
  prepare -->|"a decision blocks"| user((user answers))
  propose -->|"give the pages, wait"| user
  choose -->|"a state has no verdict"| user
  user --> prepare
  user --> propose
  user --> choose
  conclude -->|"an error is left"| conclude
  conclude --> done((done))
  prepare -->|"no engine, no system, or nothing to review"| stop((stop))
```

Each box is a file: read it, then do what it says.

## Transversal rules

- Speak only to ask or to give the final reply.
- After asking, wait for the answer.
- Otherwise call tools.
- Run the engine from the project root; never read its source.
- Every path written in a record starts there.
- Write only `reviews/` under `aidd_docs/ui/`.
- Never write in the code, nor by hand what the engine writes.
- Never write a capture: the user saves it.
- After each write, fix what the hook or the validation reports.
- Never bypass a hook.
- Commit and push only when asked.
