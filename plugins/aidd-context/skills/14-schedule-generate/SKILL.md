---
name: 14-schedule-generate
description: Configures a scheduled workflow and tests its full skill chain on demand before asking the user to enable recurrence.
---

# Scheduled tasks

```mermaid
flowchart LR
  request([new task]) --> configure["actions/01-configure.md"]
  configure -->|"draft only"| draft((draft))
  configure --> test["actions/02-test.md"]
  existing([test an existing task]) --> test
  test <-->|"approve trial"| trial((user))
  test -->|"fix and rerun"| test
  test -->|"all criteria pass"| passed((verified run))
  passed --> activate{enable schedule?}
  activate -->|"user approves"| enabled((verify schedule))
  activate -->|"declined"| inactive((keep inactive))
  test -->|"blocked or declined"| stop((reported))
```

## Transversal rules

- For a new task, start by reading [configure](actions/01-configure.md).
- For a test request on an existing task, start by reading [test](actions/02-test.md).
- Until the user explicitly approves executing the trial, inspect workflow skills and their data read-only, and never invoke a workflow step or write its destination.
