# 02 - Deliver

## Behavior

Turn the contract into a proportional plan, then give one executor the whole plan or delegate ready independent phases. For phase delegation, the caller owns preparation, dependencies, write isolation, integration, and finalization; give each executor its scope, criteria, checkout, validation resources, and commit policy. Integrate prerequisites before starting dependent phases.

The executor implements its scope and calls the validation skills, which own their checks and repair loops. Include architecture conformance whenever the project documents architecture. Run an end-to-end journey after every other validation when the plan calls for one, and none otherwise. Finalize delegated phases together after integration and required validation.

Commit and push the validated work through the commit skill. Send only the clean committed candidate and its evidence to Check.

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
    Integrate["Integrate phases"]
    Test["/aidd-dev:06-test"]
    Finalize["Finalize if phases were delegated"]
    Commit["/aidd-vcs:01-commit"]
  end

  subgraph HandoffStage["Hand off the candidate"]
    direction TB
    CommittedCandidate["$committed_candidate"]
    Check["03 Check"]
  end

  Contract --> Plan
  Plan --> PlanArtifact
  PlanArtifact -- "Whole plan, or ready independent phases." --> Executor
  Executor -- "Assigned plan or phase." --> Implement
  Implement --> Assert
  Assert --> Integrate
  Integrate -- "More ready phases." --> Executor
  Integrate -- "No required end-to-end journey." --> Finalize
  Integrate -- "Run required end-to-end journey last." --> Test
  Test -- "Journey passed." --> Finalize
  Test -- "Return a failed journey for repair." --> Executor
  Finalize -- "Acceptance failed; repair affected phase." --> Executor
  Finalize --> Commit
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
