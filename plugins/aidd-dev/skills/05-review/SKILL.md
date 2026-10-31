---
name: 05-review
description: Reviews a change or a diff and says whether it is ready to ship, naming every problem with its fix. Use when the user wants a change checked before it ships. Not for fixing what the review finds, and not for auditing a whole codebase.
argument-hint: diff | plan
---

# Review

## Actions

```mermaid
flowchart LR
  prepare["prepare<br>actions/01-prepare.md"] --> review["review<br>actions/02-review.md<br>references/axis-*.md"]
  review --> conclude["conclude<br>actions/03-conclude.md"]
  prepare -->|"empty diff"| stop((stop))
  conclude --> approve([approve])
  conclude --> changes([changes-requested])
  conclude --> blocked([blocked])
  changes -.->|a later run| prepare
  blocked -.->|a later run| prepare
```

Each box is a file: read it, then do what it says.

## Transversal rules

- Speak only to ask or to give the final reply; otherwise call tools.
- Review statically: never run the app.
- Change nothing but the report: no code, no test, no config.
