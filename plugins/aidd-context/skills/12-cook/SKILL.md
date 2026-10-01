---
name: 12-cook
description: Manages project recipes and practical guides. Use when the user wants to find a recipe, document a technique, research improvements, follow an existing guide, or check that its steps are usable.
argument-hint: recipe
---

# Cook

```mermaid
flowchart LR
    unnamed --> list
    named-new --> research
    named-update --> research
    named-research --> research
    named-apply --> apply
    named-validate --> validate
    list -->|list only| done([done])
    list -->|create or update| research
    list -->|select to apply| apply
    research -->|standalone research| done
    research -->|create, update, or selected insights| upsert
    upsert --> validate
    validate -->|standalone, pass or findings| done
    validate -->|upsert, pass| done
    validate -->|upsert, findings: repair| upsert
    apply --> done
```

## Actions

Run the flow above. Read only the next action file.

| Action | Does |
| --- | --- |
| list | list project and bundled recipes |
| research | research one recipe or topic |
| upsert | create or update one recipe |
| apply | apply one existing recipe |
| validate | validate one or all recipes |
