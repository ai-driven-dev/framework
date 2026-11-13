---
name: 05-rule-generate
description: Creates, updates or removes a coding rule across the host AI tools when the user adds or changes a convention, not for skills, agents or hooks.
argument-hint: add | update | remove
---

# Rule Generate

```mermaid
flowchart LR
  frame["actions/01-frame.md"]
  draft["actions/02-draft.md"]
  plan["actions/03-plan.md"]
  write["actions/04-write.md"]
  entry([request]) --> frame
  frame <-->|"operation, hosts and topic to confirm"| user((user answers))
  plan <-->|"candidate and paths to approve"| user
  frame -->|"add or update"| draft
  frame -->|"remove or publish"| plan
  frame -->|"no supported host"| unsupported((unsupported))
  draft --> plan
  plan -->|"approved"| write
  plan -->|"revision or refusal"| draft
  plan -->|"keep or cancel"| cancelled((cancelled))
  write -->|"no drift"| written((written))
  write -->|"refusal, drift or blocked path"| stopped((stopped))
  frame & draft & plan & write -->|"reference unreadable"| stopped
```

## Transversal rules

- If a cited reference cannot be read, stop and name it.
- Write only after the user approves the candidate shown last.
  - A choice, merge, edit or rename is not an approval: show the revision and wait.
- Change an existing source or publication only with permission naming it.
- Keep or cancel leaves project bytes unchanged.
