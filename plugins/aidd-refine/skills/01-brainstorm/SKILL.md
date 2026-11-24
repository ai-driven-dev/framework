---
name: 01-brainstorm
description: Clarifies a vague idea through questions, when the user has a half-formed idea or asks to brainstorm, refine or clarify one.
argument-hint: idea
---

# Brainstorm

```mermaid
flowchart LR
  idea([idea]) --> capture["actions/01-capture.md"]
  capture <-->|"no idea yet"| user((user answers))
  capture --> explore["actions/02-explore.md"]
  explore <-->|"questions"| user
  explore -->|"clear enough"| conclude["actions/03-conclude.md"]
  user -->|"stop or summary"| conclude
  conclude <-->|"brief to approve, then where to keep it"| user
  conclude -->|"correction"| conclude
  conclude -->|"kept"| done((approved brief))
```

## Transversal rules

- Clarify only: never plan or code.
- Ask a question only if its answer changes the outcome.
- Talk about the idea, never the skill's steps or files.
- After questions, approval or persistence options, wait.
- When the user wants to stop or asks for a summary, read `actions/03-conclude.md` and produce the brief in the chat.
