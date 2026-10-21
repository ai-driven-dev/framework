---
name: 05-review-conversation
description: Reviews a finished conversation and every session it spawned to find what cost time, tokens, or correctness, and attributes each finding to the framework, the orchestration, the host, or the project. Use when the user wants to review a conversation, understand a wasted run, or choose which instruction to fix. Not for delivery review or automatic edits.
argument-hint: conversation | export
---
# Review conversation

```mermaid
flowchart LR
  start([conversation ID or export]) --> read-conversation
  read-conversation -->|complete| recommend --> target-edits
  read-conversation -->|unavailable| unavailable([stop])
  target-edits --> question([ask next intent]) --> stop([stop])
```

## Actions

Run all three actions in order without confirmation. Read only the next file in `actions/`.

| Order | Action |
| --- | --- |
| 1 | `01-read-conversation.md` |
| 2 | `02-recommend.md` |
| 3 | `03-target-edits.md` |

## Transversal rules

- Access only the selected conversation tree and its relevant sources.
- Use recorded evidence only; every finding cites a message sequence. Mark unavailable measurements as such.
- Keep project files read-only; write only a unique temporary report.
