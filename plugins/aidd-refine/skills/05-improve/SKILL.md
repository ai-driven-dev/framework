---
name: 05-improve
description: Reads complete conversation evidence, measures visible cost, and recommends minimal improvements. Use when the user wants to improve a conversation, reduce wasted time or tokens, or choose files to revise. Not for delivery review or automatic edits.
argument-hint: conversation | export
---
# Improve

```mermaid
flowchart LR
  start([conversation ID or export]) --> read-conversation
  read-conversation -->|complete| scopes{two or more scopes?}
  read-conversation -->|unavailable| unavailable([stop])
  scopes -->|no| recommend-local[recommend locally] --> target-edits
  scopes -->|yes| isolation{isolated artifact context?}
  isolation -->|yes| recommend-parallel[recommend in parallel] --> target-edits
  isolation -->|no| recommend-local
  target-edits --> question([ask next intent]) --> stop([stop])
```

## Actions

Run the flow above. Read only the next action file.

| Action | Does |
| --- | --- |
| read-conversation | freeze complete evidence and measure visible cost |
| recommend | analyze relevant scopes and merge grounded findings |
| target-edits | render minimal edits and an executable prompt |

## Transversal rules

- After resolving the source, run all three actions without pausing for confirmation.
- Analyze only a complete conversation and the exact skills or documents it names.
- Exclude every current or previous `improve` invocation and report from the analysis evidence.
- Never invent time, tokens, source coverage, or document status.
- Do not modify, stage, or persist any project file.
