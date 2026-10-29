# Guides by goal

> [!TIP]
> Pick your goal and run its skills in order.
> Dashed boxes are optional.

## Start

| Goal | Run |
| --- | --- |
| Join an existing project | `/aidd-context:00-onboard` |
| Start a new project | `/aidd-context:01-bootstrap`, then `/aidd-context:02-project-memory` |
| See what is installed, or which skill fits | `/aidd-context:11-explore` |

## Build

### Make a small change

```mermaid
flowchart TD
  subgraph z0["Code"]
    direction LR
    n0["/aidd-dev:01-plan"] --> n1["/aidd-dev:02-implement"] --> n2["/aidd-dev:03-assert"]
  end
  subgraph z1["Review"]
    direction LR
    n3["/aidd-dev:05-review"]
  end
  z0 --> z1
  classDef spec fill:#0b7285,stroke:#0b7285,color:#fff
  classDef specOpt fill:#cff4fc,stroke:#0b7285,stroke-dasharray:4 3,color:#0b4a57
  classDef code fill:#6f42c1,stroke:#6f42c1,color:#fff
  classDef codeOpt fill:#e9ddff,stroke:#6f42c1,stroke-dasharray:4 3,color:#3b1d78
  classDef ship fill:#c2410c,stroke:#c2410c,color:#fff
  classDef shipOpt fill:#ffe1d1,stroke:#c2410c,stroke-dasharray:4 3,color:#7a2606
  classDef plain fill:#0969da,stroke:#0969da,color:#fff
  classDef plainOpt fill:#ddf4ff,stroke:#0969da,stroke-dasharray:4 3,color:#0a3069
  class n0,n1,n2 code
  class n3 ship
  style z0 fill:none,stroke:#8c959f
  style z1 fill:none,stroke:#8c959f
```

### Build a feature

