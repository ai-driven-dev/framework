---
name: pm-prd
description: >-
  Generates a comprehensive PRD from a validated product brief.
  Use when you need to transform a product brief into a full Product Requirements Document.
---

# Create PRD

## Goal

Transform a validated product brief into a comprehensive PRD with all sections needed for implementation.

## Rules

- Every feature must be justified by the North Star Metric
- Acceptance criteria in Gherkin format (Given/When/Then)
- Non-Goals section is mandatory (not optional)
- Scope in 3 tiers: MVP / Next Release / Never
- No technical implementation details (that's architecture)
- Requirements started from $ARGUMENTS

## Quick Start

```text
Generate the PRD from our product brief
```

## Workflow

```mermaid
flowchart LR
    A[Read brief] --> B[Clarify priorities] --> C[Generate PRD sections] --> D[Highlight invisibles] --> E[Review & approve] --> F[Save prd.md]
```

### Step 1: Read & Clarify

**Do:**

1. Read the brief from $ARGUMENTS or referenced files
2. Ask clarifying questions about personas, priorities, and constraints
3. **WAIT FOR USER RESPONSE**

**Success criteria:** All priorities and constraints understood

### Step 2: Generate PRD

**Do:**

1. Generate the full PRD with all 15 sections:
   - Executive Summary
   - User Personas
   - Goals & Objectives
   - Core Features
   - Acceptance Criteria (Gherkin)
   - Non-Goals
   - Non-Functional Requirements
   - Technical Architecture (high-level)
   - User Experience
   - Success Metrics
   - Dependencies
   - Experiments / A/B Testing
   - Timeline & Milestones
   - Risks & Mitigations
   - Scope Boundaries (3-tier)
2. Highlight the "invisibles" (Non-Goals, Edge Cases, Error States, Risks, Security)

**Success criteria:** All 15 sections completed, invisibles highlighted

### Step 3: Review & Save

**Do:**

1. Present for review
2. **WAIT FOR USER APPROVAL**
3. Save as `{{DOCS}}/memory/internal/prd.md`

**Success criteria:** PRD validated and saved

## Resources

| Type     | Path                                  | Description          |
| -------- | ------------------------------------- | -------------------- |
| Input    | `{{DOCS}}/memory/internal/product_brief.md`  | Validated brief      |
| Input    | `{{DOCS}}/memory/internal/constitution.md`   | Project constitution |
| Template | `{{DOCS}}/templates/pm/prd.md`      | PRD template         |
