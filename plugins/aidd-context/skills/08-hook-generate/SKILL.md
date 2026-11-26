---
name: 08-hook-generate
description: Creates, updates or removes a project hook in each host AI tool's native format, when the user wants an action to run at a lifecycle moment.
argument-hint: need | update name | remove name
---

# Hook Generate

```mermaid
flowchart LR
  entry([need]) --> frame["actions/01-frame.md"]
  frame <-->|"operation, name, hosts and need to confirm"| user((user answers))
  frame -->|"no host can do it"| unsupported((unsupported))
  frame --> plan["actions/02-plan.md"]
  plan <-->|"plan to approve"| user
  plan -->|"revision or writer refusal"| frame
  plan -->|"cancelled"| cancelled((cancelled))
  plan --> write["actions/03-write.md"]
  write -->|"writer error"| stopped((stopped))
  write -->|"remove done"| done((written))
  write --> verify["actions/04-verify.md"]
  verify -->|"trial failed"| plan
  verify <-->|"trial to approve"| user
  verify -->|"trial declined"| unverified((run not verified))
  verify --> verified((verified))
```

## Transversal rules

- If a cited reference cannot be read, stop and report the missing file.
- Write the hook only in the project, never in a user or global scope.
