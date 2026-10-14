---
name: 05-rule-generate
description: Create, update, publish or delete a coding rule across host AI tools. Use when adding, changing or removing a rule, convention or coding standard. Not for skills, agents or hooks.
argument-hint: topic | auto
---

# Rule Generate

```mermaid
flowchart TD
  request[Rule request] --> capture-rule
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

Read the next action in `actions/` and its references.

| Action | Does |
| --- | --- |
| `01-capture-rule.md` | frame, compare and decide |
| `02-write-rule.md` | publish the approved result |
| `03-validate.md` | check affected files |

## Transversal rules

- Missing/unreadable installed reference: stop.
- Create/update: present full assessed candidates, including new; await approval after capture confirmation before any rule/request/publication write. Renew after candidate/resolution/evidence changes.
- Existing changes require explicit identified-source/publication permissions.
- Keep/cancel leaves project bytes unchanged.
