---
name: 14-schedule-generate
description: Generates a scheduled task prompt and maps it to the chosen agent scheduler when a user wants to automate a workflow on a timer.
---

# Generate a scheduled task

```mermaid
flowchart LR
  entry([request]) --> draft["actions/01-draft.md"]
  draft <-->|"missing task detail"| user((user answers))
  draft -->|"prompt only"| ready((prompt ready))
  draft --> configure["actions/02-configure.md"]
  configure -->|"setup returned"| setup((draft with setup))
  configure -->|"host or capability unavailable"| gap((draft with limitation))
  configure -->|"readback matches"| registered((registration verified))
  configure -->|"failed or uncertain write"| unverified((registration unverified))
```

## Transversal rules

- Begin by reading [Draft the task](actions/01-draft.md) in this skill directory.
- Read each action and the asset it calls for before returning its result.
