# 03 - Check

## Behavior

- **Validate:** dispatch a fresh validator on the committed candidate, contract, criteria, and mandatory checks.
- **Challenge:** after validation passes, dispatch a fresh checker for review and outcome challenge using that evidence.
- **Route:** send product findings to Frame, independent repairs to Todo, dependent repairs to Deliver; revalidate each repaired candidate.
- **Ship:** open the draft pull request when no actionable finding remains.

```mermaid
---
title: Check and challenge independently
---
flowchart TD
  subgraph ReviewStage["Review independently"]
    direction TB
    Contract["$contract"]
    Plan["$plan"]
    CommittedCandidate["$committed_candidate"]
    ValidationReports["$validation_reports"]
    Validator(["@aidd-dev:validator"])
    Checker(["@aidd-dev:checker"])
    Review["/aidd-dev:05-review"]
  end

  subgraph ChallengeStage["Challenge the outcome"]
    direction TB
    Challenge["/aidd-refine:02-challenge"]
  end

  subgraph RouteStage["Route the result"]
    direction TB
    Findings["$findings"]
    Frame["01 Frame"]
    Todo["/aidd-dev:10-todo"]
    Deliver["02 Deliver"]
  end

  subgraph ShipStage["Ship the reviewed candidate"]
    direction TB
    PullRequest["/aidd-vcs:02-pull-request"]
    PullRequestUrl["$pull_request_url"]
  end

  Contract --> Validator
  Plan --> Validator
  CommittedCandidate --> Validator
  ValidationReports --> Validator
  Validator -- "All criteria pass with evidence." --> Checker
  Validator -- "Fail or blocked." --> Findings
  Checker --> Review
  Review -- "Return actionable review findings." --> Findings
  Review -- "When the review clears, challenge the outcome." --> Challenge
  Challenge -- "Return actionable challenge findings." --> Findings
  Challenge -- "When the outcome is trustworthy, open the draft pull request." --> PullRequest
  Findings -- "Use product findings as the next Frame source." --> Frame
  Findings -- "Repair independent implementation findings in parallel." --> Todo
  Findings -- "Repair dependent implementation findings together." --> Deliver
  Todo --> Deliver
  PullRequest --> PullRequestUrl

  classDef skill fill:#DBEAFE,stroke:#2563EB,color:#1E3A8A,stroke-width:2px
  classDef agent fill:#F3E8FF,stroke:#9333EA,color:#581C87,stroke-width:2px
  classDef artifact fill:#DCFCE7,stroke:#16A34A,color:#14532D,stroke-width:2px
  classDef zone fill:#F1F5F9,stroke:#64748B,color:#0F172A,stroke-width:2px

  class Review,Challenge,Todo,PullRequest skill
  class Checker,Validator agent
  class Contract,Plan,CommittedCandidate,ValidationReports,Findings,PullRequestUrl artifact
  class Frame,Deliver zone
```
