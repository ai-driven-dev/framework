---
name: 01-brainstorm
description: Clarify a vague idea through questions. Use when the user has a half-formed idea, ambiguous request, or asks to brainstorm, discover, refine, or clarify. Not for artifact gap scans, planning, or code.
argument-hint: idea
---
# Brainstorm

## Actions

```mermaid
flowchart LR
  capture["capture<br>actions/01-capture.md"] --> explore["explore<br>actions/02-explore.md"]
  explore -->|"ask questions"| user((user answers))
  user --> explore
  explore -->|"clear enough, or user stops"| conclude["conclude<br>actions/03-conclude.md"]
  conclude -->|"correct: revise, show again"| conclude
  conclude -->|"explore more"| explore
  conclude -->|"approve: offer where to keep it"| persist["persistence<br>references/persistence.md"] --> done((done))
```

Each box is a file: read it, then do what it says.

## Transversal rules

- Clarify only: never plan or code.
- Ask a question only if its answer changes the outcome.
- Talk about the idea, never the skill's steps or files.
- After questions, approval or persistence options, wait.
- When the user wants to stop or asks for a summary, go to conclude and produce the brief in the chat.
