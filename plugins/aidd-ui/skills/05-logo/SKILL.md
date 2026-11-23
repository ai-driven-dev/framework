---
name: 05-logo
description: Creates or changes a project's logo by comparing directions, when the user wants to design, redesign or adjust it, not for other assets.
argument-hint: request
---
# Logo

```mermaid
flowchart LR
  prepare["actions/01-prepare.md"]
  propose["actions/02-propose.md"]
  choose["actions/03-choose.md"]
  conclude["actions/04-conclude.md"]
  entry([request]) --> prepare
  prepare --> propose
  prepare -->|"a decision blocks"| user((user answers))
  prepare -->|"no engine, or impact refused"| stop((stop))
  propose --> choose
  propose -->|"a decision blocks"| user
  propose -->|"compare reports a problem"| propose
  choose --> conclude
  choose -->|"give the page, wait"| user
  choose -->|"no direction stands out"| propose
  user -->|"answer to prepare"| prepare
  user -->|"answer to propose"| propose
  user -->|"feedback pasted"| choose
  conclude -->|"an error is left"| conclude
  conclude --> done((done))
```

## Transversal rules

- Speak only to ask or to give the final reply.
- After asking, wait for the answer.
- Otherwise call tools.
- Run the engine from the project root.
- Never read the engine's source.
- Write only the `logo-` files under `aidd_docs/ui/assets/` and `aidd_docs/ui/drafts/logo/`.
- Never write in the code, nor by hand what the engine writes.
- After each write, fix what the hook or the validation reports.
- Never bypass a hook.
- Commit and push only when asked.
