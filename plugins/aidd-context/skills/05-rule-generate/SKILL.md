---
name: 05-rule-generate
description: Creates, updates, publishes or removes a coding rule across AI tools when a convention is set, changed or dropped, not for skills, agents or hooks.
argument-hint: add | update | remove | publish
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
  frame -->|"no supported host, index declined"| unsupported((unsupported))
  draft --> plan
  plan -->|"approved"| write
  plan -->|"revision or request refusal"| draft
  plan -->|"cancel"| cancelled((cancelled))
  plan & write -->|"refusal, drift or blocked path"| stopped((stopped))
  write -->|"no drift"| written((written))
```

## Transversal rules

- If a cited reference cannot be read, stop and name it.
- Write only after the user approves the candidate shown last.
