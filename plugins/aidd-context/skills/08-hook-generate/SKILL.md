---
name: 08-hook-generate
description: Generate a hook, a handler that runs at a lifecycle event, across the host AI tools. Use when the user wants to create, scaffold, or refactor a hook, or automate an action at a lifecycle point. Not for other artifacts like skills or rules.
argument-hint: event | action
---

# Hook Generate

```mermaid
flowchart LR
  event([event]) --> capture["actions/01-capture-hook.md"]
  action([action]) --> capture
  capture -->|"a cited file cannot be read"| missing((asset missing))
  capture -->|"every target tool skipped"| notool((no tool left))
  capture -->|"scope or tool needs an answer"| user((user answers)) --> capture
  capture --> write["actions/02-write-hook.md"] --> validate["actions/03-validate.md"]
  validate -->|"a check fails"| validate
  validate -->|"a failure cannot be resolved"| invalid((write target invalid))
  validate -->|"every check passes"| done((hook written))
```

## Transversal rules

- If a cited reference cannot be read, stop and report that the plugin is not installed in this host.
- Write every file in English, unless the user asks otherwise.
