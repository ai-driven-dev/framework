---
name: 'architecture-milestones'
description: 'Extracts and sequences implementation milestones from PRD and backlog. Use when you need to break down a project into sequenced, deployable milestones.'
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
- **Standalone usage** — when invoked directly (not through an agent), present the deliverable and ask for user approval

## Quick Start

```text
Extract milestones from our PRD and user stories
```

## Workflow

```mermaid
flowchart LR
    A[Read PRD & stories] --> B[Group into milestones] --> C[Define GO/NO-GO] --> D[Gantt chart] --> E[Critical path] --> F[Validate constraints] --> G[Challenge gate] --> H[Save milestones.md]
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

4. Read the template from Resources. Follow its exact structure — same headings, same table columns, same formats. Do not add, remove, or rename sections.
5. Calculate velocity and sprint estimation per milestone

**Success criteria:** Each milestone fully defined per template, velocity estimated

### Step 3: Plan & Validate

**Do:**

6. Generate a Gantt chart (Mermaid) showing the sequence with parallel streams
7. Identify the critical path (longest sequential dependency chain)
8. Validate total effort against constitution constraints (budget, deadline)

**Success criteria:** Gantt chart generated, critical path identified, constraints validated

### Step 4: Challenge Gate

**Do:**

9. Read the template from Resources
10. Verify every template section exists in the output with the exact same heading name and no section was added beyond what the template defines
11. Verify format requirements:
   - GO/NO-GO criteria binary (pass/fail, not "maybe")

**Success criteria:** All template sections present and format requirements met. If any section is missing or any format is wrong, STOP — fix it. Do NOT proceed until structurally complete.

### Step 5: Save

**Do:**

12. Save as `aidd_docs/memory/internal/milestones.md`

**Success criteria:** File saved and accessible

## Resources

| Type     | Path                                     | Description            |
| -------- | ---------------------------------------- | ---------------------- |
| Input    | `aidd_docs/memory/internal/prd.md`              | Product requirements   |
| Input    | `aidd_docs/memory/internal/constitution.md`     | Project constraints    |
| Template | `aidd_docs/templates/pm/milestones.md` | Milestones template    |
