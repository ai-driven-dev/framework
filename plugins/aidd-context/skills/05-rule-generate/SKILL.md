---
name: 05-rule-generate
description: Creates, updates, publishes or removes a coding rule across AI tools when a convention is set, changed or dropped, not for skills, agents or hooks.
argument-hint: add | update | remove | publish
---

# Rule Generate

```mermaid
flowchart LR
  entry([request]) --> frame["actions/01-frame.md"]
  frame <-->|"operation, hosts and topic to confirm"| user((user answers))
  frame -->|"no supported host, index declined"| unsupported((unsupported))
  frame -->|"add or update"| draft["actions/02-draft.md"]
  frame -->|"remove or publish"| plan["actions/03-plan.md"]
  draft --> plan
  plan <-->|"plan to approve"| user
  plan -->|"revision or writer refusal"| draft
  plan -->|"cancelled"| cancelled((cancelled))
  plan -->|"writer refusal on remove or publish"| stopped((stopped))
  plan --> write["actions/04-write.md"]
  write --> done((written))
  write -->|"writer error"| stopped
```

## Transversal rules

- If a cited reference cannot be read, stop and report the missing file.
- Keep the meaning of each line of an existing rule, unless the request changes it.
