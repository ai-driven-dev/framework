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
- Acceptance criteria MUST use Given/When/Then Gherkin syntax as shown in the template. Tables are NOT a valid substitute.
- Non-Goals section is mandatory (not optional)
- Scope in 3 tiers: MVP / Next Release / Never
- No technical implementation details (that's architecture)
- All template sections are mandatory in the output. For content already covered by constitution or brief, write a 1-2 sentence summary + reference link — never omit the section entirely.
- Requirements started from $ARGUMENTS
- **Standalone usage** — when invoked directly (not through an agent), present the deliverable and ask for user approval

## Quick Start

```text
Generate the PRD from our product brief
```

## Workflow

```mermaid
flowchart LR
    A[Read brief] --> B[Clarify priorities] --> C[Generate PRD sections] --> D[Highlight invisibles] --> E[Challenge gate] --> F[Save prd.md]
```

### Step 1: Read & Clarify

**Do:**

1. Read the brief from $ARGUMENTS or referenced files
2. Ask clarifying questions about personas, priorities, and constraints
3. **WAIT FOR USER RESPONSE**

**Success criteria:** All priorities and constraints understood

### Step 2: Generate PRD

**Do:**

1. Read the template from Resources. Follow its exact structure — same headings, same table columns, same formats. Do not add, remove, or rename sections.
2. Highlight the "invisibles" (Non-Goals, Edge Cases, Error States, Risks, Security, Assumptions)

**Success criteria:** All template sections completed, invisibles highlighted

### Step 3: Challenge Gate

**Do:**

1. Read the template from Resources
2. Verify every template section exists in the output with the exact same heading name and no section was added beyond what the template defines
3. Verify format requirements:
   - Acceptance criteria in Given/When/Then Gherkin format
   - Scope in 3 tiers (MVP / Next Release / Never)

**Success criteria:** All template sections present and format requirements met. If any section is missing or any format is wrong, STOP — fix it. Do NOT proceed until structurally complete.

### Step 4: Save

**Do:**

1. Save as `{{DOCS}}/memory/internal/prd.md`

**Success criteria:** File saved and accessible

## Resources

| Type     | Path                                          | Description          |
| -------- | --------------------------------------------- | -------------------- |
| Input    | `{{DOCS}}/memory/internal/product_brief.md`   | Validated brief      |
| Input    | `{{DOCS}}/memory/internal/constitution.md`    | Project constitution |
| Template | `{{DOCS}}/templates/pm/prd.md`                | PRD template         |
