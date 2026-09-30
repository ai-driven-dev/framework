---
name: 05-improve
description: Reads complete conversation evidence, measures visible cost, and recommends minimal improvements. Use when the user wants to improve a conversation, reduce wasted time or tokens, or choose files to revise. Not for delivery review or automatic edits.
argument-hint: conversation | export
---
# Improve

```mermaid
flowchart LR
  start([conversation ID or export]) --> read-conversation
  read-conversation -->|complete| recommend --> target-edits
  read-conversation -->|unavailable| unavailable([stop])
  target-edits --> question([ask next intent]) --> stop([stop])
```

## Actions

Run all three actions without confirmation. Read only the next action file.

| Action | Does |
| --- | --- |
| read-conversation | freeze complete evidence and measure visible cost |
| recommend | analyze relevant scopes and merge grounded findings |
| target-edits | render minimal edits and an executable prompt |

## Transversal rules

- Stop if the exact complete transcript is unavailable.
- Assess only named artifacts alongside conversation behavior.
- Never invent metrics, coverage, status, or private reasoning.
- Keep the project read-only; write only the unique temporary report.
