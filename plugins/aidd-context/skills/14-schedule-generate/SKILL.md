---
name: 14-schedule-generate
description: Configures scheduled agent tasks and tests their prompts when a user wants to automate a workflow or check an existing schedule.
---

# Scheduled tasks

```mermaid
flowchart LR
  request([new task]) --> configure["actions/01-configure.md"]
  configure --> test["actions/02-test.md"]
  existing([test an existing task]) --> test
  test --> report((test result))
```

## Transversal rules

- For a new task, start by reading [configure](actions/01-configure.md).
- For a test request on an existing task, start by reading [test](actions/02-test.md).
