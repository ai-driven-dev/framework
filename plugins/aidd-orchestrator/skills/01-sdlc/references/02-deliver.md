# 02 - Deliver

## Behavior

Turn the contract into a proportional plan. Delegate bounded read-only exploration when useful and reconcile sources and unknowns before planning.

Own preparation, shared plan status, dependencies, integration, and finalization. Assign ready, independent phases to executors in distinct checkouts with nonconflicting validation resources. Include each assigned phase file in its scope for lifecycle-status updates only, alongside plan context, criteria, completed prerequisites, and commit policy. Run sequentially when isolation is unavailable or independence is uncertain; legacy plans retain their phase order. For a sequential whole-plan executor, grant lifecycle-status ownership of the plan and all its phases while retaining acceptance; never grant changes to scope, specifications, or criteria.

Executors implement, validate, and repair only their assigned scope without further delegation. Include architecture conformance when documented. Integrate each returned phase before starting its dependents. Finalize against the integrated candidate, including any required end-to-end journey last. Preserve passing evidence only when its candidate and scope still match.

Commit and push through the commit capability. Send the clean committed candidate and its validation evidence to Check.

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
