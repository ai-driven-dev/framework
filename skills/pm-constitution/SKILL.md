---
name: pm-constitution
description: >-
  Generates a project constitution from an initial idea and business context.
  Use when starting a new project to define vision, objectives, and constraints.
---

# Create Constitution

## Goal

Transform a raw idea into a structured constitution document that frames the project vision, measurable objectives, and critical constraints.

## Rules

- Focus on strategic framing, not implementation details
- Keep the constitution to 1-2 pages maximum
- Every objective must be measurable
- Constraints must be binary (negotiable or not)
- Anti-over-engineering rules are mandatory
- Requirements started from $ARGUMENTS
- **Standalone usage** — when invoked directly (not through an agent), present the deliverable and ask for user approval

## Quick Start

```text
Create a constitution for my SaaS project management tool
```

## Workflow

```mermaid
flowchart LR
    A[Analyze idea] --> B[Ask clarifying questions] --> C[Wait for response] --> D[Draft constitution] --> E[Challenge gate] --> F[Save constitution.md]
```

### Step 1: Analyze & Clarify

**Do:**

1. Analyze the idea and business context from $ARGUMENTS
2. Ask clarifying questions about vision, target users, and known constraints
3. **WAIT FOR USER RESPONSE**

**Success criteria:** All key dimensions understood (vision, users, constraints, metrics)

### Step 2: Draft Constitution

**Do:**

1. Read the template from Resources. Follow its exact structure — same headings, same table columns, same formats. Do not add, remove, or rename sections.
2. Fill in each placeholder (`[...]`) with project-specific content
3. Highlight any assumptions made

**Success criteria:** All template sections completed with exact heading names preserved, assumptions flagged

### Step 3: Challenge Gate

**Do:**

1. Read the template from Resources
2. Verify every template section exists in the output with the exact same heading name and no section was added beyond what the template defines
3. Verify format requirements: (none — structure only for this skill)

**Success criteria:** All template sections present and format requirements met. If any section is missing or any format is wrong, STOP — fix it. Do NOT proceed until structurally complete.

### Step 4: Save

**Do:**

1. Save as `{{DOCS}}/memory/internal/constitution.md`

**Success criteria:** File saved and accessible

## Resources

| Type     | Path                                      | Description                  |
| -------- | ----------------------------------------- | ---------------------------- |
| Template | `{{DOCS}}/templates/pm/constitution.md`  | Constitution template |
