# 02 - Deliver

## Behavior

Turn the contract into a proportional plan, then give one executor the whole plan. When the plan has ready independent phases, delegate them instead: prepare the plan through the implementation skill, dispatch the ready phases through the batch skill, one executor per phase with its phase file as the brief, and finalize the integrated plan through the implementation skill. A `partial` or failed phase goes back to an executor with what remains.

The caller owns delegation, integration, plan status, and final acceptance; the validation skills own their checks and repair loops. Include architecture conformance whenever the project documents architecture.

Send only the clean committed candidate and its evidence to Check.

```mermaid
---
title: Deliver the candidate
---
flowchart TD
  subgraph PlanStage["Plan the delivery"]
    direction TB
    Contract["$contract"]
    Plan["/aidd-dev:01-plan"]
    PlanArtifact["$plan"]
  end

  subgraph ExecuteStage["Execute and validate the plan"]
    direction TB
    Executor(["@aidd-dev:executor"])
    Implement["/aidd-dev:02-implement"]
    Assert["/aidd-dev:03-assert"]
    Batch["/aidd-dev:10-batch"]
    Finalize["/aidd-dev:02-implement finalize"]
    Commit["/aidd-vcs:01-commit"]
  end

  subgraph HandoffStage["Hand off the candidate"]
    direction TB
    CommittedCandidate["$committed_candidate"]
    Check["03 Check"]
  end

  Contract --> Plan
  Plan --> PlanArtifact
  PlanArtifact -- "Whole plan." --> Executor
  PlanArtifact -- "Ready independent phases." --> Batch
  Batch -- "One executor per phase." --> Executor
  Executor --> Implement
  Implement --> Assert
  Assert -- "Whole plan." --> Commit
  Assert -- "Phase." --> Batch
  Batch -- "Partial or failed phase." --> Executor
  Batch -- "Every phase integrated." --> Finalize
  Finalize -- "Failure: repair the phase." --> Executor
  Finalize --> Commit
  Commit --> CommittedCandidate
  CommittedCandidate --> Check

  classDef skill fill:#DBEAFE,stroke:#2563EB,color:#1E3A8A,stroke-width:2px
  classDef agent fill:#F3E8FF,stroke:#9333EA,color:#581C87,stroke-width:2px
  classDef artifact fill:#DCFCE7,stroke:#16A34A,color:#14532D,stroke-width:2px
  classDef zone fill:#F1F5F9,stroke:#64748B,color:#0F172A,stroke-width:2px

  class Plan,Batch,Implement,Assert,Finalize,Commit skill
  class Executor agent
  class Contract,PlanArtifact,CommittedCandidate artifact
  class Check zone
```
