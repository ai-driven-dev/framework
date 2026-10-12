---
name: 02-demo
description: Show a journey in a browser as one short named video labelled with the observed outcome. Use when a journey, such as a qa.md scenario, needs a demonstration a reviewer can watch. Do NOT use to verify acceptance criteria, review a diff, or fix the application.
argument-hint: journey | candidate
---

# Demo

```mermaid
flowchart LR
  journey["journey + candidate"] --> record["record"] --> videos["one video per journey"]
```

## Actions

Read only the next action's file before running it.

| #   | Action   | Does                                                      |
| --- | -------- | --------------------------------------------------------- |
| 01  | `record` | Record, normalize, validate, and label one video per journey |

## Transversal rules

- Run against a candidate and never patch the application.
- Never delete data not proven test-only.
- Never invent a step or an expected outcome; both come from the journey.
- Never decide where a video goes; the caller does.
- Never spawn agents. Keep state-changing browser work sequential.
- Do not narrate transitions or successful checks. Report only a blocker, a required decision, or the final paths.
