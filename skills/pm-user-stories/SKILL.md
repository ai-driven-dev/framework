---
name: pm-user-stories
description: >-
  Creates user stories through iterative questioning using the INVEST checklist.
  Use when you need well-structured user stories from feature requirements.
---

# Create User Stories

## Goal

Generate well-structured user stories from PRD features, organized by epic, through systematic Product Owner questioning.

## Rules

- No technical aspect, focus on user needs
- Requirements started from $ARGUMENTS
- Lean, concise approach
- 3 max questions per iteration
- Sort by implementation priority
- All checklists must be satisfied

### INVEST Checklist

- [ ] **I**ndependent — can be developed without other stories
- [ ] **N**egotiable — details can be discussed
- [ ] **V**aluable — delivers value to the user
- [ ] **E**stimable — team can estimate the effort
- [ ] **S**mall — fits in a single sprint
- [ ] **T**estable — acceptance criteria are verifiable

### Definition of Ready

- [ ] Acceptance criteria defined (Gherkin format)
- [ ] Dependencies identified
- [ ] Story points estimated (Fibonacci: 1, 2, 3, 5, 8, 13)
- [ ] No blocking questions
- [ ] Story assigned to an epic

### Definition of Done (project-level)

Stories must also satisfy the project's Definition of Done. Reference the DoD template for the full checklist:

- [ ] Acceptance criteria pass
- [ ] Code reviewed
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Deployable to staging

## Quick Start

```text
Create user stories for the epic "Authentication"
```

## Workflow

```mermaid
flowchart LR
    A[Identify epics] --> B[Clarify per epic] --> C[Write stories] --> D[Validate INVEST] --> E[Define DoD] --> F[Save]
```

### Step 1: Identify Epics from PRD

**Do:**

1. Read the PRD and extract the major functional blocks
2. Map each block to an epic using the scope 3 tiers (MVP / Next Release / Never)
3. For each epic, justify its contribution to the North Star Metric
4. Format each epic using the epic template

**Success criteria:** All PRD features mapped to epics, scope tier assigned, NSM justification documented

### Step 2: Write Stories per Epic

**Do:**

1. For each epic (starting with MVP), ask clarifying questions (3 max per iteration)
2. Write stories in canonical format: "As a [persona], I want [action] so that [benefit]"
3. Add Gherkin acceptance criteria (happy path + error + boundary)
4. Estimate each story in Fibonacci (1, 2, 3, 5, 8) — flag any story > 8 for splitting
5. Validate each story against INVEST checklist and Definition of Ready

**Success criteria:** All stories pass INVEST checklist and Definition of Ready

### Step 3: Define Project DoD

**Do:**

1. Define the project-level Definition of Done using the DoD template
2. Include standard criteria (acceptance criteria pass, code review, tests, documentation, deployable)
3. Add project-specific criteria if needed
4. Document exceptions (spike, prototype)

**Success criteria:** DoD defined and applicable to all stories

### Step 4: Save

**Do:**

1. Save epics and stories to the ticketing system

**Success criteria:** Epics and stories saved and accessible

## Resources

| Type     | Path                                     | Description          |
| -------- | ---------------------------------------- | -------------------- |
| Template | `{{DOCS}}/templates/pm/user_story.md`  | User story template  |
| Template | `{{DOCS}}/templates/pm/epic.md`        | Epic template        |
| Template | `{{DOCS}}/templates/pm/dod.md`         | Definition of Done   |
