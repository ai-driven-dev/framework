---
name: architecture-decision
description: >-
  Generates justified architecture decisions from PRD and project constraints.
  Use when you need to make and document technical architecture choices for a new project.
---

# Architecture Decision

## Goal

Produce a structured architecture document where every technical choice is justified by a functional requirement or constraint from the constitution.

## Rules

- Every technology choice must link to a functional need or NFR
- No over-engineering: simplest solution that meets requirements wins
- Document trade-offs explicitly, not just the chosen option
- Anti-pattern: choosing tech by preference instead of by need
- Requirements started from $ARGUMENTS
- **Standalone usage** — when not orchestrated, run `/challenge` after saving for adversarial review

### Scope Boundary

**Reference constitution constraints by name, do not restate the values.** When a decision is driven by a constitution constraint (e.g., budget, team size, compliance), cite the constraint name and reference the constitution document instead of copying the full constraint definition.

## Quick Start

```text
Make architecture decisions based on our PRD
```

## Workflow

```mermaid
flowchart LR
    A[Read PRD & constitution] --> B[Extract requirements] --> C[Evaluate options] --> D[Component diagram] --> E[Data model] --> F[API contracts] --> G[Challenge gate] --> H[Review] --> I[Save architecture.md]
```

### Step 1: Extract Requirements

**Do:**

1. Read the PRD and constitution from $ARGUMENTS or referenced files
2. Extract functional requirements and NFRs that drive architecture decisions

**Success criteria:** All architecture-driving requirements identified

### Step 2: Evaluate Options

**Do:**

1. For each decision area (stack, components, data model, API, infrastructure):
   - List 2-3 options with pros/cons
   - Score each option against constraints using a weighted matrix
   - Recommend the best option with justification

**Success criteria:** Each decision documented with trade-offs and justification

### Step 3: Generate Diagrams & Contracts

**Do:**

1. Generate component diagram (Mermaid) showing main modules and their interactions
2. Generate data model (ERD in Mermaid) from core entities
3. Define API contracts at interface level (HTTP method, path, purpose, input/output concepts) — no request/response body examples or code snippets
4. Choose infrastructure based on NFR requirements

**Success criteria:** Diagrams and contracts complete

### Step 4: Challenge Gate

**Do:**

1. Verify the architecture against these criteria:
   - Every technology choice linked to a functional need or NFR (not team preference)
   - Trade-offs documented for each decision (not just the chosen option)
   - Anti-over-engineering: this is the simplest architecture that meets requirements
   - Data model covers all core entities from the PRD
   - API contracts consistent with user stories

**Success criteria:** All criteria pass. Flag any failing criterion for user resolution before saving.


### Step 5: Review & Save

**Do:**

1. Present for review
2. **WAIT FOR USER APPROVAL**
3. Save as `{{DOCS}}/memory/internal/architecture.md`

**Success criteria:** Architecture validated and saved

## Resources

| Type     | Path                                           | Description            |
| -------- | ---------------------------------------------- | ---------------------- |
| Input    | `{{DOCS}}/memory/internal/constitution.md`            | Project constraints    |
| Input    | `{{DOCS}}/memory/internal/prd.md`                     | Product requirements   |
| Template | `{{DOCS}}/templates/aidd/memory/architecture.md` | Architecture template |
| Template | `{{DOCS}}/templates/dev/adr.md`              | ADR template           |
