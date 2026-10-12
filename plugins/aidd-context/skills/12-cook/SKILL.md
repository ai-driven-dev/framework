---
name: 12-cook
description: Manages project recipes and practical guides. Use when the user wants to find a recipe, document a technique, research improvements, follow an existing guide, or check that its steps are usable.
argument-hint: recipe
---

# Cook

```mermaid
flowchart LR
    unnamed([unnamed recipe]) --> list
    named-new([new recipe]) --> research
    named-update([update recipe]) --> research
    named-research([research topic]) --> research
    named-apply([apply recipe]) --> apply
    named-validate([validate recipe or all]) --> validate
    list -->|list only| listed([listed])
    list -->|create, update, or reselect for research| research
    list -->|select or reselect to apply| apply
    list -->|resume dedup| upsert
    list -->|reselect to validate| validate
    research -->|unnamed or stale number| list
    research -->|standalone research| researched([researched])
    research -->|create, update, or selected insights| upsert
    upsert -->|new or substantial, missing verified results| research
    upsert -->|new, before dedup| list
    upsert -->|written| validate
    validate -->|stale number| list
    validate -->|CLI absent or unsupported| unavailable([validation unavailable])
    validate -->|standalone, pass| validated([validated])
    validate -->|standalone, findings| findings([findings])
    validate -->|upsert, pass| saved([saved])
    validate -->|upsert, findings: repair at Scaffold| upsert
    apply -->|unnamed or stale number| list
    apply -->|report only or chosen steps complete| reported([reported])
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

## Transversal rules

- Never maintain a separate recipe index.
