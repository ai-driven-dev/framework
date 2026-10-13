---
name: 05-rule-generate
description: Create, update, publish or delete a coding rule across host AI tools. Use when adding, changing or removing a rule, convention or coding standard. Not for skills, agents or hooks.
argument-hint: topic | auto
---

# Rule Generate

```mermaid
flowchart TD
  manual[Manual: topic] --> capture-rule
  auto[Auto: propose then select] --> capture-rule
  publish & delete --> capture-rule
  capture-rule -->|create/update| decision[Assessed candidate]
  decision -->|revise/clarify| capture-rule
  decision -->|keep/cancel| stop
  decision -->|approved| write-rule
  capture-rule -->|publish/delete confirmed| write-rule
  write-rule -->|written| validate
  write-rule -->|refused| stop
  validate --> result
```

## Actions

Read only the next action in `actions/` and its cited reference sections.

| Action | Does |
| --- | --- |
| capture-rule | frame, compare and decide |
| write-rule | publish the approved result |
| validate | check affected files |

## Transversal rules

- Missing/unreadable installed reference: stop.
- Create/update: capture confirmation is not approval. Present the full assessed candidate, including new; await subsequent user approval before any rule/request/publication write. Repeat after candidate/resolution/evidence changes.
- Existing changes require explicit identified-source/publication permissions.
- Keep/cancel leaves project bytes unchanged.
