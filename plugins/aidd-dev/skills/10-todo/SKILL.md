---
name: 10-todo
description: Split the user prompt into independent todos, run one implementer agent per todo in parallel (each refines its todo first), and report a minimal table. Use when the user says "todo", "/todo", or asks to fan out a multi-part request into parallel implementations.
---

# Todo

Turn one prompt into N independent todos, implement them in parallel, report a table.

## Actions

```markdown
@actions/01-todo.md
```
