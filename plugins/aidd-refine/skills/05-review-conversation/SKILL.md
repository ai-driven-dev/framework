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

Run each action in order without confirmation, reading only its file in `actions/` when its turn comes.

| Action | Does |
| --- | --- |
| read-conversation | load the tree and delegate one reader per child session |
| recommend | attribute each finding to one owner and draft its edit |
| target-edits | render the HTML report and ask the next intent |

## Transversal rules

- Access only the selected conversation tree and its relevant sources.
- Use recorded evidence only; every finding cites a message sequence. Mark unavailable measurements as such.
- Keep project files read-only; write only inside one unique temporary run directory.
