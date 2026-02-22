---
name: architecture-milestones
description: >-
  Extracts and sequences implementation milestones from PRD and backlog.
  Use when you need to break down a project into sequenced, deployable milestones.
---

# Extract Milestones

## Goal

Break down the PRD and backlog into sequenced, measurable milestones with GO/NO-GO criteria for each.

## Rules

- Each milestone must be independently deployable and testable
- Dependencies must be resolved: no circular dependencies allowed
- MVP is the first milestone, not a separate concept
- Every milestone has binary GO/NO-GO criteria (no "maybe")
- Maximize parallelization between streams (backend, frontend, infra)
- Requirements started from $ARGUMENTS
- **Standalone usage** — when not orchestrated, run `/challenge` after saving for adversarial review

## Quick Start

```text
Extract milestones from our PRD and user stories
```

## Workflow

```mermaid
flowchart LR
    A[Read PRD & stories] --> B[Group into milestones] --> C[Define GO/NO-GO] --> D[Gantt chart] --> E[Critical path] --> F[Validate constraints] --> G[Challenge gate] --> H[Review] --> I[Save milestones.md]
```

### Step 1: Map Epics to Milestones

**Do:**

1. Read the PRD, epics, user stories and constitution from $ARGUMENTS or referenced files
2. Map epics into 3-6 milestones by dependency and value:
   - M0: Project setup, CI/CD, infrastructure
   - M1: Core value proposition (MVP epics)
   - M2+: Incremental value additions
3. Each milestone contains one or more epics with their stories

**Success criteria:** Epics mapped into coherent, sequenced milestones

### Step 2: Define Milestones

**Do:**

1. For each milestone, define:
   - Objective (what is delivered and demonstrable)
   - Epics & stories included (with story points per epic)
   - GO/NO-GO criteria (measurable and binary)
   - Dependencies (what must be done before)
2. Calculate velocity and sprint estimation:
   - Estimated velocity (points/sprint)
   - Sprints per milestone (total points / velocity + buffer)
   - Contingency buffer (20-30%)

**Success criteria:** Each milestone fully defined with epic mapping, velocity estimation, and binary GO/NO-GO criteria

### Step 3: Plan & Validate

**Do:**

1. Generate a Gantt chart (Mermaid) showing the sequence with parallel streams
2. Identify the critical path (longest sequential dependency chain)
3. Validate total effort against constitution constraints (budget, deadline)

**Success criteria:** Gantt chart generated, critical path identified, constraints validated

### Step 4: Challenge Gate

**Do:**

1. Verify the milestones against these criteria:
   - Total effort compatible with constitution constraints (budget, deadline)
   - No circular dependencies in the dependency graph
   - Parallelization maximized between streams (backend, frontend, infra)
   - Each milestone has binary GO/NO-GO criteria (not "maybe")
   - MVP is minimum viable scope, not a disguised V1
   - Contingency buffer included (20-30%)

**Success criteria:** All criteria pass. Flag any failing criterion for user resolution before saving.


### Step 5: Review & Save

**Do:**

1. Present for review
2. **WAIT FOR USER APPROVAL**
3. Save as `{{DOCS}}/memory/internal/milestones.md`

**Success criteria:** Milestones validated and saved

## Resources

| Type     | Path                                     | Description            |
| -------- | ---------------------------------------- | ---------------------- |
| Input    | `{{DOCS}}/memory/internal/prd.md`              | Product requirements   |
| Input    | `{{DOCS}}/memory/internal/constitution.md`     | Project constraints    |
| Template | `{{DOCS}}/templates/pm/milestones.md` | Milestones template    |
