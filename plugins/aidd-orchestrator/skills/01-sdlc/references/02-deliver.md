# 02 - Deliver

## Behavior

- **Plan:** reconcile scoped exploration, then produce the implementation plan.
- **Assign:** retain shared lifecycle and integration; delegate independent phases with their criteria, prerequisites, status-file ownership, checkout, resources, and commit policy. Use separate checkouts for parallel writers; otherwise run serially. A whole-plan executor may own all lifecycle statuses, never scope or criteria.
- **Integrate:** accept scoped changes and evidence before starting dependents; finalize against the combined candidate, with required end-to-end checks last. Reuse only evidence still valid for that candidate and scope.
- **Handoff:** commit and push through the commit capability; send the clean candidate and evidence to Check.

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
    Dispatch["Caller selects ready phases"]
    Executor(["@aidd-dev:executor"])
    Implement["/aidd-dev:02-implement"]
    Assert["/aidd-dev:03-assert"]
    Integrate["Integrate phases and finalize plan"]
    Test["/aidd-dev:06-test"]
    Commit["/aidd-vcs:01-commit"]
  end

  subgraph HandoffStage["Hand off the candidate"]
    direction TB
    CommittedCandidate["$committed_candidate"]
    Check["03 Check"]
  end

  Contract --> Plan
  Plan --> PlanArtifact
  PlanArtifact --> Dispatch
  Dispatch -- "Isolated executors for independent phases; serial otherwise." --> Executor
  Executor --> Implement
  Implement --> Assert
  Assert --> Integrate
  Integrate -- "More ready phases." --> Dispatch
  Integrate -- "No required end-to-end journey." --> Commit
  Integrate -- "Run required end-to-end journey last." --> Test
  Test -- "After the journey succeeds, commit the result." --> Commit
  Test -- "Return a failed journey for repair." --> Executor
  Commit --> CommittedCandidate
  CommittedCandidate --> Check

  classDef skill fill:#DBEAFE,stroke:#2563EB,color:#1E3A8A,stroke-width:2px
  classDef agent fill:#F3E8FF,stroke:#9333EA,color:#581C87,stroke-width:2px
  classDef artifact fill:#DCFCE7,stroke:#16A34A,color:#14532D,stroke-width:2px
  classDef zone fill:#F1F5F9,stroke:#64748B,color:#0F172A,stroke-width:2px

  class Plan,Implement,Assert,Test,Commit skill
  class Executor agent
  class Contract,PlanArtifact,CommittedCandidate artifact
  class Check zone
```
