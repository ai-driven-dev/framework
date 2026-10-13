---
name: 05-rule-generate
description: Create, update, publish or delete a coding rule across host AI tools. Use when adding, changing or removing a rule, convention or coding standard. Not for skills, agents or hooks.
argument-hint: topic | auto
---

# Rule Generate

```mermaid
flowchart LR
  manual & auto & publish & delete --> capture-rule
  capture-rule -->|approve/publish/delete| write-rule
  capture-rule -->|revise| capture-rule
  capture-rule -->|keep/cancel| stop
  write-rule -->|written| validate
  write-rule -->|refused| stop
  validate --> result
```

## Actions

Read each numbered action file in `actions/` before executing it.

| Action | Does |
| --- | --- |
| capture-rule | prepare, compare and resolve |
| write-rule | publish the approved result |
| validate | check affected files |

## Transversal rules

- Create/update: capture confirmation is not approval. Present the full assessed candidate, including new; await subsequent user approval before any rule/request/publication write. Repeat after candidate/resolution/evidence changes.
- Existing changes require explicit identified-source/publication permissions.
- Keep/cancel leaves project bytes unchanged.
