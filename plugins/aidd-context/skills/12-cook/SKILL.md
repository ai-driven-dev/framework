---
name: 12-cook
description: Manage project recipes/how-to sheets by listing, creating, updating, researching, applying, or validating a recipe. Use for recipe, cook, /cook, list, new, update, research, apply, validate.
argument-hint: recipe
---

# Cook

```mermaid
flowchart LR
    unnamed --> list
    named-new --> research
    named-update --> research
    named-apply --> apply
    named-validate --> validate
    list --> done
    list --> research
    research --> upsert --> validate --> done
    validate -->|findings| upsert
    apply --> done
```

Run the flow above. Read only the next action file.

| Action | Does |
| --- | --- |
| list | list project and bundled recipes |
| research | research one recipe or topic |
| upsert | create or update one recipe |
| apply | apply one existing recipe |
| validate | validate one or all recipes |

## Transversal rules

- Read the next action file before running it.