```mermaid
flowchart TD
  subgraph z0["Specify"]
    direction LR
    n0["/aidd-refine:01-brainstorm<br/><i>if the need is unclear</i>"] --> n1["/aidd-pm:04-spec<br/><i>the contract</i>"]
  end
  subgraph z1["Code"]
    direction LR
    n2["/aidd-dev:01-plan"] --> n3["/aidd-dev:02-implement"] --> n4["/aidd-dev:06-test<br/><i>more coverage or a browser journey</i>"] --> n5["/aidd-dev:03-assert"]
  end
  subgraph z2["Review and ship"]
    direction LR
    n6["/aidd-dev:05-review"] --> n7["/aidd-refine:02-challenge<br/><i>does it answer the request?</i>"] --> n8["/aidd-vcs:01-commit"] --> n9["/aidd-vcs:02-pull-request<br/><i>opens a draft</i>"]
  end
  z0 --> z1 --> z2
  classDef spec fill:#0b7285,stroke:#0b7285,color:#fff
  classDef specOpt fill:#cff4fc,stroke:#0b7285,stroke-dasharray:4 3,color:#0b4a57
  classDef code fill:#6f42c1,stroke:#6f42c1,color:#fff
  classDef codeOpt fill:#e9ddff,stroke:#6f42c1,stroke-dasharray:4 3,color:#3b1d78
  classDef ship fill:#c2410c,stroke:#c2410c,color:#fff
  classDef shipOpt fill:#ffe1d1,stroke:#c2410c,stroke-dasharray:4 3,color:#7a2606
  classDef plain fill:#0969da,stroke:#0969da,color:#fff
  classDef plainOpt fill:#ddf4ff,stroke:#0969da,stroke-dasharray:4 3,color:#0a3069
  class n0,n1 specOpt
  class n2,n3,n5 code
  class n4 codeOpt
  class n6,n8,n9 ship
  class n7 shipOpt
  style z0 fill:none,stroke:#8c959f
  style z1 fill:none,stroke:#8c959f
  style z2 fill:none,stroke:#8c959f
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
  end
  subgraph z2["Review"]
    direction LR
    n3["/aidd-dev:05-review"]
  end
  z0 --> z1 --> z2
  classDef spec fill:#0b7285,stroke:#0b7285,color:#fff
  classDef specOpt fill:#cff4fc,stroke:#0b7285,stroke-dasharray:4 3,color:#0b4a57
  classDef code fill:#6f42c1,stroke:#6f42c1,color:#fff
  classDef codeOpt fill:#e9ddff,stroke:#6f42c1,stroke-dasharray:4 3,color:#3b1d78
  classDef ship fill:#c2410c,stroke:#c2410c,color:#fff
  classDef shipOpt fill:#ffe1d1,stroke:#c2410c,stroke-dasharray:4 3,color:#7a2606
  classDef plain fill:#0969da,stroke:#0969da,color:#fff
  classDef plainOpt fill:#ddf4ff,stroke:#0969da,stroke-dasharray:4 3,color:#0a3069
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
  end
  subgraph z1["Review"]
    direction LR
    n2["/aidd-dev:05-review"]
  end
  z0 --> z1
  classDef spec fill:#0b7285,stroke:#0b7285,color:#fff
  classDef specOpt fill:#cff4fc,stroke:#0b7285,stroke-dasharray:4 3,color:#0b4a57
  classDef code fill:#6f42c1,stroke:#6f42c1,color:#fff
  classDef codeOpt fill:#e9ddff,stroke:#6f42c1,stroke-dasharray:4 3,color:#3b1d78
  classDef ship fill:#c2410c,stroke:#c2410c,color:#fff
  classDef shipOpt fill:#ffe1d1,stroke:#c2410c,stroke-dasharray:4 3,color:#7a2606
  classDef plain fill:#0969da,stroke:#0969da,color:#fff
  classDef plainOpt fill:#ddf4ff,stroke:#0969da,stroke-dasharray:4 3,color:#0a3069
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
  classDef spec fill:#0b7285,stroke:#0b7285,color:#fff
  classDef specOpt fill:#cff4fc,stroke:#0b7285,stroke-dasharray:4 3,color:#0b4a57
  classDef code fill:#6f42c1,stroke:#6f42c1,color:#fff
  classDef codeOpt fill:#e9ddff,stroke:#6f42c1,stroke-dasharray:4 3,color:#3b1d78
  classDef ship fill:#c2410c,stroke:#c2410c,color:#fff
  classDef shipOpt fill:#ffe1d1,stroke:#c2410c,stroke-dasharray:4 3,color:#7a2606
  classDef plain fill:#0969da,stroke:#0969da,color:#fff
  classDef plainOpt fill:#ddf4ff,stroke:#0969da,stroke-dasharray:4 3,color:#0a3069
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
  classDef code fill:#6f42c1,stroke:#6f42c1,color:#fff
  classDef plain fill:#0969da,stroke:#0969da,color:#fff
  class batch,a,b,c code
  class request,summary plain
```

### Retry until a command passes

```mermaid
flowchart LR
  goal(["Your goal<br/>and a success command"]) --> forsure["/aidd-dev:09-for-sure"] --> run["Work on a step"] --> check{"Command<br/>passes?"}
  check -->|no| run
  check -->|yes| done(["Done"])
  classDef code fill:#6f42c1,stroke:#6f42c1,color:#fff
  classDef plain fill:#0969da,stroke:#0969da,color:#fff
  class forsure,run code
  class goal,done plain
```

## Understand and decide

### Investigate a technical unknown

