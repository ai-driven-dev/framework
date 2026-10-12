---
name: 05-rule-generate
description: Create, update, publish or delete a coding rule across host AI tools. Use when adding, changing or removing a rule, convention or coding standard. Not for skills, agents or hooks.
argument-hint: topic | auto
---

# Rule Generate

```mermaid
flowchart LR
  request --> capture-rule
  capture-rule -->|create/update| assess-existing-rules
  capture-rule -->|publish/delete| write-rule
  assess-existing-rules -->|revise| assess-existing-rules
  assess-existing-rules -->|approve| write-rule
  assess-existing-rules -->|keep/cancel| stop
  write-rule -->|written| validate
  write-rule -->|refused| stop
  validate --> result
```

## Actions

Read each numbered action file in `actions/` before executing it.

| Action | Does |
| --- | --- |
| capture-rule | confirm intent and destinations |
| assess-existing-rules | compare policies and resolve findings |
| write-rule | publish the approved result |
| validate | check affected files |
