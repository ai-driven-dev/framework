---
name: <skill-name>
description: <what it produces>. Use when the user wants to <intents>. <Not for X when needed.>
argument-hint: <what the user brings: their cases, or the artifact consumed>
---

# <Skill Name>

## Actions

```mermaid
flowchart LR
  <the journey: chain the slugs, a back-edge for a loop, an entry node per case for a branch, a quoted label per condition>
```

Read an action's file, then do what it says.

| Action | File |
| ------ | ---- |
| <slug> | [actions/<NN>-<slug>.md](actions/<NN>-<slug>.md) |

## Transversal rules

<Rules owned by no reference or single action, one per line.>

- <rule>

> Fill every `<...>` and delete this line. An angle bracket left in the written file is a bug.