```mermaid
flowchart TD
  subgraph z0["Investigate"]
    direction LR
    n0["/aidd-pm:05-spike"]
  end
  subgraph z1["Follow up"]
    direction LR
    n1["/aidd-pm:10-task"]
    n2["/aidd-pm:04-spec"]
  end
  z0 --> z1
  classDef spec fill:#0b7285,stroke:#0b7285,color:#fff
  classDef specOpt fill:#cff4fc,stroke:#0b7285,stroke-dasharray:4 3,color:#0b4a57
  classDef code fill:#6f42c1,stroke:#6f42c1,color:#fff
  classDef codeOpt fill:#e9ddff,stroke:#6f42c1,stroke-dasharray:4 3,color:#3b1d78
  classDef ship fill:#c2410c,stroke:#c2410c,color:#fff
  classDef shipOpt fill:#ffe1d1,stroke:#c2410c,stroke-dasharray:4 3,color:#7a2606
  classDef plain fill:#0969da,stroke:#0969da,color:#fff
  classDef plainOpt fill:#ddf4ff,stroke:#0969da,stroke-dasharray:4 3,color:#0a3069
  class n0 spec
  class n1,n2 codeOpt
  style z0 fill:none,stroke:#8c959f
  style z1 fill:none,stroke:#8c959f
```

### Other ways to decide

| Goal | Run |
| --- | --- |
| Sharpen a vague idea | `/aidd-refine:01-brainstorm` |
| Find gaps in an idea, stories, a PRD or a spec | `/aidd-refine:03-shadow-areas` |
| Check the facts in a text | `/aidd-refine:04-fact-check` |
| Audit a codebase, read-only | `/aidd-dev:04-audit` |

## Plan the product

### How the planning skills connect

```mermaid
flowchart LR
  brief["/aidd-pm:06-product-brief"] --> epic["/aidd-pm:07-epic"] --> stories["/aidd-pm:02-user-stories"]
  prd["/aidd-pm:03-prd"] --> spec["/aidd-pm:04-spec"]
  amigos["/aidd-pm:08-three-amigos<br/><i>refines an Epic or a Story</i>"] -.-> epic
  amigos -.-> stories
  classDef plan fill:#0b7285,stroke:#0b7285,color:#fff
  classDef side fill:#ddf4ff,stroke:#0969da,stroke-dasharray:4 3,color:#0a3069
  class brief,epic,stories,prd,spec plan
  class amigos side
```

| Goal | Run |
| --- | --- |
| Add a task, a defect or a spike to the backlog | `/aidd-pm:10-task`, `/aidd-pm:09-defect`, `/aidd-pm:05-spike` |
| Read a ticket | `/aidd-pm:01-ticket-info` |
| Triage, refine, order and check the backlog | `/aidd-orchestrator:02-backlog` |

## Let the framework drive

| Goal | Run |
| --- | --- |
| Deliver a request end to end | `/aidd-orchestrator:01-sdlc` |
| Turn issues into pull requests without you | `/aidd-orchestrator:00-async-dev` |

> [!NOTE]
> Start a request with `interactive` to approve the contract, the plan and the outcome.

## Learn and extend

| Goal | Run |
| --- | --- |
| Record a decision or a lesson | `/aidd-context:10-learn` |
| Follow a how-to sheet | `/aidd-context:12-cook` |
| Improve how you work with the AI | `/aidd-refine:05-improve` |

| Create | Run |
| --- | --- |
| A skill | `/aidd-context:04-skill-generate` |
| A rule | `/aidd-context:05-rule-generate` |
| An agent | `/aidd-context:06-agent-generate` |
| A command | `/aidd-context:07-command-generate` |
| A hook | `/aidd-context:08-hook-generate` |
| Something, kind unknown | `/aidd-context:03-context-generate` |

Bundled how-to sheets: [MCP installation](../plugins/aidd-context/skills/12-cook/assets/recipes/mcp-installation.md), [token optimization](../plugins/aidd-context/skills/12-cook/assets/recipes/token-optimization.md), [the AIDDy mascot in the ChatGPT desktop app](../plugins/aidd-context/skills/12-cook/assets/recipes/install-aiddy-in-codex.md).

## Prove it works

| Goal | Run |
| --- | --- |
| Check a change in a browser, with video evidence | `/aidd-qa:01-acceptance-qa` |
| Start counting tokens (opt-in, local) | `/aidd-telemetry:00-init` |
| See what a task cost in tokens | `/aidd-telemetry:01-usage` |

Every skill is described in the [catalog](CATALOG.md).
