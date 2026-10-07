---
name: 01-sdlc
description: Orchestrates a request from framing to a draft pull request, autonomous or supervised, isolating implementation, independent review, and final outcome challenge. Use when the user wants to deliver a change end to end. Not for one step.
argument-hint: request | interactive request
---

# Skill: sdlc

## Behavior

Decide the mode as `mode.md` says, then read only that reference and the current zone's. Verify that every named provider is installed before calling it. A zone that cannot proceed stops the run and says what it would take to resume.

Spawn specialized agents for isolated work. Parallelize independent work when it is faster. Give each agent one focused task that a smaller model can execute. Repeat the responsible zone when delegated work returns an actionable gap.

```mermaid
---
title: SDLC orchestration
---
flowchart TD
  subgraph FrameStage["01 Frame"]
    direction TB
    Request["$request"]
    Frame["01 Frame<br/>interactive: pause on the contract"]
  end

  subgraph DeliverStage["02 Deliver"]
    direction TB
    Deliver["02 Deliver<br/>interactive: pause on the plan"]
  end

  subgraph CheckStage["03 Check"]
    direction TB
    Check["03 Check<br/>interactive: pause on the outcome"]
    PullRequest["$pull_request"]
  end

  Request --> Frame
  Frame --> Deliver
  Deliver --> Check
  Check --> PullRequest

  classDef artifact fill:#DCFCE7,stroke:#16A34A,color:#14532D,stroke-width:2px
  classDef zone fill:#F1F5F9,stroke:#64748B,color:#0F172A,stroke-width:2px

  class Request,PullRequest artifact
  class Frame,Deliver,Check zone
```

## Say when this orchestration is over

Once the draft pull request exists, and only then, run:

```shell
echo "aidd:step-end aidd-orchestrator:01-sdlc"
```

No host reports when an orchestration finished. A skill call's own result comes back in a
tenth of a second, which is the dispatch and not the completion, so a measurement that never
hears this ends the run at the next pause — and an orchestration is mostly pauses. Everything
it drove afterwards then reads as work that belonged to nothing.

## References

| #   | Reference                               |
| --- | --------------------------------------- |
| —   | [Mode](references/mode.md)              |
| 01  | [Frame](references/01-frame.md)         |
| 02  | [Deliver](references/02-deliver.md)     |
| 03  | [Check](references/03-check.md)         |
