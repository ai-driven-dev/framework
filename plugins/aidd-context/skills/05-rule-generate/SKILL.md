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
  write-rule -->|revised| capture-rule
  write-rule -->|refused| stop
  write-rule -->|verified| result
```

## Actions

Follow the flow. Read only the next action and its references.

| Action | Does |
| --- | --- |
| capture-rule | frame, compare, plan, decide |
| write-rule | write the approved result, verify |

## Transversal rules

- Report unsupported hosts with alternatives; a lone AGENTS file identifies no installed host.
- Stop and name any installed reference that cannot be read.
- Change existing sources or publications only with explicit permission naming them.
- Write only after the user approves the candidate shown last. A choice, merge, edit or rename is not an approval: show the revision and wait.
- Keep or cancel leaves project bytes unchanged.
