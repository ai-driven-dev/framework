---
name: 08-hook-generate
description: Generates a hook, a handler run at a lifecycle event, across the host AI tools, when the user wants to create or scaffold one.
argument-hint: event | action
---

# Hook Generate

```mermaid
flowchart LR
  event([event]) --> capture["actions/01-capture-hook.md"]
  action([action]) --> capture
  capture & write & validate -->|"a cited reference cannot be read"| missing((plugin not installed))
  capture -->|"every target tool skipped"| notool((no tool left))
  capture -->|"a target, scope or decision to confirm"| user((user answers)) --> capture
  capture --> write["actions/02-write-hook.md"] --> validate["actions/03-validate.md"]
  validate -->|"a check fails"| validate
  validate -->|"a fix outside the confirmed scope or not completable"| invalid((write target invalid))
  validate -->|"every check passes"| done((hook written))
```

## Transversal rules

- If a cited reference cannot be read, stop and report that the plugin is not installed in this host.
- Write every file in English, unless the user asks otherwise.
