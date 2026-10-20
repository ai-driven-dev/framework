# 02 - Deliver

## Behavior

Turn the contract into a proportional plan, then give one executor the whole plan or delegate ready independent phases. For delegated phases, the caller owns preparation, dependencies, write isolation, integration, and finalization; give each executor its checkout and its phase file, and nothing the phase file already says. Resume the same executor session for its next phase, and leave its checkout untouched while it runs. Integrate prerequisites before starting dependent phases.

The executor follows the implementation skill for its assigned scope and calls the validation skills, which own their checks and repair loops. Include architecture conformance whenever the project documents architecture. Whole-plan execution keeps its normal flow; phase executors return for integration. Finalize the integrated plan once, including any required end-to-end journey after other checks and before marking it implemented.

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
    Executor(["Implementation agent"])
    Implement["/aidd-dev:02-implement"]
    Assert["/aidd-dev:03-assert"]
    Integrate["Integrate phases"]
    Finalize["Finalize integrated plan; /aidd-dev:06-test journey last when required"]
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
  Assert -- "Whole plan finalized." --> Commit
  Assert -- "Assigned phase returned." --> Integrate
  Integrate -- "More ready phases." --> Executor
  Integrate --> Finalize
  Finalize -- "Validation or journey failed; repair affected phase." --> Executor
  Finalize --> Commit
  Commit --> CommittedCandidate
  CommittedCandidate --> Check

  classDef skill fill:#DBEAFE,stroke:#2563EB,color:#1E3A8A,stroke-width:2px
  classDef agent fill:#F3E8FF,stroke:#9333EA,color:#581C87,stroke-width:2px
  classDef artifact fill:#DCFCE7,stroke:#16A34A,color:#14532D,stroke-width:2px
  classDef zone fill:#F1F5F9,stroke:#64748B,color:#0F172A,stroke-width:2px

  class Plan,Implement,Assert,Finalize,Commit skill
  class Executor agent
  class Contract,PlanArtifact,CommittedCandidate artifact
  class Check zone
```
