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

### Scope Boundary

**Reference constitution constraints by name, do not restate the values.** When a decision is driven by a constitution constraint (e.g., budget, team size, compliance), cite the constraint name and reference the constitution document instead of copying the full constraint definition.

## Quick Start

```text
Make architecture decisions based on our PRD
```

## Workflow

```mermaid
flowchart LR
    A[Read PRD & constitution] --> B[Extract requirements] --> C[Evaluate options] --> D[Component diagram] --> E[Data model] --> F[API contracts] --> G[Challenge gate] --> H[Save architecture.md]
```

### Step 1: Extract Requirements

**Do:**

1. Read the PRD and constitution from $ARGUMENTS or referenced files
2. Extract functional requirements and NFRs that drive architecture decisions

**Success criteria:** All architecture-driving requirements identified

### Step 2: Evaluate Options

**Do:**

1. Read the template from Resources. Follow its exact structure — same headings, same table columns, same formats. Do not add, remove, or rename sections.
2. For each decision area (stack, components, data model, API, infrastructure):
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

1. Read the template from Resources
2. Verify every template section exists in the output with the exact same heading name and no section was added beyond what the template defines
3. Verify format requirements:
   - Trade-offs in weighted matrix format

**Success criteria:** All template sections present and format requirements met. If any section is missing or any format is wrong, STOP — fix it. Do NOT proceed until structurally complete.

### Step 5: Save

**Do:**

1. Save as `{{DOCS}}/memory/internal/architecture.md`

**Success criteria:** File saved and accessible

## Resources

| Type     | Path                                           | Description            |
| -------- | ---------------------------------------------- | ---------------------- |
| Input    | `{{DOCS}}/memory/internal/constitution.md`            | Project constraints    |
| Input    | `{{DOCS}}/memory/internal/prd.md`                     | Product requirements   |
| Template | `{{DOCS}}/templates/aidd/memory/architecture.md` | Architecture template |
| Template | `{{DOCS}}/templates/dev/adr.md`              | ADR template           |
