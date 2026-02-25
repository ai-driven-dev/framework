---
name: pm-change-brief
description: >-
  Generates a change brief documenting the as-is to to-be gap for a brownfield evolution.
  Use when you need to clarify what changes and what stays the same on an existing system.
---

# Create Change Brief

## Goal

Clarify the gap between current behavior (as-is) and expected behavior (to-be) for a specific evolution on an existing system.

## Rules

- Always document the current behavior first, before describing the target
- Explicitly list what does NOT change
- Quantify business impact when possible
- One change brief per feature or coherent block of changes
- Requirements started from $ARGUMENTS
- **Standalone usage** — when invoked directly (not through an agent), present the deliverable and ask for user approval

## Quick Start

```text
Create a change brief for adding multi-tenant support
```

## Workflow

```mermaid
flowchart LR
    A[Analyze request] --> B[Document as-is] --> C[Clarify to-be] --> D[Draft brief] --> E[Calculate RICE] --> F[Challenge gate] --> G[Save change-brief.md]
```

### Step 1: Analyze & Document Current State

**Do:**

1. Analyze the change request from $ARGUMENTS
2. If `prd.md` or `constitution.md` exist, read them to enrich the "What Does NOT Change" section with product-level preservation context and to ground success criteria in project constraints and values
3. Document the current behavior (as-is) by reading relevant code
4. Ask clarifying questions about the expected behavior (to-be)
5. **WAIT FOR USER RESPONSE**

**Success criteria:** Current behavior documented, target behavior understood

### Step 2: Draft Change Brief

**Do:**

1. Read the template from Resources. Follow its exact structure — same headings, same table columns, same formats. Do not add, remove, or rename sections.
2. Calculate RICE score for prioritization
3. Identify regression risks

**Success criteria:** All template sections completed, RICE calculated, risks identified

### Step 3: Challenge Gate

**Do:**

1. Read the template from Resources
2. Verify every template section exists in the output with the exact same heading name and no section was added beyond what the template defines
3. Verify format requirements: (none — structure only for this skill)

**Success criteria:** All template sections present and format requirements met. If any section is missing or any format is wrong, STOP — fix it. Do NOT proceed until structurally complete.

### Step 4: Save

**Do:**

1. Save as `{{DOCS}}/tasks/YYYY-MM-DD-{change-name}/change-brief.md`

**Success criteria:** File saved and accessible

## Resources

| Type     | Path                                          | Description                              |
| -------- | --------------------------------------------- | ---------------------------------------- |
| Input    | `{{DOCS}}/memory/internal/system_overview.md` | System overview                          |
| Input    | `{{DOCS}}/memory/internal/prd.md`             | Product spec (if available)              |
| Input    | `{{DOCS}}/memory/internal/constitution.md`    | Project constraints & values (if available) |
| Template | `{{DOCS}}/templates/pm/change_brief.md`       | Change brief template                    |
