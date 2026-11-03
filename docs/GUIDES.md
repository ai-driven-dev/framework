# Guides by goal

> [!TIP]
> Follow the steps in order, or jump to your goal.
> Dashed boxes are optional.

| Step | Goal |
| --- | --- |
| [1. Start](#1-start) | Join a project, start one, or look around |
| [2. Memory](#2-memory) | Give the AI a memory of the project |
| [3. Harness engineering](#3-harness-engineering) | Create your skills, rules, agents, commands and hooks |
| [4. Flows](#4-flows) | Build, fix, refactor, ship, plan, decide, verify |
| [5. Learn](#5-learn) | Keep what the work teaches you |
| [6. Update](#6-update) | Keep the memory and the plugins current |

## 1. Start

| Goal | Run |
| --- | --- |
| Join an existing project | `/aidd-context:00-onboard` |
| Start a new project | `/aidd-context:01-bootstrap` |
| See what is installed, or which skill fits | `/aidd-context:11-explore` |

## 2. Memory

| Goal | Run |
| --- | --- |
| Give the AI a memory of the project | `/aidd-context:02-project-memory setup` |

What it creates: [Concepts](CONCEPTS.md#project-memory).

## 3. Harness engineering

| Create | Run |
| --- | --- |
| A skill | `/aidd-context:04-skill-generate` |
| A rule | `/aidd-context:05-rule-generate` |
| An agent | `/aidd-context:06-agent-generate` |
| A command | `/aidd-context:07-command-generate` |
| A hook | `/aidd-context:08-hook-generate` |
| Something, kind unknown | `/aidd-context:03-context-generate` |
| Follow a how-to sheet | `/aidd-context:12-cook` |

Bundled how-to sheets:

- [Connect your services](../plugins/aidd-context/skills/12-cook/assets/recipes/connect-services.md)
- [Token optimization](../plugins/aidd-context/skills/12-cook/assets/recipes/token-optimization.md)
- [The AIDDy mascot in the ChatGPT desktop app](../plugins/aidd-context/skills/12-cook/assets/recipes/install-aiddy-in-codex.md)

## 4. Flows

### Build a feature

| Goal | Run |
| --- | --- |
| Deliver a request end to end | `/aidd-orchestrator:01-sdlc` |
| Turn issues into pull requests without you | `/aidd-orchestrator:00-async-dev` |
| Go step by step | The skills below, in order |

> [!NOTE]
> Delegate it all when you are sure of the task.
> Start the request with `interactive` to approve the contract, the plan and the outcome (yellow).

```mermaid
flowchart TD
  subgraph onboard["Onboarding"]
    direction TB
    start(["/aidd-context:00-onboard<br/>guides you through every step"])
    subgraph memory["Memory, once per project"]
      direction TB
      projectMemory["/aidd-context:02-project-memory"]
    end
    subgraph frame["Frame: write the contract"]
      direction TB
      request(["your request"]) --> ticket["/aidd-pm:01-ticket-info"] --> brainstorm["/aidd-refine:01-brainstorm"] --> spec["/aidd-pm:04-spec"] --> approveContract(["approve the contract"])
    end
    subgraph deliver["Deliver: build and validate"]
      direction TB
      plan["/aidd-dev:01-plan"] --> approvePlan(["approve the plan"]) --> implement["/aidd-dev:02-implement"] --> assert["/aidd-dev:03-assert"] --> commit["/aidd-vcs:01-commit"]
      assert -. "until checks pass" .-> implement
    end
    subgraph check["Check: independent review"]
      direction TB
      review["/aidd-dev:05-review"] --> challenge["/aidd-refine:02-challenge"] --> approveOutcome(["approve the outcome"]) --> pr["/aidd-vcs:02-pull-request"]
    end
    start --> memory --> frame --> deliver --> check
  end

  classDef skill fill:#e9ddff,stroke:#8250df,color:#3b1d78
  classDef opt fill:#fff,stroke:#8250df,stroke-dasharray:4 3,color:#3b1d78
  classDef you fill:#fff8c5,stroke:#9a6700,color:#633c01
  classDef entry fill:#fff,stroke:#8250df,stroke-width:3px,color:#3b1d78
  classDef plain fill:#eaeef2,stroke:#57606a,color:#24292f
  class projectMemory,spec,plan,implement,assert,commit,review,challenge,pr skill
  class ticket,brainstorm opt
  class approveContract,approvePlan,approveOutcome you
  class request plain
  class start entry
  style onboard fill:none,stroke:#8250df,stroke-width:2px
  style memory fill:none,stroke:#8c959f
  style frame fill:none,stroke:#8c959f
  style deliver fill:none,stroke:#8c959f
  style check fill:none,stroke:#8c959f
```

### Make a small change

```mermaid
flowchart TD
  subgraph z0["Code"]
    direction LR
    n0["/aidd-dev:01-plan"] --> n1["/aidd-dev:02-implement"] --> n2["/aidd-dev:03-assert"]
    n2 -. "until checks pass" .-> n1
  end
  subgraph z1["Review"]
    direction LR
    n3["/aidd-dev:05-review"]
  end
  z0 --> z1
  classDef spec fill:#cff4fc,stroke:#0b7285,color:#0b4a57
  classDef specOpt fill:#ffffff,stroke:#0b7285,stroke-dasharray:4 3,color:#0b4a57
  classDef code fill:#e9ddff,stroke:#8250df,color:#3b1d78
  classDef codeOpt fill:#ffffff,stroke:#6f42c1,stroke-dasharray:4 3,color:#3b1d78
  classDef ship fill:#ffe1d1,stroke:#c2410c,color:#7a2606
  classDef shipOpt fill:#ffffff,stroke:#c2410c,stroke-dasharray:4 3,color:#7a2606
  classDef plain fill:#ddf4ff,stroke:#0969da,color:#0a3069
  classDef plainOpt fill:#ffffff,stroke:#0969da,stroke-dasharray:4 3,color:#0a3069
  class n0,n1,n2 code
  class n3 ship
  style z0 fill:none,stroke:#8c959f
  style z1 fill:none,stroke:#8c959f
```

### Fix a bug

```mermaid
flowchart TD
  subgraph z0["Specify"]
    direction LR
    n0["/aidd-pm:09-defect<br/><i>if no issue exists</i>"]
  end
  subgraph z1["Code"]
    direction LR
    n1["/aidd-dev:08-debug<br/><i>reproduces with a test, then fixes</i>"] --> n2["/aidd-dev:03-assert"]
    n2 -. "until checks pass" .-> n1
  end
  subgraph z2["Review"]
    direction LR
    n3["/aidd-dev:05-review"]
  end
  z0 --> z1 --> z2
  classDef spec fill:#cff4fc,stroke:#0b7285,color:#0b4a57
  classDef specOpt fill:#ffffff,stroke:#0b7285,stroke-dasharray:4 3,color:#0b4a57
  classDef code fill:#e9ddff,stroke:#8250df,color:#3b1d78
  classDef codeOpt fill:#ffffff,stroke:#6f42c1,stroke-dasharray:4 3,color:#3b1d78
  classDef ship fill:#ffe1d1,stroke:#c2410c,color:#7a2606
  classDef shipOpt fill:#ffffff,stroke:#c2410c,stroke-dasharray:4 3,color:#7a2606
  classDef plain fill:#ddf4ff,stroke:#0969da,color:#0a3069
  classDef plainOpt fill:#ffffff,stroke:#0969da,stroke-dasharray:4 3,color:#0a3069
  class n0 specOpt
  class n1,n2 code
  class n3 ship
  style z0 fill:none,stroke:#8c959f
  style z1 fill:none,stroke:#8c959f
  style z2 fill:none,stroke:#8c959f
```

### Refactor or harden code

```mermaid
flowchart TD
  subgraph z0["Code"]
    direction LR
    n0["/aidd-dev:07-refactor"] --> n1["/aidd-dev:03-assert"]
    n1 -. "until checks pass" .-> n0
  end
  subgraph z1["Review"]
    direction LR
    n2["/aidd-dev:05-review"]
  end
  z0 --> z1
  classDef spec fill:#cff4fc,stroke:#0b7285,color:#0b4a57
  classDef specOpt fill:#ffffff,stroke:#0b7285,stroke-dasharray:4 3,color:#0b4a57
  classDef code fill:#e9ddff,stroke:#8250df,color:#3b1d78
  classDef codeOpt fill:#ffffff,stroke:#6f42c1,stroke-dasharray:4 3,color:#3b1d78
  classDef ship fill:#ffe1d1,stroke:#c2410c,color:#7a2606
  classDef shipOpt fill:#ffffff,stroke:#c2410c,stroke-dasharray:4 3,color:#7a2606
  classDef plain fill:#ddf4ff,stroke:#0969da,color:#0a3069
  classDef plainOpt fill:#ffffff,stroke:#0969da,stroke-dasharray:4 3,color:#0a3069
  class n0,n1 code
  class n2 ship
  style z0 fill:none,stroke:#8c959f
  style z1 fill:none,stroke:#8c959f
```

### Commit and open a pull request

```mermaid
flowchart TD
  subgraph z0["Ship"]
    direction LR
    n0["/aidd-vcs:01-commit"] --> n1["/aidd-vcs:02-pull-request<br/><i>opens a draft</i>"] --> n2["/aidd-vcs:03-release-tag<br/><i>to cut a release</i>"]
  end
  classDef spec fill:#cff4fc,stroke:#0b7285,color:#0b4a57
  classDef specOpt fill:#ffffff,stroke:#0b7285,stroke-dasharray:4 3,color:#0b4a57
  classDef code fill:#e9ddff,stroke:#8250df,color:#3b1d78
  classDef codeOpt fill:#ffffff,stroke:#6f42c1,stroke-dasharray:4 3,color:#3b1d78
  classDef ship fill:#ffe1d1,stroke:#c2410c,color:#7a2606
  classDef shipOpt fill:#ffffff,stroke:#c2410c,stroke-dasharray:4 3,color:#7a2606
  classDef plain fill:#ddf4ff,stroke:#0969da,color:#0a3069
  classDef plainOpt fill:#ffffff,stroke:#0969da,stroke-dasharray:4 3,color:#0a3069
  class n0,n1 ship
  class n2 shipOpt
  style z0 fill:none,stroke:#8c959f
```

### Run tasks in parallel

```mermaid
flowchart LR
  request(["Your request"]) --> batch["/aidd-dev:10-batch<br/><i>splits it into independent tasks</i>"]
  batch --> a["task A"] & b["task B"] & c["task C"]
  a & b & c --> summary(["One summary:<br/>task, status, result"])
  classDef code fill:#e9ddff,stroke:#8250df,color:#3b1d78
  classDef plain fill:#ddf4ff,stroke:#0969da,color:#0a3069
  class batch,a,b,c code
  class request,summary plain
```

### Plan the product

```mermaid
flowchart TD
  backlog(["/aidd-orchestrator:02-backlog<br/>triages, refines and orders it all"])
  subgraph define["Define"]
    direction TB
    brief["/aidd-pm:06-product-brief"] --> epic["/aidd-pm:07-epic"] --> stories["/aidd-pm:02-user-stories"]
    amigos["/aidd-pm:08-three-amigos<br/>refines an Epic or a Story"] -.-> epic
    amigos -.-> stories
  end
  subgraph specify["Specify"]
    direction TB
    prd["/aidd-pm:03-prd"] --> specDoc["/aidd-pm:04-spec"]
  end
  backlog --> define
  backlog --> specify
  classDef plan fill:#cff4fc,stroke:#0b7285,color:#0b4a57
  classDef side fill:#fff,stroke:#0b7285,stroke-dasharray:4 3,color:#0b4a57
  classDef entry fill:#fff,stroke:#0b7285,stroke-width:3px,color:#0b4a57
  class brief,epic,stories,prd,specDoc plan
  class amigos side
  class backlog entry
  style define fill:none,stroke:#8c959f
  style specify fill:none,stroke:#8c959f
```

| Goal | Run |
| --- | --- |
| Add a task, a defect or a spike to the backlog | `/aidd-pm:10-task`, `/aidd-pm:09-defect`, `/aidd-pm:05-spike` |
| Read a ticket | `/aidd-pm:01-ticket-info` |

### Understand and decide

| Goal | Run |
| --- | --- |
| Investigate a technical unknown | `/aidd-pm:05-spike`, then `/aidd-pm:10-task` or `/aidd-pm:04-spec` |
| Sharpen a vague idea | `/aidd-refine:01-brainstorm` |
| Challenge finished work against its plan | `/aidd-refine:02-challenge` |
| Find gaps in an idea, stories, a PRD or a spec | `/aidd-refine:03-shadow-areas` |
| Check the facts in a text | `/aidd-refine:04-fact-check` |
| Audit a codebase, read-only | `/aidd-dev:04-audit` |

### Prove it works

| Goal | Run |
| --- | --- |
| Check a change in a browser, with video evidence | `/aidd-qa:01-acceptance-qa` |
| Start counting tokens (opt-in, local) | `/aidd-telemetry:00-init` |
| See what a task cost in tokens | `/aidd-telemetry:01-usage` |

## 5. Learn

| Goal | Run |
| --- | --- |
| Record a decision or a lesson | `/aidd-context:10-learn` |
| Review a finished conversation | `/aidd-refine:05-review-conversation` |

## 6. Update

| Goal | Run |
| --- | --- |
| Refresh the project memory | `/aidd-context:02-project-memory refresh` |
| Wire the memory into another tool | `/aidd-context:02-project-memory rewire` |
| Update the plugins | [Install guide](INSTALL.md#update) |

Every skill is described in the [catalog](CATALOG.md).
