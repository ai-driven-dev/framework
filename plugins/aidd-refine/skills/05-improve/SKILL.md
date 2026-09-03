---
name: 05-improve
description: Reads complete conversation evidence, recommends targeted improvements, and proposes minimal edits. Use when the user wants to improve a past or current conversation, reduce wasted time or tokens, or choose files to revise. Not for delivery review or automatic edits.
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

Run the flow above. Read only the next action file.

| Action | Does |
| --- | --- |
| read-conversation | load complete evidence and profile its cost |
| recommend | answer every improvement question with evidence |
| target-edits | map recommendations to minimal file edits and ask for the next intent |

## Transversal rules

- After resolving the source, run all three actions without pausing for confirmation.
- Analyze only a complete conversation and the exact skills or documents it names.
- Exclude every current or previous `improve` invocation and report from the analysis evidence.
- Never invent time, tokens, source coverage, or document status.
- Do not modify, stage, or persist any project file.
