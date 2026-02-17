---
name: extract-milestones
description: >-
  Extract and sequence implementation milestones from PRD and backlog.
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

## Quick Start

```text
Extract milestones from our PRD and user stories
```

## Workflow

```mermaid
flowchart LR
    A[Read PRD & stories] --> B[Group into milestones] --> C[Define GO/NO-GO] --> D[Gantt chart] --> E[Critical path] --> F[Validate constraints] --> G[Review] --> H[Save milestones.md]
```

### Step 1: Group Stories into Milestones

**Do:**

1. Read the PRD, user stories and constitution from $ARGUMENTS or referenced files
2. Group stories into 3-6 milestones by dependency and value:
   - M0: Project setup, CI/CD, infrastructure
   - M1: Core value proposition (MVP)
   - M2+: Incremental value additions

**Success criteria:** Stories grouped into coherent, sequenced milestones

### Step 2: Define Milestones

**Do:**

1. For each milestone, define:
   - Objective (what is delivered and demonstrable)
   - Features included (user stories)
   - GO/NO-GO criteria (measurable and binary)
   - Dependencies (what must be done before)
   - Estimated duration

**Success criteria:** Each milestone fully defined with binary GO/NO-GO criteria

### Step 3: Plan & Validate

**Do:**

1. Generate a Gantt chart (Mermaid) showing the sequence with parallel streams
2. Identify the critical path (longest sequential dependency chain)
3. Validate total effort against constitution constraints (budget, deadline)

**Success criteria:** Gantt chart generated, critical path identified, constraints validated

### Step 4: Review & Save

**Do:**

1. Present for review
2. **WAIT FOR USER APPROVAL**
3. Save as `aidd_docs/tasks/milestones.md`

**Success criteria:** Milestones validated and saved

## Resources

| Type     | Path                                     | Description            |
| -------- | ---------------------------------------- | ---------------------- |
| Input    | `aidd_docs/memory/prd.md`              | Product requirements   |
| Input    | `aidd_docs/memory/constitution.md`     | Project constraints    |
| Template | `aidd_docs/templates/pm/milestones.md` | Milestones template    |
