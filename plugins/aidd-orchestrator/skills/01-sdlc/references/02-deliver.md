# 02 - Deliver

## Behavior

Plan the contract, then give one implementation agent the whole plan. When phases are ready, deliver them in waves instead: one agent and checkout per ready phase, merge each, launch the phases the merge made ready, and finalize once all are integrated.

## Rules

- A phase is ready when its dependencies are met and it shares no file with a running phase.
- Prepare and finalize a delegated plan through the implementation skill; each agent's brief is its phase file.
- After each merge, run the checks the phase affects. A `partial` or failing phase goes back to an agent with what remains.
- The caller owns delegation, integration, plan status and final acceptance; the validation skills own their checks and repair loops.
- Include architecture conformance whenever the project documents architecture.
- Run an end-to-end journey last, only when the plan calls for one.
- Send only the clean committed candidate to Check.

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
    Integrate["Merge the phase and run the checks it affects"]
    Finalize["/aidd-dev:02-implement finalize"]
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
  PlanArtifact -- "Whole plan." --> Executor
  PlanArtifact -- "One agent and checkout per ready phase." --> Executor
  Executor --> Implement
  Implement --> Assert
  Assert -- "Delegated phase." --> Integrate
  Integrate -- "Partial or failing: what remains." --> Executor
  Integrate -- "Phases this merge made ready." --> Executor
  Integrate -- "Every phase integrated." --> Finalize
  Assert -- "Whole plan, no journey required." --> Commit
  Finalize -- "No journey required." --> Commit
  Assert -- "Whole plan, journey required: run it last." --> Test
  Finalize -- "Journey required: run it last." --> Test
  Test -- "After the journey succeeds, commit the result." --> Commit
  Test -- "Return a failed journey for repair." --> Executor
  Commit --> CommittedCandidate
  CommittedCandidate --> Check

  classDef skill fill:#DBEAFE,stroke:#2563EB,color:#1E3A8A,stroke-width:2px
  classDef agent fill:#F3E8FF,stroke:#9333EA,color:#581C87,stroke-width:2px
  classDef artifact fill:#DCFCE7,stroke:#16A34A,color:#14532D,stroke-width:2px
  classDef zone fill:#F1F5F9,stroke:#64748B,color:#0F172A,stroke-width:2px

  class Plan,Implement,Assert,Finalize,Test,Commit skill
  class Executor agent
  class Contract,PlanArtifact,CommittedCandidate artifact
  class Integrate,Check zone
```
