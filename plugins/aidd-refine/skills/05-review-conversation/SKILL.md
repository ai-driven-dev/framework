---
name: 05-review-conversation
description: Reviews a finished conversation and every session it spawned to find what cost time, tokens, or correctness, and attributes each finding to the framework, the orchestration, the host, or the project. Use when the user wants to review a conversation, understand a wasted run, or choose which instruction to fix. Not for delivery review or automatic edits.
argument-hint: conversation | export
---
# Review conversation

## Actions

```mermaid
flowchart LR
  start([conversation ID or export]) --> read["read conversation<br>actions/01-read-conversation.md"]
  read -->|complete| recommend["recommend<br>actions/02-recommend.md"]
  read -->|incomplete| unavailable((stop))
  recommend --> render["target edits<br>actions/03-target-edits.md"]
  render --> question((ask next intent))
```

Each box is a file: read it, then do what it says, without confirmation.

## Transversal rules

- Access only the selected conversation tree and its relevant sources.
- Use recorded evidence only; every finding cites a message sequence. Mark unavailable measurements as such.
- Keep project files read-only; write only inside one unique temporary run directory.
