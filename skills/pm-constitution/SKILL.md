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

## Quick Start

```text
Create a constitution for my SaaS project management tool
```

## Workflow

```mermaid
flowchart LR
    A[Analyze idea] --> B[Ask clarifying questions] --> C[Wait for response] --> D[Draft constitution] --> E[Review & approve] --> F[Save constitution.md]
```

### Step 1: Analyze & Clarify

**Do:**

1. Analyze the idea and business context from $ARGUMENTS
2. Ask clarifying questions about vision, target users, and known constraints
3. **WAIT FOR USER RESPONSE**

**Success criteria:** All key dimensions understood (vision, users, constraints, metrics)

### Step 2: Draft Constitution

**Do:**

1. Draft the constitution with all sections using the template below
2. Present for review, highlighting any assumptions made
3. **WAIT FOR USER APPROVAL**

**Success criteria:** All sections completed, assumptions flagged

### Step 3: Save

**Do:**

1. Save as `{{DOCS}}/memory/internal/constitution.md`

**Success criteria:** File saved and accessible

## Resources

| Type     | Path                                      | Description                  |
| -------- | ----------------------------------------- | ---------------------------- |
| Template | `{{DOCS}}/templates/pm/constitution.md`  | Constitution template below  |

### Constitution Template

```markdown
# Constitution - [Project Name]

## Vision
[1-2 clear sentences]

## North Star Metric
- **Metric**: [precise definition]
- **Success threshold**: [target value]
- **Measurement method**: [how to measure]

## Non-negotiable Constraints
| Category | Constraint | Justification |
| --- | --- | --- |
| Technical | ... | ... |
| Quality | ... | ... |
| Security | ... | ... |
| Budget | ... | ... |
| Timeline | ... | ... |

## Decision Rules
1. [Rule 1]
2. [Rule 2]
3. [Rule 3]

## Anti-over-engineering
- [Principle 1]
- [Principle 2]
```
