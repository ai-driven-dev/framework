---
name: architecture-decision
description: >-
  Generate justified architecture decisions from PRD and project constraints.
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

## Quick Start

```text
Make architecture decisions based on our PRD
```

## Workflow

```mermaid
flowchart LR
    A[Read PRD & constitution] --> B[Extract requirements] --> C[Evaluate options] --> D[Component diagram] --> E[Data model] --> F[API contracts] --> G[Anti-overeng check] --> H[Review] --> I[Save architecture.md]
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
3. Define API contracts for main endpoints
4. Choose infrastructure based on NFR requirements

**Success criteria:** Diagrams and contracts complete

### Step 4: Validate & Save

**Do:**

1. Apply anti-over-engineering check: is this the simplest architecture that works?
2. Present for review
3. **WAIT FOR USER APPROVAL**
4. Save as `aidd_docs/memory/architecture.md`

**Success criteria:** Architecture validated, anti-over-engineering check passed

## Resources

| Type     | Path                                           | Description            |
| -------- | ---------------------------------------------- | ---------------------- |
| Input    | `aidd_docs/memory/constitution.md`            | Project constraints    |
| Input    | `aidd_docs/memory/prd.md`                     | Product requirements   |
| Template | `aidd_docs/templates/aidd/memory/architecture.md` | Architecture template |
| Template | `aidd_docs/templates/dev/adr.md`              | ADR template           |
